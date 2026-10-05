import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import {
  INDUSTRIAL_MACHINERY_REVISION as revision,
  INDUSTRIAL_MACHINERY_FAMILIES as families,
  INDUSTRIAL_TEAM_HARDWARE_SLOTS as hardware,
  machineryPixels,
  machineryHardwarePixels,
} from '../presentation/industrial-machinery.mjs';
import { militaryFieldPixels } from '../presentation/military-field-art.mjs';
import { createActorPresentation, drawPresentedActor } from '../ui/actor-presentation.mjs';
import { createArcadeAdapter, getArcadeCollection } from '../presentation/industrial-arcade.mjs';
import { INDUSTRIAL_BUILTIN_SPRITES } from '../presentation/industrial-arcade-builtins.mjs';
import { prepareCoopMaterialSample } from '../couch/coop-terrain-trail.mjs';
import { createSnakeHuntPresentation } from '../../optional-practice/civilian-fpv/snake-hunt-presentation.mjs';
import { createIndustrialMachineryBatch } from '../../scripts/produce-industrial-machinery.mjs';

test('six original overhead families retain transparent distinct silhouettes at real native sizes', () => {
  for (const size of [16, 24, 32, 64]) {
    const images = families.map((f) => machineryPixels({ width: size, height: size }, f));
    assert.equal(new Set(images.map(({ rgba }) => Buffer.from(rgba).toString('base64'))).size, 6);
    for (const { rgba } of images) {
      let occupied = 0;
      for (let i = 3; i < rgba.length; i += 4) {
        assert.ok(rgba[i] === 0 || rgba[i] === 255);
        occupied += rgba[i] === 255 ? 1 : 0;
      }
      assert.equal(rgba[3], 0);
      assert.equal(rgba.at(-1), 0);
      assert.ok(occupied > size * size * 0.2 && occupied < size * size * 0.8);
    }
  }
});
test('native sampled clocks freeze exact machinery poses and Reduced effects uses the static original', () => {
  const phase = { phase: 0.5, travelPhase: 0.125, speed: 2 },
    size = { width: 32, height: 32 };
  for (const family of families) {
    assert.notDeepEqual(machineryPixels(size, family, phase), machineryPixels(size, family));
    assert.deepEqual(
      machineryPixels(size, family, { ...phase, locked: true, speed: 0 }),
      machineryPixels(size, family, phase),
    );
    assert.deepEqual(
      machineryPixels(size, family, { ...phase, reduced: true }),
      machineryPixels(size, family),
    );
  }
});
test('Team hardware has five readable states and cannot replace historical artwork without v3', () => {
  const size = { width: 64, height: 64 },
    frames = hardware.map((s) => machineryHardwarePixels(size, s));
  assert.equal(new Set(frames.map(({ rgba }) => Buffer.from(rgba).toString('base64'))).size, 5);
  for (const slot of hardware) {
    assert.equal(militaryFieldPixels(size, slot), null);
    assert.deepEqual(
      militaryFieldPixels(size, slot, { revision }),
      machineryHardwarePixels(size, slot),
    );
  }
  assert.deepEqual(
    militaryFieldPixels(size, 'enemy.bouncer', { revision: 'unknown' }),
    militaryFieldPixels(size, 'enemy.bouncer'),
  );
});
const state = (ticks, status, events = []) => ({
  ticks,
  events,
  actors: [{ id: 'truck', type: 'vehicle', status, position: { x: 1000, y: 0, z: 2000 } }],
});
test('native accepted vehicle defeat uses bounded shared pools, equipment material and silent restore', () => {
  let prefs = { brutal: true, blood: true, showRemains: true };
  const scene = new THREE.Scene(),
    view = createSnakeHuntPresentation({ THREE, scene, preferences: () => prefs }),
    options = {
      machineryRevision: revision,
      machineryActorIds: ['truck'],
      actorDefinitions: [
        { id: 'truck', type: 'vehicle', vehicleModel: 'cargo-truck', radius: 900 },
      ],
    },
    dead = state(11, 'defeated', [{ type: 'defeat', actor: 'truck' }]),
    before = JSON.stringify(dead);
  view.update(state(10, 'active'), options);
  view.observe(dead, options);
  view.update(dead, options);
  assert.equal(view.resources().cosmeticParticles, 18);
  assert.equal(view.resources().settledPieces, 2);
  const mesh = scene.getObjectByName('hunt-cosmetic-fragments'),
    colors = Array.from(mesh.instanceColor.array);
  prefs = { ...prefs, blood: false };
  view.update(dead, options);
  assert.deepEqual(Array.from(mesh.instanceColor.array), colors);
  prefs = { ...prefs, showRemains: false };
  view.update(dead, options);
  assert.equal(view.resources().settledPieces, 0);
  assert.equal(view.resources().cosmeticParticles, 18);
  view.update(dead, { ...options, reducedMotion: true });
  assert.equal(view.resources().cosmeticParticles, 0);
  prefs = { ...prefs, showRemains: true };
  view.reset();
  view.update(dead, options);
  assert.equal(view.resources().cosmeticParticles, 0);
  assert.equal(view.resources().settledPieces, 2);
  view.update(state(2, 'active'), options);
  view.update(state(11, 'defeated'), options);
  assert.equal(view.resources().cosmeticParticles, 0);
  assert.equal(JSON.stringify(dead), before);
  view.dispose();
  assert.equal(scene.children.length, 0);
});
test('creator-owned native vehicles are excluded from machinery fragments', () => {
  const scene = new THREE.Scene(),
    view = createSnakeHuntPresentation({
      THREE,
      scene,
      preferences: () => ({ brutal: true, blood: true, showRemains: true }),
    }),
    options = { machineryRevision: revision, actorDefinitions: [{ id: 'truck', type: 'vehicle' }] };
  view.update(state(10, 'active'), options);
  view.update(state(11, 'defeated', [{ type: 'defeat', actor: 'truck' }]), options);
  assert.equal(view.resources().settledPieces, 0);
  assert.equal(view.resources().cosmeticParticles, 0);
  view.dispose();
});
test('native Studio transport admits 17 existing machinery slots without changing the published workspace', async () => {
  const batch = await createIndustrialMachineryBatch();
  assert.equal(batch.inventory.length, 17);
  assert.ok(batch.inventory.reduce((n, row) => n + row.decodedBytes, 0) < 1024 * 1024);
  assert.ok(batch.bytes.length < 2 * 1024 * 1024);
  assert.ok(batch.inventory.every((row) => row.frames === 1 || row.frames === 8));
  assert.ok(
    batch.document.assets
      .filter((a) => a.id.startsWith('industrial-v3-'))
      .every((a) => a.quality.stage === 'produced'),
  );
});

