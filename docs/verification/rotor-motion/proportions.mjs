import { imagePresentation } from '../../../game/presentation/runtime.mjs';
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

const [compiled, presets, manifest] = await Promise.all([
  fetch('../../../game/presentation/compiled/runtime.json').then((r) => r.json()),
  fetch('../../../authoring/motion-lab/presets.json').then((r) => r.json()),
  fetch('../../../authoring/library/fpv-proportion-candidates/manifest.json').then((r) => r.json()),
]);
const set = presets.characterPresentations.sets.find((s) => s.themeId === 'fpv');
const palette = { muted: '#738d91', accent: '#ffd64a' };
const status = document.querySelector('#status');
const pairs = [];
async function entry(asset, candidate, role, enemy) {
  const geometry = imagePresentation(candidate ? asset.assetRevision : asset);
  const image = new Image();
  image.src = new URL(
    candidate
      ? `../../../${asset.path}`
      : `../../../game/presentation/compiled/${compiled.urls[asset.file.sha256]}`,
    import.meta.url,
  );
  await image.decode();
  const original = presets.characters[set.classBodies[role] ?? set.classBodies.scout];
  const body = {
    ...original,
    sampling: 'nearest',
    rotors: geometry.rotors,
    presentationPivot: geometry.pivot,
  };
  const recipe = preparedRotorRecipe(presets.animationRecipes[body.animationRecipe], geometry);
  return {
    id: asset.id,
    enemy,
    geometry,
    image,
    body,
    recipe,
    animation: createAnimationState(),
    sampler: createActorPresentation(),
  };
}
for (const asset of manifest.assets) {
  const role = asset.slot.split('.')[1];
  const original = compiled.resolved.assets[asset.slot];
  const enemy = asset.slot.startsWith('enemy.');
  const old = await entry(original, false, role, enemy);
  const candidate = await entry(asset, true, role, enemy);
  const figure = document.createElement('figure');
  const caption = document.createElement('figcaption');
  caption.textContent = `${role} · ${asset.treatment}`;
  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.innerHTML = '<span>Current</span><span>Larger prop candidate</span>';
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 302;
  const directions = document.createElement('p');
  directions.className = 'directions';
  directions.textContent = `Candidate hubs, top to bottom / left to right: ${candidate.geometry.rotors
    .map((hub) => (hub.direction > 0 ? 'CW' : 'CCW'))
    .join(' · ')}. Viewed from above, nose up.`;
  figure.append(caption, legend, canvas, directions);
  document.querySelector('#grid').append(figure);
  pairs.push({ old, candidate, canvas });
}
function tick(e, dt, { paused = false, reduced = false } = {}) {
  e.animation = advanceAnimation(e.animation, e.recipe, { visualSpeed: 6, cruiseSpeed: 6 }, dt, {
    paused,
    reducedMotion: reduced,
  });
  e.frame = e.sampler
    .sample(
      [
        {
          id: 'actor',
          type: e.enemy ? 'border-patrol' : 'team-pilot',
          x: 2,
          y: 2,
          vx: 6,
          vy: 0,
          radius: 0.25,
        },
      ],
      { dt, paused, reduced },
    )
    .get('actor');
}
function render(e, mode, diameter, heading, reduced, background = '#07111c') {
  const canvas = (e.raster ??= document.createElement('canvas'));
  if (canvas.width !== 48) {
    canvas.width = 48;
    canvas.height = 48;
  }
  const c = canvas.getContext('2d', { willReadFrequently: true });
  c.fillStyle = background;
  c.fillRect(0, 0, 48, 48);
  if (mode === 'solo' && !e.enemy) {
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
  } else
    drawPresentedActor(
      c,
      { ...e.frame, x: 24, y: 24, diameter, heading, bank: 0, tail: [], reduced },
      palette,
      e.image,
      e.geometry,
    );
  return canvas;
}
let paused = false,
  checking = false,
  last = 0;
document.querySelector('#pause').onclick = () => {
  paused = !paused;
  document.querySelector('#pause').textContent = paused ? 'Play' : 'Pause';
};
function loop(time) {
  const fps = Number(document.querySelector('#fps').value);
  if (!checking && time - last >= 1000 / fps) {
    const reduced = document.querySelector('#reduced').checked,
      mode = document.querySelector('#mode').value;
    for (const pair of pairs) {
      const c = pair.canvas.getContext('2d');
      c.clearRect(0, 0, 384, 302);
      c.imageSmoothingEnabled = false;
      for (const [col, e] of [pair.old, pair.candidate].entries()) {
        const speed = document.querySelector('#slow').checked ? 0.08 : 1;
        tick(e, speed / fps, { paused, reduced });
        for (const [row, size] of [20, 24, 32].entries())
          for (let h = 0; h < 4; h++)
            c.drawImage(
              render(e, mode, size, (h * Math.PI) / 2, reduced, row === 1 ? '#dcc99b' : '#07111c'),
              col * 192 + h * 48,
              row * 52,
            );
        c.drawImage(render(e, mode, 32, 0, reduced), col * 192, 158, 144, 144);
      }
    }
    last = time;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
const bytes = (c) => c.getContext('2d').getImageData(0, 0, 48, 48).data;
const differs = (a, b) => a.some((v, i) => v !== b[i]);
document.querySelector('#check').onclick = async () => {
  checking = true;
  document.querySelector('#check').disabled = true;
  status.textContent = 'Comparing actual candidate pixels…';
  let changed = 0,
    held = 0;
  const failures = [];
  for (const { candidate: e } of pairs) {
    for (const mode of ['solo', 'team'])
      for (const size of [20, 24, 32])
        for (const fps of [4, 30, 60, 120])
          for (let h = 0; h < 4; h++) {
            e.animation = createAnimationState();
            e.sampler.reset();
            tick(e, 1 / fps);
            const before = bytes(render(e, mode, size, (h * Math.PI) / 2, false));
            tick(e, 1 / fps);
            const after = bytes(render(e, mode, size, (h * Math.PI) / 2, false));
            if (differs(before, after)) changed++;
            else failures.push(`${e.id} ${mode} ${size}px ${fps}Hz heading${h}: static`);
            tick(e, 1 / fps, { paused: true });
            if (!differs(after, bytes(render(e, mode, size, (h * Math.PI) / 2, false)))) held++;
            else failures.push(`${e.id}: pause changed`);
            const reduced = bytes(render(e, mode, size, (h * Math.PI) / 2, true));
            tick(e, 10, { reduced: true });
            if (!differs(reduced, bytes(render(e, mode, size, (h * Math.PI) / 2, true)))) held++;
            else failures.push(`${e.id}: reduced changed`);
          }
    status.textContent = `Checked ${e.id}…`;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  document.querySelector('#report').textContent = JSON.stringify(
    {
      changed,
      held,
      failures,
      evidence:
        'Decoded original candidate PNGs and shared actor renderers. Not full-board, public or physical-device qualification.',
    },
    null,
    2,
  );
  status.textContent = failures.length
    ? `${failures.length} failures`
    : `PASS: ${changed} changing frames; ${held} held poses. Visual acceptance remains separate.`;
  checking = false;
  document.querySelector('#check').disabled = false;
};
status.textContent = `Loaded ${pairs.length} original/candidate pairs. Candidate geometry is explicit; no production binding is changed.`;
