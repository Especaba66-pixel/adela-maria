-- Reglas que impone la propia base de datos, aunque falle o se salte la aplicación.

-- 1. Registros que solo crecen: el registro de actividad y el de copias no se editan ni se borran.
CREATE FUNCTION rechazar_cambio_inalterable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % solo admite añadir filas; no se puede % ', TG_TABLE_NAME, lower(TG_OP)
    USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER registro_actividad_inalterable
  BEFORE UPDATE OR DELETE ON registro_actividad
  FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_inalterable();
--> statement-breakpoint
CREATE TRIGGER registro_actividad_sin_vaciar
  BEFORE TRUNCATE ON registro_actividad
  FOR EACH STATEMENT EXECUTE FUNCTION rechazar_cambio_inalterable();
--> statement-breakpoint
CREATE TRIGGER copias_seguridad_inalterable
  BEFORE UPDATE OR DELETE ON copias_seguridad
  FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_inalterable();
--> statement-breakpoint

-- 2. Borrado lógico: estas tablas no admiten DELETE; se desactiva o se marca anulado_en.
CREATE FUNCTION rechazar_borrado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'No se borran filas de %: se marcan como anuladas o inactivas', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER centro_sin_borrado BEFORE DELETE ON centro FOR EACH ROW EXECUTE FUNCTION rechazar_borrado();
--> statement-breakpoint
CREATE TRIGGER usuarios_sin_borrado BEFORE DELETE ON usuarios FOR EACH ROW EXECUTE FUNCTION rechazar_borrado();
--> statement-breakpoint
CREATE TRIGGER categorias_sin_borrado BEFORE DELETE ON categorias FOR EACH ROW EXECUTE FUNCTION rechazar_borrado();
--> statement-breakpoint
CREATE TRIGGER tratamientos_sin_borrado BEFORE DELETE ON tratamientos FOR EACH ROW EXECUTE FUNCTION rechazar_borrado();
--> statement-breakpoint
CREATE TRIGGER tipos_bono_sin_borrado BEFORE DELETE ON tipos_bono FOR EACH ROW EXECUTE FUNCTION rechazar_borrado();
--> statement-breakpoint

-- 3. Fecha de última modificación de usuarios, mantenida por la base de datos.
CREATE FUNCTION marcar_actualizado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER usuarios_actualizado BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION marcar_actualizado();
