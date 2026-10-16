import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, mkdir, symlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
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
  DIRECTORY_PRODUCTION_APPEARANCE_PROTOCOL,
  DIRECTORY_PRODUCTION_APPEARANCE_V2_PROTOCOL,
  verifyDirectoryJourneySources,
  verifyDirectoryDistribution,
  readDirectoryDistributionFile,
  directoryJourneyServer,
} from './observe-practice-directory-journey.mjs';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
import { DIRECTORY_DISTRIBUTION_IO_POLICY } from './practice-distribution-io.mjs';

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
    {
      appearance: appearanceWitness().appearance.replace('tryzub', 'follow-game'),
    },
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
  const previous = {
    document: globalThis.document,
    localStorage: globalThis.localStorage,
  };
  try {
    globalThis.document = {
      documentElement: {
        dataset: { themeFamily: 'tryzub', interfaceTheme: 'tryzub' },
      },
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
      observePracticeDirectoryJourney({
        planFile: file,
        playwrightModule: '/not-loaded',
        output,
      }),
    );
    assert.deepEqual(await readFile(path.join(output, 'observation.json')), original);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const productionPlan = (directory = '/absolute/distribution', manifestHash = '1'.repeat(64)) => ({
  ...plan(),
  protocol: DIRECTORY_PRODUCTION_APPEARANCE_PROTOCOL.id,
  format: 'revealline-practice-directory-production-personal-appearance-plan.v1',
  distribution: directory,
  distributionManifestSha256: manifestHash,
});
const productionV2Plan = (input = productionPlan()) => ({
  ...input,
  protocol: DIRECTORY_PRODUCTION_APPEARANCE_V2_PROTOCOL.id,
  format: 'revealline-practice-directory-production-personal-appearance-plan.v2',
  observerRevision: '2'.repeat(40),
  observerTree: '3'.repeat(40),
});
async function productionFixture(run) {
  const directory = await mkdtemp(path.join(tmpdir(), 'directory-production-unit-'));
  try {
    const info = {
      formatVersion: 1,
      version: '0.151.1',
      sourceRevision: plan().shellRevision,
      entry: 'game/index.html',
    };
    const entries = new Map([
      [
        'game/index.html',
        Buffer.from('<html>Original generated output, not source fallback</html>'),
      ],
      ['game/build-info.json', Buffer.from(JSON.stringify(info))],
    ]);
    for (const [name, bytes] of entries) {
      await mkdir(path.dirname(path.join(directory, name)), {
        recursive: true,
      });
      await writeFile(path.join(directory, name), bytes, { flag: 'wx' });
    }
    const manifest = {
      ...info,
      totalBytes: [...entries.values()].reduce((n, b) => n + b.length, 0),
      files: [...entries].map(([name, bytes]) => ({
        path: name,
        bytes: bytes.length,
        sha256: sha(bytes),
      })),
    };
    const saveManifest = async (value) => {
      const bytes = Buffer.from(JSON.stringify(value));
      await writeFile(path.join(directory, 'manifest.json'), bytes);
      return productionPlan(directory, sha(bytes));
    };
    await run({
      directory,
      entries,
      manifest,
      saveManifest,
      input: await saveManifest(manifest),
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('production protocol adds exactly the bounded distribution pin without changing prior plans', () => {
  const input = productionPlan();
  assert.deepEqual(validateDirectoryJourneyPlan(input), input);
  assert.equal(directoryJourneyProtocol(input), DIRECTORY_PRODUCTION_APPEARANCE_PROTOCOL);
  assert.equal(DIRECTORY_PRODUCTION_APPEARANCE_PROTOCOL.caseMs, 90000);
  assert.deepEqual(input.cases, plan().cases);
  for (const patch of [
    { distribution: '.' },
    { distribution: '/' + 'x'.repeat(4096) },
    { distribution: '/tmp/\0bad' },
    { distributionManifestSha256: '' },
    { format: plan().format },
    { sourceSubstitution: true },
    { cases: input.cases.slice(1) },
  ])
    assert.throws(() => validateDirectoryJourneyPlan({ ...input, ...patch }));
  assert.throws(() =>
    validateDirectoryJourneyPlan({
      ...plan(),
      distribution: input.distribution,
    }),
  );
  assert.deepEqual(validateDirectoryJourneyPlan(plan()), plan());
});

for (const version of [1, 2])
  test(`production v${version} verifies every original hash, exact manifest pin and source binding`, async () => {
    await productionFixture(async ({ input, entries, directory }) => {
      if (version === 2) input = productionV2Plan(input);
      const verified = await verifyDirectoryDistribution(input);
      assert.deepEqual([...verified.files.keys()], [...entries.keys()]);
      assert.deepEqual(
        await readDirectoryDistributionFile(verified, 'game/index.html'),
        entries.get('game/index.html'),
      );
      assert.equal(
        sha(await readDirectoryDistributionFile(verified, 'manifest.json')),
        input.distributionManifestSha256,
      );
      await assert.rejects(
        verifyDirectoryDistribution({
          ...input,
          distributionManifestSha256: '0'.repeat(64),
        }),
        /manifest pin/,
      );
      await assert.rejects(
        verifyDirectoryDistribution({
          ...input,
          shellRevision: '0'.repeat(40),
        }),
        /source differs/,
      );
      await writeFile(
        path.join(directory, 'game/index.html'),
        Buffer.alloc(entries.get('game/index.html').length, 88),
      );
      await assert.rejects(verifyDirectoryDistribution(input), /hash mismatch/);
      await assert.rejects(
        readDirectoryDistributionFile(verified, 'game/index.html'),
        /changed before serving/,
      );
      await rm(path.join(directory, 'game/index.html'));
      await assert.rejects(verifyDirectoryDistribution(input), /ENOENT/);
    });
  });

test('production rejects manifest duplicates, traversal, size/count limits and inconsistent build-info', async () => {
  await productionFixture(async ({ manifest, saveManifest, entries }) => {
    const file = manifest.files[0];
    for (const patch of [
      { files: [...manifest.files, file] },
      { totalBytes: manifest.totalBytes + 1 },
      { files: [{ ...file, path: '../escape' }] },
      { files: [{ ...file, path: '/absolute' }] },
      { files: [{ ...file, path: 'game/.private' }] },
      { files: [{ ...file, path: 'game\\index.html' }] },
      { files: [{ ...file, path: 'manifest.json' }] },
      { files: [{ ...file, bytes: 128 * 1024 ** 2 + 1 }] },
      { files: Array(20001).fill(file) },
      { totalBytes: 2 * 1024 ** 3 + 1 },
      { formatVersion: 2 },
      { entry: 'other.html' },
      { extra: true },
      { version: 'different' },
    ])
      await assert.rejects(
        verifyDirectoryDistribution(await saveManifest({ ...manifest, ...patch })),
      );
    assert.equal(entries.size, 2);
  });
});

test('production refuses symlinked members even when they point to identical admitted bytes', async () => {
  await productionFixture(async ({ directory, input, entries }) => {
    const original = path.join(directory, 'game/index.html');
    await writeFile(path.join(directory, 'copy.html'), entries.get('game/index.html'));
    await rm(original);
    await symlink('../copy.html', original);
    await assert.rejects(verifyDirectoryDistribution(input), /symlink/);
  });
});

for (const version of [1, 2])
  test(`production v${version} server serves only verified entries plus explicit practice overlay under production CSP`, async () => {
    await productionFixture(async ({ input, entries, directory }) => {
      if (version === 2) input = productionV2Plan(input);
      const distribution = await verifyDirectoryDistribution(input);
      // Deliberately present but not in manifest: never exposed by distribution fallback.
      await writeFile(path.join(directory, 'unlisted.txt'), 'unlisted');
      const report = { servedSources: [], requestFailures: [] };
      const overlay = new Map([['practice/index.json', Buffer.from('{"fixture":true}')]]);
      await assert.rejects(
        directoryJourneyServer(
          new Map([['game/index.html', Buffer.from('bad')]]),
          new Map(),
          report,
          distribution,
        ),
        /Only the explicit practice/,
      );
      const served = await directoryJourneyServer(overlay, new Map(), report, distribution);
      try {
        const root = served.url + 'revealline/';
        const response = await fetch(root + 'game/');
        assert.equal(response.status, 200);
        assert.equal(
          response.headers.get('content-security-policy'),
          PUBLIC_SECURITY_HEADERS['Content-Security-Policy'],
        );
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), entries.get('game/index.html'));
        assert.deepEqual(await (await fetch(root + 'practice/index.json')).json(), {
          fixture: true,
        });
        assert.equal((await fetch(root + 'unlisted.txt')).status, 404);
        // Exists in the checkout but not in the verified fixture: no source fallback.
        assert.equal((await fetch(root + 'game/app.mjs')).status, 404);
        assert.equal((await fetch(root + 'game/', { method: 'POST' })).status, 405);
        assert.deepEqual(report.servedSources, []);
        assert.equal(report.servedDistribution[0].sha256, sha(entries.get('game/index.html')));
        await writeFile(path.join(directory, 'game/index.html'), 'changed');
        assert.equal((await fetch(root + 'game/')).status, 404);
      } finally {
        served.server.closeAllConnections();
        await new Promise((resolve, reject) =>
          served.server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    });
  });

test('production v2 requires explicit observer pins and leaves every v1 schema unchanged', () => {
  const input = productionV2Plan();
  assert.deepEqual(validateDirectoryJourneyPlan(input), input);
  assert.equal(directoryJourneyProtocol(input), DIRECTORY_PRODUCTION_APPEARANCE_V2_PROTOCOL);
  assert.deepEqual(DIRECTORY_PRODUCTION_APPEARANCE_V2_PROTOCOL, {
    ...DIRECTORY_PRODUCTION_APPEARANCE_PROTOCOL,
    id: input.protocol,
  });
  for (const patch of [
    { observerRevision: undefined },
    { observerTree: undefined },
    { observerRevision: 'HEAD' },
    { observerTree: 'main' },
    { format: productionPlan().format },
    { sourceFallback: true },
    { shellRevision: 'HEAD' },
    { shellTree: 'main' },
    { distributionManifestSha256: '' },
  ])
    assert.throws(() => validateDirectoryJourneyPlan({ ...input, ...patch }));
  for (const old of [
    plan(),
    productionPlan(),
    {
      ...plan(),
      protocol: DIRECTORY_PERSONAL_APPEARANCE_PROTOCOL.id,
      format: 'revealline-practice-directory-personal-appearance-plan.v1',
    },
  ]) {
    assert.deepEqual(validateDirectoryJourneyPlan(old), old);
    assert.throws(() =>
      validateDirectoryJourneyPlan({
        ...old,
        observerRevision: input.observerRevision,
        observerTree: input.observerTree,
      }),
    );
  }
});

test('production v2 independently verifies clean observer HEAD/tree and original shell commit/tree before and after', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'directory-source-bindings-unit-'));
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      timeout: 10_000,
      maxBuffer: 65536,
    }).trim();
  const commit = () => {
    git('add', 'source.txt');
    git(
      '-c',
      'user.name=Unit Fixture',
      '-c',
      'user.email=unit@example.invalid',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-qm',
      'unit-only source',
    );
    return {
      revision: git('rev-parse', 'HEAD'),
      tree: git('rev-parse', 'HEAD^{tree}'),
    };
  };
  try {
    git('init', '-q');
    await writeFile(path.join(root, 'source.txt'), 'original built shell');
    const shell = commit();
    await writeFile(path.join(root, 'source.txt'), 'maintained observer');
    const observer = commit();
    const input = {
      ...productionV2Plan(),
      shellRevision: shell.revision,
      shellTree: shell.tree,
      observerRevision: observer.revision,
      observerTree: observer.tree,
    };
    assert.deepEqual(verifyDirectoryJourneySources(input, root), {
      sourceRevision: observer.revision,
      sourceTree: observer.tree,
    });
    for (const patch of [
      { observerRevision: shell.revision },
      { observerTree: shell.tree },
      { shellTree: observer.tree },
      { shellRevision: observer.revision },
      { shellRevision: '0'.repeat(40) },
      { shellRevision: shell.tree },
    ])
      assert.throws(() => verifyDirectoryJourneySources({ ...input, ...patch }, root));
    assert.throws(
      () =>
        verifyDirectoryJourneySources(
          {
            ...productionPlan(),
            shellRevision: shell.revision,
            shellTree: shell.tree,
          },
          root,
        ),
      /observer source mismatch/,
    );
    assert.deepEqual(
      verifyDirectoryJourneySources(
        {
          ...productionPlan(),
          shellRevision: observer.revision,
          shellTree: observer.tree,
        },
        root,
      ),
      {
        sourceRevision: observer.revision,
        sourceTree: observer.tree,
      },
    );
    await writeFile(path.join(root, 'source.txt'), 'changed during observation');
    assert.throws(() => verifyDirectoryJourneySources(input, root), /clean committed/);
    commit();
    assert.throws(() => verifyDirectoryJourneySources(input, root), /observer source mismatch/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('production v2 orchestration uses independent source guard before admission and after original verification', async () => {
  const source = await readFile(
    new URL('./observe-practice-directory-journey.mjs', import.meta.url),
    'utf8',
  );
  const body = source.slice(
    source.indexOf('export async function observePracticeDirectoryJourney('),
  );
  assert.equal((body.match(/verifyDirectoryJourneySources\(plan\)/g) || []).length, 2);
  assert(
    body.indexOf('verifyDirectoryJourneySources(plan)') <
      body.indexOf('directoryJourneyOverlay(plan)'),
  );
  assert(
    body.lastIndexOf('verifyDirectoryJourneySources(plan)') >
      body.lastIndexOf('await verifyDirectoryDistribution(plan)'),
  );
  assert(
    body.indexOf('report.observerSource.verifiedAfter = true') <
      body.indexOf('report.procedureComplete = true'),
  );
});

test('distribution I/O records bounded integrity progress separately from unchanged gameplay deadlines', async () => {
  assert.equal(DIRECTORY_PRODUCTION_APPEARANCE_V2_PROTOCOL.caseMs, 90000);
  assert.equal(DIRECTORY_PRODUCTION_APPEARANCE_V2_PROTOCOL.actionMs, 10000);
  assert.equal(DIRECTORY_PRODUCTION_APPEARANCE_V2_PROTOCOL.overallMs, 600000);
  await productionFixture(async ({ input, entries, directory }) => {
    const diagnostics = { label: 'before-browser' };
    await verifyDirectoryDistribution(productionV2Plan(input), diagnostics);
    assert.deepEqual(diagnostics.policy, DIRECTORY_DISTRIBUTION_IO_POLICY);
    assert.equal(diagnostics.label, 'before-browser');
    assert.equal(diagnostics.totalFiles, entries.size);
    assert.equal(diagnostics.completedFiles, entries.size);
    assert.equal(
      diagnostics.completedBytes,
      [...entries.values()].reduce((n, b) => n + b.length, 0),
    );
    assert(diagnostics.completed && diagnostics.cleanup.completed);
    assert.deepEqual(diagnostics.cleanup.pending, []);
    await writeFile(
      path.join(directory, 'game/index.html'),
      Buffer.alloc(entries.get('game/index.html').length, 88),
    );
    const failed = { label: 'after-browser' };
    await assert.rejects(
      verifyDirectoryDistribution(productionV2Plan(input), failed),
      /hash mismatch/,
    );
    assert.equal(failed.failureMember, 'game/index.html');
    assert(!failed.completed && failed.cleanup.completed);
    assert(failed.completedFiles < failed.totalFiles);
  });
  const source = await readFile(
    new URL('./observe-practice-directory-journey.mjs', import.meta.url),
    'utf8',
  );
  assert(source.includes("label: 'before-browser'"));
  assert(source.includes("label: 'after-browser'"));
  assert.match(source, /distributionIO\.some\(\(row\) => !row\.cleanup\?\.completed\)/);
});
