import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BoardPainter } from '../../ui/render.mjs';
import { authoritativeCheckpoint } from '../../replay.mjs';
import { Document, Element, Events } from './couch-dom.mjs';
const base = JSON.parse(
  await readFile(new URL('../../content/campaign.json', import.meta.url), 'utf8'),
);
const html = await readFile(new URL('../../couch/index.html', import.meta.url), 'utf8');
let sequence = 0;

// Parse actual entry markup into the minimal DOM boundary; use native property
// handlers and real input/router/navigation/duel code. No game-action factories.
export function mountCouch(document, html) {
  const stack = [document.body];
  const body = html.split(/<body\b[^>]*>/u)[1].split('</body>')[0];
  for (const token of body.matchAll(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g)) {
    const text = token[0];
    if (text.startsWith('<!--')) continue;
    if (text.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!text.startsWith('<')) {
      stack.at(-1).textContent += text.trim();
      continue;
    }
    const tag = text.match(/^<([\w-]+)/)[1];
    const node = document.createElement(tag);
    for (const [, name, quoted, bare] of text
      .slice(tag.length + 1, -1)
      .matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|([^\s]+)))?/g)) {
      const value = quoted ?? bare ?? '';
      node.setAttribute(name, value);
      if (name === 'class') node.className = value;
      if (name.startsWith('data-'))
        node.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      if (['type', 'value'].includes(name)) node[name] = value;
      if (['hidden', 'disabled', 'checked', 'inert'].includes(name)) node[name] = true;
    }
    stack.at(-1).append(node);
    if (!['meta', 'link', 'input', 'br', 'img'].includes(tag)) stack.push(node);
  }
}

export async function couchPage(
  t,
  {
    campaign = base,
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
    lockManager,
    URLImpl = globalThis.URL,
    expectBootFailure = false,
  } = {},
) {
  const doc = new Document(),
    win = new Events();
  doc.parentNode = win;
  mountCouch(doc, html);
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
    URL: URLImpl,
    Image:
      ImageClass ||
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
    location: { href: 'http://localhost/game/couch/', search: '' },
    matchMedia: (query) => ({ matches: query === '(pointer: coarse)' && coarse }),
    Option: class extends Element {
      constructor(label, value) {
        super(doc, 'option', { label, text: label, textContent: label, value });
      }
    },
    fetch: async (path) => ({
      ok: true,
      json: async () =>
        path === '../content/campaign.json'
          ? structuredClone(campaign)
          : JSON.parse(
              await readFile(new URL(path, new URL('../../couch/', import.meta.url)), 'utf8'),
            ),
    }),
    requestAnimationFrame(callback) {
      const id = ++nextFrame;
      rafs.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      rafs.delete(id);
    },
  };
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
    BoardPainter.prototype[key] =
      key === 'draw'
        ? (context, run, dt, options) => {
            renders[Number(context.id.slice(-1))] = run;
            drawOptions[Number(context.id.slice(-1))] = options;
          }
        : key === 'effectsFor'
          ? (events) => observedEvents.push(...events.map((event) => ({ ...event })))
          : () => {};
  }
  t.after(() => {
    win.emit('pagehide', { persisted: false });
    for (const [key, value] of original)
      value ? Object.defineProperty(globalThis, key, value) : delete globalThis[key];
    for (const [key, value] of methods) BoardPainter.prototype[key] = value;
  });
  await import(`../../couch/couch.mjs?navigation=${++sequence}`);
  if (expectBootFailure) assert.equal(rafs.size, 0);
  else {
    assert.ok(rafs.size, $('race-message').textContent);
    if (initialLevel !== null) {
      $('race-level').value = initialLevel;
      $('race-level').emit('change');
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
    target.emit(held ? 'keydown' : 'keyup', {
      code,
      key:
        code === 'Escape'
          ? 'Escape'
          : code === 'Enter'
            ? 'Enter'
            : code.replace('Key', '').toLowerCase(),
      repeat: false,
    });
  }
  frame();
  return {
    $,
    doc,
    win,
    renders,
    drawOptions,
    images,
    observedEvents,
    frame,
    button,
    pulse,
    join,
    key,
    readCount: () => reads,
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
