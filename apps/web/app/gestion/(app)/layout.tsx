import { NOMBRE_ROL } from "@adela/dominio";
import { Boton } from "@adela/ui";
import type { ReactNode } from "react";
import { Marca } from "@/components/Marca";
import { Navegacion } from "@/components/Navegacion";
import { VigilanteInactividad } from "@/components/VigilanteInactividad";
import { minutosInactividad, requerirSesion } from "@/server/auth";
import { cambiarDePersona } from "./acciones";

export default async function LayoutApp({ children }: { children: ReactNode }) {
  const { usuario } = await requerirSesion();
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 flex h-dvh w-64 shrink-0 flex-col gap-8 border-r border-borde bg-superficie p-4">
        <div className="px-2 pt-2">
          <Marca />
        </div>
        <Navegacion />
        <div className="mt-auto space-y-2 border-t border-borde px-2 pt-4">
          <div>
            <div className="font-semibold" data-testid="usuario-actual">{usuario.nombre}</div>
            <div className="text-sm text-tinta-suave">{NOMBRE_ROL[usuario.rol]}</div>
          </div>
          <form action={cambiarDePersona}>
            <Boton variante="secundario" type="submit" className="w-full whitespace-nowrap px-2">
              Cambiar de persona
            </Boton>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-8">{children}</main>
      <VigilanteInactividad minutos={minutosInactividad()} />
    </div>
  );
}
