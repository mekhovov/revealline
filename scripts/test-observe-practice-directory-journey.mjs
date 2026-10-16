import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  DIRECTORY_JOURNEY_PROTOCOL,
  DIRECTORY_JOURNEY_CASES,
  validateDirectoryJourneyPlan,
  directorySourcePath,
  assertDirectoryLink,
  observePracticeDirectoryJourney,
  openDirectoryPopup,
  assertDirectoryPageCount,
  openMainGamePractice,
  DIRECTORY_PERSONAL_APPEARANCE_PROTOCOL,
  directoryJourneyProtocol,
  validatePersonalAppearanceWitness,
  observePersonalAppearance,
  assertPersonalAppearanceURL,
} from './observe-practice-directory-journey.mjs';

test('popup click and late waiter failures stay owned without unhandled rejection', async () => {
  let rejectPopup;
  const wait = new Promise((_, reject) => {
    rejectPopup = reject;
  });
  await assert.rejects(
    openDirectoryPopup(
      { waitForEvent: () => wait },
      {
        click: async () => {
          throw new Error('click failed');
        },
      },
    ),
    /click failed/,
  );
  rejectPopup(new Error('late popup failure'));
  await new Promise((resolve) => setTimeout(resolve, 20));
  const popup = {};
  assert.equal(
    await openDirectoryPopup({ waitForEvent: async () => popup }, { click: async () => {} }),
    popup,
  );
});

const plan = () => ({
  format: 'revealline-practice-directory-journey-plan.v1',
  protocol: DIRECTORY_JOURNEY_PROTOCOL.id,
  caseId: 'unit-only',
  deviceLabel: 'No browser evidence',
  quietWindow: 'Unit tests only',
  cases: DIRECTORY_JOURNEY_CASES.map((c) => c.id),
  bundle: '/no-such-candidate',
  envelopeSha256: 'a'.repeat(64),
  sourceRevision: 'b'.repeat(40),
  sourceTree: 'c'.repeat(40),
  packageRevision: 'd'.repeat(64),
  shellRevision: 'e'.repeat(40),
  shellTree: 'f'.repeat(40),
});
test('main-game entry opens visible Settings and Help & Extras before practice', async () => {
  const actions = [];
  let settings = false,
    extras = false;
  const page = {
    locator: (selector) => ({
      waitFor: async ({ state }) => {
        assert.equal(selector, '#settings-dialog[open]');
        assert.equal(state, 'visible');
        assert(settings);
      },
    }),
  };
  await openMainGamePractice(page, async (owner, selector) => {
    assert.equal(owner, page);
    if (selector === '#shell-options') settings = true;
    else if (selector === '#settings-tab-extras') {
      assert(settings);
      extras = true;
    } else {
      assert.equal(selector, '#shell-home-practice');
      assert(extras, 'Practice remains hidden outside Extras.');
    }
    actions.push(selector);
  });
  assert.deepEqual(actions, ['#shell-options', '#settings-tab-extras', '#shell-home-practice']);
});
test('one-action browser journey rejects extra or missing tabs', () => {
  assertDirectoryPageCount({ pages: () => [{}, {}] }, 2);
  assert.throws(() => assertDirectoryPageCount({ pages: () => [{}, {}, {}] }, 2));
  assert.throws(() => assertDirectoryPageCount({ pages: () => [{}] }, 2));
});

