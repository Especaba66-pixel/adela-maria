import { clientes, cobros, ventas } from "@adela/db";
import { formatearEuros } from "@adela/dominio";
import { Aviso } from "@adela/ui";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { PagarPendiente } from "./Pagar";

export default async function Pendiente({ params }: { params: Promise<{ id: string }> }) {
  await requerirSesion("cobrar");
  const { id } = await params;
  const [v] = await db().select({ v: ventas, cliente: clientes.nombre }).from(ventas).leftJoin(clientes, eq(clientes.id, ventas.clienteId)).where(eq(ventas.id, id));
  if (!v) notFound();
  const pendiente = await cobros.pendienteDeVenta(db(), id);
  return (
    <div className="space-y-4">
      <h1 className="text-4xl">Cobrar lo pendiente</h1>
      <p className="text-xl">
        {v.cliente ?? "Sin clienta"} · faltan <strong>{formatearEuros(pendiente)}</strong> de {formatearEuros(v.v.total)}
      </p>
      {pendiente <= 0 ? <Aviso prioridad="correcto">Esta venta ya está pagada.</Aviso> : <PagarPendiente ventaId={id} pendiente={pendiente} />}
    </div>
  );
}
