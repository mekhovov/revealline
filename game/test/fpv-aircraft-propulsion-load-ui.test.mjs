import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { mountPropulsionEvidencePanel } from '../../optional-practice/civilian-fpv/propulsion-evidence-ui.mjs';
import {
  PROPULSION_EVIDENCE_FIELDS,
  createSyntheticPropulsionEvidence,
} from '../../optional-practice/civilian-fpv/propulsion-evidence.mjs';

const settle = () => new Promise((resolve) => setImmediate(resolve));
const empty = () => Object.fromEntries(PROPULSION_EVIDENCE_FIELDS.map((field) => [field, null]));
// Invented I(V) = V oracle, never supplied as a built-in aircraft or UI dataset.
function evidence(volts = [1, 3, 5]) {
  const source = createSyntheticPropulsionEvidence();
  source.name = 'Synthetic voltage sweep';
  source.domain = {
    kind: 'one-dimensional-path',
    axis: 'voltage',
    intervals: [[volts[0], volts.at(-1)]],
  };
  source.samples = volts.map((voltage) => ({
    values: { ...empty(), command: 0.5, voltage, current: voltage, airspeed: 0 },
    uncertainty: empty(),
  }));
  return source;
}
function fixture(t) {
  const document = new Document();
  let language = 'en';
  const aircraft = Object.freeze({ battery: Object.freeze({ fullVoltage: 99, resistance: 42 }) });
  const ui = mountPropulsionEvidencePanel({
    parent: document.body,
    locale: () => language,
    getAircraft: () => aircraft,
  });
  t.after(() => ui.dispose());
  const action = (name) => ui.root.querySelector(`[data-action="load-${name}"]`);
  const role = (name) => ui.root.querySelector(`[data-role="load-${name}"]`);
  const input = (name, value) => {
    action(name).value = String(value);
    action(name).emit('input');
  };
  const acknowledge = (value = true) => {
    action('current-basis').checked = value;
    action('current-basis').emit('change');
  };
  const manual = () => {
    input('open-voltage', 5);
    input('resistance', 1);
    acknowledge();
  };
  const calculate = ui.root.querySelector('[data-action="calculate-load"]');
  const values = () =>
    Object.fromEntries(
      [...role('values').children].reduce(
        (pairs, node, i, all) =>
          i % 2 ? pairs : [...pairs, [node.textContent, all[i + 1].textContent]],
        [],
      ),
    );
  return {
    ui,
    action,
    role,
    input,
    acknowledge,
    manual,
    calculate,
    values,
    locale(value) {
      language = value;
      ui.refresh();
    },
  };
}

test('load calculation starts empty and never reinterprets the built-in command-axis example', (t) => {
  const f = fixture(t);
  for (const field of ['open-voltage', 'resistance', 'current-limit'])
    assert.equal(f.action(field).value, '');
  assert.equal(f.action('copies').value, '1');
  assert.equal(f.action('current-basis').checked, false);
  f.ui.root.querySelector('[data-action="synthetic-demo"]').click();
  assert.equal(f.calculate.disabled, true);
  assert.match(f.role('status').textContent, /voltage-axis dataset.*cannot be reinterpreted/);
  f.manual();
  f.calculate.emit('click');
  assert.deepEqual(f.values(), {});
});

