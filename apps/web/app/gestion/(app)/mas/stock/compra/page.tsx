import { stock } from "@adela/db";
import { Aviso } from "@adela/ui";
import Link from "next/link";
import { requerirSesion } from "@/server/auth";
import { listaProveedores, productosConStock } from "@/server/stock";
import { FormularioCompra } from "./FormularioCompra";

export default async function NuevaCompra() {
  await requerirSesion("stock.gestionar");
  const [proveedores, productos] = await Promise.all([listaProveedores(), productosConStock()]);
  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/gestion/mas/stock" className="text-tinta-suave underline">
        ← Stock
      </Link>
      <h1 className="text-4xl">Registrar una compra</h1>
      <p className="text-tinta-suave">Copia la factura del proveedor: los productos entran en el stock y la compra queda en los gastos.</p>
      {proveedores.length === 0 || productos.length === 0 ? (
        <Aviso prioridad="pendiente">
          Primero da de alta {proveedores.length === 0 ? <Link href="/gestion/mas/proveedores" className="underline">el proveedor</Link> : null}
          {proveedores.length === 0 && productos.length === 0 ? " y " : null}
          {productos.length === 0 ? <Link href="/gestion/mas/stock" className="underline">los productos</Link> : null}.
        </Aviso>
      ) : (
        <FormularioCompra
          hoy={stock.hoy()}
          proveedores={proveedores.map(({ p }) => ({ id: p.id, nombre: p.nombre }))}
          productos={productos.map((p) => ({ id: p.id, nombre: p.nombre, proveedorId: p.proveedorId, coste: p.costeCentimos }))}
        />
      )}
    </div>
  );
}
