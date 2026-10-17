import {
  overflightTacticalEnemyLayers,
  overflightAttackLayers,
  overflightCacheLayers,
  overflightFinalTargetLayers,
  overflightPendingPayloadLayers,
  overflightEscortShotLayers,
} from './tactical-view.mjs';
import { bakeOverflightAtlas, OVERFLIGHT_HERO_FRAMES } from './atlas.mjs';
import { createOverflightPresentationState } from './presentation-state.mjs';
import { createOverflightBenchmark, insideOverflightCamera } from './benchmark.mjs';
import { OVERFLIGHT_MACHINERY } from './project.mjs';
import { overflightHuntEnemyLayers, overflightHuntStrikeLayers } from './raid-render-cues.mjs';
import { overflightEffectLayers } from '../presentation/overflight-motion.mjs';
import {
  createOverflightRemains,
  overflightRemainsFrame,
  OVERFLIGHT_REMAINS_LIMITS,
} from './remains.mjs';

let phaserLoad = null,
  rendererSequence = 0;
function loadPhaser(document) {
  if (globalThis.Phaser) return Promise.resolve(globalThis.Phaser);
  if (!phaserLoad)
    phaserLoad = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('../vendor/phaser-4.2.1.min.js', import.meta.url).href;
      script.onload = () =>
        globalThis.Phaser
          ? resolve(globalThis.Phaser)
          : reject(new Error('Phaser did not initialize.'));
      script.onerror = () => {
        phaserLoad = null;
        script.remove();
        reject(new Error('The local Phaser renderer could not load.'));
      };
      document.head.append(script);
    });
  return phaserLoad;
}

function registerTexture(scene, Phaser, key, canvas, frames = []) {
  const texture = scene.textures.create(key, canvas, canvas.width, canvas.height);
  if (!texture) throw new Error('Overflight atlas registration failed.');
  texture.add('__BASE', 0, 0, 0, canvas.width, canvas.height);
  for (const frame of frames) texture.add(frame.id, 0, frame.x, frame.y, frame.width, frame.height);
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return texture;
}

