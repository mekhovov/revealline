import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import {
  INSTALLATION_WORLD_TITLE,
  INSTALLATION_WORLD_DATABASE,
  selectInstallationWorldSeed,
  installationWorldReader,
  assertInstallationWorldSeed,
  assertInstallationWorldRetention,
  openInstallationWorldTab,
  readInstallationWorldCard,
  seedInstallationWorld,
} from './optional-installation-world-seed.mjs';

const hash = 'a'.repeat(64),
  key = 'b'.repeat(64);
const state = () => ({
  card: { id: 'world-example', title: INSTALLATION_WORLD_TITLE },
  database: {
    name: INSTALLATION_WORLD_DATABASE,
    version: 1,
    stores: ['projects', 'revisions'].map((name) => ({
      name,
      count: 1,
      sha256: hash,
      rows: [{ key, sha256: hash }],
    })),
  },
});

test('saved-world extension is explicitly opt-in and rejects unknown modes', () => {
  assert.equal(selectInstallationWorldSeed(undefined), false);
  assert.equal(selectInstallationWorldSeed('worlds-template-copy'), true);
  for (const value of ['', '1', 'all', true])
    assert.throws(() => selectInstallationWorldSeed(value));
});

test('empty, missing and malformed records cannot establish nonempty preservation', () => {
  assert.doesNotThrow(() => assertInstallationWorldSeed(state()));
  for (const mutate of [
    (x) => {
      x.card.id = '';
    },
    (x) => {
      x.card.title = 'Different';
    },
    (x) => {
      x.database.missing = true;
    },
    (x) => {
      x.database.version = 0;
    },
    (x) => {
      x.database.stores = [];
    },
    (x) => {
      x.database.stores[0].count = 0;
    },
    (x) => {
      x.database.stores[1].rows = [];
    },
    (x) => {
      x.database.stores[1].rows[0].sha256 = 'bad';
    },
    (x) => {
      const s = x.database.stores[0];
      s.count = 2;
      s.rows.push({ ...s.rows[0] });
    },
  ]) {
    const value = state();
    mutate(value);
    assert.throws(() => assertInstallationWorldSeed(value));
  }
});

test('card identity and every World database fingerprint must remain exact', () => {
  assert.doesNotThrow(() => assertInstallationWorldSeed(state(), state()));
  for (const mutate of [
    (x) => {
      x.card.id = 'different';
    },
    (x) => {
      x.database.stores[0].rows[0].sha256 = 'c'.repeat(64);
    },
    (x) => {
      x.database.stores[1].sha256 = 'c'.repeat(64);
    },
    (x) => {
      x.database.stores.push({ name: 'new-store', count: 0, rows: [], sha256: hash });
    },
  ]) {
    const value = state();
    mutate(value);
    assert.throws(() => assertInstallationWorldSeed(value, state()));
  }
});

test('all closed-window rounds and both restarted window kinds are required', () => {
  const labels = [
    'before-installation',
    'closed-window-round-1',
    'closed-window-round-2',
    'offline-standalone-window',
    'browser-process-restart-launcher',
    'browser-process-restart-standalone',
  ];
  const receipt = {
    preparedBeforeInstallation: true,
    baseline: state(),
    checks: labels.map((label) => ({ label, ...state() })),
  };
  assert.equal(assertInstallationWorldRetention(receipt, 2), true);
  for (const mutate of [
    (x) => {
      x.preparedBeforeInstallation = false;
    },
    (x) => {
      x.checks.pop();
    },
    (x) => {
      x.checks[1].label = 'online-window';
    },
    (x) => {
      x.checks[3].database.stores[0].count = 0;
    },
  ]) {
    const value = structuredClone(receipt);
    mutate(value);
    assert.throws(() => assertInstallationWorldRetention(value, 2));
  }
});

test('existing readonly observer can execute without network and never opens missing databases', async () => {
  const source = await readFile(
    new URL('../authoring/fpv-worlds/storage-continuity/observe.mjs', import.meta.url),
    'utf8',
  );
  const expression = installationWorldReader(source);
  // Playwright string evaluation evaluates the expression, not a returned function.
  const observed = await runInNewContext(expression, {
    TextEncoder,
    crypto: webcrypto,
    location: { origin: 'http://127.0.0.1:1234' },
    indexedDB: {
      databases: async () => [],
      open: () => {
        throw Error('Must not create DB');
      },
    },
  });
  assert.equal(observed.name, INSTALLATION_WORLD_DATABASE);
  assert.equal(observed.missing, true);
  assert.match(expression, /db\.transaction\(stores, "readonly"\)/);
  assert.match(expression, /request\.transaction\.abort\(\)/);
  assert(!expression.includes('localStorage'));
  assert.throws(() => installationWorldReader('import "x";\n' + source));
  assert.throws(() => installationWorldReader(source.repeat(10)));
});

