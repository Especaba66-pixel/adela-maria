import { formatearEuros } from "@adela/dominio";
import { Tarjeta } from "@adela/ui";
import { requerirSesion } from "@/server/auth";
import { listaProveedores } from "@/server/stock";
import { FormularioProveedor } from "./Formulario";

export default async function Proveedores() {
  await requerirSesion("stock.gestionar");
  const lista = await listaProveedores();
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-4xl">Proveedores</h1>
      {lista.length === 0 && <p className="text-tinta-suave">Todavía no hay proveedores.</p>}
      {lista.map(({ p, compras, gastado }) => (
        <section key={p.id} aria-label={p.nombre}>
          <Tarjeta className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl">{p.nombre}</h2>
              <span className="text-tinta-suave">
                {compras} {compras === 1 ? "compra" : "compras"} · {formatearEuros(gastado)} en gastos
              </span>
            </div>
            <p className="text-tinta-suave">{[p.nif && `NIF ${p.nif}`, p.telefono, p.email, p.notas].filter(Boolean).join(" · ") || "Sin datos de contacto"}</p>
            <details>
              <summary className="min-h-toque cursor-pointer pt-2 text-dorado-oscuro">Editar</summary>
              <div className="pt-3">
                <FormularioProveedor valores={{ id: p.id, nombre: p.nombre, nif: p.nif ?? "", telefono: p.telefono ?? "", email: p.email ?? "", notas: p.notas ?? "" }} />
              </div>
            </details>
          </Tarjeta>
        </section>
      ))}
      <Tarjeta>
        <h2 className="mb-3 text-2xl">Añadir un proveedor</h2>
        <FormularioProveedor />
      </Tarjeta>
    </div>
  );
}
