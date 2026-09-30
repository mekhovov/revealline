import { t, localizedText, localizedAttribute, onLocaleChange } from '../../../game/i18n/index.mjs';
import { readSourceBytes, loadProductionImage, sourceURL } from '../../production/preview.mjs';
import { authoringLabel, authoringText } from '../../../game/ui/authoring-copy.mjs';
import { setMenuIcon } from '../../../game/ui/native-menu-icons.mjs';
import { validateVariants, ROLE_IDS } from './model.mjs';
import { validatePresentations } from '../ukraine-role-presentations/model.mjs';
import { paintRole } from '../ukraine-role-presentations/preview.mjs';
import { createAnimationState, advanceAnimation } from '../../motion-lab/animation.mjs';
import { UKRAINE_WIDE_MANIFESTS, UKRAINE_WIDE_IMAGES } from './sources.mjs';

const prefix = 'tools:fpvRoleSourceReview.';
const rootURL = new URL('../../../', import.meta.url);

export function validateWideComparisons(data) {
  const newer = validateVariants(JSON.stringify(data.newer)),
    older = validatePresentations(JSON.stringify(data.older));
  return newer.roles.map((role) => ({
    id: role.classId,
    roles: [older.roles.find((entry) => entry.classId === role.classId), role],
  }));
}
export async function readUkraineWidePresentations({
  signal,
  window: win = globalThis.window,
} = {}) {
  const documents = await Promise.all(
    UKRAINE_WIDE_MANIFESTS.map(async (pin) => {
      const bytes = await readSourceBytes(sourceURL(pin.path, rootURL), pin.bytes, {
        signal,
        fetchSource: (url, options) => win.fetch(url, options),
      });
      const hash = [...new Uint8Array(await win.crypto.subtle.digest('SHA-256', bytes))]
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('');
      if (signal?.aborted || bytes.length !== pin.bytes || hash !== pin.sha256)
        throw new Error('Candidate source mismatch');
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    }),
  );
  return { newer: validateVariants(documents[0]), older: validatePresentations(documents[1]) };
}
export function loadUkraineWideImage(
  role,
  { version, signal, window: win = globalThis.window } = {},
) {
  const pin = UKRAINE_WIDE_IMAGES.find(
      (entry) => entry.id === role.classId && entry.version === version,
    ),
    folder = version === 'v1' ? 'ukraine-role-presentations' : 'ukraine-role-wide-variants';
  if (
    !pin ||
    pin.path !== `authoring/library/${folder}/${role.body.src}` ||
    pin.sha256 !== role.sha256 ||
    pin.width !== role.width ||
    pin.height !== role.height
  )
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

/** Preserve the existing comparison samples and fixed 780x215 CSS geometry. */
export function paintUkraineWideCard(card, options) {
  const { elapsed, paused, reducedMotion, speedRatio, background } = options,
    light = background === 'light',
    ctx = card.canvas.getContext('2d');
  ctx.fillStyle = light ? '#f3ecdf' : '#071320';
  ctx.fillRect(0, 0, 780, 215);
  ctx.fillStyle = light ? '#152438' : '#e8eee8';
  ctx.font = '13px monospace';
  for (const [version, item] of card.items.entries()) {
    item.state = advanceAnimation(
      item.state,
      item.role.recipe,
      { visualSpeed: speedRatio, cruiseSpeed: 1 },
      elapsed,
      { paused, reducedMotion },
    );
    for (const [size, x] of [
      [128, version ? 252 : 90],
      [20, version ? 447 : 389],
      [32, version ? 628 : 553],
    ]) {
      paintRole(ctx, item.role, item.image, item.state, {
        ...options,
        x,
        y: 105,
        inspectionPixels: size,
      });
      ctx.fillStyle = light ? '#152438' : '#e8eee8';
      ctx.fillText(`${version ? 'v3' : 'v1'} ${size}px`, x - (size === 128 ? 33 : 25), 193);
    }
  }
}

export function mountUkraineWidePresentation({
  document: doc,
  window: win = doc.defaultView,
  readPresentations = (options) => readUkraineWidePresentations({ ...options, window: win }),
  loadImage = (role, options) => loadUkraineWideImage(role, { ...options, window: win }),
  paint = paintUkraineWideCard,
  autoStart = true,
} = {}) {
  const byId = (id) => doc.getElementById(id);
  const status = byId('status'),
    motion = byId('ukraine-wide-motion-status'),
    retry = byId('ukraine-wide-retry'),
    cancelButton = byId('ukraine-wide-cancel'),
    play = byId('play'),
    reduced = byId('reduced'),
    wings = byId('wings');
  const media = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const removers = [],
    cards = [];
  let disposed = false,
    suspended = false,
    playing = false,
    frameId = null,
    previous = null,
    generation = 0,
    operation = null,
    ready = Promise.resolve(),
    retained = [],
    staging = null,
    timeout = null;
  const listen = (node, event, fn) => {
    node.addEventListener(event, fn);
    removers.push(() => node.removeEventListener(event, fn));
  };
  const foreground = () => !suspended && !doc.hidden && doc.hasFocus?.() !== false;
  const reducedMotion = () => reduced.checked || !!media?.matches;
  const modal = () => !!doc.querySelector('dialog[open]');
  const hasImages = () => cards.every((card) => card.items.every((item) => item.image));
  const eligible = () =>
    !disposed &&
    foreground() &&
    !modal() &&
    playing &&
    !reducedMotion() &&
    wings.checked &&
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
            : !playing
              ? 'paused'
              : !wings.checked
                ? 'static'
                : status.dataset.state !== 'ready'
                  ? status.dataset.state
                  : 'playing';
    if (motion.dataset.state === state) return;
    motion.dataset.state = state;
    localizedText(motion, () =>
      t(prefix + (state === 'reduced' ? 'reducedState' : state === 'static' ? 'paused' : state)),
    );
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
      paused: !playing,
      reducedMotion: reducedMotion(),
      speedRatio: Number(byId('speed').value),
      background: byId('background').value,
      heading: (Number(byId('heading').value) * Math.PI) / 180,
      showWings: wings.checked,
      guides: byId('guides').checked,
    };
    cards.forEach((card) => {
      if (!card.article.hidden) paint(card, options);
    });
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
    localizedText(status, () =>
      t(
        state === 'ready'
          ? 'tools:ukraineRoleReview.wide.loaded'
          : state === 'loading'
            ? 'tools:ukraineRoleReview.wide.loading'
            : prefix + state,
      ),
    );
  };
  const ownsCancel = () => doc.activeElement === cancelButton && foreground() && !modal();
  function releaseStaging() {
    const pending = staging;
    staging = null;
    pending?.splice(0).forEach((item) => item?.dispose());
  }
  function clearDeadline() {
    if (timeout !== null) win.clearTimeout(timeout);
    timeout = null;
  }
  function settle(state) {
    const restore = ownsCancel();
    clearDeadline();
    operation?.abort();
    releaseStaging();
    operation = null;
    retry.disabled = false;
    cancelButton.hidden = true;
    show(state);
    sync();
    if (restore) retry.focus();
  }
  for (const id of ROLE_IDS) {
    const article = doc.createElement('article'),
      title = doc.createElement('h2'),
      read = doc.createElement('button'),
      help = doc.createElement('span'),
      region = doc.createElement('div'),
      canvas = doc.createElement('canvas');
    title.id = `ukraine-wide-${id}`;
    title.dataset.authoringTarget = `ukraine-wide-read-${id}`;
    const name = () => t('tools:ukraineRoleReview.wide.cardTitle', { classId: id });
    localizedText(title, name);
    read.id = `ukraine-wide-read-${id}`;
    read.type = 'button';
    read.disabled = true;
    authoringLabel(read, 'readPage');
    setMenuIcon(read, 'content');
    localizedAttribute(read, 'aria-label', () => `${authoringText('readPage')}: ${name()}`);
    authoringLabel(help, 'readHelp');
    help.className = 'role-read-help';
    help.id = `${read.id}-help`;
    read.setAttribute('aria-describedby', help.id);
    region.id = `ukraine-wide-canvas-${id}`;
    region.className = 'role-canvas-region';
    region.setAttribute('role', 'region');
    region.setAttribute('aria-labelledby', title.id);
    canvas.width = 780;
    canvas.height = 215;
    localizedAttribute(canvas, 'aria-label', () =>
      t('tools:ukraineRoleReview.wide.canvasLabel', { title: name() }),
    );
    region.append(canvas);
    article.append(title, read, help, region);
    byId('rows').append(article);
    cards.push({
      id,
      article,
      canvas,
      items: Array.from({ length: 2 }, () => ({
        image: null,
        role: null,
        state: createAnimationState(),
      })),
      read,
    });
  }
  const updatePlay = () => {
    play.setAttribute('aria-pressed', String(playing));
    localizedText(play, () => t(playing ? 'common:actions.pause' : 'common:actions.play'));
    setMenuIcon(play, 'play');
  };
  updatePlay();
  listen(play, 'click', () => {
    playing = !playing;
    updatePlay();
    // Only the elapsed-frame baseline resets. Continuing preserves held/flown phases.
    sync();
  });
  listen(byId('phase'), 'change', () => {
    playing = false;
    updatePlay();
    for (const card of cards)
      for (const item of card.items)
        item.state = {
          ...createAnimationState(),
          phases: { wings: (Number(byId('phase').value) * Math.PI) / 2 },
        };
    sync();
  });
  for (const id of ['heading', 'speed', 'background', 'wings', 'guides', 'reduced'])
    listen(byId(id), 'change', () => sync());
  function cancel({ restoreFocus = true } = {}) {
    if (!operation) return;
    const restore = restoreFocus && ownsCancel();
    generation++;
    operation.abort();
    clearDeadline();
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
    timeout = win.setTimeout(() => {
      if (current()) settle('error');
    }, 30_000);
    const pending = [];
    staging = pending;
    ready = (async () => {
      try {
        const data = validateWideComparisons(
          await readPresentations({ signal: controller.signal }),
        );
        if (!current()) return;
        await Promise.all(
          data.flatMap((row, rowIndex) =>
            row.roles.map(async (role, versionIndex) => {
              const result = await loadImage(role, {
                version: versionIndex ? 'v3' : 'v1',
                signal: controller.signal,
              });
              if (!current()) {
                result.dispose();
                return;
              }
              pending[rowIndex * 2 + versionIndex] = result;
              if (
                result.image.naturalWidth !== role.width ||
                result.image.naturalHeight !== role.height
              )
                throw new Error('Original dimensions differ');
            }),
          ),
        );
        if (!current()) return;
        if (!foreground() || modal()) {
          cancel({ restoreFocus: false });
          return;
        }
        retained.forEach((item) => item.dispose());
        retained = pending.splice(0);
        cards.forEach((card, index) => {
          card.items.forEach((item, versionIndex) => {
            item.role = data[index].roles[versionIndex];
            item.image = retained[index * 2 + versionIndex].image;
          });
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
  const observer = new win.MutationObserver(() => {
    if (modal()) cancel({ restoreFocus: false });
    sync();
  });
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
