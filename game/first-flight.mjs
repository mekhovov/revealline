import { CELL, CLASSES, RULESET, TURN_POLICIES, loadoutHash, rosterHash } from './core/index.mjs';
import { normalizedLevel } from './core/level.mjs';
import { SCENARIO_VERSION, validateScenario, validateTheme } from './content.mjs';
import { boundedJSON, canonicalJSON, dataIdentity, plainObject } from './data-json.mjs';

const freeze = (value) => {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
  return Object.freeze(value);
};
const ensure = (condition, message) => {
  if (!condition) throw new TypeError(message);
};
const keys = (value, fields, name) =>
  ensure(
    plainObject(value) &&
      Object.keys(value).length === fields.length &&
      fields.every((key) => Object.hasOwn(value, key)),
    `${name} has missing or unsupported fields.`,
  );
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const runIdentifier = (value) =>
  typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(value);
const rect = (id, kind, x, y, w, h, label) => ({ id, kind, x, y, w, h, label });

/** Finite teaching metadata; markers never participate in simulation or awards. */
export const FIRST_FLIGHT_LESSONS = freeze([
  {
    id: 'close-line',
    levelId: 'first-flight-close-line',
    title: 'Close a line',
    summary: 'Leave the marked safe edge and reach the opposite edge.',
    instructions: [
      'Start at the marked top edge. Fly down to the opposite safe edge to close a live line.',
      'Your live line is vulnerable until it closes. Reaching safe ground secures the line and reveals territory with no enemy inside.',
      'Tap a direction to fly. Tap another to turn. Pause to take a break. Boost and Scout equipment are optional; there is no class switching in this course.',
    ],
    steps: [
      {
        id: 'close-line',
        label: 'Close the line and reveal the picture',
        instruction: 'Fly down from the marked start to the opposite safe edge.',
      },
    ],
    markers: [
      rect('start', 'start', 24, 0, 1, 2, 'Start ↓'),
      rect('return', 'return', 22, 35, 5, 1, 'Safe edge'),
    ],
  },
  {
    id: 'empty-side',
    levelId: 'first-flight-empty-side',
    title: 'Find the empty side',
    summary: 'Secure a divider, then reveal the empty upper-left region.',
    instructions: [
      'First fly straight down the center to the bottom safe edge. Both stationary threats stay in the field, so only your divider becomes safe.',
      'Move back up that secured center line. Turn left within the marked band, rows 16–24, and reach the left safe edge.',
      'The upper-left region contains no enemy. Closing the horizontal line reveals that whole region and its garden objective.',
      'A different route can reveal the picture without completing this particular example. Retry, Skip lesson and Exit remain available.',
    ],
    steps: [
      {
        id: 'separator',
        label: 'Secure the center divider',
        instruction: 'Fly straight down the center until you reach the bottom safe edge.',
      },
      {
        id: 'empty-region',
        label: 'Reveal the empty region',
        instruction:
          'Return up the secured center line; turn left within rows 16–24 and reach the left safe edge.',
      },
    ],
    markers: [
      rect('start', 'start', 24, 0, 1, 2, 'Start ↓'),
      rect('divider', 'divider', 24, 1, 1, 34, 'Center line'),
      rect('band', 'band', 1, 16, 24, 9, 'Turn left here'),
      rect('return', 'return', 0, 16, 1, 9, 'Safe edge'),
      rect('garden', 'objective', 8, 8, 1, 1, 'Garden'),
    ],
  },
  {
    id: 'picture-home',
    levelId: 'first-flight-picture-home',
    title: 'Bring the picture home',
    summary: 'Reveal the garden and enough territory while a threat moves.',
    instructions: [
      'Reveal the visible garden objective and at least 65% of the field. The threat now moves.',
      'Use safe ground to choose the next cut. A line becomes safe only when you close it.',
      'A failed live line costs a life. Previously secured territory stays safe; causing a failure is never required.',
      'This course has no saved rewards. You can repeat any lesson and return to your normal game afterward.',
    ],
    steps: [
      {
        id: 'objective',
        label: 'Reveal the garden',
        instruction: 'Close a line that reveals the visible garden objective.',
      },
      {
        id: 'picture',
        label: 'Finish the picture',
        instruction: 'Secure enough territory to finish while avoiding the moving threat.',
      },
    ],
    markers: [
      rect('start', 'start', 24, 0, 1, 2, 'Start'),
      rect('garden', 'objective', 8, 8, 1, 1, 'Garden'),
    ],
  },
]);
export function getFirstFlightLesson(id) {
  const lesson = FIRST_FLIGHT_LESSONS.find((item) => item.id === id);
  ensure(lesson, 'Unknown First Flight lesson.');
  return lesson;
}

