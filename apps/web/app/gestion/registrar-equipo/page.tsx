import { Tarjeta } from "@adela/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Marca } from "@/components/Marca";
import { dispositivoActual, obtenerSesion } from "@/server/auth";
import { Formulario } from "./Formulario";

export default async function RegistrarEquipo() {
  if (await obtenerSesion()) redirect("/gestion");
  const yaRegistrado = Boolean(await dispositivoActual());
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <Tarjeta className="w-full max-w-md space-y-8 p-10">
        <div className="space-y-6 text-center">
          <div className="inline-block">
            <Marca grande />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl">{yaRegistrado ? "Entrada de administración" : "Registrar este equipo"}</h1>
            <p className="text-tinta-suave">
              {yaRegistrado
                ? "Este equipo ya está registrado. Lo normal es entrar con PIN."
                : "Solo se hace una vez por equipo. Después, el personal entra con su PIN, sin contraseñas."}
            </p>
          </div>
        </div>
        <Formulario yaRegistrado={yaRegistrado} />
        {yaRegistrado && (
          <p className="text-center">
            <Link href="/gestion/pin" className="inline-flex min-h-toque items-center text-dorado-oscuro underline">
              Entrar con PIN
            </Link>
          </p>
        )}
      </Tarjeta>
    </main>
  );
}
