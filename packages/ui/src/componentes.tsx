import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variante = "principal" | "secundario" | "peligro" | "discreto";

const VARIANTES: Record<Variante, string> = {
  principal: "bg-dorado-oscuro text-white hover:bg-tinta active:bg-tinta",
  secundario: "bg-superficie text-dorado-oscuro border-2 border-dorado hover:bg-crema",
  peligro: "bg-urgente text-white hover:opacity-90",
  discreto: "bg-transparent text-tinta-suave hover:bg-crema",
};

export function clases(...lista: (string | false | null | undefined)[]): string {
  return lista.filter(Boolean).join(" ");
}

export function Boton({
  variante = "principal",
  grande = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; grande?: boolean }) {
  return (
    <button
      {...props}
      className={clases(
        "inline-flex items-center justify-center gap-2 rounded-xl px-6 font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50 select-none",
        grande ? "min-h-boton text-xl" : "min-h-toque",
        VARIANTES[variante],
        className,
      )}
    />
  );
}

export function Tarjeta({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={clases("rounded-tarjeta border border-borde bg-superficie p-6 shadow-sm", className)}>{children}</div>
  );
}

export type Prioridad = "urgente" | "importante" | "pendiente" | "informativo" | "correcto";

const AVISO: Record<Prioridad, string> = {
  urgente: "border-urgente bg-urgente-fondo text-urgente",
  importante: "border-importante bg-importante-fondo text-importante",
  pendiente: "border-pendiente bg-pendiente-fondo text-pendiente",
  informativo: "border-informativo bg-informativo-fondo text-informativo",
  correcto: "border-correcto bg-correcto-fondo text-correcto",
};

export function Aviso({ prioridad, children }: { prioridad: Prioridad; children: ReactNode }) {
  return (
    <div role={prioridad === "urgente" ? "alert" : "status"} className={clases("rounded-xl border-l-8 px-5 py-4", AVISO[prioridad])}>
      {children}
    </div>
  );
}
