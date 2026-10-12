import { facturas, ventas } from "@adela/db";
import { lineasTicket, puede } from "@adela/dominio";
import { Tarjeta } from "@adela/ui";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { datosTicket } from "@/server/tpv";
import { BotonesTicket } from "../../../tpv/ticket/[id]/Botones";
import { Devolver } from "./Devolver";

export default async function Factura({ params }: { params: Promise<{ id: string }> }) {
  const { usuario } = await requerirSesion("cobrar");
  const { id } = await params;
  const [f] = await db().select().from(facturas).where(eq(facturas.id, id));
  const datos = await datosTicket(id);
  if (!f || !datos) notFound();
  const [devuelta] = await db().select({ id: ventas.id }).from(ventas).where(eq(ventas.devolucionDe, f.ventaId));
  const rectificativa = devuelta ? (await db().select().from(facturas).where(eq(facturas.ventaId, devuelta.id)))[0] : undefined;
  const lineas = lineasTicket(datos, 48);
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_auto]">
      <div className="space-y-4">
        <Link href="/gestion/mas/facturacion" className="inline-flex min-h-toque items-center text-dorado-oscuro underline">
          ‹ Volver a facturación
        </Link>
        <h1 className="text-4xl">{f.numeroCompleto}</h1>
        {rectificativa && (
          <p>
            Devuelta. Rectificativa:{" "}
            <Link href={`/gestion/mas/facturacion/${rectificativa.id}`} className="text-dorado-oscuro underline">
              {rectificativa.numeroCompleto}
            </Link>
          </p>
        )}
        <BotonesTicket facturaId={id} whatsapp={`https://wa.me/?text=${encodeURIComponent("```\n" + lineasTicket(datos, 40).join("\n") + "\n```")}`} />
        {f.tipo !== "rectificativa" && !rectificativa && puede(usuario.rol, "facturas.anular") && <Devolver facturaId={id} total={f.total} />}
      </div>
      <Tarjeta className="w-fit bg-white p-4">
        <pre aria-label="Ticket" className="font-mono text-sm leading-snug">
          {lineas.join("\n")}
        </pre>
      </Tarjeta>
    </div>
  );
}
