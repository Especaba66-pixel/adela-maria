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
type Modo = "horas" | "lista";
/** Píxeles por minuto en la vista por horas: media hora son 60 px. */
const PX = 2;

const boton = "inline-flex min-h-toque items-center justify-center rounded-xl border-2 px-4 font-medium";
const formatoMes = new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", month: "long", year: "numeric" });
const formatoDiaCorto = new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", weekday: "short", day: "numeric" });
const minutosDe = (d: Date) => partesMadrid(d).minutos;

export default async function Agenda({ searchParams }: { searchParams: Promise<{ vista?: string; fecha?: string; profesional?: string; modo?: string }> }) {
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
  // El día se ve por horas (una escala a un lado y cada cita en su hueco); la lista es la otra forma de verlo.
  const modo: Modo = p.modo === "lista" ? "lista" : "horas";
  const todas = await profesionalesActivos();
  // Una profesional solo ve su agenda.
  const visibles = verToda ? todas.filter((x) => !p.profesional || x.id === p.profesional) : todas.filter((x) => x.id === propia!.id);
  const filtro = verToda ? p.profesional : propia!.id;

  const url = (cambios: Partial<{ vista: Vista; fecha: string; profesional: string; modo: Modo }>) => {
    const q = new URLSearchParams({ vista, fecha, ...(modo === "lista" ? { modo } : {}), ...(filtro && verToda ? { profesional: filtro } : {}), ...cambios });
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
        {vista === "dia" && (
          <div className="flex overflow-hidden rounded-xl border-2 border-borde">
            {(["horas", "lista"] as const).map((m) => (
              <Link
                key={m}
                href={url({ modo: m })}
                aria-current={m === modo ? "true" : undefined}
                className={clases("inline-flex min-h-toque items-center px-4 font-medium", m === modo ? "bg-dorado-oscuro text-white" : "bg-superficie")}
              >
                {{ horas: "Por horas", lista: "Lista" }[m]}
              </Link>
            ))}
          </div>
        )}
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

      {vista === "dia" && <VistaDia fecha={fecha} profesionales={visibles} gestiona={gestiona} modo={modo} />}
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
        {c.confirmoClienta && <span className="font-semibold text-correcto"> · ✓ confirmó por WhatsApp</span>}
      </div>
    </Link>
  );
}

async function VistaDia({ fecha, profesionales, gestiona, modo }: { fecha: string; profesionales: { id: string; nombre: string; color: string }[]; gestiona: boolean; modo: Modo }) {
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
      return { prof, horario, items, citas: activas.length, activas, bloq, libres };
    }),
  );

  if (profesionales.length === 0) return <Aviso prioridad="pendiente">No hay profesionales. Añádelas en Configuración → Profesionales.</Aviso>;
  if (modo === "horas") return <DiaPorHoras fecha={fecha} gestiona={gestiona} columnas={columnas} />;
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

type ColumnaDia = {
  prof: { id: string; nombre: string; color: string };
  horario: { inicio: number; fin: number }[];
  citas: number;
  activas: CitaVista[];
  bloq: Awaited<ReturnType<typeof bloqueosEntre>>;
  libres: { inicio: number; fin: number }[];
};

/** Reparte las citas que coinciden en el tiempo en carriles, para que no se tapen entre sí. */
function carriles(citas: CitaVista[]) {
  const ordenadas = [...citas].sort((a, b) => minutosDe(a.inicio) - minutosDe(b.inicio));
  const colocadas: { c: CitaVista; carril: number; de: number }[] = [];
  let grupo: typeof colocadas = [];
  let finGrupo = -1;
  const cerrar = () => {
    const de = Math.max(1, ...grupo.map((g) => g.carril + 1));
    for (const g of grupo) g.de = de;
    colocadas.push(...grupo);
    grupo = [];
  };
  for (const c of ordenadas) {
    const ini = minutosDe(c.inicio);
    if (grupo.length && ini >= finGrupo) cerrar();
    const usados = new Set(grupo.filter((g) => minutosDe(g.c.fin) > ini).map((g) => g.carril));
    let carril = 0;
    while (usados.has(carril)) carril++;
    grupo.push({ c, carril, de: 1 });
    finGrupo = Math.max(grupo.length === 1 ? 0 : finGrupo, minutosDe(c.fin));
  }
  if (grupo.length) cerrar();
  return colocadas;
}

/**
 * El día con una escala de horas a la izquierda: cada cita ocupa su sitio según la hora y la duración, y los huecos
 * se ven a simple vista (y se pulsan para dar una cita).
 */
