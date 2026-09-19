import { createCoop, startCoop, stepCoop, FIXED_DT } from '../../game/coop/core.mjs';
import { FIRST_CONNECTION } from '../../game/coop/first-connection.mjs';
import { RELAY_YARD } from '../../game/coop/relay-yard.mjs';

export const TEAM_PREVIEW_SCENARIOS = Object.freeze(
  [
    ['initial', 'Ready to fly'],
    ['cutting', 'Active cuts'],
    ['warning', 'Hunter warning'],
    ['charge', 'Hunter charge'],
    ['capture', 'Joint capture'],
    ['anchors', 'Anchors captured'],
    ['core', 'Exposed relay core'],
    ['victory', 'Completed arena'],
    ['downed-p1', 'Player 1 downed'],
    ['rescue-p1', 'Rescuing player 1'],
    ['recovered-p1', 'Player 1 recovered'],
    ['downed-p2', 'Player 2 downed'],
    ['rescue-p2', 'Rescuing player 2'],
    ['recovered-p2', 'Player 2 recovered'],
  ].map(([id, label]) => Object.freeze({ id, label })),
);

const command = (direction = null, boost = true, support = false) =>
  Object.freeze({ direction, boost, support });
const segment = (ticks, left, right) =>
  Object.freeze({ ticks, commands: Object.freeze([left, right]) });
const up = command('up');
const down = command('down');
const left = command('left');
const right = command('right');
const idle = command();
const release = command(null, false);
const inwardCover = [command('right', true, true), command('left', true, true)];

/** Recorded public-command traces on the unchanged revision-2 starter arenas,
 * Standard / seed 17. Source evidence: cbd950ab, Studio Team reachability.
 * Counts are fixed 120 Hz steps, not browser key timing or manufactured states.
 * Keep these data browser-only: no test helper, planner, process or persistence. */
const winning = Object.freeze({
  'first-connection': Object.freeze([
    segment(60, up, up),
    segment(150, right, left),
    segment(1, ...inwardCover),
    segment(203, right, left),
    segment(1, release, release),
    segment(93, left, right),
    segment(225, down, down),
    segment(1, release, release),
    segment(125, up, up),
    segment(93, right, left),
    segment(1, release, release),
    segment(93, left, right),
    segment(40, down, down),
    segment(93, right, left),
  ]),
  'relay-yard': Object.freeze([
    segment(60, up, up),
    segment(230, right, left),
    segment(1, ...inwardCover),
    segment(123, right, left),
    segment(1, release, release),
    segment(123, left, right),
    segment(115, up, up),
    segment(1, release, release),
    segment(55, down, down),
    segment(1, ...inwardCover),
    segment(122, right, left),
  ]),
});
const rescueTrace = (seat) =>
  Object.freeze([
    segment(140, right, left),
    segment(70, up, up),
    segment(214, right, left),
    segment(24, seat === 0 ? left : idle, seat === 1 ? right : idle),
    segment(35, seat === 0 ? up : idle, seat === 1 ? up : idle),
    segment(17, seat === 1 ? right : idle, seat === 0 ? left : idle),
    segment(120, command(null, true, seat === 1), command(null, true, seat === 0)),
  ]);
const rescues = Object.freeze([rescueTrace(0), rescueTrace(1)]);
const ticks = Object.freeze({
  'first-connection': Object.freeze({
    initial: 0,
    cutting: 65,
    warning: 90,
    charge: 234,
    capture: 414,
    victory: 1179,
  }),
  'relay-yard': Object.freeze({
    initial: 0,
    cutting: 65,
    warning: 180,
    charge: 324,
    capture: 414,
    anchors: 653,
    core: 709,
    victory: 832,
    'downed-p1': 483,
    'rescue-p1': 560,
    'recovered-p1': 620,
    'downed-p2': 483,
    'rescue-p2': 560,
    'recovered-p2': 620,
  }),
});
const arenas = Object.freeze({ 'first-connection': FIRST_CONNECTION, 'relay-yard': RELAY_YARD });
const MAX_STEPS = 8;
const LOOP_STEPS = 360;
const HOLD_STEPS = 60;

function freezeLevel(value) {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freezeLevel(item);
    Object.freeze(value);
  }
  return value;
}

/** An isolated, command-earned renderer specimen. Nothing subscribes to live
 * input, settings, saves, sound or storage. The caller pauses by not advancing;
 * pauseCoop would release the very rescue state this preview needs to display.
 * dt is seconds. Long frames drop excess elapsed time rather than catching up. */
export function createStudioTeamFixture({ arena = 'first-connection', scenario = 'initial' } = {}) {
  if (typeof arena !== 'string' || !Object.hasOwn(arenas, arena))
    throw new Error('Unknown Team preview arena.');
  const descriptor = TEAM_PREVIEW_SCENARIOS.find((item) => item.id === scenario);
  if (!descriptor) throw new Error('Unknown Team preview scenario.');
  if (!Object.hasOwn(ticks[arena], scenario))
    throw new Error(`Team preview scenario "${scenario}" is unavailable in ${arena}.`);
  const level = freezeLevel(structuredClone(arenas[arena]));
  const isRescue = /^(downed|rescue|recovered)-p[12]$/.test(scenario);
  const trace = isRescue ? rescues[scenario.endsWith('1') ? 0 : 1] : winning[arena];
  const selectedTick = ticks[arena][scenario];
  const traceEnd = trace.reduce((sum, item) => sum + item.ticks, 0);
  const loopEnd = Math.min(traceEnd, selectedTick + LOOP_STEPS);
  let run = startCoop(createCoop(level, { difficulty: 'standard', seed: 17 }));
  let index = 0;
  let remaining = trace[0].ticks;
  function step() {
    stepCoop(run, trace[index].commands, FIXED_DT);
    if (--remaining === 0 && index + 1 < trace.length) remaining = trace[++index].ticks;
  }
  for (let tick = 0; tick < selectedTick; tick++) step();
  // Retain only an actual earned state. Restoring this private copy avoids a
  // synchronous multi-second replay seek on every animation-loop boundary.
  const selected = structuredClone(run);
  const selectedIndex = index;
  const selectedRemaining = remaining;
  let accumulator = 0;
  let held = 0;
  function reset() {
    run = structuredClone(selected);
    index = selectedIndex;
    remaining = selectedRemaining;
    accumulator = 0;
    held = 0;
    return run;
  }
  function advance(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return run;
    accumulator += Math.min(dt, MAX_STEPS * FIXED_DT);
    const count = Math.min(MAX_STEPS, Math.floor((accumulator + 1e-12) / FIXED_DT));
    accumulator = Math.max(0, accumulator - count * FIXED_DT);
    for (let tick = 0; tick < count; tick++) {
      if (run.tick >= loopEnd) {
        if (++held >= HOLD_STEPS) {
          reset();
          break;
        }
      } else step();
    }
    return run;
  }
  return Object.freeze({
    level,
    get run() {
      return run;
    },
    advance,
    reset,
    scenario,
    label: descriptor.label,
  });
}
