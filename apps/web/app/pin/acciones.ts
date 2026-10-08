"use server";
import { entrarConPin } from "@/server/auth";

export async function entrarPin(usuarioId: string, pin: string): Promise<{ error?: string }> {
  const r = await entrarConPin(usuarioId, pin);
  return r.ok ? {} : { error: r.error };
}
