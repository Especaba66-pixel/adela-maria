import { puede } from "@adela/dominio";
import { Aviso, Tarjeta } from "@adela/ui";
import Link from "next/link";
import { fechaLarga, saludo } from "@/lib/fechas";
import { requerirSesion } from "@/server/auth";
import { avisosSistema } from "@/server/estado";
import { contarPendientes } from "@/server/reservas";

const TARJETAS = [
  { titulo: "Citas de hoy", fase: 1, href: "/gestion/agenda" },
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
  const valores: Record<string, number | undefined> = { "Reservas por confirmar": verReservas ? await contarPendientes() : undefined };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-5xl">
          {saludo(ahora)}, {usuario.nombre}
        </h1>
        <p className="mt-1 text-lg text-tinta-suave first-letter:uppercase">{fechaLarga(ahora)}</p>
      </header>

      <section aria-label="Resumen del día" className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {TARJETAS.filter((t) => t.fase > 0 || verReservas).map((t) => (
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
