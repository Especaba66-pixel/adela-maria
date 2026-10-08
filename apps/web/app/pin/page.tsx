import { usuarios } from "@adela/db";
import { Aviso } from "@adela/ui";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Marca } from "@/components/Marca";
import { dispositivoActual, obtenerSesion } from "@/server/auth";
import { db } from "@/server/db";
import { TecladoPin } from "./TecladoPin";

export default async function Pin() {
  if (await obtenerSesion()) redirect("/");
  if (!(await dispositivoActual())) redirect("/entrar");
  const personas = await db()
    .select({ id: usuarios.id, nombre: usuarios.nombre })
    .from(usuarios)
    .where(and(eq(usuarios.activo, true), isNotNull(usuarios.hashPin)))
    .orderBy(asc(usuarios.nombre));

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 p-6">
      <Marca grande />
      <div className="w-full max-w-2xl">
        {personas.length > 0 ? (
          <TecladoPin personas={personas} />
        ) : (
          <Aviso prioridad="pendiente">Nadie tiene PIN todavía. Entra con contraseña y asígnalo en Configuración.</Aviso>
        )}
      </div>
      <Link href="/entrar" className="inline-flex min-h-toque items-center text-dorado-oscuro underline">
        Entrar con contraseña
      </Link>
    </main>
  );
}
