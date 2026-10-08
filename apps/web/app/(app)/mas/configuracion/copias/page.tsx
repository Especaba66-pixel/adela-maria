import { copiasSeguridad } from "@adela/db";
import { Aviso, Tarjeta } from "@adela/ui";
import { desc } from "drizzle-orm";
import { fechaHora } from "@/lib/fechas";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";

function tamano(bytes: number | null): string {
  if (bytes === null) return "";
  return bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export default async function Copias() {
  await requerirSesion("configuracion.gestionar");
  const filas = await db().select().from(copiasSeguridad).orderBy(desc(copiasSeguridad.id)).limit(60);
  return (
    <div className="space-y-6">
      <h1 className="text-4xl">Copias de seguridad</h1>
      <p className="text-tinta-suave">
        Copia automática diaria, conservada 30 días. Si una copia falla, aparece un aviso rojo en el inicio.
      </p>
      {filas.length === 0 && <Aviso prioridad="urgente">Todavía no se ha registrado ninguna copia.</Aviso>}
      {filas.length > 0 && (
        <Tarjeta className="divide-y divide-borde p-0">
          {filas.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-4 px-6 py-4">
              <div>
                <div className="font-medium">
                  {c.tipo === "copia" ? "Copia" : "Prueba de restauración"} · {c.correcta ? "correcta" : "FALLIDA"}
                </div>
                <div className="text-sm text-tinta-suave">
                  {fechaHora(c.cuando)} {c.archivo && `· ${c.archivo}`} {tamano(c.bytes)}
                  {c.detalle && ` · ${c.detalle}`}
                </div>
              </div>
              <span aria-hidden className={`text-2xl ${c.correcta ? "text-correcto" : "text-urgente"}`}>
                {c.correcta ? "✓" : "✕"}
              </span>
            </div>
          ))}
        </Tarjeta>
      )}
    </div>
  );
}
