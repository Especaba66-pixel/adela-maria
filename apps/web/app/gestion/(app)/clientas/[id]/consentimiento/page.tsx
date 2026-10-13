import { Tarjeta } from "@adela/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth";
import { textoParaFirmar } from "@/server/fichas";
import { Firma } from "./Firma";

export default async function FirmarConsentimiento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ modelo?: string; cita?: string }> }) {
  await requerirSesion("clientas.gestionar");
  const [{ id }, q] = await Promise.all([params, searchParams]);
  const t = q.modelo ? await textoParaFirmar(q.modelo, id) : null;
  if (!t || !t.modelo.activo) notFound();
  return (
    <div className="max-w-3xl space-y-6">
      <Link href={`/gestion/clientas/${id}`} className="inline-flex min-h-toque items-center text-dorado-oscuro underline">
        ‹ Volver a la ficha
      </Link>
      <h1 className="text-4xl">{t.modelo.nombre}</h1>
      <Tarjeta>
        <div className="whitespace-pre-wrap text-lg leading-relaxed" data-testid="texto-consentimiento">
          {t.texto}
        </div>
      </Tarjeta>
      <Tarjeta>
        <Firma clienteId={id} modeloId={t.modelo.id} citaId={q.cita} nombre={t.clienta.nombre} />
      </Tarjeta>
    </div>
  );
}
