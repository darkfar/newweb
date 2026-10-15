import RegisterPresenter from './register-presenter';
import * as StoryApi from '../../data/api';
import { setFormMessage, setSubmitting, showFieldErrors } from '../../utils/form';

const FIELDS = ['name', 'email', 'password'];

export default class RegisterPage {
  #presenter = null;
  #form = null;
  #redirectTimer = null;

  async render() {
    return `
      <section class="container auth-section">
        <h1>Daftar Akun</h1>
        <p class="page-lead">Buat akun baru untuk mulai membagikan cerita.</p>

        <form id="register-form" class="form" novalidate>
          <div class="form-group">
            <label for="name">Nama</label>
            <input id="name" name="name" type="text" autocomplete="name" required aria-describedby="name-error">
            <p id="name-error" class="field-error"></p>
          </div>

          <div class="form-group">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" autocomplete="email" required aria-describedby="email-error">
            <p id="email-error" class="field-error"></p>
          </div>

          <div class="form-group">
            <label for="password">Kata sandi (minimal 8 karakter)</label>
            <input id="password" name="password" type="password" autocomplete="new-password" required aria-describedby="password-error">
            <p id="password-error" class="field-error"></p>
          </div>

          <p class="form-message" role="alert"></p>
          <button type="submit" class="button">Daftar</button>
        </form>

        <p class="auth-switch">Sudah punya akun? <a href="#/login">Masuk di sini</a></p>
      </section>
    `;
  }

  async afterRender() {
    this.#form = document.getElementById('register-form');
    this.#presenter = new RegisterPresenter({ view: this, api: StoryApi });

    this.#form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await this.#presenter.register({
        name: this.#form.elements.name.value,
        email: this.#form.elements.email.value,
        password: this.#form.elements.password.value,
      });
    });
  }

  destroy() {
    clearTimeout(this.#redirectTimer);
  }

  showFieldErrors(errors) {
    setFormMessage(this.#form, '');
    showFieldErrors(this.#form, FIELDS, errors);
    const firstInvalid = FIELDS.find((name) => errors[name]);
    if (firstInvalid) this.#form.elements[firstInvalid].focus();
  }

  setSubmitting(isSubmitting) {
    setSubmitting(this.#form, isSubmitting, 'Daftar', 'Memproses...');
  }

  showError(message) {
    setFormMessage(this.#form, message, 'error');
  }

  registerSuccess() {
    setFormMessage(this.#form, 'Pendaftaran berhasil! Mengarahkan ke halaman masuk...', 'success');
    this.#redirectTimer = setTimeout(() => {
      location.hash = '#/login';
    }, 1200);
  }
}
