export function setFieldError(form, name, message) {
  const input = form.elements[name];
  const error = form.querySelector(`#${name}-error`);

  if (error) error.textContent = message || '';
  if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

export function showFieldErrors(form, names, errors) {
  names.forEach((name) => setFieldError(form, name, errors[name]));
}

export function setFormMessage(form, message, type = 'error') {
  const element = form.querySelector('.form-message');
  if (!element) return;

  element.textContent = message || '';
  element.className = `form-message${message ? ` form-message--${type}` : ''}`;
}

export function setSubmitting(form, isSubmitting, idleLabel, busyLabel) {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;

  button.disabled = isSubmitting;
  button.textContent = isSubmitting ? busyLabel : idleLabel;
}
