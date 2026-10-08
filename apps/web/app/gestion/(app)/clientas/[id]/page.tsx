import { NOMBRE_ESTADO, enlaceWhatsapp, formatearTelefono, horaATexto, partesMadrid, puede, type EstadoCita } from "@adela/dominio";
import { Boton, Tarjeta } from "@adela/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { diaLargo, fechaHora } from "@/lib/fechas";
import { requerirSesion } from "@/server/auth";
import { fichaClienta } from "@/server/clientas";
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
          <a
            href={enlaceWhatsapp(c.telefono, `Hola, ${c.nombre}. `)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-toque items-center rounded-xl border-2 border-correcto px-5 font-semibold text-correcto hover:bg-correcto-fondo"
          >
            WhatsApp
          </a>
        )}
        <Link href={`/gestion/agenda/nueva?cliente=${c.id}`} className="inline-flex min-h-toque items-center rounded-xl bg-dorado-oscuro px-5 font-semibold text-white hover:bg-tinta">
          + Nueva cita
        </Link>
      </header>

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
