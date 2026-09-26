import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BoardPainter } from '../../ui/render.mjs';
import { authoritativeCheckpoint } from '../../replay.mjs';
import { Document, Element, Events } from './couch-dom.mjs';
import { installActorAppearanceTransport } from './actor-appearance-transport.mjs';
const base = JSON.parse(
  await readFile(new URL('../../content/campaign.json', import.meta.url), 'utf8'),
);
const html = await readFile(new URL('../../couch/index.html', import.meta.url), 'utf8');
let sequence = 0;

import { mountCouch } from './mount-html.mjs';
export { mountCouch } from './mount-html.mjs';

export async function couchPage(
  t,
  {
    campaign = base,
    beforeImport,
    beforeActorRequest,
    turnPolicy = 'immediate',
    pads = [],
    seconds = '30',
    coarse = false,
    // Existing input/navigation fixtures explicitly keep their authored geometry.
    // null exercises the real shipped default instead.
    initialLevel = campaign.levels[0].id,
    ImageClass,
    assetDatabase,
    storage,
    previewStorage,
    href = 'http://localhost/game/couch/?journey=legacy',
    lockManager,
    fetchResponse,
    URLImpl = globalThis.URL,
    expectBootFailure = false,
    audio,
    rendering,
    // Opt into browser default keyboard actions for native controls/dialogs.
    // Existing input fixtures retain their direct-event boundary by default.
    nativeKeyboard = false,
  } = {},
) {
  const doc = new Document(),
    win = new Events();
  doc.parentNode = win;
  if (rendering) {
    const createElement = doc.createElement.bind(doc);
    doc.createElement = (tag) => {
      const element = createElement(tag);
      if (tag === 'canvas') element.getContext = () => rendering.contextFor(element);
      return element;
    };
  }
  mountCouch(doc, html);
  if (audio?.createElement) {
    const createElement = doc.createElement.bind(doc);
    doc.createElement = (tag) => (tag === 'audio' ? audio.createElement(doc) : createElement(tag));
  }
  const $ = (id) => doc.getElementById(id);
  $('race-turn').value = turnPolicy;
  $('race-time').value = seconds;
  const original = new Map(),
    methods = new Map(),
    renders = [],
    drawOptions = [],
    images = [],
    observedEvents = [],
    rafs = new Map();
  let now = 1000,
    nextFrame = 0,
    reads = 0,
    readError = null;
  const globals = {
    document: doc,
    window: win,
    navigator: {
      locks: lockManager,
      getGamepads() {
        reads++;
        if (readError) throw readError;
        return pads;
      },
    },
    indexedDB: assetDatabase,
    localStorage: storage,
    performance: { now: () => now },
    URL: URLImpl,
    Image:
      ImageClass ||
      rendering?.Image ||
      class {
        constructor() {
          images.push(this);
        }
        set src(source) {
          this.source = source;
          const bytes = Buffer.from(source.split(',')[1], 'base64');
          assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
          this.width = this.naturalWidth = bytes.readUInt32BE(16);
          this.height = this.naturalHeight = bytes.readUInt32BE(20);
          queueMicrotask(() => this.onload?.());
        }
        async decode() {}
        removeAttribute(name) {
          assert.equal(name, 'src');
          this.released = (this.released || 0) + 1;
        }
      },
    location: { href, search: new URL(href).search },
    sessionStorage: previewStorage,
    matchMedia: (query) => ({ matches: query === '(pointer: coarse)' && coarse }),
    Option: class extends Element {
      constructor(label, value) {
        super(doc, 'option', { label, text: label, textContent: label, value });
      }
    },
    fetch: async (path, options) =>
      (await fetchResponse?.(path, options)) ?? {
        ok: true,
        json: async () =>
          path === '../content/campaign.json'
            ? structuredClone(campaign)
            : JSON.parse(
                await readFile(new URL(path, new URL('../../couch/', import.meta.url)), 'utf8'),
              ),
      },
    requestAnimationFrame(callback) {
      const id = ++nextFrame;
      rafs.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      rafs.delete(id);
    },
  };
  if (rendering?.ResizeObserver) globals.ResizeObserver = rendering.ResizeObserver;
  if (audio?.Context) globals.AudioContext = audio.Context;
  for (const [key, value] of Object.entries(globals)) {
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  for (const key of [
    'setLook',
    'setLevel',
    'skipCelebration',
    'startCelebration',
    'effectsFor',
    'draw',
  ]) {
    methods.set(key, BoardPainter.prototype[key]);
    if (key === 'draw') {
      BoardPainter.prototype[key] = function (context, run, dt, options) {
        const seat = Number((context.canvas?.id || context.id).slice(-1));
        renders[seat] = run;
        drawOptions[seat] = options;
        if (rendering) {
          methods.get('draw').call(this, context, run, dt, options);
          rendering.onDraw?.({ painter: this, context, run, dt, options, seat });
        }
      };
    } else if (key === 'effectsFor') {
      BoardPainter.prototype[key] = function (events, run) {
        observedEvents.push(...events.map((event) => ({ ...event })));
        if (rendering) methods.get(key).call(this, events, run);
      };
    } else if (!rendering) BoardPainter.prototype[key] = () => {};
  }
  t.after(() => {
    win.emit('pagehide', { persisted: false });
    for (const [key, value] of original)
      value ? Object.defineProperty(globalThis, key, value) : delete globalThis[key];
    for (const [key, value] of methods) BoardPainter.prototype[key] = value;
  });
  const actorTransport = installActorAppearanceTransport({
    baseURL: new URL('../presentation/compiled/', href),
    beforeRequest: beforeActorRequest,
    install(name, descriptor) {
      if (!original.has(name))
        original.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
      Object.defineProperty(globalThis, name, { ...descriptor, configurable: true });
    },
  });
  await beforeImport?.({ document: doc, window: win });
  await import(`../../couch/couch.mjs?navigation=${++sequence}`);
  if (expectBootFailure) assert.equal(rafs.size, 0);
  else {
    assert.ok(rafs.size, $('race-message').textContent);
    if (initialLevel !== null) {
      $('race-level').value = initialLevel;
      const handler = $('race-level').onchange;
      let preparation;
      $('race-level').onchange = (event) => (preparation = handler(event));
      try {
        $('race-level').emit('change');
        await preparation;
      } finally {
        $('race-level').onchange = handler;
      }
    }
  }
  function frame(ms = 1000 / 120) {
    now += ms;
    const first = rafs.entries().next().value;
    if (!first) return;
    rafs.delete(first[0]);
    first[1](now);
  }
  function button(index, button, pressed) {
    pads[index].buttons[button] = { pressed, value: pressed ? 1 : 0 };
  }
  function pulse(index, key) {
    button(index, key, true);
    frame();
    button(index, key, false);
    frame();
  }
  function join(index) {
    frame();
    frame();
    pulse(index, 0);
    frame();
  }
  function key(code, held = true, target = $('race-canvas-0')) {
    const event = target.emit(held ? 'keydown' : 'keyup', {
      code,
      key:
        code === 'Escape'
          ? 'Escape'
          : code === 'Enter'
            ? 'Enter'
            : code.replace('Key', '').toLowerCase(),
      repeat: false,
    });
    if (nativeKeyboard && held && !event.defaultPrevented) {
      const modal = doc.modalDialogs.at(-1);
      if (code === 'Escape' && modal) {
        const cancel = modal.emit('cancel', { bubbles: false });
        if (!cancel.defaultPrevented) modal.close();
      } else if (
        code === 'Enter' &&
        target.tagName === 'BUTTON' &&
        target.getClientRects().length &&
        !target.closest('[hidden],[inert]') &&
        (!modal || modal.contains(target))
      )
        target.click();
    }
    return event;
  }
  frame();
  return {
    $,
    doc,
    win,
    renders,
    drawOptions,
    images,
    actorTransport,
    observedEvents,
    frame,
    button,
    pulse,
    join,
    key,
    readCount: () => reads,
    pendingFrames: () => rafs.size,
    pads: () => pads,
    setPads: (next) => {
      pads = next;
    },
    setError: (next) => {
      readError = next;
    },
    tick: () => renders[0].tick,
    state: () => $('racer-state-0').textContent,
    checkpoint: () => renders.map((run) => authoritativeCheckpoint(run)),
    focus: (id) => $(id).focus(),
    editors: () => doc.querySelectorAll('.controller-editor'),
    frames: (count, ms) => {
      for (let i = 0; i < count; i++) frame(ms);
    },
  };
}
