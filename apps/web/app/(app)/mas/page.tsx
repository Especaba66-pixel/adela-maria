import { puede } from "@adela/dominio";
import { Tarjeta } from "@adela/ui";
import Link from "next/link";
import { MAS } from "@/components/menu";
import { requerirSesion } from "@/server/auth";

export default async function Mas() {
  const { usuario } = await requerirSesion();
  const entradas = MAS.filter((e) => !e.soloAdmin || puede(usuario.rol, "configuracion.gestionar"));
  return (
    <div className="space-y-6">
      <h1 className="text-4xl">Más</h1>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {entradas.map((e) => (
          <Link key={e.href} href={e.href} className="rounded-tarjeta">
            <Tarjeta className="flex h-full min-h-28 items-center gap-4 transition-colors hover:border-dorado">
              <span aria-hidden className="text-3xl text-dorado">
                {e.icono}
              </span>
              <div>
                <div className="text-xl font-semibold">{e.nombre}</div>
                {e.fase > 0 && <div className="text-sm text-tinta-suave">Fase {e.fase}</div>}
              </div>
            </Tarjeta>
          </Link>
        ))}
      </div>
    </div>
  );
}
