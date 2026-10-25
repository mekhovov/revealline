// Minimal browser boundary for the actual solo entry. No layout or pixel claims.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { rasterDimensions } from './raster-image.mjs';
import { readFile } from 'node:fs/promises';
import { hrtime } from 'node:process';
import { BoardPainter } from '../../ui/render.mjs';
import { Document, Element, Events } from './couch-dom.mjs';
import { SOUNDTRACK_DATABASE } from '../../soundtrack-store.mjs';
import { JOURNEY_PROFILE_DATABASE } from '../../journey/profile.mjs';
import { audioHarness } from './soundtrack-audio.mjs';
import { memoryIndexedDB } from './soundtrack-fixtures.mjs';
import { waitFor } from './wait-for.mjs';

// Model only the known theme stylesheet's asynchronous native load boundary.
// CSS bytes remain real; this host makes no parsing, layout or font claim.
export function installSoloStylesheets(document, { read = readFile } = {}) {
  const href = new URL('../../presentation/industrial-workshop.css', import.meta.url).href;
  const head = document.head,
    original = head.append;
  const controller = new AbortController(),
    seen = new WeakSet();
  let disposed = false;
  const append = function (...nodes) {
    const result = original.apply(this, nodes);
    for (const node of nodes) {
      if (
        node.tagName !== 'LINK' ||
        node.rel !== 'stylesheet' ||
        node.href !== href ||
        seen.has(node)
      )
        continue;
      seen.add(node);
      const current = () =>
        !disposed && node.isConnected && node.parentNode === head && node.href === href;
      Promise.resolve()
        .then(() => read(new URL(href), { signal: controller.signal }))
        .then((bytes) => {
          if (!current()) return;
          assert(
            bytes.byteLength > 0 && bytes.byteLength <= 256 * 1024,
            'Modeled stylesheet must have bounded local bytes.',
          );
          node.sheet = { cssRules: [{}] };
          node.emit('load');
        })
        .catch(() => {
          if (current()) node.emit('error');
        });
    }
    return result;
  };
  head.append = append;
  return () => {
    disposed = true;
    controller.abort();
    if (head.append === append) head.append = original;
  };
}

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
  prepend(...nodes) {
    const prior = [...this.children];
    this.append(...nodes);
    this.children = [...nodes, ...prior.filter((node) => !nodes.includes(node))];
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
  getContext() {
    // Guides and sprite admission need a usable inert Canvas boundary. Drawing
    // assertions install their explicit observable context in soloPage below.
    return (this._canvasContext ??= new Proxy(
      { canvas: this, id: this.id },
      { get: (target, key) => (Object.hasOwn(target, key) ? target[key] : () => {}) },
    ));
  }
}
class SoloDocument extends Document {
  constructor() {
    super();
    this.documentElement = new SoloElement(this, 'html');
    this.documentElement.parentNode = this;
    this.children = [this.documentElement];
    this.documentElement.append(this.head);
    this.body = new SoloElement(this, 'body');
    this.documentElement.append(this.body);
    this.activeElement = this.body;
  }
  createElement(tag) {
    return new SoloElement(this, tag);
  }
  createTextNode(value) {
    const node = new SoloElement(this, 'span');
    node.textContent = value;
    return node;
  }
}
export function mount(document, html) {
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
export function soloDatabase(indexedDB) {
  const connections = new Set(),
    databases = new Map();
  return {
    close() {
      for (const db of connections) {
        db.onversionchange?.();
        db.close();
      }
    },
    open(name, ...args) {
      // The finite model represents one database. Browser names must not share
      // schema/version state, but explicit test routers keep their own policy.
      if (indexedDB === undefined && !databases.has(name))
        databases.set(name, memoryIndexedDB().indexedDB);
      const backend = indexedDB === undefined ? databases.get(name) : indexedDB;
      const request = backend.open(name, ...args);
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
const waitingHosts = new Set();
export async function settle(
  predicate,
  message = 'Asynchronous host action did not settle.',
  options = {},
) {
  // The focused gate runs independent host processes concurrently. Its runner
  // can schedule a valid asynchronous handoff later than the interactive
  // fixture's five-second default; retain the fast local feedback while
  // giving CI a deterministic scheduler allowance.
  const timeoutMs = options.timeoutMs ?? (process.env.CI ? 20_000 : 5_000);
  await waitFor(
    () => {
      // A real browser continues to submit paused preparation frames while an
      // async action settles. Keep simulated time controlled by each test.
      for (const frame of waitingHosts) frame(0);
      return predicate();
    },
    { ...options, timeoutMs, message },
  );
}
export function clickVisibleSimulator(page) {
  const simulator = page.$('solo-fpv-sim');
  if (simulator.hidden) simulator.parentElement.querySelector('[data-mode-more]')?.click();
  assert.equal(simulator.hidden, false, 'SIM must be revealed through More before launch.');
  simulator.click();
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
    presentationFixture,
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
    animationFrames = false,
    automaticPreparationFrames = true,
    loadStylesheets = true,
    initialReadyTimeoutMs = 5000,
    browserSetup,
    readPads = () => [],
  } = {},
) {
  assert.ok(
    Number.isInteger(initialReadyTimeoutMs) &&
      initialReadyTimeoutMs > 0 &&
      initialReadyTimeoutMs <= 180000,
    'Initial readiness allowance must be an integer from 1 to 180000ms.',
  );
  if (presentationFixture)
    assert.ok(
      typeof presentationFixture.read === 'function' &&
        typeof presentationFixture.snapshot === 'function',
      'An opted-in presentation fixture must expose its reader and bounded provenance.',
    );
  const doc = new SoloDocument(),
    win = new Events(),
    db = soloDatabase(assetIndexedDB);
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
  Object.assign(win, doc.defaultView);
  doc.defaultView = win;
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
    padReads = 0,
    displayDraws = 0,
    displayClears = 0;
  const globals = {
    // This host models scene time and inert drawing, not native browser work.
    // An explicit browserSetup clock still overrides this default.
    performance: { now: () => now },
    document: doc,
    window: win,
    location: {
      href: `http://localhost/game/${search}`,
      search,
      origin: 'http://localhost',
      protocol: 'http:',
    },
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
        const source = new URL(`../../presentation/${presentation[1]}`, import.meta.url);
        const bytes = presentationFixture
          ? await presentationFixture.read(source)
          : await readFile(source);
        if (options?.signal?.aborted) throw new DOMException('Cancelled.', 'AbortError');
        return new Response(bytes);
      }
      return {
        ok: path !== 'build-info.json' || !!buildInfo,
        text: async () => {
          const replacement = fetchJSON?.(path);
          if (replacement !== undefined) return JSON.stringify(replacement);
          return readFile(new URL(path, new URL('../../', import.meta.url)), 'utf8');
        },
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
      Core: { Events: { PRE_STEP: 'prestep', POST_RENDER: 'postrender' } },
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
                canvas,
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
              visible: true,
              setVisible(value) {
                this.visible = value;
                return this;
              },
              willRender(camera) {
                return this.visible && camera.visible && camera.alpha > 0;
              },
              setOrigin() {
                return this;
              },
              setSizeToFrame() {},
            }),
          };
          scene.events = new EventEmitter();
          scene.sys = {
            visible: true,
            isVisible() {
              return this.visible;
            },
          };
          scene.game = {
            canvas: doc.createElement('canvas'),
            events: new EventEmitter(),
            renderer: { type: 'canvas', config: { clearBeforeRender: true } },
            scene: { scenes: [scene] },
          };
          scene.game.canvas.width = config.width;
          scene.game.canvas.height = config.height;
          if (rendering) scene.game.canvas.clientWidth = rendering.displayCSSWidth ?? config.width;
          scene.scale = {
            resize(width, height) {
              scene.game.canvas.width = width;
              scene.game.canvas.height = height;
            },
          };
          scene.cameras = { main: { visible: true, alpha: 1, setSize() {} } };
          scene.cameras.cameras = [scene.cameras.main];
          $('game-canvas').append(scene.game.canvas);
          scene.create();
          scene.sys.displayList = { list: [scene.boardImage] };
        }
      },
    },
  };
  if (animationFrames) {
    win.performance = { now: () => now };
    win.requestAnimationFrame = globals.requestAnimationFrame;
    win.cancelAnimationFrame = globals.cancelAnimationFrame;
  }
  // Presentation bytes, manifests and header/hash validation remain real. Only
  // browser codecs are modeled, as they are unavailable in the Node DOM host.
  if (typeof globalThis.createImageBitmap !== 'function')
    globals.createImageBitmap = async (blob) => ({ ...(await rasterDimensions(blob)), close() {} });
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
        const data = /^data:(image\/(?:png|jpeg|webp));base64,/.exec(value);
        const blob =
          codecBlobs.get(value) ??
          (data ? new Blob([Buffer.from(value.split(',')[1], 'base64')], { type: data[1] }) : null);
        if (!blob) {
          queueMicrotask(() => this.onerror?.());
          return;
        }
        void rasterDimensions(blob).then(
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
  // Window and global URL share the same page-owned object URL registry.
  win.URL = globals.URL;
  // Real browser Window and global sessionStorage refer to the same tab store.
  win.sessionStorage = previewStorage;
  if (loadStylesheets) t.after(installSoloStylesheets(doc));
  // Explicit browserSetup overrides may suppress or fail the modeled boundary.
  browserSetup?.({ document: doc, window: win, globals });
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
    const started = hrtime.bigint();
    try {
      await waitFor(predicate, { message: phase, timeoutMs: initialReadyTimeoutMs });
    } catch (error) {
      // Initial picture selection precedes the first modeled frame. Observe
      // only existing public state on failure; never advance or retry its work.
      try {
        const read = (get, fallback = null) => {
          try {
            return get();
          } catch {
            return fallback;
          }
        };
        const text = (value, limit = 64) =>
          typeof value === 'string' ? value.slice(0, limit) : null;
        const number = (value) => (Number.isFinite(value) ? value : null);
        const flag = (get) =>
          read(() => {
            const value = get();
            return typeof value === 'boolean' ? value : null;
          });
        const status = (id) => {
          const element = read(() => $(id));
          return {
            id,
            hidden: flag(() => element.hidden),
            state: text(
              read(() => element.dataset.state),
              24,
            ),
            stage: text(
              read(() => element.dataset.stage),
              32,
            ),
            message: text(
              read(() => element.textContent),
              80,
            ),
          };
        };
        const fixture = read(() => presentationFixture?.snapshot());
        const fixtureNumber = (key) => number(read(() => fixture[key]));
        const errorCount = number(read(() => errors.length));
        const existingErrors = [];
        for (let i = 0; i < Math.min(errorCount ?? 0, 4); i++)
          existingErrors.push(
            text(
              read(() => (typeof errors[i] === 'string' ? errors[i] : errors[i]?.message)),
              80,
            ),
          );
        const diagnostic = {
          format: 'SoloInitialPictureFailureV1',
          phase: text(phase, 96),
          timeoutMs: initialReadyTimeoutMs,
          elapsedMs: number(Number((Number(hrtime.bigint() - started) / 1e6).toFixed(3))),
          pack: text(read(() => $('pack-select').value)),
          pictureState: text(
            read(() => doc.body.dataset.pictureState),
            24,
          ),
          packStatus: text(
            read(() => $('pack-status').textContent),
            96,
          ),
          runMessage: text(
            read(() => $('run-message').textContent),
            96,
          ),
          start: text(read(() => $('start-button').textContent)),
          page: {
            hidden: flag(() => doc.hidden),
            focused: flag(() => doc.hasFocus()),
            documentConnected: flag(() => doc.documentElement.isConnected),
            documentOwned: globalThis.document === doc,
            windowOwned: globalThis.window === win,
            activeId: text(read(() => doc.activeElement?.id)),
            flight: text(
              read(() => doc.body.dataset.flightState),
              24,
            ),
          },
          preparation: [
            'flight-preparation-status',
            'presentation-preparation-status',
            'theme-preparation-status',
            'craft-preparation-status',
          ].map(status),
          // The existing transport snapshot is summarized without copying its
          // source inventory or any image bytes into an assertion failure.
          presentationFixture: fixture
            ? {
                requests: fixtureNumber('requests'),
                hits: fixtureNumber('hits'),
                joined: fixtureNumber('joined'),
                reads: fixtureNumber('reads'),
                failures: fixtureNumber('failures'),
                uncached: fixtureNumber('uncached'),
                retainedBytes: fixtureNumber('retainedBytes'),
                retainedEntries: fixtureNumber('retainedEntries'),
                pending: number(read(() => fixture.pending.length)),
              }
            : null,
          errors: existingErrors,
          omittedErrors:
            errorCount === null ? null : Math.max(0, errorCount - existingErrors.length),
        };
        const encoded = JSON.stringify(diagnostic);
        if (Buffer.byteLength(encoded, 'utf8') <= 8192 && typeof error?.message === 'string') {
          // Preserve V8's original lazy stack header, cause and Error identity.
          // Include the same bounded details for reporters that display only stack.
          const stack = error.stack,
            details = `\n${encoded}`;
          error.message += details;
          if (typeof stack === 'string') error.stack = stack + details;
        }
      } catch {}

      throw error;
    }
  }
  // Optional Library examples load only when that public surface is requested.
  // Flight readiness is owned by the actual selected picture below.
  function submitRender() {
    // Model Phaser.Game.step's clear/camera draw before the final event.
    if (scene.game.renderer.config.clearBeforeRender) displayClears++;
    if (
      scene.sys.isVisible() &&
      scene.cameras.main.visible &&
      scene.cameras.main.alpha > 0 &&
      scene.boardImage.willRender(scene.cameras.main)
    )
      displayDraws++;
    scene.game.events.emit('postrender', scene.game.renderer, now, 0);
  }
  function frame(
    ms = 1000 / 120,
    { dispatchAnimationFrames = true, dispatchRender = true, beforeRender } = {},
  ) {
    now += ms;
    scene.game.events.emit('prestep', now, ms);
    scene.update(now, ms);
    beforeRender?.();
    if (dispatchRender) submitRender();
    if (animationFrames && dispatchAnimationFrames && !doc.hidden) {
      for (const [id, callback] of [...frames]) {
        if (!frames.delete(id)) continue;
        callback(now);
      }
    }
  }
  if (waitForPictures)
    await initialReady(
      () => doc.body.dataset.pictureState === 'ready',
      'Actual host must finish its initial picture choice before synchronous input tests.',
    );
  frame(0);
  const preparationFrame = () => frame(scene.cadence?.waiting ? 1000 / 60 : 0);
  waitingHosts.add(preparationFrame);
  t.after(() => waitingHosts.delete(preparationFrame));
  if (automaticPreparationFrames) {
    // Native rendering continues while a caller awaits a Start/Next promise.
    // A pending cadence check needs real positive scene intervals while paused.
    // Neither that check nor board submission advances active simulation ticks.
    const preparationFrames = setInterval(() => {
      if (!doc.hidden && (scene.preparedFrame || scene.cadence?.waiting)) preparationFrame();
    }, 16);
    t.after(() => clearInterval(preparationFrames));
  }
  async function waitUntilRunning(label = '') {
    const wallStarted = hrtime.bigint(),
      modelStarted = now;
    try {
      await settle(() => doc.body.dataset.flightState === 'running');
    } catch (error) {
      // Diagnose only the failed boundary. A stale scene/getter must never
      // replace the original error, cause or stack with an observation failure.
      try {
        const read = (get, fallback = null) => {
          try {
            return get();
          } catch {
            return fallback;
          }
        };
        const text = (value, limit = 48) =>
          typeof value === 'string' ? value.slice(0, limit) : null;
        const number = (value) => (Number.isFinite(value) ? value : null);
        const flag = (get) =>
          read(() => {
            const value = get();
            return typeof value === 'boolean' ? value : null;
          });
        const status = read(() => $('flight-preparation-status'));
        const currentRun = read(() => rendered.run);
        const dialogs = [];
        let openDialogs = 0;
        for (const dialog of read(() => doc.querySelectorAll('dialog'), []))
          if (read(() => dialog.open, false)) {
            openDialogs++;
            if (dialogs.length < 4)
              dialogs.push(
                text(
                  read(() => dialog.id),
                  32,
                ),
              );
          }
        const existingErrors = [];
        for (
          let i = 0;
          i <
          Math.min(
            read(() => errors.length, 0),
            4,
          );
          i++
        )
          existingErrors.push(
            text(
              read(() => (typeof errors[i] === 'string' ? errors[i] : errors[i]?.message)),
              80,
            ),
          );
        const modelNow = now;
        const diagnostic = {
          format: 'SoloStartFailureV1',
          label: text(label, 80),
          timing: {
            wallElapsedMs: number(Number(hrtime.bigint() - wallStarted) / 1e6),
            modelStartedMs: number(modelStarted),
            modelNowMs: number(modelNow),
            modelElapsedMs: number(modelNow - modelStarted),
          },
          page: {
            hidden: flag(() => doc.hidden),
            focused: flag(() => doc.hasFocus()),
            activeId: text(read(() => doc.activeElement?.id)),
            flight: text(read(() => doc.body.dataset.flightState)),
            picture: text(read(() => doc.body.dataset.pictureState)),
            startHidden: flag(() => $('start-button').hidden),
            startDisabled: flag(() => $('start-button').disabled),
            overlayHidden: flag(() => $('game-overlay').hidden),
            overlayKind: text(read(() => $('game-overlay').dataset.kind)),
            openDialogs,
            dialogs,
            omittedDialogs: Math.max(0, openDialogs - dialogs.length),
          },
          preparation: {
            state: text(read(() => status.dataset.state)),
            stage: text(read(() => status.dataset.stage)),
            message: text(
              read(() => status.textContent),
              128,
            ),
          },
          run: {
            level: text(read(() => currentRun.levelId)),
            tick: number(read(() => currentRun.tick)),
            status: text(read(() => currentRun.status)),
            paused: flag(() => rendered.paused),
          },
          scene: {
            prepared: flag(() => scene.prepared()),
            preparedFrame: read(() => !!scene.preparedFrame),
            preparedCancel: read(() => !!scene.preparedCancel),
            framePending: flag(() => scene.framePending),
            pendingSubmission: flag(() => scene.pendingSubmission),
            displayedBoardValid: flag(() => scene.displayedBoardValid),
            revision: number(read(() => scene.revision)),
            preparedRevision: number(read(() => scene.preparedState?.revision)),
            paintRevision: number(read(() => scene.preparedState?.paintRevision)),
            preparedRunMatches: read(() => !!currentRun && scene.preparedState?.run === currentRun),
            lastPaintRunMatches: read(() => !!currentRun && scene.lastPaint?.run === currentRun),
            cadenceWaiting: flag(() => scene.cadence.waiting),
            cadenceReady: flag(() => scene.cadence.ready),
            cadenceSamples: number(read(() => scene.cadence.samples)),
          },
          errors: existingErrors,
          omittedErrors: Math.max(0, read(() => errors.length, 0) - existingErrors.length),
        };
        // Values are fixed scalars and bounded strings/arrays before encoding.
        // The cap is a final assertion of the diagnostic's own output envelope.
        const encoded = JSON.stringify(diagnostic);
        if (encoded.length <= 8192 && typeof error?.message === 'string') {
          // Materialize V8's lazy stack before changing its message header.
          void error.stack;
          error.message += `\n${encoded}`;
        }
      } catch {}
      throw error;
    }
  }
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
    submitRender,
    key,
    change,
    errors,
    audioElements,
    waitUntilRunning,
    get rendered() {
      return rendered;
    },
    get padReads() {
      return padReads;
    },
    get displayRender() {
      return {
        draws: displayDraws,
        clears: displayClears,
        clearBeforeRender: scene.game.renderer.config.clearBeforeRender,
        cameraVisible: scene.cameras.main.visible,
      };
    },
  };
}
