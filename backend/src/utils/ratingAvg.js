'use strict';

// Promedio combinado de estrellas de un restaurante: mezcla las reseñas de
// Google recolectadas por scripts/collectRestaurantData.js (google_rating,
// google_reviews_total) con las reseñas reales de usuarios de la app (tabla
// reviews), tratando cada reseña de ambas fuentes con el mismo peso.
//
//   rating_avg = (google_rating * google_reviews_total + SUM(reviews.rating))
//                / (google_reviews_total + COUNT(reviews.*))
//
// Si el restaurante no tiene ni reseñas de Google ni de usuarios (p.ej. una
// ficha cargada a mano y aún sin actividad), se conserva el rating_avg que ya
// tenía en vez de pisarlo con 0.
//
// Se debe llamar cada vez que cambia alguna de las dos fuentes: al insertar
// una reseña de usuario (reviewController) y al recolectar/actualizar datos
// de Google (collectRestaurantData.js).
async function recalculateRatingAvg(pool, restaurantId) {
  await pool.query(
    `UPDATE restaurants r
     SET rating_avg = CASE
       WHEN (
         COALESCE(r.google_reviews_total, 0)
         + (SELECT COUNT(*) FROM reviews rv WHERE rv.restaurant_id = r.id)
       ) > 0
       THEN ROUND(
         (
           COALESCE(r.google_rating * r.google_reviews_total, 0)
           + COALESCE((SELECT SUM(rv.rating) FROM reviews rv WHERE rv.restaurant_id = r.id), 0)
         )
         /
         (
           COALESCE(r.google_reviews_total, 0)
           + (SELECT COUNT(*) FROM reviews rv WHERE rv.restaurant_id = r.id)
         ),
         1
       )
       ELSE r.rating_avg
     END
     WHERE r.id = ?`,
    [restaurantId]
  );
}

module.exports = { recalculateRatingAvg };
