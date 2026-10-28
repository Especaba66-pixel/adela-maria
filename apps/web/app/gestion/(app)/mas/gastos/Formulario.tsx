"use client";
import { CATEGORIAS_GASTO, NOMBRE_CATEGORIA_GASTO } from "@adela/dominio";
import { Aviso, Boton } from "@adela/ui";
import { useActionState } from "react";
import { sinReinicio } from "@/components/sinReinicio";
import { anotarGasto } from "./acciones";

const campo = "mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg";

export function FormularioGasto({ hoy, proveedores }: { hoy: string; proveedores: { id: string; nombre: string }[] }) {
  const [estado, accion, pendiente] = useActionState(anotarGasto, null);
  return (
    <form key={estado?.ok ? estado.mensaje : "gasto"} onSubmit={sinReinicio(accion)} className="space-y-3" aria-label="Nuevo gasto">
      {estado && (estado.ok ? <Aviso prioridad="correcto">{estado.mensaje}</Aviso> : <Aviso prioridad="urgente">{estado.error}</Aviso>)}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          Concepto
          <input name="concepto" required placeholder="Papel camilla y vaselina" className={campo} />
        </label>
        <label className="block">
          Tipo de gasto
          <select name="categoria" defaultValue="material" className={campo}>
            {CATEGORIAS_GASTO.filter((c) => c !== "compras").map((c) => (
              <option key={c} value={c}>
                {NOMBRE_CATEGORIA_GASTO[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Fecha de la factura
          <input name="fecha" type="date" required defaultValue={hoy} className={campo} />
        </label>
        <label className="block">
          Proveedor <span className="text-tinta-suave">(opcional)</span>
          <select name="proveedor" defaultValue="" className={campo}>
            <option value="">—</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Total pagado, IVA incluido (€)
          <input name="total" inputMode="decimal" required className={campo} />
        </label>
        <label className="block">
          IVA (%)
          <input name="iva" inputMode="decimal" defaultValue="21" className={campo} />
        </label>
        <label className="block">
          Nº de factura <span className="text-tinta-suave">(opcional)</span>
          <input name="factura" className={campo} />
        </label>
        <label className="flex min-h-toque items-center gap-3 self-end">
          <input name="caja" type="checkbox" className="size-6 accent-dorado-oscuro" />
          Pagado en efectivo con dinero de la caja
        </label>
      </div>
      <Boton type="submit" disabled={pendiente}>
        Anotar gasto
      </Boton>
    </form>
  );
}
