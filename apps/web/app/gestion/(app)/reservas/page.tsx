import { solicitudesReserva, tratamientos, usuarios } from "@adela/db";
import { NOMBRE_FRANJA, enlaceWhatsapp, formatearTelefono, horaATexto, partesMadrid } from "@adela/dominio";
import { Aviso, Boton, Tarjeta } from "@adela/ui";
import { asc, desc, eq, ne } from "drizzle-orm";
import Link from "next/link";
import { citasEntre } from "@/server/agenda";
import { diaLargo, fechaHora } from "@/lib/fechas";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { confirmar, confirmarCita, rechazar, rechazarCita } from "./acciones";

const columnas = {
  s: solicitudesReserva,
  tratamiento: tratamientos.nombre,
};

export default async function Reservas() {
  await requerirSesion("reservas.gestionar");
  const citasWeb = await citasEntre(new Date(), new Date("2100-01-01"), { estado: "pendiente" });
  const [pendientes, gestionadas] = await Promise.all([
    db()
      .select(columnas)
      .from(solicitudesReserva)
      .innerJoin(tratamientos, eq(tratamientos.id, solicitudesReserva.tratamientoId))
      .where(eq(solicitudesReserva.estado, "pendiente"))
      .orderBy(asc(solicitudesReserva.creadaEn)),
    db()
      .select({ ...columnas, quien: usuarios.nombre })
      .from(solicitudesReserva)
      .innerJoin(tratamientos, eq(tratamientos.id, solicitudesReserva.tratamientoId))
      .leftJoin(usuarios, eq(usuarios.id, solicitudesReserva.gestionadaPor))
      .where(ne(solicitudesReserva.estado, "pendiente"))
      .orderBy(desc(solicitudesReserva.gestionadaEn))
      .limit(20),
  ]);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-4xl">Reservas por confirmar</h1>
        <p className="text-tinta-suave">
          Citas pedidas por las clientas desde la web. Las que ya tienen hora la tienen guardada en la agenda: confírmalas
          o recházalas (el hueco queda libre). Las que no tienen hora, dales cita.
        </p>
      </div>

      {pendientes.length === 0 && citasWeb.length === 0 && <Aviso prioridad="correcto">No hay peticiones pendientes.</Aviso>}

      {citasWeb.map((c) => {
        const ini = partesMadrid(c.inicio);
        const mensaje =
          `Hola, ${c.cliente.nombre}. Somos Adela María · Belleza holística. Te confirmamos tu cita de ${c.servicios.join(" y ")} ` +
          `el ${diaLargo(ini.fecha)} a las ${horaATexto(ini.minutos)}. ¡Te esperamos!`;
        return (
          <section key={c.id} aria-label={`Cita web de ${c.cliente.nombre}`}>
            <Tarjeta className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-2xl">{c.cliente.nombre}</h2>
                <span className="rounded-full bg-pendiente-fondo px-3 text-sm text-pendiente">Hora reservada en la web</span>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
                <dt className="text-tinta-suave">Tratamiento</dt>
                <dd className="font-medium">{c.servicios.join(" + ")}</dd>
                <dt className="text-tinta-suave">Cuándo</dt>
                <dd className="font-medium first-letter:uppercase">
                  {diaLargo(ini.fecha)} a las {horaATexto(ini.minutos)}
                </dd>
                {c.cliente.telefono && (
                  <>
                    <dt className="text-tinta-suave">Teléfono</dt>
                    <dd className="font-medium">{formatearTelefono(c.cliente.telefono)}</dd>
                  </>
                )}
                {c.nota && (
                  <>
                    <dt className="text-tinta-suave">Comentario</dt>
                    <dd>{c.nota}</dd>
                  </>
                )}
              </dl>
              <div className="flex flex-wrap gap-3">
                {c.cliente.telefono && (
                  <a
                    href={enlaceWhatsapp(c.cliente.telefono, mensaje)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-toque items-center rounded-xl border-2 border-correcto px-5 font-semibold text-correcto hover:bg-correcto-fondo"
                  >
                    Escribir por WhatsApp
                  </a>
                )}
                <form action={confirmarCita}>
                  <input type="hidden" name="id" value={c.id} />
                  <Boton type="submit">Confirmar</Boton>
                </form>
                <form action={rechazarCita}>
                  <input type="hidden" name="id" value={c.id} />
                  <Boton type="submit" variante="discreto">
                    Rechazar
                  </Boton>
                </form>
              </div>
            </Tarjeta>
          </section>
        );
      })}
      {pendientes.map(({ s, tratamiento }) => {
        const mensaje =
          `Hola, ${s.nombre}. Somos Adela María · Belleza holística. Hemos recibido tu petición de cita para ` +
          `${tratamiento} el ${diaLargo(s.fechaPreferida)}. ¿Te viene bien a las `;
        return (
          <section key={s.id} aria-label={`Petición de ${s.nombre}`}>
            <Tarjeta className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-2xl">{s.nombre}</h2>
                <span className="text-sm text-tinta-suave">Pedida el {fechaHora(s.creadaEn)}</span>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
                <dt className="text-tinta-suave">Tratamiento</dt>
                <dd className="font-medium">{tratamiento}</dd>
                <dt className="text-tinta-suave">Prefiere</dt>
                <dd className="font-medium first-letter:uppercase">
                  {diaLargo(s.fechaPreferida)} · {NOMBRE_FRANJA[s.franja].toLowerCase()}
                </dd>
                <dt className="text-tinta-suave">Teléfono</dt>
                <dd className="font-medium">{formatearTelefono(s.telefono)}</dd>
                {s.nota && (
                  <>
                    <dt className="text-tinta-suave">Comentario</dt>
                    <dd>{s.nota}</dd>
                  </>
                )}
              </dl>
              <div className="flex flex-wrap gap-3">
                <a
                  href={enlaceWhatsapp(s.telefono, mensaje)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-toque items-center rounded-xl border-2 border-correcto px-5 font-semibold text-correcto hover:bg-correcto-fondo"
                >
                  Escribir por WhatsApp
                </a>
                <Link
                  href={`/gestion/agenda/nueva?solicitud=${s.id}`}
                  className="inline-flex min-h-toque items-center rounded-xl bg-dorado-oscuro px-5 font-semibold text-white hover:bg-tinta"
                >
                  Dar cita
                </Link>
                <form action={confirmar}>
                  <input type="hidden" name="id" value={s.id} />
                  <Boton type="submit" variante="secundario">
                    Confirmar sin cita
                  </Boton>
                </form>
                <form action={rechazar}>
                  <input type="hidden" name="id" value={s.id} />
                  <Boton type="submit" variante="discreto">
                    Rechazar
                  </Boton>
                </form>
              </div>
            </Tarjeta>
          </section>
        );
      })}

      {gestionadas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-3xl">Últimas contestadas</h2>
          <Tarjeta className="divide-y divide-borde p-0">
            {gestionadas.map(({ s, tratamiento, quien }) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3">
                <div>
                  <span className="font-medium">{s.nombre}</span> · {tratamiento} · {diaLargo(s.fechaPreferida)}
                </div>
                <div className={s.estado === "confirmada" ? "text-correcto" : "text-tinta-suave"}>
                  {s.estado === "confirmada" ? "Confirmada" : "Rechazada"} por {quien}
                </div>
              </div>
            ))}
          </Tarjeta>
        </section>
      )}
    </div>
  );
}
