// Minimal browser boundary for the actual solo entry. No layout or pixel claims.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BoardPainter } from '../../ui/render.mjs';
import { Document, Element, Events } from './couch-dom.mjs';
import { SOUNDTRACK_DATABASE } from '../../soundtrack-store.mjs';
import { audioHarness } from './soundtrack-audio.mjs';

export class SoloElement extends Element {
  constructor(document, tag, options) {
    super(document, tag, options);
    this.style.setProperty = (name, value) => (this.style[name] = value);
  }
  // The existing HUD publishes one numeric <small> suffix. Parsing text here is
  // a DOM boundary, never a replacement for app source or action handlers.
  set innerHTML(value) {
    this.replaceChildren();
    this.textContent = String(value).replace(/<[^>]*>/g, '');
  }
  get firstChild() {
    if (!this.textContent) return this.children[0] ?? null;
    const element = this;
    return {
      nodeType: 3,
      get textContent() {
        return element.textContent;
      },
      set textContent(value) {
        element.textContent = value;
      },
    };
  }
  get childNodes() {
    return this.textContent ? [this.firstChild, ...this.children] : this.children;
  }
  get lastElementChild() {
    return this.children.at(-1) ?? null;
  }
  showModal() {
    this.open = true;
    this.setAttribute('open', '');
  }
  close() {
    this.open = false;
    this.removeAttribute('open');
    this.emit('close');
  }
  focus() {
    if (!this.disabled) super.focus();
  }
}
class SoloDocument extends Document {
  constructor() {
    super();
    this.documentElement = new SoloElement(this, 'html');
    this.documentElement.parentNode = this;
    this.children = [this.documentElement];
    this.body = new SoloElement(this, 'body');
    this.documentElement.append(this.body);
    this.activeElement = this.body;
  }
  createElement(tag) {
    return new SoloElement(this, tag);
  }
}
function mount(document, html) {
  const stack = [document.body];
  for (const token of html
    .split('<body>')[1]
    .split('</body>')[0]
    .matchAll(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g)) {
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
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag)) stack.push(node);
  }
}
export function memoryStorage(entries = {}) {
  const map = new Map(Object.entries(entries)),
    writes = [];
  return {
    map,
    writes,
    getItem: (key) => map.get(key) ?? null,
    setItem(key, value) {
      writes.push([key, String(value)]);
      map.set(key, String(value));
    },
    removeItem(key) {
      writes.push([key, null]);
      map.delete(key);
    },
  };
}
function assetDatabase() {
  const assets = new Map();
  const db = {
    close() {},
    createObjectStore() {},
    transaction() {
      const transaction = {
        objectStore: () => ({
          get(key) {
            const request = {};
            queueMicrotask(() => {
              request.result = structuredClone(assets.get(key));
              request.onsuccess();
            });
            return request;
          },
          put(value, key) {
            assets.set(key, structuredClone(value));
            queueMicrotask(() => transaction.oncomplete());
          },
        }),
      };
      return transaction;
    },
  };
  return {
    db,
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = db;
        request.onsuccess();
      });
      return request;
    },
  };
}
export async function settle(predicate, message = 'Asynchronous host action did not settle.') {
  for (let i = 0; i < 150; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.ok(predicate(), message);
}
let sequence = 0;
export async function soloPage(
  t,
  {
    campaign,
    storage = memoryStorage(),
    search = '',
    previewStorage = memoryStorage(),
    titleScreen = false,
    fetchJSON,
    audio,
    soundtrackIndexedDB,
    rendering,
  } = {},
) {
  const doc = new SoloDocument(),
    win = new Events(),
    db = assetDatabase();
  const audioElements = [];
  if (audio?.filePlayback !== false && audio) {
    const createElement = doc.createElement.bind(doc);
    doc.createElement = (tag) => {
      const element = createElement(tag);
      if (tag.toLowerCase() !== 'audio') return element;
      // The app still constructs the real player and Soundscape. Only the
      // browser's media element is modeled, with one independent event target
      // and stream position per element, including probes and audition.
      const media = audioHarness().media;
      for (const [name, value] of Object.entries(media)) {
        if (['emit', 'addEventListener', 'removeEventListener', 'removeAttribute'].includes(name))
          continue;
        element[name] = value;
      }
      element.canPlayType = (type) => (type === 'audio/mpeg' ? 'probably' : '');
      element.load = () => {
        media.load.call(element);
        if (element.src) {
          element.duration = audio.durationSeconds ?? 1;
          element.readyState = 2;
          queueMicrotask(() => {
            element.emit('loadedmetadata');
            element.emit('loadeddata');
          });
        }
      };
      element.removeAttribute = (name) => {
        SoloElement.prototype.removeAttribute.call(element, name);
        if (name === 'src') element.src = '';
      };
      audioElements.push(element);
      return element;
    };
  }
  if (rendering) {
    const createElement = doc.createElement.bind(doc);
    doc.createElement = (tag) => {
      const element = createElement(tag);
      if (tag.toLowerCase() === 'canvas') {
        // Real Phaser textures are detached canvases: their CSS width is zero.
        element.clientWidth = 0;
        element.getContext = () => rendering.contextFor(element);
      }
      return element;
    };
  }
  win.parent = win;
  doc.parentNode = win;
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  mount(doc, html);
  const $ = (id) => doc.getElementById(id);
  const originals = new Map(),
    methods = new Map(),
    errors = [],
    frames = new Map();
  let scene,
    rendered,
    now = 1000,
    nextFrame = 0,
    padReads = 0;
  const globals = {
    document: doc,
    window: win,
    location: { href: `http://localhost/game/${search}`, search, origin: 'http://localhost' },
    localStorage: storage,
    sessionStorage: previewStorage,
    indexedDB: soundtrackIndexedDB
      ? {
          open(name, ...args) {
            return name === SOUNDTRACK_DATABASE
              ? soundtrackIndexedDB.open(name, ...args)
              : db.open(name, ...args);
          },
        }
      : db,
    navigator: {
      getGamepads() {
        padReads++;
        return [];
      },
      locks: {
        request(name, options, callback) {
          return Promise.resolve((callback ?? options)({ name }));
        },
      },
    },
    matchMedia: () => ({ matches: false }),
    Option: class extends SoloElement {
      constructor(label, value) {
        super(doc, 'option', { label, text: label, textContent: label, value });
      }
    },
    fetch: async (path) => ({
      ok: path !== 'build-info.json',
      json: async () => {
        const replacement = fetchJSON?.(path);
        if (replacement !== undefined) return structuredClone(replacement);
        return path === 'content/campaign.json' && campaign
          ? structuredClone(campaign)
          : JSON.parse(await readFile(new URL(path, new URL('../../', import.meta.url)), 'utf8'));
      },
    }),
    requestAnimationFrame(callback) {
      const id = ++nextFrame;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    Phaser: {
      CANVAS: 'canvas',
      Scene: class {},
      Game: class {
        constructor(config) {
          scene = new config.scene();
          scene.textures = {
            createCanvas: (id, width, height) => {
              const canvas = doc.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              return {
                context: rendering ? canvas.getContext('2d') : {},
                width,
                height,
                setSize(w, h) {
                  this.width = canvas.width = w;
                  this.height = canvas.height = h;
                },
              };
            },
          };
          scene.add = {
            image: () => ({
              setOrigin() {
                return this;
              },
              setSizeToFrame() {},
            }),
          };
          scene.game = { canvas: doc.createElement('canvas') };
          scene.game.canvas.width = config.width;
          scene.game.canvas.height = config.height;
          if (rendering) scene.game.canvas.clientWidth = rendering.displayCSSWidth ?? config.width;
          scene.scale = {
            resize(width, height) {
              scene.game.canvas.width = width;
              scene.game.canvas.height = height;
            },
          };
          scene.cameras = { main: { setSize() {} } };
          $('game-canvas').append(scene.game.canvas);
          scene.create();
        }
      },
    },
  };
  if (rendering?.Image) globals.Image = rendering.Image;
  if (audio) {
    globals.AudioContext = function () {
      return audio.context;
    };
    if (audio.URLImpl) {
      globals.URL = class extends globalThis.URL {
        static createObjectURL(blob) {
          return audio.URLImpl.createObjectURL(blob);
        }
        static revokeObjectURL(url) {
          return audio.URLImpl.revokeObjectURL(url);
        }
      };
    }
  }
  win.location = globals.location;
  for (const [key, value] of Object.entries(globals)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const originalError = console.error;
  console.error = (error) => errors.push(error);
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
        rendered = { run, ...options };
        if (rendering) {
          methods.get('draw').call(this, context, run, dt, options);
          rendering.onDraw?.({ painter: this, context, run, dt, options });
        }
      };
    } else if (!rendering) BoardPainter.prototype[key] = () => {};
  }
  t.after(async () => {
    win.emit('pagehide', { persisted: false });
    await new Promise((resolve) => setImmediate(resolve));
    db.db.onversionchange?.();
    console.error = originalError;
    for (const [key, value] of originals)
      value ? Object.defineProperty(globalThis, key, value) : delete globalThis[key];
    for (const [key, value] of methods) BoardPainter.prototype[key] = value;
  });
  await import(`../../app.mjs?difficultyHost=${++sequence}`);
  // Ordinary host tests begin at the briefing through real menu handlers.
  // Shell-specific cases can retain the title with titleScreen:true.
  if (!titleScreen && $('shell-home').open) {
    $('shell-play').click();
    $('shell-briefing').click();
  }
  assert.ok(
    scene,
    `${$('overlay-title').textContent}: ${$('overlay-copy').textContent}\n${errors.map((e) => e.stack).join('\n')}`,
  );
  await settle(
    () => $('builtin-packs').children.length > 0,
    'Bundled pack index must finish loading.',
  );
  function frame(ms = 1000 / 120) {
    now += ms;
    scene.update(now, ms);
  }
  frame(0);
  function key(code, held = true) {
    $('game-canvas').emit(held ? 'keydown' : 'keyup', {
      code,
      key: code.replace('Arrow', ''),
      repeat: false,
    });
  }
  function change(id, value) {
    assert.equal($(id).disabled, false, `${id} must be enabled`);
    $(id).focus();
    $(id).value = value;
    $(id).emit('change');
  }
  return {
    $,
    doc,
    win,
    storage,
    frame,
    key,
    change,
    errors,
    audioElements,
    get rendered() {
      return rendered;
    },
    get padReads() {
      return padReads;
    },
  };
}
