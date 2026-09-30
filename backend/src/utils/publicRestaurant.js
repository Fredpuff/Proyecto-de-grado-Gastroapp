'use strict';

const { isGooglePhotoUrl } = require('../services/photoProxy.service');

// Quita de la respuesta las URLs de Google Places (llevan la API key
// incrustada). Las fotos se sirven por el proxy /api/restaurants/:id/image;
// una URL manual externa puesta por el admin se deja tal cual.
function toPublicRestaurant(row) {
  if (!row) return row;
  return isGooglePhotoUrl(row.image_url) ? { ...row, image_url: null } : row;
}

module.exports = { toPublicRestaurant };
