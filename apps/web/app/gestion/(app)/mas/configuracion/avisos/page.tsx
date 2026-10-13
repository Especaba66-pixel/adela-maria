import { Tarjeta } from "@adela/ui";
import { requerirSesion } from "@/server/auth";
import { ajustesAvisos } from "@/server/avisos";
import { FormularioAvisos } from "./Formulario";

export default async function AjustesAvisos() {
  await requerirSesion("configuracion.gestionar");
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-4xl">Avisos automáticos</h1>
      <p className="text-tinta-suave">
        Qué aparece cada día en «Qué hay que hacer hoy». Cuando toca escribir a una clienta, el aviso trae el WhatsApp ya escrito; los textos se
        cambian en Más → WhatsApp. Siempre se respeta el permiso que dio cada clienta.
      </p>
      <Tarjeta>
        <FormularioAvisos ajustes={await ajustesAvisos()} />
      </Tarjeta>
    </div>
  );
}
