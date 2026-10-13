import { MODELOS_CONSENTIMIENTO_INICIALES } from "@adela/dominio";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { centro, clientes, cobros, consentimientosFirmados, fotosClientes, modelosConsentimiento, profesionales, sembrar, usuarios, ventas, type BaseDatos } from "./index";
import { baseDePruebas } from "./pruebas/preparar";

let db: BaseDatos;
let cerrar: () => Promise<void>;
let adela: string;
let clienta: string;

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
  [{ id: adela }] = (await db.select({ id: usuarios.id }).from(usuarios)) as [{ id: string }];
  await db.update(centro).set({ nombreFiscal: "Adela María Pérez", nif: "12345678Z", direccionFiscal: "Calle Mayor 1" });
  [{ id: clienta }] = (await db.insert(clientes).values({ nombre: "Marta Ruiz", telefono: "+34611000111" }).returning({ id: clientes.id })) as [{ id: string }];
});
afterAll(async () => cerrar());

describe("consentimientos informados", () => {
  it("se siembran los de partida", async () => {
    expect((await db.select().from(modelosConsentimiento)).map((m) => m.nombre).sort()).toEqual(MODELOS_CONSENTIMIENTO_INICIALES.map((m) => m.nombre).sort());
  });

  it("lo firmado no se cambia: solo se puede retirar, una vez", async () => {
    const [m] = await db.select().from(modelosConsentimiento).limit(1);
    const [f] = await db
      .insert(consentimientosFirmados)
      .values({ clienteId: clienta, modeloId: m!.id, nombreModelo: m!.nombre, texto: "Texto firmado", firma: "data:image/png;base64,AAAA", firmante: "Marta Ruiz", registradoPor: adela })
      .returning();
    expect(await errorDe(db.update(consentimientosFirmados).set({ texto: "Otro" }).where(eq(consentimientosFirmados.id, f!.id)))).toMatch(/solo admite añadir/);
    await db.update(consentimientosFirmados).set({ revocadoEn: new Date(), revocadoPor: adela }).where(eq(consentimientosFirmados.id, f!.id));
    expect(await errorDe(db.update(consentimientosFirmados).set({ revocadoEn: new Date() }).where(eq(consentimientosFirmados.id, f!.id)))).toMatch(/solo admite añadir/);
  });
});

describe("fotos", () => {
  it("se guardan en la base de datos, con un tamaño máximo", async () => {
    await db.insert(fotosClientes).values({ clienteId: clienta, tipo: "antes", mime: "image/jpeg", datos: Buffer.from([1, 2, 3]), subidaPor: adela });
    expect(await errorDe(db.insert(fotosClientes).values({ clienteId: clienta, tipo: "antes", mime: "image/jpeg", datos: Buffer.alloc(3 * 1024 * 1024 + 1), subidaPor: adela }))).toMatch(/fotos_tamano/);
  });
});

describe("quién atendió", () => {
  it("cada venta guarda su profesional y la devolución también", async () => {
    const [p] = await db.select().from(profesionales).limit(1);
    await cobros.abrirCaja(db, adela, 5000);
    const r = await cobros.cobrar(db, adela, {
      profesionalId: p!.id,
      lineas: [{ descripcion: "Crema", cantidad: 1, precioUnitario: 1210, descuentoCentesimas: 0, ivaCentesimas: 2100 }],
      pagos: [{ metodo: "efectivo", importe: 1210 }],
    });
    if (!r.ok) throw new Error(r.error);
    const [v] = await db.select().from(ventas).where(eq(ventas.id, r.valor.ventaId!));
    expect(v!.profesionalId).toBe(p!.id);
    const d = await cobros.devolver(db, adela, v!.id, "efectivo", "Prueba");
    expect(d.ok).toBe(true);
    const [dev] = await db.select().from(ventas).where(eq(ventas.devolucionDe, v!.id));
    expect(dev).toMatchObject({ profesionalId: p!.id, total: -1210 });
  });
});
