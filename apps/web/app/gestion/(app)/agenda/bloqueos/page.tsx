import { bloqueos, profesionales } from "@adela/db";
import { hoyEnMadrid } from "@adela/dominio";
import { Boton, Tarjeta } from "@adela/ui";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import Link from "next/link";
import { fechaHora } from "@/lib/fechas";
import { profesionalesActivos } from "@/server/agenda";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { quitarBloqueo } from "./acciones";
import { FormularioBloqueo } from "./Formulario";

const TIPO = { vacaciones: "Vacaciones o cierre", descanso: "Descanso", otro: "Otro" };

export default async function Bloqueos() {
  await requerirSesion("agenda.gestionar");
  const [lista, equipo] = await Promise.all([
    db()
      .select({ b: bloqueos, quien: profesionales.nombre })
      .from(bloqueos)
      .leftJoin(profesionales, eq(profesionales.id, bloqueos.profesionalId))
      .where(and(isNull(bloqueos.anuladoEn), gt(bloqueos.fin, new Date())))
      .orderBy(asc(bloqueos.inicio)),
    profesionalesActivos(),
  ]);
  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/gestion/agenda" className="inline-flex min-h-toque items-center text-dorado-oscuro underline">
        ‹ Volver a la agenda
      </Link>
      <h1 className="text-4xl">Bloqueos</h1>
      <p className="text-tinta-suave">Vacaciones, descansos u horarios especiales. En esas horas no se pueden dar citas ni se ofrecen en la web.</p>
      {lista.length > 0 && (
        <Tarjeta className="divide-y divide-borde p-0">
          {lista.map(({ b, quien }) => (
            <div key={b.id} className="flex items-center justify-between gap-4 px-6 py-4">
              <div>
                <div className="font-semibold">
                  {TIPO[b.tipo]} · {quien ?? "Todo el centro"}
                </div>
                <div className="text-sm text-tinta-suave">
                  {fechaHora(b.inicio)} → {fechaHora(b.fin)}
                  {b.motivo && ` · ${b.motivo}`}
                </div>
              </div>
              <form action={quitarBloqueo}>
                <input type="hidden" name="id" value={b.id} />
                <Boton type="submit" variante="discreto">
                  Quitar
                </Boton>
              </form>
            </div>
          ))}
        </Tarjeta>
      )}
      <Tarjeta className="space-y-4">
        <h2 className="text-2xl">Nuevo bloqueo</h2>
        <FormularioBloqueo equipo={equipo.map((p) => ({ id: p.id, nombre: p.nombre }))} hoy={hoyEnMadrid(new Date())} />
      </Tarjeta>
    </div>
  );
}