/** Reads only a finite course query. No map, return URL, storage or executable input. */
export function resolveCourseRequest(params) {
  ensure(params instanceof URLSearchParams, 'Course query must be URLSearchParams.');
  ensure(params.toString().length <= 4096, 'Course query exceeds its budget.');
  if (!params.has('course')) {
    ensure(!params.has('lesson'), 'A lesson requires the First Flight course.');
    return null;
  }
  for (const key of ['course', 'lesson', 'turn-policy'])
    ensure(params.getAll(key).length <= 1, `Duplicate ${key} query.`);
  ensure(params.get('course') === 'first-flight', 'Unknown course.');
  ensure(!params.has('practice'), 'Course and practice scenario inputs cannot be combined.');
  const lessonId = params.get('lesson') ?? FIRST_FLIGHT_LESSONS[0].id;
  getFirstFlightLesson(lessonId);
  const policy = params.get('turn-policy');
  ensure(policy === null || TURN_POLICIES.includes(policy), 'Unknown course turn policy.');
  return Object.freeze({
    course: 'first-flight',
    lessonId,
    ...(policy === null ? {} : { turnPolicy: policy }),
  });
}

const scout = CLASSES.find((recipe) => recipe.id === 'scout');
const recipes = Object.freeze([scout]);
const recipeJSON = canonicalJSON(scout);
const rosterJSON = canonicalJSON(recipes);
const expectedLoadout = loadoutHash(scout);
const expectedRoster = rosterHash(recipes);
function levelFor(lesson) {
  const garden = { id: 'garden', x: 8.5, y: 8.5, required: true, hidden: false };
  const enemy = (id, x, y, vx = 0, vy = 0) => ({ id, type: 'bouncer', x, y, vx, vy, radius: 0.25 });
  return {
    version: 'xonix-level.v1',
    id: lesson.levelId,
    revision: '1',
    name: lesson.title,
    width: 48,
    height: 36,
    spawn: { x: 24.5, y: 0.5 },
    walls: [],
    enemies:
      lesson.id === 'empty-side'
        ? [enemy('west-threat', 12.5, 27.5), enemy('east-threat', 38.5, 27.5)]
        : [
            lesson.id === 'close-line'
              ? enemy('roamer', 37.5, 24.5)
              : enemy('roamer', 38.5, 27.5, -1, 0.7),
          ],
    objectives: lesson.id === 'close-line' ? [] : [garden],
    supplies: [{ id: 'home', x: 24.5, y: 0.5, radius: 2 }],
    hangars: [],
    goal: {
      coverage: lesson.id === 'close-line' ? 0.45 : lesson.id === 'empty-side' ? 0.25 : 0.65,
    },
    rules: {
      lives: 3,
      moveSpeed: 10,
      boostMultiplier: 1.5,
      respawnSeconds: 0.7,
      graceSeconds: 0.7,
      playerRadius: 0.18,
      pointsPerCell: 10,
      timeMedals: [40, 73],
    },
  };
}
const contexts = new Map(
  FIRST_FLIGHT_LESSONS.map((lesson) => {
    const level = freeze(normalizedLevel(levelFor(lesson)));
    return [
      lesson.id,
      {
        level,
        json: canonicalJSON(level),
        rules: canonicalJSON(level.rules),
        identity: `level-v1-${dataIdentity(level)}`,
      },
    ];
  }),
);

