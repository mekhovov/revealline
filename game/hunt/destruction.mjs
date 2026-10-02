import {
  HUNT_PRESENTATION_CATALOG as catalog,
  huntActorPresentation,
  huntDestructionRecipe,
} from './presentation-catalog.mjs';
/** Cosmetic pixel art and bounded defeat animation. Never reads gameplay RNG. */
const hash = (text) => {
  let n = 2166136261;
  for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
};
const rect = (ctx, color, x, y, w, h) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};
const { edge, blood, flesh } = catalog.palette;
const { recipes, budgets } = catalog;
const particleLimit = budgets.pageParticles / budgets.painters;
const envelopeLimit = budgets.pageEnvelopes / budgets.painters;
const coatFor = (kind, accent) => {
  const actor = huntActorPresentation(kind);
  return actor?.tintWithAccent ? (accent ?? actor.palette.coat) : (actor?.palette.coat ?? accent);
};
function art(ctx, rectangles, palette) {
  for (const [color, x, y, width, height] of rectangles)
    rect(ctx, palette[color], x, y, width, height);
}
export function drawHumanoidPixelBody(ctx, { kind = 'runner', pose = 0 }, palette = {}) {
  const actor = huntActorPresentation(kind);
  if (!actor) return;
  const colors = { ...catalog.palette, ...actor.palette };
  if (actor.tintWithAccent && palette.accent) colors.coat = palette.accent;
  art(
    ctx,
    actor.artwork.frames[
      (Number.isFinite(pose) ? Math.abs(Math.trunc(pose)) : 0) % actor.artwork.frames.length
    ],
    colors,
  );
}
function piece(ctx, index, bloody, color, unit) {
  ctx.scale(unit, unit);
  const material = catalog.materials[bloody ? 'flesh' : 'neutral'];
  art(ctx, material.fragments[index % material.fragments.length], {
    ...catalog.palette,
    coat: color,
  });
}

export function drawHuntRemains(
  ctx,
  mark,
  { unit = 1, brutal = false, blood: showBlood = true, color = '#79d7ce' } = {},
) {
  const seed = hash(`${mark.id}/${mark.tick}`),
    bloody = brutal && showBlood && huntActorPresentation(mark.kind)?.material === 'flesh';
  const x = mark.x * catalog.pixelSize,
    y = mark.y * catalog.pixelSize;
  ctx.save();
  ctx.translate(x, y);
  if (bloody) {
    ctx.globalAlpha *= recipes.settled.poolOpacity;
    rect(ctx, blood, -7 * unit, -2 * unit, 14 * unit, 4 * unit);
    rect(ctx, blood, -4 * unit, -4 * unit, 8 * unit, 8 * unit);
    rect(ctx, flesh, -2 * unit, -unit, 3 * unit, 2 * unit);
    for (let i = 0; i < 3; i++) {
      const angle = ((seed + i * 139) % 628) / 100;
      rect(ctx, blood, Math.cos(angle) * 9 * unit, Math.sin(angle) * 6 * unit, unit, unit);
    }
    ctx.globalAlpha /= recipes.settled.poolOpacity;
  }
  for (let i = 0; i < (brutal ? recipes.settled.fullPieces : recipes.settled.cleanPieces); i++) {
    const angle = (seed % 628) / 100 + i * 1.8;
    ctx.save();
    ctx.translate(Math.cos(angle) * 5 * unit, Math.sin(angle) * 3 * unit);
    ctx.rotate(angle);
    piece(
      ctx,
      i,
      bloody,
      coatFor(mark.kind, color),
      unit * (brutal ? recipes.settled.fullScale : recipes.settled.cleanScale),
    );
    ctx.restore();
  }
  ctx.restore();
}

const DIRECTION = Object.freeze({
  up: [0, -1],
  right: [1, 0],
  down: [0, 1],
  left: [-1, 0],
});
function impactAngle(mark, sources, seed) {
  const candidates = sources.filter(
    (source) =>
      source &&
      Number.isFinite(source.x) &&
      Number.isFinite(source.y) &&
      (!source.status || source.status === 'active') &&
      (!mark.players?.length || mark.players.includes(source.id)),
  );
  const closest = candidates.reduce(
    (best, source) =>
      !best ||
      Math.hypot(source.x - mark.x, source.y - mark.y) <
        Math.hypot(best.x - mark.x, best.y - mark.y)
        ? source
        : best,
    null,
  );
  if (!closest) return (seed % 628) / 100;
  const dx = mark.x - closest.x,
    dy = mark.y - closest.y;
  if (Math.hypot(dx, dy) > 0.05) return Math.atan2(dy, dx);
  const heading = DIRECTION[closest.direction];
  if (heading) return Math.atan2(heading[1], heading[0]);
  if (
    Number.isFinite(closest.vx) &&
    Number.isFinite(closest.vy) &&
    Math.hypot(closest.vx, closest.vy) > 0.001
  )
    return Math.atan2(closest.vy, closest.vx);
  return (seed % 628) / 100;
}

/** Two compact stepped blast envelopes per painter. Both materials use the same
 * geometry; blood is a color/body recipe, never an extra damage or collision. */
