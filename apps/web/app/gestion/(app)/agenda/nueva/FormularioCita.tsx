"use client";
import { horaATexto } from "@adela/dominio";
import { Aviso, Boton, Tarjeta, clases } from "@adela/ui";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { buscar, guardarCita, huecos } from "./acciones";

interface Tratamiento {
  id: string;
  nombre: string;
  categoria: string;
  duracionMinutos: number | null;
  exclusivo: boolean;
}
interface Profesional {
  id: string;
  nombre: string;
  tratamientoIds: string[];
}
interface Clienta {
  id: string;
  nombre: string;
  telefono: string | null;
}
export interface Inicial {
  fecha: string;
  hora?: string;
  profesionalId?: string;
  clienta?: Clienta;
  nuevaClienta?: { nombre: string; telefono: string };
  tratamientoIds?: string[];
  nota?: string;
  solicitudId?: string;
}

const campo = "mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg focus:border-dorado";
const chip = "inline-flex min-h-toque items-center rounded-xl border-2 px-4 text-left";

export function FormularioCita({ tratamientos, equipo, inicial }: { tratamientos: Tratamiento[]; equipo: Profesional[]; inicial: Inicial }) {
  const [estado, accion, guardando] = useActionState(guardarCita, {});
  const [clienta, setClienta] = useState<Clienta | null>(inicial.clienta ?? null);
  const [crearNueva, setCrearNueva] = useState(Boolean(inicial.nuevaClienta));
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<Clienta[]>([]);
  const [elegidos, setElegidos] = useState<string[]>(inicial.tratamientoIds ?? []);
  const [profesionalId, setProfesionalId] = useState(inicial.profesionalId ?? equipo[0]?.id ?? "");
  const [fecha, setFecha] = useState(inicial.fecha);
  const [hora, setHora] = useState(inicial.hora ?? "");
  const [libres, setLibres] = useState<number[] | null>(null);
  const [sinHorario, setSinHorario] = useState(false);
  const [repetir, setRepetir] = useState(false);
  const [, iniciar] = useTransition();

  const duracion = useMemo(() => {
    const sel = tratamientos.filter((t) => elegidos.includes(t.id));
    return sel.length && sel.every((t) => t.duracionMinutos !== null) ? sel.reduce((s, t) => s + t.duracionMinutos!, 0) : null;
  }, [elegidos, tratamientos]);
  const posibles = equipo.filter((p) => p.tratamientoIds.length === 0 || elegidos.every((t) => p.tratamientoIds.includes(t)));

  useEffect(() => {
    if (busqueda.trim().length < 2) return setResultados([]);
    const t = setTimeout(() => iniciar(async () => setResultados(await buscar(busqueda))), 250);
    return () => clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    if (!profesionalId || !fecha || !duracion) return setLibres(null);
    iniciar(async () => {
      const r = await huecos(profesionalId, fecha, elegidos);
      setLibres(r.libres);
      setSinHorario(r.horario.length === 0);
    });
  }, [profesionalId, fecha, duracion, elegidos]);

  const alternar = (id: string) => setElegidos((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
  const categorias = [...new Set(tratamientos.map((t) => t.categoria))];

  return (
    <form action={accion} className="space-y-6">
      {estado.error && <Aviso prioridad="urgente">{estado.error}</Aviso>}
      {inicial.solicitudId && <input type="hidden" name="solicitud" value={inicial.solicitudId} />}

      <Tarjeta className="space-y-3">
        <h2 className="text-2xl">Clienta</h2>
        {clienta ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xl font-semibold" data-testid="clienta-elegida">{clienta.nombre}</div>
              {clienta.telefono && <div className="text-tinta-suave">{clienta.telefono}</div>}
            </div>
            <input type="hidden" name="cliente" value={clienta.id} />
            <Boton type="button" variante="discreto" onClick={() => setClienta(null)}>
              Cambiar
            </Boton>
          </div>
        ) : crearNueva ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              Nombre
              <input name="nuevoNombre" required defaultValue={inicial.nuevaClienta?.nombre} className={campo} />
            </label>
            <label className="block">
              Teléfono
              <input name="nuevoTelefono" type="tel" defaultValue={inicial.nuevaClienta?.telefono} className={campo} />
            </label>
            <label className="col-span-2 flex min-h-toque items-center gap-3">
              <input name="nuevoAvisos" type="checkbox" className="size-6 accent-dorado-oscuro" />
              Acepta recibir avisos de sus citas por WhatsApp
            </label>
            <Boton type="button" variante="discreto" onClick={() => setCrearNueva(false)} className="col-span-2 justify-self-start">
              Buscar una clienta existente
            </Boton>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre o teléfono…"
              aria-label="Buscar clienta"
              className={campo}
              autoFocus
            />
            <div className="flex flex-wrap gap-2">
              {resultados.map((r) => (
                <button key={r.id} type="button" onClick={() => setClienta(r)} className={`${chip} border-borde bg-superficie hover:border-dorado`}>
                  <span>
                    <span className="font-semibold">{r.nombre}</span>
                    {r.telefono && <span className="text-tinta-suave"> · {r.telefono.replace(/^\+34/, "")}</span>}
                  </span>
                </button>
              ))}
            </div>
            <Boton type="button" variante="secundario" onClick={() => setCrearNueva(true)}>
              + Clienta nueva
            </Boton>
          </div>
        )}
      </Tarjeta>

      <Tarjeta className="space-y-3">
        <h2 className="text-2xl">
          Tratamientos {duracion !== null && <span className="font-sans text-base text-tinta-suave">· {duracion} min en total</span>}
        </h2>
        {categorias.map((c) => (
          <fieldset key={c} className="space-y-2">
            <legend className="text-sm font-semibold uppercase tracking-wider text-tinta-suave">{c}</legend>
            <div className="flex flex-wrap gap-2">
              {tratamientos
                .filter((t) => t.categoria === c)
                .map((t) => (
                  <label key={t.id} className={clases(chip, "cursor-pointer", elegidos.includes(t.id) ? "border-dorado-oscuro bg-crema font-semibold" : "border-borde bg-superficie")}>
                    <input type="checkbox" name="tratamiento" value={t.id} checked={elegidos.includes(t.id)} onChange={() => alternar(t.id)} className="sr-only" />
                    {t.nombre}
                    <span className="ml-2 text-sm font-normal text-tinta-suave">
                      {t.duracionMinutos === null ? "sin duración" : `${t.duracionMinutos}′`}
                      {t.exclusivo && " · va sola"}
                    </span>
                  </label>
                ))}
            </div>
          </fieldset>
        ))}
      </Tarjeta>

      <Tarjeta className="space-y-4">
        <h2 className="text-2xl">Cuándo</h2>
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            Profesional
            <select name="profesional" value={profesionalId} onChange={(e) => setProfesionalId(e.target.value)} className={campo}>
              {(posibles.length ? posibles : equipo).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Día
            <input name="fecha" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} className={campo} />
          </label>
          <label className="block">
            Hora
            <input name="hora" type="time" step={300} required value={hora} onChange={(e) => setHora(e.target.value)} className={campo} />
          </label>
        </div>
        {libres !== null && (
          <div className="space-y-2">
            <div className="text-sm text-tinta-suave">{sinHorario ? "Ese día no trabaja según su horario; puedes poner la hora a mano." : "Horas libres:"}</div>
            <div className="flex flex-wrap gap-2">
              {libres.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setHora(horaATexto(m))}
                  className={clases("min-h-toque min-w-20 rounded-xl border-2 px-3", hora === horaATexto(m) ? "border-dorado-oscuro bg-dorado-oscuro text-white" : "border-borde bg-superficie")}
                >
                  {horaATexto(m)}
                </button>
              ))}
              {!sinHorario && libres.length === 0 && <span className="text-urgente">No queda ningún hueco libre ese día.</span>}
            </div>
          </div>
        )}
        <label className="flex min-h-toque items-center gap-3">
          <input type="checkbox" checked={repetir} onChange={(e) => setRepetir(e.target.checked)} className="size-6 accent-dorado-oscuro" />
          Se repite
        </label>
        {repetir && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              Cada
              <select name="cadaSemanas" defaultValue="1" className={campo}>
                {[1, 2, 3, 4, 6, 8].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "semana" : `${n} semanas`}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              Veces en total
              <input name="veces" type="number" min={2} max={52} defaultValue={4} className={campo} />
            </label>
          </div>
        )}
        <label className="block">
          Nota <span className="text-tinta-suave">(opcional)</span>
          <input name="nota" defaultValue={inicial.nota} maxLength={500} className={campo} />
        </label>
      </Tarjeta>

      <Boton type="submit" grande disabled={guardando || elegidos.length === 0 || (!clienta && !crearNueva)} className="w-full">
        {guardando ? "Guardando…" : "Guardar cita"}
      </Boton>
    </form>
  );
}
