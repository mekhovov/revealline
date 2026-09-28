import { createPresentationHost } from '../../../game/presentation/host.mjs';
import { createCoopPainter } from '../../../game/couch/coop-view.mjs';
import { hunterReviewCheckpoints } from './team-hunter-fixture.mjs';

const $ = (id) => document.getElementById(id),
  host = createPresentationHost(),
  checkpoints = hunterReviewCheckpoints(),
  labels = ['Patrol', 'Warning', 'Charge', 'Recovery'];
let snapshot = null,
  controller = null,
  disposed = false;
function controls() {
  $('load').hidden = Boolean(snapshot);
  $('load').disabled = Boolean(controller);
  $('cancel').hidden = !controller;
  for (const id of ['phase', 'reduced', 'light']) $(id).disabled = !snapshot || Boolean(controller);
}
function render(index) {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 360;
  const painter = createCoopPainter({
    width: canvas.width,
    height: canvas.height,
    clientWidth: canvas.width,
    getContext: (...args) => canvas.getContext(...args),
  });
  painter.setPresentation({
    ...snapshot,
    canvas: {
      ...snapshot.canvas,
      palette: { ...snapshot.canvas.palette, field: $('light').checked ? '#dcc99b' : '#07111c' },
    },
  });
  const run = structuredClone(checkpoints[0]);
  for (let i = 0; i <= index; i++) {
    Object.assign(run, structuredClone(checkpoints[i]));
    const before = JSON.stringify(run);
    painter.paint(run, { reduced: $('reduced').checked });
    if (before !== JSON.stringify(run)) throw new Error('The painter changed a review checkpoint.');
  }
  const enemy = run.enemies[0],
    frame = painter.actorFrame('enemy', enemy.id);
  return { canvas, enemy, frame, time: run.time };
}
function paint() {
  if (!snapshot || disposed) return;
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 4; index++) {
    const result = render(index),
      figure = document.createElement('figure'),
      caption = document.createElement('figcaption'),
      crop = document.createElement('canvas');
    crop.width = crop.height = 96;
    crop.setAttribute('aria-label', `${labels[index]}: prepared hunter crop at native size`);
    crop
      .getContext('2d')
      .drawImage(
        result.canvas,
        Math.round(result.enemy.x * 10 - 48),
        Math.round(result.enemy.y * 10 - 48),
        96,
        96,
        0,
        0,
        96,
        96,
      );
    caption.textContent = `${labels[index]} · ${result.time.toFixed(2)}s · ${((result.frame.diameter * 10) / 16).toFixed(1)}px body envelope`;
    figure.append(crop, caption);
    fragment.append(figure);
    result.canvas.width = 0;
  }
  $('poses').replaceChildren(fragment);
  const result = render(Number($('phase').value));
  $('board').getContext('2d').drawImage(result.canvas, 0, 0);
  result.canvas.width = 0;
}
async function load() {
  if (controller || disposed) return;
  const owner = new AbortController();
  controller = owner;
  controls();
  $('status').textContent = 'Verifying compiled actor bytes and preparing image frames…';
  const timeout = setTimeout(() => owner.abort(), 15000);
  try {
    const next = await host.load({ signal: owner.signal });
    if (disposed || controller !== owner || owner.signal.aborted) return;
    snapshot = next;
    paint();
    $('status').textContent =
      `Four real-core checkpoints. Current actor manifest ${next.manifestSha256.slice(0, 12)}. No records or awards are written.`;
  } catch (error) {
    snapshot = null;
    if (!disposed && controller === owner)
      $('status').textContent = owner.signal.aborted
        ? 'Loading stopped. Load prepared actors to retry.'
        : `Review unavailable: ${error.message}`;
  } finally {
    clearTimeout(timeout);
    if (controller === owner) controller = null;
    if (!disposed) controls();
  }
}
$('load').addEventListener('click', load);
$('cancel').addEventListener('click', () => controller?.abort());
for (const id of ['phase', 'reduced', 'light']) $(id).addEventListener('change', paint);
addEventListener(
  'pagehide',
  () => {
    disposed = true;
    controller?.abort();
    host.close();
    snapshot = null;
  },
  { once: true },
);
