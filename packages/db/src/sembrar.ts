/**
 * Datos iniciales. Se puede ejecutar varias veces: solo añade lo que falta.
 */
import { MODELOS_CONSENTIMIENTO_INICIALES, PLANTILLAS_INICIALES, cifrarSecreto, normalizarUsuario, validarContrasena, validarPin, validarUsuario } from "@adela/dominio";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { registrarActividad } from "./actividad";
import { CABINAS, CONTACTO, HORARIO_INICIAL } from "./datos/centro";
import { BONOS, CATEGORIAS, type TarifaBono, type TarifaCategoria } from "./datos/tarifas";
import { categorias, centro, horarios, modelosConsentimiento, modelosConsentimientoTratamientos, plantillas, profesionales, tiposBono, tiposBonoTratamientos, tratamientos, usuarios } from "./esquema";
import type { BaseDatos } from "./index";

export const NOMBRE_CENTRO = "Adela María · Belleza holística";

export interface AdminInicial {
  nombre: string;
  usuario: string;
  contrasena: string;
  pin: string;
}

export interface ResumenSiembra {
  centroCreado: boolean;
  adminCreado: boolean;
  tratamientosNuevos: number;
  bonosNuevos: number;
  horarioCreado: boolean;
  avisos: string[];
}

export async function sembrar(
  db: BaseDatos,
  admin: AdminInicial,
  tarifas: { categorias: TarifaCategoria[]; bonos: TarifaBono[] } = { categorias: CATEGORIAS, bonos: BONOS },
): Promise<ResumenSiembra> {
  const resumen: ResumenSiembra = { centroCreado: false, adminCreado: false, tratamientosNuevos: 0, bonosNuevos: 0, horarioCreado: false, avisos: [] };

  await db.transaction(async (tx) => {
    let [c] = await tx.select().from(centro).limit(1);
    if (!c) {
      [c] = await tx.insert(centro).values({ nombre: NOMBRE_CENTRO, direccion: CONTACTO.direccion }).returning();
      resumen.centroCreado = true;
    }
    const centroId = c!.id;
    if (c!.cabinas === null) await tx.update(centro).set({ cabinas: CABINAS }).where(eq(centro.id, centroId));

    const [hayAdmin] = await tx.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.rol, "administrador")).limit(1);
    if (!hayAdmin) {
      const usuario = normalizarUsuario(admin.usuario);
      const error = validarUsuario(usuario) ?? validarContrasena(admin.contrasena) ?? validarPin(admin.pin);
      if (error) throw new Error(`Administrador inicial no válido: ${error}`);
      const [nuevo] = await tx
        .insert(usuarios)
        .values({
          centroId,
          nombre: admin.nombre,
          usuario,
          rol: "administrador",
          hashContrasena: await cifrarSecreto(admin.contrasena),
          hashPin: await cifrarSecreto(admin.pin),
        })
        .returning();
      await registrarActividad(tx, { usuarioId: null, accion: "usuario.crear", entidad: "usuarios", entidadId: nuevo!.id, despues: nuevo });
      resumen.adminCreado = true;
    }

    // La administración atiende citas: es la primera profesional (su horario se pone en Configuración).
    const [hayProfesional] = await tx.select({ id: profesionales.id }).from(profesionales).limit(1);
    if (!hayProfesional) {
      const [admin] = await tx.select().from(usuarios).where(eq(usuarios.rol, "administrador")).limit(1);
      const [adela] = await tx.insert(profesionales).values({ nombre: admin!.nombre, usuarioId: admin!.id }).returning();
      await tx.insert(horarios).values(HORARIO_INICIAL.map((h) => ({ ...h, profesionalId: adela!.id })));
      resumen.horarioCreado = true;
    }

    // Plantillas de mensajes de partida (las que ya existen no se tocan: puede haberlas cambiado el centro).
    await tx.insert(plantillas).values(PLANTILLAS_INICIALES).onConflictDoNothing();

    for (const [i, cat] of tarifas.categorias.entries()) {
      await tx.insert(categorias).values({ nombre: cat.nombre, orden: i }).onConflictDoNothing();
      const [fila] = await tx.select().from(categorias).where(eq(categorias.nombre, cat.nombre));
      if (cat.tratamientos.length === 0) resumen.avisos.push(`Faltan los tratamientos de la categoría «${cat.nombre}».`);
      for (const [j, t] of cat.tratamientos.entries()) {
        const insertados = await tx
          .insert(tratamientos)
          .values({ categoriaId: fila!.id, orden: j, ...t })
          .onConflictDoNothing()
          .returning({ id: tratamientos.id });
        resumen.tratamientosNuevos += insertados.length;
      }
    }

    for (const bono of tarifas.bonos) {
      const [nuevo] = await tx
        .insert(tiposBono)
        .values({ nombre: bono.nombre, sesiones: bono.sesiones, precioCentimos: bono.precioCentimos })
        .onConflictDoNothing()
        .returning();
      if (nuevo) resumen.bonosNuevos++;
      const [tipo] = await tx.select().from(tiposBono).where(eq(tiposBono.nombre, bono.nombre));
      const cubiertos = await tx
        .select({ id: tratamientos.id, nombre: tratamientos.nombre })
        .from(tratamientos)
        .innerJoin(categorias, eq(categorias.id, tratamientos.categoriaId))
        .where(and(eq(categorias.nombre, bono.categoria), isNull(tratamientos.anuladoEn)));
      const incluidos = cubiertos.filter((t) => !bono.excepto?.includes(t.nombre));
      if (incluidos.length > 0) {
        await tx
          .insert(tiposBonoTratamientos)
          .values(incluidos.map((t) => ({ tipoBonoId: tipo!.id, tratamientoId: t.id })))
          .onConflictDoNothing();
      }
    }

    // Consentimientos informados de partida (solo los que no existen; los tratamientos que los piden, por nombre).
    for (const m of MODELOS_CONSENTIMIENTO_INICIALES) {
      const [nuevo] = await tx.insert(modelosConsentimiento).values({ nombre: m.nombre, texto: m.texto }).onConflictDoNothing().returning();
      if (!nuevo || m.tratamientos.length === 0) continue;
      const piden = await tx.select({ id: tratamientos.id }).from(tratamientos).where(inArray(tratamientos.nombre, m.tratamientos));
      if (piden.length) await tx.insert(modelosConsentimientoTratamientos).values(piden.map((t) => ({ modeloId: nuevo.id, tratamientoId: t.id })));
    }
  });

  return resumen;
}
