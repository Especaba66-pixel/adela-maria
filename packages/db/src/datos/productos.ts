/**
 * Productos de venta y las compras con que llegaron:
 * - Arganour, factura INV-ES-21420 del 27 de agosto de 2026 (todo para vender).
 * - Área Estética, documento SF 26000034 del 29 de junio de 2026: lo marcado en rojo es para vender; el resto es
 *   para cabina y va solo a gastos (`GASTOS_INICIALES`), sin control de stock.
 *
 * El precio de venta es el que pone Adela (`PRECIO_ADELA`). Un producto sin precio suyo sale del coste real (precio
 * de la factura con el descuento del pedido repartido) más el margen del centro (`MARGEN_VENTA`) y el IVA.
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

/**
 * Precio de venta al público de cada producto, IVA incluido, puesto por Adela (escrito a mano en las facturas y en su
 * lista; fotos enviadas por Espe el 22 de octubre de 2026). Cuando en la factura apuntó dos precios para el mismo
 * producto (una línea por unidad), va el más alto: en la tienda cada producto tiene un solo precio.
 */
export const PRECIO_ADELA: Record<string, number> = {
  // Arganour
  "Aceite de masaje relajante": 750,
  "Balance - Sérum con Revinage (efecto retinol)": 860, // apuntó 8,60 y 7,75 €
  "Femme - Gel íntimo": 1_390,
  "Agua micelar": 810,
  "Crema antiedad de día": 1_020,
  "Crema antiedad de noche": 1_020,
  "AHA - Peeling facial con caviar de lima australiano": 975, // 9,75 y 9,70 €
  "D-Glow - Crema facial iluminadora": 1_600, // 14,65, 14,60 y 16,00 €
  "Porcelain - Sérum antimanchas": 1_660,
  "Elixir - Contorno de ojos": 1_270, // 12,70, 12,65 y 12,60 €
  "Purity - Sérum con vitamina C": 975, // 9,75 y 9,70 €
  "Gel limpiador facial": 680,
  "Aceite limpiador facial": 875,
  "Velvet - Sérum minimizador de poros": 1_460,
  "Aceite esencial de árbol de té 100 % puro": 640, // 5,85 y 6,40 €
  "Equilibrium - Crema antiacné": 1_460,
  "BHA - Peeling facial con ácido salicílico": 970,
  "Tónico facial": 640,
  "Aceite de semillas de higo chumbo 100 % puro": 1_950, // 19,50 y 17,70 €
  "Aceite de argán 100 % puro": 1_095,
  "Aceite esencial de lavanda 100 % puro": 660,
  "Aceite esencial de limón 100 % puro": 475,
  "Aceite de ricino 100 % puro": 540,
  "Boticream - Crema reparadora": 1_070,
  "Aceite de almendras dulces 100 % puro": 750,
  // Área Estética
  "Extracto de olivo 15 ml": 2_670,
  "Sérum hidratante de jojoba 30 ml": 5_300,
  "Crema hidratante total 50 ml": 4_990,
  "Crema antiarrugas de aguacate 100 ml": 6_690,
  "Crema regeneradora antiarrugas 100 ml": 8_100,
  "Extracto de aloe vera 15 ml": 2_790,
  "Extracto de soja orgánica 15 ml": 2_790,
};

export const GRUPOS_PRODUCTO = ["Sérums y extractos", "Cremas y contorno de ojos", "Limpieza y exfoliación", "Aceites", "Cuerpo"] as const;
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
  /** Total de la factura con IVA. Sin indicar cuando la factura incluye también productos de cabina (van aparte, en
   *  `GASTOS_INICIALES`): entonces el IVA se calcula sobre estas líneas. */
  totalFactura?: number;
}

export interface GastoInicial {
  proveedor: string;
  fecha: string;
  numeroFactura: string;
  concepto: string;
  ivaCentesimas: number;
  /** Detalle tal como viene en la factura: [código, descripción, unidades, importe sin IVA en céntimos]. */
  lineas: [codigo: string, descripcion: string, unidades: number, importe: number][];
}

