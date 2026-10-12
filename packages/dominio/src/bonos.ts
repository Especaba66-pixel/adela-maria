/**
 * Bonos y tarjetas regalo.
 *
 * - Un bono es un paquete de sesiones de unos tratamientos concretos (por ejemplo, 6 faciales). Se factura al venderlo
 *   y cada sesión que se usa se descuenta sin volver a cobrar. Los del centro no caducan (caducidad opcional).
 * - Una tarjeta regalo es un saldo en euros con un código. No se factura al venderla: se factura lo que se paga con
 *   ella, cuando se usa (a confirmar con la gestoría).
 */
import { formatearEuros } from "./dinero";

// ── Bonos ────────────────────────────────────────────────────────────────────

export type EstadoBono = "activo" | "agotado" | "caducado" | "anulado";

export interface Bono {
  id: string;
  sesiones: number;
  /** Sesiones gastadas (usos menos correcciones). */
  usadas: number;
  /** Fecha (AAAA-MM-DD) hasta la que vale, incluida; vacía si no caduca. */
  caducaEn: string | null;
  anulado: boolean;
  /** Tratamientos para los que vale. */
  tratamientoIds: string[];
  /** Para elegir el más antiguo cuando hay varios. */
  compradoEn: string;
}

export const restantes = (b: Pick<Bono, "sesiones" | "usadas">) => b.sesiones - b.usadas;

export function estadoBono(b: Pick<Bono, "sesiones" | "usadas" | "caducaEn" | "anulado">, hoy: string): EstadoBono {
  if (b.anulado) return "anulado";
  if (restantes(b) <= 0) return "agotado";
  if (b.caducaEn !== null && b.caducaEn < hoy) return "caducado";
  return "activo";
}

export const NOMBRE_ESTADO_BONO: Record<EstadoBono, string> = {
  activo: "Activo",
  agotado: "Agotado",
  caducado: "Caducado",
  anulado: "Anulado",
};

/** Fecha de caducidad a partir del día de compra; null si el tipo de bono no caduca. */
export function caducidad(fechaCompra: string, validezDias: number | null): string | null {
  if (validezDias === null) return null;
  const d = new Date(`${fechaCompra}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + validezDias);
  return d.toISOString().slice(0, 10);
}

/**
 * Reparte bonos entre los tratamientos de una cuenta: a cada tratamiento le toca el bono activo que lo cubra y
 * caduque antes (o, si no caducan, el más antiguo), sin gastar más sesiones de las que quedan.
 * Devuelve, en el mismo orden, el id del bono de cada tratamiento o null si no hay ninguno.
 */
export function asignarBonos(tratamientoIds: string[], bonos: Bono[], hoy: string): (string | null)[] {
  const quedan = new Map(bonos.map((b) => [b.id, estadoBono(b, hoy) === "activo" ? restantes(b) : 0]));
  const orden = [...bonos].sort(
    (a, b) => (a.caducaEn ?? "9999").localeCompare(b.caducaEn ?? "9999") || a.compradoEn.localeCompare(b.compradoEn),
  );
  return tratamientoIds.map((t) => {
    const b = orden.find((x) => x.tratamientoIds.includes(t) && (quedan.get(x.id) ?? 0) > 0);
    if (!b) return null;
    quedan.set(b.id, quedan.get(b.id)! - 1);
    return b.id;
  });
}

export const textoSesiones = (n: number) => (n === 1 ? "1 sesión" : `${n} sesiones`);
/** «queda 1 sesión», «quedan 3 sesiones». */
export const textoQuedan = (n: number) => `${n === 1 ? "queda" : "quedan"} ${textoSesiones(n)}`;

/** Aviso cuando a un bono le queda poco (para ofrecer renovarlo). */
export const BONO_CASI_AGOTADO = 1;

// ── Tarjetas regalo ──────────────────────────────────────────────────────────

/** Sin 0/O, 1/I/L ni U/V, que se confunden al dictarlos o leerlos. */
const ALFABETO = "23456789ABCDEFGHJKMNPQRSTWXYZ";
const PREFIJO = "AM";

/** Código de tarjeta regalo «AM-XXXX-XXXX». `aleatorio` da bytes aleatorios (crypto.getRandomValues). */
export function generarCodigoTarjeta(aleatorio: (n: number) => Uint8Array): string {
  const letras: string[] = [];
  // Se descartan los bytes que darían más peso a unas letras que a otras.
  const limite = 256 - (256 % ALFABETO.length);
  while (letras.length < 8) {
    for (const b of aleatorio(16)) {
      if (b < limite && letras.length < 8) letras.push(ALFABETO[b % ALFABETO.length]!);
    }
  }
  return `${PREFIJO}-${letras.slice(0, 4).join("")}-${letras.slice(4).join("")}`;
}

/** Acepta el código como lo escriba la persona («am xk7p 3rtw», «AMXK7P3RTW»…). Null si no tiene forma de código. */
export function normalizarCodigo(texto: string): string | null {
  let t = texto.toUpperCase().replace(/[\s\-.]/g, "");
  if (t.startsWith(PREFIJO)) t = t.slice(PREFIJO.length);
  if (t.length !== 8 || [...t].some((c) => !ALFABETO.includes(c))) return null;
  return `${PREFIJO}-${t.slice(0, 4)}-${t.slice(4)}`;
}

export const TARJETA_MINIMO = 500;
export const TARJETA_MAXIMO = 100_000;

export function validarImporteTarjeta(centimos: number): string | null {
  if (!Number.isInteger(centimos) || centimos < TARJETA_MINIMO || centimos > TARJETA_MAXIMO) {
    return `El importe de una tarjeta regalo va de ${formatearEuros(TARJETA_MINIMO)} a ${formatearEuros(TARJETA_MAXIMO)}.`;
  }
  return null;
}

export const saldoTarjeta = (movimientos: { importe: number }[]) => movimientos.reduce((s, m) => s + m.importe, 0);

/** Las tarjetas regalo no caducan (como los bonos); se anulan solo si se devuelven sin haberlas usado. */
export type EstadoTarjeta = "activa" | "gastada" | "anulada";

export function estadoTarjeta(t: { saldo: number; anulada: boolean }): EstadoTarjeta {
  if (t.anulada) return "anulada";
  return t.saldo > 0 ? "activa" : "gastada";
}

export const NOMBRE_ESTADO_TARJETA: Record<EstadoTarjeta, string> = { activa: "Activa", gastada: "Gastada", anulada: "Anulada" };