/** Inject the already loaded FPV theme; never fetch cosmetic JSON inside the registry. */
export function createLessonScenario(lessonId, { turnPolicy = 'immediate', theme } = {}) {
  const lesson = getFirstFlightLesson(lessonId);
  ensure(TURN_POLICIES.includes(turnPolicy), 'Unknown course turn policy.');
  const ownedTheme = boundedJSON(theme, {
    maxBytes: 65536,
    maxNodes: 1024,
    maxDepth: 8,
    maxArray: 40,
  });
  const checkedTheme = validateTheme(ownedTheme);
  ensure(checkedTheme.valid, `Invalid course theme: ${checkedTheme.errors.join('; ')}`);
  ensure(
    ownedTheme.id === 'fpv' && ownedTheme.family === 'fpv',
    'The course requires the FPV theme.',
  );
  const scenario = {
    format: SCENARIO_VERSION,
    level: levelFor(lesson),
    theme: ownedTheme,
    visualOverrides: {},
    settings: { classId: 'scout', turnPolicy, seed: 1 },
    classRecipes: structuredClone(recipes),
  };
  const checked = validateScenario(scenario);
  ensure(checked.valid, `Invalid course scenario: ${checked.errors.join('; ')}`);
  return scenario;
}

const FACT_VERSION = 'first-flight-facts.v1';
const MAX_TICK = 30 * 60 * 120;
const factsBrand = new WeakSet();
const eventFields = {
  'cut.closed': ['cells'],
  'cells.claimed': ['indices'],
  'objective.captured': ['id'],
  'player.failed': ['cause', 'lives'],
  'player.respawned': [],
  'run.completed': ['status'],
};
const indices = (value, label) => {
  ensure(
    Array.isArray(value) &&
      value.length <= 1728 &&
      value.every((i) => integer(i, 0, 1727)) &&
      new Set(value).size === value.length,
    `Invalid ${label} cell set.`,
  );
  return [...value].sort((a, b) => a - b);
};
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const sameData = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const frame = ({ events: _events, ...value }) => value;

