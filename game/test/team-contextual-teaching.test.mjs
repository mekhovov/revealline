import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTeamContextualTeaching,
  TEAM_CONTEXTUAL_TEACHING_FORMAT,
} from '../couch/team-contextual-teaching.mjs';

class Storage {
  constructor(entries = {}) {
    this.entries = new Map(Object.entries(entries));
    this.failWrites = false;
  }
  getItem(key) {
    return this.entries.get(key) ?? null;
  }
  setItem(key, value) {
    if (this.failWrites) throw new Error('write blocked');
    this.entries.set(key, value);
  }
}

const calm = Object.freeze({
  ground: 'safe',
  supportCapabilities: [],
  supportRoles: ['hybrid', 'hybrid'],
});
const pressure = Object.freeze({
  ground: 'reclaimed',
  supportCapabilities: ['slow', 'intercept'],
  supportRoles: ['interceptor', 'disruptor'],
});

test('semantic capabilities select translatable device-neutral cues without localized parsing', () => {
  const teacher = createTeamContextualTeaching({ getStorage: () => new Storage() });
  assert.deepEqual(teacher.opening(pressure), {
    kind: 'cut',
    key: 'gameplay:team.teachingCut',
    values: { context: 'reclaimed' },
  });
  assert.deepEqual(teacher.observe([{ type: 'cut.closed' }], pressure), {
    kind: 'support',
    key: 'gameplay:team.teachingSupportSpecialists',
    values: { interceptor: 1, disruptor: 2 },
  });
  assert.deepEqual(teacher.snapshot(), {
    active: 'support',
    pending: ['support'],
    acknowledged: [],
    completed: ['cut'],
  });
});

test('Retry retains an unfinished cue; only success or acknowledgement dismisses it', () => {
  const storage = new Storage();
  const teacher = createTeamContextualTeaching({ getStorage: () => storage });
  const first = teacher.opening(pressure);
  assert.deepEqual(teacher.opening(pressure), first, 'a fresh attempt retains the unfinished cue');
  teacher.observe([{ type: 'cut.joint' }], pressure);
  assert.equal(teacher.active().kind, 'support');
  assert.equal(
    teacher.observe(
      [{ type: 'support.pulse', slowedEnemies: [], interceptedImpacts: [] }],
      pressure,
    ).kind,
    'support',
    'an empty pulse is not demonstrated success',
  );
  assert.equal(
    teacher.observe(
      [{ type: 'support.pulse', slowedEnemies: ['hunter'], interceptedImpacts: [] }],
      pressure,
    ),
    null,
  );
  assert.deepEqual(teacher.snapshot().completed, ['cut', 'support']);

  teacher.observe([{ type: 'player.downed', player: 0 }], pressure);
  assert.equal(teacher.active().kind, 'rescue');
  teacher.acknowledge('rescue');
  assert.equal(teacher.active(), null);
  const nextVisit = createTeamContextualTeaching({ getStorage: () => storage });
  assert.equal(nextVisit.opening(pressure), null);
  nextVisit.observe([{ type: 'player.downed', player: 1 }], pressure);
  assert.equal(nextVisit.active(), null, 'explicit acknowledgement persists');
});

test('rescue preempts Support and demonstrated rescue restores the still-pending skill', () => {
  const teacher = createTeamContextualTeaching({ getStorage: () => new Storage() });
  teacher.opening(pressure);
  teacher.observe([{ type: 'cut.closed' }], pressure);
  teacher.observe([{ type: 'player.downed', player: 0 }], pressure);
  assert.equal(teacher.active().kind, 'rescue');
  assert.equal(
    teacher.observe([{ type: 'rescue.completed', player: 1 }], pressure).kind,
    'support',
  );
  assert.deepEqual(teacher.snapshot().completed, ['cut', 'rescue']);
});

test('calm arenas never invent a Support lesson and safe-ground copy remains semantic', () => {
  const teacher = createTeamContextualTeaching({ getStorage: () => new Storage() });
  assert.deepEqual(teacher.opening(calm).values, { context: undefined });
  assert.equal(teacher.observe([{ type: 'cut.closed' }], calm), null);
  assert.deepEqual(teacher.observe([{ type: 'player.downed' }], calm), {
    kind: 'rescue',
    key: 'gameplay:team.teachingRescue',
    values: { context: undefined },
  });
});

test('a setup change hides pending Support where no target exists and restores it in a relevant arena', () => {
  const teacher = createTeamContextualTeaching({ getStorage: () => new Storage() });
  teacher.opening(pressure);
  assert.equal(teacher.observe([{ type: 'cut.closed' }], pressure).kind, 'support');

  assert.equal(teacher.opening(calm), null, 'calm setup has no valid Support lesson');
  assert.deepEqual(teacher.snapshot(), {
    active: null,
    pending: ['support'],
    acknowledged: [],
    completed: ['cut'],
  });

  assert.equal(
    teacher.opening(pressure).kind,
    'support',
    'the unfinished lesson returns when Support has a valid target',
  );
});

test('unavailable, corrupt and failed storage retain bounded in-memory teaching', () => {
  const warnings = [];
  const unavailable = createTeamContextualTeaching({
    getStorage() {
      throw new Error('read blocked');
    },
    onWarning: (message) => warnings.push(message),
  });
  assert.equal(unavailable.opening(calm).kind, 'cut');
  assert.match(warnings[0], /stays on this page.*read blocked/);

  const key = 'custom';
  const corrupt = new Storage({ [key]: '{bad' });
  const recovered = createTeamContextualTeaching({
    getStorage: () => corrupt,
    key,
    onWarning: (message) => warnings.push(message),
  });
  recovered.opening(calm);
  recovered.acknowledge('cut');
  assert.equal(JSON.parse(corrupt.getItem(key)).format, TEAM_CONTEXTUAL_TEACHING_FORMAT);

  corrupt.failWrites = true;
  recovered.observe([{ type: 'player.downed' }], calm);
  recovered.acknowledge('rescue');
  assert.match(warnings.at(-1), /stays on this page.*write blocked/);
  assert.deepEqual(recovered.snapshot().acknowledged, ['cut', 'rescue']);
});

test('invalid callbacks and event lists fail closed', () => {
  assert.throws(() => createTeamContextualTeaching({ getStorage: null }), /callbacks/);
  const teacher = createTeamContextualTeaching({ getStorage: () => null });
  assert.throws(() => teacher.observe(null, calm), /event list/);
  assert.equal(teacher.acknowledge('__proto__'), null);
});
