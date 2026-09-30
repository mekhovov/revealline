import { localizedText, localizedAttribute, t } from '../../../../../game/i18n/index.mjs';
import { authoringLabel, authoringText } from '../../../../../game/ui/authoring-copy.mjs';
import { setMenuIcon } from '../../../../../game/ui/native-menu-icons.mjs';
import { readPreparedRevealText } from './review-model.mjs';
import { PREPARED_REVEAL_MANIFEST } from './review-sources.mjs';
import { reviewText } from './review-copy.mjs';

// This modal accepts exactly the pinned 266,665-byte historical manifest only.
// It does not raise the shared source viewer's 256 KiB text limit.
const visible = (node) =>
  node?.isConnected && !node.closest('[hidden],[inert]') && node.getClientRects().length > 0;

/** Literal, bounded documentation on the caller's existing input owner. */
export function mountPreparedRevealManifestViewer({
  document: doc,
  window: win,
  navigation,
  readText = (options) => readPreparedRevealText({ ...options, window: win }),
}) {
  const entries = new Map([['manifest', PREPARED_REVEAL_MANIFEST]]);
  const dialog = doc.createElement('dialog'),
    title = doc.createElement('h2'),
    status = doc.createElement('p'),
    actions = doc.createElement('div'),
    region = doc.createElement('div');
  dialog.id = 'prepared-reveal-manifest-dialog';
  dialog.className = 'prepared-reveal-manifest-dialog';
  title.id = 'prepared-reveal-manifest-title';
  status.id = 'prepared-reveal-manifest-status';
  status.setAttribute('role', 'status');
  dialog.setAttribute('aria-labelledby', title.id);
  actions.className = 'prepared-reveal-manifest-actions';
  region.id = 'prepared-reveal-manifest-region';
  region.tabIndex = -1;
  region.setAttribute('role', 'region');
  region.setAttribute('aria-labelledby', title.id);
  const button = (id, label, icon = 'content') => {
    const node = doc.createElement('button');
    node.id = `prepared-reveal-manifest-${id}`;
    node.type = 'button';
    localizedText(node, label);
    setMenuIcon(node, icon);
    actions.append(node);
    return node;
  };
  const back = button('back', () => t('common:actions.back'), 'back'),
    retry = button('retry', () => t('common:actions.retry')),
    read = button('read', () => authoringText('readPage'), 'missions'),
    start = button('start', () => t('interface:startOfDetails')),
    end = button('end', () => t('interface:endOfDetails'));
  const note = doc.createElement('p'),
    help = doc.createElement('p');
  localizedText(note, () => t('tools:creatorGuide.documentNote'));
  authoringLabel(help, 'readHelp');
  dialog.append(title, status, actions, note, help, region);
  doc.body.insertBefore(dialog, doc.querySelector('.authoring-sections-dialog'));
  let disposed = false,
    visit = 0,
    operation = null,
    source = null,
    origin = null,
    ready = false,
    timeout = null;
  const foreground = () => !doc.hidden && doc.hasFocus?.() !== false;
  const topDialog = () => [...doc.querySelectorAll('dialog[open]')].at(-1);
  const current = () => !disposed && dialog.open && topDialog() === dialog && foreground();
  const label = () => (source ? reviewText('manifest') : '');
  localizedText(title, label);
  const readLabel = () => `${authoringText('readPage')}: ${label()}`;
  localizedAttribute(read, 'aria-label', readLabel);
  const show = (key, error = false, values = {}) => {
    status.dataset.error = String(error);
    localizedText(status, () => t(`tools:creatorGuide.${key}`, values));
  };
  function refresh() {
    const reading = navigation.readingState()?.regionId === region.id;
    read.setAttribute('aria-pressed', String(reading));
    read.disabled = start.disabled = end.disabled = !ready;
    retry.disabled = !!operation;
    region.tabIndex = reading ? 0 : -1;
    dialog.dataset.state = ready
      ? 'ready'
      : operation
        ? 'loading'
        : status.dataset.error === 'true'
          ? 'error'
          : 'cancelled';
  }
  function stopReading() {
    if (navigation.readingState()?.regionId === region.id)
      navigation.endReading({ restoreFocus: false });
  }
  function release() {
    stopReading();
    ready = false;
    region.replaceChildren();
    region.removeAttribute('data-game-reading');
    region.tabIndex = -1;
    region.scrollTop = region.scrollLeft = 0;
  }
  function abort() {
    visit++;
    if (timeout !== null) win.clearTimeout(timeout);
    timeout = null;
    operation?.abort();
    operation = null;
  }
  function close({ restoreFocus = true } = {}) {
    const target = origin,
      restore =
        restoreFocus &&
        current() &&
        dialog.contains(doc.activeElement) &&
        visible(target) &&
        !target.disabled;
    abort();
    release();
    origin = null;
    source = null;
    if (dialog.open) dialog.close();
    refresh();
    if (restore) {
      target.focus();
      target.scrollIntoView({ block: 'nearest' });
    }
  }
  function interrupted() {
    stopReading();
    if (operation) {
      abort();
      release();
      show('documentCancelled');
    }
    refresh();
  }
  async function prepare() {
    abort();
    release();
    const controller = new AbortController(),
      generation = visit,
      selected = source;
    operation = controller;
    show('documentLoading');
    refresh();
    const valid = () =>
      current() &&
      source === selected &&
      visit === generation &&
      operation === controller &&
      !controller.signal.aborted;
    timeout = win.setTimeout(() => {
      if (valid()) {
        abort();
        release();
        show('documentUnavailable', true);
        refresh();
      }
    }, 30000);
    try {
      const text = await readText({ signal: controller.signal });
      if (!valid()) return;
      const pre = doc.createElement('pre');
      pre.textContent = text;
      region.append(pre);
      region.setAttribute('data-game-reading', '');
      ready = true;
      show('documentReady', false, { bytes: selected.bytes });
    } catch {
      if (valid()) {
        release();
        show('documentUnavailable', true);
      }
    } finally {
      if (operation === controller) {
        if (timeout !== null) win.clearTimeout(timeout);
        timeout = null;
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
    dialog.dataset.documentId = next.id;
    dialog.dataset.path = next.path;
    localizedText(title, label);
    localizedAttribute(read, 'aria-label', readLabel);
    dialog.showModal();
    back.focus();
    void prepare();
    return true;
  }
  read.onclick = () => {
    if (!current() || !ready) return;
    region.tabIndex = 0;
    navigation.beginReading({ region, origin: read, label: label(), getLabel: label });
    refresh();
  };
  const edge = (last) => {
    if (!current() || !ready) return;
    region.scrollTop = last ? Math.max(0, region.scrollHeight - region.clientHeight) : 0;
  };
  start.onclick = () => edge(false);
  end.onclick = () => edge(true);
  back.onclick = () => close();
  retry.onclick = () => {
    if (current()) void prepare();
  };
  const cancel = (event) => {
    event.preventDefault();
    close();
  };
  // Native close events are queued; an old event must not retire a newer visit.
  const externalClose = () => {
    if (!dialog.open && source) close({ restoreFocus: false });
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
    for (const node of [read, start, end, back, retry]) node.onclick = null;
    dialog.remove();
  }
  refresh();
  return { open, close, destroy };
}
