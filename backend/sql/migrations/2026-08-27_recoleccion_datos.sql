-- Migración: soporte para el script de recolección de datos (Google Places + scraping)
-- Proyecto GSI (Gastroapp) - Capítulo III, Instrumentos y técnicas de recolección.
--
-- Idempotente en TiDB: usa ADD COLUMN / ADD INDEX IF NOT EXISTS.
-- El script scripts/collectRestaurantData.js también aplica estos cambios
-- automáticamente al arrancar (revisa INFORMATION_SCHEMA), así que este archivo
-- queda como referencia y para aplicarlo a mano con el cliente mysql:
--
--   mysql -h <host> -P <port> -u <user> -p gsi_db < sql/migrations/2026-08-27_recoleccion_datos.sql

USE gsi_db;

-- 1. Procedencia del dato (ficha metodológica del anteproyecto)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS data_source VARCHAR(32) NOT NULL DEFAULT 'manual'
  COMMENT 'manual | google_places | google_places+scraping';

-- 2. Identificador estable de Google Places para hacer UPSERT sin duplicar
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(128) NULL;

ALTER TABLE restaurants
  ADD UNIQUE INDEX IF NOT EXISTS uq_google_place_id (google_place_id);

-- 3. Calificación y nº de reseñas tal como los reporta Google Maps
--    (se guardan aparte de rating_avg, que puede venir cargado a mano)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS google_rating DECIMAL(2,1) NULL;

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS google_reviews_total INT NULL;

-- 4. Enlace a la presencia web principal / ficha de Google Maps
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS google_maps_url VARCHAR(255) NULL;

-- 5. Marca de tiempo de la última recolección automática
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMP NULL;

-- 6. Campos que Google Places puede NO entregar: se permiten NULL para no
--    inventar datos (requisito del anteproyecto: solo datos reales/verificables)
ALTER TABLE restaurants MODIFY COLUMN cuisine_type VARCHAR(80) NULL;
ALTER TABLE restaurants MODIFY COLUMN opening_hours VARCHAR(255) NULL;
ALTER TABLE restaurants MODIFY COLUMN price_range ENUM('$', '$$', '$$$', '$$$$') NULL DEFAULT NULL;

-- 7. Zona "Sin clasificar" para resultados cuya dirección no calza claramente
--    con ninguno de los 4 sectores objetivo del anteproyecto
ALTER TABLE restaurants
  MODIFY COLUMN neighborhood
  ENUM('Centro Histórico', 'Barzal', 'La Rosita', 'Villacentro', 'Sin clasificar') NOT NULL;

-- 7b. Las URLs de fotos de Google Places (New) superan los 255 caracteres
--     (resource name completo + API key) -> VARCHAR(255) las trunca y el INSERT falla.
ALTER TABLE restaurants MODIFY COLUMN image_url TEXT NULL;

-- 8. Origen de cada ítem de menú (para poder re-ejecutar el scraping sin pisar
--    lo cargado a mano en el seed/panel admin)
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'manual'
  COMMENT 'manual | scraping';
