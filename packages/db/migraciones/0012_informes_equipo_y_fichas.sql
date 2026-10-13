CREATE TABLE "consentimientos_firmados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"modelo_id" uuid NOT NULL,
	"nombre_modelo" text NOT NULL,
	"texto" text NOT NULL,
	"firma" text NOT NULL,
	"firmante" text NOT NULL,
	"cita_id" uuid,
	"registrado_por" uuid NOT NULL,
	"firmado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"revocado_en" timestamp with time zone,
	"revocado_por" uuid,
	CONSTRAINT "firma_tamano" CHECK (length("consentimientos_firmados"."firma") <= 400000)
);
--> statement-breakpoint
CREATE TABLE "fotos_clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"nota" text,
	"cita_id" uuid,
	"mime" text NOT NULL,
	"datos" "bytea" NOT NULL,
	"subida_por" uuid NOT NULL,
	"subida_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fotos_tamano" CHECK (octet_length("fotos_clientes"."datos") <= 3145728)
);
--> statement-breakpoint
CREATE TABLE "modelos_consentimiento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"texto" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modelos_consentimiento_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "modelos_consentimiento_tratamientos" (
	"modelo_id" uuid NOT NULL,
	"tratamiento_id" uuid NOT NULL,
	CONSTRAINT "modelos_consentimiento_tratamientos_modelo_id_tratamiento_id_pk" PRIMARY KEY("modelo_id","tratamiento_id")
);
--> statement-breakpoint
ALTER TABLE "profesionales" ADD COLUMN "comision_servicios" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profesionales" ADD COLUMN "comision_productos" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ventas" ADD COLUMN "profesional_id" uuid;--> statement-breakpoint
ALTER TABLE "consentimientos_firmados" ADD CONSTRAINT "consentimientos_firmados_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consentimientos_firmados" ADD CONSTRAINT "consentimientos_firmados_modelo_id_modelos_consentimiento_id_fk" FOREIGN KEY ("modelo_id") REFERENCES "public"."modelos_consentimiento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consentimientos_firmados" ADD CONSTRAINT "consentimientos_firmados_cita_id_citas_id_fk" FOREIGN KEY ("cita_id") REFERENCES "public"."citas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consentimientos_firmados" ADD CONSTRAINT "consentimientos_firmados_registrado_por_usuarios_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consentimientos_firmados" ADD CONSTRAINT "consentimientos_firmados_revocado_por_usuarios_id_fk" FOREIGN KEY ("revocado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotos_clientes" ADD CONSTRAINT "fotos_clientes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotos_clientes" ADD CONSTRAINT "fotos_clientes_cita_id_citas_id_fk" FOREIGN KEY ("cita_id") REFERENCES "public"."citas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotos_clientes" ADD CONSTRAINT "fotos_clientes_subida_por_usuarios_id_fk" FOREIGN KEY ("subida_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modelos_consentimiento_tratamientos" ADD CONSTRAINT "modelos_consentimiento_tratamientos_modelo_id_modelos_consentimiento_id_fk" FOREIGN KEY ("modelo_id") REFERENCES "public"."modelos_consentimiento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modelos_consentimiento_tratamientos" ADD CONSTRAINT "modelos_consentimiento_tratamientos_tratamiento_id_tratamientos_id_fk" FOREIGN KEY ("tratamiento_id") REFERENCES "public"."tratamientos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consentimientos_firmados_cliente" ON "consentimientos_firmados" USING btree ("cliente_id","firmado_en");--> statement-breakpoint
CREATE INDEX "fotos_cliente" ON "fotos_clientes" USING btree ("cliente_id","subida_en");--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_profesional_id_profesionales_id_fk" FOREIGN KEY ("profesional_id") REFERENCES "public"."profesionales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Un consentimiento firmado no se cambia: solo se puede revocar (y borrar si la clienta pide suprimir sus datos).
CREATE FUNCTION consentimiento_solo_revocar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - array['revocado_en', 'revocado_por']) IS DISTINCT FROM (to_jsonb(OLD) - array['revocado_en', 'revocado_por'])
     OR OLD.revocado_en IS NOT NULL THEN
    RAISE EXCEPTION 'Este registro solo admite añadir: un consentimiento firmado solo se puede revocar.';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER consentimientos_firmados_sin_cambios BEFORE UPDATE ON consentimientos_firmados FOR EACH ROW EXECUTE FUNCTION consentimiento_solo_revocar();
