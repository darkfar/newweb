import DetailPresenter from './detail-presenter';
import * as StoryApi from '../../data/api';
import { clearSession } from '../../data/auth';
import { SavedStoryDb } from '../../data/db';
import { parseActivePathname } from '../../routes/url-parser';
import { createMap, L } from '../../utils/map';
import { showToast } from '../../utils/toast';
import { escapeHtml, showFormattedDate } from '../../utils';

export default class DetailPage {
  #presenter = null;
  #map = null;
  #saveButton = null;

  async render() {
    return `
      <section class="container detail-section">
        <p><a href="#/">&larr; Kembali ke beranda</a></p>
        <h1>Detail Cerita</h1>
        <div id="detail-content">
          <p class="status" role="status">Memuat cerita...</p>
        </div>
      </section>
    `;
  }

  async afterRender() {
    const { id } = parseActivePathname();
    this.#presenter = new DetailPresenter({ view: this, api: StoryApi, savedDb: SavedStoryDb });
    await this.#presenter.load(id);
  }

  destroy() {
    this.#map?.remove();
    this.#map = null;
    this.#saveButton = null;
  }

  // ----- View API -----

  showLoading() {
    this.#setContent('<p class="status" role="status">Memuat cerita...</p>');
  }

  showError(message) {
    this.#setContent(`<p class="status status--error" role="alert">Gagal memuat cerita: ${escapeHtml(message)}</p>`);
  }

  showMessage(message, type = 'info') {
    showToast(message, { type });
  }

  handleUnauthorized() {
    clearSession();
    location.hash = '#/login';
  }

  showStory(story, { isSaved = false, notice = '' } = {}) {
    const name = escapeHtml(story.name);
    const hasLocation = Number.isFinite(story.lat) && Number.isFinite(story.lon);

    this.#setContent(`
      ${notice ? `<p class="status" role="status">${escapeHtml(notice)}</p>` : ''}
      <article class="story-detail">
        <img class="story-detail__image" src="${escapeHtml(story.photoUrl)}" alt="Foto cerita dari ${name}">
        <div class="story-detail__body">
          <h2>${name}</h2>
          <p class="story-card__meta">
            <time datetime="${escapeHtml(story.createdAt)}">${showFormattedDate(story.createdAt, 'id-ID', { hour: '2-digit', minute: '2-digit' })}</time>
          </p>
          <p class="story-card__description">${escapeHtml(story.description)}</p>
          <p class="story-card__meta">
            ${hasLocation ? `Lokasi: ${story.lat.toFixed(4)}, ${story.lon.toFixed(4)}` : 'Lokasi tidak tersedia'}
          </p>
          <button type="button" id="detail-save" class="button button--secondary"></button>
        </div>
        ${hasLocation ? '<div id="detail-map" class="map" role="region" aria-label="Peta lokasi cerita"></div>' : ''}
      </article>
    `);

    this.#saveButton = document.getElementById('detail-save');
    this.#saveButton.addEventListener('click', () => this.#presenter.toggleSave());
    this.updateSaveState(isSaved, { silent: true });

    if (hasLocation) {
      this.#map?.remove();
      this.#map = createMap(document.getElementById('detail-map'), { center: [story.lat, story.lon], zoom: 13 });
      L.marker([story.lat, story.lon], { alt: `Lokasi cerita dari ${story.name}`, title: story.name }).addTo(this.#map);
    }
  }

  updateSaveState(isSaved, { silent = false } = {}) {
    if (!this.#saveButton) return;
    this.#saveButton.textContent = isSaved ? 'Hapus dari simpanan' : 'Simpan cerita';
    if (!silent) {
      showToast(isSaved ? 'Cerita disimpan di perangkat.' : 'Cerita dihapus dari simpanan.', { type: 'success' });
    }
  }

  #setContent(html) {
    const container = document.getElementById('detail-content');
    if (container) container.innerHTML = html;
  }
}
