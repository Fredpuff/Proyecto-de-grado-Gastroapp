require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: true }
  });

  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS restaurant_photos_cache (
        restaurant_id INT PRIMARY KEY,
        photo_names   JSON        NOT NULL,
        updated_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_photos_cache_restaurant
          FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    console.log('OK: tabla restaurant_photos_cache creada (o ya existia)');

    const [rows] = await conn.execute("SHOW TABLES LIKE 'restaurant_photos_cache'");
    console.log('Verificacion:', rows.length === 1 ? 'TABLA EXISTE' : 'NO ENCONTRADA');
  } finally {
    await conn.end();
  }
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
