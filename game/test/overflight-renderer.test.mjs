import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  overflightAtlasInventory,
  OVERFLIGHT_ATLAS_BUDGET,
  overflightEnemyFrame,
} from '../overflight/atlas.mjs';
import { createOverflightBenchmark, insideOverflightCamera } from '../overflight/benchmark.mjs';
import {
  OVERFLIGHT_FIELD_KIT_IDS,
  overflightFieldKitArt,
} from '../presentation/overflight-field-kit-art.mjs';
import { createOverflightRenderer } from '../overflight/renderer.mjs';
import {
  overflightEffectPose,
  overflightEffectLayers,
} from '../presentation/overflight-motion.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  chooseOverflightUpgrade,
  overflightSummary,
} from '../overflight/core.mjs';

test('all native families, wardrobes and motion poses fit two audited textures', () => {
  const inventory = overflightAtlasInventory();
  assert.equal(inventory.soldierFrames, 12 * 3 * 6);
  assert.equal(inventory.machineryFrames, 6 * 6);
  assert.equal(inventory.textures, 2);
  assert.ok(inventory.baseRGBABytes < OVERFLIGHT_ATLAS_BUDGET);
  assert.ok(inventory.width <= 2048 && inventory.height <= 2048);
  const ids = new Set();
  for (const frame of inventory.frames) {
    assert.ok(!ids.has(frame.id));
    ids.add(frame.id);
    assert.ok(
      frame.x >= 0 &&
        frame.y >= 0 &&
        frame.x + frame.width <= inventory.width &&
        frame.y + frame.height <= inventory.height,
    );
  }
  for (const family of ['runner', 'shield-bearer', 'relay-warden', 'tracked-tank', 'radar-truck'])
    for (let wardrobe = 0; wardrobe < 3; wardrobe++)
      for (let pose = 0; pose < 6; pose++)
        assert.ok(ids.has(overflightEnemyFrame({ id: 6, family, wardrobe }, pose / 9)));
  assert.throws(() => overflightEnemyFrame({ id: 1, family: 'unadmitted', wardrobe: 0 }, 1));
});

test('field equipment is deterministic, original bounded pixel data with distinct silhouettes', () => {
  const signatures = new Set();
  for (const id of OVERFLIGHT_FIELD_KIT_IDS) {
    const art = overflightFieldKitArt(id);
    assert.equal(art.width, 16);
    assert.equal(art.rgba.length, 16 * 16 * 4);
    assert.deepEqual(art, overflightFieldKitArt(id));
    const palette = new Set();
    let opaque = 0,
      transparent = 0;
    for (let at = 0; at < art.rgba.length; at += 4) {
      if (art.rgba[at + 3]) {
        opaque++;
        palette.add([...art.rgba.subarray(at, at + 3)].join(','));
      } else transparent++;
    }
    assert.ok(opaque > 0 && transparent > 0);
    assert.ok(palette.size <= 12);
    signatures.add(Buffer.from(art.rgba).toString('base64'));
  }
  assert.equal(signatures.size, OVERFLIGHT_FIELD_KIT_IDS.length);
  assert.equal(overflightFieldKitArt('unknown'), null);
});

test('native family gait timing and reduced effects preserve meaningful danger cues', () => {
  assert.match(overflightEnemyFrame({ id: 0, family: 'runner', wardrobe: 0 }, 0.11), /:1$/);
  assert.match(overflightEnemyFrame({ id: 0, family: 'guard', wardrobe: 0 }, 0.11), /:0$/);
  assert.match(overflightEnemyFrame({ id: 0, family: 'runner', wardrobe: 0 }, 0.4, true), /:0$/);
  const warning = { kind: 'warning', age: 0.5, life: 1 };
  assert.deepEqual(
    overflightEffectPose(warning),
    overflightEffectPose({ ...warning, reducedEffects: true }),
  );
  const hostile = { kind: 'hostile-impact', age: 0.1, life: 0.3 };
  assert.deepEqual(
    overflightEffectPose(hostile),
    overflightEffectPose({ ...hostile, reducedEffects: true }),
  );
});

