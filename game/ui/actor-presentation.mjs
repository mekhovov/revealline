// Cosmetic poses, pixel silhouettes and cut effects. No simulation objects are changed.
const TAU = Math.PI * 2;
const CELL = 16;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const finite = (n, fallback = 0) => (Number.isFinite(n) ? n : fallback);
const angleDelta = (a, b) => ((((a - b + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const family = (id, fallback) =>
  ['fpv', 'ukraine', 'retro', 'coupa'].includes(id)
    ? id
    : ({ fpv: 'fpv', atlas: 'ukraine', retro: 'retro', navi: 'coupa' }[fallback] ?? 'retro');
export const ACTOR_PRESENTATION_LIMITS = Object.freeze({
  actors: 64,
  tailPoints: 3,
  maximumLogicalSize: 48,
  maximumBossSize: 60,
  desktopMinimum: 18,
  phoneMinimum: 12,
  maximumCSSSize: 28,
});

export function actorRole(type) {
  return (
    {
      'contour-patrol': 'contour',
      'claimed-rover': 'rover',
      eroder: 'eroder',
      'border-patrol': 'patrol',
      'lane-boss': 'boss',
      'relay-sentinel': 'boss',
    }[type] ?? 'enemy'
  );
}
export function actorDiameter({
  role = 'enemy',
  style = 'hybrid',
  screenScale = 1,
  canvasCSSWidth = 1152,
  scale = 1,
} = {}) {
  const s = clamp(finite(screenScale, 1), 0.1, 4),
    boss = role === 'boss';
  const base = (style === 'microtile' ? 26 : style === 'props' ? 34 : 30) * (boss ? 1.3 : 1);
  const desired = base * clamp(finite(scale, 1), 0.75, 1.5);
  const minimum = canvasCSSWidth >= 480 ? 18 : 12;
  return clamp(clamp(desired, minimum / s, (boss ? 34 : 28) / s), 18, boss ? 60 : 48);
}

/** Retain only previous observed positions and cosmetic clocks, never entity references. */
export function createActorPresentation() {
  let prior = new Map();
  return {
    reset() {
      prior = new Map();
    },
    sample(
      enemies,
      {
        tick = 0,
        time = 0,
        dt = 0,
        paused = false,
        reduced = false,
        classic = null,
        themeId = 'fpv',
        themeFamily = null,
        style = 'hybrid',
        screenScale = 1,
        canvasCSSWidth = 1152,
        scale = 1,
      } = {},
    ) {
      const next = new Map(),
        frames = new Map(),
        details = new Map((classic?.enemies ?? []).map((e) => [e.id, e]));
      const elapsed = clamp(finite(dt), 0, 0.1);
      for (const actor of enemies.slice(0, ACTOR_PRESENTATION_LIMITS.actors)) {
        if (!Number.isFinite(actor.x) || !Number.isFinite(actor.y)) continue;
        const old = prior.get(actor.id),
          detail = details.get(actor.id),
          role = actorRole(actor.type);
        const stunned = Boolean(detail?.stunned) || (actor.stunnedUntil ?? 0) > time;
        const locked =
          paused ||
          Boolean(detail?.frozen) ||
          stunned ||
          ['dormant', 'idle'].includes(detail?.mode);
        let speed = old?.speed ?? Math.hypot(finite(actor.vx), finite(actor.vy));
        let heading =
          old?.heading ??
          (speed > 0 ? Math.atan2(finite(actor.vy), finite(actor.vx)) + Math.PI / 2 : 0);
        let target = old?.target ?? heading;
        if (!locked && old && old.tick !== tick) {
          const dx = actor.x - old.x,
            dy = actor.y - old.y,
            distance = Math.hypot(dx, dy);
          speed = distance / Math.max(1 / 120, time - old.time);
          if (distance > 0.00001) target = Math.atan2(dy, dx) + Math.PI / 2;
        }
        const delta = angleDelta(target, heading);
        if (!locked)
          heading = reduced ? target : heading + clamp(delta, -elapsed * 12, elapsed * 12);
        const phase =
          (old?.phase ?? 0) + (locked || reduced ? 0 : elapsed * (1 + Math.min(speed, 12) * 0.13));
        const travelPhase =
          (old?.travelPhase ?? 0) + (locked || reduced ? 0 : elapsed * Math.min(speed, 12) * 0.45);
        const tail = old?.tail ? [...old.tail] : [];
        if (
          !locked &&
          !reduced &&
          old &&
          old.tick !== tick &&
          Math.hypot(actor.x - old.x, actor.y - old.y) > 0.025
        )
          tail.unshift({ x: old.x, y: old.y });
        const keptTail =
          reduced || speed < 0.05
            ? []
            : tail.filter((p) => Math.hypot(p.x - actor.x, p.y - actor.y) < 1.15).slice(0, 3);
        const bank = reduced ? 0 : locked ? (old?.bank ?? 0) : clamp(delta * 0.12, -0.15, 0.15);
        const record = {
          x: actor.x,
          y: actor.y,
          tick,
          time,
          phase,
          travelPhase,
          heading,
          target,
          speed,
          tail: keptTail,
          bank,
        };
        next.set(actor.id, record);
        frames.set(
          actor.id,
          Object.freeze({
            id: actor.id,
            x: actor.x * CELL,
            y: actor.y * CELL,
            role,
            type: actor.type,
            themeId: family(themeId, themeFamily),
            style,
            heading,
            phase,
            travelPhase,
            speed: locked ? 0 : speed,
            bank,
            locked,
            reduced,
            stunned,
            dormant: ['dormant', 'idle'].includes(detail?.mode),
            diameter: actorDiameter({ role, style, screenScale, canvasCSSWidth, scale }),
            radius: clamp(finite(actor.radius, 0.25), 0.05, 0.75) * CELL,
            tail: Object.freeze(keptTail.map((p) => Object.freeze({ ...p }))),
          }),
        );
      }
      prior = next;
      return frames;
    },
  };
}

const rect = (c, color, x, y, w, h) => {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), w, h);
};
function rotor(c, x, y, phase, colors, compact) {
  rect(c, colors.dark, x - 4, y - 4, 8, 8);
  c.save();
  c.translate(x, y);
  c.rotate(phase % TAU);
  for (let i = 0; i < 3; i++) {
    c.rotate(TAU / 3);
    rect(c, colors.light, -1, -5, 2, compact ? 3 : 4);
    rect(c, colors.body, -1, -5, 1, 2);
  }
  c.restore();
  rect(c, colors.light, x - 1, y - 1, 2, 2);
}
function treads(c, colors, phase, compact) {
  for (const x of [-11, 7]) {
    rect(c, colors.dark, x, -9, 4, 19);
    rect(c, colors.body, x + 1, -8, 2, 17);
    if (!compact)
      for (let y = -7; y < 8; y += 5)
        rect(c, colors.light, x + 1, y + (Math.floor(phase * 9) % 3), 2, 1);
  }
}
function fpv(c, f, colors) {
  const compact = f.style === 'microtile',
    phase = f.phase;
  if (f.role === 'patrol' || f.role === 'contour') {
    for (const x of [-7, 7])
      for (const y of [-7, 7]) {
        rect(c, colors.body, Math.min(0, x), Math.min(0, y), Math.abs(x) + 1, 2);
        rotor(c, x, y, phase * 7 * (x * y > 0 ? 1 : -1), colors, compact);
      }
    rect(c, colors.dark, -4, -7, 8, 14);
    rect(c, colors.body, -3, -6, 6, 12);
    rect(c, colors.light, -2, -6, 4, 2);
    rect(c, colors.trim, -2, 3, 4, 2);
  } else if (f.role === 'boss') {
    treads(c, colors, f.travelPhase, compact);
    rect(c, colors.body, -7, -6, 14, 15);
    rect(c, colors.dark, -5, -4, 10, 5);
    c.save();
    c.rotate(f.reduced ? 0 : Math.sin(phase * 1.5) * 0.45);
    rect(c, colors.dark, -10, -12, 20, 5);
    rect(c, colors.light, -8, -11, 16, 2);
    rect(c, colors.body, -1, -10, 2, 10);
    c.restore();
  } else {
    treads(c, colors, f.travelPhase, compact);
    rect(c, colors.dark, -7, -10, 14, 21);
    rect(c, colors.body, -6, -9, 12, 18);
    rect(c, colors.light, -5, -8, 10, 2);
    rect(c, colors.trim, -4, 5, 8, 2);
    rect(c, colors.dark, -4, -5, 8, 9);
    rect(c, colors.body, -3, -4, 6, 7);
    if (f.role === 'eroder') {
      for (let x = -8; x <= 8; x += 4)
        rect(c, colors.light, x, -12 + (Math.floor(phase * 8) % 2), 2, 4);
    } else if (f.role === 'rover') {
      rect(c, colors.light, -4, -6, 3, 2);
      rect(c, colors.light, 1, -6, 3, 2);
    } else {
      rect(c, colors.dark, -2, -14, 4, 11);
      rect(c, colors.light, -1, -13, 2, 9);
    }
  }
}
function ukraine(c, f, colors) {
  const flap = f.reduced ? 0 : Math.sin(f.phase * 5),
    compact = f.style === 'microtile';
  if (f.role === 'patrol' || f.role === 'contour') {
    for (const side of [-1, 1]) {
      c.save();
      c.scale(side, 1);
      rect(c, colors.dark, 1, -7, 11, 14);
      rect(c, colors.body, 2, -6 + flap * 2, 9, 7);
      rect(c, colors.trim, 3, 2 - flap * 2, 6, 5);
      if (!compact) rect(c, colors.light, 5, -4, 3, 3);
      c.restore();
    }
    rect(c, colors.dark, -2, -10, 4, 21);
    rect(c, colors.light, -1, -9, 2, 16);
  } else if (f.role === 'boss' || f.role === 'eroder') {
    for (let i = 0; i < 8; i++) {
      c.save();
      c.rotate((i * TAU) / 8);
      rect(c, colors.dark, -3, -13, 6, 8);
      rect(c, i % 2 ? colors.trim : colors.body, -2, -12 + (compact ? 0 : flap), 4, 7);
      if (!compact) rect(c, colors.light, -1, -11, 2, 2);
      c.restore();
    }
    rect(c, colors.dark, -5, -5, 10, 10);
    rect(c, colors.body, -3, -3, 6, 6);
  } else {
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++)
        rect(
          c,
          colors.trim,
          side < 0 ? -12 : 6,
          -6 + i * 6 + (compact ? 0 : Math.sin(f.travelPhase * 8 + i) * 2),
          6,
          2,
        );
    rect(c, colors.dark, -8, -10, 16, 22);
    rect(c, colors.body, -6, -8, 12, 18);
    rect(c, colors.trim, -1, -8, 2, 18);
    for (const x of [-4, 2]) {
      rect(c, colors.light, x, -11, 2, 3);
      if (!compact) {
        rect(c, colors.dark, x, -4, 2, 3);
        rect(c, colors.light, x, 4, 2, 2);
      }
    }
  }
}
function retro(c, f, colors) {
  const step = f.reduced ? 0 : Math.floor(f.travelPhase * 7) % 2,
    compact = f.style === 'microtile';
  if (f.role === 'patrol' || f.role === 'contour') {
    rect(c, colors.dark, -5, -12, 10, 20);
    rect(c, colors.body, -4, -11, 8, 17);
    rect(c, colors.light, -2, -9, 4, 8);
    rect(c, colors.trim, -7, -3, 3, 9);
    rect(c, colors.trim, 4, -3, 3, 9);
    rect(c, colors.body, -2, 7, 4, 3 + step * 2);
  } else if (f.role === 'eroder') {
    for (let i = 0; i < 4; i++) {
      c.save();
      c.rotate((i * Math.PI) / 2);
      rect(c, colors.dark, -4, -13, 8, 10);
      rect(c, colors.body, -3, -12 + step, 6, 8);
      rect(c, colors.light, -2, -11, 4, 2);
      c.restore();
    }
    rect(c, colors.trim, -5, -5, 10, 10);
  } else {
    rect(c, colors.dark, -11, -9, 22, 18);
    rect(c, colors.body, -9, -8, 18, 15);
    rect(c, colors.trim, -7, -11, 4, 4);
    rect(c, colors.trim, 3, -11, 4, 4);
    rect(c, colors.dark, -7, -4, 14, 6);
    rect(c, colors.light, -6, -3, 4, 2);
    rect(c, colors.light, 2, -3, 4, 2);
    for (const x of [-10, 5]) rect(c, colors.trim, x, 8 + (x < 0 ? step : 1 - step) * 2, 5, 3);
    if (!compact) for (let x = -5; x <= 4; x += 3) rect(c, colors.light, x, 4, 2, 1);
    if (f.role === 'boss') {
      rect(c, colors.trim, -14, -4, 3, 9);
      rect(c, colors.trim, 11, -4, 3, 9);
    }
  }
}
function coupa(c, f, colors) {
  const compact = f.style === 'microtile',
    step = f.reduced ? 0 : Math.floor(f.travelPhase * 6) % 2;
  if (f.role === 'boss' || f.role === 'eroder') {
    for (let i = 0; i < 4; i++) {
      c.save();
      c.rotate((i * Math.PI) / 2);
      rect(c, colors.dark, -4, -13, 8, 8);
      rect(c, colors.trim, -3, -12, 6, 6);
      if (!compact) rect(c, colors.light, -2, -11, 2, 2);
      c.restore();
    }
    rect(c, colors.dark, -7, -7, 14, 14);
    rect(c, colors.body, -5, -5, 10, 10);
  } else if (f.role === 'patrol' || f.role === 'contour') {
    rect(c, colors.dark, -9, -9, 18, 18);
    rect(c, colors.body, -7, -7, 14, 14);
    rect(c, colors.light, -7, -7, 14, 2);
    rect(c, colors.trim, -2, -7, 4, 14);
    rect(c, colors.dark, -4, -2, 8, 4);
    rect(c, colors.light, -2, -2, 4, 2);
    rect(c, colors.trim, -5, 10 + step, 3, 2);
    rect(c, colors.trim, 2, 11 - step, 3, 2);
  } else {
    rect(c, colors.dark, -9, -12, 18, 24);
    rect(c, colors.light, -7, -10, 14, 20);
    rect(c, colors.body, -7, -10, 14, 4);
    rect(c, colors.trim, 3, -10, 4, 4);
    for (let y = -2; y < 7; y += 4) rect(c, colors.dark, -4, y, compact ? 6 : 8, 1);
    rect(c, colors.body, -11, 4 + step, 3, 6);
    rect(c, colors.body, 8, 5 - step, 3, 6);
    if (f.role === 'rover') {
      rect(c, colors.dark, -10, 11, 7, 3);
      rect(c, colors.dark, 3, 11, 7, 3);
    }
  }
}

/** Image roles override only the body; collision-center cues retain their physical size. */
export function drawPresentedActor(ctx, frame, palette, image = null) {
  if (!frame) return;
  const colors = {
    dark: '#07111c',
    body: frame.dormant ? palette.muted : palette.danger,
    trim: palette.accent,
    light: palette.paper,
  };
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (!frame.reduced)
    for (let i = frame.tail.length - 1; i >= 0; i--) {
      const point = frame.tail[i];
      ctx.globalAlpha = 0.12 + (3 - i) * 0.035;
      rect(ctx, colors.body, point.x * CELL - 1, point.y * CELL - 1, 2, 2);
    }
  ctx.globalAlpha = frame.stunned ? 0.45 : frame.dormant ? 0.65 : 1;
  ctx.translate(Math.round(frame.x), Math.round(frame.y));
  ctx.save();
  ctx.rotate(frame.heading);
  ctx.scale(1 - frame.bank * 0.35, 1 + frame.bank * 0.2);
  const d = frame.diameter;
  if (image) ctx.drawImage(image, -d / 2, -d / 2, d, d);
  else {
    ctx.scale(d / 28, d / 28);
    (({ fpv, ukraine, retro, coupa })[frame.themeId] ?? retro)(ctx, frame, colors);
  }
  ctx.restore();
  // The luminous center is the contact footprint; larger body art is cosmetic.
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = palette.danger;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, frame.radius, 0, TAU);
  ctx.stroke();
  rect(ctx, colors.dark, -2, -2, 4, 4);
  rect(ctx, colors.light, -1, -1, 2, 2);
  ctx.restore();
}

