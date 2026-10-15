export default class HomePresenter {
  #view;
  #api;
  #savedDb;
  #stories = [];
  #savedIds = new Set();

  constructor({ view, api, savedDb }) {
    this.#view = view;
    this.#api = api;
    this.#savedDb = savedDb;
  }

  async loadStories() {
    this.#view.showLoading();
    try {
      const { listStory } = await this.#api.getStories({ location: 1 });
      this.#stories = listStory ?? [];
      await this.#loadSavedIds();
      this.#view.showStories(this.#stories, { fit: true });
    } catch (error) {
      if (error.status === 401) {
        this.#view.handleUnauthorized();
        return;
      }

      // Offline dan belum ada cache API: tampilkan cerita yang tersimpan di IndexedDB.
      if (error.isNetworkError) {
        const saved = await this.#savedDb.getAll().catch(() => []);
        if (saved.length > 0) {
          this.#stories = saved;
          this.#savedIds = new Set(saved.map((story) => story.id));
          this.#view.setSavedIds(this.#savedIds);
          this.#view.showStories(saved, {
            fit: true,
            notice: 'Anda sedang offline, menampilkan cerita yang tersimpan di perangkat.',
          });
          return;
        }
      }

      this.#view.showError(error.message);
    }
  }

  async #loadSavedIds() {
    try {
      const saved = await this.#savedDb.getAll();
      this.#savedIds = new Set(saved.map((story) => story.id));
    } catch {
      this.#savedIds = new Set();
    }
    this.#view.setSavedIds(this.#savedIds);
  }

  filter(keyword) {
    const query = keyword.trim().toLowerCase();
    const result = query
      ? this.#stories.filter((story) => `${story.name} ${story.description}`.toLowerCase().includes(query))
      : this.#stories;

    this.#view.showStories(result, { fit: false, filtered: Boolean(query) });
  }

  async toggleSave(id) {
    const story = this.#stories.find((item) => item.id === id);
    if (!story) return;

    try {
      if (this.#savedIds.has(id)) {
        await this.#savedDb.delete(id);
        this.#savedIds.delete(id);
        this.#view.updateSaveState(id, false);
      } else {
        await this.#savedDb.put({ ...story, savedAt: Date.now() });
        this.#savedIds.add(id);
        this.#view.updateSaveState(id, true);
      }
    } catch {
      this.#view.showMessage('Gagal memperbarui cerita tersimpan.', 'error');
    }
  }
}
