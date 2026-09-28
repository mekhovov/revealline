import { imagePresentation } from '../../../game/presentation/runtime.mjs';
import { drawPreparedPilotContact } from '../../../game/couch/coop-pilot-cues.mjs';
import { paintCharacter } from '../../../authoring/motion-lab/render-character.mjs';
import {
  createAnimationState,
  advanceAnimation,
} from '../../../authoring/motion-lab/animation.mjs';
import { preparedRotorRecipe } from '../../../game/ui/rotor-presentation.mjs';
import {
  actorImagePaintMetrics,
  createActorPresentation,
  drawPresentedActor,
} from '../../../game/ui/actor-presentation.mjs';
import {
  createPreviewLifecycle,
  retainControlFocus,
} from '../../../authoring/game-feel-lab/lifecycle.mjs';

const $ = (id) => document.getElementById(id);
const pairs = [];
let paused = true,
  ready = false,
  checking = false,
  last = null;
const palette = { muted: '#738d91', accent: '#ffd64a' };
const boot = new AbortController();
const images = new Set();
const json = async (relative) => {
  const response = await fetch(new URL(relative, import.meta.url), { signal: boot.signal });
  if (!response.ok) throw new Error(`Could not load ${relative}: ${response.status}`);
  return response.json();
};
async function entry(asset, presets, set) {
  const response = await fetch(new URL(`../../../${asset.path}`, import.meta.url), {
    signal: boot.signal,
  });
  if (!response.ok) throw new Error(`Could not load ${asset.path}: ${response.status}`);
  const bytes = await response.arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
  if (bytes.byteLength !== asset.bytes || hash !== asset.sha256)
    throw new Error(`Candidate bytes do not match ${asset.id}`);
  const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  if (boot.signal.aborted) {
    image.close();
    throw new Error('Review closed.');
  }
  images.add(image);
  if (image.width !== asset.width || image.height !== asset.height)
    throw new Error(`Candidate dimensions do not match ${asset.id}`);
  const geometry = imagePresentation(asset.assetRevision);
  const original = presets.characters[set.classBodies[asset.slot.split('.')[1]]];
  const body = {
    ...original,
    sampling: 'nearest',
    rotors: geometry.rotors,
    presentationPivot: geometry.pivot,
  };
  return {
    id: asset.id,
    geometry,
    image,
    body,
    recipe: preparedRotorRecipe(presets.animationRecipes[body.animationRecipe], geometry),
    animation: createAnimationState(),
    sampler: createActorPresentation(),
  };
}
function tick(e, dt, { frozen = false, reduced = false } = {}) {
  e.animation = advanceAnimation(e.animation, e.recipe, { visualSpeed: 6, cruiseSpeed: 6 }, dt, {
    paused: frozen,
    reducedMotion: reduced,
  });
  e.frame = e.sampler
    .sample([{ id: 'actor', type: 'team-pilot', x: 2, y: 2, vx: 6, vy: 0, radius: 0.25 }], {
      dt,
      paused: frozen,
      reduced,
    })
    .get('actor');
}
function render(e, mode, diameter, heading, reduced, bodyOnly = false, background = '#07111c') {
  const canvas = (e.raster ??= document.createElement('canvas'));
  if (canvas.width !== 48) {
    canvas.width = 48;
    canvas.height = 48;
  }
  const c = canvas.getContext('2d', { willReadFrequently: true });
  c.fillStyle = background;
  c.fillRect(0, 0, 48, 48);
  c.imageSmoothingEnabled = false;
  if (bodyOnly) {
    const paint = actorImagePaintMetrics(diameter, e.geometry);
    c.save();
    c.translate(24, 24);
    c.rotate(heading);
    c.drawImage(
      e.image,
      -paint.width * e.geometry.pivot.x,
      -paint.height * e.geometry.pivot.y,
      paint.width,
      paint.height,
    );
    c.restore();
  } else if (mode === 'solo') {
    const paint = actorImagePaintMetrics(diameter, e.geometry);
    paintCharacter(c, {
      body: e.body,
      image: e.image,
      recipe: e.recipe,
      animation: e.animation,
      colors: { body: '#000000', accent: '#ffd64a' },
      scale: paint.width / e.body.widthCells,
      x: 24,
      y: 24,
      heading,
      bank: 0,
      reducedMotion: reduced,
      pixel: 1,
    });
  } else {
    drawPresentedActor(
      c,
      { ...e.frame, x: 24, y: 24, diameter, heading, bank: 0, tail: [], reduced },
      palette,
      e.image,
      e.geometry,
      null,
      { showBodyCues: false },
    );
    c.save();
    c.translate(24, 24);
    drawPreparedPilotContact(c, e.frame.radius, palette.accent, 1);
    c.restore();
  }
  return canvas;
}
function paint(dt = 0) {
  const reduced = $('reduced').checked,
    mode = $('mode').value,
    bodyOnly = $('body-only').checked;
  for (const pair of pairs) {
    const c = pair.canvas.getContext('2d');
    c.clearRect(0, 0, 384, 302);
    c.imageSmoothingEnabled = false;
    for (const [col, e] of [pair.before, pair.after].entries()) {
      tick(e, dt, { frozen: paused, reduced });
      for (const [row, size] of [20, 24, 32].entries())
        for (let h = 0; h < 4; h++)
          c.drawImage(
            render(
              e,
              mode,
              size,
              (h * Math.PI) / 2,
              reduced,
              bodyOnly,
              row === 1 ? '#dcc99b' : '#07111c',
            ),
            col * 192 + h * 48,
            row * 52,
          );
      c.drawImage(render(e, mode, 32, 0, reduced, bodyOnly), col * 192, 158, 144, 144);
    }
  }
}
function setPaused(value) {
  paused = value;
  last = null;
  $('pause').textContent = value ? 'Play' : 'Pause';
}
const lifecycle = createPreviewLifecycle({
  requestFrame: (fn) => requestAnimationFrame(fn),
  cancelFrame: (id) => cancelAnimationFrame(id),
  initialActive: !document.hidden,
  onFrame(time) {
    if (!ready || checking || paused) return;
    const dt = last === null ? 0 : Math.min(0.1, (time - last) / 1000);
    last = time;
    paint(dt);
  },
  onSuspend() {
    setPaused(true);
  },
});
$('pause').onclick = () => {
  if (checking || !ready || !lifecycle.active) return;
  setPaused(!paused);
  paint();
};
for (const id of ['mode', 'reduced', 'body-only'])
  $(id).addEventListener('change', () => {
    if (ready && !checking) paint();
  });
