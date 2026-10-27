/** External bootstrap keeps strict native CSP and the access-gate script order. */
document.documentElement.dataset.modeShellPending = 'true';
const simLoadMessage = (message) => {
  const status = document.getElementById('sim-menu-boot-message');
  if (status && document.documentElement.dataset.modeShellPending) status.textContent = message;
};
const simLoadFailed = () =>
  simLoadMessage('Could not start. Reload to retry. / Не вдалося запустити. Оновіть сторінку.');
window.addEventListener('error', simLoadFailed, { once: true });
window.addEventListener('unhandledrejection', simLoadFailed, { once: true });
window.setTimeout(
  () =>
    simLoadMessage(
      'Still loading… You can reload or go back. / Ще завантажується… Можна оновити сторінку або повернутися назад.',
    ),
  15000,
);

for (const control of document.querySelectorAll('[data-sim-reload]'))
  control.addEventListener('click', (event) => {
    event.preventDefault();
    location.reload();
  });
for (const control of document.querySelectorAll('[data-sim-back]'))
  control.addEventListener('click', () => history.back());
