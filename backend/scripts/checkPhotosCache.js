require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, ssl: { rejectUnauthorized: true }
  });
  try {
    const [rows] = await conn.execute(
      'SELECT restaurant_id, JSON_LENGTH(photo_names) AS count, updated_at FROM restaurant_photos_cache'
    );
    console.table(rows);
  } finally {
    await conn.end();
  }
}
run().catch(e => { console.error(e.message); process.exit(1); });
