import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { attachControllerReading } from '../ui/controller-reading.mjs';
import { createRun, stepRun, releaseInputs, FIXED_DT, getSummary } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

class Element {
  constructor(id) {
    this.id = id;
    this.listeners = new Map();
    this.attributes = new Map();
    this.disabled = false;
    this.hidden = false;
    this.open = true;
    this.textContent = '';
    this.scrolled = [];
  }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }
  emit(type) {
    for (const listener of [...(this.listeners.get(type) || [])]) listener({ target: this });
  }
  click() {
    if (!this.disabled) this.emit('click');
  }
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
  scrollIntoView(options) {
    this.scrolled.push(options);
  }
  set innerHTML(_value) {
    throw new Error('Reading hints must be safe DOM text.');
  }
}
function fixture(t, initialScope = 'paused', overrides = {}) {
  const ids = [
    'overlay-reading',
    'overlay-read',
    'overlay-reading-done',
    'overlay-reading-hint',
    'overlay-reading-unit',
    'mission-brief-reading',
    'mission-brief-read',
    'mission-brief-reading-done',
    'mission-brief-reading-hint',
    'mission-brief-unit',
    'mission-brief',
  ];
  const elements = new Map(ids.map((id) => [id, new Element(id)])),
    calls = [];
  const doc = { getElementById: (id) => elements.get(id) };
  let state = null,
    scope = initialScope,
    rejectEntry = false,
    transition = () => {};
  let labels = { confirm: 'Right bumper', back: 'West' };
  let reading;
  const navigation = {
    beginReading(value) {
      assert.equal(value.exit, elements.get(`${value.region.id}-done`));
      calls.push(['begin', value.region.id, value.origin.id, value.label]);
      if (rejectEntry) return false;
      state = { regionId: value.region.id, label: value.label };
      reading.changed(state);
      return true;
    },
    readingState: () => state && { ...state },
    endReading(options) {
      calls.push(['end', options]);
      const wasActive = !!state;
      if (state) {
        state = null;
        reading.changed(null);
      }
      return wasActive;
    },
  };
  reading = attachControllerReading({
    document: doc,
    getNavigation: () => navigation,
    getControlLabels: () => labels,
    getScope: () => scope,
    pause: (force) => {
      calls.push(['pause', force]);
      scope = 'paused';
    },
    onTransition: () => {
      calls.push(['transition', state?.regionId || null]);
      transition();
    },
    ...overrides,
  });
  t.after(() => reading.destroy());
  return {
    reading,
    navigation,
    calls,
    elements,
    $: (id) => elements.get(id),
    setScope: (value) => {
      scope = value;
    },
    rejectEntry: () => {
      rejectEntry = true;
    },
    setLabels: (value) => {
      labels = value;
    },
    onTransition: (callback) => {
      transition = callback;
    },
  };
}

test('two finite toolbars keep Done stable, show mapped labels and retain the return origin', (t) => {
  const f = fixture(t);
  assert.equal(f.$('overlay-reading-done').disabled, true);
  assert.equal(f.$('mission-brief-reading-done').disabled, true);
  f.$('overlay-read').click();
  assert.deepEqual(f.calls[0], ['begin', 'overlay-reading', 'overlay-read', 'Mission details']);
  assert.equal(f.$('overlay-read').disabled, false);
  assert.equal(f.$('overlay-reading-done').disabled, false);
  assert.equal(f.$('overlay-reading-done').hidden, false);
  assert.equal(f.$('mission-brief-reading-done').disabled, true);
  assert.match(f.$('overlay-reading-hint').textContent, /Right bumper or West returns/);
  f.setLabels({ confirm: 'Triangle', back: 'Circle' });
  f.reading.refresh();
  assert.match(f.$('overlay-reading-hint').textContent, /Triangle or Circle returns/);
  assert.deepEqual(f.$('overlay-reading-unit').scrolled, [
    { block: 'nearest', inline: 'nearest', behavior: 'instant' },
  ]);
});

test('optional reading prompt uses the same measured scrollability without replacing Done or transitions', (t) => {
  const f = fixture(t, 'paused', {
    getReadingPrompt: ({ scrollable }) =>
      `${scrollable ? 'Scroll to read' : 'All text is visible'} · Done reading returns`,
  });
  const region = f.$('overlay-reading'),
    done = f.$('overlay-reading-done');
  region.clientHeight = 100;
  region.scrollHeight = 100;
  f.$('overlay-read').click();
  assert.match(
    f.$('overlay-reading-hint').textContent,
    /All text is visible · Done reading returns/,
  );
  const calls = [...f.calls];
  region.scrollHeight = 400;
  f.reading.refresh();
  assert.match(f.$('overlay-reading-hint').textContent, /Scroll to read · Done reading returns/);
  assert.equal(f.$('overlay-reading-done'), done);
  assert.equal(done.disabled, false);
  assert.deepEqual(f.calls, calls);
});

test('running full-brief entry pauses before beginning; overlay entry cannot start or pause flight', (t) => {
  const f = fixture(t, 'flight');
  f.$('overlay-read').click();
  assert.deepEqual(f.calls, []);
  f.$('mission-brief-read').click();
  assert.deepEqual(f.calls, [
    ['pause', true],
    ['begin', 'mission-brief-reading', 'mission-brief-read', 'Mission brief'],
    ['transition', 'mission-brief-reading'],
  ]);
  f.$('mission-brief-reading-done').click();
  assert.deepEqual(f.calls.slice(-2), [
    ['end', { restoreFocus: true }],
    ['transition', null],
  ]);
  assert.equal(f.calls.filter((call) => call[0] === 'pause').length, 1);
});

