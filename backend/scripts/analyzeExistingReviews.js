/**
 * analyzeExistingReviews.js
 * -----------------------------------------------------------------------------
 * Backfill: reanaliza (con IA) las reseñas existentes que estén en estado
 * 'pending' o 'failed', hasta 500 por corrida, con concurrencia 3.
 *
 * Uso:
 *   npm run nlp:backfill
 * -----------------------------------------------------------------------------
 */

'use strict';

require('dotenv').config();

const pool = require('../src/config/db');
const { reanalyzePending } = require('../src/services/reviewNlp.service');

async function main() {
  console.log('GSI · Backfill de análisis de sentimiento sobre reseñas existentes\n');

  const counts = await reanalyzePending({ limit: 500, concurrency: 3 });

  console.log('\n================ RESUMEN ================');
  console.log(`Total procesadas: ${counts.total}`);
  console.log(`Analizadas (done): ${counts.done}`);
  console.log(`Omitidas (skipped, sin texto suficiente): ${counts.skipped}`);
  console.log(`Fallidas (failed): ${counts.failed}`);
}

main()
  .catch((err) => {
    console.error('\nERROR FATAL:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
