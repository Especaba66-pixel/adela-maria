/**
 * Fichas avanzadas: consentimientos informados firmados en el TPV y fotos de antes y después.
 * Los textos de partida son una base: el centro debe revisarlos con su asesoría antes de usarlos.
 */

export interface ModeloConsentimiento {
  nombre: string;
  /** Tratamientos (por nombre) que lo necesitan. */
  tratamientos: string[];
  texto: string;
}

export const VARIABLES_CONSENTIMIENTO = ["nombre", "fecha", "centro"] as const;

const PIE =
  "He leído y entendido esta información, he podido hacer preguntas y se me han respondido. Sé que puedo retirar este consentimiento en cualquier momento.\n\n" +
  "Mis datos se tratan por {centro} para prestar el servicio y cumplir sus obligaciones legales, y se conservan el tiempo que exige la ley. Puedo ejercer mis derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad en el propio centro.";

export const MODELOS_CONSENTIMIENTO_INICIALES: ModeloConsentimiento[] = [
  {
    nombre: "Micropigmentación (microblading)",
    tratamientos: ["Microblading"],
    texto:
      "Yo, {nombre}, solicito a {centro} el tratamiento de micropigmentación de cejas (microblading) el {fecha}.\n\n" +
      "Se me ha explicado en qué consiste: se introduce pigmento en la capa superficial de la piel con una herramienta de microagujas estériles y de un solo uso. El resultado es semipermanente y se aclara con el tiempo; suele necesitar un retoque entre 4 y 8 semanas después.\n\n" +
      "Se me han explicado los posibles efectos: enrojecimiento, inflamación y pequeñas costras los primeros días; diferencias de color o de retención del pigmento; y, raramente, infección o reacción alérgica.\n\n" +
      "Declaro que NO estoy embarazada ni en periodo de lactancia, ni tengo diabetes no controlada, problemas de cicatrización o de coagulación, alergia conocida a pigmentos o anestésicos tópicos, infección o lesión en la zona, ni he usado isotretinoína (Roacután) en los últimos 6 meses; y que he informado de cualquier medicación o enfermedad.\n\n" +
      "Me comprometo a seguir los cuidados posteriores que se me han dado.\n\n" +
      PIE,
  },
  {
    nombre: "Tratamientos faciales y corporales",
    tratamientos: [],
    texto:
      "Yo, {nombre}, solicito a {centro} el tratamiento estético que se me ha explicado, el {fecha}.\n\n" +
      "Se me ha informado de en qué consiste, de sus resultados esperables (que varían de una persona a otra) y de sus posibles efectos: enrojecimiento, sensibilidad o irritación pasajeros y, raramente, reacción alérgica a algún producto.\n\n" +
      "Declaro que he informado de alergias, embarazo o lactancia, medicación, enfermedades de la piel y tratamientos recientes (peelings, láser, retinoides), y que avisaré si algo cambia.\n\n" +
      PIE,
  },
  {
    nombre: "Uso de fotografías",
    tratamientos: [],
    texto:
      "Yo, {nombre}, autorizo a {centro} a hacer fotografías de la zona tratada antes y después del tratamiento para mi ficha y el seguimiento de los resultados.\n\n" +
      "Además, AUTORIZO / NO AUTORIZO (táchese lo que no proceda o indíquelo a la profesional) que se publiquen, sin mostrar mi cara ni mi nombre, en la web y redes sociales del centro.\n\n" +
      "Puedo retirar esta autorización cuando quiera; desde entonces no se publicarán más y se retirarán las publicadas que dependan del centro.\n\n" +
      PIE,
  },
];

/** Rellena las variables de un modelo de consentimiento. */
export function rellenarConsentimiento(texto: string, v: { nombre: string; fecha: string; centro: string }): string {
  return texto.replace(/\{(nombre|fecha|centro)\}/g, (_, k: "nombre" | "fecha" | "centro") => v[k]);
}

export function validarModeloConsentimiento(nombre: string, texto: string): string | null {
  if (nombre.trim().length < 3 || nombre.trim().length > 80) return "Escribe el nombre (de 3 a 80 letras).";
  if (texto.trim().length < 50) return "Escribe el texto del consentimiento.";
  if (texto.length > 20_000) return "El texto es demasiado largo.";
  const mala = [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).find((v) => !(VARIABLES_CONSENTIMIENTO as readonly string[]).includes(v));
  if (mala) return `No existe {${mala}}. Puedes usar {nombre}, {fecha} y {centro}.`;
  return null;
}

/** Una firma válida es una imagen PNG en formato data: que no está en blanco (lo comprueba el que dibuja) ni es enorme. */
export function validarFirma(firma: string): string | null {
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(firma)) return "Falta la firma.";
  if (firma.length < 1500) return "Falta la firma.";
  if (firma.length > 400_000) return "La firma es demasiado grande. Bórrala y firma otra vez.";
  return null;
}

/** Fotos: tipos admitidos y tamaño máximo (la app las reduce antes de subirlas). */
export const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_FOTO_BYTES = 3 * 1024 * 1024;
export const NOMBRE_TIPO_FOTO = { antes: "Antes", despues: "Después", otra: "Foto" } as const;
