import { t, localizedText, localizedAttribute, formatNumber } from '../../../game/i18n/index.mjs';
import { readSourceBytes, sourceURL } from '../../production/preview.mjs';
import { FPV_ENEMY_ROLES, FPV_ENEMY_SOURCES } from './sources.mjs';

const prefix = 'tools:fpvEnemySourceReview.';
const imageSources = FPV_ENEMY_SOURCES.filter((source) => source.kind === 'image');
const inspectionSource = FPV_ENEMY_SOURCES.find((source) => source.id === 'inspection');
const nameOf = (type) => FPV_ENEMY_ROLES.find(([id]) => id === type)?.[1];
const roleText = (type) => t(prefix + 'roles.' + nameOf(type));

export function validateFpvEnemyInspection(report) {
  if (report?.format !== 'fpv-enemy-original-inspection.v1' || report.images?.length !== 7)
    throw new Error('Invalid inspection');
  const seen = new Set();
  for (const row of report.images) {
    const source = imageSources.find((entry) => entry.id === row.type);
    if (
      !source ||
      seen.has(row.type) ||
      row.bytes !== source.bytes ||
      row.sha256 !== source.sha256 ||
      row.dimensions?.[0] !== source.width ||
      row.dimensions?.[1] !== source.height ||
      !Number.isFinite(row.substantialWidthFraction) ||
      row.substantialWidthFraction < 0 ||
      row.substantialWidthFraction > 1 ||
      !Number.isSafeInteger(row.actualVisibleRGBColorsAlpha128) ||
      row.actualVisibleRGBColorsAlpha128 < 0 ||
      !Number.isSafeInteger(row.alpha?.zero) ||
      row.alpha.zero < 0 ||
      row.alpha.zero > source.width * source.height
    )
      throw new Error('Inspection identity mismatch');
    seen.add(row.type);
  }
  return report;
}

