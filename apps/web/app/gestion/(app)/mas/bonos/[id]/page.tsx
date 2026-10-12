import { NOMBRE_ESTADO_BONO, puede, textoQuedan } from "@adela/dominio";
import { Aviso, Tarjeta } from "@adela/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { diaLargo, fechaHora } from "@/lib/fechas";
import { requerirSesion } from "@/server/auth";
import { detalleBono } from "@/server/bonos";
import { DevolverSesion } from "./DevolverSesion";

export default async function Bono({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ usada?: string; devuelta?: string }> }) {
  const { usuario } = await requerirSesion("cobrar");
  const [{ id }, q] = await Promise.all([params, searchParams]);
  const b = await detalleBono(id);
  if (!b) notFound();
  const quedan = b.sesiones - b.usadas;
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-4xl">{b.nombre}</h1>
        <p className="text-lg">
          De{" "}
          <Link href={`/gestion/clientas/${b.clienteId}`} className="font-semibold underline">
            {b.clienta}
          </Link>{" "}
          · comprado el {fechaHora(b.compradoEn).split(",")[0]}
        </p>
      </header>
      {q.usada && (
        <Aviso prioridad="correcto">
          Sesión descontada. {quedan > 0 ? `Le ${textoQuedan(quedan)}.` : "El bono se ha terminado: es buen momento para ofrecerle otro."}
        </Aviso>
      )}
      {q.devuelta && <Aviso prioridad="correcto">Sesión devuelta al bono.</Aviso>}
      {!q.usada && b.estado === "activo" && quedan === 1 && <Aviso prioridad="pendiente">Solo le queda 1 sesión: ofrécele renovar el bono.</Aviso>}

      <Tarjeta className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <div className="text-tinta-suave">Sesiones que quedan</div>
          <div className="font-titulo text-5xl" data-testid="sesiones-quedan">
            {quedan} de {b.sesiones}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-semibold">{NOMBRE_ESTADO_BONO[b.estado]}</div>
          <div className="text-tinta-suave">{b.caducaEn ? `Vale hasta el ${diaLargo(b.caducaEn)}` : "No caduca"}</div>
        </div>
      </Tarjeta>

      <Tarjeta className="divide-y divide-borde p-0">
        <h2 className="px-6 py-3 text-2xl">Sesiones</h2>
        {b.historial.length === 0 && <p className="px-6 py-3 text-tinta-suave">Todavía no ha usado ninguna.</p>}
        {b.historial.map((u) => (
          <div key={u.id} className="flex flex-wrap justify-between gap-2 px-6 py-3">
            <span>
              {fechaHora(u.cuando).slice(0, -3)} · {u.cantidad > 0 ? (u.tratamiento ?? "Sesión") : `Sesión devuelta: ${u.motivo}`}
            </span>
            <span className="text-tinta-suave">{u.quien}</span>
          </div>
        ))}
      </Tarjeta>

      {b.usadas > 0 && !b.anuladoEn && puede(usuario.rol, "bonos.corregir") && <DevolverSesion bonoId={id} />}
    </div>
  );
}
