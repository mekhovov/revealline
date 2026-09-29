import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { buildAnalogNoiseAtlas, ANALOG_ATLAS } from '../../scripts/build-analog-noise-atlas.mjs';
import { MENU_SCENES, resolveMenuScene } from '../ui/menu-scene-catalog.mjs';
import { artworkMotionMode } from '../ui/menu-scene-motion.mjs';
import {
  attachMenuScene,
  getMenuAnimation,
  setMenuAnimation,
  MENU_ANIMATION_KEY,
} from '../ui/menu-scenes.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

function fixture(context = {}) {
  const doc = new Document();
  const win = new Events();
  win.CustomEvent = class extends Event {
    constructor(type, options) {
      super(type);
      this.detail = options.detail;
    }
  };
  win.getComputedStyle = doc.defaultView.getComputedStyle;
  const values = new Map();
  win.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const reduced = Object.assign(new Events(), { matches: false });
  const portrait = Object.assign(new Events(), { matches: false });
  win.matchMedia = (query) => (query.includes('reduced-motion') ? reduced : portrait);
  let observer, resizer;
  const observers = [];
  win.ResizeObserver = class {
    constructor(callback) {
      resizer = this;
      this.callback = callback;
    }
    observe() {}
    disconnect() {
      this.disconnected = true;
    }
  };
  win.MutationObserver = class {
    constructor(callback) {
      observer = this;
      this.callback = callback;
      this.observed = [];
      observers.push(this);
    }
    observe(target, options) {
      this.observed = this.observed.filter((entry) => entry.target !== target);
      this.observed.push({ target, options });
    }
    disconnect() {
      this.disconnected = true;
    }
  };
  doc.defaultView = win;
  const root = doc.createElement('section');
  root.prepend = (...children) => {
    const previous = [...root.children];
    root.append(...children);
    root.children = [...children, ...previous];
  };
  doc.body.append(root);
  const menu = doc.createElement('button');
  root.append(menu);
  const renderers = [],
    receivers = [];
  const createMotion = (options) => {
    const renderer = {
      options,
      updates: [],
      runs: [],
      disposed: 0,
      ready(value) {
        options.canvas.hidden = !value;
        options.onReady(value);
      },
      update(value) {
        assert.equal(this.disposed, 0, 'A retired renderer cannot receive profile updates.');
        this.updates.push(value);
      },
      setRunning(value) {
        assert.equal(this.disposed, 0, 'A retired renderer cannot restart.');
        this.runs.push(value);
      },
      dispose() {
        this.disposed++;
        options.canvas.hidden = true;
        options.onReady(false);
      },
    };
    renderers.push(renderer);
    renderer.ready(false);
    return renderer;
  };
  const createSignalLoss = (options) => {
    const receiver = {
      options,
      runs: [],
      resets: 0,
      disposed: 0,
      setRunning(value) {
        assert.equal(this.disposed, 0, 'A disposed receiver cannot restart.');
        this.runs.push(value);
      },
      reset() {
        assert.equal(this.disposed, 0, 'A disposed receiver cannot reset.');
        this.resets++;
      },
      dispose() {
        this.disposed++;
      },
    };
    receivers.push(receiver);
    return receiver;
  };
  const api = attachMenuScene({
    root,
    mode: 'solo',
    getContext: () => context,
    createMotion,
    createSignalLoss,
  });
  const scene = root.children[0];
  return {
    doc,
    win,
    root,
    menu,
    api,
    context,
    reduced,
    portrait,
    observer,
    resizer,
    mutate(target, attributeName) {
      for (const watcher of observers) {
        if (watcher.disconnected) continue;
        const observed = watcher.observed.some((entry) => {
          let within = target === entry.target;
          if (entry.options.subtree)
            for (let node = target; node; node = node.parentNode)
              if (node === entry.target) within = true;
          return (
            within &&
            entry.options.attributes &&
            (!entry.options.attributeFilter ||
              entry.options.attributeFilter.includes(attributeName))
          );
        });
        if (observed) watcher.callback([{ target, attributeName, type: 'attributes' }]);
      }
    },
    scene,
    renderers,
    receivers,
    get receiver() {
      return receivers.at(-1);
    },
    get renderer() {
      return renderers.at(-1);
    },
    load(width = 960, height = 540) {
      const image = scene.querySelector('.menu-scene-art');
      image.naturalWidth = width;
      image.naturalHeight = height;
      image.complete = true;
      image.emit('load');
    },
  };
}

