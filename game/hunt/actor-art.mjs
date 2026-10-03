import { createSoldierAnimation, sampleActorAnimation } from '../presentation/actor-animation.mjs';
import { actorArtReviewRevision } from './preferences.mjs';
import { actorVisual, resolveActorFamily } from './actor-catalog.mjs';
/** Original overhead pixel rigs. The host owns time, facing and vulnerability;
 * this renderer never advances AI, reads a clock or consumes randomness. */
const UNIT = 32;
const ANGLES = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
const STRIDE = [0, 1, 2, 0, -1, -2];
const BREATH = [0, 0, 1, 0];
const INK = '#192820';
const BOOT = '#26302c';

export const INDUSTRIAL_ACTOR_SAMPLES = Object.freeze({
  runner: createSoldierAnimation('industrial-runner', ['helmet', 'torso', 'arms', 'boots']),
  courier: createSoldierAnimation('industrial-courier', [
    'cap',
    'torso',
    'arms',
    'boots',
    'satchel',
  ]),
  guard: createSoldierAnimation(
    'industrial-guard',
    ['helmet', 'torso', 'arms', 'boots', 'armor', 'weapon'],
    'armor',
  ),
  'shield-bearer': createSoldierAnimation(
    'industrial-shield',
    ['helmet', 'torso', 'arms', 'boots', 'shield'],
    'armor',
  ),
});

export const OVERHEAD_ACTOR_ART_REVISION = 'industrial-overhead-v2';
export const OVERHEAD_ACTOR_SAMPLES = Object.freeze(
  Object.fromEntries(
    [
      ['lookout', ['cap', 'torso', 'arms', 'boots']],
      ['patroller', ['cap', 'torso', 'arms', 'boots']],
      ['runner', ['helmet', 'torso', 'arms', 'boots']],
      ['sprinter', ['helmet', 'torso', 'arms', 'boots']],
      ['courier', ['cap', 'torso', 'arms', 'boots', 'satchel']],
      ['guard', ['helmet', 'torso', 'arms', 'boots', 'armor', 'weapon']],
      ['refuge-seeker', ['helmet', 'torso', 'arms', 'boots', 'satchel']],
      ['switchback', ['helmet', 'torso', 'arms', 'boots']],
      ['rendezvous-pair', ['helmet', 'torso', 'arms', 'boots', 'satchel']],
      ['shield-bearer', ['helmet', 'torso', 'arms', 'boots', 'shield']],
      ['brace-trooper', ['helmet', 'torso', 'arms', 'boots', 'armor']],
      ['relay-warden', ['helmet', 'torso', 'arms', 'boots', 'armor']],
    ].map(([family, parts]) => [
      family,
      createSoldierAnimation(
        `overhead-${family}`,
        parts,
        ['guard', 'shield-bearer', 'brace-trooper', 'relay-warden'].includes(family)
          ? 'armor'
          : 'cloth',
      ),
    ]),
  ),
);

