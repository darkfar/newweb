const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default class RegisterPresenter {
  #view;
  #api;

  constructor({ view, api }) {
    this.#view = view;
    this.#api = api;
  }

  validate({ name, email, password }) {
    const errors = {};

    if (!name.trim()) errors.name = 'Nama wajib diisi.';

    if (!email.trim()) errors.email = 'Email wajib diisi.';
    else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Format email tidak valid.';

    if (!password) errors.password = 'Kata sandi wajib diisi.';
    else if (password.length < 8) errors.password = 'Kata sandi minimal 8 karakter.';

    return errors;
  }

  async register({ name, email, password }) {
    const errors = this.validate({ name, email, password });
    this.#view.showFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    this.#view.setSubmitting(true);
    try {
      await this.#api.register({ name: name.trim(), email: email.trim(), password });
      this.#view.registerSuccess();
    } catch (error) {
      this.#view.showError(error.message);
      this.#view.setSubmitting(false);
    }
  }
}
