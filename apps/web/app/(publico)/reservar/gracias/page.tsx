import Link from "next/link";

export default async function Gracias({ searchParams }: { searchParams: Promise<{ cita?: string }> }) {
  const { cita } = await searchParams;
  return (
    <div className="mx-auto max-w-xl space-y-6 text-center">
      <div aria-hidden className="text-6xl text-dorado">✿</div>
      <h1 className="text-5xl">{cita ? "¡Hora reservada!" : "¡Petición recibida!"}</h1>
      <p className="text-lg text-tinta-suave">
        {cita
          ? "Te guardamos la hora y te escribimos por WhatsApp para confirmarla. Tu cita no está confirmada hasta que te contestemos."
          : "Te escribiremos por WhatsApp para confirmarte la hora. Tu cita no está confirmada hasta que te contestemos."}
      </p>
      <Link href="/" className="inline-flex min-h-toque items-center text-dorado-oscuro underline">
        Volver al inicio
      </Link>
    </div>
  );
}
