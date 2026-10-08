import { Tarjeta } from "@adela/ui";
import Link from "next/link";
import { requerirSesion } from "@/server/auth";

const SECCIONES = [
  { href: "/gestion/mas/configuracion/usuarios", nombre: "Usuarios", texto: "Quién entra, con qué rol, contraseña y PIN." },
  { href: "/gestion/mas/configuracion/equipos", nombre: "Equipos", texto: "Equipos de confianza donde se entra con PIN." },
  { href: "/gestion/mas/configuracion/actividad", nombre: "Registro de actividad", texto: "Quién hizo qué y cuándo." },
  { href: "/gestion/mas/configuracion/copias", nombre: "Copias de seguridad", texto: "Copias realizadas y pruebas de restauración." },
];

export default async function Configuracion() {
  await requerirSesion("configuracion.gestionar");
  return (
    <div className="space-y-6">
      <h1 className="text-4xl">Configuración</h1>
      <div className="grid grid-cols-2 gap-4">
        {SECCIONES.map((s) => (
          <Link key={s.href} href={s.href} className="rounded-tarjeta">
            <Tarjeta className="h-full transition-colors hover:border-dorado">
              <div className="text-xl font-semibold">{s.nombre}</div>
              <div className="text-tinta-suave">{s.texto}</div>
            </Tarjeta>
          </Link>
        ))}
      </div>
    </div>
  );
}
