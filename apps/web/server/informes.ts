import "server-only";
import { baseSinIva, comision, instanteMadrid, sumarDias, type Cuadre } from "@adela/dominio";
import { sql } from "drizzle-orm";
import { db } from "./db";

/**
 * Informes de un periodo (normalmente un mes): ventas, tratamientos, productos, clientas, equipo y caja, y el cuadre
 * entre ventas, cobros, facturas y caja. Todo se calcula de los registros que no se modifican.
 */

type Fila = Record<string, unknown>;
const consulta = async <T extends Fila>(q: ReturnType<typeof sql>) => (await db().execute(q)) as unknown as T[];
const n = (x: unknown) => Number(x ?? 0);

export async function informe(desde: string, hasta: string) {
  const ini = instanteMadrid(desde, 0).toISOString();
  const fin = instanteMadrid(sumarDias(hasta, 1), 0).toISOString();
  const enPeriodo = (col: ReturnType<typeof sql.raw>) => sql`${col} >= ${ini} and ${col} < ${fin}`;

  const [ventasRes] = await consulta<{ ventas: number; devoluciones: number; numero: number; num_devoluciones: number; con_factura: number }>(sql`
    select coalesce(sum(total) filter (where devolucion_de is null), 0)::int as ventas,
           coalesce(sum(total) filter (where devolucion_de is not null), 0)::int as devoluciones,
           count(*) filter (where devolucion_de is null)::int as numero,
           count(*) filter (where devolucion_de is not null)::int as num_devoluciones,
           coalesce(sum(total) filter (where con_factura), 0)::int as con_factura
    from ventas where ${enPeriodo(sql.raw("creada_en"))}`);

  const porMetodo = await consulta<{ metodo: string; importe: number }>(sql`
    select p.metodo, sum(p.importe)::int as importe from pagos p
    where ${enPeriodo(sql.raw("p.cuando"))} group by p.metodo order by importe desc`);

  const porDia = await consulta<{ dia: string; total: number; numero: number }>(sql`
    select to_char(creada_en at time zone 'Europe/Madrid', 'YYYY-MM-DD') as dia, sum(total)::int as total, count(*)::int as numero
    from ventas where ${enPeriodo(sql.raw("creada_en"))} group by 1 order by 1`);

  const lineas = await consulta<{
    tipo: "tratamiento" | "bono" | "producto" | "otro";
    nombre: string;
    cantidad: number;
    total: number;
    iva: number;
    coste: number | null;
    profesional_id: string | null;
  }>(sql`
    select case when l.tratamiento_id is not null then 'tratamiento' when l.tipo_bono_id is not null then 'bono' when l.producto_id is not null then 'producto' else 'otro' end as tipo,
           coalesce(t.nombre, tb.nombre, pr.nombre, l.descripcion) as nombre,
           l.cantidad, l.total, l.iva_centesimas as iva, pr.coste_centimos as coste, v.profesional_id
    from lineas_venta l
    join ventas v on v.id = l.venta_id
    left join tratamientos t on t.id = l.tratamiento_id
    left join tipos_bono tb on tb.id = l.tipo_bono_id
    left join productos pr on pr.id = l.producto_id
    where ${enPeriodo(sql.raw("v.creada_en"))} and v.con_factura`);

  const sesionesBono = await consulta<{ nombre: string; sesiones: number }>(sql`
    select coalesce(t.nombre, 'Sin tratamiento') as nombre, sum(u.cantidad)::int as sesiones
    from usos_bono u left join tratamientos t on t.id = u.tratamiento_id
    where ${enPeriodo(sql.raw("u.cuando"))} group by 1 order by 2 desc`);

  // Tratamientos: lo cobrado y las sesiones de bono hechas.
  const tratamientos = new Map<string, { nombre: string; cantidad: number; total: number; sesionesBono: number }>();
  for (const l of lineas.filter((x) => x.tipo === "tratamiento")) {
    const t = tratamientos.get(l.nombre) ?? { nombre: l.nombre, cantidad: 0, total: 0, sesionesBono: 0 };
    t.cantidad += n(l.cantidad);
    t.total += n(l.total);
    tratamientos.set(l.nombre, t);
  }
  for (const s of sesionesBono) {
    const t = tratamientos.get(s.nombre) ?? { nombre: s.nombre, cantidad: 0, total: 0, sesionesBono: 0 };
    t.sesionesBono += n(s.sesiones);
    tratamientos.set(s.nombre, t);
  }

  const agrupar = (tipo: string) => {
    const m = new Map<string, { nombre: string; cantidad: number; total: number; coste: number | null }>();
    for (const l of lineas.filter((x) => x.tipo === tipo)) {
      const x = m.get(l.nombre) ?? { nombre: l.nombre, cantidad: 0, total: 0, coste: 0 };
      x.cantidad += n(l.cantidad);
      x.total += n(l.total);
      x.coste = l.coste === null || x.coste === null ? null : x.coste + n(l.coste) * n(l.cantidad);
      m.set(l.nombre, x);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  };

  // Clientas.
  const [clientas] = await consulta<{ nuevas: number; atendidas: number; con_compra: number; realizadas: number; no_vino: number; canceladas: number }>(sql`
    select (select count(*) from clientes where ${enPeriodo(sql.raw("creada_en"))} and anonimizada_en is null)::int as nuevas,
           (select count(distinct cliente_id) from citas where estado = 'realizada' and ${enPeriodo(sql.raw("inicio"))})::int as atendidas,
           (select count(distinct cliente_id) from ventas where cliente_id is not null and devolucion_de is null and ${enPeriodo(sql.raw("creada_en"))})::int as con_compra,
           (select count(*) from citas where estado = 'realizada' and ${enPeriodo(sql.raw("inicio"))})::int as realizadas,
           (select count(*) from citas where estado = 'no_presentada' and ${enPeriodo(sql.raw("inicio"))})::int as no_vino,
           (select count(*) from citas where estado = 'cancelada' and ${enPeriodo(sql.raw("inicio"))})::int as canceladas`);
  const mejores = await consulta<{ id: string; nombre: string; total: number; compras: number }>(sql`
    select c.id, c.nombre, sum(v.total)::int as total, count(*) filter (where v.devolucion_de is null)::int as compras
    from ventas v join clientes c on c.id = v.cliente_id
    where ${enPeriodo(sql.raw("v.creada_en"))} and c.anonimizada_en is null
    group by c.id, c.nombre having sum(v.total) > 0 order by total desc limit 10`);

  // Equipo: lo que vende cada profesional (base sin IVA) y su comisión; citas y sesiones de bono hechas.
  const profesionales = await consulta<{ id: string; nombre: string; comision_servicios: number; comision_productos: number; activo: boolean; citas: number; sesiones: number }>(sql`
    select p.id, p.nombre, p.comision_servicios, p.comision_productos, p.activo,
      (select count(*) from citas c where c.profesional_id = p.id and c.estado = 'realizada' and ${enPeriodo(sql.raw("c.inicio"))})::int as citas,
      (select coalesce(sum(u.cantidad), 0) from usos_bono u join citas c on c.id = u.cita_id where c.profesional_id = p.id and ${enPeriodo(sql.raw("u.cuando"))})::int as sesiones
    from profesionales p order by p.orden, p.nombre`);
  const equipo = profesionales
    .map((p) => {
      const suyas = lineas.filter((l) => l.profesional_id === p.id);
      const base = (tipos: string[]) => suyas.filter((l) => tipos.includes(l.tipo)).reduce((s, l) => s + baseSinIva(n(l.total), n(l.iva)), 0);
      const servicios = base(["tratamiento", "bono", "otro"]);
      const productos = base(["producto"]);
      return {
        id: p.id,
        nombre: p.nombre,
        citas: n(p.citas),
        sesionesBono: n(p.sesiones),
        servicios,
        productos,
        comisionServicios: n(p.comision_servicios),
        comisionProductos: n(p.comision_productos),
        comision: comision(servicios, n(p.comision_servicios)) + comision(productos, n(p.comision_productos)),
        activo: p.activo,
      };
    })
    .filter((p) => p.activo || p.citas || p.servicios || p.productos);
  const sinAsignar = lineas.filter((l) => !l.profesional_id).reduce((s, l) => s + baseSinIva(n(l.total), n(l.iva)), 0);

  // Caja.
  const cajas = await consulta<{ id: string; abierta_en: Date; cerrada_en: Date | null; fondo: number; esperado: number | null; contado: number | null; quien: string }>(sql`
    select s.id, s.abierta_en, s.cerrada_en, s.fondo_inicial as fondo, s.efectivo_esperado as esperado, s.efectivo_contado as contado, u.nombre as quien
    from sesiones_caja s join usuarios u on u.id = s.abierta_por
    where ${enPeriodo(sql.raw("s.abierta_en"))} order by s.abierta_en`);

  // Cuadre.
  const [cuadreRes] = await consulta<{ facturas: number; cobrado: number; pendiente: number; efectivo_pagos: number; efectivo_caja: number }>(sql`
    select (select coalesce(sum(total), 0) from facturas where fecha_expedicion between ${desde} and ${hasta})::int as facturas,
           (select coalesce(sum(p.importe), 0) from pagos p join ventas v on v.id = p.venta_id where ${enPeriodo(sql.raw("v.creada_en"))})::int as cobrado,
           (select coalesce(sum(greatest(v.total - coalesce((select sum(p.importe) from pagos p where p.venta_id = v.id), 0), 0)), 0)
              from ventas v where v.devolucion_de is null and ${enPeriodo(sql.raw("v.creada_en"))})::int as pendiente,
           (select coalesce(sum(importe), 0) from pagos where metodo = 'efectivo' and ${enPeriodo(sql.raw("cuando"))})::int as efectivo_pagos,
           (select coalesce(sum(importe), 0) from movimientos_caja where tipo in ('venta', 'devolucion') and ${enPeriodo(sql.raw("cuando"))})::int as efectivo_caja`);
  const ventasTotal = n(ventasRes!.ventas) + n(ventasRes!.devoluciones);
  const cuadre: Cuadre = {
    ventas: ventasTotal,
    ventasConFactura: n(ventasRes!.con_factura),
    facturas: n(cuadreRes!.facturas),
    cobrado: n(cuadreRes!.cobrado),
    pendiente: n(cuadreRes!.pendiente),
    efectivoPagos: n(cuadreRes!.efectivo_pagos),
    efectivoCaja: n(cuadreRes!.efectivo_caja),
  };

  return {
    desde,
    hasta,
    ventas: {
      total: ventasTotal,
      bruto: n(ventasRes!.ventas),
      devoluciones: n(ventasRes!.devoluciones),
      numero: n(ventasRes!.numero),
      numDevoluciones: n(ventasRes!.num_devoluciones),
      ticketMedio: n(ventasRes!.numero) ? Math.round(n(ventasRes!.ventas) / n(ventasRes!.numero)) : 0,
      porMetodo: porMetodo.map((m) => ({ metodo: m.metodo, importe: n(m.importe) })),
      porDia: porDia.map((d) => ({ dia: d.dia, total: n(d.total), numero: n(d.numero) })),
    },
    tratamientos: [...tratamientos.values()].sort((a, b) => b.total - a.total || b.sesionesBono - a.sesionesBono),
    bonos: agrupar("bono"),
    productos: agrupar("producto"),
    clientas: {
      nuevas: n(clientas!.nuevas),
      atendidas: n(clientas!.atendidas),
      conCompra: n(clientas!.con_compra),
      realizadas: n(clientas!.realizadas),
      noVino: n(clientas!.no_vino),
      canceladas: n(clientas!.canceladas),
      mejores: mejores.map((m) => ({ id: m.id, nombre: m.nombre, total: n(m.total), compras: n(m.compras) })),
    },
    equipo,
    sinAsignar,
    cajas: cajas.map((c) => ({
      id: c.id,
      abiertaEn: new Date(c.abierta_en),
      cerradaEn: c.cerrada_en ? new Date(c.cerrada_en) : null,
      fondo: n(c.fondo),
      esperado: c.esperado === null ? null : n(c.esperado),
      contado: c.contado === null ? null : n(c.contado),
      quien: c.quien,
    })),
    cuadre,
  };
}

export type Informe = Awaited<ReturnType<typeof informe>>;
