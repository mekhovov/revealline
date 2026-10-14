import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  OBSERVED_PACKAGES,
  TRANSFER_TIMEOUT_MS,
  boundedOperation,
  closeAllPages,
  unlockObservedPage,
  matchesLaunchedAppURL,
  revealFPVOffline,
} from './optional-installation-observer-helpers.mjs';

test('installation observer covers all three public app identities and current offline controls', async () => {
  assert.deepEqual(Object.keys(OBSERVED_PACKAGES), [
    'civilian-flight',
    'civilian-fpv',
    'fpv-worlds',
  ]);
  for (const [id, adapter] of Object.entries(OBSERVED_PACKAGES)) {
    const markup = await readFile(
      new URL(`../optional-practice/${id}/index.html`, import.meta.url),
      'utf8',
    );
    for (const selector of [adapter.prepare, adapter.status]) {
      assert.ok(markup.includes(`id="${selector.slice(1)}"`), `${id} must contain ${selector}`);
    }
  }
  for (const [id, adapter] of Object.entries(OBSERVED_PACKAGES)) {
    const source = await readFile(
      new URL(
        `../optional-practice/${id === 'civilian-flight' ? id : 'civilian-fpv'}/${id === 'fpv-worlds' ? 'world-' : ''}app.mjs`,
        import.meta.url,
      ),
      'utf8',
    );
    assert.ok(source.includes(`idPrefix: '${adapter.settingsPrefix}-shell'`));
    assert.ok(source.includes(`prefix: '${adapter.settingsPrefix}-settings'`));
    assert.equal(adapter.mounted, `#${adapter.settingsPrefix}-shell-action-settings`);
  }
  const gym = OBSERVED_PACKAGES['civilian-flight'];
  assert.equal(gym.panel, '#gym-settings-tab-content');
  assert.equal(gym.close, '#gym-shell-action-settings-back');
  const gymSource = await readFile(
    new URL('../optional-practice/civilian-flight/app.mjs', import.meta.url),
    'utf8',
  );
  assert.match(
    gymSource,
    /offlineControls\.append\(\$\('offline'\), \$\('remove-offline'\), \$\('package-status'\)\)/,
  );
  assert.match(gymSource, /content: \[offlineControls\]/);
  const shell = await readFile(new URL('../game/ui/mode-play-shell.mjs', import.meta.url), 'utf8');
  assert.ok(shell.includes("button('back', back, false, `${name}-back`)"));
  assert.ok(
    TRANSFER_TIMEOUT_MS > 300_000,
    'The harness must permit the app-owned five-minute limit.',
  );
});

test('launcher destinations preserve exact app identity and the defined locale query', async () => {
  const entry =
    'http://127.0.0.1:4000/revealline/practice/civilian-flight/releases/v1.2.3/site/optional-practice/civilian-flight/index.html';
  assert.equal(matchesLaunchedAppURL(entry + '?lang=en', entry), true);
  assert.equal(matchesLaunchedAppURL(new URL(entry + '?lang=uk'), entry, 'uk'), true);
  for (const observed of [
    entry,
    entry + '?lang=uk',
    entry + '?lang=de',
    entry + '?lang=en&lang=en',
    entry + '?lang=en&action=play',
    entry + '?lang=en#other',
    entry.replace('4000', '4001') + '?lang=en',
    entry.replace('v1.2.3', 'v1.2.2') + '?lang=en',
  ]) {
    assert.equal(matchesLaunchedAppURL(observed, entry), false, observed);
  }
  const launcher = await readFile(
    new URL('../optional-practice/launcher-template.mjs', import.meta.url),
    'utf8',
  );
  assert.ok(
    launcher.includes("url.searchParams.set('lang', locale)"),
    'Track the actual launcher locale contract.',
  );
});

