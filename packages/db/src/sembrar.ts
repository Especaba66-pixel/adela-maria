/**
 * Datos iniciales. Se puede ejecutar varias veces: solo añade lo que falta.
 */
import { MODELOS_CONSENTIMIENTO_INICIALES, PLANTILLAS_INICIALES, normalizarTelefono, cifrarSecreto, normalizarUsuario, validarContrasena, validarPin, validarUsuario } from "@adela/dominio";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { registrarActividad } from "./actividad";
import { CORREO_ADMINISTRACION, USUARIO_ADMINISTRACION_INSTALACION } from "./datos/accesos";
import { CABINAS, CONTACTO, HORARIO_INICIAL } from "./datos/centro";
import { COMPRAS_INICIALES, GASTOS_INICIALES, PRODUCTOS_VENTA, PROVEEDORES_INICIALES, STOCK_MINIMO_INICIAL, totalGastoInicial, type CompraInicial, type GastoInicial, type ProductoVenta, type ProveedorInicial } from "./datos/productos";
import { BONOS, CATEGORIAS, type TarifaBono, type TarifaCategoria } from "./datos/tarifas";
import { registrarCompra, registrarGasto } from "./stock";
import { categorias, centro, compras, gastos, horarios, modelosConsentimiento, modelosConsentimientoTratamientos, plantillas, productos, profesionales, proveedores, tiposBono, tiposBonoTratamientos, tratamientos, usuarios } from "./esquema";
import type { BaseDatos } from "./index";

export const NOMBRE_CENTRO = "Adela María · Belleza holística";

export interface AdminInicial {
  nombre: string;
  usuario: string;
  contrasena: string;
  pin: string;
}

export interface ResumenSiembra {
  centroCreado: boolean;
  adminCreado: boolean;
  tratamientosNuevos: number;
  bonosNuevos: number;
  horarioCreado: boolean;
  productosNuevos: number;
  comprasNuevas: number;
  gastosNuevos: number;
  avisos: string[];
}

/** Lo que se carga en la base de datos. Lo que no se indica no se carga (las pruebas pasan solo lo que necesitan). */
export interface DatosIniciales {
  categorias: TarifaCategoria[];
  bonos: TarifaBono[];
  proveedores?: ProveedorInicial[];
  productos?: ProductoVenta[];
  compras?: CompraInicial[];
  gastos?: GastoInicial[];
}

