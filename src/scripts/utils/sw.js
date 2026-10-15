export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;

  try {
    // Path relatif agar tetap benar jika aplikasi di-host di sub-path (mis. GitHub Pages).
    return await navigator.serviceWorker.register('sw.js');
  } catch (error) {
    console.error('Service worker gagal didaftarkan:', error);
    return null;
  }
}
