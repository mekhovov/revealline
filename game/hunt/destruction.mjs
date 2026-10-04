import { huntDestructionBudget } from './destruction-budget.mjs';
import { drawHuntActor } from './actor-art.mjs';
import { sharedActorAppearance, runtimeActorArtRevision } from './preferences.mjs';
import {
  INDUSTRIAL_SOLDIER_KIT_REVISION,
  INDUSTRIAL_SOLDIER_KITS,
} from './industrial-soldier-kit.mjs';
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
const actorFor = (mark) => {
  const cast = mark?.cast ?? sharedActorAppearance().snapshot().cast;
  return huntActorPresentation(
    typeof mark === 'string' ? mark : (mark.family ?? mark.pursuit?.behavior ?? mark.kind),
    cast === 'authored' ? 'rivals' : cast,
  );
};
const coatFor = (mark, accent) => {
  const actor = actorFor(mark);
  return actor?.tintWithAccent ? (accent ?? actor.palette.coat) : (actor?.palette.coat ?? accent);
};
function art(ctx, rectangles, palette) {
  for (const [color, x, y, width, height] of rectangles)
    rect(ctx, palette[color], x, y, width, height);
}
export function drawHumanoidPixelBody(ctx, actor = {}, palette = {}) {
  const kind = actor.family ?? actor.pursuit?.behavior ?? actor.kind ?? 'runner';
  const appearance = actorFor({ ...actor, kind });
  if (!appearance) return;
  const phase = actor.pursuit?.phase ?? actor.phase;
  drawHuntActor(ctx, 0, 0, 16, actor.pose ?? 0, {
    ...actor,
    kind,
    heading: actor.pursuit?.heading ?? actor.heading,
    nextHeading: actor.pursuit?.nextHeading ?? actor.nextHeading,
    goal: actor.pursuit?.goal ?? actor.goal,
    partnerId: actor.pursuit?.partnerId ?? actor.partnerId,
    phase: phase === 'recovering' ? 'rest' : phase,
    state: phase === 'blocked' ? 'blocked' : actor.state,
    cast: appearance.cast,
    palette,
    token: false,
    detail: 'compact',
  });
}
function equipment(ctx, family, colors, artRevision = null) {
  const kit = artRevision === INDUSTRIAL_SOLDIER_KIT_REVISION && INDUSTRIAL_SOLDIER_KITS[family];
  if (kit) {
    // The live 32px rig and this 16px defeat layer consume identical rectangles.
    // Center the detached accessory; its size never becomes collision geometry.
    for (const [role, x, y, width, height] of kit.rectangles)
      rect(
        ctx,
        colors[role] ?? role,
        (x - kit.size[0] / 2) / 2,
        (y - kit.size[1] / 2) / 2,
        width / 2,
        height / 2,
      );
    return;
  }
  const paint = (color, x, y, w, h) => rect(ctx, color, x, y, w, h);
  const { coat, light, dark, ink } = colors;
  if (family === 'courier') {
    paint(ink, -3, -3, 6, 6);
    paint('#c99455', -2, -2, 4, 4);
    paint('#ffe2a2', -2, -2, 4, 1);
    paint('#624a37', -1, -1, 2, 1);
  } else if (family === 'lookout') {
    paint(ink, -4, -1, 8, 1);
    paint(ink, -4, -2, 3, 4);
    paint(ink, 1, -2, 3, 4);
    paint(light, -3, -2, 1, 2);
    paint(light, 2, -2, 1, 2);
  } else if (family === 'shield-bearer' || family === 'brace-trooper') {
    paint(ink, -3, -3, 6, 6);
    paint(light, -2, -2, 4, 4);
    paint(dark, -1, -1, 2, 3);
    paint('#bca47f', -1, -2, 2, 1);
  } else if (family === 'relay-warden') {
    paint(ink, -3, -3, 6, 6);
    paint(dark, -2, -2, 4, 4);
    paint(light, -2, -2, 3, 1);
    paint(ink, 2, -6, 1, 5);
    paint(coat, -1, 0, 2, 1);
  } else if (family === 'rendezvous-pair') {
    paint(ink, -3, -2, 6, 4);
    paint(light, -2, -1, 2, 2);
    paint(light, 1, -1, 2, 2);
  } else if (family === 'sprinter') {
    paint(ink, -3, -3, 6, 1);
    paint(dark, -4, -2, 2, 4);
    paint(dark, 2, -2, 2, 4);
    paint(light, -4, -2, 1, 3);
    paint(coat, 1, 2, 3, 1);
  } else if (family === 'switchback') {
    paint(dark, -4, -2, 7, 2);
    paint(light, -4, -2, 6, 1);
    paint(coat, 2, -1, 2, 3);
  } else if (family === 'guard' || family === 'patroller') {
    paint(ink, -3, -2, 6, 4);
    paint(coat, -2, -1, 4, 2);
    paint(light, -3, 1, 7, 1);
  } else {
    paint(ink, -3, -3, 6, 6);
    paint(coat, -2, -2, 4, 4);
    paint(light, -2, -2, 1, 4);
    paint(dark, 0, -2, 1, 4);
  }
}

