import { Tarjeta } from "@adela/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Marca } from "@/components/Marca";
import { dispositivoActual, obtenerSesion } from "@/server/auth";
import { Formulario } from "./Formulario";

export default async function Entrar() {
  if (await obtenerSesion()) redirect("/");
  const esTpv = Boolean(await dispositivoActual());
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <Tarjeta className="w-full max-w-md space-y-8 p-10">
        <div className="text-center">
          <div className="inline-block">
            <Marca grande />
          </div>
        </div>
        <Formulario esTpv={esTpv} />
        {esTpv && (
          <p className="text-center">
            <Link href="/pin" className="inline-flex min-h-toque items-center text-dorado-oscuro underline">
              Entrar con PIN
            </Link>
          </p>
        )}
      </Tarjeta>
    </main>
  );
}
