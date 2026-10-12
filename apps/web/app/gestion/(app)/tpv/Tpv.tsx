"use client";
import { METODOS_PAGO, NOMBRE_METODO, calcularLinea, cambio, formatearEuros, totalDe, type MetodoPago } from "@adela/dominio";
import { Aviso, Boton, Tarjeta, clases } from "@adela/ui";
import { useMemo, useState, useTransition } from "react";
import { TecladoImporte } from "@/components/TecladoImporte";
import { cobrar } from "./acciones";

export interface ItemCatalogo {
  id: string;
  nombre: string;
  categoria: string;
  precioCentimos: number | null;
  ivaCentesimas: number | null;
}
export interface CitaPorCobrar {
  id: string;
  hora: string;
  cliente: { id: string; nombre: string };
  servicios: string[];
  tratamientoIds: string[];
}
interface Linea {
  tratamientoId: string;
  cantidad: number;
  descuentoCentesimas: number;
}

const DESCUENTOS = [0, 500, 1000, 1500, 2000, 5000, 10000];

export function Tpv({
  catalogo,
  citas,
  cajaAbierta,
  inicial,
}: {
  catalogo: ItemCatalogo[];
  citas: CitaPorCobrar[];
  cajaAbierta: boolean;
  /** Cita con la que se abre el TPV (al pulsar «Cobrar» en una cita). */
  inicial?: CitaPorCobrar;
}) {
  const [lineas, setLineas] = useState<Linea[]>(() => (inicial?.tratamientoIds ?? []).map((id) => ({ tratamientoId: id, cantidad: 1, descuentoCentesimas: 0 })));
  const [cita, setCita] = useState<CitaPorCobrar | null>(inicial ?? null);
  const [pagosHechos, setPagosHechos] = useState<{ metodo: MetodoPago; importe: number; entregado?: number }[]>([]);
  const [metodo, setMetodo] = useState<MetodoPago | null>(null);
  const [importe, setImporte] = useState(0);
  const [entregado, setEntregado] = useState(0);
  const [conFactura, setConFactura] = useState(false);
  const [destinatario, setDestinatario] = useState({ nombre: "", nif: "", direccion: "" });
  const [error, setError] = useState<string | null>(null);
  const [cobrando, iniciar] = useTransition();

  const porId = useMemo(() => new Map(catalogo.map((c) => [c.id, c])), [catalogo]);
  const calculadas = lineas.map((l) => {
    const t = porId.get(l.tratamientoId)!;
    return { ...l, nombre: t.nombre, ...calcularLinea({ descripcion: t.nombre, cantidad: l.cantidad, precioUnitario: t.precioCentimos ?? 0, descuentoCentesimas: l.descuentoCentesimas, ivaCentesimas: t.ivaCentesimas ?? 0 }) };
  });
  const total = totalDe(calculadas);
  const yaPagado = pagosHechos.reduce((s, p) => s + p.importe, 0);
  const falta = total - yaPagado;

  function reiniciarPago(nuevoFalta = falta) {
    setMetodo(null);
    setImporte(nuevoFalta);
    setEntregado(nuevoFalta);
  }
  function anadir(id: string) {
    setError(null);
    setPagosHechos([]);
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.tratamientoId === id && l.descuentoCentesimas === 0);
      return i >= 0 ? ls.map((l, j) => (j === i ? { ...l, cantidad: l.cantidad + 1 } : l)) : [...ls, { tratamientoId: id, cantidad: 1, descuentoCentesimas: 0 }];
    });
    setMetodo(null);
  }
  function cambiarLinea(i: number, cambios: Partial<Linea> | null) {
    setPagosHechos([]);
    setMetodo(null);
    setLineas((ls) => (cambios === null ? ls.filter((_, j) => j !== i) : ls.map((l, j) => (j === i ? { ...l, ...cambios } : l))));
  }
  function elegirCita(c: CitaPorCobrar) {
    setError(null);
    setCita(c);
    setPagosHechos([]);
    setMetodo(null);
    setLineas(c.tratamientoIds.filter((id) => porId.has(id)).map((id) => ({ tratamientoId: id, cantidad: 1, descuentoCentesimas: 0 })));
  }
  function elegirMetodo(m: MetodoPago) {
    setMetodo(m);
    setImporte(falta);
    setEntregado(falta);
  }
  function vaciar() {
    setLineas([]);
    setCita(null);
    setPagosHechos([]);
    setMetodo(null);
    setConFactura(false);
    setError(null);
  }

  const pagoActual = metodo && importe > 0 ? { metodo, importe, ...(metodo === "efectivo" ? { entregado: Math.max(entregado, importe) } : {}) } : null;
  const pagosFinales = pagoActual ? [...pagosHechos, pagoActual] : pagosHechos;
  const quedaADeber = total - pagosFinales.reduce((s, p) => s + p.importe, 0);

  function enviar(pagos: typeof pagosFinales) {
    setError(null);
    iniciar(async () => {
      const r = await cobrar({
        lineas,
        pagos,
        clienteId: cita?.cliente.id,
        citaId: cita?.id,
        destinatario: conFactura ? destinatario : undefined,
      });
      if (r?.error) setError(r.error);
    });
  }

  const categorias = [...new Set(catalogo.map((c) => c.categoria))];

  return (
    <div className="grid grid-cols-[14rem_1fr_22rem] gap-4">
      {/* Citas de hoy por cobrar */}
      <section aria-label="Citas por cobrar" className="space-y-2">
        <h2 className="text-2xl">Por cobrar hoy</h2>
        {citas.length === 0 && <p className="text-tinta-suave">No hay citas pendientes de cobro.</p>}
        {citas.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => elegirCita(c)}
            className={clases("block w-full rounded-xl border-2 px-3 py-2 text-left", cita?.id === c.id ? "border-dorado-oscuro bg-crema" : "border-borde bg-superficie hover:border-dorado")}
          >
            <div className="font-semibold">
              {c.hora} · {c.cliente.nombre}
            </div>
            <div className="text-sm text-tinta-suave">{c.servicios.join(" + ")}</div>
          </button>
        ))}
      </section>

      {/* Catálogo */}
      <section aria-label="Tratamientos" className="space-y-3">
        {categorias.map((cat) => (
          <div key={cat} className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-tinta-suave">{cat}</h3>
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
              {catalogo
                .filter((c) => c.categoria === cat)
                .map((c) => {
                  const cobrable = c.precioCentimos !== null && c.ivaCentesimas !== null;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={!cobrable}
                      onClick={() => anadir(c.id)}
                      className="min-h-boton rounded-xl border-2 border-borde bg-superficie px-3 py-2 text-left hover:border-dorado disabled:opacity-50"
                    >
                      <div className="font-medium leading-tight">{c.nombre}</div>
                      <div className="text-sm text-tinta-suave">
                        {c.precioCentimos === null ? "sin precio" : c.ivaCentesimas === null ? "sin IVA" : formatearEuros(c.precioCentimos)}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </section>

      {/* Cuenta y cobro */}
      <section aria-label="Cuenta" className="space-y-3">
        <Tarjeta className="space-y-3 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl">{cita ? cita.cliente.nombre : "Cuenta"}</h2>
            {lineas.length > 0 && (
              <Boton variante="discreto" onClick={vaciar} className="min-h-0 px-2 text-sm">
                Vaciar
              </Boton>
            )}
          </div>
          {lineas.length === 0 && <p className="text-tinta-suave">Toca una cita o un tratamiento.</p>}
          <ul className="divide-y divide-borde">
            {calculadas.map((l, i) => (
              <li key={i} className="space-y-1 py-2" aria-label={`Línea ${l.nombre}`}>
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{l.nombre}</span>
                  <span className="font-semibold">{formatearEuros(l.total)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Boton variante="secundario" className="min-h-10 px-3" aria-label="Quitar uno" onClick={() => (l.cantidad > 1 ? cambiarLinea(i, { cantidad: l.cantidad - 1 }) : cambiarLinea(i, null))}>
                    −
                  </Boton>
                  <span className="w-8 text-center">{l.cantidad}</span>
                  <Boton variante="secundario" className="min-h-10 px-3" aria-label="Añadir uno" onClick={() => cambiarLinea(i, { cantidad: l.cantidad + 1 })}>
                    +
                  </Boton>
                  <select
                    aria-label={`Descuento de ${l.nombre}`}
                    value={l.descuentoCentesimas}
                    onChange={(e) => cambiarLinea(i, { descuentoCentesimas: Number(e.target.value) })}
                    className="ml-auto min-h-10 rounded-lg border-2 border-borde bg-superficie px-2"
                  >
                    {DESCUENTOS.map((d) => (
                      <option key={d} value={d}>
                        {d === 0 ? "Sin dto." : d === 10000 ? "Gratis" : `−${d / 100} %`}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between border-t-2 border-tinta pt-2">
            <span className="text-xl font-semibold">Total</span>
            <span className="font-titulo text-4xl" data-testid="total">
              {formatearEuros(total)}
            </span>
          </div>
          {pagosHechos.map((p, i) => (
            <div key={i} className="flex justify-between text-tinta-suave">
              <span>{NOMBRE_METODO[p.metodo]}</span>
              <span>{formatearEuros(p.importe)}</span>
            </div>
          ))}
          {pagosHechos.length > 0 && (
            <div className="flex justify-between font-semibold">
              <span>Falta</span>
              <span>{formatearEuros(falta)}</span>
            </div>
          )}
        </Tarjeta>

        {error && <Aviso prioridad="urgente">{error}</Aviso>}
        {!cajaAbierta && lineas.length > 0 && <Aviso prioridad="importante">La caja está cerrada: ábrela en Caja para cobrar.</Aviso>}

        {lineas.length > 0 && falta > 0 && (
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Forma de pago">
            {METODOS_PAGO.map((m) => (
              <Boton key={m} variante={metodo === m ? "principal" : "secundario"} onClick={() => elegirMetodo(m)} className="h-16">
                {NOMBRE_METODO[m]}
              </Boton>
            ))}
          </div>
        )}

        {metodo && (
          <div className="space-y-2">
            {metodo === "efectivo" ? (
              <>
                <TecladoImporte centimos={entregado} onCambio={setEntregado} etiqueta="Entregado" atajos={[importe, 1000, 2000, 5000].filter((v, i, a) => v >= importe && a.indexOf(v) === i)} />
                <div className="flex justify-between text-xl">
                  <span>Cambio</span>
                  <strong data-testid="cambio">{formatearEuros(cambio(importe, entregado))}</strong>
                </div>
              </>
            ) : (
              <p className="text-tinta-suave">Cobra {formatearEuros(importe)} en el datáfono y pulsa Cobrar.</p>
            )}
          </div>
        )}

        {lineas.length > 0 && (
          <label className="flex min-h-toque items-center gap-3">
            <input type="checkbox" checked={conFactura} onChange={(e) => setConFactura(e.target.checked)} className="size-6 accent-dorado-oscuro" />
            Quiere factura con sus datos
          </label>
        )}
        {conFactura && (
          <div className="space-y-2">
            {(["nombre", "nif", "direccion"] as const).map((k) => (
              <input
                key={k}
                aria-label={{ nombre: "Nombre para la factura", nif: "NIF para la factura", direccion: "Dirección para la factura" }[k]}
                placeholder={{ nombre: "Nombre", nif: "NIF", direccion: "Dirección" }[k]}
                value={destinatario[k]}
                onChange={(e) => setDestinatario({ ...destinatario, [k]: e.target.value })}
                className="block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3"
              />
            ))}
          </div>
        )}

        {lineas.length > 0 && (
          <div className="space-y-2">
            <Boton
              grande
              className="w-full"
              disabled={cobrando || !cajaAbierta || (total > 0 && pagosFinales.length === 0) || (metodo === "efectivo" && entregado < importe)}
              onClick={() => enviar(pagosFinales)}
            >
              {cobrando ? "Cobrando…" : quedaADeber > 0 ? `Cobrar y dejar ${formatearEuros(quedaADeber)} a deber` : `Cobrar ${formatearEuros(total)}`}
            </Boton>
            {metodo && importe < falta && (
              <Boton variante="secundario" className="w-full" onClick={() => (setPagosHechos([...pagosHechos, pagoActual!]), reiniciarPago(falta - importe))}>
                Pagar {formatearEuros(importe)} así y el resto de otra forma
              </Boton>
            )}
            {metodo && metodo !== "efectivo" && (
              <details>
                <summary className="cursor-pointer text-sm text-tinta-suave">Cobrar solo una parte</summary>
                <div className="pt-2">
                  <TecladoImporte centimos={importe} onCambio={(c) => setImporte(Math.min(c, falta))} etiqueta="Importe de este pago" />
                </div>
              </details>
            )}
            {pagosFinales.length === 0 && total > 0 && (
              <Boton variante="discreto" className="w-full" disabled={cobrando || !cajaAbierta} onClick={() => enviar([])}>
                Dejarlo todo a deber
              </Boton>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
