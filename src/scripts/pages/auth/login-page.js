import LoginPresenter from './login-presenter';
import * as StoryApi from '../../data/api';
import * as Auth from '../../data/auth';
import { setFormMessage, setSubmitting, showFieldErrors } from '../../utils/form';

const FIELDS = ['email', 'password'];

export default class LoginPage {
  #presenter = null;
  #form = null;

  async render() {
    return `
      <section class="container auth-section">
        <h1>Masuk</h1>
        <p class="page-lead">Masuk untuk melihat dan membagikan cerita di peta.</p>

        <form id="login-form" class="form" novalidate>
          <div class="form-group">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" autocomplete="email" required aria-describedby="email-error">
            <p id="email-error" class="field-error"></p>
          </div>

          <div class="form-group">
            <label for="password">Kata sandi</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required aria-describedby="password-error">
            <p id="password-error" class="field-error"></p>
          </div>

          <p class="form-message" role="alert"></p>
          <button type="submit" class="button">Masuk</button>
        </form>

        <p class="auth-switch">Belum punya akun? <a href="#/register">Daftar di sini</a></p>
      </section>
    `;
  }

  async afterRender() {
    this.#form = document.getElementById('login-form');
    this.#presenter = new LoginPresenter({ view: this, api: StoryApi, auth: Auth });

    this.#form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await this.#presenter.login({
        email: this.#form.elements.email.value,
        password: this.#form.elements.password.value,
      });
    });
  }

  showFieldErrors(errors) {
    setFormMessage(this.#form, '');
    showFieldErrors(this.#form, FIELDS, errors);
    const firstInvalid = FIELDS.find((name) => errors[name]);
    if (firstInvalid) this.#form.elements[firstInvalid].focus();
  }

  setSubmitting(isSubmitting) {
    setSubmitting(this.#form, isSubmitting, 'Masuk', 'Memproses...');
  }

  showError(message) {
    setFormMessage(this.#form, message, 'error');
  }

  loginSuccess() {
    location.hash = '#/';
  }
}
