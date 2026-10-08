CREATE TYPE "public"."estado_cita" AS ENUM('pendiente', 'confirmada', 'realizada', 'no_presentada', 'cancelada');--> statement-breakpoint
CREATE TABLE "bloqueos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profesional_id" uuid,
	"inicio" timestamp with time zone NOT NULL,
	"fin" timestamp with time zone NOT NULL,
	"tipo" text NOT NULL,
	"motivo" text,
	"creado_por" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"anulado_en" timestamp with time zone,
	CONSTRAINT "bloqueos_intervalo" CHECK ("bloqueos"."inicio" < "bloqueos"."fin")
);
--> statement-breakpoint
CREATE TABLE "citas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"profesional_id" uuid NOT NULL,
	"inicio" timestamp with time zone NOT NULL,
	"fin" timestamp with time zone NOT NULL,
	"estado" "estado_cita" DEFAULT 'confirmada' NOT NULL,
	"origen" text NOT NULL,
	"serie_id" uuid,
	"solicitud_id" uuid,
	"nota" text,
	"creada_por" uuid,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizada_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "citas_intervalo" CHECK ("citas"."inicio" < "citas"."fin")
);
--> statement-breakpoint
CREATE TABLE "citas_servicios" (
	"cita_id" uuid NOT NULL,
	"orden" integer NOT NULL,
	"tratamiento_id" uuid NOT NULL,
	"duracion_minutos" integer NOT NULL,
	"precio_centimos" integer,
	CONSTRAINT "citas_servicios_cita_id_orden_pk" PRIMARY KEY("cita_id","orden")
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text,
	"email" text,
	"fecha_nacimiento" date,
	"notas" text,
	"acepta_avisos_citas" boolean DEFAULT false NOT NULL,
	"acepta_promociones" boolean DEFAULT false NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"anonimizada_en" timestamp with time zone,
	CONSTRAINT "clientes_nombre_valido" CHECK (length(trim("clientes"."nombre")) between 2 and 80)
);
--> statement-breakpoint
CREATE TABLE "consentimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"aceptado" boolean NOT NULL,
	"texto" text,
	"canal" text NOT NULL,
	"registrado_por" uuid,
	"cuando" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "horarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profesional_id" uuid NOT NULL,
	"dia_semana" integer NOT NULL,
	"inicio_min" integer NOT NULL,
	"fin_min" integer NOT NULL,
	CONSTRAINT "horarios_dia_valido" CHECK ("horarios"."dia_semana" between 1 and 7),
	CONSTRAINT "horarios_tramo_valido" CHECK ("horarios"."inicio_min" >= 0 and "horarios"."fin_min" <= 1440 and "horarios"."inicio_min" < "horarios"."fin_min" and "horarios"."inicio_min" % 5 = 0 and "horarios"."fin_min" % 5 = 0)
);
--> statement-breakpoint
CREATE TABLE "notas_clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"texto" text NOT NULL,
	"autor_id" uuid NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profesionales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"usuario_id" uuid,
	"color" text DEFAULT '#b08d57' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "profesionales_nombre_unique" UNIQUE("nombre"),
	CONSTRAINT "profesionales_usuarioId_unique" UNIQUE("usuario_id")
);
--> statement-breakpoint
CREATE TABLE "profesionales_tratamientos" (
	"profesional_id" uuid NOT NULL,
	"tratamiento_id" uuid NOT NULL,
	CONSTRAINT "profesionales_tratamientos_profesional_id_tratamiento_id_pk" PRIMARY KEY("profesional_id","tratamiento_id")
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cada_semanas" integer NOT NULL,
	"veces" integer NOT NULL,
	"creada_por" uuid NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bloqueos" ADD CONSTRAINT "bloqueos_profesional_id_profesionales_id_fk" FOREIGN KEY ("profesional_id") REFERENCES "public"."profesionales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bloqueos" ADD CONSTRAINT "bloqueos_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citas" ADD CONSTRAINT "citas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citas" ADD CONSTRAINT "citas_profesional_id_profesionales_id_fk" FOREIGN KEY ("profesional_id") REFERENCES "public"."profesionales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citas" ADD CONSTRAINT "citas_serie_id_series_id_fk" FOREIGN KEY ("serie_id") REFERENCES "public"."series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citas" ADD CONSTRAINT "citas_solicitud_id_solicitudes_reserva_id_fk" FOREIGN KEY ("solicitud_id") REFERENCES "public"."solicitudes_reserva"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citas" ADD CONSTRAINT "citas_creada_por_usuarios_id_fk" FOREIGN KEY ("creada_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citas_servicios" ADD CONSTRAINT "citas_servicios_cita_id_citas_id_fk" FOREIGN KEY ("cita_id") REFERENCES "public"."citas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citas_servicios" ADD CONSTRAINT "citas_servicios_tratamiento_id_tratamientos_id_fk" FOREIGN KEY ("tratamiento_id") REFERENCES "public"."tratamientos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consentimientos" ADD CONSTRAINT "consentimientos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consentimientos" ADD CONSTRAINT "consentimientos_registrado_por_usuarios_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horarios" ADD CONSTRAINT "horarios_profesional_id_profesionales_id_fk" FOREIGN KEY ("profesional_id") REFERENCES "public"."profesionales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_clientes" ADD CONSTRAINT "notas_clientes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_clientes" ADD CONSTRAINT "notas_clientes_autor_id_usuarios_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profesionales" ADD CONSTRAINT "profesionales_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profesionales_tratamientos" ADD CONSTRAINT "profesionales_tratamientos_profesional_id_profesionales_id_fk" FOREIGN KEY ("profesional_id") REFERENCES "public"."profesionales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profesionales_tratamientos" ADD CONSTRAINT "profesionales_tratamientos_tratamiento_id_tratamientos_id_fk" FOREIGN KEY ("tratamiento_id") REFERENCES "public"."tratamientos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_creada_por_usuarios_id_fk" FOREIGN KEY ("creada_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bloqueos_inicio" ON "bloqueos" USING btree ("inicio");--> statement-breakpoint
CREATE INDEX "citas_inicio" ON "citas" USING btree ("inicio");--> statement-breakpoint
CREATE INDEX "citas_cliente" ON "citas" USING btree ("cliente_id","inicio");--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_telefono_unico" ON "clientes" USING btree ("telefono") WHERE "clientes"."anonimizada_en" is null and "clientes"."telefono" is not null;--> statement-breakpoint
CREATE INDEX "clientes_nombre" ON "clientes" USING btree ("nombre");--> statement-breakpoint
CREATE INDEX "horarios_profesional" ON "horarios" USING btree ("profesional_id","dia_semana");--> statement-breakpoint
-- Sin doble reserva: dos citas no canceladas de la misma profesional no pueden solaparse.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "citas" ADD CONSTRAINT "citas_sin_solape"
  EXCLUDE USING gist ("profesional_id" WITH =, tstzrange("inicio", "fin", '[)') WITH &&)
  WHERE ("estado" <> 'cancelada');
--> statement-breakpoint
-- La duración de una cita es múltiplo de 5 minutos.
ALTER TABLE "citas" ADD CONSTRAINT "citas_tramos_5"
  CHECK (extract(epoch from ("fin" - "inicio"))::int % 300 = 0);
--> statement-breakpoint
CREATE TRIGGER clientes_sin_borrado BEFORE DELETE ON clientes FOR EACH ROW EXECUTE FUNCTION rechazar_borrado();
--> statement-breakpoint
CREATE TRIGGER citas_sin_borrado BEFORE DELETE ON citas FOR EACH ROW EXECUTE FUNCTION rechazar_borrado();
--> statement-breakpoint
CREATE TRIGGER consentimientos_inalterable BEFORE UPDATE OR DELETE ON consentimientos FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_inalterable();
--> statement-breakpoint
CREATE TRIGGER profesionales_sin_borrado BEFORE DELETE ON profesionales FOR EACH ROW EXECUTE FUNCTION rechazar_borrado();
--> statement-breakpoint
CREATE FUNCTION marcar_cita_actualizada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizada_en := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER citas_actualizada BEFORE UPDATE ON citas FOR EACH ROW EXECUTE FUNCTION marcar_cita_actualizada();
