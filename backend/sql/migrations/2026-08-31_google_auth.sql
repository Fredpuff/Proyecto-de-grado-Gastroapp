-- Migración: login con Google (OAuth) además del login tradicional.
-- Proyecto GSI (Gastroapp).
--
-- Los usuarios que entran solo por Google no tienen password tradicional,
-- así que password_hash pasa a ser NULL-able. Se agrega auth_provider para
-- saber cómo se creó/usa cada cuenta ('local' | 'google' | 'ambos' una vez
-- se vincula), avatar_url para la foto de perfil de Google, y google_id
-- (sub del token) para no depender solo del email al reconocer la cuenta.
--
-- Las columnas usan ADD COLUMN IF NOT EXISTS (soportado por TiDB). El índice
-- único NO acepta IF NOT EXISTS en esta versión de TiDB ("You have an error
-- in your SQL syntax ... near IF NOT EXISTS"), así que si lo vas a aplicar
-- dos veces comenta/borra esa línea la segunda vez. Aplícalo a mano con el
-- cliente mysql:
--
--   mysql -h <host> -P <port> -u <user> -p gsi_db < sql/migrations/2026-08-31_google_auth.sql

USE gsi_db;

ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) NULL;

ALTER TABLE users
  ADD UNIQUE INDEX uq_google_id (google_id);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_provider ENUM('local', 'google', 'ambos') NOT NULL DEFAULT 'local';
