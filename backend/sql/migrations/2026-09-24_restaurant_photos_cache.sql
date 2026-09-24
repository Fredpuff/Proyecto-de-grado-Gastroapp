-- Migración: caché de fotos de Google Places para el carrusel de imágenes.
-- Guarda los photo.name (sin la API key) para reconstruir la URL en el backend.
-- TTL de 30 días: la clave updated_at se compara en restaurantController#getPhotos.
--
--   mysql -h <host> -P <port> -u <user> -p gsi_db < sql/migrations/2026-09-24_restaurant_photos_cache.sql

USE gsi_db;

CREATE TABLE IF NOT EXISTS restaurant_photos_cache (
  restaurant_id INT PRIMARY KEY,
  photo_names   JSON        NOT NULL COMMENT 'Array de photo.name de Google Places API v1',
  updated_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_photos_cache_restaurant
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
) ENGINE=InnoDB;