function checkFacts(source, captured = false) {
  if (factsBrand.has(source)) return source;
  // The capture path constructs every container itself; imported/plain caller facts
  // still cross the strict accessor-free bounded copy boundary.
  const f = captured
    ? source
    : boundedJSON(source, {
        maxBytes: 160 * 1024,
        maxNodes: 6500,
        maxDepth: 5,
        maxArray: 1728,
        maxString: 180,
      });
  keys(
    f,
    [
      'version',
      'setup',
      'tick',
      'time',
      'status',
      'lives',
      'player',
      'trail',
      'cells',
      'enemies',
      'objectives',
      'events',
    ],
    'Lesson facts',
  );
  keys(
    f.setup,
    [
      'lessonId',
      'runId',
      'levelIdentity',
      'ruleset',
      'seed',
      'turnPolicy',
      'classId',
      'classRevision',
      'loadoutHash',
      'rosterHash',
    ],
    'Lesson setup',
  );
  const context = contexts.get(f.setup.lessonId);
  ensure(context && runIdentifier(f.setup.runId), 'Invalid lesson attempt identity.');
  ensure(
    f.version === FACT_VERSION &&
      f.setup.levelIdentity === context.identity &&
      f.setup.ruleset === RULESET &&
      f.setup.seed === 1 &&
      TURN_POLICIES.includes(f.setup.turnPolicy) &&
      f.setup.classId === 'scout' &&
      f.setup.classRevision === scout.revision &&
      f.setup.loadoutHash === expectedLoadout &&
      f.setup.rosterHash === expectedRoster,
    'Lesson setup does not match the trusted scenario.',
  );
  ensure(
    integer(f.tick, 0, MAX_TICK) &&
      Number.isFinite(f.time) &&
      f.time >= 0 &&
      f.time <= MAX_TICK / 120 &&
      f.time <= f.tick / 120 + 1e-7 &&
      f.time >= (f.tick - 1) / 120 - 1e-7,
    'Invalid lesson tick/time.',
  );
  ensure(
    ['running', 'respawning', 'won', 'lost'].includes(f.status) &&
      integer(f.lives, 0, 3) &&
      (f.status === 'lost') === (f.lives === 0),
    'Invalid lesson status/lives.',
  );
  keys(f.player, ['x', 'y', 'cutting'], 'Lesson player');
  ensure(
    Number.isFinite(f.player.x) &&
      f.player.x >= 0 &&
      f.player.x < 48 &&
      Number.isFinite(f.player.y) &&
      f.player.y >= 0 &&
      f.player.y < 36 &&
      typeof f.player.cutting === 'boolean',
    'Invalid lesson player.',
  );
  ensure(
    Array.isArray(f.cells) &&
      f.cells.length === 1728 &&
      f.cells.every(
        (c, i) =>
          c === CELL.SAFE || (c === CELL.FIELD && i % 48 > 0 && i % 48 < 47 && i >= 48 && i < 1680),
      ),
    'Invalid lesson ownership grid.',
  );
  f.trail = indices(f.trail, 'trail');
  ensure(
    f.trail.every((i) => f.cells[i] === CELL.FIELD) && (f.player.cutting || f.trail.length === 0),
    'Invalid lesson live trail.',
  );
  ensure(
    Array.isArray(f.enemies) && f.enemies.length === context.level.enemies.length,
    'Invalid lesson enemies.',
  );
  f.enemies.sort((a, b) => String(a?.id).localeCompare(String(b?.id)));
  for (const e of f.enemies) {
    keys(e, ['id', 'x', 'y'], 'Lesson enemy');
    ensure(
      context.level.enemies.some((source) => source.id === e.id) &&
        Number.isFinite(e.x) &&
        e.x >= 0 &&
        e.x < 48 &&
        Number.isFinite(e.y) &&
        e.y >= 0 &&
        e.y < 36,
      'Invalid lesson enemy center.',
    );
  }
  ensure(new Set(f.enemies.map((e) => e.id)).size === f.enemies.length, 'Duplicate lesson enemy.');
  if (f.setup.lessonId !== 'picture-home')
    ensure(
      f.enemies.every((e) =>
        context.level.enemies.some((a) => a.id === e.id && a.x === e.x && a.y === e.y),
      ),
      'Stationary lesson threat moved.',
    );
  ensure(
    Array.isArray(f.objectives) && f.objectives.length === context.level.objectives.length,
    'Invalid lesson objectives.',
  );
  for (const o of f.objectives) {
    keys(o, ['id', 'x', 'y', 'captured'], 'Lesson objective');
    const authored = context.level.objectives.find((value) => value.id === o.id);
    ensure(
      authored &&
        o.x === authored.x &&
        o.y === authored.y &&
        typeof o.captured === 'boolean' &&
        (!o.captured || f.cells[Math.floor(o.y) * 48 + Math.floor(o.x)] === CELL.SAFE),
      'Invalid lesson objective state.',
    );
  }
  ensure(Array.isArray(f.events) && f.events.length <= 8, 'Invalid lesson events.');
  for (const e of f.events) {
    ensure(plainObject(e) && Object.hasOwn(eventFields, e.type), 'Unsupported lesson event.');
    keys(e, ['type', 'tick', ...eventFields[e.type]], 'Lesson event');
    ensure(e.tick === f.tick, 'Lesson event belongs to another tick.');
    if (e.type === 'cut.closed') ensure(integer(e.cells, 1, 1564), 'Invalid closed-cell count.');
    if (e.type === 'cells.claimed') e.indices = indices(e.indices, 'claimed');
    if (e.type === 'objective.captured') ensure(e.id === 'garden', 'Unknown captured objective.');
    if (e.type === 'player.failed')
      ensure(
        ['self-contact', 'enemy-trail', 'enemy-player'].includes(e.cause) && e.lives === f.lives,
        'Invalid lesson failure.',
      );
    if (e.type === 'run.completed')
      ensure(
        e.status === f.status && ['won', 'lost'].includes(f.status),
        'Invalid lesson completion.',
      );
  }
  ensure(new Set(f.events.map((e) => e.type)).size === f.events.length, 'Duplicate lesson event.');
  freeze(f);
  factsBrand.add(f);
  return f;
}

