import { CELL, FIXED_DT } from '../core/registry.mjs';

const SIZE = 16;
const KINDS = ['extra-life', 'player-speed', 'enemy-slow', 'enemy-freeze'];
const LABELS = {
  'extra-life': 'Life',
  'player-speed': 'Speed',
  'enemy-slow': 'Enemies slow',
  'enemy-freeze': 'Enemies frozen',
};
const TYPES = [
  'bouncer',
  'border-patrol',
  'lane-boss',
  'relay-sentinel',
  'contour-patrol',
  'claimed-rover',
  'eroder',
];
const own = (value, key) => {
  if (!value || typeof value !== 'object') throw new TypeError('Expected presentation data');
  const field = Object.getOwnPropertyDescriptor(value, key);
  if (!field) return undefined;
  if (!Object.hasOwn(field, 'value'))
    throw new TypeError('Presentation data cannot contain getters');
  return field.value;
};
const check = (condition) => {
  if (!condition) throw new TypeError('Invalid classic presentation');
};
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const typedLength = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  'length',
).get;
const dense = (value, max) => {
  check(Array.isArray(value) && value.length <= max);
  return Array.from({ length: value.length }, (_, i) => {
    const item = own(value, String(i));
    check(item !== undefined);
    return item;
  });
};
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const position = (value) => {
  const x = own(value, 'x'),
    y = own(value, 'y');
  check(Number.isFinite(x) && x >= 0 && x <= 72 && Number.isFinite(y) && y >= 0 && y <= 36);
  return { x, y };
};
const identity = (value) => {
  const id = own(value, 'id');
  check(typeof id === 'string' && id.length > 0 && id.length <= 80);
  return id;
};

