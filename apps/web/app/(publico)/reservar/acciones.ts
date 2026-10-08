"use server";
import { redirect } from "next/navigation";
import { crearSolicitud, reservarConHora } from "@/server/reservas";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function pedirCita(_previo: { error?: string }, f: FormData): Promise<{ error?: string }> {
  const r = await crearSolicitud(
    {
      tratamientoId: texto(f, "tratamiento"),
      fechaPreferida: texto(f, "fecha"),
      franja: texto(f, "franja"),
      nombre: texto(f, "nombre"),
      telefono: texto(f, "telefono"),
      nota: texto(f, "nota"),
      aceptaPrivacidad: f.get("privacidad") === "on",
    },
    texto(f, "web"),
  );
  if (!r.ok) return { error: r.error };
  redirect("/reservar/gracias");
}

export async function reservarCita(_previo: { error?: string }, f: FormData): Promise<{ error?: string }> {
  const r = await reservarConHora(
    {
      tratamientoId: texto(f, "tratamiento"),
      fecha: texto(f, "fecha"),
      minutos: Number(texto(f, "hora")),
      nombre: texto(f, "nombre"),
      telefono: texto(f, "telefono"),
      nota: texto(f, "nota"),
      aceptaPrivacidad: f.get("privacidad") === "on",
    },
    texto(f, "web"),
  );
  if (!r.ok) return { error: r.error };
  redirect("/reservar/gracias?cita=1");
}
