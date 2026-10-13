import { clientes, tareas, usuarios } from "@adela/db";
import { Aviso, Tarjeta } from "@adela/ui";
import { asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { ListaAvisos } from "@/components/ListaAvisos";
import { diaLargo, fechaHora } from "@/lib/fechas";
import { requerirSesion } from "@/server/auth";
import { avisosDeHoy } from "@/server/avisos";
import { db } from "@/server/db";
import { FormularioTarea } from "./FormularioTarea";

export default async function Avisos() {
  const { usuario } = await requerirSesion();
  const [porHacer, proximas, hechas, lista] = await Promise.all([
    avisosDeHoy(usuario),
    db().select().from(tareas).where(isNull(tareas.hechaEn)).orderBy(asc(tareas.fecha)),
    db()
      .select({ t: tareas, quien: usuarios.nombre })
      .from(tareas)
      .leftJoin(usuarios, eq(usuarios.id, tareas.hechaPor))
      .where(isNotNull(tareas.hechaEn))
      .orderBy(desc(tareas.hechaEn))
      .limit(10),
    db().select({ id: clientes.id, nombre: clientes.nombre }).from(clientes).where(isNull(clientes.anonimizadaEn)).orderBy(asc(clientes.nombre)),
  ]);
  const futuras = proximas.filter((t) => t.fecha && !porHacer.some((a) => a.tareaId === t.id));
  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-4xl">Avisos y tareas</h1>

      <section aria-label="Para hoy" className="space-y-3">
        <h2 className="text-2xl">Para hoy</h2>
        {porHacer.length === 0 ? <Aviso prioridad="correcto">Todo en orden: no hay nada pendiente.</Aviso> : <ListaAvisos avisos={porHacer} />}
      </section>

      <Tarjeta>
        <h2 className="mb-3 text-2xl">Apuntar una tarea</h2>
        <FormularioTarea clientas={lista} />
      </Tarjeta>

      {futuras.length > 0 && (
        <section aria-label="Más adelante" className="space-y-2">
          <h2 className="text-2xl">Más adelante</h2>
          <Tarjeta className="divide-y divide-borde p-0">
            {futuras.map((t) => (
              <div key={t.id} className="px-6 py-3">
                <span className="font-semibold">{diaLargo(t.fecha!)}</span> · {t.texto}
              </div>
            ))}
          </Tarjeta>
        </section>
      )}

      {hechas.length > 0 && (
        <details>
          <summary className="min-h-toque cursor-pointer text-xl">Últimas tareas hechas</summary>
          <Tarjeta className="mt-2 divide-y divide-borde p-0">
            {hechas.map(({ t, quien }) => (
              <div key={t.id} className="px-6 py-3 text-tinta-suave">
                {t.texto} · hecha por {quien} el {fechaHora(t.hechaEn!).slice(0, -3)}
              </div>
            ))}
          </Tarjeta>
        </details>
      )}
    </div>
  );
}
