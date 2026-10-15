const SORTERS = {
  newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  'name-asc': (a, b) => a.name.localeCompare(b.name, 'id'),
  'name-desc': (a, b) => b.name.localeCompare(a.name, 'id'),
  'recently-saved': (a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0),
};

export default class SavedPresenter {
  #view;
  #savedDb;
  #pendingDb;
  #sync;
  #stories = [];
  #query = '';
  #sortBy = 'recently-saved';

  constructor({ view, savedDb, pendingDb, sync }) {
    this.#view = view;
    this.#savedDb = savedDb;
    this.#pendingDb = pendingDb;
    this.#sync = sync;
  }

  async load() {
    try {
      this.#stories = await this.#savedDb.getAll();
      this.#render();
    } catch {
      this.#view.showError('Gagal membaca data dari IndexedDB.');
    }
    await this.loadPending();
  }

  setQuery(query) {
    this.#query = query.trim().toLowerCase();
    this.#render();
  }

  setSort(sortBy) {
    this.#sortBy = SORTERS[sortBy] ? sortBy : 'recently-saved';
    this.#render();
  }

  #render() {
    const visible = this.#stories
      .filter((story) => !this.#query || `${story.name} ${story.description}`.toLowerCase().includes(this.#query))
      .sort(SORTERS[this.#sortBy]);

    this.#view.showSaved(visible, { total: this.#stories.length, filtered: Boolean(this.#query) });
  }

  async remove(id) {
    try {
      await this.#savedDb.delete(id);
      this.#stories = this.#stories.filter((story) => story.id !== id);
      this.#render();
      this.#view.showMessage('Cerita dihapus dari simpanan.', 'success');
    } catch {
      this.#view.showMessage('Gagal menghapus cerita.', 'error');
    }
  }

  async loadPending() {
    try {
      this.#view.showPending(await this.#pendingDb.getAll());
    } catch {
      this.#view.showPending([]);
    }
  }

  async cancelPending(localId) {
    try {
      await this.#pendingDb.delete(localId);
      this.#view.showMessage('Cerita di antrean dibatalkan.', 'success');
    } catch {
      this.#view.showMessage('Gagal membatalkan cerita.', 'error');
    }
  }

  async syncNow() {
    if (!navigator.onLine) {
      this.#view.showMessage('Anda masih offline. Sinkronisasi dilakukan otomatis saat koneksi kembali.', 'error');
      return;
    }

    this.#view.setSyncing(true);
    try {
      const result = await this.#sync();
      if (!result) {
        this.#view.showMessage('Sinkronisasi sedang berjalan atau sesi Anda berakhir.', 'info');
      } else if (result.synced > 0 && result.remaining === 0) {
        this.#view.showMessage(`${result.synced} cerita berhasil dikirim.`, 'success');
      } else if (result.synced > 0) {
        this.#view.showMessage(`${result.synced} cerita terkirim, ${result.remaining} masih menunggu.`, 'info');
      } else if (result.failed > 0) {
        this.#view.showMessage('Server menolak cerita di antrean. Periksa pesan kesalahan pada tiap cerita.', 'error');
      } else if (result.remaining > 0) {
        this.#view.showMessage('Sinkronisasi terhenti. Coba lagi beberapa saat lagi.', 'error');
      }
    } finally {
      this.#view.setSyncing(false);
      await this.loadPending();
    }
  }
}
