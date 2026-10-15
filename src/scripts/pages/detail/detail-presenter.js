export default class DetailPresenter {
  #view;
  #api;
  #savedDb;
  #story = null;
  #isSaved = false;

  constructor({ view, api, savedDb }) {
    this.#view = view;
    this.#api = api;
    this.#savedDb = savedDb;
  }

  async load(id) {
    this.#view.showLoading();

    try {
      const { story } = await this.#api.getStoryDetail(id);
      this.#story = story;
      this.#isSaved = await this.#readSaved(id);
      this.#view.showStory(story, { isSaved: this.#isSaved });
    } catch (error) {
      if (error.status === 401) {
        this.#view.handleUnauthorized();
        return;
      }

      // Offline dan belum ada cache: coba ambil dari IndexedDB.
      const saved = await this.#savedDb.get(id).catch(() => null);
      if (saved) {
        this.#story = saved;
        this.#isSaved = true;
        this.#view.showStory(saved, {
          isSaved: true,
          notice: 'Menampilkan salinan yang tersimpan di perangkat.',
        });
        return;
      }

      this.#view.showError(error.message);
    }
  }

  async #readSaved(id) {
    try {
      return Boolean(await this.#savedDb.get(id));
    } catch {
      return false;
    }
  }

  async toggleSave() {
    if (!this.#story) return;

    try {
      if (this.#isSaved) {
        await this.#savedDb.delete(this.#story.id);
        this.#isSaved = false;
      } else {
        await this.#savedDb.put({ ...this.#story, savedAt: Date.now() });
        this.#isSaved = true;
      }
      this.#view.updateSaveState(this.#isSaved);
    } catch {
      this.#view.showMessage('Gagal memperbarui cerita tersimpan.', 'error');
    }
  }
}
