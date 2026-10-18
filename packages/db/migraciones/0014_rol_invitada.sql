ALTER TYPE "public"."rol" ADD VALUE 'invitada';--> statement-breakpoint
ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_admin_con_contrasena";--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_admin_con_contrasena" CHECK ("usuarios"."rol"::text not in ('administrador', 'invitada') or "usuarios"."hash_contrasena" is not null);