function blast(ctx, burst, t, unit) {
  const recipe = huntDestructionRecipe(burst.cause),
    phase = t / recipe.envelopeLife;
  if (phase < 0 || phase >= 1) return;
  const x = burst.x * catalog.pixelSize,
    y = burst.y * catalog.pixelSize,
    capture = recipe.radial,
    radius = (recipe.radius + phase * recipe.radiusChange) * unit;
  ctx.save();
  ctx.globalAlpha *= (1 - phase) * (burst.chain > 1 ? recipes.group.opacity : recipe.opacity);
  const color = burst.bloody ? flesh : catalog.palette.spark;
  if (capture) {
    // An enclosure collapses in four corners before its pieces fan out.
    for (const dx of [-1, 1])
      for (const dy of [-1, 1]) {
        rect(ctx, color, x + dx * radius - 2 * unit, y + dy * radius - unit, 4 * unit, 2 * unit);
        rect(ctx, color, x + dx * radius - unit, y + dy * radius - 2 * unit, 2 * unit, 4 * unit);
      }
  } else {
    // A contact blast is stretched along the actual approach direction.
    ctx.translate(x, y);
    ctx.rotate(burst.angle);
    rect(ctx, color, -radius * 0.4, -unit, radius * 1.6, 2 * unit);
    rect(ctx, color, radius * 0.25, -radius * 0.45, 2 * unit, radius * 0.9);
    rect(ctx, edge, 0, -unit, 3 * unit, 2 * unit);
  }
  ctx.restore();
}

/** At most 64 particles/two envelopes per painter: two-board hosts stay within
 * the page-wide 128/four budget. The 24 records are cosmetic clusters per board.
 * Sources are read-only craft positions for contact direction, not gameplay RNG. */
export function createHuntDestruction() {
  let owner = null,
    seen = new Set(),
    bursts = [],
    enabled = false,
    bloodEnabled = false;
  return Object.freeze({
    reset() {
      owner = null;
      seen.clear();
      bursts = [];
      enabled = false;
    },
    advance(
      view,
      dt,
      {
        key,
        paused = false,
        brutal = false,
        blood: showBlood = true,
        reduced = false,
        concealed = false,
        sources = [],
      } = {},
    ) {
      if (!view || !view.valid) {
        bursts = [];
        return;
      }
      if (owner !== key) {
        owner = key;
        seen = new Set(view.eliminations.map((m) => m.id));
        bursts = [];
      }
      if (concealed) {
        seen = new Set(view.eliminations.map((m) => m.id));
        bursts = [];
        enabled = brutal;
        bloodEnabled = showBlood;
        return;
      }
      if (!brutal || reduced || (bloodEnabled && !showBlood)) bursts = [];
      if (!paused)
        bursts = bursts
          .map((b) => ({ ...b, age: b.age + Math.max(0, Math.min(0.1, dt || 0)) }))
          .filter((b) => b.age < huntDestructionRecipe(b.cause).life);
      const fresh = view.eliminations.filter((m) => !seen.has(m.id));
      for (const mark of fresh) seen.add(mark.id);
      if (brutal && !reduced && !paused && enabled) {
        for (const [index, mark] of fresh.entries()) {
          const seed = hash(`${mark.id}/${mark.tick}/${mark.cause}`);
          bursts.push({
            ...mark,
            seed,
            angle: impactAngle(mark, sources, seed),
            age: 0,
            delay: Math.min(index, recipes.group.maximumDelaySteps) * recipes.group.delayStep,
            chain: fresh.length,
            bloody: showBlood && huntActorPresentation(mark.kind)?.material === 'flesh',
          });
        }
        bursts = bursts.slice(-budgets.settledClustersPerBoard);
      }
      enabled = brutal;
      bloodEnabled = showBlood;
    },
    draw(ctx, { unit = 1, color = '#79d7ce' } = {}) {
      let particles = 0,
        envelopes = 0;
      ctx.save();
      // Newest removals retain feedback when a crowded enclosure uses the cap.
      for (let eventIndex = bursts.length - 1; eventIndex >= 0; eventIndex--) {
        const burst = bursts[eventIndex],
          t = burst.age - burst.delay,
          recipe = huntDestructionRecipe(burst.cause);
        if (t < 0) continue;
        if (envelopes < envelopeLimit && t < recipe.envelopeLife) {
          blast(ctx, burst, t, unit);
          envelopes++;
        }
        const capture = recipe.radial,
          count =
            bursts.length > recipes.group.crowdedAt ? recipes.group.fragments : recipe.fragments,
          fade = Math.min(1, Math.max(0, (recipe.life - burst.age) * 3)),
          x = burst.x * catalog.pixelSize,
          y = burst.y * catalog.pixelSize;
        for (let i = 0; i < count && particles < particleLimit; i++) {
          const variation = ((burst.seed >>> i % 8) % 101) / 100,
            angle = capture
              ? ((burst.seed + i * 107) % 628) / 100
              : burst.angle + (variation - 0.5) * recipe.spread,
            speed = (recipe.speed + variation * recipe.speedRange) * unit,
            px = x + Math.cos(angle) * speed * t,
            py = y + Math.sin(angle) * speed * t + recipe.gravity * unit * t * t;
          ctx.globalAlpha = fade;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(angle + t * (i % 2 ? 6 : -6));
          piece(ctx, i, burst.bloody, coatFor(burst.kind, color), unit);
          ctx.restore();
          particles++;
          // Directional stepped droplets or neutral chips share one hard cap.
          if (particles < particleLimit) {
            const stretch = recipe.trail * unit;
            ctx.save();
            ctx.translate(px - Math.cos(angle) * 4 * unit, py - Math.sin(angle) * 4 * unit);
            ctx.rotate(angle);
            rect(ctx, burst.bloody ? blood : catalog.palette.spark, -stretch, 0, stretch, unit);
            ctx.restore();
            particles++;
          }
        }
      }
      ctx.restore();
    },
  });
}