test('explicit inputs and DC acknowledgment calculate an independent circuit oracle without auto-applying', (t) => {
  const f = fixture(t),
    source = evidence(),
    before = JSON.stringify(source);
  assert.equal(f.ui.importEvidence(source), true);
  f.input('open-voltage', 5);
  f.input('resistance', 1);
  f.calculate.click();
  assert.match(f.role('status').textContent, /Confirm the source current basis/);
  assert.equal(f.role('status').getAttribute('role'), 'alert');
  f.acknowledge();
  assert.deepEqual(f.values(), {}, 'Acknowledgment alone does not calculate');
  f.calculate.click();
  assert.match(f.role('status').textContent, /Calculated operating point/);
  assert.match(f.role('source').textContent, /synthetic source data, invented values/);
  const values = f.values();
  assert.equal(values['Terminal voltage (V)'], '2.5'); // V + 1 × V = 5.
  assert.equal(values['Total DC input current (A)'], '2.5');
  assert.equal(values['Power at open-circuit voltage (W)'], '12.5');
  assert.equal(values['Power delivered to loads (W)'], '6.25');
  assert.equal(values['Series-resistance loss (W)'], '6.25');
  assert.equal(values['Equation residual V + R × I − open voltage (V)'], '0');
  assert.equal(values['Thrust per identical path (N)'], 'Unavailable');
  assert.equal(values['Shaft torque per identical path (N·m)'], 'Unavailable');
  assert.match(
    f.role('limits').textContent,
    /central values only.*declaration.*unverified.*not propagated/,
  );
  assert.equal(JSON.stringify(source), before);
  f.input('resistance', 0);
  assert.deepEqual(f.values(), {}, 'Edits immediately discard the previous operating point');
  f.calculate.click();
  assert.equal(f.values()['Terminal voltage (V)'], '5');
  assert.equal(f.values()['Series-resistance loss (W)'], '0');
});

test('identical independent copies sum current, preserve per-path channels and only flag a threshold', (t) => {
  const f = fixture(t);
  f.ui.importEvidence(evidence());
  f.manual();
  f.input('copies', 4);
  f.input('resistance', 0.25);
  f.input('current-limit', 9);
  f.calculate.click();
  assert.match(f.role('status').textContent, /threshold exceeded.*not clipped or regulated/);
  assert.match(f.role('source').textContent, /identical independent copies: 4/);
  assert.equal(f.values()['Terminal voltage (V)'], '2.5'); // V + 0.25 × 4V = 5.
  assert.equal(f.values()['Total DC input current (A)'], '10');
  assert.equal(f.values()['Current per identical path (A)'], '2.5');
  assert.equal(f.values()['Power at open-circuit voltage (W)'], '50');
  assert.equal(f.values()['Power delivered to loads (W)'], '25');
  assert.equal(f.values()['Series-resistance loss (W)'], '25');
  f.input('current-limit', '');
  f.calculate.click();
  assert.match(f.role('status').textContent, /Calculated operating point/);
  assert.equal(f.values()['Total DC input current (A)'], '10');
});

test('invalid manual values clear results, including missing, nonfinite, negative and noninteger values', (t) => {
  const f = fixture(t);
  f.ui.importEvidence(evidence());
  for (const [name, value] of [
    ['open-voltage', ''],
    ['open-voltage', 'NaN'],
    ['open-voltage', 1001],
    ['resistance', 'Infinity'],
    ['resistance', -1],
    ['resistance', ''],
    ['copies', 0],
    ['copies', 1.5],
    ['copies', 5],
    ['copies', ''],
    ['current-limit', -1],
    ['current-limit', 40001],
  ]) {
    f.manual();
    f.input('copies', 1);
    f.input('current-limit', '');
    f.calculate.click();
    assert.ok(Object.keys(f.values()).length > 0);
    f.input(name, value);
    f.calculate.click();
    assert.deepEqual(f.values(), {}, `${name}=${value}`);
    assert.equal(f.role('status').getAttribute('role'), 'alert');
  }
});