$('reduced').checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.addEventListener('visibilitychange', () =>
  document.hidden ? lifecycle.suspend() : lifecycle.resume(),
);
window.addEventListener('pagehide', (event) => {
  lifecycle.suspend();
  if (!event.persisted) {
    boot.abort();
    lifecycle.dispose();
    for (const image of images) image.close();
    images.clear();
  }
});
window.addEventListener('pageshow', () => {
  if (!document.hidden) lifecycle.resume();
});

$('check').onclick = async () => {
  if (checking || !ready || !lifecycle.active) return;
  const restoreFocus = retainControlFocus($('check'), document),
    task = lifecycle.beginTask();
  const failures = [];
  const savedStates = pairs.map(({ after: e }) => ({
    e,
    animation: e.animation,
    sampler: e.sampler,
    frame: e.frame,
  }));
  for (const { e } of savedStates) e.sampler = createActorPresentation();
  let changed = 0,
    held = 0;
  checking = true;
  setPaused(true);
  $('check').disabled = true;
  $('pause').disabled = true;
  const raster = (e, mode, size, heading, reduced, background) =>
    new Uint8ClampedArray(
      render(e, mode, size, heading, reduced, false, background)
        .getContext('2d')
        .getImageData(0, 0, 48, 48).data,
    );
  const same = (a, b) => a.every((value, i) => value === b[i]);
  try {
    for (const { after: e } of pairs) {
      if (!task.current()) return;
      tick(e, 0, { frozen: true });
      const dark = raster(e, 'solo', 20, 0, false, '#07111c');
      const light = raster(e, 'solo', 20, 0, false, '#dcc99b');
      if (same(dark, light)) throw new Error('Light and dark raster backgrounds must differ.');
      for (const background of ['#07111c', '#dcc99b'])
        for (const mode of ['solo', 'team'])
          for (const size of [20, 24, 32])
            for (const fps of [4, 30, 60, 120])
              for (let h = 0; h < 4; h++) {
                e.animation = createAnimationState();
                e.sampler.reset();
                const heading = (h * Math.PI) / 2;
                tick(e, 1 / fps);
                const first = raster(e, mode, size, heading, false, background);
                tick(e, 1 / fps);
                const second = raster(e, mode, size, heading, false, background);
                if (!same(first, second)) changed++;
                else failures.push(`${e.id} ${mode} ${size}px ${fps}Hz heading ${h}: static`);
                tick(e, 1 / fps, { frozen: true });
                if (same(second, raster(e, mode, size, heading, false, background))) held++;
                else failures.push(`${e.id}: pause moved`);
                const reduced = raster(e, mode, size, heading, true, background);
                tick(e, 10, { reduced: true });
                if (same(reduced, raster(e, mode, size, heading, true, background))) held++;
                else failures.push(`${e.id}: reduced moved`);
              }
      $('status').textContent = `Checked ${e.id}…`;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (task.current()) {
      $('report').textContent = JSON.stringify(
        {
          changed,
          held,
          failures,
          backgrounds: ['#07111c', '#dcc99b'],
          evidence:
            'Hash-verified native candidates through shared painters. Render evidence only; no public, full-board or physical-device acceptance.',
        },
        null,
        2,
      );
      $('status').textContent = failures.length
        ? `${failures.length} failures`
        : `PASS: ${changed} changed frames; ${held} held poses.`;
    }
  } catch (error) {
    if (task.current())
      $('status').textContent = `Frame check failed: ${error.message} Retry the check when ready.`;
  } finally {
    for (const { e, animation, sampler, frame } of savedStates) {
      e.animation = animation;
      e.sampler = sampler;
      e.frame = frame;
    }
    task.finish();
    checking = false;
    $('check').disabled = !ready;
    $('pause').disabled = !ready;
    restoreFocus(task.current());
    if (ready && lifecycle.active) paint();
  }
};
try {
  const [before, after, presets] = await Promise.all([
    json('../../../authoring/library/fpv-proportion-candidates/manifest.json'),
    json('../../../authoring/library/fpv-body-detail-candidates/manifest.json'),
    json('../../../authoring/motion-lab/presets.json'),
  ]);
  const set = presets.characterPresentations.sets.find((s) => s.themeId === 'fpv');
  for (const asset of after.assets) {
    const previous = before.assets.find(
      (a) => a.slot === asset.slot && a.treatment === asset.treatment,
    );
    if (!previous) throw new Error(`Missing previous candidate for ${asset.slot}`);
    const [old, fresh] = await Promise.all([
      entry(previous, presets, set),
      entry(asset, presets, set),
    ]);
    const figure = document.createElement('figure'),
      caption = document.createElement('figcaption'),
      legend = document.createElement('div'),
      canvas = document.createElement('canvas');
    caption.textContent = `${asset.slot.split('.')[1]} · ${asset.treatment}`;
    legend.className = 'legend';
    legend.innerHTML = '<span>Proportion candidate</span><span>Body detail candidate</span>';
    canvas.width = 384;
    canvas.height = 302;
    canvas.setAttribute(
      'aria-label',
      `${caption.textContent}: previous and refined body with matching rotors`,
    );
    const pixels = document.createElement('div');
    pixels.className = 'pixels';
    pixels.append(legend, canvas);
    figure.append(caption, pixels);
    $('grid').append(figure);
    pairs.push({ before: old, after: fresh, canvas });
  }
  ready = true;
  paint();
  $('pause').disabled = false;
  $('check').disabled = false;
  $('status').textContent =
    'Four exact candidate pairs ready. Paused for body review; Play to compare attached rotor motion.';
} catch (error) {
  const departed = boot.signal.aborted;
  boot.abort();
  for (const image of images) image.close();
  images.clear();
  if (!departed)
    $('status').textContent =
      `${error.message} Reload to retry; no replacement artwork has been substituted.`;
}
