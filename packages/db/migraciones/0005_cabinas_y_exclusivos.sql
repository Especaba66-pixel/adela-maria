ALTER TABLE "centro" ADD COLUMN "cabinas" integer;--> statement-breakpoint
ALTER TABLE "citas" ADD COLUMN "exclusiva" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tratamientos" ADD COLUMN "exclusivo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Antes: nunca dos citas a la vez de la misma profesional. Ahora: una por cabina, y las exclusivas solas.
ALTER TABLE "citas" DROP CONSTRAINT "citas_sin_solape";
--> statement-breakpoint
ALTER TABLE "centro" ADD CONSTRAINT "centro_cabinas_validas" CHECK ("cabinas" IS NULL OR "cabinas" BETWEEN 1 AND 20);
--> statement-breakpoint
CREATE FUNCTION comprobar_hueco_cita() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  capacidad integer;
  punto timestamptz;
  simultaneas integer;
BEGIN
  IF NEW.estado = 'cancelada' THEN
    RETURN NEW;
  END IF;
  -- Una sola comprobación a la vez: dos reservas simultáneas no pueden colarse en la misma cabina.
  PERFORM pg_advisory_xact_lock(hashtext('adela_citas'));

  -- Exclusivas: nada puede coincidir con ellas para la misma profesional.
  IF EXISTS (
    SELECT 1 FROM citas c
    WHERE c.id <> NEW.id AND c.estado <> 'cancelada' AND c.profesional_id = NEW.profesional_id
      AND c.inicio < NEW.fin AND NEW.inicio < c.fin
      AND (c.exclusiva OR NEW.exclusiva)
  ) THEN
    RAISE EXCEPTION 'cita_exclusiva' USING ERRCODE = 'exclusion_violation';
  END IF;

  -- Cabinas: en ningún momento puede haber más citas a la vez que cabinas.
  SELECT coalesce(max(cabinas), 1) INTO capacidad FROM centro;
  FOR punto IN
    SELECT NEW.inicio
    UNION
    SELECT c.inicio FROM citas c
    WHERE c.id <> NEW.id AND c.estado <> 'cancelada' AND c.inicio > NEW.inicio AND c.inicio < NEW.fin
  LOOP
    SELECT count(*) INTO simultaneas FROM citas c
    WHERE c.id <> NEW.id AND c.estado <> 'cancelada' AND c.inicio <= punto AND punto < c.fin;
    IF simultaneas + 1 > capacidad THEN
      RAISE EXCEPTION 'cabinas_llenas' USING ERRCODE = 'exclusion_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER citas_comprobar_hueco
  BEFORE INSERT OR UPDATE OF inicio, fin, estado, profesional_id, exclusiva ON citas
  FOR EACH ROW EXECUTE FUNCTION comprobar_hueco_cita();
