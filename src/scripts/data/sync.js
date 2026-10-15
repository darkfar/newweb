import * as StoryApi from './api';
import { isLoggedIn } from './auth';
import { PendingStoryDb } from './db';

let isSyncing = false;

/**
 * Mengirim semua cerita yang dibuat saat offline ke API.
 * Mengembalikan null jika sinkronisasi tidak dijalankan (offline, belum login, atau sedang berjalan).
 */
export async function syncPendingStories() {
  if (isSyncing || !navigator.onLine || !isLoggedIn()) return null;

  isSyncing = true;
  const result = { synced: 0, failed: 0, remaining: 0 };

  try {
    const items = await PendingStoryDb.getAll();

    for (const item of items) {
      try {
        await StoryApi.addStory(item);
        await PendingStoryDb.delete(item.localId);
        result.synced += 1;
      } catch (error) {
        // Koneksi putus atau sesi berakhir: hentikan, coba lagi nanti.
        if (error.isNetworkError || error.status === 401) break;

        // Ditolak server (mis. data tidak valid): simpan alasan, lanjut ke data berikutnya.
        result.failed += 1;
        await PendingStoryDb.update({ ...item, lastError: error.message });
      }
    }

    result.remaining = (await PendingStoryDb.getAll()).length;
  } finally {
    isSyncing = false;
  }

  return result;
}
