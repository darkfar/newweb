import SavedPresenter from './saved-presenter';
import { SavedStoryDb, PendingStoryDb } from '../../data/db';
import { syncPendingStories } from '../../data/sync';
import { showToast } from '../../utils/toast';
import { escapeHtml, showFormattedDate, truncate } from '../../utils';

export default class SavedPage {
  #presenter = null;
  #pendingUrls = [];
  #onPendingChanged = () => this.#presenter?.loadPending();

  async render() {
    return `
      <section class="container">
        <h1>Cerita Tersimpan</h1>
        <p class="page-lead">Cerita yang Anda simpan tetap bisa dibuka saat offline.</p>

        <section id="pending-section" class="panel" aria-labelledby="pending-title" hidden>
          <h2 id="pending-title">Menunggu sinkronisasi</h2>
          <p class="hint">Cerita yang dibuat saat offline dikirim otomatis ketika koneksi kembali.</p>
          <ul id="pending-list" class="pending-list"></ul>
          <button type="button" id="sync-button" class="button">Sinkronkan sekarang</button>
        </section>

        <section aria-labelledby="saved-title">
          <h2 id="saved-title">Tersimpan di perangkat</h2>

          <div class="toolbar">
            <div class="form-group">
              <label for="saved-search">Cari cerita tersimpan</label>
              <input id="saved-search" type="search" placeholder="Nama atau isi cerita" autocomplete="off">
            </div>
            <div class="form-group">
              <label for="saved-sort">Urutkan</label>
              <select id="saved-sort">
                <option value="recently-saved">Terakhir disimpan</option>
                <option value="newest">Cerita terbaru</option>
                <option value="oldest">Cerita terlama</option>
                <option value="name-asc">Nama A-Z</option>
                <option value="name-desc">Nama Z-A</option>
              </select>
            </div>
          </div>

          <p id="saved-status" class="status" role="status">Memuat...</p>
          <ul id="saved-list" class="story-list"></ul>
        </section>
      </section>
    `;
  }

  async afterRender() {
    this.#presenter = new SavedPresenter({
      view: this,
      savedDb: SavedStoryDb,
      pendingDb: PendingStoryDb,
      sync: syncPendingStories,
    });

    document.getElementById('saved-search').addEventListener('input', (event) => {
      this.#presenter.setQuery(event.target.value);
    });
    document.getElementById('saved-sort').addEventListener('change', (event) => {
      this.#presenter.setSort(event.target.value);
    });
    document.getElementById('saved-list').addEventListener('click', (event) => {
      const button = event.target.closest('[data-action="remove"]');
      if (button) this.#presenter.remove(button.dataset.id);
    });
    document.getElementById('pending-list').addEventListener('click', (event) => {
      const button = event.target.closest('[data-action="cancel-pending"]');
      if (button) this.#presenter.cancelPending(Number(button.dataset.id));
    });
    document.getElementById('sync-button').addEventListener('click', () => this.#presenter.syncNow());

    window.addEventListener('pending-stories-changed', this.#onPendingChanged);
    await this.#presenter.load();
  }

  destroy() {
    window.removeEventListener('pending-stories-changed', this.#onPendingChanged);
    this.#revokePendingUrls();
  }

  // ----- View API -----

  showError(message) {
    const status = document.getElementById('saved-status');
    if (status) {
      status.textContent = message;
      status.classList.add('status--error');
    }
  }

  showMessage(message, type = 'info') {
    showToast(message, { type });
  }

  showSaved(stories, { total, filtered }) {
    const list = document.getElementById('saved-list');
    const status = document.getElementById('saved-status');
    if (!list || !status) return;

    status.classList.remove('status--error');
    if (total === 0) {
      status.textContent = 'Belum ada cerita tersimpan. Tekan "Simpan" pada cerita di beranda.';
    } else if (stories.length === 0 && filtered) {
      status.textContent = 'Tidak ada cerita yang cocok dengan pencarian.';
    } else {
      status.textContent = `${stories.length} dari ${total} cerita tersimpan ditampilkan.`;
    }

    list.innerHTML = stories
      .map((story) => {
        const name = escapeHtml(story.name);
        const id = escapeHtml(story.id);
        return `
          <li>
            <article class="story-card">
              <img class="story-card__image" src="${escapeHtml(story.photoUrl)}" alt="Foto cerita dari ${name}" loading="lazy">
              <div class="story-card__body">
                <h3 class="story-card__title">${name}</h3>
                <p class="story-card__meta">
                  <time datetime="${escapeHtml(story.createdAt)}">${showFormattedDate(story.createdAt, 'id-ID')}</time>
                </p>
                <p class="story-card__description">${escapeHtml(story.description)}</p>
                <div class="story-card__actions">
                  <a class="button button--secondary" href="#/stories/${id}" aria-label="Lihat detail cerita dari ${name}">Lihat detail</a>
                  <button type="button" class="button button--secondary" data-action="remove" data-id="${id}"
                    aria-label="Hapus cerita dari ${name} dari simpanan">Hapus</button>
                </div>
              </div>
            </article>
          </li>
        `;
      })
      .join('');
  }

  showPending(items) {
    const section = document.getElementById('pending-section');
    const list = document.getElementById('pending-list');
    if (!section || !list) return;

    this.#revokePendingUrls();
    section.hidden = items.length === 0;

    list.innerHTML = items
      .map((item) => {
        const url = URL.createObjectURL(item.photo);
        this.#pendingUrls.push(url);
        return `
          <li class="pending-item">
            <img class="pending-item__image" src="${url}" alt="Pratinjau foto cerita yang menunggu dikirim">
            <div class="pending-item__body">
              <p>${escapeHtml(truncate(item.description, 120))}</p>
              <p class="story-card__meta">
                Dibuat <time datetime="${escapeHtml(item.createdAt)}">${showFormattedDate(item.createdAt, 'id-ID', { hour: '2-digit', minute: '2-digit' })}</time>
                &middot; Lokasi: ${Number(item.lat).toFixed(4)}, ${Number(item.lon).toFixed(4)}
              </p>
              ${item.lastError ? `<p class="field-error">Ditolak server: ${escapeHtml(item.lastError)}</p>` : ''}
              <button type="button" class="button button--secondary" data-action="cancel-pending" data-id="${item.localId}"
                aria-label="Batalkan pengiriman cerita: ${escapeHtml(truncate(item.description, 40))}">Batalkan</button>
            </div>
          </li>
        `;
      })
      .join('');
  }

  setSyncing(isSyncing) {
    const button = document.getElementById('sync-button');
    if (!button) return;
    button.disabled = isSyncing;
    button.textContent = isSyncing ? 'Menyinkronkan...' : 'Sinkronkan sekarang';
  }

  #revokePendingUrls() {
    this.#pendingUrls.forEach((url) => URL.revokeObjectURL(url));
    this.#pendingUrls = [];
  }
}
