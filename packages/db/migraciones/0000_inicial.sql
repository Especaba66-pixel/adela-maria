CREATE TYPE "public"."rol" AS ENUM('administrador', 'recepcion', 'profesional');--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"anulado_en" timestamp with time zone,
	CONSTRAINT "categorias_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "centro" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"nif" text,
	"direccion" text,
	"telefono" text,
	"zona_horaria" text DEFAULT 'Europe/Madrid' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copias_seguridad" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"correcta" boolean NOT NULL,
	"archivo" text,
	"bytes" integer,
	"detalle" text,
	"cuando" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispositivos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hash_token" text NOT NULL,
	"nombre" text NOT NULL,
	"registrado_por" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_uso" timestamp with time zone DEFAULT now() NOT NULL,
	"revocado_en" timestamp with time zone,
	CONSTRAINT "dispositivos_hashToken_unique" UNIQUE("hash_token")
);
--> statement-breakpoint
CREATE TABLE "registro_actividad" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"cuando" timestamp with time zone DEFAULT now() NOT NULL,
	"usuario_id" uuid,
	"accion" text NOT NULL,
	"entidad" text,
	"entidad_id" text,
	"antes" jsonb,
	"despues" jsonb
);
--> statement-breakpoint
CREATE TABLE "sesiones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hash_token" text NOT NULL,
	"usuario_id" uuid NOT NULL,
	"dispositivo_id" uuid,
	"metodo" text NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"ultima_actividad" timestamp with time zone DEFAULT now() NOT NULL,
	"cerrada_en" timestamp with time zone,
	CONSTRAINT "sesiones_hashToken_unique" UNIQUE("hash_token")
);
--> statement-breakpoint
CREATE TABLE "tipos_bono" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"sesiones" integer NOT NULL,
	"precio_centimos" integer NOT NULL,
	"validez_dias" integer,
	"anulado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tipos_bono_nombre_unique" UNIQUE("nombre"),
	CONSTRAINT "tipos_bono_sesiones_positivas" CHECK ("tipos_bono"."sesiones" > 0),
	CONSTRAINT "tipos_bono_precio_no_negativo" CHECK ("tipos_bono"."precio_centimos" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tipos_bono_tratamientos" (
	"tipo_bono_id" uuid NOT NULL,
	"tratamiento_id" uuid NOT NULL,
	CONSTRAINT "tipos_bono_tratamientos_tipo_bono_id_tratamiento_id_pk" PRIMARY KEY("tipo_bono_id","tratamiento_id")
);
--> statement-breakpoint
CREATE TABLE "tratamientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"categoria_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"duracion_minutos" integer NOT NULL,
	"precio_centimos" integer NOT NULL,
	"iva_centesimas" integer,
	"orden" integer DEFAULT 0 NOT NULL,
	"anulado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tratamientos_duracion_tramos_5" CHECK ("tratamientos"."duracion_minutos" > 0 and "tratamientos"."duracion_minutos" % 5 = 0),
	CONSTRAINT "tratamientos_precio_no_negativo" CHECK ("tratamientos"."precio_centimos" >= 0),
	CONSTRAINT "tratamientos_iva_valido" CHECK ("tratamientos"."iva_centesimas" is null or "tratamientos"."iva_centesimas" between 0 and 10000)
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centro_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"usuario" text NOT NULL,
	"hash_contrasena" text NOT NULL,
	"hash_pin" text,
	"rol" "rol" NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"intentos_fallidos" integer DEFAULT 0 NOT NULL,
	"bloqueado_hasta" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dispositivos" ADD CONSTRAINT "dispositivos_registrado_por_usuarios_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registro_actividad" ADD CONSTRAINT "registro_actividad_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_dispositivo_id_dispositivos_id_fk" FOREIGN KEY ("dispositivo_id") REFERENCES "public"."dispositivos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipos_bono_tratamientos" ADD CONSTRAINT "tipos_bono_tratamientos_tipo_bono_id_tipos_bono_id_fk" FOREIGN KEY ("tipo_bono_id") REFERENCES "public"."tipos_bono"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipos_bono_tratamientos" ADD CONSTRAINT "tipos_bono_tratamientos_tratamiento_id_tratamientos_id_fk" FOREIGN KEY ("tratamiento_id") REFERENCES "public"."tratamientos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tratamientos" ADD CONSTRAINT "tratamientos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_centro_id_centro_id_fk" FOREIGN KEY ("centro_id") REFERENCES "public"."centro"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registro_actividad_cuando" ON "registro_actividad" USING btree ("cuando");--> statement-breakpoint
CREATE INDEX "sesiones_usuario" ON "sesiones" USING btree ("usuario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tratamientos_nombre_por_categoria" ON "tratamientos" USING btree ("categoria_id","nombre");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_usuario_unico" ON "usuarios" USING btree ("usuario");