test('authored cast preserves mixed wardrobes and explicit cast only selects a rendered wardrobe', () => {
  const enemy = Object.freeze({ id: 7, family: 'runner', wardrobe: 2 });
  assert.equal(
    overflightEnemyFrame(enemy, 0.3),
    overflightEnemyFrame(enemy, 0.3, false, 'authored'),
  );
  assert.match(overflightEnemyFrame(enemy, 0.3, false, 'authored'), /:arcade:/);
  for (const cast of ['tactical', 'rivals', 'arcade'])
    assert.match(overflightEnemyFrame(enemy, 0.3, false, cast), new RegExp(`:${cast}:`));
  const machinery = Object.freeze({ id: 7, family: 'tracked-tank', wardrobe: 2 });
  assert.equal(
    overflightEnemyFrame(machinery, 0.3, false, 'tactical'),
    overflightEnemyFrame(machinery, 0.3, false, 'arcade'),
  );
});

test('shared effect composites preserve full danger cues and locate chain endpoints in world space', () => {
  for (const kind of ['arrival', 'warning', 'hostile-impact']) {
    const effect = { kind, age: 0.2, life: 1, radius: 40 };
    const layers = overflightEffectLayers(effect);
    assert.deepEqual(layers, overflightEffectLayers({ ...effect, reducedEffects: true }));
    assert.ok(layers.every((layer) => layer.priority));
  }
  const warning = overflightEffectLayers({ kind: 'warning', radius: 40 });
  assert.equal(warning[0].width, 80);
  assert.ok(warning.some((layer) => layer.frame === 'pickup.overflight-warning'));
  const impact = { kind: 'drop', age: 0.2, life: 1, radius: 40 };
  assert.ok(
    overflightEffectLayers(impact).some((layer) => layer.frame === 'pickup.overflight-impact'),
  );
  assert.ok(
    !overflightEffectLayers({ ...impact, reducedEffects: true }).some(
      (layer) => layer.frame === 'pickup.overflight-impact',
    ),
  );
  const [line] = overflightEffectLayers({ kind: 'chain', x: 20, y: 40, x2: 100, y2: -20 });
  const halfX = (Math.cos(line.rotation) * line.width) / 2;
  const halfY = (Math.sin(line.rotation) * line.width) / 2;
  assert.ok(Math.abs(20 + line.dx - halfX - 20) < 1e-10);
  assert.ok(Math.abs(40 + line.dy - halfY - 40) < 1e-10);
  assert.ok(Math.abs(20 + line.dx + halfX - 100) < 1e-10);
  assert.ok(Math.abs(40 + line.dy + halfY + 20) < 1e-10);
});

test('cadence retains foreground stalls, excludes known pauses, and exports bounded ordered samples', () => {
  const meter = createOverflightBenchmark({ capacity: 3 });
  meter.frame(0);
  meter.frame(16);
  meter.frame(32);
  meter.frame(232);
  meter.exclude('hidden');
  meter.frame(10000);
  meter.frame(10020);
  meter.frame(10038);
  meter.submission(3, 10020);
  meter.submission(4, 10038);
  const result = meter.snapshot({ raw: true });
  assert.deepEqual(
    result.rawIntervals.map((sample) => sample.intervalMs),
    [200, 20, 18],
  );
  assert.deepEqual(
    result.rawIntervals.map((sample) => sample.endMs),
    [232, 10020, 10038],
  );
  assert.equal(result.cadenceMs.worst, 200);
  assert.equal(result.over100Ms, 1);
  assert.equal(result.exclusions.hidden, 1);
  assert.equal(result.measuredIntervals, 5);
  assert.equal(result.measuredSeconds, 0.27);
  assert.equal(result.cadenceHz, (5 * 1000) / 270);
  assert.deepEqual(
    result.rawSubmission.map((sample) => sample.cpuMs),
    [3, 4],
  );
});

