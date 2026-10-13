-- Reservas por internet: lo mínimo para ofrecer horas libres y guardar las peticiones mientras el TPV está apagado.
-- El TPV manda aquí sus tratamientos, horario, cabinas y lo que ya está ocupado, y se lleva las reservas nuevas.

CREATE TABLE ajustes (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
INSERT INTO ajustes (clave, valor) VALUES ('cabinas', '2'), ('version', '0'), ('sincronizado', '');

CREATE TABLE servicios (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL,
  duracion INTEGER NOT NULL CHECK (duracion > 0),
  exclusivo INTEGER NOT NULL DEFAULT 0,
  precio INTEGER,
  orden INTEGER NOT NULL DEFAULT 0
);

-- Horario por día de la semana (1 = lunes … 7 = domingo), en minutos desde medianoche.
CREATE TABLE horario (dia_semana INTEGER NOT NULL, inicio INTEGER NOT NULL, fin INTEGER NOT NULL);

-- Lo que ya está ocupado en el centro (citas y bloqueos), en milisegundos. Lo reemplaza el TPV en cada sincronización.
CREATE TABLE ocupado (inicio INTEGER NOT NULL, fin INTEGER NOT NULL, exclusiva INTEGER NOT NULL DEFAULT 0, bloqueo INTEGER NOT NULL DEFAULT 0);
CREATE INDEX ocupado_inicio ON ocupado (inicio);

-- Reservas hechas en la web. Cuando el TPV se las lleva, se borran el nombre y el teléfono de aquí.
CREATE TABLE reservas (
  id TEXT PRIMARY KEY,
  servicio_id TEXT NOT NULL,
  servicio_nombre TEXT NOT NULL,
  inicio INTEGER NOT NULL,
  fin INTEGER NOT NULL,
  exclusiva INTEGER NOT NULL DEFAULT 0,
  nombre TEXT,
  telefono TEXT,
  nota TEXT,
  consentimiento TEXT,
  ip TEXT,
  creada INTEGER NOT NULL,
  importada INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX reservas_inicio ON reservas (inicio);
CREATE INDEX reservas_pendientes ON reservas (importada, creada);
