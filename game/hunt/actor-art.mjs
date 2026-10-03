import { actorVisual, resolveActorFamily } from './actor-catalog.mjs';
/** Original shared pixel actors. Rendering never advances AI, reads a clock or
 * consumes randomness. The host owns timeMs, phase, facing and vulnerability. */
const UNIT = 28;
const ANGLES = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
const INK = '#29313a';
const SKIN = '#e4ad7e';
const SKIN_LIGHT = '#ffd3a1';

function pixel(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function arm(ctx, x, offset, role, cast) {
  pixel(ctx, INK, x, 10 + offset, 4, 8);
  pixel(ctx, role.coat, x + 1, 11 + offset, 3, 3);
  pixel(ctx, SKIN, x + 1, 14 + offset, 2, 3);
  pixel(ctx, SKIN_LIGHT, x + 1, 14 + offset, 1, 2);
  if (cast === 'arcade') {
    pixel(ctx, INK, x, 15 + offset, 4, 3);
    pixel(ctx, role.trim, x + 1, 15 + offset, 3, 2);
  }
}

function leg(ctx, x, lift, role, running) {
  pixel(ctx, INK, x, 18, 4, 7 - lift);
  pixel(ctx, role.pants, x + 1, 19, 2, 4 - lift);
  pixel(ctx, '#819096', x + 1, 19, 1, 3 - lift);
  pixel(ctx, INK, x - 1, 24 - lift, 5, 2);
  pixel(ctx, running ? role.light : '#f6e7c4', x, 24 - lift, 3, 1);
}

function actor(ctx, role, profile, gait, options, cast) {
  const leftLift = gait > 0 ? 1 : 0;
  const rightLift = gait < 0 ? 1 : 0;
  leg(ctx, 9, leftLift, role, profile === 'sprinter');
  leg(ctx, 16, rightLift, role, profile === 'sprinter');
  arm(ctx, 5, gait, role, cast);
  arm(ctx, 20, -gait, role, cast);

  // Broad jacket, bare forearms and separated trouser legs read as a person
  // even when the board is reduced to a phone-sized grid.
  pixel(ctx, INK, 8, 10, 13, 10);
  pixel(ctx, role.dark, 9, 11, 11, 8);
  pixel(ctx, role.coat, 9, 11, 10, 7);
  pixel(ctx, role.light, 9, 11, 2, 6);
  pixel(ctx, '#fff0cc', 13, 11, 3, 7);
  pixel(ctx, role.dark, 14, 12, 1, 6);
  pixel(ctx, role.light, 17, 14, 2, 2);
  pixel(ctx, INK, 9, 19, 11, 1);
  pixel(ctx, '#bca47f', 13, 19, 3, 1);

  // A large uncovered face replaces the former helmet/weapon silhouette.
  pixel(ctx, INK, 10, 2, 9, 9);
  pixel(ctx, SKIN, 9, 6, 11, 3);
  pixel(ctx, SKIN_LIGHT, 11, 4, 7, 6);
  pixel(ctx, SKIN, 17, 5, 1, 5);
  pixel(ctx, '#594334', 11, 3, 7, 2);
  pixel(ctx, '#342e2a', 11, 3, 2, 3);
  pixel(ctx, '#87654a', 14, 3, 3, 1);
  pixel(ctx, INK, 12, 6, 1, 1);
  pixel(ctx, INK, 16, 6, 1, 1);
  pixel(ctx, '#c58c64', 14, 7, 1, 2);
  pixel(ctx, '#8c5543', 13, 9, 3, 1);
  pixel(ctx, SKIN, 13, 10, 3, 2);

  if (cast === 'tactical') {
    // A small field pack and webbing leave the family accessory and face clear.
    pixel(ctx, INK, 3, 9, 3, 9);
    pixel(ctx, '#77846a', 4, 10, 2, 7);
    pixel(ctx, role.trim, 10, 12, 8, 2);
    pixel(ctx, role.dark, 12, 11, 2, 7);
    pixel(ctx, '#dcc79f', 15, 15, 3, 2);
  } else if (cast === 'arcade') {
    pixel(ctx, INK, 8, 23 - leftLift, 5, 3);
    pixel(ctx, role.light, 8, 23 - leftLift, 4, 2);
    pixel(ctx, INK, 16, 23 - rightLift, 5, 3);
    pixel(ctx, role.light, 17, 23 - rightLift, 4, 2);
    pixel(ctx, role.trim, 9, 11, 3, 2);
    pixel(ctx, role.trim, 17, 11, 3, 2);
  }

  if (profile === 'lookout') {
    const looking = options.state === 'notice' || options.phase === 'warning';
    pixel(ctx, '#886c42', 10, 2, 10, 2);
    pixel(ctx, role.light, 8, 4, 13, 1);
    pixel(ctx, '#654c34', 12, 11, 1, 3);
    pixel(ctx, '#654c34', 17, 11, 1, 3);
    pixel(ctx, INK, 10, looking ? 6 : 14, 4, 3);
    pixel(ctx, INK, 15, looking ? 6 : 14, 4, 3);
    pixel(ctx, '#b9e2e8', 11, looking ? 6 : 14, 2, 1);
    pixel(ctx, '#b9e2e8', 16, looking ? 6 : 14, 2, 1);
  } else if (profile === 'patroller') {
    // A soft cap and reflective jacket distinguish the predictable walker.
    pixel(ctx, INK, 10, 2, 9, 2);
    pixel(ctx, role.coat, 11, 2, 7, 1);
    pixel(ctx, role.dark, 9, 4, 10, 1);
    pixel(ctx, role.light, 10, 16, 9, 1);
  } else if (profile === 'sprinter') {
    // A headband, two short ribbons and light shoes read without color alone.
    pixel(ctx, role.light, 11, 5, 7, 1);
    pixel(ctx, role.coat, 19, 5, 3, 1);
    pixel(ctx, role.dark, 21, 6, 2, 1);
    pixel(ctx, '#fff0cc', 18, 11, 1, 5);
  } else if (profile === 'courier') {
    // The delivery satchel stays beside the body rather than hiding the face.
    pixel(ctx, '#624a37', 11, 11, 2, 3);
    pixel(ctx, '#624a37', 13, 13, 2, 2);
    pixel(ctx, '#624a37', 15, 15, 3, 2);
    pixel(ctx, INK, 19, 15, 6, 6);
    pixel(ctx, '#c99455', 20, 16, 4, 4);
    pixel(ctx, '#ffe2a2', 20, 16, 4, 1);
    pixel(ctx, '#624a37', 21, 17, 2, 1);
    if (options.state === 'idle' || options.phase === 'rest') {
      pixel(ctx, SKIN_LIGHT, 19, 14, 3, 2);
      pixel(ctx, '#fff0cc', 21, 12, 3, 2);
    }
  } else if (profile === 'guard') {
    pixel(ctx, INK, 9, 1, 11, 5);
    pixel(ctx, '#627562', 10, 2, 9, 3);
    pixel(ctx, role.light, 11, 2, 5, 1);
    pixel(ctx, '#d4c6a3', 9, 5, 11, 1);
    pixel(ctx, role.dark, 10, 12, 9, 6);
    pixel(ctx, '#ced6c0', 11, 13, 3, 3);
    pixel(ctx, '#ced6c0', 15, 13, 3, 3);
    pixel(ctx, INK, 21, 12, 5, 3);
    pixel(ctx, '#8e9d9e', 22, 12, 4, 1);
  } else if (profile === 'refuge-seeker') {
    pixel(ctx, role.dark, 9, 2, 2, 8);
    pixel(ctx, role.dark, 18, 2, 2, 8);
    pixel(ctx, role.dark, 10, 1, 9, 2);
    pixel(ctx, role.light, 11, 1, 6, 1);
    pixel(ctx, '#ded0a0', 12, 11, 1, 4);
    pixel(ctx, '#ded0a0', 17, 11, 1, 4);
    if (options.goal && options.state === 'notice') {
      pixel(ctx, role.coat, 20, 10, 4, 3);
      pixel(ctx, SKIN_LIGHT, 23, 10, 3, 2);
    }
  } else if (profile === 'switchback') {
    pixel(ctx, role.light, 9, 10, 11, 2);
    pixel(ctx, role.coat, 20, 11 + Math.abs(gait), 5, 2);
    pixel(ctx, role.dark, 23, 13 + Math.abs(gait), 3, 2);
    pixel(ctx, '#fff0cc', 13, 14, 3, 1);
    pixel(ctx, '#fff0cc', 12, 13, 1, 1);
    pixel(ctx, '#fff0cc', 16, 13, 1, 1);
  } else if (profile === 'rendezvous-pair') {
    const partner = options.partnerId ?? '';
    const alternate =
      typeof partner === 'string' && partner.charCodeAt(partner.length - 1) % 2 === 1;
    pixel(ctx, role.dark, 10, 2, 9, 2);
    pixel(ctx, alternate ? '#f7ca7e' : role.light, 11, 2, 7, 1);
    pixel(ctx, '#fff0cc', 11, 13, 3, 3);
    pixel(ctx, '#fff0cc', 15, 13, 3, 3);
    pixel(ctx, role.dark, 12, 14, 1, 1);
    pixel(ctx, role.dark, 16, 14, 1, 1);
    if (options.state === 'notice') {
      pixel(ctx, role.coat, 21, 7, 3, 5);
      pixel(ctx, SKIN_LIGHT, 21, 5, 3, 3);
    }
  } else if (profile === 'shield-bearer') {
    pixel(ctx, INK, 10, 1, 9, 4);
    pixel(ctx, '#8eabba', 11, 2, 7, 2);
    pixel(ctx, role.light, 10, 12, 9, 2);
    pixel(ctx, role.dark, 13, 14, 3, 4);
  } else if (profile === 'brace-trooper') {
    const closed = options.phase === 'warning' || options.phase === 'burst';
    pixel(ctx, INK, 8, 10, 14, 10);
    pixel(ctx, role.light, 9, 10, closed ? 6 : 3, 9);
    pixel(ctx, role.coat, closed ? 15 : 19, 10, closed ? 6 : 3, 9);
    pixel(ctx, role.dark, 10, 14, closed ? 10 : 1, 2);
    if (closed) {
      pixel(ctx, '#fff0cc', 12, 12, 1, 4);
      pixel(ctx, '#fff0cc', 17, 12, 1, 4);
    } else {
      pixel(ctx, '#fff0cc', 13, 13, 5, 4);
      pixel(ctx, role.coat, 14, 14, 3, 2);
    }
  } else if (profile === 'relay-warden') {
    pixel(ctx, INK, 8, 1, 13, 4);
    pixel(ctx, '#e4c26b', 9, 2, 11, 2);
    pixel(ctx, '#fff0cc', 9, 0, 2, 3);
    pixel(ctx, '#fff0cc', 14, 0, 2, 3);
    pixel(ctx, '#fff0cc', 19, 0, 2, 3);
    pixel(ctx, role.light, 6, 11, 4, 9);
    pixel(ctx, role.dark, 19, 11, 4, 9);
    pixel(ctx, '#e4c26b', 12, 13, 6, 2);
    pixel(ctx, '#e4c26b', 14, 12, 2, 6);
  }

  if (options.state === 'notice' || options.phase === 'warning') {
    pixel(ctx, INK, 12, 5, 2, 1);
    pixel(ctx, INK, 16, 5, 2, 1);
    pixel(ctx, '#8c5543', 14, 8, 2, 2);
  } else if (options.phase === 'rest' || options.state === 'recover') {
    pixel(ctx, SKIN_LIGHT, 12, 6, 6, 1);
    pixel(ctx, INK, 12, 7, 2, 1);
    pixel(ctx, INK, 16, 7, 2, 1);
    pixel(ctx, '#8c5543', 14, 9, 2, 1);
  } else if (options.state === 'caught') {
    pixel(ctx, '#fff0cc', 11, 6, 3, 2);
    pixel(ctx, '#fff0cc', 16, 6, 3, 2);
    pixel(ctx, INK, 12, 6, 1, 2);
    pixel(ctx, INK, 17, 6, 1, 2);
    pixel(ctx, '#8c5543', 14, 9, 2, 2);
  }
}

function directionMarker(ctx, direction, color) {
  if (!Object.hasOwn(ANGLES, direction)) return;
  ctx.save();
  ctx.translate(24, 4);
  ctx.rotate(ANGLES[direction]);
  pixel(ctx, color, -1, -2, 2, 4);
  pixel(ctx, color, -2, -1, 4, 1);
  ctx.restore();
}

function compactActor(ctx, role, profile, gait, options, cast) {
  // Author on a real 16-pixel grid rather than downsampling the detailed face.
  ctx.save();
  ctx.scale(UNIT / 16, UNIT / 16);
  const left = gait > 0 ? 1 : 0,
    right = gait < 0 ? 1 : 0;
  pixel(ctx, INK, 5, 10, 2, 5 - left);
  pixel(ctx, INK, 9, 10, 2, 5 - right);
  pixel(ctx, role.pants, 5, 11, 1, 3 - left);
  pixel(ctx, role.pants, 9, 11, 1, 3 - right);
  pixel(ctx, role.light, 4, 14 - left, 3, 1);
  pixel(ctx, role.light, 9, 14 - right, 3, 1);
  pixel(ctx, INK, 4, 6, 8, 6);
  pixel(ctx, role.coat, 5, 7, 6, 4);
  pixel(ctx, role.light, 5, 7, 1, 3);
  pixel(ctx, '#fff0cc', 7, 7, 2, 3);
  pixel(ctx, INK, 2, 7 + gait, 3, 5);
  pixel(ctx, INK, 11, 7 - gait, 3, 5);
  pixel(ctx, role.coat, 3, 7 + gait, 2, 2);
  pixel(ctx, role.coat, 11, 7 - gait, 2, 2);
  pixel(ctx, cast === 'arcade' ? role.trim : SKIN_LIGHT, 3, 9 + gait, 2, 2);
  pixel(ctx, cast === 'arcade' ? role.trim : SKIN_LIGHT, 11, 9 - gait, 2, 2);
  pixel(ctx, INK, 5, 1, 6, 6);
  pixel(ctx, SKIN_LIGHT, 6, 2, 4, 4);
  pixel(ctx, '#594334', 5, 1, 6, 2);
  pixel(ctx, INK, 6, 4, 1, 1);
  pixel(ctx, INK, 9, 4, 1, 1);
  if (cast === 'tactical') {
    pixel(ctx, '#6d7b60', 1, 7, 2, 4);
    pixel(ctx, role.trim, 5, 8, 6, 1);
  } else if (cast === 'arcade') {
    pixel(ctx, role.light, 3, 14 - left, 4, 1);
    pixel(ctx, role.light, 9, 14 - right, 4, 1);
  }
  if (profile === 'lookout') {
    pixel(ctx, role.light, 4, 2, 8, 1);
    pixel(ctx, INK, 6, 8, 2, 2);
    pixel(ctx, INK, 9, 8, 2, 2);
  } else if (profile === 'patroller') {
    pixel(ctx, role.coat, 5, 1, 6, 1);
    pixel(ctx, role.dark, 4, 3, 7, 1);
    pixel(ctx, role.light, 5, 10, 6, 1);
  } else if (profile === 'sprinter') {
    pixel(ctx, role.light, 5, 3, 6, 1);
    pixel(ctx, role.coat, 11, 3, 3, 1);
  } else if (profile === 'courier') {
    pixel(ctx, INK, 11, 9, 4, 5);
    pixel(ctx, '#c99455', 12, 10, 2, 3);
    pixel(ctx, '#ffe2a2', 12, 10, 2, 1);
  } else if (profile === 'guard') {
    pixel(ctx, '#627562', 5, 1, 6, 3);
    pixel(ctx, '#d4c6a3', 4, 3, 8, 1);
    pixel(ctx, '#ced6c0', 6, 7, 4, 3);
    pixel(ctx, INK, 12, 8, 3, 2);
  } else if (profile === 'refuge-seeker') {
    pixel(ctx, role.dark, 4, 1, 1, 6);
    pixel(ctx, role.dark, 11, 1, 1, 6);
    pixel(ctx, role.dark, 5, 0, 6, 1);
  } else if (profile === 'switchback') {
    pixel(ctx, role.light, 4, 6, 8, 1);
    pixel(ctx, role.coat, 12, 7, 3, 2);
  } else if (profile === 'rendezvous-pair') {
    pixel(ctx, role.light, 5, 1, 6, 1);
    pixel(ctx, '#fff0cc', 6, 8, 2, 2);
    pixel(ctx, '#fff0cc', 9, 8, 2, 2);
  } else if (profile === 'shield-bearer') {
    pixel(ctx, '#8eabba', 5, 1, 6, 2);
    pixel(ctx, role.light, 5, 7, 6, 2);
  } else if (profile === 'brace-trooper') {
    const closed = options.phase === 'warning' || options.phase === 'burst';
    pixel(ctx, role.light, 4, 6, closed ? 4 : 2, 6);
    pixel(ctx, role.dark, closed ? 8 : 10, 6, closed ? 4 : 2, 6);
    if (!closed) pixel(ctx, '#fff0cc', 7, 8, 2, 2);
  } else if (profile === 'relay-warden') {
    pixel(ctx, '#e4c26b', 4, 2, 8, 1);
    pixel(ctx, '#e4c26b', 4, 0, 1, 3);
    pixel(ctx, '#e4c26b', 7, 0, 2, 3);
    pixel(ctx, '#e4c26b', 11, 0, 1, 3);
    pixel(ctx, '#e4c26b', 7, 7, 2, 4);
  }
  if (options.state === 'notice' || options.state === 'caught') pixel(ctx, '#8c5543', 7, 5, 2, 1);
  ctx.restore();
}

function specialistMarkers(ctx, profile, options) {
  if (profile === 'shield-bearer') {
    const facing = options.heading ?? options.direction ?? options.facing;
    if (!Object.hasOwn(ANGLES, facing)) return;
    ctx.save();
    ctx.translate(14, 14);
    ctx.rotate(ANGLES[facing]);
    // Only the forward edge is blocked. No closed box can imply safe flanks
    // are hazardous. The facing stays unchanged during a turning warning.
    pixel(ctx, INK, -8, -13, 16, 5);
    pixel(ctx, '#d59b62', -7, -12, 14, 3);
    pixel(ctx, '#fff0cc', -6, -12, 12, 1);
    pixel(ctx, '#7c402e', -1, -12, 2, 3);
    ctx.restore();
    if (options.phase === 'turning' && Object.hasOwn(ANGLES, options.nextHeading)) {
      ctx.save();
      ctx.translate(14, 14);
      ctx.rotate(ANGLES[options.nextHeading]);
      pixel(ctx, INK, -2, -8, 4, 5);
      pixel(ctx, '#fff0cc', -1, -8, 2, 1);
      pixel(ctx, '#fff0cc', -2, -7, 1, 3);
      pixel(ctx, '#fff0cc', 1, -7, 1, 3);
      ctx.restore();
    }
  } else if (profile === 'brace-trooper') {
    const closed = options.phase === 'warning' || options.phase === 'burst';
    for (const x of [1, 24]) {
      pixel(ctx, INK, x, 11, 3, 9);
      pixel(ctx, closed ? '#b06842' : '#4f8465', x + 1, 12, 1, 7);
      if (closed) {
        pixel(ctx, '#fff0cc', x, 11, 3, 1);
        pixel(ctx, '#fff0cc', x, 19, 3, 1);
      }
    }
  }
}

/**
 * Warm, readable humanoids with cosmetic role accessories. `pose` remains the
 * historical three-frame gait; optional `timeMs` is a caller-owned presentation
 * clock, so pause/seek can freeze it. Reduced effects and Pulse freeze the gait.
 */
export function drawHuntActor(ctx, x, y, size, pose = 0, options = {}) {
  if (!ctx || ![x, y, size].every(Number.isFinite) || size <= 0) return;
  const family = resolveActorFamily(options.family ?? options.kind ?? options.profile) ?? 'runner';
  const visual =
    actorVisual(options.visualId) ?? actorVisual(family, options.cast) ?? actorVisual(family);
  const profile = visual.family;
  const role = visual.palette;
  const palette = options.palette ?? {};
  const still =
    options.reducedEffects ||
    options.frozen ||
    profile === 'lookout' ||
    options.phase === 'rest' ||
    options.phase === 'warning' ||
    options.phase === 'turning' ||
    ['idle', 'notice', 'recover', 'blocked', 'caught'].includes(options.state);
  const phase = Number.isFinite(options.timeMs)
    ? Math.floor(options.timeMs / (profile === 'sprinter' ? 110 : 180))
    : Number.isFinite(pose)
      ? Math.trunc(pose)
      : 0;
  const gait = still ? 0 : [0, 1, -1][Math.abs(phase) % 3];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / UNIT, size / UNIT);
  ctx.imageSmoothingEnabled = false;

  // The cream token recalls the original orange humanoid and gives all themes
  // the same strong face/limb contrast. Only its outer edge follows the theme.
  if (options.token !== false) {
    pixel(ctx, palette.grid ?? '#74654b', 1, 1, 26, 26);
    pixel(ctx, '#bc9f68', 2, 1, 24, 26);
    pixel(ctx, '#fff0c3', 3, 2, 22, 24);
    pixel(ctx, '#fff7dd', 3, 2, 22, 2);
    pixel(ctx, '#e5cf9a', 3, 24, 22, 2);
    pixel(ctx, '#d4be90', 7, 25, 15, 1);
  } else {
    pixel(ctx, '#263733', 8, 25, 14, 1);
  }
  const compact = options.detail === 'compact' || (options.detail !== 'detailed' && size < 24);
  if (compact) compactActor(ctx, role, profile, gait, options, visual.cast);
  else actor(ctx, role, profile, gait, options, visual.cast);
  directionMarker(ctx, options.direction ?? options.heading, role.dark);

  if (options.frozen) {
    for (const [left, top, sx, sy] of [
      [1, 1, 1, 1],
      [26, 1, -1, 1],
      [1, 26, 1, -1],
      [26, 26, -1, -1],
    ]) {
      pixel(ctx, '#487e93', left + Math.min(0, sx * 4), top, 5, 2);
      pixel(ctx, '#487e93', left, top + Math.min(0, sy * 4), 2, 5);
      pixel(ctx, '#d6f6ff', left + Math.min(0, sx * 3), top, 4, 1);
      pixel(ctx, '#d6f6ff', left, top + Math.min(0, sy * 3), 1, 4);
    }
  }
  if (options.phase === 'warning' || options.state === 'notice') {
    pixel(ctx, '#933e32', 3, 3, 4, 8);
    pixel(ctx, '#fff7dd', 4, 4, 2, 4);
    pixel(ctx, '#fff7dd', 4, 9, 2, 1);
  }
  if (options.state === 'blocked') {
    pixel(ctx, INK, 2, 4, 5, 3);
    pixel(ctx, '#fff0cc', 3, 5, 3, 1);
  }
  specialistMarkers(ctx, profile, options);
  ctx.restore();
}