/** Owns facts from public core state. runId is host-owned and always explicit. */
export function captureLessonFacts(run, { runId } = {}) {
  ensure(runIdentifier(runId), 'A bounded host runId is required for lesson facts.');
  const lesson = FIRST_FLIGHT_LESSONS.find((value) => value.levelId === run?.levelId);
  const context = contexts.get(lesson?.id);
  ensure(
    context &&
      canonicalJSON(run.level) === context.json &&
      canonicalJSON(run.rules) === context.rules,
    'Run is not an exact trusted lesson.',
  );
  ensure(
    run.revision === context.level.revision &&
      canonicalJSON(run.classRecipe) === recipeJSON &&
      canonicalJSON(run.classRecipes) === rosterJSON &&
      run.activeClassId === 'scout' &&
      run.classHistory.length === 1 &&
      sameData(run.classHistory[0], {
        classId: 'scout',
        classRevision: scout.revision,
        loadoutHash: expectedLoadout,
        tick: 0,
      }),
    'Course loadout changed.',
  );
  return checkFacts(
    {
      version: FACT_VERSION,
      setup: {
        lessonId: lesson.id,
        runId,
        levelIdentity: context.identity,
        ruleset: run.ruleset,
        seed: run.seed,
        turnPolicy: run.turnPolicy,
        classId: run.classId,
        classRevision: run.classRevision,
        loadoutHash: run.loadoutHash,
        rosterHash: run.rosterHash,
      },
      tick: run.tick,
      time: run.time,
      status: run.status,
      lives: run.lives,
      player: { x: run.player.x, y: run.player.y, cutting: run.player.cutting },
      trail: run.trail.map((cell) => cell.index),
      cells: Array.from(run.cells),
      enemies: run.enemies.map(({ id, x, y }) => ({ id, x, y })),
      objectives: run.objectives.map(({ id, x, y, captured }) => ({ id, x, y, captured })),
      events: run.events
        .filter((e) => Object.hasOwn(eventFields, e.type))
        .map((e) => ({
          type: e.type,
          tick: e.tick,
          ...Object.fromEntries(
            eventFields[e.type].map((field) => [
              field,
              field === 'indices' ? [...e[field]] : e[field],
            ]),
          ),
        })),
    },
    true,
  );
}

const divider = Object.freeze(Array.from({ length: 34 }, (_, i) => (i + 1) * 48 + 24));
const horizontal = (row) => Array.from({ length: 23 }, (_, i) => row * 48 + i + 1);
const rectangle = (row) =>
  Array.from({ length: row * 23 }, (_, i) => (Math.floor(i / 23) + 1) * 48 + (i % 23) + 1);

