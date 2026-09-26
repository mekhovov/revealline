import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  snapshotReplay,
  MAX_REPLAY_BYTES,
  MAX_REPLAY_TICKS,
} from '../replay.mjs';
import {
  REPLAY_PRESENTATION_FORMAT,
  REPLAY_PRESENTATION_METADATA_BYTES,
  MAX_REPLAY_PRESENTATION_BYTES,
  exportReplayPresentation,
  snapshotReplayPresentation,
} from '../replay-presentation.mjs';
import { ACTOR_APPEARANCE_PIN_BYTES } from '../presentation/actor-appearance-pin.mjs';

const bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
function fixture({ wide = false, finished = false } = {}) {
  const level = {
      version: wide ? 'xonix-level.v3' : 'xonix-level.v1',
      id: 'presentation-replay',
      revision: '1',
      width: wide ? 72 : 48,
      height: 36,
      ...(wide ? { encounter: null } : {}),
      spawn: { x: 24.5, y: 0.5 },
      goal: { coverage: 0.4 },
      enemies: [],
    },
    options = { seed: 1, turnPolicy: 'immediate', classId: 'scout' },
    run = createRun(level, options),
    recorder = createRecorder(level, options, 'presentation-envelope-test');
  for (let i = 0; i < (finished ? 1000 : 12) && run.status === 'running'; i++) {
    const input = { direction: 'down' };
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
  }
  if (finished) assert.equal(run.status, 'won');
  return {
    execution: { campaignKey: 'campaign/1/exact-execution-key', sourcePackId: null },
    actorAppearancePin: {
      format: 'revealline-actor-appearance-pin.v1',
      style: 'fpv',
      rendererPolicy: 'actor-style.v1',
      content: {
        editionId: 'field-kit',
        contentThemeId: 'fpv',
        mode: 'solo',
        owner: { kind: 'campaign', baseCampaignKey: 'campaign/1/authored-key' },
        level: { id: level.id, revision: level.revision, sha256: 'a'.repeat(64) },
      },
      presentation: {
        source: { id: 'field-kit', revision: 62 },
        theme: { id: 'fpv', revision: 62 },
        collection: null,
        sha256: 'b'.repeat(64),
      },
    },
    replay: exportReplay(recorder, run),
  };
}
const envelope = (source = fixture()) => ({ format: REPLAY_PRESENTATION_FORMAT, ...source });
test('replay export never executes a nested authored-receipt accessor while selecting its version', () => {
  const source = fixture();
  let calls = 0;
  Object.defineProperty(source.actorAppearancePin, 'authoredPresentationSha256', {
    enumerable: true,
    get() {
      calls++;
      return 'a'.repeat(64);
    },
  });
  assert.throws(() => exportReplayPresentation(source));
  assert.equal(calls, 0);
});

for (const wide of [false, true])
  for (const finished of [false, true])
    test(`${wide ? 'wide' : 'legacy'} ${finished ? 'finished' : 'unfinished'} raw replay stays unchanged inside the envelope`, () => {
      const source = fixture({ wide, finished }),
        raw = JSON.stringify(source.replay),
        wrapped = exportReplayPresentation(source),
        imported = snapshotReplayPresentation(JSON.stringify(wrapped));
      assert.equal(JSON.stringify(wrapped.replay), raw);
      assert.equal(JSON.stringify(source.replay), raw);
      assert.deepEqual(imported, wrapped);
      assert.equal(verifyReplay(imported.replay).match, true);
      assert.deepEqual(imported.replay.checkpoint, source.replay.checkpoint);
      assert.equal(imported.actorAppearancePin.presentation.source.revision, 62);
      assert.notEqual(
        imported.execution.campaignKey,
        imported.actorAppearancePin.content.owner.baseCampaignKey,
      );
    });

test('owned snapshot is deeply immutable and does not freeze or retain caller data', () => {
  const source = fixture(),
    wrapped = exportReplayPresentation(source);
  const check = (value) => {
    if (!value || typeof value !== 'object') return;
    assert(Object.isFrozen(value));
    Object.values(value).forEach(check);
  };
  check(wrapped);
  source.execution.campaignKey = 'changed';
  source.actorAppearancePin.presentation.source.revision++;
  source.replay.options.classRecipes[0].cooldown++;
  assert.equal(wrapped.execution.campaignKey, 'campaign/1/exact-execution-key');
  assert.equal(wrapped.actorAppearancePin.presentation.source.revision, 62);
  assert.notEqual(
    wrapped.replay.options.classRecipes[0].cooldown,
    source.replay.options.classRecipes[0].cooldown,
  );
  assert.throws(() => {
    wrapped.replay.segments[0].ticks++;
  }, TypeError);
});

test('metadata preserves explicit pack ID, never infers it from an uploaded pin', () => {
  const source = fixture();
  source.execution.sourcePackId = 'trusted-chapter';
  const wrapped = exportReplayPresentation(source);
  assert.equal(wrapped.execution.sourcePackId, 'trusted-chapter');
  // A parser accepts a well-formed declaration, not its claimed authority.
  source.actorAppearancePin.content.level.sha256 = 'c'.repeat(64);
  source.actorAppearancePin.presentation.sha256 = 'd'.repeat(64);
  assert.equal(
    exportReplayPresentation(source).actorAppearancePin.presentation.sha256,
    'd'.repeat(64),
  );
});

test('raw documents retain their existing parser and are not silently wrapped', () => {
  const raw = fixture().replay;
  assert.deepEqual(snapshotReplay(raw), raw);
  assert.throws(() => snapshotReplayPresentation(raw), /unsupported or missing fields/);
  assert.throws(() => snapshotReplay(envelope()), /replay version|document fields/);
});

