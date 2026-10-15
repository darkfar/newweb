import CONFIG from '../config';
import { getToken } from './auth';

const ENDPOINTS = {
  REGISTER: `${CONFIG.BASE_URL}/register`,
  LOGIN: `${CONFIG.BASE_URL}/login`,
  STORIES: `${CONFIG.BASE_URL}/stories`,
  SUBSCRIBE: `${CONFIG.BASE_URL}/notifications/subscribe`,
};

async function request(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    const error = new Error('Gagal terhubung ke server. Periksa koneksi internet Anda.');
    error.isNetworkError = true;
    throw error;
  }

  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error('Respons dari server tidak valid.');
  }

  if (!response.ok || json.error) {
    const error = new Error(json.message || 'Terjadi kesalahan pada server.');
    error.status = response.status;
    throw error;
  }

  return json;
}

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${getToken()}`, ...extra };
}

export async function register({ name, email, password }) {
  return request(ENDPOINTS.REGISTER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
}

export async function login({ email, password }) {
  return request(ENDPOINTS.LOGIN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function getStories({ page = 1, size = 30, location = 1 } = {}) {
  const query = new URLSearchParams({ page, size, location });
  return request(`${ENDPOINTS.STORIES}?${query}`, {
    headers: authHeaders(),
  });
}

export async function getStoryDetail(id) {
  return request(`${ENDPOINTS.STORIES}/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
  });
}

export async function addStory({ description, photo, lat, lon }) {
  const body = new FormData();
  body.append('description', description);
  body.append('photo', photo);
  body.append('lat', lat);
  body.append('lon', lon);

  return request(ENDPOINTS.STORIES, {
    method: 'POST',
    headers: authHeaders(),
    body,
  });
}

export async function subscribePushNotification({ endpoint, keys }) {
  return request(ENDPOINTS.SUBSCRIBE, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }),
  });
}

export async function unsubscribePushNotification({ endpoint }) {
  return request(ENDPOINTS.SUBSCRIBE, {
    method: 'DELETE',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ endpoint }),
  });
}
