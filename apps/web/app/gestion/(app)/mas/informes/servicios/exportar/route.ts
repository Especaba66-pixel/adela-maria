import { aCsv, euros, esFecha, hoyEnMadrid, nombreMes, periodoDeMes } from "@adela/dominio";
import { requerirSesion } from "@/server/auth";
import { serviciosDelPeriodo } from "@/server/informes";

/** Lo cobrado, línea a línea, de un día o de un mes entero (con el total de cada día), en un archivo que abre Excel. */
export async function GET(req: Request) {
  await requerirSesion("informes.ver");
  const q = new URL(req.url).searchParams;
  const dia = q.get("dia") ?? "";
  const mesPedido = q.get("mes") ?? "";
  const esDia = esFecha(dia);
  const mes = periodoDeMes(mesPedido) ? mesPedido : hoyEnMadrid(new Date()).slice(0, 7);
  const periodo = esDia ? { desde: dia, hasta: dia } : periodoDeMes(mes)!;
  const lineas = await serviciosDelPeriodo(periodo.desde, periodo.hasta);
  const titulo = esDia ? `Servicios del ${dia}` : `Servicios de ${nombreMes(mes)}`;
  const suma = (ls: typeof lineas) => [euros(ls.reduce((s, l) => s + l.base, 0)), euros(ls.reduce((s, l) => s + l.iva, 0)), euros(ls.reduce((s, l) => s + l.total, 0))];
  const filas: (string | number | null)[][] = [
    [`Adela María · Belleza holística · ${titulo}`],
    ["Importes en euros. Las devoluciones salen en negativo."],
    [],
    ["Fecha", "Hora", "Factura", "Clienta", "Tipo", "Concepto", "Cantidad", "Base", "IVA", "Total", "Forma de pago"],
  ];
  const dias = [...new Set(lineas.map((l) => l.fecha))];
  for (const d of dias) {
    const delDia = lineas.filter((l) => l.fecha === d);
    for (const l of delDia) {
      filas.push([l.fecha, l.hora, l.factura ?? "", l.clienta ?? "", l.tipo, l.descripcion, String(l.cantidad), euros(l.base), euros(l.iva), euros(l.total), l.pago]);
    }
    if (!esDia) filas.push([`Total ${d}`, "", "", "", "", "", "", ...suma(delDia), ""], []);
  }
  if (lineas.length === 0) filas.push(["Sin ventas en este periodo."]);
  else filas.push([], ["TOTAL", "", "", "", "", "", "", ...suma(lineas), ""]);
  return new Response(aCsv(filas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="adela-maria-servicios-${esDia ? dia : mes}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
