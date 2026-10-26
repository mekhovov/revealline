import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createBattlefieldGroundPreferences,
  sharedBattlefieldGround,
  BATTLEFIELD_GROUND_KEY,
  createBattlefieldGroundSurface,
  battlefieldGroundAllowed,
} from '../presentation/battlefield-ground.mjs';
import {
  createOverflightGroundPresentation,
  createOverflightWorldPresentation,
  validateOverflightWorldPresentation,
} from '../overflight/worlds.mjs';
import { dataIdentity } from '../data-json.mjs';
import { mountBattlefieldGroundControls } from '../ui/battlefield-ground-controls.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { createRun } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { createCoop } from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
function fixture(t) {
  const doc = new Document(),
    created = [],
    draws = [],
    prior = Object.getOwnPropertyDescriptor(globalThis, 'document'),
    make = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const element = make(tag);
    if (tag === 'canvas') {
      created.push(element);
      element.getContext('2d').drawImage = (...args) => draws.push(args);
    }
    return element;
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  t.after(() => {
    sharedBattlefieldGround().set('authored');
    if (prior) Object.defineProperty(globalThis, 'document', prior);
    else delete globalThis.document;
  });
  return { doc, created, draws };
}

test('ground is opt-in and preserves unsupported stored versions instead of overwriting them', (t) => {
  const window = new Events(),
    storage = memoryStorage(),
    prefs = createBattlefieldGroundPreferences({ window, getStorage: () => storage });
  t.after(() => prefs.dispose());
  assert.equal(prefs.snapshot().world, 'authored');
  assert.equal(storage.writes.length, 0);
  prefs.set('freight-depot');
  assert.equal(JSON.parse(storage.getItem(BATTLEFIELD_GROUND_KEY)).world, 'freight-depot');
  assert.throws(() => prefs.set('invalid'));
  storage.setItem(BATTLEFIELD_GROUND_KEY, '{"format":"FutureGroundV2","world":"future"}');
  prefs.set('relay-ruins');
  assert.equal(prefs.snapshot().world, 'relay-ruins');
  assert.equal(prefs.snapshot().durable, false);
  assert.match(storage.getItem(BATTLEFIELD_GROUND_KEY), /FutureGroundV2/);
});

test('shared appearance controls expose six named worlds with clear mode scope, localization and cleanup', (t) => {
  const doc = new Document(),
    storage = memoryStorage(),
    prefs = createBattlefieldGroundPreferences({ getStorage: () => storage });
  let locale = 'en';
  const controls = mountBattlefieldGroundControls({
    document: doc,
    container: doc.body,
    preferences: prefs,
    locale: () => locale,
  });
  t.after(() => {
    controls.dispose();
    prefs.dispose();
  });
  const select = doc.querySelector('[data-battlefield-ground]');
  const labels = {
    en: [
      'Original ground',
      'FPV · Field Crossing',
      'FPV · Freight Depot',
      'FPV · Relay Ruins',
      'FPV · River Port',
      'FPV · Chalk Quarry',
      'FPV · Orchard Strongpoint',
    ],
    uk: [
      'Початкове покриття',
      'FPV · Польова переправа',
      'FPV · Вантажне депо',
      'FPV · Руїни ретранслятора',
      'FPV · Річковий порт',
      'FPV · Крейдяний кар’єр',
      'FPV · Садовий опорний пункт',
    ],
  };
  assert.equal(select.options.length, 7);
  assert.deepEqual(
    [...select.options].map((option) => option.textContent),
    labels.en,
  );
  assert.match(doc.body.textContent, /Solo, Duel and Team/);
  assert.equal(storage.writes.length, 0);
  select.value = 'field-crossing';
  select.dispatchEvent({ type: 'change' });
  assert.equal(prefs.snapshot().world, 'field-crossing');
  locale = 'uk';
  controls.refresh();
  assert.deepEqual(
    [...select.options].map((option) => option.textContent),
    labels.uk,
  );
  for (const world of ['river-port', 'chalk-quarry', 'orchard-strongpoint']) {
    select.value = world;
    select.dispatchEvent({ type: 'change' });
    assert.equal(prefs.snapshot().world, world);
    assert.equal(JSON.parse(storage.getItem(BATTLEFIELD_GROUND_KEY)).world, world);
  }
  controls.dispose();
  assert.equal(doc.querySelector('[data-battlefield-ground]'), null);
});

test('world preparation reuses one bounded surface and releases it on original/custom selection', (t) => {
  const f = fixture(t),
    surface = createBattlefieldGroundSurface();
  const first = surface.prepare('field-crossing', 4000, 3000);
  assert.equal(first.width, 1024);
  assert.equal(first.height, 768);
  assert.equal(surface.prepare('field-crossing', 4000, 3000), first);
  assert.equal(f.created.length, 1);
  const second = surface.prepare('relay-ruins', 768, 576);
  assert.equal(first.width, 0);
  assert.equal(surface.prepare('relay-ruins', 768, 576, false), null);
  assert.equal(second.width, 0);
  assert.equal(surface.prepare('authored', 768, 576), null);
});

test('pinned environments and custom terrain or background overrides keep their authored ground', () => {
  assert.equal(battlefieldGroundAllowed(), true);
  assert.equal(battlefieldGroundAllowed({ environmentPin: {} }), false);
  assert.equal(battlefieldGroundAllowed({ overrides: { background: { file: 'mine' } } }), false);
  assert.equal(
    battlefieldGroundAllowed({
      presentation: { resolved: { assets: { 'terrain.wall': { file: { sha256: 'mine' } } } } },
    }),
    false,
  );
  const builtin = read('../presentation/compiled/runtime.json');
  assert.equal(battlefieldGroundAllowed({ presentation: builtin }), true);
});