test('unsupported source conditions and uncovered roots retain explicit localized unavailable reasons', (t) => {
  const f = fixture(t);
  const cases = [
    [(s) => (s.conditions.scope = 'whole-aircraft'), /one rotor/, /один ротор/],
    [(s) => (s.conditions.flow = 'axial'), /Static-air/, /нерухомого повітря/],
    [(s) => (s.samples[1].values.airspeed = null), /known zero airspeed/, /нульову швидкість/],
    [(s) => (s.samples[1].values.command = null), /include the ESC command/, /містити команду ESC/],
    [(s) => (s.samples[1].values.command = 0.8), /command must stay constant/, /має бути сталою/],
    [(s) => (s.samples[1].values.current = null), /Current is required/, /Струм потрібен/],
    [(s) => (s.samples[0].values.current = -1), /Negative current/, /Від’ємний струм/],
    [(s) => (s.samples[2].values.current = 2), /must not decrease/, /не має зменшуватися/],
    [
      (s) =>
        (s.domain.intervals = [
          [1, 1],
          [3, 5],
        ]),
      /gap in the source/,
      /розрив даних/,
    ],
  ];
  for (const [change, english, ukrainian] of cases) {
    const source = evidence();
    change(source);
    assert.equal(f.ui.importEvidence(source), true);
    f.locale('en');
    f.manual();
    f.calculate.click();
    assert.match(f.role('status').textContent, english);
    assert.deepEqual(f.values(), {});
    f.locale('uk');
    assert.match(f.role('status').textContent, ukrainian);
  }
  f.locale('en');
  f.ui.importEvidence(evidence());
  f.manual();
  for (const [voltage, expected] of [
    [0, /below documented/],
    [20, /above documented/],
  ]) {
    f.input('open-voltage', voltage);
    f.calculate.click();
    assert.match(f.role('status').textContent, expected);
  }
  const steep = evidence([1, 1 + Number.EPSILON]);
  steep.samples[0].values.current = 0;
  steep.samples[1].values.current = 10000;
  f.ui.importEvidence(steep);
  f.manual();
  f.input('open-voltage', 2);
  f.input('resistance', 1000);
  f.calculate.click();
  assert.match(f.role('status').textContent, /precision cannot resolve/);
  assert.deepEqual(f.values(), {});
});

test('accepted replacement resets the source declaration; invalid and superseded imports preserve the active calculation', async (t) => {
  const f = fixture(t);
  f.ui.importEvidence(evidence());
  f.manual();
  f.calculate.click();
  const before = f.values();
  assert.equal(f.ui.importEvidence('{bad'), false);
  assert.deepEqual(f.values(), before);
  assert.equal(f.action('current-basis').checked, true);
  const imported = evidence();
  imported.name = '<img src=x> second source';
  imported.source.kind = 'calculated';
  f.ui.importEvidence(imported);
  assert.equal(f.action('current-basis').checked, false);
  assert.deepEqual(f.values(), {});
  f.manual();
  f.calculate.click();
  assert.match(f.role('source').textContent, /<img src=x> second source.*calculated source data/);
  assert.equal(f.ui.root.querySelectorAll('img').length, 0);
  let resolveRead;
  const file = f.ui.root.querySelector('[data-action="import-file"]');
  file.files = [
    {
      size: 10,
      text: () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
    },
  ];
  file.emit('change');
  f.ui.importEvidence(evidence());
  f.manual();
  f.calculate.click();
  resolveRead(JSON.stringify(imported));
  await settle();
  assert.match(f.role('source').textContent, /^Synthetic voltage sweep/);
  assert.deepEqual(f.values(), before);
  f.ui.dispose();
  assert.equal(f.calculate.listeners.get('click').size, 0);
  assert.equal(f.action('resistance').listeners.get('input').size, 0);
  f.calculate.emit('click');
  assert.deepEqual(f.values(), before);
});

test('EN/UK refresh preserves manual inputs and the calculated result with labeled keyboard controls', (t) => {
  const f = fixture(t);
  f.ui.importEvidence(evidence());
  f.manual();
  f.calculate.click();
  f.locale('uk');
  assert.equal(f.action('open-voltage').value, '5');
  assert.equal(f.action('resistance').value, '1');
  assert.equal(f.action('current-basis').checked, true);
  assert.equal(f.calculate.textContent, 'Розрахувати навантаження');
  assert.match(f.role('status').textContent, /Розрахована робоча точка/);
  assert.equal(f.values()['Напруга на клемах (V)'], '2.5');
  assert.match(f.role('source').textContent, /синтетичні дані джерела, вигадані/);
  assert.equal(f.role('status').getAttribute('aria-live'), 'polite');
  for (const field of ['open-voltage', 'resistance', 'copies', 'current-limit', 'current-basis']) {
    assert.equal(f.action(field).parentNode.tagName, 'LABEL');
    assert.ok(f.action(field).parentNode.textContent.length > 0);
    assert.equal(f.action(field).tabIndex, 0);
  }
  f.locale('en');
  assert.equal(f.values()['Terminal voltage (V)'], '2.5');
});
