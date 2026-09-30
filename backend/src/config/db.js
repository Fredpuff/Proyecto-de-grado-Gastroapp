const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gsi_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
  // TiDB guarda NOW()/CURRENT_TIMESTAMP en UTC; sin esto mysql2 los lee como
  // hora local (Colombia, -05:00) y todas las fechas salen corridas 5 horas
  // (una reseña recién publicada quedaba "en el futuro").
  timezone: 'Z',
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  }
});

module.exports = pool;