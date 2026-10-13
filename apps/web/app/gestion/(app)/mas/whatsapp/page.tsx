import { mensajes, plantillas } from "@adela/db";
import { VARIABLES_PLANTILLA, hoyEnMadrid, instanteMadrid, rellenarPlantilla } from "@adela/dominio";
import { Aviso, Tarjeta } from "@adela/ui";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import Link from "next/link";
import { fechaHora } from "@/lib/fechas";
import { requerirSesion } from "@/server/auth";
import { plantillasGuardadas } from "@/server/avisos";
import { db } from "@/server/db";
import { ultimoWhatsapp } from "@/server/internet";
import { plantillaMeta } from "@/server/mensajes";
import { ajustesWhatsapp, apiWhatsapp } from "@/server/whatsapp";
import { FormularioPlantilla } from "./Formulario";
import { FormularioAutomatico, FormularioMeta } from "./FormularioMeta";

const EJEMPLO = { nombre: "Marta", centro: "Adela María · Belleza holística", fecha: "jueves, 15 de octubre", hora: "10:30", servicios: "higiene facial", quedan: "1 sesión", bono: "Bono facial 6 sesiones" };
const PERMISO = { cita: "Necesita permiso para avisos de citas", promocion: "Necesita permiso para promociones" };

/** Mensajes enviados por la API este mes, por categoría de Meta (lo que Meta cobra). */
async function envioDelMes() {
  const inicio = instanteMadrid(`${hoyEnMadrid(new Date()).slice(0, 8)}01`, 0);
  const filas = await db()
    .select({ categoria: plantillas.metaCategoria, n: sql<number>`count(*)::int` })
    .from(mensajes)
    .leftJoin(plantillas, eq(plantillas.clave, mensajes.plantilla))
    .where(and(eq(mensajes.canal, "whatsapp_api"), eq(mensajes.direccion, "saliente"), inArray(mensajes.estado, ["enviado", "entregado", "leido"]), gte(mensajes.cuando, inicio)))
    .groupBy(plantillas.metaCategoria);
  const n = (c: string | null) => filas.find((f) => f.categoria === c)?.n ?? 0;
  return { utilidad: n("utility"), marketing: n("marketing"), libres: n(null) };
}

export default async function WhatsApp() {
  await requerirSesion("configuracion.gestionar");
  const [lista, ajustes, mes] = await Promise.all([plantillasGuardadas(), ajustesWhatsapp(), envioDelMes()]);
  const api = apiWhatsapp();
  const ultimo = ultimoWhatsapp();
  return (
    <div className="max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-4xl">WhatsApp</h1>
        <Link href="/gestion/mas/whatsapp/campana" className="inline-flex min-h-toque items-center rounded-xl border-2 border-dorado px-5 font-semibold text-dorado-oscuro hover:bg-crema">
          Enviar a un grupo de clientas
        </Link>
      </header>

      <Tarjeta className="space-y-3">
        <h2 className="text-2xl">Envío automático</h2>
        {api ? (
          <Aviso prioridad={ultimo && !ultimo.ok ? "importante" : "correcto"}>
            Conectado con WhatsApp de Meta.{" "}
            {ultimo ? (ultimo.ok ? `Última comprobación: ${fechaHora(ultimo.cuando)}.` : `Último intento con problemas (${fechaHora(ultimo.cuando)}): ${ultimo.error}`) : "Aún no ha comprobado nada."}
          </Aviso>
        ) : (
          <Aviso prioridad="informativo">
            Sin conectar: los mensajes se envían abriendo WhatsApp (botón verde). Para que salgan solos hace falta dar de alta el centro en Meta (ver docs/whatsapp.md).
          </Aviso>
        )}
        <p className="text-tinta-suave" data-testid="envios-mes">
          Enviados este mes por la app: {mes.utilidad} de utilidad, {mes.marketing} de marketing y {mes.libres} respuestas (las respuestas en las 24 horas
          siguientes a un mensaje de la clienta son gratis). Meta cobra cada mensaje de utilidad o marketing según su tarifa para España.
        </p>
        <FormularioAutomatico valores={ajustes} />
      </Tarjeta>

      <p className="text-tinta-suave">
        Estos son los textos de cada mensaje. Puedes usar {VARIABLES_PLANTILLA.map((v) => `{${v}}`).join(", ")}. Para que un mensaje se envíe desde la app,
        tiene que estar aprobado en Meta con el mismo texto (allí las variables se escriben {"{{1}}"}, {"{{2}}"}…) y apuntar aquí su nombre.
      </p>
      {lista.map((p) => {
        const meta = plantillaMeta(p);
        return (
          <Tarjeta key={p.clave} className="space-y-3">
            <div>
              <h2 className="text-2xl">{p.nombre}</h2>
              <p className="text-sm text-tinta-suave">
                {p.clave === "confirmar_cita" ? "Se puede enviar siempre: lo pidió la clienta" : PERMISO[p.permiso]} ·{" "}
                {meta ? `Aprobado en Meta como «${meta.nombre}»` : "Se envía abriendo WhatsApp"}
              </p>
            </div>
            <FormularioPlantilla clave={p.clave} nombre={p.nombre} texto={p.texto} ejemplo={rellenarPlantilla(p.texto, EJEMPLO)} />
            <details>
              <summary className="min-h-toque cursor-pointer font-semibold text-dorado-oscuro">Datos de Meta</summary>
              <div className="mt-3">
                <FormularioMeta
                  clave={p.clave}
                  nombre={p.nombre}
                  valores={{ metaNombre: p.metaNombre ?? "", metaIdioma: p.metaIdioma, metaCategoria: p.metaCategoria ?? (p.permiso === "promocion" ? "marketing" : "utility"), metaVariables: p.metaVariables.join(", "), metaBotones: p.metaBotones }}
                />
              </div>
            </details>
          </Tarjeta>
        );
      })}
    </div>
  );
}
