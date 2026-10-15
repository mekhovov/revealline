import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  FIRST_FLIGHT_PROTOCOL,
  FIRST_FLIGHT_CASES,
  validateFirstFlightPlan,
  parseFirstFlightHUD,
  hasFirstFlightMotion,
  assertFirstFlightReset,
  observePracticeFirstFlight,
} from './observe-practice-first-flight.mjs';

const plan = () => ({
  format: 'revealline-practice-first-flight-plan.v1',
  protocol: FIRST_FLIGHT_PROTOCOL.id,
  caseId: 'unit-fixture',
  deviceLabel: 'No device evidence',
  quietWindow: 'Unit tests only',
  cases: FIRST_FLIGHT_CASES.map((row) => row.id),
  bundle: '.',
  envelopeSha256: 'a'.repeat(64),
  sourceRevision: 'b'.repeat(40),
  sourceTree: 'c'.repeat(40),
  packageRevision: 'd'.repeat(64),
});

test('requires exact artifact binding and complete declared EN four-case matrix', () => {
  assert.equal(validateFirstFlightPlan(plan()).cases.length, 4);
  for (const patch of [
    { cases: ['en-gym'] },
    { cases: [...plan().cases].reverse() },
    { sourceRevision: 'latest' },
    { envelopeSha256: 'latest' },
    { packageRevision: '' },
    { format: 'other' },
    { password: 'never-in-plan' },
  ])
    assert.throws(() => validateFirstFlightPlan({ ...plan(), ...patch }));
});

test('public HUD parsing ignores elapsed time for Worlds and includes Gym position', () => {
  assert.deepEqual(
    parseFirstFlightHUD('civilian-flight', 'Position 2.0, -1.5 m · Height 0.25 m · Heading 90°'),
    { x: 2, z: -1.5, height: 0.25, heading: 90 },
  );
  assert.deepEqual(parseFirstFlightHUD('civilian-fpv', 'Altitude 0.2 m · Speed 1.1 m/s'), {
    height: 0.2,
    speed: 1.1,
  });
  assert.deepEqual(parseFirstFlightHUD('fpv-worlds', '0.0 m · 0 m/s · 99.0 s · 100%'), {
    height: 0,
    speed: 0,
  });
  assert.throws(() => parseFirstFlightHUD('civilian-fpv', 'Loading'));
  assert.throws(() => parseFirstFlightHUD('civilian-flight', '0.1 m'));
});

test('time/throttle/speed alone never count as altitude movement; fixed threshold tolerates floating rounding', () => {
  assert.equal(hasFirstFlightMotion({ height: 0 }, { height: 0, speed: 100, time: 999 }), false);
  assert.equal(hasFirstFlightMotion({ height: 0 }, { height: 0.19 }), false);
  assert.equal(hasFirstFlightMotion({ height: 0.1 }, { height: 0.3 }), true);
});

test('retry must restore launch height, position and zero FPV speed', () => {
  assertFirstFlightReset({ height: 0, speed: 0 }, { height: 0, speed: 0 });
  assert.throws(() => assertFirstFlightReset({ height: 0 }, { height: 0.2, speed: 0 }));
  assert.throws(() => assertFirstFlightReset({ height: 0 }, { height: 0, speed: 1 }));
  assert.throws(() => assertFirstFlightReset({ height: 0, x: 2, z: 3 }, { height: 0, x: 3, z: 3 }));
});

test('adapters correspond to native public source controls and keyboard mappings', async () => {
  const read = (name) => readFile(new URL('../' + name, import.meta.url), 'utf8');
  const shell = await read('game/ui/mode-play-shell.mjs');
  assert.match(shell, /root\.dataset\.modePlayShell = idPrefix/);
  assert.match(shell, /'restart'.*activate\('retry'\).*'pause-restart'/);
  assert.match(shell, /put\(root\.dataset, 'phase', state\.phase\)/);
  const gym = await read('optional-practice/civilian-flight/input.mjs');
  assert.match(gym, /KeyR: \['throttle', 1\]/);
  const input = await read('optional-practice/civilian-fpv/input.mjs');
  assert.match(input, /throttle: Object\.freeze\(\['KeyS', 'KeyW'\]\)/);
  const academy = await read('optional-practice/civilian-fpv/app.mjs');
  assert.match(academy, /gameplay: \[settingLabel\('mode'\)/);
  assert.match(academy, /dataset\.flightState = state\.status/);
  const worlds = await read('optional-practice/civilian-fpv/world-app.mjs');
  assert.match(worlds, /start: \(\) => \$\('hero-fly'\)\.click\(\)/);
  assert.match(worlds, /catalogue\.find\(\(e\) => e\.legacy && !complete\.has\(keyOf\(e\)\)\)/);
  assert.match(worlds, /dataset\.flightState = state\.status/);
});

test('bad frozen envelope fails before browser launch and retains honest receipt', async () => {
  const work = await mkdtemp(path.join(tmpdir(), 'first-flight-unit-'));
  try {
    await writeFile(path.join(work, 'plan.json'), JSON.stringify(plan()));
    await writeFile(path.join(work, 'optional-packages.json'), '{}');
    const output = path.join(work, 'evidence');
    const report = await observePracticeFirstFlight({
      planFile: path.join(work, 'plan.json'),
      playwrightModule: '/does-not-exist',
      output,
    });
    assert.equal(report.completed, false);
    assert.equal(report.qualified, false);
    assert.equal(report.cases.length, 0);
    assert.equal(report.cleanup.completed, true);
    assert.match(report.failure, /Envelope differs/);
    assert.equal(
      JSON.parse(await readFile(path.join(output, 'observation.json'))).completed,
      false,
    );
    await assert.rejects(
      observePracticeFirstFlight({
        planFile: path.join(work, 'plan.json'),
        playwrightModule: '/does-not-exist',
        output,
      }),
      /EEXIST/,
    );
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});
