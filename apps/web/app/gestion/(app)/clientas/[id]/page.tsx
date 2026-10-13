import { NOMBRE_ESTADO, NOMBRE_ESTADO_BONO, NOMBRE_ESTADO_ENVIO, ventanaAbierta, enlaceWhatsapp, textoQuedan, formatearTelefono, horaATexto, partesMadrid, puede, type EstadoCita } from "@adela/dominio";
import { Boton, Tarjeta } from "@adela/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { diaLargo, fechaHora } from "@/lib/fechas";
import { requerirSesion } from "@/server/auth";
import { fichaClienta, mensajesDeClienta } from "@/server/clientas";
import { plantillasGuardadas } from "@/server/avisos";
import { enlaceMensaje } from "@/components/ListaAvisos";
import { FormularioTarea } from "../../avisos/FormularioTarea";
import { EnviarWhatsapp } from "@/components/EnviarWhatsapp";
import { enviable } from "@/server/mensajes";
import { apiWhatsapp, ultimoDeLaClienta } from "@/server/whatsapp";
import { Responder } from "./Responder";
import { NOMBRE_TIPO_FOTO } from "@adela/dominio";
import { consentimientosDeClienta, fotosDeClienta, modelos } from "@/server/fichas";
import { borrar } from "./acciones-fichas";
import { SubirFoto } from "./SubirFoto";
import { bonosDeClienta } from "@/server/bonos";
import { suprimir } from "../acciones";
import { FormularioClienta } from "../FormularioClienta";
import { NuevaNota } from "./Nota";

const PERMISO = { privacidad_reserva: "Aceptó la privacidad al reservar", avisos_citas: "Avisos de citas", promociones: "Promociones" };

