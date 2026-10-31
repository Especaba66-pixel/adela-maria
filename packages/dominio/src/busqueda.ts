/**
 * Búsqueda por texto en el TPV: sin distinguir mayúsculas ni tildes, y cada palabra escrita tiene que aparecer
 * (en cualquier orden y al principio o dentro de una palabra). «diseno ceja» encuentra «Diseño y depilación de cejas».
 */
export function textoBuscable(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function coincide(texto: string, consulta: string): boolean {
  const palabras = textoBuscable(consulta).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return false;
  const t = textoBuscable(texto);
  return palabras.every((p) => t.includes(p));
}

/**
 * Los que coinciden, primero los que empiezan por lo escrito y después por orden alfabético; como mucho `max`.
 */
export function buscar<T>(items: T[], consulta: string, texto: (item: T) => string, max = 8): T[] {
  const primera = textoBuscable(consulta).trim();
  return items
    .filter((i) => coincide(texto(i), consulta))
    .map((i) => ({ i, empieza: textoBuscable(texto(i)).startsWith(primera), t: textoBuscable(texto(i)) }))
    .sort((a, b) => Number(b.empieza) - Number(a.empieza) || a.t.localeCompare(b.t, "es"))
    .slice(0, max)
    .map((x) => x.i);
}
