import { NOMBRE_MOVIMIENTO_STOCK, formatearEuros } from "@adela/dominio";
import { Aviso, Tarjeta } from "@adela/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fechaHora } from "@/lib/fechas";
import { requerirSesion } from "@/server/auth";
import { fichaProducto, listaProveedores } from "@/server/stock";
import { FormularioConsumo, FormularioMerma, FormularioProducto, FormularioRecuento } from "../Formularios";

const iva = (c: number | null) => (c === null ? "" : (c / 100).toLocaleString("es-ES"));
const euros = (c: number | null) => (c === null ? "" : (c / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 }));

export default async function Producto({ params }: { params: Promise<{ id: string }> }) {
  await requerirSesion("stock.gestionar");
  const { id } = await params;
  const [f, proveedores] = await Promise.all([fichaProducto(id), listaProveedores()]);
  if (!f) notFound();
  const p = f.producto;
  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/gestion/mas/stock" className="text-tinta-suave underline">
        ← Stock
      </Link>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-4xl">{p.nombre}</h1>
        <div className="text-right">
          <div className="text-tinta-suave">Quedan</div>
          <div className="font-titulo text-5xl" data-testid="stock-actual">
            {f.stock}
          </div>
        </div>
      </header>
      {f.bajo && <Aviso prioridad="importante">Quedan {f.stock}: hay que reponer (el mínimo es {p.stockMinimo}).</Aviso>}
      {p.costeCentimos !== null && <p className="text-tinta-suave">Último coste de compra: {formatearEuros(p.costeCentimos)} sin IVA.</p>}

      <div className="grid gap-6 xl:grid-cols-2">
        <Tarjeta>
          <h2 className="mb-3 text-2xl">Recuento</h2>
          <FormularioRecuento id={p.id} stock={f.stock} />
        </Tarjeta>
        <Tarjeta>
          <h2 className="mb-3 text-2xl">Roto o caducado</h2>
          <FormularioMerma id={p.id} />
        </Tarjeta>
      </div>

      {p.uso === "cabina" && (
        <Tarjeta>
          <h2 className="mb-3 text-2xl">Se gasta en tratamientos</h2>
          <FormularioConsumo id={p.id} tratamientos={f.tratamientos} />
          {f.tratamientos.some((t) => t.consumo) && (
            <ul className="mt-3 list-disc pl-6">
              {f.tratamientos
                .filter((t) => t.consumo)
                .map((t) => (
                  <li key={t.id}>
                    {t.nombre}: {t.consumo} {t.consumo === 1 ? "unidad" : "unidades"}
                  </li>
                ))}
            </ul>
          )}
        </Tarjeta>
      )}

      <Tarjeta className="divide-y divide-borde p-0">
        <h2 className="px-6 py-3 text-2xl">Movimientos</h2>
        {f.historial.length === 0 && <p className="px-6 py-3 text-tinta-suave">Todavía no hay movimientos. Registra una compra o haz un recuento.</p>}
        {f.historial.map(({ m, quien }) => (
          <div key={m.id} className="flex flex-wrap justify-between gap-2 px-6 py-3">
            <span>
              {fechaHora(m.cuando).slice(0, -3)} · {NOMBRE_MOVIMIENTO_STOCK[m.tipo]}
              {m.motivo && <span className="text-tinta-suave"> · {m.motivo}</span>}
              <span className="text-tinta-suave"> · {quien}</span>
            </span>
            <span className={m.cantidad < 0 ? "font-semibold text-urgente" : "font-semibold"}>
              {m.cantidad > 0 ? "+" : ""}
              {m.cantidad}
            </span>
          </div>
        ))}
      </Tarjeta>

      <details className="rounded-tarjeta border border-borde bg-superficie p-6">
        <summary className="cursor-pointer text-2xl">Cambiar datos del producto</summary>
        <div className="pt-4">
          <FormularioProducto
            proveedores={proveedores.map(({ p: x }) => ({ id: x.id, nombre: x.nombre }))}
            valores={{
              id: p.id,
              nombre: p.nombre,
              uso: p.uso,
              referencia: p.referencia ?? "",
              precio: euros(p.precioCentimos),
              iva: iva(p.ivaCentesimas),
              minimo: String(p.stockMinimo),
              proveedorId: p.proveedorId ?? "",
            }}
          />
        </div>
      </details>
    </div>
  );
}