/** A bounded owned projection. Missing/malformed guidance never changes gameplay. */
export function classicView(run) {
  try {
    if (own(run, 'ruleset') !== 'xonix-core.v5') return null;
    check(own(run, 'width') === 72 && own(run, 'height') === 36);
    const tick = own(run, 'tick'),
      time = own(run, 'time'),
      status = own(run, 'status');
    check(integer(tick) && Number.isFinite(time) && time >= 0);
    check(['running', 'respawning', 'won', 'lost'].includes(status));
    const state = own(run, 'classic'),
      actorTick = own(state, 'actorTick'),
      actorTime = own(state, 'actorTime');
    check(
      own(state, 'version') === 'classic-state.v1' &&
        integer(actorTick) &&
        Number.isFinite(actorTime) &&
        actorTime >= 0,
    );
    const cells = own(run, 'cells'),
      mask = own(state, 'terrain');
    check(
      Object.getPrototypeOf(cells) === Uint8Array.prototype &&
        Object.getPrototypeOf(mask) === Uint8Array.prototype,
    );
    check(typedLength.call(cells) === 2592 && typedLength.call(mask) === 2592);
    const terrain = [];
    for (let i = 0; i < 2592; i++) {
      check(cells[i] <= 2 && mask[i] <= 2);
      if (cells[i] === CELL.FIELD && mask[i])
        terrain.push({ x: i % 72, y: Math.floor(i / 72), kind: mask[i] === 1 ? 'slow' : 'lethal' });
    }
    const effects = [];
    for (const kind of KINDS.slice(1)) {
      const effect = own(own(state, 'effects'), kind),
        from = own(effect, 'from'),
        until = own(effect, 'until');
      check(integer(from) && integer(until) && until >= from);
      if (until <= tick || status === 'won' || status === 'lost') continue;
      effects.push({
        kind,
        label: LABELS[kind],
        phase: tick < from ? 'pending' : 'active',
        ticks: until - Math.max(tick, from),
        seconds: (until - Math.max(tick, from)) * FIXED_DT,
      });
    }
    const active = (kind) =>
      effects.some((effect) => effect.kind === kind && effect.phase === 'active');
    const powerups = [];
    for (const item of dense(own(state, 'powerups'), 64)) {
      const kind = own(item, 'kind'),
        collectedTick = own(item, 'collectedTick');
      check(
        KINDS.includes(kind) &&
          (collectedTick === null || (integer(collectedTick) && collectedTick <= tick)),
      );
      const id = identity(item),
        point = position(item);
      check(
        Number.isInteger(point.x - 0.5) &&
          point.x >= 0.5 &&
          point.x <= 71.5 &&
          Number.isInteger(point.y - 0.5) &&
          point.y >= 0.5 &&
          point.y <= 35.5,
      );
      if (collectedTick === null) powerups.push({ id, kind, label: LABELS[kind], ...point });
    }
    const erosion = [];
    const enemies = dense(own(run, 'enemies'), 24).map((enemy) => {
      const id = identity(enemy),
        type = own(enemy, 'type'),
        point = position(enemy);
      check(TYPES.includes(type));
      const radius = own(enemy, 'radius');
      check(Number.isFinite(radius) && radius >= 0.05 && radius <= 0.45);
      const detail = own(enemy, 'classic');
      let mode = null,
        seconds = null;
      if (type === 'claimed-rover' || type === 'contour-patrol') {
        mode = own(detail, 'mode');
        check(
          (type === 'claimed-rover'
            ? ['dormant', 'warning', 'active']
            : ['patrolling', 'rejoining', 'idle']
          ).includes(mode),
        );
        if (mode === 'warning') {
          const at = own(detail, 'activationTick');
          check(integer(at));
          seconds = Math.max(0, at - actorTick) * FIXED_DT;
        }
      }
      if (type === 'eroder') {
        const target = own(detail, 'target');
        check(target === null || (integer(target) && target < 2592));
        if (target !== null) {
          const at = own(detail, 'erosionAt');
          check(integer(at));
          mode = 'warning';
          seconds = Math.max(0, at - actorTick) * FIXED_DT;
          if (cells[target] === CELL.SAFE)
            erosion.push({ id, x: target % 72, y: Math.floor(target / 72), seconds });
        }
      }
      const stunnedUntil = own(enemy, 'stunnedUntil') ?? 0,
        slowUntil = own(enemy, 'slowUntil') ?? 0;
      check(Number.isFinite(stunnedUntil) && Number.isFinite(slowUntil));
      return {
        id,
        type,
        ...point,
        radius,
        mode,
        seconds,
        frozen: active('enemy-freeze'),
        stunned: stunnedUntil > time + 1e-8,
        slowed: !active('enemy-freeze') && (active('enemy-slow') || slowUntil > time + 1e-8),
      };
    });
    const roles = [
      ['bouncer', 'field enemy'],
      ['contour-patrol', 'contour patrol'],
      ['claimed-rover', 'claimed rover'],
      ['eroder', 'eroder'],
    ].flatMap(([type, label]) => {
      const count = enemies.filter((enemy) => enemy.type === type).length;
      return count ? [`${count} ${label}${count === 1 ? '' : 's'}`] : [];
    });
    return freeze({
      actorTick,
      actorTime,
      terrain,
      powerups,
      effects,
      enemies,
      erosion,
      summary: [
        ...roles,
        ...(terrain.some((cell) => cell.kind === 'slow') ? ['Slow ground active'] : []),
        ...(terrain.some((cell) => cell.kind === 'lethal') ? ['Lethal ground active'] : []),
        ...(powerups.length
          ? [`${powerups.length} contact pickup${powerups.length === 1 ? '' : 's'}`]
          : []),
        ...enemies
          .filter((enemy) => enemy.mode === 'warning')
          .map(
            (enemy) =>
              `${enemy.type === 'eroder' ? 'Ground reopens' : 'Rover wakes'} in ${enemy.seconds.toFixed(1)}s`,
          ),
        ...effects.map(
          (effect) =>
            `${effect.label}: ${effect.phase === 'pending' ? 'next tick' : `${effect.seconds.toFixed(1)}s`}`,
        ),
      ].join(' · '),
    });
  } catch {
    return null;
  }
}

