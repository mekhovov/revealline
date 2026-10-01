import { t } from '../i18n/index.mjs';
import { hashText } from './music.mjs';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)),
  TAU = Math.PI * 2;
const ease = (v) => 1 - (1 - clamp(v, 0, 1)) ** 3;
export const CELEBRATION_SECONDS = 3.8;
const PAPER_COUNT = 72;
const GLINT_COUNT = 8;
// Keep the family IDs stable for existing presentation consumers. Each now
// selects a paper palette; no family draws equipment, smoke or explosions.
const CONFETTI_TONES = {
  'signal-clear': ['accent', 'safe', 'paper', 'danger', 'accent', 'safe'],
  'stitch-bloom': ['accent', 'danger', 'paper', 'safe', 'danger', 'accent'],
  'savings-nodes': ['safe', 'accent', 'paper', 'safe', 'danger', 'accent'],
  'neon-fireworks': ['danger', 'safe', 'paper', 'accent', 'safe', 'danger'],
};
// Stateless presentation randomness: sampling a frame never consumes gameplay
// randomness, accumulates particles or depends on the rendering frame rate.
function sample(seed, index, channel) {
  let value = seed ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(channel + 1, 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}
export function finaleKind(theme = {}) {
  return theme.family === 'fpv' || theme.id === 'fpv'
    ? 'signal-clear'
    : theme.family === 'atlas' || theme.scene === 'heritage'
      ? 'stitch-bloom'
      : theme.family === 'navi' || theme.scene === 'network'
        ? 'savings-nodes'
        : 'neon-fireworks';
}
export function createCelebration({ theme = {}, levelId = '', seed = 0, reduced = false } = {}) {
  return {
    kind: finaleKind(theme),
    levelId,
    seed: hashText(`${levelId}:${seed}:${theme.id || ''}`),
    elapsed: reduced ? CELEBRATION_SECONDS : 0,
    duration: CELEBRATION_SECONDS,
    reduced: !!reduced,
    skipped: false,
  };
}
export function advanceCelebration(state, dt, { paused = false, reduced = false } = {}) {
  if (!state) return null;
  if (!Number.isFinite(dt) || dt < 0)
    throw new TypeError(t('interface:celebrationDtMustBeFiniteAndNonnegative'));
  if (reduced) return { ...state, reduced: true, elapsed: state.duration };
  if (paused || state.elapsed >= state.duration) return state;
  return { ...state, elapsed: Math.min(state.duration, state.elapsed + Math.min(dt, 0.25)) };
}
export function skipCelebration(state) {
  return state ? { ...state, elapsed: state.duration, skipped: true } : null;
}
export function celebrationFrame(state) {
  if (!state)
    return {
      active: false,
      finished: true,
      reveal: 1,
      pictureScale: 1,
      progress: 1,
      phase: 'picture',
      particles: [],
      equipment: [],
    };
  const time = state.elapsed,
    finished = time >= state.duration,
    fade = 1 - ease((time - 2.45) / (state.duration - 2.45)),
    particles = [];
  if (!finished && !state.reduced) {
    const tones = CONFETTI_TONES[state.kind] || CONFETTI_TONES['signal-clear'];
    for (let index = 0; index < PAPER_COUNT; index++) {
      const random = (channel) => sample(state.seed, index, channel),
        age = time - random(0) * 0.55;
      if (age < 0) continue;
      const phase = random(1) * TAU,
        depth = random(2),
        flutter = 1.8 + random(3) * 1.8,
        y = 0.04 - random(4) * 0.19 + age * (0.19 + depth * 0.1) + age * age * 0.014;
      if (y < -0.025 || y > 1.04) continue;
      particles.push({
        shape: 'paper',
        x: clamp(
          0.035 + random(5) * 0.93 + Math.sin(age * flutter + phase) * (0.012 + depth * 0.016),
          0.015,
          0.985,
        ),
        y,
        size: 4.2 + depth * 3.6,
        aspect: index % 5 === 0 ? 1.7 : 0.48 + random(6) * 0.38,
        rotation: phase + Math.sin(age * 1.7 + phase) * 0.6 + age * (random(7) - 0.5) * 1.6,
        flip: 0.18 + Math.abs(Math.cos(phase + age * flutter)) * 0.82,
        alpha: ease(age / 0.22) * fade * (0.62 + depth * 0.32),
        tone: tones[index % tones.length],
      });
    }
    // A few soft, single-bloom glints sit near the picture edges. They do not
    // strobe, spread out from an impact, or obscure the picture's focal area.
    for (let index = 0; index < GLINT_COUNT; index++) {
      const age = time - 0.2 - index * 0.13,
        life = 0.9;
      if (age < 0 || age > life) continue;
      const bloom = Math.sin((age / life) * Math.PI);
      particles.push({
        shape: 'glint',
        x:
          index % 2
            ? 0.93 - sample(state.seed, index, 9) * 0.07
            : 0.07 + sample(state.seed, index, 9) * 0.07,
        y: 0.16 + sample(state.seed, index, 10) * 0.56,
        size: 2 + bloom * 3,
        rotation: Math.PI / 8,
        alpha: bloom * 0.55,
        tone: index % 3 ? 'paper' : 'accent',
      });
    }
  }
  return {
    active: !finished,
    finished,
    reveal: finished || state.reduced ? 1 : ease(time / 0.85),
    pictureScale: finished || state.reduced ? 1 : 1 + 0.014 * (1 - ease(time / 1.35)),
    progress: clamp(time / state.duration, 0, 1),
    phase: finished ? 'picture' : time < 0.85 ? 'reveal' : time < 2.45 ? 'celebrate' : 'settle',
    kind: state.kind,
    elapsed: time,
    duration: state.duration,
    particles,
    equipment: [],
  };
}
export function drawCelebration(ctx, frame, palette, width = 768, height = 576) {
  if (!frame.active) return;
  const scale = Math.min(width / 768, height / 576);
  ctx.save();
  // The curtain belongs entirely to the board, including in a letterboxed view.
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  for (const p of frame.particles) {
    if (p.alpha <= 0) continue;
    const size = p.size * scale;
    ctx.save();
    ctx.globalAlpha = clamp(p.alpha, 0, 1);
    ctx.fillStyle = palette[p.tone] || palette.accent;
    ctx.translate(p.x * width, p.y * height);
    ctx.rotate(p.rotation);
    if (p.shape === 'paper') {
      ctx.scale(p.flip, 1);
      ctx.fillRect(-size / 2, (-size * p.aspect) / 2, size, size * p.aspect);
      // A narrow lighter fold makes the paper feel tactile without glow or blur.
      ctx.globalAlpha *= 0.32;
      ctx.fillStyle = palette.paper || '#fff4dc';
      ctx.fillRect(-size / 2, (-size * p.aspect) / 2, size, Math.min(1, size * p.aspect * 0.22));
    } else if (p.shape === 'glint') {
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.22, -size * 0.22);
      ctx.lineTo(size, 0);
      ctx.lineTo(size * 0.22, size * 0.22);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.22, size * 0.22);
      ctx.lineTo(-size, 0);
      ctx.lineTo(-size * 0.22, -size * 0.22);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}
