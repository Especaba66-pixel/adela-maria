import { comprobarSecreto } from "@adela/dominio";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  categorias,
  registrarActividad,
  registroActividad,
  sembrar,
  solicitudesReserva,
  tiposBono,
  tiposBonoTratamientos,
  tratamientos,
  usuarios,
  type BaseDatos,
} from "./index";
import { baseDePruebas } from "./pruebas/preparar";

let db: BaseDatos;
let cerrar: () => Promise<void>;

const ADMIN = { nombre: "Adela", usuario: "Adela", contrasena: "contrasena-de-prueba", pin: "2468" };
const TARIFAS = {
  categorias: [
    {
      nombre: "Faciales",
      tratamientos: [
        { nombre: "Higiene facial", duracionMinutos: 60, precioCentimos: 4500 },
        { nombre: "Facial hidratante", duracionMinutos: 45, precioCentimos: 4000 },
      ],
    },
    { nombre: "Depilación", tratamientos: [{ nombre: "Labio superior", duracionMinutos: 5, precioCentimos: 300 }] },
  ],
  bonos: [{ nombre: "Bono facial 3 sesiones", sesiones: 3, precioCentimos: 12000, categoria: "Faciales" }],
};

/** Ejecuta una sentencia y devuelve el mensaje de error de PostgreSQL, o null si no falló. */
async function errorDe(consulta: Promise<unknown>): Promise<string | null> {
  try {
    await consulta;
    return null;
  } catch (e) {
    const err = e as { cause?: { message?: string }; message?: string };
    return err.cause?.message ?? err.message ?? String(e);
  }
}

beforeAll(async () => {
  ({ db, cerrar } = await baseDePruebas());
});
afterAll(async () => cerrar());

describe("datos iniciales", () => {
  it("crea centro, administradora, tarifas y bonos ligados a los faciales", async () => {
    const r = await sembrar(db, ADMIN, TARIFAS);
    expect(r).toMatchObject({ centroCreado: true, adminCreado: true, tratamientosNuevos: 3, bonosNuevos: 1, avisos: [] });

    const [adela] = await db.select().from(usuarios).where(eq(usuarios.usuario, "adela"));
    expect(adela?.rol).toBe("administrador");
    expect(adela?.hashPin).not.toContain("2468");
    expect(await comprobarSecreto("2468", adela!.hashPin!)).toBe(true);
    expect(await comprobarSecreto("contrasena-de-prueba", adela!.hashContrasena!)).toBe(true);

    const cubiertos = await db
      .select({ nombre: tratamientos.nombre })
      .from(tiposBonoTratamientos)
      .innerJoin(tratamientos, eq(tratamientos.id, tiposBonoTratamientos.tratamientoId))
      .innerJoin(tiposBono, eq(tiposBono.id, tiposBonoTratamientos.tipoBonoId));
    expect(cubiertos.map((c) => c.nombre).sort()).toEqual(["Facial hidratante", "Higiene facial"]);
  });

  it("se puede repetir sin duplicar nada", async () => {
    const r = await sembrar(db, ADMIN, TARIFAS);
    expect(r).toMatchObject({ centroCreado: false, adminCreado: false, tratamientosNuevos: 0, bonosNuevos: 0 });
    expect(await db.$count(tratamientos)).toBe(3);
    expect(await db.$count(usuarios)).toBe(1);
  });

  it("dejó rastro de la creación de la administradora, sin secretos", async () => {
    const [fila] = await db.select().from(registroActividad).where(eq(registroActividad.accion, "usuario.crear"));
    expect(JSON.stringify(fila?.despues)).not.toMatch(/scrypt/);
    expect((fila?.despues as Record<string, unknown>).hashPin).toBe("[oculto]");
  });
});

describe("reglas que impone la base de datos", () => {
  it("el registro de actividad no se puede editar, borrar ni vaciar", async () => {
    await registrarActividad(db, { usuarioId: null, accion: "prueba" });
    expect(await errorDe(db.update(registroActividad).set({ accion: "otra" }))).toMatch(/solo admite añadir/);
    expect(await errorDe(db.delete(registroActividad))).toMatch(/solo admite añadir/);
    expect(await errorDe(db.execute(sql`truncate registro_actividad`))).toMatch(/solo admite añadir/);
  });

  it("no se borran usuarios ni tratamientos: se desactivan o anulan", async () => {
    expect(await errorDe(db.delete(usuarios))).toMatch(/No se borran filas de usuarios/);
    expect(await errorDe(db.delete(tratamientos))).toMatch(/No se borran filas de tratamientos/);
    await db.update(usuarios).set({ activo: false });
    await db.update(usuarios).set({ activo: true });
  });

  it("los tratamientos duran tramos de 5 minutos y no tienen precio negativo", async () => {
    const [cat] = await db.select().from(categorias).limit(1);
    const base = { categoriaId: cat!.id, precioCentimos: 100 };
    expect(await errorDe(db.insert(tratamientos).values({ ...base, nombre: "a", duracionMinutos: 7 }))).toMatch(/tramos_5/);
    expect(await errorDe(db.insert(tratamientos).values({ ...base, nombre: "b", duracionMinutos: 0 }))).toMatch(/tramos_5/);
    expect(
      await errorDe(db.insert(tratamientos).values({ ...base, nombre: "c", duracionMinutos: 5, precioCentimos: -1 })),
    ).toMatch(/precio_no_negativo/);
  });

  it("la administración siempre tiene contraseña; el resto del personal puede no tenerla", async () => {
    const [adela] = await db.select().from(usuarios).limit(1);
    expect(await errorDe(db.update(usuarios).set({ hashContrasena: null }).where(eq(usuarios.id, adela!.id)))).toMatch(
      /usuarios_admin_con_contrasena/,
    );
    const sinClave = { ...adela!, id: undefined, usuario: "lucia", rol: "recepcion" as const, hashContrasena: null, creadoEn: undefined, actualizadoEn: undefined };
    expect(await errorDe(db.insert(usuarios).values(sinClave))).toBeNull();
  });

  it("las peticiones de cita no se borran ni se piden para días pasados", async () => {
    const [t] = await db.select().from(tratamientos).limit(1);
    const base = { tratamientoId: t!.id, franja: "tarde" as const, nombre: "Marta", telefono: "+34600112233", consentimientoTexto: "texto" };
    expect(await errorDe(db.insert(solicitudesReserva).values({ ...base, fechaPreferida: "2020-01-01" }))).toMatch(/fecha_futura/);
    expect(await errorDe(db.insert(solicitudesReserva).values({ ...base, fechaPreferida: "2099-01-01" }))).toBeNull();
    expect(await errorDe(db.insert(solicitudesReserva).values({ ...base, nombre: " ", fechaPreferida: "2099-01-01" }))).toMatch(
      /solicitudes_reserva_nombre/,
    );
    expect(await errorDe(db.delete(solicitudesReserva))).toMatch(/No se borran filas de solicitudes_reserva/);
  });

  it("el nombre de usuario es único", async () => {
    const [adela] = await db.select().from(usuarios).limit(1);
    const copia = { ...adela!, id: undefined, creadoEn: undefined, actualizadoEn: undefined };
    expect(await errorDe(db.insert(usuarios).values(copia))).toMatch(/usuarios_usuario_unico/);
  });
});
