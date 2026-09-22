import {
  createCombatPresentation,
  drawCombatWarnings,
  drawCombatProjectiles,
  drawCombatScrap,
} from '../ui/combat-presentation.mjs';
import { traceContentActor } from '../content-design/actor-marker.mjs';
import { PRESENTATION_INK, PRESENTATION_PLATE } from '../ui/actor-presentation.mjs';

const controls = Object.fromEntries(
  ['body-size', 'surface', 'effects', 'colour'].map((id) => [id, document.getElementById(id)]),
);
const studies = document.getElementById('studies');
const status = document.getElementById('review-status');
const painter = createCombatPresentation();
const rows = [
  [
    'scout',
    'Scout · removable',
    'A square visor, two feet and open side brackets. Contact or capture removes it; it never retains a field region.',
    'Two walking poses and an idle pose. Reduced effects makes every pose static.',
  ],
  [
    'warning',
    'Sentry · locked aim',
    'The dashed ray and fixed cross announce one non-homing shot. The ray continues beyond the aim point.',
    'The remaining-warning bar shrinks in gameplay. This specimen is halfway through.',
  ],
  [
    'recovery',
    'Sentry · resting',
    'The top emitter identifies the shooting role. A short rest bar marks recovery; it cannot shoot again immediately.',
    'Stationary recovery pose. Movement speed and rest come from the shared catalogue.',
  ],
  [
    'shot',
    'Projectile · exposed body only',
    'A solid diamond and short tail distinguish the live shot from a dashed warning or active trail.',
    'The visible centre marks the shot. Enlarged pixels do not enlarge its collision radius.',
  ],
  [
    'freeze',
    'Freeze · still visible',
    'Pause marks remain beside the actor and projectile. Frozen attacks never disappear into the background.',
    'Warning geometry and projectile positions remain visible with reduced effects.',
  ],
  [
    'scrap',
    'Removed · mechanical scrap',
    'Contact and capture leave the same small inert mark. A brief spark differs by cause, without gore or rewards.',
    'Left: contact spark. Middle: capture spark. Right: persistent scrap. No sparks in reduced effects.',
  ],
  [
    'keeper',
    'Field keeper · not removable',
    'The ordinary round role marker is deliberately different. A keeper still damages craft/trail and retains unclaimed territory.',
    'Shared authoring-role outline for comparison, not a new keeper skin.',
  ],
];
const specimens = rows.map(([id, title, explanation, caption]) => {
  const card = document.createElement('section');
  card.className = 'study';
  const h = document.createElement('h2');
  h.textContent = title;
  const p = document.createElement('p');
  p.className = 'material';
  p.textContent = explanation;
  const surface = document.createElement('div');
  surface.className = 'surface';
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${title}. ${explanation}`);
  const foot = document.createElement('p');
  foot.className = 'caption';
  foot.textContent = caption;
  surface.append(canvas);
  card.append(h, p, surface, foot);
  studies.append(card);
  return { id, canvas };
});

// Deliberately constructed static presentation specimens, never simulation state.
function specimen(scale) {
  const point = (x, y) => ({ x: x / (16 * scale), y: y / (16 * scale) });
  const actor = {
    id: 'robot',
    role: 'sentry',
    ...point(48, 64),
    vx: 0,
    vy: 0,
    radius: 0.22,
    phase: 'warning',
    warningTicks: 90,
    warningTotal: 180,
    aim: point(132, 64),
    rayEnd: point(220, 64),
  };
  const shot = { id: 'shot', actorId: 'robot', ...point(160, 64), vx: 8, vy: 0, radius: 0.1 };
  return {
    point,
    view: {
      valid: true,
      tick: 240,
      actorTick: 120,
      status: 'running',
      frozen: false,
      actors: [actor],
      projectiles: [shot],
      eliminations: [],
    },
  };
}
function render() {
  const size = Number(controls['body-size'].value);
  if (![16, 24, 32].includes(size)) return;
  const reduced = controls.effects.value === 'reduced';
  const palette =
    controls.colour.value === 'mono'
      ? { accent: PRESENTATION_INK, danger: PRESENTATION_INK }
      : { accent: '#79d7ce', danger: '#ffd27b' };
  studies.className = `studies ${['dark', 'light', 'grey'].includes(controls.surface.value) ? controls.surface.value : 'dark'}`;
  const scale = size / 26,
    options = { screenScale: scale, canvasCSSWidth: 256, reduced };
  for (const { id, canvas } of specimens) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 128);
    ctx.save();
    ctx.scale(scale, scale);
    const { view, point } = specimen(scale);
    if (id === 'scout') {
      for (const [i, x] of [48, 128, 208].entries()) {
        const actor = {
          ...view.actors[0],
          role: 'scout',
          ...point(x, 64),
          phase: 'cooldown',
          vx: i < 2 ? 2 : 0,
          warningTicks: 0,
          warningTotal: 0,
          aim: null,
          rayEnd: null,
        };
        painter.drawActors(ctx, { ...view, actorTick: i * 24, actors: [actor] }, palette, options);
      }
    } else if (id === 'warning' || id === 'freeze') {
      view.frozen = id === 'freeze';
      drawCombatWarnings(ctx, view, palette, options);
      painter.drawActors(ctx, view, palette, options);
      if (view.frozen) drawCombatProjectiles(ctx, view, palette, options);
    } else if (id === 'recovery') {
      view.actors[0] = {
        ...view.actors[0],
        ...point(128, 64),
        phase: 'recovery',
        warningTicks: 0,
        warningTotal: 0,
        aim: null,
        rayEnd: null,
      };
      painter.drawActors(ctx, view, palette, options);
    } else if (id === 'shot') {
      view.projectiles[0] = { ...view.projectiles[0], ...point(128, 64) };
      drawCombatProjectiles(ctx, view, palette, options);
    } else if (id === 'scrap') {
      view.eliminations = [
        ['ram', 48, 230],
        ['capture', 128, 230],
        ['capture', 208, 180],
      ].map(([cause, x, tick], i) => ({ id: `scrap-${i}`, cause, ...point(x, 64), tick }));
      drawCombatScrap(ctx, view, palette, options);
    } else {
      ctx.translate(128 / scale, 64 / scale);
      for (const [ink, width] of [
        [PRESENTATION_PLATE, 4 / scale],
        [PRESENTATION_INK, 2 / scale],
      ]) {
        ctx.strokeStyle = ink;
        ctx.lineWidth = width;
        ctx.beginPath();
        traceContentActor(ctx, 'bouncer', 0, 0, 13);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  status.textContent = `Seven static specimens · ${size}px robot bodies · ${reduced ? 'reduced effects' : 'normal effects'} · ${controls.colour.value === 'mono' ? 'monochrome' : 'workshop accents'} · not gameplay or published content.`;
}
for (const control of Object.values(controls)) control.addEventListener('change', render);
render();
