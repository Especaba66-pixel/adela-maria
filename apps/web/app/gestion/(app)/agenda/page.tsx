import {
  aMinutosDelDia,
  diasCalendarioMes,
  esFecha,
  horaATexto,
  hoyEnMadrid,
  instanteMadrid,
  lunesDeLaSemana,
  partesMadrid,
  puede,
  sumarDias,
  tramosDisponibles,
} from "@adela/dominio";
import { Aviso, Tarjeta, clases } from "@adela/ui";
import Link from "next/link";
import { BORDE_ESTADO, EstadoCitaChip } from "@/components/EstadoCita";
import { diaLargo } from "@/lib/fechas";
import {
  bloqueosEntre,
  cabinas,
  citasEntre,
  citasQueOcupan,
  horarioDe,
  limitesDia,
  profesionalDeUsuario,
  profesionalesActivos,
  type CitaVista,
} from "@/server/agenda";
import { requerirSesion } from "@/server/auth";

type Vista = "dia" | "semana" | "mes";

const boton = "inline-flex min-h-toque items-center justify-center rounded-xl border-2 px-4 font-medium";
const formatoMes = new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", month: "long", year: "numeric" });
const formatoDiaCorto = new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", weekday: "short", day: "numeric" });
const minutosDe = (d: Date) => partesMadrid(d).minutos;