/** Total con IVA de un gasto inicial (el IVA, redondeado al céntimo sobre la suma de sus líneas). */
export function totalGastoInicial(g: GastoInicial): number {
  const base = g.lineas.reduce((s, [, , , importe]) => s + importe, 0);
  return base + Math.round((base * g.ivaCentesimas) / 10_000);
}

export const PROVEEDORES_INICIALES: ProveedorInicial[] = [
  {
    nombre: "Arganour S.L.U.",
    nif: "B93243889",
    telefono: "+34 952 75 05 53",
    email: "hello@arganour.com",
    notas: "Calle Periana nº8, 29160 Casabermeja (Málaga).",
  },
  {
    nombre: "Área Estética S.L.",
    nif: "B10466480",
    telefono: "927 29 13 54",
    email: "areaestetica@areaestetica.es",
    notas: "Polígono Charca del Hambre, nave 14, 10190 Casar de Cáceres (Cáceres). www.areaestetica.es",
  },
];

/** Código del proveedor de cada producto (se guarda como referencia). */
export const REFERENCIA_DE: Record<string, string> = {
  "Extracto de olivo 15 ml": "MA040",
  "Extracto de aloe vera 15 ml": "MA038",
  "Extracto de soja orgánica 15 ml": "MA041",
  "Sérum hidratante de jojoba 30 ml": "MA186",
  "Crema hidratante total 50 ml": "MA030",
  "Crema antiarrugas de aguacate 100 ml": "MA047",
  "Crema regeneradora antiarrugas 100 ml": "MA048",
};

/** Grupo de cada producto en la web y en el TPV. El nombre es el de la factura, con mayúsculas normalizadas. */
export const GRUPO_DE: Record<string, GrupoProducto> = {
  "Balance - Sérum con Revinage (efecto retinol)": "Sérums y extractos",
  "Porcelain - Sérum antimanchas": "Sérums y extractos",
  "Purity - Sérum con vitamina C": "Sérums y extractos",
  "Velvet - Sérum minimizador de poros": "Sérums y extractos",
  "Sérum hidratante de jojoba 30 ml": "Sérums y extractos",
  "Extracto de olivo 15 ml": "Sérums y extractos",
  "Extracto de aloe vera 15 ml": "Sérums y extractos",
  "Extracto de soja orgánica 15 ml": "Sérums y extractos",
  "Crema hidratante total 50 ml": "Cremas y contorno de ojos",
  "Crema antiarrugas de aguacate 100 ml": "Cremas y contorno de ojos",
  "Crema regeneradora antiarrugas 100 ml": "Cremas y contorno de ojos",
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
  {
    // Solo las líneas marcadas en rojo (para vender). Las de 1 unidad a 0 € son las de regalo (descuento del 100 %).
    proveedor: "Área Estética S.L.",
    fecha: "2026-06-29",
    numeroFactura: "SF 26000034",
    ivaCentesimas: 2_100,
    descuento: 0,
    lineas: [
      ["Extracto de olivo 15 ml", 1, 1_340],
      ["Sérum hidratante de jojoba 30 ml", 1, 2_630],
      ["Crema hidratante total 50 ml", 2, 2_480],
      ["Crema hidratante total 50 ml", 1, 0],
      ["Crema antiarrugas de aguacate 100 ml", 2, 3_170],
      ["Crema antiarrugas de aguacate 100 ml", 1, 0],
      ["Crema regeneradora antiarrugas 100 ml", 2, 3_800],
      ["Crema regeneradora antiarrugas 100 ml", 1, 0],
      ["Extracto de aloe vera 15 ml", 2, 1_340],
      ["Extracto de aloe vera 15 ml", 1, 0],
      ["Extracto de olivo 15 ml", 2, 1_340],
      ["Extracto de olivo 15 ml", 1, 0],
      ["Extracto de soja orgánica 15 ml", 2, 1_410],
      ["Extracto de soja orgánica 15 ml", 1, 0],
      ["Sérum hidratante de jojoba 30 ml", 2, 2_630],
      ["Sérum hidratante de jojoba 30 ml", 1, 0],
    ],
  },
];

