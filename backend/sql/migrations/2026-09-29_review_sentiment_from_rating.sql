-- Migración de datos (sin cambios de esquema): clasifica por sus estrellas las
-- reseñas que quedaron sin sentimiento (sin texto, texto de 1 carácter o
-- análisis fallido). 4-5 = positivo, 3 = neutral, 1-2 = negativo.
-- Proyecto GSI (Gastroapp). Es idempotente: solo toca filas con sentiment NULL.
--
--   mysql -h <host> -P <port> -u <user> -p gsi_db < sql/migrations/2026-09-29_review_sentiment_from_rating.sql

USE gsi_db;

UPDATE reviews
SET sentiment = CASE
      WHEN rating >= 4 THEN 'positivo'
      WHEN rating <= 2 THEN 'negativo'
      ELSE 'neutral'
    END,
    sentiment_score = CASE rating
      WHEN 5 THEN 0.8
      WHEN 4 THEN 0.5
      WHEN 2 THEN -0.5
      WHEN 1 THEN -0.8
      ELSE 0
    END
WHERE sentiment IS NULL;
