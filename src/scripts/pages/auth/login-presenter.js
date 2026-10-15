const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default class LoginPresenter {
  #view;
  #api;
  #auth;

  constructor({ view, api, auth }) {
    this.#view = view;
    this.#api = api;
    this.#auth = auth;
  }

  validate({ email, password }) {
    const errors = {};

    if (!email.trim()) errors.email = 'Email wajib diisi.';
    else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Format email tidak valid.';

    if (!password) errors.password = 'Kata sandi wajib diisi.';
    else if (password.length < 8) errors.password = 'Kata sandi minimal 8 karakter.';

    return errors;
  }

  async login({ email, password }) {
    const errors = this.validate({ email, password });
    this.#view.showFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    this.#view.setSubmitting(true);
    try {
      const { loginResult } = await this.#api.login({ email: email.trim(), password });
      this.#auth.saveSession({ token: loginResult.token, name: loginResult.name });
      this.#view.loginSuccess();
    } catch (error) {
      this.#view.showError(error.message);
    } finally {
      this.#view.setSubmitting(false);
    }
  }
}
