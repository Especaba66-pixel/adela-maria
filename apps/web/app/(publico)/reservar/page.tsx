import { horaATexto, rangoFechasReserva, sumarDias, textoPrecio } from "@adela/dominio";
import Link from "next/link";
import { diaLargo } from "@/lib/fechas";
import { huecosWeb } from "@/server/agenda";
import { tratamientosReservables } from "@/server/reservas";
import { FormularioDatos } from "./FormularioDatos";
import { FormularioPeticion } from "./FormularioPeticion";

export const dynamic = "force-dynamic";

/** Días que se ofrecen como botones (los primeros con horas libres). */
const DIAS_A_MOSTRAR = 10;

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const boton =
  "inline-flex min-h-toque items-center justify-center rounded-xl border-2 border-borde bg-superficie px-4 font-medium hover:border-dorado";
const botonActivo = "border-dorado-oscuro bg-crema font-semibold";

function Paso({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3" aria-labelledby={`paso-${n}`}>
      <h2 id={`paso-${n}`} className="flex items-center gap-3 text-2xl">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-dorado-oscuro font-sans text-base text-white">{n}</span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export default async function Reservar({ searchParams }: { searchParams: Promise<{ tratamiento?: string; fecha?: string; hora?: string }> }) {
  const params = await searchParams;
  const lista = await tratamientosReservables();
  const elegido = lista.find((t) => t.id === params.tratamiento);
  const { desde, hasta } = rangoFechasReserva(new Date());

  // Días con horas libres para el tratamiento elegido.
  let dias: { fecha: string; huecos: number }[] = [];
  if (elegido?.duracionMinutos) {
    for (let f = desde; f <= hasta && dias.length < DIAS_A_MOSTRAR; f = sumarDias(f, 1)) {
      const h = await huecosWeb(elegido.id, f);
      if (h.length > 0) dias.push({ fecha: f, huecos: h.length });
    }
  }
  const fecha = dias.some((d) => d.fecha === params.fecha) ? params.fecha : undefined;
  const huecos = elegido && fecha ? await huecosWeb(elegido.id, fecha) : [];
  const hora = huecos.find((h) => String(h.minutos) === params.hora)?.minutos;
  // Sin horas en la web (tratamiento sin duración o sin horario cargado): se deja una petición y el centro llama.
  const sinHoras = elegido && dias.length === 0;
  const enlace = (extra: Record<string, string>) => `/reservar?${new URLSearchParams({ tratamiento: elegido!.id, ...extra })}`;

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-5xl">Pedir cita</h1>
        <p className="text-lg text-tinta-suave">Sin registrarte ni crear claves. Elige y te confirmamos por WhatsApp.</p>
      </div>

      {lista.length === 0 && <p className="text-tinta-suave">Muy pronto podrás pedir cita desde aquí. Mientras tanto, llámanos.</p>}

      {lista.length > 0 && (
        <Paso n={1} titulo="¿Qué te apetece?">
          <form method="get" className="space-y-3">
            <select name="tratamiento" defaultValue={elegido?.id ?? ""} required aria-label="Tratamiento" className="block min-h-toque w-full min-w-0 rounded-xl border-2 border-borde bg-superficie px-4 text-lg">
              <option value="" disabled>
                Elige un tratamiento…
              </option>
              {[...new Set(lista.map((t) => t.categoria))].map((c) => (
                <optgroup key={c} label={c}>
                  {lista
                    .filter((t) => t.categoria === c)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <button type="submit" className={`${boton} ${botonActivo} w-full`}>
              Ver horas
            </button>
          </form>
          {elegido && (
            <p className="text-tinta-suave">
              {elegido.duracionMinutos !== null && `${elegido.duracionMinutos} min · `}
              {textoPrecio(elegido.precioCentimos)}
            </p>
          )}
        </Paso>
      )}

      {elegido && !sinHoras && (
        <Paso n={2} titulo="¿Qué día?">
          <div className="grid grid-cols-2 gap-2">
            {dias.map((d) => (
              <Link key={d.fecha} href={enlace({ fecha: d.fecha })} className={`${boton} ${d.fecha === fecha ? botonActivo : ""}`}>
                {mayuscula(diaLargo(d.fecha))}
              </Link>
            ))}
          </div>
        </Paso>
      )}

      {elegido && fecha && (
        <Paso n={3} titulo="¿A qué hora?">
          <div className="grid grid-cols-4 gap-2">
            {huecos.map((h) => (
              <Link key={h.minutos} href={enlace({ fecha, hora: String(h.minutos) })} className={`${boton} ${h.minutos === hora ? botonActivo : ""}`}>
                {horaATexto(h.minutos)}
              </Link>
            ))}
          </div>
        </Paso>
      )}

      {elegido && fecha && hora !== undefined && (
        <Paso n={4} titulo="Tus datos">
          <p className="rounded-xl bg-crema px-4 py-3">
            <strong>{elegido.nombre}</strong>
            <br />
            {mayuscula(diaLargo(fecha))} a las {horaATexto(hora)}
          </p>
          <FormularioDatos tratamiento={elegido.id} fecha={fecha} hora={hora} />
        </Paso>
      )}

      {sinHoras && (
        <Paso n={2} titulo="Déjanos tu petición">
          <p className="text-tinta-suave">Para este tratamiento te buscamos hora nosotras. Dinos qué día te viene bien y te escribimos.</p>
          <FormularioPeticion tratamientos={lista} elegido={elegido.id} desde={desde} hasta={hasta} />
        </Paso>
      )}
    </div>
  );
}