function imagePool(scene, textureForFrame, depth) {
  const images = [];
  let used = 0,
    previouslyUsed = 0;
  return {
    begin() {
      used = 0;
    },
    take(frame, x, y, width, height = width, tint = 0xffffff, alpha = 1, rotation = 0) {
      const key = textureForFrame(frame);
      let entry = images[used];
      if (!entry)
        images[used] = entry = {
          image: scene.add.image(0, 0, key, frame).setDepth(depth),
        };
      const image = entry.image,
        changed = entry.frame !== frame || entry.key !== key;
      if (entry.key !== key) image.setTexture(key, frame);
      else if (changed) image.setFrame(frame);
      if (changed || entry.width !== width || entry.height !== height)
        image.setDisplaySize(width, height);
      if (entry.tint !== tint) image.setTint(tint);
      if (entry.alpha !== alpha) image.setAlpha(alpha);
      entry.key = key;
      entry.frame = frame;
      entry.width = width;
      entry.height = height;
      entry.tint = tint;
      entry.alpha = alpha;
      image.setPosition(x, y).setRotation(rotation).setVisible(true);
      used++;
      return image;
    },
    end() {
      for (let index = used; index < previouslyUsed; index++) images[index].image.setVisible(false);
      previouslyUsed = used;
    },
    size: () => images.length,
    used: () => used,
  };
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const colors = Object.freeze({
  amber: 0xf4c765,
  cyan: 0x9aebda,
  danger: 0xf9a275,
  impact: 0xffde97,
  white: 0xf2f5d9,
});

/** A dedicated WebGL scene owns only presentation. Every live enemy remains in
 * the simulation; all visible silhouettes are submitted, with no actor sampler
 * or 64-actor limit. No painting, readback or texture upload occurs in present. */
export async function createOverflightRenderer({
  parent,
  appearance,
  presentation = null,
  arena = { width: 2880, height: 1080 },
  onFrame = () => {},
  onContextLost = () => {},
  onContextRestored = () => {},
  onError = () => {},
}) {
  if (!parent?.ownerDocument) throw new TypeError('Overflight renderer needs a parent element.');
  const document = parent.ownerDocument;
  if (document.readyState === 'loading')
    await new Promise((resolve) =>
      document.addEventListener('DOMContentLoaded', resolve, { once: true }),
    );
  const Phaser = await loadPhaser(document);
  if (Phaser.VERSION && Phaser.VERSION !== '4.2.1')
    throw new Error('Overflight requires the bundled Phaser 4.2.1 renderer.');
  const preparedAt = performance.now();
  let atlas;
  const previewFrames = new Map();
  const frameTextures = new Map();
  const textureForFrame = (frame) => frameTextures.get(frame);
  const presentationState = createOverflightPresentationState();
  const key = `overflight-art-${++rendererSequence}`,
    groundKey = `${key}-ground`;
  let benchmark = createOverflightBenchmark();
  let game, scene, pools, poolList, hero, heroShadow, ground;
  const worldImages = [];
  const remains = createOverflightRemains();
  let lost = false,
    destroyed = false,
    failed = false,
    destroyPromise = null;
  let current = null,
    renderStarted = 0,
    frameActive = false,
    presentMs = 0;
  let preparationMs = 0,
    contextLosses = 0,
    contextRestores = 0;
  let contextRecoveryTimer = null,
    contextRecoveryTests = 0;
  let previousHull = null,
    hitAt = -Infinity,
    previousHeading = null,
    previousTime = null,
    bank = 0;
  const counts = {
    alive: 0,
    visible: 0,
    rendered: 0,
    effects: 0,
    pickups: 0,
    warnings: 0,
    behaviorCues: 0,
    remains: 0,
    defeats: 0,
    quads: 0,
  };
  let resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const fail = (error) => {
    if (failed || destroyed) return;
    failed = true;
    frameActive = false;
    benchmark.exclude('error');
    onError(error);
  };
  const onLost = () => {
    lost = true;
    contextLosses++;
    benchmark.exclude('context-lost');
    onContextLost();
  };
  const onRestored = () => {
    lost = false;
    contextRestores++;
    benchmark.exclude('context-restored');
    onContextRestored();
  };
  const onVisibility = () => {
    if (document.hidden) benchmark.exclude('hidden');
  };
  const preRender = () => {
    renderStarted = performance.now();
  };
  const postRender = () => {
    const now = performance.now();
    benchmark.frame(
      now,
      frameActive && !lost && !destroyed && !document.hidden,
      current?.phase,
      current?.time,
    );
    if (frameActive) benchmark.submission(presentMs + Math.max(0, now - renderStarted), now);
  };
  try {
    game = new Phaser.Game({
      type: Phaser.WEBGL,
      parent,
      width: 960,
      height: 540,
      backgroundColor: '#172a22',
      banner: false,
      pixelArt: true,
      roundPixels: true,
      antialias: false,
      render: { mipmapFilter: '', antialias: false, roundPixels: true },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 960,
        height: 540,
      },
      audio: { noAudio: true },
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      fps: { target: 60, forceSetTimeOut: false },
      scene: {
        create() {
          try {
            scene = this;
            if (this.game.renderer.type !== Phaser.WEBGL)
              throw new Error('Overflight requires WebGL; a Canvas fallback cannot run the horde.');
            const gl = this.game.renderer.gl;
            atlas = bakeOverflightAtlas(appearance, document, {
              maxTextureSize: gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 2048,
              presentation,
              arena,
            });
            for (const page of atlas.inventory.pages) {
              const pageKey = `${key}-${page.index}`;
              registerTexture(scene, Phaser, pageKey, atlas.pages[page.index], page.frames);
              for (const frame of page.frames) {
                previewFrames.set(frame.id, frame);
                frameTextures.set(frame.id, pageKey);
              }
            }
            if (atlas.ground) {
              registerTexture(scene, Phaser, groundKey, atlas.ground);
              ground = scene.add
                .tileSprite(0, 0, arena.width, arena.height, groundKey)
                .setOrigin(0)
                .setDepth(0);
            }
            for (const tile of atlas.worldTiles) {
              const tileKey = `${groundKey}-${tile.index}`;
              registerTexture(scene, Phaser, tileKey, tile.canvas);
              worldImages.push(scene.add.image(tile.x, tile.y, tileKey).setOrigin(0).setDepth(0));
            }
            pools = {
              remains: imagePool(scene, textureForFrame, 3),
              props: imagePool(scene, textureForFrame, 5),
              pickups: imagePool(scene, textureForFrame, 10),
              defeats: imagePool(scene, textureForFrame, 19),
              enemies: imagePool(scene, textureForFrame, 20),
              effects: imagePool(scene, textureForFrame, 30),
              projectiles: imagePool(scene, textureForFrame, 35),
              warnings: imagePool(scene, textureForFrame, 60),
              status: imagePool(scene, textureForFrame, 65),
              escorts: imagePool(scene, textureForFrame, 69),
              heroStatus: imagePool(scene, textureForFrame, 72),
            };
            poolList = Object.values(pools);
            heroShadow = scene.add
              .image(0, 0, textureForFrame('shadow'), 'shadow')
              .setDepth(38)
              .setAlpha(0.8);
            hero = scene.add.image(0, 0, textureForFrame('hero:0'), 'hero:0').setDepth(71);
            hero.setVisible(false);
            heroShadow.setVisible(false);
            this.game.canvas.tabIndex = -1;
            this.game.canvas.style.imageRendering = 'pixelated';
            this.game.renderer.on(Phaser.Renderer.Events.LOSE_WEBGL, onLost);
            this.game.renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, onRestored);
            this.game.events.on(Phaser.Core.Events.PRE_RENDER, preRender);
            this.game.events.on(Phaser.Core.Events.POST_RENDER, postRender);
            document.addEventListener('visibilitychange', onVisibility);
            preparationMs = performance.now() - preparedAt;
            resolveReady();
          } catch (error) {
            rejectReady(error);
          }
        },
        update() {
          if (destroyed || lost || failed) {
            frameActive = false;
            return;
          }
          presentMs = 0;
          try {
            onFrame(performance.now());
          } catch (error) {
            fail(error);
          }
          // A normal draft pauses simulation, not foreground rendering. Decide
          // after the host transition so card work and its complete render interval
          // remain measured; manual pause, hidden state and failures still interrupt.
          frameActive =
            (current?.phase === 'playing' || current?.phase === 'upgrade') &&
            !document.hidden &&
            !failed;
        },
      },
    });
    await ready;
  } catch (error) {
    if (game) {
      game.destroy(true, false);
      // Public step completes pending destruction without waiting for a hidden
      // document's RAF. This occurs outside the engine's current frame.
      game.step(performance.now(), 0);
    }
    atlas?.dispose();
    throw error;
  }

  function danger(x, y, radius, camera, time, arrival = false) {
    const tint = arrival ? colors.amber : colors.danger;
    if (insideOverflightCamera(x, y, camera, radius)) {
      for (const layer of overflightEffectLayers({
        kind: arrival ? 'arrival' : 'warning',
        radius,
      }))
        pools.warnings.take(
          layer.frame,
          x + layer.dx,
          y + layer.dy,
          layer.width,
          layer.height,
          layer.tint,
          layer.alpha,
          layer.rotation,
        );
    } else {
      const dx = x - camera.x,
        dy = y - camera.y;
      const amount = Math.min(
        (camera.width / 2 - 20) / Math.max(Math.abs(dx), 0.01),
        (camera.height / 2 - 32) / Math.max(Math.abs(dy), 0.01),
      );
      pools.warnings.take(
        'arrow',
        camera.x + dx * amount,
        camera.y + dy * amount,
        24,
        24,
        tint,
        1,
        Math.atan2(dy, dx),
      );
    }
  }

  function present(run) {
    if (destroyed || lost || failed || !run) return;
    const started = performance.now();
    if (current !== run) {
      previousHull = previousHeading = previousTime = null;
      hitAt = -Infinity;
      bank = 0;
      presentationState.reset();
    }
    current = run;
    const camera = run.camera;
    if (!camera || ![camera.x, camera.y, camera.width, camera.height].every(Number.isFinite))
      throw new TypeError('Overflight presentation requires a finite camera center and size.');
    const arena = run.project?.arena ?? run.compiled?.arena ?? { width: 2880, height: 1080 };
    scene.cameras.main.setBounds(0, 0, arena.width, arena.height).centerOn(camera.x, camera.y);
    if (ground && (ground.width !== arena.width || ground.height !== arena.height))
      ground.setSize(arena.width, arena.height);
    const reduced = appearance.reducedEffects === true;
    for (const pool of poolList) pool.begin();
    counts.alive = 0;
    counts.visible = 0;
    counts.rendered = 0;
    counts.behaviorCues = 0;
    const destruction = appearance.destruction ?? {};
    remains.consume(run);
    let movingRemains = 0;
    remains.visitVisible(camera, (mark) => {
      const age = Math.max(0, run.time - mark.time);
      const moving =
        !reduced &&
        run.phase !== 'won' &&
        run.phase !== 'lost' &&
        age < OVERFLIGHT_REMAINS_LIMITS.settleSeconds &&
        movingRemains < OVERFLIGHT_REMAINS_LIMITS.moving;
      const frame = overflightRemainsFrame(mark, destruction, appearance.cast);
      if (moving) {
        movingRemains++;
        pools.defeats.take(
          `${frame.replace(/^remains:/, 'defeat:')}:${Math.min(3, Math.floor(age / 0.08))}`,
          mark.x,
          mark.y,
          (mark.size * 64) / 48,
          (mark.size * 64) / 48,
          0xffffff,
          0.92,
          mark.heading,
        );
      }
      if (destruction.showRemains !== false)
        pools.remains.take(
          frame,
          mark.x,
          mark.y,
          mark.size,
          mark.size,
          0xffffff,
          moving ? 0.35 : 0.72,
          mark.heading,
        );
    });
    for (const enemy of run.enemies) {
      if (!enemy.active) continue;
      counts.alive++;
      if (insideOverflightCamera(enemy.x, enemy.y, camera)) counts.visible++;
      const state = presentationState.enemy(enemy, run.time);
      const machine = OVERFLIGHT_MACHINERY.includes(enemy.family);
      const size = enemy.heavy ? (machine ? 54 : 32) : machine ? 32 : enemy.specialist ? 23 : 21;
      if (!run.hunt && !run.goals?.finalDefeated && enemy.id === run.goals?.finalId)
        // Objective navigation stays below hostile warnings and the player.
        for (const cue of overflightFinalTargetLayers(
          enemy,
          camera,
          atlas.enemyFrame(enemy, run.time, true, appearance.cast, state),
        ))
          pools.effects.take(
            cue.frame,
            cue.x,
            cue.y,
            cue.width,
            cue.height,
            cue.tint,
            cue.alpha,
            cue.rotation,
          );
      if (insideOverflightCamera(enemy.x, enemy.y, camera, size)) {
        pools.enemies.take(
          atlas.enemyFrame(enemy, run.time, reduced, appearance.cast, state),
          enemy.x,
          enemy.y,
          size,
          size,
          0xffffff,
          enemy.warning > 0 ? 0.55 : 1,
          state.heading + Math.PI / 2,
        );
        counts.rendered++;
        const behaviorCueStart = pools.status.used();
        const phase = enemy.behaviorPhase;
        // Body-local marks communicate behavior without painting hundreds of
        // attack-range circles. These state cues remain in both quality
        // settings and never depend on cosmetic animation or flashing.
        const crosscut =
          enemy.movementPreset === 'crosscut' || enemy.movementPreset === 'crosscut-interceptor';
        const preparingMovement = crosscut && enemy.movementPhase === 'preparing';
        const committedMovement = crosscut && enemy.movementPhase === 'committed';
        if (phase === 'windup' || phase === 'burst' || preparingMovement || committedMovement) {
          const heading =
              preparingMovement || committedMovement ? state.heading : (enemy.heading ?? 0),
            distance = size * 0.55;
          pools.status.take(
            'arrow',
            enemy.x + Math.cos(heading) * distance,
            enemy.y + Math.sin(heading) * distance,
            phase === 'windup' || preparingMovement ? 16 : 24,
            phase === 'windup' || preparingMovement ? 16 : 24,
            phase === 'windup' || preparingMovement ? colors.amber : colors.danger,
            1,
            heading,
          );
        }
        if (enemy.supportRadius > 0) {
          pools.status.take(
            enemy.family === 'radar-truck' ? 'pickup.module-scanner' : 'pickup.support-marker',
            enemy.x + size * 0.4,
            enemy.y + size * 0.35,
            14,
          );
          if (phase === 'rally-warning')
            pools.status.take('ring', enemy.x, enemy.y, size + 4, size + 4, colors.amber, 0.9);
          else if (phase === 'rally') {
            const heading = Math.atan2(enemy.rallyY - enemy.y, enemy.rallyX - enemy.x);
            pools.status.take(
              'arrow',
              enemy.x + Math.cos(heading) * size * 0.6,
              enemy.y + Math.sin(heading) * size * 0.6,
              22,
              22,
              colors.danger,
              1,
              heading,
            );
          }
        }
        if (enemy.rewardTarget)
          pools.status.take(
            'pickup.salvage-small',
            enemy.x - size * 0.4,
            enemy.y + size * 0.35,
            12,
          );
        if (run.hunt) {
          for (const cue of overflightHuntEnemyLayers(enemy, size))
            pools.status.take(
              cue.frame,
              enemy.x + cue.dx,
              enemy.y + cue.dy,
              cue.width,
              cue.height,
              cue.tint,
              cue.alpha ?? 1,
              cue.rotation ?? 0,
            );
        }
        if (!run.hunt && (enemy.maxGuardIntegrity > 0 || enemy.maxArmor > 0))
          for (const cue of overflightTacticalEnemyLayers(
            enemy,
            size,
            run.hunt ? null : run.player,
          ))
            pools.status.take(
              cue.frame,
              cue.x,
              cue.y,
              cue.width,
              cue.height,
              cue.tint,
              cue.alpha,
              cue.rotation,
            );
        counts.behaviorCues += pools.status.used() - behaviorCueStart;
        if (
          !run.hunt &&
          (enemy.heavy || enemy.specialist || enemy.role === 'final') &&
          enemy.maxHp > 0
        ) {
          const width = enemy.heavy ? 34 : 22,
            health = clamp(enemy.hp / enemy.maxHp, 0, 1);
          pools.status.take('bar', enemy.x, enemy.y - size / 2 - 5, width + 2, 4, 0x09120f);
          if (health > 0)
            pools.status.take(
              'bar',
              enemy.x - (width * (1 - health)) / 2,
              enemy.y - size / 2 - 5,
              width * health,
              2,
              enemy.role === 'final' ? colors.danger : colors.amber,
            );
        }
        if (enemy.markUntil > run.tick)
          pools.status.take('ring', enemy.x, enemy.y, size + 5, size + 5, colors.cyan, 0.8);
        if (enemy.warning > 0)
          danger(enemy.x, enemy.y, Math.max(10, enemy.radius * 1.5), camera, run.time, true);
      }
      if (!run.priorityAttacks && enemy.attackWarning > 0)
        danger(
          enemy.attackX ?? enemy.x,
          enemy.attackY ?? enemy.y,
          enemy.attackRadius ?? enemy.radius * 3,
          camera,
          run.time,
        );
    }
    if (run.hunt) {
      // One objective pointer and one optional opportunity; never hundreds of edge arrows.
      for (const optional of [false, true]) {
        let nearest = null,
          distance = Infinity;
        for (const enemy of run.enemies) {
          if (!enemy.active || (optional ? enemy.behavior !== 'courier' : !enemy.objectiveId))
            continue;
          if (insideOverflightCamera(enemy.x, enemy.y, camera, 24)) continue;
          const next = Math.hypot(enemy.x - run.player.x, enemy.y - run.player.y);
          if (next < distance) {
            nearest = enemy;
            distance = next;
          }
        }
        if (nearest) danger(nearest.x, nearest.y, 16, camera, run.time, !optional);
      }
    }
    for (const attack of run.priorityAttacks ?? []) {
      if (!attack.active) continue;
      if (['lane', 'fan'].includes(attack.kind) || attack.stage === 'active') {
        for (const cue of overflightAttackLayers(attack))
          pools.warnings.take(
            cue.frame,
            cue.x,
            cue.y,
            cue.width,
            cue.height,
            cue.tint,
            cue.alpha,
            cue.rotation,
          );
      } else danger(attack.x, attack.y, attack.radius, camera, run.time);
    }
    for (const pickup of run.pickups ?? []) {
      if (!pickup.active || !insideOverflightCamera(pickup.x, pickup.y, camera, 8)) continue;
      pools.pickups.take(
        pickup.value > 2 ? 'pickup.salvage-cluster' : 'pickup.salvage-small',
        pickup.x,
        pickup.y,
        pickup.value > 2 ? 13 : 11,
      );
    }
    for (const obstacle of run.terrain?.obstacles ?? []) {
      // V2 permanent cover is baked from the shared modular art at preparation.
      // Breakable barriers remain dynamic and keep their damage-state marks.
      if (
        !obstacle.breakable &&
        run.compiled?.presentation?.format === 'OverflightWorldPresentationV2' &&
        run.compiled.presentation.assemblies.some((item) => item.coverId === obstacle.id)
      )
        continue;
      const x = obstacle.x + obstacle.width / 2,
        y = obstacle.y + obstacle.height / 2;
      if (!insideOverflightCamera(x, y, camera, Math.max(obstacle.width, obstacle.height)))
        continue;
      const alpha = obstacle.active ? 1 : 0.28;
      pools.props.take(
        'bar',
        x + 4,
        y + 5,
        obstacle.width + 6,
        obstacle.height + 6,
        0x14201d,
        alpha,
      );
      pools.props.take(
        'bar',
        x,
        y,
        obstacle.width,
        obstacle.height,
        obstacle.breakable ? 0x625640 : 0x414d48,
        alpha,
      );
      pools.props.take(
        'bar',
        x,
        obstacle.y + 2,
        obstacle.width,
        4,
        obstacle.breakable ? 0xa69569 : 0x899486,
        alpha,
      );
      pools.props.take('bar', obstacle.x + 2, y, 4, obstacle.height, 0x778373, alpha);
      for (let row = 1; row < 4; row++)
        pools.props.take(
          'bar',
          x,
          obstacle.y + (obstacle.height * row) / 4,
          obstacle.width - 8,
          3,
          0x26352e,
          alpha,
        );
      if (obstacle.active && obstacle.breakable) {
        for (let plate = 0; plate < obstacle.hp; plate++)
          pools.status.take('bar', x - 6 + plate * 12, obstacle.y - 8, 8, 4, colors.amber);
        if (obstacle.hp === 1)
          pools.props.take('bar', x, y, obstacle.height * 0.7, 4, 0x14201d, 1, Math.PI / 3);
      }
    }
    for (const prop of run.props ?? run.project?.props ?? run.compiled?.props ?? []) {
      if (insideOverflightCamera(prop.x, prop.y, camera, 20))
        pools.props.take(
          prop.opened || prop.open ? 'pickup.supply-case-open' : 'pickup.supply-case-closed',
          prop.x,
          prop.y,
          26,
        );
    }
    for (const cache of run.caches ?? []) {
      if (!insideOverflightCamera(cache.x, cache.y, camera, 100)) continue;
      for (const cue of overflightCacheLayers(cache))
        pools.status.take(
          cue.frame,
          cue.x,
          cue.y,
          cue.width,
          cue.height,
          cue.tint,
          cue.alpha,
          cue.rotation,
        );
    }
    for (const payload of run._echoes ?? []) {
      if (!payload.active) continue;
      for (const cue of overflightPendingPayloadLayers(payload)) {
        if (!insideOverflightCamera(cue.x, cue.y, camera, Math.max(cue.width, cue.height)))
          continue;
        pools.effects.take(
          cue.frame,
          cue.x,
          cue.y,
          cue.width,
          cue.height,
          cue.tint,
          cue.alpha,
          cue.rotation,
        );
      }
    }
    for (const effect of run.effects ?? []) {
      if (!effect.active) continue;
      // The simulation queue supplies all actual fan/echo footprints above.
      if (effect.kind === 'drop-warning' && run._echoes) continue;
      const radius = effect.radius ?? 20;
      if (effect.kind === 'warning') {
        danger(effect.x, effect.y, radius, camera, run.time);
        continue;
      }
      if (!insideOverflightCamera(effect.x, effect.y, camera, radius + 20)) continue;
      for (const layer of overflightEffectLayers({
        ...effect,
        reducedEffects: reduced,
      }))
        (layer.priority ? pools.warnings : pools.effects).take(
          layer.frame,
          effect.x + layer.dx,
          effect.y + layer.dy,
          layer.width,
          layer.height,
          layer.tint,
          layer.alpha,
          layer.rotation,
        );
    }
    for (const projectile of run.projectiles ?? []) {
      if (!projectile.active) continue;
      if (insideOverflightCamera(projectile.x, projectile.y, camera, 10))
        pools.projectiles.take(
          'disc',
          projectile.x,
          projectile.y,
          projectile.hostile ? 7 : 13,
          projectile.hostile ? 7 : 5,
          projectile.hostile ? colors.danger : colors.amber,
          1,
          Math.atan2(projectile.vy ?? 0, projectile.vx ?? 1),
        );
      else if (projectile.hostile) danger(projectile.x, projectile.y, 7, camera, run.time);
    }
    for (const trail of run.riy?.trails ?? []) {
      if (!trail.active || !insideOverflightCamera(trail.x, trail.y, camera, trail.radius))
        continue;
      pools.effects.take(
        'ring',
        trail.x,
        trail.y,
        trail.radius * 2,
        trail.radius * 2,
        colors.cyan,
        0.35,
      );
    }
    for (const escort of run.riy?.escorts ?? []) {
      const tint = escort.role === 'sweeper' ? colors.cyan : colors.amber;
      pools.escorts.take(
        `escort:${escort.role}:${reduced ? 0 : Math.floor(run.time * 60) % OVERFLIGHT_HERO_FRAMES}`,
        escort.x,
        escort.y,
        44,
        44,
        tint,
        1,
        escort.heading + Math.PI / 2,
      );
      pools.status.take(
        'bar',
        escort.x,
        escort.y + 18,
        escort.role === 'sweeper' ? 14 : 6,
        3,
        tint,
      );
      if (run.riy?.rules?.followArc || escort.followArc) {
        const arc = ((escort.followArc ?? 120) * Math.PI) / 180;
        const facing =
          (escort.formationHeading ?? escort.heading) + (escort.role === 'sweeper' ? Math.PI : 0);
        const phase = run.riy.phase;
        const cueTint =
          phase === 'returning' ? colors.white : phase === 'engaged' ? colors.amber : tint;
        // Focus attacks use target access rather than the follow coverage arc.
        for (const side of ['approach', 'engaged'].includes(phase) ? [] : [-1, 1]) {
          const angle = facing + (side * arc) / 2;
          pools.status.take(
            'bar',
            escort.x + Math.cos(angle) * 29,
            escort.y + Math.sin(angle) * 29,
            12,
            2,
            cueTint,
            0.8,
            angle,
          );
        }
        if (phase === 'approach' || phase === 'returning')
          pools.status.take(
            'arrow',
            escort.x,
            escort.y - 24,
            9,
            9,
            cueTint,
            0.9,
            phase === 'returning' ? Math.PI : 0,
          );
      }
      for (const cue of overflightEscortShotLayers(escort, reduced)) {
        pools.projectiles.take(
          cue.frame,
          cue.x,
          cue.y,
          cue.width,
          cue.height,
          cue.tint,
          cue.alpha,
          cue.rotation,
        );
      }
    }
    const targetId = run.riy?.targetId ?? run.riy?.candidateId;
    const riyTarget =
      targetId && run.enemies.find((enemy) => enemy.active && enemy.id === targetId);
    if (riyTarget) {
      const size = riyTarget.radius + 9;
      const focused = run.riy?.targetId === riyTarget.id;
      const tint = focused ? colors.amber : colors.cyan;
      for (const side of [-1, 1]) {
        pools.status.take('bar', riyTarget.x + side * size, riyTarget.y, 2, focused ? 16 : 9, tint);
        pools.status.take('bar', riyTarget.x, riyTarget.y + side * size, focused ? 16 : 9, 2, tint);
      }
    }
    const player = run.player;
    if (previousHull !== null && player.hull < previousHull) hitAt = run.time;
    previousHull = player.hull;
    const heading = player.heading ?? 0;
    if (previousTime !== null && run.time > previousTime) {
      const dt = Math.min(0.1, run.time - previousTime);
      const delta = Math.atan2(
        Math.sin(heading - previousHeading),
        Math.cos(heading - previousHeading),
      );
      const target = reduced ? 0 : clamp(delta / (dt * 9), -1, 1);
      bank += (target - bank) * (1 - Math.exp(-dt * 12));
    }
    if (reduced) bank = 0;
    previousTime = run.time;
    previousHeading = heading;
    const boosting = player.boostRemaining > 0;
    for (const cue of overflightHuntStrikeLayers(run))
      pools.heroStatus.take(
        cue.frame,
        player.x + cue.dx,
        player.y + cue.dy,
        cue.width,
        cue.height,
        cue.tint,
        cue.alpha,
        cue.rotation,
      );
    heroShadow
      .setPosition(player.x + 2 + bank * 2, player.y + 7)
      .setDisplaySize(boosting ? 43 : 39, 26)
      .setVisible(true);
    const heroFrame = `hero:${reduced ? 0 : Math.floor(run.time * 60) % OVERFLIGHT_HERO_FRAMES}`;
    hero
      .setTexture(textureForFrame(heroFrame), heroFrame)
      .setPosition(player.x, player.y)
      .setDisplaySize(64 * (1 - Math.abs(bank) * 0.09), boosting && !reduced ? 65 : 64)
      .setRotation(heading + Math.PI / 2 + bank * 0.045)
      .setTint(run.time - hitAt < 0.16 ? colors.impact : 0xffffff)
      .setVisible(true);
    hero.setAlpha(player.invulnerable > 0 && !reduced && Math.floor(run.time * 12) % 2 ? 0.6 : 1);
    // Compact local instruments follow the craft without enclosing it. Hull,
    // replacement airframes and protection remain legible without flashing.
    const health = clamp(player.hull / (player.maxHull || 100), 0, 1);
    pools.heroStatus.take('bar', player.x, player.y + 29, 32, 5, 0x09120f, 0.95);
    if (health > 0)
      pools.heroStatus.take(
        'bar',
        player.x - 14 * (1 - health),
        player.y + 29,
        28 * health,
        2,
        health < 0.35 ? colors.danger : colors.cyan,
      );
    for (let index = 0; index < Math.min(3, run.airframes ?? 1); index++)
      pools.heroStatus.take(
        'bar',
        player.x - 6 + index * 6,
        player.y + 35,
        4,
        2,
        index < (run.airframesRemaining ?? 1) ? colors.amber : 0x4b564b,
      );
    if (player.shield > 0)
      for (let index = 0; index < Math.min(2, player.shield); index++)
        pools.heroStatus.take(
          'pickup.module-shield',
          player.x + 24 + index * 13,
          player.y + 29,
          11,
        );
    else if (player.invulnerable > 0) {
      pools.heroStatus.take('bar', player.x - 20, player.y + 27, 2, 7, colors.cyan);
      pools.heroStatus.take('bar', player.x + 20, player.y + 27, 2, 7, colors.cyan);
    }
    if (player.armorReduction > 0)
      for (let index = 0; index < Math.round(player.armorReduction * 10); index++)
        pools.heroStatus.take('bar', player.x - 22 - index * 5, player.y + 29, 3, 9, colors.amber);
    if (boosting && !reduced)
      for (let index = 0; index < 3; index++) {
        const distance = 21 + index * 7;
        pools.heroStatus.take(
          'bar',
          player.x - Math.cos(heading) * distance,
          player.y - Math.sin(heading) * distance,
          9 - index * 2,
          2,
          colors.cyan,
          0.5 - index * 0.12,
          heading,
        );
      }
    for (const pool of poolList) pool.end();
    counts.effects = pools.effects.used();
    counts.pickups = pools.pickups.used();
    counts.warnings = pools.warnings.used();
    counts.remains = pools.remains.used();
    counts.defeats = pools.defeats.used();
    counts.quads =
      2 + (ground ? 1 : worldImages.length) + poolList.reduce((sum, pool) => sum + pool.used(), 0);
    benchmark.observe(counts);
    presentMs += performance.now() - started;
  }

  return {
    present,
    // Upgrade previews use the already prepared, selected native art. The host
    // drives these tiny canvases while paused; no second renderer/RAF/texture owner.
    paintPreviewSprite(context, kind, x, y, size, time = 0) {
      if (destroyed) return;
      const id =
        kind === 'drone'
          ? `hero:${Math.floor(time * 30) % OVERFLIGHT_HERO_FRAMES}`
          : atlas.enemyFrame(
              {
                id: 0,
                family:
                  kind === 'machine'
                    ? 'tracked-tank'
                    : kind === 'shield'
                      ? 'shield-bearer'
                      : 'runner',
                wardrobe: 0,
              },
              time,
              appearance.reducedEffects,
              appearance.cast,
            );
      const frame = previewFrames.get(id);
      if (!frame) return;
      context.save();
      context.imageSmoothingEnabled = false;
      context.translate(x, y);
      context.rotate(Math.PI / 2);
      context.drawImage(
        atlas.pages[frame.page],
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        -size / 2,
        -size / 2,
        size,
        size,
      );
      context.restore();
    },
    /** Diagnostics only: exercise the browser/Phaser restoration path. The
     * host's ordinary context callbacks still own pause and explicit resume. */
    requestContextRecoveryTest() {
      if (destroyed || failed || lost || contextRecoveryTimer !== null) return false;
      const extension = game.renderer.gl?.getExtension('WEBGL_lose_context');
      if (!extension?.loseContext || !extension?.restoreContext) return false;
      try {
        extension.loseContext();
      } catch {
        return false;
      }
      contextRecoveryTests++;
      contextRecoveryTimer = setTimeout(() => {
        contextRecoveryTimer = null;
        if (destroyed) return;
        try {
          extension.restoreContext();
        } catch (error) {
          fail(error);
        }
      }, 200);
      return true;
    },
    measurementComplete: () => benchmark.complete(),
    resourceStats() {
      return {
        ...counts,
        allocatedSprites: poolList.reduce((sum, pool) => sum + pool.size(), 2),
        atlasBytes: atlas.inventory.baseRGBABytes ?? null,
        remains: remains.snapshot(),
        contextLosses,
        contextRestores,
      };
    },
    resetMeasurements(protocol = {}) {
      benchmark = createOverflightBenchmark(protocol);
      previousHull = null;
      previousHeading = previousTime = null;
      bank = 0;
      hitAt = -Infinity;
      remains.reset();
      for (const pool of poolList) {
        pool.begin();
        pool.end();
      }
      current = null;
      frameActive = false;
      presentMs = 0;
      for (const key of Object.keys(counts)) counts[key] = 0;
    },
    stats({ raw = false } = {}) {
      const { frames, ...inventory } = atlas.inventory;
      return {
        renderer: 'Phaser 4.2.1 WebGL',
        logicalWidth: 960,
        logicalHeight: 540,
        backingWidth: game.canvas?.width ?? 0,
        backingHeight: game.canvas?.height ?? 0,
        // Raw timing samples are useful evidence; thousands of repeated frame
        // rectangles are not. The preparer owns the full deterministic atlas.
        atlas: {
          ...inventory,
          pages: inventory.pages.map(({ frames, ...page }) => ({
            ...page,
            frameCount: frames.length,
          })),
          frameCount: frames.length,
        },
        heroArtwork: atlas.heroArtwork,
        counts: { ...counts },
        allocatedSprites: poolList.reduce((sum, pool) => sum + pool.size(), 2),
        remains: { ...remains.snapshot(), limits: OVERFLIGHT_REMAINS_LIMITS },
        destruction: {
          showRemains: appearance.destruction?.showRemains !== false,
          brutal: appearance.destruction?.brutal === true,
          blood: appearance.destruction?.blood !== false,
        },
        fixture: current?.fixture ?? null,
        reducedEffects: appearance.reducedEffects === true,
        preparationMs,
        contextLosses,
        contextRestores,
        contextRecoveryTests,
        lost,
        failed,
        ...benchmark.snapshot({ raw }),
      };
    },
    destroy() {
      if (destroyPromise) return destroyPromise;
      destroyed = true;
      if (contextRecoveryTimer !== null) clearTimeout(contextRecoveryTimer);
      contextRecoveryTimer = null;
      benchmark.exclude('destroyed');
      document.removeEventListener('visibilitychange', onVisibility);
      game.renderer.off(Phaser.Renderer.Events.LOSE_WEBGL, onLost);
      game.renderer.off(Phaser.Renderer.Events.RESTORE_WEBGL, onRestored);
      game.events.off(Phaser.Core.Events.PRE_RENDER, preRender);
      game.events.off(Phaser.Core.Events.POST_RENDER, postRender);
      destroyPromise = new Promise((resolve) => {
        game.events.once(Phaser.Core.Events.DESTROY, () =>
          queueMicrotask(() => {
            atlas.dispose();
            remains.reset();
            presentationState.reset();
            frameTextures.clear();
            previewFrames.clear();
            current = null;
            resolve();
          }),
        );
        game.destroy(true, false);
        queueMicrotask(() => {
          if (game.pendingDestroy) game.step(performance.now(), 0);
        });
      });
      return destroyPromise;
    },
  };
}
