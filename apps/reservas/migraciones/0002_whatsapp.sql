-- Avisos de Meta (estados de los envíos y mensajes de las clientas). Se guardan tal cual hasta que el TPV se los
-- lleva; entonces se borran.
CREATE TABLE whatsapp_eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cuerpo TEXT NOT NULL,
  recibido INTEGER NOT NULL
);
