CREATE TABLE "avisos_atendidos" (
	"clave" text PRIMARY KEY NOT NULL,
	"posponer_hasta" date,
	"usuario_id" uuid NOT NULL,
	"cuando" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mensajes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"plantilla" text,
	"texto" text NOT NULL,
	"canal" text NOT NULL,
	"usuario_id" uuid NOT NULL,
	"cuando" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plantillas" (
	"clave" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"permiso" text NOT NULL,
	"texto" text NOT NULL,
	"actualizada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tareas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"texto" text NOT NULL,
	"fecha" date,
	"cliente_id" uuid,
	"creada_por" uuid NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"hecha_por" uuid,
	"hecha_en" timestamp with time zone,
	CONSTRAINT "tareas_texto" CHECK (length(trim("tareas"."texto")) between 2 and 300)
);
--> statement-breakpoint
ALTER TABLE "centro" ADD COLUMN "avisos" jsonb;--> statement-breakpoint
ALTER TABLE "avisos_atendidos" ADD CONSTRAINT "avisos_atendidos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_creada_por_usuarios_id_fk" FOREIGN KEY ("creada_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_hecha_por_usuarios_id_fk" FOREIGN KEY ("hecha_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mensajes_cliente" ON "mensajes" USING btree ("cliente_id","cuando");--> statement-breakpoint
CREATE INDEX "tareas_pendientes" ON "tareas" USING btree ("hecha_en","fecha");--> statement-breakpoint
-- Lo que se escribió a cada clienta queda en su ficha: no se edita ni se borra (salvo al suprimir sus datos).
CREATE TRIGGER mensajes_sin_cambios BEFORE UPDATE ON mensajes FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_inalterable();
