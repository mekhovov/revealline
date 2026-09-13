import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLASSES, FIXED_DT, createRun, stepRun } from '../core/index.mjs';
import { createRecorder, recordInput, authoritativeCheckpoint } from '../replay.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { campaignKey, emptyLibrary, exportLibrary, updatePreferences } from '../library.mjs';
import { preparePack, resolvePackCampaign } from '../packs.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { createDifficultyContext } from '../campaign-difficulty.mjs';
import { expandDifficultyCampaigns } from '../campaign-contexts.mjs';
import {
  discoverProfileTransfers,
  prepareProfileTransfer,
  TRANSFER_LIMITS,
} from '../profile-transfer.mjs';
import { attachProfileTransferPanel } from '../ui/profile-transfer-panel.mjs';
import { commitBackup } from '../backup-storage.mjs';
import { Document } from './helpers/couch-dom.mjs';

const level = {
  version: 'xonix-level.v1',
  id: 'first-unsaved-profile',
  revision: '1',
  name: 'First attempt',
  width: 48,
  height: 36,
  spawn: { x: 24.5, y: 0.5 },
  walls: [],
  enemies: [{ id: 'anchor', type: 'bouncer', x: 40.5, y: 25.5, vx: 0, vy: 0, radius: 0.3 }],
  objectives: [],
  supplies: [],
  goal: { coverage: 0.6 },
};
const campaign = {
  version: 'xonix-campaign.v1',
  id: 'first-attempt-transfer',
  revision: '1',
  title: 'First attempt',
  classRecipes: structuredClone(CLASSES),
  levels: [level],
};
const keys = (channel) => ({
  profileKey: `revealline.library.${channel}.v1`,
  sessionKey: `revealline.suspended.${channel}.v1`,
  packsKey: `revealline.packs.${channel}.v1`,
  journalKey: `revealline.library.${channel}.v1.backup-journal`,
  lockKey: `revealline.library.${channel}.v1.backup-lock`,
  writerKey: `revealline.library.${channel}.v1.writer`,
});
class Locks {
  held = new Set();
  calls = [];
  async request(key, options, work) {
    this.calls.push([key, options]);
    if (this.held.has(key)) return work(null);
    this.held.add(key);
    try {
      return await work({ name: key });
    } finally {
      this.held.delete(key);
    }
  }
}
function source() {
  const id = 'release-v0.29.2',
    k = keys(id),
    local = new Map(),
    assets = new Map(),
    reads = [];
  const locks = new Locks();
  const read = (map, key) => {
    assert.deepEqual(
      locks.held,
      new Set([k.writerKey, k.lockKey]),
      'Every source value is read under both real source lock names.',
    );
    reads.push(key);
    return map.has(key) ? map.get(key) : null;
  };
  const storage = {
    get length() {
      return local.size;
    },
    key: (index) => [...local.keys()][index] ?? null,
    getItem: (key) => read(local, key),
    setItem() {
      assert.fail('Source storage must remain read-only.');
    },
    removeItem() {
      assert.fail('Source storage must remain read-only.');
    },
  };
  return {
    id,
    k,
    local,
    assets,
    reads,
    locks,
    options: {
      currentVersion: '0.31.0',
      storage,
      readAsset: async (key) => read(assets, key),
      lockManager: locks,
      campaigns: [campaign],
    },
  };
}
function live(c = campaign, turnPolicy = 'grid-center', ticks = 100) {
  const options = { classId: 'scout', classRecipes: c.classRecipes, turnPolicy, seed: 1 };
  const run = createRun(c.levels[0], options),
    recorder = createRecorder(c.levels[0], options);
  for (let tick = 0; tick < ticks; tick++) {
    const input = { direction: 'down' };
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
  }
  assert.equal(run.status, 'running');
  const session = suspendSession({
    run,
    recorder,
    campaignKey: campaignKey(c),
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: `first-attempt-${turnPolicy}`,
    savedAt: '2026-09-13T08:00:00.000Z',
    continuation: { direction: 'left' },
  });
  return { run, session };
}

test('discovery includes suspended-only releases, deduplicates profiles and excludes recovery markers', () => {
  const f = source();
  f.local.set(f.k.sessionKey, 'discovery does not parse this');
  for (const channel of [
    'release-v0.28.0',
    'release-0.29.2',
    'release',
    'dev',
    'release-v0.31.0',
    'release-v0.32.0',
    'release-v0.2.0',
    'release-v00.29.1',
  ])
    f.local.set(keys(channel).sessionKey, 'unverified');
  f.local.set(keys('release-v0.29.1').lockKey, 'pending');
  f.local.set(keys('release-v0.29.1').writerKey, 'not a source');
  f.local.set(keys('release-v0.29.1').journalKey, 'not a source');
  const before = discoverProfileTransfers(f.options);
  assert.deepEqual(
    before.map((v) => v.id),
    ['release-0.29.2', f.id, 'release-v0.28.0', 'release'],
  );
  f.local.set(f.k.profileKey, 'unverified profile');
  assert.deepEqual(discoverProfileTransfers(f.options), before);
  assert.equal(f.reads.length, 0);
});

