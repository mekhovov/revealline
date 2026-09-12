import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareBackup, BACKUP_FORMAT } from '../backup.mjs';
import { emptyLibrary } from '../library.mjs';
import { emptyPackLibrary } from '../packs.mjs';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import { createRecorder, recordInput } from '../replay.mjs';
import { suspendSession, SESSION_STORAGE_BYTES } from '../sessions.mjs';
import { campaignKey } from '../library.mjs';
import { commitBackup, recoverBackupImport, BACKUP_JOURNAL_FORMAT } from '../backup-storage.mjs';

const keys = {
  profileKey: 'profile',
  packsKey: 'packs',
  sessionKey: 'session',
  journalKey: 'journal',
  lockKey: 'profile.backup-lock',
};
const prior = {
  profile: '{old profile bytes}',
  session: '{old session bytes}',
  packs: '{old pack bytes}',
};
const prepared = () =>
  prepareBackup({
    format: BACKUP_FORMAT,
    library: emptyLibrary(),
    packs: emptyPackLibrary(),
    session: null,
  });
function harness(initial = prior) {
  const local = new Map(Object.entries(initial).filter(([key]) => key !== 'packs'));
  const assets = new Map([['packs', initial.packs ?? null]]);
  const events = [];
  let fault = () => {},
    onWrite = () => {};
  const storage = {
    getItem: (key) => local.get(key) ?? null,
    setItem(key, value) {
      fault('local', key, value);
      local.set(key, String(value));
      events.push(['local', key, value]);
      onWrite();
    },
    removeItem(key) {
      fault('remove', key, null);
      local.delete(key);
      events.push(['remove', key]);
      onWrite();
    },
  };
  const api = {
    ...keys,
    storage,
    readAsset: async (key) => {
      fault('read', key);
      return structuredClone(assets.get(key) ?? null);
    },
    writeAsset: async (key, value) => {
      fault('asset', key, value);
      assets.set(key, structuredClone(value));
      events.push(['asset', key, value]);
      onWrite();
      fault('after-asset', key, value);
    },
    withLock: (task) => task(),
    commitProfile: async (library, options) => {
      assert.equal(storage.getItem(keys.lockKey), options.writeLock.token);
      assert.equal(options.writeLock.key, keys.lockKey);
      assert.equal(options.mode, 'replace');
      storage.setItem(keys.profileKey, JSON.stringify(library));
      return { ok: true, generation: 'new-generation', baseline: 'new-baseline' };
    },
  };
  return {
    api,
    local,
    assets,
    events,
    fault: (fn) => {
      fault = fn;
    },
    onWrite: (fn) => {
      onWrite = fn;
    },
    values: () => ({
      profile: local.get('profile') ?? null,
      session: local.get('session') ?? null,
      packs: assets.get('packs') ?? null,
    }),
  };
}
function journal(previous = prior) {
  return {
    format: BACKUP_JOURNAL_FORMAT,
    token: 'interrupted-owner',
    targets: {
      profileKey: keys.profileKey,
      packsKey: keys.packsKey,
      sessionKey: keys.sessionKey,
      lockKey: keys.lockKey,
    },
    previous,
  };
}
test('coordinated import journals original bytes before writes and commits profile in replace mode', async () => {
  const h = harness();
  const result = await commitBackup(await prepared(), h.api);
  assert.equal(result.ok, true);
  assert.equal(result.profile.generation, 'new-generation');
  const writes = h.events.filter((e) => e[1] !== keys.lockKey);
  assert.deepEqual(
    writes.map((e) => e.slice(0, 2)),
    [
      ['asset', 'journal'],
      ['asset', 'packs'],
      ['remove', 'session'],
      ['local', 'profile'],
      ['asset', 'journal'],
    ],
  );
  assert.deepEqual(writes[0][2].previous, prior);
  assert.equal(h.assets.get('journal'), null);
  assert.equal(h.local.get(keys.lockKey), undefined);
  assert.equal(JSON.parse(h.values().profile).format, 'xonix-library.v1');
  assert.equal(JSON.parse(h.values().packs).format, 'xonix-pack-library.v1');
  assert.equal(h.values().session, null);
});
test('a journal write failure performs no player-data writes', async () => {
  const h = harness();
  h.fault((kind, key) => {
    if (kind === 'asset' && key === 'journal') throw new Error('quota');
  });
  const result = await commitBackup(await prepared(), h.api);
  assert.equal(result.ok, false);
  assert.equal(result.recoveryRequired, false);
  assert.deepEqual(h.values(), prior);
  assert.equal(
    h.events.some((e) => ['packs', 'profile', 'session'].includes(e[1])),
    false,
  );
  assert.equal(h.local.has(keys.lockKey), false);
});
test('each apply-stage failure rolls back exact raw values and absent entries', async () => {
  for (const failure of ['packs', 'session', 'profile', 'journal-clear', 'profile-result']) {
    const h = harness();
    let fired = false;
    h.fault((kind, key, value) => {
      const matching =
        failure === 'packs'
          ? kind === 'asset' && key === 'packs'
          : failure === 'session'
            ? kind === 'remove' && key === 'session'
            : failure === 'profile'
              ? kind === 'local' && key === 'profile'
              : failure === 'journal-clear'
                ? kind === 'asset' && key === 'journal' && value === null
                : false;
      if (!fired && matching) {
        fired = true;
        throw new Error(`failed ${failure}`);
      }
    });
    if (failure === 'profile-result')
      h.api.commitProfile = async () => ({ ok: false, warning: 'profile rejected' });
    const result = await commitBackup(await prepared(), h.api);
    assert.equal(result.ok, false, failure);
    assert.equal(result.rolledBack, true, failure);
    assert.deepEqual(h.values(), prior, failure);
    assert.equal(h.assets.get('journal'), null);
    assert.equal(h.local.has(keys.lockKey), false);
  }
  const empty = harness({ packs: null });
  empty.api.commitProfile = async () => ({ ok: false, warning: 'denied' });
  assert.equal((await commitBackup(await prepared(), empty.api)).rolledBack, true);
  assert.deepEqual(empty.values(), { profile: null, session: null, packs: null });
});
test('startup recovery rolls back crashes after journal, packs, session or profile stages', async () => {
  for (const stage of ['journal', 'packs', 'session', 'profile']) {
    const h = harness();
    h.assets.set('journal', journal());
    h.local.set(keys.lockKey, 'interrupted-owner');
    if (stage !== 'journal') h.assets.set('packs', 'new packs');
    if (stage === 'session' || stage === 'profile') h.local.delete('session');
    if (stage === 'profile') h.local.set('profile', 'new profile');
    const result = await recoverBackupImport(h.api);
    assert.equal(result.ok, true, stage);
    assert.equal(result.recovered, true, stage);
    assert.deepEqual(h.values(), prior, stage);
    assert.equal(h.assets.get('journal'), null);
    assert.equal(h.local.has(keys.lockKey), false);
    assert.deepEqual(await recoverBackupImport(h.api), { ok: true, recovered: false, warning: '' });
  }
});
test('rollback failure retains journal and ownership until a later successful recovery', async () => {
  const h = harness();
  let imports = 0;
  h.fault((kind, key, value) => {
    if (kind === 'asset' && key === 'packs') {
      imports++;
      if (value === prior.packs) throw new Error('disk full during rollback');
    }
  });
  h.api.commitProfile = async () => ({ ok: false, warning: 'stale profile' });
  const result = await commitBackup(await prepared(), h.api);
  assert.equal(result.recoveryRequired, true);
  assert.equal(result.rolledBack, false);
  assert.equal(imports, 2);
  assert.deepEqual(h.assets.get('journal').previous, prior);
  assert.ok(h.local.get(keys.lockKey));
  const again = await commitBackup(await prepared(), h.api);
  assert.equal(again.ok, false);
  assert.match(again.warning, /unfinished backup import/);
  h.fault(() => {});
  assert.equal((await recoverBackupImport(h.api)).recovered, true);
  assert.deepEqual(h.values(), prior);
});
test('an uncertain journal-clear error restores its record before rollback', async () => {
  const h = harness();
  let failed = false;
  h.fault((kind, key, value) => {
    if (!failed && kind === 'after-asset' && key === 'journal' && value === null) {
      failed = true;
      throw new Error('unknown acknowledgment');
    }
  });
  const result = await commitBackup(await prepared(), h.api);
  assert.equal(result.rolledBack, true);
  assert.deepEqual(h.values(), prior);
  assert.equal(
    h.events.filter((e) => e[0] === 'asset' && e[1] === 'journal' && e[2] !== null).length,
    2,
  );
});
test('uncertain journal creation leaves recoverable metadata without changing player values', async () => {
  const h = harness();
  let once = false;
  h.fault((kind, key, value) => {
    if (!once && kind === 'after-asset' && key === 'journal' && value !== null) {
      once = true;
      throw new Error('acknowledgment lost');
    }
  });
  const result = await commitBackup(await prepared(), h.api);
  assert.equal(result.recoveryRequired, true);
  assert.deepEqual(h.values(), prior);
  assert.ok(h.assets.get('journal'));
  assert.equal((await recoverBackupImport(h.api)).recovered, true);
});
test('malformed, wrong-target and executable journal data are preserved without game writes', async () => {
  for (const corrupt of [
    '{not JSON',
    { ...journal(), format: 'wrong' },
    { ...journal(), targets: { ...journal().targets, profileKey: 'other-user' } },
    { ...journal(), execute: 'script' },
    { ...journal(), previous: { profile: prior.profile, session: prior.session } },
  ]) {
    const h = harness();
    h.assets.set('journal', corrupt);
    const result = await recoverBackupImport(h.api);
    assert.equal(result.ok, false);
    assert.equal(result.recoveryRequired, true);
    assert.deepEqual(h.values(), prior);
    assert.deepEqual(h.assets.get('journal'), corrupt);
    assert.equal(h.events.length, 0);
  }
});
test('orphan lock cleanup requires exclusive ownership, and unprepared imports never write', async () => {
  const h = harness();
  h.local.set(keys.lockKey, 'orphan');
  assert.equal((await commitBackup(await prepared(), h.api)).ok, false);
  assert.equal((await recoverBackupImport(h.api)).recovered, true);
  assert.deepEqual(h.values(), prior);
  h.events.length = 0;
  assert.equal((await commitBackup(structuredClone(await prepared()), h.api)).ok, false);
  assert.equal(h.events.length, 0);
  assert.equal(
    (await commitBackup(await prepared(), { ...h.api, packsKey: keys.profileKey })).ok,
    false,
  );
});
test('same-page concurrent import is rejected while exclusive operation retains ownership', async () => {
  const h = harness();
  const ready = await prepared();
  let release;
  h.api.withLock = (task) =>
    new Promise((resolve) => {
      release = () => resolve(task());
    });
  const first = commitBackup(ready, h.api);
  const second = await commitBackup(ready, h.api);
  assert.equal(second.ok, false);
  assert.match(second.warning, /already running/);
  release();
  assert.equal((await first).ok, true);
});
test('journal captures profile after ordinary writers are blocked, including concurrent pre-lock edits', async () => {
  const h = harness();
  const originalRead = h.api.readAsset;
  h.api.readAsset = async (key) => {
    const result = await originalRead(key);
    if (key === 'journal' && result === null && !h.local.has(keys.lockKey))
      h.local.set('profile', 'latest pre-lock progress');
    return result;
  };
  h.api.commitProfile = async () => ({ ok: false, warning: 'fail to test rollback' });
  const result = await commitBackup(await prepared(), h.api);
  assert.equal(result.rolledBack, true);
  assert.equal(h.values().profile, 'latest pre-lock progress');
});
test('a valid large portable attempt cannot bypass the smaller local-slot budget', async () => {
  const level = {
    version: 'xonix-level.v1',
    id: 'long-idle',
    revision: '1',
    name: 'Long idle',
    width: 48,
    height: 36,
    spawn: { x: 24.5, y: 0.5 },
    walls: [],
    objectives: [],
    supplies: [],
    enemies: [{ id: 'anchor', type: 'bouncer', x: 40.5, y: 25.5, vx: 0, vy: 0, radius: 0.3 }],
    goal: { coverage: 0.7 },
  };
  const campaign = { id: 'long-idle', revision: '1', levels: [level], classRecipes: CLASSES };
  const run = createRun(level),
    recorder = createRecorder(level);
  for (let tick = 0; tick < 21000; tick++) {
    const command = { boost: tick % 2 === 0 };
    stepRun(run, command, FIXED_DT);
    recordInput(recorder, command);
  }
  const session = suspendSession({
    run,
    recorder,
    campaignKey: campaignKey(campaign),
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: 'long-idle',
  });
  assert.ok(new TextEncoder().encode(JSON.stringify(session)).byteLength > SESSION_STORAGE_BYTES);
  const ready = await prepareBackup(
    { format: BACKUP_FORMAT, library: emptyLibrary(), packs: emptyPackLibrary(), session },
    { campaigns: [campaign] },
  );
  const h = harness();
  const result = await commitBackup(ready, h.api);
  assert.equal(result.ok, false);
  assert.match(result.warning, /2 MiB local slot/);
  assert.equal(h.events.length, 0);
  assert.deepEqual(h.values(), prior);
});
test(
  'a host without exclusive locking can export but cannot mutate through full import',
  { skip: !!globalThis.navigator?.locks?.request },
  async () => {
    const h = harness();
    delete h.api.withLock;
    assert.equal((await recoverBackupImport(h.api)).ok, true);
    const result = await commitBackup(await prepared(), h.api);
    assert.equal(result.ok, false);
    assert.match(result.warning, /Web Locks/);
    assert.equal(h.events.length, 0);
    h.assets.set('journal', journal());
    assert.equal((await recoverBackupImport(h.api)).ok, false);
    assert.deepEqual(h.values(), prior);
  },
);
