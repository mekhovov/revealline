/* Visible local-file/module failure guidance; no storage or runtime side effects. */
(() => {
  const status = document.getElementById('video-poster-status');
  const controls = document.getElementById('video-poster-controls');
  if (!['http:', 'https:'].includes(location.protocol)) {
    status.removeAttribute?.('data-state');
    status.textContent =
      'Open this preview through the repository server on localhost or HTTPS. File URLs cannot load its modules. No game or media storage was opened.';
    return;
  }
  import('./workshop.mjs')
    .then(() => {
      controls.disabled = false;
      // Keep the attached presenter intact and preserve any deliberate focus choice.
      if (!document.hidden && document.activeElement === document.body)
        document.getElementById('video-poster-file').focus();
    })
    .catch((error) => {
      status.removeAttribute?.('data-state');
      controls.disabled = true;
      status.textContent = `Video poster preview could not start: ${error.message}. Reload the complete repository page.`;
    });
})();
