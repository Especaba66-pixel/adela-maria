CREATE TYPE "public"."metodo_pago" AS ENUM('efectivo', 'tarjeta', 'bizum');--> statement-breakpoint
CREATE TABLE "facturas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"serie" text NOT NULL,
	"numero" integer NOT NULL,
	"numero_completo" text NOT NULL,
	"tipo" text NOT NULL,
	"fecha_expedicion" date NOT NULL,
	"expedida_en" timestamp with time zone DEFAULT now() NOT NULL,
	"venta_id" uuid NOT NULL,
	"rectifica_a" uuid,
	"emisor" jsonb NOT NULL,
	"destinatario" jsonb,
	"desglose" jsonb NOT NULL,
	"base_total" integer NOT NULL,
	"cuota_total" integer NOT NULL,
	"total" integer NOT NULL,
	CONSTRAINT "facturas_numeroCompleto_unique" UNIQUE("numero_completo")
);
--> statement-breakpoint
CREATE TABLE "lineas_venta" (
	"venta_id" uuid NOT NULL,
	"orden" integer NOT NULL,
	"tratamiento_id" uuid,
	"descripcion" text NOT NULL,
	"cantidad" integer NOT NULL,
	"precio_unitario" integer NOT NULL,
	"descuento_centesimas" integer DEFAULT 0 NOT NULL,
	"iva_centesimas" integer NOT NULL,
	"total" integer NOT NULL,
	CONSTRAINT "lineas_venta_venta_id_orden_pk" PRIMARY KEY("venta_id","orden")
);
--> statement-breakpoint
CREATE TABLE "movimientos_caja" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"sesion_caja_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"importe" integer NOT NULL,
	"concepto" text,
	"pago_id" uuid,
	"usuario_id" uuid NOT NULL,
	"cuando" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venta_id" uuid NOT NULL,
	"metodo" "metodo_pago" NOT NULL,
	"importe" integer NOT NULL,
	"entregado" integer,
	"sesion_caja_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"cuando" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registros_facturacion" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"factura_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"huella" text NOT NULL,
	"huella_anterior" text,
	"datos" jsonb NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registros_facturacion_huella_unique" UNIQUE("huella")
);
--> statement-breakpoint
CREATE TABLE "series_facturacion" (
	"codigo" text PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"anio" integer NOT NULL,
	"ultimo_numero" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sesiones_caja" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"abierta_en" timestamp with time zone DEFAULT now() NOT NULL,
	"abierta_por" uuid NOT NULL,
	"fondo_inicial" integer NOT NULL,
	"cerrada_en" timestamp with time zone,
	"cerrada_por" uuid,
	"efectivo_esperado" integer,
	"efectivo_contado" integer,
	"notas_cierre" text
);
--> statement-breakpoint
CREATE TABLE "ventas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid,
	"cita_id" uuid,
	"devolucion_de" uuid,
	"total" integer NOT NULL,
	"creada_por" uuid NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "centro" ADD COLUMN "nombre_fiscal" text;--> statement-breakpoint
