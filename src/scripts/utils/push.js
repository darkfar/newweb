import CONFIG from '../config';
import * as StoryApi from '../data/api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function getReadyRegistration() {
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    throw new Error('Service worker belum aktif. Muat ulang halaman lalu coba lagi.');
  }
  await navigator.serviceWorker.ready;
  return registration;
}

export async function isSubscribed() {
  if (!isPushSupported()) return false;

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return false;

  return Boolean(await registration.pushManager.getSubscription());
}

export async function subscribePush() {
  if (!isPushSupported()) {
    throw new Error('Browser Anda tidak mendukung push notification.');
  }

  if (Notification.permission === 'denied') {
    throw new Error('Notifikasi diblokir. Aktifkan izin notifikasi untuk situs ini di pengaturan browser.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Izin notifikasi tidak diberikan.');
  }

  const registration = await getReadyRegistration();
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(CONFIG.VAPID_PUBLIC_KEY),
    }));

  try {
    await StoryApi.subscribePushNotification(subscription.toJSON());
  } catch (error) {
    // Jangan biarkan langganan setengah jadi (ada di browser tapi tidak di server).
    await subscription.unsubscribe();
    throw error;
  }
}

/**
 * force: tetap batalkan langganan di browser walau pemberitahuan ke server gagal (mis. saat logout).
 */
export async function unsubscribePush({ force = false } = {}) {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  try {
    await StoryApi.unsubscribePushNotification({ endpoint: subscription.endpoint });
  } catch (error) {
    if (!force && error.isNetworkError) throw error;
  }

  await subscription.unsubscribe();
}
