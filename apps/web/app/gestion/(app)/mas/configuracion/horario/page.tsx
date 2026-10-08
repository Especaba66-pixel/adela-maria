import { horarios } from "@adela/db";
import { horaATexto } from "@adela/dominio";
import { Tarjeta } from "@adela/ui";
import { asc } from "drizzle-orm";
import { profesionalesActivos } from "@/server/agenda";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { FormularioHorario } from "./Formulario";

export default async function Horario() {
  await requerirSesion("configuracion.gestionar");
  const [equipo, filas] = await Promise.all([profesionalesActivos(), db().select().from(horarios).orderBy(asc(horarios.inicioMin))]);
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-4xl">Horario</h1>
      <p className="text-tinta-suave">Horario de cada semana. Para vacaciones o días sueltos usa los bloqueos de la agenda.</p>
      {equipo.map((p) => {
        const valores: Record<number, [string, string][]> = {};
        for (const h of filas.filter((f) => f.profesionalId === p.id)) {
          (valores[h.diaSemana] ??= []).push([horaATexto(h.inicioMin), horaATexto(h.finMin)]);
        }
        return (
          <Tarjeta key={p.id} className="space-y-3">
            <h2 className="text-2xl">{p.nombre}</h2>
            <FormularioHorario profesionalId={p.id} nombre={p.nombre} valores={valores} />
          </Tarjeta>
        );
      })}
    </div>
  );
}
