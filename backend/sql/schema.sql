-- GSI (Gastronomy Search Intelligence) - Esquema de base de datos
-- Fase 1: sin IA, sin NLP, sin scraping. Solo modelo de datos funcional.

CREATE DATABASE IF NOT EXISTS gsi_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gsi_db;

-- ---------------------------------------------------------------------
-- USUARIOS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('cliente', 'admin') NOT NULL DEFAULT 'cliente',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- RESTAURANTES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restaurants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NULL, -- admin dueño de la ficha (rol 'admin' en users)
  name VARCHAR(160) NOT NULL,
  address VARCHAR(255) NOT NULL,
  neighborhood ENUM('Centro Histórico', 'Barzal', 'La Rosita', 'Villacentro') NOT NULL,
  cuisine_type VARCHAR(80) NOT NULL, -- ej: Colombiana, Italiana, Mariscos, Parrilla...
  price_range ENUM('$', '$$', '$$$', '$$$$') NOT NULL DEFAULT '$$',
  opening_hours VARCHAR(255) NOT NULL, -- ej: "Lun-Sáb 12:00-22:00, Dom 12:00-16:00"
  phone VARCHAR(40) NULL,
  website VARCHAR(255) NULL, -- sitio web o red social
  has_wifi BOOLEAN NOT NULL DEFAULT FALSE,
  parking_type ENUM('propio', 'convenio', 'publico', 'no_disponible') NOT NULL DEFAULT 'no_disponible',
  kids_zone BOOLEAN NOT NULL DEFAULT FALSE,
  rating_avg DECIMAL(2,1) NOT NULL DEFAULT 0.0, -- cargado manualmente por ahora (no calculado por IA)
  image_url VARCHAR(255) NULL, -- si es NULL, el frontend usa un placeholder
  lat DECIMAL(10, 7) NOT NULL,
  lng DECIMAL(10, 7) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_restaurant_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_neighborhood (neighborhood),
  INDEX idx_cuisine (cuisine_type),
  INDEX idx_price (price_range)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- MENU DIGITAL
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  name VARCHAR(160) NOT NULL,
  description VARCHAR(255) NULL,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(60) NOT NULL, -- ej: Entradas, Fuertes, Postres, Bebidas
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_menu_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  INDEX idx_menu_restaurant (restaurant_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- PARQUEADEROS CERCANOS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parkings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  type ENUM('propio', 'convenio', 'publico') NOT NULL,
  lat DECIMAL(10, 7) NOT NULL,
  lng DECIMAL(10, 7) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Relación N:M -- un parqueadero puede servir a varios restaurantes y viceversa
CREATE TABLE IF NOT EXISTS restaurant_parkings (
  restaurant_id INT NOT NULL,
  parking_id INT NOT NULL,
  PRIMARY KEY (restaurant_id, parking_id),
  CONSTRAINT fk_rp_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_parking FOREIGN KEY (parking_id) REFERENCES parkings(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- RESEÑAS (solo almacenamiento, sin análisis de sentimiento)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  user_id INT NOT NULL,
  rating TINYINT NOT NULL,
  comment TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_review_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  CONSTRAINT fk_review_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_rating_range CHECK (rating BETWEEN 1 AND 5),
  INDEX idx_review_restaurant (restaurant_id)
) ENGINE=InnoDB;
