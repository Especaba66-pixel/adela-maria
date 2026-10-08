import { Tarjeta } from "@adela/ui";

export function ProximaFase({ titulo, fase, descripcion }: { titulo: string; fase: number; descripcion: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-4xl">{titulo}</h1>
      <Tarjeta className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wider text-dorado">Llega en la fase {fase}</p>
        <p className="text-tinta-suave">{descripcion}</p>
      </Tarjeta>
    </div>
  );
}
