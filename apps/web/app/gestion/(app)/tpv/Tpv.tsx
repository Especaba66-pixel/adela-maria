"use client";
import {
  METODOS_CAJA,
  NOMBRE_METODO,
  asignarBonos,
  calcularLinea,
  cambio,
  formatearEuros,
  restantes,
  textoQuedan,
  textoSesiones,
  totalDe,
  type Bono,
  type MetodoPago,
} from "@adela/dominio";
import { Aviso, Boton, Tarjeta, clases } from "@adela/ui";
import { useEffect, useMemo, useState, useTransition } from "react";
import { TecladoImporte } from "@/components/TecladoImporte";
import { bonosUsables, buscarClienta, cobrar, consultarTarjeta, venderTarjeta } from "./acciones";

export interface ItemCatalogo {
  id: string;
  nombre: string;
  categoria: string;
  precioCentimos: number | null;
  ivaCentesimas: number | null;
}
export interface BonoALaVenta {
  id: string;
  nombre: string;
  sesiones: number;
  precioCentimos: number;
  ivaCentesimas: number | null;
  tratamientoIds: string[];
}
export interface CitaPorCobrar {
  id: string;
  hora: string;
  cliente: { id: string; nombre: string };
  servicios: string[];
  tratamientoIds: string[];
}
type Linea =
  | { tipo: "tratamiento"; tratamientoId: string; cantidad: number; descuentoCentesimas: number; conBono: boolean }
  | { tipo: "bono"; tipoBonoId: string; cantidad: number; descuentoCentesimas: number }
  | { tipo: "producto"; productoId: string; cantidad: number; descuentoCentesimas: number };
export interface ProductoALaVenta {
  id: string;
  nombre: string;
  precioCentimos: number | null;
  ivaCentesimas: number | null;
  stock: number;
}
type Pago = { metodo: MetodoPago; importe: number; entregado?: number; codigo?: string };
interface Clienta {
  id: string;
  nombre: string;
}

const DESCUENTOS = [0, 500, 1000, 1500, 2000, 5000, 10000];
const hoy = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
/** Los bonos que se compran en esta cuenta cuentan como bonos de la clienta (después de los que ya tiene). */
const NUEVO = "nuevo:";
const lineaTratamiento = (id: string): Linea => ({ tipo: "tratamiento", tratamientoId: id, cantidad: 1, descuentoCentesimas: 0, conBono: false });

