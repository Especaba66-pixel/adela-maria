import { usuarios } from "@adela/db";
import { NOMBRE_ROL } from "@adela/dominio";
import { Tarjeta } from "@adela/ui";
import { asc, desc } from "drizzle-orm";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { EditarUsuario, NuevoUsuario } from "./Formularios";

export default async function Usuarios() {
  const { usuario: yo } = await requerirSesion("usuarios.gestionar");
  const lista = await db().select().from(usuarios).orderBy(desc(usuarios.activo), asc(usuarios.nombre));
  return (
    <div className="space-y-8">
      <h1 className="text-4xl">Usuarios</h1>
      <div className="space-y-4">
        {lista.map((u) => (
          <section key={u.id} aria-label={u.nombre}>
            <Tarjeta className="space-y-4">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h2 className="text-2xl">{u.nombre}</h2>
                <span className="text-tinta-suave">
                  {u.usuario} · {NOMBRE_ROL[u.rol]}
                  {!u.activo && " · desactivado"}
                  {!u.hashPin && " · sin PIN"}
                </span>
              </div>
              <details>
                <summary className="inline-flex min-h-toque cursor-pointer items-center text-dorado-oscuro">Editar</summary>
                <div className="pt-3">
                  <EditarUsuario id={u.id} rol={u.rol} activo={u.activo} esYo={u.id === yo.id} />
                </div>
              </details>
            </Tarjeta>
          </section>
        ))}
      </div>
      <Tarjeta className="space-y-4">
        <h2 className="text-2xl">Nuevo usuario</h2>
        <NuevoUsuario />
      </Tarjeta>
    </div>
  );
}
