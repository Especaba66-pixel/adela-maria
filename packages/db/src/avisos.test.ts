import { PLANTILLAS_INICIALES } from "@adela/dominio";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientes, mensajes, plantillas, sembrar, usuarios, type BaseDatos } from "./index";
import { baseDePruebas } from "./pruebas/preparar";

let db: BaseDatos;
let cerrar: () => Promise<void>;

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
  await sembrar(db, { nombre: "Adela", usuario: "adela", contrasena: "contrasena-de-prueba", pin: "2468" }, { categorias: [], bonos: [] });
});
afterAll(async () => cerrar());

describe("mensajes y plantillas", () => {
  it("se siembran las plantillas de partida, sin pisar las que ya se cambiaron", async () => {
    expect((await db.select().from(plantillas)).length).toBe(PLANTILLAS_INICIALES.length);
    await db.update(plantillas).set({ texto: "Hola, {nombre}. Texto propio." });
    await sembrar(db, { nombre: "Adela", usuario: "adela", contrasena: "contrasena-de-prueba", pin: "2468" }, { categorias: [], bonos: [] }).catch(() => undefined);
    const todas = await db.select().from(plantillas);
    expect(todas.every((p) => p.texto === "Hola, {nombre}. Texto propio.")).toBe(true);
  });

  it("lo que se escribió a una clienta no se modifica", async () => {
    const [{ id: usuarioId }] = (await db.select({ id: usuarios.id }).from(usuarios)) as [{ id: string }];
    const [c] = await db.insert(clientes).values({ nombre: "Marta", telefono: "+34611223344" }).returning();
    await db.insert(mensajes).values({ clienteId: c!.id, plantilla: "recordatorio", texto: "Hola, Marta.", canal: "whatsapp_enlace", usuarioId });
    expect(await errorDe(db.update(mensajes).set({ texto: "Otro" }))).toMatch(/solo admite añadir/);
  });

  it("de un envío por la API solo cambia el estado, y el mismo aviso de una cita no sale dos veces", async () => {
    const [c] = await db.insert(clientes).values({ nombre: "Lola", telefono: "+34622334455" }).returning();
    const [m] = await db.insert(mensajes).values({ clienteId: c!.id, plantilla: "cumpleanos", texto: "¡Felicidades!", canal: "whatsapp_api", estado: "enviando" }).returning();
    await db.update(mensajes).set({ waId: "wamid.1", estado: "enviado" }).where(eq(mensajes.id, m!.id));
    await db.update(mensajes).set({ estado: "leido", estadoEn: new Date() }).where(eq(mensajes.id, m!.id));
    expect(await errorDe(db.update(mensajes).set({ waId: "wamid.2" }).where(eq(mensajes.id, m!.id)))).toMatch(/solo admite añadir/);
    expect(await errorDe(db.update(mensajes).set({ texto: "Otro" }).where(eq(mensajes.id, m!.id)))).toMatch(/solo admite añadir/);
    expect(await errorDe(db.insert(mensajes).values({ clienteId: c!.id, texto: "x", canal: "whatsapp_api", estado: "enviando", waId: "wamid.1" }))).toMatch(/duplicate|duplicad/);
  });
});
