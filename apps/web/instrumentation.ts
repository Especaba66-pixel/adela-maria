/**
 * Al arrancar el servidor del TPV: si están configuradas las reservas por internet, se sincronizan cada minuto
 * (se traen las reservas nuevas y se manda la agenda). Si no hay internet, se reintenta al minuto siguiente.
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.RESERVAS_URL || !process.env.RESERVAS_CLAVE) return;
  const puerto = process.env.PORT ?? "3000";
  const lanzar = () =>
    fetch(`http://127.0.0.1:${puerto}/api/sincronizar`, { method: "POST", headers: { Authorization: `Bearer ${process.env.RESERVAS_CLAVE}` } }).catch(() => {});
  setTimeout(lanzar, 15_000);
  setInterval(lanzar, Number(process.env.RESERVAS_CADA_SEGUNDOS ?? 60) * 1000);
}