export async function sembrar(
  db: BaseDatos,
  admin: AdminInicial,
  tarifas: DatosIniciales = { categorias: CATEGORIAS, bonos: BONOS, proveedores: PROVEEDORES_INICIALES, productos: PRODUCTOS_VENTA, compras: COMPRAS_INICIALES, gastos: GASTOS_INICIALES },
): Promise<ResumenSiembra> {
  const resumen: ResumenSiembra = { centroCreado: false, adminCreado: false, tratamientosNuevos: 0, bonosNuevos: 0, horarioCreado: false, productosNuevos: 0, comprasNuevas: 0, gastosNuevos: 0, avisos: [] };

  await db.transaction(async (tx) => {
    let [c] = await tx.select().from(centro).limit(1);
    if (!c) {
      [c] = await tx.insert(centro).values({ nombre: NOMBRE_CENTRO, direccion: CONTACTO.direccion, telefono: CONTACTO.whatsapp ? normalizarTelefono(CONTACTO.whatsapp) : null }).returning();
      resumen.centroCreado = true;
    }
    const centroId = c!.id;
    if (c!.cabinas === null) await tx.update(centro).set({ cabinas: CABINAS }).where(eq(centro.id, centroId));

    const [hayAdmin] = await tx.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.rol, "administrador")).limit(1);
    if (!hayAdmin) {
      const usuario = normalizarUsuario(admin.usuario);
      const error = validarUsuario(usuario) ?? validarContrasena(admin.contrasena) ?? validarPin(admin.pin);
      if (error) throw new Error(`Administrador inicial no válido: ${error}`);
      const [nuevo] = await tx
        .insert(usuarios)
        .values({
          centroId,
          nombre: admin.nombre,
          usuario,
          rol: "administrador",
          hashContrasena: await cifrarSecreto(admin.contrasena),
          hashPin: await cifrarSecreto(admin.pin),
        })
        .returning();
      await registrarActividad(tx, { usuarioId: null, accion: "usuario.crear", entidad: "usuarios", entidadId: nuevo!.id, despues: nuevo });
      resumen.adminCreado = true;
    }

    // La administración entra con su correo: si sigue con el usuario de la instalación, pasa a ser el correo.
    const [conCorreo] = await tx.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.usuario, CORREO_ADMINISTRACION));
    if (!conCorreo) {
      const [antiguo] = await tx
        .select()
        .from(usuarios)
        .where(and(eq(usuarios.rol, "administrador"), eq(usuarios.usuario, USUARIO_ADMINISTRACION_INSTALACION)));
      if (antiguo) {
        await tx.update(usuarios).set({ usuario: CORREO_ADMINISTRACION }).where(eq(usuarios.id, antiguo.id));
        await registrarActividad(tx, {
          usuarioId: null,
          accion: "usuario.editar",
          entidad: "usuarios",
          entidadId: antiguo.id,
          antes: { usuario: antiguo.usuario },
          despues: { usuario: CORREO_ADMINISTRACION },
        });
        resumen.avisos.push(`La administración se registra ahora con su correo: ${CORREO_ADMINISTRACION} (la contraseña no cambia).`);
      }
    }

    // La administración atiende citas: es la primera profesional (su horario se pone en Configuración).
    const [hayProfesional] = await tx.select({ id: profesionales.id }).from(profesionales).limit(1);
    if (!hayProfesional) {
      const [admin] = await tx.select().from(usuarios).where(eq(usuarios.rol, "administrador")).limit(1);
      const [adela] = await tx.insert(profesionales).values({ nombre: admin!.nombre, usuarioId: admin!.id }).returning();
      await tx.insert(horarios).values(HORARIO_INICIAL.map((h) => ({ ...h, profesionalId: adela!.id })));
      resumen.horarioCreado = true;
    }

    // Plantillas de mensajes de partida (las que ya existen no se tocan: puede haberlas cambiado el centro).
    await tx.insert(plantillas).values(PLANTILLAS_INICIALES).onConflictDoNothing();

    for (const [i, cat] of tarifas.categorias.entries()) {
      await tx.insert(categorias).values({ nombre: cat.nombre, orden: i }).onConflictDoNothing();
      const [fila] = await tx.select().from(categorias).where(eq(categorias.nombre, cat.nombre));
      if (cat.tratamientos.length === 0) resumen.avisos.push(`Faltan los tratamientos de la categoría «${cat.nombre}».`);
      for (const [j, t] of cat.tratamientos.entries()) {
        const insertados = await tx
          .insert(tratamientos)
          .values({ categoriaId: fila!.id, orden: j, ...t })
          .onConflictDoNothing()
          .returning({ id: tratamientos.id });
        resumen.tratamientosNuevos += insertados.length;
      }
    }

    for (const bono of tarifas.bonos) {
      const [nuevo] = await tx
        .insert(tiposBono)
        .values({ nombre: bono.nombre, sesiones: bono.sesiones, precioCentimos: bono.precioCentimos })
        .onConflictDoNothing()
        .returning();
      if (nuevo) resumen.bonosNuevos++;
      const [tipo] = await tx.select().from(tiposBono).where(eq(tiposBono.nombre, bono.nombre));
      const cubiertos = await tx
        .select({ id: tratamientos.id, nombre: tratamientos.nombre })
        .from(tratamientos)
        .innerJoin(categorias, eq(categorias.id, tratamientos.categoriaId))
        .where(and(eq(categorias.nombre, bono.categoria), isNull(tratamientos.anuladoEn)));
      const incluidos = cubiertos.filter((t) => !bono.excepto?.includes(t.nombre));
      if (incluidos.length > 0) {
        await tx
          .insert(tiposBonoTratamientos)
          .values(incluidos.map((t) => ({ tipoBonoId: tipo!.id, tratamientoId: t.id })))
          .onConflictDoNothing();
      }
    }

    // Consentimientos informados de partida (solo los que no existen; los tratamientos que los piden, por nombre).
    for (const m of MODELOS_CONSENTIMIENTO_INICIALES) {
      const [nuevo] = await tx.insert(modelosConsentimiento).values({ nombre: m.nombre, texto: m.texto }).onConflictDoNothing().returning();
      if (!nuevo || m.tratamientos.length === 0) continue;
      const piden = await tx.select({ id: tratamientos.id }).from(tratamientos).where(inArray(tratamientos.nombre, m.tratamientos));
      if (piden.length) await tx.insert(modelosConsentimientoTratamientos).values(piden.map((t) => ({ modeloId: nuevo.id, tratamientoId: t.id })));
    }

    // Proveedores y productos de venta (los que ya existen no se tocan: el centro puede haber cambiado el precio).
    for (const p of tarifas.proveedores ?? []) {
      await tx.insert(proveedores).values({ nombre: p.nombre, nif: p.nif, telefono: p.telefono, email: p.email, notas: p.notas ?? null }).onConflictDoNothing();
    }
    for (const p of tarifas.productos ?? []) {
      const [prov] = await tx.select({ id: proveedores.id }).from(proveedores).where(eq(proveedores.nombre, p.proveedor));
      const nuevos = await tx
        .insert(productos)
        .values({
          nombre: p.nombre,
          referencia: p.referencia ?? null,
          uso: "venta",
          precioCentimos: p.precioCentimos,
          ivaCentesimas: p.ivaCentesimas,
          costeCentimos: p.costeCentimos,
          stockMinimo: STOCK_MINIMO_INICIAL,
          proveedorId: prov?.id ?? null,
        })
        .onConflictDoNothing()
        .returning({ id: productos.id });
      resumen.productosNuevos += nuevos.length;
    }
  });

  // Compras ya pagadas: entran en el stock y en los gastos una sola vez (se reconocen por proveedor y nº de factura).
  // Van con las reglas de siempre (registrarCompra), a nombre de la primera administradora.
  for (const c of tarifas.compras ?? []) {
    const [prov] = await db.select().from(proveedores).where(eq(proveedores.nombre, c.proveedor));
    if (!prov) throw new Error(`Falta el proveedor «${c.proveedor}».`);
    const [ya] = await db.select({ id: compras.id }).from(compras).where(and(eq(compras.proveedorId, prov.id), eq(compras.numeroFactura, c.numeroFactura)));
    if (ya) continue;
    const nombres = [...new Set(c.lineas.map(([nombre]) => nombre))];
    const filas = await db.select({ id: productos.id, nombre: productos.nombre }).from(productos).where(inArray(productos.nombre, nombres));
    const idDe = new Map(filas.map((f) => [f.nombre, f.id]));
    const faltan = nombres.filter((n) => !idDe.has(n));
    if (faltan.length) throw new Error(`La compra ${c.numeroFactura} tiene productos que no existen: ${faltan.join(", ")}.`);
    const [admin] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.rol, "administrador")).limit(1);
    const r = await registrarCompra(db, admin!.id, {
      proveedorId: prov.id,
      fecha: c.fecha,
      numeroFactura: c.numeroFactura,
      ivaCentesimas: c.ivaCentesimas,
      descuento: c.descuento,
      totalFactura: c.totalFactura,
      lineas: c.lineas.map(([nombre, cantidad, costeUnitario]) => ({ productoId: idDe.get(nombre)!, cantidad, costeUnitario })),
      notas: "Cargada con los datos iniciales.",
    });
    if (!r.ok) throw new Error(`No se pudo cargar la compra ${c.numeroFactura}: ${r.error}`);
    resumen.comprasNuevas++;
  }

  // Gastos ya pagados (productos de cabina): una sola vez, por proveedor, nº de factura y concepto.
  for (const g of tarifas.gastos ?? []) {
    const [prov] = await db.select().from(proveedores).where(eq(proveedores.nombre, g.proveedor));
    if (!prov) throw new Error(`Falta el proveedor «${g.proveedor}».`);
    const [ya] = await db
      .select({ id: gastos.id })
      .from(gastos)
      .where(and(eq(gastos.proveedorId, prov.id), eq(gastos.numeroFactura, g.numeroFactura), eq(gastos.concepto, g.concepto)));
    if (ya) continue;
    const [admin] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.rol, "administrador")).limit(1);
    const r = await registrarGasto(db, admin!.id, {
      fecha: g.fecha,
      categoria: "compras",
      concepto: g.concepto,
      proveedorId: prov.id,
      numeroFactura: g.numeroFactura,
      total: totalGastoInicial(g),
      ivaCentesimas: g.ivaCentesimas,
    });
    if (!r.ok) throw new Error(`No se pudo cargar el gasto ${g.numeroFactura}: ${r.error}`);
    resumen.gastosNuevos++;
  }

  return resumen;
}
