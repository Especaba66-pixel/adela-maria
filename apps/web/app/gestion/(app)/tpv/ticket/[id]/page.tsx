import { clientes, facturas, ventas } from "@adela/db";
import { enlaceWhatsapp, formatearEuros, lineasTicket } from "@adela/dominio";
import { Aviso, Tarjeta } from "@adela/ui";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { datosTicket } from "@/server/tpv";
import { BotonesTicket } from "./Botones";

export default async function Ticket({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cambio?: string; pendiente?: string; impresion?: string }> }) {
  await requerirSesion("cobrar");
  const [{ id }, q] = await Promise.all([params, searchParams]);
  const datos = await datosTicket(id);
  if (!datos) notFound();
  const [fila] = await db()
    .select({ telefono: clientes.telefono })
    .from(facturas)
    .innerJoin(ventas, eq(ventas.id, facturas.ventaId))
    .leftJoin(clientes, eq(clientes.id, ventas.clienteId))
    .where(eq(facturas.id, id));
  const lineas = lineasTicket(datos, 40);
  const texto = "```\n" + lineas.join("\n") + "\n```";
  const whatsapp = fila?.telefono ? enlaceWhatsapp(fila.telefono, texto) : `https://wa.me/?text=${encodeURIComponent(texto)}`;
  const cambio = Number(q.cambio ?? 0);
  const pendiente = Number(q.pendiente ?? 0);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_auto]">
      <div className="space-y-4">
        <h1 className="text-4xl">Cobrado</h1>
        {cambio > 0 && (
          <Tarjeta className="border-dorado bg-crema">
            <div className="text-xl">Cambio</div>
            <div className="font-titulo text-6xl" data-testid="cambio-final">
              {formatearEuros(cambio)}
            </div>
          </Tarjeta>
        )}
        {pendiente > 0 && <Aviso prioridad="pendiente">Quedan {formatearEuros(pendiente)} a deber. Aparecen en el TPV y en el inicio.</Aviso>}
        {q.impresion && <Aviso prioridad="importante">{q.impresion} La venta está guardada: puedes reimprimir o enviar el ticket por WhatsApp.</Aviso>}
        <BotonesTicket facturaId={id} whatsapp={whatsapp} />
      </div>
      <Tarjeta className="w-fit bg-white p-4">
        <pre aria-label="Ticket" className="font-mono text-sm leading-snug">
          {lineas.join("\n")}
        </pre>
      </Tarjeta>
    </div>
  );
}
