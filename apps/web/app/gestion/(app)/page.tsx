import { puede } from "@adela/dominio";
import { Aviso, Tarjeta } from "@adela/ui";
import Link from "next/link";
import { fechaLarga, saludo } from "@/lib/fechas";
import { requerirSesion } from "@/server/auth";
import { avisosSistema } from "@/server/estado";
import { contarPendientes } from "@/server/reservas";
import { citasDelDia, profesionalDeUsuario } from "@/server/agenda";
import { EstadoCitaChip } from "@/components/EstadoCita";
import { horaATexto, hoyEnMadrid, partesMadrid } from "@adela/dominio";

const TARJETAS = [
  { titulo: "Citas de hoy", fase: 0, href: "/gestion/agenda" },
  { titulo: "Reservas por confirmar", fase: 0, href: "/gestion/reservas" },
  { titulo: "Pendientes de cobro", fase: 2, href: "/gestion/tpv" },
  { titulo: "Bonos por caducar", fase: 3, href: "/gestion/clientas" },
  { titulo: "Stock bajo", fase: 4, href: "/gestion/mas/stock" },
  { titulo: "Tareas", fase: 5, href: "/gestion/avisos" },
];

export default async function Inicio() {
  const { usuario } = await requerirSesion();
  const ahora = new Date();
  const avisos = puede(usuario.rol, "configuracion.gestionar") ? await avisosSistema() : [];
  const verReservas = puede(usuario.rol, "reservas.gestionar");
  const verToda = puede(usuario.rol, "agenda.ver_toda");
  const propia = verToda ? null : await profesionalDeUsuario(usuario.id);
  const hoy = verToda || propia ? await citasDelDia(hoyEnMadrid(ahora), { profesionalId: propia?.id }) : [];
  const proximas = hoy.filter((c) => c.fin.getTime() > ahora.getTime());
  const valores: Record<string, number | undefined> = {
    "Reservas por confirmar": verReservas ? await contarPendientes() : undefined,
    "Citas de hoy": verToda || propia ? hoy.length : undefined,
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-5xl">
          {saludo(ahora)}, {usuario.nombre}
        </h1>
        <p className="mt-1 text-lg text-tinta-suave first-letter:uppercase">{fechaLarga(ahora)}</p>
      </header>

      <section aria-label="Resumen del día" className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {TARJETAS.filter((t) => t.fase > 0 || valores[t.titulo] !== undefined).map((t) => (
          <Link key={t.titulo} href={t.href} className="rounded-tarjeta focus-visible:outline-3">
            <Tarjeta className="h-full transition-colors hover:border-dorado">
              <div className="text-tinta-suave">{t.titulo}</div>
              {valores[t.titulo] === undefined ? (
                <>
                  <div className="mt-2 font-titulo text-5xl text-borde">—</div>
                  <div className="mt-1 text-sm text-dorado">Fase {t.fase}</div>
                </>
              ) : (
                <div className="mt-2 font-titulo text-5xl text-tinta" data-testid={`tarjeta-${t.titulo}`}>
                  {valores[t.titulo]}
                </div>
              )}
            </Tarjeta>
          </Link>
        ))}
      </section>

      {(verToda || propia) && (
        <section aria-labelledby="titulo-hoy" className="space-y-3">
          <h2 id="titulo-hoy" className="text-3xl">
            Próximas de hoy
          </h2>
          {proximas.length === 0 ? (
            <p className="text-tinta-suave">No quedan citas hoy.</p>
          ) : (
            <Tarjeta className="divide-y divide-borde p-0">
              {proximas.slice(0, 8).map((c) => (
                <Link key={c.id} href={`/gestion/agenda/cita/${c.id}`} className="flex min-h-boton items-center justify-between gap-4 px-6 hover:bg-crema">
                  <span>
                    <span className="font-semibold">{horaATexto(partesMadrid(c.inicio).minutos)}</span> · {c.cliente.nombre}
                    <span className="text-tinta-suave"> · {c.servicios.join(" + ")}</span>
                  </span>
                  <EstadoCitaChip estado={c.estado} />
                </Link>
              ))}
            </Tarjeta>
          )}
        </section>
      )}

      <section aria-labelledby="titulo-avisos" className="space-y-3">
        <h2 id="titulo-avisos" className="text-3xl">
          Avisos
        </h2>
        {avisos.length === 0 ? (
          <Aviso prioridad="correcto">Todo en orden.</Aviso>
        ) : (
          avisos.map((a) => (
            <Aviso key={a.texto} prioridad={a.prioridad}>
              {a.enlace ? (
                <Link href={a.enlace} className="underline">
                  {a.texto}
                </Link>
              ) : (
                a.texto
              )}
            </Aviso>
          ))
        )}
      </section>
    </div>
  );
}
