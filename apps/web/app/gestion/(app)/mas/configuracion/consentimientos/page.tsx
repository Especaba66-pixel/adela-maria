import { categorias, tratamientos } from "@adela/db";
import { Aviso, Tarjeta } from "@adela/ui";
import { asc, eq, isNull } from "drizzle-orm";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { modelos } from "@/server/fichas";
import { FormularioModelo } from "./Formulario";

export default async function Consentimientos() {
  await requerirSesion("configuracion.gestionar");
  const [lista, catalogo] = await Promise.all([
    modelos(),
    db()
      .select({ id: tratamientos.id, nombre: tratamientos.nombre, categoria: categorias.nombre })
      .from(tratamientos)
      .innerJoin(categorias, eq(categorias.id, tratamientos.categoriaId))
      .where(isNull(tratamientos.anuladoEn))
      .orderBy(asc(categorias.orden), asc(tratamientos.orden)),
  ]);
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-4xl">Consentimientos informados</h1>
      <Aviso prioridad="informativo">
        Los textos de partida son una base. Revísalos con tu asesoría o tu seguro antes de usarlos. Cuando una cita lleva un tratamiento que pide
        consentimiento y la clienta no lo ha firmado, sale un aviso en el Inicio y en la cita.
      </Aviso>
      {lista.map((m) => (
        <Tarjeta key={m.id} className="space-y-3">
          <h2 className="text-2xl">
            {m.nombre} {!m.activo && <span className="text-base text-tinta-suave">· retirado</span>}
          </h2>
          <p className="text-sm text-tinta-suave">{m.tratamientos.length ? `Antes de: ${m.tratamientos.map((t) => t.nombre).join(", ")}` : "Se firma cuando haga falta"}</p>
          <details>
            <summary className="inline-flex min-h-toque cursor-pointer items-center text-dorado-oscuro">Editar</summary>
            <div className="pt-3">
              <FormularioModelo valores={{ id: m.id, nombre: m.nombre, texto: m.texto, activo: m.activo, tratamientoIds: m.tratamientos.map((t) => t.id) }} tratamientos={catalogo} />
            </div>
          </details>
        </Tarjeta>
      ))}
      <Tarjeta className="space-y-3">
        <h2 className="text-2xl">Añadir un consentimiento</h2>
        <FormularioModelo tratamientos={catalogo} />
      </Tarjeta>
    </div>
  );
}
