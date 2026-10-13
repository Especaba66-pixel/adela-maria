import { NOMBRE_METODO, comprobarCuadre, formatearEuros, hoyEnMadrid, mesVecino, nombreMes, periodoDeMes, textoPorcentaje, type MetodoPago } from "@adela/dominio";
import { Aviso, Tarjeta } from "@adela/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { diaLargo, fechaHora } from "@/lib/fechas";
import { requerirSesion } from "@/server/auth";
import { informe } from "@/server/informes";

const enlace = "inline-flex min-h-toque items-center rounded-xl border-2 border-dorado px-4 font-semibold text-dorado-oscuro hover:bg-crema";

function Cifra({ nombre, valor, testid }: { nombre: string; valor: ReactNode; testid?: string }) {
  return (
    <div className="rounded-xl border border-borde bg-superficie px-4 py-3">
      <div className="text-sm text-tinta-suave">{nombre}</div>
      <div className="text-2xl font-semibold" data-testid={testid}>
        {valor}
      </div>
    </div>
  );
}

function Tabla({ titulo, cabecera, filas, vacio }: { titulo: string; cabecera: string[]; filas: ReactNode[][]; vacio: string }) {
  return (
    <section aria-label={titulo} className="space-y-2">
      <h2 className="text-2xl">{titulo}</h2>
      {filas.length === 0 ? (
        <p className="text-tinta-suave">{vacio}</p>
      ) : (
        <Tarjeta className="overflow-x-auto p-0">
          <table className="w-full text-left">
            <thead className="border-b border-borde text-sm text-tinta-suave">
              <tr>
                {cabecera.map((c, i) => (
                  <th key={c} className={`px-4 py-2 font-medium ${i > 0 ? "text-right" : ""}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {filas.map((f, i) => (
                <tr key={i}>
                  {f.map((c, j) => (
                    <td key={j} className={`px-4 py-2 ${j > 0 ? "text-right tabular-nums" : ""}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      )}
    </section>
  );
}

export default async function Informes({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await requerirSesion("informes.ver");
  const actual = hoyEnMadrid(new Date()).slice(0, 7);
  const q = await searchParams;
  const mes = q.mes && periodoDeMes(q.mes) ? q.mes : actual;
  const p = periodoDeMes(mes)!;
  const d = await informe(p.desde, p.hasta);
  const e = formatearEuros;
  const cuadre = comprobarCuadre(d.cuadre, e);

  return (
    <div className="max-w-5xl space-y-8">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-4xl first-letter:uppercase">Informes · {nombreMes(mes)}</h1>
        <Link href={`/gestion/mas/informes?mes=${mesVecino(mes, -1)}`} className={enlace}>
          ‹ Mes anterior
        </Link>
        {mes < actual && (
          <Link href={`/gestion/mas/informes?mes=${mesVecino(mes, 1)}`} className={enlace}>
            Mes siguiente ›
          </Link>
        )}
        <a href={`/gestion/mas/informes/exportar?mes=${mes}`} className={enlace}>
          Descargar para Excel
        </a>
      </header>

      <section aria-label="Cuadre" className="space-y-2">
        <h2 className="text-2xl">Cuadre con caja y facturación</h2>
        {cuadre.every((c) => c.ok) ? (
          <Aviso prioridad="correcto">Todo coincide: ventas, cobros, facturas y caja.</Aviso>
        ) : (
          <Aviso prioridad="importante">Hay diferencias. Revisa lo marcado abajo.</Aviso>
        )}
        <ul className="space-y-1" aria-label="Comprobaciones">
          {cuadre.map((c) => (
            <li key={c.nombre} className={c.ok ? "" : "font-semibold text-urgente"}>
              {c.ok ? "✓" : "✗"} {c.nombre}: {c.detalle}
            </li>
          ))}
        </ul>
        {d.cuadre.pendiente !== 0 && <p className="text-tinta-suave">Queda a deber {e(d.cuadre.pendiente)} de ventas de este mes.</p>}
      </section>

      <section aria-label="Ventas" className="space-y-3">
        <h2 className="text-2xl">Ventas</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <Cifra nombre="Ventas (menos devoluciones)" valor={e(d.ventas.total)} testid="total-ventas" />
          <Cifra nombre="Número de ventas" valor={d.ventas.numero} />
          <Cifra nombre="Ticket medio" valor={e(d.ventas.ticketMedio)} />
          <Cifra nombre="Devoluciones" valor={`${d.ventas.numDevoluciones} · ${e(-d.ventas.devoluciones)}`} />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1" aria-label="Cobrado por método">
          {d.ventas.porMetodo.map((m) => (
            <span key={m.metodo}>
              {NOMBRE_METODO[m.metodo as MetodoPago] ?? m.metodo}: <strong>{e(m.importe)}</strong>
            </span>
          ))}
        </div>
      </section>

      <Tabla
        titulo="Tratamientos"
        cabecera={["Tratamiento", "Cobrados", "Importe", "Sesiones de bono"]}
        filas={d.tratamientos.map((t) => [t.nombre, t.cantidad, e(t.total), t.sesionesBono])}
        vacio="Ningún tratamiento este mes."
      />
      <Tabla titulo="Bonos vendidos" cabecera={["Bono", "Vendidos", "Importe"]} filas={d.bonos.map((b) => [b.nombre, b.cantidad, e(b.total)])} vacio="Ningún bono vendido este mes." />
      <Tabla
        titulo="Productos"
        cabecera={["Producto", "Unidades", "Importe", "Coste", "Margen"]}
        filas={d.productos.map((p) => [p.nombre, p.cantidad, e(p.total), p.coste === null ? "—" : e(p.coste), p.coste === null ? "—" : e(p.total - p.coste)])}
        vacio="Ningún producto vendido este mes."
      />

      <section aria-label="Clientas" className="space-y-3">
        <h2 className="text-2xl">Clientas</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Cifra nombre="Nuevas" valor={d.clientas.nuevas} />
          <Cifra nombre="Atendidas" valor={d.clientas.atendidas} />
          <Cifra nombre="Con compra" valor={d.clientas.conCompra} />
          <Cifra nombre="Citas hechas" valor={d.clientas.realizadas} />
          <Cifra nombre="No vinieron" valor={d.clientas.noVino} />
          <Cifra nombre="Canceladas" valor={d.clientas.canceladas} />
        </div>
      </section>
      <Tabla
        titulo="Las que más han gastado"
        cabecera={["Clienta", "Compras", "Total"]}
        filas={d.clientas.mejores.map((c) => [
          <Link key={c.id} href={`/gestion/clientas/${c.id}`} className="underline">
            {c.nombre}
          </Link>,
          c.compras,
          e(c.total),
        ])}
        vacio="Ninguna compra con clienta este mes."
      />

      <Tabla
        titulo="Equipo y comisiones"
        cabecera={["Profesional", "Citas", "Sesiones de bono", "Servicios (sin IVA)", "Productos (sin IVA)", "Comisión"]}
        filas={d.equipo.map((p) => [
          p.nombre,
          p.citas,
          p.sesionesBono,
          e(p.servicios),
          e(p.productos),
          <span key="c" data-testid={`comision-${p.nombre}`} title={`${textoPorcentaje(p.comisionServicios)} servicios · ${textoPorcentaje(p.comisionProductos)} productos`}>
            {e(p.comision)}
          </span>,
        ])}
        vacio="Sin profesionales."
      />
      {d.sinAsignar !== 0 && <p className="text-tinta-suave">Ventas sin profesional asignada: {e(d.sinAsignar)} (sin IVA). No cuentan para comisiones.</p>}

      <Tabla
        titulo="Caja"
        cabecera={["Abierta", "Por", "Fondo", "Esperado", "Contado", "Diferencia"]}
        filas={d.cajas.map((c) => [
          `${fechaHora(c.abiertaEn)}${c.cerradaEn ? "" : " (abierta)"}`,
          c.quien,
          e(c.fondo),
          c.esperado === null ? "—" : e(c.esperado),
          c.contado === null ? "—" : e(c.contado),
          c.esperado === null || c.contado === null ? "—" : e(c.contado - c.esperado),
        ])}
        vacio="No se abrió la caja este mes."
      />
      <Tabla
        titulo="Ventas por día"
        cabecera={["Día", "Ventas", "Importe"]}
        filas={d.ventas.porDia.map((x) => [<span key="d" className="first-letter:uppercase">{diaLargo(x.dia)}</span>, x.numero, e(x.total)])}
        vacio="Sin ventas este mes."
      />
    </div>
  );
}
