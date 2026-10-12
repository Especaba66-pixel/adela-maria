"use server";
import { revalidatePath } from "next/cache";
import { guardarDatosCentro, type Resultado } from "@/server/centro";

export async function guardar(_: Resultado | null, f: FormData): Promise<Resultado> {
  const t = (k: string) => String(f.get(k) ?? "");
  const r = await guardarDatosCentro({
    telefono: t("telefono"),
    direccion: t("direccion"),
    cabinas: t("cabinas"),
    nombreFiscal: t("nombreFiscal"),
    nif: t("nif"),
    direccionFiscal: t("direccionFiscal"),
    pieTicket: t("pieTicket"),
  });
  revalidatePath("/", "layout");
  return r;
}
