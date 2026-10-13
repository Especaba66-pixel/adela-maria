/**
 * Datos de partida para la base de datos de Cloudflare: las tarifas, el horario y las cabinas del centro, para que
 * se pueda reservar desde el primer día aunque el TPV aún no se haya sincronizado. Cuando el TPV sincroniza, los
 * sustituye por los suyos (y esta semilla deja de aplicarse).
 * Uso: tsx scripts/semilla.ts > semilla.sql
 */
import { CABINAS, CATEGORIAS, HORARIO_INICIAL } from "@adela/db/datos";

const texto = (t: string) => `'${t.replaceAll("'", "''")}'`;
const nuncaSincronizado = "(SELECT valor FROM ajustes WHERE clave = 'sincronizado') = ''";

const lineas = [`DELETE FROM horario WHERE ${nuncaSincronizado};`];
let orden = 0;
for (const c of CATEGORIAS) {
  for (const t of c.tratamientos) {
    orden++;
    if (!t.duracionMinutos) continue;
    // El id lleva el nombre: el TPV reconoce el tratamiento por su nombre hasta que sincroniza con sus propios ids.
    lineas.push(
      `INSERT OR IGNORE INTO servicios (id, nombre, categoria, duracion, exclusivo, precio, orden) SELECT ${texto(`tarifa:${t.nombre}`)}, ${texto(t.nombre)}, ${texto(c.nombre)}, ${t.duracionMinutos}, 0, ${t.precioCentimos ?? "NULL"}, ${orden} WHERE ${nuncaSincronizado};`,
    );
  }
}
for (const h of HORARIO_INICIAL) {
  lineas.push(`INSERT INTO horario (dia_semana, inicio, fin) SELECT ${h.diaSemana}, ${h.inicioMin}, ${h.finMin} WHERE ${nuncaSincronizado};`);
}
lineas.push(`UPDATE ajustes SET valor = '${CABINAS}' WHERE clave = 'cabinas' AND ${nuncaSincronizado};`);
console.log(lineas.join("\n"));
