import { campanas, plantillas, usuarios } from "@adela/db";
import { NOMBRE_SEGMENTO, SEGMENTOS, formatearTelefono, rellenarPlantilla, type Segmento } from "@adela/dominio";
import { Aviso, Tarjeta } from "@adela/ui";
import { desc, eq, sql } from "drizzle-orm";
import { fechaHora } from "@/lib/fechas";
import { requerirSesion } from "@/server/auth";
import { clientasDeSegmento } from "@/server/clientas";
import { db } from "@/server/db";
import { enviable } from "@/server/mensajes";
import { apiWhatsapp } from "@/server/whatsapp";
import { EnviarCampana } from "./Enviar";

const campo = "mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg";

export default async function Campana({ searchParams }: { searchParams: Promise<{ segmento?: string; plantilla?: string }> }) {
  await requerirSesion("configuracion.gestionar");
  const q = await searchParams;
  const promociones = (await db().select().from(plantillas)).filter((p) => p.permiso === "promocion" && enviable(p));
  const segmento = (SEGMENTOS as readonly string[]).includes(q.segmento ?? "") ? (q.segmento as Segmento) : null;
  const plantilla = promociones.find((p) => p.clave === q.plantilla) ?? null;
  const destino = segmento && plantilla ? (await clientasDeSegmento(segmento)).filter((c) => c.telefono && c.promociones) : [];
  const anteriores = await db()
    .select({
      c: campanas,
      quien: usuarios.nombre,
      mensaje: plantillas.nombre,
      entregados: sql<number>`(select count(*) from mensajes m where m.campana_id = "campanas"."id" and m.estado in ('entregado', 'leido'))::int`,
      leidos: sql<number>`(select count(*) from mensajes m where m.campana_id = "campanas"."id" and m.estado = 'leido')::int`,
      fallidos: sql<number>`(select count(*) from mensajes m where m.campana_id = "campanas"."id" and m.estado = 'fallido')::int`,
    })
    .from(campanas)
    .innerJoin(usuarios, eq(usuarios.id, campanas.usuarioId))
    .innerJoin(plantillas, eq(plantillas.clave, campanas.plantilla))
    .orderBy(desc(campanas.cuando))
    .limit(20);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-4xl">Enviar a un grupo de clientas</h1>
      <p className="text-tinta-suave">Solo se envía a las clientas del grupo que aceptan promociones y tienen teléfono. Cada mensaje es de marketing: Meta lo cobra.</p>
      {!apiWhatsapp() ? (
        <Aviso prioridad="informativo">Hace falta conectar WhatsApp con Meta. Mientras, en Clientas puedes abrir cada grupo y escribir una a una con el botón verde.</Aviso>
      ) : promociones.length === 0 ? (
        <Aviso prioridad="informativo">Aún no hay ningún mensaje de promoción aprobado en Meta (Más → WhatsApp → Datos de Meta).</Aviso>
      ) : (
        <Tarjeta className="space-y-4">
          <form method="get" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" aria-label="Elegir grupo y mensaje">
            <label className="block">
              Grupo
              <select name="segmento" defaultValue={segmento ?? ""} className={campo}>
                <option value="">—</option>
                {SEGMENTOS.map((s) => (
                  <option key={s} value={s}>
                    {NOMBRE_SEGMENTO[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              Mensaje
              <select name="plantilla" defaultValue={plantilla?.clave ?? ""} className={campo}>
                <option value="">—</option>
                {promociones.map((p) => (
                  <option key={p.clave} value={p.clave}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="min-h-toque rounded-xl border-2 border-dorado px-5 font-semibold text-dorado-oscuro">
              Ver a quién
            </button>
          </form>
          {segmento && plantilla && (
            <div className="space-y-3">
              <p>
                Mensaje: <em>{rellenarPlantilla(plantilla.texto, { nombre: "Marta", centro: "Adela María · Belleza holística" })}</em>
              </p>
              <p className="font-semibold" data-testid="destinatarias">
                {destino.length} {destino.length === 1 ? "clienta" : "clientas"}: {destino.map((c) => `${c.nombre} (${formatearTelefono(c.telefono!)})`).join(", ") || "nadie"}
              </p>
              <EnviarCampana segmento={segmento} plantilla={plantilla.clave} total={destino.length} />
            </div>
          )}
        </Tarjeta>
      )}
      {anteriores.length > 0 && (
        <section className="space-y-2" aria-label="Envíos anteriores">
          <h2 className="text-2xl">Envíos anteriores</h2>
          <Tarjeta className="divide-y divide-borde p-0">
            {anteriores.map((a) => (
              <div key={a.c.id} className="px-6 py-3">
                <div className="font-semibold">
                  {a.mensaje} · {NOMBRE_SEGMENTO[a.c.segmento as Segmento] ?? a.c.segmento}
                </div>
                <div className="text-sm text-tinta-suave">
                  {fechaHora(a.c.cuando)} · {a.quien} · {a.c.total} enviados, {a.entregados} entregados, {a.leidos} leídos{a.fallidos ? `, ${a.fallidos} fallidos` : ""}
                </div>
              </div>
            ))}
          </Tarjeta>
        </section>
      )}
    </div>
  );
}
