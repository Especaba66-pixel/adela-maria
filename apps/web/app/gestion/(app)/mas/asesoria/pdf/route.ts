import { hoyEnMadrid, periodoDeMes, type Permiso } from "@adela/dominio";
import { DOCS_ASESORIA, pdfAsesoria, type DocAsesoria } from "@/server/asesoria";
import { requerirSesion } from "@/server/auth";

const PERMISO: Record<DocAsesoria, Permiso> = { servicios: "informes.ver", stock: "stock.gestionar", trimestre: "gastos.gestionar" };

/** Un papel del mes para la asesoría, en PDF: ?doc=servicios|stock|trimestre&mes=AAAA-MM. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const doc = (DOCS_ASESORIA as string[]).includes(q.get("doc") ?? "") ? (q.get("doc") as DocAsesoria) : "servicios";
  await requerirSesion(PERMISO[doc]);
  const pedido = q.get("mes") ?? "";
  const mes = periodoDeMes(pedido) ? pedido : hoyEnMadrid(new Date()).slice(0, 7);
  const { bytes, archivo } = await pdfAsesoria(doc, mes);
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${archivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
