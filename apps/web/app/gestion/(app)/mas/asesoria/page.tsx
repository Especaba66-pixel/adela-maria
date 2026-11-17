import { centro } from "@adela/db";
import { hoyEnMadrid, mesVecino, nombreMes, periodoDeMes, puede, trimestre } from "@adela/dominio";
import { Tarjeta } from "@adela/ui";
import Link from "next/link";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";

const enlace = "inline-flex min-h-toque items-center rounded-xl border-2 border-borde bg-superficie px-4 font-medium";
const boton = "inline-flex min-h-toque items-center rounded-xl border-2 border-dorado-oscuro px-5 font-semibold text-dorado-oscuro hover:bg-crema";
const principal = "inline-flex min-h-toque items-center rounded-xl bg-dorado-oscuro px-5 font-semibold text-white hover:bg-tinta";

/** Todo lo que se manda a la asesoría, junto: el mes elegido en PDF o Excel y el correo ya redactado. */
export default async function Asesoria({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { usuario } = await requerirSesion("informes.ver");
  const actual = hoyEnMadrid(new Date()).slice(0, 7);
  const q = await searchParams;
  // Por defecto, el mes que acaba de terminar: es el que suele pedir la asesoría.
  const mes = q.mes && periodoDeMes(q.mes) && q.mes <= actual ? q.mes : mesVecino(actual, -1);
  const t = trimestre(`${mes}-15`);
  const cierraTrimestre = mes === t.hasta.slice(0, 7);
  const [c] = await db().select({ correo: centro.correoAsesoria }).from(centro).limit(1);
  const correo = c?.correo ?? "";

  const papeles = [
    {
      clave: "servicios",
      titulo: `Servicios y ventas de ${nombreMes(mes)}`,
      texto: "Todo lo cobrado, línea a línea, con el total de cada día y el resumen del mes.",
      excel: `/gestion/mas/informes/servicios/exportar?mes=${mes}`,
      archivo: `adela-maria-servicios-${mes}`,
      ver: true,
    },
    {
      clave: "stock",
      titulo: `Stock de ${nombreMes(mes)}`,
      texto: "Lo que había, lo que entró, lo vendido, lo gastado en cabina y lo que queda, con su valor.",
      excel: `/gestion/mas/stock/exportar?mes=${mes}`,
      archivo: `adela-maria-stock-${mes}`,
      ver: puede(usuario.rol, "stock.gestionar"),
    },
    {
      clave: "trimestre",
      titulo: `Trimestre ${t.nombre.slice(-2)} de ${t.nombre.slice(0, 4)}`,
      texto: cierraTrimestre
        ? "Facturas emitidas, gastos y resumen de IVA. Este mes cierra el trimestre: toca mandarlo."
        : "Facturas emitidas, gastos y resumen de IVA. Se manda al cerrar el trimestre (marzo, junio, septiembre y diciembre).",
      excel: `/gestion/mas/gastos/exportar?t=${t.nombre}`,
      archivo: `adela-maria-trimestre-${t.nombre}`,
      ver: puede(usuario.rol, "gastos.gestionar"),
    },
  ].filter((p) => p.ver);

  const adjuntos = papeles.filter((p) => p.clave !== "trimestre" || cierraTrimestre).map((p) => `- ${p.archivo}.pdf`);
  const mailto = correo
    ? `mailto:${encodeURIComponent(correo)}?subject=${encodeURIComponent(`Documentación de ${nombreMes(mes)} · Adela María Belleza holística`)}&body=${encodeURIComponent(
        `Hola,\n\nTe paso la documentación de ${nombreMes(mes)}:\n\n${adjuntos.join("\n")}\n\nUn saludo.`,
      )}`
    : null;

  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-4xl first-letter:uppercase">Asesoría · {nombreMes(mes)}</h1>
        <Link href={`/gestion/mas/asesoria?mes=${mesVecino(mes, -1)}`} className={enlace}>
          ‹ Mes anterior
        </Link>
        {mes < actual && (
          <Link href={`/gestion/mas/asesoria?mes=${mesVecino(mes, 1)}`} className={enlace}>
            Mes siguiente ›
          </Link>
        )}
      </header>
      <p className="text-tinta-suave">
        Descarga los papeles del mes en PDF (o en Excel, si la asesoría los quiere para trabajar con los números) y mándalos con el correo ya redactado.
      </p>

      <ol className="space-y-4">
        {papeles.map((p, i) => (
          <li key={p.clave} aria-label={p.titulo}>
            <Tarjeta className="space-y-3">
              <h2 className="text-2xl">
                {i + 1}. {p.titulo}
              </h2>
              <p className="text-tinta-suave">{p.texto}</p>
              <div className="flex flex-wrap gap-3">
                <a href={`/gestion/mas/asesoria/pdf?doc=${p.clave}&mes=${mes}`} className={principal}>
                  Descargar PDF
                </a>
                <a href={p.excel} className={boton}>
                  Excel
                </a>
              </div>
            </Tarjeta>
          </li>
        ))}
      </ol>

      <section aria-label="Mandar a la asesoría">
      <Tarjeta className="space-y-3">
        <h2 className="text-2xl">Mandar a la asesoría</h2>
        {mailto ? (
          <>
            <p className="text-tinta-suave">
              Abre el correo para <strong>{correo}</strong> con el asunto y el texto ya puestos. Adjunta los PDF que acabas de descargar (están en la carpeta Descargas).
            </p>
            <a href={mailto} className={principal}>
              Escribir a la asesoría
            </a>
          </>
        ) : (
          <p className="text-tinta-suave">
            Para abrir el correo ya redactado, pon el correo de la asesoría en{" "}
            <Link href="/gestion/mas/configuracion/centro" className="font-semibold text-dorado-oscuro underline">
              Configuración → Datos del centro
            </Link>
            .
          </p>
        )}
      </Tarjeta>
      </section>
    </div>
  );
}
