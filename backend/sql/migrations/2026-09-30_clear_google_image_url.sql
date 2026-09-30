-- Migración de datos (sin cambios de esquema): borra de restaurants.image_url
-- las URLs de fotos de Google Places. Llevaban la API key incrustada y su
-- photo name ya venció (Google responde 400 "The photo resource in the request
-- is invalid"). Las fotos ahora se sirven por el proxy del backend
-- (/api/restaurants/:id/image), que las pide a Places con el google_place_id.
-- Las URLs manuales externas que haya puesto el admin NO se tocan.
-- Proyecto GSI (Gastroapp). Es idempotente.
--
--   mysql -h <host> -P <port> -u <user> -p gsi_db < sql/migrations/2026-09-30_clear_google_image_url.sql

USE gsi_db;

UPDATE restaurants
SET image_url = NULL
WHERE image_url LIKE '%googleapis.com%';
