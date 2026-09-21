import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { emptyLibrary, updatePreferences } from '../library.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';

// Actual application/core/renderer and immutable source bytes. Canvas commands,
// browser images, FontFace and bitmap decoding are finite boundaries, not pixels.
function rendering() {
  const contexts = new WeakMap(),
    requested = [],
    held = [];
  let frame,
    hold = false,
    heldURL = null;
  class Image {
    removed = 0;
    set src(value) {
      this.source = value;
      if (!value) return;
      const bytes = value.startsWith('data:') ? null : readFileSync(new URL(value));
      const header = bytes
        ? {
            valid: bytes.toString('ascii', 1, 4) === 'PNG',
            width: bytes.readUInt32BE(16),
            height: bytes.readUInt32BE(20),
          }
        : inspectImageDataUrl(value);
      assert.equal(header.valid, true);
      this.width = this.naturalWidth = header.width;
      this.height = this.naturalHeight = header.height;
      requested.push(this);
      if (hold && value === heldURL) {
        held.push(this);
      } else queueMicrotask(() => this.onload?.());
    }
    get src() {
      return this.source;
    }
    async decode() {}
    removeAttribute() {
      this.source = '';
      this.removed++;
    }
  }
  return {
    Image,
    displayCSSWidth: 600,
    requested,
    held,
    holdSource(source) {
      assert.ok(source && !source.startsWith('data:'), 'Hold the exact selected source PNG.');
      heldURL = source;
      hold = true;
    },
    release() {
      hold = false;
      heldURL = null;
      for (const image of held.splice(0)) image.onload?.();
    },
    contextFor(canvas) {
      if (contexts.has(canvas)) return contexts.get(canvas);
      const calls = [],
        values = {},
        stack = [];
      const context = new Proxy(
        { canvas, calls },
        {
          get(target, key) {
            if (key in target) return target[key];
            if (key in values) return values[key];
            return (...args) => {
              if (key === 'clearRect') calls.length = 0;
              calls.push({ op: key, args });
              if (key === 'save') stack.push({ ...values });
              if (key === 'restore') Object.assign(values, stack.pop());
            };
          },
          set(_target, key, value) {
            values[key] = value;
            return true;
          },
        },
      );
      contexts.set(canvas, context);
      return context;
    },
    onDraw(value) {
      frame = value;
    },
    get frame() {
      return frame;
    },
  };
}

