import { Aviso, Boton, Tarjeta } from "@adela/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fechaHora } from "@/lib/fechas";
import { requerirSesion } from "@/server/auth";
import { consentimientoFirmado } from "@/server/fichas";
import { revocar } from "../../acciones-fichas";
import { Imprimir } from "./Imprimir";

export default async function VerConsentimiento({ params, searchParams }: { params: Promise<{ id: string; firmadoId: string }>; searchParams: Promise<{ firmado?: string }> }) {
  await requerirSesion("clientas.gestionar");
  const [{ id, firmadoId }, { firmado }] = await Promise.all([params, searchParams]);
  const r = await consentimientoFirmado(firmadoId);
  if (!r || r.c.clienteId !== id) notFound();
  const { c } = r;
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link href={`/gestion/clientas/${id}`} className="mr-auto inline-flex min-h-toque items-center text-dorado-oscuro underline">
          ‹ Volver a la ficha
        </Link>
        <Imprimir />
      </div>
      {firmado && <Aviso prioridad="correcto">Consentimiento firmado y guardado en su ficha.</Aviso>}
      {c.revocadoEn && <Aviso prioridad="importante">Retirado el {fechaHora(c.revocadoEn)}.</Aviso>}
      <h1 className="text-4xl">{c.nombreModelo}</h1>
      <Tarjeta className="space-y-4">
        <div className="whitespace-pre-wrap leading-relaxed">{c.texto}</div>
        <div className="border-t border-borde pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.firma} alt={`Firma de ${c.firmante}`} className="h-32 w-auto" />
          <div>
            Firmado por <strong>{c.firmante}</strong> el {fechaHora(c.firmadoEn)}. Registrado por {r.quien}.
          </div>
        </div>
      </Tarjeta>
      {!c.revocadoEn && (
        <details className="print:hidden">
          <summary className="inline-flex min-h-toque cursor-pointer items-center font-semibold text-urgente">Retirar este consentimiento…</summary>
          <form action={revocar} className="mt-2 space-y-2 rounded-xl border border-urgente bg-urgente-fondo p-3">
            <input type="hidden" name="cliente" value={id} />
            <input type="hidden" name="id" value={c.id} />
            <p className="text-sm">Si la clienta lo retira, queda anotado con la fecha. Lo firmado no se borra.</p>
            <Boton type="submit" variante="peligro">
              Sí, retirarlo
            </Boton>
          </form>
        </details>
      )}
    </div>
  );
}
