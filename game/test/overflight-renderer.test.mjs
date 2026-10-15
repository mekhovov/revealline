import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  overflightAtlasInventory,
  packOverflightAtlasFrames,
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
  dropOverflightSalvage,
  pauseOverflight,
  resumeOverflight,
  overflightSummary,
  spawnOverflightEnemy,
  damageOverflightEnemy,
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
  const machinery = Object.freeze({
    id: 7,
    family: 'tracked-tank',
    wardrobe: 2,
  });
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
  const [line] = overflightEffectLayers({
    kind: 'chain',
    x: 20,
    y: 40,
    x2: 100,
    y2: -20,
  });
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

function fakeEnvironment({ maxTextureSize } = {}) {
  let paints = 0,
    textureUploads = 0,
    disposedCanvases = 0;
  const draws = [],
    canvases = [],
    images = [];
  const documentEvents = new EventEmitter();
  const document = {
    readyState: 'complete',
    hidden: false,
    addEventListener: (name, listener) => documentEvents.on(name, listener),
    removeEventListener: (name, listener) => documentEvents.off(name, listener),
    dispatchEvent: (event) => documentEvents.emit(event.type, event),
    createElement(tag) {
      assert.equal(tag, 'canvas');
      const canvas = { style: {}, width: 0, height: 0 };
      const ctx = new Proxy(
        {
          canvas,
          globalAlpha: 1,
          createImageData: (width, height) => ({
            data: new Uint8ClampedArray(width * height * 4),
          }),
          drawImage(...args) {
            paints++;
            draws.push(args);
          },
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
      'setTexture',
      'setRotation',
      'setTint',
    ])
      value[method] = (...args) => {
        value[method.slice(3)] = args;
        if (method === 'setTexture') value.Frame = [args[1]];
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
    Core: {
      Events: { PRE_RENDER: 'pre', POST_RENDER: 'post', DESTROY: 'destroy' },
    },
    Game: class {
      constructor(config) {
        game = this;
        this.config = config;
        this.events = new EventEmitter();
        this.renderer = new EventEmitter();
        this.renderer.type = 2;
        if (maxTextureSize)
          this.renderer.gl = {
            MAX_TEXTURE_SIZE: 0x0d33,
            getParameter: () => maxTextureSize,
          };
        this.canvas = { style: {}, width: 960, height: 540 };
        this.scene = {
          game: this,
          textures: {
            create: () => {
              textureUploads++;
              return { add() {}, setFilter() {} };
            },
          },
          add: {
            image,
            tileSprite: (_x, _y, width, height) => image().setSize(width, height),
          },
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
    draws,
    images,
  };
}

test('real earned drafts retain complete render intervals while manual lifecycle interruptions invalidate', async (t) => {
  const prior = globalThis.Phaser;
  let now = 0;
  t.mock.method(performance, 'now', () => now);
  try {
    for (const { condition, measureAt } of [
      'normal',
      'foreground-stall',
      'manual-pause',
      'hidden',
      'context-loss',
    ].flatMap((condition) => [null, 0.02].map((measureAt) => ({ condition, measureAt })))) {
      const environment = fakeEnvironment();
      globalThis.Phaser = environment.Phaser;
      now = 0;
      const run = createOverflightRun(
        compileOverflightProject(createOverflightProject({ rulesVersion: 4, seed: 17031991 })),
      );
      startOverflight(run);
      let nextAction = null;
      const renderer = await createOverflightRenderer({
        parent: { ownerDocument: environment.document },
        appearance: {
          snapshot: { image: (id) => (id.startsWith('player.') ? { image: {} } : null) },
        },
        onContextLost: () => pauseOverflight(run),
        onFrame() {
          nextAction?.();
          renderer.present(run);
        },
      });
      try {
        renderer.resetMeasurements({
          warmupSeconds: 0,
          measurementSeconds: 1,
          repetitions: 1,
          stopAtEnd: true,
          measureAt,
        });
        const frame = (delta = 16, action = null) => {
          now += delta;
          nextAction = action;
          environment.game().config.scene.update();
          environment.game().events.emit('pre');
          environment.game().events.emit('post');
          nextAction = null;
        };
        frame(0);
        frame(16, () => stepOverflight(run));
        if (measureAt !== null) {
          const pending = renderer.stats({ raw: true });
          assert.equal(pending.protocol.scheduledStart.pending, true);
          assert.equal(pending.measuredIntervals, 0);
          assert.equal(pending.rawSubmission.length, 0);
        }
        frame(16, () => {
          dropOverflightSalvage(run, run.player.x, run.player.y, run.progression.nextThreshold);
          stepOverflight(run);
          assert.equal(run.phase, 'upgrade', 'real salvage collection must open the draft');
          // Simulate foreground card/preparation work inside the phase-changing
          // host callback, not an inactive gap or a fabricated benchmark sample.
          if (condition === 'foreground-stall') now += 220;
        });
        const draftTime = run.time;
        if (measureAt !== null)
          assert.equal(renderer.stats().protocol.scheduledStart.actualGameplaySeconds, draftTime);
        for (let index = 0; index < 10; index++) frame();
        assert.equal(run.time, draftTime, 'rendering the draft cannot advance simulation');

        if (condition === 'manual-pause') {
          frame(16, () => assert.ok(pauseOverflight(run)));
          assert.equal(run.phase, 'paused');
          frame(100);
          frame(16, () => assert.ok(resumeOverflight(run)));
          assert.equal(run.phase, 'upgrade', 'manual resume returns to the interrupted draft');
        } else if (condition === 'hidden') {
          environment.document.hidden = true;
          environment.document.dispatchEvent({ type: 'visibilitychange' });
          frame(100);
          environment.document.hidden = false;
          environment.document.dispatchEvent({ type: 'visibilitychange' });
          frame();
        } else if (condition === 'context-loss') {
          environment.game().renderer.emit('lose');
          frame(100);
          environment.game().renderer.emit('restore');
          frame(16, () => assert.ok(resumeOverflight(run)));
        }

        frame(16, () => {
          assert.ok(chooseOverflightUpgrade(run, run.offers[0].id));
          assert.equal(run.phase, 'playing');
        });
        for (let index = 0; index < 100 && !renderer.measurementComplete(); index++)
          frame(16, () => stepOverflight(run));
        const report = renderer.stats({ raw: true });
        const window = report.protocol.windows[0];
        assert.equal(window.complete, true, condition);
        assert.ok(window.phaseCoverage.upgrade.samples >= 11, condition);
        assert.ok(window.phaseCoverage.playing.samples > 0, condition);
        assert.ok(
          Math.abs(
            Object.values(window.phaseCoverage).reduce((sum, phase) => sum + phase.seconds, 0) -
              window.measuredSeconds,
          ) < 1e-9,
          'phase time accounts for the complete measured window',
        );
        assert.ok(report.rawIntervals.some((sample) => sample.phase === 'upgrade'));
        if (condition === 'normal' || condition === 'foreground-stall') {
          assert.equal(report.valid, true, condition);
          assert.deepEqual(report.invalidReasons, [], condition);
          assert.equal(report.protocol.acceptance, condition === 'normal');
          const pendingWallMs = measureAt === null ? 0 : 16;
          assert.ok(Math.abs(report.measuredSeconds - (now - pendingWallMs) / 1000) < 1e-9);
          if (condition === 'foreground-stall') {
            assert.ok(
              report.rawIntervals.some(
                (sample) => sample.phase === 'upgrade' && sample.intervalMs === 236,
              ),
            );
            assert.equal(window.cadenceMs.worst, 236);
            assert.ok(window.slowFraction > 0, 'foreground stall must remain in acceptance');
          }
        } else {
          assert.equal(report.valid, false, condition);
          assert.equal(report.protocol.acceptance, false, condition);
          assert.ok(
            report.invalidReasons.includes(
              condition === 'manual-pause'
                ? 'interrupted'
                : condition === 'context-loss'
                  ? 'context-lost'
                  : 'hidden',
            ),
          );
        }
      } finally {
        await renderer.destroy();
      }
    }
  } finally {
    globalThis.Phaser = prior;
  }
});

test('only the live Survivor/Riy final objective gets a persistent marker without new texture work', async () => {
  const prior = globalThis.Phaser;
  const environment = fakeEnvironment();
  globalThis.Phaser = environment.Phaser;
  let renderer;
  const appearance = {
    reducedEffects: false,
    snapshot: { image: (id) => (id.startsWith('player.') ? { image: {} } : null) },
  };
  try {
    renderer = await createOverflightRenderer({
      parent: { ownerDocument: environment.document },
      appearance,
    });
    const run = createOverflightRun(
      compileOverflightProject(createOverflightProject({ rulesVersion: 4 })),
    );
    startOverflight(run);
    const target = spawnOverflightEnemy(run, {
      family: 'tracked-tank',
      x: 2650,
      y: 540,
      warning: 0,
    });
    const cues = () =>
      environment.images.filter((image) => image.Depth?.[0] === 30 && image.Visible?.[0]);
    renderer.present(run);
    assert.equal(cues().length, 0, 'ordinary offscreen bodies do not get objective arrows');
    run.goals.finalSpawned = true;
    run.goals.finalId = target.id;
    const resources = environment.counts();
    renderer.present(run);
    assert.equal(cues().length, 7);
    assert.equal(
      renderer.stats().counts.rendered,
      0,
      'offscreen cue does not count as a visible actor',
    );
    appearance.reducedEffects = true;
    renderer.present(run);
    assert.equal(cues().length, 7, 'reduced effects preserve the objective');
    assert.deepEqual(environment.counts(), resources, 'navigation uses prepared atlas frames');
    run.goals.finalDefeated = true;
    renderer.present(run);
    assert.equal(cues().length, 0);
    run.goals.finalDefeated = false;
    run.hunt = {};
    renderer.present(run);
    assert.equal(cues().length, 0, 'Raid keeps its own objective navigation');
    delete run.hunt;
    target.active = false;
    renderer.present(run);
    assert.equal(cues().length, 0);
  } finally {
    await renderer?.destroy();
    globalThis.Phaser = prior;
  }
});

test('arming a late renderer window preserves earned remains, live simulation and prepared resources', async (t) => {
  const prior = globalThis.Phaser;
  const environment = fakeEnvironment();
  globalThis.Phaser = environment.Phaser;
  let now = 0,
    renderer,
    afterStep;
  t.mock.method(performance, 'now', () => now);
  const run = createOverflightRun(
    compileOverflightProject(createOverflightProject({ rulesVersion: 4 })),
  );
  startOverflight(run);
  const victim = spawnOverflightEnemy(run, {
    family: 'patroller',
    x: run.player.x + 80,
    y: run.player.y,
    warning: 0,
  });
  damageOverflightEnemy(run, victim, 1000);
  assert.equal(run.stats.kills, 1);
  try {
    renderer = await createOverflightRenderer({
      parent: { ownerDocument: environment.document },
      appearance: {
        destruction: { showRemains: true, brutal: true, blood: true },
        snapshot: { image: (id) => (id.startsWith('player.') ? { image: {} } : null) },
      },
      onFrame() {
        stepOverflight(run);
        afterStep = structuredClone(run);
        renderer.present(run);
      },
    });
    renderer.resetMeasurements({ measureAt: 0.05, repetitions: 1, stopAtEnd: true });
    const prepared = environment.counts();
    for (let index = 0; index < 4; index++) {
      now += 16;
      environment.game().config.scene.update();
      environment.game().events.emit('pre');
      environment.game().events.emit('post');
      assert.deepEqual(run, afterStep, 'Completed render cannot seek or modify the simulation.');
      assert.equal(renderer.stats().remains.stored, 1);
      assert.equal(renderer.stats().protocol.scheduledStart.pending, index < 2);
      assert.deepEqual(
        environment.counts(),
        prepared,
        'Arming cannot repaint or upload prepared art.',
      );
    }
    assert.equal(renderer.stats().protocol.scheduledStart.actualGameplaySeconds, 0.05);
    assert.equal(run.stats.kills, 1);
  } finally {
    await renderer?.destroy();
    globalThis.Phaser = prior;
  }
});

test('persistent native remains obey shared settings, preserve live draw counts, and survive recovery without new texture work', async () => {
  const environment = fakeEnvironment(),
    prior = globalThis.Phaser;
  globalThis.Phaser = environment.Phaser;
  const appearance = {
    reducedEffects: false,
    playerSlot: 'player.carrier.detailed',
    destruction: { showRemains: true, brutal: true, blood: true },
    snapshot: {
      image: (id) =>
        id === 'player.carrier.detailed' ? { image: {}, asset: { id: 'accepted-carrier' } } : null,
    },
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
      airframes: 3,
      airframesRemaining: 2,
      player: {
        x: 1440,
        y: 540,
        heading: 0,
        hull: 60,
        maxHull: 100,
        shield: 1,
      },
      enemies: Array.from({ length: 700 }, (_, id) => ({
        id,
        active: true,
        family: 'runner',
        wardrobe: 0,
        x: 1440,
        y: 540,
        radius: 8,
      })),
      defeats: {
        sequence: 400,
        capacity: 512,
        records: Array.from({ length: 512 }, (_, index) => ({
          sequence: index + 1,
          id: index,
          family: index % 2 ? 'runner' : 'tracked-tank',
          wardrobe: 1,
          x: 1440,
          y: 540,
          time: 2.9,
          heading: 0,
        })),
      },
    };
    const before = structuredClone(run),
      baked = environment.counts();
    renderer.present(run);
    assert.equal(renderer.stats().counts.rendered, 700);
    assert.equal(renderer.stats().remains.stored, 400);
    assert.equal(renderer.stats().counts.remains, 320);
    assert.equal(renderer.stats().counts.defeats, 24);
    assert.equal(renderer.stats().heroArtwork.assetId, 'accepted-carrier');
    assert.equal(renderer.stats().heroArtwork.playerSlot, appearance.playerSlot);
    assert.ok(!environment.images.some((image) => image.Frame?.[0] === 'hero-ring'));
    const residue = () =>
      environment.images.filter(
        (image) => [3, 19].includes(image.Depth?.[0]) && image.Visible?.[0],
      );
    assert.ok(residue().some((image) => image.Frame[0].includes(':blood')));
    appearance.destruction.blood = false;
    renderer.present(run);
    assert.ok(residue().every((image) => !image.Frame[0].includes(':blood')));
    appearance.destruction.brutal = false;
    renderer.present(run);
    assert.ok(residue().every((image) => image.Frame[0].includes(':clean')));
    appearance.reducedEffects = true;
    renderer.present(run);
    assert.equal(renderer.stats().counts.defeats, 0);
    assert.equal(renderer.stats().counts.remains, 320);
    environment.game().renderer.emit('lose');
    environment.game().renderer.emit('restore');
    renderer.present(run);
    assert.equal(renderer.stats().remains.stored, 400);
    appearance.destruction.showRemains = false;
    renderer.present(run);
    assert.equal(residue().length, 0);
    assert.deepEqual(
      environment.counts(),
      baked,
      'Settings and recovery never repaint or upload textures.',
    );
    assert.deepEqual(run, before, 'Presentation never alters accepted kills or live actors.');
    renderer.resetMeasurements();
    assert.equal(renderer.stats().remains.stored, 0);
    assert.equal(residue().length, 0);
  } finally {
    await renderer?.destroy();
    globalThis.Phaser = prior;
  }
});

test('enemy behavior cues retain phase, rally direction and reward identity with reduced effects', async () => {
  const environment = fakeEnvironment(),
    prior = globalThis.Phaser;
  globalThis.Phaser = environment.Phaser;
  const appearance = {
    reducedEffects: false,
    snapshot: {
      image: (id) => (id.startsWith('player.') ? { image: {} } : null),
    },
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
        {
          family: 'relay-warden',
          behaviorPhase: 'rally-warning',
          supportRadius: 160,
        },
        {
          family: 'relay-warden',
          behaviorPhase: 'rally',
          supportRadius: 160,
          rallyX: 1100,
          rallyY: 650,
        },
        { family: 'courier', behaviorPhase: 'pursuit', rewardTarget: true },
        {
          family: 'refuge-seeker',
          behaviorPhase: 'pursuit',
          rewardTarget: true,
        },
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
        snapshot: {
          image: (id) => (id.startsWith('player.') ? { image: {} } : null),
        },
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
        snapshot: {
          image: (id) => (id.startsWith('player.') ? { image: {} } : null),
        },
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
            snapshot: {
              image: (id) => (id.startsWith('player.') ? { image: {} } : null),
            },
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

test('armor detail follows approach distance without changing actor coverage, quality cues or simulation', async () => {
  const environment = fakeEnvironment(),
    prior = globalThis.Phaser;
  globalThis.Phaser = environment.Phaser;
  const appearance = {
    reducedEffects: false,
    snapshot: {
      image: (id) => (id.startsWith('player.') ? { image: {} } : null),
    },
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
      player: { x: 1440, y: 540, heading: 0, hull: 100, invulnerable: 0 },
      enemies: [
        { x: 1080, y: 480 },
        { x: 1380, y: 480 },
        { x: 1790, y: 480, heavy: true },
        { x: 1790, y: 600, objectiveId: 'priority' },
      ].map((enemy, id) => ({
        id,
        family: 'armored-carrier',
        active: true,
        radius: 14,
        wardrobe: 0,
        heading: 0,
        armor: 100,
        maxArmor: 100,
        exposureRemaining: 0,
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
          tint: image.Tint[0],
          width: image.displayWidth,
          height: image.displayHeight,
        }));
    renderer.present(run);
    const normal = cues();
    const tracks = normal.filter((cue) => cue.tint === 0x12241f);
    assert.equal(renderer.stats().counts.rendered, 4);
    assert.equal(tracks.length, 4);
    assert.equal(tracks[0].width, 16, 'distant ordinary machinery has a compact armor bar');
    assert.ok(
      tracks.slice(1).every((cue) => cue.width === 34),
      'near, heavy and objective machinery retain full detail',
    );
    appearance.reducedEffects = true;
    renderer.present(run);
    assert.deepEqual(cues(), normal);
    assert.deepEqual(run, before);
    assert.deepEqual(environment.counts(), baked, 'approach cues need no new textures or painting');
  } finally {
    await renderer?.destroy();
    globalThis.Phaser = prior;
  }
});

test('Riy native attachments distinguish both escort roles with reduced effects', async () => {
  const { createOverflightRiy } = await import('../overflight/riy-core.mjs');
  const environment = fakeEnvironment(),
    prior = globalThis.Phaser;
  globalThis.Phaser = environment.Phaser;
  const appearance = {
    reducedEffects: false,
    playerSlot: 'player.scout.detailed',
    snapshot: { image: () => ({ image: {}, asset: { id: 'accepted-scout' } }) },
  };
  let renderer;
  try {
    renderer = await createOverflightRenderer({
      parent: { ownerDocument: environment.document },
      appearance,
    });
    const run = createOverflightRun(compileOverflightProject(createOverflightProject()));
    startOverflight(run);
    run.riy = createOverflightRiy(run);
    const original = structuredClone(run.riy),
      baked = environment.counts();
    const escorts = () =>
      environment.images.filter((image) => image.Depth?.[0] === 69 && image.Visible?.[0]);
    for (let frame = 0; frame < 20; frame++) {
      appearance.reducedEffects = frame > 9;
      renderer.present(run);
      assert.equal(escorts().length, 2);
      assert.ok(
        escorts().every(
          (image) => image.Frame[0].startsWith('escort:') && image.displayWidth === 44,
        ),
      );
    }
    assert.deepEqual(run.riy, original);
    assert.deepEqual(
      environment.counts(),
      baked,
      'escorts require no additional atlas painting or uploads',
    );
    delete run.riy;
    renderer.present(run);
    assert.equal(escorts().length, 0, 'ordinary Survivor has no escort sprites');
  } finally {
    await renderer?.destroy();
    globalThis.Phaser = prior;
  }
});

test('Riy coverage faces rear for Sweeper, forward for Breaker and hides during Focus', async () => {
  const { createOverflightRiyProject, compileOverflightRiyProject } = await import(
    '../overflight/riy-project.mjs'
  );
  const { createOverflightRiy } = await import('../overflight/riy-core.mjs');
  const environment = fakeEnvironment(),
    prior = globalThis.Phaser;
  globalThis.Phaser = environment.Phaser;
  const appearance = {
    reducedEffects: false,
    playerSlot: 'player.scout.detailed',
    snapshot: { image: () => ({ image: {}, asset: { id: 'accepted-scout' } }) },
  };
  let renderer;
  try {
    renderer = await createOverflightRenderer({
      parent: { ownerDocument: environment.document },
      appearance,
    });
    const run = createOverflightRun(
      compileOverflightRiyProject(createOverflightRiyProject({ rulesVersion: 3 })),
    );
    startOverflight(run);
    run.riy = createOverflightRiy(run);
    for (const escort of run.riy.escorts) {
      escort.formationHeading = 0;
      escort.followArc = 120;
      escort.heading = Math.PI / 2;
    }
    const cues = () =>
      environment.images.filter(
        (image) =>
          image.Depth?.[0] === 65 &&
          image.Visible?.[0] &&
          image.Frame?.[0] === 'bar' &&
          image.displayWidth === 12 &&
          image.displayHeight === 2,
      );
    for (const phase of ['follow', 'approach', 'engaged', 'returning']) {
      run.riy.phase = phase;
      const before = structuredClone(run.riy);
      renderer.present(run);
      const visible = cues();
      if (['approach', 'engaged'].includes(phase)) assert.equal(visible.length, 0);
      else {
        assert.equal(visible.length, 4);
        for (const [index, escort] of run.riy.escorts.entries()) {
          const roleCues = visible.slice(index * 2, index * 2 + 2);
          assert.ok(
            roleCues.every((image) =>
              escort.role === 'sweeper'
                ? image.Position[0] < escort.x
                : image.Position[0] > escort.x,
            ),
          );
        }
      }
      appearance.reducedEffects = true;
      renderer.present(run);
      assert.equal(cues().length, visible.length);
      assert.deepEqual(run.riy, before);
    }
  } finally {
    await renderer?.destroy();
    globalThis.Phaser = prior;
  }
});

test('paged atlas packing stays deterministic, non-overlapping and device-bounded', () => {
  const inventory = overflightAtlasInventory({ maxTextureSize: 512 });
  assert.ok(inventory.pages.length > 1);
  assert.deepEqual(inventory, overflightAtlasInventory({ maxTextureSize: 512 }));
  assert.equal(
    inventory.spriteRGBABytes,
    inventory.pages.reduce((sum, page) => sum + page.width * page.height * 4, 0),
  );
  assert.equal(inventory.textures, inventory.pages.length + 1);
  for (const page of inventory.pages) {
    assert.ok(page.width <= 512 && page.height <= 512);
    for (let i = 0; i < page.frames.length; i++) {
      const a = page.frames[i];
      assert.equal(a.page, page.index);
      assert.ok(
        a.x >= 2 &&
          a.y >= 2 &&
          a.x + a.width + 2 <= page.width &&
          a.y + a.height + 2 <= page.height,
      );
      for (const b of page.frames.slice(i + 1))
        assert.ok(
          a.x + a.width + 4 <= b.x ||
            b.x + b.width + 4 <= a.x ||
            a.y + a.height + 4 <= b.y ||
            b.y + b.height + 4 <= a.y,
        );
    }
  }
  assert.throws(
    () =>
      packOverflightAtlasFrames([{ id: 'too-big', width: 512, height: 32 }], {
        maxTextureSize: 512,
      }),
    /exceeds device/,
  );
  assert.throws(
    () =>
      packOverflightAtlasFrames(
        Array.from({ length: 3000 }, (_, id) => ({
          id,
          width: 64,
          height: 64,
        })),
      ),
    /32 MiB/,
  );
});

test('low-capability device routes frames across retained pages and releases every canvas', async () => {
  const environment = fakeEnvironment({ maxTextureSize: 512 }),
    prior = globalThis.Phaser;
  globalThis.Phaser = environment.Phaser;
  let renderer;
  try {
    renderer = await createOverflightRenderer({
      parent: { ownerDocument: environment.document },
      appearance: { snapshot: { image: () => ({ image: {} }) } },
    });
    const run = createOverflightRun(compileOverflightProject(createOverflightProject()), {
      seed: 23,
    });
    startOverflight(run);
    for (let i = 0; i < 180; i++) stepOverflight(run, { x: 1, y: 0 });
    renderer.present(run);
    const info = renderer.stats().atlas;
    assert.ok(info.pages.length > 1);
    assert.equal(environment.counts().textureUploads, info.textures);
    const routed = environment.images
      .filter((entry) => entry.Texture)
      .map((entry) => entry.Texture[0]);
    assert.ok(new Set(routed).size > 1, 'different frame sizes use the appropriate page');
    const before = environment.counts();
    environment.game().renderer.emit('lose');
    environment.game().renderer.emit('restore');
    renderer.present(run);
    assert.deepEqual(environment.counts(), before);
    await renderer.destroy();
    assert.ok(environment.canvases.every((canvas) => canvas.width === 0 && canvas.height === 0));
  } finally {
    await renderer?.destroy();
    globalThis.Phaser = prior;
  }
});

test('world art is prepared in bounded retained tiles once, including failure cleanup', async () => {
  const { createOverflightWorldPresentation } = await import('../overflight/worlds.mjs');
  const presentation = createOverflightWorldPresentation('freight-depot');
  const customMaterial = { width: 32, height: 32 },
    customRail = { width: 32, height: 32 };
  const environment = fakeEnvironment(),
    prior = globalThis.Phaser;
  globalThis.Phaser = environment.Phaser;
  let renderer;
  try {
    renderer = await createOverflightRenderer({
      parent: { ownerDocument: environment.document },
      appearance: {
        snapshot: {
          image: (slot) =>
            slot === 'world.overflight.material.concrete'
              ? { image: customMaterial }
              : slot === 'world.overflight.prop.rail'
                ? { image: customRail }
                : slot.startsWith('player.')
                  ? { image: {} }
                  : null,
        },
      },
      presentation,
      arena: { width: 2880, height: 1080 },
    });
    const stats = renderer.stats();
    const raw = renderer.stats({ raw: true });
    assert.deepEqual(raw.atlas, stats.atlas, 'raw timing exports keep the bounded atlas summary');
    assert.equal(raw.atlas.frames, undefined);
    assert.ok(raw.atlas.pages.every((page) => !page.frames && page.frameCount > 0));
    assert.equal(stats.atlas.worldTiles.length, 6);
    assert.ok(environment.draws.some(([image]) => image === customMaterial));
    assert.ok(environment.draws.some(([image]) => image === customRail));
    assert.equal(stats.atlas.worldRGBABytes, 2880 * 1080 * 4);
    assert.equal(stats.atlas.groundRGBABytes, 0);
    assert.equal(stats.atlas.retainedCanvasBytes, stats.atlas.baseRGBABytes);
    assert.ok(stats.atlas.spriteRGBABytes < OVERFLIGHT_ATLAS_BUDGET);
    assert.equal(environment.images.filter((image) => image.Depth?.[0] === 0).length, 6);
    const run = createOverflightRun(compileOverflightProject(createOverflightProject()));
    const baked = environment.counts();
    renderer.present(run);
    assert.deepEqual(environment.counts(), baked, 'ground never repaints in live presentation');
    await renderer.destroy();
    assert.ok(environment.canvases.every((canvas) => !canvas.width && !canvas.height));
    await assert.rejects(
      () =>
        createOverflightRenderer({
          parent: { ownerDocument: environment.document },
          appearance: {},
        }),
      /selected native player artwork/,
    );
    assert.ok(
      environment.canvases.every((canvas) => !canvas.width && !canvas.height),
      'failed preparation releases every allocated page',
    );
  } finally {
    await renderer?.destroy();
    globalThis.Phaser = prior;
  }
});

test('ten world renderer lifecycles preserve reference and stress coverage and release every retained page', async () => {
  const { createOverflightWorldPresentation } = await import('../overflight/worlds.mjs');
  const prior = globalThis.Phaser;
  try {
    for (let retry = 0; retry < 10; retry++) {
      const world = ['field-crossing', 'freight-depot', 'relay-ruins'][retry % 3];
      const environment = fakeEnvironment({ maxTextureSize: retry % 2 ? 512 : 2048 });
      globalThis.Phaser = environment.Phaser;
      let renderer;
      try {
        renderer = await createOverflightRenderer({
          parent: { ownerDocument: environment.document },
          appearance: { snapshot: { image: () => ({ image: {} }) } },
          presentation: createOverflightWorldPresentation(world),
          arena: { width: 2880, height: 1080 },
        });
        const run = createOverflightRun(
          compileOverflightProject(createOverflightProject({ rulesVersion: 3, world })),
          { fixture: retry % 2 ? 'stress' : 'reference' },
        );
        startOverflight(run);
        const prepared = environment.counts();
        renderer.present(run);
        const alive = retry % 2 ? 2500 : 1500;
        const visible = retry % 2 ? 1200 : 700;
        assert.equal(renderer.stats().counts.alive, alive);
        assert.equal(renderer.stats().counts.rendered, visible);
        assert.deepEqual(environment.counts(), prepared);
        environment.game().renderer.emit('lose');
        assert.equal(renderer.stats().lost, true);
        environment.game().renderer.emit('restore');
        renderer.present(run);
        assert.equal(renderer.stats().lost, false);
        assert.equal(renderer.stats().counts.rendered, visible);
        assert.deepEqual(
          environment.counts(),
          prepared,
          'retained sources do not repaint or upload',
        );
        renderer.resetMeasurements();
        assert.equal(renderer.stats().highWater.visible, 0);
        renderer.present(run);
        assert.equal(renderer.stats().counts.rendered, visible);
        await renderer.destroy();
        await renderer.destroy();
        assert.equal(environment.counts().disposedCanvases, 1);
        assert.ok(environment.canvases.every((canvas) => !canvas.width && !canvas.height));
        assert.equal(environment.game().renderer.listenerCount('lose'), 0);
        assert.equal(environment.game().renderer.listenerCount('restore'), 0);
      } finally {
        await renderer?.destroy();
      }
    }
  } finally {
    globalThis.Phaser = prior;
  }
});

test('accepted Studio actor images and Motion clips bake once and feed native upgrade previews', async () => {
  const { createSoldierAnimation } = await import('../presentation/actor-animation.mjs');
  const { prepareOverflightActorOverrides } = await import('../overflight/actor-overrides.mjs');
  const descriptor = structuredClone(createSoldierAnimation('review-runner', ['boots', 'torso']));
  descriptor.rig = 'sprite.v1';
  descriptor.frames = [
    {
      id: 'a',
      durationMs: 80,
      stride: 0,
      breath: 0,
      accessory: 0,
      region: { x: 0, y: 0, width: 32, height: 32 },
    },
    {
      id: 'b',
      durationMs: 160,
      stride: 0,
      breath: 0,
      accessory: 0,
      region: { x: 32, y: 0, width: 32, height: 32 },
    },
  ];
  for (const clip of Object.keys(descriptor.clips))
    descriptor.clips[clip] = { frames: ['a', 'b'], loop: true };
  const soldierImage = { width: 64, height: 32 },
    machineImage = { width: 64, height: 64 };
  const soldier = {
    image: soldierImage,
    asset: {
      id: 'review-runner',
      revision: 2,
      kind: 'image',
      animation: descriptor,
      file: { width: 64, height: 32, sha256: 'a'.repeat(64) },
    },
  };
  const machine = {
    image: machineImage,
    asset: {
      id: 'review-tank',
      revision: 4,
      kind: 'image',
      file: { width: 64, height: 64, sha256: 'b'.repeat(64) },
    },
  };
  const snapshot = {
    image: (id) =>
      id.startsWith('player.')
        ? { image: {} }
        : id === 'overflight.soldier.runner.tactical'
          ? soldier
          : id === 'enemy.eroder'
            ? machine
            : null,
  };
  const overrides = prepareOverflightActorOverrides(snapshot);
  const enemy = { id: 0, family: 'runner', wardrobe: 0 };
  const moving = { state: 'moving', clip: 'move', elapsed: 0 };
  assert.match(overrides.frame(enemy, 0.079, false, 'authored', moving), /:move:0$/);
  assert.match(overrides.frame(enemy, 0.08, false, 'authored', moving), /:move:1$/);
  assert.match(overrides.frame(enemy, 0.24, false, 'authored', moving), /:move:0$/);
  assert.match(overrides.frame(enemy, 0.12, true, 'authored', moving), /:move:0$/);
  assert.match(
    overrides.frame(enemy, 100, false, 'authored', {
      state: 'preparing',
      clip: 'anticipation',
      elapsed: 0.09,
    }),
    /:anticipation:1$/,
  );
  assert.equal(overrides.frame(enemy, 0, false, 'rivals', moving), null);
  const environment = fakeEnvironment(),
    prior = globalThis.Phaser;
  globalThis.Phaser = environment.Phaser;
  let renderer;
  try {
    renderer = await createOverflightRenderer({
      parent: { ownerDocument: environment.document },
      appearance: { snapshot },
    });
    assert.ok(environment.draws.some(([image, x]) => image === soldierImage && x === 32));
    assert.ok(environment.draws.some(([image]) => image === machineImage));
    assert.equal(renderer.stats().atlas.acceptedActorOverrides.length, 2);
    assert.equal(renderer.stats().atlas.customActorFrames, 13);
    const run = createOverflightRun(compileOverflightProject(createOverflightProject()), {
      fixture: 'reference',
    });
    startOverflight(run);
    const before = structuredClone(run),
      baked = environment.counts();
    renderer.present(run);
    assert.deepEqual(run, before, 'custom appearance does not alter damage or simulation');
    assert.deepEqual(environment.counts(), baked);
    const preview = [];
    const ctx = new Proxy(
      { drawImage: (...args) => preview.push(args) },
      {
        get: (target, key) => target[key] ?? (() => {}),
      },
    );
    renderer.paintPreviewSprite(ctx, 'runner', 10, 10, 20, 0.09);
    renderer.paintPreviewSprite(ctx, 'machine', 10, 10, 20, 0.09);
    assert.equal(preview.length, 2, 'custom-only atlas frames also feed upgrade demos');
    environment.game().renderer.emit('lose');
    environment.game().renderer.emit('restore');
    renderer.present(run);
    assert.deepEqual(environment.counts(), baked);
  } finally {
    await renderer?.destroy();
    globalThis.Phaser = prior;
  }
});

test('all eighteen selected-world inventories keep exact texture accounting without multiplying sprite atlases', async () => {
  const { OVERFLIGHT_BATTLEFIELDS } = await import('../overflight/battlefields.mjs');
  const { overflightWorldImageSlots } = await import('../presentation/overflight-world-slots.mjs');
  for (const maxTextureSize of [2048, 512]) {
    const sprites = overflightAtlasInventory({ maxTextureSize });
    for (const layout of OVERFLIGHT_BATTLEFIELDS) {
      const compiled = compileOverflightProject(
        createOverflightProject({ rulesVersion: 4, layout: layout.id }),
      );
      const inventory = overflightAtlasInventory({
        maxTextureSize,
        presentation: compiled.presentation,
        arena: compiled.arena,
      });
      assert.equal(compiled.presentation.format, 'OverflightWorldPresentationV2');
      assert.equal(inventory.frames.length, sprites.frames.length);
      assert.deepEqual(
        inventory.pages,
        sprites.pages,
        'world artwork does not duplicate actor frames',
      );
      assert.equal(inventory.worldTiles.length, maxTextureSize === 2048 ? 6 : 18);
      assert.equal(inventory.worldRGBABytes, 2880 * 1080 * 4);
      assert.equal(inventory.groundRGBABytes, 0);
      assert.equal(inventory.baseRGBABytes, inventory.spriteRGBABytes + inventory.worldRGBABytes);
      assert.equal(inventory.retainedCanvasBytes, inventory.baseRGBABytes);
      assert.equal(inventory.preparationScratchBytes, 64 * 64 * 4);
      assert.ok(inventory.baseRGBABytes < OVERFLIGHT_ATLAS_BUDGET);
      assert.ok(
        inventory.worldTiles.every(
          (tile) => tile.width <= maxTextureSize && tile.height <= maxTextureSize,
        ),
      );
      const slots = overflightWorldImageSlots(compiled.presentation);
      assert.ok(slots.length > 0 && slots.length < 20, 'one selected kit stays bounded');
      assert.equal(new Set(slots).size, slots.length);
    }
  }
});

test('ten V4 world lifecycles retain custom panels, recover all pages and release every selected-scene canvas', async () => {
  const { OVERFLIGHT_BATTLEFIELDS } = await import('../overflight/battlefields.mjs');
  const { overflightWorldImageSlots } = await import('../presentation/overflight-world-slots.mjs');
  const prior = globalThis.Phaser;
  const worlds = new Set();
  try {
    for (let retry = 0; retry < 10; retry++) {
      const layout = OVERFLIGHT_BATTLEFIELDS[(retry * 5) % OVERFLIGHT_BATTLEFIELDS.length];
      worlds.add(layout.world);
      const compiled = compileOverflightProject(
        createOverflightProject({ rulesVersion: 4, layout: layout.id }),
      );
      const selected = new Set(overflightWorldImageSlots(compiled.presentation));
      const worldImages = new Map(
        [...selected].map((slot) => [slot, { width: 32, height: 32, slot }]),
      );
      const used = new Set();
      const environment = fakeEnvironment({ maxTextureSize: retry % 2 ? 512 : 2048 });
      globalThis.Phaser = environment.Phaser;
      let renderer;
      try {
        renderer = await createOverflightRenderer({
          parent: { ownerDocument: environment.document },
          appearance: {
            snapshot: {
              image: (slot) => {
                if (slot.startsWith('player.')) return { image: {} };
                if (!slot.startsWith('world.overflight.')) return null;
                assert.ok(
                  selected.has(slot),
                  `${layout.id} requests only its selected scene sources: ${slot}`,
                );
                used.add(slot);
                return { image: worldImages.get(slot) };
              },
            },
          },
          presentation: compiled.presentation,
          arena: compiled.arena,
        });
        assert.deepEqual(used, selected);
        assert.ok(
          environment.draws.some(([image]) => image?.slot?.startsWith('world.overflight.module.')),
        );
        const atlas = renderer.stats().atlas;
        assert.equal(environment.counts().textureUploads, atlas.textures);
        assert.equal(
          environment.canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height * 4, 0),
          atlas.retainedCanvasBytes,
          'owned retained canvas bytes match the atlas report after scratch cleanup',
        );
        const run = createOverflightRun(compiled, { fixture: retry % 2 ? 'stress' : 'reference' });
        startOverflight(run);
        const prepared = environment.counts();
        renderer.present(run);
        const visible = retry % 2 ? 1200 : 700;
        assert.equal(renderer.stats().counts.rendered, visible);
        environment.game().renderer.emit('lose');
        assert.equal(renderer.stats().lost, true);
        environment.game().renderer.emit('restore');
        renderer.present(run);
        assert.equal(renderer.stats().lost, false);
        assert.equal(renderer.stats().counts.rendered, visible);
        renderer.resetMeasurements();
        renderer.present(run);
        assert.deepEqual(
          environment.counts(),
          prepared,
          'presentation, recovery and retry reuse prepared pixels',
        );
        await renderer.destroy();
        await renderer.destroy();
        assert.ok(
          environment.canvases.every((canvas) => canvas.width === 0 && canvas.height === 0),
        );
        assert.equal(environment.counts().disposedCanvases, 1);
        assert.equal(environment.game().renderer.listenerCount('lose'), 0);
        assert.equal(environment.game().renderer.listenerCount('restore'), 0);
      } finally {
        await renderer?.destroy();
      }
    }
    assert.equal(worlds.size, 6, 'the retry sequence covers every new world kit');
  } finally {
    globalThis.Phaser = prior;
  }
});
