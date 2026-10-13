import { Aviso, Boton } from "@adela/ui";
import Link from "next/link";
import { hecho, posponer, tareaHecha } from "@/app/gestion/(app)/avisos/acciones";
import type { AvisoDia, MensajeAviso } from "@/server/avisos";

/** Enlace que prepara el mensaje (lo anota en la ficha) y abre WhatsApp. */
export function enlaceMensaje(m: MensajeAviso, clave?: string) {
  const q = new URLSearchParams({ cliente: m.clienteId, plantilla: m.plantilla });
  if (m.citaId) q.set("cita", m.citaId);
  if (m.bonoId) q.set("bono", m.bonoId);
  if (clave) q.set("clave", clave);
  return `/gestion/whatsapp?${q}`;
}

const boton = "inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold";

/** Lista de cosas por hacer, cada una con su acción: escribir por WhatsApp, hecho, mañana. */
export function ListaAvisos({ avisos }: { avisos: AvisoDia[] }) {
  return (
    <ul className="space-y-2" aria-label="Por hacer">
      {avisos.map((a, i) => (
        <li key={a.clave ?? a.tareaId ?? `${a.titulo}-${i}`}>
          <Aviso prioridad={a.prioridad}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="mr-auto min-w-0">
                <div className="font-semibold">
                  {a.enlace ? (
                    <Link href={a.enlace} className="underline">
                      {a.titulo}
                    </Link>
                  ) : (
                    a.titulo
                  )}
                </div>
                {a.detalle && <div className="text-sm opacity-80">{a.detalle}</div>}
                {a.mensaje?.noDisponible && <div className="text-sm opacity-80">WhatsApp: {a.mensaje.noDisponible.toLowerCase()}.</div>}
              </div>
              <div className="flex flex-wrap gap-2">
                {a.mensaje && !a.mensaje.noDisponible && (
                  <a href={enlaceMensaje(a.mensaje, a.clave)} target="_blank" rel="noopener" className={`${boton} bg-correcto text-white hover:opacity-90`}>
                    WhatsApp
                  </a>
                )}
                {a.clave && (
                  <>
                    <form action={hecho}>
                      <input type="hidden" name="clave" value={a.clave} />
                      <Boton type="submit" variante="secundario" className="min-h-10 px-3 text-sm">
                        Hecho
                      </Boton>
                    </form>
                    <form action={posponer}>
                      <input type="hidden" name="clave" value={a.clave} />
                      <Boton type="submit" variante="discreto" className="min-h-10 px-3 text-sm">
                        Mañana
                      </Boton>
                    </form>
                  </>
                )}
                {a.tareaId && (
                  <form action={tareaHecha}>
                    <input type="hidden" name="id" value={a.tareaId} />
                    <Boton type="submit" variante="secundario" className="min-h-10 px-3 text-sm">
                      Hecha
                    </Boton>
                  </form>
                )}
              </div>
            </div>
          </Aviso>
        </li>
      ))}
    </ul>
  );
}
