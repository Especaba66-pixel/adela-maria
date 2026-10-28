import { Tarjeta } from "@adela/ui";
import { requerirSesion } from "@/server/auth";
import { configImpresora } from "@/server/impresora";
import { FormularioImpresora } from "./Formulario";

export default async function Impresora() {
  await requerirSesion("configuracion.gestionar");
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-4xl">Impresora y cajón</h1>
      <p className="text-tinta-suave">
        El cajón se abre solo al cobrar en efectivo. Puede ir enchufado a la impresora o directamente al TPV por USB (puerto
        COM). Si la impresora o el cajón fallan, el cobro se guarda igual y el ticket se puede reimprimir o enviar por
        WhatsApp.
      </p>
      <Tarjeta>
        <FormularioImpresora config={await configImpresora()} />
      </Tarjeta>
    </div>
  );
}
