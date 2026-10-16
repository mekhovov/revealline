import { createActorPresentation } from '../../game/ui/actor-presentation.mjs';

export const SEQUENCE_FPS = 60;
export const SEQUENCE_TICKS = 360;
export const BOARD = Object.freeze({ columns: 24, rows: 14, cellSize: 16 });
export const CUES = Object.freeze([
  Object.freeze({ tick: 96, label: 'Live-line threat' }),
  Object.freeze({ tick: 162, label: 'Capture' }),
  Object.freeze({ tick: 222, label: 'Separate stun cue' }),
  Object.freeze({ tick: 288, label: 'Recovery' }),
]);
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const indices = freeze(
  Array.from({ length: 120 }, (_, i) => (1 + Math.floor(i / 10)) * BOARD.columns + 1 + (i % 10)),
);
const initialCells = freeze(
  Array.from({ length: BOARD.columns * BOARD.rows }, (_, i) =>
    i < BOARD.columns ||
    i >= BOARD.columns * (BOARD.rows - 1) ||
    i % BOARD.columns === 0 ||
    i % BOARD.columns === BOARD.columns - 1
      ? 1
      : 0,
  ),
);
const securedCells = freeze(initialCells.map((cell, i) => (indices.includes(i) ? 1 : cell)));
function validTick(tick) {
  if (!Number.isSafeInteger(tick) || tick < 0 || tick >= SEQUENCE_TICKS)
    throw new Error('Choose a sequence tick from 0 to 359.');
  return tick;
}

/** Authored presentation snapshots, not a simulated attempt or a replay file.
 * Capture and stun are separate cues; neither implies a gameplay relationship. */
export function authoredSnapshot(tick) {
  validTick(tick);
  const time = tick / SEQUENCE_FPS;
  const cutting = tick < 150;
  const player = { x: 10.5, y: cutting ? 0.5 + (13 * tick) / 150 : 13.5 };
  const actor = {
    id: 'comparison-actor',
    type: 'bouncer',
    x: tick < 150 ? 17 : tick < 210 ? 17 - (tick - 150) / 20 : 14,
    y: tick < 150 ? 4 + tick / 50 : tick < 270 ? 7 : 7 - (tick - 270) / 30,
    vx: 0,
    vy: 1.2,
    radius: 0.25,
    stunnedUntil: tick >= 210 && tick < 270 ? 4.5 : 0,
  };
  const phase =
    tick < 95
      ? 'Cut in progress'
      : tick < 150
        ? 'Live-line threat'
        : tick < 189
          ? 'Territory secured'
          : tick < 210
            ? 'Secured state'
            : tick < 270
              ? 'Separate authored stun cue'
              : 'Actor recovery';
  return freeze({
    tick,
    time,
    phase,
    actor,
    player,
    cells: cutting ? initialCells : securedCells,
    newlySecured: cutting ? [] : indices,
    captureEffect: { age: (tick - 150) / SEQUENCE_FPS, indices },
    trailSegments: cutting ? [{ x1: 10.5, y1: 0.5, x2: player.x, y2: player.y }] : [],
    trailPoints: cutting
      ? Array.from({ length: Math.floor(player.y) }, (_, y) => ({ x: 10.5, y: y + 0.5 }))
      : [],
    front: tick >= 95 && cutting ? { x: 10.5, y: 2 + (tick - 95) / 10, direction: 1 } : null,
  });
}

const cache = new Map();
/** Replay fixed 1/60 steps once per effects setting. Seeking never feeds a
 * large dt into the history-dependent production actor sampler. */
export function sequenceFrame(tick, { reduced = false } = {}) {
  validTick(tick);
  const key = Boolean(reduced);
  if (!cache.has(key)) {
    const sampler = createActorPresentation();
    cache.set(
      key,
      freeze(
        Array.from({ length: SEQUENCE_TICKS }, (_, index) => {
          const scene = authoredSnapshot(index);
          const actorFrame = sampler
            .sample([scene.actor], {
              tick: index,
              time: scene.time,
              dt: index === 0 ? 0 : 1 / SEQUENCE_FPS,
              reduced: key,
              themeId: 'fpv',
              canvasCSSWidth: 384,
            })
            .get(scene.actor.id);
          return { ...scene, actorFrame };
        }),
      ),
    );
  }
  return cache.get(key)[tick];
}

export function createSequenceClock() {
  let tick = 0;
  let playing = false;
  let remainder = 0;
  return {
    get tick() {
      return tick;
    },
    get playing() {
      return playing;
    },
    play() {
      playing = true;
    },
    pause() {
      playing = false;
      remainder = 0;
    },
    seek(next) {
      tick = validTick(next);
      playing = false;
      remainder = 0;
    },
    step() {
      this.seek((tick + 1) % SEQUENCE_TICKS);
    },
    restart() {
      this.seek(0);
    },
    advance(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Invalid elapsed time.');
      if (!playing) return tick;
      remainder += seconds * SEQUENCE_FPS;
      const whole = Math.floor(remainder + 1e-9);
      remainder -= whole;
      tick = (tick + whole) % SEQUENCE_TICKS;
      return tick;
    },
  };
}
