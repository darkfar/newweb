export const MAX_PHOTO_SIZE = 1_000_000; // batas upload Story API: 1 MB

export default class AddPresenter {
  #view;
  #api;
  #pendingDb;

  constructor({ view, api, pendingDb }) {
    this.#view = view;
    this.#api = api;
    this.#pendingDb = pendingDb;
  }

  validate({ description, photo, lat, lon }) {
    const errors = {};

    if (!description.trim()) errors.description = 'Deskripsi wajib diisi.';

    if (!photo) errors.photo = 'Foto wajib dipilih atau diambil dari kamera.';
    else if (photo.size > MAX_PHOTO_SIZE) errors.photo = 'Ukuran foto maksimal 1 MB.';

    if (lat === null || lon === null) errors.location = 'Pilih lokasi dengan mengklik peta.';

    return errors;
  }

  async submit({ description, photo, lat, lon }) {
    const errors = this.validate({ description, photo, lat, lon });
    this.#view.showFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const story = { description: description.trim(), photo, lat, lon };
    this.#view.setSubmitting(true);

    // Offline: simpan ke IndexedDB, dikirim otomatis saat koneksi kembali.
    if (!navigator.onLine) {
      await this.#queue(story);
      return;
    }

    try {
      await this.#api.addStory(story);
      this.#view.submitSuccess();
    } catch (error) {
      if (error.status === 401) {
        this.#view.handleUnauthorized();
        return;
      }
      if (error.isNetworkError) {
        await this.#queue(story);
        return;
      }
      this.#view.showError(error.message);
      this.#view.setSubmitting(false);
    }
  }

  async #queue(story) {
    try {
      await this.#pendingDb.add({ ...story, createdAt: new Date().toISOString() });
      this.#view.submitQueued();
    } catch {
      this.#view.showError('Gagal menyimpan cerita untuk dikirim nanti. Coba lagi.');
      this.#view.setSubmitting(false);
    }
  }
}
