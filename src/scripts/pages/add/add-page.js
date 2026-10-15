import AddPresenter, { MAX_PHOTO_SIZE } from './add-presenter';
import * as StoryApi from '../../data/api';
import { clearSession } from '../../data/auth';
import { PendingStoryDb } from '../../data/db';
import Camera from '../../utils/camera';
import { createMap, L } from '../../utils/map';
import { setFormMessage, setSubmitting, showFieldErrors } from '../../utils/form';

const FIELDS = ['description', 'photo', 'location'];

export default class AddPage {
  #presenter = null;
  #form = null;
  #map = null;
  #marker = null;
  #camera = null;
  #photo = null;
  #previewUrl = null;
  #lat = null;
  #lon = null;
  #redirectTimer = null;

  async render() {
    return `
      <section class="container add-section">
        <h1>Tambah Cerita Baru</h1>
        <p class="page-lead">Bagikan ceritamu lengkap dengan foto dan lokasinya.</p>

        <form id="add-form" class="form form--wide" novalidate>
          <div class="form-group">
            <label for="description">Deskripsi cerita</label>
            <textarea id="description" name="description" rows="4" required aria-describedby="description-error"></textarea>
            <p id="description-error" class="field-error"></p>
          </div>

          <fieldset class="form-group photo-group">
            <legend>Foto cerita (maks. 1 MB)</legend>

            <label for="photo">Pilih berkas gambar</label>
            <input id="photo" name="photo" type="file" accept="image/*" aria-describedby="photo-error">

            <div class="camera-actions">
              <button type="button" id="camera-open" class="button button--secondary">Buka kamera</button>
              <button type="button" id="camera-capture" class="button" hidden>Ambil foto</button>
              <button type="button" id="camera-close" class="button button--secondary" hidden>Tutup kamera</button>
            </div>

            <video id="camera-video" class="camera-video" playsinline muted hidden aria-label="Tampilan langsung kamera"></video>
            <canvas id="camera-canvas" hidden></canvas>

            <img id="photo-preview" class="photo-preview" alt="" hidden>
            <p id="photo-error" class="field-error"></p>
          </fieldset>

          <fieldset class="form-group">
            <legend>Lokasi cerita</legend>
            <p id="map-help" class="hint">Klik pada peta untuk memilih lokasi. Pengguna keyboard dapat menggeser peta dengan tombol panah, lalu memilih titik tengah peta.</p>
            <div id="add-map" class="map map--form" role="region" aria-label="Peta untuk memilih lokasi cerita" aria-describedby="map-help"></div>
            <button type="button" id="use-center" class="button button--secondary">Gunakan titik tengah peta</button>

            <div class="coordinate-row">
              <div>
                <label for="lat">Latitude</label>
                <input id="lat" name="lat" type="text" readonly placeholder="Belum dipilih" aria-describedby="location-error">
              </div>
              <div>
                <label for="lon">Longitude</label>
                <input id="lon" name="lon" type="text" readonly placeholder="Belum dipilih" aria-describedby="location-error">
              </div>
            </div>
            <p id="location-error" class="field-error"></p>
          </fieldset>

          <p class="hint">Saat offline, cerita disimpan di perangkat dan dikirim otomatis ketika koneksi kembali.</p>
          <p class="form-message" role="alert"></p>
          <button type="submit" class="button">Kirim cerita</button>
        </form>
      </section>
    `;
  }

