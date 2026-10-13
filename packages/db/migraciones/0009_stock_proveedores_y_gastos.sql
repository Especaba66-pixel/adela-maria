CREATE TABLE "compras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proveedor_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"numero_factura" text,
	"notas" text,
	"usuario_id" uuid NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consumos_tratamiento" (
	"tratamiento_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"cantidad" integer NOT NULL,
	CONSTRAINT "consumos_tratamiento_tratamiento_id_producto_id_pk" PRIMARY KEY("tratamiento_id","producto_id"),
	CONSTRAINT "consumos_cantidad_positiva" CHECK ("consumos_tratamiento"."cantidad" > 0)
);
--> statement-breakpoint
CREATE TABLE "gastos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fecha" date NOT NULL,
	"categoria" text NOT NULL,
	"concepto" text NOT NULL,
	"proveedor_id" uuid,
	"numero_factura" text,
	"base" integer NOT NULL,
	"iva_centesimas" integer NOT NULL,
	"cuota" integer NOT NULL,
	"total" integer NOT NULL,
	"compra_id" uuid,
	"pago_caja" boolean DEFAULT false NOT NULL,
	"usuario_id" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"anulado_en" timestamp with time zone,
	CONSTRAINT "gastos_cuadra" CHECK ("gastos"."base" + "gastos"."cuota" = "gastos"."total"),
	CONSTRAINT "gastos_iva_valido" CHECK ("gastos"."iva_centesimas" between 0 and 10000)
);
--> statement-breakpoint
CREATE TABLE "lineas_compra" (
	"compra_id" uuid NOT NULL,
	"orden" integer NOT NULL,
	"producto_id" uuid NOT NULL,
	"cantidad" integer NOT NULL,
	"coste_unitario" integer NOT NULL,
	CONSTRAINT "lineas_compra_compra_id_orden_pk" PRIMARY KEY("compra_id","orden"),
	CONSTRAINT "lineas_compra_cantidad" CHECK ("lineas_compra"."cantidad" > 0),
	CONSTRAINT "lineas_compra_coste" CHECK ("lineas_compra"."coste_unitario" >= 0)
);
--> statement-breakpoint
CREATE TABLE "movimientos_stock" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"producto_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"cantidad" integer NOT NULL,
	"compra_id" uuid,
	"venta_id" uuid,
	"cita_id" uuid,
	"motivo" text,
	"usuario_id" uuid NOT NULL,
	"cuando" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movimientos_stock_no_cero" CHECK ("movimientos_stock"."cantidad" <> 0)
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"uso" text NOT NULL,
	"referencia" text,
	"precio_centimos" integer,
	"iva_centesimas" integer,
	"coste_centimos" integer,
	"stock_minimo" integer DEFAULT 0 NOT NULL,
	"proveedor_id" uuid,
	"anulado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "productos_nombre_unique" UNIQUE("nombre"),
	CONSTRAINT "productos_precio_no_negativo" CHECK ("productos"."precio_centimos" is null or "productos"."precio_centimos" >= 0),
	CONSTRAINT "productos_iva_valido" CHECK ("productos"."iva_centesimas" is null or "productos"."iva_centesimas" between 0 and 10000),
	CONSTRAINT "productos_minimo_no_negativo" CHECK ("productos"."stock_minimo" >= 0)
);
--> statement-breakpoint
CREATE TABLE "proveedores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"nif" text,
	"telefono" text,
	"email" text,
	"notas" text,
	"anulado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proveedores_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
ALTER TABLE "lineas_venta" ADD COLUMN "producto_id" uuid;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumos_tratamiento" ADD CONSTRAINT "consumos_tratamiento_tratamiento_id_tratamientos_id_fk" FOREIGN KEY ("tratamiento_id") REFERENCES "public"."tratamientos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumos_tratamiento" ADD CONSTRAINT "consumos_tratamiento_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_compra_id_compras_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineas_compra" ADD CONSTRAINT "lineas_compra_compra_id_compras_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineas_compra" ADD CONSTRAINT "lineas_compra_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_compra_id_compras_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_cita_id_citas_id_fk" FOREIGN KEY ("cita_id") REFERENCES "public"."citas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gastos_fecha" ON "gastos" USING btree ("fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "gastos_una_por_compra" ON "gastos" USING btree ("compra_id");--> statement-breakpoint
CREATE INDEX "movimientos_stock_producto" ON "movimientos_stock" USING btree ("producto_id");--> statement-breakpoint
ALTER TABLE "lineas_venta" ADD CONSTRAINT "lineas_venta_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- El historial de stock y las compras solo crecen: un error se corrige con otro movimiento.
CREATE TRIGGER movimientos_stock_inalterable BEFORE UPDATE OR DELETE ON movimientos_stock FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_inalterable();
--> statement-breakpoint
CREATE TRIGGER compras_inalterable BEFORE UPDATE OR DELETE ON compras FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_inalterable();
--> statement-breakpoint
CREATE TRIGGER lineas_compra_inalterable BEFORE UPDATE OR DELETE ON lineas_compra FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_inalterable();
--> statement-breakpoint
-- Productos, proveedores y gastos no se borran: se marcan como anulados.
CREATE TRIGGER productos_sin_borrado BEFORE DELETE ON productos FOR EACH ROW EXECUTE FUNCTION rechazar_borrado();
--> statement-breakpoint
CREATE TRIGGER proveedores_sin_borrado BEFORE DELETE ON proveedores FOR EACH ROW EXECUTE FUNCTION rechazar_borrado();
--> statement-breakpoint
CREATE TRIGGER gastos_sin_borrado BEFORE DELETE ON gastos FOR EACH ROW EXECUTE FUNCTION rechazar_borrado();
