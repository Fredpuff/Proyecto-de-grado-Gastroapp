import { api } from './client';

function toQueryString(params = {}) {
  const parts = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item !== undefined && item !== null && item !== '') parts.push([k, item]);
      }
    } else {
      parts.push([k, v]);
    }
  }
  if (parts.length === 0) return '';
  return `?${new URLSearchParams(parts).toString()}`;
}

export const authApi = {
  register: (payload) => api.post('/auth/register', payload),
  login: (payload) => api.post('/auth/login', payload),
  google: (credential) => api.post('/auth/google', { credential }),
  me: () => api.get('/auth/me', { auth: true })
};

export const restaurantsApi = {
  list: (filters) => api.get(`/restaurants${toQueryString(filters)}`),
  get: (id) => api.get(`/restaurants/${id}`),
  create: (payload) => api.post('/restaurants', payload, { auth: true }),
  update: (id, payload) => api.put(`/restaurants/${id}`, payload, { auth: true }),
  remove: (id) => api.del(`/restaurants/${id}`, { auth: true }),
  nearbyParkings: (id, radiusKm) => api.get(`/restaurants/${id}/nearby-parkings${toQueryString({ radiusKm })}`),
  ratingSummary: (id) => api.get(`/restaurants/${id}/rating-summary`)
};

export const menuApi = {
  listByRestaurant: (restaurantId) => api.get(`/restaurants/${restaurantId}/menu`),
  create: (restaurantId, payload) => api.post(`/restaurants/${restaurantId}/menu`, payload, { auth: true }),
  update: (id, payload) => api.put(`/menu/${id}`, payload, { auth: true }),
  remove: (id) => api.del(`/menu/${id}`, { auth: true })
};

export const parkingsApi = {
  list: () => api.get('/parkings'),
  create: (payload) => api.post('/parkings', payload, { auth: true }),
  update: (id, payload) => api.put(`/parkings/${id}`, payload, { auth: true }),
  remove: (id) => api.del(`/parkings/${id}`, { auth: true })
};

export const reviewsApi = {
  listByRestaurant: (restaurantId) => api.get(`/restaurants/${restaurantId}/reviews`),
  create: (restaurantId, payload) => api.post(`/restaurants/${restaurantId}/reviews`, payload, { auth: true }),
  insights: (restaurantId, opts) => api.get(`/restaurants/${restaurantId}/insights`, opts)
};

export const chatApi = {
  recommend: (message, conversationHistory) =>
    api.post('/chat/recommend', { message, conversationHistory }, { auth: true })
};
