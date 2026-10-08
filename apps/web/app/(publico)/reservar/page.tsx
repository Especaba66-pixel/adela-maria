import { rangoFechasReserva } from "@adela/dominio";
import { tratamientosReservables } from "@/server/reservas";
import { Formulario } from "./Formulario";

export const dynamic = "force-dynamic";

export default async function Reservar({ searchParams }: { searchParams: Promise<{ tratamiento?: string }> }) {
  const [{ tratamiento }, lista] = await Promise.all([searchParams, tratamientosReservables()]);
  const { desde, hasta } = rangoFechasReserva(new Date());
  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-5xl">Pedir cita</h1>
        <p className="text-lg text-tinta-suave">
          Sin registrarte ni crear claves. Dinos qué te apetece y cuándo te viene bien, y te escribimos por WhatsApp para
          confirmar la hora exacta.
        </p>
      </div>
      {lista.length === 0 ? (
        <p className="text-tinta-suave">Muy pronto podrás pedir cita desde aquí. Mientras tanto, llámanos.</p>
      ) : (
        <Formulario
          tratamientos={lista}
          elegido={lista.some((t) => t.id === tratamiento) ? tratamiento : undefined}
          desde={desde}
          hasta={hasta}
        />
      )}
    </div>
  );
}