export default async function Agenda({ searchParams }: { searchParams: Promise<{ vista?: string; fecha?: string; profesional?: string }> }) {
  const { usuario } = await requerirSesion();
  const verToda = puede(usuario.rol, "agenda.ver_toda");
  const propia = await profesionalDeUsuario(usuario.id);
  if (!verToda && !puede(usuario.rol, "agenda.ver_propia")) return <Aviso prioridad="informativo">No tienes agenda.</Aviso>;
  if (!verToda && !propia) return <Aviso prioridad="informativo">Todavía no tienes agenda asignada. Pídeselo a la administración.</Aviso>;
  const gestiona = puede(usuario.rol, "agenda.gestionar");

  const p = await searchParams;
  const vista: Vista = p.vista === "semana" || p.vista === "mes" ? p.vista : "dia";
  const hoy = hoyEnMadrid(new Date());
  const fecha = p.fecha && esFecha(p.fecha) ? p.fecha : hoy;
  const todas = await profesionalesActivos();
  // Una profesional solo ve su agenda.
  const visibles = verToda ? todas.filter((x) => !p.profesional || x.id === p.profesional) : todas.filter((x) => x.id === propia!.id);
  const filtro = verToda ? p.profesional : propia!.id;

  const url = (cambios: Partial<{ vista: Vista; fecha: string; profesional: string }>) => {
    const q = new URLSearchParams({ vista, fecha, ...(filtro && verToda ? { profesional: filtro } : {}), ...cambios });
    return `/gestion/agenda?${q}`;
  };
  const salto = vista === "dia" ? 1 : vista === "semana" ? 7 : 0;
  const anterior = vista === "mes" ? `${sumarDias(`${fecha.slice(0, 7)}-01`, -1).slice(0, 7)}-01` : sumarDias(fecha, -salto);
  const siguiente = vista === "mes" ? `${sumarDias(`${fecha.slice(0, 7)}-01`, 32).slice(0, 7)}-01` : sumarDias(fecha, salto);
  const titulo =
    vista === "dia"
      ? diaLargo(fecha)
      : vista === "semana"
        ? `Semana del ${diaLargo(lunesDeLaSemana(fecha))}`
        : formatoMes.format(new Date(`${fecha}T12:00:00Z`));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-4xl first-letter:uppercase">{titulo}</h1>
        {gestiona && (
          <>
            <Link href="/gestion/agenda/bloqueos" className={`${boton} border-borde bg-superficie`}>
              Bloqueos
            </Link>
            <Link href={`/gestion/agenda/nueva?fecha=${fecha}`} className={`${boton} border-dorado-oscuro bg-dorado-oscuro text-white`}>
              + Nueva cita
            </Link>
          </>
        )}
      </header>

      <nav aria-label="Navegar por la agenda" className="flex flex-wrap items-center gap-2">
        <Link href={url({ fecha: anterior })} className={`${boton} border-borde bg-superficie`} aria-label="Anterior">
          ‹
        </Link>
        <Link href={url({ fecha: hoy })} className={`${boton} border-borde bg-superficie`}>
          Hoy
        </Link>
        <Link href={url({ fecha: siguiente })} className={`${boton} border-borde bg-superficie`} aria-label="Siguiente">
          ›
        </Link>
        <div className="ml-2 flex overflow-hidden rounded-xl border-2 border-borde">
          {(["dia", "semana", "mes"] as const).map((v) => (
            <Link
              key={v}
              href={url({ vista: v })}
              aria-current={v === vista ? "page" : undefined}
              className={clases("inline-flex min-h-toque items-center px-5 font-medium", v === vista ? "bg-dorado-oscuro text-white" : "bg-superficie")}
            >
              {{ dia: "Día", semana: "Semana", mes: "Mes" }[v]}
            </Link>
          ))}
        </div>
        {verToda && todas.length > 1 && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Link href={url({ profesional: "" })} className={clases(boton, !filtro ? "border-dorado-oscuro bg-crema" : "border-borde bg-superficie")}>
              Todas
            </Link>
            {todas.map((x) => (
              <Link key={x.id} href={url({ profesional: x.id })} className={clases(boton, filtro === x.id ? "border-dorado-oscuro bg-crema" : "border-borde bg-superficie")}>
                {x.nombre}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {vista === "dia" && <VistaDia fecha={fecha} profesionales={visibles} gestiona={gestiona} />}
      {vista === "semana" && <VistaSemana fecha={fecha} profesionalId={filtro || undefined} url={url} />}
      {vista === "mes" && <VistaMes fecha={fecha} hoy={hoy} profesionalId={filtro || undefined} url={url} />}
    </div>
  );
}

function TarjetaCita({ c }: { c: CitaVista }) {
  return (
    <Link href={`/gestion/agenda/cita/${c.id}`} className={clases("block rounded-xl border border-l-8 border-borde bg-superficie px-4 py-3 hover:bg-crema", BORDE_ESTADO[c.estado])}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">
          {horaATexto(minutosDe(c.inicio))}–{horaATexto(minutosDe(c.fin))} · {c.cliente.nombre}
        </span>
        <EstadoCitaChip estado={c.estado} />
      </div>
      <div className="text-tinta-suave">
        {c.servicios.join(" + ")}
        {c.origen === "web" && " · pedida en la web"}
        {c.serieId && " · se repite"}
      </div>
    </Link>
  );
}

async function VistaDia({ fecha, profesionales, gestiona }: { fecha: string; profesionales: { id: string; nombre: string; color: string }[]; gestiona: boolean }) {
  const { desde, hasta } = limitesDia(fecha);
  const [ocupan, capacidad] = await Promise.all([citasQueOcupan(desde, hasta), cabinas()]);
  const columnas = await Promise.all(
    profesionales.map(async (prof) => {
      const [horario, lista, bloq] = await Promise.all([horarioDe(prof.id, fecha), citasEntre(desde, hasta, { profesionalId: prof.id, incluirCanceladas: true }), bloqueosEntre(desde, hasta, prof.id)]);
      const activas = lista.filter((c) => c.estado !== "cancelada");
      // Huecos donde aún se puede empezar algo: sin bloqueo, con cabina libre y sin un exclusivo en curso.
      const libres = tramosDisponibles({ fecha, horario, bloqueos: bloq, citas: ocupan, cabinas: capacidad, profesionalId: prof.id });
      type Item = { minuto: number; nodo: React.ReactNode; clave: string };
      const items: Item[] = [
        ...lista.map((c) => ({ minuto: minutosDe(c.inicio), clave: c.id, nodo: <TarjetaCita c={c} /> })),
        ...bloq.map((b) => {
          const t = aMinutosDelDia(fecha, b);
          return {
            minuto: t.inicio,
            clave: b.id,
            nodo: (
              <div className="rounded-xl border border-dashed border-tinta-suave bg-crema px-4 py-3 text-tinta-suave">
                {t.inicio === 0 && t.fin === 1440 ? "Todo el día" : `${horaATexto(t.inicio)}–${horaATexto(t.fin)}`} · {b.motivo ?? b.tipo}
                {!b.profesionalId && " (todo el centro)"}
              </div>
            ),
          };
        }),
        ...libres.map((l) => ({
          minuto: l.inicio,
          clave: `libre-${l.inicio}`,
          nodo: gestiona ? (
            <Link
              href={`/gestion/agenda/nueva?${new URLSearchParams({ fecha, hora: String(l.inicio), profesional: prof.id })}`}
              className="flex min-h-toque items-center justify-between rounded-xl border-2 border-dashed border-dorado-claro px-4 text-dorado-oscuro hover:bg-crema"
              aria-label={`Hueco libre de ${horaATexto(l.inicio)} a ${horaATexto(l.fin)} con ${prof.nombre}`}
            >
              <span>
                {activas.some((c) => minutosDe(c.inicio) < l.fin && minutosDe(c.fin) > l.inicio) ? "Cabina libre" : "Libre"} {horaATexto(l.inicio)}–
                {horaATexto(l.fin)}
              </span>
              <span className="font-semibold">+ Cita</span>
            </Link>
          ) : (
            <div className="px-4 py-2 text-tinta-suave">
              Libre {horaATexto(l.inicio)}–{horaATexto(l.fin)}
            </div>
          ),
        })),
      ].sort((a, b) => a.minuto - b.minuto);
      return { prof, horario, items, citas: activas.length };
    }),
  );

  if (profesionales.length === 0) return <Aviso prioridad="pendiente">No hay profesionales. Añádelas en Configuración → Profesionales.</Aviso>;
  return (
    <div className={clases("grid gap-4", columnas.length > 1 ? "grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>
      {columnas.map(({ prof, horario, items, citas }) => (
        <section key={prof.id} aria-label={`Agenda de ${prof.nombre}`} className="space-y-2">
          <h2 className="flex items-center gap-2 text-2xl">
            <span aria-hidden className="size-4 rounded-full" style={{ background: prof.color }} />
            {prof.nombre}
            <span className="font-sans text-base text-tinta-suave">
              {citas} {citas === 1 ? "cita" : "citas"}
            </span>
          </h2>
          {horario.length === 0 && (
            <p className="text-tinta-suave">
              No trabaja este día según su horario.
              {gestiona && (
                <>
                  {" "}
                  <Link href={`/gestion/agenda/nueva?${new URLSearchParams({ fecha, profesional: prof.id })}`} className="text-dorado-oscuro underline">
                    Dar cita igualmente
                  </Link>
                </>
              )}
            </p>
          )}
          {items.map((i) => (
            <div key={i.clave}>{i.nodo}</div>
          ))}
        </section>
      ))}
    </div>
  );
}

async function VistaSemana({ fecha, profesionalId, url }: { fecha: string; profesionalId?: string; url: (c: { vista?: Vista; fecha?: string }) => string }) {
  const lunes = lunesDeLaSemana(fecha);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const lista = await citasEntre(instanteMadrid(lunes, 0), instanteMadrid(sumarDias(lunes, 7), 0), { profesionalId });
  return (
    <div className="grid grid-cols-7 gap-2">
      {dias.map((d) => {
        const delDia = lista.filter((c) => partesMadrid(c.inicio).fecha === d);
        return (
          <section key={d} aria-label={diaLargo(d)} className="min-w-0 space-y-1">
            <Link href={url({ vista: "dia", fecha: d })} className="block rounded-lg bg-crema px-2 py-2 text-center font-semibold capitalize hover:bg-dorado-claro">
              {formatoDiaCorto.format(new Date(`${d}T12:00:00Z`))}
            </Link>
            {delDia.map((c) => (
              <Link key={c.id} href={`/gestion/agenda/cita/${c.id}`} className={clases("block rounded-lg border border-l-4 border-borde bg-superficie px-2 py-1 text-sm hover:bg-crema", BORDE_ESTADO[c.estado])}>
                <div className="font-semibold">{horaATexto(minutosDe(c.inicio))}</div>
                <div className="truncate">{c.cliente.nombre}</div>
              </Link>
            ))}
          </section>
        );
      })}
    </div>
  );
}

async function VistaMes({ fecha, hoy, profesionalId, url }: { fecha: string; hoy: string; profesionalId?: string; url: (c: { vista?: Vista; fecha?: string }) => string }) {
  const dias = diasCalendarioMes(fecha);
  const lista = await citasEntre(instanteMadrid(dias[0]!, 0), instanteMadrid(sumarDias(dias.at(-1)!, 1), 0), { profesionalId });
  const mes = fecha.slice(0, 7);
  return (
    <Tarjeta className="p-3">
      <div className="grid grid-cols-7 gap-1 text-center text-sm uppercase tracking-wider text-tinta-suave">
        {["lun", "mar", "mié", "jue", "vie", "sáb", "dom"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dias.map((d) => {
          const n = lista.filter((c) => partesMadrid(c.inicio).fecha === d).length;
          return (
            <Link
              key={d}
              href={url({ vista: "dia", fecha: d })}
              aria-label={`${diaLargo(d)}: ${n} citas`}
              className={clases(
                "flex min-h-20 flex-col items-center justify-center rounded-lg border hover:border-dorado",
                d.slice(0, 7) === mes ? "border-borde bg-superficie" : "border-transparent bg-transparent text-tinta-suave",
                d === hoy && "border-2 border-dorado-oscuro",
              )}
            >
              <span className="font-semibold">{Number(d.slice(8))}</span>
              {n > 0 && <span className="mt-1 rounded-full bg-dorado-claro px-2 text-sm">{n}</span>}
            </Link>
          );
        })}
      </div>
    </Tarjeta>
  );
}
