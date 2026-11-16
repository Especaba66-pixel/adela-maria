"use client";
import { nombreMes } from "@adela/dominio";
import { useState } from "react";

const boton = "inline-flex min-h-toque items-center rounded-xl border-2 border-dorado-oscuro px-5 font-semibold text-dorado-oscuro hover:bg-crema";

/** Stock del mes para la asesoría: se descarga el archivo y se abre el correo ya redactado (el archivo se adjunta). */
export function StockAsesoria({ mesInicial, mesMaximo, correo }: { mesInicial: string; mesMaximo: string; correo: string }) {
  const [mes, setMes] = useState(mesInicial);
  const valido = /^\d{4}-\d{2}$/.test(mes);
  const nombre = valido ? nombreMes(mes) : "";
  const asunto = `Stock de ${nombre} · Adela María Belleza holística`;
  const cuerpo = `Hola,\n\nTe paso el stock de ${nombre}: existencias al empezar, entradas, salidas, gastado en cabina y existencias al acabar, con su valor.\n\nAdjunto el archivo (adela-maria-stock-${mes}.csv).\n\nUn saludo.`;
  const enlaceCorreo = `mailto:${encodeURIComponent(correo)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  return (
    <form action="/gestion/mas/stock/exportar" method="get" aria-label="Stock para la asesoría" className="flex flex-wrap items-end gap-3 rounded-xl border border-borde bg-superficie p-4">
      <label className="font-medium">
        Stock del mes para la asesoría
        <input name="mes" type="month" required value={mes} max={mesMaximo} onChange={(e) => setMes(e.target.value)} className="mt-1 block min-h-toque rounded-xl border-2 border-borde bg-white px-3" />
      </label>
      <button type="submit" className={boton}>
        1. Descargar
      </button>
      {correo ? (
        <a href={valido ? enlaceCorreo : undefined} className={boton}>
          2. Escribir a la asesoría
        </a>
      ) : (
        <span className="text-sm text-tinta-suave">Para abrir el correo ya redactado, pon el correo de la asesoría en Configuración → Datos del centro.</span>
      )}
      <span className="basis-full text-sm text-tinta-suave">
        Lo que había, lo que entró, lo que se vendió y se gastó, y lo que queda, con su valor. Se abre en Excel. Descarga el archivo y adjúntalo al correo.
      </span>
    </form>
  );
}
