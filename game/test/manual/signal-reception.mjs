/* global document, window, Image, requestAnimationFrame, cancelAnimationFrame */
import { BoardPainter } from '../../ui/render.mjs';
import { createRun, stepRun, FIXED_DT } from '../../core/index.mjs';

const read = async (path) => (await fetch(new URL(path, import.meta.url))).json();
const [presets, themes, manifest] = await Promise.all([
  read('../../../authoring/motion-lab/presets.json'),
  read('../../content/themes.json'),
  read('../../presentation/compiled/runtime.json'),
]);
const theme = themes.themes.find((item) => item.id === 'fpv');
const canvas = document.querySelector('#board'),
  context = canvas.getContext('2d'),
  status = document.querySelector('#status'),
  reduced = document.querySelector('#reduced'),
  painter = new BoardPainter(presets);
// This legal authored foundation exposes real installed Orchard Gate artwork
// from the first frame; its unclaimed right side still has the ordinary mask.
const level = {
  version: 'xonix-level.v5',
  id: 'receiver-foundation-preview',
  revision: '1',
  name: 'Receiver foundation preview',
  width: 72,
  height: 36,
  spawn: { x: 28.5, y: 18.5 },
  foundations: [{ x: 1, y: 1, w: 28, h: 34 }],
  walls: [],
  goal: { coverage: 0.99 },
  encounter: null,
  classic: { version: 'classic.v1', terrain: [], powerups: [] },
  enemies: [{ id: 'keeper', type: 'bouncer', x: 60.5, y: 28.5, vx: 0, vy: 0 }],
  objectives: [],
  supplies: [],
  rules: { lives: 1, moveSpeed: 10, timeLimitSeconds: 2 },
};
const picture = manifest.resolved.assets['scene.reveal.wide'];
const image = new Image();
image.src = new URL(
  manifest.urls[picture.file.sha256],
  new URL('../../presentation/compiled/runtime.json', import.meta.url),
).href;
await image.decode();
const backdrop = { image, fit: 'contain' };
await painter.setLook(theme, theme.player);
let run,
  mode,
  elapsed,
  last = performance.now(),
  accumulator = 0,
  frame;
function reset(nextMode) {
  run = createRun(level);
  painter.setLevel(level);
  mode = nextMode;
  elapsed = accumulator = 0;
  painter.draw(context, run, 0, { paused: true, signalReception: 'ready', backdrop });
}
function simulate() {
  stepRun(run, { direction: 'right' }, FIXED_DT);
  painter.effectsFor(run.events, run);
}
function draw(dt, running) {
  painter.draw(context, run, dt, {
    backdrop,
    paused: run.status === 'lost' || !running,
    reduced: reduced.checked,
    signalReception: mode === 'clean' ? 'off' : run.status === 'lost' ? 'lost' : 'playing',
    signalEffectsRunning: running,
    defeatEffectsRunning: run.status === 'lost' && running,
  });
  status.textContent =
    run.status === 'lost'
      ? mode === 'mid-loss'
        ? 'Mid-loss · 400ms · masked feed loses colour and horizontal sync.'
        : 'Signal lost · terminal run stays frozen; controls remain clear.'
      : mode === 'clean'
        ? 'Clean feed · no transition.'
        : 'Acquiring signal · terrain, trail and craft remain sharp.';
}
function preview(kind) {
  reset(kind);
  if (kind === 'lost' || kind === 'mid-loss') {
    while (run.status === 'running') simulate();
    for (let i = 0; i < (kind === 'mid-loss' ? 4 : 9); i++) draw(0.1, true);
  } else draw(0, false);
}
document.querySelector('#replay').onclick = () => reset('sequence');
document.querySelector('#acquire').onclick = () => preview('acquire');
document.querySelector('#lost').onclick = () => preview('lost');
document.querySelector('#mid-loss').onclick = () => preview('mid-loss');
document.querySelector('#clean').onclick = () => preview('clean');
reduced.onchange = () => preview(mode === 'sequence' ? 'acquire' : mode);
function update(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  if (!document.hidden && mode === 'sequence') {
    elapsed += dt;
    if (elapsed > 0.7 && run.status === 'running') {
      accumulator += dt;
      while (accumulator >= FIXED_DT && run.status === 'running') {
        simulate();
        accumulator -= FIXED_DT;
      }
    }
    draw(dt, true);
  }
  frame = requestAnimationFrame(update);
}
reset('sequence');
frame = requestAnimationFrame(update);
window.addEventListener('pagehide', () => {
  cancelAnimationFrame(frame);
  painter.dispose();
});
