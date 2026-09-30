import { t, localizedText, localizedAttribute, onLocaleChange } from '../../../game/i18n/index.mjs';
import { readReserveManifest, loadReserveImage } from './sources.mjs';
const prefix = 'tools:reserveCatalog.';
export function mountReservePresentation({
  document: doc,
  window: win = doc.defaultView,
  readManifest = (options) => readReserveManifest({ ...options, window: win }),
  loadImage = (entry, options) => loadReserveImage(entry, { ...options, window: win }),
  onManifest = () => {},
  autoStart = true,
} = {}) {
  const $ = (id) => doc.getElementById(id),
    status = $('catalog-status'),
    retry = $('reserve-retry'),
    cancelButton = $('reserve-cancel');
  let manifest = null,
    entries = [],
    visible = [],
    current = null,
    retained = null,
    generation = 0,
    operation = null,
    disposed = false,
    ready = Promise.resolve();
  const cleanups = [];
  const listen = (node, type, fn) => {
    node.addEventListener(type, fn);
    cleanups.push(() => node.removeEventListener(type, fn));
  };
  const foreground = () =>
    !doc.hidden && doc.hasFocus?.() !== false && !doc.querySelector('dialog[open]');
  const setStatus = (state, key) => {
    status.dataset.state = state;
    localizedText(status.querySelector('.operation-status-label') || status, () => t(prefix + key));
    cancelButton.hidden = !operation;
    $('image-read').disabled = !retained || retained.entry !== current || !!operation;
    const download = $('download');
    if (retained?.entry === current && !operation) {
      download.href = retained.image.src;
      download.download = current.original.path.split('/').at(-1);
      download.removeAttribute('aria-disabled');
      download.removeAttribute('tabindex');
    } else {
      download.removeAttribute('href');
      download.setAttribute('aria-disabled', 'true');
      download.tabIndex = -1;
    }
  };
  const stop = () => {
    generation++;
    if (operation) {
      operation.controller.abort();
      win.clearTimeout(operation.timer);
    }
    operation = null;
  };
  function cancel({ restoreFocus = true } = {}) {
    if (!operation || disposed) return;
    const restore = restoreFocus && foreground() && doc.activeElement === cancelButton;
    stop();
    setStatus('cancelled', 'cancelled');
    if (restore) retry.focus();
  }
  function controls() {
    const position = visible.indexOf(current);
    $('previous').disabled = position <= 0;
    $('next').disabled = position >= visible.length - 1;
    if (foreground() && doc.activeElement === $('next') && $('next').disabled)
      $('previous').focus();
    else if (foreground() && doc.activeElement === $('previous') && $('previous').disabled)
      $('next').focus();
    localizedText($('position'), () =>
      t(prefix + 'position', { number: position + 1, count: visible.length }),
    );
    if (!current) return;
    $('selection').value = current.id;
    $('title').textContent = current.title;
    localizedText($('theme-wave'), () =>
      t(prefix + 'themeWave', { theme: manifest.themes[current.themeId], wave: current.wave }),
    );
    localizedText($('dimensions'), () =>
      t(prefix + 'dimensions', {
        width: current.width,
        height: current.height,
        size: (current.original.bytes / 1048576).toFixed(2),
      }),
    );
    $('sha').textContent = current.original.sha256;
    $('blob').textContent = current.original.gitBlob;
    $('path').textContent = current.original.path;
    $('cleanup').hidden = current.prompts.length < 2;
    for (const [id, source] of [
      ['prompt', current.prompts[0]],
      ['cleanup', current.prompts[1]],
      ['provenance', current.provenance],
      ['notes', current.notes],
    ]) {
      if (source) $(id).href = source.url;
      else $(id).removeAttribute('href');
    }
    localizedAttribute($('image-read'), 'aria-label', () =>
      t(prefix + 'inspectNamed', { title: current?.title || '' }),
    );
  }
  function filterOptions() {
    visible = entries.filter(
      (entry) => $('theme').value === 'all' || entry.themeId === $('theme').value,
    );
    $('selection').replaceChildren(
      ...visible.map((entry) => {
        const option = doc.createElement('option');
        option.value = entry.id;
        localizedText(option, () => t(prefix + 'option', { wave: entry.wave, title: entry.title }));
        return option;
      }),
    );
  }
  function begin() {
    stop();
    const op = {
      controller: new AbortController(),
      generation,
      timer: null,
      owned: doc.activeElement === retry && foreground(),
    };
    operation = op;
    op.timer = win.setTimeout(() => {
      if (operation !== op || disposed) return;
      const restore = op.owned && doc.activeElement === cancelButton && foreground();
      stop();
      setStatus('error', 'timeout');
      if (restore) retry.focus();
    }, 30000);
    setStatus('loading', manifest ? 'loadingImage' : 'loading');
    if (op.owned) cancelButton.focus();
    return op;
  }
  const valid = (op) =>
    !disposed &&
    operation === op &&
    generation === op.generation &&
    !op.controller.signal.aborted &&
    foreground();
  async function imageFor(entry, op) {
    let pending = null;
    try {
      pending = await loadImage(entry, { signal: op.controller.signal });
      if (!valid(op) || current !== entry) {
        pending.dispose();
        return;
      }
      retained?.dispose();
      retained = { ...pending, entry };
      pending = null;
      retained.image.width = entry.width;
      retained.image.height = entry.height;
      localizedAttribute(retained.image, 'alt', () =>
        t(prefix + 'imageAlt', { title: entry.title, theme: manifest.themes[entry.themeId] }),
      );
      $('image-slot').replaceChildren(retained.image);
      const restore = op.owned && doc.activeElement === cancelButton;
      win.clearTimeout(op.timer);
      operation = null;
      setStatus('ready', 'ready');
      if (restore) retry.focus();
    } catch {
      pending?.dispose();
      if (valid(op)) finishError(op);
    }
  }
  function finishError(op) {
    const restore = op.owned && doc.activeElement === cancelButton;
    stop();
    setStatus('error', 'error');
    if (restore && foreground()) retry.focus();
  }
  function show(entry) {
    if (disposed || !foreground() || !entries.includes(entry)) return ready;
    current = entry;
    controls();
    // Keep a completed original only when retrying that same selection. Never
    // show an older illustration under a newly selected title or download.
    if (retained?.entry !== entry) {
      retained?.dispose();
      retained = null;
      $('image-slot').replaceChildren();
    }
    const op = begin();
    ready = imageFor(entry, op);
    return ready;
  }
  function load() {
    if (disposed || !foreground()) return ready;
    const op = begin(),
      selectedId = current?.id;
    ready = (async () => {
      try {
        const next = await readManifest({ signal: op.controller.signal });
        if (!valid(op)) return;
        // The production reader verifies the immutable historical manifest before
        // any dynamic source descriptor or URL can be published.
        onManifest(next);
        manifest = next;
        entries = next.entries;
        const selectedTheme = $('theme').value || 'all';
        const all = doc.createElement('option');
        all.value = 'all';
        localizedText(all, () => t(prefix + 'allThemes'));
        $('theme').replaceChildren(
          all,
          ...Object.entries(next.themes).map(([id, label]) => {
            const option = doc.createElement('option');
            option.value = id;
            option.textContent = label;
            return option;
          }),
        );
        $('theme').value = ['all', ...Object.keys(next.themes)].includes(selectedTheme)
          ? selectedTheme
          : 'all';
        filterOptions();
        current = visible.find((entry) => entry.id === selectedId) || visible[0];
        if (retained?.entry.id === current.id) retained.entry = current;
        else {
          retained?.dispose();
          retained = null;
          $('image-slot').replaceChildren();
        }
        $('catalog').hidden = false;
        controls();
        setStatus('loading', 'loadingImage');
        await imageFor(current, op);
      } catch {
        if (valid(op)) finishError(op);
      }
    })();
    return ready;
  }
  listen(retry, 'click', load);
  listen(cancelButton, 'click', () => cancel());
  listen($('theme'), 'change', () => {
    if (!manifest) return;
    filterOptions();
    show(visible.includes(current) ? current : visible[0]);
  });
  listen($('selection'), 'change', () =>
    show(visible.find((entry) => entry.id === $('selection').value)),
  );
  listen($('previous'), 'click', () => show(visible[Math.max(0, visible.indexOf(current) - 1)]));
  listen($('next'), 'click', () =>
    show(visible[Math.min(visible.length - 1, visible.indexOf(current) + 1)]),
  );
  listen(win, 'blur', () => cancel({ restoreFocus: false }));
  listen(doc, 'visibilitychange', () => {
    if (doc.hidden) cancel({ restoreFocus: false });
  });
  listen(win, 'pagehide', (event) => {
    if (event.persisted) cancel({ restoreFocus: false });
    else destroy();
  });
  const observer = new win.MutationObserver(() => {
    if (doc.querySelector('dialog[open]')) cancel({ restoreFocus: false });
  });
  observer.observe(doc.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  const offLocale = onLocaleChange(
    () => () => {
      if (!disposed && manifest) controls();
    },
    { before: true },
  );
  function destroy() {
    if (disposed) return;
    stop();
    disposed = true;
    retained?.dispose();
    retained = null;
    observer.disconnect();
    offLocale();
    cleanups.forEach((fn) => fn());
  }
  const owner = {
    load,
    cancel,
    show,
    destroy,
    get ready() {
      return ready;
    },
    get current() {
      return current;
    },
  };
  if (autoStart) load();
  return owner;
}
