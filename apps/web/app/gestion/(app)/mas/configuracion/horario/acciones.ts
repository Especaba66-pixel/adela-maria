"use server";
import { textoAHora, type Tramo } from "@adela/dominio";
import { revalidatePath } from "next/cache";
import { guardarHorario, type Resultado } from "@/server/equipo";

export async function guardar(_: Resultado | null, f: FormData): Promise<Resultado> {
  const dias: Record<number, Tramo[]> = {};
  for (let d = 1; d <= 7; d++) {
    dias[d] = [];
    for (const tramo of [1, 2]) {
      const a = String(f.get(`d${d}t${tramo}i`) ?? "");
      const b = String(f.get(`d${d}t${tramo}f`) ?? "");
      if (!a && !b) continue;
      const inicio = textoAHora(a);
      const fin = textoAHora(b);
      if (inicio === null || fin === null) return { ok: false, error: "Completa las dos horas de cada tramo (o déjalas vacías)." };
      dias[d]!.push({ inicio, fin });
    }
  }
  const r = await guardarHorario(String(f.get("profesional")), dias);
  revalidatePath("/gestion", "layout");
  revalidatePath("/reservar");
  return r;
}