test('benchmark gates remain strict and cannot accept an incomplete protocol', () => {
  const meter = createOverflightBenchmark({
    warmupSeconds: 0,
    measurementSeconds: 1,
    repetitions: 1,
  });
  for (let i = 0; i <= 60; i++) meter.frame((i * 1000) / 60);
  const result = meter.snapshot();
  assert.equal(result.protocol.windows[0].complete, true);
  assert.equal(result.protocol.acceptance, true);
  const stalled = createOverflightBenchmark({
    warmupSeconds: 0,
    measurementSeconds: 1,
    repetitions: 1,
  });
  for (let i = 0; i <= 60; i++) stalled.frame((i * 1000) / 60 + (i > 30 ? 100 : 0));
  assert.equal(stalled.snapshot().protocol.acceptance, false);
  assert.equal(createOverflightBenchmark().snapshot().protocol.acceptance, null);
});

test('120 Hz full protocol retains all three measured windows beyond 36000 samples', () => {
  const meter = createOverflightBenchmark();
  for (let frame = 0; frame <= 391 * 120; frame++) meter.frame((frame * 1000) / 120);
  const stats = meter.snapshot();
  assert.equal(stats.retainedIntervals, 391 * 120);
  assert.equal(stats.protocol.acceptance, true);
  assert.deepEqual(
    stats.protocol.windows.map((window) => window.cadenceMs.samples),
    [14400, 14400, 14400],
  );
});

test('a paused or hidden trial cannot pass even when its retained cadence is fast', () => {
  for (const reason of ['hidden', 'context-lost', 'pause']) {
    const meter = createOverflightBenchmark({
      warmupSeconds: 0,
      measurementSeconds: 1,
      repetitions: 1,
    });
    for (let i = 0; i <= 30; i++) meter.frame((i * 1000) / 60);
    if (reason === 'pause') meter.frame(501, false);
    else meter.exclude(reason);
    for (let i = 0; i <= 61; i++) meter.frame(1000 + (i * 1000) / 60);
    const report = meter.snapshot();
    assert.equal(report.protocol.windows[0].passes, true);
    assert.equal(report.valid, false);
    assert.equal(report.protocol.acceptance, false);
    assert.ok(report.invalidReasons.length > 0);
  }
});

test('a completed independent trial freezes before inspection and ignores subsequent pauses', () => {
  const meter = createOverflightBenchmark({
    warmupSeconds: 0.5,
    measurementSeconds: 1,
    repetitions: 1,
    stopAtEnd: true,
  });
  for (let i = 0; i <= 91; i++) meter.frame((i * 1000) / 60);
  assert.equal(meter.complete(), true);
  const before = meter.snapshot({ raw: true });
  meter.exclude('hidden');
  meter.frame(3000, false);
  meter.frame(9000);
  const after = meter.snapshot({ raw: true });
  assert.deepEqual(after.rawIntervals, before.rawIntervals);
  assert.equal(after.valid, true);
  assert.equal(after.protocol.acceptance, true);
  assert.equal(after.protocol.repetitions, 1);
});

function fakeEnvironment() {
  let paints = 0,
    textureUploads = 0,
    disposedCanvases = 0;
  const canvases = [],
    images = [];
  const document = {
    readyState: 'complete',
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
    createElement(tag) {
      assert.equal(tag, 'canvas');
      const canvas = { style: {}, width: 0, height: 0 };
      const ctx = new Proxy(
        {
          canvas,
          globalAlpha: 1,
          createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
        },
        {
          get: (target, key) =>
            key in target
              ? target[key]
              : () => {
                  paints++;
                },
        },
      );
      canvas.getContext = () => ctx;
      canvases.push(canvas);
      return canvas;
    },
  };
  const image = () => {
    const value = {};
    images.push(value);
    for (const method of [
      'setDepth',
      'setOrigin',
      'setAlpha',
      'setVisible',
      'setPosition',
      'setFrame',
      'setRotation',
      'setTint',
    ])
      value[method] = (...args) => {
        value[method.slice(3)] = args;
        return value;
      };
    value.setDisplaySize = (width, height) => {
      value.displayWidth = width;
      value.displayHeight = height;
      return value;
    };
    value.setSize = (width, height) => {
      value.width = width;
      value.height = height;
      return value;
    };
    return value;
  };
  let game;
  const Phaser = {
    WEBGL: 2,
    Scale: { FIT: 1, CENTER_BOTH: 1 },
    Textures: { FilterMode: { NEAREST: 0 } },
    Renderer: { Events: { LOSE_WEBGL: 'lose', RESTORE_WEBGL: 'restore' } },
    Core: { Events: { PRE_RENDER: 'pre', POST_RENDER: 'post', DESTROY: 'destroy' } },
    Game: class {
      constructor(config) {
        game = this;
        this.config = config;
        this.events = new EventEmitter();
        this.renderer = new EventEmitter();
        this.renderer.type = 2;
        this.canvas = { style: {}, width: 960, height: 540 };
        this.scene = {
          game: this,
          textures: {
            create: () => {
              textureUploads++;
              return { add() {}, setFilter() {} };
            },
          },
          add: { image, tileSprite: (_x, _y, width, height) => image().setSize(width, height) },
          cameras: {
            main: {
              setBounds() {
                return this;
              },
              centerOn() {},
            },
          },
        };
        queueMicrotask(() => config.scene.create.call(this.scene));
      }
      destroy() {
        this.pendingDestroy = true;
      }
      step() {
        if (this.pendingDestroy) {
          this.pendingDestroy = false;
          disposedCanvases++;
          this.events.emit('destroy');
        }
      }
    },
  };
  return {
    document,
    Phaser,
    game: () => game,
    counts: () => ({ paints, textureUploads, disposedCanvases }),
    canvases,
    images,
  };
}

