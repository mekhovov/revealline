import { localizedText, localizedAttribute, t } from '../../game/i18n/index.mjs';
import { authoringLabel, authoringText } from '../../game/ui/authoring-copy.mjs';
import { registerAuthoringEditor } from '../../game/ui/authoring-editors.mjs';
import { setMenuIcon } from '../../game/ui/native-menu-icons.mjs';
import { readSourceBytes, loadProductionImage, sourceURL } from '../production/preview.mjs';

const TEXT_BYTES = 256 * 1024;
const clamp = (n, max) => Math.max(0, Math.min(max, n));
const visible = (node) =>
  node?.isConnected && !node.closest('[hidden],[inert]') && node.getClientRects().length > 0;

/** One bounded source view. The calling authoring host retains all input polling. */
export function mountRevealAuditViewer({ document: doc, window: win, navigation, sources }) {
  const entries = new Map(sources.map((source) => [source.id, Object.freeze({ ...source })]));
  const rootURL = new URL('../../', import.meta.url).href;
  const dialog = doc.createElement('dialog'),
    title = doc.createElement('h2'),
    status = doc.createElement('p'),
    actions = doc.createElement('div'),
    region = doc.createElement('div');
  dialog.id = 'reveal-source-dialog';
  dialog.className = 'reveal-source-dialog';
  title.id = 'reveal-source-title';
  status.id = 'reveal-source-status';
  status.setAttribute('role', 'status');
  dialog.setAttribute('aria-labelledby', title.id);
  actions.className = 'reveal-source-actions';
  region.id = 'reveal-source-region';
  region.setAttribute('role', 'region');
  region.tabIndex = -1;
  region.setAttribute('aria-labelledby', title.id);
  const button = (id, label, icon = 'content') => {
    const node = doc.createElement('button');
    node.id = id;
    node.type = 'button';
    localizedText(node, label);
    setMenuIcon(node, icon);
    actions.append(node);
    return node;
  };
  const back = button('reveal-source-close', () => t('common:actions.back'), 'back');
  const retry = button('reveal-source-retry', () => t('tools:retryLoadingStudy'));
  const read = button('reveal-read-source', () => authoringText('readPage'), 'missions');
  const fit = button('reveal-source-fit', () => t('tools:revealSourceFit'));
  const actual = button('reveal-source-actual', () => t('tools:revealSourceActualSize'));
  const start = button('reveal-source-start', () => t('interface:startOfDetails'));
  const end = button('reveal-source-end', () => t('interface:endOfDetails'));
  const help = doc.createElement('p');
  authoringLabel(help, 'readHelp');
  dialog.append(title, status, actions, help, region);
  // The host determines top-modal ownership in DOM order. Its Sections overlay
  // must remain after this modal, even when Menu is used while viewing a source.
  doc.body.insertBefore(dialog, doc.querySelector('.authoring-sections-dialog'));
  let closing = false,
    disposed = false,
    visit = 0,
    operation = null,
    source = null,
    origin = null,
    image = null,
    unregister = null,
    panning = false,
    ready = false;
  const foreground = () => !doc.hidden && doc.hasFocus?.() !== false;
  const topDialog = () => [...doc.querySelectorAll('dialog[open]')].at(-1);
  const current = () => !disposed && dialog.open && topDialog() === dialog && foreground();
  const label = () => (typeof source?.title === 'function' ? source.title() : source?.title || '');
  localizedText(title, label);
  localizedAttribute(read, 'aria-label', () => `${authoringText('readPage')}: ${label()}`);
  const show = (key, error = false, values = {}) => {
    status.dataset.error = String(error);
    localizedText(status, () => t(`tools:${key}`, values));
  };
  function refresh() {
    const reading = panning || navigation.readingState()?.regionId === region.id;
    read.setAttribute('aria-pressed', String(reading));
    read.disabled = !ready;
    fit.hidden = actual.hidden = source?.kind !== 'image';
    fit.disabled = actual.disabled = !ready;
    start.disabled = end.disabled = !ready;
    dialog.dataset.state = ready
      ? 'ready'
      : operation
        ? 'loading'
        : status.dataset.error === 'true'
          ? 'error'
          : 'cancelled';
  }
  function stopReading() {
    panning = false;
    region.removeAttribute('data-reveal-source-reading');
    if (navigation.readingState()?.regionId === region.id)
      navigation.endReading({ restoreFocus: false });
    refresh();
  }
  function release() {
    stopReading();
    unregister?.();
    unregister = null;
    image?.dispose();
    image = null;
    ready = false;
    region.replaceChildren();
    region.removeAttribute('data-game-reading');
    region.tabIndex = -1;
    region.scrollTop = region.scrollLeft = 0;
  }
  function abort() {
    visit++;
    operation?.abort();
    operation = null;
  }
  function close({ restoreFocus = true } = {}) {
    const target = origin;
    const restore =
      restoreFocus &&
      current() &&
      dialog.contains(doc.activeElement) &&
      visible(target) &&
      !target.disabled;
    abort();
    release();
    origin = null;
    closing = true;
    try {
      if (dialog.open) dialog.close();
    } finally {
      closing = false;
    }
    source = null;
    refresh();
    if (restore) target.focus();
  }
  function interrupted() {
    stopReading();
    if (!operation) return;
    abort();
    release();
    show('revealSourceCancelled');
    refresh();
  }
  function move(dx, dy, edge = null) {
    if (!current() || !ready) return;
    const maxX = Math.max(0, region.scrollWidth - region.clientWidth),
      maxY = Math.max(0, region.scrollHeight - region.clientHeight);
    region.scrollLeft =
      edge === 'start'
        ? 0
        : edge === 'end'
          ? maxX
          : clamp(region.scrollLeft + dx * Math.max(80, region.clientWidth * 0.6), maxX);
    region.scrollTop =
      edge === 'start'
        ? 0
        : edge === 'end'
          ? maxY
          : clamp(region.scrollTop + dy * Math.max(80, region.clientHeight * 0.6), maxY);
  }
  const panCurrent = () => panning && current() && ready && doc.activeElement === read;
  const pan = {
    enter() {
      if (!current() || !ready || doc.activeElement !== read) return false;
      panning = true;
      region.setAttribute('data-reveal-source-reading', 'true');
      refresh();
      return true;
    },
    isCurrent: panCurrent,
    focus: () => read.focus({ preventScroll: true }),
    handle(command) {
      if (!panCurrent() || command.back || command.menu) return 'cancel';
      if (command.confirm || command.confirmCommit) return 'done';
      const vector = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[command.direction];
      if (vector) move(...vector);
    },
    keydown(event) {
      if (
        !panCurrent() ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !['Home', 'End', 'PageUp', 'PageDown'].includes(event.key)
      )
        return false;
      event.preventDefault();
      if (event.key === 'Home' || event.key === 'End')
        move(0, 0, event.key === 'Home' ? 'start' : 'end');
      else move(0, event.key === 'PageUp' ? -1 : 1);
      return true;
    },
    exit() {
      panning = false;
      region.removeAttribute('data-reveal-source-reading');
      refresh();
    },
  };
  async function prepare() {
    abort();
    release();
    const controller = new AbortController(),
      generation = visit,
      selected = source;
    operation = controller;
    show('revealSourceLoading');
    refresh();
    const valid = () =>
      current() &&
      source === selected &&
      visit === generation &&
      operation === controller &&
      !controller.signal.aborted;
    let pendingImage = null;
    try {
      if (selected.kind === 'image') {
        pendingImage = await loadProductionImage(
          { role: 'original', file: selected, width: selected.width, height: selected.height },
          {
            rootURL,
            signal: controller.signal,
            fetchSource: (url, options) => win.fetch(url, options),
            cryptoSource: win.crypto,
            urlAPI: win.URL,
            makeImage: () => doc.createElement('img'),
          },
        );
        if (!valid()) {
          pendingImage.dispose();
          return;
        }
        image = pendingImage;
        pendingImage = null;
        image.image.dataset.size = 'fit';
        image.image.alt = label();
        region.append(image.image);
        fit.setAttribute('aria-pressed', 'true');
        actual.setAttribute('aria-pressed', 'false');
        unregister = registerAuthoringEditor(read, pan);
        // Keep the first native Enter as ordinary button activation, not the
        // canvas helper's simultaneous enter-and-confirm sequence.
        read.removeAttribute('data-controller-editor');
      } else {
        if (
          selected.kind !== 'text' ||
          !Number.isSafeInteger(selected.bytes) ||
          selected.bytes < 1 ||
          selected.bytes > TEXT_BYTES ||
          !/^[a-f0-9]{64}$/.test(selected.sha256)
        )
          throw new Error(t('tools:revealSourceMismatch'));
        const bytes = await readSourceBytes(sourceURL(selected.path, rootURL), selected.bytes, {
          signal: controller.signal,
          fetchSource: (url, options) => win.fetch(url, options),
        });
        if (!valid()) return;
        const digest = new Uint8Array(await win.crypto.subtle.digest('SHA-256', bytes));
        if (!valid()) return;
        if (
          bytes.length !== selected.bytes ||
          Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('') !== selected.sha256
        )
          throw new Error(t('tools:revealSourceMismatch'));
        const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
        const pre = doc.createElement('pre');
        pre.textContent = text;
        region.append(pre);
        region.setAttribute('data-game-reading', '');
        region.tabIndex = 0;
      }
      ready = true;
      show('revealSourceReady', false, { bytes: selected.bytes });
    } catch (error) {
      pendingImage?.dispose();
      if (valid()) {
        release();
        show('revealSourceUnavailable', true, {
          reason: error?.message || t('tools:revealSourceMismatch'),
        });
      }
    } finally {
      if (operation === controller) {
        operation = null;
        refresh();
      }
    }
  }
  function open(id, opener) {
    const next = entries.get(id);
    if (
      disposed ||
      !next ||
      !foreground() ||
      !visible(opener) ||
      (topDialog() && topDialog() !== dialog)
    )
      return false;
    close({ restoreFocus: false });
    source = next;
    origin = opener;
    dialog.dataset.kind = next.kind;
    dialog.dataset.path = next.path;
    title.textContent = label();
    if (!dialog.open) dialog.showModal();
    back.focus();
    void prepare();
    return true;
  }
  read.onclick = () => {
    if (!current() || !ready) return;
    if (source.kind === 'image') navigation.handle({ confirm: true });
    else navigation.beginReading({ region, origin: read, label: label(), getLabel: label });
    refresh();
  };
  const resize = (mode) => {
    if (!current() || !ready || !image) return;
    stopReading();
    image.image.dataset.size = mode;
    fit.setAttribute('aria-pressed', String(mode === 'fit'));
    actual.setAttribute('aria-pressed', String(mode === 'actual'));
    region.scrollTop = region.scrollLeft = 0;
  };
  fit.onclick = () => resize('fit');
  actual.onclick = () => resize('actual');
  start.onclick = () => move(0, 0, 'start');
  end.onclick = () => move(0, 0, 'end');
  back.onclick = () => close();
  retry.onclick = () => {
    if (current()) void prepare();
  };
  const externalClose = () => {
    // close() queues this event. An older event must not retire a new open visit.
    if (!closing && !dialog.open && source) close({ restoreFocus: false });
  };
  const cancel = (event) => {
    event.preventDefault();
    close();
  };
  const focus = () => {
    if (operation && !dialog.contains(doc.activeElement)) interrupted();
  };
  const hidden = () => {
    if (doc.hidden) interrupted();
  };
  const pagehide = (event) => {
    if (event.persisted) close({ restoreFocus: false });
    else destroy();
  };
  const observer = new win.MutationObserver(() => {
    if (dialog.open && topDialog() !== dialog) close({ restoreFocus: false });
    else refresh();
  });
  observer.observe(doc.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['open', 'data-controller-reading'],
  });
  dialog.addEventListener('cancel', cancel);
  dialog.addEventListener('close', externalClose);
  win.addEventListener('blur', interrupted);
  win.addEventListener('pagehide', pagehide);
  doc.addEventListener('visibilitychange', hidden);
  doc.addEventListener('focusin', focus, true);
  function destroy() {
    if (disposed) return;
    close({ restoreFocus: false });
    disposed = true;
    observer.disconnect();
    dialog.removeEventListener('cancel', cancel);
    dialog.removeEventListener('close', externalClose);
    win.removeEventListener('blur', interrupted);
    win.removeEventListener('pagehide', pagehide);
    doc.removeEventListener('visibilitychange', hidden);
    doc.removeEventListener('focusin', focus, true);
    for (const node of [read, fit, actual, start, end, back, retry]) node.onclick = null;
    dialog.remove();
  }
  refresh();
  return { open, close, destroy };
}
