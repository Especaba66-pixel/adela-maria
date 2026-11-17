ALTER TABLE "citas" ADD COLUMN "a_la_vez" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tratamientos" ADD COLUMN "a_la_vez" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Dato de Espe (17 de noviembre de 2026): las citas no se solapan (una cabina), salvo la presoterapia, que va a la vez.
UPDATE "tratamientos" SET "a_la_vez" = true WHERE "nombre" ILIKE 'presoterapia%';
--> statement-breakpoint
UPDATE "citas" c SET "a_la_vez" = true
WHERE EXISTS (SELECT 1 FROM "citas_servicios" cs WHERE cs."cita_id" = c."id")
  AND NOT EXISTS (
    SELECT 1 FROM "citas_servicios" cs JOIN "tratamientos" t ON t."id" = cs."tratamiento_id"
    WHERE cs."cita_id" = c."id" AND NOT t."a_la_vez"
  );
--> statement-breakpoint
UPDATE "centro" SET "cabinas" = 1;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION comprobar_hueco_cita() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  capacidad integer;
  punto timestamptz;
  simultaneas integer;
BEGIN
  IF NEW.estado = 'cancelada' THEN
    RETURN NEW;
  END IF;
  -- Si no cambia ni cuándo ni de qué tipo es (solo el estado de una cita que ya contaba), no se vuelve a mirar: así
  -- las citas que ya coincidían de antes se pueden seguir marcando como hechas o no presentadas.
  IF TG_OP = 'UPDATE' AND OLD.estado <> 'cancelada' AND NEW.inicio = OLD.inicio AND NEW.fin = OLD.fin
     AND NEW.profesional_id = OLD.profesional_id AND NEW.exclusiva = OLD.exclusiva AND NEW.a_la_vez = OLD.a_la_vez THEN
    RETURN NEW;
  END IF;
  -- Una sola comprobación a la vez: dos reservas simultáneas no pueden colarse en la misma cabina.
  PERFORM pg_advisory_xact_lock(hashtext('adela_citas'));

  -- Exclusivas: nada puede coincidir con ellas para la misma profesional (tampoco la presoterapia).
  IF EXISTS (
    SELECT 1 FROM citas c
    WHERE c.id <> NEW.id AND c.estado <> 'cancelada' AND c.profesional_id = NEW.profesional_id
      AND c.inicio < NEW.fin AND NEW.inicio < c.fin
      AND (c.exclusiva OR NEW.exclusiva)
  ) THEN
    RAISE EXCEPTION 'cita_exclusiva' USING ERRCODE = 'exclusion_violation';
  END IF;

  -- «A la vez» (presoterapia): no ocupa cabina, pero dos no pueden coincidir (un solo aparato).
  IF NEW.a_la_vez THEN
    IF EXISTS (
      SELECT 1 FROM citas c
      WHERE c.id <> NEW.id AND c.estado <> 'cancelada' AND c.a_la_vez AND c.inicio < NEW.fin AND NEW.inicio < c.fin
    ) THEN
      RAISE EXCEPTION 'a_la_vez_ocupada' USING ERRCODE = 'exclusion_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- Cabinas: en ningún momento puede haber más citas a la vez que cabinas (sin contar las «a la vez»).
  SELECT coalesce(max(cabinas), 1) INTO capacidad FROM centro;
  FOR punto IN
    SELECT NEW.inicio
    UNION
    SELECT c.inicio FROM citas c
    WHERE c.id <> NEW.id AND c.estado <> 'cancelada' AND NOT c.a_la_vez AND c.inicio > NEW.inicio AND c.inicio < NEW.fin
  LOOP
    SELECT count(*) INTO simultaneas FROM citas c
    WHERE c.id <> NEW.id AND c.estado <> 'cancelada' AND NOT c.a_la_vez AND c.inicio <= punto AND punto < c.fin;
    IF simultaneas + 1 > capacidad THEN
      RAISE EXCEPTION 'cabinas_llenas' USING ERRCODE = 'exclusion_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER "citas_comprobar_hueco" ON "citas";
--> statement-breakpoint
CREATE TRIGGER citas_comprobar_hueco
  BEFORE INSERT OR UPDATE OF inicio, fin, estado, profesional_id, exclusiva, a_la_vez ON citas
  FOR EACH ROW EXECUTE FUNCTION comprobar_hueco_cita();