/** Productos de cabina: van a gastos, sin control de stock (decidido por el centro el 18 de octubre de 2026). */
export const GASTOS_INICIALES: GastoInicial[] = [
  {
    proveedor: "Área Estética S.L.",
    fecha: "2026-06-29",
    numeroFactura: "SF 26000034",
    concepto: "Productos de cabina",
    ivaCentesimas: 2_100,
    lineas: [
      ["PR592", "Sinergia relajante 30 ml", 1, 2_660],
      ["MA193", "Biocellular Botanic eye make-up remover 200 ml", 1, 1_900],
      ["MA001", "Leche limpiadora pieles sensibles 200 ml", 1, 1_560],
      ["MA056", "Scrub al karité 200 ml", 1, 2_160],
      ["MA045", "Lifting mask hyaluronic acid 100 ml", 1, 3_030],
      ["MA011", "Lifting serum hyaluronic acid 30 ml", 1, 4_590],
      ["PR654", "Hyaluronic acid veils mask 6 uds.", 1, 5_040],
      ["MA125", "Biocellular Damask rose eau de fleur 200 ml", 1, 1_870],
      ["MA015", "Eye & lip contour lifting hyaluronic acid 15 ml", 1, 2_690],
      ["MA027", "Energetic lifting complex cream 50 ml", 1, 3_690],
      ["AC955", "Set de moxas con aplicador facial", 1, 6_340],
      ["AC957", "Cucharas volcánicas", 1, 6_320],
      ["PR214", "Biocellular synergy 15 ml", 1, 3_260],
      ["MA816", "Revived skin cleansing balm with raspberry & ginger", 1, 2_360],
      ["PR604", "Biocellular Massada TM complex 30 ml", 1, 5_270],
      ["MA003", "Sensitive skin tonic with prebiotics 200 ml", 1, 1_560],
      ["MA805", "Multivitamin fusion (10 × 3 ml)", 1, 3_330],
      ["MA809", "C Mass vitamin serum 30 ml", 1, 3_270],
      ["PR574", "Mud facial mask 200 ml", 1, 3_090],
      ["MA046", "Facial mask sensitive skin 100 ml", 1, 1_890],
      ["MA014", "Antiaging pearls eye contour 15 ml", 1, 2_690],
      ["MA807", "Veggie comfort cream 30 ml", 1, 2_690],
      ["MA162", "Mineral Veil cellular longevity 50 ml", 1, 2_900],
      ["PR591", "Sinergia linfodrenante 30 ml", 1, 3_110],
      ["MA153", "Minceur intensive body oil 100 ml", 1, 1_950],
      ["PR612", "Minceur intensive wrap 1.000 ml", 1, 6_550],
      ["MA208", "Minceur intensive cream 200 ml", 1, 2_800],
      ["MA808", "Fruit concentrate peeling (10 × 2 ml)", 1, 3_260],
    ],
  },
];

export interface ProductoVenta {
  nombre: string;
  referencia?: string;
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
        ...(REFERENCIA_DE[nombre] ? { referencia: REFERENCIA_DE[nombre] } : {}),
        grupo,
        proveedor: compra.proveedor,
        costeCentimos,
        precioCentimos: PRECIO_ADELA[nombre] ?? precioConMargen(costeCentimos, MARGEN_VENTA, IVA_PRODUCTOS),
        ivaCentesimas: IVA_PRODUCTOS,
      });
    }
  }
  return [...productos.values()].sort(
    (a, b) => GRUPOS_PRODUCTO.indexOf(a.grupo) - GRUPOS_PRODUCTO.indexOf(b.grupo) || a.nombre.localeCompare(b.nombre, "es"),
  );
})();
