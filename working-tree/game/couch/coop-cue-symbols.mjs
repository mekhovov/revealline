const MARKS = new Set([
  'hunter',
  'hunter-lock',
  'hunter-charge',
  'hunter-recovery',
  'drifter',
  'shielded',
  'exposed',
  'secured',
  'anchor-a',
  'anchor-b',
]);
const METHODS = [
  'save',
  'restore',
  'beginPath',
  'moveTo',
  'lineTo',
  'closePath',
  'arc',
  'fill',
  'stroke',
  'setLineDash',
];
const opaqueHex = (value) =>
  typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value);

/**
 * Draw an owner-anchored cue in local CSS pixels, centred at (0, 0).
 * The caller owns its world translation/scale; size never describes collision.
 *
 * mark: hunter / hunter-lock / hunter-charge / hunter-recovery / drifter /
 * shielded / exposed / secured / anchor-a / anchor-b.
 * size (8..64, default 14): primary symbol extent including its dark outline.
 * color/backing: opaque RGB hex colours; changing colour never changes geometry.
 * captured: adds a check to anchor-a/b, retaining its one/two-notch identity.
 * target: exact 0/1 adds a circle/diamond to lock/charge only. Other values omit it.
 *
 * Returns frozen conservative stroke bounds. Hunter bounds reserve the same
 * upper-right target-badge space in every phase, including an absent target.
 * Own paths are begun here; drawing attributes are restored even if drawing fails.
 * No fonts, text, clocks, motion preferences or gameplay objects are consulted.
 */
export function drawCoopCueSymbol(ctx, options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options))
    throw new TypeError('Cue symbol options must be a record.');
  const {
    mark,
    size = 14,
    color = '#f1f7ed',
    backing = '#07111c',
    target = null,
    captured = false,
  } = options;
  if (!MARKS.has(mark)) throw new TypeError('Unknown Team cue symbol.');
  if (!Number.isFinite(size) || size < 8 || size > 64)
    throw new TypeError('Cue symbol size must be between 8 and 64 CSS pixels.');
  if (!opaqueHex(color) || !opaqueHex(backing))
    throw new TypeError('Cue symbol colours must be opaque RGB hex values.');
  if (typeof captured !== 'boolean') throw new TypeError('Captured cue state must be boolean.');
  if (!ctx || METHODS.some((method) => typeof ctx[method] !== 'function'))
    throw new TypeError('Cue symbol needs a Canvas drawing context.');

  const half = size / 2,
    h = half - 1.5,
    hunter = mark.startsWith('hunter'),
    bounds = Object.freeze({
      left: -half,
      top: -half - (hunter ? 7.75 : 0),
      right: half + (hunter ? 7.75 : 0),
      bottom: half,
    });
  const path = (points, closed = false) => {
    ctx.beginPath();
    points.forEach(([x, y], index) => {
      if (index) ctx.lineTo(x * h, y * h);
      else ctx.moveTo(x * h, y * h);
    });
    if (closed) ctx.closePath();
  };
  const outline = (closed = false) => {
    if (closed) {
      ctx.fillStyle = backing;
      ctx.fill();
    }
    ctx.strokeStyle = backing;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };
  const check = () => {
    path([
      [-0.5, 0.1],
      [-0.15, 0.5],
      [0.55, -0.4],
    ]);
    outline();
  };

  ctx.save();
  try {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
    if (mark === 'hunter') {
      path(
        [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
        ],
        true,
      );
      outline(true);
    } else if (mark === 'hunter-lock') {
      ctx.beginPath();
      for (const [x, y] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        ctx.moveTo((x * h) / 3, y * h);
        ctx.lineTo(x * h, y * h);
        ctx.lineTo(x * h, (y * h) / 3);
      }
      outline();
    } else if (mark === 'hunter-charge') {
      ctx.beginPath();
      for (const x of [-0.5, 0.5]) {
        ctx.moveTo((x - 0.5) * h, -h);
        ctx.lineTo((x + 0.5) * h, 0);
        ctx.lineTo((x - 0.5) * h, h);
      }
      outline();
    } else if (mark === 'hunter-recovery') {
      path(
        [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ],
        true,
      );
      outline(true);
    } else if (mark === 'drifter') {
      path(
        [
          [0, -1],
          [1, 1],
          [-1, 1],
        ],
        true,
      );
      outline(true);
    } else if (mark === 'shielded') {
      path(
        [
          [-1, -1],
          [1, -1],
          [1, 1 / 3],
          [0, 1],
          [-1, 1 / 3],
        ],
        true,
      );
      outline(true);
    } else if (mark === 'exposed') {
      ctx.beginPath();
      for (const y of [-1, 1]) {
        ctx.moveTo(-h, (y * h) / 3);
        ctx.lineTo(-h, y * h);
        ctx.lineTo(h, y * h);
        ctx.lineTo(h, (y * h) / 3);
      }
      outline();
    } else if (mark === 'secured') {
      path(
        [
          [-0.5, -1],
          [0.5, -1],
          [1, 0],
          [0.5, 1],
          [-0.5, 1],
          [-1, 0],
        ],
        true,
      );
      outline(true);
      check();
    } else {
      const notches =
        mark === 'anchor-a'
          ? [[-0.25, 0.25]]
          : [
              [-0.6, -0.2],
              [0.2, 0.6],
            ];
      const points = [[-1, -1]];
      for (const [left, right] of notches)
        points.push([left, -1], [left, -0.55], [right, -0.55], [right, -1]);
      points.push([1, -1], [1, 1], [-1, 1]);
      path(points, true);
      outline(true);
      if (captured) check();
    }
    if ((mark === 'hunter-lock' || mark === 'hunter-charge') && (target === 0 || target === 1)) {
      const x = half + 3,
        y = -half - 3;
      ctx.beginPath();
      if (target === 0) ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      else {
        ctx.moveTo(x, y - 3.25);
        ctx.lineTo(x + 3.25, y);
        ctx.lineTo(x, y + 3.25);
        ctx.lineTo(x - 3.25, y);
        ctx.closePath();
      }
      outline(true);
    }
  } finally {
    ctx.restore();
  }
  return bounds;
}
