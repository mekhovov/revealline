import { actorVisual, resolveActorFamily } from './actor-catalog.mjs';
/** Original overhead pixel rigs. The host owns time, facing and vulnerability;
 * this renderer never advances AI, reads a clock or consumes randomness. */
const UNIT = 32;
const ANGLES = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
const STRIDE = [0, 1, 2, 0, -1, -2];
const BREATH = [0, 0, 1, 0];
const INK = '#192820';
const BOOT = '#26302c';

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
  else if (family === 'patroller' || cast === 'tactical') pack(ctx, role, 12, 18, 8, 7);
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
  const gait = motion(pose, options, visual.family);
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
    pixel(ctx, '#101b17', 6, 14, 20, 11);
    ctx.globalAlpha = alpha;
  }
  const useCompact = options.detail === 'compact' || (options.detail !== 'detailed' && size < 24);
  (useCompact ? compact : detailed)(ctx, visual.palette, visual.family, gait, options, visual.cast);
  ctx.restore();
  markers(ctx, visual.family, options, angle);
  ctx.restore();
}