export function Tpv({
  catalogo,
  bonosVenta,
  productosVenta = [],
  citas,
  cajaAbierta,
  inicial,
}: {
  catalogo: ItemCatalogo[];
  bonosVenta: BonoALaVenta[];
  productosVenta?: ProductoALaVenta[];
  citas: CitaPorCobrar[];
  cajaAbierta: boolean;
  /** Cita con la que se abre el TPV (al pulsar «Cobrar» en una cita). */
  inicial?: CitaPorCobrar;
}) {
  const [lineas, setLineas] = useState<Linea[]>(() => (inicial?.tratamientoIds ?? []).map(lineaTratamiento));
  const [cita, setCita] = useState<CitaPorCobrar | null>(inicial ?? null);
  const [clienta, setClienta] = useState<Clienta | null>(inicial?.cliente ?? null);
  const [bonosClienta, setBonosClienta] = useState<(Bono & { nombre: string })[]>([]);
  const [tarjeta, setTarjeta] = useState<{ importe: number; para: string; deParte: string } | null>(null);
  const [pagosHechos, setPagosHechos] = useState<Pago[]>([]);
  const [metodo, setMetodo] = useState<MetodoPago | null>(null);
  const [importe, setImporte] = useState(0);
  const [entregado, setEntregado] = useState(0);
  const [regalo, setRegalo] = useState<{ codigo: string; saldo: number } | null>(null);
  const [conFactura, setConFactura] = useState(false);
  const [destinatario, setDestinatario] = useState({ nombre: "", nif: "", direccion: "" });
  const [error, setError] = useState<string | null>(null);
  const [cobrando, iniciar] = useTransition();

  // Al elegir clienta se cargan sus bonos; si viene de una cita, los tratamientos que cubren se marcan «con bono».
  useEffect(() => {
    let vigente = true;
    if (!clienta) {
      setBonosClienta([]);
      return;
    }
    bonosUsables(clienta.id).then((bs) => {
      if (!vigente) return;
      setBonosClienta(bs);
      if (cita) {
        setLineas((ls) => {
          const ids = ls.map((l) => (l.tipo === "tratamiento" && l.cantidad === 1 ? l.tratamientoId : ""));
          const asignados = asignarBonos(ids, bs, hoy());
          return ls.map((l, i) => (l.tipo === "tratamiento" && asignados[i] ? { ...l, conBono: true } : l));
        });
      }
    });
    return () => {
      vigente = false;
    };
  }, [clienta, cita]);

  const porId = useMemo(() => new Map(catalogo.map((c) => [c.id, c])), [catalogo]);
  const bonoPorId = useMemo(() => new Map(bonosVenta.map((b) => [b.id, b])), [bonosVenta]);
  const productoPorId = useMemo(() => new Map(productosVenta.map((p) => [p.id, p])), [productosVenta]);

  // Qué bono paga cada línea «con bono», y si a las demás les podría tocar uno.
  const bonosEnCuenta = lineas.flatMap((l) => {
    if (l.tipo !== "bono") return [];
    const b = bonoPorId.get(l.tipoBonoId)!;
    return [{ id: `${NUEVO}${b.id}`, nombre: b.nombre, sesiones: b.sesiones * l.cantidad, usadas: 0, caducaEn: null, anulado: false, tratamientoIds: b.tratamientoIds, compradoEn: "9999" }];
  });
  const todosLosBonos = [...bonosClienta, ...bonosEnCuenta];
  const asignacion = asignarBonos(
    lineas.map((l) => (l.tipo === "tratamiento" && l.conBono ? l.tratamientoId : "")),
    todosLosBonos,
    hoy(),
  );
  const usadasAqui = new Map<string, number>();
  for (const b of asignacion) if (b) usadasAqui.set(b, (usadasAqui.get(b) ?? 0) + 1);
  const bonosRestantes = todosLosBonos.map((b) => ({ ...b, usadas: b.usadas + (usadasAqui.get(b.id) ?? 0) }));
  const bonoPosible = (tratamientoId: string) => bonosRestantes.find((b) => b.tratamientoIds.includes(tratamientoId) && restantes(b) > 0);

  const calculadas = lineas.map((l, i) => {
    if (l.tipo === "producto") {
      const p = productoPorId.get(l.productoId)!;
      return { linea: l, nombre: p.nombre, bonoId: null, ...calcularLinea({ descripcion: p.nombre, cantidad: l.cantidad, precioUnitario: p.precioCentimos ?? 0, descuentoCentesimas: l.descuentoCentesimas, ivaCentesimas: p.ivaCentesimas ?? 0 }) };
    }
    if (l.tipo === "bono") {
      const b = bonoPorId.get(l.tipoBonoId)!;
      return { linea: l, nombre: b.nombre, bonoId: null, ...calcularLinea({ descripcion: b.nombre, cantidad: l.cantidad, precioUnitario: b.precioCentimos, descuentoCentesimas: l.descuentoCentesimas, ivaCentesimas: b.ivaCentesimas ?? 0 }) };
    }
    const t = porId.get(l.tratamientoId)!;
    const bonoId = l.conBono ? (asignacion[i] ?? null) : null;
    const c = calcularLinea({ descripcion: t.nombre, cantidad: l.cantidad, precioUnitario: t.precioCentimos ?? 0, descuentoCentesimas: l.descuentoCentesimas, ivaCentesimas: t.ivaCentesimas ?? 0 });
    return { linea: l, nombre: t.nombre, bonoId, ...c, total: l.conBono ? 0 : c.total };
  });
  const sinSesion = calculadas.some((c) => c.linea.tipo === "tratamiento" && c.linea.conBono && !c.bonoId);
  const total = tarjeta ? tarjeta.importe : totalDe(calculadas);
  const yaPagado = pagosHechos.reduce((s, p) => s + p.importe, 0);
  const falta = total - yaPagado;
  const hayAlgo = lineas.length > 0 || tarjeta !== null;
  const todoConBono = !tarjeta && lineas.length > 0 && total === 0 && calculadas.every((c) => c.bonoId);
  const vendeBonos = lineas.some((l) => l.tipo === "bono");

  function limpiarPago() {
    setError(null);
    setPagosHechos([]);
    setMetodo(null);
    setRegalo(null);
  }
  function reiniciarPago(nuevoFalta = falta) {
    setMetodo(null);
    setRegalo(null);
    setImporte(nuevoFalta);
    setEntregado(nuevoFalta);
  }
  function anadir(id: string) {
    limpiarPago();
    setTarjeta(null);
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.tipo === "tratamiento" && l.tratamientoId === id && l.descuentoCentesimas === 0 && !l.conBono);
      return i >= 0 ? ls.map((l, j) => (j === i ? { ...l, cantidad: l.cantidad + 1 } : l)) : [...ls, lineaTratamiento(id)];
    });
  }
  /** Al vender un bono, lo que cubre de la cuenta pasa a pagarse con él (la primera sesión, hoy). */
  function anadirProducto(id: string) {
    limpiarPago();
    setTarjeta(null);
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.tipo === "producto" && l.productoId === id && l.descuentoCentesimas === 0);
      return i >= 0 ? ls.map((l, j) => (j === i ? { ...l, cantidad: l.cantidad + 1 } : l)) : [...ls, { tipo: "producto", productoId: id, cantidad: 1, descuentoCentesimas: 0 }];
    });
  }
  function anadirBono(id: string) {
    limpiarPago();
    setTarjeta(null);
    const cubre = bonoPorId.get(id)!.tratamientoIds;
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.tipo === "bono" && l.tipoBonoId === id && l.descuentoCentesimas === 0);
      const conBono = ls.map((l) => (l.tipo === "tratamiento" && !l.conBono && l.cantidad === 1 && cubre.includes(l.tratamientoId) ? { ...l, conBono: true, descuentoCentesimas: 0 } : l));
      return i >= 0 ? conBono.map((l, j) => (j === i ? { ...l, cantidad: l.cantidad + 1 } : l)) : [...conBono, { tipo: "bono", tipoBonoId: id, cantidad: 1, descuentoCentesimas: 0 }];
    });
  }
  function cambiarLinea(i: number, cambios: Partial<Linea> | null) {
    limpiarPago();
    setLineas((ls) => (cambios === null ? ls.filter((_, j) => j !== i) : ls.map((l, j) => (j === i ? ({ ...l, ...cambios } as Linea) : l))));
  }
  function elegirCita(c: CitaPorCobrar) {
    limpiarPago();
    setTarjeta(null);
    setCita(c);
    setClienta(c.cliente);
    setLineas(c.tratamientoIds.filter((id) => porId.has(id)).map(lineaTratamiento));
  }
  function empezarTarjeta() {
    limpiarPago();
    setLineas([]);
    setCita(null);
    setConFactura(false);
    setTarjeta({ importe: 0, para: "", deParte: "" });
  }
  function elegirMetodo(m: MetodoPago) {
    setMetodo(m);
    setRegalo(null);
    setImporte(falta);
    setEntregado(falta);
  }
  function vaciar() {
    setLineas([]);
    setCita(null);
    setTarjeta(null);
    setConFactura(false);
    limpiarPago();
  }

  const pagoActual: Pago | null =
    metodo && importe > 0 && (metodo !== "tarjeta_regalo" || regalo)
      ? { metodo, importe, ...(metodo === "efectivo" ? { entregado: Math.max(entregado, importe) } : {}), ...(regalo ? { codigo: regalo.codigo } : {}) }
      : null;
  const pagosFinales = pagoActual ? [...pagosHechos, pagoActual] : pagosHechos;
  const quedaADeber = total - pagosFinales.reduce((s, p) => s + p.importe, 0);

  function enviar(pagos: Pago[]) {
    setError(null);
    iniciar(async () => {
      const r = tarjeta
        ? await venderTarjeta({ importe: tarjeta.importe, para: tarjeta.para, deParte: tarjeta.deParte, clienteId: clienta?.id, pagos })
        : await cobrar({
            lineas: calculadas.map(({ linea: l, bonoId }) =>
              l.tipo === "producto"
                ? { tipo: "producto", productoId: l.productoId, cantidad: l.cantidad, descuentoCentesimas: l.descuentoCentesimas }
                : l.tipo === "bono"
                ? { tipo: "bono", tipoBonoId: l.tipoBonoId, cantidad: l.cantidad, descuentoCentesimas: l.descuentoCentesimas }
                : {
                    tipo: "tratamiento",
                    tratamientoId: l.tratamientoId,
                    cantidad: l.cantidad,
                    descuentoCentesimas: l.descuentoCentesimas,
                    ...(bonoId?.startsWith(NUEVO) ? { bonoNuevo: bonoId.slice(NUEVO.length) } : bonoId ? { bonoId } : {}),
                  },
            ),
            pagos,
            clienteId: clienta?.id,
            citaId: cita?.id,
            destinatario: conFactura ? destinatario : undefined,
          });
      if (r?.error) setError(r.error);
    });
  }

  const categorias = [...new Set(catalogo.map((c) => c.categoria))];
  const necesitaCaja = total > 0;
  const textoCobrar = cobrando
    ? "Cobrando…"
    : todoConBono
      ? "Descontar del bono"
      : quedaADeber > 0
        ? `Cobrar y dejar ${formatearEuros(quedaADeber)} a deber`
        : `Cobrar ${formatearEuros(total)}`;

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
        {productosVenta.length > 0 && (
          <div className="space-y-2" role="group" aria-label="Productos">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-tinta-suave">Productos</h3>
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
              {productosVenta.map((p) => {
                const vendible = p.precioCentimos !== null && p.ivaCentesimas !== null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!vendible}
                    onClick={() => anadirProducto(p.id)}
                    className="min-h-boton rounded-xl border-2 border-borde bg-superficie px-3 py-2 text-left hover:border-dorado disabled:opacity-50"
                  >
                    <div className="font-medium leading-tight">{p.nombre}</div>
                    <div className="text-sm text-tinta-suave">
                      {vendible ? formatearEuros(p.precioCentimos!) : "sin precio"} · {p.stock > 0 ? `quedan ${p.stock}` : "sin stock"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="space-y-2" role="group" aria-label="Bonos y tarjetas regalo">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-tinta-suave">Bonos y tarjetas regalo</h3>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
            {bonosVenta.map((b) => (
              <button
                key={b.id}
                type="button"
                disabled={b.ivaCentesimas === null}
                onClick={() => anadirBono(b.id)}
                className="min-h-boton rounded-xl border-2 border-dorado bg-crema px-3 py-2 text-left hover:border-dorado-oscuro disabled:opacity-50"
              >
                <div className="font-medium leading-tight">{b.nombre}</div>
                <div className="text-sm text-tinta-suave">{b.ivaCentesimas === null ? "sin IVA" : `${formatearEuros(b.precioCentimos)} · ${textoSesiones(b.sesiones)}`}</div>
              </button>
            ))}
            <button type="button" onClick={empezarTarjeta} className="min-h-boton rounded-xl border-2 border-dorado bg-crema px-3 py-2 text-left hover:border-dorado-oscuro">
              <div className="font-medium leading-tight">Tarjeta regalo</div>
              <div className="text-sm text-tinta-suave">El importe que quieras</div>
            </button>
          </div>
        </div>
      </section>

      {/* Cuenta y cobro */}
      <section aria-label="Cuenta" className="space-y-3">
        <Tarjeta className="space-y-3 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl">{tarjeta ? "Tarjeta regalo" : clienta ? clienta.nombre : "Cuenta"}</h2>
            {hayAlgo && (
              <Boton variante="discreto" onClick={vaciar} className="min-h-0 px-2 text-sm">
                Vaciar
              </Boton>
            )}
          </div>
          {!cita && <SelectorClienta clienta={clienta} onElegir={(c) => (limpiarPago(), setClienta(c))} />}
          {clienta && bonosClienta.length > 0 && (
            <ul aria-label="Bonos de la clienta" className="space-y-1 rounded-xl bg-crema px-3 py-2 text-sm">
              {bonosRestantes.filter((b) => !b.id.startsWith(NUEVO)).map((b) => (
                <li key={b.id}>
                  {b.nombre}: {textoQuedan(restantes(b))}
                </li>
              ))}
            </ul>
          )}
          {!hayAlgo && <p className="text-tinta-suave">Toca una cita o un tratamiento.</p>}

          {tarjeta && (
            <div className="space-y-2">
              <TecladoImporte
                centimos={tarjeta.importe}
                onCambio={(c) => (limpiarPago(), setTarjeta({ ...tarjeta, importe: c }))}
                etiqueta="Importe de la tarjeta regalo"
                atajos={[2000, 3000, 5000, 10000]}
              />
              <input
                aria-label="Para quién es"
                placeholder="Para (nombre de quien la recibe)"
                value={tarjeta.para}
                onChange={(e) => setTarjeta({ ...tarjeta, para: e.target.value })}
                className="block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3"
              />
              <input
                aria-label="De parte de"
                placeholder="De parte de (opcional)"
                value={tarjeta.deParte}
                onChange={(e) => setTarjeta({ ...tarjeta, deParte: e.target.value })}
                className="block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3"
              />
            </div>
          )}

          <ul className="divide-y divide-borde">
            {calculadas.map((c, i) => {
              const l = c.linea;
              const posible = l.tipo === "tratamiento" && !l.conBono && l.cantidad === 1 && clienta ? bonoPosible(l.tratamientoId) : undefined;
              return (
                <li key={i} className="space-y-1 py-2" aria-label={`Línea ${c.nombre}`}>
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{c.nombre}</span>
                    <span className="font-semibold">{l.tipo === "tratamiento" && l.conBono ? "Con bono" : formatearEuros(c.total)}</span>
                  </div>
                  {l.tipo === "tratamiento" && l.conBono ? (
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className={c.bonoId ? "text-correcto" : "text-urgente"}>
                        {c.bonoId ? `1 sesión de «${todosLosBonos.find((b) => b.id === c.bonoId)?.nombre}»${c.bonoId.startsWith(NUEVO) ? " (el que compra ahora)" : ""}` : "No quedan sesiones de bono para esto"}
                      </span>
                      <Boton variante="discreto" className="min-h-10 px-2" onClick={() => cambiarLinea(i, { conBono: false })}>
                        Cobrarlo
                      </Boton>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1">
                      <Boton variante="secundario" className="min-h-10 px-3" aria-label="Quitar uno" onClick={() => (l.cantidad > 1 ? cambiarLinea(i, { cantidad: l.cantidad - 1 }) : cambiarLinea(i, null))}>
                        −
                      </Boton>
                      <span className="w-8 text-center">{l.cantidad}</span>
                      <Boton variante="secundario" className="min-h-10 px-3" aria-label="Añadir uno" onClick={() => cambiarLinea(i, { cantidad: l.cantidad + 1 })}>
                        +
                      </Boton>
                      <select
                        aria-label={`Descuento de ${c.nombre}`}
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
                      {posible && (
                        <Boton variante="secundario" className="min-h-10 w-full px-3 text-sm" onClick={() => cambiarLinea(i, { conBono: true, descuentoCentesimas: 0 })}>
                          Usar bono ({textoQuedan(restantes(posible))})
                        </Boton>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
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
        {vendeBonos && !clienta && <Aviso prioridad="importante">Elige la clienta: el bono va a su nombre.</Aviso>}
        {!cajaAbierta && hayAlgo && necesitaCaja && <Aviso prioridad="importante">La caja está cerrada: ábrela en Caja para cobrar.</Aviso>}

        {hayAlgo && falta > 0 && (
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Forma de pago">
            {METODOS_CAJA.map((m) => (
              <Boton key={m} variante={metodo === m ? "principal" : "secundario"} onClick={() => elegirMetodo(m)} className="h-16">
                {NOMBRE_METODO[m]}
              </Boton>
            ))}
            {!tarjeta && (
              <Boton variante={metodo === "tarjeta_regalo" ? "principal" : "secundario"} onClick={() => elegirMetodo("tarjeta_regalo")} className="h-16">
                {NOMBRE_METODO.tarjeta_regalo}
              </Boton>
            )}
          </div>
        )}

        {metodo === "tarjeta_regalo" && <PagoConTarjeta falta={falta} regalo={regalo} onSaldo={(t) => (setRegalo(t), setImporte(Math.min(t.saldo, falta)))} />}

        {hayAlgo && !tarjeta && total > 0 && (
          <label className="flex min-h-toque items-center gap-3">
            <input type="checkbox" checked={conFactura} onChange={(e) => setConFactura(e.target.checked)} className="size-6 accent-dorado-oscuro" />
            Quiere factura con sus datos
          </label>
        )}
        {conFactura && !tarjeta && (
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

        {metodo === "efectivo" && (
          <div className="flex justify-between rounded-xl bg-crema px-4 py-2 text-xl">
            <span>Cambio</span>
            <strong data-testid="cambio">{formatearEuros(cambio(importe, entregado))}</strong>
          </div>
        )}
        {(metodo === "tarjeta" || metodo === "bizum") && <p className="text-tinta-suave">Cobra {formatearEuros(importe)} en el datáfono y pulsa Cobrar.</p>}
        {hayAlgo && (
          <div className="space-y-2">
            <Boton
              grande
              className="w-full"
              disabled={
                cobrando ||
                sinSesion ||
                (necesitaCaja && !cajaAbierta) ||
                (total > 0 && pagosFinales.length === 0) ||
                (tarjeta !== null && (total === 0 || quedaADeber > 0)) ||
                (metodo === "efectivo" && entregado < importe)
              }
              onClick={() => enviar(pagosFinales)}
            >
              {textoCobrar}
            </Boton>
            {metodo && pagoActual && importe < falta && (
              <Boton variante="secundario" className="w-full" onClick={() => (setPagosHechos([...pagosHechos, pagoActual]), reiniciarPago(falta - importe))}>
                Pagar {formatearEuros(importe)} así y el resto de otra forma
              </Boton>
            )}
            {(metodo === "tarjeta" || metodo === "bizum") && (
              <details>
                <summary className="cursor-pointer text-sm text-tinta-suave">Cobrar solo una parte</summary>
                <div className="pt-2">
                  <TecladoImporte centimos={importe} onCambio={(c) => setImporte(Math.min(c, falta))} etiqueta="Importe de este pago" />
                </div>
              </details>
            )}
            {pagosFinales.length === 0 && total > 0 && !tarjeta && (
              <Boton variante="discreto" className="w-full" disabled={cobrando || !cajaAbierta} onClick={() => enviar([])}>
                Dejarlo todo a deber
              </Boton>
            )}
          </div>
        )}
        {metodo === "efectivo" && (
          <TecladoImporte
            centimos={entregado}
            onCambio={setEntregado}
            etiqueta="Entregado"
            atajos={[importe, 1000, 2000, 5000].filter((v, i, a) => v >= importe && a.indexOf(v) === i)}
          />
        )}
      </section>
    </div>
  );
}

/** Buscar y elegir la clienta (para vender o usar bonos, o que la venta quede en su ficha). */
function SelectorClienta({ clienta, onElegir }: { clienta: Clienta | null; onElegir: (c: Clienta | null) => void }) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [resultados, setResultados] = useState<{ id: string; nombre: string; telefono: string | null }[]>([]);
  useEffect(() => {
    if (!abierto || texto.trim().length < 2) {
      setResultados([]);
      return;
    }
    let vigente = true;
    const t = setTimeout(() => buscarClienta(texto).then((r) => vigente && setResultados(r)), 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [texto, abierto]);

  if (clienta) {
    return (
      <Boton variante="discreto" className="min-h-0 px-0 text-sm" onClick={() => onElegir(null)}>
        Cambiar de clienta
      </Boton>
    );
  }
  if (!abierto) {
    return (
      <Boton variante="secundario" className="w-full" onClick={() => setAbierto(true)}>
        Elegir clienta
      </Boton>
    );
  }
  return (
    <div className="space-y-2">
      <input
        autoFocus
        aria-label="Buscar clienta"
        placeholder="Nombre o teléfono"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        className="block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3"
      />
      <ul aria-label="Clientas encontradas" className="space-y-1">
        {resultados.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => (onElegir({ id: c.id, nombre: c.nombre }), setAbierto(false), setTexto(""))}
              className="block w-full rounded-xl border-2 border-borde bg-superficie px-3 py-2 text-left hover:border-dorado"
            >
              {c.nombre}
              {c.telefono && <span className="text-sm text-tinta-suave"> · {c.telefono.replace(/^\+34/, "")}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pagar con una tarjeta regalo: se escribe su código y se ve su saldo. */
function PagoConTarjeta({ falta, regalo, onSaldo }: { falta: number; regalo: { codigo: string; saldo: number } | null; onSaldo: (t: { codigo: string; saldo: number }) => void }) {
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [buscando, iniciar] = useTransition();
  if (regalo) {
    return (
      <Aviso prioridad="correcto">
        Tarjeta {regalo.codigo}: saldo {formatearEuros(regalo.saldo)}.{" "}
        {regalo.saldo < falta ? `Paga ${formatearEuros(regalo.saldo)} con ella y el resto de otra forma.` : "Cubre todo."}
      </Aviso>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          aria-label="Código de la tarjeta regalo"
          placeholder="AM-XXXX-XXXX"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          className="block min-h-toque w-full rounded-xl border-2 border-borde bg-superficie px-3 uppercase"
        />
        <Boton
          variante="secundario"
          disabled={buscando || codigo.trim().length < 8}
          onClick={() =>
            iniciar(async () => {
              const r = await consultarTarjeta(codigo);
              if ("error" in r) setError(r.error);
              else (setError(null), onSaldo(r));
            })
          }
        >
          Comprobar
        </Boton>
      </div>
      {error && <Aviso prioridad="urgente">{error}</Aviso>}
    </div>
  );
}
