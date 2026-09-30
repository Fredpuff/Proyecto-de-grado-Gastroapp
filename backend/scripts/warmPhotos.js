/**
 * warmPhotos.js
 * -----------------------------------------------------------------------------
 * Descarga de una vez la foto principal de todos los restaurantes que aún no la
 * tienen en backend/storage/photos/, una por una con una pausa de ~300 ms, y
 * muestra un resumen. Usa la misma lógica del proxy (photoProxy.service), así
 * que renueva los photo names vencidos y nunca imprime la API key.
 *
 * Uso: npm run photos:warm
 * -----------------------------------------------------------------------------
 */

'use strict';

require('dotenv').config();

const pool = require('../src/config/db');
const photoProxy = require('../src/services/photoProxy.service');

const PAUSE_MS = 300;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('GSI · Precarga de la foto principal de los restaurantes\n');
  photoProxy.ensureStorageDir();

  const [restaurants] = await pool.query('SELECT id, name, image_url FROM restaurants ORDER BY id');
  const summary = { descargadas: 0, yaExistian: 0, externas: 0, fallaron: [] };

  for (const r of restaurants) {
    if (r.image_url && !photoProxy.isGooglePhotoUrl(r.image_url)) {
      summary.externas += 1;
      console.log(`  = #${r.id} ${r.name}: usa una URL externa manual`);
      continue;
    }
    if (await photoProxy.findOnDisk(r.id, 0)) {
      summary.yaExistian += 1;
      continue;
    }

    const result = await photoProxy.getMainImage(r.id);
    if (result.file) {
      summary.descargadas += 1;
      console.log(`  ✓ #${r.id} ${r.name}`);
    } else {
      summary.fallaron.push({ id: r.id, name: r.name, reason: result.reason || 'desconocido' });
      console.log(`  ✗ #${r.id} ${r.name}: ${result.reason}`);
    }
    await sleep(PAUSE_MS);
  }

  console.log('\n================ RESUMEN ================');
  console.log(`Restaurantes: ${restaurants.length}`);
  console.log(`Descargadas: ${summary.descargadas}`);
  console.log(`Ya existían en disco: ${summary.yaExistian}`);
  console.log(`Con URL externa manual: ${summary.externas}`);
  console.log(`Fallaron: ${summary.fallaron.length}`);
  for (const f of summary.fallaron) console.log(`  #${f.id} ${f.name}: ${f.reason}`);
}

main()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
