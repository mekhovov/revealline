import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBrowserReadinessProbe } from './solo-qualification-readiness.mjs';
import {
  readinessAssessment,
  optionalAudioReadinessSelection,
  OPTIONAL_AUDIO_SETTINGS_FIXTURE,
  GEOMETRY_READINESS_SOURCE,
} from './solo-remote-readiness.mjs';
const protocol = 'optional-audio-start-missing-v1';

function capture(actors, { legacy = 'campaign', kind = protocol } = {}) {
  let pinReads = 0;
  const run = { tick: 0, level: { id: 'first-return' } };
  const scene = {
    lastPaint: { run, actors, actorAppearance: { style: legacy } },
    submittedRun: run,
    cadence: { snapshot: () => ({}) },
  };
  if (actors?.pin) {
    const original = actors.pin;
    actors = {
      ...actors,
      pin() {
        pinReads++;
        return original();
      },
    };
    scene.lastPaint.actors = actors;
  }
  const environment = {
    performance: { now: () => 0 },
    document: {
      body: { dataset: { flightState: 'running' } },
      hidden: false,
      hasFocus: () => true,
      addEventListener() {},
      removeEventListener() {},
    },
    addEventListener() {},
    removeEventListener() {},
  };
  const install = new Function(`return (${createBrowserReadinessProbe.toString()});`)();
  const probe = install(() => scene, environment, kind);
  probe.phase('running');
  environment.document.body.dataset.flightState = 'paused';
  const result = probe.export();
  probe.dispose();
  return { result, pinReads };
}

test('MainScene supplies a lease, while painter options are only a derived projection', async () => {
  const app = await readFile(new URL('../game/app.mjs', import.meta.url), 'utf8');
  assert.match(app, /this\.lastPaint\.actors = flightActorLease;/);
  assert.match(
    app,
    /actorAppearance: flightActorLease\s*\? \{ style: flightActorLease\.pin\(\)\.style, snapshot: flightActorLease\.snapshot \}/,
  );
  assert.doesNotMatch(app, /this\.lastPaint\.actorAppearance\s*=/);
  const actual = capture({ pin: () => ({ style: 'campaign' }) }, { legacy: 'fpv' });
  assert.equal(actual.result.records[0].actorStyle, 'campaign');
  assert.equal(actual.result.records[0].submittedRunMatches, true);
  assert.equal(actual.pinReads, 1);
});

test('missing, invalid and throwing submitted leases cannot borrow the painter-option style', () => {
  for (const actors of [
    undefined,
    null,
    {},
    { pin: () => null },
    { pin: () => ({ style: 'other' }) },
  ]) {
    const { result } = capture(actors);
    assert.equal(result.records[0].actorStyle, null);
  }
  assert.equal(capture({ pin: () => ({ style: 'fpv' }) }).result.records[0].actorStyle, 'fpv');
  const failure = capture({
    pin() {
      throw Error('retired lease');
    },
  }).result;
  assert.equal(failure.errors, 1);
  assert.deepEqual(failure.records, []);
  const ordinary = capture(
    {
      pin() {
        throw Error('must not read');
      },
    },
    { kind: 'first-running-v1' },
  );
  assert.equal(ordinary.pinReads, 0);
  assert.equal(ordinary.result.errors, 0);
  assert.equal(Object.hasOwn(ordinary.result.records[0], 'actorStyle'), false);
});

test('actual action reader admits only the exact Settings fixture optional second Close', async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL('../docs/performance/solo-optional-start-audio-e1cc-v3-plan.json', import.meta.url),
    ),
  );
  const selected = optionalAudioReadinessSelection({ ...manifest, engine: 'chromium' });
  const fixture = JSON.parse(
    await readFile(new URL('../' + selected.fixture.path, import.meta.url)),
  );
  const source = readinessAssessment.toString();
  const begin = source.indexOf('      assert.equal(raw.actions.length, fixture.actions.length);');
  const end = source.indexOf('    } else assert(raw.actions.every', begin);
  assert(begin > 0 && end > begin);
  const check = new Function(
    'assert',
    'selected',
    'fixture',
    'raw',
    'GEOMETRY_READINESS_SOURCE',
    'OPTIONAL_AUDIO_SETTINGS_FIXTURE',
    source.slice(begin, end),
  );
  const actions = fixture.actions.map((a, i) => ({
    path: String(i),
    type: a.type,
    label: a.label ?? null,
    status: i === 4 ? 'skipped-not-visible' : 'pass',
  }));
  const invoke = (s = selected, f = fixture, a = actions) =>
    check(assert, s, f, { actions: a }, GEOMETRY_READINESS_SOURCE, OPTIONAL_AUDIO_SETTINGS_FIXTURE);
  invoke();
  invoke(
    selected,
    fixture,
    actions.map((a) => ({ ...a, status: 'pass' })),
  );
  for (const change of [
    (s) => (s.protocol = 'optional-icon-missing-v1'),
    (s) => (s.source.revision = 'a'.repeat(40)),
    (s) => (s.fixture.path = 'other.fixture'),
    (s) => s.fixture.bytes++,
    (s) => (s.fixture.sha256 = '0'.repeat(64)),
  ]) {
    const s = structuredClone(selected);
    change(s);
    assert.throws(() => invoke(s));
  }
  for (const change of [
    (f) => (f.actions[4].optional = false),
    (f) => (f.actions[4].selector = '#other .dialog-close'),
    (f) => (f.actions[4].type = 'expect'),
    (f) => {
      f.actions[5] = { ...f.actions[4] };
      f.actions[4] = { type: 'expect', selector: 'body' };
    },
  ]) {
    const f = structuredClone(fixture);
    change(f);
    assert.throws(() => invoke(selected, f));
  }
  for (const index of [0, 3, 5, 6, 16]) {
    const a = structuredClone(actions);
    a[index].status = 'skipped-not-visible';
    assert.throws(() => invoke(selected, fixture, a));
  }
  const failed = structuredClone(actions);
  failed[4].status = 'failed';
  assert.throws(() => invoke(selected, fixture, failed));
  // The existing categories-specific optional route remains unchanged for its older readers.
  const old = structuredClone(fixture);
  old.actions[4].selector =
    '#settings-dialog[open][data-settings-view="categories"] button[data-close="settings-dialog"]';
  invoke({ ...selected, protocol: 'selected-font-cancel-v1' }, old);
});