test('all 18 themes resolve explicitly, company mapping works, unknown IDs safely fall back', () => {
  assert.equal(Object.keys(MENU_SCENES).length, 18);
  for (const id of Object.keys(MENU_SCENES))
    assert.equal(resolveMenuScene({ themeId: id, editionId: 'coupa-operations' }).id, id);
  assert.equal(
    resolveMenuScene({ editionId: 'coupa-operations' }).id,
    'coupa-product-operations-theme',
  );
  assert.equal(
    resolveMenuScene({ editionId: 'droneaid-nl-shared-horizon' }).id,
    'droneaid-nl-shared-horizon-theme',
  );
  assert.equal(resolveMenuScene({ themeId: '__proto__', editionId: 'constructor' }).id, 'fpv');
  assert.equal(resolveMenuScene({ themeId: '../../private.png' }).id, 'fpv');
});

test('every scene retains bounded artwork anchors and one shared image/canvas plane without moving stickers', () => {
  const f = fixture();
  const plane = f.scene.querySelector('.menu-scene-art-plane');
  const image = f.scene.querySelector('.menu-scene-art');
  const canvas = f.scene.querySelector('canvas');
  const reception = f.scene.querySelector('.menu-scene-reception');
  const signal = f.scene.querySelector('.menu-scene-signal');
  assert.deepEqual(f.scene.children, [plane, signal]);
  assert.deepEqual(plane.children, [image, canvas, reception]);
  assert.equal(image.alt, '');
  assert.equal(image.draggable, false);
  for (const profile of Object.values(MENU_SCENES)) {
    for (const vertical of [false, true]) {
      f.context.themeId = profile.id;
      f.portrait.matches = vertical;
      f.api.update();
      f.load(vertical ? 540 : 960, vertical ? 960 : 540);
      const layers = vertical ? profile.portraitEnvironment : profile.environment;
      if (profile.id === 'droneaid-nl-community') {
        assert.deepEqual(layers, [], 'The supplied photograph has no authored motion regions.');
        assert.equal(artworkMotionMode(profile, vertical), 'static');
      } else {
        assert.ok(layers.length > 0, `${profile.id} needs intentional environment motion`);
        assert.equal(artworkMotionMode(profile, vertical), 'regions');
      }
      assert.ok(Object.isFrozen(layers));
      for (const layer of layers) {
        assert.ok(Object.isFrozen(layer));
        assert.ok(layer.width > 0 && layer.height > 0);
        assert.ok(layer.x >= 0 && layer.x + layer.width <= 100);
        assert.ok(layer.y >= 0 && layer.y + layer.height <= 100);
        assert.ok(layer.duration > 0);
      }
      assert.equal(f.scene.querySelector('.menu-scene-art'), image);
      assert.equal(f.scene.querySelector('canvas'), canvas);
      assert.equal(f.scene.querySelector('.menu-scene-reception'), reception);
      assert.deepEqual(f.scene.querySelectorAll('img'), [image]);
      assert.equal(
        image.src,
        new URL(
          vertical ? profile.portrait : profile.landscape,
          new URL('../ui/menu-scenes.mjs', import.meta.url),
        ).href,
      );
      for (const name of ['environment', 'haze', 'glow', 'particles', 'actors', 'cloud-art'])
        assert.equal(f.scene.querySelector(`.menu-scene-${name}`), null);
      assert.equal(f.renderer.options.image, image);
      assert.equal(f.renderer.options.canvas, canvas);
      const selected = f.renderer.updates.at(-1) ?? f.renderer.options;
      assert.equal(selected.profile, profile);
      assert.equal(selected.vertical, vertical);
    }
  }
  f.api.dispose();
});