export function drawActiveTrail(
  ctx,
  segments,
  points,
  player,
  palette,
  { time = 0, reduced = false } = {},
) {
  ctx.save();
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';
  for (const [color, width, alpha] of [
    ['#06101a', 8, 0.9],
    [palette.accent, 4, 1],
    [palette.paper, 1, 0.85],
  ]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    for (const s of segments) {
      ctx.moveTo(s.x1 * CELL, s.y1 * CELL);
      ctx.lineTo(s.x2 * CELL, s.y2 * CELL);
    }
    ctx.stroke();
  }
  ctx.fillStyle = palette.accent;
  ctx.globalAlpha = 0.12;
  for (const p of points) ctx.fillRect(Math.floor(p.x) * CELL, Math.floor(p.y) * CELL, CELL, CELL);
  if (segments.length) {
    ctx.globalAlpha = 1;
    rect(ctx, palette.accent, player.x * CELL - 4, player.y * CELL - 4, 8, 8);
    rect(ctx, palette.paper, player.x * CELL - 2, player.y * CELL - 2, 4, 4);
    if (!reduced) {
      let remaining = 0.3 + ((time * 3) % 1) * 0.65;
      for (let i = segments.length - 1; i >= 0; i--) {
        const s = segments[i],
          length = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
        if (length >= remaining) {
          const a = remaining / Math.max(length, 0.00001);
          rect(
            ctx,
            palette.paper,
            (s.x2 + (s.x1 - s.x2) * a) * CELL - 1,
            (s.y2 + (s.y1 - s.y2) * a) * CELL - 1,
            3,
            3,
          );
          break;
        }
        remaining -= length;
      }
    }
  }
  ctx.restore();
}

export function drawCapturePulse(ctx, effect, columns, cells, palette, reduced = false) {
  if (reduced || effect.age < 0 || effect.age >= 0.65 || !Array.isArray(effect.indices)) return;
  ctx.save();
  ctx.fillStyle = palette.accent;
  const age = effect.age / 0.65;
  for (const index of effect.indices.slice(0, 2592)) {
    if (!Number.isInteger(index) || index < 0 || index >= cells.length || cells[index] !== 1)
      continue;
    const x = index % columns,
      y = Math.floor(index / columns),
      phase = (x / columns + y / (cells.length / columns)) / 2;
    const alpha = Math.max(0, 1 - Math.abs(age - phase) * 5) * (1 - age) * 0.2;
    if (alpha < 0.015) continue;
    ctx.globalAlpha = alpha;
    ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
  }
  ctx.restore();
}
