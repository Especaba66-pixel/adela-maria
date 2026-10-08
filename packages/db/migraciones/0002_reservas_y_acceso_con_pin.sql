CREATE TYPE "public"."estado_solicitud" AS ENUM('pendiente', 'confirmada', 'rechazada');--> statement-breakpoint
CREATE TYPE "public"."franja" AS ENUM('manana', 'tarde', 'indiferente');--> statement-breakpoint
CREATE TABLE "solicitudes_reserva" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tratamiento_id" uuid NOT NULL,
	"fecha_preferida" date NOT NULL,
	"franja" "franja" NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text NOT NULL,
	"nota" text,
	"consentimiento_texto" text NOT NULL,
	"estado" "estado_solicitud" DEFAULT 'pendiente' NOT NULL,
	"gestionada_por" uuid,
	"gestionada_en" timestamp with time zone,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "solicitudes_reserva_nombre" CHECK (length(trim("solicitudes_reserva"."nombre")) between 2 and 80),
	CONSTRAINT "solicitudes_reserva_nota" CHECK ("solicitudes_reserva"."nota" is null or length("solicitudes_reserva"."nota") <= 500)
);
--> statement-breakpoint
ALTER TABLE "usuarios" ALTER COLUMN "hash_contrasena" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "solicitudes_reserva" ADD CONSTRAINT "solicitudes_reserva_tratamiento_id_tratamientos_id_fk" FOREIGN KEY ("tratamiento_id") REFERENCES "public"."tratamientos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes_reserva" ADD CONSTRAINT "solicitudes_reserva_gestionada_por_usuarios_id_fk" FOREIGN KEY ("gestionada_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "solicitudes_reserva_estado" ON "solicitudes_reserva" USING btree ("estado","creada_en");--> statement-breakpoint
CREATE INDEX "solicitudes_reserva_telefono" ON "solicitudes_reserva" USING btree ("telefono");--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_admin_con_contrasena" CHECK ("usuarios"."rol" <> 'administrador' or "usuarios"."hash_contrasena" is not null);--> statement-breakpoint
CREATE TRIGGER solicitudes_reserva_sin_borrado BEFORE DELETE ON solicitudes_reserva FOR EACH ROW EXECUTE FUNCTION rechazar_borrado();
--> statement-breakpoint
ALTER TABLE "solicitudes_reserva" ADD CONSTRAINT "solicitudes_reserva_fecha_futura"
  CHECK ("fecha_preferida" >= ("creada_en" AT TIME ZONE 'Europe/Madrid')::date);
