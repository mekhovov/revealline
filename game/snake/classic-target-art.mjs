/** Original pixel actors for Classic Snake. Presentation never advances target AI. */
const UNIT = 28;
const ROLES = Object.freeze({
  runner: { coat: '#e5a148', light: '#ffd483', dark: '#a96934', mark: '#986333' },
  patroller: { coat: '#67a6bb', light: '#b9e2e8', dark: '#356579', mark: '#356579' },
  sprinter: { coat: '#dd7554', light: '#ffb588', dark: '#934833', mark: '#a63d36' },
  courier: { coat: '#a581ba', light: '#ddbee8', dark: '#674979', mark: '#674979' },
});
const ANGLES = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
const INK = '#29313a';
const SKIN = '#e4ad7e';
const SKIN_LIGHT = '#ffd3a1';

function pixel(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function arm(ctx, x, offset, role) {
  pixel(ctx, INK, x, 10 + offset, 4, 8);
  pixel(ctx, role.coat, x + 1, 11 + offset, 3, 3);
  pixel(ctx, SKIN, x + 1, 14 + offset, 2, 3);
  pixel(ctx, SKIN_LIGHT, x + 1, 14 + offset, 1, 2);
}

function leg(ctx, x, lift, role, running) {
  pixel(ctx, INK, x, 18, 4, 7 - lift);
  pixel(ctx, '#45515e', x + 1, 19, 2, 4 - lift);
  pixel(ctx, '#819096', x + 1, 19, 1, 3 - lift);
  pixel(ctx, INK, x - 1, 24 - lift, 5, 2);
  pixel(ctx, running ? role.light : '#f6e7c4', x, 24 - lift, 3, 1);
}

function actor(ctx, role, profile, gait) {
  const leftLift = gait > 0 ? 1 : 0;
  const rightLift = gait < 0 ? 1 : 0;
  leg(ctx, 9, leftLift, role, profile === 'sprinter');
  leg(ctx, 16, rightLift, role, profile === 'sprinter');
  arm(ctx, 5, gait, role);
  arm(ctx, 20, -gait, role);

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

  if (profile === 'patroller') {
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
  }
}

function directionMarker(ctx, direction, color) {
  if (!(direction in ANGLES)) return;
  ctx.save();
  ctx.translate(24, 4);
  ctx.rotate(ANGLES[direction]);
  pixel(ctx, color, -1, -2, 2, 4);
  pixel(ctx, color, -2, -1, 4, 1);
  ctx.restore();
}

/**
 * Warm, readable humanoids with cosmetic role accessories. `pose` remains the
 * historical three-frame gait; optional `timeMs` is a caller-owned presentation
 * clock, so pause/seek can freeze it. Reduced effects and Pulse freeze the gait.
 */
export function drawClassicTarget(ctx, x, y, size, pose = 0, options = {}) {
  const profile = options.kind ?? options.profile ?? 'runner';
  const role = ROLES[profile] ?? ROLES.runner;
  const palette = options.palette ?? {};
  const still =
    options.reducedEffects ||
    options.frozen ||
    profile === 'still' ||
    options.phase === 'rest' ||
    options.phase === 'warning';
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
  pixel(ctx, palette.grid ?? '#74654b', 1, 1, 26, 26);
  pixel(ctx, '#bc9f68', 2, 1, 24, 26);
  pixel(ctx, '#fff0c3', 3, 2, 22, 24);
  pixel(ctx, '#fff7dd', 3, 2, 22, 2);
  pixel(ctx, '#e5cf9a', 3, 24, 22, 2);
  pixel(ctx, '#d4be90', 7, 25, 15, 1);
  actor(ctx, role, profile, gait);
  directionMarker(ctx, options.direction, role.mark);

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
  if (options.phase === 'warning') {
    pixel(ctx, '#933e32', 3, 3, 4, 8);
    pixel(ctx, '#fff7dd', 4, 4, 2, 4);
    pixel(ctx, '#fff7dd', 4, 9, 2, 1);
  }
  ctx.restore();
}