export default async function Ficha({ params }: { params: Promise<{ id: string }> }) {
  const { usuario } = await requerirSesion("clientas.gestionar");
  const { id } = await params;
  const f = await fichaClienta(id);
  if (!f) notFound();
  const c = f.clienta;
  if (c.anonimizadaEn) {
    return (
      <div className="space-y-4">
        <h1 className="text-4xl">Clienta eliminada</h1>
        <p className="text-tinta-suave">Sus datos se eliminaron el {fechaHora(c.anonimizadaEn)} a petición suya.</p>
      </div>
    );
  }
  const esAdmin = puede(usuario.rol, "configuracion.gestionar");
  const [bonos, mensajes, plantillas, fotos, firmados, modelosActivos] = await Promise.all([
    puede(usuario.rol, "cobrar") ? bonosDeClienta(id) : [],
    mensajesDeClienta(id),
    plantillasGuardadas(),
    fotosDeClienta(id),
    consentimientosDeClienta(id),
    modelos(true),
  ]);
  // Próxima cita (para el recordatorio con su fecha y hora).
  const ahora = Date.now();
  const proxima = f.eventos
    .filter((e) => e.tipo === "cita" && (e.estado === "pendiente" || e.estado === "confirmada") && new Date(e.cuando).getTime() > ahora)
    .sort((a, b) => new Date(a.cuando).getTime() - new Date(b.cuando).getTime())[0];
  const puedeResponder = apiWhatsapp() && ventanaAbierta(await ultimoDeLaClienta(id), new Date());
  const SOLO_NOMBRE = /\{(fecha|hora|servicios|quedan|bono)\}/;
  const ofrecer = plantillas.flatMap((p): { p: typeof p; citaId?: string }[] => {
    if (p.permiso === "cita" && !c.aceptaAvisosCitas && p.clave !== "confirmar_cita") return [];
    if (p.permiso === "promocion" && !c.aceptaPromociones) return [];
    if (!SOLO_NOMBRE.test(p.texto)) return [{ p }];
    if (proxima && proxima.tipo === "cita" && (p.clave === "recordatorio" || p.clave === "confirmar_cita")) return [{ p, citaId: proxima.id }];
    return [];
  });

  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-4xl">{c.nombre}</h1>
          <p className="text-tinta-suave">
            {c.telefono ? formatearTelefono(c.telefono) : "Sin teléfono"} · {f.realizadas} {f.realizadas === 1 ? "visita" : "visitas"}
            {f.noVino > 0 && ` · no vino ${f.noVino} ${f.noVino === 1 ? "vez" : "veces"}`}
            {f.proximas > 0 && ` · ${f.proximas} ${f.proximas === 1 ? "cita próxima" : "citas próximas"}`}
          </p>
        </div>
        {c.telefono && (
          <details className="relative">
            <summary className="inline-flex min-h-toque cursor-pointer items-center rounded-xl border-2 border-correcto px-5 font-semibold text-correcto hover:bg-correcto-fondo">
              WhatsApp
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-72 space-y-1 rounded-xl border border-borde bg-superficie p-2 shadow-lg">
              {ofrecer.map(({ p, citaId }) =>
                enviable(p) ? (
                  <EnviarWhatsapp key={p.clave} clienteId={c.id} plantilla={p.clave} citaId={citaId} texto={`Enviar: ${p.nombre}`} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-crema disabled:opacity-60" />
                ) : (
                  <a key={p.clave} href={enlaceMensaje({ clienteId: c.id, plantilla: p.clave, citaId })} target="_blank" rel="noopener" className="block rounded-lg px-3 py-2 hover:bg-crema">
                    {p.nombre}
                  </a>
                ),
              )}
              <a href={enlaceWhatsapp(c.telefono, `Hola, ${c.nombre.split(" ")[0]}. `)} target="_blank" rel="noopener noreferrer" className="block rounded-lg px-3 py-2 text-tinta-suave hover:bg-crema">
                Escribir otra cosa
              </a>
            </div>
          </details>
        )}
        <Link href={`/gestion/agenda/nueva?cliente=${c.id}`} className="inline-flex min-h-toque items-center rounded-xl bg-dorado-oscuro px-5 font-semibold text-white hover:bg-tinta">
          + Nueva cita
        </Link>
      </header>

      {bonos.length > 0 && (
        <section aria-label="Bonos" className="space-y-2">
          <h2 className="text-2xl">Bonos</h2>
          <Tarjeta className="divide-y divide-borde p-0">
            {bonos.map((b) => (
              <Link key={b.id} href={`/gestion/mas/bonos/${b.id}`} className="flex min-h-toque flex-wrap items-center justify-between gap-2 px-6 py-2 hover:bg-crema">
                <span className="font-semibold">{b.nombre}</span>
                <span>{b.estado === "activo" ? `Le ${textoQuedan(b.sesiones - b.usadas)}` : NOMBRE_ESTADO_BONO[b.estado]}</span>
              </Link>
            ))}
          </Tarjeta>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="historial" className="space-y-3">
          <h2 id="historial" className="text-2xl">
            Historial
          </h2>
          <NuevaNota id={c.id} />
          <ol className="space-y-2">
            {f.eventos.map((e, i) => (
              <li key={i} className="rounded-xl border border-borde bg-superficie px-4 py-3">
                {e.tipo === "cita" && (
                  <Link href={`/gestion/agenda/cita/${e.id}`} className="block">
                    <div className="font-semibold first-letter:uppercase">
                      {diaLargo(partesMadrid(e.cuando).fecha)}, {horaATexto(partesMadrid(e.cuando).minutos)} · {NOMBRE_ESTADO[e.estado as EstadoCita]}
                    </div>
                    <div className="text-tinta-suave">
                      {e.servicios.join(" + ")}
                      {e.origen === "web" && " · pedida en la web"}
                    </div>
                  </Link>
                )}
                {e.tipo === "nota" && (
                  <>
                    <div className="text-sm text-tinta-suave">
                      Nota de {e.autor} · {fechaHora(e.cuando)}
                    </div>
                    <div className="whitespace-pre-wrap">{e.texto}</div>
                  </>
                )}
                {e.tipo === "consentimiento" && (
                  <div className="text-sm text-tinta-suave">
                    {PERMISO[e.permiso as keyof typeof PERMISO]}: {e.aceptado ? "sí" : "retirado"} ({e.canal}) · {fechaHora(e.cuando)}
                  </div>
                )}
                {e.tipo === "alta" && <div className="text-sm text-tinta-suave">Ficha creada · {fechaHora(e.cuando)}</div>}
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="datos" className="space-y-3">
          <Tarjeta className="space-y-3">
            <h2 className="text-xl">Consentimientos</h2>
            {firmados.length > 0 && (
              <ul className="space-y-1" aria-label="Consentimientos firmados">
                {firmados.map((f) => (
                  <li key={f.id}>
                    <Link href={`/gestion/clientas/${c.id}/consentimiento/${f.id}`} className="underline">
                      {f.nombre}
                    </Link>{" "}
                    <span className="text-sm text-tinta-suave">
                      · firmado el {fechaHora(f.firmadoEn)}
                      {f.revocadoEn && <strong className="text-urgente"> · retirado</strong>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              {modelosActivos.map((m) => (
                <Link key={m.id} href={`/gestion/clientas/${c.id}/consentimiento?modelo=${m.id}`} className="inline-flex min-h-10 items-center rounded-lg border-2 border-dorado px-3 text-sm font-semibold text-dorado-oscuro hover:bg-crema">
                  Firmar: {m.nombre}
                </Link>
              ))}
            </div>
          </Tarjeta>
          <Tarjeta className="space-y-3">
            <h2 className="text-xl">Fotos</h2>
            {fotos.length > 0 && (
              <ul className="grid grid-cols-3 gap-2" aria-label="Fotos">
                {fotos.map((f) => (
                  <li key={f.id} className="space-y-1">
                    <a href={`/gestion/clientas/${c.id}/fotos/${f.id}`} target="_blank" rel="noopener">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/gestion/clientas/${c.id}/fotos/${f.id}`} alt={`${NOMBRE_TIPO_FOTO[f.tipo]} · ${fechaHora(f.subidaEn)}`} className="aspect-square w-full rounded-lg object-cover" />
                    </a>
                    <div className="text-xs text-tinta-suave">
                      {NOMBRE_TIPO_FOTO[f.tipo]} · {fechaHora(f.subidaEn).slice(0, 10)}
                      {f.nota && ` · ${f.nota}`}
                    </div>
                    <form action={borrar}>
                      <input type="hidden" name="cliente" value={c.id} />
                      <input type="hidden" name="foto" value={f.id} />
                      <button type="submit" className="text-xs text-urgente underline">
                        Borrar
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <SubirFoto clienteId={c.id} />
          </Tarjeta>
          <Tarjeta className="space-y-3">
            <h2 className="text-xl">Apuntar una tarea sobre {c.nombre.split(" ")[0]}</h2>
            <FormularioTarea clienteId={c.id} />
          </Tarjeta>
          {(mensajes.length > 0 || puedeResponder) && (
            <Tarjeta className="space-y-3">
              <h2 id="whatsapp" className="scroll-mt-4 text-xl">
                WhatsApp
              </h2>
              {puedeResponder && <Responder clienteId={c.id} />}
              <ol className="space-y-2" aria-label="Mensajes">
                {mensajes.slice(0, 30).map(({ m, quien }) => (
                  <li key={m.id} className={`rounded-xl border px-3 py-2 ${m.direccion === "entrante" ? "mr-8 border-dorado bg-crema" : "ml-8 border-borde"}`}>
                    <div className="text-sm text-tinta-suave">
                      {m.direccion === "entrante"
                        ? `${c.nombre.split(" ")[0]} escribió`
                        : m.canal === "whatsapp_enlace"
                          ? `Abierto en WhatsApp por ${quien ?? "—"}`
                          : `Enviado por ${quien ?? "la app"}`}{" "}
                      · {fechaHora(m.cuando)}
                      {m.estado && m.direccion === "saliente" && (
                        <span className={`ml-2 font-semibold ${m.estado === "fallido" ? "text-urgente" : "text-correcto"}`} data-testid="estado-envio">
                          {NOMBRE_ESTADO_ENVIO[m.estado]}
                        </span>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap">{m.texto}</div>
                    {m.estado === "fallido" && m.error && <div className="text-sm text-urgente">{m.error}</div>}
                  </li>
                ))}
              </ol>
            </Tarjeta>
          )}

          <h2 id="datos" className="text-2xl">
            Datos
          </h2>
          <Tarjeta>
            <FormularioClienta
              valores={{
                id: c.id,
                nombre: c.nombre,
                telefono: c.telefono ? formatearTelefono(c.telefono) : "",
                email: c.email ?? "",
                fechaNacimiento: c.fechaNacimiento ?? "",
                notas: c.notas ?? "",
                aceptaAvisosCitas: c.aceptaAvisosCitas,
                aceptaPromociones: c.aceptaPromociones,
              }}
            />
          </Tarjeta>
          {esAdmin && (
            <Tarjeta className="space-y-3">
              <h3 className="text-xl">Protección de datos</h3>
              <p className="text-sm text-tinta-suave">Si la clienta lo pide, puedes darle una copia de sus datos o eliminarlos.</p>
              <div className="flex flex-wrap gap-3">
                <a href={`/gestion/clientas/${c.id}/exportar`} className="inline-flex min-h-toque items-center rounded-xl border-2 border-dorado px-5 font-semibold text-dorado-oscuro">
                  Descargar sus datos
                </a>
                <form action={suprimir}>
                  <input type="hidden" name="id" value={c.id} />
                  <ConfirmarSupresion />
                </form>
              </div>
            </Tarjeta>
          )}
        </section>
      </div>
    </div>
  );
}

function ConfirmarSupresion() {
  return (
    <details>
      <summary className="inline-flex min-h-toque cursor-pointer items-center rounded-xl px-5 font-semibold text-urgente">Eliminar sus datos…</summary>
      <div className="mt-2 space-y-2 rounded-xl border border-urgente bg-urgente-fondo p-3">
        <p className="text-sm">Se borran su nombre, teléfono, correo y notas. Sus citas quedan sin nombre. No se puede deshacer.</p>
        <Boton type="submit" variante="peligro">
          Sí, eliminar sus datos
        </Boton>
      </div>
    </details>
  );
}
