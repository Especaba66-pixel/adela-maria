import { categorias, tiposBono, tiposBonoTratamientos, tratamientos } from "@adela/db";
import { formatearEuros, puede, textoPrecio } from "@adela/dominio";
import { Aviso, Tarjeta } from "@adela/ui";
import { asc, count, eq, isNotNull, isNull } from "drizzle-orm";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { FormularioCategoria, FormularioTratamiento } from "./Formularios";

export default async function Tratamientos() {
  const { usuario } = await requerirSesion();
  const edita = puede(usuario.rol, "configuracion.gestionar");
  const [cats, lista, bonos, retirados] = await Promise.all([
    db().select().from(categorias).where(isNull(categorias.anuladoEn)).orderBy(asc(categorias.orden)),
    db().select().from(tratamientos).where(isNull(tratamientos.anuladoEn)).orderBy(asc(tratamientos.orden)),
    db()
      .select({ bono: tiposBono, cubiertos: count(tiposBonoTratamientos.tratamientoId) })
      .from(tiposBono)
      .leftJoin(tiposBonoTratamientos, eq(tiposBonoTratamientos.tipoBonoId, tiposBono.id))
      .where(isNull(tiposBono.anuladoEn))
      .groupBy(tiposBono.id)
      .orderBy(asc(tiposBono.sesiones)),
    db().select().from(tratamientos).where(isNotNull(tratamientos.anuladoEn)).orderBy(asc(tratamientos.nombre)),
  ]);
  const listaCats = cats.map((c) => ({ id: c.id, nombre: c.nombre }));
  const valores = (t: typeof tratamientos.$inferSelect) => ({
    id: t.id,
    categoriaId: t.categoriaId,
    nombre: t.nombre,
    duracion: t.duracionMinutos === null ? "" : String(t.duracionMinutos),
    precio: t.precioCentimos === null ? "" : (t.precioCentimos / 100).toFixed(2).replace(".", ","),
    descripcion: t.descripcion ?? "",
    exclusivo: t.exclusivo,
    retirado: t.anuladoEn !== null,
  });

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
                  <div key={t.id} className="px-6 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium">{t.nombre}</div>
                      <div className="text-sm text-tinta-suave">
                        {t.duracionMinutos === null ? "Duración por decidir" : `${t.duracionMinutos} min`}
                        {t.exclusivo && " · va sola"}
                      </div>
                    </div>
                    <div className={t.precioCentimos === null ? "text-pendiente" : "font-semibold"}>{textoPrecio(t.precioCentimos)}</div>
                  </div>
                  {edita && (
                    <details>
                      <summary className="inline-flex min-h-toque cursor-pointer items-center text-dorado-oscuro" aria-label={`Editar ${t.nombre}`}>
                        Editar
                      </summary>
                      <div className="pt-2">
                        <FormularioTratamiento valores={valores(t)} categorias={listaCats} />
                      </div>
                    </details>
                  )}
                  </div>
                ))}
              </Tarjeta>
            )}
          </section>
        );
      })}
      {edita && (
        <Tarjeta className="space-y-4">
          <h2 className="text-3xl">Nuevo tratamiento</h2>
          <FormularioTratamiento categorias={listaCats} />
          <FormularioCategoria />
        </Tarjeta>
      )}
      {edita && retirados.length > 0 && (
        <details>
          <summary className="inline-flex min-h-toque cursor-pointer items-center text-dorado-oscuro">Retirados ({retirados.length})</summary>
          <Tarjeta className="mt-2 divide-y divide-borde p-0">
            {retirados.map((t) => (
              <div key={t.id} className="px-6 py-3">
                <div className="font-medium">{t.nombre}</div>
                <FormularioTratamiento valores={valores(t)} categorias={listaCats} />
              </div>
            ))}
          </Tarjeta>
        </details>
      )}
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
