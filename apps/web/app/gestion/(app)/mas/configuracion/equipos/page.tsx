import { dispositivos, usuarios } from "@adela/db";
import { Aviso, Boton, Tarjeta } from "@adela/ui";
import { desc, eq } from "drizzle-orm";
import { fechaHora } from "@/lib/fechas";
import { dispositivoActual, requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { revocarEquipo } from "./acciones";

export default async function Equipos() {
  await requerirSesion("configuracion.gestionar");
  const actual = await dispositivoActual();
  const lista = await db()
    .select({ d: dispositivos, por: usuarios.nombre })
    .from(dispositivos)
    .innerJoin(usuarios, eq(usuarios.id, dispositivos.registradoPor))
    .orderBy(desc(dispositivos.creadoEn));
  return (
    <div className="space-y-6">
      <h1 className="text-4xl">Equipos de confianza</h1>
      <p className="text-tinta-suave">
        Solo en estos equipos se puede entrar con PIN. Para añadir uno, entra en él con contraseña de administración y marca
        «Este equipo es el TPV del centro».
      </p>
      {lista.length === 0 && <Aviso prioridad="informativo">Todavía no hay ningún equipo registrado.</Aviso>}
      {lista.map(({ d, por }) => (
        <Tarjeta key={d.id} className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xl font-semibold">
              {d.nombre}
              {actual?.id === d.id && <span className="ml-2 text-base font-normal text-dorado">(este equipo)</span>}
            </div>
            <div className="text-sm text-tinta-suave">
              Registrado por {por} el {fechaHora(d.creadoEn)} · último uso {fechaHora(d.ultimoUso)}
              {d.revocadoEn && ` · retirado el ${fechaHora(d.revocadoEn)}`}
            </div>
          </div>
          {!d.revocadoEn && (
            <form action={revocarEquipo}>
              <input type="hidden" name="id" value={d.id} />
              <Boton variante="peligro" type="submit">
                Retirar
              </Boton>
            </form>
          )}
        </Tarjeta>
      ))}
    </div>
  );
}
