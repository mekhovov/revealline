import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import {
  FIRST_FLIGHT_PROTOCOL,
  FIRST_FLIGHT_CASES,
  FIRST_FLIGHT_V2_PROTOCOL,
  FIRST_FLIGHT_V2_CASES,
  GYM_EXERCISE_PROTOCOL,
  GYM_EXERCISE_CASES,
  HUD_SETTINGS_PROTOCOL,
  HUD_SETTINGS_CASES,
  readVisibleFlightHUD,
  firstFlightArtifactPackage,
  firstFlightAuthority,
  completeFirstFlightGymExercise,
  firstFlightProtocol,
  firstFlightCases,
  firstFlightRoute,
  observeFirstFlightLocale,
  selectFirstFlightMode,
  validateFirstFlightPlan,
  parseFirstFlightHUD,
  hasFirstFlightMotion,
  assertFirstFlightReset,
  observePracticeFirstFlight,
  activateFirstFlightControl,
  returnFirstFlightHome,
  retryFirstFlight,
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

test('HUD settings protocol is a separate strict four-case bilingual matrix', () => {
  const input = {
    ...plan(),
    format: 'revealline-practice-hud-settings-plan.v1',
    protocol: HUD_SETTINGS_PROTOCOL.id,
    cases: HUD_SETTINGS_CASES.map((row) => row.id),
  };
  assert.deepEqual(validateFirstFlightPlan(input), input);
  assert.deepEqual(input.cases, [
    'en-academy-self-level-hud-settings',
    'en-worlds-self-level-hud-settings',
    'uk-academy-self-level-hud-settings',
    'uk-worlds-self-level-hud-settings',
  ]);
  assert.equal(firstFlightArtifactPackage(input), 'civilian-fpv');
  for (const patch of [
    { cases: input.cases.slice(0, 1) },
    { cases: [...input.cases].reverse() },
    { script: 'custom' },
    { protocol: FIRST_FLIGHT_V2_PROTOCOL.id },
  ])
    assert.throws(() => validateFirstFlightPlan({ ...input, ...patch }));
  assert.equal(firstFlightProtocol(input).caseMs, 90000);
});

test('maintained HUD witness requires visible localized Detailed height rather than hidden legacy telemetry', async () => {
  for (const locale of ['en', 'uk']) {
    const calls = [];
    const text = locale === 'uk' ? 'Висота 0 м · 1,2–2,4 м' : 'Height 0 m · 1.2–2.4 m';
    let visible = true,
      reading = text;
    const page = {
      locator: (selector) => {
        calls.push(selector);
        assert.equal(selector, '[data-sim-hud="flight"] [data-hud-part="details"]');
        return {
          waitFor: async ({ state }) => assert.equal(state, 'visible'),
          isVisible: async () => visible,
          innerText: async () => reading,
        };
      },
    };
    assert.equal((await readVisibleFlightHUD(page, locale)).text, text);
    visible = false;
    await assert.rejects(readVisibleFlightHUD(page, locale), /must be visible/);
    visible = true;
    for (reading of ['Height 1.2 m · 1.2–2.4 m', 'Throttle 0% · ≤ 10%', 'Loading', 'x'.repeat(513)])
      await assert.rejects(readVisibleFlightHUD(page, locale));
    assert(calls.length > 0);
  }
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

test('v2 declares exactly ten EN/UK modes, preserving v1 and its fixed budgets', () => {
  const v2 = {
    ...plan(),
    format: 'revealline-practice-first-flight-plan.v2',
    protocol: FIRST_FLIGHT_V2_PROTOCOL.id,
    cases: FIRST_FLIGHT_V2_CASES.map((c) => c.id),
  };
  assert.deepEqual(validateFirstFlightPlan(v2), v2);
  assert.equal(firstFlightCases(plan()), FIRST_FLIGHT_CASES);
  assert.equal(firstFlightCases(v2), FIRST_FLIGHT_V2_CASES);
  assert.deepEqual(
    FIRST_FLIGHT_V2_CASES.map((c) => c.id),
    [
      'en-gym',
      'en-academy-self-level',
      'en-academy-acro',
      'en-worlds-self-level',
      'en-worlds-acro',
      'uk-gym',
      'uk-academy-self-level',
      'uk-academy-acro',
      'uk-worlds-self-level',
      'uk-worlds-acro',
    ],
  );
  assert.equal(firstFlightProtocol(v2).caseMs, 90000);
  assert.equal(firstFlightProtocol(v2).overallMs, 600000);
  for (const patch of [
    { protocol: FIRST_FLIGHT_PROTOCOL.id },
    { cases: plan().cases },
    { cases: [...v2.cases].reverse() },
    { cases: [...v2.cases, 'uk-gym'] },
    { script: 'custom()' },
    { locale: 'fr' },
    { quietWindow: 'x'.repeat(2049) },
  ])
    assert.throws(() => validateFirstFlightPlan({ ...v2, ...patch }));
  assert.throws(() => validateFirstFlightPlan({ ...plan(), cases: v2.cases }));
  assert.throws(() => validateFirstFlightPlan(' '.repeat(65537)));
  assert.throws(() => firstFlightCases({ protocol: 'unknown' }));
});

test('all declared v2 launchers preserve exact locale and package destination', () => {
  for (const spec of FIRST_FLIGHT_V2_CASES) {
    const route = firstFlightRoute(spec, { origin: 'http://127.0.0.1:1234', version: 'v1.2.3' });
    assert.equal(route.locale, spec.locale);
    assert.equal(
      route.launcher,
      `http://127.0.0.1:1234/revealline/practice/${spec.package}/app/?action=play&lang=${spec.locale}`,
    );
    assert.equal(
      route.expected,
      `http://127.0.0.1:1234/revealline/practice/${spec.package}/releases/v1.2.3/site/optional-practice/${spec.package}/index.html`,
    );
  }
  assert.equal(
    firstFlightRoute(FIRST_FLIGHT_CASES[0], { origin: 'http://127.0.0.1', version: 'v1.2.3' })
      .locale,
    'en',
  );
  assert.throws(() =>
    firstFlightRoute(
      { ...FIRST_FLIGHT_V2_CASES[0], locale: 'fr' },
      { origin: 'http://127.0.0.1', version: 'v1.2.3' },
    ),
  );
});

test('Gym exercise is a distinct strict EN/UK assisted protocol with Gym artifact and extra authority', () => {
  const exercise = {
    ...plan(),
    format: 'revealline-practice-gym-exercise-plan.v1',
    protocol: GYM_EXERCISE_PROTOCOL.id,
    cases: GYM_EXERCISE_CASES.map((c) => c.id),
  };
  assert.deepEqual(validateFirstFlightPlan(exercise), exercise);
  assert.deepEqual(exercise.cases, ['en-gym-lift-and-land', 'uk-gym-lift-and-land']);
  assert(
    GYM_EXERCISE_CASES.every(
      (c) =>
        c.mode === 'assisted' && c.package === 'civilian-flight' && c.exercise === 'lift-and-land',
    ),
  );
  assert.equal(firstFlightArtifactPackage(exercise), 'civilian-flight');
  assert.equal(firstFlightArtifactPackage(plan()), 'civilian-fpv');
  assert.equal(
    firstFlightArtifactPackage({ protocol: FIRST_FLIGHT_V2_PROTOCOL.id }),
    'civilian-fpv',
  );
  assert.deepEqual(firstFlightAuthority(exercise).slice(-2), [
    'scripts/practice-exercise-ui.mjs',
    'scripts/practice-exercise-replay.mjs',
  ]);
  assert.equal(firstFlightAuthority(plan()).length, 8);
  for (const patch of [
    { protocol: FIRST_FLIGHT_V2_PROTOCOL.id },
    { cases: ['en-gym-lift-and-land'] },
    { cases: [...exercise.cases].reverse() },
    { cases: ['en-gym'] },
    { exercise: 'another' },
    { runCaseOverride: 'injected' },
    { module: './custom.mjs' },
  ])
    assert.throws(() => validateFirstFlightPlan({ ...exercise, ...patch }));
});

test('Gym exercise integration captures completion before export, exclusively saves actual text and requires independent frozen replay', async () => {
  // Scripted DOM/model commands below are unit fixtures, never browser evidence.
  const { createPractice } = await import('../optional-practice/civilian-flight/model.mjs');
  const { CIVILIAN_PRACTICE_CATALOGUE } = await import(
    '../optional-practice/civilian-flight/catalogue.mjs'
  );
  const { GYM_REPLAY_INPUTS } = await import('./practice-exercise-replay.mjs');
  const model = createPractice(CIVILIAN_PRACTICE_CATALOGUE, 'lift-and-land');
  model.start();
  const commands = [
    [1, 20],
    [0, 20],
    [-1, 20],
    [0, 19],
  ].map(([throttle, ticks]) => {
    const input = { pitch: 0, roll: 0, throttle, yaw: 0 };
    for (let i = 0; i < ticks; i++) model.step(input);
    return { input, ticks };
  });
  const json = JSON.stringify({
    format: 'revealline-practice-transcript.v1',
    catalogueIdentity: model.identity,
    drillId: 'lift-and-land',
    commands,
  });
  const files = new Map(
    await Promise.all(
      GYM_REPLAY_INPUTS.map(async (name) => [
        name,
        name === 'game/i18n/catalogs.mjs'
          ? Buffer.from(
              '// Selected optional-practice validator and settings messages.\nglobalThis.RevealLineTranslations={"en":{},"uk":{}};\n',
            )
          : await readFile(new URL('../' + name, import.meta.url)),
      ]),
    ),
  );
  const work = await mkdtemp(path.join(tmpdir(), 'gym-exercise-integration-unit-'));
  try {
    const spec = GYM_EXERCISE_CASES[0],
      events = [],
      result = { actions: [], errors: [], passed: false };
    let sample = 0;
    const page = {
      keyboard: { up: async () => {}, down: async () => {} },
      evaluate: async () => {
        const [height, checkpoint] = [
          [0, 0],
          [1, 1],
          [0, 2],
        ][Math.min(sample++, 2)];
        return {
          locale: 'en',
          drill: 'lift-and-land',
          visible: true,
          focused: true,
          readout: `Position 10, 16 m · Height ${height} m · Heading 0°`,
          status: `${checkpoint === 2 ? 'Practice route complete' : 'Practising'} · Checkpoints ${checkpoint}/2`,
          phase: checkpoint === 2 ? 'results' : 'playing',
          verified: checkpoint === 2,
        };
      },
      screenshot: async () => {
        events.push('screenshot');
        return Buffer.from('unit-image-not-browser-evidence');
      },
      locator: (selector) => ({
        click: async () => events.push('focus arena'),
        waitFor: async () => {},
        press: async () => events.push(selector),
        inputValue: async () => json,
        locator: () => ({ getAttribute: async () => '' }),
        getByRole: (role, { name }) => {
          assert.equal(selector, '.continuous-result-actions');
          assert.equal(role, 'button');
          assert(name.test('Home'));
          return { waitFor: async () => {}, press: async () => events.push('results Home') };
        },
      }),
    };
    await completeFirstFlightGymExercise(page, spec, result, work, files);
    assert.equal(events[0], 'focus arena');
    assert(events.indexOf('screenshot') < events.indexOf('results Home'));
    assert(events.indexOf('results Home') < events.indexOf('#gym-shell-action-settings'));
    assert(events.indexOf('screenshot') < events.indexOf('#export-trace'));
    assert.equal(result.passed, true);
    assert.equal(result.independentReplayVerified, true);
    assert.equal(result.exercise.cleanup.released, true);
    assert.deepEqual(result.completionScreenshot, result.screenshot);
    assert.equal(result.exercise.independentReplay.snapshot.status, 'complete');
    assert.equal(result.exercise.transcript.json, undefined);
    const saved = await readFile(path.join(work, result.exercise.transcript.exportedFile.path));
    assert.equal(saved.toString(), json);
    assert.equal(
      createHash('sha256').update(saved).digest('hex'),
      result.exercise.transcript.exportedFile.sha256,
    );
    sample = 0;
    const repeat = { errors: [], passed: false };
    await assert.rejects(completeFirstFlightGymExercise(page, spec, repeat, work, files), /EEXIST/);
    assert.equal(repeat.passed, false);
    assert.equal(
      (await readFile(path.join(work, result.exercise.transcript.exportedFile.path))).toString(),
      json,
    );
    const badOutput = path.join(work, 'bad-replay');
    await (await import('node:fs/promises')).mkdir(badOutput);
    sample = 0;
    const bad = { errors: [], passed: false };
    await assert.rejects(
      completeFirstFlightGymExercise(page, spec, bad, badOutput, new Map()),
      /Missing replay dependency/,
    );
    assert.equal(bad.passed, false);
    assert.equal(bad.independentReplayVerified, false);
    assert.equal(bad.exercise.transcript.independentReplayVerified, false);
    assert.equal(
      (await readFile(path.join(badOutput, bad.exercise.transcript.exportedFile.path))).toString(),
      json,
    );
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test('strict localized HUD parser follows actual dot-decimal copy, not unrelated numbers', () => {
  for (const [locale, gym, fpv] of [
    ['en', 'Position -2.0, 1.5 m · Height 0.25 m · Heading 90°', 'Height 0.2 m · Speed 1.1 m/s'],
    ['uk', 'Положення -2.0, 1.5 m · Висота 0.25 m · Курс 90°', 'Висота 0.2 m · Швидкість 1.1 m/s'],
  ]) {
    assert.deepEqual(parseFirstFlightHUD('civilian-flight', gym, locale), {
      x: -2,
      z: 1.5,
      height: 0.25,
      heading: 90,
    });
    assert.deepEqual(parseFirstFlightHUD('civilian-fpv', fpv, locale), { height: 0.2, speed: 1.1 });
    assert.deepEqual(parseFirstFlightHUD('fpv-worlds', '0.2 m · 1 m/s · 99.0 s · ♥ 100', locale), {
      height: 0.2,
      speed: 1,
    });
    assert.throws(() => parseFirstFlightHUD('civilian-fpv', fpv, locale === 'en' ? 'uk' : 'en'));
  }
  for (const text of [
    '0.2 m · 99.0 s',
    'Time 99 · Height 0.2 m · Speed 1 m/s',
    'Висота 0,2 m · Швидкість 1,1 m/s',
    'Height NaN m · Speed 1 m/s',
    'Height 0.2 m · Speed 1 m/s extra',
  ])
    assert.throws(() => parseFirstFlightHUD('civilian-fpv', text, 'en'));
  assert.throws(() => parseFirstFlightHUD('unknown', '0.2 m · 1 m/s · 1 s', 'uk'));
});

test('v2 observes actual document and public Settings locale, not just query parameters', async () => {
  for (const locale of ['en', 'uk']) {
    const spec = FIRST_FLIGHT_V2_CASES.find((c) => c.locale === locale);
    const page = (lang, label) => ({
      locator: (selector) =>
        selector === 'html'
          ? { getAttribute: async () => lang }
          : { waitFor: async () => {}, innerText: async () => label },
    });
    const label = locale === 'uk' ? 'Налаштування' : 'Settings';
    assert.deepEqual(await observeFirstFlightLocale(page(locale, label), spec), {
      documentLanguage: locale,
      settingsLabel: label,
    });
    await assert.rejects(observeFirstFlightLocale(page(locale, 'wrong'), spec));
    await assert.rejects(observeFirstFlightLocale(page('fr', label), spec));
  }
});

test('v2 uses visible native Retry action with maintained Ukrainian label', async () => {
  const spec = FIRST_FLIGHT_V2_CASES.find((c) => c.id === 'uk-worlds-acro'),
    result = { actions: [] },
    calls = [];
  await retryFirstFlight(
    {
      locator: (selector) => {
        assert.equal(selector, '#worlds-shell-pause-dialog[open] [data-practice-action="retry"]');
        return {
          waitFor: async (o) => calls.push(o.state),
          isEnabled: async () => true,
          innerText: async () => 'Ще раз',
          getAttribute: async () => 'retry',
          press: async (key) => calls.push(key),
        };
      },
    },
    spec,
    result,
  );
  assert.deepEqual(calls, ['visible', 'Enter']);
});

test('v2 selects both FPV modes through visible Gameplay and closes the actual Settings dialog', async () => {
  for (const spec of FIRST_FLIGHT_V2_CASES.filter((c) => c.mode)) {
    let open = false,
      mode;
    const calls = [],
      selector = spec.package === 'civilian-fpv' ? '#mode' : '#flight-mode';
    const page = {
      waitForFunction: async () => {},
      locator: (target) => ({
        waitFor: async () => {},
        isVisible: async () => true,
        getAttribute: async () => {
          if (spec.package === 'fpv-worlds' && target.endsWith('-settings-dialog')) return null;
          return target === '#sim-settings' || target.endsWith('-settings-dialog')
            ? open
              ? ''
              : null
            : '';
        },
        press: async () => {
          calls.push(target);
          if (target.endsWith('-action-settings')) open = true;
          if (target.endsWith('-settings-back') || target === '#close-sim-settings') open = false;
        },
        selectOption: async (value) => {
          assert.equal(target, selector);
          assert(open);
          mode = value;
        },
        inputValue: async () => mode,
      }),
    };
    await selectFirstFlightMode(page, spec, { actions: [] });
    assert.equal(mode, spec.mode);
    assert.equal(open, false);
    assert(calls.some((c) => c.endsWith('-settings-tab-gameplay')));
  }
});

test('Worlds v2 closes the real custom modal before accepting the already-open background Home', async () => {
  for (const required of [1, 2]) {
    let presses = 0;
    const result = { actions: [] };
    const page = {
      waitForFunction: async () => {},
      locator: (selector) => {
        if (selector === '#sim-settings')
          return { getAttribute: async () => (presses < required ? '' : null) };
        if (selector === '#worlds-shell-settings-dialog') return { getAttribute: async () => null };
        if (selector === '#worlds-shell-home-dialog') return { getAttribute: async () => '' };
        if (selector === '#worlds-shell-action-primary')
          return {
            isVisible: async () => true,
            waitFor: async () =>
              assert.equal(presses, required, 'Underlying Home cannot bypass the custom modal.'),
          };
        assert.equal(selector, '#close-sim-settings');
        return {
          isVisible: async () => presses < required,
          waitFor: async () => assert(presses < required),
          press: async () => {
            assert(presses < required);
            presses++;
          },
        };
      },
    };
    await returnFirstFlightHome(
      page,
      FIRST_FLIGHT_V2_CASES.find((c) => c.id === 'uk-worlds-acro'),
      result,
    );
    assert.equal(presses, required);
    assert(result.actions.every((action) => action.selector === '#close-sim-settings'));
  }
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

test('Pause uses an ordinary pointer click rather than a focus-and-Enter toggle', async () => {
  const calls = [];
  const target = {
    waitFor: async () => {},
    click: async (...args) => calls.push(['click', ...args]),
    press: async (...args) => calls.push(['press', ...args]),
  };
  const result = { actions: [] };
  await activateFirstFlightControl(
    { locator: () => target, waitForFunction: async () => {} },
    '#gym-shell-action-pause',
    result,
    'pointer',
  );
  assert.deepEqual(calls, [['click']]); // No force option, hidden control or focus preconditioning.
  assert.match(result.actions[0].action, /pointer/);
});

test('settings Back follows the visible stack and never presses a hidden second Back', async () => {
  for (const required of [1, 2]) {
    let presses = 0;
    const primary = {
      // Home stays laid out behind the modal throughout; this must not be used
      // as a shortcut for native top-layer dialog ownership.
      isVisible: async () => true,
      waitFor: async () => assert.equal(presses, required),
    };
    const back = {
      isVisible: async () => presses < required,
      waitFor: async () => assert(presses < required),
      press: async () => {
        assert(presses < required);
        presses++;
      },
    };
    await returnFirstFlightHome(
      {
        locator: (selector) =>
          selector.endsWith('-primary')
            ? primary
            : selector.endsWith('-settings-dialog')
              ? { getAttribute: async () => (presses < required ? '' : null) }
              : selector.endsWith('-home-dialog')
                ? { getAttribute: async () => '' }
                : back,
        waitForFunction: async () => {},
      },
      { shell: 'academy-shell' },
      { actions: [] },
    );
    assert.equal(presses, required);
  }
});

test('FPV Retry targets the visible tutorial action within the open pause dialog', async () => {
  const calls = [],
    result = { actions: [] };
  const retry = {
    waitFor: async () => {},
    isEnabled: async () => true,
    getAttribute: async (name) => (name === 'id' ? null : 'retry'),
    press: async (key) => calls.push(key),
  };
  await retryFirstFlight(
    {
      locator: (selector) => {
        assert.equal(selector, '#worlds-shell-pause-dialog[open]');
        return {
          getByRole: (role, options) => {
            assert.equal(role, 'button');
            assert.deepEqual(options, { name: 'Retry', exact: true });
            return retry;
          },
        };
      },
    },
    { package: 'fpv-worlds', shell: 'worlds-shell' },
    result,
  );
  assert.deepEqual(calls, ['Enter']);
  assert.equal(result.actions[0].practiceAction, 'retry');
});

test('adapters correspond to native public source controls and keyboard mappings', async () => {
  const read = (name) => readFile(new URL('../' + name, import.meta.url), 'utf8');
  const shell = await read('game/ui/mode-play-shell.mjs');
  assert.match(shell, /root\.dataset\.modePlayShell = idPrefix/);
  assert.match(shell, /'restart'.*activate\('retry'\).*'pause-restart'/);
  assert.match(shell, /put\(root\.dataset, 'phase', state\.phase\)/);
  const gym = await read('optional-practice/civilian-flight/input.mjs');
  assert.match(gym, /KeyR: \['throttle', 1\]/);
  assert.match(gym, /listen\(doc, 'focusin'/);
  assert.match(shell, /pausePress = \{ phase: state.phase, pointerId: event.pointerId \}/);
  const input = await read('optional-practice/civilian-fpv/input.mjs');
  assert.match(input, /throttle: Object\.freeze\(\['KeyS', 'KeyW'\]\)/);
  const academy = await read('optional-practice/civilian-fpv/app.mjs');
  assert.match(academy, /gameplay: \[settingLabel\('mode'\)/);
  assert.match(academy, /dataset\.flightState = state\.status/);
  const worlds = await read('optional-practice/civilian-fpv/world-app.mjs');
  assert.match(worlds, /start: \(\) => \$\('hero-fly'\)\.click\(\)/);
  assert.match(worlds, /catalogue\.find\(\(e\) => e\.legacy && !complete\.has\(keyOf\(e\)\)\)/);
  assert.match(worlds, /dataset\.flightState = state\.status/);
  assert.match(worlds, /action === 'retry'\) return retryFlight\(\{ paused: true \}\)/);
  assert.match(worlds, /gameplay: \[settingLabel\('flight-mode'\)\]/);
  assert.match(worlds, /doc\.documentElement\.lang = locale/);
  assert.match(academy, /doc\.documentElement\.lang = locale/);
  assert.match(shell, /settings: 'Налаштування'/);
  const gymCopy = await read('optional-practice/civilian-flight/copy.mjs');
  assert.match(gymCopy, /position: 'Положення'/);
  assert.match(gymCopy, /height: 'Висота'/);
  assert.match(gymCopy, /heading: 'Курс'/);
  const fpvCopy = await read('optional-practice/civilian-fpv/copy.mjs');
  assert.match(fpvCopy, /altitude: 'Висота'/);
  assert.match(fpvCopy, /speed: 'Швидкість'/);
  const practice = await read('optional-practice/civilian-fpv/flight-fullscreen.mjs');
  assert.match(practice, /button.dataset.practiceAction = action/);
  assert.match(practice, /retry: uk \? 'Ще раз' : 'Retry'/);
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
    assert.equal(report.authority.length, 8);
    for (const pin of report.authority) {
      const bytes = await readFile(path.join(output, 'authority', path.basename(pin.path)));
      assert.equal(bytes.length, pin.bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256);
    }
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

test('Gym failure receipt has its own format and snapshots both exercise authorities without claiming completion', async () => {
  const work = await mkdtemp(path.join(tmpdir(), 'gym-exercise-admission-unit-'));
  try {
    const exercise = {
      ...plan(),
      format: 'revealline-practice-gym-exercise-plan.v1',
      protocol: GYM_EXERCISE_PROTOCOL.id,
      cases: GYM_EXERCISE_CASES.map((c) => c.id),
    };
    await writeFile(path.join(work, 'plan.json'), JSON.stringify(exercise));
    await writeFile(path.join(work, 'optional-packages.json'), '{}');
    const output = path.join(work, 'evidence');
    const report = await observePracticeFirstFlight({
      planFile: path.join(work, 'plan.json'),
      playwrightModule: '/unused',
      output,
    });
    assert.equal(report.format, 'PracticeGymExerciseObservation.v1');
    assert.equal(report.protocol.id, GYM_EXERCISE_PROTOCOL.id);
    assert.equal(report.completed, false);
    assert.equal(report.qualified, false);
    assert.equal(report.cases.length, 0);
    assert.equal(report.authority.length, 10);
    assert.match(report.failure, /Envelope differs/);
    for (const item of report.authority.slice(-2)) {
      const bytes = await readFile(path.join(output, 'authority', path.basename(item.path)));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256);
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});
