import { exportarClienta } from "@/server/clientas";

/** Copia de todos los datos de la clienta (RGPD), como archivo JSON. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const datos = await exportarClienta(id);
  if (!datos) return new Response("No existe", { status: 404 });
  return new Response(JSON.stringify(datos, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="datos-clienta-${id.slice(0, 8)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
