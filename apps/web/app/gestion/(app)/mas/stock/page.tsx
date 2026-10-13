import { NOMBRE_USO, formatearEuros } from "@adela/dominio";
import { Aviso, Tarjeta } from "@adela/ui";
import Link from "next/link";
import { fechaHora } from "@/lib/fechas";
import { requerirSesion } from "@/server/auth";
import { listaProveedores, productosConStock, ultimasCompras } from "@/server/stock";
import { FormularioProducto } from "./Formularios";

export default async function Stock({ searchParams }: { searchParams: Promise<{ compra?: string }> }) {
  await requerirSesion("stock.gestionar");
  const [lista, proveedores, compras, { compra }] = await Promise.all([productosConStock(), listaProveedores(), ultimasCompras(10), searchParams]);
  const bajos = lista.filter((p) => p.bajo);
  return (
    <div className="max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-4xl">Stock</h1>
        <Link href="/gestion/mas/stock/compra" className="inline-flex min-h-toque items-center rounded-xl bg-dorado-oscuro px-5 font-semibold text-white hover:bg-tinta">
          Registrar una compra
        </Link>
      </header>
      {compra && <Aviso prioridad="correcto">Compra registrada por {formatearEuros(Number(compra))}: ya está en el stock y en los gastos.</Aviso>}
      {bajos.length > 0 && (
        <Aviso prioridad="importante">
          Hay que reponer: {bajos.map((p) => `${p.nombre} (quedan ${p.stock})`).join(", ")}.
        </Aviso>
      )}

      {lista.length === 0 ? (
        <p className="text-tinta-suave">Todavía no hay productos. Añade los que vendes y los que gastas en cabina.</p>
      ) : (
        <Tarjeta className="overflow-x-auto p-0">
          <table className="w-full text-left">
            <thead className="border-b border-borde text-sm text-tinta-suave">
              <tr>
                <th className="px-4 py-3 font-normal">Producto</th>
                <th className="px-4 py-3 font-normal">Para</th>
                <th className="px-4 py-3 text-right font-normal">Precio</th>
                <th className="px-4 py-3 text-right font-normal">Quedan</th>
                <th className="px-4 py-3 text-right font-normal">Mínimo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {lista.map((p) => (
                <tr key={p.id} className={p.bajo ? "bg-importante-fondo" : undefined}>
                  <td className="px-4 py-3">
                    <Link href={`/gestion/mas/stock/${p.id}`} className="font-semibold underline-offset-2 hover:underline">
                      {p.nombre}
                    </Link>
                    {p.proveedor && <div className="text-sm text-tinta-suave">{p.proveedor}</div>}
                  </td>
                  <td className="px-4 py-3">{NOMBRE_USO[p.uso]}</td>
                  <td className="px-4 py-3 text-right">{p.precioCentimos === null ? "—" : formatearEuros(p.precioCentimos)}</td>
                  <td className="px-4 py-3 text-right font-semibold" data-testid={`stock-${p.nombre}`}>
                    {p.stock}
                    {p.bajo && <span className="ml-2 rounded-full bg-importante px-2 text-xs font-semibold text-white">reponer</span>}
                  </td>
                  <td className="px-4 py-3 text-right">{p.stockMinimo || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      )}

      <details className="rounded-tarjeta border border-borde bg-superficie p-6">
        <summary className="cursor-pointer text-2xl">Añadir un producto</summary>
        <div className="pt-4">
          <FormularioProducto proveedores={proveedores.map(({ p }) => ({ id: p.id, nombre: p.nombre }))} />
        </div>
      </details>

      {compras.length > 0 && (
        <section aria-label="Últimas compras" className="space-y-2">
          <h2 className="text-2xl">Últimas compras</h2>
          <Tarjeta className="divide-y divide-borde p-0">
            {compras.map(({ c, proveedor, total, lineas }) => (
              <div key={c.id} className="flex flex-wrap justify-between gap-2 px-6 py-3">
                <span>
                  {fechaHora(new Date(`${c.fecha}T12:00:00Z`)).split(",")[0]} · {proveedor}
                  {c.numeroFactura && <span className="text-tinta-suave"> · factura {c.numeroFactura}</span>}
                  <span className="text-tinta-suave"> · {lineas} {lineas === 1 ? "producto" : "productos"}</span>
                </span>
                <span className="font-semibold">{total === null ? "" : formatearEuros(total)}</span>
              </div>
            ))}
          </Tarjeta>
        </section>
      )}
    </div>
  );
}
