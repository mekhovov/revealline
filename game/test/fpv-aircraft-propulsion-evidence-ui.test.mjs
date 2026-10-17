import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { mountPropulsionEvidencePanel } from '../../optional-practice/civilian-fpv/propulsion-evidence-ui.mjs';
import {
  createSyntheticPropulsionEvidence,
  PROPULSION_EVIDENCE_LIMITS,
} from '../../optional-practice/civilian-fpv/propulsion-evidence.mjs';
import { createPresetConfiguration } from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { aircraftMotorPoint } from '../../optional-practice/civilian-fpv/aircraft-physics.mjs';

const settle = () => new Promise((resolve) => setImmediate(resolve));
function fixture(t) {
  const document = new Document();
  let language = 'en',
    aircraft = createPresetConfiguration('nazgul-eco-xl5-v11').aircraft;
  const ui = mountPropulsionEvidencePanel({
    parent: document.body,
    locale: () => language,
    getAircraft: () => aircraft,
  });
  t.after(() => ui.dispose());
  const action = (name) => ui.root.querySelector(`[data-action="${name}"]`);
  const role = (name) => ui.root.querySelector(`[data-role="${name}"]`);
  const query = (value) => {
    action('axis-value').value = String(value);
    action('axis-value').emit('input');
  };
  const loadFile = (file) => {
    action('import-file').files = [file];
    action('import-file').emit('change');
  };
  return {
    document,
    ui,
    action,
    role,
    query,
    loadFile,
    get aircraft() {
      return aircraft;
    },
    setAircraft(value) {
      aircraft = value;
      ui.refresh();
    },
    locale(value) {
      language = value;
      ui.refresh();
    },
  };
}
const validFile = (value) => {
  const body = JSON.stringify(value);
  return { size: new TextEncoder().encode(body).byteLength, text: async () => body };
};

test('inspection opens only on explicit input; the offline example never claims measurements or changes aircraft', (t) => {
  const f = fixture(t),
    before = JSON.stringify(f.aircraft);
  assert.equal(f.ui.root.tagName, 'DETAILS');
  assert.equal(f.ui.root.open, false);
  assert.match(f.role('import-status').textContent, /invented example/);
  assert.equal(f.role('provenance').textContent, '');
  assert.equal(f.action('import-file').accept, '.json,application/json');
  assert.equal(f.action('import-file').style.display, 'block');
  assert.equal(f.action('import-file').tabIndex, 0);
  f.action('synthetic-demo').emit('click');
  assert.match(f.role('provenance').textContent, /Synthetic example — invented values/);
  assert.equal(JSON.parse(f.action('paste-data').value).source.kind, 'synthetic');
  assert.match(f.role('import-status').textContent, /settings are unchanged/);
  assert.equal(JSON.stringify(f.aircraft), before);
  assert.equal(f.action('axis-value').type, 'number');
  assert.equal(f.action('axis-value').step, 'any');
  assert.equal(f.role('point-status').getAttribute('aria-live'), 'polite');
  assert.ok(f.ui.root.querySelectorAll('th').every((th) => ['row', 'col'].includes(th.scope)));
});

