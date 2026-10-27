/** Optional C4 public Workshop seed and read-only retention witnesses. */
import assert from 'node:assert/strict';

export const INSTALLATION_WORLD_SEED = 'worlds-template-copy';
export const INSTALLATION_WORLD_TITLE = 'C4 retained world';
export const INSTALLATION_WORLD_DATABASE = 'revealline-fpv-worlds-v1';

export function selectInstallationWorldSeed(value) {
  if (value === undefined) return false;
  assert.equal(
    value,
    INSTALLATION_WORLD_SEED,
    'OPTIONAL_INSTALLATION_WORLD_SEED must be omitted or worlds-template-copy.',
  );
  return true;
}

/** The caller reads and pins this existing authoring-only, import-free observer.
 * Direct evaluation avoids adding a network dependency during genuine offline
 * relaunch. Its existing database allowlist and readonly transactions are kept.
 */
export function installationWorldReader(source) {
  assert(typeof source === 'string' && Buffer.byteLength(source) <= 65536);
  assert(source.includes('export async function observeStorageContinuity('));
  assert(!/^\s*import\s/m.test(source), 'Continuity observer must remain import-free.');
  return (
    `(async () => {\n${source.replace(/^export /gm, '')}\n` +
    `return (await observeStorageContinuity()).databases.find(row => row.name === '${INSTALLATION_WORLD_DATABASE}');\n})()`
  );
}

export function assertInstallationWorldSeed(state, baseline) {
  assert(
    state?.card &&
      typeof state.card.id === 'string' &&
      state.card.id.length > 0 &&
      state.card.id.length <= 256 &&
      state.card.title === INSTALLATION_WORLD_TITLE,
    'Require the identifiable visible saved-world card.',
  );
  const database = state.database;
  assert(
    database?.name === INSTALLATION_WORLD_DATABASE &&
      !database.missing &&
      Number.isSafeInteger(database.version) &&
      database.version > 0,
    'Require the existing World Studio database.',
  );
  for (const name of ['projects', 'revisions']) {
    const store = database.stores?.find((row) => row.name === name);
    assert(
      store &&
        Number.isSafeInteger(store.count) &&
        store.count > 0 &&
        store.rows?.length === store.count &&
        /^[a-f0-9]{64}$/.test(store.sha256) &&
        store.rows.every(
          (row) => /^[a-f0-9]{64}$/.test(row.key) && /^[a-f0-9]{64}$/.test(row.sha256),
        ) &&
        new Set(store.rows.map((row) => row.key)).size === store.count,
      `Require fingerprinted nonempty World Studio ${name}.`,
    );
  }
  if (baseline) {
    assert.equal(state.card.id, baseline.card.id, 'Saved world card identity changed.');
    assert.equal(state.card.title, baseline.card.title);
    assert.deepEqual(database, baseline.database, 'Saved world record fingerprints changed.');
  }
  return state;
}

export function assertInstallationWorldRetention(receipt, rounds) {
  assert(Number.isInteger(rounds) && rounds >= 1 && rounds <= 5);
  assert.equal(receipt.preparedBeforeInstallation, true);
  assertInstallationWorldSeed(receipt.baseline);
  const labels = [
    'before-installation',
    ...Array.from({ length: rounds }, (_, index) => `closed-window-round-${index + 1}`),
    'offline-standalone-window',
    'browser-process-restart-launcher',
    'browser-process-restart-standalone',
  ];
  assert.deepEqual(
    receipt.checks.map((row) => row.label),
    labels,
    'All explicitly scoped saved-world relaunch witnesses are required.',
  );
  for (const state of receipt.checks) assertInstallationWorldSeed(state, receipt.baseline);
  return true;
}

export async function openInstallationWorldTab(page, tab) {
  assert(['creator', 'packs'].includes(tab));
  for (const selector of [
    '#worlds-shell-action-settings',
    '#worlds-settings-tab-content',
    `[data-tab="${tab}"]`,
  ]) {
    await page.locator(selector).waitFor({ state: 'visible' });
    await page.locator(selector).press('Enter');
  }
  await page.locator(`#${tab}`).waitFor({ state: 'visible' });
}

export async function readInstallationWorldCard(page) {
  const card = page.locator('#installed-packs [data-pack-id]').filter({
    has: page.getByText(INSTALLATION_WORLD_TITLE, { exact: true }),
  });
  await card.waitFor({ state: 'visible' });
  assert.equal(await card.count(), 1, 'Require exactly one identifiable saved-world card.');
  await card.scrollIntoViewIfNeeded();
  return {
    id: await card.getAttribute('data-pack-id'),
    title: await card.locator('strong').innerText(),
  };
}

export async function seedInstallationWorld(page, readDatabase) {
  const before = await readDatabase(page);
  for (const name of ['projects', 'revisions']) {
    const store = before?.stores?.find((row) => row.name === name);
    assert.equal(store?.count ?? 0, 0, 'World seed requires fresh empty project/revision stores.');
  }
  await openInstallationWorldTab(page, 'creator');
  const template = await page.locator('#creator-template').evaluate((node) => ({
    value: node.value,
    label: node.selectedOptions[0]?.textContent ?? '',
  }));
  assert(
    typeof template.value === 'string' &&
      template.value.length > 0 &&
      template.value.length <= 256 &&
      typeof template.label === 'string' &&
      template.label.length > 0 &&
      template.label.length <= 2048,
    'Require the ordinary selected Workshop template.',
  );
  await page.locator('#clone-challenge').waitFor({ state: 'visible' });
  await page.locator('#clone-challenge').press('Enter');
  await page.locator('#creator-title').waitFor({ state: 'visible' });
  await page.locator('#creator-title').fill(INSTALLATION_WORLD_TITLE);
  await page.locator('#creator-title').press('Tab');
  await page.locator('#install-project').waitFor({ state: 'visible' });
  await page.locator('#install-project').press('Enter');
  await page.locator('#studio-status').waitFor({ state: 'visible' });
  await page.waitForFunction(
    () =>
      globalThis.document.querySelector('#studio-status')?.textContent ===
      'World pack is ready to fly.',
  );
  return { template };
}
