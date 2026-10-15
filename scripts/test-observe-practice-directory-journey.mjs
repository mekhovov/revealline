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
