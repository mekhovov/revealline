// Minimal browser boundary for the actual solo entry. No layout or pixel claims.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BoardPainter } from '../../ui/render.mjs';
import { Document, Element, Events } from './couch-dom.mjs';
import { SOUNDTRACK_DATABASE } from '../../soundtrack-store.mjs';
import { JOURNEY_PROFILE_DATABASE } from '../../journey/profile.mjs';
import { audioHarness } from './soundtrack-audio.mjs';
import { memoryIndexedDB } from './soundtrack-fixtures.mjs';
import { waitFor } from './wait-for.mjs';

export class SoloElement extends Element {
  constructor(document, tag, options) {
    super(document, tag, options);
    this.style.setProperty = (name, value) => (this.style[name] = value);
    this.style.getPropertyValue = (name) => this.style[name] ?? '';
    this.style.removeProperty = (name) => delete this.style[name];
  }
  // The existing HUD publishes one numeric <small> suffix. Parsing text here is
  // a DOM boundary, never a replacement for app source or action handlers.
  set innerHTML(value) {
    this.replaceChildren();
    this.textContent = String(value).replace(/<[^>]*>/g, '');
  }
  get firstChild() {
    if (!this._text) return this.children[0] ?? null;
    const element = this;
    return {
      nodeType: 3,
      get textContent() {
        return element._text;
      },
      set textContent(value) {
        element._text = String(value);
      },
    };
  }
  get childNodes() {
    return this._text ? [this.firstChild, ...this.children] : this.children;
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
    .split(/<body\b[^>]*>/u)[1]
    .split('</body>')[0]
    .matchAll(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g)) {
    const text = token[0];
    if (text.startsWith('<!--')) continue;
    if (text.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!text.startsWith('<')) {
      stack.at(-1)._text += text.trim();
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
function assetDatabase(indexedDB = memoryIndexedDB().indexedDB) {
  const connections = new Set();
  return {
    close() {
      for (const db of connections) {
        db.onversionchange?.();
        db.close();
      }
    },
    open(...args) {
      const request = indexedDB.open(...args);
      let success;
      Object.defineProperty(request, 'onsuccess', {
        get: () => success,
        set: (callback) => {
          success = (...events) => {
            connections.add(request.result);
            callback?.(...events);
          };
        },
      });
      return request;
    },
  };
}
export async function settle(predicate, message = 'Asynchronous host action did not settle.') {
  await waitFor(predicate, { message });
}
let sequence = 0;
export async function soloPage(
  t,
  {
    campaign,
    storage = memoryStorage(),
    // Historical host tests exercise Legacy unless they explicitly request the
    // ordinary public entry with search: '' or a particular Journey edition.
    search = '?journey=legacy',
    previewStorage = memoryStorage(),
    titleScreen = false,
    fetchJSON,
    fetchResponse,
    buildInfo,
    audio,
    soundtrackIndexedDB,
    assetIndexedDB,
    journeyIndexedDB,
    lockManager,
    rendering,
    parentWindow,
    pictures,
    waitForPictures = true,
    initialReadyTimeoutMs = 5000,
    readPads = () => [],
  } = {},
) {
  assert.ok(
    Number.isInteger(initialReadyTimeoutMs) &&
      initialReadyTimeoutMs > 0 &&
      initialReadyTimeoutMs <= 180000,
    'Initial readiness allowance must be an integer from 1 to 180000ms.',
  );
  const doc = new SoloDocument(),
    win = new Events(),
    db = assetDatabase(assetIndexedDB);
  const mediaDB = soundtrackIndexedDB ?? memoryIndexedDB().indexedDB;
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
  win.parent = parentWindow ?? win;
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
    indexedDB: mediaDB
      ? {
          open(name, ...args) {
            if (name === JOURNEY_PROFILE_DATABASE && journeyIndexedDB)
              return journeyIndexedDB.open(name, ...args);
            return name === SOUNDTRACK_DATABASE
              ? mediaDB.open(name, ...args)
              : db.open(name, ...args);
          },
        }
      : db,
    navigator: {
      getGamepads() {
        padReads++;
        return readPads();
      },
      locks: lockManager ?? {
        request(name, options, callback) {
          return Promise.resolve((callback ?? options)({ name }));
        },
      },
    },
    matchMedia: () => ({ matches: false }),
    Option: class extends SoloElement {
      constructor(label, value) {
        super(doc, 'option', { textContent: label, value });
      }
      get label() {
        return this.getAttribute('label') ?? this.textContent;
      }
      set label(value) {
        this.setAttribute('label', value);
      }
      get text() {
        return this.textContent;
      }
      set text(value) {
        this.textContent = value;
      }
    },
    fetch: async (path, options) => {
      const custom = await fetchResponse?.(path, options);
      if (custom !== undefined && custom !== null) return custom;
      const presentation = String(path).match(/(?:^|\/)presentation\/(.+)$/);
      if (presentation) {
        if (options?.signal?.aborted) throw new DOMException('Cancelled.', 'AbortError');
        const bytes = await readFile(
          new URL(`../../presentation/${presentation[1]}`, import.meta.url),
        );
        if (options?.signal?.aborted) throw new DOMException('Cancelled.', 'AbortError');
        return new Response(bytes);
      }
      return {
        ok: path !== 'build-info.json' || !!buildInfo,
        json: async () => {
          if (path === 'build-info.json' && buildInfo) return structuredClone(buildInfo);
          const replacement = fetchJSON?.(path);
          if (replacement !== undefined) return structuredClone(replacement);
          return path === 'content/campaign.json' && campaign
            ? structuredClone(campaign)
            : JSON.parse(await readFile(new URL(path, new URL('../../', import.meta.url)), 'utf8'));
        },
      };
    },
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
  // Presentation bytes, manifests and header/hash validation remain real. Only
  // browser codecs are modeled, as they are unavailable in the Node DOM host.
  const pngDimensions = async (blob) => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  };
  if (typeof globalThis.createImageBitmap !== 'function')
    globals.createImageBitmap = async (blob) => ({ ...(await pngDimensions(blob)), close() {} });
  if (typeof globalThis.FontFace !== 'function')
    globals.FontFace = class {
      constructor(family) {
        this.family = family;
      }
      async load() {
        return this;
      }
    };
  const codecBlobs = new Map();
  globals.URL = class extends globalThis.URL {
    static createObjectURL(blob) {
      const url = audio?.URLImpl
        ? audio.URLImpl.createObjectURL(blob)
        : super.createObjectURL(blob);
      codecBlobs.set(url, blob);
      return url;
    }
    static revokeObjectURL(url) {
      codecBlobs.delete(url);
      if (audio?.URLImpl) audio.URLImpl.revokeObjectURL(url);
      else super.revokeObjectURL(url);
    }
  };
  if (pictures?.Image || rendering?.Image) globals.Image = pictures?.Image ?? rendering.Image;
  else if (typeof globalThis.Image !== 'function')
    globals.Image = class {
      set src(value) {
        this.source = value;
        const blob =
          codecBlobs.get(value) ??
          (/^data:image\/png;base64,/.test(value)
            ? new Blob([Buffer.from(value.split(',')[1], 'base64')], { type: 'image/png' })
            : null);
        if (!blob) {
          queueMicrotask(() => this.onerror?.());
          return;
        }
        void pngDimensions(blob).then(
          ({ width, height }) => {
            if (this.source !== value) return;
            this.naturalWidth = this.width = width;
            this.naturalHeight = this.height = height;
            this.onload?.();
          },
          () => this.onerror?.(),
        );
      }
      get src() {
        return this.source;
      }
      removeAttribute(name) {
        if (name === 'src') this.source = null;
      }
      async decode() {}
    };
  if (audio)
    globals.AudioContext = function () {
      return audio.context;
    };
  win.location = globals.location;
  // Real browser Window and global sessionStorage refer to the same tab store.
  win.sessionStorage = previewStorage;
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
    db.close();
    // Model the retired page, not a still-connected document in the next host's
    // JavaScript realm. Live locale bindings must not refresh detached controls.
    doc.documentElement.remove();
    console.error = originalError;
    for (const [key, value] of originals)
      value ? Object.defineProperty(globalThis, key, value) : delete globalThis[key];
    for (const [key, value] of methods) BoardPainter.prototype[key] = value;
  });
  await import(`../../app.mjs?difficultyHost=${++sequence}`);
  // Ordinary host tests begin at the briefing through real menu handlers.
  // Shell-specific cases can retain the title with titleScreen:true.
  if (!titleScreen && $('shell-home').open) {
    $('overlay-brief').click();
    $('shell-briefing').click();
  }
  assert.ok(
    scene,
    `${$('overlay-title').textContent}: ${$('overlay-copy').textContent}\n${errors.map((e) => e.stack).join('\n')}`,
  );
  // Bulk installed-original fixtures can declare their existing bounded
  // inventory allowance. Ordinary hosts retain the same five-second deadline.
  async function initialReady(predicate, phase) {
    try {
      await waitFor(predicate, { message: phase, timeoutMs: initialReadyTimeoutMs });
    } catch (error) {
      error.message += `\n${JSON.stringify({
        phase,
        timeoutMs: initialReadyTimeoutMs,
        pack: $('pack-select').value,
        pictureState: doc.body.dataset.pictureState,
        packStatus: $('pack-status').textContent,
        runMessage: $('run-message').textContent,
        start: $('start-button').textContent,
        errors: errors.map((value) => String(value?.stack ?? value)),
      })}`;
      throw error;
    }
  }
  await initialReady(
    () => $('builtin-packs').children.length > 0,
    'Bundled pack index must finish loading.',
  );
  function frame(ms = 1000 / 120) {
    now += ms;
    scene.update(now, ms);
  }
  if (waitForPictures)
    await initialReady(
      () => doc.body.dataset.pictureState === 'ready',
      'Actual host must finish its initial picture choice before synchronous input tests.',
    );
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
