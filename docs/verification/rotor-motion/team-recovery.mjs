import { createPresentationHost } from '../../../game/presentation/host.mjs';
import { createCoopPainter } from '../../../game/couch/coop-view.mjs';
import { TEAM_RECOVERY_STAGES, visitTeamRecovery } from './team-recovery-fixture.mjs';

const $ = (id) => document.getElementById(id),
  host = createPresentationHost();
let snapshot = null,
  controller = null,
  disposed = false;
function controls() {
  $('load').hidden = Boolean(snapshot);
  $('load').disabled = Boolean(controller);
  $('cancel').hidden = !controller;
  for (const id of ['arena', 'phase', 'reduced', 'light'])
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
    fragment = document.createDocumentFragment();
  painter.setPresentation({
    ...snapshot,
    canvas: {
      ...snapshot.canvas,
      palette: { ...snapshot.canvas.palette, field: $('light').checked ? '#dcc99b' : '#07111c' },
    },
  });
  try {
    visitTeamRecovery({
      arena: $('arena').value,
      visit(run, index) {
        const before = JSON.stringify(run);
        painter.paint(run, { reduced: $('reduced').checked });
        if (JSON.stringify(run) !== before) throw new Error('Painting changed a Team checkpoint.');
        if (index < 0) return;
        for (const player of run.players) {
          const frame = painter.actorFrame('pilot', player.id),
            figure = document.createElement('figure'),
            caption = document.createElement('figcaption'),
            crop = document.createElement('canvas');
          crop.width = crop.height = 96;
          crop.setAttribute(
            'aria-label',
            `${TEAM_RECOVERY_STAGES[index].label}: player ${player.id + 1} at native size`,
          );
          crop
            .getContext('2d')
            .drawImage(
              canvas,
              Math.max(0, Math.min(624, Math.round(player.x * 10 - 48))),
              Math.max(0, Math.min(264, Math.round(player.y * 10 - 48))),
              96,
              96,
              0,
              0,
              96,
              96,
            );
          caption.textContent = `${TEAM_RECOVERY_STAGES[index].label} · P${player.id + 1} · tick ${run.tick} · ${frame.pilotState} · heading ${frame.heading.toFixed(2)} · speed ${frame.speed.toFixed(2)}`;
          figure.append(crop, caption);
          fragment.append(figure);
        }
        if (index === Number($('phase').value)) {
          const ctx = $('board').getContext('2d');
          ctx.clearRect(0, 0, 720, 360);
          ctx.drawImage(canvas, 0, 0);
        }
      },
    });
    $('poses').replaceChildren(fragment);
  } finally {
    canvas.width = 0;
  }
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
      `Four public-core checkpoints, both pilots. Manifest ${next.manifestSha256.slice(0, 12)}. Source review only; revised Team presentation requires production approval and public verification.`;
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
for (const id of ['arena', 'phase', 'reduced', 'light'])
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
