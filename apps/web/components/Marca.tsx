/** Nombre del centro con su tipografía. PENDIENTE: sustituir por el logo original cuando llegue. */
export function Marca({ grande = false }: { grande?: boolean }) {
  return (
    <div className="leading-tight">
      <div className={`font-titulo font-semibold text-dorado-oscuro ${grande ? "text-5xl" : "text-2xl"}`}>Adela María</div>
      <div className={`tracking-[0.25em] uppercase text-dorado ${grande ? "text-sm mt-1" : "text-[0.65rem]"}`}>
        Belleza holística
      </div>
    </div>
  );
}