function releaseCodec(t) {
  const before = Object.fromEntries(
    ['createImageBitmap', 'FontFace'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const decoded = [];
  globalThis.createImageBitmap = async (blob) => {
    assert.ok(
      blob instanceof Blob,
      'Current approved full-frame sprites do not require crop substitution.',
    );
    const bytes = Buffer.from(await blob.arrayBuffer());
    assert.equal(bytes.toString('ascii', 1, 4), 'PNG');
    const image = {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
      closes: 0,
      close() {
        this.closes++;
      },
    };
    decoded.push(image);
    return image;
  };
  globalThis.FontFace = class {
    constructor(family) {
      this.family = family;
    }
    async load() {
      return this;
    }
  };
  t.after(() => {
    for (const [key, descriptor] of Object.entries(before))
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
  });
  return decoded;
}

const fetched = async (path) => {
  const text = String(path);
  if (text.includes('/content-design/assets/')) return new Response(await readFile(path));
  const url = new URL(text, 'http://localhost/game/');
  if (url.pathname.startsWith('/game/presentation/compiled/')) {
    const relative = url.pathname.slice('/game/'.length);
    return new Response(await readFile(new URL('../' + relative, import.meta.url)));
  }
};
const running = (p, id) =>
  settle(() => {
    p.frame(0);
    return p.doc.body.dataset.flightState === 'running' && p.rendered.run.levelId === id;
  });
function earnDown(p, limit = 1000) {
  p.key('ArrowDown');
  p.key('ArrowDown', false);
  for (let tick = 0; tick < limit && p.rendered.run.status !== 'won'; tick++) p.frame();
  assert.equal(p.rendered.run.status, 'won', 'Only actual command-earned victory authorizes Next.');
  if (!p.$('skip-celebration').hidden) p.$('skip-celebration').click();
  if (!p.$('show-result').hidden) p.$('show-result').click();
  p.frame(0);
  assert.equal(p.$('game-overlay').dataset.kind, 'won');
}
const drawn = (surface, image) =>
  surface.frame.context.calls.some((call) => call.op === 'drawImage' && call.args[0] === image);
const report = (t, row) => t.diagnostic(JSON.stringify(row));

const retroURL = new URL('../../authoring/motion-lab/assets/retro-craft.png', import.meta.url).href;
async function journey(t, { hold = false, turnPolicy = 'immediate' } = {}) {
  const surface = rendering();
  t.after(() => surface.release());
  releaseCodec(t);
  if (hold) surface.holdSource(retroURL);
  const storage = memoryStorage();
  if (turnPolicy !== 'immediate')
    storage.setItem(
      'revealline.library.dev.v1',
      JSON.stringify(updatePreferences(emptyLibrary(), { turnPolicy })),
    );
  const p = await soloPage(t, {
    search: '?journey=opening',
    titleScreen: true,
    storage,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    rendering: surface,
    pictures: { Image: surface.Image },
    fetchResponse: fetched,
  });
  return { p, surface };
}
function unchanged(p, surface, owner) {
  p.frame(0);
  assert.equal(p.rendered.run, owner.run);
  assert.equal(p.rendered.backdrop, owner.picture);
  assert.equal(authoritativeCheckpoint(owner.run).hash, owner.checkpoint);
  assert.equal(owner.picture.image.removed, 0);
  assert.notEqual(p.doc.body.dataset.flightState, 'running');
  assert.ok(drawn(surface, owner.picture.image));
}
async function pendingStart(p, surface) {
  const owner = {
    run: p.rendered.run,
    picture: p.rendered.backdrop,
    checkpoint: authoritativeCheckpoint(p.rendered.run).hash,
  };
  const requests = surface.held.length;
  assert.ok(requests > 0, 'The genuine initial renderer request is deliberately unresolved.');
  assert.equal(p.$('shell-featured').hidden, false);
  p.$('shell-featured').click();
  await settle(
    () => surface.held.length > requests,
    'The staged initial attempt requests its own required craft.',
  );
  for (let tick = 0; tick < 24; tick++) p.frame();
  unchanged(p, surface, owner);
  assert.equal(p.$('flight-preparation-cancel').hidden, false);
  assert.match(p.$('flight-preparation-status').textContent, /selected craft/);
  return { owner, image: surface.held.at(-1) };
}
async function restartFeatured(p) {
  if (!p.$('shell-home').open) p.$('shell-menu').click();
  assert.equal(p.$('shell-home').open, true);
  assert.equal(p.$('shell-featured').hidden, false);
  p.$('shell-featured').click();
  await running(p, 'first-return');
}

test('same-source authored Next reuses the decoded craft through command-earned victory', async (t) => {
  const { p, surface } = await journey(t);
  await settle(() => !!surface.frame.painter.image);
  p.$('shell-featured').click();
  await running(p, 'first-return');
  const craft = surface.frame.painter.image;
  assert.match(craft.src, /retro-craft.png$/);
  assert.ok(drawn(surface, craft));
  earnDown(p);
  const previous = p.rendered.run,
    original = p.rendered.backdrop;
  const checkpoint = authoritativeCheckpoint(previous).hash;
  surface.holdSource(craft.src);
  const requested = surface.requested.length;
  p.$('next-button').click();
  await running(p, 'choose-your-share');
  assert.notEqual(p.rendered.run, previous);
  assert.notEqual(p.rendered.backdrop, original);
  assert.equal(original.image.removed, 1);
  assert.equal(authoritativeCheckpoint(previous).hash, checkpoint);
  assert.equal(surface.frame.painter.image, craft);
  assert.equal(craft.removed, 0);
  assert.equal(surface.held.length, 0, 'No redundant request for the ready required source.');
  assert.equal(
    surface.requested.slice(requested).filter((image) => image.src === craft.src).length,
    0,
  );
  for (let tick = 0; tick < 24; tick++) p.frame();
  assert.equal(p.rendered.run.tick, 24);
  assert.ok(drawn(surface, craft));
  assert.ok(drawn(surface, p.rendered.backdrop.image));
  assert.equal(p.$('flight-preparation-cancel').hidden, true);
  assert.deepEqual(p.errors, []);
});

test('unresolved authored Start keeps the previous briefing; Cancel retires late pixels and a fresh action retries', async (t) => {
  const { p, surface } = await journey(t, { hold: true });
  const { owner, image } = await pendingStart(p, surface);
  const lateLoad = image.onload;
  p.$('flight-preparation-cancel').click();
  await settle(() => p.$('flight-preparation-status').dataset.state === 'cancelled');
  await settle(
    () => image.removed === 1,
    'The cancelled image owner settles and releases its source.',
  );
  await lateLoad();
  for (let tick = 0; tick < 24; tick++) p.frame();
  unchanged(p, surface, owner);
  surface.release();
  await settle(() => !!surface.frame.painter.image);
  await restartFeatured(p);
  assert.notEqual(p.rendered.run, owner.run);
  assert.equal(p.rendered.run.tick, 0);
  assert.ok(drawn(surface, surface.frame.painter.image));
  assert.notEqual(surface.frame.painter.image, image, 'The cancelled source is never adopted.');
  assert.deepEqual(p.errors, []);
});

test('required authored craft failure keeps the previous original and exposes recovery before deliberate retry', async (t) => {
  const { p, surface } = await journey(t, { hold: true });
  const { owner, image } = await pendingStart(p, surface);
  image.onerror(new Error('Finite source acquisition failure'));
  await settle(() => p.$('flight-preparation-status').dataset.state === 'error');
  unchanged(p, surface, owner);
  assert.equal(image.removed, 1);
  assert.match(
    p.$('flight-preparation-status').textContent,
    /could not be loaded|could not prepare/i,
  );
  assert.equal(p.$('picture-use-legacy').hidden, true);
  surface.release();
  await settle(() => !!surface.frame.painter.image);
  await restartFeatured(p);
  assert.notEqual(p.rendered.run, owner.run);
  assert.equal(p.rendered.run.tick, 0);
  assert.ok(drawn(surface, surface.frame.painter.image));
  assert.notEqual(surface.frame.painter.image, image);
  assert.deepEqual(p.errors, []);
});

test('ready compiled FPV legacy Next keeps drawing its approved sprite with source held', async (t) => {
  const surface = rendering(),
    decoded = releaseCodec(t);
  t.after(() => surface.release());
  const original = retryFixture('self-contact').level;
  const campaign = {
    version: 'xonix-campaign.v1',
    id: 'look-readiness-fixture',
    revision: '1',
    title: 'Look readiness fixture',
    themeId: 'fpv',
    classRecipes: JSON.parse(
      await readFile(new URL('../content/classes.json', import.meta.url), 'utf8'),
    ),
    levels: [0, 1].map((index) => ({
      ...original,
      id: `look-${index}`,
      name: `Look ${index}`,
      goal: { coverage: 0.1 },
      rules: { lives: 3 },
    })),
  };
  const p = await soloPage(t, {
    campaign,
    rendering: surface,
    pictures: { Image: surface.Image },
    fetchResponse: fetched,
  });
  await settle(
    () => !!surface.frame.painter.presentation,
    'The actual compiled host must return its decoded snapshot.',
  );
  const snapshot = surface.frame.painter.presentation;
  p.$('start-button').click();
  await running(p, 'look-0');
  p.frame(0);
  const sprite = snapshot.image('player.scout.detailed');
  assert.ok(sprite && decoded.includes(sprite.image));
  assert.ok(
    drawn(surface, sprite.image),
    `Expected actual compiled scout for ${surface.frame.painter.bodyId}.`,
  );
  earnDown(p);
  surface.holdSource(surface.frame.painter.image.src);
  p.$('next-button').click();
  try {
    await settle(() => surface.held.length > 0);
  } catch (error) {
    report(t, {
      fixtureBoundary: true,
      level: p.rendered.run.levelId,
      status: p.rendered.run.status,
      next: {
        text: p.$('next-button').textContent,
        disabled: p.$('next-button').disabled,
        hidden: p.$('next-button').hidden,
      },
      preparation: p.$('flight-preparation-status').textContent,
      overlay: p.$('game-overlay').dataset.kind,
      errors: p.errors.map(String),
      requested: surface.requested.map((i) => i.source?.slice(0, 160)),
    });
    throw error;
  }
  await running(p, 'look-1');
  const zero = p.rendered.run.tick;
  for (let tick = 0; tick < 24; tick++) p.frame();
  const observation = {
    case: 'ready-compiled-fpv',
    level: p.rendered.run.levelId,
    manifestSha256: snapshot.manifestSha256,
    assetId: sprite.asset.id,
    assetRevision: sprite.asset.revision,
    assetSha256: sprite.asset.file.sha256,
    compiledImageDrawn: drawn(surface, sprite.image),
    compiledImageStillOwned: sprite.image.closes === 0,
    heldSourceDrawn: drawn(surface, surface.held[0]),
    sourceImageBound: surface.frame.painter.image !== null,
    flightState: p.doc.body.dataset.flightState,
    tickBefore: zero,
    tickAfter: p.rendered.run.tick,
    craftStatus: p.$('craft-preparation-status').textContent,
  };
  report(t, observation);
  assert.equal(observation.compiledImageDrawn, true);
  assert.equal(observation.compiledImageStillOwned, true);
  assert.equal(observation.sourceImageBound, false);
  assert.equal(observation.heldSourceDrawn, false);
  assert.equal(observation.flightState, 'running');
  assert.ok(observation.tickAfter > observation.tickBefore);
  surface.release();
  assert.deepEqual(p.errors, []);
});

test('cancelled authored preparation cannot bypass required craft readiness through visible Start mission', async (t) => {
  const { p, surface } = await journey(t, { hold: true, turnPolicy: 'grid-center' });
  assert.equal(p.rendered.run.turnPolicy, 'grid-center');
  const { owner } = await pendingStart(p, surface);
  p.$('flight-preparation-cancel').click();
  await settle(() => p.$('flight-preparation-status').dataset.state === 'cancelled');
  unchanged(p, surface, owner);
  const start = p.$('start-button');
  assert.equal(start.hidden, false);
  assert.equal(start.disabled, false);
  start.click();
  for (let tick = 0; tick < 24; tick++) p.frame();
  t.diagnostic(
    JSON.stringify({
      case: 'direct-ready-start-after-cancel',
      oldRunRetained: p.rendered.run === owner.run,
      tick: p.rendered.run.tick,
      flightState: p.doc.body.dataset.flightState,
      sourceBound: !!surface.frame.painter.image,
      heldSources: surface.held.length,
    }),
  );
  assert.notEqual(
    p.doc.body.dataset.flightState,
    'running',
    'Visible Start must prepare the required authored craft before simulation starts.',
  );
  assert.equal(authoritativeCheckpoint(owner.run).hash, owner.checkpoint);
  surface.release();
  await running(p, 'first-return');
  p.frame();
  assert.ok(drawn(surface, surface.frame.painter.image));
  p.key('ArrowDown');
  p.key('ArrowDown', false);
  for (let tick = 0; tick < 25; tick++) p.frame();
  assert.equal(p.rendered.run.player.cutting, true);
  p.key('ArrowRight');
  p.key('ArrowRight', false);
  p.frame();
  assert.equal(
    p.rendered.run.player.queuedDirection,
    'right',
    'An actual off-center command queues the turn.',
  );
  p.$('pause-button').click();
  p.frame(0);
  assert.equal(p.doc.body.dataset.flightState, 'paused');
  const retained = p.rendered.run;
  const paused = {
    checkpoint: authoritativeCheckpoint(retained).hash,
    tick: retained.tick,
    direction: retained.player.direction,
    queuedDirection: retained.player.queuedDirection,
    x: retained.player.x,
    y: retained.player.y,
  };
  assert.equal(paused.queuedDirection, 'right');
  assert.equal(p.$('start-button').hidden, false);
  p.$('start-button').click();
  await running(p, 'first-return');
  assert.equal(p.rendered.run, retained);
  assert.equal(authoritativeCheckpoint(retained).hash, paused.checkpoint);
  assert.equal(retained.tick, paused.tick);
  assert.equal(retained.player.direction, paused.direction);
  assert.equal(retained.player.queuedDirection, paused.queuedDirection);
  p.frame();
  assert.ok(retained.tick > paused.tick);
  assert.ok(retained.player.x !== paused.x || retained.player.y !== paused.y);
  report(t, {
    case: 'paused-resume',
    checkpointRetainedBeforeStep: true,
    direction: paused.direction,
    queuedDirection: paused.queuedDirection,
    tickBefore: paused.tick,
    tickAfter: retained.tick,
  });
  earnDown(p);
  assert.equal(p.$('flight-preparation-status').hidden, true);
  assert.equal(p.$('flight-preparation-status').textContent, '');
  assert.deepEqual(p.errors, []);
});