function piece(ctx, index, bloody, color, unit, appearance, artRevision = null) {
  ctx.scale(unit, unit);
  if (
    appearance &&
    (artRevision === INDUSTRIAL_SOLDIER_KIT_REVISION
      ? index === 0
      : (!bloody && index % 2 === 0) || (bloody && index % 6 === 4))
  ) {
    equipment(ctx, appearance.family, appearance.palette, artRevision);
    return;
  }
  const material = catalog.materials[bloody ? 'flesh' : 'neutral'];
  art(ctx, material.fragments[index % material.fragments.length], {
    ...catalog.palette,
    ...appearance?.palette,
    coat: color,
  });
  if (appearance && bloody && index % material.fragments.length === 0) {
    if (['guard', 'patroller', 'shield-bearer'].includes(appearance.family)) {
      rect(ctx, appearance.palette.coat, -2, -3, 5, 1);
      rect(ctx, appearance.palette.light, -2, -2, 5, 1);
    } else if (appearance.family === 'sprinter') {
      rect(ctx, appearance.palette.light, -2, -2, 5, 1);
    }
  }
}

export function drawHuntRemains(
  ctx,
  mark,
  {
    unit = 1,
    brutal = false,
    blood: showBlood = true,
    color = '#79d7ce',
    artRevision = runtimeActorArtRevision(),
  } = {},
) {
  const seed = hash(`${mark.id}/${mark.tick}`),
    bloody = brutal && showBlood && actorFor(mark)?.material === 'flesh';
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
      coatFor(mark, color),
      unit * (brutal ? recipes.settled.fullScale : recipes.settled.cleanScale),
      actorFor(mark),
      artRevision,
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
const cleanRecipe = Object.freeze({
  life: 0.42,
  envelopeLife: 0.14,
  speed: 9,
  speedRange: 7,
  spread: 1.3,
  gravity: 18,
  fragments: 2,
  trail: 1,
  radius: 2,
  radiusChange: 4,
  opacity: 0.3,
});
const recipeForBurst = (burst) =>
  burst.brutal
    ? huntDestructionRecipe(burst.cause)
    : { ...huntDestructionRecipe(burst.cause), ...cleanRecipe };

function blast(ctx, burst, t, unit) {
  const recipe = recipeForBurst(burst),
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
export function createHuntDestruction({
  preview = false,
  artRevision = runtimeActorArtRevision(),
  onPreempt = () => {},
  budget = huntDestructionBudget,
  now = () => globalThis.performance?.now?.() ?? Date.now(),
} = {}) {
  const budgetOwner = {};
  let lease = null,
    lastAdvance = null,
    drawn = { particles: 0, envelopes: 0 };
  const release = () => {
    lease?.release();
    lease = null;
  };
  const cancel = () => {
    bursts = [];
    release();
    drawn = { particles: 0, envelopes: 0 };
    onPreempt();
  };
  let owner = null,
    seen = new Set(),
    bursts = [],
    enabled = false,
    bloodEnabled = false,
    brutalEnabled = false;
  return Object.freeze({
    setArtRevision(value) {
      if (value === artRevision) return false;
      artRevision = value;
      this.reset();
      return true;
    },
    reset() {
      owner = null;
      seen.clear();
      bursts = [];
      enabled = false;
      brutalEnabled = false;
      lastAdvance = null;
      release();
      drawn = { particles: 0, envelopes: 0 };
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
      const time = now(),
        stale = lastAdvance !== null && time - lastAdvance > budgets.staleFrameMs;
      lastAdvance = time;
      if (!view || !view.valid) {
        cancel();
        return;
      }
      if (stale) {
        seen = new Set(view.eliminations.map((m) => m.id));
        cancel();
      }
      if (owner !== key) {
        owner = key;
        seen = new Set(view.eliminations.map((m) => m.id));
        bursts = [];
        release();
      }
      if (concealed) {
        seen = new Set(view.eliminations.map((m) => m.id));
        bursts = [];
        release();
        enabled = true;
        brutalEnabled = brutal;
        bloodEnabled = showBlood;
        return;
      }
      if ((!brutal && brutalEnabled) || reduced || (bloodEnabled && !showBlood)) {
        bursts = [];
        release();
      }
      if (!paused)
        bursts = bursts
          .map((b) => ({ ...b, age: b.age + Math.max(0, Math.min(0.1, dt || 0)) }))
          .filter((b) => b.age < recipeForBurst(b).life);
      const fresh = view.eliminations.filter((m) => !seen.has(m.id));
      for (const mark of fresh) seen.add(mark.id);
      if (!bursts.length) release();
      if (!reduced && !paused && enabled && fresh.length) {
        lease = budget.claim(budgetOwner, { preview, cancel });
        if (!lease) {
          enabled = true;
          brutalEnabled = brutal;
          bloodEnabled = showBlood;
          return;
        }
        for (const [index, mark] of fresh.entries()) {
          const seed = hash(`${mark.id}/${mark.tick}/${mark.cause}`);
          bursts.push({
            ...mark,
            seed,
            angle: impactAngle(mark, sources, seed),
            age: 0,
            delay: Math.min(index, recipes.group.maximumDelaySteps) * recipes.group.delayStep,
            chain: fresh.length,
            brutal,
            bloody: brutal && showBlood && actorFor(mark)?.material === 'flesh',
            ...(artRevision === INDUSTRIAL_SOLDIER_KIT_REVISION
              ? { kitAppearance: actorFor(mark) }
              : {}),
          });
        }
        bursts = bursts.slice(-budgets.settledClustersPerBoard);
      }
      enabled = true;
      brutalEnabled = brutal;
      bloodEnabled = showBlood;
      if (bursts.length) lease = budget.claim(budgetOwner, { preview, cancel });
    },
    snapshot() {
      return Object.freeze({
        bursts: bursts.length,
        newestBurstAge: bursts.at(-1)?.age ?? null,
        ...drawn,
        allocatedParticles: lease?.active ? lease.particles : 0,
        allocatedEnvelopes: lease?.active ? lease.envelopes : 0,
      });
    },
    draw(ctx, { unit = 1, color = '#79d7ce' } = {}) {
      drawn = { particles: 0, envelopes: 0 };
      if (!bursts.length || !lease?.active) return;
      const particleLimit = lease.particles,
        envelopeLimit = lease.envelopes;
      let particles = 0,
        envelopes = 0;
      ctx.save();
      // Newest removals retain feedback when a crowded enclosure uses the cap.
      for (let eventIndex = bursts.length - 1; eventIndex >= 0; eventIndex--) {
        const burst = bursts[eventIndex],
          t = burst.age - burst.delay,
          recipe = recipeForBurst(burst);
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
          piece(
            ctx,
            i,
            burst.bloody,
            coatFor(burst, color),
            unit,
            burst.kitAppearance ?? actorFor(burst),
            artRevision,
          );
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
      drawn = { particles, envelopes };
    },
  });
}
