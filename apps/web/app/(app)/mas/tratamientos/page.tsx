import { categorias, tiposBono, tiposBonoTratamientos, tratamientos } from "@adela/db";
import { formatearEuros } from "@adela/dominio";
import { Aviso, Tarjeta } from "@adela/ui";
import { asc, count, eq, isNull } from "drizzle-orm";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";

export default async function Tratamientos() {
  await requerirSesion();
  const [cats, lista, bonos] = await Promise.all([
    db().select().from(categorias).where(isNull(categorias.anuladoEn)).orderBy(asc(categorias.orden)),
    db().select().from(tratamientos).where(isNull(tratamientos.anuladoEn)).orderBy(asc(tratamientos.orden)),
    db()
      .select({ bono: tiposBono, cubiertos: count(tiposBonoTratamientos.tratamientoId) })
      .from(tiposBono)
      .leftJoin(tiposBonoTratamientos, eq(tiposBonoTratamientos.tipoBonoId, tiposBono.id))
      .where(isNull(tiposBono.anuladoEn))
      .groupBy(tiposBono.id)
      .orderBy(asc(tiposBono.sesiones)),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-4xl">Tratamientos</h1>
      {cats.map((c) => {
        const deCategoria = lista.filter((t) => t.categoriaId === c.id);
        return (
          <section key={c.id} className="space-y-3">
            <h2 className="text-3xl">{c.nombre}</h2>
            {deCategoria.length === 0 ? (
              <Aviso prioridad="pendiente">Faltan por cargar los tratamientos de esta categoría.</Aviso>
            ) : (
              <Tarjeta className="divide-y divide-borde p-0">
                {deCategoria.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-4 px-6 py-4">
                    <div>
                      <div className="font-medium">{t.nombre}</div>
                      <div className="text-sm text-tinta-suave">{t.duracionMinutos} min</div>
                    </div>
                    <div className="font-semibold">{formatearEuros(t.precioCentimos)}</div>
                  </div>
                ))}
              </Tarjeta>
            )}
          </section>
        );
      })}
      <section className="space-y-3">
        <h2 className="text-3xl">Bonos</h2>
        <Tarjeta className="divide-y divide-borde p-0">
          {bonos.map(({ bono, cubiertos }) => (
            <div key={bono.id} className="flex items-center justify-between gap-4 px-6 py-4">
              <div>
                <div className="font-medium">{bono.nombre}</div>
                <div className="text-sm text-tinta-suave">
                  {bono.sesiones} sesiones · vale para {cubiertos} {cubiertos === 1 ? "tratamiento" : "tratamientos"}
                </div>
              </div>
              <div className="font-semibold">{formatearEuros(bono.precioCentimos)}</div>
            </div>
          ))}
        </Tarjeta>
      </section>
    </div>
  );
}