test('enemy behavior cues retain phase, rally direction and reward identity with reduced effects', async () => {
  const environment = fakeEnvironment(),
    prior = globalThis.Phaser;
  globalThis.Phaser = environment.Phaser;
  const appearance = {
    reducedEffects: false,
    snapshot: { image: (id) => (id.startsWith('player.') ? { image: {} } : null) },
  };
  let renderer;
  try {
    renderer = await createOverflightRenderer({
      parent: { ownerDocument: environment.document },
      appearance,
    });
    const run = {
      phase: 'playing',
      time: 3,
      tick: 180,
      camera: { x: 1440, y: 540, width: 960, height: 540 },
      player: { x: 1440, y: 540, heading: 0, hull: 3, invulnerable: 0 },
      enemies: [
        { family: 'sprinter', behaviorPhase: 'windup', heading: 0 },
        { family: 'sprinter', behaviorPhase: 'burst', heading: Math.PI / 2 },
        { family: 'radar-truck', behaviorPhase: 'support', supportRadius: 140 },
        { family: 'relay-warden', behaviorPhase: 'rally-warning', supportRadius: 160 },
        {
          family: 'relay-warden',
          behaviorPhase: 'rally',
          supportRadius: 160,
          rallyX: 1100,
          rallyY: 650,
        },
        { family: 'courier', behaviorPhase: 'pursuit', rewardTarget: true },
        { family: 'refuge-seeker', behaviorPhase: 'pursuit', rewardTarget: true },
      ].map((enemy, id) => ({
        id,
        x: 1100 + id * 80,
        y: 500,
        active: true,
        radius: 8,
        wardrobe: 0,
        specialist: enemy.supportRadius > 0,
        ...enemy,
      })),
      pickups: [],
      effects: [],
    };
    const before = structuredClone(run),
      baked = environment.counts();
    const cues = () =>
      environment.images
        .filter((image) => image.Depth?.[0] === 65 && image.Visible?.[0])
        .map((image) => ({
          frame: image.Frame[0],
          position: image.Position,
          rotation: image.Rotation[0],
          tint: image.Tint[0],
          alpha: image.Alpha[0],
          width: image.displayWidth,
          height: image.displayHeight,
        }));
    renderer.present(run);
    const normal = cues();
    assert.equal(normal.length, 9);
    assert.equal(renderer.stats().counts.behaviorCues, 9);
    assert.equal(
      renderer.stats().counts.warnings,
      0,
      'Family cues do not invent aimed attack warnings.',
    );
    assert.ok(normal.every((cue) => cue.width <= 28 && cue.height <= 28));
    const arrows = normal.filter((cue) => cue.frame === 'arrow');
    assert.equal(arrows.length, 3);
    assert.equal(arrows[0].rotation, 0);
    assert.equal(arrows[1].rotation, Math.PI / 2);
    assert.ok(
      arrows[1].width > arrows[0].width,
      'Committed burst is visibly distinct from windup.',
    );
    assert.notEqual(arrows[1].tint, arrows[0].tint);
    assert.equal(
      arrows[2].rotation,
      Math.atan2(150, -320),
      'Rally cue uses the real committed target.',
    );
    assert.equal(normal.filter((cue) => cue.frame === 'pickup.salvage-small').length, 2);
    appearance.reducedEffects = true;
    renderer.present(run);
    assert.deepEqual(cues(), normal, 'Reduced effects cannot alter these state cues.');
    assert.deepEqual(
      environment.counts(),
      baked,
      'Cues reuse baked textures without new painting or uploads.',
    );
    assert.deepEqual(run, before);
    run.enemies.forEach((enemy) => {
      enemy.active = false;
    });
    renderer.present(run);
    assert.equal(cues().length, 0, 'Retired enemies cannot leave stale status markers.');
  } finally {
    await renderer?.destroy();
    globalThis.Phaser = prior;
  }
});