test('v3 shared adapter keeps Company art and the player while exposing admitted Team materials', () => {
  const canvases = [],
    adapter = createArcadeAdapter({
      reviewRevision: revision,
      canvasFactory: () => {
        const canvas = {
          getContext: () => ({
            drawImage() {},
            getImageData: () => ({ data: new Uint8ClampedArray(32 * 32 * 4) }),
            putImageData() {},
          }),
        };
        canvases.push(canvas);
        return canvas;
      },
    }),
    frame = (slot, hash = INDUSTRIAL_BUILTIN_SPRITES[slot]?.[0]) => ({
      image: { width: 32, height: 32 },
      geometry: {
        frame: { width: 32, height: 32 },
        pivot: { x: 0.5, y: 0.5 },
        rotors: [{ x: 0.1 }],
      },
      asset: { id: `${slot}.field-kit`, file: { width: 32, height: 32, sha256: hash } },
    }),
    frames = {
      'terrain.slow': frame('terrain.slow'),
      'terrain.lethal': frame('terrain.lethal', 'company-owned'),
      'enemy.bouncer': frame('enemy.bouncer'),
      'player.scout.compact': frame('player.scout.compact', 'player-owned'),
    },
    resolved = adapter.resolve(
      { image: (slot) => frames[slot] },
      getArcadeCollection('military-field', 'r1'),
    );
  assert.equal(prepareCoopMaterialSample(resolved)[1], resolved.image('terrain.slow'));
  assert.equal(resolved.image('terrain.slow').materialReviewRevision, revision);
  assert.equal(prepareCoopMaterialSample(resolved)[2], null);
  assert.equal(resolved.image('terrain.lethal'), frames['terrain.lethal']);
  assert.equal(resolved.image('player.scout.compact'), frames['player.scout.compact']);
  assert.equal(resolved.image('enemy.bouncer').geometry.machineryRevision, revision);
  assert.deepEqual(resolved.image('enemy.bouncer').geometry.rotors, []);
  assert.equal(frames['enemy.bouncer'].geometry.rotors.length, 1);
  adapter.clear();
  assert.ok(canvases.every((canvas) => canvas.width === 0 && canvas.height === 0));
});
test('accepted per-step vehicle events survive normal multi-tick render intervals, never restore gaps', () => {
  const scene = new THREE.Scene(),
    view = createSnakeHuntPresentation({
      THREE,
      scene,
      preferences: () => ({ brutal: true, showRemains: true }),
    }),
    options = {
      machineryRevision: revision,
      machineryActorIds: ['truck'],
      actorDefinitions: [{ id: 'truck', type: 'vehicle', radius: 900 }],
    };
  view.update(state(10, 'active'), options);
  view.observe(state(11, 'defeated', [{ type: 'defeat', actor: 'truck' }]), options);
  view.observe(state(12, 'defeated'), options);
  view.observe(state(13, 'defeated'), options);
  view.update(state(13, 'defeated'), options);
  assert.equal(view.resources().cosmeticParticles, 18);
  view.observe(state(14, 'defeated'), options);
  view.observe(state(15, 'defeated'), options);
  view.update(state(15, 'defeated'), options);
  assert.equal(view.resources().cosmeticParticles, 18);
  view.update(state(30, 'defeated'), options);
  assert.equal(
    view.resources().cosmeticParticles,
    0,
    'A seek without accepted observation never replays a burst',
  );
  view.reset();
  view.update(state(13, 'defeated'), options);
  assert.equal(view.resources().cosmeticParticles, 0);
  view.dispose();
});
test('machinery never crowds previously supported humanoid feedback out of shared bounded pools', () => {
  const scene = new THREE.Scene(),
    otherScene = new THREE.Scene(),
    preferences = () => ({ brutal: true, blood: true, showRemains: true }),
    view = createSnakeHuntPresentation({ THREE, scene, preferences }),
    baseline = createSnakeHuntPresentation({ THREE, scene: otherScene, preferences }),
    actors = Array.from({ length: 4 }, (_, i) => ({
      id: `vehicle-${i}`,
      type: 'vehicle',
      status: 'defeated',
      position: { x: 1000, y: 0, z: 2000 },
    })),
    snapshot = {
      ticks: 100,
      events: actors.map(({ id }) => ({ type: 'defeat', actor: id })),
      actors,
      hunt: {
        tail: [],
        catches: Array.from({ length: 12 }, (_, i) => ({
          id: `human-${i}`,
          family: 'runner',
          tick: 100 - i,
          position: { x: 3000, y: 0, z: i * 1000 },
          velocity: { x: 100, y: 0, z: 0 },
        })),
      },
    },
    options = {
      machineryRevision: revision,
      machineryActorIds: actors.map(({ id }) => id),
      actorDefinitions: actors,
    };
  view.observe(snapshot, options);
  view.update(snapshot, options);
  baseline.update(snapshot);
  assert.equal(view.resources().settledPieces, 48);
  assert.equal(view.resources().cosmeticParticles, 96);
  for (const name of ['hunt-cosmetic-fragments', 'hunt-settled-remains']) {
    const actual = scene.getObjectByName(name),
      expected = otherScene.getObjectByName(name);
    assert.equal(actual.count, expected.count);
    assert.deepEqual(actual.instanceMatrix.array, expected.instanceMatrix.array);
    assert.deepEqual(actual.instanceColor.array, expected.instanceColor.array);
  }
  view.dispose();
  baseline.dispose();
});

