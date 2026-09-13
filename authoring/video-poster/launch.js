/* Visible local-file/module failure guidance; no storage or runtime side effects. */
(() => {
  const status = document.getElementById('video-poster-status');
  const controls = document.getElementById('video-poster-controls');
  if (!['http:', 'https:'].includes(location.protocol)) {
    status.textContent =
      'Open this preview through the repository server on localhost or HTTPS. File URLs cannot load its modules. No game or media storage was opened.';
    return;
  }
  import('./workshop.mjs')
    .then(() => {
      controls.disabled = false;
      status.textContent =
        'Choose a local video to inspect. No game or media storage is opened by this page.';
      document.getElementById('video-poster-file').focus();
    })
    .catch((error) => {
      controls.disabled = true;
      status.textContent = `Video poster preview could not start: ${error.message}. Reload the complete repository page.`;
    });
})();