function mockPage() {
  const events = [];
  const page = {
    events,
    getByText: (text, options) => ({ text, options }),
    waitForFunction: async () => events.push('ready-status'),
    locator: (selector) => ({
      waitFor: async (options) => {
        assert.equal(options.state, 'visible');
        events.push(`visible:${selector}`);
      },
      press: async (key) => events.push(`press:${selector}:${key}`),
      fill: async (value) => events.push(`fill:${selector}:${value}`),
      evaluate: async () => ({ value: 'template-1', label: 'Ordinary template' }),
      filter: (options) => {
        assert.equal(options.has.text, INSTALLATION_WORLD_TITLE);
        return {
          waitFor: async (options) => {
            assert.equal(options.state, 'visible');
            events.push('card-visible');
          },
          count: async () => 1,
          scrollIntoViewIfNeeded: async () => events.push('card-scrolled'),
          getAttribute: async (name) => {
            assert.equal(name, 'data-pack-id');
            return 'world-example';
          },
          locator: (tag) => {
            assert.equal(tag, 'strong');
            return { innerText: async () => INSTALLATION_WORLD_TITLE };
          },
        };
      },
    }),
  };
  return page;
}

test('public seed uses visible Workshop controls, title commit and ordinary install, never imports', async () => {
  const page = mockPage();
  const result = await seedInstallationWorld(page, async () => ({ stores: [] }));
  assert.equal(result.template.value, 'template-1');
  assert.deepEqual(page.events, [
    'visible:#worlds-shell-action-settings',
    'press:#worlds-shell-action-settings:Enter',
    'visible:#worlds-settings-tab-content',
    'press:#worlds-settings-tab-content:Enter',
    'visible:[data-tab="creator"]',
    'press:[data-tab="creator"]:Enter',
    'visible:#creator',
    'visible:#clone-challenge',
    'press:#clone-challenge:Enter',
    'visible:#creator-title',
    `fill:#creator-title:${INSTALLATION_WORLD_TITLE}`,
    'press:#creator-title:Tab',
    'visible:#install-project',
    'press:#install-project:Enter',
    'visible:#studio-status',
    'ready-status',
  ]);
  const alreadySaved = mockPage();
  await assert.rejects(
    seedInstallationWorld(alreadySaved, async () => state().database),
    /fresh empty/,
  );
  assert.deepEqual(alreadySaved.events, []);
});

test('public Library card observation requires its exact visible title and identity', async () => {
  const page = mockPage();
  await openInstallationWorldTab(page, 'packs');
  assert.deepEqual(await readInstallationWorldCard(page), state().card);
  assert(page.events.includes('press:[data-tab="packs"]:Enter'));
  assert(page.events.includes('card-visible'));
  assert(page.events.includes('card-scrolled'));
  await assert.rejects(openInstallationWorldTab(page, 'unsafe'));
});

test('observer integrates seed before prepare and retains independent offline/restart witnesses', async () => {
  const source = await readFile(
    new URL('./observe-optional-installation.mjs', import.meta.url),
    'utf8',
  );
  assert(
    source.indexOf("verifyWorldSeed(page, 'before-installation')") <
      source.indexOf('await prepare(worlds)'),
  );
  for (const label of [
    'offline-standalone-window',
    'browser-process-restart-launcher',
    'browser-process-restart-standalone',
  ])
    assert(source.includes(`'${label}'`));
  assert.match(source, /closed-window-round-\$\{round\}/);
  assert.match(source, /report\.passed &&= worldSeed\.passed/);
  assert.match(source, /worldSeedSourceSha256 === sha\(await readFile\(worldSeedURL\)\)/);
  assert.match(source, /continuitySourceSha256 === sha\(await readFile\(continuityURL\)\)/);
  assert.match(source, /if \(worldSeedEnabled\) \{[\s\S]*?report\.worldSeed = worldSeed/);
});
