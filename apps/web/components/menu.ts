/** Menú del plan: 7 entradas fijas; el resto se agrupa en "Más". */
export interface EntradaMenu {
  href: string;
  nombre: string;
  icono: string;
  /** Fase del plan en la que llega. 0 = ya disponible. */
  fase: number;
}

export const MENU: EntradaMenu[] = [
  { href: "/", nombre: "Inicio", icono: "⌂", fase: 0 },
  { href: "/agenda", nombre: "Agenda", icono: "▦", fase: 1 },
  { href: "/clientas", nombre: "Clientas", icono: "☺", fase: 1 },
  { href: "/tpv", nombre: "TPV", icono: "€", fase: 2 },
  { href: "/caja", nombre: "Caja", icono: "▤", fase: 2 },
  { href: "/avisos", nombre: "Avisos", icono: "⚑", fase: 5 },
  { href: "/mas", nombre: "Más", icono: "⋯", fase: 0 },
];

export const MAS: (EntradaMenu & { soloAdmin?: boolean })[] = [
  { href: "/mas/tratamientos", nombre: "Tratamientos", icono: "✿", fase: 0 },
  { href: "/mas/configuracion", nombre: "Configuración", icono: "⚙", fase: 0, soloAdmin: true },
  { href: "/mas/facturacion", nombre: "Facturación", icono: "▣", fase: 2 },
  { href: "/mas/stock", nombre: "Stock", icono: "▥", fase: 4 },
  { href: "/mas/proveedores", nombre: "Proveedores", icono: "⛟", fase: 4 },
  { href: "/mas/whatsapp", nombre: "WhatsApp", icono: "✆", fase: 5 },
  { href: "/mas/informes", nombre: "Informes", icono: "▲", fase: 7 },
];
