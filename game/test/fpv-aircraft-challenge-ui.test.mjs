import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { mountAircraftChallengeControls } from '../../optional-practice/civilian-fpv/aircraft-challenge-ui.mjs';
import { createAircraftChallengeProgress } from '../../optional-practice/civilian-fpv/aircraft-challenge.mjs';
const settle = () => new Promise((resolve) => setImmediate(resolve));
function fixture(t) {
  const doc = new Document(),
    parents = [doc.createElement('div'), doc.createElement('div')],
    statusParent = doc.createElement('div'),
    restarted = [];
  doc.body.append(...parents, statusParent);
  let locale = 'en',
    currentRules = null,
    state = { aircraftRadiusMm: 50 },
    present = true,
    failure = null;
  const session = { snapshot: () => state, challengeRules: () => currentRules };
  const ui = mountAircraftChallengeControls({
    parents,
    statusParent,
    locale: () => locale,
    getSession: () => (present ? session : null),
    async onRestart(rules) {
      if (failure) throw new Error(failure);
      restarted.push(rules);
      currentRules = rules;
      state = { aircraftRadiusMm: 50 };
      if (rules)
        state.challenge = createAircraftChallengeProgress(rules, { capacityAh: 0.45 }).snapshot();
      ui.update(state);
    },
  });
  t.after(() => ui.dispose());
  return {
    doc,
    ui,
    restarted,
    statusParent,
    control: (name, panel = 0) =>
      parents[panel].querySelector(`[data-aircraft-challenge="${name}"]`),
    locale(value) {
      locale = value;
      ui.update(state);
    },
    present(value) {
      present = value;
      ui.update(state);
    },
    state(value) {
      state = value;
      ui.update(state);
    },
    failure(value) {
      failure = value;
    },
    get stateValue() {
      return state;
    },
  };
}

test('shared challenge selectors default to unlimited and apply only through an explicit new attempt', async (t) => {
  const f = fixture(t);
  assert.equal(f.control('kind').value, 'none');
  assert.equal(f.control('duration').parentNode.hidden, true);
  assert.equal(f.statusParent.children[0].hidden, true);
  f.control('kind').value = 'timed-practice';
  f.control('kind').emit('change');
  f.control('duration').value = '30';
  f.control('duration').emit('input');
  assert.equal(f.restarted.length, 0);
  assert.equal(f.control('kind', 1).value, 'timed-practice');
  assert.equal(f.control('duration', 1).value, '30');
  f.control('restart', 1).click();
  assert.equal(f.control('restart').disabled, true);
  await settle();
  assert.equal(f.restarted[0].durationTicks, 1500);
  assert.equal(f.control('restart').disabled, false);
  assert.match(f.statusParent.textContent, /0:00 \/ 0:30/);
  f.control('kind').value = 'none';
  f.control('kind').emit('change');
  assert.match(f.statusParent.textContent, /0:00 \/ 0:30/, 'draft does not change active rules');
  f.control('restart').click();
  await settle();
  assert.equal(f.restarted[1], null);
  assert.equal(f.statusParent.children[0].hidden, true);
});

test('challenge duration errors do not restart, endurance is explicit, and EN/UK result labels stay unscored', async (t) => {
  const f = fixture(t);
  f.control('kind').value = 'timed-practice';
  f.control('kind').emit('change');
  for (const bad of ['0', '30.5', '3601', '']) {
    f.control('duration').value = bad;
    f.control('duration').emit('input');
    f.control('restart').click();
    await settle();
    assert.equal(f.restarted.length, 0);
    assert.match(f.ui.roots[0].textContent, /whole number/);
  }
  f.control('kind').value = 'battery-endurance';
  f.control('kind').emit('change');
  f.control('restart').click();
  await settle();
  assert.equal(f.restarted[0].kind, 'battery-endurance');
  assert.match(f.ui.roots[0].textContent, /Waiting for takeoff/);
  assert.match(f.ui.roots[0].textContent, /not measured real-aircraft endurance/);
  f.locale('uk');
  assert.match(f.ui.roots[0].textContent, /Очікування зльоту/);
  assert.match(f.ui.roots[0].textContent, /Розряджання|розряджання/);
  const state = structuredClone(f.stateValue);
  state.challenge.result = {
    reason: 'battery-empty',
    missionTick: 1,
    elapsedTicks: 0,
    airborneTicks: 0,
  };
  f.state(state);
  assert.match(f.statusParent.textContent, /Батарея порожня/);
  assert.match(f.statusParent.textContent, /без заліку/);
  f.locale('en');
  assert.match(f.statusParent.textContent, /Continue flying or restart/);
  assert.equal(f.statusParent.querySelector('output').getAttribute('aria-live'), 'off');
});

test('unavailable sessions hide controls and asynchronous failures remain visible without applying rules', async (t) => {
  const f = fixture(t);
  f.present(false);
  assert.ok(f.ui.roots.every((root) => root.hidden));
  f.control('restart').click();
  await settle();
  assert.equal(f.restarted.length, 0);
  f.present(true);
  f.failure('Preparation failed');
  f.control('restart').click();
  await settle();
  assert.match(f.ui.roots[0].textContent, /Preparation failed/);
  assert.equal(f.restarted.length, 0);
  assert.equal(f.control('restart').disabled, false);
  f.ui.dispose();
  assert.equal(f.statusParent.children.length, 0);
});
