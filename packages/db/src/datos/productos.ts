/**
 * Productos de venta y su primera compra (factura INV-ES-21420 de Arganour, 27 de agosto de 2026).
 *
 * El precio de venta no se escribe a mano: sale del coste real (precio de la factura con el 30 % de descuento del
 * pedido repartido) más el margen del centro y el IVA. Si cambia el margen, se cambia `MARGEN_VENTA` y nada más.
 * Para añadir productos o compras: editar aquí y ejecutar `pnpm db:seed`, que añade lo nuevo sin duplicar.
 */
import { costeConDescuento, precioConMargen } from "@adela/dominio/stock";

/** Margen sobre el coste, en centésimas de punto: 3000 = 30 % (decidido por el centro el 18 de octubre de 2026). */
export const MARGEN_VENTA = 3_000;
/** IVA de la cosmética: 21 %, como en la factura del proveedor. */
export const IVA_PRODUCTOS = 2_100;
/**
 * Sin aviso de stock bajo al cargarlos: de la mayoría se compró una sola unidad, y con mínimo 1 saldrían 11 avisos
 * de «reponer» desde el primer día. El mínimo de cada producto se pone en la app cuando el centro decida reponerlo.
 */
export const STOCK_MINIMO_INICIAL = 0;

export const GRUPOS_PRODUCTO = ["Sérums", "Cremas y contorno de ojos", "Limpieza y exfoliación", "Aceites", "Cuerpo"] as const;
export type GrupoProducto = (typeof GRUPOS_PRODUCTO)[number];

export interface ProveedorInicial {
  nombre: string;
  nif: string;
  telefono: string;
  email: string;
  notas?: string;
}

export interface CompraInicial {
  proveedor: string;
  fecha: string;
  numeroFactura: string;
  ivaCentesimas: number;
  /** Líneas tal como vienen en la factura: [producto, cantidad, precio por unidad sin IVA en céntimos]. */
  lineas: [producto: string, cantidad: number, costeUnitario: number][];
  /** Descuento de pedido, sin IVA. */
  descuento: number;
  /** Total de la factura con IVA. */
  totalFactura: number;
}

export const PROVEEDORES_INICIALES: ProveedorInicial[] = [
  {
    nombre: "Arganour S.L.U.",
    nif: "B93243889",
    telefono: "+34 952 75 05 53",
    email: "hello@arganour.com",
    notas: "Calle Periana nº8, 29160 Casabermeja (Málaga).",
  },
];

/** Grupo de cada producto en la web y en el TPV. El nombre es el de la factura, con mayúsculas normalizadas. */
export const GRUPO_DE: Record<string, GrupoProducto> = {
  "Balance - Sérum con Revinage (efecto retinol)": "Sérums",
  "Porcelain - Sérum antimanchas": "Sérums",
  "Purity - Sérum con vitamina C": "Sérums",
  "Velvet - Sérum minimizador de poros": "Sérums",
  "Crema antiedad de día": "Cremas y contorno de ojos",
  "Crema antiedad de noche": "Cremas y contorno de ojos",
  "D-Glow - Crema facial iluminadora": "Cremas y contorno de ojos",
  "Equilibrium - Crema antiacné": "Cremas y contorno de ojos",
  "Boticream - Crema reparadora": "Cremas y contorno de ojos",
  "Elixir - Contorno de ojos": "Cremas y contorno de ojos",
  "Agua micelar": "Limpieza y exfoliación",
  "Gel limpiador facial": "Limpieza y exfoliación",
  "Aceite limpiador facial": "Limpieza y exfoliación",
  "Tónico facial": "Limpieza y exfoliación",
  "AHA - Peeling facial con caviar de lima australiano": "Limpieza y exfoliación",
  "BHA - Peeling facial con ácido salicílico": "Limpieza y exfoliación",
  "Aceite de argán 100 % puro": "Aceites",
  "Aceite de semillas de higo chumbo 100 % puro": "Aceites",
  "Aceite de almendras dulces 100 % puro": "Aceites",
  "Aceite de ricino 100 % puro": "Aceites",
  "Aceite esencial de lavanda 100 % puro": "Aceites",
  "Aceite esencial de limón 100 % puro": "Aceites",
  "Aceite esencial de árbol de té 100 % puro": "Aceites",
  "Aceite de masaje relajante": "Cuerpo",
  "Femme - Gel íntimo": "Cuerpo",
};