test('renderer submits every visible actor above 64 without texture work, preserves simulation, restores and disposes', async () => {
  const environment = fakeEnvironment(),
    prior = globalThis.Phaser;
  globalThis.Phaser = environment.Phaser;
  let lost = 0,
    restored = 0,
    frames = 0;
  try {
    const renderer = await createOverflightRenderer({
      parent: { ownerDocument: environment.document },
      appearance: {
        snapshot: { image: (id) => (id.startsWith('player.') ? { image: {} } : null) },
        artRevision: 'industrial-roster-v3',
      },
      onContextLost: () => lost++,
      onContextRestored: () => restored++,
      onFrame: () => frames++,
    });
    const run = {
      phase: 'playing',
      time: 3,
      camera: { x: 1440, y: 540, width: 960, height: 540 },
      compiled: { arena: { width: 2880, height: 1080 }, props: [] },
      player: { x: 1440, y: 540, heading: 0, hull: 3, invulnerable: 0 },
      enemies: Array.from({ length: 1500 }, (_, id) => ({
        id,
        active: true,
        x: id < 700 ? 1000 + (id % 40) * 20 : 100,
        y: 350 + (id % 15) * 20,
        heading: 0,
        family: 'runner',
        wardrobe: id % 3,
        radius: 8,
      })),
      pickups: [],
      effects: [],
    };
    const before = structuredClone(run),
      baked = environment.counts();
    renderer.present(run);
    renderer.present(run);
    assert.deepEqual(run, before);
    assert.equal(renderer.stats().counts.alive, 1500);
    assert.equal(renderer.stats().counts.visible, 700);
    assert.equal(renderer.stats().counts.rendered, 700);
    assert.equal(renderer.stats().highWater.visible, 700);
    assert.deepEqual(environment.counts(), baked);
    assert.equal(
      renderer.requestContextRecoveryTest(),
      false,
      'unsupported contexts have no diagnostic side effect',
    );
    run.priorityAttacks = [{ active: true, x: 2700, y: 500, radius: 40 }];
    run.projectiles = [{ active: true, x: 2700, y: 500, vx: 1, vy: 0 }];
    renderer.present(run);
    assert.equal(
      renderer.stats().counts.warnings,
      1,
      'committed attack stays marked offscreen; friendly shots do not create danger arrows',
    );
    environment.game().config.scene.update();
    assert.equal(frames, 1);
    environment.game().renderer.emit('lose');
    environment.game().config.scene.update();
    assert.equal(frames, 1);
    assert.equal(lost, 1);
    environment.game().renderer.emit('restore');
    assert.equal(restored, 1);
    assert.equal(environment.counts().textureUploads, 2);
    renderer.resetMeasurements();
    assert.equal(renderer.stats().highWater.visible, 0);
    assert.equal(environment.counts().textureUploads, 2, 'retry retains prepared atlas');
    await renderer.destroy();
    await renderer.destroy();
    assert.equal(environment.counts().disposedCanvases, 1);
    assert.ok(environment.canvases.every((canvas) => canvas.width === 0 && canvas.height === 0));
    assert.equal(insideOverflightCamera(0, 0, run.camera), false);
  } finally {
    globalThis.Phaser = prior;
  }
});