test('every landing has restrained signal styling, with all drone and technical scenes stronger', () => {
  const technical = new Set([
    'fpv',
    'retro',
    'coupa-developer-integration-theme',
    'droneaid-community',
    'droneaid-nl-community',
    'droneaid-nl-workshop-lights-theme',
    'droneaid-nl-parts-in-motion-theme',
    'droneaid-nl-makers-together-theme',
    'droneaid-nl-careful-handoff-theme',
    'droneaid-nl-signals-of-support-theme',
    'droneaid-nl-shared-horizon-theme',
  ]);
  const f = fixture({ themeId: 'ukraine' });
  f.menu.focus();
  const signal = f.scene.querySelector('.menu-scene-signal');
  assert.equal(signal.className, 'menu-scene-signal');
  for (const profile of Object.values(MENU_SCENES)) {
    f.context.themeId = profile.id;
    f.api.update();
    assert.equal(profile.signalOpacity, technical.has(profile.id) ? 0.05 : 0.03);
    assert.equal(profile.signalPeakOpacity, technical.has(profile.id) ? 0.12 : 0.06);
    assert.equal(f.scene.style['--scene-signal-opacity'], String(profile.signalOpacity));
    assert.equal(f.scene.style['--scene-signal-peak'], String(profile.signalPeakOpacity));
    assert.equal(
      f.scene.querySelector('.menu-scene-signal'),
      signal,
      'Profile changes reuse the same decorative layer.',
    );
    assert.equal(f.doc.activeElement, f.menu);
  }
  f.api.dispose();
});

