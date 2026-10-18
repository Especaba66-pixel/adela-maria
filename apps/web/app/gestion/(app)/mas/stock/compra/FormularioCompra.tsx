"use client";
import { errorAjustesCompra, eurosACentimos, formatearEuros, totalCompra } from "@adela/dominio";
import { Aviso, Boton, Tarjeta } from "@adela/ui";
import { useState, useTransition } from "react";
import { comprar, type LineaCompraForm } from "../acciones";

const campo = "mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg";
const aTexto = (c: number | null) => (c === null ? "" : (c / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 }));

export function FormularioCompra({
  hoy,
  proveedores,
  productos,
}: {
  hoy: string;
  proveedores: { id: string; nombre: string }[];
  productos: { id: string; nombre: string; proveedorId: string | null; coste: number | null }[];
}) {
  const [proveedorId, setProveedor] = useState(proveedores[0]!.id);
  const [fecha, setFecha] = useState(hoy);
  const [numeroFactura, setNumero] = useState("");
  const [iva, setIva] = useState("21");
  const [descuento, setDescuento] = useState("");
  const [totalFactura, setTotalFactura] = useState("");
  const [lineas, setLineas] = useState<LineaCompraForm[]>([{ productoId: "", cantidad: "1", coste: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  const cambiar = (i: number, c: Partial<LineaCompraForm>) => setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...c } : l)));
  const validas = lineas.flatMap((l) => {
    const coste = eurosACentimos(l.coste);
    const cantidad = Number(l.cantidad);
    return l.productoId && coste !== null && Number.isInteger(cantidad) && cantidad > 0 ? [{ cantidad, costeUnitario: coste }] : [];
  });
  const ivaN = Math.round(Number(iva.replace(",", ".")) * 100);
  const descuentoN = descuento.trim() ? eurosACentimos(descuento) : 0;
  const totalN = totalFactura.trim() ? eurosACentimos(totalFactura) : undefined;
  const ajustes = { descuento: descuentoN ?? 0, totalFactura: totalN ?? undefined };
  const aviso = Number.isFinite(ivaN) && validas.length > 0 ? errorAjustesCompra(validas, ivaN, ajustes) : null;
  const totales = Number.isFinite(ivaN) && !aviso ? totalCompra(validas, ivaN, ajustes) : null;
  // Primero los productos de ese proveedor.
  const ordenados = [...productos].sort((a, b) => Number(b.proveedorId === proveedorId) - Number(a.proveedorId === proveedorId) || a.nombre.localeCompare(b.nombre));

  return (
    <form
      className="space-y-4"
      aria-label="Compra"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        iniciar(async () => {
          const r = await comprar({ proveedorId, fecha, numeroFactura, iva, descuento, totalFactura, lineas });
          if (r?.error) setError(r.error);
        });
      }}
    >
      {error && <Aviso prioridad="urgente">{error}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block sm:col-span-2">
          Proveedor
          <select value={proveedorId} onChange={(e) => setProveedor(e.target.value)} className={campo}>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Fecha de la factura
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className={campo} />
        </label>
        <label className="block">
          Nº de factura
          <input value={numeroFactura} onChange={(e) => setNumero(e.target.value)} className={campo} />
        </label>
      </div>

      <Tarjeta className="space-y-3">
        <h2 className="text-2xl">Productos</h2>
        {lineas.map((l, i) => (
          <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_7rem_9rem_auto]" role="group" aria-label={`Línea ${i + 1}`}>
            <label className="block">
              Producto
              <select
                value={l.productoId}
                onChange={(e) => {
                  const p = productos.find((x) => x.id === e.target.value);
                  cambiar(i, { productoId: e.target.value, coste: l.coste || aTexto(p?.coste ?? null) });
                }}
                className={campo}
              >
                <option value="">Elige…</option>
                {ordenados.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              Cantidad
              <input inputMode="numeric" value={l.cantidad} onChange={(e) => cambiar(i, { cantidad: e.target.value })} className={campo} />
            </label>
            <label className="block">
              Coste/ud. sin IVA (€)
              <input inputMode="decimal" value={l.coste} onChange={(e) => cambiar(i, { coste: e.target.value })} className={campo} />
            </label>
            <Boton variante="discreto" aria-label={`Quitar línea ${i + 1}`} disabled={lineas.length === 1} onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))}>
              Quitar
            </Boton>
          </div>
        ))}
        <Boton variante="secundario" onClick={() => setLineas((ls) => [...ls, { productoId: "", cantidad: "1", coste: "" }])}>
          + Otro producto
        </Boton>
      </Tarjeta>

      <div className="flex flex-wrap items-end gap-6">
        <label className="block w-32">
          IVA (%)
          <input inputMode="decimal" value={iva} onChange={(e) => setIva(e.target.value)} className={campo} />
        </label>
        <label className="block w-44">
          Descuento del pedido sin IVA (€)
          <input inputMode="decimal" value={descuento} onChange={(e) => setDescuento(e.target.value)} placeholder="0" className={campo} />
        </label>
        <label className="block w-44">
          Total de la factura (€)
          <input inputMode="decimal" value={totalFactura} onChange={(e) => setTotalFactura(e.target.value)} placeholder="Opcional" className={campo} />
        </label>
        {aviso && <p className="text-lg text-urgente">{aviso}</p>}
        {totales && (
          <div className="text-lg" data-testid="total-compra">
            Base {formatearEuros(totales.base)} · IVA {formatearEuros(totales.cuota)} · <strong>Total {formatearEuros(totales.total)}</strong>
          </div>
        )}
      </div>
      <Boton type="submit" grande disabled={guardando || validas.length === 0}>
        {guardando ? "Guardando…" : "Registrar compra"}
      </Boton>
    </form>
  );
}
