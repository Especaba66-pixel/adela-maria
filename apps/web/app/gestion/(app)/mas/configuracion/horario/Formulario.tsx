"use client";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { guardar } from "./acciones";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const hora = "min-h-toque rounded-xl border-2 border-borde bg-superficie px-2 text-lg";

/** `valores[d]` = tramos ["10:00","14:00"] del día d (1 = lunes). */
export function FormularioHorario({ profesionalId, nombre, valores }: { profesionalId: string; nombre: string; valores: Record<number, [string, string][]> }) {
  const [estado, accion, pendiente] = useActionState(guardar, null);
  return (
    <form action={accion} className="space-y-3" aria-label={`Horario de ${nombre}`}>
      {estado && (estado.ok ? <Aviso prioridad="correcto">{estado.mensaje}</Aviso> : <Aviso prioridad="urgente">{estado.error}</Aviso>)}
      <input type="hidden" name="profesional" value={profesionalId} />
      <table className="w-full">
        <thead className="text-left text-sm uppercase tracking-wider text-tinta-suave">
          <tr>
            <th className="py-2">Día</th>
            <th>Mañana (o jornada)</th>
            <th>Tarde</th>
          </tr>
        </thead>
        <tbody>
          {DIAS.map((dia, i) => {
            const d = i + 1;
            return (
              <tr key={dia} className="border-t border-borde">
                <th scope="row" className="py-2 pr-4 text-left font-medium">
                  {dia}
                </th>
                {[1, 2].map((t) => (
                  <td key={t} className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <input name={`d${d}t${t}i`} type="time" step={300} aria-label={`${dia} tramo ${t} desde`} defaultValue={valores[d]?.[t - 1]?.[0]} className={hora} />
                      <span aria-hidden>–</span>
                      <input name={`d${d}t${t}f`} type="time" step={300} aria-label={`${dia} tramo ${t} hasta`} defaultValue={valores[d]?.[t - 1]?.[1]} className={hora} />
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-sm text-tinta-suave">Deja vacío el día que no trabaja.</p>
      <Boton type="submit" disabled={pendiente}>
        Guardar horario
      </Boton>
    </form>
  );
}
