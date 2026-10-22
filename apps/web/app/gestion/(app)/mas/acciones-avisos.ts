"use server";
import type { SuscripcionPush } from "@adela/dominio";
import { activarEnEsteEquipo, clavesRemitente, desactivarEnEsteEquipo, enviarPrueba, estaActivado } from "@/server/notificaciones";
import { requerirSesion } from "@/server/auth";

export async function clavePublicaAvisos(): Promise<string> {
  await requerirSesion();
  return (await clavesRemitente()).publica;
}

export async function activarAvisos(s: SuscripcionPush) {
  return activarEnEsteEquipo(s);
}

export async function desactivarAvisos(endpoint: string) {
  await desactivarEnEsteEquipo(endpoint);
}

export async function avisosActivos(endpoint: string): Promise<boolean> {
  await requerirSesion();
  return estaActivado(endpoint);
}

export async function avisoDePrueba(endpoint: string): Promise<boolean> {
  return enviarPrueba(endpoint);
}
