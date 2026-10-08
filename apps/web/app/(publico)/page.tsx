import { tiposBono } from "@adela/db";
import { formatearEuros, textoPrecio } from "@adela/dominio";
import { asc, isNull } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/server/db";
import { tratamientosReservables } from "@/server/reservas";

// Las tarifas salen de la base de datos: se ven siempre al día.
export const dynamic = "force-dynamic";

export default async function Portada() {
  const [lista, bonos] = await Promise.all([
    tratamientosReservables(),
    db().select().from(tiposBono).where(isNull(tiposBono.anuladoEn)).orderBy(asc(tiposBono.sesiones)),
  ]);
  const categorias = [...new Set(lista.map((t) => t.categoria))];

  return (
    <div className="space-y-12">
      <section className="space-y-4 text-center">
        <h1 className="text-5xl leading-tight">Tu momento de cuidado</h1>
        <p className="mx-auto max-w-xl text-lg text-tinta-suave">
          Consulta nuestros tratamientos y pide tu cita en un minuto, sin registrarte ni crear claves. Te escribimos por
          WhatsApp para confirmar la hora.
        </p>
        <Link
          href="/reservar"
          className="inline-flex min-h-boton items-center rounded-xl bg-dorado-oscuro px-8 text-xl font-semibold text-white hover:bg-tinta"
        >
          Pedir cita
        </Link>
      </section>

      <section aria-labelledby="tarifas" className="space-y-8">
        <h2 id="tarifas" className="text-center text-4xl">
          Tratamientos
        </h2>
        {lista.length === 0 && (
          <p className="text-center text-tinta-suave">Muy pronto podrás ver aquí todos nuestros tratamientos y precios.</p>
        )}
        {categorias.map((cat) => (
          <div key={cat} className="space-y-3">
            <h3 className="text-3xl text-dorado-oscuro">{cat}</h3>
            <ul className="divide-y divide-borde rounded-tarjeta border border-borde bg-superficie">
              {lista
                .filter((t) => t.categoria === cat)
                .map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <div className="font-medium">{t.nombre}</div>
                      <div className="text-sm text-tinta-suave">
                        {t.duracionMinutos !== null && `${t.duracionMinutos} min · `}
                        {textoPrecio(t.precioCentimos)}
                      </div>
                    </div>
                    <Link
                      href={`/reservar?tratamiento=${t.id}`}
                      className="inline-flex min-h-toque shrink-0 items-center rounded-xl border-2 border-dorado px-4 font-semibold text-dorado-oscuro hover:bg-crema"
                      aria-label={`Pedir cita: ${t.nombre}`}
                    >
                      Pedir cita
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
        {bonos.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-3xl text-dorado-oscuro">Bonos</h3>
            <ul className="divide-y divide-borde rounded-tarjeta border border-borde bg-superficie">
              {bonos.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <div className="font-medium">{b.nombre}</div>
                    <div className="text-sm text-tinta-suave">{b.sesiones} sesiones</div>
                  </div>
                  <div className="font-semibold">{formatearEuros(b.precioCentimos)}</div>
                </li>
              ))}
            </ul>
            <p className="text-sm text-tinta-suave">Los bonos se compran en el centro.</p>
          </div>
        )}
      </section>
    </div>
  );
}
