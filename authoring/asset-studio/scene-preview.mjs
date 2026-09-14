import { createRun } from '../../game/core/index.mjs';
import { BoardPainter, boardPaintSizeForRun } from '../../game/ui/render.mjs';
import { createStudioPreviewRun, pickupKinds } from './preview-fixture.mjs';
export { pickupKinds } from './preview-fixture.mjs';
import {
  canvasPresentation,
  imagePresentation,
  presentationCSSVariables,
} from '../../game/presentation/runtime.mjs';
import { paintCharacter } from '../motion-lab/render-character.mjs';
import { createAnimationState, advanceAnimation } from '../motion-lab/animation.mjs';
import { Soundscape } from '../../game/ui/audio.mjs';
import { drawActiveTrail, drawCapturePulse } from '../../game/ui/actor-presentation.mjs';
import { drawEventFeedback } from '../../game/ui/event-feedback.mjs';
import { CURRENT_ART_SOURCES } from '../../game/presentation/current-art-sources.mjs';
const text = (tag, value, className = '') => {
  const node = document.createElement(tag);
  node.textContent = value;
  node.className = className;
  return node;
};
const read = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Preview fixture unavailable (${response.status}).`);
  return response.json();
};
const optionalFixtureLevels = {
  'fpv-arcade-r5': ['orchard-crossing', 'courtyard-exits', 'night-crossfire'],
  'fpv-arcade': ['orchard-window', 'split-courtyard', 'night-signal'],
};
function metadataFixturePack(id) {
  const rows = optionalFixtureLevels[id].map((levelId) =>
    CURRENT_ART_SOURCES.find(
      (row) =>
        row.source.path === `game/content/packs/${id}.json` &&
        row.owner.themeId === 'fpv' &&
        row.level?.id === levelId,
    ),
  );
  if (rows.some((row) => !row?.level || !row.theme))
    throw new Error(`Code-owned inspection metadata is unavailable for ${id}.`);
  // Only trusted level/theme metadata: no original picture bytes or player storage.
  return { themes: [rows[0].theme], campaigns: [{ levels: rows.map((row) => row.level) }] };
}
export function createStudioFixtureLoader({ readJSON = read } = {}) {
  let presetPromise;
  const packs = new Map();
  const presets = () =>
    (presetPromise ||= readJSON(new URL('../motion-lab/presets.json', import.meta.url)).catch(
      (error) => {
        presetPromise = null;
        throw error;
      },
    ));
  const pack = (id) => {
    if (!packs.has(id))
      packs.set(
        id,
        readJSON(new URL(`../../game/content/packs/${id}.json`, import.meta.url)).catch((error) => {
          if (Object.hasOwn(optionalFixtureLevels, id)) return metadataFixturePack(id);
          packs.delete(id);
          throw error;
        }),
      );
    return packs.get(id);
  };
  return {
    presets,
    async context(slotId, pictureOwner = null) {
      if (pictureOwner && (!pictureOwner.level || !pictureOwner.theme))
        throw new Error(
          'Exact picture owner metadata is unavailable; no substitute board is shown.',
        );
      const preset = await presets();
      if (pictureOwner)
        return {
          presets: preset,
          theme: pictureOwner.theme,
          level: pictureOwner.level,
          run: createRun(pictureOwner.level, { seed: pictureOwner.descriptor?.seed ?? 0 }),
        };
      const choices = await Promise.all(
        ['fpv-arcade-r5', 'classic-lab', 'sentinel-relay', 'fpv-arcade'].map(pack),
      );
      return {
        presets: preset,
        theme: choices[0].themes[0],
        ...createStudioPreviewRun(choices, slotId),
      };
    },
  };
}
const fixtureLoader = createStudioFixtureLoader();
const bodyIds = {
  scout: 'fpv-scout-v1',
  bomber: 'fpv-light-carrier-v1',
  carrier: 'fpv-heavy-carrier-v1',
  interceptor: 'fpv-interceptor-v1',
  fiber: 'fpv-fiber-relay-v1',
  impact: 'fpv-impact-v1',
  trapper: 'fpv-trapper-v1',
};
const imageRoles = {
  'enemy.bouncer': 'enemy',
  'enemy.border-patrol': 'patrol',
  'enemy.contour-patrol': 'contour',
  'enemy.claimed-rover': 'rover',
  'enemy.eroder': 'eroder',
  'enemy.lane-boss': 'boss',
  'enemy.relay-sentinel': 'boss',
  'terrain.wall': 'wall',
  'terrain.slow': 'slowTerrain',
  'terrain.lethal': 'lethalTerrain',
  'pickup.objective': 'objective',
  'pickup.supply': 'supply',
  'pickup.life': 'lifePickup',
  'pickup.speed': 'speedPickup',
  'pickup.slow': 'slowPickup',
  'pickup.freeze': 'freezePickup',
};
/** Same frame-local geometry adapter as the release host. Decoded images are
 * owned by this inspection only; this snapshot never reads or writes player state. */
export function createStudioContextPresentation(resolved, decoded, selectedPlayerSlot = null) {
  const images = new Map();
  for (const [id, { asset, image }] of decoded)
    images.set(id, Object.freeze({ image, asset, geometry: imagePresentation(asset) }));
  const selected = images.get(selectedPlayerSlot),
    selectedClass = /^player\.([^.]+)\.(compact|detailed)$/.exec(selectedPlayerSlot || '')?.[1],
    css = presentationCSSVariables(resolved);
  return Object.freeze({
    resolved,
    canvas: canvasPresentation(resolved),
    fonts: Object.freeze({ ui: css['--fk-font-ui'], numeric: css['--fk-font-mono'] }),
    image: (id) =>
      selected &&
      (id === `player.${selectedClass}.compact` || id === `player.${selectedClass}.detailed`)
        ? selected
        : (images.get(id) ?? null),
  });
}

async function croppedImage(asset, blobs) {
  const blob = blobs.get(asset.file.sha256);
  if (!blob) throw new Error('Preview media is missing.');
  const bitmap = await createImageBitmap(blob),
    f = asset.geometry.frame,
    canvas = document.createElement('canvas');
  canvas.width = f.width;
  canvas.height = f.height;
  canvas.getContext('2d').drawImage(bitmap, f.x, f.y, f.width, f.height, 0, 0, f.width, f.height);
  bitmap.close();
  const image = new Image();
  image.src = canvas.toDataURL('image/png');
  await image.decode();
  return image;
}
function loop(surface, own, draw, motion) {
  let alive = true,
    frame,
    last = performance.now();
  const reduced = motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const run = (now) => {
    if (!alive) return;
    draw(motion === 'playing' && !reduced ? Math.min(0.05, (now - last) / 1000) : 0, reduced);
    last = now;
    if (motion === 'playing' && !reduced) frame = requestAnimationFrame(run);
  };
  own(() => {
    alive = false;
    cancelAnimationFrame(frame);
  });
  run(last);
}
export async function playerRecipePreview(surface, slot, resolved, blobs, options, own) {
  const presets = await fixtureLoader.presets(),
    classId = slot.id.split('.')[1],
    bodyId = bodyIds[classId] || bodyIds.scout;
  let body = structuredClone(presets.characters[bodyId]);
  const recipe = structuredClone(presets.animationRecipes[body.animationRecipe]);
  const imageAsset =
    resolved.assets[`player.${classId}.${slot.id.endsWith('detailed') ? 'detailed' : 'compact'}`];
  let image;
  if (imageAsset?.kind === 'image') {
    image = await croppedImage(imageAsset, blobs);
    const geometry = imagePresentation(imageAsset);
    body.rotors = geometry.rotors;
    body.presentationPivot = geometry.pivot;
  } else {
    image = new Image();
    image.src = new URL(`../motion-lab/${body.src}`, import.meta.url).href;
    await image.decode();
  }
  if (!options.isCurrent()) return;
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 220;
  surface.append(
    canvas,
    text(
      'small',
      `${bodyId} · actual body and registered rotor renderer · ${options.motion}`,
      'bounded-label',
    ),
  );
  const ctx = canvas.getContext('2d'),
    palette = canvasPresentation(resolved).palette;
  let animation = createAnimationState();
  loop(
    surface,
    own,
    (dt, reduced) => {
      ctx.clearRect(0, 0, 320, 220);
      animation = advanceAnimation(animation, recipe, { visualSpeed: 3, cruiseSpeed: 6 }, dt, {
        paused: options.motion === 'paused',
        reducedMotion: reduced,
        inspectionSlow: true,
      });
      paintCharacter(ctx, {
        body,
        image,
        recipe,
        animation,
        colors: { body: palette.safe, accent: palette.accent },
        scale: 130 / Math.max(body.widthCells, body.heightCells),
        x: 160,
        y: 110,
        pixel: 1,
        speedRatio: 0.5,
        reducedMotion: reduced,
        inspectionSlow: true,
      });
    },
    options.motion,
  );
}
export async function boardContextPreview(surface, slot, asset, resolved, blobs, options, own) {
  const classId = slot.id.startsWith('player.') ? slot.id.split('.')[1] : 'scout',
    pictureOwner = options.pictureOwner || options.sourcePicture,
    {
      presets,
      level,
      run,
      theme: fixtureTheme,
    } = await fixtureLoader.context(slot.id, pictureOwner);
  const painter = new BoardPainter(presets),
    theme = {
      ...fixtureTheme,
      palette: canvasPresentation(resolved).palette,
    };
  let warning = '';
  painter.onAsset = (message) => {
    warning = message;
  };
  await painter.setLook(theme, bodyIds[classId] || bodyIds.scout);
  painter.setLevel(level, { seed: pictureOwner?.descriptor?.seed ?? 42 });
  if (slot.id.startsWith('effect.')) {
    const type = {
      failure: 'player.failed',
      pickup: 'powerup.collected',
      shield: 'shield.absorbed',
      respawn: 'player.respawned',
      pressure: 'lineImpact.seeded',
      capture: 'cells.claimed',
      victory: 'run.completed',
    }[slot.id.slice(7)];
    painter.effectsFor(
      [{ type, tick: run.tick, x: run.player.x, y: run.player.y, kind: 'extra-life' }],
      run,
    );
  }
  const scoped = { ...resolved.assets, [slot.id]: asset },
    decoded = new Map();
  for (const [id, candidate] of Object.entries(scoped)) {
    if (candidate?.kind !== 'image') continue;
    let role = imageRoles[id];
    if (id === `player.${classId}.compact` || id === `player.${classId}.detailed`) role = 'player';
    if (id === slot.id && (slot.group === 'pictures' || slot.group === 'screens'))
      role = 'background';
    if (!role) continue;
    const image = await croppedImage(candidate, blobs);
    if (role === 'background') painter.images.background = image;
    else decoded.set(id, { asset: candidate, image });
  }
  painter.setPresentation(
    createStudioContextPresentation(
      { ...resolved, assets: scoped },
      decoded,
      slot.id.startsWith('player.') ? slot.id : null,
    ),
  );
  own(() => painter.enemyBodies.clear());
  if (options.sourcePicture) painter.images.background = options.sourcePicture.image;
  if (!options.isCurrent()) return;
  const size = boardPaintSizeForRun(run),
    canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.setAttribute('aria-label', 'Actual board renderer in an isolated mission fixture');
  const frame = text('div', '', 'board-context-frame'),
    hud = text('div', '', 'context-hud');
  hud.append(text('span', 'FLIGHT / STUDIO'), text('span', 'III  00:00  0%'));
  frame.append(hud, canvas);
  surface.append(
    frame,
    text(
      'small',
      `BoardPainter · ${level.name} · ${run.width} × ${run.height} cells · ${pictureOwner ? 'exact source level' : 'isolated fixture'}${/^player\.[^.]+\.(compact|detailed)$/.test(slot.id) ? ` · selected ${slot.id.split('.')[2]} body at every preview width` : ''}${warning ? ` · ${warning}` : ''}`,
      'bounded-label',
    ),
  );
  let gallery = false;
  const render = (dt, reduced) => {
    const image = painter.images.background;
    if (gallery)
      painter.drawGallery(canvas.getContext('2d'), {
        theme,
        level,
        image,
        fit: pictureOwner?.fit || 'cover',
      });
    else
      painter.draw(canvas.getContext('2d'), run, dt, {
        paused: options.motion !== 'playing',
        reduced,
        showGrid: true,
        displayCSSWidth: Math.max(200, canvas.clientWidth),
        ...(pictureOwner
          ? {
              backdrop: {
                image: painter.images.background,
                fit: pictureOwner.fit,
                sampling: pictureOwner.sampling,
              },
            }
          : {}),
      });
  };
  if (slot.group === 'pictures') {
    const toggle = text('button', 'Show picture viewer');
    toggle.type = 'button';
    toggle.onclick = () => {
      gallery = !gallery;
      toggle.textContent = gallery ? 'Show concealed field' : 'Show picture viewer';
      render(0, true);
    };
    surface.append(toggle);
  }
  loop(surface, own, render, options.motion);
}
export function audioRecipePreview(surface, slot, own) {
  const player = new Soundscape(),
    box = text('div', '', 'recipe-sample'),
    play = text('button', slot.id === 'audio.music' ? 'Audition 4 seconds' : 'Audition cue'),
    stop = text('button', 'Stop'),
    result = text('p', 'Sound starts only from this button. Local audition volume: 35%.');
  play.type = 'button';
  stop.type = 'button';
  box.append(text('h3', slot.label), play, stop, result);
  surface.append(box);
  let frame,
    alive = true;
  own(() => {
    alive = false;
    cancelAnimationFrame(frame);
    player.dispose();
  });
  const tick = () => {
    if (!alive) return;
    player.update(false, { id: 'fpv' }, { status: 'running' });
    if (player.previewActive) frame = requestAnimationFrame(tick);
  };
  play.onclick = async () => {
    try {
      player.configure({ master: 0.35, music: 0.5, sfx: 0.7 });
      if (slot.id === 'audio.music') {
        await player.preview({ seconds: 4 });
        tick();
      } else {
        if (!(await player.enable())) throw new Error('Audio is unavailable.');
        const cue = slot.id.slice(6);
        const event = {
          capture: 'cells.claimed',
          failure: 'player.failed',
          victory: 'run.completed',
          pickup: 'pickup.collected',
          confirm: 'ability.used',
          focus: 'class.switched',
          cancel: 'craft.redeployed',
        }[cue];
        player.event({ type: event, won: true, tick: performance.now() });
      }
      result.textContent = 'Playing the registered Soundscape recipe.';
    } catch (error) {
      result.textContent = error.message;
    }
  };
  stop.onclick = () => {
    player.disable();
    cancelAnimationFrame(frame);
    result.textContent = 'Audition stopped.';
  };
}
export function effectRecipePreview(surface, slot, resolved, options, own) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 200;
  const ctx = canvas.getContext('2d'),
    palette = canvasPresentation(resolved).palette;
  surface.append(
    canvas,
    text('small', 'Actual game effect helper · isolated event fixture', 'bounded-label'),
  );
  let time = 0.2;
  loop(
    surface,
    own,
    (dt, reduced) => {
      time += dt;
      ctx.clearRect(0, 0, 320, 200);
      const age = time % 0.65;
      if (slot.id.startsWith('trail.'))
        drawActiveTrail(
          ctx,
          [{ x1: 3, y1: 6, x2: 15, y2: 6 }],
          [
            { x: 3, y: 6 },
            { x: 15, y: 6 },
          ],
          { x: 15, y: 6, cutting: true },
          palette,
          { time, reduced },
        );
      else if (slot.id === 'effect.capture' || slot.id === 'effect.victory') {
        const cells = new Uint8Array(20 * 12),
          indices = [];
        for (let y = 4; y < 9; y++)
          for (let x = 5; x < 15; x++) {
            indices.push(y * 20 + x);
            cells[y * 20 + x] = 1;
          }
        ctx.fillStyle = palette.safe;
        ctx.globalAlpha = 0.2;
        ctx.fillRect(80, 64, 160, 80);
        ctx.globalAlpha = 1;
        drawCapturePulse(ctx, { age, indices }, 20, cells, palette, reduced);
      } else {
        const type = {
          failure: 'player.failed',
          pickup: 'powerup.collected',
          shield: 'shield.absorbed',
          respawn: 'player.respawned',
          pressure: 'lineImpact.seeded',
        }[slot.id.slice(7)];
        drawEventFeedback(ctx, { type, x: 10, y: 6, age, kind: 'extra-life' }, palette, {
          reduced,
          width: 320,
          height: 200,
        });
      }
    },
    options.motion,
  );
}
export { componentPreview } from './component-specimens.mjs';
