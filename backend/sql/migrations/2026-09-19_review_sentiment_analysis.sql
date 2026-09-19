-- Migración: análisis de sentimiento basado en aspectos (ABSA) sobre reseñas,
-- usando la API de Anthropic (ver backend/src/services/reviewNlp.service.js).
-- Proyecto GSI (Gastroapp).
--
-- Un ALTER TABLE por columna (TiDB no soporta bien varios cambios en un solo
-- ALTER). Usa ADD COLUMN IF NOT EXISTS para poder re-ejecutarse sin fallar.
-- Aplícalo a mano con el cliente mysql:
--
--   mysql -h <host> -P <port> -u <user> -p gsi_db < sql/migrations/2026-09-19_review_sentiment_analysis.sql

USE gsi_db;

-- 1. Resultado del análisis de sentimiento general de la reseña
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS sentiment VARCHAR(10) NULL COMMENT 'positivo | neutral | negativo | mixto';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(4,3) NULL COMMENT 'rango -1 a 1';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS keywords JSON NULL COMMENT 'hasta 5 palabras clave detectadas';

-- 2. Moderación básica detectada por el modelo
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_spam TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_offensive TINYINT(1) NOT NULL DEFAULT 0;

-- 3. true si la calificación en estrellas contradice el sentimiento detectado
--    (>=4 estrellas con sentimiento negativo, o <=2 con sentimiento positivo)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS rating_mismatch TINYINT(1) NOT NULL DEFAULT 0;

-- 4. Estado del pipeline de análisis (para reintentos y backfill)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS analysis_status VARCHAR(10) NOT NULL DEFAULT 'pending' COMMENT 'pending | done | failed | skipped';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS analysis_error VARCHAR(255) NULL;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMP NULL;

ALTER TABLE reviews ADD INDEX IF NOT EXISTS idx_review_restaurant_analysis (restaurant_id, analysis_status);

-- 5. Sentimiento por aspecto (comida, servicio, ambiente, precio, limpieza,
--    parqueadero, tiempo_espera) de cada reseña. Sin claves foráneas: se borra
--    y reinserta por completo cada vez que se reanaliza una reseña.
CREATE TABLE IF NOT EXISTS review_aspects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  review_id INT NOT NULL,
  aspect VARCHAR(20) NOT NULL,
  sentiment VARCHAR(10) NOT NULL,
  score DECIMAL(4,3) NOT NULL,
  evidence VARCHAR(255) NULL,
  INDEX idx_review_aspects_review (review_id),
  INDEX idx_review_aspects_aspect (aspect)
) ENGINE=InnoDB;

-- 6. Agregados por restaurante (evita recalcular todo en cada request de
--    GET /api/restaurants/:id/insights). Se recalcula en
--    reviewNlp.service.js#refreshRestaurantInsights. Con FK a restaurants
--    (ON DELETE CASCADE) porque es un agregado 1:1 que no tiene sentido sin
--    su restaurante, igual que reviews/menu_items.
CREATE TABLE IF NOT EXISTS restaurant_review_insights (
  restaurant_id INT PRIMARY KEY,
  total_analyzed INT NOT NULL DEFAULT 0,
  avg_score DECIMAL(4,3) NULL,
  positive_count INT NOT NULL DEFAULT 0,
  neutral_count INT NOT NULL DEFAULT 0,
  negative_count INT NOT NULL DEFAULT 0,
  mixed_count INT NOT NULL DEFAULT 0,
  aspect_scores JSON NULL,
  top_keywords JSON NULL,
  summary TEXT NULL,
  summary_review_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_insights_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
) ENGINE=InnoDB;
