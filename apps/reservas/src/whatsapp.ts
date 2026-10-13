/**
 * Webhook de WhatsApp (Meta). Meta avisa aquí de cómo van los envíos y de lo que escriben las clientas; como este
 * servicio está siempre encendido, no se pierde nada aunque el TPV esté apagado. El TPV se lo lleva al sincronizar.
 */

/** Tamaño máximo de un aviso de Meta que se guarda (los normales ocupan unos pocos KB). */
export const MAX_CUERPO = 256 * 1024;

/** Comprueba la firma de Meta (cabecera X-Hub-Signature-256 = «sha256=» + HMAC del cuerpo con el secreto de la app). */
export async function firmaValida(secreto: string, cuerpo: string, cabecera: string | null): Promise<boolean> {
  if (!secreto || !cabecera?.startsWith("sha256=")) return false;
  const dada = cabecera.slice(7).trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(dada)) return false;
  const clave = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = new Uint8Array(await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(cuerpo)));
  const esperada = new Uint8Array(dada.match(/../g)!.map((h) => parseInt(h, 16)));
  if (esperada.length !== firma.length) return false;
  let diferencia = 0;
  for (let i = 0; i < firma.length; i++) diferencia |= firma[i]! ^ esperada[i]!;
  return diferencia === 0;
}

/** Alta del webhook en Meta: devuelve el «challenge» si el token de verificación coincide. */
export function verificarSuscripcion(url: URL, token: string): string | null {
  const p = url.searchParams;
  return token && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === token ? p.get("hub.challenge") : null;
}
