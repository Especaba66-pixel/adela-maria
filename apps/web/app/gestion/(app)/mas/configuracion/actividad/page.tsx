import { registroActividad, usuarios } from "@adela/db";
import { Tarjeta } from "@adela/ui";
import { desc, eq } from "drizzle-orm";
import { fechaHora } from "@/lib/fechas";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";

const ACCIONES: Record<string, string> = {
  "sesion.entrar": "Entró",
  "sesion.salir": "Salió",
  "sesion.caducada": "Sesión cerrada por inactividad",
  "sesion.fallo": "Intento de entrada fallido",
  "sesion.bloqueo": "Bloqueado por intentos fallidos",
  "usuario.crear": "Creó un usuario",
  "usuario.editar": "Modificó un usuario",
  "dispositivo.registrar": "Registró un equipo de confianza",
  "dispositivo.revocar": "Retiró un equipo de confianza",
  "centro.editar": "Cambió los datos del centro",
  "reserva.solicitar": "Una clienta pidió cita",
  "reserva.confirmar": "Confirmó una petición de cita",
  "reserva.rechazar": "Rechazó una petición de cita",
  "cita.crear": "Dio una cita",
  "cita.estado": "Cambió el estado de una cita",
  "cita.mover": "Movió una cita",
  "clienta.crear": "Creó una ficha de clienta",
  "clienta.editar": "Modificó una ficha de clienta",
  "clienta.exportar": "Descargó los datos de una clienta",
  "clienta.suprimir": "Eliminó los datos de una clienta",
  "bloqueo.crear": "Bloqueó horas de la agenda",
  "bloqueo.quitar": "Quitó un bloqueo de la agenda",
  "horario.editar": "Cambió un horario",
  "profesional.crear": "Añadió una profesional",
  "profesional.editar": "Modificó una profesional",
  "tratamiento.crear": "Añadió un tratamiento",
  "tratamiento.editar": "Modificó un tratamiento",
  "categoria.crear": "Creó una categoría",
};

/** Qué campos cambiaron entre "antes" y "después" (sin mostrar secretos). */
function cambios(antes: unknown, despues: unknown): string {
  if (!antes || !despues || typeof antes !== "object" || typeof despues !== "object") return "";
  const a = antes as Record<string, unknown>;
  const d = despues as Record<string, unknown>;
  return Object.keys(d)
    .filter((k) => !["actualizadoEn", "intentosFallidos", "bloqueadoHasta"].includes(k) && JSON.stringify(a[k]) !== JSON.stringify(d[k]))
    .map((k) => (k.startsWith("hash") ? `${k.replace("hash", "").toLowerCase()} cambiado` : `${k}: ${String(a[k])} → ${String(d[k])}`))
    .join(", ");
}

export default async function Actividad() {
  await requerirSesion("actividad.ver");
  const filas = await db()
    .select({ r: registroActividad, quien: usuarios.nombre })
    .from(registroActividad)
    .leftJoin(usuarios, eq(usuarios.id, registroActividad.usuarioId))
    .orderBy(desc(registroActividad.id))
    .limit(200);
  return (
    <div className="space-y-6">
      <h1 className="text-4xl">Registro de actividad</h1>
      <p className="text-tinta-suave">Últimos 200 movimientos. Este registro no se puede modificar ni borrar.</p>
      <Tarjeta className="overflow-x-auto p-0">
        <table className="w-full text-left">
          <thead className="border-b border-borde bg-crema text-sm uppercase tracking-wider text-tinta-suave">
            <tr>
              <th className="px-4 py-3">Cuándo</th>
              <th className="px-4 py-3">Quién</th>
              <th className="px-4 py-3">Qué</th>
              <th className="px-4 py-3">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {filas.map(({ r, quien }) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-3">{fechaHora(r.cuando)}</td>
                <td className="px-4 py-3">{quien ?? "Sistema"}</td>
                <td className="px-4 py-3">{ACCIONES[r.accion] ?? r.accion}</td>
                <td className="px-4 py-3 text-sm text-tinta-suave">{cambios(r.antes, r.despues)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>
    </div>
  );
}
