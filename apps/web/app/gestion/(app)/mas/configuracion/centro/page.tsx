import { centro } from "@adela/db";
import { formatearTelefono } from "@adela/dominio";
import { Tarjeta } from "@adela/ui";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { Formulario } from "./Formulario";

export default async function DatosCentro() {
  await requerirSesion("configuracion.gestionar");
  const [c] = await db().select().from(centro).limit(1);
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-4xl">Datos del centro</h1>
      <p className="text-tinta-suave">Aparecen al pie de la web de clientas. Si los dejas vacíos, no se muestran.</p>
      <Tarjeta>
        <Formulario telefono={c?.telefono ? formatearTelefono(c.telefono) : ""} direccion={c?.direccion ?? ""} />
      </Tarjeta>
    </div>
  );
}
