import { mountPresentationPage } from './page.mjs';
import { createOperationStatus } from '../ui/operation-status.mjs';

const entries = new WeakMap();
const statusStyles = new URL('../ui/operation-status.css', import.meta.url).href;

function ensureStatusStyles(doc) {
  if (!doc.head) return;
  const present = [...doc.querySelectorAll('link[rel="stylesheet"]')].some((link) => {
    try {
      return new URL(link.getAttribute('href'), doc.baseURI).href === statusStyles;
    } catch {
      return false;
    }
  });
  if (present) return;
  const link = doc.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('href', statusStyles);
  doc.head.append(link);
}

/** Observe the shared cosmetic load without taking ownership of local tool work. */
export function mountAuxiliaryPresentationPage({
  document: doc = globalThis.document,
  window: win = doc?.defaultView ?? globalThis.window,
  createHost,
} = {}) {
  const existing = entries.get(doc);
  if (existing) return existing;
  let closed = false;
  const anotherOwner = doc.querySelector(
    '[data-presentation-status], #presentation-preparation-status',
  );
  const target = anotherOwner ? null : doc.createElement('p');
  let presenter = null,
    activity = null;
  if (target) {
    target.setAttribute('data-presentation-status', 'auxiliary');
    target.className = 'micro-note';
    const heading = doc.querySelector('h1');
    if (heading) heading.after(target);
    else doc.body.append(target);
    ensureStatusStyles(doc);
    presenter = createOperationStatus(target, { isCurrent: () => !closed });
  }
  const lease = mountPresentationPage({
    document: doc,
    window: win,
    createHost,
    onStatus(status) {
      if (closed || !presenter) return;
      if (!activity) activity = presenter.begin(status);
      if (status.status === 'ready') {
        activity.finish();
        activity = null;
      } else if (status.status === 'error') {
        activity.finish({ message: status.message, state: 'error' });
        activity = null;
      } else activity.update(status);
    },
  });
  const close = () => {
    if (closed) return;
    closed = true;
    presenter?.dispose();
    target?.remove();
    lease.close();
    win?.removeEventListener?.('pagehide', pagehide);
    if (entries.get(doc) === entry) entries.delete(doc);
  };
  const pagehide = (event) => {
    if (!event.persisted) close();
  };
  const entry = Object.freeze({
    ...lease,
    get ready() {
      return lease.ready;
    },
    close,
  });
  entries.set(doc, entry);
  win?.addEventListener?.('pagehide', pagehide);
  return entry;
}

// Auxiliary document chrome only. Editor/source-preview canvases continue to
// render their explicit authored inputs; embedded game pages own their host.
if (globalThis.document?.documentElement) mountAuxiliaryPresentationPage();