  async afterRender() {
    this.#form = document.getElementById('add-form');
    this.#presenter = new AddPresenter({ view: this, api: StoryApi, pendingDb: PendingStoryDb });

    this.#setupMap();
    this.#setupPhotoInput();
    this.#setupCamera();

    this.#form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await this.#presenter.submit({
        description: this.#form.elements.description.value,
        photo: this.#photo,
        lat: this.#lat,
        lon: this.#lon,
      });
    });
  }

  destroy() {
    clearTimeout(this.#redirectTimer);
    this.#closeCamera(); // pastikan media stream selalu ditutup
    this.#revokePreview();
    this.#map?.remove();
    this.#map = null;
    this.#marker = null;
  }

  // ----- Peta -----

  #setupMap() {
    this.#map = createMap(document.getElementById('add-map'));
    this.#map.on('click', (event) => this.#setLocation(event.latlng.lat, event.latlng.lng));

    document.getElementById('use-center').addEventListener('click', () => {
      const center = this.#map.getCenter();
      this.#setLocation(center.lat, center.lng);
    });
  }

  #setLocation(lat, lon) {
    this.#lat = Number(lat.toFixed(6));
    this.#lon = Number(lon.toFixed(6));
    this.#form.elements.lat.value = this.#lat;
    this.#form.elements.lon.value = this.#lon;

    if (this.#marker) {
      this.#marker.setLatLng([this.#lat, this.#lon]);
    } else {
      this.#marker = L.marker([this.#lat, this.#lon], { alt: 'Lokasi cerita yang dipilih' }).addTo(this.#map);
    }

    this.#setError('location', '');
  }

  // ----- Foto (berkas) -----

  #setupPhotoInput() {
    const input = document.getElementById('photo');
    input.addEventListener('change', () => {
      const [file] = input.files;
      if (!file) return;

      if (!this.#setPhoto(file)) input.value = '';
    });
  }

  #setPhoto(file) {
    if (!file.type.startsWith('image/')) {
      this.#setError('photo', 'Berkas harus berupa gambar.');
      return false;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      this.#setError('photo', 'Ukuran foto maksimal 1 MB.');
      return false;
    }

    this.#closeCamera();
    this.#photo = file;
    this.#setError('photo', '');

    this.#revokePreview();
    this.#previewUrl = URL.createObjectURL(file);
    const preview = document.getElementById('photo-preview');
    preview.src = this.#previewUrl;
    preview.alt = 'Pratinjau foto yang akan diunggah';
    preview.hidden = false;
    return true;
  }

  #revokePreview() {
    if (this.#previewUrl) URL.revokeObjectURL(this.#previewUrl);
    this.#previewUrl = null;
  }

  // ----- Kamera -----

  #setupCamera() {
    this.#camera = new Camera({
      video: document.getElementById('camera-video'),
      canvas: document.getElementById('camera-canvas'),
    });

    document.getElementById('camera-open').addEventListener('click', async () => {
      try {
        await this.#camera.start();
        this.#toggleCameraUi(true);
        setFormMessage(this.#form, '');
      } catch (error) {
        this.#camera.stop();
        this.#toggleCameraUi(false);
        setFormMessage(this.#form, error.message || 'Tidak dapat mengakses kamera. Periksa izin kamera Anda.', 'error');
      }
    });

    document.getElementById('camera-capture').addEventListener('click', async () => {
      try {
        const blob = await this.#camera.capture();
        const file = new File([blob], `kamera-${Date.now()}.jpg`, { type: 'image/jpeg' });
        if (this.#setPhoto(file)) {
          document.getElementById('photo').value = '';
        }
      } catch (error) {
        setFormMessage(this.#form, error.message, 'error');
      }
    });

    document.getElementById('camera-close').addEventListener('click', () => this.#closeCamera());
  }

  #closeCamera() {
    if (!this.#camera) return;
    this.#camera.stop();
    this.#toggleCameraUi(false);
  }

  #toggleCameraUi(isOpen) {
    document.getElementById('camera-video')?.toggleAttribute('hidden', !isOpen);
    document.getElementById('camera-capture')?.toggleAttribute('hidden', !isOpen);
    document.getElementById('camera-close')?.toggleAttribute('hidden', !isOpen);
    document.getElementById('camera-open')?.toggleAttribute('hidden', isOpen);
  }

  // ----- View API (dipanggil presenter) -----

  #setError(name, message) {
    showFieldErrors(this.#form, [name], { [name]: message });
  }

  showFieldErrors(errors) {
    setFormMessage(this.#form, '');
    showFieldErrors(this.#form, FIELDS, errors);

    const first = FIELDS.find((name) => errors[name]);
    if (first === 'description') this.#form.elements.description.focus();
    else if (first === 'photo') this.#form.elements.photo.focus();
    else if (first === 'location') this.#form.elements.lat.focus();
  }

  setSubmitting(isSubmitting) {
    setSubmitting(this.#form, isSubmitting, 'Kirim cerita', 'Mengirim...');
  }

  showError(message) {
    setFormMessage(this.#form, message, 'error');
  }

  handleUnauthorized() {
    clearSession();
    location.hash = '#/login';
  }

  submitQueued() {
    this.#closeCamera();
    setFormMessage(
      this.#form,
      'Anda sedang offline. Cerita disimpan di perangkat dan akan dikirim otomatis saat online.',
      'success',
    );
    this.#redirectTimer = setTimeout(() => {
      location.hash = '#/saved';
    }, 1800);
  }

  submitSuccess() {
    this.#closeCamera();
    setFormMessage(this.#form, 'Cerita berhasil dikirim! Mengarahkan ke beranda...', 'success');
    this.#redirectTimer = setTimeout(() => {
      location.hash = '#/';
    }, 1200);
  }
}
