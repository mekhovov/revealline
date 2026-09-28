import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './solo-dom.mjs';

/** Actual solo app, replay transport and painter. Canvas, image decode and the
 * physical pad boundary are modeled; this makes no browser pixel/device claim. */
export async function demoPage(t, { clipId = 'first-signal-left', ...options } = {}) {
  let demoFrame = null;
  const contexts = new WeakMap();
  const rendering = {
    displayCSSWidth: 600,
    Image: class {
      width = 64;
      height = 64;
      set src(value) {
        this.source = value;
        queueMicrotask(() => this.onload?.());
      }
    },
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
    },
  };
  const page = await soloPage(t, { titleScreen: true, ...options, rendering });
  const ordinaryFetch = globalThis.fetch;
  globalThis.fetch = async (path, fetchOptions) => {
    if (!(path instanceof URL) || !path.pathname.includes('/demo-data/'))
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
    await settle(
      () => page.$('demo-dialog').open && !page.$('demo-fresh').disabled,
      `Demo should finish loading: ${page.$('demo-availability').textContent}`,
    );
    page.frame(0);
  }
  return {
    ...page,
    get rendered() {
      return page.rendered;
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
