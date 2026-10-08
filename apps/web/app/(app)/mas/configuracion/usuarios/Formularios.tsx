"use client";
import { NOMBRE_ROL, ROLES, type Rol } from "@adela/dominio";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import type { Resultado } from "@/server/usuarios";
import { accionCrear, accionEditar } from "./acciones";

const campo = "mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 focus:border-dorado";

function Mensaje({ estado }: { estado: Resultado | null }) {
  if (!estado) return null;
  return estado.ok ? <Aviso prioridad="correcto">{estado.mensaje}</Aviso> : <Aviso prioridad="urgente">{estado.error}</Aviso>;
}

function SelectorRol({ valor }: { valor?: Rol }) {
  return (
    <select name="rol" defaultValue={valor ?? ""} required className={campo}>
      {!valor && (
        <option value="" disabled>
          Elige…
        </option>
      )}
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {NOMBRE_ROL[r]}
        </option>
      ))}
    </select>
  );
}

export function NuevoUsuario() {
  const [estado, accion, pendiente] = useActionState(accionCrear, null);
  return (
    <form action={accion} className="space-y-4">
      <Mensaje estado={estado} />
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          Nombre
          <input name="nombre" required className={campo} />
        </label>
        <label className="block">
          Usuario
          <input name="usuario" required autoCapitalize="none" className={campo} />
        </label>
        <label className="block">
          Rol
          <SelectorRol />
        </label>
        <label className="block">
          PIN (4 a 6 números)
          <input name="pin" inputMode="numeric" pattern="\d{4,6}" className={campo} />
        </label>
        <label className="col-span-2 block">
          Contraseña (mínimo 10 caracteres)
          <input name="contrasena" type="password" autoComplete="new-password" required minLength={10} className={campo} />
        </label>
      </div>
      <Boton type="submit" disabled={pendiente}>
        Crear usuario
      </Boton>
    </form>
  );
}

export function EditarUsuario({ id, rol, activo, esYo }: { id: string; rol: Rol; activo: boolean; esYo: boolean }) {
  const [estado, accion, pendiente] = useActionState(accionEditar, null);
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <Mensaje estado={estado} />
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          Rol
          <SelectorRol valor={rol} />
        </label>
        <label className="block">
          Estado
          <select name="activo" defaultValue={activo ? "si" : "no"} disabled={esYo} className={campo}>
            <option value="si">Activo</option>
            <option value="no">Desactivado</option>
          </select>
        </label>
        <label className="block">
          Nuevo PIN
          <input name="pin" inputMode="numeric" pattern="\d{4,6}" className={campo} />
        </label>
        <label className="block">
          Nueva contraseña
          <input name="contrasena" type="password" autoComplete="new-password" minLength={10} className={campo} />
        </label>
      </div>
      <Boton type="submit" variante="secundario" disabled={pendiente}>
        Guardar cambios
      </Boton>
    </form>
  );
}