const appearanceWitness = () => ({
  family: 'tryzub',
  interface: 'tryzub',
  appearance: JSON.stringify({
    familyId: 'tryzub',
    arcadeArt: 'follow-game',
    highContrast: false,
    opaqueHud: false,
    ornaments: 'theme',
  }),
  sim: JSON.stringify({
    format: 'SimAppearancePreferences.v1',
    interface: 'follow-game',
    world: 'follow-game',
  }),
});
test('personal appearance protocol is fixed, separately named, bounded and backward compatible', () => {
  const personal = {
    ...plan(),
    protocol: DIRECTORY_PERSONAL_APPEARANCE_PROTOCOL.id,
    format: 'revealline-practice-directory-personal-appearance-plan.v1',
  };
  assert.deepEqual(validateDirectoryJourneyPlan(personal), personal);
  assert.equal(directoryJourneyProtocol(personal), DIRECTORY_PERSONAL_APPEARANCE_PROTOCOL);
  assert.equal(directoryJourneyProtocol(plan()), DIRECTORY_JOURNEY_PROTOCOL);
  assert.equal(DIRECTORY_PERSONAL_APPEARANCE_PROTOCOL.caseMs, 90000);
  assert.equal(DIRECTORY_PERSONAL_APPEARANCE_PROTOCOL.overallMs, 600000);
  assert.deepEqual(personal.cases, plan().cases);
  for (const patch of [
    { format: plan().format },
    { protocol: 'unknown' },
    { theme: 'dos' },
    { script: 'custom' },
    { cases: personal.cases.slice(0, 1) },
  ])
    assert.throws(() => validateDirectoryJourneyPlan({ ...personal, ...patch }));
  assert.throws(() => validateDirectoryJourneyPlan({ ...plan(), format: personal.format }));
});
test('personal appearance witnesses reject defaults, missing storage, overrides and oversized records', () => {
  assert.deepEqual(validatePersonalAppearanceWitness(appearanceWitness()), appearanceWitness());
  for (const patch of [
    { family: 'legacy' },
    { interface: 'dos' },
    { appearance: null },
    { sim: null },
    { appearance: 'x'.repeat(1025) },
    { sim: '{}' },
    { appearance: appearanceWitness().appearance.replace('tryzub', 'follow-game') },
    { sim: appearanceWitness().sim.replace('follow-game', 'dos') },
  ])
    assert.throws(() => validatePersonalAppearanceWitness({ ...appearanceWitness(), ...patch }));
  assertPersonalAppearanceURL('https://example.test/app?lang=uk&action=play');
  for (const suffix of [
    'appearanceFamily=tryzub',
    'appearanceRevision=r1',
    'appearanceFamily=tryzub&appearanceRevision=r1',
    'appearanceFamily=',
  ])
    assert.throws(() => assertPersonalAppearanceURL('https://example.test/app?' + suffix));
});
test('personal appearance uses ordinary Settings selection before Extras in both locales', async () => {
  for (const locale of ['en', 'uk']) {
    const actions = [];
    let chosen = false;
    const page = {
      locale,
      locator: (selector) => ({
        waitFor: async ({ state }) => {
          assert.equal(state, 'visible');
          assert(['#settings-dialog[open]', '#settings-panel-display'].includes(selector));
        },
        getAttribute: async (key) => {
          assert.equal(selector, '#theme-card-tryzub');
          assert.equal(key, 'aria-pressed');
          return String(chosen);
        },
      }),
    };
    await openMainGamePractice(
      page,
      async (owner, selector) => {
        assert.equal(owner, page);
        actions.push(selector);
        if (selector === '#theme-card-tryzub') chosen = true;
      },
      async () => {
        assert(chosen);
        actions.push('appearance witness');
      },
    );
    assert.deepEqual(actions, [
      '#shell-options',
      '#settings-tab-display',
      '#theme-card-tryzub',
      'appearance witness',
      '#settings-tab-extras',
      '#shell-home-practice',
    ]);
  }
});
test('appearance observer waits for actual DOM resolution and reads only two bounded preference records', async () => {
  const expected = appearanceWitness(),
    reads = [];
  const previous = { document: globalThis.document, localStorage: globalThis.localStorage };
  try {
    globalThis.document = {
      documentElement: { dataset: { themeFamily: 'tryzub', interfaceTheme: 'tryzub' } },
    };
    globalThis.localStorage = {
      getItem(key) {
        reads.push(key);
        if (key === 'revealline.appearance.v2') return expected.appearance;
        assert.equal(key, 'revealline.fpv.appearance.v1');
        return expected.sim;
      },
    };
    let waited = false;
    const page = {
      locator: (selector) => {
        assert.equal(selector, 'html[data-theme-family="tryzub"][data-interface-theme="tryzub"]');
        return {
          waitFor: async () => {
            waited = true;
          },
        };
      },
      evaluate: async (read) => {
        assert(waited);
        return read();
      },
    };
    assert.deepEqual(await observePersonalAppearance(page), expected);
    assert.deepEqual(reads, ['revealline.appearance.v2', 'revealline.fpv.appearance.v1']);
    globalThis.localStorage.getItem = () => 'x'.repeat(1025);
    await assert.rejects(observePersonalAppearance(page), /Oversized/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

test('directory protocol requires exact six-case EN/UK matrix and two independent source bindings', () => {
  assert.deepEqual(validateDirectoryJourneyPlan(plan()), plan());
  assert.equal(DIRECTORY_JOURNEY_CASES.length, 6);
  assert.deepEqual(
    DIRECTORY_JOURNEY_CASES.map((c) => c.id),
    [
      'en-civilian-flight',
      'en-civilian-fpv',
      'en-fpv-worlds',
      'uk-civilian-flight',
      'uk-civilian-fpv',
      'uk-fpv-worlds',
    ],
  );
  for (const patch of [
    { cases: plan().cases.slice(1) },
    { cases: [...plan().cases].reverse() },
    { shellRevision: 'latest' },
    { shellTree: '' },
    { sourceTree: '' },
    { packageRevision: '' },
    { bundle: '.' },
    { format: 'unknown' },
    { protocol: 'unknown' },
    { password: 'not-allowed' },
    { script: 'no-hooks' },
  ])
    assert.throws(() => validateDirectoryJourneyPlan({ ...plan(), ...patch }));
  assert.throws(() => validateDirectoryJourneyPlan(' '.repeat(65537)));
});

test('read-only source router admits fixed root and rejects private/traversal/malformed paths', () => {
  assert.equal(directorySourcePath('/revealline/game/?lang=uk'), 'game/index.html');
  assert.equal(directorySourcePath('/revealline/game/app.mjs'), 'game/app.mjs');
  assert.equal(directorySourcePath('/revealline/practice/index.json'), 'practice/index.json');
  for (const value of [
    '/game/',
    '/revealline/.git/config',
    '/revealline/game/../private',
    '/revealline/%2e%2e/config',
    '/revealline/game/%00.js',
    '/revealline/game/%5cfoo',
    '/revealline/%zz',
  ])
    assert.throws(() => directorySourcePath(value));
});

test('public launch links require safe locale/play/appearance semantics, not arbitrary destinations', () => {
  const options = {
    origin: 'https://example.test',
    id: 'civilian-flight',
    locale: 'uk',
    play: true,
  };
  const base = 'https://example.test/revealline/practice/civilian-flight/app/';
  const href = base + '?action=play&lang=uk&appearanceFamily=retro&appearanceRevision=r1';
  assert.equal(assertDirectoryLink(href, options).appearanceFamily, 'retro');
  assertDirectoryLink(base + '?lang=uk', { ...options, play: false });
  for (const value of [
    base + '?lang=en&action=play',
    base + '?lang=uk',
    base + '?lang=uk&action=play&lang=uk',
    base + '?lang=uk&action=play&script=no',
    base + '?lang=uk&action=play&appearanceFamily=retro',
    base + '?lang=uk&action=play#run',
    href.replace('example.test', 'elsewhere.test'),
    href.replace('civilian-flight', 'fpv-worlds'),
    href.replace('https://', 'https://user@'),
  ])
    assert.throws(() => assertDirectoryLink(value, options));
});

test('failed source/admission still retains plan and authority and refuses evidence overwrite', async () => {
  const work = await mkdtemp(path.join(tmpdir(), 'directory-journey-unit-'));
  try {
    const file = path.join(work, 'plan.json'),
      output = path.join(work, 'evidence');
    await writeFile(file, JSON.stringify(plan()));
    const report = await observePracticeDirectoryJourney({
      planFile: file,
      playwrightModule: '/not-loaded',
      output,
      password: undefined,
    });
    assert.equal(report.completed, false);
    assert.equal(report.qualified, false);
    assert(report.failure);
    assert.equal(report.cleanup.completed, true);
    assert.equal(report.cases.length, 0);
    assert(report.authority.length >= 10);
    assert.equal(await readFile(path.join(output, 'plan.json'), 'utf8'), JSON.stringify(plan()));
    const original = await readFile(path.join(output, 'observation.json'));
    await assert.rejects(
      observePracticeDirectoryJourney({ planFile: file, playwrightModule: '/not-loaded', output }),
    );
    assert.deepEqual(await readFile(path.join(output, 'observation.json')), original);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});
