import { t, localizedText, localizedAttribute, onLocaleChange } from '../../../game/i18n/index.mjs';
import { readSourceBytes, loadProductionImage, sourceURL } from '../../production/preview.mjs';
import { authoringLabel, authoringText } from '../../../game/ui/authoring-copy.mjs';
import { setMenuIcon } from '../../../game/ui/native-menu-icons.mjs';
import { validatePresentations, ROLE_IDS, BODY_IDS } from './model.mjs';
import { paintRole } from './preview.mjs';
import { createAnimationState, advanceAnimation } from '../../motion-lab/animation.mjs';
import { FPV_ROLE_SOURCES, FPV_ROLE_IMAGES } from './sources.mjs';

const prefix = 'tools:fpvRoleSourceReview.';
const rootURL = new URL('../../../', import.meta.url);
const records = FPV_ROLE_SOURCES.find(({ id }) => id === 'records');
export async function readFpvRolePresentations({ signal, window: win = globalThis.window } = {}) {
  const bytes = await readSourceBytes(sourceURL(records.path, rootURL), records.bytes, {
    signal,
    fetchSource: (url, options) => win.fetch(url, options),
  });
  const hash = [...new Uint8Array(await win.crypto.subtle.digest('SHA-256', bytes))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
  if (signal?.aborted || bytes.length !== records.bytes || hash !== records.sha256)
    throw new Error('Candidate source mismatch');
  return validatePresentations(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
export function loadFpvRoleImage(role, { signal, window: win = globalThis.window } = {}) {
  const pin = FPV_ROLE_IMAGES.find(({ id }) => id === role.classId);
  if (!pin || pin.sha256 !== role.sha256 || pin.width !== role.width || pin.height !== role.height)
    throw new Error('Original identity mismatch');
  return loadProductionImage(
    { role: 'original', file: pin, width: pin.width, height: pin.height },
    {
      rootURL,
      signal,
      fetchSource: (url, options) => win.fetch(url, options),
      cryptoSource: win.crypto,
      urlAPI: win.URL,
      makeImage: () => win.document.createElement('img'),
    },
  );
}

/** Existing source rendering at unchanged 360x190 CSS pixels. Paused control
 * changes repaint once, without advancing the cosmetic animation clock. */
export function paintFpvRoleCard(card, options) {
  const { elapsed, paused, reducedMotion, speedRatio, background } = options;
  card.state = advanceAnimation(
    card.state,
    card.role.recipe,
    { visualSpeed: speedRatio, cruiseSpeed: 1 },
    elapsed,
    { paused, reducedMotion },
  );
  const g = card.canvas.getContext('2d');
  g.fillStyle = background === 'light' ? '#ecece5' : '#0a1521';
  g.fillRect(0, 0, 360, 190);
  if (background === 'checker')
    for (let y = 0; y < 190; y += 10)
      for (let x = 0; x < 360; x += 10) {
        g.fillStyle = (x / 10 + y / 10) % 2 ? '#b6bbc2' : '#e8ebec';
        g.fillRect(x, y, 10, 10);
      }
  paintRole(g, card.role, card.image, card.state, {
    ...options,
    y: 93,
    x: 88,
    inspectionPixels: 128,
  });
  const actual = paintRole(g, card.role, card.image, card.state, { ...options, y: 93, x: 267 });
  g.fillStyle = background === 'dark' ? '#d7e7f0' : '#102030';
  g.font = '500 14px "Field Kit Mono", monospace';
  g.fillText(t(prefix + 'inspection'), 18, 178);
  g.fillText(t(prefix + 'actual', { size: actual.imageBoxCSS.toFixed(1) }), 191, 178);
}

export function mountFpvRolePresentation({
  document: doc,
  window: win = doc.defaultView,
  readPresentations = (options) => readFpvRolePresentations({ ...options, window: win }),
  loadImage = (role, options) => loadFpvRoleImage(role, { ...options, window: win }),
  paint = paintFpvRoleCard,
  autoStart = true,
} = {}) {
  const byId = (id) => doc.getElementById(id);
  const status = byId('status'),
    motion = byId('fpv-role-motion-status'),
    retry = byId('fpv-role-retry'),
    cancelButton = byId('fpv-role-cancel'),
    pause = byId('pause'),
    reduced = byId('reduced'),
    rotors = byId('rotors');
  const media = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const removers = [],
    cards = [];
  let disposed = false,
    suspended = false,
    paused = false,
    frameId = null,
    previous = null,
    generation = 0,
    operation = null,
    ready = Promise.resolve(),
    retained = [],
    staging = null;
  const listen = (node, event, fn) => {
    node.addEventListener(event, fn);
    removers.push(() => node.removeEventListener(event, fn));
  };
  const foreground = () => !suspended && !doc.hidden && doc.hasFocus?.() !== false;
  const reducedMotion = () => reduced.checked || !!media?.matches;
  const modal = () => !!doc.querySelector('dialog[open]');
  const hasImages = () => cards.every((card) => card.image);
  const eligible = () =>
    !disposed &&
    foreground() &&
    !modal() &&
    !paused &&
    !reducedMotion() &&
    rotors.checked &&
    !operation &&
    status.dataset.state === 'ready' &&
    hasImages();
  const updateMotion = () => {
    const state = operation
      ? 'loading'
      : !hasImages()
        ? status.dataset.state || 'loading'
        : !foreground() || modal()
          ? 'suspended'
          : reducedMotion()
            ? 'reduced'
            : paused
              ? 'paused'
              : !rotors.checked
                ? 'static'
                : status.dataset.state !== 'ready'
                  ? status.dataset.state
                  : 'playing';
    if (motion.dataset.state === state) return;
    motion.dataset.state = state;
    localizedText(motion, () => t(prefix + (state === 'reduced' ? 'reducedState' : state)));
  };
  function stop() {
    if (frameId !== null) win.cancelAnimationFrame(frameId);
    frameId = null;
    previous = null;
  }
  function draw(elapsed = 0) {
    if (disposed || !foreground() || modal() || !hasImages()) return;
    const options = {
      elapsed,
      paused,
      reducedMotion: reducedMotion(),
      speedRatio: Number(byId('speed').value),
      background: byId('background').value,
      arenaWidth: Number(byId('width').value),
      sizing: byId('sizing').value,
      heading: (Number(byId('heading').value) * Math.PI) / 180,
      showRotors: rotors.checked,
      guides: byId('guides').checked,
    };
    cards.forEach((card) => paint(card, options));
  }
  function frame(now) {
    frameId = null;
    if (!eligible()) {
      stop();
      updateMotion();
      return;
    }
    const elapsed = previous === null ? 0 : Math.max(0, Math.min(0.1, (now - previous) / 1000));
    previous = now;
    draw(elapsed);
    if (eligible()) frameId = win.requestAnimationFrame(frame);
  }
  function sync({ repaint = true } = {}) {
    stop();
    if (repaint) draw(0);
    updateMotion();
    if (eligible()) frameId = win.requestAnimationFrame(frame);
  }
  const show = (state) => {
    status.dataset.state = state;
    localizedText(status, () => t(prefix + state));
  };
  const ownsCancel = () => doc.activeElement === cancelButton && foreground() && !modal();
  function releaseStaging() {
    const pending = staging;
    staging = null;
    pending?.splice(0).forEach((item) => item?.dispose());
  }
  function settle(state) {
    const restore = ownsCancel();
    operation?.abort();
    releaseStaging();
    operation = null;
    retry.disabled = false;
    cancelButton.hidden = true;
    show(state);
    sync();
    if (restore) retry.focus();
  }
  for (const [index, id] of ROLE_IDS.entries()) {
    const article = doc.createElement('article'),
      title = doc.createElement('h2'),
      detail = doc.createElement('small'),
      read = doc.createElement('button'),
      help = doc.createElement('span'),
      region = doc.createElement('div'),
      canvas = doc.createElement('canvas');
    title.id = `fpv-role-${id}`;
    title.dataset.authoringTarget = `fpv-role-read-${id}`;
    const name = () => t(prefix + 'roles.' + id);
    localizedText(title, name);
    localizedText(detail, () =>
      t(prefix + 'detail', { role: id, body: BODY_IDS[index], count: id === 'carrier' ? 6 : 4 }),
    );
    read.id = `fpv-role-read-${id}`;
    read.type = 'button';
    read.disabled = true;
    authoringLabel(read, 'readPage');
    setMenuIcon(read, 'content');
    localizedAttribute(read, 'aria-label', () => `${authoringText('readPage')}: ${name()}`);
    authoringLabel(help, 'readHelp');
    help.className = 'role-read-help';
    help.id = `${read.id}-help`;
    read.setAttribute('aria-describedby', help.id);
    region.id = `fpv-role-canvas-${id}`;
    region.className = 'role-canvas-region';
    region.setAttribute('role', 'region');
    region.setAttribute('aria-labelledby', title.id);
    canvas.width = 360;
    canvas.height = 190;
    localizedAttribute(canvas, 'aria-label', () => t(prefix + 'canvasLabel', { name: name() }));
    region.append(canvas);
    article.append(title, detail, read, help, region);
    byId('cards').append(article);
    cards.push({ id, canvas, image: null, role: null, state: createAnimationState(), read });
  }
  const updatePause = () => {
    pause.setAttribute('aria-pressed', String(paused));
    authoringLabel(pause, paused ? 'playMedia' : 'pauseMedia');
    setMenuIcon(pause, 'play');
  };
  updatePause();
  listen(pause, 'click', () => {
    paused = !paused;
    updatePause();
    sync();
  });
  for (const id of [
    'sizing',
    'width',
    'heading',
    'speed',
    'background',
    'rotors',
    'guides',
    'reduced',
  ])
    listen(byId(id), 'change', () => sync());
  function cancel({ restoreFocus = true } = {}) {
    if (!operation) return;
    const restore = restoreFocus && ownsCancel();
    generation++;
    operation.abort();
    releaseStaging();
    operation = null;
    retry.disabled = false;
    cancelButton.hidden = true;
    show('cancelled');
    sync();
    if (restore) retry.focus();
  }
  function load() {
    if (disposed) return Promise.resolve();
    cancel({ restoreFocus: false });
    const controller = new AbortController(),
      visit = ++generation;
    operation = controller;
    const current = () =>
      !disposed && operation === controller && visit === generation && !controller.signal.aborted;
    const initiating = doc.activeElement === retry && foreground() && !modal();
    retry.disabled = true;
    cancelButton.hidden = false;
    show('loading');
    sync({ repaint: false });
    if (initiating) cancelButton.focus();
    const pending = [];
    staging = pending;
    ready = (async () => {
      try {
        const data = validatePresentations(
          JSON.stringify(await readPresentations({ signal: controller.signal })),
        );
        if (!current()) return;
        await Promise.all(
          data.roles.map(async (role, index) => {
            const result = await loadImage(role, { signal: controller.signal });
            if (!current()) {
              result.dispose();
              return;
            }
            pending[index] = result;
            if (
              result.image.naturalWidth !== role.width ||
              result.image.naturalHeight !== role.height
            )
              throw new Error('Original dimensions differ');
          }),
        );
        if (!current()) return;
        if (!foreground()) {
          cancel({ restoreFocus: false });
          return;
        }
        retained.forEach((item) => item.dispose());
        retained = pending.splice(0);
        cards.forEach((card, index) => {
          card.role = data.roles[index];
          card.image = retained[index].image;
          card.read.disabled = false;
        });
        settle('ready');
      } catch {
        if (current()) settle('error');
      } finally {
        pending.splice(0).forEach((item) => item?.dispose());
      }
    })();
    return ready;
  }
  listen(retry, 'click', () => void load());
  listen(cancelButton, 'click', () => cancel());
  const interrupt = () => {
    suspended = true;
    cancel({ restoreFocus: false });
    stop();
    updateMotion();
  };
  const resume = () => {
    suspended = doc.hidden || doc.hasFocus?.() === false;
    sync();
  };
  listen(win, 'blur', interrupt);
  listen(win, 'focus', resume);
  listen(win, 'pagehide', interrupt);
  listen(win, 'pageshow', resume);
  listen(doc, 'visibilitychange', () => (doc.hidden ? interrupt() : resume()));
  if (media?.addEventListener) listen(media, 'change', () => sync());
  // Modal ownership belongs to the shared host. Observing open only suspends
  // artwork; it does not consume, forward or synthesize input.
  const observer = new win.MutationObserver(() => sync());
  observer.observe(doc.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  const locale = onLocaleChange(() => () => sync(), { before: true });
  const owner = {
    load,
    cancel,
    get ready() {
      return ready;
    },
    destroy() {
      if (disposed) return;
      cancel({ restoreFocus: false });
      disposed = true;
      generation++;
      stop();
      retained.forEach((item) => item.dispose());
      retained = [];
      observer.disconnect();
      locale();
      removers.forEach((remove) => remove());
    },
  };
  if (autoStart) load();
  return owner;
}
