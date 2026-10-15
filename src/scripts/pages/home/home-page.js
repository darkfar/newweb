import HomePresenter from './home-presenter';
import * as StoryApi from '../../data/api';
import { clearSession } from '../../data/auth';
import { SavedStoryDb } from '../../data/db';
import { createMap, L } from '../../utils/map';
import { showToast } from '../../utils/toast';
import { escapeHtml, showFormattedDate, truncate } from '../../utils';

export default class HomePage {
  #presenter = null;
  #map = null;
  #markerLayer = null;
  #markers = new Map();
  #cards = new Map();
  #activeId = null;
  #savedIds = new Set();

  async render() {
    return `
      <section class="container">
        <h1>Cerita Terbaru</h1>
        <p class="page-lead">Jelajahi cerita pengguna dan lihat lokasinya di peta.</p>

        <div class="story-layout">
          <div class="map-wrapper">
            <div id="stories-map" class="map" role="region" aria-label="Peta lokasi cerita"></div>
          </div>

          <div class="story-panel">
            <div class="form-group">
              <label for="story-filter">Cari cerita</label>
              <input id="story-filter" type="search" placeholder="Nama atau isi cerita" autocomplete="off">
            </div>
            <p id="story-status" class="status" role="status">Memuat cerita...</p>
            <ul id="story-list" class="story-list"></ul>
          </div>
        </div>
      </section>
    `;
  }

  async afterRender() {
    this.#map = createMap(document.getElementById('stories-map'));
    this.#markerLayer = L.layerGroup().addTo(this.#map);
    this.#presenter = new HomePresenter({ view: this, api: StoryApi, savedDb: SavedStoryDb });

    document.getElementById('story-filter').addEventListener('input', (event) => {
      this.#presenter.filter(event.target.value);
    });

    document.getElementById('story-list').addEventListener('click', (event) => {
      const showButton = event.target.closest('[data-action="show-on-map"]');
      if (showButton) {
        this.#focusStory(showButton.dataset.id);
        return;
      }

      const saveButton = event.target.closest('[data-action="toggle-save"]');
      if (saveButton) this.#presenter.toggleSave(saveButton.dataset.id);
    });

    await this.#presenter.loadStories();
  }

  destroy() {
    this.#map?.remove();
    this.#map = null;
    this.#markerLayer = null;
    this.#markers.clear();
    this.#cards.clear();
    this.#activeId = null;
  }

  // ----- View API (dipanggil presenter) -----

  showLoading() {
    this.#setStatus('Memuat cerita...');
  }

  showError(message) {
    this.#setStatus(`Gagal memuat cerita: ${message}`, true);
  }

  showMessage(message, type = 'info') {
    showToast(message, { type });
  }

  handleUnauthorized() {
    clearSession();
    location.hash = '#/login';
  }

  setSavedIds(savedIds) {
    this.#savedIds = savedIds;
  }

  updateSaveState(id, isSaved) {
    const button = this.#cards.get(id)?.querySelector('[data-action="toggle-save"]');
    if (button) {
      const name = button.dataset.name;
      button.textContent = isSaved ? 'Hapus dari simpanan' : 'Simpan';
      button.setAttribute('aria-label', `${isSaved ? 'Hapus' : 'Simpan'} cerita dari ${name}${isSaved ? ' dari simpanan' : ''}`);
    }
    showToast(isSaved ? 'Cerita disimpan di perangkat.' : 'Cerita dihapus dari simpanan.', { type: 'success' });
  }

