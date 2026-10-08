"use client";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { registrar } from "./acciones";

const campo = "mt-2 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-4 text-lg focus:border-dorado";

export function Formulario({ yaRegistrado }: { yaRegistrado: boolean }) {
  const [estado, accion, pendiente] = useActionState(registrar, {});
  return (
    <form action={accion} className="space-y-5">
      {estado.error && <Aviso prioridad="urgente">{estado.error}</Aviso>}
      {!yaRegistrado && (
        <label className="block font-medium">
          Nombre del equipo
          <input name="equipo" defaultValue="TPV" maxLength={40} required className={campo} />
        </label>
      )}
      <label className="block font-medium">
        Usuario de administración
        <input name="usuario" autoComplete="username" autoCapitalize="none" required className={campo} />
      </label>
      <label className="block font-medium">
        Contraseña
        <input name="contrasena" type="password" autoComplete="current-password" required className={campo} />
      </label>
      <Boton type="submit" grande disabled={pendiente} className="w-full">
        {pendiente ? "Comprobando…" : yaRegistrado ? "Entrar" : "Registrar este equipo"}
      </Boton>
    </form>
  );
}