ALTER TABLE "centro" ADD COLUMN "direccion_fiscal" text;--> statement-breakpoint
ALTER TABLE "centro" ADD COLUMN "pie_ticket" text;--> statement-breakpoint
ALTER TABLE "centro" ADD COLUMN "impresora" jsonb;--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_serie_series_facturacion_codigo_fk" FOREIGN KEY ("serie") REFERENCES "public"."series_facturacion"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineas_venta" ADD CONSTRAINT "lineas_venta_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineas_venta" ADD CONSTRAINT "lineas_venta_tratamiento_id_tratamientos_id_fk" FOREIGN KEY ("tratamiento_id") REFERENCES "public"."tratamientos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_sesion_caja_id_sesiones_caja_id_fk" FOREIGN KEY ("sesion_caja_id") REFERENCES "public"."sesiones_caja"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_pago_id_pagos_id_fk" FOREIGN KEY ("pago_id") REFERENCES "public"."pagos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_sesion_caja_id_sesiones_caja_id_fk" FOREIGN KEY ("sesion_caja_id") REFERENCES "public"."sesiones_caja"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_facturacion" ADD CONSTRAINT "registros_facturacion_factura_id_facturas_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."facturas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones_caja" ADD CONSTRAINT "sesiones_caja_abierta_por_usuarios_id_fk" FOREIGN KEY ("abierta_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones_caja" ADD CONSTRAINT "sesiones_caja_cerrada_por_usuarios_id_fk" FOREIGN KEY ("cerrada_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cita_id_citas_id_fk" FOREIGN KEY ("cita_id") REFERENCES "public"."citas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_creada_por_usuarios_id_fk" FOREIGN KEY ("creada_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "facturas_serie_numero" ON "facturas" USING btree ("serie","numero");--> statement-breakpoint
CREATE INDEX "facturas_venta" ON "facturas" USING btree ("venta_id");--> statement-breakpoint
CREATE INDEX "movimientos_caja_sesion" ON "movimientos_caja" USING btree ("sesion_caja_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ventas_una_por_cita" ON "ventas" USING btree ("cita_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ventas_una_devolucion" ON "ventas" USING btree ("devolucion_de");--> statement-breakpoint
CREATE INDEX "ventas_creada" ON "ventas" USING btree ("creada_en");--> statement-breakpoint
-- Solo una caja abierta a la vez.
CREATE UNIQUE INDEX "sesiones_caja_una_abierta" ON "sesiones_caja" ((true)) WHERE "cerrada_en" IS NULL;
--> statement-breakpoint
-- La cadena de registros no admite bifurcaciones: cada huella solo puede ser «anterior» de un registro
-- (y solo el primero no tiene anterior).
CREATE UNIQUE INDEX "registros_facturacion_cadena" ON "registros_facturacion" ("huella_anterior") NULLS NOT DISTINCT;
--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_devolucion_de_fk" FOREIGN KEY ("devolucion_de") REFERENCES "ventas"("id");
--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_rectifica_a_fk" FOREIGN KEY ("rectifica_a") REFERENCES "facturas"("id");
--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_cuadra" CHECK ("base_total" + "cuota_total" = "total");
--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_rectificativa_con_original" CHECK (("tipo" = 'rectificativa') = ("rectifica_a" IS NOT NULL));
--> statement-breakpoint
ALTER TABLE "lineas_venta" ADD CONSTRAINT "lineas_venta_valores" CHECK ("cantidad" <> 0 AND "precio_unitario" >= 0 AND "descuento_centesimas" BETWEEN 0 AND 10000 AND "iva_centesimas" BETWEEN 0 AND 10000);
--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_no_cero" CHECK ("importe" <> 0);
--> statement-breakpoint
ALTER TABLE "sesiones_caja" ADD CONSTRAINT "sesiones_caja_fondo" CHECK ("fondo_inicial" >= 0);
--> statement-breakpoint
-- Lo cobrado y lo facturado no se edita ni se borra.
CREATE TRIGGER ventas_inalterable BEFORE UPDATE OR DELETE ON ventas FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_inalterable();
--> statement-breakpoint
CREATE TRIGGER lineas_venta_inalterable BEFORE UPDATE OR DELETE ON lineas_venta FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_inalterable();
--> statement-breakpoint
CREATE TRIGGER pagos_inalterable BEFORE UPDATE OR DELETE ON pagos FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_inalterable();
--> statement-breakpoint
CREATE TRIGGER movimientos_caja_inalterable BEFORE UPDATE OR DELETE ON movimientos_caja FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_inalterable();
--> statement-breakpoint
CREATE TRIGGER facturas_inalterable BEFORE UPDATE OR DELETE ON facturas FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_inalterable();
--> statement-breakpoint
CREATE TRIGGER registros_facturacion_inalterable BEFORE UPDATE OR DELETE ON registros_facturacion FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_inalterable();
--> statement-breakpoint
CREATE TRIGGER registros_facturacion_sin_vaciar BEFORE TRUNCATE ON registros_facturacion FOR EACH STATEMENT EXECUTE FUNCTION rechazar_cambio_inalterable();
--> statement-breakpoint
CREATE TRIGGER facturas_sin_vaciar BEFORE TRUNCATE ON facturas FOR EACH STATEMENT EXECUTE FUNCTION rechazar_cambio_inalterable();
--> statement-breakpoint
-- La sesión de caja solo cambia para cerrarse, una vez.
CREATE FUNCTION proteger_sesion_caja() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.cerrada_en IS NOT NULL
     OR NEW.abierta_en <> OLD.abierta_en OR NEW.abierta_por <> OLD.abierta_por OR NEW.fondo_inicial <> OLD.fondo_inicial THEN
    RAISE EXCEPTION 'La caja cerrada no se modifica' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER sesiones_caja_proteger BEFORE UPDATE OR DELETE ON sesiones_caja FOR EACH ROW EXECUTE FUNCTION proteger_sesion_caja();
--> statement-breakpoint
-- Los pagos solo se anotan en una caja abierta.
CREATE FUNCTION pago_en_caja_abierta() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sesiones_caja WHERE id = NEW.sesion_caja_id AND cerrada_en IS NULL) THEN
    RAISE EXCEPTION 'caja_cerrada' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER pagos_caja_abierta BEFORE INSERT ON pagos FOR EACH ROW EXECUTE FUNCTION pago_en_caja_abierta();
--> statement-breakpoint
CREATE TRIGGER movimientos_caja_abierta BEFORE INSERT ON movimientos_caja FOR EACH ROW EXECUTE FUNCTION pago_en_caja_abierta();
