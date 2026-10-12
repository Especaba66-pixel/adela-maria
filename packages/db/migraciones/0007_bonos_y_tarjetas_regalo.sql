ALTER TYPE "public"."metodo_pago" ADD VALUE 'tarjeta_regalo';--> statement-breakpoint
CREATE TABLE "bonos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo_bono_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"venta_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"sesiones" integer NOT NULL,
	"comprado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"caduca_en" date,
	"anulado_en" timestamp with time zone,
	CONSTRAINT "bonos_sesiones_positivas" CHECK ("bonos"."sesiones" > 0)
);
--> statement-breakpoint
CREATE TABLE "bonos_tratamientos" (
	"bono_id" uuid NOT NULL,
	"tratamiento_id" uuid NOT NULL,
	CONSTRAINT "bonos_tratamientos_bono_id_tratamiento_id_pk" PRIMARY KEY("bono_id","tratamiento_id")
);
--> statement-breakpoint
CREATE TABLE "movimientos_tarjeta_regalo" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tarjeta_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"importe" integer NOT NULL,
	"pago_id" uuid,
	"usuario_id" uuid NOT NULL,
	"cuando" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movimientos_tarjeta_regalo_no_cero" CHECK ("movimientos_tarjeta_regalo"."importe" <> 0)
);
--> statement-breakpoint
CREATE TABLE "tarjetas_regalo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"importe_inicial" integer NOT NULL,
	"para" text,
	"de_parte" text,
	"cliente_id" uuid,
	"venta_id" uuid NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"anulada_en" timestamp with time zone,
	CONSTRAINT "tarjetas_regalo_codigo_unique" UNIQUE("codigo"),
	CONSTRAINT "tarjetas_regalo_importe_positivo" CHECK ("tarjetas_regalo"."importe_inicial" > 0)
);
--> statement-breakpoint
CREATE TABLE "usos_bono" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bono_id" uuid NOT NULL,
	"cantidad" integer NOT NULL,
	"tratamiento_id" uuid,
	"cita_id" uuid,
	"venta_id" uuid,
	"motivo" text,
	"usuario_id" uuid NOT NULL,
	"cuando" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usos_bono_cantidad" CHECK ("usos_bono"."cantidad" in (1, -1)),
	CONSTRAINT "usos_bono_correccion_con_motivo" CHECK ("usos_bono"."cantidad" = 1 or "usos_bono"."motivo" is not null)
);
--> statement-breakpoint
ALTER TABLE "lineas_venta" ADD COLUMN "tipo_bono_id" uuid;--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "tarjeta_regalo_id" uuid;--> statement-breakpoint
ALTER TABLE "tipos_bono" ADD COLUMN "iva_centesimas" integer;--> statement-breakpoint
ALTER TABLE "ventas" ADD COLUMN "con_factura" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "bonos" ADD CONSTRAINT "bonos_tipo_bono_id_tipos_bono_id_fk" FOREIGN KEY ("tipo_bono_id") REFERENCES "public"."tipos_bono"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bonos" ADD CONSTRAINT "bonos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bonos" ADD CONSTRAINT "bonos_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bonos_tratamientos" ADD CONSTRAINT "bonos_tratamientos_bono_id_bonos_id_fk" FOREIGN KEY ("bono_id") REFERENCES "public"."bonos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bonos_tratamientos" ADD CONSTRAINT "bonos_tratamientos_tratamiento_id_tratamientos_id_fk" FOREIGN KEY ("tratamiento_id") REFERENCES "public"."tratamientos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_tarjeta_regalo" ADD CONSTRAINT "movimientos_tarjeta_regalo_tarjeta_id_tarjetas_regalo_id_fk" FOREIGN KEY ("tarjeta_id") REFERENCES "public"."tarjetas_regalo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_tarjeta_regalo" ADD CONSTRAINT "movimientos_tarjeta_regalo_pago_id_pagos_id_fk" FOREIGN KEY ("pago_id") REFERENCES "public"."pagos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_tarjeta_regalo" ADD CONSTRAINT "movimientos_tarjeta_regalo_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarjetas_regalo" ADD CONSTRAINT "tarjetas_regalo_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarjetas_regalo" ADD CONSTRAINT "tarjetas_regalo_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usos_bono" ADD CONSTRAINT "usos_bono_bono_id_bonos_id_fk" FOREIGN KEY ("bono_id") REFERENCES "public"."bonos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usos_bono" ADD CONSTRAINT "usos_bono_tratamiento_id_tratamientos_id_fk" FOREIGN KEY ("tratamiento_id") REFERENCES "public"."tratamientos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usos_bono" ADD CONSTRAINT "usos_bono_cita_id_citas_id_fk" FOREIGN KEY ("cita_id") REFERENCES "public"."citas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usos_bono" ADD CONSTRAINT "usos_bono_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usos_bono" ADD CONSTRAINT "usos_bono_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bonos_cliente" ON "bonos" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "bonos_venta" ON "bonos" USING btree ("venta_id");--> statement-breakpoint
CREATE INDEX "movimientos_tarjeta_regalo_tarjeta" ON "movimientos_tarjeta_regalo" USING btree ("tarjeta_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tarjetas_regalo_venta" ON "tarjetas_regalo" USING btree ("venta_id");--> statement-breakpoint
CREATE INDEX "usos_bono_bono" ON "usos_bono" USING btree ("bono_id");--> statement-breakpoint
CREATE INDEX "usos_bono_cita" ON "usos_bono" USING btree ("cita_id");--> statement-breakpoint
ALTER TABLE "lineas_venta" ADD CONSTRAINT "lineas_venta_tipo_bono_id_tipos_bono_id_fk" FOREIGN KEY ("tipo_bono_id") REFERENCES "public"."tipos_bono"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_tarjeta_regalo_id_tarjetas_regalo_id_fk" FOREIGN KEY ("tarjeta_regalo_id") REFERENCES "public"."tarjetas_regalo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipos_bono" ADD CONSTRAINT "tipos_bono_iva_valido" CHECK ("tipos_bono"."iva_centesimas" is null or "tipos_bono"."iva_centesimas" between 0 and 10000);--> statement-breakpoint
-- Un pago con tarjeta regalo dice siempre con qué tarjeta; los demás pagos, nunca.
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_tarjeta_regalo_con_tarjeta" CHECK (("metodo"::text = 'tarjeta_regalo') = ("tarjeta_regalo_id" IS NOT NULL));
--> statement-breakpoint
-- Historiales que solo crecen: sesiones gastadas, movimientos de saldo y tratamientos de cada bono vendido.
CREATE TRIGGER usos_bono_inalterable BEFORE UPDATE OR DELETE ON usos_bono FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_inalterable();
--> statement-breakpoint
CREATE TRIGGER movimientos_tarjeta_regalo_inalterable BEFORE UPDATE OR DELETE ON movimientos_tarjeta_regalo FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_inalterable();
--> statement-breakpoint
CREATE TRIGGER bonos_tratamientos_inalterable BEFORE UPDATE OR DELETE ON bonos_tratamientos FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_inalterable();
--> statement-breakpoint
-- Bonos y tarjetas no se borran ni se editan: solo se pueden anular, una vez (la columna va como argumento).
CREATE FUNCTION solo_anular() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (to_jsonb(OLD) ->> TG_ARGV[0]) IS NOT NULL
     OR (to_jsonb(NEW) - TG_ARGV[0]) <> (to_jsonb(OLD) - TG_ARGV[0]) THEN
    RAISE EXCEPTION 'En % solo se puede anular, una vez', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER bonos_solo_anular BEFORE UPDATE OR DELETE ON bonos FOR EACH ROW EXECUTE FUNCTION solo_anular('anulado_en');
--> statement-breakpoint
CREATE TRIGGER tarjetas_regalo_solo_anular BEFORE UPDATE OR DELETE ON tarjetas_regalo FOR EACH ROW EXECUTE FUNCTION solo_anular('anulada_en');
--> statement-breakpoint
-- Cada sesión gastada: el bono existe, no está anulado ni caducado, cubre ese tratamiento y le quedan sesiones.
-- Se bloquea la fila del bono para que dos cobros a la vez no gasten la misma sesión.
CREATE FUNCTION comprobar_uso_bono() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  b bonos%ROWTYPE;
  usadas integer;
BEGIN
  SELECT * INTO b FROM bonos WHERE id = NEW.bono_id FOR UPDATE;
  IF b.anulado_en IS NOT NULL THEN
    RAISE EXCEPTION 'bono_anulado' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.cantidad > 0 AND b.caduca_en IS NOT NULL AND b.caduca_en < (now() AT TIME ZONE 'Europe/Madrid')::date THEN
    RAISE EXCEPTION 'bono_caducado' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.cantidad > 0 AND NEW.tratamiento_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM bonos_tratamientos WHERE bono_id = b.id AND tratamiento_id = NEW.tratamiento_id) THEN
    RAISE EXCEPTION 'bono_no_cubre' USING ERRCODE = 'check_violation';
  END IF;
  SELECT coalesce(sum(cantidad), 0) INTO usadas FROM usos_bono WHERE bono_id = b.id;
  IF usadas + NEW.cantidad > b.sesiones THEN
    RAISE EXCEPTION 'bono_agotado' USING ERRCODE = 'check_violation';
  END IF;
  IF usadas + NEW.cantidad < 0 THEN
    RAISE EXCEPTION 'bono_sin_usos' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER usos_bono_comprobar BEFORE INSERT ON usos_bono FOR EACH ROW EXECUTE FUNCTION comprobar_uso_bono();
--> statement-breakpoint
-- El saldo de una tarjeta regalo nunca queda en negativo, y una tarjeta anulada no se puede usar.
CREATE FUNCTION comprobar_movimiento_tarjeta() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  t tarjetas_regalo%ROWTYPE;
  saldo integer;
BEGIN
  SELECT * INTO t FROM tarjetas_regalo WHERE id = NEW.tarjeta_id FOR UPDATE;
  IF t.anulada_en IS NOT NULL THEN
    RAISE EXCEPTION 'tarjeta_anulada' USING ERRCODE = 'check_violation';
  END IF;
  SELECT coalesce(sum(importe), 0) INTO saldo FROM movimientos_tarjeta_regalo WHERE tarjeta_id = t.id;
  IF saldo + NEW.importe < 0 THEN
    RAISE EXCEPTION 'tarjeta_sin_saldo' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER movimientos_tarjeta_regalo_comprobar BEFORE INSERT ON movimientos_tarjeta_regalo FOR EACH ROW EXECUTE FUNCTION comprobar_movimiento_tarjeta();
