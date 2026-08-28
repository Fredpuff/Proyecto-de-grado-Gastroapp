/**
 * seedTestReviews.js
 * -----------------------------------------------------------------------------
 * *** DATOS DE PRUEBA - NO SON RESEÑAS REALES DE USUARIOS ***
 *
 * Inserta reseñas de ejemplo (inventadas pero realistas, variadas en tono y
 * calificación) sobre restaurantes REALES ya recolectados por
 * collectRestaurantData.js, usando los usuarios de prueba del seed
 * (cliente1@gsi.test, cliente2@gsi.test) como autores.
 *
 * Objetivo: validar visualmente que las reseñas se guardan bien, aparecen en
 * la ficha del restaurante, y que rating_avg (src/utils/ratingAvg.js) se
 * recalcula correctamente al combinarse con el rating de Google.
 *
 * Estas reseñas NO deben confundirse con reseñas legítimas de usuarios reales
 * de la app: son exclusivamente para probar el sistema. Si más adelante se
 * quieren quitar, basta con borrar los reviews cuyo comment coincide con los
 * de REVIEWS_DE_PRUEBA más abajo (o el restaurante+usuario+texto exacto).
 *
 * Uso:
 *   node scripts/seedTestReviews.js
 *
 * Es re-ejecutable sin duplicar: antes de insertar, revisa si ya existe una
 * reseña idéntica (mismo restaurante + mismo usuario + mismo comentario).
 * -----------------------------------------------------------------------------
 */

'use strict';

require('dotenv').config();

const pool = require('../src/config/db');
const { recalculateRatingAvg } = require('../src/utils/ratingAvg');

const CLIENTE1_EMAIL = 'cliente1@gsi.test';
const CLIENTE2_EMAIL = 'cliente2@gsi.test';

// nombre del restaurante (debe existir tal cual, insertado por
// collectRestaurantData.js) -> lista de reseñas de prueba a dejarle.
const REVIEWS_DE_PRUEBA = [
  {
    restaurantName: 'KOI SUSHI | Restaurante Japonés en Villavicencio',
    reviews: [
      {
        author: CLIENTE1_EMAIL,
        rating: 5,
        comment:
          'El salmón estaba fresquísimo y el servicio fue muy atento. Sin duda el mejor sushi que he probado en Villavicencio.',
      },
      {
        author: CLIENTE2_EMAIL,
        rating: 4,
        comment: 'Buena variedad de rollos, aunque la espera un viernes en la noche fue de casi 40 minutos.',
      },
    ],
  },
  {
    restaurantName: 'Helaito',
    reviews: [
      {
        author: CLIENTE1_EMAIL,
        rating: 5,
        comment: 'Los bowls de helado son una locura, el de mango biche quedó espectacular. Volveré seguro.',
      },
      {
        author: CLIENTE2_EMAIL,
        rating: 3,
        comment: 'Rico pero un poco caro para la porción que dan. El local es pequeño y no hay mucho parqueo cerca.',
      },
    ],
  },
  {
    restaurantName: 'Restaurante La Posada del Arriero',
    reviews: [
      {
        author: CLIENTE2_EMAIL,
        rating: 5,
        comment: 'La mamona y el casabe son exactamente como los recuerdo de mi infancia en el Llano. Excelente atención.',
      },
      {
        author: CLIENTE1_EMAIL,
        rating: 2,
        comment: 'La comida tardó más de una hora en llegar y cuando llegó ya estaba tibia. Esperaba más por la fama que tiene.',
      },
    ],
  },
  {
    restaurantName: 'NAPOLETA TRADIZIONE',
    reviews: [
      {
        author: CLIENTE1_EMAIL,
        rating: 4,
        comment: 'La pizza napolitana tiene la masa perfecta, delgada y con buen borde. El único pero es que el lugar es chico.',
      },
    ],
  },
  {
    restaurantName: 'Fervor Restaurante Villavicencio',
    reviews: [
      {
        author: CLIENTE2_EMAIL,
        rating: 5,
        comment:
          'Excelente para ir en familia al centro comercial, el ambiente es agradable y el parqueadero de Primavera Urbana queda a la mano.',
      },
      {
        author: CLIENTE1_EMAIL,
        rating: 1,
        comment: 'Pedí una carne término medio y llegó muy cocida, además el mesero fue cortante cuando reclamé.',
      },
    ],
  },
  {
    restaurantName: 'Sunroof coffee',
    reviews: [
      {
        author: CLIENTE2_EMAIL,
        rating: 4,
        comment: 'Buen café de especialidad y buena vista, ideal para trabajar en la mañana.',
      },
    ],
  },
];

async function getUserIdByEmail(email) {
  const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (!rows.length) throw new Error(`No existe el usuario de prueba "${email}" (¿corriste sql/seed.sql?)`);
  return rows[0].id;
}

async function getRestaurantIdByName(name) {
  const [rows] = await pool.query(
    "SELECT id FROM restaurants WHERE name = ? AND data_source LIKE 'google_places%' LIMIT 1",
    [name]
  );
  return rows.length ? rows[0].id : null;
}

async function reviewExists(restaurantId, userId, comment) {
  const [rows] = await pool.query(
    'SELECT id FROM reviews WHERE restaurant_id = ? AND user_id = ? AND comment = ? LIMIT 1',
    [restaurantId, userId, comment]
  );
  return rows.length > 0;
}

async function main() {
  console.log('GSI · Sembrando reseñas de PRUEBA sobre restaurantes reales (no son reseñas de usuarios reales)\n');

  const userIdByEmail = {
    [CLIENTE1_EMAIL]: await getUserIdByEmail(CLIENTE1_EMAIL),
    [CLIENTE2_EMAIL]: await getUserIdByEmail(CLIENTE2_EMAIL),
  };

  const stats = { insertadas: 0, ya_existian: 0, restaurante_no_encontrado: 0, restaurantes_afectados: new Set() };

  for (const { restaurantName, reviews } of REVIEWS_DE_PRUEBA) {
    const restaurantId = await getRestaurantIdByName(restaurantName);
    if (!restaurantId) {
      console.log(`  ! "${restaurantName}" no está en la BD (¿corriste collectRestaurantData.js?) -> se omite`);
      stats.restaurante_no_encontrado += reviews.length;
      continue;
    }

    for (const { author, rating, comment } of reviews) {
      const userId = userIdByEmail[author];
      if (await reviewExists(restaurantId, userId, comment)) {
        console.log(`  · "${restaurantName}" (${author}, ${rating}★) ya existía -> se omite`);
        stats.ya_existian += 1;
        continue;
      }
      await pool.query('INSERT INTO reviews (restaurant_id, user_id, rating, comment) VALUES (?, ?, ?, ?)', [
        restaurantId,
        userId,
        rating,
        comment,
      ]);
      console.log(`  + "${restaurantName}" (${author}, ${rating}★) insertada`);
      stats.insertadas += 1;
      stats.restaurantes_afectados.add(restaurantId);
    }

    await recalculateRatingAvg(pool, restaurantId);
  }

  console.log('\n================ RESUMEN ================');
  console.log(`Insertadas: ${stats.insertadas} | Ya existían: ${stats.ya_existian} | Restaurante no encontrado: ${stats.restaurante_no_encontrado}`);
  console.log(`Restaurantes con reseñas nuevas (rating_avg recalculado): ${stats.restaurantes_afectados.size}`);

  await pool.end();
}

main().catch(async (err) => {
  console.error('\nERROR FATAL:', err.message);
  try {
    await pool.end();
  } catch (_) {
    /* noop */
  }
  process.exitCode = 1;
});