const lines = (ctx, points) => {
  ctx.beginPath();
  for (const [a, b] of points) {
    ctx.moveTo(...a);
    ctx.lineTo(...b);
  }
  ctx.stroke();
};
const polygon = (ctx, points) => {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
};
function icon(ctx, kind) {
  if (kind === 'extra-life')
    polygon(ctx, [
      [0, 6],
      [-6, 0],
      [-6, -4],
      [-3, -6],
      [0, -3],
      [3, -6],
      [6, -4],
      [6, 0],
    ]);
  else if (kind === 'player-speed')
    lines(ctx, [
      [
        [-6, -5],
        [-1, 0],
      ],
      [
        [-1, 0],
        [-6, 5],
      ],
      [
        [1, -5],
        [6, 0],
      ],
      [
        [6, 0],
        [1, 5],
      ],
    ]);
  else if (kind === 'enemy-slow')
    lines(ctx, [
      [
        [-5, -6],
        [5, -6],
      ],
      [
        [-5, 6],
        [5, 6],
      ],
      [
        [-4, -5],
        [4, 5],
      ],
      [
        [4, -5],
        [-4, 5],
      ],
    ]);
  else {
    lines(ctx, [
      [
        [-6, 0],
        [6, 0],
      ],
      [
        [0, -6],
        [0, 6],
      ],
      [
        [-4, -4],
        [4, 4],
      ],
      [
        [-4, 4],
        [4, -4],
      ],
    ]);
    ctx.strokeRect(-2, -2, 4, 4);
  }
}

/** Functional material is painted over the opaque art mask, only while FIELD. */
export function drawClassicTerrain(ctx, view, palette, images = {}) {
  if (!view) return;
  ctx.save();
  ctx.lineWidth = 1.5;
  for (const cell of view.terrain) {
    const x = cell.x * SIZE,
      y = cell.y * SIZE;
    const image = images[cell.kind === 'slow' ? 'slowTerrain' : 'lethalTerrain'];
    if (image) ctx.drawImage(image, x, y, SIZE, SIZE);
    ctx.strokeStyle = cell.kind === 'slow' ? palette.safe : palette.danger;
    if (cell.kind === 'slow')
      lines(ctx, [
        [
          [x + 2, y + 5],
          [x + 7, y + 5],
        ],
        [
          [x + 9, y + 10],
          [x + 14, y + 10],
        ],
      ]);
    else {
      ctx.strokeRect(x + 1.5, y + 1.5, 13, 13);
      lines(ctx, [
        [
          [x + 5, y + 5],
          [x + 11, y + 11],
        ],
        [
          [x + 11, y + 5],
          [x + 5, y + 11],
        ],
      ]);
    }
  }
  ctx.restore();
}

export function drawClassicPickups(ctx, view, palette, images = {}) {
  if (!view) return;
  for (const item of view.powerups) {
    ctx.save();
    ctx.translate(item.x * SIZE, item.y * SIZE);
    ctx.fillStyle = palette.ink;
    ctx.strokeStyle = palette.paper;
    ctx.lineWidth = 1;
    ctx.fillRect(-8, -8, 16, 16);
    ctx.strokeRect(-8, -8, 16, 16);
    const role = {
      'extra-life': 'lifePickup',
      'player-speed': 'speedPickup',
      'enemy-slow': 'slowPickup',
      'enemy-freeze': 'freezePickup',
    }[item.kind];
    if (images[role]) {
      ctx.drawImage(images[role], -8, -8, 16, 16);
      // Retain a small type badge even when artwork replaces the main symbol.
      ctx.translate(6, 6);
      ctx.scale(0.6, 0.6);
      ctx.fillRect(-8, -8, 16, 16);
    }
    ctx.strokeStyle = palette.accent;
    ctx.fillStyle = palette.accent;
    ctx.lineWidth = 1.5;
    icon(ctx, item.kind);
    ctx.restore();
  }
  ctx.save();
  ctx.strokeStyle = palette.danger;
  ctx.lineWidth = 2;
  for (const cell of view.erosion) {
    const x = cell.x * SIZE,
      y = cell.y * SIZE;
    ctx.strokeRect(x + 1, y + 1, 14, 14);
    lines(ctx, [
      [
        [x + 4, y + 4],
        [x + 12, y + 12],
      ],
      [
        [x + 12, y + 4],
        [x + 4, y + 12],
      ],
    ]);
  }
  ctx.restore();
}

