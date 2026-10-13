CREATE TABLE "campanas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"segmento" text NOT NULL,
	"plantilla" text NOT NULL,
	"total" integer NOT NULL,
	"usuario_id" uuid NOT NULL,
	"cuando" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "avisos_atendidos" ALTER COLUMN "usuario_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mensajes" ALTER COLUMN "cliente_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mensajes" ALTER COLUMN "usuario_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "centro" ADD COLUMN "whatsapp" jsonb;--> statement-breakpoint
ALTER TABLE "citas" ADD COLUMN "confirmada_por_clienta_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mensajes" ADD COLUMN "telefono" text;--> statement-breakpoint
ALTER TABLE "mensajes" ADD COLUMN "direccion" text DEFAULT 'saliente' NOT NULL;--> statement-breakpoint
ALTER TABLE "mensajes" ADD COLUMN "cita_id" uuid;--> statement-breakpoint
ALTER TABLE "mensajes" ADD COLUMN "campana_id" uuid;--> statement-breakpoint
ALTER TABLE "mensajes" ADD COLUMN "wa_id" text;--> statement-breakpoint
ALTER TABLE "mensajes" ADD COLUMN "estado" text;--> statement-breakpoint
ALTER TABLE "mensajes" ADD COLUMN "estado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mensajes" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "mensajes" ADD COLUMN "boton" text;--> statement-breakpoint
ALTER TABLE "mensajes" ADD COLUMN "responde" text;--> statement-breakpoint
ALTER TABLE "plantillas" ADD COLUMN "meta_nombre" text;--> statement-breakpoint
ALTER TABLE "plantillas" ADD COLUMN "meta_idioma" text DEFAULT 'es' NOT NULL;--> statement-breakpoint
ALTER TABLE "plantillas" ADD COLUMN "meta_categoria" text;--> statement-breakpoint
ALTER TABLE "plantillas" ADD COLUMN "meta_variables" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "plantillas" ADD COLUMN "meta_botones" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campanas" ADD CONSTRAINT "campanas_plantilla_plantillas_clave_fk" FOREIGN KEY ("plantilla") REFERENCES "public"."plantillas"("clave") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanas" ADD CONSTRAINT "campanas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_cita_id_citas_id_fk" FOREIGN KEY ("cita_id") REFERENCES "public"."citas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_campana_id_campanas_id_fk" FOREIGN KEY ("campana_id") REFERENCES "public"."campanas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mensajes_wa_id" ON "mensajes" USING btree ("wa_id");--> statement-breakpoint
CREATE INDEX "mensajes_entrantes" ON "mensajes" USING btree ("direccion","cuando");--> statement-breakpoint
CREATE UNIQUE INDEX "mensajes_api_cita_unico" ON "mensajes" USING btree ("cita_id","plantilla") WHERE "mensajes"."canal" = 'whatsapp_api' and "mensajes"."cita_id" is not null and "mensajes"."estado" <> 'fallido';--> statement-breakpoint
-- De un mensaje solo cambia cómo va el envío (Meta avisa de enviado, entregado, leído o fallido); lo demás no se toca.
DROP TRIGGER mensajes_sin_cambios ON mensajes;--> statement-breakpoint
CREATE FUNCTION mensajes_solo_estado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - array['wa_id', 'estado', 'estado_en', 'error']) IS DISTINCT FROM (to_jsonb(OLD) - array['wa_id', 'estado', 'estado_en', 'error'])
     OR (OLD.wa_id IS NOT NULL AND NEW.wa_id IS DISTINCT FROM OLD.wa_id) THEN
    RAISE EXCEPTION 'Este registro solo admite añadir: de un mensaje solo cambia el estado del envío.';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER mensajes_sin_cambios BEFORE UPDATE ON mensajes FOR EACH ROW EXECUTE FUNCTION mensajes_solo_estado();--> statement-breakpoint
CREATE TRIGGER campanas_sin_cambios BEFORE UPDATE OR DELETE ON campanas FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_inalterable();