export const COMPRAS_INICIALES: CompraInicial[] = [
  {
    proveedor: "Arganour S.L.U.",
    fecha: "2026-08-27",
    numeroFactura: "INV-ES-21420",
    ivaCentesimas: 2_100,
    descuento: 10_260,
    totalFactura: 29_027,
    lineas: [
      ["Aceite de masaje relajante", 2, 577],
      ["Balance - Sérum con Revinage (efecto retinol)", 1, 657],
      ["Femme - Gel íntimo", 1, 1_070],
      ["Agua micelar", 2, 620],
      ["Crema antiedad de día", 1, 785],
      ["Crema antiedad de noche", 1, 785],
      ["AHA - Peeling facial con caviar de lima australiano", 1, 747],
      ["D-Glow - Crema facial iluminadora", 1, 1_125],
      ["Porcelain - Sérum antimanchas", 1, 1_275],
      ["Elixir - Contorno de ojos", 1, 974],
      ["Purity - Sérum con vitamina C", 1, 749],
      ["Gel limpiador facial", 1, 521],
      ["Aceite limpiador facial", 1, 671],
      ["Balance - Sérum con Revinage (efecto retinol)", 1, 596],
      ["Velvet - Sérum minimizador de poros", 1, 1_121],
      ["Elixir - Contorno de ojos", 1, 971],
      ["Aceite esencial de árbol de té 100 % puro", 1, 449],
      ["Equilibrium - Crema antiacné", 1, 1_121],
      ["BHA - Peeling facial con ácido salicílico", 1, 746],
      ["Tónico facial", 1, 488],
      ["D-Glow - Crema facial iluminadora", 1, 1_120],
      ["Elixir - Contorno de ojos", 1, 970],
      ["AHA - Peeling facial con caviar de lima australiano", 1, 745],
      ["Aceite de semillas de higo chumbo 100 % puro", 1, 1_500],
      ["Balance - Sérum con Revinage (efecto retinol)", 1, 596],
      ["Gel limpiador facial", 1, 520],
      ["Purity - Sérum con vitamina C", 1, 746],
      ["Tónico facial", 1, 487],
      ["Aceite de semillas de higo chumbo 100 % puro", 1, 1_360],
      ["Aceite de semillas de higo chumbo 100 % puro", 1, 1_362],
      ["Aceite de argán 100 % puro", 2, 905],
      ["Aceite esencial de lavanda 100 % puro", 1, 492],
      ["Aceite esencial de limón 100 % puro", 1, 364],
      ["Aceite esencial de árbol de té 100 % puro", 1, 494],
      ["Aceite de ricino 100 % puro", 1, 411],
      ["D-Glow - Crema facial iluminadora", 1, 1_234],
      ["Boticream - Crema reparadora", 2, 822],
      ["Aceite de almendras dulces 100 % puro", 2, 574],
    ],
  },
];

export interface ProductoVenta {
  nombre: string;
  grupo: GrupoProducto;
  proveedor: string;
  /** Coste real por unidad, sin IVA: media de las líneas de la compra con el descuento repartido. */
  costeCentimos: number;
  /** Precio de venta al público, IVA incluido. */
  precioCentimos: number;
  ivaCentesimas: number;
}

/** Productos de venta con su precio, calculados a partir de las compras. Ordenados por grupo y nombre. */
export const PRODUCTOS_VENTA: ProductoVenta[] = (() => {
  const productos = new Map<string, ProductoVenta>();
  for (const compra of COMPRAS_INICIALES) {
    const suma = compra.lineas.reduce((s, [, cantidad, coste]) => s + cantidad * coste, 0);
    const porProducto = new Map<string, { unidades: number; importe: number }>();
    for (const [nombre, cantidad, coste] of compra.lineas) {
      const p = porProducto.get(nombre) ?? { unidades: 0, importe: 0 };
      porProducto.set(nombre, { unidades: p.unidades + cantidad, importe: p.importe + cantidad * coste });
    }
    for (const [nombre, p] of porProducto) {
      const grupo = GRUPO_DE[nombre];
      if (!grupo) throw new Error(`Falta el grupo del producto «${nombre}» en GRUPO_DE.`);
      const costeCentimos = costeConDescuento(Math.round(p.importe / p.unidades), suma, compra.descuento);
      productos.set(nombre, {
        nombre,
        grupo,
        proveedor: compra.proveedor,
        costeCentimos,
        precioCentimos: precioConMargen(costeCentimos, MARGEN_VENTA, IVA_PRODUCTOS),
        ivaCentesimas: IVA_PRODUCTOS,
      });
    }
  }
  return [...productos.values()].sort(
    (a, b) => GRUPOS_PRODUCTO.indexOf(a.grupo) - GRUPOS_PRODUCTO.indexOf(b.grupo) || a.nombre.localeCompare(b.nombre, "es"),
  );
})();
