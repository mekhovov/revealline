import { createPresentationHost } from './host.mjs';

// One cosmetic release loader per document, regardless of board or module count.
// Uploaded media, authoring drafts, player libraries and run state never enter here.
const pages = new WeakMap();

export function mountPresentationPage({
  document: doc = globalThis.document,
  window: win = doc?.defaultView ?? globalThis.window,
  createHost = createPresentationHost,
  onError = () => {},
} = {}) {
  if (!doc?.documentElement) throw new TypeError('Presentation needs a page document.');
  let page = pages.get(doc);
  if (!page) {
    page = {
      host: null,
      snapshot: null,
      error: null,
      closed: false,
      leases: new Set(),
      painters: new Map(),
    };
    pages.set(doc, page);
    const applyPainter = (painter, binding) => {
      if (page.snapshot && (painter.presentation ?? null) === binding.before)
        painter.setPresentation(page.snapshot);
    };
    page.applyPainter = applyPainter;
    page.dispose = () => {
      if (page.closed) return;
      page.closed = true;
      for (const lease of [...page.leases]) lease.close();
      page.host?.close();
      win?.removeEventListener?.('pagehide', page.pagehide);
      if (pages.get(doc) === page) pages.delete(doc);
    };
    page.pagehide = (event) => {
      if (!event.persisted) page.dispose();
    };
    win?.addEventListener?.('pagehide', page.pagehide);
    // Defer until the first lease is registered. Failed loads keep each existing
    // look intact and resolve ready to null rather than leaking a rejection.
    page.ready = Promise.resolve()
      .then(() => {
        if (page.closed) return null;
        page.host = createHost({ document: doc });
        return page.host.load();
      })
      .then((snapshot) => {
        if (page.closed || !snapshot) return null;
        page.host.apply(doc.documentElement);
        page.snapshot = snapshot;
        for (const [painter, binding] of page.painters) applyPainter(painter, binding);
        return snapshot;
      })
      .catch((error) => {
        if (page.closed || error.name === 'AbortError') return null;
        for (const [painter, binding] of page.painters)
          if (page.snapshot && painter.presentation === page.snapshot)
            painter.setPresentation(binding.before);
        page.snapshot = null;
        page.host?.close();
        page.host = null;
        page.error = error;
        for (const lease of page.leases) lease.notify(error);
        return null;
      });
  }
  let closed = false;
  const bindings = new Set();
  const lease = {
    ready: page.ready,
    readAudio(slot, options) {
      if (closed || page.closed || !page.host)
        return Promise.reject(new Error('Presentation page is closed.'));
      return page.host.readAudio(slot, options);
    },
    notify(error) {
      if (!closed) {
        try {
          onError(error);
        } catch {
          // A display notice must not affect playback or page cleanup.
        }
      }
    },
    bindPainter(painter) {
      if (closed || page.closed) return () => {};
      if (typeof painter?.setPresentation !== 'function')
        throw new TypeError('Presentation needs a compatible painter.');
      let binding = page.painters.get(painter);
      if (!binding) {
        binding = { before: painter.presentation ?? null, users: 0 };
        page.painters.set(painter, binding);
      }
      binding.users++;
      page.applyPainter(painter, binding);
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        bindings.delete(release);
        if (--binding.users > 0) return;
        if (page.snapshot && painter.presentation === page.snapshot)
          painter.setPresentation(binding.before);
        page.painters.delete(painter);
      };
      bindings.add(release);
      return release;
    },
    close() {
      if (closed) return;
      closed = true;
      for (const release of [...bindings]) release();
      page.leases.delete(lease);
      if (!page.leases.size) page.dispose();
    },
  };
  page.leases.add(lease);
  if (page.error) lease.notify(page.error);
  return Object.freeze(lease);
}
