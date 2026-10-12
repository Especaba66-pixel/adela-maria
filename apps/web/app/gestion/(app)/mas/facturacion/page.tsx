import { clientes, facturas, registrosFacturacion, ventas } from "@adela/db";
import { formatearEuros, verificarCadena, type DatosHuella } from "@adela/dominio";
import { Aviso, Tarjeta } from "@adela/ui";
import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { fechaHora } from "@/lib/fechas";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";

const TIPO = { simplificada: "Ticket", completa: "Factura", rectificativa: "Rectificativa" };

export default async function Facturacion() {
  await requerirSesion("cobrar");
  const [lista, registros] = await Promise.all([
    db()
      .select({ f: facturas, cliente: clientes.nombre })
      .from(facturas)
      .innerJoin(ventas, eq(ventas.id, facturas.ventaId))
      .leftJoin(clientes, eq(clientes.id, ventas.clienteId))
      .orderBy(desc(facturas.expedidaEn))
      .limit(200),
    db().select().from(registrosFacturacion).orderBy(asc(registrosFacturacion.id)),
  ]);
  const roto = verificarCadena(registros.map((r) => ({ ...(r.datos as DatosHuella), huella: r.huella })));
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-4xl">Facturación</h1>
      {roto === null ? (
        <Aviso prioridad="correcto">
          Registro de facturación íntegro: {registros.length} {registros.length === 1 ? "registro encadenado" : "registros encadenados"} sin alteraciones.
        </Aviso>
      ) : (
        <Aviso prioridad="urgente">El registro de facturación no cuadra a partir del registro {roto + 1}. Avisa al soporte.</Aviso>
      )}
      {lista.length === 0 ? (
        <p className="text-tinta-suave">Todavía no hay facturas.</p>
      ) : (
        <Tarjeta className="divide-y divide-borde p-0">
          {lista.map(({ f, cliente }) => (
            <Link key={f.id} href={`/gestion/mas/facturacion/${f.id}`} className="flex min-h-toque flex-wrap items-center justify-between gap-2 px-6 py-2 hover:bg-crema">
              <span>
                <span className="font-semibold">{f.numeroCompleto}</span> · {TIPO[f.tipo]} · {fechaHora(f.expedidaEn).slice(0, -3)}
                {cliente && <span className="text-tinta-suave"> · {cliente}</span>}
              </span>
              <span className={f.total < 0 ? "font-semibold text-urgente" : "font-semibold"}>{formatearEuros(f.total)}</span>
            </Link>
          ))}
        </Tarjeta>
      )}
    </div>
  );
}
