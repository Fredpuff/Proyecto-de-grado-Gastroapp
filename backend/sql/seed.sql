-- GSI - Datos semilla (ficticios pero realistas) para Villavicencio, Meta.
-- Ejecutar después de schema.sql. Idempotente: limpia tablas antes de insertar.

USE gsi_db;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE reviews;
TRUNCATE TABLE restaurant_parkings;
TRUNCATE TABLE menu_items;
TRUNCATE TABLE parkings;
TRUNCATE TABLE restaurants;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- USUARIOS
-- password para todos los "admin*": Admin123!
-- password para todos los "cliente*": Cliente123!
-- ---------------------------------------------------------------------
INSERT INTO users (id, name, email, password_hash, role) VALUES
  (1, 'Andrés Ramírez', 'admin1@gsi.test', '$2a$10$g70HfFPZpJRJLISuSZOsmOfubyTe9wJwoPANJgRCOS3Q9kITUekKi', 'admin'),
  (2, 'Marcela Torres', 'admin2@gsi.test', '$2a$10$g70HfFPZpJRJLISuSZOsmOfubyTe9wJwoPANJgRCOS3Q9kITUekKi', 'admin'),
  (3, 'Julián Cárdenas', 'admin3@gsi.test', '$2a$10$g70HfFPZpJRJLISuSZOsmOfubyTe9wJwoPANJgRCOS3Q9kITUekKi', 'admin'),
  (4, 'Laura Gómez', 'cliente1@gsi.test', '$2a$10$D8hTMF1v1aZfazUSPXgJVOxVHIketqxqFBDf3nVBY5UGc/cF7P2qW', 'cliente'),
  (5, 'Camilo Herrera', 'cliente2@gsi.test', '$2a$10$D8hTMF1v1aZfazUSPXgJVOxVHIketqxqFBDf3nVBY5UGc/cF7P2qW', 'cliente');

-- ---------------------------------------------------------------------
-- RESTAURANTES (9, distribuidos en las 4 zonas)
-- ---------------------------------------------------------------------
INSERT INTO restaurants
  (id, owner_id, name, address, neighborhood, cuisine_type, price_range, opening_hours,
   phone, website, has_wifi, parking_type, kids_zone, rating_avg, image_url, lat, lng) VALUES
  (1, 1, 'El Fogón Llanero', 'Calle 38 #29-14, Centro Histórico', 'Centro Histórico', 'Colombiana / Llanera', '$$',
   'Lun-Dom 11:00-22:00', '3201234567', 'https://instagram.com/elfogonllanero', TRUE, 'convenio', FALSE, 4.5,
   NULL, 4.1422, -73.6260),

  (2, 1, 'Trattoria Bella Vista', 'Carrera 33 #37-20, Centro Histórico', 'Centro Histórico', 'Italiana', '$$$',
   'Mar-Dom 12:00-22:30', '3109876543', 'https://bellavistavillavo.com', TRUE, 'publico', TRUE, 4.2,
   NULL, 4.1408, -73.6278),

  (3, 1, 'El Rincón Mexicano', 'Calle 40 #31-05, Centro Histórico', 'Centro Histórico', 'Mexicana', '$$',
   'Lun-Dom 12:00-21:00', '3157654321', 'https://facebook.com/rinconmexicanovvo', TRUE, 'convenio', TRUE, 4.1,
   NULL, 4.1435, -73.6249),

  (4, 2, 'Sushi Katana', 'Avenida 40 #23-11, Barzal', 'Barzal', 'Japonesa', '$$$',
   'Mar-Dom 13:00-22:00', '3112223344', 'https://instagram.com/sushikatanavvo', TRUE, 'propio', FALSE, 4.6,
   NULL, 4.1502, -73.6353),

  (5, 2, 'Parrilla del Llano', 'Calle 35 #22-40, Barzal', 'Barzal', 'Parrilla / Carnes', '$$',
   'Lun-Dom 11:30-22:00', '3123334455', NULL, FALSE, 'convenio', TRUE, 4.0,
   NULL, 4.1519, -73.6339),

  (6, 3, 'Casa Olivar Gourmet', 'Carrera 20 #8-30, Villacentro', 'Villacentro', 'Fusión Gourmet', '$$$$',
   'Mié-Dom 18:00-23:00', '3134445566', 'https://casaolivar.co', TRUE, 'propio', FALSE, 4.7,
   NULL, 4.1352, -73.6295),

  (7, 3, 'Arepas & Algo Más', 'Calle 15 #18-22, Villacentro', 'Villacentro', 'Colombiana', '$',
   'Lun-Dom 07:00-15:00', '3145556677', NULL, FALSE, 'no_disponible', TRUE, 3.9,
   NULL, 4.1341, -73.6312),

  (8, 2, 'Mariscos del Meta', 'Calle 41 #42-18, La Rosita', 'La Rosita', 'Mariscos', '$$$',
   'Lun-Dom 11:00-21:30', '3156667788', 'https://instagram.com/mariscosdelmeta', TRUE, 'no_disponible', FALSE, 4.3,
   NULL, 4.1608, -73.6415),

  (9, 3, 'Café Terracota', 'Carrera 44 #40-09, La Rosita', 'La Rosita', 'Cafetería / Postres', '$',
   'Lun-Dom 08:00-20:00', '3167778899', 'https://instagram.com/cafeterracota', TRUE, 'publico', TRUE, 4.4,
   NULL, 4.1622, -73.6432);

