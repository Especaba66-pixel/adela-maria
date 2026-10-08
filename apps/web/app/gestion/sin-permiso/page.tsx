import Link from "next/link";

export default function SinPermiso() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl">No tienes acceso a esta parte</h1>
      <p className="text-tinta-suave">Si lo necesitas, pídeselo a la administración del centro.</p>
      <Link href="/gestion" className="inline-flex min-h-toque items-center text-dorado-oscuro underline">
        Volver al inicio
      </Link>
    </main>
  );
}