  showStories(stories, { fit = false, filtered = false, notice = '' } = {}) {
    const list = document.getElementById('story-list');
    if (!list || !this.#map) return;

    this.#activeId = null;
    this.#cards.clear();
    this.#markers.clear();
    this.#markerLayer.clearLayers();

    list.innerHTML = stories.map((story) => this.#cardTemplate(story)).join('');
    list.querySelectorAll('.story-card').forEach((card) => this.#cards.set(card.dataset.id, card));

    const points = [];
    stories.forEach((story) => {
      if (!this.#hasLocation(story)) return;

      const position = [story.lat, story.lon];
      const marker = L.marker(position, {
        title: story.name,
        alt: `Lokasi cerita dari ${story.name}`,
      }).bindPopup(this.#popupTemplate(story), { maxWidth: 240 });

      marker.on('click', () => this.#setActive(story.id, { scroll: true }));
      this.#markerLayer.addLayer(marker);
      this.#markers.set(story.id, marker);
      points.push(position);
    });

    if (fit && points.length > 0) {
      this.#map.fitBounds(L.latLngBounds(points).pad(0.2), { maxZoom: 12 });
    }

    const summary =
      stories.length === 0
        ? filtered
          ? 'Tidak ada cerita yang cocok dengan pencarian.'
          : 'Belum ada cerita.'
        : `${stories.length} cerita ditampilkan.`;
    this.#setStatus(notice ? `${summary} ${notice}` : summary);
  }

  // ----- Helpers -----

  #setStatus(message, isError = false) {
    const status = document.getElementById('story-status');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('status--error', isError);
  }

  #hasLocation(story) {
    return Number.isFinite(story.lat) && Number.isFinite(story.lon);
  }

  #focusStory(id) {
    const marker = this.#markers.get(id);
    if (!marker) return;

    this.#map.setView(marker.getLatLng(), Math.max(this.#map.getZoom(), 13));
    marker.openPopup();
    this.#setActive(id);
    document.getElementById('stories-map')?.scrollIntoView({
      behavior: this.#prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'nearest',
    });
  }

  #setActive(id, { scroll = false } = {}) {
    if (this.#activeId) {
      this.#cards.get(this.#activeId)?.classList.remove('story-card--active');
      this.#markers.get(this.#activeId)?.getElement()?.classList.remove('marker-active');
    }

    this.#activeId = id;
    const card = this.#cards.get(id);
    card?.classList.add('story-card--active');
    this.#markers.get(id)?.getElement()?.classList.add('marker-active');

    if (scroll) {
      card?.scrollIntoView({
        behavior: this.#prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'center',
      });
    }
  }

  #prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  #cardTemplate(story) {
    const hasLocation = this.#hasLocation(story);
    const name = escapeHtml(story.name);
    const id = escapeHtml(story.id);
    const isSaved = this.#savedIds.has(story.id);

    return `
      <li>
        <article class="story-card" data-id="${id}">
          <img class="story-card__image" src="${escapeHtml(story.photoUrl)}" alt="Foto cerita dari ${name}" loading="lazy">
          <div class="story-card__body">
            <h2 class="story-card__title">${name}</h2>
            <p class="story-card__meta">
              <time datetime="${escapeHtml(story.createdAt)}">${showFormattedDate(story.createdAt, 'id-ID')}</time>
            </p>
            <p class="story-card__description">${escapeHtml(story.description)}</p>
            <p class="story-card__meta">
              ${hasLocation ? `Lokasi: ${story.lat.toFixed(4)}, ${story.lon.toFixed(4)}` : 'Lokasi tidak tersedia'}
            </p>
            <div class="story-card__actions">
              ${
                hasLocation
                  ? `<button type="button" class="button button--secondary" data-action="show-on-map"
                       data-id="${id}" aria-label="Lihat cerita dari ${name} di peta">Lihat di peta</button>`
                  : ''
              }
              <a class="button button--secondary" href="#/stories/${id}" aria-label="Lihat detail cerita dari ${name}">Lihat detail</a>
              <button type="button" class="button button--secondary" data-action="toggle-save"
                data-id="${id}" data-name="${name}"
                aria-label="${isSaved ? 'Hapus' : 'Simpan'} cerita dari ${name}${isSaved ? ' dari simpanan' : ''}">${isSaved ? 'Hapus dari simpanan' : 'Simpan'}</button>
            </div>
          </div>
        </article>
      </li>
    `;
  }

  #popupTemplate(story) {
    const name = escapeHtml(story.name);
    return `
      <div class="popup">
        <img class="popup-image" src="${escapeHtml(story.photoUrl)}" alt="Foto cerita dari ${name}">
        <strong>${name}</strong>
        <p>${escapeHtml(truncate(story.description, 100))}</p>
      </div>
    `;
  }
}
