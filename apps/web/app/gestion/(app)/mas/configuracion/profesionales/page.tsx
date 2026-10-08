import { profesionales, profesionalesTratamientos, usuarios } from "@adela/db";
import { Tarjeta } from "@adela/ui";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { catalogoParaCitas } from "@/server/agenda";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { FormularioProfesional } from "./Formulario";

export default async function Profesionales() {
  await requerirSesion("configuracion.gestionar");
  const [lista, asignaciones, gente, tratamientos] = await Promise.all([
    db().select().from(profesionales).orderBy(asc(profesionales.orden), asc(profesionales.nombre)),
    db().select().from(profesionalesTratamientos),
    db().select({ id: usuarios.id, nombre: usuarios.nombre }).from(usuarios).where(eq(usuarios.activo, true)).orderBy(asc(usuarios.nombre)),
    catalogoParaCitas(),
  ]);
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-4xl">Profesionales</h1>
      <p className="text-tinta-suave">
        Quién atiende citas. Su horario se pone en <Link href="/gestion/mas/configuracion/horario" className="text-dorado-oscuro underline">Horario</Link>.
      </p>
      {lista.map((p) => {
        const suyos = asignaciones.filter((a) => a.profesionalId === p.id).map((a) => a.tratamientoId);
        return (
          <section key={p.id} aria-label={p.nombre}>
            <Tarjeta className="space-y-3">
              <div className="flex items-center gap-3">
                <span aria-hidden className="size-5 rounded-full" style={{ background: p.color }} />
                <h2 className="text-2xl">{p.nombre}</h2>
                <span className="text-tinta-suave">
                  {p.activo ? "" : "no atiende · "}
                  {suyos.length ? `${suyos.length} tratamientos` : "hace todos los tratamientos"}
                </span>
              </div>
              <details>
                <summary className="inline-flex min-h-toque cursor-pointer items-center text-dorado-oscuro">Editar</summary>
                <div className="pt-3">
                  <FormularioProfesional valores={{ ...p, tratamientoIds: suyos }} usuarios={gente} tratamientos={tratamientos} />
                </div>
              </details>
            </Tarjeta>
          </section>
        );
      })}
      <Tarjeta className="space-y-4">
        <h2 className="text-2xl">Nueva profesional</h2>
        <FormularioProfesional usuarios={gente} tratamientos={tratamientos} />
      </Tarjeta>
    </div>
  );
}
