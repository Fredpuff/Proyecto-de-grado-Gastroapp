// Ejecuta sql/schema.sql y luego sql/seed.sql contra la base configurada en .env
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true
    }
  });

  const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8');
  const seedSql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'seed.sql'), 'utf8');

  console.log('Aplicando schema.sql...');
  await connection.query(schemaSql);

  console.log('Aplicando seed.sql...');
  await connection.query(seedSql);

  console.log('Listo: base de datos gsi_db creada y poblada con datos de ejemplo.');
  await connection.end();
}

run().catch((err) => {
  console.error('Error ejecutando el seed:', err.message);
  process.exit(1);
});