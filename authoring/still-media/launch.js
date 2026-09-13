/* Dependency-free file/error guidance before any module or storage access. */
(() => {
  const status = document.getElementById('still-host-status');
  const open = document.getElementById('still-host-open');
  const fail = (message) => {
    open.disabled = true;
    status.textContent = message;
  };
  if (!['http:', 'https:'].includes(location.protocol)) {
    fail(
      'Use the repository source server on localhost or HTTPS. This file URL cannot open local media; no database was accessed.',
    );
    return;
  }
  open.disabled = true;
  import('./workshop.mjs')
    .then(() => {
      open.disabled = false;
    })
    .catch((error) => {
      fail(
        `Workshop could not start: ${error.message}. Reload the complete source page. No media was automatically opened.`,
      );
    });
})();
