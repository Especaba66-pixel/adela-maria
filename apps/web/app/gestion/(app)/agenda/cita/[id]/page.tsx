import { ESTADOS_CITA, enlaceWhatsapp, formatearTelefono, horaATexto, partesMadrid, puede, puedeCambiarEstado, textoPrecio } from "@adela/dominio";
import { Aviso, Tarjeta } from "@adela/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EstadoCitaChip } from "@/components/EstadoCita";
import { diaLargo } from "@/lib/fechas";
import { detalleCita, profesionalDeUsuario, profesionalesActivos } from "@/server/agenda";
import { requerirSesion } from "@/server/auth";
import { BotonCancelarSerie, BotonesEstado, FormularioMover } from "./Acciones";

export default async function Cita({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creada?: string; canceladas?: string }> }) {
  const { usuario } = await requerirSesion();
  const [{ id }, { creada, canceladas }] = await Promise.all([params, searchParams]);
  const d = await detalleCita(id);
  if (!d) notFound();
  const gestiona = puede(usuario.rol, "agenda.gestionar");
  // Una profesional solo puede ver sus propias citas.
  if (!puede(usuario.rol, "agenda.ver_toda")) {
    const propia = await profesionalDeUsuario(usuario.id);
    if (propia?.id !== d.c.profesionalId) notFound();
  }
  const ini = partesMadrid(d.c.inicio);
  const fin = partesMadrid(d.c.fin);
  const posibles = ESTADOS_CITA.filter((e) => puedeCambiarEstado(d.c.estado, e));
  const servicios = d.servicios.map((s) => s.nombre).join(" y ");
  const anonima = Boolean(d.cliente.anonimizadaEn);
  const mensaje =
    `Hola, ${d.cliente.nombre}. Te ${d.c.estado === "pendiente" ? "confirmamos" : "recordamos"} tu cita de ${servicios} el ` +
    `${diaLargo(ini.fecha)} a las ${horaATexto(ini.minutos)}. Adela María · Belleza holística`;

  return (
    <div className="max-w-3xl space-y-6">
      <Link href={`/gestion/agenda?fecha=${ini.fecha}`} className="inline-flex min-h-toque items-center text-dorado-oscuro underline">
        ‹ Volver a la agenda
      </Link>
      {creada && (
        <Aviso prioridad="correcto">{Number(creada) > 1 ? `Se han creado ${creada} citas (se repite).` : "Cita guardada."}</Aviso>
      )}
      {canceladas && (
        <Aviso prioridad="correcto">{Number(canceladas) === 1 ? "1 cita cancelada." : `${canceladas} citas canceladas.`}</Aviso>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-4xl first-letter:uppercase">
          {diaLargo(ini.fecha)}, {horaATexto(ini.minutos)}–{horaATexto(fin.minutos)}
        </h1>
        <EstadoCitaChip estado={d.c.estado} />
      </div>

      <Tarjeta>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="text-tinta-suave">Clienta</dt>
          <dd className="font-semibold">
            {anonima || !gestiona ? d.cliente.nombre : <Link href={`/gestion/clientas/${d.cliente.id}`} className="text-dorado-oscuro underline">{d.cliente.nombre}</Link>}
            {d.cliente.telefono && <span className="font-normal text-tinta-suave"> · {formatearTelefono(d.cliente.telefono)}</span>}
          </dd>
          <dt className="text-tinta-suave">Tratamientos</dt>
          <dd>
            {d.servicios.map((s) => (
              <div key={s.nombre}>
                {s.nombre} <span className="text-tinta-suave">· {s.duracion} min · {textoPrecio(s.precio)}</span>
              </div>
            ))}
          </dd>
          <dt className="text-tinta-suave">Profesional</dt>
          <dd>{d.profesional.nombre}</dd>
          {d.c.nota && (
            <>
              <dt className="text-tinta-suave">Nota</dt>
              <dd>{d.c.nota}</dd>
            </>
          )}
          <dt className="text-tinta-suave">Origen</dt>
          <dd>{d.c.origen === "web" ? "Pedida por la clienta en la web" : "Dada en el centro"}{d.c.serieId && " · se repite"}</dd>
        </dl>
      </Tarjeta>

      {gestiona && posibles.length > 0 && (
        <Tarjeta className="space-y-4">
          <h2 className="text-2xl">Estado</h2>
          <BotonesEstado id={d.c.id} posibles={posibles} actual={d.c.estado} />
          {d.c.serieId && (d.c.estado === "pendiente" || d.c.estado === "confirmada") && <BotonCancelarSerie id={d.c.id} />}
        </Tarjeta>
      )}

      {gestiona && d.cliente.telefono && (d.c.estado === "pendiente" || d.c.estado === "confirmada") && (
        <a
          href={enlaceWhatsapp(d.cliente.telefono, mensaje)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-toque items-center rounded-xl border-2 border-correcto px-5 font-semibold text-correcto hover:bg-correcto-fondo"
        >
          {d.c.estado === "pendiente" ? "Confirmar por WhatsApp" : "Recordar por WhatsApp"}
        </a>
      )}

      {gestiona && (d.c.estado === "pendiente" || d.c.estado === "confirmada") && (
        <Tarjeta className="space-y-4">
          <h2 className="text-2xl">Cambiar de día u hora</h2>
          <FormularioMover
            id={d.c.id}
            fecha={ini.fecha}
            hora={horaATexto(ini.minutos)}
            profesionalId={d.c.profesionalId}
            equipo={(await profesionalesActivos()).map((p) => ({ id: p.id, nombre: p.nombre }))}
          />
        </Tarjeta>
      )}
    </div>
  );
}