function DiaPorHoras({ fecha, gestiona, columnas }: { fecha: string; gestiona: boolean; columnas: ColumnaDia[] }) {
  const todos: number[] = [];
  for (const col of columnas) {
    for (const t of col.horario) todos.push(t.inicio, t.fin);
    for (const c of col.activas) todos.push(minutosDe(c.inicio), minutosDe(c.fin));
  }
  const desde = todos.length ? Math.floor(Math.min(...todos) / 30) * 30 : 9 * 60;
  const hasta = todos.length ? Math.max(Math.ceil(Math.max(...todos) / 30) * 30, desde + 60) : 20 * 60;
  const alto = (hasta - desde) * PX;
  const marcas = Array.from({ length: (hasta - desde) / 30 + 1 }, (_, i) => desde + i * 30);
  const arriba = (min: number) => (Math.min(Math.max(min, desde), hasta) - desde) * PX;

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[18rem] gap-x-2" style={{ gridTemplateColumns: `3.25rem repeat(${columnas.length}, minmax(0, 1fr))` }}>
        <div aria-hidden className="pb-3 pt-10">
          <div className="relative" style={{ height: alto }}>
          {marcas.map((m) => (
            <span key={m} className={clases("absolute right-1 -translate-y-1/2 text-xs", m % 60 === 0 ? "font-semibold text-tinta" : "text-tinta-suave")} style={{ top: (m - desde) * PX }}>
              {horaATexto(m)}
            </span>
          ))}
          </div>
        </div>

        {columnas.map(({ prof, horario, activas, bloq, libres, citas }) => (
          <section key={prof.id} aria-label={`Agenda de ${prof.nombre}`} className="min-w-0">
            <h2 className="flex h-10 items-center gap-2 text-xl">
              <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: prof.color }} />
              <span className="truncate">{prof.nombre}</span>
              <span className="font-sans text-sm text-tinta-suave">
                {citas} {citas === 1 ? "cita" : "citas"}
              </span>
            </h2>
            <div className="relative overflow-hidden rounded-xl border border-borde bg-crema/60" style={{ height: alto }}>
            {horario.map((t) => (
              <div key={t.inicio} aria-hidden className="absolute inset-x-0 bg-superficie" style={{ top: arriba(t.inicio), height: arriba(t.fin) - arriba(t.inicio) }} />
            ))}
            {marcas.map((m) => (
              <div key={m} aria-hidden className={clases("absolute inset-x-0 border-t", m % 60 === 0 ? "border-borde" : "border-borde/40")} style={{ top: (m - desde) * PX }} />
            ))}
            {horario.length === 0 && (
              <p className="absolute inset-x-0 top-2 z-10 px-3 text-sm text-tinta-suave">
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

            {libres.map((l) => {
              const estilo = { top: arriba(l.inicio), height: Math.max(arriba(l.fin) - arriba(l.inicio), 0) };
              const etiqueta = (
                <span className="flex items-start justify-between gap-2 px-2 pt-1 text-sm">
                  <span>
                    Libre {horaATexto(l.inicio)}–{horaATexto(l.fin)}
                  </span>
                  {gestiona && <span className="font-semibold">+ Cita</span>}
                </span>
              );
              return gestiona ? (
                <Link
                  key={`libre-${l.inicio}`}
                  href={`/gestion/agenda/nueva?${new URLSearchParams({ fecha, hora: String(l.inicio), profesional: prof.id })}`}
                  aria-label={`Hueco libre de ${horaATexto(l.inicio)} a ${horaATexto(l.fin)} con ${prof.nombre}`}
                  className="absolute inset-x-1 z-0 overflow-hidden rounded-lg border border-dashed border-dorado-claro text-dorado-oscuro hover:bg-crema"
                  style={estilo}
                >
                  {etiqueta}
                </Link>
              ) : (
                <div key={`libre-${l.inicio}`} className="absolute inset-x-1 z-0 overflow-hidden rounded-lg border border-dashed border-dorado-claro text-tinta-suave" style={estilo}>
                  {etiqueta}
                </div>
              );
            })}

            {bloq.map((b) => {
              const t = aMinutosDelDia(fecha, b);
              return (
                <div
                  key={b.id}
                  className="absolute inset-x-1 z-10 overflow-hidden rounded-lg border border-dashed border-tinta-suave bg-crema/90 px-2 py-1 text-sm text-tinta-suave"
                  style={{ top: arriba(t.inicio), height: Math.max(arriba(t.fin) - arriba(t.inicio), 28) }}
                >
                  {t.inicio === 0 && t.fin === 1440 ? "Todo el día" : `${horaATexto(t.inicio)}–${horaATexto(t.fin)}`} · {b.motivo ?? b.tipo}
                  {!b.profesionalId && " (todo el centro)"}
                </div>
              );
            })}

            {carriles(activas).map(({ c, carril, de }) => {
              const ini = minutosDe(c.inicio);
              const fin = minutosDe(c.fin);
              return (
                <Link
                  key={c.id}
                  href={`/gestion/agenda/cita/${c.id}`}
                  className={clases("absolute z-20 overflow-hidden rounded-lg border border-l-8 border-borde bg-superficie px-2 py-1 text-sm leading-tight shadow-sm hover:bg-crema", BORDE_ESTADO[c.estado])}
                  style={{ top: arriba(ini), height: Math.max((fin - ini) * PX, 46), left: `calc(${(carril * 100) / de}% + 4px)`, width: `calc(${100 / de}% - 8px)` }}
                >
                  <div className="truncate font-semibold">
                    {horaATexto(ini)}–{horaATexto(fin)} · {c.cliente.nombre}
                  </div>
                  <div className="truncate text-tinta-suave">{c.servicios.join(" + ")}</div>
                </Link>
              );
            })}
            </div>
          </section>
        ))}
      </div>
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
