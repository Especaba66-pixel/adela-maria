-- Sábado de 10:00 a 14:00 para Adela (la profesional de la administración), si aún no tiene ningún tramo en sábado.
INSERT INTO "horarios" ("profesional_id", "dia_semana", "inicio_min", "fin_min")
SELECT p."id", 6, 600, 840 FROM "profesionales" p
JOIN "usuarios" u ON u."id" = p."usuario_id" AND u."rol" = 'administrador'
WHERE NOT EXISTS (SELECT 1 FROM "horarios" h WHERE h."profesional_id" = p."id" AND h."dia_semana" = 6);
