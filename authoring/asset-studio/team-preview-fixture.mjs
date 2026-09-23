import { createTeamOutcomeFeedback } from '../../game/couch/coop-outcome-presentation.mjs';
import { createCoop, startCoop, stepCoop, FIXED_DT } from '../../game/coop/core.mjs';
import { FIRST_CONNECTION } from '../../game/coop/first-connection.mjs';
import { RELAY_YARD } from '../../game/coop/relay-yard.mjs';
import { buildCoopLevel, createCoopLevelRecipe } from '../../game/coop/recipes.mjs';

export const TEAM_PREVIEW_SCENARIOS = Object.freeze(
  [
    ['initial', 'Ready to fly'],
    ['cutting', 'Active cuts'],
    ['warning', 'Hunter warning'],
    ['charge', 'Hunter charge'],
    ['hunter-recovery', 'Hunter recovery'],
    ['capture', 'Joint capture'],
    ['team-recovery', 'Team reserve recovery'],
    ['support', 'Support pulse'],
    ['emitter-warning', 'Emitter warning'],
    ['emitter-spark', 'Travelling spark'],
    ['anchors', 'Anchors captured'],
    ['core', 'Exposed relay core'],
    ['secured', 'Secured core · two-relay specimen'],
    ['victory', 'Completed arena'],
    ['downed-p1', 'Player 1 downed'],
    ['crawling-p1', 'Player 1 crawling'],
    ['rescue-p1', 'Rescuing player 1'],
    ['recovered-p1', 'Player 1 recovered'],
    ['downed-p2', 'Player 2 downed'],
    ['crawling-p2', 'Player 2 crawling'],
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
// Same authored arena and public controls. Turn upward before the usual joint
// capture so the warned trail remains exposed long enough for a real spark.
const hunterRecoveryTraces = Object.freeze({
  'first-connection': Object.freeze([
    segment(60, up, up),
    segment(150, right, left),
    segment(1, ...inwardCover),
    segment(23, right, left),
    segment(480, release, release),
  ]),
  'relay-yard': Object.freeze([
    segment(60, up, up),
    segment(230, right, left),
    segment(1, ...inwardCover),
    segment(33, right, left),
    segment(480, release, release),
  ]),
});
const teamRecoveryTraces = Object.freeze(
  Object.fromEntries(
    Object.entries({
      'first-connection': [
        [90, 'up', 'up'],
        [90, 'down', 'left'],
        [90, 'up', 'up'],
        [90, 'down', 'down'],
        [90, 'up', 'right'],
        [90, 'right', 'up'],
        [90, 'left', 'right'],
        [90, 'right', 'up'],
        [90, 'left', 'down'],
        [90, 'left', 'right'],
        [90, 'left', 'down'],
        [90, 'left', 'down'],
        [90, 'left', 'down'],
        [90, 'up', 'down'],
        [90, 'up', 'left'],
        [90, 'down', 'right'],
        [90, 'down', 'right'],
        [90, 'down', 'up'],
        [90, 'left', 'right'],
        [90, 'left', 'down'],
        [90, 'right', 'right'],
        [90, 'left', 'right'],
        [90, 'up', 'down'],
        [90, 'up', 'up'],
        [90, 'up', 'up'],
        [90, 'up', 'right'],
        [90, 'right', 'up'],
        [90, 'left', 'right'],
        [90, 'up', 'left'],
        [90, 'up', 'down'],
        [90, 'up', 'down'],
        [90, 'down', 'right'],
        [90, 'right', 'down'],
        [90, 'left', 'up'],
        [90, 'up', 'down'],
        [90, 'right', 'down'],
        [90, 'right', 'down'],
        [90, 'left', 'down'],
        [90, 'up', 'right'],
        [90, 'left', 'right'],
        [90, 'down', 'down'],
        [90, 'left', 'up'],
        [90, 'left', 'left'],
        [90, 'right', 'up'],
        [90, 'left', 'left'],
        [90, 'left', 'down'],
        [5, 'left', 'up'],
        [360, null, null],
      ],
      'relay-yard': [
        [90, 'up', 'up'],
        [90, 'down', 'left'],
        [90, 'up', 'up'],
        [90, 'down', 'down'],
        [90, 'up', 'right'],
        [90, 'right', 'up'],
        [90, 'left', 'right'],
        [90, 'right', 'up'],
        [90, 'left', 'down'],
        [90, 'left', 'right'],
        [90, 'left', 'down'],
        [90, 'left', 'down'],
        [90, 'left', 'down'],
        [90, 'up', 'down'],
        [90, 'up', 'left'],
        [90, 'down', 'right'],
        [90, 'down', 'right'],
        [90, 'down', 'up'],
        [90, 'left', 'right'],
        [90, 'left', 'down'],
        [90, 'right', 'right'],
        [90, 'left', 'right'],
        [90, 'up', 'down'],
        [90, 'up', 'up'],
        [90, 'up', 'up'],
        [90, 'up', 'right'],
        [90, 'right', 'up'],
        [90, 'left', 'right'],
        [90, 'up', 'left'],
        [90, 'up', 'down'],
        [90, 'up', 'down'],
        [90, 'down', 'right'],
        [90, 'right', 'down'],
        [90, 'left', 'up'],
        [90, 'up', 'down'],
        [90, 'right', 'down'],
        [90, 'right', 'down'],
        [90, 'left', 'down'],
        [90, 'up', 'right'],
        [90, 'left', 'right'],
        [90, 'down', 'down'],
        [90, 'left', 'up'],
        [90, 'left', 'left'],
        [90, 'right', 'up'],
        [90, 'left', 'left'],
        [90, 'left', 'down'],
        [5, 'left', 'up'],
        [360, null, null],
      ],
    }).map(([arena, steps]) => [
      arena,
      Object.freeze(
        steps.map(([ticks, left, right]) =>
          segment(ticks, command(left, left !== null), command(right, right !== null)),
        ),
      ),
    ]),
  ),
);
const emitterTrace = Object.freeze([
  segment(60, up, up),
  segment(230, right, left),
  segment(1, ...inwardCover),
  segment(39, right, left),
  segment(120, up, up),
]);
const rescueTrace = (seat) =>
  Object.freeze([
    segment(140, right, left),
    segment(70, up, up),
    segment(214, right, left),
    segment(24, seat === 0 ? left : idle, seat === 1 ? right : idle),
    segment(35, seat === 0 ? up : idle, seat === 1 ? up : idle),
    segment(17, seat === 1 ? right : idle, seat === 0 ? left : idle),
    segment(120, command(null, true, seat === 1), command(null, true, seat === 0)),
    // Released controls let real recovery grace expire before the specimen loops.
    segment(360, release, release),
  ]);
const rescues = Object.freeze([rescueTrace(0), rescueTrace(1)]);
const crawls = Object.freeze(
  [0, 1].map((seat) =>
    Object.freeze([
      ...rescueTrace(seat).slice(0, 5),
      segment(60, seat === 0 ? left : release, seat === 1 ? right : release),
      segment(360, release, release),
    ]),
  ),
);
const ticks = Object.freeze({
  'first-connection': Object.freeze({
    initial: 0,
    'team-recovery': 4145,
    cutting: 65,
    warning: 90,
    charge: 234,
    'hunter-recovery': 432,
    capture: 414,
    support: 211,
    victory: 1179,
  }),
  'relay-yard': Object.freeze({
    initial: 0,
    'team-recovery': 4145,
    cutting: 65,
    warning: 180,
    charge: 324,
    'hunter-recovery': 502,
    capture: 414,
    support: 291,
    'emitter-warning': 360,
    'emitter-spark': 430,
    anchors: 653,
    core: 709,
    secured: 832,
    victory: 832,
    'downed-p1': 483,
    'crawling-p1': 495,
    'rescue-p1': 560,
    'recovered-p1': 620,
    'downed-p2': 483,
    'crawling-p2': 495,
    'rescue-p2': 560,
    'recovered-p2': 620,
  }),
});
export function isTeamPreviewScenarioAvailable(arena, scenario) {
  return (
    typeof arena === 'string' &&
    Object.hasOwn(ticks, arena) &&
    typeof scenario === 'string' &&
    Object.hasOwn(ticks[arena], scenario)
  );
}

const arenas = Object.freeze({ 'first-connection': FIRST_CONNECTION, 'relay-yard': RELAY_YARD });
// A distinct authored level, accepted by the ordinary recipe/level validators.
// No captured flags or outcomes are authored: the public Relay Yard command
// trace earns the first core while the second required relay keeps play active.
// It has no canonical arena-picture binding; Studio must use a neutral backdrop.
const securedLevel = freezeLevel(
  buildCoopLevel(
    createCoopLevelRecipe('stronghold', {
      id: 'studio-two-relays',
      name: 'Studio Two Relays',
      layout: {
        strongholds: [
          ...structuredClone(RELAY_YARD.strongholds),
          {
            id: 'studio-south-relay',
            core: { x: 35.5, y: 29.5 },
            anchors: [
              { x: 23.5, y: 25.5 },
              { x: 48.5, y: 25.5 },
            ],
          },
        ],
      },
    }),
  ),
);
const securedTrace = Object.freeze([...winning['relay-yard'], segment(360, release, release)]);

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
  const neutralBackdrop = scenario === 'secured';
  const level = freezeLevel(structuredClone(neutralBackdrop ? securedLevel : arenas[arena]));
  const isRescue = /^(downed|crawling|rescue|recovered)-p[12]$/.test(scenario);
  const trace =
    scenario === 'secured'
      ? securedTrace
      : scenario === 'team-recovery'
        ? teamRecoveryTraces[arena]
        : scenario === 'hunter-recovery'
          ? hunterRecoveryTraces[arena]
          : scenario.startsWith('emitter-')
            ? emitterTrace
            : scenario.startsWith('crawling-')
              ? crawls[scenario.endsWith('1') ? 0 : 1]
              : isRescue
                ? rescues[scenario.endsWith('1') ? 0 : 1]
                : winning[arena];
  const selectedTick = ticks[arena][scenario];
  const traceEnd = trace.reduce((sum, item) => sum + item.ticks, 0);
  const loopEnd = Math.min(traceEnd, selectedTick + LOOP_STEPS);
  let run = startCoop(createCoop(level, { difficulty: 'standard', seed: 17 }));
  const outcomes = createTeamOutcomeFeedback();
  let index = 0;
  let remaining = trace[0].ticks;
  function step() {
    stepCoop(run, trace[index].commands, FIXED_DT);
    outcomes.observe(run);
    if (--remaining === 0 && index + 1 < trace.length) remaining = trace[++index].ticks;
  }
  let previousRun = null;
  for (let tick = 0; tick < selectedTick; tick++) {
    if (tick === selectedTick - 1) previousRun = structuredClone(run);
    step();
  }
  // Keep the current attempt’s level identity for adjacency checks. The core owns
  // this level and aliases some mutable actors into it; sampled actor arrays above
  // remain the actual previous tick. Never use level actors as a prior-frame sample.
  if (previousRun) previousRun.level = run.level;
  // Retain only an actual earned state. Restoring this private copy avoids a
  // synchronous multi-second replay seek on every animation-loop boundary.
  const selected = structuredClone(run);
  const selectedFeedback = outcomes.read(run);
  const selectedIndex = index;
  const selectedRemaining = remaining;
  let accumulator = 0;
  let held = 0;
  function reset() {
    run = structuredClone(selected);
    outcomes.restore(run, selectedFeedback);
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
    neutralBackdrop,
    get feedback() {
      return outcomes.read(run);
    },
    get previousRun() {
      if (!previousRun) return null;
      return { ...structuredClone(previousRun), level: run.level };
    },
    get run() {
      return run;
    },
    advance,
    reset,
    scenario,
    label: descriptor.label,
  });
}
