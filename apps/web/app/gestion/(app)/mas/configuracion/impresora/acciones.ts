"use server";
import { centro, registrarActividad } from "@adela/db";
import { lineasTicket } from "@adela/dominio";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth";
import { db } from "@/server/db";
import { PUERTO_COM, abrirCajon, configImpresora, imprimirTicket, type ConfigImpresora } from "@/server/impresora";

type Estado = { ok?: string; error?: string };

export async function guardar(_: Estado, f: FormData): Promise<Estado> {
  const { usuario } = await requerirSesion("configuracion.gestionar");
  const tipo = String(f.get("tipo"));
  if (!["ninguna", "simulador", "red", "windows"].includes(tipo)) return { error: "Elige el tipo." };
  const config: ConfigImpresora = { tipo: tipo as ConfigImpresora["tipo"], ancho: f.get("ancho") === "32" ? 32 : 48 };
  if (tipo === "red") {
    const host = String(f.get("host") ?? "").trim();
    const puerto = Number(f.get("puerto") || 9100);
    if (!/^[\w.-]{1,100}$/.test(host)) return { error: "Escribe la dirección IP de la impresora (por ejemplo, 192.168.1.50)." };
    if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) return { error: "Puerto no válido." };
    Object.assign(config, { host, puerto });
  }
  if (tipo === "windows") {
    const nombre = String(f.get("nombre") ?? "").trim();
    if (!/^[\w .()-]{1,64}$/.test(nombre)) return { error: "Escribe el nombre con el que está compartida la impresora en Windows." };
    config.nombre = nombre;
  }
  if (f.get("cajon") === "com") {
    const puerto = String(f.get("cajonCom") ?? "").trim().toUpperCase();
    if (!PUERTO_COM.test(puerto)) return { error: "Escribe el puerto del cajón tal como sale en el Administrador de dispositivos (por ejemplo, COM3)." };
    config.cajonCom = puerto;
  }
  await db().update(centro).set({ impresora: config });
  await registrarActividad(db(), { usuarioId: usuario.id, accion: "impresora.configurar", entidad: "centro", despues: config });
  revalidatePath("/gestion/mas/configuracion/impresora");
  return { ok: "Impresora guardada." };
}

export async function prueba(): Promise<Estado> {
  await requerirSesion("configuracion.gestionar");
  const { ancho = 48 } = await configImpresora();
  const lineas = lineasTicket(
    {
      emisor: { nombre: "Adela María · Belleza holística", nombreFiscal: "Ticket de prueba", nif: "-", direccion: "Si lees bien las tildes y el €, todo está bien: áéíóú ñ €" },
      numero: "PRUEBA",
      fechaHora: new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" }).slice(0, 17),
      tipo: "simplificada",
      lineas: [{ descripcion: "Línea de prueba", cantidad: 1, total: 100, descuentoCentesimas: 0 }],
      desglose: [{ ivaCentesimas: 2100, base: 83, cuota: 17 }],
      total: 100,
      pagos: [],
      atendidaPor: "Prueba",
    },
    ancho,
  );
  const r = await imprimirTicket(lineas, false);
  return r.ok ? { ok: r.detalle } : { error: r.error };
}

export async function cajon(): Promise<Estado> {
  await requerirSesion("caja.abrir_cerrar");
  const r = await abrirCajon();
  return r.ok ? { ok: r.detalle } : { error: r.error };
}