test('ready, paused, won, lost and complete entries never invoke a flight action', (t) => {
  const f = fixture(t);
  for (const scope of [
    'ready:first-signal:first',
    'paused',
    'won',
    'lost',
    'overview:first-signal',
  ]) {
    f.setScope(scope);
    for (const prefix of ['overlay', 'mission-brief']) {
      f.$(`${prefix}-read`).click();
      f.$(`${prefix}-reading-done`).click();
    }
  }
  assert.equal(f.calls.filter((call) => call[0] === 'pause').length, 0);
  assert.equal(f.calls.filter((call) => call[0] === 'begin').length, 10);
});

test('a rejected or repeated entry does not scroll the host unit or recreate reading', (t) => {
  const f = fixture(t);
  f.$('overlay-read').click();
  f.$('overlay-read').click();
  assert.equal(f.calls.filter((call) => call[0] === 'begin').length, 1);
  assert.equal(f.$('overlay-reading-unit').scrolled.length, 1);
  f.navigation.endReading({ restoreFocus: false });
  f.rejectEntry();
  f.$('overlay-read').click();
  assert.equal(f.$('overlay-reading-unit').scrolled.length, 1);
  assert.equal(f.$('overlay-reading-done').disabled, true);
});

test('late Done click after cancellation cannot re-enter or invoke another action', (t) => {
  const f = fixture(t);
  f.$('overlay-read').click();
  const done = f.$('overlay-reading-done');
  // A different native gesture may cancel reading before a queued activation.
  f.navigation.endReading({ restoreFocus: false });
  assert.equal(f.$('overlay-reading-done'), done);
  assert.equal(done.hidden, false);
  assert.equal(done.disabled, true);
  done.click();
  // A late queued activation remains harmless even if dispatched directly.
  done.emit('click');
  assert.equal(f.navigation.readingState(), null);
  assert.equal(f.calls.filter((call) => call[0] === 'begin').length, 1);
  assert.equal(f.calls.filter((call) => call[0] === 'pause').length, 0);
});

test('closing the full brief ends only its own active reader without restoring hidden focus', (t) => {
  const f = fixture(t);
  f.$('overlay-read').click();
  f.$('mission-brief').open = false;
  f.$('mission-brief').emit('toggle');
  assert.equal(f.navigation.readingState().regionId, 'overlay-reading');
  f.$('mission-brief').open = true;
  f.$('mission-brief-read').click();
  f.$('mission-brief').open = false;
  f.$('mission-brief').emit('toggle');
  assert.equal(f.navigation.readingState(), null);
  assert.deepEqual(f.calls.slice(-2), [
    ['end', { restoreFocus: false }],
    ['transition', null],
  ]);
});

test('local hints use text, do not duplicate mapped prompts, and ignore later unrelated navigation', (t) => {
  const f = fixture(t);
  f.$('overlay-read').click();
  const message = 'End of details. <img src=x> · Right bumper or West returns';
  f.reading.hint(message);
  assert.equal(f.$('overlay-reading-hint').textContent, message);
  f.$('overlay-reading-done').click();
  f.reading.hint('Choice applied.');
  assert.equal(
    f.$('overlay-reading-hint').textContent,
    'Reading ended. Choose an action when ready.',
  );
  assert.equal(f.$('mission-brief-reading-hint').textContent, 'Read without starting or resuming.');
});

test('destruction ends once and removes both finite toolbars and details event handlers', (t) => {
  const f = fixture(t);
  f.$('mission-brief-read').click();
  f.reading.destroy();
  const count = f.calls.length;
  f.$('mission-brief-read').click();
  f.$('overlay-read').click();
  f.$('mission-brief-reading-done').emit('click');
  f.$('mission-brief').emit('toggle');
  f.reading.destroy();
  assert.equal(f.calls.length, count);
  assert.equal(f.navigation.readingState(), null);
});

const pack = JSON.parse(
  await readFile(new URL('../content/packs/sentinel-relay.json', import.meta.url)),
);
const proof = JSON.parse(
  await readFile(new URL('../replays/sentinel-routes.json', import.meta.url)),
);
for (const policy of ['immediate', 'grid-center'])
  test(`reading entry/exit preserves a legal Sentinel live cut and terminal outcome: ${policy}`, (t) => {
    const f = fixture(t, 'flight'),
      route = proof.routes.find(
        (value) =>
          value.variant === 'ordinary' && value.classId === 'scout' && value.turnPolicy === policy,
      ),
      run = createRun(pack.campaigns[0].levels[0], {
        classRecipes: pack.classRecipes,
        classId: route.classId,
        turnPolicy: policy,
        seed: route.seed,
      });
    const commands = route.segments.flatMap((segment) =>
      Array.from({ length: segment.ticks }, () => segment.input),
    );
    for (const input of commands.slice(0, 610)) stepRun(run, input, FIXED_DT);
    assert.ok(run.trail.length > 0);
    const before = getSummary(run),
      expected = structuredClone(run);
    releaseInputs(expected);
    f.onTransition(() => releaseInputs(run));
    f.$('mission-brief-read').click();
    f.$('mission-brief-reading-done').click();
    assert.deepEqual(getSummary(run), before);
    assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(expected));
    for (const input of commands.slice(610)) stepRun(run, input, FIXED_DT);
    assert.deepEqual(getSummary(run), route.expected);
    const terminal = authoritativeCheckpoint(run);
    f.setScope('won');
    f.$('overlay-read').click();
    f.$('overlay-reading-done').click();
    assert.deepEqual(authoritativeCheckpoint(run), terminal);
    assert.equal(run.events.filter((event) => event.type === 'run.completed').length, 1);
  });
