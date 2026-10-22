import { comprobarSecreto } from "@adela/dominio";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  categorias,
  registrarActividad,
  registroActividad,
  centro,
  citas,
  clientes,
  consentimientos,
  gastos,
  horarios,
  productos,
  profesionales,
  sembrar,
  solicitudesReserva,
  stock,
  tiposBono,
  tiposBonoTratamientos,
  tratamientos,
  usuarios,
  type BaseDatos,
} from "./index";
import { COMPRAS_INICIALES, GASTOS_INICIALES, PRODUCTOS_VENTA, PROVEEDORES_INICIALES } from "./datos";
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
    expect(r).toMatchObject({
      centroCreado: true,
      adminCreado: true,
      tratamientosNuevos: 3,
      bonosNuevos: 1,
      avisos: ["La administración se registra ahora con su correo: adelamaria_16@hotmail.com (la contraseña no cambia)."],
    });
    const [prof] = await db.select().from(profesionales);
    expect(prof?.nombre).toBe("Adela");
    const [c] = await db.select().from(centro);
    expect(c?.cabinas).toBe(3);
    // Horario de Adela: martes a viernes, con el miércoles partido.
    const h = await db.select().from(horarios).where(eq(horarios.profesionalId, prof!.id));
    expect(h.map((x) => [x.diaSemana, x.inicioMin, x.finMin]).sort()).toEqual([[2, 555, 825], [3, 555, 795], [3, 930, 1110], [4, 660, 1110], [5, 660, 1140]]);

    // La administración que instala con «adela» pasa a entrar con su correo.
    const [adela] = await db.select().from(usuarios).where(eq(usuarios.usuario, "adelamaria_16@hotmail.com"));
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
    expect(r).toMatchObject({ centroCreado: false, adminCreado: false, tratamientosNuevos: 0, bonosNuevos: 0, avisos: [] });
    expect(await db.$count(tratamientos)).toBe(3);
    expect(await db.$count(usuarios)).toBe(1);
  });

  it("carga los productos de venta, sus compras y el gasto de cabina una sola vez, por los importes exactos", async () => {
    const datos = { categorias: [], bonos: [], proveedores: PROVEEDORES_INICIALES, productos: PRODUCTOS_VENTA, compras: COMPRAS_INICIALES, gastos: GASTOS_INICIALES };
    const r = await sembrar(db, ADMIN, datos);
    expect(r).toMatchObject({ productosNuevos: 32, comprasNuevas: 2, gastosNuevos: 1 });
    const lista = await stock.listaProductos(db);
    expect(lista).toHaveLength(32);
    expect(lista.reduce((s, p) => s + p.stock, 0)).toBe(43 + 23);
    const dglow = lista.find((p) => p.nombre.startsWith("D-Glow"))!;
    expect(dglow).toMatchObject({ uso: "venta", stock: 3, precioCentimos: 1600, ivaCentesimas: 2100, costeCentimos: 812, proveedor: "Arganour S.L.U.", stockMinimo: 0, bajo: false });
    expect(lista.find((p) => p.nombre === "Extracto de olivo 15 ml")).toMatchObject({ stock: 4, referencia: "MA040", costeCentimos: 1005, proveedor: "Área Estética S.L." });

    const [arganour] = await db.select().from(gastos).where(eq(gastos.numeroFactura, "INV-ES-21420"));
    expect(arganour).toMatchObject({ fecha: "2026-08-27", categoria: "compras", base: 23_988, cuota: 5_039, total: 29_027 });
    // Área Estética: la parte de venta (con stock) y la de cabina (solo gasto) suman exactamente el documento.
    const area = await db.select().from(gastos).where(eq(gastos.numeroFactura, "SF 26000034"));
    expect(area).toHaveLength(2);
    expect(area.reduce((s, g) => s + g.base, 0)).toBe(128_140);
    expect(area.reduce((s, g) => s + g.cuota, 0)).toBe(26_909);
    expect(area.reduce((s, g) => s + g.total, 0)).toBe(155_049);
    expect(area.find((g) => g.concepto === "Productos de cabina")).toMatchObject({ fecha: "2026-06-29", base: 91_830, cuota: 19_284 });

    // Repetirlo (cada actualización del TPV lo hace) no duplica nada ni pisa un precio cambiado en la app.
    await db.update(productos).set({ precioCentimos: 1_500 }).where(eq(productos.id, dglow.id));
    expect(await sembrar(db, ADMIN, datos)).toMatchObject({ productosNuevos: 0, comprasNuevas: 0, gastosNuevos: 0 });
    expect(await db.$count(gastos)).toBe(3);
    expect((await stock.listaProductos(db)).find((p) => p.id === dglow.id)).toMatchObject({ stock: 3, precioCentimos: 1_500 });
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

  it("admite tantas citas a la vez como cabinas, y nunca una más", async () => {
    const [adela] = await db.select().from(profesionales).limit(1);
    const [otra] = await db.insert(profesionales).values({ nombre: "Lucía" }).returning();
    const [cliente] = await db.insert(clientes).values({ nombre: "Marta", telefono: "+34600112233" }).returning();
    const cita = (prof: string, desde: string, hasta: string, extra: { estado?: "confirmada" | "cancelada"; exclusiva?: boolean } = {}) =>
      db.insert(citas).values({ clienteId: cliente!.id, profesionalId: prof, inicio: new Date(desde), fin: new Date(hasta), origen: "centro", ...extra });

    await db.update(centro).set({ cabinas: 1 });
    expect(await errorDe(cita(adela!.id, "2026-11-02T09:00:00Z", "2026-11-02T10:30:00Z"))).toBeNull();
    expect(await errorDe(cita(adela!.id, "2026-11-02T10:00:00Z", "2026-11-02T10:15:00Z"))).toMatch(/cabinas_llenas/);
    // Otra profesional también ocupa cabina.
    expect(await errorDe(cita(otra!.id, "2026-11-02T10:00:00Z", "2026-11-02T10:15:00Z"))).toMatch(/cabinas_llenas/);
    expect(await errorDe(cita(adela!.id, "2026-11-02T10:30:00Z", "2026-11-02T10:45:00Z"))).toBeNull();
    expect(await errorDe(cita(adela!.id, "2026-11-02T09:30:00Z", "2026-11-02T09:45:00Z", { estado: "cancelada" }))).toBeNull();

    await db.update(centro).set({ cabinas: 2 });
    expect(await errorDe(cita(adela!.id, "2026-11-02T09:15:00Z", "2026-11-02T09:45:00Z"))).toBeNull();
    // Ya hay dos a las 9:30: la tercera no cabe.
    expect(await errorDe(cita(adela!.id, "2026-11-02T09:30:00Z", "2026-11-02T09:40:00Z"))).toMatch(/cabinas_llenas/);
    // Dos citas que no coinciden entre sí no suman: a las 9:50 solo está la primera.
    expect(await errorDe(cita(adela!.id, "2026-11-02T09:50:00Z", "2026-11-02T10:00:00Z"))).toBeNull();
    expect(await errorDe(cita(adela!.id, "2026-11-02T11:00:00Z", "2026-11-02T11:07:00Z"))).toMatch(/citas_tramos_5/);
    expect(await errorDe(db.delete(citas))).toMatch(/No se borran filas de citas/);
  });

  it("un microblading (exclusivo) no admite nada a la vez, aunque haya cabinas", async () => {
    const [adela] = await db.select().from(profesionales).limit(1);
    const [cliente] = await db.select().from(clientes).limit(1);
    const cita = (desde: string, hasta: string, exclusiva = false) =>
      db.insert(citas).values({ clienteId: cliente!.id, profesionalId: adela!.id, inicio: new Date(desde), fin: new Date(hasta), origen: "centro", exclusiva });
    expect(await errorDe(cita("2026-11-03T09:00:00Z", "2026-11-03T11:00:00Z", true))).toBeNull();
    expect(await errorDe(cita("2026-11-03T10:00:00Z", "2026-11-03T10:15:00Z"))).toMatch(/cita_exclusiva/);
    expect(await errorDe(cita("2026-11-03T08:00:00Z", "2026-11-03T09:00:00Z"))).toBeNull();
    expect(await errorDe(cita("2026-11-03T08:30:00Z", "2026-11-03T09:30:00Z", true))).toMatch(/cita_exclusiva/);
  });

  it("un teléfono no se repite entre clientas activas, y los consentimientos no se modifican", async () => {
    expect(await errorDe(db.insert(clientes).values({ nombre: "Otra Marta", telefono: "+34600112233" }))).toMatch(/clientes_telefono_unico/);
    const [c] = await db.select().from(clientes).limit(1);
    await db.insert(consentimientos).values({ clienteId: c!.id, tipo: "avisos_citas", aceptado: true, canal: "centro" });
    expect(await errorDe(db.update(consentimientos).set({ aceptado: false }))).toMatch(/solo admite añadir/);
  });

  it("el horario va en tramos de 5 minutos y un día válido", async () => {
    const [p] = await db.select().from(profesionales).limit(1);
    expect(await errorDe(db.insert(horarios).values({ profesionalId: p!.id, diaSemana: 8, inicioMin: 600, finMin: 840 }))).toMatch(/dia_valido/);
    expect(await errorDe(db.insert(horarios).values({ profesionalId: p!.id, diaSemana: 1, inicioMin: 840, finMin: 600 }))).toMatch(/tramo_valido/);
    expect(await errorDe(db.insert(horarios).values({ profesionalId: p!.id, diaSemana: 1, inicioMin: 600, finMin: 840 }))).toBeNull();
  });

  it("el nombre de usuario es único", async () => {
    const [adela] = await db.select().from(usuarios).limit(1);
    const copia = { ...adela!, id: undefined, creadoEn: undefined, actualizadoEn: undefined };
    expect(await errorDe(db.insert(usuarios).values(copia))).toMatch(/usuarios_usuario_unico/);
  });
});
