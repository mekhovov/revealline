/** Passive presentation only: transport, pause and navigation remain host-owned. */
export function attachMusicCredit({ document: doc, root, pauseButton, prefix }) {
  const details = doc.createElement('section');
  details.id = `${prefix}-music-details`;
  details.className = 'music-credit-details';
  details.setAttribute('aria-label', 'Current soundtrack details');
  const title = doc.createElement('p'),
    artist = doc.createElement('p'),
    file = doc.createElement('p'),
    source = doc.createElement('p'),
    link = doc.createElement('a');
  link.setAttribute('target', '_blank');
  link.setAttribute('rel', 'noopener noreferrer');
  source.append(link);
  details.append(title, artist, file, source);
  root.append(details);
  const previousDescription = pauseButton?.getAttribute('aria-description');
  pauseButton?.classList.add('compact-track-pause');
  let disposed = false,
    identity = null,
    description = null;
  const text = (value, fallback) =>
    typeof value === 'string' && value.trim() ? value.trim() : fallback;
  function website(track) {
    for (const value of [
      ...(track?.websites ?? []).map((site) => site.url),
      track?.rights?.source,
    ]) {
      try {
        const url = new URL(value);
        if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password)
          return url;
      } catch {
        /* Legacy sources may be plain text. */
      }
    }
    return null;
  }
  function render(playback = {}, master = {}) {
    if (disposed) return;
    const track = playback.track,
      name = text(track?.title, 'No track selected'),
      performer = text(track?.artist, 'Artist not recorded'),
      filename = text(
        track?.fileName,
        track?.kind === 'synth' ? 'Built-in synthesized music' : 'Original filename not recorded',
      ),
      url = website(track),
      muted = master.muted || master.volume === 0 || playback.volume === 0,
      caption = !track
        ? 'Music off'
        : muted
          ? `Muted: ${name}`
          : playback.playing
            ? `♪ ${name}`
            : `Paused: ${name}`,
      key = JSON.stringify([name, performer, filename, url?.href, caption]);
    if (key === identity) return;
    identity = key;
    title.textContent = `Track: ${name}`;
    artist.textContent = `Artist: ${performer}`;
    file.textContent = `File: ${filename}`;
    link.textContent = url ? `Source: ${url.hostname}` : 'Source website not recorded';
    if (url) link.setAttribute('href', url.href);
    else link.removeAttribute('href');
    if (pauseButton) {
      pauseButton.setAttribute('data-track-caption', caption);
      description = `${caption}. Full soundtrack details are in Settings, Audio.`;
      pauseButton.setAttribute('aria-description', description);
    }
  }
  render();
  return Object.freeze({
    render,
    element: details,
    dispose() {
      if (disposed) return;
      disposed = true;
      details.remove();
      pauseButton?.classList.remove('compact-track-pause');
      pauseButton?.removeAttribute('data-track-caption');
      if (pauseButton?.getAttribute('aria-description') === description) {
        if (previousDescription === null) pauseButton.removeAttribute('aria-description');
        else pauseButton.setAttribute('aria-description', previousDescription);
      }
    },
  });
}