/** The new role silhouette remains stable across themes and reduced effects. */
export function drawClassicEnemy(ctx, enemy, palette, images = {}) {
  if (!enemy || !['contour-patrol', 'claimed-rover', 'eroder'].includes(enemy.type)) return false;
  ctx.save();
  ctx.translate(enemy.x * SIZE, enemy.y * SIZE);
  ctx.fillStyle =
    enemy.stunned || enemy.mode === 'dormant' || enemy.mode === 'idle'
      ? palette.muted
      : palette.danger;
  ctx.strokeStyle = palette.paper;
  ctx.lineWidth = 1.5;
  const image =
    images[{ 'contour-patrol': 'contour', 'claimed-rover': 'rover', eroder: 'eroder' }[enemy.type]];
  if (image) {
    ctx.save();
    if (enemy.stunned || enemy.mode === 'dormant' || enemy.mode === 'idle') ctx.globalAlpha = 0.45;
    ctx.drawImage(image, -11, -11, 22, 22);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * SIZE, 0, Math.PI * 2);
    ctx.stroke();
  } else if (enemy.type === 'contour-patrol') {
    polygon(ctx, [
      [0, -10],
      [9, 0],
      [0, 10],
      [-9, 0],
    ]);
    ctx.strokeStyle = palette.ink;
    lines(ctx, [
      [
        [-4, -3],
        [0, 2],
      ],
      [
        [0, 2],
        [4, -3],
      ],
    ]);
  } else if (enemy.type === 'claimed-rover') {
    ctx.fillRect(-7, -6, 14, 12);
    ctx.strokeRect(-7, -6, 14, 12);
    for (const x of [-10, 7]) {
      ctx.fillRect(x, -9, 3, 6);
      ctx.fillRect(x, 3, 3, 6);
    }
    ctx.fillStyle = palette.ink;
    ctx.fillRect(-3, -2, 6, 4);
    if (enemy.mode === 'dormant') {
      ctx.strokeStyle = palette.paper;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(-12, -11, 24, 22);
    }
  } else {
    polygon(ctx, [
      [-10, -7],
      [-3, -7],
      [0, -11],
      [4, -7],
      [10, -7],
      [7, 0],
      [11, 4],
      [7, 8],
      [0, 7],
      [-5, 11],
      [-8, 5],
      [-7, 0],
    ]);
    ctx.fillStyle = palette.ink;
    ctx.fillRect(-3, -3, 6, 6);
  }
  if (image && enemy.mode === 'dormant') {
    ctx.setLineDash([2, 2]);
    ctx.strokeRect(-12, -11, 24, 22);
  }
  if (enemy.mode === 'warning' || enemy.mode === 'rejoining') {
    ctx.strokeStyle = palette.accent;
    ctx.setLineDash([3, 2]);
    ctx.strokeRect(-13, -13, 26, 26);
  }
  ctx.restore();
  return true;
}

export function drawClassicStatus(ctx, view, palette) {
  if (!view) return;
  for (const enemy of view.enemies) {
    if (!enemy.frozen && !enemy.slowed) continue;
    ctx.save();
    ctx.translate(enemy.x * SIZE, enemy.y * SIZE);
    ctx.strokeStyle = palette.safe;
    ctx.lineWidth = 2;
    if (enemy.frozen) {
      ctx.strokeRect(-14, -14, 28, 28);
      ctx.translate(0, -18);
      icon(ctx, 'enemy-freeze');
    } else
      lines(ctx, [
        [
          [-12, 11],
          [12, 11],
        ],
        [
          [-12, 15],
          [12, 15],
        ],
      ]);
    ctx.restore();
  }
  view.effects.forEach((effect, i) => {
    ctx.save();
    ctx.translate(22 + i * 174, 552);
    ctx.fillStyle = palette.ink;
    ctx.fillRect(-3, -12, 170, 24);
    ctx.strokeStyle = palette.paper;
    ctx.fillStyle = palette.paper;
    ctx.lineWidth = 1.5;
    icon(ctx, effect.kind);
    ctx.font = '12px monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(
      `${effect.label} ${effect.phase === 'pending' ? 'next tick' : `${effect.seconds.toFixed(1)}s`}`,
      12,
      0,
    );
    ctx.restore();
  });
}
