import routes, { guestRoutes, protectedRoutes } from '../routes/routes';
import { getActiveRoute } from '../routes/url-parser';
import { clearSession, isLoggedIn } from '../data/auth';
import { syncPendingStories } from '../data/sync';
import { registerServiceWorker } from '../utils/sw';
import { isPushSupported, isSubscribed, subscribePush, unsubscribePush } from '../utils/push';
import { showToast } from '../utils/toast';
import NotFoundPage from './not-found/not-found-page';

class App {
  #content = null;
  #drawerButton = null;
  #navigationDrawer = null;
  #skipLink = null;
  #currentPage = null;
  #currentRoute = '/';
  #notFoundPage = new NotFoundPage();
  #pushSubscribed = false;
  #installPrompt = null;

  constructor({ navigationDrawer, drawerButton, content, skipLink }) {
    this.#content = content;
    this.#drawerButton = drawerButton;
    this.#navigationDrawer = navigationDrawer;
    this.#skipLink = skipLink;

    this._setupDrawer();
    this._setupSkipLink();
    this._setupNavigationActions();
  }

  async init() {
    this._setupConnectivity();
    this._setupInstallPrompt();
    this._setupServiceWorkerMessages();

    await this.renderPage();

    // Dijalankan setelah halaman tampil agar tidak menghambat render pertama.
    registerServiceWorker()
      .then(() => this._refreshPushState())
      .then(() => this._runSync());
  }

  // ----- Drawer & skip link -----

  _setDrawer(isOpen) {
    this.#navigationDrawer.classList.toggle('open', isOpen);
    this.#drawerButton.setAttribute('aria-expanded', String(isOpen));
  }

  _setupDrawer() {
    this.#drawerButton.addEventListener('click', () => {
      this._setDrawer(!this.#navigationDrawer.classList.contains('open'));
    });

    document.body.addEventListener('click', (event) => {
      if (!this.#navigationDrawer.contains(event.target) && !this.#drawerButton.contains(event.target)) {
        this._setDrawer(false);
      }

      this.#navigationDrawer.querySelectorAll('a').forEach((link) => {
        if (link.contains(event.target)) {
          this._setDrawer(false);
        }
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.#navigationDrawer.classList.contains('open')) {
        this._setDrawer(false);
        this.#drawerButton.focus();
      }
    });
  }

  // Skip to content: href="#main-content" akan bentrok dengan hash routing,
  // jadi klik dicegat lalu fokus dipindahkan secara manual.
  _setupSkipLink() {
    this.#skipLink.addEventListener('click', (event) => {
      event.preventDefault();
      this.#skipLink.blur();
      this.#content.focus();
      this.#content.scrollIntoView();
    });
  }

  // ----- Navigasi -----

  _updateNavigation(route = this.#currentRoute) {
    const loggedIn = isLoggedIn();
    const links = loggedIn
      ? [
          ['/', 'Beranda'],
          ['/saved', 'Tersimpan'],
          ['/add', 'Tambah Cerita'],
          ['/about', 'Tentang'],
          ['/logout', 'Keluar'],
        ]
      : [
          ['/login', 'Masuk'],
          ['/register', 'Daftar'],
          ['/about', 'Tentang'],
        ];

    const items = links.map(([path, label]) => {
      const current = path === route ? ' aria-current="page"' : '';
      return `<li><a href="#${path}"${current}>${label}</a></li>`;
    });

    if (loggedIn && isPushSupported()) {
      const label = this.#pushSubscribed ? 'Matikan Notifikasi' : 'Aktifkan Notifikasi';
      items.push(`<li><button type="button" class="nav-button" data-action="toggle-push">${label}</button></li>`);
    }

    if (this.#installPrompt) {
      items.push('<li><button type="button" class="nav-button" data-action="install">Pasang Aplikasi</button></li>');
    }

    this.#navigationDrawer.querySelector('#nav-list').innerHTML = items.join('');
  }

  _setupNavigationActions() {
    this.#navigationDrawer.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;

      if (button.dataset.action === 'toggle-push') await this._togglePush(button);
      if (button.dataset.action === 'install') await this._install();
    });
  }

  // ----- Push notification -----

  async _refreshPushState() {
    try {
      this.#pushSubscribed = await isSubscribed();
    } catch {
      this.#pushSubscribed = false;
    }
    this._updateNavigation();
  }

  async _togglePush(button) {
    button.disabled = true;

    try {
      if (this.#pushSubscribed) {
        await unsubscribePush();
        this.#pushSubscribed = false;
        showToast('Notifikasi dinonaktifkan.', { type: 'success' });
      } else {
        await subscribePush();
        this.#pushSubscribed = true;
        showToast('Notifikasi diaktifkan. Anda akan diberi tahu saat cerita baru dibuat.', { type: 'success' });
      }
    } catch (error) {
      showToast(error.message, { type: 'error' });
    }

    this._updateNavigation();
    this.#navigationDrawer.querySelector('[data-action="toggle-push"]')?.focus();
  }

  // ----- PWA: install, offline, pesan dari service worker -----

  _setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.#installPrompt = event;
      this._updateNavigation();
    });

    window.addEventListener('appinstalled', () => {
      this.#installPrompt = null;
      this._updateNavigation();
      showToast('Aplikasi berhasil dipasang.', { type: 'success' });
    });
  }

  async _install() {
    if (!this.#installPrompt) return;

    this.#installPrompt.prompt();
    await this.#installPrompt.userChoice;
    this.#installPrompt = null;
    this._updateNavigation();
  }

  _setupConnectivity() {
    const indicator = document.getElementById('offline-indicator');
    const update = () => {
      indicator.hidden = navigator.onLine;
    };

    window.addEventListener('offline', update);
    window.addEventListener('online', () => {
      update();
      this._runSync();
    });
    update();
  }

  async _runSync() {
    const result = await syncPendingStories();
    if (!result) return;

    if (result.synced > 0) {
      showToast(`${result.synced} cerita yang dibuat saat offline berhasil dikirim.`, { type: 'success' });
    }
    if (result.failed > 0) {
      showToast(`${result.failed} cerita ditolak server. Periksa di halaman Tersimpan.`, { type: 'error' });
    }
  }

  _setupServiceWorkerMessages() {
    if (!('serviceWorker' in navigator)) return;

    // Klik pada notifikasi: service worker meminta halaman membuka detail cerita.
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'NAVIGATE' && typeof event.data.hash === 'string') {
        location.hash = event.data.hash;
      }
    });
  }

  // ----- Render halaman -----

  async renderPage() {
    const route = getActiveRoute();

    if (route === '/logout') {
      await unsubscribePush({ force: true }).catch(() => {});
      clearSession();
      this.#pushSubscribed = false;
      location.replace('#/login');
      return;
    }

    if (protectedRoutes.includes(route) && !isLoggedIn()) {
      location.replace('#/login');
      return;
    }

    if (guestRoutes.includes(route) && isLoggedIn()) {
      location.replace('#/');
      return;
    }

    const page = routes[route] ?? this.#notFoundPage;

    const updateView = async () => {
      this.#currentPage?.destroy?.();
      this.#currentPage = page;
      this.#currentRoute = route;

      this.#content.innerHTML = await page.render();
      await page.afterRender();
      this._updateNavigation(route);
      window.scrollTo(0, 0);
    };

    // View Transition API (dengan animasi kustom di styles.css).
    if (document.startViewTransition) {
      const transition = document.startViewTransition(updateView);
      await transition.updateCallbackDone;
    } else {
      await updateView();
    }
  }
}

export default App;
