import { api } from './client';

function toQueryString(params = {}) {
  const usable = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (usable.length === 0) return '';
  const search = new URLSearchParams(usable);
  return `?${search.toString()}`;
}

export const authApi = {
  register: (payload) => api.post('/auth/register', payload),
  login: (payload) => api.post('/auth/login', payload),
  me: () => api.get('/auth/me', { auth: true })
};

export const restaurantsApi = {
  list: (filters) => api.get(`/restaurants${toQueryString(filters)}`),
  get: (id) => api.get(`/restaurants/${id}`),
  create: (payload) => api.post('/restaurants', payload, { auth: true }),
  update: (id, payload) => api.put(`/restaurants/${id}`, payload, { auth: true }),
  remove: (id) => api.del(`/restaurants/${id}`, { auth: true }),
  nearbyParkings: (id, radiusKm) => api.get(`/restaurants/${id}/nearby-parkings${toQueryString({ radiusKm })}`)
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
  create: (restaurantId, payload) => api.post(`/restaurants/${restaurantId}/reviews`, payload, { auth: true })
};
