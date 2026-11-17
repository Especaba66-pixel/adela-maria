-- Tratamientos que se hacen a la vez que otra cita (presoterapia): no ocupan cabina, pero dos no coinciden.
ALTER TABLE servicios ADD COLUMN a_la_vez INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ocupado ADD COLUMN a_la_vez INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reservas ADD COLUMN a_la_vez INTEGER NOT NULL DEFAULT 0;
