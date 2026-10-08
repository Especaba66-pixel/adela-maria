import "../entorno";
import { conectar } from "../index";
import { sembrar } from "../sembrar";

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable ${nombre} en .env`);
  return valor;
}

const { db, cerrar } = conectar(requerida("DATABASE_URL"), { max: 1 });
try {
  const r = await sembrar(db, {
    nombre: requerida("ADMIN_NOMBRE"),
    usuario: requerida("ADMIN_USUARIO"),
    contrasena: requerida("ADMIN_CONTRASENA"),
    pin: requerida("ADMIN_PIN"),
  });
  console.log(`Centro ${r.centroCreado ? "creado" : "ya existía"}.`);
  console.log(`Administrador ${r.adminCreado ? "creado" : "ya existía"}.`);
  console.log(`Tratamientos nuevos: ${r.tratamientosNuevos}. Bonos nuevos: ${r.bonosNuevos}.`);
  for (const aviso of r.avisos) console.warn(`Aviso: ${aviso}`);
} finally {
  await cerrar();
}
