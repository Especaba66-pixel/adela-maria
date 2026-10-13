import { requerirSesion } from "@/server/auth";
import { prepararMensaje } from "@/server/mensajes";

/**
 * Abre WhatsApp con el mensaje de una plantilla ya escrito para una clienta (se usa como enlace desde los avisos y la
 * ficha). Antes deja anotado en la ficha qué se le preparó y da el aviso por atendido.
 */
export async function GET(req: Request) {
  const { usuario } = await requerirSesion("clientas.gestionar");
  const q = new URL(req.url).searchParams;
  const r = await prepararMensaje(usuario.id, {
    clienteId: q.get("cliente") ?? "",
    plantilla: q.get("plantilla") ?? "",
    citaId: q.get("cita") ?? undefined,
    bonoId: q.get("bono") ?? undefined,
    clave: q.get("clave") ?? undefined,
  });
  if (!r.ok) return new Response(r.error, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return Response.redirect(r.enlace, 303);
}
