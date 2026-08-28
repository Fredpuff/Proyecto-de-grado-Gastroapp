-- Migración: parqueaderos compartidos de centros comerciales.
-- Proyecto GSI (Gastroapp).
--
-- Un restaurante dentro de un centro comercial no tiene parqueadero propio:
-- usa el del CC, compartido con todos los locales de adentro. Antes, el
-- script de recolección dejaba parking_type='no_disponible' para esos casos
-- porque Google Places no reporta un parqueadero por restaurante.
--
-- Idempotente en TiDB. scripts/collectRestaurantData.js también aplica este
-- cambio automáticamente al arrancar (revisa INFORMATION_SCHEMA), así que
-- este archivo queda como referencia y para aplicarlo a mano:
--
--   mysql -h <host> -P <port> -u <user> -p gsi_db < sql/migrations/2026-08-28_centros_comerciales.sql

USE gsi_db;

ALTER TABLE parkings
  MODIFY COLUMN type ENUM('propio', 'convenio', 'publico', 'centro_comercial') NOT NULL;
