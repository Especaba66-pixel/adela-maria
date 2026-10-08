"use client";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { categoria, guardar } from "./acciones";

const campo = "mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg";

export interface ValoresTratamiento {
  id: string;
  categoriaId: string;
  nombre: string;
  duracion: string;
  precio: string;
  descripcion: string;
  exclusivo: boolean;
  retirado: boolean;
}

export function FormularioTratamiento({ valores, categorias }: { valores?: ValoresTratamiento; categorias: { id: string; nombre: string }[] }) {
  const [estado, accion, pendiente] = useActionState(guardar, null);
  return (
    <form action={accion} className="space-y-3">
      {estado && (estado.ok ? <Aviso prioridad="correcto">{estado.mensaje}</Aviso> : <Aviso prioridad="urgente">{estado.error}</Aviso>)}
      {valores && <input type="hidden" name="id" value={valores.id} />}
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 block">
          Nombre
          <input name="nombre" required defaultValue={valores?.nombre} className={campo} />
        </label>
        <label className="block">
          Categoría
          <select name="categoria" defaultValue={valores?.categoriaId ?? categorias[0]?.id} className={campo}>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            Minutos
            <input name="duracion" inputMode="numeric" placeholder="por decidir" defaultValue={valores?.duracion} className={campo} />
          </label>
          <label className="block">
            Precio (€)
            <input name="precio" inputMode="decimal" placeholder="a consultar" defaultValue={valores?.precio} className={campo} />
          </label>
        </div>
        <label className="col-span-2 block">
          Descripción para la web <span className="text-tinta-suave">(opcional)</span>
          <input name="descripcion" maxLength={300} defaultValue={valores?.descripcion} className={campo} />
        </label>
        <label className="col-span-2 flex min-h-toque items-center gap-3">
          <input name="exclusivo" type="checkbox" defaultChecked={valores?.exclusivo} className="size-6 accent-dorado-oscuro" />
          Va sola: necesita a la profesional en exclusiva (como el microblading)
        </label>
        {valores && (
          <label className="col-span-2 flex min-h-toque items-center gap-3">
            <input name="retirado" type="checkbox" defaultChecked={valores.retirado} className="size-6 accent-dorado-oscuro" />
            Retirado (ya no se ofrece; se conserva en el historial)
          </label>
        )}
      </div>
      <Boton type="submit" variante={valores ? "secundario" : "principal"} disabled={pendiente}>
        {valores ? "Guardar" : "Añadir tratamiento"}
      </Boton>
    </form>
  );
}

export function FormularioCategoria() {
  const [estado, accion, pendiente] = useActionState(categoria, null);
  return (
    <form action={accion} className="flex flex-wrap items-end gap-3">
      {estado && (estado.ok ? <Aviso prioridad="correcto">{estado.mensaje}</Aviso> : <Aviso prioridad="urgente">{estado.error}</Aviso>)}
      <label className="block flex-1">
        Nueva categoría
        <input name="nombre" required className={campo} />
      </label>
      <Boton type="submit" variante="secundario" disabled={pendiente}>
        Crear
      </Boton>
    </form>
  );
}
