import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTeamContextualTeaching,
  TEAM_CONTEXTUAL_TEACHING_FORMAT,
} from '../couch/team-contextual-teaching.mjs';

class Storage {
  constructor(entries = {}) {
    this.entries = new Map(Object.entries(entries));
  }
  getItem(key) {
    return this.entries.get(key) ?? null;
  }
  setItem(key, value) {
    this.entries.set(key, value);
  }
}

const guidance = {
  groundName: 'reclaimed ground',
  supportText:
    'Tap Support to slow nearby enemies and intercept nearby sparks. Hold Support beside a downed partner.',
  supportBySeat: ['Support · slows nearby enemies', 'Support · slows nearby enemies'],
};

test('Team teaching introduces a cut, then relevant Support and rescue without repeating on Retry', () => {
  const storage = new Storage();
  const first = createTeamContextualTeaching({ getStorage: () => storage });
  assert.deepEqual(first.opening(guidance), {
    kind: 'cut',
    text: 'FIRST CUT · Steer off reclaimed ground, then return to reclaimed ground to bank the line.',
  });
  assert.equal(
    first.opening(guidance),
    null,
    'Retry in this visit does not repeat the first-cut cue.',
  );
  assert.deepEqual(first.observe([{ type: 'cut.closed' }], guidance), {
    kind: 'support',
    text: 'SUPPORT READY · Tap Support near a moving threat or travelling spark.',
  });
  assert.equal(first.observe([{ type: 'cut.closed' }], guidance), null);
  assert.deepEqual(first.observe([{ type: 'player.downed', player: 0 }], guidance), {
    kind: 'rescue',
    text: 'RESCUE · Move together on reclaimed ground; the active partner holds Support nearby for one second.',
  });
  assert.equal(first.observe([{ type: 'player.downed', player: 1 }], guidance), null);
  first.observe(
    [
      { type: 'support.pulse', player: 0 },
      { type: 'rescue.completed', player: 0 },
    ],
    guidance,
  );
  assert.deepEqual(first.snapshot(), {
    introduced: ['cut', 'support', 'rescue'],
    completed: ['cut', 'support', 'rescue'],
  });

  const nextVisit = createTeamContextualTeaching({ getStorage: () => storage });
  assert.equal(nextVisit.opening(guidance), null);
  assert.equal(nextVisit.observe([{ type: 'cut.closed' }], guidance), null);
  assert.equal(nextVisit.observe([{ type: 'player.downed' }], guidance), null);
});

test('completion in the same step suppresses an obsolete teaching prompt', () => {
  const teacher = createTeamContextualTeaching({ getStorage: () => new Storage() });
  teacher.opening(guidance);
  assert.equal(
    teacher.observe([{ type: 'cut.closed' }, { type: 'support.pulse', player: 0 }], guidance),
    null,
  );
  assert.equal(
    teacher.observe(
      [
        { type: 'player.downed', player: 0 },
        { type: 'rescue.completed', player: 1 },
      ],
      guidance,
    ),
    null,
  );
});

test('Team teaching skips an irrelevant Support prompt but still teaches rescue', () => {
  const teacher = createTeamContextualTeaching({
    getStorage: () => new Storage(),
  });
  const calm = {
    groundName: 'safe ground',
    supportText: 'Hold Support on safe ground beside a downed partner for one second.',
    supportBySeat: ['Support · rescue', 'Support · rescue'],
  };
  assert.match(teacher.opening(calm).text, /safe ground/);
  assert.equal(teacher.observe([{ type: 'cut.joint' }], calm), null);
  assert.match(teacher.observe([{ type: 'player.downed' }], calm).text, /safe ground/);
});

test('Team teaching tolerates unavailable, corrupt and failing storage with bounded state', () => {
  const warnings = [];
  const unavailable = createTeamContextualTeaching({
    getStorage() {
      throw new Error('blocked');
    },
    onWarning: (message) => warnings.push(message),
  });
  assert.equal(unavailable.opening(guidance)?.kind, 'cut');
  assert.equal(unavailable.opening(guidance), null);
  assert.match(warnings[0], /stays on this page.*blocked/);

  const key = 'custom';
  const corrupt = new Storage({ [key]: '{bad' });
  const recovered = createTeamContextualTeaching({
    getStorage: () => corrupt,
    key,
    onWarning: (message) => warnings.push(message),
  });
  assert.equal(recovered.opening(guidance)?.kind, 'cut');
  assert.match(warnings.at(-1), /stays on this page/);

  const stored = JSON.parse(corrupt.getItem(key));
  assert.equal(stored.format, TEAM_CONTEXTUAL_TEACHING_FORMAT);
  assert.deepEqual(stored.introduced, ['cut']);
});

test('Team teaching validates callbacks and event input', () => {
  assert.throws(() => createTeamContextualTeaching({ getStorage: null }), /callbacks/);
  const teacher = createTeamContextualTeaching({ getStorage: () => null });
  assert.throws(() => teacher.observe(null, guidance), /event list/);
});