test('v3 native painter replaces the base machinery bitmap so folded accessories leave no stale pixels', () => {
  const actor = { id: 'machine', type: 'relay-sentinel', x: 2, y: 3, vx: 1, vy: 0, radius: 0.2 },
    frame = createActorPresentation()
      .sample([actor], { themeId: 'fpv', style: 'hybrid', dt: 0.08 })
      .get(actor.id),
    calls = [],
    ctx = new Proxy(
      {},
      {
        get: (target, key) =>
          key in target ? target[key] : (...args) => calls.push([key, ...args]),
        set: (target, key, value) => {
          target[key] = value;
          return true;
        },
      },
    ),
    geometry = {
      frame: { width: 32, height: 32 },
      pivot: { x: 0.5, y: 0.5 },
      rotors: [],
      material: 'military-vehicle',
      vehicleRole: 'radar-truck',
      machineryRevision: revision,
    };
  drawPresentedActor(ctx, frame, { muted: '#333333', accent: '#ffffff' }, {}, geometry);
  assert.ok(calls.some(([name]) => name === 'fillRect'));
  assert.equal(
    calls.some(([name]) => name === 'drawImage'),
    false,
  );
  calls.length = 0;
  drawPresentedActor(
    ctx,
    frame,
    { muted: '#333333', accent: '#ffffff' },
    {},
    { ...geometry, machineryRevision: null },
  );
  assert.equal(
    calls.some(([name]) => name === 'drawImage'),
    true,
    'Released painter semantics remain',
  );
});