-- ---------------------------------------------------------------------
-- MENÚ DIGITAL
-- ---------------------------------------------------------------------
INSERT INTO menu_items (restaurant_id, name, description, price, category) VALUES
  (1, 'Mamona al asador', 'Carne de ternera asada a la llanera con yuca', 38000, 'Fuertes'),
  (1, 'Ternera a la llanera', 'Porción individual con papa criolla', 32000, 'Fuertes'),
  (1, 'Casabe con hogao', 'Entrada típica llanera', 12000, 'Entradas'),

  (2, 'Fettuccine al Alfredo', 'Pasta fresca con salsa cremosa', 34000, 'Fuertes'),
  (2, 'Pizza Margherita', 'Horneada en horno de leña', 29000, 'Fuertes'),
  (2, 'Tiramisú clásico', 'Postre italiano tradicional', 15000, 'Postres'),

  (3, 'Tacos al pastor (3 uds)', 'Con piña asada y cilantro', 22000, 'Fuertes'),
  (3, 'Guacamole con totopos', 'Preparado en mesa', 18000, 'Entradas'),
  (3, 'Margarita clásica', 'Coctel con tequila y limón', 20000, 'Bebidas'),

  (4, 'Combo Katana (24 piezas)', 'Selección de sushi variado', 65000, 'Fuertes'),
  (4, 'Ramen tonkotsu', 'Caldo de cerdo 12 horas', 32000, 'Fuertes'),
  (4, 'Gyozas de cerdo (6 uds)', 'Empanadillas japonesas al vapor', 19000, 'Entradas'),

  (5, 'Punta de anca 400g', 'A la parrilla, con papa y ensalada', 42000, 'Fuertes'),
  (5, 'Chorizo santarrosano', 'Entrada para compartir', 15000, 'Entradas'),
  (5, 'Limonada de coco', 'Refrescante bebida natural', 9000, 'Bebidas'),

  (6, 'Lomo de res al vino tinto', 'Reducción de vino con vegetales de temporada', 58000, 'Fuertes'),
  (6, 'Risotto de hongos silvestres', 'Arroz cremoso con hongos locales', 45000, 'Fuertes'),
  (6, 'Esfera de chocolate y maracuyá', 'Postre de autor', 24000, 'Postres'),

  (7, 'Arepa de choclo con queso', 'Arepa dulce llanera', 8000, 'Entradas'),
  (7, 'Calentado paisa', 'Desayuno tradicional completo', 14000, 'Fuertes'),
  (7, 'Chocolate santafereño', 'Con queso y almojábana', 9000, 'Bebidas'),

  (8, 'Cazuela de mariscos', 'Camarón, calamar y pescado en salsa', 48000, 'Fuertes'),
  (8, 'Ceviche de camarón', 'Estilo peruano', 28000, 'Entradas'),
  (8, 'Patacón con hogao de mariscos', 'Para compartir', 22000, 'Entradas'),

  (9, 'Torta de zanahoria', 'Con frosting de queso crema', 9000, 'Postres'),
  (9, 'Café de origen Meta', 'Preparado en V60', 7000, 'Bebidas'),
  (9, 'Croissant relleno de jamón y queso', 'Horneado diario', 11000, 'Entradas');

-- ---------------------------------------------------------------------
-- PARQUEADEROS CERCANOS
-- ---------------------------------------------------------------------
INSERT INTO parkings (id, name, type, lat, lng) VALUES
  (1, 'Parqueadero Centro Plaza', 'publico', 4.1418, -73.6265),
  (2, 'Parqueadero Bella Vista', 'convenio', 4.1411, -73.6280),
  (3, 'Parqueadero Katana Privado', 'propio', 4.1503, -73.6354),
  (4, 'Parqueadero Barzal Real', 'convenio', 4.1521, -73.6336),
  (5, 'Parqueadero Rosita Norte', 'publico', 4.1615, -73.6420),
  (6, 'Parqueadero Villacentro VIP', 'propio', 4.1350, -73.6293);

INSERT INTO restaurant_parkings (restaurant_id, parking_id) VALUES
  (1, 1), (3, 1), -- Centro Plaza sirve a El Fogón Llanero y El Rincón Mexicano
  (2, 2),         -- Bella Vista tiene su propio convenio
  (4, 3),         -- Sushi Katana - parqueadero propio
  (5, 4),         -- Parrilla del Llano - convenio Barzal Real
  (8, 5), (9, 5),  -- Mariscos del Meta y Café Terracota comparten Rosita Norte
  (6, 6);         -- Casa Olivar Gourmet - parqueadero propio VIP

-- ---------------------------------------------------------------------
-- RESEÑAS (solo almacenamiento)
-- ---------------------------------------------------------------------
INSERT INTO reviews (restaurant_id, user_id, rating, comment) VALUES
  (1, 4, 5, 'La mamona estaba increíble, el mejor sabor llanero de la ciudad.'),
  (1, 5, 4, 'Muy buena porción y atención rápida.'),
  (4, 4, 5, 'El ramen tonkotsu es espectacular, vale cada peso.'),
  (8, 5, 4, 'Mariscos frescos, aunque toca buscar parqueadero aparte.'),
  (6, 4, 5, 'Experiencia gourmet completa, ideal para una cena especial.'),
  (6, 5, 4, 'Excelente carta de vinos y presentación de los platos.'),
  (9, 4, 4, 'El café de origen es delicioso, buen lugar para trabajar.'),
  (2, 5, 3, 'Buena pasta pero la espera fue larga un sábado en la noche.'),
  (3, 4, 4, 'Los tacos al pastor se sienten muy auténticos.'),
  (7, 5, 3, 'Buen desayuno económico, ambiente sencillo y familiar.');
