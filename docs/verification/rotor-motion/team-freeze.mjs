import { createPresentationHost } from '../../../game/presentation/host.mjs';
import { createCoopPainter } from '../../../game/couch/coop-view.mjs';
import { teamBonusReviewCheckpoints, teamBonusReviewInitial } from './team-freeze-fixture.mjs';

const $ = (id) => document.getElementById(id),
  host = createPresentationHost(),
  checkpoints = teamBonusReviewCheckpoints(),
  labels = ['Before pickup', 'Freeze starts', 'Freeze held', 'Effect expires', 'Moving again'];
let snapshot = null,
  controller = null,
  disposed = false;
function controls() {
  $('load').hidden = Boolean(snapshot);
  $('load').disabled = Boolean(controller);
  $('cancel').hidden = !controller;
  for (const id of ['phase', 'rig', 'reduced', 'light'])
    $(id).disabled = !snapshot || Boolean(controller);
}
function paint() {
  if (!snapshot || disposed) return;
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 360;
  const painter = createCoopPainter({
      width: 720,
      height: 360,
      clientWidth: 720,
      getContext: (...args) => canvas.getContext(...args),
    }),
    rig = $('rig').checked,
    asset = snapshot.resolved.assets['player.scout.compact'];
  painter.setPresentation({
    ...snapshot,
    resolved: {
      ...snapshot.resolved,
      assets: { ...snapshot.resolved.assets, ...(rig ? { 'team.enemy.drifter': asset } : {}) },
    },
    image: (slot) =>
      snapshot.image(rig && slot === 'team.enemy.drifter' ? 'player.scout.compact' : slot),
    canvas: {
      ...snapshot.canvas,
      palette: { ...snapshot.canvas.palette, field: $('light').checked ? '#dcc99b' : '#07111c' },
    },
  });
  const run = teamBonusReviewInitial(),
    fragment = document.createDocumentFragment();
  painter.paint(run, { reduced: $('reduced').checked });
  for (let index = 0; index < checkpoints.length; index++) {
    Object.assign(run, structuredClone(checkpoints[index]));
    const before = JSON.stringify(run);
    painter.paint(run, { reduced: $('reduced').checked });
    if (JSON.stringify(run) !== before) throw new Error('The painter changed a Team checkpoint.');
    const enemy = run.enemies[0],
      frame = painter.actorFrame('enemy', enemy.id),
      figure = document.createElement('figure'),
      caption = document.createElement('figcaption'),
      crop = document.createElement('canvas');
    crop.width = crop.height = 96;
    crop.setAttribute('aria-label', `${labels[index]}: prepared drifter at native size`);
    crop
      .getContext('2d')
      .drawImage(
        canvas,
        Math.round(enemy.x * 10 - 48),
        Math.round(enemy.y * 10 - 48),
        96,
        96,
        0,
        0,
        96,
        96,
      );
    caption.textContent = `${labels[index]} · tick ${run.tick} · rotor ${frame.rotorPhase.toFixed(4)} · ${frame.locked ? 'held' : 'released'}`;
    figure.append(crop, caption);
    fragment.append(figure);
    if (index === Number($('phase').value)) {
      const ctx = $('board').getContext('2d');
      ctx.clearRect(0, 0, 720, 360);
      ctx.drawImage(canvas, 0, 0);
    }
  }
  $('poses').replaceChildren(fragment);
  canvas.width = 0;
}
async function load() {
  if (controller || disposed) return;
  const owner = new AbortController();
  controller = owner;
  controls();
  $('status').textContent = 'Verifying compiled actor bytes and preparing frames…';
  const timeout = setTimeout(() => owner.abort(), 15000);
  try {
    const next = await host.load({ signal: owner.signal });
    if (disposed || controller !== owner || owner.signal.aborted) return;
    snapshot = next;
    paint();
    $('status').textContent =
      `Five real-core checkpoints. Current manifest ${next.manifestSha256.slice(0, 12)}. Source review only; changing the Team adapter reopens production source approval.`;
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
for (const id of ['phase', 'rig', 'reduced', 'light'])
  $(id).addEventListener('change', () => {
    try {
      paint();
    } catch (error) {
      $('status').textContent = `Review unavailable: ${error.message}`;
    }
  });
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
