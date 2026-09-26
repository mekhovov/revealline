import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PACK_CATALOG_VERSION,
  canAutoStartPackLaunch,
  canReconcilePackCommit,
  createPackCommitCoordinator,
  createPackLaunchGuard,
  preparePackCatalog,
  resolvePackLaunch,
  packLaunchHref,
} from '../content-launch.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const source = await json('../content/packs/catalog.json');
const catalog = preparePackCatalog(source);

test('shipped pack catalog is a lightweight exact projection of every bundled pack', async () => {
  assert.equal(catalog.format, PACK_CATALOG_VERSION);
  const index = await json('../content/packs/index.json');
  assert.deepEqual(
    catalog.packs.map(({ id, path }) => ({ id, path })),
    index.packs,
  );
  for (const summary of catalog.packs) {
    const pack = await json(`../content/packs/${summary.path}`);
    assert.equal(summary.name, pack.name);
    assert.deepEqual(
      summary.campaigns,
      pack.campaigns.map((campaign) => ({
        id: campaign.id,
        revision: campaign.revision,
        title: campaign.title,
        levels: campaign.levels.map((level) => ({ id: level.id, name: level.name })),
      })),
    );
  }
  assert.ok(Object.isFrozen(catalog));
  assert.ok(Object.isFrozen(catalog.packs[0].campaigns[0].levels[0]));
});

test('pack launch resolves defaults and an explicit level only from the shipped catalog', () => {
  assert.deepEqual(resolvePackLaunch(new URLSearchParams('pack=homeward-skies&play=1'), catalog), {
    packId: 'homeward-skies',
    packName: 'Homeward Skies',
    path: 'homeward-skies.json',
    campaignId: 'homeward-skies',
    campaignTitle: 'Homeward Skies',
    levelId: 'homeward-01',
    levelName: 'Copper Orchard',
    play: true,
  });
  assert.equal(
    resolvePackLaunch(
      new URLSearchParams('pack=fieldcraft&campaign=fieldcraft&level=fieldcraft-04&play=1'),
      catalog,
    ).levelName,
    'Net Loom',
  );
  assert.equal(resolvePackLaunch(new URLSearchParams(), catalog), null);
});

test('pack launch rejects unknown, ambiguous and partial routes without accepting file paths', () => {
  for (const query of [
    'pack=unknown',
    'pack=../night-shift',
    'pack=night-shift&campaign=unknown',
    'pack=night-shift&level=unknown',
    'pack=night-shift&play=0',
    'pack=night-shift&pack=fieldcraft',
    'level=night-shift-01',
  ])
    assert.throws(() => resolvePackLaunch(new URLSearchParams(query), catalog));
});

test('pack launch validation follows the active locale', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  setLocale('uk', { persist: false });
  assert.throws(
    () => resolvePackLaunch(new URLSearchParams('pack=unknown'), catalog),
    /Цей вбудований пакет недоступний/,
  );
  setLocale('en', { persist: false });
  assert.throws(
    () => resolvePackLaunch(new URLSearchParams('pack=unknown'), catalog),
    /This bundled pack is not available/,
  );
});

test('pack launch href encodes selector choices and autoplay explicitly', () => {
  assert.equal(
    packLaunchHref('./game/', {
      packId: 'night-shift',
      campaignId: 'night-shift',
      levelId: 'night-shift-02',
      play: true,
    }),
    './game/?pack=night-shift&campaign=night-shift&level=night-shift-02&play=1',
  );
});

test('catalog validation rejects drift, duplicate identities and unsupported fields', () => {
  const mutate = (fn) => {
    const candidate = structuredClone(source);
    fn(candidate);
    return candidate;
  };
  assert.throws(() => preparePackCatalog(mutate((value) => (value.format = 'future'))));
  assert.throws(() =>
    preparePackCatalog(mutate((value) => value.packs.push(structuredClone(value.packs[0])))),
  );
  assert.throws(() =>
    preparePackCatalog(mutate((value) => (value.packs[0].path = '../night-shift.json'))),
  );
  assert.throws(() =>
    preparePackCatalog(mutate((value) => (value.packs[0].campaigns[0].revision = ''))),
  );
  assert.throws(() =>
    preparePackCatalog(mutate((value) => (value.packs[0].campaigns[0].levels[0].extra = true))),
  );
});