function pixel(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function facing(options) {
  // Specialist heading is the heading used by the accepted contact transaction.
  // A nextHeading warning must never rotate the currently protected front.
  if (Object.hasOwn(ANGLES, options.heading)) return ANGLES[options.heading];
  if (Number.isFinite(options.facingRadians)) return options.facingRadians;
  return ANGLES[options.direction] ?? ANGLES[options.facing] ?? 0;
}

function motion(pose, options, family) {
  const frozen = options.reducedEffects || options.frozen || options.paused;
  const time = !frozen && Number.isFinite(options.timeMs) ? options.timeMs : 0;
  const still =
    frozen ||
    family === 'lookout' ||
    ['rest', 'warning', 'turning', 'recovering', 'blocked'].includes(options.phase) ||
    ['idle', 'notice', 'recover', 'blocked', 'caught'].includes(options.state);
  const running = options.state === 'flee' || options.phase === 'burst' || family === 'sprinter';
  const frame = frozen
    ? 0
    : Number.isFinite(options.locomotionPhase)
      ? Math.floor(options.locomotionPhase * STRIDE.length)
      : Number.isFinite(options.timeMs)
        ? Math.floor(time / (running ? 85 : 130))
        : Number.isFinite(pose)
          ? Math.trunc(pose)
          : 0;
  return {
    stride: still ? 0 : STRIDE[((frame % STRIDE.length) + STRIDE.length) % STRIDE.length],
    breath: frozen ? 0 : BREATH[Math.floor(time / 300) % BREATH.length],
    running,
    moving: !still,
    idling: family === 'lookout' || options.state === 'idle',
    notice: options.state === 'notice',
    recovery: options.state === 'recover' || ['rest', 'recovering'].includes(options.phase),
    caught: options.state === 'caught',
  };
}

function pack(ctx, role, x, y, width, height, radio = false) {
  pixel(ctx, role.edge, x - 1, y, width + 2, height);
  pixel(ctx, INK, x, y, width, height);
  pixel(ctx, role.dark, x + 1, y + 1, width - 2, height - 2);
  pixel(ctx, role.trim, x + 1, y + 1, width - 2, 1);
  pixel(ctx, role.coat, x + 2, y + 3, width - 4, Math.max(1, height - 5));
  if (radio) {
    pixel(ctx, INK, x + width - 2, y - 7, 1, 8);
    pixel(ctx, role.edge, x + width - 2, y - 7, 1, 1);
    pixel(ctx, '#8ab5a6', x + 2, y + 2, 2, 1);
  }
}

function detailed(ctx, role, family, gait, options, cast) {
  const stride = gait.stride;
  const wide = family === 'brace-trooper' || family === 'relay-warden';
  const recovering = gait.recovery || gait.idling ? gait.breath : 0;
  const shoulderY = gait.caught ? 17 : 14 + recovering;
  // Foreshortened boots extend behind the hips; no front-view face or torso.
  for (const [x, offset] of [
    [10, stride],
    [18, -stride],
  ]) {
    pixel(ctx, role.edge, x - 1, 21 + offset, 5, 6);
    pixel(ctx, INK, x, 21 + offset, 4, 6);
    pixel(ctx, role.pants, x, 21 + offset, 3, 4);
    pixel(ctx, role.light, x, 21 + offset, 1, 3);
    pixel(ctx, BOOT, x - 1, 25 + offset, 5, 2);
  }
  // Alternating forward/back arm swings are visible on either side of the pack.
  for (const [x, offset] of [
    [5, -stride],
    [23, stride],
  ]) {
    const raised = gait.notice && x === 23 ? -4 : 0;
    pixel(ctx, role.edge, x - 1, shoulderY + offset + raised, 5, 8);
    pixel(ctx, INK, x, shoulderY + offset + raised, 4, 8);
    pixel(ctx, role.coat, x, shoulderY + offset + raised, 3, 5);
    pixel(ctx, role.light, x, shoulderY + offset + raised, 1, 3);
    pixel(ctx, role.glove, x, shoulderY + offset + raised + 5, 3, 2);
  }
  pixel(ctx, role.edge, wide ? 7 : 8, shoulderY - 1, wide ? 18 : 16, 9);
  pixel(ctx, INK, wide ? 8 : 9, shoulderY, wide ? 16 : 14, 10);
  pixel(ctx, role.coat, 10, shoulderY, 12, 9);
  pixel(ctx, role.light, 10, shoulderY, 3, 3);
  pixel(ctx, role.camo, 18, shoulderY + 1, 3, 2);
  pixel(ctx, role.camo, 11, shoulderY + 6, 4, 2);
  pixel(ctx, role.dark, 13, shoulderY, 2, 10);
  pixel(ctx, role.trim, 14, shoulderY + 5, 5, 2);
  pixel(ctx, role.dark, 19, shoulderY, 2, 10);
  pixel(ctx, role.trim, 10, shoulderY + 8, 12, 1);
  // Small field insignia is secondary to silhouette and equipment.
  pixel(ctx, '#d9ddcf', 6, shoulderY + 1, 2, 1);
  pixel(ctx, '#5a779d', 6, shoulderY + 2, 2, 1);
  pixel(ctx, '#965c55', 6, shoulderY + 3, 2, 1);

  if (family === 'refuge-seeker') pack(ctx, role, 11, 17, 11, 10);
  else if (family === 'rendezvous-pair' || family === 'relay-warden')
    pack(ctx, role, 12, 17, family === 'relay-warden' ? 11 : 9, 9, true);
  else if (family === 'patroller' || (cast === 'tactical' && !options.industrialSample))
    pack(ctx, role, 12, 18, 8, 7);
  else {
    pixel(ctx, INK, 10, 21, 4, 4);
    pixel(ctx, role.trim, 11, 22, 2, 2);
    pixel(ctx, INK, 19, 21, 4, 4);
    pixel(ctx, role.trim, 20, 22, 2, 2);
  }
  if (cast === 'rivals') {
    pixel(ctx, role.patch, 10, shoulderY + 2, 2, 2);
    pixel(ctx, role.patch, 20, shoulderY + 6, 2, 2);
  } else if (cast === 'arcade') {
    pixel(ctx, role.edge, 9, shoulderY, 2, 6);
    pixel(ctx, role.camo, 21, shoulderY + 3, 1, 4);
  }

  // The crown of the helmet is the dominant head surface. The nose is a single
  // front edge; helmet seams and rear strap distinguish front from back.
  const hood = family === 'refuge-seeker';
  const cap = family === 'lookout' || (cast === 'rivals' && family === 'runner');
  pixel(ctx, role.edge, 11, 7, 10, 10);
  pixel(ctx, role.edge, 10, 9, 12, 6);
  pixel(ctx, INK, 11, 8, 10, 8);
  pixel(ctx, INK, 12, 7, 8, 10);
  pixel(ctx, hood ? role.dark : role.coat, 12, 8, 8, 7);
  pixel(ctx, role.light, 12, 8, 5, 2);
  pixel(ctx, role.camo, 16, 10, 4, 2);
  pixel(ctx, role.camo, 12, 13, 3, 2);
  pixel(ctx, role.dark, 14, 15, 4, 2);
  pixel(ctx, role.skin, 15, 6, 2, 1);
  if (cap) {
    pixel(ctx, INK, 11, 6, 10, 2);
    pixel(ctx, role.trim, 12, 6, 8, 1);
  } else if (!hood) {
    pixel(ctx, role.trim, 14, 8, 1, 6);
    pixel(ctx, role.dark, 20, 10, 1, 4);
  }
  if (family === 'runner' && (gait.notice || gait.recovery)) {
    pixel(ctx, role.skin, 10, 11, 1, 2);
    pixel(ctx, role.dark, 14, 8, 4, 1);
  }
  if (family === 'lookout') {
    const y = gait.notice || gait.breath ? 4 : 13;
    pixel(ctx, INK, 10, y, 4, 4);
    pixel(ctx, INK, 18, y, 4, 4);
    pixel(ctx, role.dark, 13, y + 2, 6, 1);
    pixel(ctx, '#a9c5bf', 11, y, 2, 1);
    pixel(ctx, '#a9c5bf', 19, y, 2, 1);
  } else if (family === 'sprinter') {
    pixel(ctx, INK, 10, 10, 2, 5);
    pixel(ctx, INK, 21, 10, 2, 5);
    pixel(ctx, role.trim, 11, 9, 10, 1);
    pixel(ctx, role.edge, 22, 9, 1, 3);
    if (options.phase === 'warning') pixel(ctx, role.dark, 11, 16, 10, 3);
  } else if (family === 'courier') {
    const bounce = Math.abs(stride) === 2 ? 1 : 0;
    pixel(ctx, INK, 23, 17 - bounce, 6, 8);
    pixel(ctx, '#c99455', 24, 18 - bounce, 4, 6);
    pixel(ctx, '#ffe2a2', 24, 18 - bounce, 4, 1);
    pixel(ctx, '#624a37', 25, 20 - bounce, 2, 2);
    pixel(ctx, role.trim, 11, 17, 13, 1);
    if (gait.notice || options.state === 'idle') pixel(ctx, '#e5debd', 23, 14, 4, 3);
  } else if (family === 'guard' && options.armed === true) {
    // Only an accepted armed policy may request weapon geometry.
    pixel(ctx, INK, 23, 6, 2, 15);
    pixel(ctx, '#718277', 23, 10, 1, 7);
    pixel(ctx, '#735c40', 22, 18, 3, 4);
    pixel(ctx, role.glove, 21, 13, 3, 2);
    pixel(ctx, INK, 24, 13, 2, 3);
  } else if (family === 'switchback') {
    pixel(ctx, role.patch, 9, 15, 14, 2);
    pixel(ctx, role.trim, 22, 16, 3, 3);
    pixel(ctx, INK, 25, 18, 3, 8);
    pixel(ctx, role.trim, 26, 19, 1, 6);
  } else if (family === 'rendezvous-pair') {
    const partner = String(options.partnerId ?? '');
    const alternate = (partner.charCodeAt(partner.length - 1) || 0) % 2;
    pixel(ctx, alternate ? '#dac295' : '#9cbdbe', 12, 19, 3, 2);
    pixel(ctx, alternate ? '#9cbdbe' : '#dac295', 17, 19, 3, 2);
  } else if (family === 'shield-bearer') {
    pixel(ctx, INK, 6, 4, 20, 4);
    pixel(ctx, '#84928a', 7, 4, 18, 2);
    pixel(ctx, '#c8d0bd', 8, 4, 16, 1);
    pixel(ctx, '#384c46', 12, 5, 8, 2);
  } else if (family === 'brace-trooper') {
    const closed = options.phase === 'warning' || options.phase === 'burst';
    for (const x of closed ? [10, 16] : [7, 21]) {
      pixel(ctx, INK, x, 16, closed ? 6 : 4, 8);
      pixel(ctx, role.trim, x + 1, 17, closed ? 4 : 2, 6);
      pixel(ctx, role.light, x + 1, 17, closed ? 4 : 2, 1);
    }
    if (!closed) pixel(ctx, '#aec3a0', 14, 19, 4, 3);
  } else if (family === 'relay-warden') {
    pixel(ctx, INK, 9, 9, 2, 5);
    pixel(ctx, role.trim, 10, 8, 12, 1);
    pixel(ctx, role.edge, 10, 7, 3, 1);
    pixel(ctx, INK, 24, 11, 1, 9);
    pixel(ctx, role.trim, 24, 11, 1, 1);
  }
}

function compact(ctx, role, family, gait, options, cast) {
  ctx.save();
  ctx.scale(2, 2);
  const step = Math.sign(gait.stride);
  const breath = gait.idling || gait.recovery ? gait.breath : 0;
  for (const [x, offset] of [
    [5, step],
    [9, -step],
  ]) {
    pixel(ctx, role.edge, x - 1, 10 + offset, 3, 4);
    pixel(ctx, role.pants, x, 10 + offset, 2, 3);
    pixel(ctx, BOOT, x, 13 + offset, 2, 1);
  }
  pixel(ctx, role.edge, 3, 7, 10, 5);
  pixel(ctx, INK, 4, 7, 8, 5);
  pixel(ctx, role.coat, 5, 7, 6, 5);
  pixel(ctx, role.camo, 8, 9, 3, 2);
  for (const [x, offset] of [
    [2, -step],
    [12, step],
  ]) {
    pixel(ctx, role.edge, x, 7 + offset, 2, 4);
    pixel(ctx, role.coat, x, 7 + offset, 1, 3);
    pixel(ctx, role.glove, x, 10 + offset, 2, 1);
  }
  pixel(ctx, role.dark, 6, 10 + breath, 4, 3);
  pixel(ctx, role.trim, 6, 10 + breath, 4, 1);
  if (breath) {
    pixel(ctx, role.light, 4, 7, 1, 2);
    pixel(ctx, role.light, 11, 7, 1, 2);
  }
  pixel(ctx, role.edge, 5, 3, 6, 5);
  pixel(ctx, INK, 5, 4, 6, 4);
  pixel(ctx, role.coat, 6, 3, 4, 4);
  pixel(ctx, role.light, 6, 3, 3, 1);
  pixel(ctx, role.camo, 8, 5, 2, 1);
  pixel(ctx, role.skin, 7, 2, 2, 1);
  pixel(ctx, role.dark, 7, 7, 2, 1);
  if (cast === 'rivals') pixel(ctx, role.patch, 5, 8, 2, 1);
  if (cast === 'arcade') pixel(ctx, role.light, 4, 8, 1, 3);
  if (family === 'lookout') {
    const y = gait.notice || breath ? 2 : 6;
    pixel(ctx, INK, 4, y, 2, 2);
    pixel(ctx, INK, 10, y, 2, 2);
    pixel(ctx, '#a9c5bf', 4, y, 1, 1);
    pixel(ctx, '#a9c5bf', 11, y, 1, 1);
  } else if (family === 'patroller') {
    pixel(ctx, role.trim, 5, 2, 6, 1);
    pixel(ctx, INK, 6, 9, 5, 4);
    pixel(ctx, role.trim, 7, 10, 3, 2);
  } else if (family === 'sprinter') {
    pixel(ctx, INK, 4, 4, 1, 3);
    pixel(ctx, INK, 11, 4, 1, 3);
    pixel(ctx, role.trim, 5, 3, 6, 1);
  } else if (family === 'courier') {
    pixel(ctx, INK, 12, 9, 3, 4);
    pixel(ctx, '#c99455', 13, 10, 2, 3);
    pixel(ctx, '#ffe2a2', 13, 10, 2, 1);
  } else if (family === 'guard' && options.armed === true) {
    pixel(ctx, INK, 12, 3, 1, 8);
    pixel(ctx, '#735c40', 11, 10, 2, 2);
  } else if (family === 'refuge-seeker') {
    pixel(ctx, role.dark, 5, 3, 1, 5);
    pixel(ctx, role.dark, 10, 3, 1, 5);
    pixel(ctx, INK, 5, 9, 7, 5);
    pixel(ctx, role.trim, 6, 10, 5, 3);
  } else if (family === 'switchback') {
    pixel(ctx, role.patch, 4, 7, 8, 1);
    pixel(ctx, role.trim, 13, 9, 1, 5);
  } else if (family === 'rendezvous-pair' || family === 'relay-warden') {
    pixel(ctx, INK, 6, 9, 6, 5);
    pixel(ctx, role.trim, 7, 10, 4, 3);
    pixel(ctx, INK, 11, 5, 1, 6);
    pixel(ctx, '#a8c9bb', 7, 10, 1, 1);
    if (family === 'relay-warden') {
      pixel(ctx, INK, 4, 5, 1, 3);
      pixel(ctx, role.trim, 5, 3, 6, 1);
      pixel(ctx, role.edge, 13, 7, 1, 4);
    }
  } else if (family === 'shield-bearer') {
    pixel(ctx, INK, 3, 2, 10, 2);
    pixel(ctx, '#c8d0bd', 4, 2, 8, 1);
    pixel(ctx, '#384c46', 6, 3, 4, 1);
  } else if (family === 'brace-trooper') {
    const closed = options.phase === 'warning' || options.phase === 'burst';
    pixel(ctx, role.light, closed ? 5 : 3, 8, closed ? 3 : 2, 4);
    pixel(ctx, role.trim, closed ? 8 : 11, 8, closed ? 3 : 2, 4);
    if (!closed) pixel(ctx, '#aec3a0', 7, 9, 2, 2);
  }
  ctx.restore();
}

/** Plan view, looking vertically down. The crown overlaps the shoulder plane;
 * there is no visible face or upright chest. Limbs swing around that plane and
 * remain mostly occluded beneath it. Helmet position never bobs off the centre. */
function overheadDetailed(ctx, role, family, gait, options, cast) {
  const stride = gait.stride,
    breath = gait.idling || gait.recovery ? gait.breath : 0,
    wide = ['guard', 'brace-trooper', 'relay-warden'].includes(family),
    hood = family === 'refuge-seeker',
    cap = ['lookout', 'patroller', 'courier'].includes(family),
    closed = options.phase === 'warning' || options.phase === 'burst';

  // Short soles and trouser tops are glimpsed beyond the rear/lateral silhouette.
  // They are drawn first so the shoulders, helmet and kit occlude the upper legs.
  for (const [x, offset] of [
    [10, stride],
    [18, -stride],
  ]) {
    pixel(ctx, role.edge, x - 1, 18 + offset, 6, 6);
    pixel(ctx, BOOT, x, 19 + offset, 4, 5);
    pixel(ctx, role.pants, x, 18 + offset, 4, 3);
    pixel(ctx, role.light, x, 18 + offset, 1, 2);
    pixel(ctx, INK, x + 1, 23 + offset, 3, 1);
  }
  // Bent elbows, then forearms reaching ahead; never long hanging portrait arms.
  for (const [x, offset] of [
    [5, -stride],
    [22, stride],
  ]) {
    const raised = gait.notice && x === 22 ? -2 : 0,
      y = 13 + offset + raised;
    pixel(ctx, role.edge, x - 1, y, 7, 6);
    pixel(ctx, INK, x, y, 5, 5);
    pixel(ctx, role.coat, x, y + 1, 4, 3);
    pixel(ctx, role.light, x, y + 1, 3, 1);
    pixel(ctx, INK, x + (x === 5 ? 1 : 0), y - 3, 4, 4);
    pixel(ctx, role.glove, x + (x === 5 ? 2 : 1), y - 2, 2, 3);
  }
  // A broad, shallow shoulder/upper-back footprint under the central crown.
  pixel(ctx, role.edge, wide ? 6 : 7, 12, wide ? 20 : 18, 10);
  pixel(ctx, INK, 8, 11, 16, 12);
  pixel(ctx, role.coat, 8, 12, 16, 9);
  pixel(ctx, role.light, 8, 12, 4, 2 + breath);
  pixel(ctx, role.light, 20, 12, 4, 2 + breath);
  pixel(ctx, role.camo, 8, 17, 4, 3);
  pixel(ctx, role.camo, 21, 15, 3, 3);
  pixel(ctx, role.dark, 11, 19, 10, 4);
  pixel(ctx, role.trim, 12, 21, 8, 1);
  if (cast === 'rivals') {
    pixel(ctx, role.patch, 8, 14, 3, 2);
    pixel(ctx, role.patch, 21, 19, 2, 2);
  } else if (cast === 'arcade') {
    pixel(ctx, role.edge, 8, 12, 3, 6);
    pixel(ctx, role.camo, 22, 13, 2, 5);
  }

  // Top planes of the kit project behind or beside the crown, not down a chest.
  if (['refuge-seeker', 'patroller', 'rendezvous-pair', 'relay-warden'].includes(family)) {
    const width = hood ? 12 : 10,
      x = hood ? 10 : 11;
    pixel(ctx, INK, x, 19, width, hood ? 7 : 6);
    pixel(ctx, role.dark, x + 1, 20, width - 2, hood ? 5 : 4);
    pixel(ctx, role.trim, x + 1, 20, width - 2, 2);
    pixel(ctx, role.coat, x + 3, 20, 2, hood ? 5 : 4);
    if (family === 'rendezvous-pair' || family === 'relay-warden') {
      pixel(ctx, INK, x + width - 1, 14, 1, 8);
      pixel(ctx, role.edge, x + width - 1, 14, 1, 1);
      pixel(ctx, '#a8c9bb', x + 2, 21, 2, 1);
    }
  } else {
    for (const x of [9, 20]) {
      pixel(ctx, INK, x, 19, 3, 4);
      pixel(ctx, role.trim, x, 19, 3, 2);
    }
  }
  if (family === 'guard') {
    pixel(ctx, role.dark, 7, 12, 5, 8);
    pixel(ctx, role.dark, 20, 12, 5, 8);
    pixel(ctx, '#99a58e', 8, 12, 3, 2);
    pixel(ctx, '#99a58e', 21, 12, 3, 2);
  }

  // Crown lies INSIDE the shoulders and obscures the spine/neck. The tiny front
  // brim plus rear strap communicates heading without eyes, mouth or face skin.
  pixel(ctx, role.edge, 11, 10, 10, 11);
  pixel(ctx, role.edge, 10, 12, 12, 7);
  pixel(ctx, INK, 11, 11, 10, 9);
  pixel(ctx, INK, 12, 10, 8, 11);
  pixel(ctx, hood ? role.dark : role.coat, 12, 11, 8, 8);
  pixel(ctx, role.light, 12, 11, 5, 2);
  pixel(ctx, role.light, 12, 13, 2, 3);
  pixel(ctx, role.camo, 16, 13, 4, 2);
  pixel(ctx, role.camo, 13, 17, 3, 2);
  pixel(ctx, role.dark, 14, 19, 4, 2);
  pixel(ctx, role.trim, cap ? 11 : 13, 9, cap ? 10 : 6, 2);
  if (hood) {
    pixel(ctx, role.coat, 10, 11, 2, 7);
    pixel(ctx, role.coat, 20, 11, 2, 7);
  } else if (!cap) pixel(ctx, role.trim, 15, 11, 1, 6);

  if (family === 'lookout') {
    const y = gait.notice || gait.breath ? 6 : 8;
    pixel(ctx, INK, 10, y, 5, 4);
    pixel(ctx, INK, 17, y, 5, 4);
    pixel(ctx, role.dark, 14, y + 1, 4, 2);
    pixel(ctx, '#a9c5bf', 11, y, 3, 1);
    pixel(ctx, '#a9c5bf', 18, y, 3, 1);
  } else if (family === 'patroller') {
    pixel(ctx, role.trim, 8, 15, 2, 2);
    pixel(ctx, INK, 24, 17, 2, 6);
    pixel(ctx, role.coat, 24, 18, 1, 3);
  } else if (family === 'runner') {
    pixel(ctx, role.trim, 11, 20, 2, 4);
    pixel(ctx, role.trim, 19, 20, 2, 4);
    if (gait.notice || gait.recovery) pixel(ctx, role.glove, 8, 11, 3, 2);
  } else if (family === 'sprinter') {
    pixel(ctx, INK, 9, 12, 2, 5);
    pixel(ctx, INK, 21, 12, 2, 5);
    pixel(ctx, role.trim, 11, 10, 10, 1);
    pixel(ctx, role.edge, 22, 11, 1, 2);
    if (options.phase === 'warning') {
      pixel(ctx, role.glove, 7, 10, 3, 3);
      pixel(ctx, role.glove, 22, 10, 3, 3);
    }
  } else if (family === 'courier') {
    const y = 18 - (Math.abs(stride) === 2 ? 1 : 0);
    pixel(ctx, INK, 23, y, 6, 6);
    pixel(ctx, '#795e3f', 24, y + 1, 4, 4);
    pixel(ctx, '#be9b65', 24, y + 1, 4, 2);
    pixel(ctx, '#d9c296', 26, y + 1, 1, 4);
    pixel(ctx, role.trim, 21, 16, 4, 1);
    if (gait.notice || gait.idling) pixel(ctx, '#e5debd', 25, y, 3, 2);
  } else if (family === 'guard' && options.armed === true) {
    pixel(ctx, INK, 24, 5, 2, 14);
    pixel(ctx, '#718277', 24, 9, 1, 7);
    pixel(ctx, '#735c40', 23, 18, 3, 4);
    pixel(ctx, role.glove, 22, 12, 3, 2);
  } else if (family === 'switchback') {
    pixel(ctx, role.patch, 10, 20, 13, 2);
    pixel(ctx, role.trim, 22, 20, 5, 2);
    pixel(ctx, role.patch, 25, 21, 3, 3);
    pixel(ctx, INK, 26, 24, 2, 1);
  } else if (family === 'rendezvous-pair') {
    const partner = String(options.partnerId ?? ''),
      alternate = (partner.charCodeAt(partner.length - 1) || 0) % 2;
    pixel(ctx, alternate ? '#dac295' : '#9cbdbe', 8, 14, 3, 2);
    pixel(ctx, alternate ? '#9cbdbe' : '#dac295', 21, 14, 3, 2);
  } else if (family === 'shield-bearer') {
    pixel(ctx, INK, 5, 5, 22, 4);
    pixel(ctx, '#84928a', 6, 5, 20, 2);
    pixel(ctx, '#c8d0bd', 7, 5, 18, 1);
    pixel(ctx, '#384c46', 12, 6, 8, 2);
    pixel(ctx, role.glove, 8, 9, 3, 3);
    pixel(ctx, role.glove, 21, 9, 3, 3);
  } else if (family === 'brace-trooper') {
    for (const x of closed ? [7, 20] : [3, 25]) {
      pixel(ctx, INK, x, closed ? 8 : 14, closed ? 5 : 4, 7);
      pixel(ctx, role.trim, x + 1, closed ? 9 : 15, closed ? 3 : 2, 5);
      pixel(ctx, role.light, x + 1, closed ? 9 : 15, closed ? 3 : 2, 1);
    }
    if (!closed) pixel(ctx, '#aec3a0', 14, 21, 4, 2);
  } else if (family === 'relay-warden') {
    pixel(ctx, role.trim, 6, 12, 5, 2);
    pixel(ctx, role.trim, 21, 12, 5, 2);
    pixel(ctx, INK, 9, 17, 1, 9);
    pixel(ctx, role.edge, 9, 17, 1, 1);
    pixel(ctx, INK, 9, 12, 2, 5);
    pixel(ctx, INK, 21, 12, 2, 5);
  }
}

function overheadCompact(ctx, role, family, gait, options, cast) {
  ctx.save();
  ctx.scale(2, 2);
  const step = Math.sign(gait.stride),
    breath = gait.idling || gait.recovery ? gait.breath : 0,
    closed = options.phase === 'warning' || options.phase === 'burst';
  for (const [x, offset] of [
    [5, step],
    [9, -step],
  ]) {
    pixel(ctx, role.edge, x - 1, 9 + offset, 4, 3);
    pixel(ctx, BOOT, x, 9 + offset, 2, 3);
    pixel(ctx, role.pants, x, 9 + offset, 2, 1);
  }
  for (const [x, offset] of [
    [2, -step],
    [11, step],
  ]) {
    pixel(ctx, role.edge, x, 6 + offset, 3, 3);
    pixel(ctx, role.coat, x, 7 + offset, 3, 1);
    pixel(ctx, role.glove, x + 1, 5 + offset, 2, 2);
  }
  pixel(ctx, role.edge, 3, 6, 10, 5);
  pixel(ctx, INK, 4, 5, 8, 7);
  pixel(ctx, role.coat, 4, 6, 8, 5);
  pixel(ctx, role.light, 4, 6, 2, 1 + breath);
  pixel(ctx, role.light, 10, 6, 2, 1 + breath);
  pixel(ctx, role.camo, 4, 9, 2, 2);
  pixel(ctx, role.dark, 6, 10, 4, 2);
  if (cast === 'rivals') pixel(ctx, role.patch, 4, 7, 1, 1);
  if (cast === 'arcade') pixel(ctx, role.edge, 11, 7, 1, 3);
  if (['patroller', 'refuge-seeker', 'rendezvous-pair', 'relay-warden'].includes(family)) {
    pixel(ctx, INK, 5, 10, 6, 3);
    pixel(ctx, role.trim, 6, 10, 4, 2);
    pixel(ctx, role.coat, 7, 10, 1, 3);
  }
  // The compact crown occupies the middle of the shoulder block, not its top.
  pixel(ctx, role.edge, 5, 5, 6, 5);
  pixel(ctx, INK, 5, 6, 6, 4);
  pixel(ctx, role.coat, 6, 5, 4, 4);
  pixel(ctx, role.light, 6, 5, 3, 1);
  pixel(ctx, role.camo, 8, 7, 2, 1);
  pixel(ctx, role.dark, 7, 9, 2, 1);
  pixel(ctx, role.trim, 6, 4, 4, 1);
  if (family === 'lookout') {
    const y = gait.notice || gait.breath ? 3 : 4;
    pixel(ctx, INK, 4, y, 3, 2);
    pixel(ctx, INK, 9, y, 3, 2);
    pixel(ctx, '#a9c5bf', 4, y, 2, 1);
    pixel(ctx, '#a9c5bf', 10, y, 2, 1);
  } else if (family === 'patroller') {
    pixel(ctx, role.trim, 5, 4, 6, 1);
    pixel(ctx, INK, 12, 9, 1, 3);
  } else if (family === 'runner') {
    pixel(ctx, role.trim, 5, 10, 1, 2);
    pixel(ctx, role.trim, 10, 10, 1, 2);
  } else if (family === 'sprinter') {
    pixel(ctx, INK, 4, 6, 1, 3);
    pixel(ctx, INK, 11, 6, 1, 3);
    pixel(ctx, role.trim, 5, 5, 6, 1);
  } else if (family === 'courier') {
    const y = 8 - Math.abs(step);
    pixel(ctx, INK, 12, y, 3, 3);
    pixel(ctx, '#be9b65', 12, y, 3, 1);
    pixel(ctx, '#795e3f', 13, y + 1, 2, 2);
    pixel(ctx, '#d9c296', 13, y, 1, 3);
  } else if (family === 'guard') {
    pixel(ctx, role.dark, 3, 6, 2, 4);
    pixel(ctx, role.dark, 11, 6, 2, 4);
    pixel(ctx, '#99a58e', 3, 6, 2, 1);
    pixel(ctx, '#99a58e', 11, 6, 2, 1);
    if (options.armed === true) {
      pixel(ctx, INK, 12, 2, 1, 7);
      pixel(ctx, '#735c40', 12, 9, 2, 2);
    }
  } else if (family === 'refuge-seeker') {
    pixel(ctx, role.dark, 5, 5, 1, 5);
    pixel(ctx, role.dark, 10, 5, 1, 5);
    pixel(ctx, role.trim, 5, 10, 6, 3);
    pixel(ctx, role.coat, 7, 10, 1, 3);
  } else if (family === 'switchback') {
    pixel(ctx, role.patch, 5, 10, 7, 1);
    pixel(ctx, role.trim, 11, 11, 3, 1);
    pixel(ctx, role.patch, 13, 12, 1, 1);
  } else if (family === 'rendezvous-pair') {
    pixel(ctx, INK, 10, 7, 1, 4);
    pixel(ctx, '#dac295', 4, 7, 1, 1);
    pixel(ctx, '#9cbdbe', 11, 7, 1, 1);
    pixel(ctx, '#a8c9bb', 6, 10, 1, 1);
  } else if (family === 'shield-bearer') {
    pixel(ctx, INK, 2, 3, 12, 2);
    pixel(ctx, '#c8d0bd', 3, 3, 10, 1);
    pixel(ctx, '#384c46', 6, 4, 4, 1);
  } else if (family === 'brace-trooper') {
    pixel(ctx, role.light, closed ? 3 : 1, closed ? 4 : 7, 2, 3);
    pixel(ctx, role.trim, closed ? 11 : 13, closed ? 4 : 7, 2, 3);
    if (!closed) pixel(ctx, '#aec3a0', 7, 10, 2, 1);
  } else if (family === 'relay-warden') {
    pixel(ctx, INK, 4, 8, 1, 5);
    pixel(ctx, INK, 10, 7, 1, 5);
    pixel(ctx, role.trim, 3, 6, 2, 1);
    pixel(ctx, role.trim, 11, 6, 2, 1);
    pixel(ctx, '#a8c9bb', 6, 10, 1, 1);
  }
  ctx.restore();
}

function markers(ctx, family, options, angle) {
  if (family === 'shield-bearer') {
    ctx.save();
    ctx.translate(16, 16);
    ctx.rotate(angle);
    // Exact accepted forward edge, with exposed sides. No enclosing danger box.
    pixel(ctx, INK, -10, -14, 20, 2);
    pixel(ctx, '#e5b37d', -9, -14, 18, 1);
    ctx.restore();
    if (options.phase === 'turning' && Object.hasOwn(ANGLES, options.nextHeading)) {
      ctx.save();
      ctx.translate(16, 16);
      ctx.rotate(ANGLES[options.nextHeading]);
      pixel(ctx, INK, -2, -11, 4, 4);
      pixel(ctx, '#fff0cc', -1, -11, 2, 1);
      pixel(ctx, '#fff0cc', -2, -10, 1, 2);
      pixel(ctx, '#fff0cc', 1, -10, 1, 2);
      ctx.restore();
    }
  } else if (family === 'brace-trooper') {
    const closed = options.phase === 'warning' || options.phase === 'burst';
    ctx.save();
    ctx.translate(16, 16);
    ctx.rotate(angle);
    for (const x of [-14, 12]) {
      pixel(ctx, INK, x, -2, 2, 8);
      pixel(ctx, closed ? '#e0ac76' : '#9edda8', x, -1, 1, 6);
      if (closed) {
        pixel(ctx, '#fff0cc', x, -2, 2, 1);
        pixel(ctx, '#fff0cc', x, 5, 2, 1);
      }
    }
    ctx.restore();
  }
  if (options.frozen) {
    // A small snowflake, not the former square token/corner frame.
    pixel(ctx, INK, 26, 2, 3, 7);
    pixel(ctx, '#d6f6ff', 27, 2, 1, 7);
    pixel(ctx, '#d6f6ff', 24, 5, 7, 1);
    pixel(ctx, '#88bfce', 25, 3, 1, 1);
    pixel(ctx, '#88bfce', 29, 7, 1, 1);
  }
  if (options.phase === 'warning' || options.state === 'notice') {
    pixel(ctx, INK, 2, 2, 4, 8);
    pixel(ctx, '#f7d593', 3, 3, 2, 4);
    pixel(ctx, '#f7d593', 3, 8, 2, 1);
  }
  if (options.state === 'blocked') {
    pixel(ctx, INK, 2, 4, 5, 3);
    pixel(ctx, '#fff0cc', 3, 5, 3, 1);
  }
}

/** Transparent overhead art. Legacy token/palette options remain accepted but
 * can no longer introduce a square. facingRadians is clockwise from north.
 * Gait is sampled from caller-owned presentation time or locomotionPhase; a
 * frozen/Pulse actor keeps its authoritative armor state and a stable pose. */
export function drawHuntActor(ctx, x, y, size, pose = 0, options = {}) {
  if (!ctx || ![x, y, size].every(Number.isFinite) || size <= 0) return;
  const family = resolveActorFamily(options.family ?? options.kind ?? options.profile) ?? 'runner';
  const visual =
    actorVisual(options.visualId) ?? actorVisual(family, options.cast) ?? actorVisual(family);
  const angle = facing(options);
  const revision = options.artRevision ?? actorArtReviewRevision(),
    candidate = revision === 'industrial-pilot-v1',
    overhead = revision === OVERHEAD_ACTOR_ART_REVISION;
  const descriptor =
    options.animation ??
    (overhead
      ? OVERHEAD_ACTOR_SAMPLES[visual.family]
      : candidate
        ? INDUSTRIAL_ACTOR_SAMPLES[visual.family]
        : null);
  const artOptions = overhead
    ? {
        ...options,
        state: options.state === 'recovery' ? 'recover' : options.state,
        phase:
          options.state === 'anticipation' && options.phase == null ? 'warning' : options.phase,
      }
    : options;
  const gait = motion(pose, artOptions, visual.family);
  if (
    (overhead && ['aim', 'fire'].includes(options.state)) ||
    ['aim', 'fire'].includes(options.animationClip)
  )
    gait.stride = 0;
  if (descriptor) {
    const clip = Object.hasOwn(descriptor.clips, options.animationClip)
      ? options.animationClip
      : overhead && Object.hasOwn(descriptor.clips, options.state)
        ? options.state
        : gait.caught
          ? 'caught'
          : gait.recovery
            ? 'recovery'
            : options.phase === 'warning' || options.phase === 'turning'
              ? 'anticipation'
              : options.state === 'blocked'
                ? 'blocked'
                : gait.notice
                  ? 'notice'
                  : gait.idling
                    ? 'idle'
                    : 'move';
    // Locomotion phase is owned by the native host. Sampling its whole cycle
    // avoids aliasing a six-frame walk against an unrelated idle/breath clock.
    const moveDuration =
      overhead && clip === 'move' && Number.isFinite(options.locomotionPhase)
        ? descriptor.clips.move.frames.reduce(
            (sum, id) => sum + descriptor.frames.find((frame) => frame.id === id).durationMs,
            0,
          )
        : null;
    const sample = sampleActorAnimation(descriptor, {
      clip,
      timeMs:
        moveDuration === null
          ? (options.timeMs ?? pose * 100)
          : options.locomotionPhase * moveDuration,
      reducedEffects: options.reducedEffects || options.frozen || options.paused,
    });
    if (overhead || options.animationClip != null) {
      // Eligibility comes from the native state (or an explicit Studio Move
      // preview), never from a zero crossing of the legacy 130/85ms gait.
      const moving =
        clip === 'move' &&
        (gait.moving || options.animationClip === 'move') &&
        !options.reducedEffects &&
        !options.frozen &&
        !options.paused;
      gait.stride = moving ? sample.stride : 0;
    } else if (gait.stride !== 0) gait.stride = sample.stride;
    gait.breath = sample.breath;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / UNIT, size / UNIT);
  ctx.imageSmoothingEnabled = false;
  // Body and accessories share one transform; simulation position is untouched.
  ctx.save();
  ctx.translate(16, 16);
  ctx.rotate(angle);
  ctx.translate(-16, -16);
  if (options.shadow !== false) {
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha *= 0.18;
    if (overhead) {
      pixel(ctx, '#101b17', 8, 12, 16, 11);
      pixel(ctx, '#101b17', 6, 14, 20, 6);
    } else pixel(ctx, '#101b17', 6, 14, 20, 11);
    ctx.globalAlpha = alpha;
  }
  const useCompact = options.detail === 'compact' || (options.detail !== 'detailed' && size < 24);
  (overhead ? (useCompact ? overheadCompact : overheadDetailed) : useCompact ? compact : detailed)(
    ctx,
    visual.palette,
    visual.family,
    gait,
    { ...artOptions, industrialSample: candidate },
    visual.cast,
  );
  if (candidate && INDUSTRIAL_ACTOR_SAMPLES[visual.family]) {
    const p = visual.palette;
    // Family-sized equipment changes the silhouette, not the occupied cell.
    if (visual.family === 'runner') {
      pixel(ctx, p.dark, 11, 16, 10, 7);
      pixel(ctx, p.coat, 12, 16, 8, 6);
      pixel(ctx, p.trim, 12, 17, 2, 4);
      pixel(ctx, '#bdbda0', 19, 17, 1, 3);
      pixel(ctx, INK, 12, 23, 3, 2);
      pixel(ctx, INK, 18, 23, 3, 2);
    } else if (visual.family === 'courier') {
      const bounce = gait.stride ? Math.sign(gait.stride) : 0;
      pixel(ctx, INK, 23, 17 + bounce, 8, 10);
      pixel(ctx, '#795e3f', 24, 18 + bounce, 6, 8);
      pixel(ctx, '#be9b65', 24, 18 + bounce, 6, 2);
      pixel(ctx, '#d9c296', 26, 20 + bounce, 2, 4);
      pixel(ctx, '#402f24', 24, 25 + bounce, 6, 1);
      pixel(ctx, p.trim, 11, 15, 2, 9);
    } else if (visual.family === 'guard') {
      pixel(ctx, INK, 7, 14, 18, 5);
      pixel(ctx, '#667366', 8, 14, 16, 4);
      pixel(ctx, '#9fa68b', 8, 14, 15, 1);
      pixel(ctx, p.dark, 10, 19, 12, 5);
      for (const x of [10, 15, 20]) {
        pixel(ctx, '#283b33', x, 19, 3, 5);
        pixel(ctx, '#87957c', x, 19, 3, 1);
      }
    } else {
      pixel(ctx, INK, 5, 2, 22, 8);
      pixel(ctx, '#465953', 6, 2, 20, 7);
      pixel(ctx, '#afb8a0', 6, 2, 20, 1);
      pixel(ctx, '#85958a', 6, 3, 2, 5);
      pixel(ctx, '#263a37', 23, 3, 3, 6);
      pixel(ctx, '#152723', 10, 4, 12, 2);
      pixel(ctx, '#c2d6c8', 11, 4, 10, 1);
      pixel(ctx, '#a59762', 15, 7, 2, 2);
    }
  }
  ctx.restore();
  markers(ctx, visual.family, options, angle);
  ctx.restore();
}
