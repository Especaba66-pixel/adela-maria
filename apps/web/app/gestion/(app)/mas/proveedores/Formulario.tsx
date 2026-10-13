"use client";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { sinReinicio } from "@/components/sinReinicio";
import { guardarProveedor } from "./acciones";

const campo = "mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg";

export interface ValoresProveedor {
  id: string;
  nombre: string;
  nif: string;
  telefono: string;
  email: string;
  notas: string;
}

export function FormularioProveedor({ valores }: { valores?: ValoresProveedor }) {
  const [estado, accion, pendiente] = useActionState(guardarProveedor, null);
  return (
    <form key={!valores && estado?.ok ? estado.mensaje : "proveedor"} onSubmit={sinReinicio(accion)} className="space-y-3" aria-label={valores ? `Datos de ${valores.nombre}` : "Nuevo proveedor"}>
      {estado && (estado.ok ? <Aviso prioridad="correcto">{estado.mensaje}</Aviso> : <Aviso prioridad="urgente">{estado.error}</Aviso>)}
      {valores && <input type="hidden" name="id" value={valores.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          Nombre
          <input name="nombre" required defaultValue={valores?.nombre} className={campo} />
        </label>
        <label className="block">
          NIF <span className="text-tinta-suave">(para los gastos)</span>
          <input name="nif" defaultValue={valores?.nif} className={campo} />
        </label>
        <label className="block">
          Teléfono
          <input name="telefono" type="tel" defaultValue={valores?.telefono} className={campo} />
        </label>
        <label className="block">
          Email
          <input name="email" type="email" defaultValue={valores?.email} className={campo} />
        </label>
        <label className="block sm:col-span-2">
          Notas <span className="text-tinta-suave">(comercial, días de pedido…)</span>
          <input name="notas" defaultValue={valores?.notas} className={campo} />
        </label>
      </div>
      <Boton type="submit" variante={valores ? "secundario" : "principal"} disabled={pendiente}>
        {valores ? "Guardar" : "Añadir proveedor"}
      </Boton>
    </form>
  );
}