test('separate extras and game expose wired pack and level selectors with exact first-mission routes', async () => {
  const landing = await readFile(new URL('../../site/about.html', import.meta.url), 'utf8');
  const game = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(landing, /id="landing-pack-select"/);
  assert.match(landing, /id="landing-level-select"/);
  assert.match(game, /id="pack-select"/);
  assert.match(game, /id="level-select"/);
  const quick = landing.match(/id="landing-pack-play"[\s\S]*?href="\.\.\/game\/\?([^"]+)"/);
  assert.ok(quick);
  const featured = resolvePackLaunch(
    new URLSearchParams(quick[1].replaceAll('&amp;', '&')),
    catalog,
  );
  assert.equal(featured.packId, 'fpv-arcade-r5');
  assert.equal(featured.campaignId, 'fpv-pressure-lines');
  assert.equal(featured.levelId, 'orchard-crossing');
  const cards = [
    ...landing.matchAll(/<article\b[^>]*class="[^"]*\bpack-card\b[^"]*"[^>]*>[\s\S]*?<\/article>/g),
  ].map(([markup]) => markup);
  const archive = preparePackCatalog(await json('../content/packs/archive-catalog.json'));
  const allPacks = [...catalog.packs, ...archive.packs];
  assert.equal(cards.length, allPacks.length);
  for (const pack of allPacks) {
    const campaign = pack.campaigns[0];
    const level = campaign.levels[0];
    const encoded = `pack=${pack.id}&amp;campaign=${campaign.id}&amp;level=${level.id}&amp;play=1`;
    const matching = cards.filter((card) => card.includes(`href="../game/?${encoded}"`));
    assert.equal(matching.length, 1, `${pack.name} must have one real first-mission launch card`);
    assert.equal(
      matching[0].match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1].trim(),
      pack.name,
      'The original title is retained beside its translation marker.',
    );
    const route = resolvePackLaunch(new URLSearchParams(encoded.replaceAll('&amp;', '&')), {
      ...catalog,
      packs: allPacks,
    });
    assert.equal(route.packId, pack.id);
    assert.equal(route.campaignId, campaign.id);
    assert.equal(route.levelId, level.id);
    assert.equal(route.play, true);
  }
});

test('newer restore, profile and pack choices block an in-flight pack adoption', async () => {
  for (const newerAction of ['saved-flight restore', 'profile replacement', 'pack selection']) {
    const guard = createPackLaunchGuard();
    const packs = {};
    const ticket = guard.begin(packs);
    let finish;
    let adopted = false;
    const pending = guard
      .run(
        ticket,
        packs,
        () => packs,
        () => new Promise((resolve) => (finish = resolve)),
      )
      .then(() => (adopted = true));
    guard.invalidate();
    finish(newerAction);
    await assert.rejects(pending, /newer action/);
    assert.equal(adopted, false, `${newerAction} must win over the older pack launch`);
    assert.equal(guard.current(ticket, packs), false);
    assert.throws(() => guard.assert(ticket, packs), /newer action/);
  }
});

test('pack launch work rejects a library replacement before adopting its result', async () => {
  const guard = createPackLaunchGuard();
  const before = {};
  const after = {};
  let packs = before;
  let finish;
  let adopted = false;
  const ticket = guard.begin(before);
  const pending = guard
    .run(
      ticket,
      before,
      () => packs,
      () => new Promise((resolve) => (finish = resolve)),
    )
    .then(() => (adopted = true));
  packs = after;
  finish();
  await assert.rejects(pending, /newer action/);
  assert.equal(adopted, false);
});