test('the CSS noise atlas is reproducible, small, opaque monochrome and contains four distinct frames', async () => {
  const bytes = await readFile(
    new URL('../ui/art/menu-scenes/analog-noise-atlas.png', import.meta.url),
  );
  assert.deepEqual(bytes, buildAnalogNoiseAtlas());
  assert.ok(bytes.length < 256 * 1024);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const width = bytes.readUInt32BE(16),
    height = bytes.readUInt32BE(20),
    compressed = [];
  assert.equal(width, ANALOG_ATLAS.frameWidth * 4);
  assert.equal(height, ANALOG_ATLAS.height);
  for (let offset = 8; offset < bytes.length; ) {
    const length = bytes.readUInt32BE(offset),
      type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') compressed.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const pixels = inflateSync(Buffer.concat(compressed)),
    hashes = [];
  assert.equal(pixels.length, (width * 4 + 1) * height);
  for (let frame = 0; frame < 4; frame++) {
    const hash = createHash('sha256');
    let mean = 0;
    for (let y = 0; y < height; y++) {
      const row = y * (width * 4 + 1);
      assert.equal(pixels[row], 0);
      const part = pixels.subarray(
        row + 1 + frame * ANALOG_ATLAS.frameWidth * 4,
        row + 1 + (frame + 1) * ANALOG_ATLAS.frameWidth * 4,
      );
      hash.update(part);
      for (let index = 0; index < part.length; index += 4) {
        assert.equal(part[index], part[index + 1]);
        assert.equal(part[index], part[index + 2]);
        assert.equal(part[index + 3], 255);
        mean += part[index];
      }
    }
    assert.ok(Math.abs(mean / (ANALOG_ATLAS.frameWidth * height) - 128) < 3);
    hashes.push(hash.digest('hex'));
  }
  assert.equal(new Set(hashes).size, 4);
});

test('scene files and provenance exist, match checksums and stay below 2 MiB per active scene', async () => {
  const folder = new URL('../ui/art/menu-scenes/', import.meta.url);
  const ledger = JSON.parse(await readFile(new URL('provenance.json', folder), 'utf8'));
  const assets = new Map(ledger.assets.map((asset) => [asset.file, asset]));
  assert.equal(
    new Set(
      Object.values(MENU_SCENES).map(
        (scene) => assets.get(scene.landscape.split('/').at(-1)).sha256,
      ),
    ).size,
    18,
    'Each theme, including both aggregate overviews, has its own distinct composition.',
  );
  for (const scene of Object.values(MENU_SCENES)) {
    for (const path of [scene.landscape, scene.portrait]) {
      const file = path.split('/').at(-1),
        asset = assets.get(file);
      assert.ok(asset, path);
      const bytes = await readFile(new URL(file, folder));
      assert.equal(bytes.length, asset.bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
      assert.ok(bytes.length < 2 * 1024 * 1024);
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    }
  }
});

test('DroneAid lossless runtime derivative retains the exact supplied original and pixel provenance', async () => {
  const profile = MENU_SCENES['droneaid-nl-community'];
  const path = './art/menu-scenes/droneaid-main-background.webp';
  assert.equal(profile.landscape, path);
  assert.equal(profile.portrait, path);
  assert.equal(resolveMenuScene({ editionId: 'droneaid-nl-community' }), profile);
  const source = 'authoring/library/droneaid-brand-kit-2026-09-29/background-original.png';
  const [original, retained, runtime, ledgerText, assetText] = await Promise.all([
    readFile(new URL(`../../${source}`, import.meta.url)),
    readFile(new URL('../ui/art/menu-scenes/droneaid-main-background.png', import.meta.url)),
    readFile(new URL(`../ui/${path}`, import.meta.url)),
    readFile(new URL('../ui/art/menu-scenes/provenance.json', import.meta.url), 'utf8'),
    readFile(new URL('../editions/runtime-assets.json', import.meta.url), 'utf8'),
  ]);
  assert.deepEqual(retained, original, 'Both supplied PNG originals remain byte-identical.');
  assert.equal(original.length, 880307);
  const hash = createHash('sha256').update(original).digest('hex');
  assert.equal(hash, '836c883d4eee658aab610f113eb4fec34f40ed1c963b4a759c52ec37990a8515');
  assert.equal(original.readUInt32BE(16), 2000);
  assert.equal(original.readUInt32BE(20), 1545);
  assert.equal(runtime.toString('ascii', 8, 12), 'WEBP');
  assert.equal(runtime.toString('ascii', 12, 16), 'VP8L', 'The runtime encoding must be lossless.');
  assert.equal(runtime[20], 0x2f);
  const dimensions = runtime.readUInt32LE(21);
  assert.equal((dimensions & 0x3fff) + 1, 2000);
  assert.equal(((dimensions >>> 14) & 0x3fff) + 1, 1545);
  assert.equal(runtime.length, 493598);
  const runtimeHash = createHash('sha256').update(runtime).digest('hex');
  assert.equal(runtimeHash, '378741b03c221c08ead77ee4af8f0a65a7d2b15088363898bfb8b79dfebc6000');
  const record = JSON.parse(ledgerText).assets.find((asset) => asset.id === profile.id);
  assert.equal(record.source, source);
  assert.equal(record.sourceSha256, hash);
  assert.equal(record.sha256, runtimeHash);
  assert.equal(record.bytes, runtime.length);
  assert.equal(record.width, 2000);
  assert.equal(record.height, 1545);
  assert.equal(record.process, 'WebP lossless; decoded RGBA verified identical');
  assert.match(record.decodedRgbaSha256, /^[0-9a-f]{64}$/);
  const admitted = JSON.parse(assetText).find((asset) => asset.path === `game/ui/${path.slice(2)}`);
  assert.equal(admitted.sha256, runtimeHash);
  assert.equal(admitted.bytes, runtime.length);
});

test('DroneAid photograph keeps a full static source in both orientations and WebGL fallback', () => {
  const f = fixture({ editionId: 'droneaid-nl-community' });
  const image = f.scene.querySelector('.menu-scene-art');
  const source = image.src;
  for (const vertical of [false, true]) {
    f.portrait.matches = vertical;
    f.portrait.emit('change');
    f.load(2000, 1545);
    const selected = f.renderer.updates.at(-1) ?? f.renderer.options;
    assert.equal(artworkMotionMode(selected.profile, selected.vertical), 'static');
    assert.equal(selected.vertical, vertical);
    assert.equal(image.src, source);
    for (const ready of [true, false]) {
      f.renderer.ready(ready);
      assert.equal(f.scene.dataset.renderer, ready ? 'webgl' : 'css');
      assert.equal(image.hidden, false, 'The original image remains the intact fallback.');
      const draws = [];
      assert.equal(
        f.receiver.options.drawSource({ drawImage: (...args) => draws.push(args) }, 400, 309),
        true,
      );
      assert.deepEqual(draws, [[image, 0, 0, 2000, 1545, 0, 0, 400, 309]]);
    }
  }
  f.api.dispose();
});

test('Solo, Versus and Team changes preserve focus, the artwork source and a single renderer', () => {
  const f = fixture({ themeId: 'retro' });
  f.menu.focus();
  f.load();
  f.renderer.ready(true);
  const image = f.scene.querySelector('.menu-scene-art'),
    canvas = f.scene.querySelector('canvas'),
    initial = f.renderer;
  const source = image.src;
  const receiver = f.receiver,
    initialResets = receiver.resets;
  let assignedSource = source,
    assignments = 0;
  Object.defineProperty(image, 'src', {
    configurable: true,
    get: () => assignedSource,
    set: (value) => {
      assignments++;
      assignedSource = value;
    },
  });
  for (const mode of ['versus', 'team', 'solo']) {
    f.context.mode = mode;
    f.api.update();
    assert.equal(f.root.dataset.menuMode, mode);
    assert.equal(f.scene.querySelector('.menu-scene-art'), image);
    assert.equal(image.src, source);
    assert.equal(f.scene.querySelector('canvas'), canvas);
    assert.equal(f.renderer, initial);
    assert.equal(f.receiver, receiver);
    assert.equal(receiver.resets, initialResets);
    assert.equal(f.renderers.length, 1);
    assert.equal(f.scene.querySelector('.menu-scene-actors'), null);
    assert.equal(assignments, 0, 'Changing seat mode does not request the artwork again.');
    assert.equal(f.doc.activeElement, f.menu);
  }
  assert.equal(f.scene.getAttribute('aria-hidden'), 'true');
  assert.equal(f.scene.getAttribute('inert'), '');
  f.context.themeId = 'ukraine';
  f.doc.emit('change');
  assert.equal(f.root.dataset.menuScene, 'ukraine');
  assert.equal(f.doc.activeElement, f.menu);
  f.api.dispose();
});

test('a ready decoded image creates one renderer and handoff follows its readiness without taking focus', () => {
  const f = fixture({ themeId: 'fpv' });
  f.menu.focus();
  const image = f.scene.querySelector('.menu-scene-art'),
    canvas = f.scene.querySelector('canvas');
  assert.equal(f.renderers.length, 0, 'Loading artwork does not allocate a renderer early.');
  assert.equal(f.receivers.length, 0, 'Loading artwork does not allocate signal processing early.');
  assert.equal(f.scene.dataset.loaded, 'false');
  assert.equal(f.scene.dataset.renderer, 'css');
  assert.equal(canvas.hidden, true);
  f.api.update();
  assert.equal(f.renderers.length, 0);
  f.load();
  const owner = f.renderer;
  assert.equal(f.renderers.length, 1);
  assert.equal(owner.options.image, image);
  assert.equal(owner.options.canvas, canvas);
  assert.equal(owner.options.profile, MENU_SCENES.fpv);
  assert.equal(owner.options.vertical, false);
  assert.equal(
    f.scene.dataset.renderer,
    'css',
    'The still image is the fallback until the first rendered frame.',
  );
  owner.ready(true);
  assert.equal(f.scene.dataset.renderer, 'webgl');
  assert.equal(canvas.hidden, false);
  f.load();
  f.api.update();
  assert.equal(f.renderers.length, 1, 'Repeated load/update notifications reuse the renderer.');
  owner.ready(false);
  assert.equal(
    f.scene.dataset.renderer,
    'css',
    'A renderer failure returns to the original image.',
  );
  assert.equal(canvas.hidden, true);
  assert.equal(image.hidden, false);
  assert.equal(f.doc.activeElement, f.menu);

  f.portrait.matches = true;
  f.portrait.emit('change');
  assert.equal(f.scene.dataset.loaded, 'false');
  assert.equal(
    owner.runs.at(-1),
    false,
    'A replacement source cannot continue using the previous loaded flag.',
  );
  assert.equal(owner.updates.at(-1).vertical, true);
  f.load(540, 960);
  owner.ready(true);
  assert.equal(f.renderers.length, 1);
  assert.equal(owner.runs.at(-1), true);
  f.api.dispose();
  const rendererState = f.scene.dataset.renderer,
    calls = owner.runs.length;
  owner.options.onReady(true);
  f.api.update();
  image.emit('load');
  f.doc.emit('change');
  assert.equal(owner.runs.length, calls);
  assert.equal(
    f.scene.dataset.renderer,
    rendererState,
    'Late ready callbacks cannot change a disposed scene.',
  );
  assert.equal(owner.disposed, 1);
  assert.deepEqual(f.root.children, [f.menu]);
});

test('receiver interference samples the original artwork into its own canvas and keeps that source after handoff', () => {
  const f = fixture({ themeId: 'fpv' });
  const image = f.scene.querySelector('.menu-scene-art');
  const artworkCanvas = f.scene.querySelector('.menu-scene-art-motion');
  const receiverCanvas = f.scene.querySelector('.menu-scene-reception');
  assert.notEqual(receiverCanvas, artworkCanvas);
  assert.equal(receiverCanvas.hidden, true);
  f.load();
  const receiver = f.receiver;
  assert.equal(receiver.options.canvas, receiverCanvas);
  const captures = [];
  const context = { drawImage: (...args) => captures.push(args) };
  const capture = () => {
    const before = captures.length;
    receiver.options.drawSource(context, 320, 180);
    assert.equal(captures.length, before + 1);
    const [source, ...geometry] = captures.at(-1);
    assert.equal(source, image, 'Signal processing must not read back either output canvas.');
    assert.deepEqual(geometry.slice(-4), [0, 0, 320, 180]);
  };
  capture();
  f.renderer.ready(true);
  capture();
  f.context.themeId = 'ukraine';
  f.api.update();
  assert.equal(receiver.runs.at(-1), false);
  f.load();
  capture();
  assert.equal(f.receiver, receiver);
  assert.equal(f.receivers.length, 1);
  f.api.dispose();
});

test('receiver source generation resets on changed artwork but not mode, resize, pause or repeated load', () => {
  const f = fixture({ themeId: 'fpv' });
  f.load();
  const receiver = f.receiver;
  const initialResets = receiver.resets;
  const sameSourceUpdates = () => {
    f.context.mode = f.context.mode === 'team' ? 'solo' : 'team';
    f.api.update();
    f.api.update();
    f.resizer.callback();
    f.win.emit('resize');
    f.api.pause();
    f.api.resume();
    f.load();
  };
  sameSourceUpdates();
  assert.equal(receiver.resets, initialResets);
  f.portrait.matches = true;
  f.portrait.emit('change');
  assert.equal(receiver.resets, initialResets + 1);
  assert.equal(
    receiver.runs.at(-1),
    false,
    'New image bytes must load before signal bursts resume.',
  );
  f.load(540, 960);
  assert.equal(receiver.runs.at(-1), true);
  sameSourceUpdates();
  assert.equal(receiver.resets, initialResets + 1);
  f.context.themeId = 'ukraine';
  f.api.update();
  assert.equal(receiver.resets, initialResets + 2);
  f.load();
  assert.equal(f.receivers.length, 1);
  f.api.dispose();
  const runs = receiver.runs.length;
  const resets = receiver.resets;
  f.context.themeId = 'retro';
  f.api.update();
  f.api.resume();
  f.load();
  f.win.emit('pageshow');
  f.mutate(f.root, 'hidden');
  assert.equal(receiver.runs.length, runs);
  assert.equal(receiver.resets, resets);
  assert.equal(receiver.disposed, 1);
});

for (const gate of [
  'hidden',
  'pagehide',
  'reduced',
  'local-setting',
  'gameplay',
  'body-effects',
  'body-reduced-effects',
  'html-reduced-motion',
])
  test(`${gate} defers renderer creation until a loaded scene can actually animate`, () => {
    const f = fixture({ active: true });
    if (gate === 'hidden') {
      f.doc.hidden = true;
      f.doc.emit('visibilitychange');
    }
    if (gate === 'pagehide') f.win.emit('pagehide');
    if (gate === 'reduced') {
      f.reduced.matches = true;
      f.reduced.emit('change');
    }
    if (gate === 'local-setting') setMenuAnimation(false, f.win);
    if (gate === 'gameplay') {
      f.context.active = false;
      f.api.update();
    }
    if (gate === 'body-effects') {
      f.doc.body.dataset.effects = 'reduced';
      f.mutate(f.doc.body, 'data-effects');
    }
    if (gate === 'body-reduced-effects') {
      f.doc.body.dataset.reducedEffects = 'true';
      f.mutate(f.doc.body, 'data-reduced-effects');
    }
    if (gate === 'html-reduced-motion') {
      f.doc.documentElement.dataset.reducedMotion = 'true';
      f.mutate(f.doc.documentElement, 'data-reduced-motion');
    }
    f.load();
    assert.equal(f.scene.dataset.loaded, 'true');
    assert.equal(f.renderers.length, 0);
    assert.equal(f.receivers.length, 0);
    f.doc.hidden = false;
    f.reduced.matches = false;
    f.context.active = true;
    f.doc.body.dataset.effects = 'full';
    f.doc.body.dataset.reducedEffects = 'false';
    f.doc.documentElement.dataset.reducedMotion = 'false';
    setMenuAnimation(true, f.win);
    f.win.emit('pageshow');
    f.api.update();
    assert.equal(f.renderers.length, 1);
    assert.equal(f.receivers.length, 1);
    assert.equal(f.renderer.runs.at(-1), true);
    assert.equal(f.receiver.runs.at(-1), true);
    f.api.dispose();
    assert.equal(f.renderer.disposed, 1);
    assert.equal(f.receiver.disposed, 1);
  });

test('reduced motion, local setting, hidden menu, gameplay and background tab stop ambient motion', () => {
  const f = fixture({ active: true });
  f.load();
  f.renderer.ready(true);
  const running = () => {
    const value = f.renderer.runs.at(-1);
    assert.equal(
      f.receiver.runs.at(-1),
      value,
      'Artwork and receiver share the same eligibility gates.',
    );
    return value;
  };
  assert.equal(f.scene.dataset.running, 'true');
  assert.equal(running(), true);
  f.reduced.matches = true;
  f.reduced.emit('change');
  assert.equal(f.scene.dataset.motion, 'off');
  assert.equal(running(), false);
  f.reduced.matches = false;
  f.reduced.emit('change');
  setMenuAnimation(false, f.win);
  assert.equal(getMenuAnimation(f.win), false);
  assert.equal(f.scene.dataset.motion, 'off');
  assert.equal(running(), false);
  setMenuAnimation(true, f.win);
  assert.equal(f.scene.dataset.motion, 'on');
  assert.equal(running(), true);
  f.root.hidden = true;
  f.mutate(f.root, 'hidden');
  assert.equal(f.scene.dataset.running, 'false');
  assert.equal(running(), false);
  f.root.hidden = false;
  f.context.active = false;
  f.api.update();
  assert.equal(f.scene.dataset.running, 'false');
  assert.equal(running(), false);
  f.context.active = true;
  f.doc.hidden = true;
  f.doc.emit('visibilitychange');
  assert.equal(f.scene.dataset.running, 'false');
  assert.equal(running(), false);
  f.doc.hidden = false;
  f.doc.emit('visibilitychange');
  assert.equal(f.scene.dataset.running, 'true');
  assert.equal(running(), true);
  f.api.pause();
  assert.equal(f.scene.dataset.running, 'false');
  assert.equal(running(), false);
  f.api.resume();
  assert.equal(f.scene.dataset.running, 'true');
  assert.equal(running(), true);
  f.api.dispose();
});

test('portrait selection, error fallback and cleanup never replace interactive content', () => {
  const f = fixture({ themeId: 'fpv' });
  const image = f.scene.querySelector('.menu-scene-art');
  assert.ok(image.src.endsWith('/fpv.webp'));
  f.portrait.matches = true;
  f.portrait.emit('change');
  assert.ok(image.src.endsWith('/fpv-portrait.webp'));
  f.load(540, 960);
  assert.equal(f.scene.dataset.loaded, 'true');
  image.emit('error');
  assert.equal(f.scene.dataset.loaded, 'false');
  assert.equal(f.renderer.runs.at(-1), false);
  assert.equal(f.receiver.runs.at(-1), false);
  assert.ok(f.root.children.includes(f.menu));
  f.api.dispose();
  f.api.dispose();
  assert.equal(f.renderer.disposed, 1);
  assert.equal(f.receiver.disposed, 1);
  assert.deepEqual(f.root.children, [f.menu]);
  assert.equal(f.observer.disconnected, true);
  assert.equal(f.resizer.disconnected, true);
  assert.equal(f.root.getAttribute('data-menu-scene'), null);
  assert.equal(f.win.listeners.get('storage').size, 0);
});

test('visible decoration keeps moving without keyboard focus, but stops while hidden or suspended', () => {
  const f = fixture({ active: true });
  f.load();
  f.renderer.ready(true);
  f.doc.hasFocus = () => false;
  f.win.emit('blur');
  f.api.update();
  assert.equal(
    f.scene.dataset.running,
    'true',
    'Visible split panes and address-bar focus keep scenery alive.',
  );
  assert.equal(f.renderer.runs.at(-1), true);
  f.win.emit('pagehide');
  assert.equal(f.scene.dataset.running, 'false');
  assert.equal(f.renderer.runs.at(-1), false);
  f.win.emit('pageshow');
  assert.equal(f.scene.dataset.running, 'true');
  assert.equal(f.renderer.runs.at(-1), true);
  f.doc.hidden = true;
  f.doc.emit('visibilitychange');
  assert.equal(f.scene.dataset.running, 'false');
  assert.equal(f.renderer.runs.at(-1), false);
  f.doc.hidden = false;
  f.doc.emit('visibilitychange');
  assert.equal(f.scene.dataset.running, 'true');
  assert.equal(f.renderer.runs.at(-1), true);
  f.api.dispose();
  assert.equal(f.win.listeners.get('pagehide').size, 0);
  assert.equal(f.win.listeners.get('resize').size, 0);
});

test('a sibling settings dialog pauses the actual visible landing owner and closes without recreating it', () => {
  const f = fixture({ active: true });
  f.load();
  f.renderer.ready(true);
  const renderer = f.renderer;
  assert.equal(renderer.runs.at(-1), true);
  const settings = f.doc.createElement('dialog');
  settings.id = 'coop-options';
  f.doc.body.append(settings);
  settings.showModal();
  f.mutate(settings, 'open');
  assert.equal(f.root.hidden, false, 'The covered landing remains mounted and visible.');
  assert.equal(
    renderer.runs.at(-1),
    false,
    'Sibling modal visibility must reach the motion owner.',
  );
  assert.equal(f.receiver.runs.at(-1), false, 'Signal bursts also stop behind settings.');
  settings.close();
  f.mutate(settings, 'open');
  assert.equal(renderer.runs.at(-1), true);
  assert.equal(f.receiver.runs.at(-1), true);
  assert.equal(f.renderer, renderer);
  assert.equal(f.renderers.length, 1);
  f.api.dispose();
});

test('the image/canvas plane stays registered to original artwork through cover crops and orientation changes', () => {
  const f = fixture({ themeId: 'fpv' });
  let bounds = { width: 1280, height: 800 };
  f.scene.getBoundingClientRect = () => bounds;
  const plane = f.scene.querySelector('.menu-scene-art-plane');
  const image = f.scene.querySelector('.menu-scene-art');
  image.naturalWidth = 960;
  image.naturalHeight = 540;
  image.emit('load');
  assert.ok(Math.abs(parseFloat(plane.style.width) - 1422.2222) < 0.001);
  assert.equal(plane.style.height, '800px');
  assert.ok(Math.abs(parseFloat(plane.style.left) + 96.7111) < 0.001);
  bounds = { width: 390, height: 844 };
  f.portrait.matches = true;
  f.portrait.emit('change');
  image.naturalWidth = 540;
  image.naturalHeight = 960;
  image.emit('load');
  assert.equal(plane.style.width, '474.75px');
  assert.equal(plane.style.height, '844px');
  assert.equal(plane.style.left, '-42.375px');
  assert.equal(plane.style.top, '0px');
  bounds = { width: 540, height: 960 };
  f.resizer.callback();
  assert.equal(plane.style.left, '0px');
  assert.equal(plane.style.width, '540px');
  f.api.dispose();
});

test('storage denial retains current-page preference and cross-tab updates are applied', () => {
  const f = fixture();
  f.win.localStorage = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('denied');
    },
  };
  setMenuAnimation(false, f.win);
  assert.equal(getMenuAnimation(f.win), false);
  assert.equal(f.scene.dataset.motion, 'off');
  f.win.localStorage = { getItem: () => 'on' };
  f.win.emit('storage', { key: MENU_ANIMATION_KEY });
  assert.equal(f.scene.dataset.motion, 'on');
  f.api.dispose();
});
