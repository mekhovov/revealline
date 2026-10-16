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
const compiled = await (await fetch('../../../game/presentation/compiled/runtime.json')).json();
const presets = await (await fetch('../../../authoring/motion-lab/presets.json')).json();
const set = presets.characterPresentations.sets.find((s) => s.themeId === 'fpv');
const palette = { muted: '#738d91', accent: '#ffd64a' };
const status = document.querySelector('#status'),
  report = document.querySelector('#report');
const entries = [];
for (const [role, id] of Object.entries(set.classBodies))
  for (const treatment of ['compact', 'detailed']) {
    const slot = `player.${role}.${treatment}`,
      asset = compiled.resolved.assets[slot];
    const geometry = imagePresentation(asset),
      image = new Image();
    image.src = new URL(
      `../../../game/presentation/compiled/${compiled.urls[asset.file.sha256]}`,
      import.meta.url,
    );
    await image.decode();
    const body = {
      ...presets.characters[id],
      sampling: 'nearest',
      rotors: geometry.rotors,
      presentationPivot: geometry.pivot,
    };
    const recipe = preparedRotorRecipe(presets.animationRecipes[body.animationRecipe], geometry);
    const figure = document.createElement('figure'),
      caption = document.createElement('figcaption'),
      canvas = document.createElement('canvas');
    caption.textContent = `${role} · ${treatment}`;
    canvas.width = 384;
    canvas.height = 302;
    figure.append(caption, canvas);
    document.querySelector('#grid').append(figure);
    entries.push({
      slot,
      asset,
      geometry,
      image,
      body,
      recipe,
      canvas,
      animation: createAnimationState(),
      sampler: createActorPresentation(),
    });
  }
function render(e, mode, diameter, heading, animation, frame, reduced, background = '#07111c') {
  const canvas = (e.raster ??= document.createElement('canvas'));
  if (canvas.width !== 48) {
    canvas.width = 48;
    canvas.height = 48;
  }
  const c = canvas.getContext('2d', { willReadFrequently: true });
  c.fillStyle = background;
  c.fillRect(0, 0, 48, 48);
  const paint = actorImagePaintMetrics(diameter, e.geometry);
  if (mode === 'solo')
    paintCharacter(c, {
      body: e.body,
      image: e.image,
      recipe: e.recipe,
      animation,
      colors: { body: '#000000', accent: '#ffd64a' },
      scale: paint.width / e.body.widthCells,
      x: 24,
      y: 24,
      heading,
      bank: 0,
      reducedMotion: reduced,
      pixel: 1,
    });
  else
    drawPresentedActor(
      c,
      { ...frame, x: 24, y: 24, diameter, heading, bank: 0, tail: [], reduced },
      palette,
      e.image,
      e.geometry,
    );
  return canvas;
}
function tick(e, dt, { paused = false, reduced = false } = {}) {
  e.animation = advanceAnimation(e.animation, e.recipe, { visualSpeed: 6, cruiseSpeed: 6 }, dt, {
    paused,
    reducedMotion: reduced,
  });
  e.frame = e.sampler
    .sample([{ id: 'pilot', type: 'team-pilot', x: 2, y: 2, vx: 6, vy: 0, radius: 0.25 }], {
      dt,
      paused,
      reduced,
    })
    .get('pilot');
}
let paused = false;
document.querySelector('#pause').onclick = () => {
  paused = !paused;
  document.querySelector('#pause').textContent = paused ? 'Play' : 'Pause';
};
function draw() {
  const reduced = document.querySelector('#reduced').checked,
    dt = 1 / Number(document.querySelector('#fps').value);
  for (const e of entries) {
    tick(e, dt, { paused, reduced });
    const c = e.canvas.getContext('2d');
    c.clearRect(0, 0, 384, 302);
    for (const [row, size] of [20, 24, 32].entries())
      for (let h = 0; h < 4; h++)
        for (const [col, mode] of ['solo', 'team'].entries()) {
          const out = render(
            e,
            mode,
            size,
            (h * Math.PI) / 2,
            e.animation,
            e.frame,
            reduced,
            row === 1 ? '#dcc99b' : '#07111c',
          );
          c.drawImage(out, h * 48 + col * 192, row * 52);
        }
    for (const [col, mode] of ['solo', 'team'].entries()) {
      c.imageSmoothingEnabled = false;
      c.drawImage(render(e, mode, 32, 0, e.animation, e.frame, reduced), col * 192, 158, 144, 144);
    }
  }
}
let last = 0,
  checking = false;
function loop(time) {
  if (!checking && time - last >= 1000 / Number(document.querySelector('#fps').value)) {
    draw();
    last = time;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
const bytes = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
const differs = (a, b) => a.some((v, i) => v !== b[i]);
document.querySelector('#check').onclick = async () => {
  checking = true;
  document.querySelector('#check').disabled = true;
  status.textContent = 'Comparing actual rotor frames…';
  await new Promise((resolve) => setTimeout(resolve, 0));
  let comparisons = 0,
    changed = 0,
    held = 0;
  const failures = [];
  for (const e of entries) {
    for (const mode of ['solo', 'team'])
      for (const size of [20, 24, 32])
        for (const fps of [4, 30, 60, 120])
          for (let h = 0; h < 4; h++) {
            e.animation = createAnimationState();
            e.sampler.reset();
            tick(e, 1 / fps);
            const first = bytes(
              render(e, mode, size, (h * Math.PI) / 2, e.animation, e.frame, false),
            );
            tick(e, 1 / fps);
            const second = bytes(
              render(e, mode, size, (h * Math.PI) / 2, e.animation, e.frame, false),
            );
            comparisons++;
            if (differs(first, second)) changed++;
            else failures.push(`${e.slot} ${mode} ${size} ${fps} heading${h}: no pixel change`);
            tick(e, 1 / fps, { paused: true });
            const pause = bytes(
              render(e, mode, size, (h * Math.PI) / 2, e.animation, e.frame, false),
            );
            if (!differs(second, pause)) held++;
            else failures.push(`${e.slot} ${mode}: pause changed pixels`);
            const reduced1 = bytes(
              render(e, mode, size, (h * Math.PI) / 2, e.animation, e.frame, true),
            );
            tick(e, 10, { reduced: true });
            const reduced2 = bytes(
              render(e, mode, size, (h * Math.PI) / 2, e.animation, e.frame, true),
            );
            if (!differs(reduced1, reduced2)) held++;
            else failures.push(`${e.slot} ${mode}: reduced changed pixels`);
          }
    status.textContent = `Checked ${e.slot}…`;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  checking = false;
  document.querySelector('#check').disabled = false;
  report.textContent = JSON.stringify(
    {
      comparisons,
      changed,
      held,
      failures,
      evidence:
        'Actual browser canvas pixels; isolated actor paths, not whole-board/device qualification.',
    },
    null,
    2,
  );
  status.textContent = failures.length
    ? `${failures.length} frame-check failures`
    : `PASS: ${changed} changed frames; ${held} held poses`;
};
status.textContent = `Loaded ${entries.length} exact compiled player bindings. Live rendered motion; sample rate is controlled, not measured device FPS.`;