test('pasted evidence is rendered as inert text with full source, condition, missing and license information', (t) => {
  const f = fixture(t),
    source = createSyntheticPropulsionEvidence();
  source.source.kind = 'measured';
  source.source.title = '<img src=x onerror=alert(1)>';
  source.source.url = 'https://example.org/bench';
  source.source.revision = 'specific-motor-2022';
  source.source.retrievedAt = '2026-10-17';
  source.source.sha256 = 'ab'.repeat(32);
  source.source.license = { id: null, url: null, attribution: null, redistribution: 'unknown' };
  source.components.motor = 'Test motor revision A';
  source.components.esc = 'Test ESC';
  source.conditions.temperatureC = 23;
  source.conditions.notes = '<script>must stay text</script>';
  source.units.current = null;
  for (const sample of source.samples) sample.values.current = null;
  f.action('paste-data').value = JSON.stringify(source);
  f.action('import-paste').emit('click');
  assert.match(f.role('provenance').textContent, /Source declares measured component data/);
  for (const value of [
    source.source.title,
    source.source.url,
    source.source.revision,
    source.source.sha256,
    source.components.motor,
    source.conditions.notes,
  ])
    assert.ok(f.role('metadata').textContent.includes(value), value);
  assert.equal(f.ui.root.querySelectorAll('img').length, 0);
  assert.equal(f.ui.root.querySelectorAll('script').length, 0);
  assert.match(f.role('missing').textContent, /Current/);
  assert.match(f.role('power').textContent, /Electrical power: Unavailable/);
  assert.match(f.role('diagnostics').textContent, /Permission to redistribute.*not confirmed/);
});

test('evaluate exposes interpolation, energy diagnostics and disconnected coverage without extrapolation', (t) => {
  const f = fixture(t),
    source = createSyntheticPropulsionEvidence();
  source.domain.intervals = [
    [0.25, 0.5],
    [1, 1],
  ];
  source.samples[1].values.torque = 1;
  assert.equal(f.ui.importEvidence(source), true);
  f.query(0.375);
  assert.match(f.role('point-status').textContent, /Linear interpolation/);
  assert.match(f.role('diagnostics').textContent, /shaft power exceeds electrical input/);
  assert.match(f.role('uncertainty').textContent, /not zero/);
  f.query(0.75);
  assert.match(f.role('point-status').textContent, /Outside.*coverage/);
  assert.equal(f.ui.root.querySelector('tbody').children.length, 0);
  assert.match(f.role('comparison').textContent, /Comparison unavailable/);
  f.query('');
  assert.match(f.role('point-status').textContent, /Enter a finite number/);
  f.query(1);
  f.action('evaluate').emit('click');
  assert.match(f.role('point-status').textContent, /Original source sample/);
});

test('equivalent-thrust comparison uses the measured voltage and does not treat command as motor speed', (t) => {
  const f = fixture(t),
    source = createSyntheticPropulsionEvidence();
  const atSpeed = 0.35,
    voltage = 18;
  const expected = aircraftMotorPoint(f.aircraft, atSpeed, voltage);
  for (const sample of source.samples) {
    sample.values.thrust = expected.thrust;
    sample.values.voltage = voltage;
    sample.values.current = 42;
    sample.values.torque = 0.123;
  }
  const before = JSON.stringify(f.aircraft);
  f.ui.importEvidence(source);
  f.query(0.5);
  const text = f.role('comparison').textContent;
  assert.ok(text.includes(`estimated current ${Number(expected.current.toPrecision(7))} A`), text);
  assert.ok(text.includes(`estimated torque ${Number(expected.torque.toPrecision(7))} N·m`), text);
  assert.match(text, /data: 42/);
  assert.match(text, /18 V per motor/);
  const wrong = aircraftMotorPoint(f.aircraft, 0.5, voltage);
  assert.notEqual(Number(expected.current.toPrecision(7)), Number(wrong.current.toPrecision(7)));
  assert.equal(JSON.stringify(f.aircraft), before);
  assert.match(f.ui.root.textContent, /ESC command and RPM cannot be mapped/);
});

