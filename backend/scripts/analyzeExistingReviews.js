/**
 * analyzeExistingReviews.js
 * -----------------------------------------------------------------------------
 * Backfill del análisis de sentimiento sobre reseñas existentes:
 *   1. Reanaliza (con IA) las reseñas en estado 'pending', 'failed' o 'skipped'
 *      con texto analizable, hasta 500 por corrida, con concurrencia 3.
 *   2. Corrige las palabras clave de las reseñas ya analizadas que tengan
 *      alguna que no aparece en el comentario: las re-extrae con IA (solo las
 *      palabras clave; sentimiento y aspectos no cambian) y refresca los
 *      insights de los restaurantes afectados.
 *
 * Uso:
 *   npm run nlp:backfill              # aplica los cambios
 *   npm run nlp:backfill -- --dry-run # solo muestra qué haría, sin escribir
 * -----------------------------------------------------------------------------
 */

'use strict';

require('dotenv').config();

const pool = require('../src/config/db');
const { reanalyzePending, refilterStoredKeywords } = require('../src/services/reviewNlp.service');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`GSI · Backfill de análisis de sentimiento sobre reseñas existentes${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

  if (DRY_RUN) {
    const [pending] = await pool.query(
      `SELECT id, analysis_status, comment FROM reviews
       WHERE analysis_status IN ('pending', 'failed')
          OR (analysis_status = 'skipped' AND CHAR_LENGTH(TRIM(comment)) >= 2)
       ORDER BY id ASC LIMIT 500`
    );
    console.log(`Se reanalizarían ${pending.length} reseñas:`);
    for (const r of pending) console.log(`  #${r.id} [${r.analysis_status}] ${JSON.stringify(r.comment)}`);
  } else {
    const counts = await reanalyzePending({ limit: 500, concurrency: 3 });
    console.log('================ REANÁLISIS ================');
    console.log(`Total procesadas: ${counts.total}`);
    console.log(`Analizadas (done): ${counts.done}`);
    console.log(`Omitidas (skipped, sin texto suficiente): ${counts.skipped}`);
    console.log(`Fallidas (failed): ${counts.failed}`);
  }

  const { reviewed, changes } = await refilterStoredKeywords({ dryRun: DRY_RUN });
  console.log('\n============ LIMPIEZA DE PALABRAS CLAVE ============');
  console.log(`Reseñas analizadas revisadas: ${reviewed}`);
  console.log(`Con palabras clave que no aparecen en el texto: ${changes.length}`);
  for (const c of changes) {
    const label = DRY_RUN ? 'después (solo filtro; en la corrida real se re-extraen con IA)' : `después (${c.source})`;
    console.log(`  #${c.id} ${JSON.stringify(c.comment)}\n     antes: ${JSON.stringify(c.before)}\n     ${label}: ${JSON.stringify(c.after)}`);
  }
  if (DRY_RUN) console.log('\n(DRY RUN: no se escribió nada)');
}

main()
  .catch((err) => {
    console.error('\nERROR FATAL:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
