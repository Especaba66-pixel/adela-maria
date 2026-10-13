"use client";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { sinReinicio } from "@/components/sinReinicio";
import { consumo, contar, guardarProducto, merma, type Estado } from "./acciones";

const campo = "mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg";

function Mensaje({ estado }: { estado: Estado }) {
  if (!estado) return null;
  return estado.ok ? <Aviso prioridad="correcto">{estado.mensaje}</Aviso> : <Aviso prioridad="urgente">{estado.error}</Aviso>;
}

export interface ValoresProducto {
  id: string;
  nombre: string;
  uso: "venta" | "cabina";
  referencia: string;
  precio: string;
  iva: string;
  minimo: string;
  proveedorId: string;
}

export function FormularioProducto({ valores, proveedores }: { valores?: ValoresProducto; proveedores: { id: string; nombre: string }[] }) {
  const [estado, accion, pendiente] = useActionState(guardarProducto, null);
  return (
    <form key={!valores && estado?.ok ? estado.mensaje : "producto"} onSubmit={sinReinicio(accion)} className="space-y-3" aria-label={valores ? "Datos del producto" : "Nuevo producto"}>
      <Mensaje estado={estado} />
      {valores && <input type="hidden" name="id" value={valores.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          Nombre
          <input name="nombre" required defaultValue={valores?.nombre} className={campo} />
        </label>
        <label className="block">
          Para qué es
          <select name="uso" defaultValue={valores?.uso ?? "venta"} className={campo}>
            <option value="venta">Para vender a las clientas</option>
            <option value="cabina">Para gastar en cabina</option>
          </select>
        </label>
        <label className="block">
          Proveedor <span className="text-tinta-suave">(opcional)</span>
          <select name="proveedor" defaultValue={valores?.proveedorId ?? ""} className={campo}>
            <option value="">—</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Precio de venta (€) <span className="text-tinta-suave">(si se vende)</span>
          <input name="precio" inputMode="decimal" defaultValue={valores?.precio} className={campo} />
        </label>
        <label className="block">
          IVA (%)
          <input name="iva" inputMode="decimal" defaultValue={valores?.iva} className={campo} />
        </label>
        <label className="block">
          Avisar cuando queden
          <input name="minimo" inputMode="numeric" defaultValue={valores?.minimo ?? "0"} className={campo} />
        </label>
        <label className="block">
          Referencia <span className="text-tinta-suave">(opcional)</span>
          <input name="referencia" defaultValue={valores?.referencia} className={campo} />
        </label>
      </div>
      <Boton type="submit" variante={valores ? "secundario" : "principal"} disabled={pendiente}>
        {valores ? "Guardar" : "Añadir producto"}
      </Boton>
    </form>
  );
}

export function FormularioRecuento({ id, stock }: { id: string; stock: number }) {
  const [estado, accion, pendiente] = useActionState(contar, null);
  return (
    <form onSubmit={sinReinicio(accion)} className="space-y-3" aria-label="Recuento">
      <Mensaje estado={estado} />
      <input type="hidden" name="id" value={id} />
      <p className="text-tinta-suave">Cuenta lo que hay de verdad y escríbelo. Se anota la diferencia con lo que dice la app ({stock}).</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          Hay ahora
          <input name="contado" inputMode="numeric" required className={campo} />
        </label>
        <label className="block">
          Motivo <span className="text-tinta-suave">(opcional)</span>
          <input name="motivo" placeholder="Inventario" className={campo} />
        </label>
      </div>
      <Boton type="submit" variante="secundario" disabled={pendiente}>
        Anotar recuento
      </Boton>
    </form>
  );
}

export function FormularioMerma({ id }: { id: string }) {
  const [estado, accion, pendiente] = useActionState(merma, null);
  return (
    <form onSubmit={sinReinicio(accion)} className="space-y-3" aria-label="Roto o caducado">
      <Mensaje estado={estado} />
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          Unidades
          <input name="cantidad" inputMode="numeric" required className={campo} />
        </label>
        <label className="block">
          Motivo
          <input name="motivo" required placeholder="Se cayó, caducado…" className={campo} />
        </label>
      </div>
      <Boton type="submit" variante="secundario" disabled={pendiente}>
        Quitar del stock
      </Boton>
    </form>
  );
}

export function FormularioConsumo({ id, tratamientos }: { id: string; tratamientos: { id: string; nombre: string; consumo: number }[] }) {
  const [estado, accion, pendiente] = useActionState(consumo, null);
  return (
    <form onSubmit={sinReinicio(accion)} className="space-y-3" aria-label="Gasto en cabina">
      <Mensaje estado={estado} />
      <input type="hidden" name="id" value={id} />
      <p className="text-tinta-suave">Al cobrar el tratamiento (o descontarlo de un bono) se resta solo del stock. Pon 0 para que no gaste nada.</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <label className="block">
          Tratamiento
          <select name="tratamiento" className={campo}>
            {tratamientos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
                {t.consumo ? ` (ahora ${t.consumo})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Unidades
          <input name="cantidad" inputMode="numeric" required className={campo} />
        </label>
      </div>
      <Boton type="submit" variante="secundario" disabled={pendiente}>
        Guardar
      </Boton>
    </form>
  );
}
