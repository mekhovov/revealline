// Actual native app and renderer with finite browser/Phaser/codec boundaries.
// Real local authored bytes and production validation remain authoritative.
// This does not model CSS layout, WebGL pixels, audio output or physical input.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse, parseFragment } from 'parse5';
import { Document, Element } from './couch-dom.mjs';
import { mountCouch } from './mount-html.mjs';
import { installSoloStylesheets } from './solo-dom.mjs';
import { rasterDimensions } from './raster-image.mjs';
import { waitFor } from './wait-for.mjs';
import { getLocale, setLocale } from '../../i18n/index.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const NativeURL = globalThis.URL;
let sequence = 0;
export function overflightMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial)),
    writes = [];
  let fail = false;
  return {
    values,
    writes,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (fail) throw new Error('Storage unavailable');
      writes.push([key, String(value)]);
      values.set(key, String(value));
    },
    removeItem(key) {
      writes.push([key, null]);
      values.delete(key);
    },
    failWrites() {
      fail = true;
    },
  };
}
function finitePhaser(document) {
  const games = [];
  const image = () => {
    const value = {};
    for (const name of [
      'setDepth',
      'setOrigin',
      'setAlpha',
      'setVisible',
      'setPosition',
      'setFrame',
      'setTexture',
      'setRotation',
      'setTint',
      'setDisplaySize',
      'setSize',
    ])
      value[name] = () => value;
    return value;
  };
  const Phaser = {
    VERSION: '4.2.1',
    WEBGL: 2,
    Scale: { FIT: 1, CENTER_BOTH: 1 },
    Textures: { FilterMode: { NEAREST: 0 } },
    Renderer: { Events: { LOSE_WEBGL: 'lose', RESTORE_WEBGL: 'restore' } },
    Core: { Events: { PRE_RENDER: 'pre', POST_RENDER: 'post', DESTROY: 'destroy' } },
    Game: class {
      constructor(config) {
        this.config = config;
        this.events = new EventEmitter();
        this.renderer = new EventEmitter();
        this.renderer.type = Phaser.WEBGL;
        this.canvas = document.createElement('canvas');
        this.canvas.width = 960;
        this.canvas.height = 540;
        config.parent.append(this.canvas);
        this.scene = {
          game: this,
          textures: { create: () => ({ add() {}, setFilter() {} }) },
          add: { image, tileSprite: image },
          cameras: {
            main: {
              setBounds() {
                return this;
              },
              centerOn() {},
            },
          },
        };
        games.push(this);
        queueMicrotask(() => config.scene.create.call(this.scene));
      }
      destroy() {
        this.pendingDestroy = true;
      }
      step() {
        if (this.pendingDestroy) {
          this.pendingDestroy = false;
          this.destroyed = true;
          this.canvas.remove();
          this.events.emit('destroy');
        }
      }
    },
  };
  return { Phaser, games };
}

