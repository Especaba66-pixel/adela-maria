"use client";
import { Aviso, Boton, clases } from "@adela/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { entrarPin } from "./acciones";

interface Persona {
  id: string;
  nombre: string;
}

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "borrar", "0", "ok"] as const;

export function TecladoPin({ personas }: { personas: Persona[] }) {
  const router = useRouter();
  const [elegida, setElegida] = useState<Persona | null>(personas.length === 1 ? personas[0]! : null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function enviar() {
    if (!elegida || pin.length < 4) return;
    iniciar(async () => {
      const r = await entrarPin(elegida.id, pin);
      if (r.error) {
        setError(r.error);
        setPin("");
      } else {
        router.replace("/");
        router.refresh();
      }
    });
  }

  function pulsar(tecla: (typeof TECLAS)[number]) {
    setError(null);
    if (tecla === "borrar") setPin((p) => p.slice(0, -1));
    else if (tecla === "ok") enviar();
    else setPin((p) => (p.length < 6 ? p + tecla : p));
  }

  if (!elegida) {
    return (
      <div className="space-y-4">
        <h2 className="text-center text-3xl">¿Quién eres?</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {personas.map((p) => (
            <Boton key={p.id} variante="secundario" grande onClick={() => setElegida(p)} className="h-28 text-2xl">
              {p.nombre}
            </Boton>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-5">
      <div className="text-center">
        <h2 className="text-3xl">Hola, {elegida.nombre}</h2>
        <p className="text-tinta-suave">Escribe tu PIN</p>
      </div>
      <div aria-label="PIN escrito" className="flex justify-center gap-3" data-testid="puntos-pin">
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            className={clases("size-5 rounded-full border-2 border-dorado", i < pin.length && "bg-dorado", i >= 4 && i >= pin.length && "opacity-30")}
          />
        ))}
      </div>
      {error && <Aviso prioridad="urgente">{error}</Aviso>}
      <div className="grid grid-cols-3 gap-3">
        {TECLAS.map((t) => (
          <Boton
            key={t}
            type="button"
            variante={t === "ok" ? "principal" : t === "borrar" ? "discreto" : "secundario"}
            disabled={pendiente || (t === "ok" && pin.length < 4)}
            onClick={() => pulsar(t)}
            className="h-20 text-3xl"
            aria-label={t === "borrar" ? "Borrar" : t === "ok" ? "Entrar" : t}
          >
            {t === "borrar" ? "⌫" : t === "ok" ? "Entrar" : t}
          </Boton>
        ))}
      </div>
      {personas.length > 1 && (
        <Boton variante="discreto" className="w-full" onClick={() => (setElegida(null), setPin(""), setError(null))}>
          No soy {elegida.nombre}
        </Boton>
      )}
    </div>
  );
}