test('bounded operation returns results, preserves errors, and rejects stalls', async () => {
  assert.equal(await boundedOperation('success', () => 42, 50), 42);
  await assert.rejects(
    boundedOperation(
      'failure',
      () => {
        throw new Error('original');
      },
      50,
    ),
    /original/,
  );
  await assert.rejects(
    boundedOperation('stalled operation', () => new Promise(() => {}), 5),
    /stalled operation timed out/,
  );
});

test('Academy offline controls expand the ordinary closed Workshop disclosure in every offline flow', async () => {
  const markup = await readFile(
    new URL('../optional-practice/civilian-fpv/index.html', import.meta.url),
    'utf8',
  );
  const disclosure = markup.match(
    /<details>\s*<summary data-sim-copy="workshopAndOffline">[\s\S]*?<\/details>/,
  )?.[0];
  assert.ok(disclosure, 'Workshop & offline is initially a closed disclosure.');
  for (const id of ['install-offline', 'remove-offline'])
    assert.ok(disclosure.includes(`id="${id}"`));
  let helpOpen = false;
  let disclosureOpen = false;
  const clicks = [];
  const page = {
    locator: (selector) => ({
      isVisible: async () => helpOpen,
      locator: () => ({ getAttribute: async () => (disclosureOpen ? '' : null) }),
      press: async (key) => {
        assert.equal(key, 'Enter');
        clicks.push(selector);
        disclosureOpen = true;
      },
      waitFor: async ({ state }) => {
        assert.equal(state, 'visible');
        assert.equal(
          helpOpen && disclosureOpen,
          true,
          `${selector} must be reachable through public controls.`,
        );
      },
    }),
  };
  const openHelp = async () => {
    clicks.push('#help');
    helpOpen = true;
  };
  await revealFPVOffline(page, openHelp);
  assert.deepEqual(clicks, ['#help', 'summary[data-sim-copy="workshopAndOffline"]']);
  await revealFPVOffline(page, openHelp);
  assert.equal(clicks.length, 2, 'An already-open disclosure must not be toggled closed.');
  const observer = await readFile(
    new URL('./observe-optional-installation.mjs', import.meta.url),
    'utf8',
  );
  assert.equal(
    observer.match(/await revealFPVOffline\(page, \(\) => clickFPV\('#help'\)\)/g)?.length,
    3,
    'Preparation, failed download, and removal share the same public disclosure action.',
  );
});

test('offline restart closes every page and rejects surviving windows', async () => {
  const pages = new Set();
  for (let index = 0; index < 4; index++) {
    const page = { close: async () => pages.delete(page) };
    pages.add(page);
  }
  assert.equal(await closeAllPages({ pages: () => [...pages] }), 4);
  assert.equal(pages.size, 0);
  await assert.rejects(
    closeAllPages({ pages: () => [{ close: async () => {} }] }),
    /zero surviving pages/,
  );
});

test('access-gated candidates require normal-form credentials and never expose them in errors', async () => {
  const actions = [];
  const page = {
    locator: (selector) => ({
      getAttribute: async () => 'locked',
      fill: async (value) => actions.push(['fill', selector, value]),
      click: async () => actions.push(['click', selector]),
    }),
    waitForFunction: async () => actions.push(['wait-for-unlock']),
  };
  await assert.rejects(unlockObservedPage(page), /OPTIONAL_INSTALLATION_PASSWORD/);
  assert.equal(actions.length, 0, 'Missing credentials must not modify access state.');
  assert.equal(await unlockObservedPage(page, 'synthetic-test-password'), true);
  assert.deepEqual(
    actions.map(([action]) => action),
    ['fill', 'click', 'wait-for-unlock'],
  );
  page.locator = () => ({
    getAttribute: async () => 'locked',
    fill: async () => {
      throw new Error('Diagnostics include synthetic-test-password');
    },
  });
  await assert.rejects(unlockObservedPage(page, 'synthetic-test-password'), (error) => {
    assert.match(error.message, /did not unlock/);
    assert.ok(!error.message.includes('synthetic-test-password'));
    return true;
  });
  page.locator = () => ({ getAttribute: async () => 'unlocked' });
  assert.equal(await unlockObservedPage(page), false);
});
