import { cobros } from "@adela/db";
import { formatearEuros, horaATexto, hoyEnMadrid, partesMadrid } from "@adela/dominio";
import { Tarjeta } from "@adela/ui";
import Link from "next/link";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { bonosALaVenta, catalogoTpv, citasPorCobrar, productosALaVenta, ventasPendientes } from "@/server/tpv";
import { profesionalDeUsuario, profesionalesActivos } from "@/server/agenda";
import { Tpv } from "./Tpv";

export default async function PaginaTpv({ searchParams }: { searchParams: Promise<{ cita?: string }> }) {
  const { usuario } = await requerirSesion("cobrar");
  const [catalogo, bonosVenta, productosVenta, citas, deudas, caja, { cita }, profesionales, propia] = await Promise.all([
    catalogoTpv(),
    bonosALaVenta(),
    productosALaVenta(),
    citasPorCobrar(hoyEnMadrid(new Date())),
    ventasPendientes(),
    cobros.cajaAbierta(db()),
    searchParams,
    profesionalesActivos(),
    profesionalDeUsuario(usuario.id),
  ]);
  const paraCobrar = citas.map((c) => ({
    id: c.id,
    hora: horaATexto(partesMadrid(c.inicio).minutos),
    cliente: { id: c.cliente.id, nombre: c.cliente.nombre },
    servicios: c.servicios,
    tratamientoIds: c.tratamientoIds,
    profesionalId: c.profesionalId,
  }));
  // Si se viene desde una cita, se pone la primera.
  const primero = paraCobrar.find((c) => c.id === cita);
  return (
    <div className="space-y-4">
      <h1 className="text-4xl">TPV</h1>
      <Tpv key={primero?.id ?? "tpv"} catalogo={catalogo} bonosVenta={bonosVenta} productosVenta={productosVenta} citas={paraCobrar} cajaAbierta={Boolean(caja)} inicial={primero}
        profesionales={profesionales.map((p) => ({ id: p.id, nombre: p.nombre }))}
        profesionalPorDefecto={propia?.id ?? (profesionales.length === 1 ? profesionales[0]!.id : undefined)}
      />
      {deudas.length > 0 && (
        <Tarjeta className="divide-y divide-borde p-0">
          <h2 className="px-6 py-3 text-2xl">A deber</h2>
          {deudas.map((d) => (
            <Link key={d.id} href={`/gestion/tpv/pendiente/${d.id}`} className="flex min-h-toque items-center justify-between gap-4 px-6 hover:bg-crema">
              <span>{d.cliente ?? "Sin clienta"}</span>
              <span className="font-semibold">Faltan {formatearEuros(d.pendiente)}</span>
            </Link>
          ))}
        </Tarjeta>
      )}
    </div>
  );
}
