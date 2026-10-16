import { readFile } from 'node:fs/promises';
import { soloPage } from './solo-dom.mjs';
import { waitFor } from './wait-for.mjs';
import { DEMO_LOAD_TIMEOUT_MS } from '../../demo-loading.mjs';
import { PNGImage } from './png-image.mjs';

// Catalogue, retained-library and complete scene admission each own a bounded
// native loading phase. Observe their real readiness without shortening the
// product's per-phase deadline to the generic five-second fixture wait.
export const DEMO_HOST_READY_TIMEOUT_MS = 3 * DEMO_LOAD_TIMEOUT_MS;

/** Actual solo app, replay transport and painter. Canvas, image decode and the
 * physical pad boundary are modeled; this makes no browser pixel/device claim. */
export async function demoPage(t, { clipId = 'first-signal-left', ...options } = {}) {
  let demoFrame = null,
    ordinaryFrame = null,
    ordinaryCanvas = null;
  const contexts = new WeakMap();
  const rendering = {
    displayCSSWidth: 600,
    contextFor(canvas) {
      if (contexts.has(canvas)) return contexts.get(canvas);
      const values = {},
        stack = [];
      const context = new Proxy(
        {
          canvas,
          getImageData() {
            return { data: new Uint8ClampedArray(canvas.width * canvas.height * 4) };
          },
        },
        {
          get(target, key) {
            if (key in target) return target[key];
            if (key in values) return values[key];
            return () => {
              if (key === 'save') stack.push({ ...values });
              if (key === 'restore') Object.assign(values, stack.pop());
            };
          },
          set(_, key, value) {
            values[key] = value;
            return true;
          },
        },
      );
      contexts.set(canvas, context);
      return context;
    },
    onDraw(frame) {
      if (frame.context.canvas.id === 'demo-canvas') demoFrame = frame;
      else if (ordinaryCanvas === null || frame.context.canvas === ordinaryCanvas) {
        // The modal deliberately suspends ordinary drawing. Keep its last
        // frame owned by that canvas instead of attributing a demo draw to it.
        ordinaryCanvas = frame.context.canvas;
        ordinaryFrame = { run: frame.run, ...frame.options };
      }
    },
  };
  const page = await soloPage(t, {
    titleScreen: true,
    animationFrames: true,
    search: '?journey=legacy',
    pictures: { Image: PNGImage },
    ...options,
    rendering,
    fetchResponse: async (path, init) => {
      const response = await options.fetchResponse?.(path, init);
      if (response !== undefined) return response;
      if (String(path).includes('/content-design/assets/'))
        return new Response(
          await readFile(String(path).startsWith('file:') ? new URL(path) : path),
        );
    },
  });
  const ordinaryFetch = globalThis.fetch;
  globalThis.fetch = async (path, fetchOptions) => {
    // soloPage installs a fresh URL subclass for each page; catalogue URLs can
    // legitimately retain the earlier module's constructor across page reloads.
    if (typeof path?.pathname !== 'string' || !path.pathname.includes('/demo-data/'))
      return ordinaryFetch(path, fetchOptions);
    let contents = await readFile(path, 'utf8');
    if (path.pathname.endsWith('/catalog.json')) {
      const catalog = JSON.parse(contents);
      catalog.clips = catalog.clips.filter((clip) => clip.id === clipId);
      contents = JSON.stringify(catalog);
    }
    return {
      ok: true,
      headers: { get: () => null },
      text: async () => contents,
      json: async () => JSON.parse(contents),
    };
  };
  async function open() {
    page.$('shell-demo').click();
    await ready();
  }
  async function ready() {
    await waitFor(() => page.$('demo-dialog').open && !page.$('demo-fresh').disabled, {
      timeoutMs: DEMO_HOST_READY_TIMEOUT_MS,
      message: 'The native demo must finish catalogue, library and scene preparation.',
    }).catch((error) => {
      error.message += JSON.stringify({
        scene: page.$('demo-dialog').dataset.scene,
        status: page.$('demo-status').textContent,
        availability: page.$('demo-availability').textContent,
        errors: page.errors.map((value) => String(value?.stack ?? value)),
      });
      throw error;
    });
    page.frame(0);
  }
  return {
    ...page,
    get rendered() {
      return ordinaryFrame;
    },
    get padReads() {
      return page.padReads;
    },
    get demoFrame() {
      return demoFrame;
    },
    open,
    ready,
  };
}

export function demoKey(page, code, held = true, extra = {}) {
  return page.$('demo-canvas').emit(held ? 'keydown' : 'keyup', {
    code,
    key: code,
    repeat: false,
    stopImmediatePropagation() {
      this.cancelBubble = true;
    },
    ...extra,
  });
}

export function demoPointer(element, type, extra = {}) {
  return element.emit(type, {
    pointerId: 41,
    pointerType: 'touch',
    button: 0,
    detail: 1,
    clientX: 20,
    clientY: 20,
    stopImmediatePropagation() {
      this.cancelBubble = true;
    },
    ...extra,
  });
}
