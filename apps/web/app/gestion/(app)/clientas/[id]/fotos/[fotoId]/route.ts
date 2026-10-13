import { requerirSesion } from "@/server/auth";
import { datosFoto } from "@/server/fichas";

/** Una foto de la ficha (solo con sesión y permiso para fichas). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string; fotoId: string }> }) {
  await requerirSesion("clientas.gestionar");
  const { id, fotoId } = await params;
  const f = await datosFoto(id, fotoId);
  if (!f) return new Response("No existe", { status: 404 });
  return new Response(new Uint8Array(f.datos), { headers: { "Content-Type": f.mime, "Cache-Control": "private, max-age=3600" } });
}
