"use client";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { entrar } from "./acciones";

const campo = "mt-2 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-4 text-lg focus:border-dorado";

export function Formulario({ esTpv }: { esTpv: boolean }) {
  const [estado, accion, pendiente] = useActionState(entrar, {});
  return (
    <form action={accion} className="space-y-5">
      {estado.error && <Aviso prioridad="urgente">{estado.error}</Aviso>}
      <label className="block font-medium">
        Usuario
        <input name="usuario" autoComplete="username" autoCapitalize="none" required className={campo} />
      </label>
      <label className="block font-medium">
        Contraseña
        <input name="contrasena" type="password" autoComplete="current-password" required className={campo} />
      </label>
      {!esTpv && (
        <label className="flex min-h-toque items-center gap-3 text-tinta-suave">
          <input name="tpv" type="checkbox" className="size-6 accent-dorado-oscuro" />
          Este equipo es el TPV del centro (solo administración)
        </label>
      )}
      <Boton type="submit" grande disabled={pendiente} className="w-full">
        {pendiente ? "Entrando…" : "Entrar"}
      </Boton>
    </form>
  );
}
