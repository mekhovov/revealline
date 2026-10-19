import { readFile } from 'node:fs/promises';
import { soloPage } from './solo-dom.mjs';
import { waitFor } from './wait-for.mjs';
import { DEMO_LOAD_TIMEOUT_MS } from '../../demo-loading.mjs';
import { PNGImage } from './png-image.mjs';

// Catalogue, retained-library and complete scene admission each own a bounded
// native loading phase. Observe their real readiness without shortening the
// product's per-phase deadline to the generic five-second fixture wait.
export const DEMO_HOST_READY_TIMEOUT_MS = 3 * DEMO_LOAD_TIMEOUT_MS;

// Observe only existing public state at a failed boundary. This collector does
// not wait, pump modeled frames, retry preparation, or replace the caller's Error.
export function reportDemoHostFailure(
  t,
  page,
  { phase, timeoutMs, lastOrdinaryRender = () => page.rendered } = {},
) {
  try {
    const read = (get, fallback = null) => {
      try {
        return get();
      } catch {
        return fallback;
      }
    };
    const text = (value, limit = 96) => (typeof value === 'string' ? value.slice(0, limit) : null);
    const number = (value) => (Number.isFinite(value) ? value : null);
    const flag = (get) => {
      const value = read(get);
      return typeof value === 'boolean' ? value : null;
    };
    const element = (id) => read(() => page.$(id));
    const status = (id) => {
      const node = element(id);
      return {
        id,
        hidden: flag(() => node.hidden),
        state: text(
          read(() => node.dataset.state),
          32,
        ),
        stage: text(
          read(() => node.dataset.stage),
          48,
        ),
        message: text(
          read(() => node.textContent),
          160,
        ),
      };
    };
    const dialog = element('demo-dialog');
    const frame = read(lastOrdinaryRender);
    const run = read(() => frame.run);
    const errorCount = read(() => page.errors.length, 0);
    const count = Number.isSafeInteger(errorCount) && errorCount >= 0 ? errorCount : 0;
    const errors = [];
    for (let index = Math.max(0, count - 4); index < count; index++)
      errors.push(
        text(
          read(() =>
            typeof page.errors[index] === 'string'
              ? page.errors[index]
              : page.errors[index]?.message,
          ),
          160,
        ),
      );
    const diagnostic = {
      format: 'DemoHostFailureV1',
      phase: text(phase),
      timeoutMs: number(timeoutMs),
      page: {
        hidden: flag(() => page.doc.hidden),
        focused: flag(() => page.doc.hasFocus()),
        connected: flag(() => page.doc.documentElement.isConnected),
        documentOwned: flag(() => globalThis.document === page.doc),
        windowOwned: flag(() => globalThis.window === page.win),
        activeId: text(read(() => page.doc.activeElement?.id)),
        flight: text(
          read(() => page.doc.body.dataset.flightState),
          32,
        ),
        picture: text(
          read(() => page.doc.body.dataset.pictureState),
          32,
        ),
        overlayKind: text(
          read(() => element('game-overlay').dataset.kind),
          32,
        ),
      },
      // Demo watching deliberately retains this ordinary frame. It is evidence
      // of the last drawn checkpoint, not a claim about the current internal owner.
      lastOrdinaryRender: {
        level: text(read(() => run.levelId)),
        tick: number(read(() => run.tick)),
        status: text(
          read(() => run.status),
          32,
        ),
        paused: flag(() => frame.paused),
      },
      demo: {
        open: flag(() => dialog.open),
        scene: text(
          read(() => dialog.dataset.scene),
          32,
        ),
        mode: text(
          read(() => dialog.dataset.demoMode),
          32,
        ),
        source: text(
          read(() => dialog.dataset.demoSource),
          128,
        ),
        phase: text(
          read(() => dialog.dataset.demoPhase),
          32,
        ),
        tick: text(
          read(() => dialog.dataset.demoTick),
          32,
        ),
        status: text(
          read(() => element('demo-status').textContent),
          160,
        ),
        availability: text(
          read(() => element('demo-availability').textContent),
          160,
        ),
        preparationDetailsText: text(
          read(() => dialog.dataset.demoPreparationDetails),
          768,
        ),
        failureDetailsText: text(
          read(() => dialog.dataset.demoFailureDetails),
          512,
        ),
        freshDisabled: flag(() => element('demo-fresh').disabled),
        resumeDisabled: flag(() => element('demo-resume').disabled),
        watchPauseDisabled: flag(() => element('demo-watch-pause').disabled),
        actionsHidden: flag(() => element('demo-actions').hidden),
        panelHidden: flag(() => element('demo-panel').hidden),
      },
      preparation: [
        'flight-preparation-status',
        'presentation-preparation-status',
        'theme-preparation-status',
        'craft-preparation-status',
      ].map(status),
      errors,
      omittedErrors: count - errors.length,
    };
    const encoded = JSON.stringify(diagnostic);
    if (Buffer.byteLength(encoded, 'utf8') <= 8192) t.diagnostic(encoded);
  } catch {
    // Observation, serialization and the diagnostic sink must never replace
    // the original wait failure. The caller rethrows the exact Error unchanged.
  }
}

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
    if (/\/catalog(?:\.[a-z-]+)?\.json$/.test(path.pathname)) {
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
      reportDemoHostFailure(t, page, {
        phase: 'demo catalogue, library and scene preparation',
        timeoutMs: DEMO_HOST_READY_TIMEOUT_MS,
        lastOrdinaryRender: () => ordinaryFrame,
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
    get displayRender() {
      return page.displayRender;
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
