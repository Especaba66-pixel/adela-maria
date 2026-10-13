import { VARIABLES_PLANTILLA, rellenarPlantilla } from "@adela/dominio";
import { Tarjeta } from "@adela/ui";
import { requerirSesion } from "@/server/auth";
import { plantillasGuardadas } from "@/server/avisos";
import { FormularioPlantilla } from "./Formulario";

const EJEMPLO = { nombre: "Marta", centro: "Adela María · Belleza holística", fecha: "jueves, 15 de octubre", hora: "10:30", servicios: "higiene facial", quedan: "1 sesión", bono: "Bono facial 6 sesiones" };
const PERMISO = { cita: "Necesita permiso para avisos de citas", promocion: "Necesita permiso para promociones" };

export default async function WhatsApp() {
  await requerirSesion("configuracion.gestionar");
  const lista = await plantillasGuardadas();
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-4xl">Mensajes de WhatsApp</h1>
      <p className="text-tinta-suave">
        Son los textos que salen escritos al pulsar «WhatsApp» en un aviso o en la ficha de una clienta. Se abre WhatsApp con el mensaje y tú pulsas
        enviar: nada se envía solo (el envío automático llegará en la fase 6). Puedes usar {VARIABLES_PLANTILLA.map((v) => `{${v}}`).join(", ")}.
      </p>
      {lista.map((p) => (
        <Tarjeta key={p.clave} className="space-y-3">
          <div>
            <h2 className="text-2xl">{p.nombre}</h2>
            <p className="text-sm text-tinta-suave">{p.clave === "confirmar_cita" ? "Se puede enviar siempre: lo pidió la clienta" : PERMISO[p.permiso]}</p>
          </div>
          <FormularioPlantilla clave={p.clave} nombre={p.nombre} texto={p.texto} ejemplo={rellenarPlantilla(p.texto, EJEMPLO)} />
        </Tarjeta>
      ))}
    </div>
  );
}