test('candidate bound counts distinct editions across both namespaces', () => {
  const f = source();
  for (let i = 0; i < TRANSFER_LIMITS.candidates; i++)
    for (const key of ['profileKey', 'sessionKey'])
      f.local.set(keys(`release-v0.28.${i}`)[key], 'x');
  assert.equal(discoverProfileTransfers(f.options).length, 32);
  f.local.set(keys('release-v0.29.0').sessionKey, 'x');
  assert.throws(() => discoverProfileTransfers(f.options), /Too many earlier/);
});

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: an unfinished first attempt transfers without ever writing a source profile`, async () => {
    const f = source(),
      attempt = live(campaign, turnPolicy);
    f.local.set(f.k.sessionKey, JSON.stringify(attempt.session));
    const before = structuredClone({ local: f.local, assets: f.assets });
    assert.equal(discoverProfileTransfers(f.options)[0].id, f.id);
    const result = await prepareProfileTransfer(f.id, f.options);
    assert.equal(result.preview.profileAbsent, true);
    assert.equal(result.preview.hasSession, true);
    assert.equal(result.preview.completedLevels, 0);
    assert.deepEqual(result.prepared.library, emptyLibrary());
    assert.deepEqual(result.prepared.session, attempt.session);
    const restored = await restoreSession(result.prepared.session, {
      campaign,
      campaignKey: campaignKey(campaign),
    });
    assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(attempt.run));
    assert.deepEqual(restored.session.continuation, { direction: 'left' });
    assert.deepEqual({ local: f.local, assets: f.assets }, before);
    assert.equal(f.locks.held.size, 0);
  });
}

test('null profile never masks corrupt/unreadable profiles, missing sessions or malformed replay data', async () => {
  const attempt = live();
  for (const change of [
    (f) => f.local.delete(f.k.sessionKey),
    (f) => f.local.set(f.k.sessionKey, undefined),
    (f) => f.local.set(f.k.sessionKey, 'null'),
    (f) => f.local.set(f.k.sessionKey, '{}'),
    (f) =>
      f.local.set(
        f.k.sessionKey,
        JSON.stringify({ ...attempt.session, campaignKey: 'foreign/1/unknown' }),
      ),
    (f) => f.local.set(f.k.profileKey, undefined),
    (f) => f.local.set(f.k.profileKey, ''),
    (f) => f.local.set(f.k.profileKey, 'null'),
    (f) => f.local.set(f.k.profileKey, '{broken'),
    (f) => f.assets.set(f.k.packsKey, 'null'),
    (f) => f.assets.set(f.k.packsKey, undefined),
  ]) {
    const f = source();
    f.local.set(f.k.sessionKey, JSON.stringify(attempt.session));
    change(f);
    const before = structuredClone({ local: f.local, assets: f.assets });
    await assert.rejects(prepareProfileTransfer(f.id, f.options));
    assert.deepEqual({ local: f.local, assets: f.assets }, before);
    assert.equal(f.locks.held.size, 0);
  }
});

test('suspended-only sources retain writer and recovery exclusion without stealing or repairing', async () => {
  for (const change of [
    (f) => f.locks.held.add(f.k.writerKey),
    (f) => f.locks.held.add(f.k.lockKey),
    (f) => f.local.set(f.k.lockKey, 'pending'),
    (f) => f.assets.set(f.k.journalKey, { broken: true }),
  ]) {
    const f = source();
    f.local.set(f.k.sessionKey, JSON.stringify(live().session));
    change(f);
    // A busy second lock permits the first lock's callback but no value read.
    await assert.rejects(prepareProfileTransfer(f.id, f.options), /busy|unfinished|journal/);
    assert.equal(f.reads.includes(f.k.sessionKey), false);
  }
});

// Trusted Node decoder boundary: inspect all original headers; this does not
// claim browser pixel decoding. The pack and gameplay data are the shipped R4.
const decodeImage = async (url) => {
  const header = inspectImageDataUrl(url);
  assert.equal(header.valid, true);
  return { naturalWidth: header.width, naturalHeight: header.height };
};
test('shipped R4 suspended-only first capture retains its exact edition, original art and both turn policies', async () => {
  const raw = JSON.parse(
    readFileSync(new URL('../content/packs/fpv-arcade-r4.json', import.meta.url)),
  );
  const pack = (await preparePack(raw, { decodeImage })).pack;
  const base = resolvePackCampaign(pack, pack.campaigns[0].id).campaign;
  for (const turnPolicy of ['immediate', 'grid-center']) {
    const f = source(),
      attempt = live(base, turnPolicy, 316);
    assert.equal(attempt.run.score, 12240);
    assert.equal(attempt.run.lives, 3);
    assert.ok(Math.abs(attempt.run.coverage - 36 / 70) < 1e-8);
    assert.equal(attempt.run.player.speed, 0);
    f.local.set(f.k.sessionKey, JSON.stringify(attempt.session));
    f.assets.set(f.k.packsKey, JSON.stringify({ format: 'xonix-pack-library.v1', packs: [pack] }));
    const result = await prepareProfileTransfer(f.id, {
      ...f.options,
      campaigns: [],
      decodeImage,
      expandCampaigns: expandDifficultyCampaigns,
    });
    assert.deepEqual(result.prepared.packs.packs, [pack]);
    assert.equal(result.preview.profileAbsent, true);
    const restored = await restoreSession(result.prepared.session, {
      campaign: base,
      campaignKey: campaignKey(base),
    });
    assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(attempt.run));
    assert.deepEqual(restored.session.continuation, { direction: 'left' });
    assert.equal(f.local.has(f.k.profileKey), false);
  }
});

test('included Gentle campaign expansion is forwarded for both absent and present profiles', async () => {
  const raw = JSON.parse(
    readFileSync(new URL('../content/packs/night-shift.json', import.meta.url)),
  );
  raw.campaigns = [{ ...campaign, classRecipes: undefined, themeId: 'retro' }];
  delete raw.campaigns[0].classRecipes;
  raw.levelVisuals = [];
  const pack = (await preparePack(raw, { decodeImage })).pack;
  const base = resolvePackCampaign(pack, campaign.id).campaign;
  const gentle = createDifficultyContext(base, 'gentle');
  for (const withProfile of [false, true]) {
    const f = source(),
      attempt = live(gentle.campaign);
    f.local.set(f.k.sessionKey, JSON.stringify(attempt.session));
    if (withProfile) f.local.set(f.k.profileKey, exportLibrary(emptyLibrary()));
    f.assets.set(f.k.packsKey, JSON.stringify({ format: 'xonix-pack-library.v1', packs: [pack] }));
    const options = { ...f.options, campaigns: [], decodeImage };
    await assert.rejects(prepareProfileTransfer(f.id, options), /matching included pack/);
    const result = await prepareProfileTransfer(f.id, {
      ...options,
      expandCampaigns: expandDifficultyCampaigns,
    });
    assert.equal(result.preview.profileAbsent, withProfile ? undefined : true);
    assert.equal(result.prepared.session.campaignKey, gentle.campaignKey);
    assert.deepEqual(result.prepared.session, attempt.session);
    assert.deepEqual(result.prepared.library, emptyLibrary());
  }
});

test('real transfer panel reviews empty-profile meaning, rechecks source and applies only the fresh journaled snapshot', async (t) => {
  const doc = new Document(),
    prior = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true });
  t.after(() =>
    prior ? Object.defineProperty(globalThis, 'document', prior) : delete globalThis.document,
  );
  const f = source(),
    attempt = live();
  f.local.set(f.k.sessionKey, JSON.stringify(attempt.session));
  const target = new Map(),
    assets = new Map(),
    events = [],
    targetKeys = keys('release-v0.31.0');
  const storage = {
    getItem: (key) => target.get(key) ?? null,
    setItem(key, value) {
      events.push(key);
      target.set(key, String(value));
    },
    removeItem: (key) => target.delete(key),
  };
  const adapters = {
    ...targetKeys,
    storage,
    readAsset: async (key) => assets.get(key) ?? null,
    writeAsset: async (key, value) => {
      events.push(key);
      assets.set(key, value);
    },
    withLock: (work) => work(),
    commitProfile: async (library, options) => {
      assert.equal(options.mode, 'replace');
      assert.equal(storage.getItem(targetKeys.lockKey), options.writeLock.token);
      storage.setItem(targetKeys.profileKey, exportLibrary(library));
      return { ok: true };
    },
  };
  attachProfileTransferPanel({
    api: { profileTransfer: f.options },
    container: doc.body,
    backupOptions: () => ({ campaigns: [campaign] }),
    task: (_id, work) => work(),
    applyPrepared: async (prepared) => {
      const result = await commitBackup(prepared, adapters);
      assert.equal(result.ok, true, result.warning);
      return { ...result, undo: false };
    },
  });
  const $ = (id) => doc.getElementById(id);
  // Select's automatic first-option value is the only omitted browser behavior.
  $('transfer-source').value = f.id;
  await $('transfer-review').onclick();
  assert.match($('transfer-preview').textContent, /empty collection and default preferences/);
  assert.equal(events.length, 0);
  f.local.set(
    f.k.profileKey,
    exportLibrary(updatePreferences(emptyLibrary(), { textSize: 'large' })),
  );
  await $('transfer-copy').onclick();
  assert.match($('transfer-status').textContent, /source changed/);
  assert.doesNotMatch(
    $('transfer-preview').textContent,
    /empty collection and default preferences/,
  );
  assert.equal(events.length, 0, 'A changed review never commits stale default preferences.');
  const before = structuredClone(f.local);
  await $('transfer-copy').onclick();
  assert.match($('transfer-status').textContent, /Copied from v0.29.2/);
  assert.equal(
    events[1],
    targetKeys.journalKey,
    'The target recovery journal precedes authoritative writes.',
  );
  assert.deepEqual(JSON.parse(target.get(targetKeys.sessionKey)), attempt.session);
  assert.equal(JSON.parse(target.get(targetKeys.profileKey)).preferences.textSize, 'large');
  assert.deepEqual(f.local, before);
  assert.equal(assets.get(targetKeys.journalKey), null);
});
