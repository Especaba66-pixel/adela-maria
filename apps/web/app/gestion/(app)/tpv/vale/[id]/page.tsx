import { clientes, cobros } from "@adela/db";
import { enlaceWhatsapp, estadoTarjeta, formatearEuros, lineasVale, NOMBRE_ESTADO_TARJETA, puede } from "@adela/dominio";
import { Aviso, Tarjeta } from "@adela/ui";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { fechaHora } from "@/lib/fechas";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { datosVale } from "@/server/tpv";
import { BotonesVale, DevolverTarjeta } from "./Botones";

const MOVIMIENTO = { carga: "Compra", pago: "Pago", devolucion: "Devolución de una venta", anulacion: "Tarjeta devuelta" };

export default async function Vale({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cambio?: string; nueva?: string; impresion?: string; devuelta?: string }> }) {
  const { usuario } = await requerirSesion("cobrar");
  const [{ id }, q] = await Promise.all([params, searchParams]);
  const [t, datos] = await Promise.all([cobros.tarjetaRegalo(db(), { id }), datosVale(id)]);
  if (!t || !datos) notFound();
  const [compradora] = t.clienteId ? await db().select().from(clientes).where(eq(clientes.id, t.clienteId)) : [];
  const lineas = lineasVale(datos, 40);
  const texto = "```\n" + lineas.join("\n") + "\n```";
  const whatsapp = compradora?.telefono ? enlaceWhatsapp(compradora.telefono, texto) : `https://wa.me/?text=${encodeURIComponent(texto)}`;
  const cambio = Number(q.cambio ?? 0);
  const estado = estadoTarjeta(t);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_auto]">
      <div className="space-y-4">
        <h1 className="text-4xl">{q.nueva ? "Tarjeta regalo vendida" : `Tarjeta regalo ${t.codigo}`}</h1>
        {cambio > 0 && (
          <Tarjeta className="border-dorado bg-crema">
            <div className="text-xl">Cambio</div>
            <div className="font-titulo text-6xl" data-testid="cambio-final">
              {formatearEuros(cambio)}
            </div>
          </Tarjeta>
        )}
        {q.impresion && <Aviso prioridad="importante">{q.impresion} La tarjeta está guardada: puedes reimprimir el vale o enviarlo por WhatsApp.</Aviso>}
        {q.devuelta && <Aviso prioridad="correcto">Tarjeta devuelta: se ha devuelto el dinero y ya no se puede usar.</Aviso>}
        <Tarjeta className="space-y-1">
          <div className="text-tinta-suave">Saldo</div>
          <div className="font-titulo text-5xl" data-testid="saldo">
            {formatearEuros(t.saldo)}
          </div>
          <div>
            {NOMBRE_ESTADO_TARJETA[estado]} · de {formatearEuros(t.importeInicial)}
            {compradora && <> · comprada por {compradora.nombre}</>}
          </div>
        </Tarjeta>
        <BotonesVale tarjetaId={id} whatsapp={whatsapp} />
        <Tarjeta className="divide-y divide-borde p-0">
          <h2 className="px-6 py-3 text-2xl">Movimientos</h2>
          {t.movimientos.map((m) => (
            <div key={m.id} className="flex justify-between gap-4 px-6 py-3">
              <span>
                {fechaHora(m.cuando).slice(0, -3)} · {MOVIMIENTO[m.tipo]}
              </span>
              <span className={m.importe < 0 ? "font-semibold text-urgente" : "font-semibold"}>{formatearEuros(m.importe)}</span>
            </div>
          ))}
        </Tarjeta>
        {estado === "activa" && t.saldo === t.importeInicial && puede(usuario.rol, "facturas.anular") && <DevolverTarjeta tarjetaId={id} importe={t.saldo} />}
      </div>
      <Tarjeta className="w-fit bg-white p-4">
        <pre aria-label="Vale" className="font-mono text-sm leading-snug">
          {lineas.join("\n")}
        </pre>
      </Tarjeta>
    </div>
  );
}
