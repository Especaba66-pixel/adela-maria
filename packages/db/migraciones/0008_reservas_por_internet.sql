CREATE TABLE "reservas_online" (
	"id" text PRIMARY KEY NOT NULL,
	"cita_id" uuid,
	"solicitud_id" uuid,
	"importada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reservas_online" ADD CONSTRAINT "reservas_online_cita_id_citas_id_fk" FOREIGN KEY ("cita_id") REFERENCES "public"."citas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas_online" ADD CONSTRAINT "reservas_online_solicitud_id_solicitudes_reserva_id_fk" FOREIGN KEY ("solicitud_id") REFERENCES "public"."solicitudes_reserva"("id") ON DELETE no action ON UPDATE no action;