export async function overflightNativePage(
  t,
  {
    operation = '',
    entry = 'play',
    locale = 'en',
    storage = overflightMemoryStorage(),
    coarse = false,
  } = {},
) {
  const previousLocale = getLocale();
  setLocale(locale, { persist: false });
  const document = new Document(),
    window = document.defaultView,
    originals = new Map(),
    rafs = new Map(),
    requests = [],
    blobs = new Map();
  const html = await readFile(path.join(root, `game/overflight/${entry}.html`), 'utf8');
  class NativeElement extends Element {
    getContext(kind = '2d') {
      const context = super.getContext(kind);
      if (context && !context.createImageData) {
        context.createImageData = (width, height) => ({
          width,
          height,
          data: new Uint8ClampedArray(width * height * 4),
        });
        context.getImageData = (_x, _y, width, height) => context.createImageData(width, height);
      }
      return context;
    }
    set innerHTML(markup) {
      const convert = (source) => {
        if (source.nodeName === '#text') return document.createTextNode(source.value);
        const node = document.createElement(source.tagName);
        for (const { name, value } of source.attrs ?? []) node.setAttribute(name, value);
        node.append(...(source.childNodes ?? []).map(convert));
        return node;
      };
      this.replaceChildren(...parseFragment(markup).childNodes.map(convert));
    }
  }
  document.createElement = (tag) => new NativeElement(document, tag);
  mountCouch(document, html);
  const parsed = parse(html),
    htmlNode = parsed.childNodes.find((node) => node.tagName === 'html'),
    bodyNode = htmlNode.childNodes.find((node) => node.tagName === 'body');
  for (const [element, attrs] of [
    [document.documentElement, htmlNode.attrs],
    [document.body, bodyNode.attrs],
  ])
    for (const { name, value } of attrs) {
      element.setAttribute(name, value);
      if (name === 'class') element.className = value;
      if (name.startsWith('data-'))
        element.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    }
  document.documentElement.lang = locale;
  document.parentNode = window;
  let now = 1000,
    nextFrame = 0;
  const href = `http://localhost/game/overflight/${entry}.html?lang=${locale}${operation ? `&operation=${operation}` : ''}`;
  const { Phaser, games } = finitePhaser(document);
  const mappedURL = class extends NativeURL {
    constructor(input, base) {
      super(input, base);
      // The source module has a file URL in Node; model only the compiled web
      // release directory at the same origin as the actual native entry.
      if (this.protocol === 'file:' && this.pathname.includes('/game/presentation/compiled/'))
        return new NativeURL(
          this.pathname.slice(this.pathname.indexOf('/game/')),
          'http://localhost',
        );
    }
    static createObjectURL(blob) {
      const url = NativeURL.createObjectURL(blob);
      blobs.set(url, blob);
      return url;
    }
    static revokeObjectURL(url) {
      blobs.delete(url);
      NativeURL.revokeObjectURL(url);
    }
  };
  const fetch = async (input, options = {}) => {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const url = new NativeURL(input, href);
    let relative;
    if (url.protocol === 'file:') relative = path.relative(root, fileURLToPath(url));
    else if (url.origin === 'http://localhost') relative = url.pathname.replace(/^\//, '');
    else return new Response('', { status: 404 });
    assert.ok(
      !relative.startsWith('..') && !path.isAbsolute(relative),
      'Only local game resources belong to this fixture.',
    );
    requests.push(relative);
    let bytes;
    try {
      bytes = await readFile(path.join(root, relative));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (!relative.startsWith('game/presentation/compiled/'))
        return new Response('', { status: 404 });
      // Exact already-local Git bytes only; no sparse hydration or network.
      bytes = execFileSync('git', ['show', `HEAD:${relative}`], {
        cwd: root,
        maxBuffer: 2 * 1024 * 1024,
        env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_OPTIONAL_LOCKS: '0' },
      });
    }
    return new Response(bytes);
  };
  const globals = {
    document,
    window,
    localStorage: storage,
    sessionStorage: overflightMemoryStorage(),
    navigator: { getGamepads: () => [], storage: {}, hardwareConcurrency: 4 },
    location: { href, search: new NativeURL(href).search, origin: 'http://localhost' },
    performance: { now: () => now },
    matchMedia: (query) => ({
      matches: query.includes('coarse') && coarse,
      addEventListener() {},
      removeEventListener() {},
    }),
    requestAnimationFrame(callback) {
      const id = ++nextFrame;
      rafs.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id) => rafs.delete(id),
    fetch,
    URL: mappedURL,
    Phaser,
    createImageBitmap: async (blob, ...crop) => ({
      ...(blob instanceof Blob
        ? await rasterDimensions(blob)
        : { width: crop[2], height: crop[3] }),
      close() {},
    }),
    Image: class {
      set src(value) {
        const blob = blobs.get(value);
        if (!blob) {
          queueMicrotask(() => this.onerror?.());
          return;
        }
        rasterDimensions(blob).then(
          ({ width, height }) => {
            this.width = this.naturalWidth = width;
            this.height = this.naturalHeight = height;
            this.onload?.();
          },
          () => this.onerror?.(),
        );
      }
      async decode() {}
      removeAttribute() {}
    },
  };
  for (const [key, value] of Object.entries(globals)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  Object.assign(window, globals, {
    innerWidth: 390,
    innerHeight: 844,
    setTimeout,
    clearTimeout,
    crypto: globalThis.crypto,
    parent: window,
  });
  const removeStylesheets = installSoloStylesheets(document);
  t.after(async () => {
    window.emit('pagehide', { persisted: false });
    await waitFor(() => !window.RevealLineOverflight);
    await new Promise((resolve) => setImmediate(resolve));
    removeStylesheets();
    for (const url of blobs.keys()) mappedURL.revokeObjectURL(url);
    for (const [key, descriptor] of originals)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    setLocale(previousLocale, { persist: false });
  });
  await import(`../../overflight/app.mjs?native-text-scaling=${++sequence}`);
  assert.ok(window.RevealLineOverflight, document.getElementById('boot-status').textContent);
  return {
    document,
    window,
    storage,
    requests,
    games,
    $: (id) => document.getElementById(id),
    snapshot: () => structuredClone(window.RevealLineOverflight.snapshot()),
    frame(milliseconds = 1000 / 60) {
      now += milliseconds;
      for (const [id, callback] of [...rafs]) {
        rafs.delete(id);
        callback(now);
      }
      for (const game of games.filter((game) => !game.destroyed)) {
        game.config.scene.update.call(game.scene);
        game.events.emit('pre');
        game.events.emit('post');
      }
    },
  };
}
