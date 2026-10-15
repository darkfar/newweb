let timer = null;

export function showToast(message, { type = 'info', timeout = 5000 } = {}) {
  const element = document.getElementById('toast');
  if (!element) return;

  element.textContent = message;
  element.className = `toast toast--${type}`;

  clearTimeout(timer);
  timer = setTimeout(() => {
    element.textContent = '';
    element.className = 'toast';
  }, timeout);
}