test('diagnostic context restoration uses the extension and cancels its timer on destroy', async () => {
  const environment = fakeEnvironment(),
    prior = globalThis.Phaser;
  globalThis.Phaser = environment.Phaser;
  let loses = 0,
    restores = 0;
  try {
    const renderer = await createOverflightRenderer({
      parent: { ownerDocument: environment.document },
      appearance: {
        snapshot: { image: (id) => (id.startsWith('player.') ? { image: {} } : null) },
      },
    });
    const native = environment.game().renderer;
    native.gl = {
      getExtension: (name) =>
        name === 'WEBGL_lose_context'
          ? {
              loseContext() {
                loses++;
                native.emit('lose');
              },
              restoreContext() {
                restores++;
                native.emit('restore');
              },
            }
          : null,
    };
    assert.equal(renderer.requestContextRecoveryTest(), true);
    assert.equal(renderer.requestContextRecoveryTest(), false, 'a pending recovery cannot overlap');
    assert.equal(renderer.stats().lost, true);
    await new Promise((resolve) => setTimeout(resolve, 230));
    assert.equal(loses, 1);
    assert.equal(restores, 1);
    assert.equal(renderer.stats().lost, false);
    assert.equal(renderer.stats().contextRecoveryTests, 1);
    assert.equal(renderer.requestContextRecoveryTest(), true);
    await renderer.destroy();
    await new Promise((resolve) => setTimeout(resolve, 230));
    assert.equal(loses, 2);
    assert.equal(restores, 1, 'destroy cancels a pending restore on the retired renderer');
    assert.equal(renderer.requestContextRecoveryTest(), false);
  } finally {
    globalThis.Phaser = prior;
  }
});

test('normal and reduced-effects renderers preserve identical real-core outcomes over 600 ticks', async () => {
  const environment = fakeEnvironment(),
    prior = globalThis.Phaser;
  globalThis.Phaser = environment.Phaser;
  const renderers = [];
  try {
    for (const reducedEffects of [false, true])
      renderers.push(
        await createOverflightRenderer({
          parent: { ownerDocument: environment.document },
          appearance: {
            reducedEffects,
            snapshot: { image: (id) => (id.startsWith('player.') ? { image: {} } : null) },
          },
        }),
      );
    const compiled = compileOverflightProject(createOverflightProject({ seed: 17031991 }));
    const runs = [
      createOverflightRun(compiled, { airframes: 3 }),
      createOverflightRun(compiled, { airframes: 3 }),
    ];
    runs.forEach(startOverflight);
    let differentCosmeticWork = false;
    for (let tick = 0; tick < 600; tick++) {
      if (runs[0].phase === 'upgrade') {
        const choice = runs[0].offers[0].id;
        assert.ok(chooseOverflightUpgrade(runs[0], choice));
        assert.ok(chooseOverflightUpgrade(runs[1], choice));
      }
      const input = {
        x: Math.cos(tick / 75) * 0.3,
        y: Math.sin(tick / 75) * 0.3,
        boost: tick % 180 === 0,
      };
      for (let index = 0; index < runs.length; index++) {
        stepOverflight(runs[index], input);
        renderers[index].present(runs[index]);
      }
      const normal = renderers[0].stats(),
        reduced = renderers[1].stats();
      assert.equal(
        normal.counts.rendered,
        reduced.counts.rendered,
        'reduced effects cannot hide enemies',
      );
      assert.equal(
        normal.counts.warnings,
        reduced.counts.warnings,
        'reduced effects cannot hide danger',
      );
      differentCosmeticWork ||= normal.counts.effects > reduced.counts.effects;
    }
    assert.equal(runs[0].tick, 600);
    assert.ok(differentCosmeticWork, 'the paired run exercised distinct cosmetic workloads');
    assert.deepEqual(overflightSummary(runs[0]), overflightSummary(runs[1]));
    assert.deepEqual(
      runs[0],
      runs[1],
      'all simulation pools, RNG, cooldowns and progression remain identical',
    );
  } finally {
    await Promise.all(renderers.map((renderer) => renderer.destroy()));
    globalThis.Phaser = prior;
  }
});
