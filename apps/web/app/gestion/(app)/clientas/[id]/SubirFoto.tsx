"use client";
import { Aviso, Boton } from "@adela/ui";
import { startTransition, useActionState, useRef, type FormEvent } from "react";
import { subir } from "./acciones-fichas";

const LADO_MAXIMO = 1600;

/** Reduce la foto en el propio equipo (máximo 1600 px, JPG) antes de subirla: ocupa poco y entra en las copias. */
async function reducir(archivo: File): Promise<File> {
  const bitmap = await createImageBitmap(archivo).catch(() => null);
  if (!bitmap) return archivo;
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(bitmap.width * escala);
  lienzo.height = Math.round(bitmap.height * escala);
  lienzo.getContext("2d")!.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
  const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", 0.85));
  return blob ? new File([blob], "foto.jpg", { type: "image/jpeg" }) : archivo;
}

const campo = "mt-1 block w-full min-h-toque rounded-xl border-2 border-borde bg-superficie px-3 text-lg";

export function SubirFoto({ clienteId }: { clienteId: string }) {
  const [estado, accion, pendiente] = useActionState(subir, null);
  const form = useRef<HTMLFormElement>(null);
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const archivo = datos.get("archivo");
    if (archivo instanceof File && archivo.size > 0) datos.set("archivo", await reducir(archivo));
    startTransition(() => accion(datos));
    form.current?.reset();
  }
  return (
    <form ref={form} onSubmit={enviar} className="space-y-3" aria-label="Subir foto">
      {estado && (estado.ok ? <Aviso prioridad="correcto">{estado.mensaje}</Aviso> : <Aviso prioridad="urgente">{estado.error}</Aviso>)}
      <input type="hidden" name="cliente" value={clienteId} />
      <label className="block">
        Foto
        <input name="archivo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required className={`${campo} py-2`} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          Es de
          <select name="tipo" defaultValue="antes" className={campo}>
            <option value="antes">Antes</option>
            <option value="despues">Después</option>
            <option value="otra">Otra</option>
          </select>
        </label>
        <label className="block">
          Nota <span className="text-tinta-suave">(opcional)</span>
          <input name="nota" maxLength={200} className={campo} />
        </label>
      </div>
      <Boton type="submit" variante="secundario" disabled={pendiente}>
        {pendiente ? "Subiendo…" : "Guardar foto"}
      </Boton>
    </form>
  );
}