test('a stale durable pack commit reconciles catalog bytes without changing the newer run', async () => {
  let durable = null;
  let releaseWrite;
  let activeRun = { id: 'base-run' };
  let adoptedCatalog = null;
  let resumeCalls = 0;
  const coordinator = createPackCommitCoordinator({
    write: (value) =>
      new Promise((resolve) => {
        releaseWrite = () => {
          durable = value;
          resolve();
        };
      }),
    read: () => durable,
    prepare: (value) => ({ packs: value }),
    adopt: (value) => (adoptedCatalog = value),
  });
  const guard = createPackLaunchGuard();
  const packs = {};
  const ticket = guard.begin(packs);
  const committing = coordinator.commit('pack-a', {
    beforeWrite: () => guard.assert(ticket, packs),
  });
  await Promise.resolve();
  guard.invalidate();
  activeRun = { id: 'newer-run' };
  releaseWrite();
  await committing;
  assert.equal(guard.current(ticket, packs), false);
  assert.equal(await coordinator.noteStaleCommit(), true);
  assert.deepEqual(adoptedCatalog, { packs: 'pack-a' });
  assert.equal(activeRun.id, 'newer-run');
  assert.equal(resumeCalls, 0);
});

test('pack reconciliation keeps the backup gate after a content-switch reset', async () => {
  const host = {
    contentSwitchBusy: true,
    sessionBusy: false,
    backupBusy: true,
    persistenceReady: true,
    backupLocked: true,
    hidden: false,
  };
  let durable = null;
  let activeRun = { id: 'restore-pending' };
  let adoptedCatalog = null;
  const coordinator = createPackCommitCoordinator({
    write: async (value) => (durable = value),
    read: () => durable,
    prepare: (value) => ({ packs: value }),
    adopt: (value) => (adoptedCatalog = value),
    canAdopt: () => canReconcilePackCommit(host),
  });
  await coordinator.commit('pack-a');
  host.contentSwitchBusy = false;
  assert.equal(await coordinator.noteStaleCommit(), false);
  assert.equal(adoptedCatalog, null);
  assert.equal(coordinator.needsReconciliation(), true);
  coordinator.markIntent();
  await coordinator.commit('pack-b');
  activeRun = { id: 'restored-run' };
  host.backupBusy = false;
  host.backupLocked = false;
  assert.equal(await coordinator.reconcile(), true);
  assert.deepEqual(adoptedCatalog, { packs: 'pack-b' });
  assert.equal(activeRun.id, 'restored-run');
});

test('a denied reconciliation gate fails closed through the error callback and can retry', async () => {
  let denied = true;
  let durable = null;
  let adopted = null;
  let reported = null;
  const coordinator = createPackCommitCoordinator({
    write: async (value) => (durable = value),
    read: () => durable,
    prepare: (value) => value,
    adopt: (value) => (adopted = value),
    canAdopt: () => {
      if (denied) throw new Error('Storage access denied.');
      return true;
    },
    onError: (error) => (reported = error.message),
  });
  await coordinator.commit('pack-a');
  assert.equal(await coordinator.noteStaleCommit(), false);
  assert.equal(adopted, null);
  assert.equal(reported, 'Storage access denied.');
  assert.equal(coordinator.needsReconciliation(), true);
  denied = false;
  assert.equal(await coordinator.reconcile(), true);
  assert.equal(adopted, 'pack-a');
});

test('pack launch guard rejects changed libraries and advances only its current operation', () => {
  const guard = createPackLaunchGuard();
  const before = {};
  const after = {};
  const first = guard.begin(before);
  assert.throws(() => guard.assert(first, after), /newer action/);
  guard.advance(first, before, after);
  assert.equal(guard.current(first, before), false);
  assert.equal(guard.current(first, after), true);
  const newer = guard.begin(after);
  assert.throws(() => guard.advance(first, after, {}), /newer action/);
  assert.equal(guard.current(newer, after), true);
});

test('autoplay rechecks dialog, busy and lifecycle state before resuming', () => {
  const run = {};
  const entry = {};
  const ready = {
    current: true,
    blocked: false,
    started: false,
    paused: true,
    overlayKind: 'ready',
    run,
    expectedRun: run,
    entry,
    expectedEntry: entry,
    campaignKey: 'campaign-key',
    expectedCampaignKey: 'campaign-key',
    levelId: 'level-01',
    expectedLevelId: 'level-01',
  };
  assert.equal(canAutoStartPackLaunch(ready), true);
  for (const stale of [
    { current: false },
    { blocked: true },
    { started: true },
    { paused: false },
    { overlayKind: 'pause' },
    { run: {} },
    { entry: {} },
    { campaignKey: 'new-campaign' },
    { levelId: 'level-02' },
  ])
    assert.equal(canAutoStartPackLaunch({ ...ready, ...stale }), false);
});
