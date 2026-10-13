import type { Permiso } from "@adela/dominio";

/** Menú del plan: 7 entradas fijas; el resto se agrupa en "Más". */
export interface EntradaMenu {
  href: string;
  nombre: string;
  icono: string;
  /** Fase del plan en la que llega. 0 = ya disponible. */
  fase: number;
}

export const MENU: EntradaMenu[] = [
  { href: "/gestion", nombre: "Inicio", icono: "⌂", fase: 0 },
  { href: "/gestion/agenda", nombre: "Agenda", icono: "▦", fase: 0 },
  { href: "/gestion/clientas", nombre: "Clientas", icono: "☺", fase: 0 },
  { href: "/gestion/tpv", nombre: "TPV", icono: "€", fase: 0 },
  { href: "/gestion/caja", nombre: "Caja", icono: "▤", fase: 0 },
  { href: "/gestion/avisos", nombre: "Avisos", icono: "⚑", fase: 0 },
  { href: "/gestion/mas", nombre: "Más", icono: "⋯", fase: 0 },
];

export const MAS: (EntradaMenu & { permiso?: Permiso })[] = [
  { href: "/gestion/reservas", nombre: "Reservas web", icono: "✉", fase: 0, permiso: "reservas.gestionar" },
  { href: "/gestion/mas/tratamientos", nombre: "Tratamientos", icono: "✿", fase: 0 },
  { href: "/gestion/mas/configuracion", nombre: "Configuración", icono: "⚙", fase: 0, permiso: "configuracion.gestionar" },
  { href: "/gestion/mas/facturacion", nombre: "Facturación", icono: "▣", fase: 0, permiso: "cobrar" },
  { href: "/gestion/mas/bonos", nombre: "Bonos y tarjetas regalo", icono: "✦", fase: 0, permiso: "cobrar" },
  { href: "/gestion/mas/stock", nombre: "Stock", icono: "▥", fase: 0, permiso: "stock.gestionar" },
  { href: "/gestion/mas/proveedores", nombre: "Proveedores", icono: "⛟", fase: 0, permiso: "stock.gestionar" },
  { href: "/gestion/mas/gastos", nombre: "Gastos", icono: "◧", fase: 0, permiso: "gastos.gestionar" },
  { href: "/gestion/mas/whatsapp", nombre: "WhatsApp", icono: "✆", fase: 0, permiso: "configuracion.gestionar" },
  { href: "/gestion/mas/informes", nombre: "Informes", icono: "▲", fase: 0, permiso: "informes.ver" },
];
