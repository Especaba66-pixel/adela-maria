import { timingSafeEqual } from "node:crypto";
import { sincronizar } from "@/server/internet";

/**
 * Sincroniza las reservas por internet. La llama el propio servidor cada minuto (instrumentation.ts) con la clave
 * de sincronización; no tiene nada que ver con la sesión del personal.
 */
export async function POST(req: Request) {
  const dada = Buffer.from((req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const clave = Buffer.from(process.env.RESERVAS_CLAVE ?? "");
  if (clave.length < 32 || dada.length !== clave.length || !timingSafeEqual(dada, clave)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const r = await sincronizar();
  return Response.json(r, { status: r.ok ? 200 : 502 });
}