for (const mode of ['Solo', 'Duel'])
  test(`${mode} native shared painter samples the battlefield only into unclaimed horizontal spans without changing gameplay or pictures`, (t) => {
    const f = fixture(t),
      canvas = f.doc.createElement('canvas'),
      presets = read('../../authoring/motion-lab/presets.json'),
      painter = new BoardPainter(presets),
      run = createRun(read('../content/campaign.json').levels[0]);
    canvas.width = 768;
    canvas.height = 576;
    painter.theme = read('../content/themes.json').themes[0];
    painter.body = presets.characters['neutral-marker'];
    painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
    painter.background = { width: 384, height: 288 };
    const before = authoritativeCheckpoint(run),
      picture = painter.background;
    sharedBattlefieldGround().set('field-crossing');
    painter.draw(canvas.getContext('2d'), run, 0, { paused: true, reduced: true });
    assert.ok(
      f.draws.some(([image]) => image === picture),
      'earned picture still draws',
    );
    // Select the source of span samples, independently of later cached layers.
    const ground = f.draws.find((args) => args.length === 9 && f.created.includes(args[0]))?.[0],
      samples = f.draws.filter(([image]) => image === ground);
    assert.ok(ground);
    assert.ok(samples.length > 0 && samples.length < run.cells.length / 2);
    for (const args of samples) {
      const [, , , , , x, y, width, height] = args;
      assert.equal(height, 16);
      for (let cell = x / 16; cell < (x + width) / 16; cell++)
        assert.equal(run.cells[(y / 16) * run.width + cell], 0);
    }
    assert.deepEqual(authoritativeCheckpoint(run), before);
    painter.dispose();
    assert.equal(ground.width, 0);
  });

test('Team native painter reuses the same world with bounded span draws below its gameplay layer', (t) => {
  const f = fixture(t),
    canvas = f.doc.createElement('canvas'),
    run = createCoop(FIRST_CONNECTION),
    before = structuredClone(run),
    painter = createCoopPainter(canvas);
  canvas.width = 1152;
  canvas.height = 576;
  sharedBattlefieldGround().set('freight-depot');
  painter.paint(run, { reduced: true });
  const ground = f.created.at(-1),
    samples = f.draws.filter(([image]) => image === ground);
  assert.ok(samples.length > 0 && samples.length < run.cells.length / 2);
  for (const [, , , , , x, y, width, height] of samples) {
    assert.equal(height, 1);
    for (let col = x; col < x + width; col++) assert.equal(run.cells[y * run.width + col], 0);
  }
  assert.deepEqual(run, before);
  painter.dispose();
  assert.equal(ground.width, 0);
});

test('shared ground preserves original scenes and reuses distinct low V2 composition for new worlds', () => {
  const arena = { width: 2880, height: 1080 };
  for (const world of ['field-crossing', 'freight-depot', 'relay-ruins']) {
    const original = createOverflightWorldPresentation(world, arena);
    original.landmarks = original.landmarks.filter(
      (entry) => !['tree', 'container', 'antenna'].includes(entry.kind),
    );
    assert.deepEqual(createOverflightGroundPresentation(world, arena), original);
  }
  const compositions = new Set(),
    drawings = new Set();
  for (const world of ['river-port', 'chalk-quarry', 'orchard-strongpoint']) {
    const source = createOverflightGroundPresentation(world, arena);
    assert.doesNotThrow(() => validateOverflightWorldPresentation(source, arena));
    assert.equal(source.format, 'OverflightWorldPresentationV2');
    assert.deepEqual(source.resource, { id: 'overflight-worlds', revision: 2 });
    assert.deepEqual(source.assemblies, [], 'decorative ground must never suggest solid cover');
    assert.ok(
      source.landmarks.every((item) =>
        ['pipe', 'puddle', 'spoil', 'rubble', 'irrigation', 'glass'].includes(item.kind),
      ),
    );
    assert.equal(source.regions.length, 3);
    assert.equal(source.paths.length, 2);
    compositions.add(
      dataIdentity({ regions: source.regions, paths: source.paths, landmarks: source.landmarks }),
    );
    const rectangles = [];
    const context = {
      save() {},
      restore() {},
      scale() {},
      beginPath() {},
      rect() {},
      clip() {},
      fillRect(...args) {
        rectangles.push(args);
      },
    };
    const canvas = { width: 0, height: 0, getContext: () => context };
    const surface = createBattlefieldGroundSurface({ canvasFactory: () => canvas });
    assert.equal(surface.prepare(world, 960, 540), canvas);
    assert.ok(rectangles.length > 100);
    drawings.add(dataIdentity(rectangles)); // Actual drawn geometry, ignoring palette colors.
    const count = rectangles.length;
    surface.prepare(world, 960, 540);
    assert.equal(
      rectangles.length,
      count,
      'selected-world art is cached, never repainted per frame',
    );
    surface.clear();
    assert.equal(canvas.width, 0);
  }
  assert.equal(compositions.size, 3, 'new choices have different paths/material regions/props');
  assert.equal(drawings.size, 3, 'new choices cannot be recolors of identical geometry');
});
