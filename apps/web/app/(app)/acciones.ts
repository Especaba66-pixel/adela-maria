"use server";
import { redirect } from "next/navigation";
import { salir } from "@/server/auth";

export async function cambiarDePersona() {
  redirect(await salir());
}
