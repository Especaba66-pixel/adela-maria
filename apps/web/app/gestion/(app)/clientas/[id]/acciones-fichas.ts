"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { borrarFoto, firmarConsentimiento, revocarConsentimiento, subirFoto } from "@/server/fichas";

export type Estado = { ok: true; mensaje: string } | { ok: false; error: string } | null;

export async function subir(_: Estado, f: FormData): Promise<Estado> {
  const clienteId = String(f.get("cliente") ?? "");
  const archivo = f.get("archivo");
  const r = await subirFoto({ clienteId, tipo: String(f.get("tipo") ?? ""), nota: String(f.get("nota") ?? ""), archivo: archivo instanceof File ? archivo : null });
  revalidatePath(`/gestion/clientas/${clienteId}`);
  return r.ok ? { ok: true, mensaje: "Foto guardada." } : { ok: false, error: r.error };
}

export async function borrar(f: FormData) {
  const clienteId = String(f.get("cliente") ?? "");
  await borrarFoto(clienteId, String(f.get("foto") ?? ""));
  revalidatePath(`/gestion/clientas/${clienteId}`);
}

export async function firmar(_: Estado, f: FormData): Promise<Estado> {
  const clienteId = String(f.get("cliente") ?? "");
  const r = await firmarConsentimiento({
    clienteId,
    modeloId: String(f.get("modelo") ?? ""),
    firma: String(f.get("firma") ?? ""),
    firmante: String(f.get("firmante") ?? ""),
    citaId: String(f.get("cita") ?? "") || undefined,
  });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/gestion", "layout");
  redirect(`/gestion/clientas/${clienteId}/consentimiento/${r.valor}?firmado=1`);
}

export async function revocar(f: FormData) {
  const clienteId = String(f.get("cliente") ?? "");
  const id = String(f.get("id") ?? "");
  await revocarConsentimiento(id);
  revalidatePath("/gestion", "layout");
  redirect(`/gestion/clientas/${clienteId}/consentimiento/${id}`);
}
