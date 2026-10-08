import { Tarjeta } from "@adela/ui";
import { requerirSesion } from "@/server/auth";
import { FormularioClienta } from "../FormularioClienta";

export default async function NuevaClienta() {
  await requerirSesion("clientas.gestionar");
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-4xl">Nueva clienta</h1>
      <Tarjeta>
        <FormularioClienta />
      </Tarjeta>
    </div>
  );
}