export async function readFpvEnemyInspection({ signal, window: win = globalThis.window } = {}) {
  const bytes = await readSourceBytes(
    sourceURL(inspectionSource.path, new URL('../../../', import.meta.url)),
    inspectionSource.bytes,
    {
      signal,
      fetchSource: (url, options) => win.fetch(url, options),
    },
  );
  const hash = [...new Uint8Array(await win.crypto.subtle.digest('SHA-256', bytes))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
  if (
    signal?.aborted ||
    bytes.length !== inspectionSource.bytes ||
    hash !== inspectionSource.sha256
  )
    throw new Error('Inspection source mismatch');
  return validateFpvEnemyInspection(
    JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
  );
}

/** Source samples have one captured loading operation. Mutable enlarged preview
 * decoding must never poison the immutable sample group. No storage writes. */
export function mountFpvEnemyPresentation({
  document: doc,
  window: win = doc.defaultView,
  readInspection = (options) => readFpvEnemyInspection({ ...options, window: win }),
  decodeImage = (image) => image.decode(),
  autoStart = true,
} = {}) {
  const grid = doc.querySelector('#grid'),
    large = doc.querySelector('#large'),
    role = doc.querySelector('#role'),
    heading = doc.querySelector('#heading'),
    pivots = doc.querySelector('#pivots'),
    status = doc.querySelector('#status'),
    retry = doc.querySelector('#fpv-enemy-retry'),
    cancelButton = doc.querySelector('#fpv-enemy-cancel');
  const removers = [],
    stableImages = [];
  const listen = (node, event, fn) => {
    node.addEventListener(event, fn);
    removers.push(() => node.removeEventListener(event, fn));
  };
  let disposed = false,
    visit = 0,
    selectedVisit = 0,
    operation = null,
    ready = Promise.resolve();
  const foreground = () => !doc.hidden && doc.hasFocus?.() !== false;
  const restoreOwned = () =>
    doc.activeElement === cancelButton && foreground() && !doc.querySelector('dialog[open]');
  const show = (state, key, values = {}) => {
    status.dataset.state = state;
    localizedText(status, () => t(prefix + key, values));
  };
  const settle = (state, key, values = {}) => {
    const restore = restoreOwned();
    operation?.abort();
    operation = null;
    retry.disabled = false;
    cancelButton.hidden = true;
    show(state, key, values);
    if (restore) retry.focus();
  };
  for (const [type] of FPV_ENEMY_ROLES) {
    const option = doc.createElement('option');
    option.value = type;
    localizedText(option, () => roleText(type));
    role.append(option);
    const card = doc.createElement('article'),
      title = doc.createElement('h2'),
      subtitle = doc.createElement('small'),
      source = doc.createElement('a');
    title.id = `fpv-enemy-${type}`;
    title.dataset.authoringTarget = `fpv-enemy-source-${type}`;
    localizedText(title, () => roleText(type));
    subtitle.textContent = type;
    source.id = `fpv-enemy-source-${type}`;
    source.dataset.fpvEnemySource = type;
    source.className = 'source-link';
    source.href = `originals/${type}.png`;
    localizedText(source, () => t(prefix + 'viewOriginal'));
    localizedAttribute(
      source,
      'aria-label',
      () => `${t(prefix + 'viewOriginal')}: ${roleText(type)}`,
    );
    card.append(title, subtitle, source);
    for (const tone of ['dark', 'light']) {
      const strip = doc.createElement('div');
      strip.className = `samples ${tone}`;
      localizedAttribute(strip, 'aria-label', () =>
        t(prefix + 'sampleLabel', { name: roleText(type), tone: t(prefix + `tones.${tone}`) }),
      );
      for (const size of [16, 24, 32, 64]) {
        const sample = doc.createElement('div'),
          frame = doc.createElement('div'),
          image = doc.createElement('img'),
          label = doc.createElement('span');
        sample.className = 'sample';
        frame.className = 'frame';
        frame.style.setProperty('--size', `${size}px`);
        image.src = `originals/${type}.png`;
        localizedAttribute(image, 'alt', () => roleText(type));
        label.textContent = `${size} px`;
        frame.append(image);
        sample.append(frame, label);
        strip.append(sample);
        stableImages.push(image);
      }
      card.append(strip);
    }
    const metric = doc.createElement('p');
    metric.className = 'metric';
    metric.dataset.type = type;
    card.append(metric);
    grid.append(card);
  }
  role.value = 'bouncer';
  const updateLarge = () => {
    selectedVisit++;
    large.src = `originals/${role.value}.png`;
    localizedAttribute(large, 'alt', () => roleText(role.value));
  };
  updateLarge();
  listen(heading, 'change', () => {
    if (['0', '90', '180', '270'].includes(heading.value))
      doc.documentElement.style.setProperty('--heading', `${heading.value}deg`);
  });
  listen(pivots, 'change', () => doc.body.classList.toggle('pivots', pivots.checked));
  listen(role, 'change', () => {
    if (!nameOf(role.value)) return;
    updateLarge();
    if (operation || status.dataset.state !== 'ready') return;
    const selected = selectedVisit,
      generation = visit;
    Promise.resolve()
      .then(() => decodeImage(large))
      .catch(() => {
        if (
          !disposed &&
          selectedVisit === selected &&
          visit === generation &&
          !operation &&
          foreground()
        )
          show('error', 'loadFailed');
      });
  });
  function cancel({ restoreFocus = true } = {}) {
    if (!operation) return;
    const owned = restoreFocus && restoreOwned();
    visit++;
    selectedVisit++;
    operation.abort();
    operation = null;
    retry.disabled = false;
    cancelButton.hidden = true;
    show('cancelled', 'cancelled');
    if (owned) retry.focus();
  }
  function load() {
    if (disposed) return Promise.resolve();
    cancel({ restoreFocus: false });
    const controller = new AbortController(),
      generation = ++visit;
    operation = controller;
    const current = () =>
      !disposed && operation === controller && generation === visit && !controller.signal.aborted;
    const initiating =
      doc.activeElement === retry && foreground() && !doc.querySelector('dialog[open]');
    cancelButton.hidden = false;
    retry.disabled = true;
    show('loading', 'loading');
    if (initiating) cancelButton.focus();
    ready = (async () => {
      try {
        const [report] = await Promise.all([
          readInspection({ signal: controller.signal }),
          Promise.all(stableImages.map((image) => decodeImage(image))),
        ]);
        if (!current()) return;
        validateFpvEnemyInspection(report);
        // A source change can reject decode() for the previously selected URL.
        // Retry only that obsolete selection, never the stable 56 samples.
        while (current()) {
          const selected = selectedVisit;
          try {
            await decodeImage(large);
          } catch (error) {
            if (selected !== selectedVisit) continue;
            throw error;
          }
          if (selected === selectedVisit) break;
        }
        if (!current()) return;
        if (!foreground()) {
          cancel({ restoreFocus: false });
          return;
        }
        for (const row of report.images) {
          const metric = grid.querySelector(`[data-type="${row.type}"]`);
          localizedText(metric, () =>
            t(prefix + 'metric', {
              width: Number((row.substantialWidthFraction * 100).toFixed(1)),
              colors: formatNumber(row.actualVisibleRGBColorsAlpha128),
              transparent: formatNumber(row.alpha.zero),
            }),
          );
        }
        settle('ready', 'loaded', { frames: 57, ratio: win.devicePixelRatio });
      } catch {
        if (current()) settle('error', 'loadFailed');
      }
    })();
    return ready;
  }
  listen(retry, 'click', () => void load());
  listen(cancelButton, 'click', () => cancel());
  const interrupt = () => {
    selectedVisit++;
    cancel({ restoreFocus: false });
  };
  listen(win, 'blur', interrupt);
  listen(win, 'pagehide', interrupt);
  listen(doc, 'visibilitychange', () => {
    if (doc.hidden) interrupt();
  });
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
      visit++;
      selectedVisit++;
      removers.forEach((remove) => remove());
    },
  };
  if (autoStart) load();
  return owner;
}