/** Local guidance only: never a replay certificate, reward record or storage writer. */
export function createLessonObserver({ lessonId, runId, initial }) {
  const lesson = getFirstFlightLesson(lessonId);
  ensure(runIdentifier(runId), 'A bounded host runId is required for a lesson observer.');
  const completed = new Set();
  let previous,
    available = true,
    error = null,
    outcome = 'pending',
    cutting = false,
    territoryKept = false,
    recoveryCells = null;
  const fail = (reason) => {
    available = false;
    error = String(reason?.message ?? reason).slice(0, 240);
  };
  const snapshot = () => {
    const current =
      lesson.steps.find((step) => !completed.has(step.id))?.id ?? lesson.steps.at(-1).id;
    return {
      lessonId,
      runId,
      stepId: current,
      steps: lesson.steps.map(({ id }) => ({
        id,
        status: completed.has(id)
          ? 'complete'
          : id === current && outcome === 'pending'
            ? 'current'
            : 'pending',
      })),
      outcome,
      available,
      error,
      cutting,
      territoryKept,
    };
  };
  try {
    previous = checkFacts(initial);
    ensure(
      previous.setup.lessonId === lessonId &&
        previous.setup.runId === runId &&
        previous.tick === 0 &&
        previous.status === 'running' &&
        previous.lives === 3 &&
        previous.trail.length === 0 &&
        previous.events.length === 0 &&
        previous.player.x === 24.5 &&
        previous.player.y === 0.5 &&
        !previous.player.cutting &&
        previous.cells.filter((c) => c === CELL.FIELD).length === 1564 &&
        previous.objectives.every((o) => !o.captured) &&
        previous.enemies.every((e) =>
          contexts
            .get(lessonId)
            .level.enemies.some((a) => e.id === a.id && e.x === a.x && e.y === a.y),
        ),
      'A lesson observer requires the exact fresh attempt.',
    );
  } catch (reason) {
    fail(reason);
  }
  return {
    snapshot,
    observe(beforeSource, afterSource) {
      if (!available) return snapshot();
      try {
        const before = checkFacts(beforeSource),
          after = checkFacts(afterSource);
        ensure(
          sameData(before.setup, previous.setup) && sameData(after.setup, previous.setup),
          'Lesson attempt or setup changed.',
        );
        ensure(sameData(frame(before), frame(previous)), 'Lesson observations must be contiguous.');
        if (after.tick === before.tick) {
          ensure(sameData(frame(before), frame(after)), 'Lesson state changed without a tick.');
          return snapshot();
        }
        ensure(
          after.tick === before.tick + 1 && ['running', 'respawning'].includes(before.status),
          'Observe exactly one active fixed step.',
        );
        const changed = [];
        for (let i = 0; i < 1728; i++)
          if (before.cells[i] !== after.cells[i]) {
            ensure(
              before.cells[i] === CELL.FIELD && after.cells[i] === CELL.SAFE,
              'Secured lesson territory changed unexpectedly.',
            );
            changed.push(i);
          }
        const event = (type) => after.events.find((e) => e.type === type);
        const claimed = event('cells.claimed'),
          closed = event('cut.closed');
        ensure(
          claimed ? same(claimed.indices, changed) : changed.length === 0,
          'Claim event does not match ownership changes.',
        );
        if (closed)
          ensure(
            claimed &&
              closed.cells === changed.length &&
              before.player.cutting &&
              before.trail.length > 0 &&
              !after.player.cutting &&
              after.trail.length === 0 &&
              before.trail.every((i) => changed.includes(i)),
            'Closure does not match the live line and claimed cells.',
          );
        const failed = event('player.failed');
        ensure(
          after.lives === before.lives - (failed ? 1 : 0),
          'Life changes require an actual failure.',
        );
        if (failed) {
          ensure(
            before.status === 'running' &&
              ['respawning', 'lost'].includes(after.status) &&
              changed.length === 0 &&
              after.trail.length === 0 &&
              !after.player.cutting,
            'Invalid lesson failure transaction.',
          );
          recoveryCells = after.status === 'respawning' ? after.cells : null;
          territoryKept =
            recoveryCells !== null && before.cells.filter((c) => c === CELL.SAFE).length > 164;
        }
        if (event('player.respawned')) {
          ensure(
            before.status === 'respawning' && after.status === 'running',
            'Invalid lesson recovery.',
          );
          if (
            recoveryCells &&
            same(recoveryCells, after.cells) &&
            recoveryCells.filter((c) => c === CELL.SAFE).length > 164
          )
            territoryKept = true;
          recoveryCells = null;
        }
        if (event('objective.captured'))
          ensure(
            !before.objectives[0]?.captured &&
              after.objectives[0]?.captured &&
              changed.includes(8 * 48 + 8),
            'Garden capture lacks ownership evidence.',
          );
        if (['won', 'lost'].includes(after.status))
          ensure(event('run.completed'), 'Terminal lesson state needs its completion event.');
        if (lessonId === 'close-line' && closed && after.status === 'won')
          completed.add('close-line');
        if (lessonId === 'empty-side' && closed) {
          if (
            !completed.has('separator') &&
            same(before.trail, divider) &&
            same(changed, divider) &&
            after.enemies.every(
              (e) => after.cells[Math.floor(e.y) * 48 + Math.floor(e.x)] === CELL.FIELD,
            )
          )
            completed.add('separator');
          else if (completed.has('separator')) {
            for (let row = 16; row <= 24; row++)
              if (
                same(before.trail, horizontal(row)) &&
                same(changed, rectangle(row)) &&
                event('objective.captured') &&
                after.status === 'won'
              )
                completed.add('empty-region');
          }
        }
        if (lessonId === 'picture-home') {
          if (event('objective.captured')) completed.add('objective');
          if (after.status === 'won' && after.objectives[0]?.captured) completed.add('picture');
        }
        if (['won', 'lost'].includes(after.status)) {
          ensure(event('run.completed'), 'Terminal lesson state needs its completion event.');
          outcome =
            after.status === 'lost'
              ? 'lost'
              : lesson.steps.every((step) => completed.has(step.id))
                ? 'complete'
                : 'missed';
        }
        cutting = after.player.cutting;
        previous = after;
      } catch (reason) {
        fail(reason);
      }
      return snapshot();
    },
  };
}