test('comparison rejects unsupported conditions, unknown voltage, unattainable thrust and old aircraft', (t) => {
  const f = fixture(t);
  const changes = [
    (s) => {
      s.conditions.scope = 'whole-aircraft';
    },
    (s) => {
      s.conditions.scope = 'unknown';
    },
    (s) => {
      s.conditions.flow = 'axial';
    },
    (s) => {
      for (const sample of s.samples) sample.values.airspeed = null;
    },
    (s) => {
      for (const sample of s.samples) sample.values.voltage = null;
    },
    (s) => {
      for (const sample of s.samples) sample.values.thrust = -1;
    },
    (s) => {
      for (const sample of s.samples) sample.values.thrust = 999;
    },
  ];
  for (const change of changes) {
    const source = createSyntheticPropulsionEvidence();
    change(source);
    assert.equal(f.ui.importEvidence(source), true);
    assert.match(f.role('comparison').textContent, /Comparison unavailable/);
  }
  f.ui.importEvidence(createSyntheticPropulsionEvidence());
  f.setAircraft({ format: 'AdvancedAircraft.v1' });
  assert.match(f.role('comparison').textContent, /no compatible active aircraft/);
});

test('invalid and oversized files retain the previously opened dataset and do not read oversized content', async (t) => {
  const f = fixture(t);
  f.action('synthetic-demo').emit('click');
  const before = f.role('provenance').textContent;
  let reads = 0;
  f.loadFile({
    size: PROPULSION_EVIDENCE_LIMITS.maxBytes + 1,
    text: () => {
      reads++;
      return '{}';
    },
  });
  await settle();
  assert.equal(reads, 0);
  assert.match(f.role('import-status').textContent, /exceeds.*limit/);
  assert.equal(f.role('import-status').getAttribute('role'), 'alert');
  assert.equal(f.role('provenance').textContent, before);
  f.loadFile({ size: 10, text: async () => '{bad json' });
  await settle();
  assert.match(f.role('import-status').textContent, /previously opened dataset is preserved/);
  assert.equal(f.role('provenance').textContent, before);
  const real = createSyntheticPropulsionEvidence();
  real.name = 'Imported file example';
  f.loadFile(validFile(real));
  await settle();
  assert.ok(f.ui.root.textContent.includes(real.name));
  assert.match(f.role('import-status').textContent, /opened for inspection/);
});

test('superseded asynchronous imports and disposal cannot adopt stale file data', async (t) => {
  const f = fixture(t);
  let resolveRead;
  const pending = new Promise((resolve) => {
    resolveRead = resolve;
  });
  f.loadFile({ size: 100, text: () => pending });
  assert.match(f.role('import-status').textContent, /Reading local file/);
  f.action('synthetic-demo').emit('click');
  const source = createSyntheticPropulsionEvidence();
  source.name = 'STALE FILE';
  resolveRead(JSON.stringify(source));
  await settle();
  assert.ok(!f.ui.root.textContent.includes('STALE FILE'));
  let rejectRead;
  const later = new Promise((_resolve, reject) => {
    rejectRead = reject;
  });
  f.loadFile({ size: 100, text: () => later });
  const file = f.action('import-file'),
    root = f.ui.root;
  f.ui.dispose();
  rejectRead(new Error('late read failure'));
  await settle();
  assert.equal(root.parentNode, null);
  assert.equal(file.listeners.get('change').size, 0);
  assert.equal(f.ui.importEvidence(source), false);
});

test('EN/UK locale refresh preserves values and source labels while localizing the controls', (t) => {
  const f = fixture(t);
  f.action('synthetic-demo').emit('click');
  f.query(0.375);
  f.locale('uk');
  assert.equal(f.action('axis-value').value, '0.375');
  assert.equal(f.action('synthetic-demo').textContent, 'Завантажити синтетичний приклад');
  assert.equal(f.action('import-paste').textContent, 'Переглянути вставлені дані');
  assert.match(f.role('provenance').textContent, /вигадані значення/);
  assert.match(f.role('point-status').textContent, /Лінійна інтерполяція/);
  assert.match(f.role('coverage').textContent, /Одновимірний/);
  assert.ok(
    f.ui.root
      .querySelectorAll('label')
      .every((label) =>
        label.children.some((child) => ['INPUT', 'TEXTAREA'].includes(child.tagName)),
      ),
  );
  f.locale('en');
  assert.match(f.role('point-status').textContent, /Linear interpolation/);
});