test('semantic inner validation delegates level/options, input, ticks and checkpoint checks', () => {
  for (const mutate of [
    (r) => {
      r.level.width = 0;
    },
    (r) => {
      r.options.turnPolicy = 'unregistered';
    },
    (r) => {
      r.segments[0].input.direction = 'diagonal';
    },
    (r) => {
      r.ticks++;
    },
    (r) => {
      r.ticks = MAX_REPLAY_TICKS + 1;
    },
    (r) => {
      r.checkpoint.hash = '0'.repeat(16);
    },
    (r) => {
      r.ruleset = 'xonix-core.v999';
    },
  ]) {
    const source = fixture();
    mutate(source.replay);
    assert.throws(() => exportReplayPresentation(source));
  }
});

test('parsing does not claim that validly shaped inputs reproduce the recorded outcome', () => {
  const source = fixture();
  source.replay.segments[0].input.direction = 'right';
  const wrapped = exportReplayPresentation(source);
  assert.equal(verifyReplay(wrapped.replay).match, false, 'The normal verifier remains mandatory.');
});

test('v1 requires Solo FPV actors and complete closed execution metadata', () => {
  for (const mutate of [
    (s) => {
      s.actorAppearancePin.style = 'campaign';
      s.actorAppearancePin.presentation = null;
    },
    (s) => {
      s.actorAppearancePin.content.mode = 'versus';
    },
    (s) => {
      delete s.execution.sourcePackId;
    },
    (s) => {
      s.execution.sourcePackId = '../injected';
    },
    (s) => {
      s.execution.campaignKey = '';
    },
    (s) => {
      s.execution.campaignKey = ' '.repeat(20);
    },
    (s) => {
      s.execution.extra = true;
    },
    (s) => {
      s.actorAppearancePin.extra = true;
    },
  ]) {
    const source = fixture();
    mutate(source);
    assert.throws(() => exportReplayPresentation(source));
  }
});

test('unknown envelope fields, malformed JSON and nested JSON strings are rejected', () => {
  for (const source of [
    '{',
    { ...envelope(), image: 'data:image/png;base64,AAAA' },
    { ...envelope(), format: 'revealline-replay-presentation.v2' },
    { ...envelope(), execution: JSON.stringify(fixture().execution) },
    { ...envelope(), actorAppearancePin: JSON.stringify(fixture().actorAppearancePin) },
    { ...envelope(), replay: JSON.stringify(fixture().replay) },
    Object.create(envelope()),
  ])
    assert.throws(() => snapshotReplayPresentation(source));
  assert.throws(() =>
    exportReplayPresentation({ ...fixture(), format: REPLAY_PRESENTATION_FORMAT }),
  );
});

test('object accessors, hidden fields, symbols and toJSON never execute', () => {
  let reads = 0;
  for (const path of [
    [],
    ['execution'],
    ['actorAppearancePin'],
    ['replay'],
    ['replay', 'options'],
  ]) {
    const source = envelope();
    const target = path.reduce((value, key) => value[key], source);
    const field = Object.keys(target)[0];
    Object.defineProperty(target, field, {
      enumerable: true,
      get() {
        reads++;
        throw new Error('getter executed');
      },
    });
    assert.throws(() => snapshotReplayPresentation(source), /accessors/);
  }
  for (const descriptor of [
    { value: true, enumerable: false },
    {
      value() {
        reads++;
        return {};
      },
      enumerable: true,
    },
  ]) {
    const source = envelope();
    Object.defineProperty(source, 'toJSON', descriptor);
    assert.throws(() => snapshotReplayPresentation(source));
  }
  const symbolic = envelope();
  symbolic[Symbol('hidden')] = true;
  assert.throws(() => snapshotReplayPresentation(symbolic));
  const hostileExport = fixture();
  Object.defineProperty(hostileExport, 'replay', {
    enumerable: true,
    get() {
      reads++;
    },
  });
  assert.throws(() => exportReplayPresentation(hostileExport), /accessors/);
  assert.equal(reads, 0);
});

test('metadata and existing actor pin retain their own small bounds', () => {
  assert.equal(
    MAX_REPLAY_PRESENTATION_BYTES,
    MAX_REPLAY_BYTES + ACTOR_APPEARANCE_PIN_BYTES + REPLAY_PRESENTATION_METADATA_BYTES,
  );
  const metadata = fixture();
  metadata.execution.campaignKey = 'x'.repeat(REPLAY_PRESENTATION_METADATA_BYTES + 1);
  assert.throws(() => exportReplayPresentation(metadata), /budget/);
  const actor = fixture();
  actor.actorAppearancePin.extra = 'x'.repeat(ACTOR_APPEARANCE_PIN_BYTES + 1);
  assert.throws(() => exportReplayPresentation(actor), /budget/);
});

test('a 32 MiB oversized inner replay cannot borrow the outer metadata allowance', () => {
  const source = fixture();
  source.replay.summary.padding = Array(128).fill('x'.repeat(262000));
  const remainder = MAX_REPLAY_BYTES + 1 - bytes(source.replay) - 3;
  assert(remainder > 0 && remainder < 262144);
  source.replay.summary.padding.push('x'.repeat(remainder));
  assert.equal(bytes(source.replay), MAX_REPLAY_BYTES + 1);
  assert(bytes(envelope(source)) < MAX_REPLAY_PRESENTATION_BYTES);
  assert.throws(() => snapshotReplayPresentation(envelope(source)), /32 MiB|size budget/);
});

test('aggregate source bytes are bounded before JSON parsing', () => {
  const source = ' '.repeat(MAX_REPLAY_PRESENTATION_BYTES + 1);
  assert.throws(() => snapshotReplayPresentation(source), /aggregate byte budget/);
});
