import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../data-json.mjs';
import {
  DEFAULT_PREFERENCES,
  LIBRARY_VERSION,
  LIBRARY_STORAGE_VERSION,
  emptyLibrary,
  importLibrary,
  exportLibrary,
  validateLibrary,
  updatePreferences,
  mergeLibraries,
  loadLibrary,
  saveLibrary,
} from '../library.mjs';
import { resolveControllerBindings } from '../controller-bindings.mjs';
import { BACKUP_FORMAT, prepareBackup, exportBackup } from '../backup.mjs';
import { commitBackup } from '../backup-storage.mjs';
import { emptyPackLibrary } from '../packs.mjs';
import { restoreSession } from '../sessions.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { claimProfileWriter } from '../profile-writer.mjs';
import {
  discoverProfileTransfers,
  prepareProfileTransfer,
  transferFingerprint,
} from '../profile-transfer.mjs';

// Original APIs emitted this fixture before preference edits. Tests require no
// archive installation and never derive old expected profiles from current code.
const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/controller-boost-profiles.json', import.meta.url)),
);
const latest = fixture.sources[1];
const hash = (value) => createHash('sha256').update(value).digest('hex');
const original = (source = latest) => JSON.parse(source.profileText);
const current = () => importLibrary(latest.profileText);
const optionsFor = (source = latest) => ({ campaigns: [source.campaign] });
const archive = (library, source = latest) => ({
  format: BACKUP_FORMAT,
  library,
  packs: emptyPackLibrary(),
  session: source.session,
});
function unchangedRecords(actual, expected) {
  for (const key of ['campaigns', 'gallery', 'scores', 'masteries'])
    assert.deepEqual(actual[key], expected[key] ?? []);
}
function storage(entries = {}) {
  const map = new Map(Object.entries(entries));
  const writes = [];
  return {
    map,
    writes,
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem(key, value) {
      writes.push([key, value]);
      map.set(key, String(value));
    },
    removeItem(key) {
      writes.push([key, null]);
      map.delete(key);
    },
  };
}
class Locks {
  held = new Set();
  async request(key, options, callback) {
    assert.equal(options.ifAvailable, true);
    assert.equal(options.mode, 'exclusive');
    if (this.held.has(key)) return callback(null);
    this.held.add(key);
    try {
      return await callback({ name: key, mode: 'exclusive' });
    } finally {
      this.held.delete(key);
    }
  }
}
function backupStorage(before) {
  const local = storage({
    profile: exportLibrary(before.library),
    session: JSON.stringify(before.session),
  });
  const assets = new Map([['packs', JSON.stringify(before.packs)]]);
  let fault = () => {};
  const api = {
    storage: local,
    profileKey: 'profile',
    sessionKey: 'session',
    packsKey: 'packs',
    journalKey: 'journal',
    lockKey: 'profile.backup-lock',
    readAsset: async (key) => structuredClone(assets.get(key) ?? null),
    writeAsset: async (key, value) => {
      fault(key, value);
      assets.set(key, structuredClone(value));
    },
    withLock: (task) => task(),
    commitProfile: (library, options) => saveLibrary(local, 'profile', library, null, options),
  };
  return { local, assets, api, fault: (next) => (fault = next) };
}

test('original v0.2/v0.12 exports and authority are pinned independently of current modules', () => {
  assert.equal(
    hash(canonicalJSON(fixture)),
    'bb589bb138c85193cc177c33fcbcaf2514327d3cb4bccc912b597f6be2b8977c',
  );
  assert.deepEqual(
    fixture.sources.map((source) => [source.version, source.revision]),
    [
      ['v0.2.0', 'eec303cc67914fa6a90db6bd209d41f2e7195ecb'],
      ['v0.12.0', '640f3e3570323394a22922261e8928634db7bf3b'],
    ],
  );
  for (const source of fixture.sources) {
    assert.equal(hash(source.profileText), source.profileSha256);
    assert.ok(source.files.some((file) => file.path === 'game/library.mjs'));
    assert.equal(source.futurePreferenceRejected, true);
    assert.equal(Object.hasOwn(original(source).preferences, 'controllerBoostMode'), false);
  }
});
for (const source of fixture.sources) {
  test(`${source.version} raw/enveloped profiles migrate omission to Hold without source writes`, () => {
    const old = original(source);
    const bytes = JSON.stringify(old);
    const migrated = importLibrary(old, optionsFor(source));
    assert.equal(DEFAULT_PREFERENCES.controllerBoostMode, 'hold');
    assert.equal(emptyLibrary().preferences.controllerBoostMode, 'hold');
    assert.equal(migrated.format, LIBRARY_VERSION);
    assert.deepEqual(migrated.preferences, {
      ...old.preferences,
      tapSteering: old.preferences.tapSteering ?? null,
      keyboardBindings: old.preferences.keyboardBindings ?? null,
      controllerBindings: old.preferences.controllerBindings ?? null,
      controllerBoostMode: 'hold',
      campaignDifficulty: 'standard',
      textSize: 'standard',
      screenControls: 'auto',
      touchControls: null,
    });
    unchangedRecords(migrated, old);
    assert.equal(JSON.stringify(old), bytes);
    for (const raw of [
      source.profileText,
      JSON.stringify({
        format: LIBRARY_STORAGE_VERSION,
        generation: 'generation-archived',
        library: old,
      }),
    ]) {
      const local = storage({ profile: raw });
      const loaded = loadLibrary(local, 'profile', optionsFor(source));
      assert.equal(loaded.recovery, null);
      assert.equal(loaded.warning, '');
      assert.equal(loaded.library.preferences.controllerBoostMode, 'hold');
      assert.equal(
        loaded.generation,
        raw === source.profileText ? 'legacy' : 'generation-archived',
      );
      unchangedRecords(loaded.library, old);
      assert.equal(local.getItem('profile'), raw);
      assert.deepEqual(local.writes, []);
    }
  });
}

test('Hold/Toggle roundtrip independently of remapped bindings, other preferences and collection', () => {
  const bindings = resolveControllerBindings();
  bindings.flight.buttons.boost = 7;
  const initial = updatePreferences(current(), {
    controllerBindings: bindings,
    musicGenre: 'metal',
  });
  const bytes = exportLibrary(initial);
  for (const controllerBoostMode of ['toggle', 'hold']) {
    const changed = updatePreferences(initial, { controllerBoostMode });
    const roundtrip = importLibrary(exportLibrary(changed));
    assert.equal(roundtrip.preferences.controllerBoostMode, controllerBoostMode);
    assert.deepEqual(roundtrip.preferences.controllerBindings, bindings);
    assert.equal(roundtrip.preferences.musicGenre, 'metal');
    unchangedRecords(roundtrip, initial);
    assert.equal(exportLibrary(initial), bytes);
  }
});

test('explicit malformed Boost modes reject before reads, profile writes or recovery writes', () => {
  const baseline = current();
  const before = exportLibrary(baseline);
  let reads = 0;
  const local = storage({ profile: before });
  local.getItem = () => {
    reads++;
    throw new Error('Storage must not be reached');
  };
  for (const controllerBoostMode of [
    undefined,
    null,
    false,
    true,
    0,
    1,
    '',
    'Hold',
    'TOGGLE',
    'toggle ',
    'auto',
    [],
    {},
  ]) {
    const candidate = {
      ...baseline,
      preferences: { ...baseline.preferences, controllerBoostMode },
    };
    assert.throws(() => updatePreferences(baseline, { controllerBoostMode }));
    assert.equal(validateLibrary(candidate).valid, false);
    assert.throws(() => importLibrary(candidate));
    assert.throws(() => mergeLibraries(candidate, baseline, { baseline }));
    assert.equal(
      saveLibrary(local, 'profile', candidate, 'corrupt-preserved', { mode: 'replace' }).ok,
      false,
    );
  }
  assert.equal(reads, 0);
  assert.deepEqual(local.writes, []);
  assert.equal(exportLibrary(baseline), before);
});

test('accessors, inherited modes, reserved keys and latch fields cannot masquerade as omitted defaults', () => {
  let reads = 0;
  const candidates = [];
  const accessor = current();
  Object.defineProperty(accessor.preferences, 'controllerBoostMode', {
    enumerable: true,
    get() {
      reads++;
      return 'toggle';
    },
  });
  candidates.push(accessor);
  const inherited = original();
  Object.setPrototypeOf(inherited.preferences, { controllerBoostMode: 'toggle' });
  candidates.push(inherited);
  for (const extra of ['controllerBoostLatched', '__proto__', 'constructor']) {
    const value = current();
    Object.defineProperty(value.preferences, extra, { value: true, enumerable: true });
    candidates.push(value);
  }
  const local = storage({ profile: latest.profileText });
  for (const value of candidates) {
    assert.throws(() => importLibrary(value));
    assert.equal(saveLibrary(local, 'profile', value).ok, false);
  }
  assert.equal(reads, 0);
  assert.deepEqual(local.writes, []);
  assert.equal(local.getItem('profile'), latest.profileText);
});

test('omitted stale baseline preserves a newer mode; deliberate Toggle and Hold changes remain explicit', () => {
  const baseline = original();
  const remote = updatePreferences(importLibrary(baseline), { controllerBoostMode: 'toggle' });
  const stale = updatePreferences(importLibrary(baseline), { musicVolume: 0.2 });
  const merged = mergeLibraries(stale, remote, { baseline });
  assert.equal(merged.preferences.controllerBoostMode, 'toggle');
  assert.equal(merged.preferences.musicVolume, 0.2);
  unchangedRecords(merged, remote);
  const hold = updatePreferences(remote, { controllerBoostMode: 'hold' });
  assert.equal(
    mergeLibraries(hold, remote, { baseline: remote }).preferences.controllerBoostMode,
    'hold',
  );
  assert.equal(
    mergeLibraries(remote, stale, { baseline }).preferences.controllerBoostMode,
    'toggle',
  );
});

test('storage save returns the actual merged Boost mode after an unrelated stale setting edit', () => {
  const local = storage({ profile: latest.profileText });
  const baseline = loadLibrary(local, 'profile');
  const options = { baseline: baseline.library, generation: baseline.generation };
  const selected = saveLibrary(
    local,
    'profile',
    updatePreferences(baseline.library, { controllerBoostMode: 'toggle' }),
    null,
    options,
  );
  assert.equal(selected.ok, true);
  const stale = updatePreferences(baseline.library, { musicGenre: 'rock' });
  const saved = saveLibrary(local, 'profile', stale, null, options);
  assert.equal(saved.ok, true);
  assert.equal(stale.preferences.controllerBoostMode, 'hold');
  assert.equal(saved.library.preferences.controllerBoostMode, 'toggle');
  assert.equal(saved.library.preferences.musicGenre, 'rock');
  assert.deepEqual(loadLibrary(local, 'profile').library, saved.library);
  unchangedRecords(saved.library, baseline.library);
});

test('profile replacement and Undo restore the mode with fresh generations and reject stale resurrection', () => {
  const prior = current();
  const local = storage({ profile: exportLibrary(prior) });
  const incoming = updatePreferences(prior, { controllerBoostMode: 'toggle' });
  const adopted = saveLibrary(local, 'profile', importLibrary(exportLibrary(incoming)), null, {
    mode: 'replace',
  });
  assert.equal(adopted.ok, true);
  assert.equal(adopted.library.preferences.controllerBoostMode, 'toggle');
  const undone = saveLibrary(local, 'profile', prior, null, { mode: 'replace' });
  assert.equal(undone.ok, true);
  assert.equal(undone.library.preferences.controllerBoostMode, 'hold');
  assert.notEqual(undone.generation, adopted.generation);
  const bytes = local.getItem('profile');
  assert.equal(
    saveLibrary(local, 'profile', adopted.library, null, {
      baseline: adopted.library,
      generation: adopted.generation,
    }).ok,
    false,
  );
  assert.equal(local.getItem('profile'), bytes);
  unchangedRecords(undone.library, prior);
});

test('quota failure preserves the requested session preference and exact prior stored collection', () => {
  const selected = updatePreferences(current(), { controllerBoostMode: 'toggle' });
  const local = storage({ profile: latest.profileText });
  local.setItem = () => {
    throw new Error('quota exhausted');
  };
  const result = saveLibrary(local, 'profile', selected);
  assert.equal(result.ok, false);
  assert.match(result.warning, /quota|session|storage|save/i);
  assert.equal(selected.preferences.controllerBoostMode, 'toggle');
  assert.equal(importLibrary(exportLibrary(selected)).preferences.controllerBoostMode, 'toggle');
  assert.equal(local.getItem('profile'), latest.profileText);
  assert.deepEqual(local.writes, []);
});

test('secondary/no-lock sessions can own and export a mode without obtaining the profile writer lease', async () => {
  const locks = new Locks();
  const owner = await claimProfileWriter(locks, 'profile.writer');
  const local = storage({ profile: latest.profileText });
  try {
    for (const manager of [locks, undefined]) {
      const session = await claimProfileWriter(manager, 'profile.writer');
      assert.equal(session.writable, false);
      assert.match(session.reason, /session-only/);
      const selected = updatePreferences(loadLibrary(local, 'profile').library, {
        controllerBoostMode: 'toggle',
      });
      assert.equal(
        importLibrary(exportLibrary(selected)).preferences.controllerBoostMode,
        'toggle',
      );
      const ready = await prepareBackup(archive(selected), optionsFor());
      const full = await prepareBackup(await exportBackup(ready, optionsFor()), optionsFor());
      assert.equal(full.library.preferences.controllerBoostMode, 'toggle');
      assert.equal(local.getItem('profile'), latest.profileText);
      assert.deepEqual(local.writes, []);
      session.release();
    }
  } finally {
    owner.release();
  }
});

for (const source of fixture.sources) {
  test(`${source.version} complete backup migrates profile only and preserves held-Boost suspended authority`, async () => {
    const candidate = archive(original(source), source);
    const before = JSON.stringify(candidate);
    const ready = await prepareBackup(candidate, optionsFor(source));
    assert.equal(ready.library.preferences.controllerBoostMode, 'hold');
    unchangedRecords(ready.library, original(source));
    assert.deepEqual(ready.session, source.session);
    assert.equal(ready.session.replay.segments.at(-1).input.boost, true);
    const restored = await restoreSession(ready.session, {
      campaign: source.campaign,
      campaignKey: source.campaignKey,
    });
    assert.deepEqual(authoritativeCheckpoint(restored.run), source.session.replay.checkpoint);
    assert.equal(verifyReplay(source.recording).match, true);
    assert.equal(JSON.stringify(candidate), before);
  });
}

test('Toggle backup transports mode metadata without adding input preferences or live latch to sessions', async () => {
  const selected = updatePreferences(current(), { controllerBoostMode: 'toggle' });
  const ready = await prepareBackup(archive(selected), optionsFor());
  const restored = await prepareBackup(await exportBackup(ready, optionsFor()), optionsFor());
  assert.equal(restored.library.preferences.controllerBoostMode, 'toggle');
  assert.deepEqual(restored.session, latest.session);
  assert.equal(JSON.stringify(restored.session).includes('controllerBoost'), false);
  assert.equal(
    Object.keys(restored.library.preferences).some((key) => /latched/i.test(key)),
    false,
  );
  assert.ok(Object.isFrozen(restored.library.preferences));
});

test('bad backup mode rejects before image decoding or caller adoption', async () => {
  const pack = JSON.parse(
    readFileSync(new URL('../content/packs/night-shift.json', import.meta.url)),
  );
  pack.visualOverrides.background = {
    name: 'pixel.png',
    dataUrl:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=',
  };
  const candidate = archive(current());
  candidate.packs = { format: 'xonix-pack-library.v1', packs: [pack] };
  candidate.library.preferences.controllerBoostMode = 'automatic';
  let decodes = 0;
  await assert.rejects(
    prepareBackup(candidate, {
      ...optionsFor(),
      decodeImage: async () => {
        decodes++;
        return { naturalWidth: 1, naturalHeight: 1 };
      },
    }),
    /Boost mode/,
  );
  assert.equal(decodes, 0);
});

test('journaled complete-backup import and Undo restore modes without changing suspended inputs', async () => {
  const before = await prepareBackup(archive(current()), optionsFor());
  const incoming = await prepareBackup(
    archive(updatePreferences(current(), { controllerBoostMode: 'toggle' })),
    optionsFor(),
  );
  const h = backupStorage(before);
  const imported = await commitBackup(incoming, h.api);
  assert.equal(imported.ok, true, imported.warning);
  assert.equal(imported.profile.library.preferences.controllerBoostMode, 'toggle');
  assert.equal(h.assets.get('journal'), null);
  assert.deepEqual(JSON.parse(h.local.getItem('session')), latest.session);
  const undone = await commitBackup(before, h.api);
  assert.equal(undone.ok, true, undone.warning);
  assert.equal(undone.profile.library.preferences.controllerBoostMode, 'hold');
  assert.notEqual(undone.profile.generation, imported.profile.generation);
  assert.deepEqual(loadLibrary(h.local, 'profile').library, before.library);
  assert.equal(h.local.getItem('profile.backup-lock'), null);
});

test('failed full-backup finalization rolls mode and profile generation back to exact original bytes', async () => {
  const before = await prepareBackup(archive(current()), optionsFor());
  const incoming = await prepareBackup(
    archive(updatePreferences(current(), { controllerBoostMode: 'toggle' })),
    optionsFor(),
  );
  const h = backupStorage(before);
  const raw = new Map(h.local.map),
    assets = new Map(h.assets);
  let failed = false;
  h.fault((key, value) => {
    if (key === 'journal' && value === null && !failed) {
      failed = true;
      throw new Error('final journal write failed');
    }
  });
  const result = await commitBackup(incoming, h.api);
  assert.equal(result.ok, false);
  assert.equal(result.rolledBack, true, result.warning);
  assert.deepEqual(h.local.map, raw);
  for (const [key, value] of assets) assert.equal(h.assets.get(key), value);
  assert.equal(h.assets.get('journal'), null);
  assert.equal(loadLibrary(h.local, 'profile').library.preferences.controllerBoostMode, 'hold');
});

for (const source of fixture.sources) {
  test(`${source.version} previous-release copy normalizes Hold without source or checkpoint mutation`, async () => {
    const channel = source.version === 'v0.2.0' ? 'release' : `release-${source.version}`;
    const profileKey = `revealline.library.${channel}.v1`;
    const sessionKey = `revealline.suspended.${channel}.v1`;
    const local = storage({
      [profileKey]: source.profileText,
      [sessionKey]: JSON.stringify(source.session),
    });
    const prior = new Map(local.map);
    const locks = new Locks();
    const options = {
      ...optionsFor(source),
      storage: local,
      readAsset: async () => null,
      lockManager: locks,
      currentVersion: 'v0.13.0',
    };
    const descriptor = discoverProfileTransfers(options).find(
      (entry) => entry.profileKey === profileKey,
    );
    assert.ok(descriptor);
    const result = await prepareProfileTransfer(descriptor.id, options);
    assert.equal(result.prepared.library.preferences.controllerBoostMode, 'hold');
    assert.equal(result.preview.pictures, 1);
    assert.equal(result.preview.hasSession, true);
    assert.deepEqual(result.prepared.session, source.session);
    assert.deepEqual(local.map, prior);
    assert.deepEqual(local.writes, []);
    assert.equal(locks.held.size, 0);
  });
}

test('transfer fingerprint distinguishes an explicit mode change but normalizes old omission to Hold', async () => {
  const absent = await prepareBackup(archive(original()), optionsFor());
  const hold = await prepareBackup(archive(current()), optionsFor());
  const toggle = await prepareBackup(
    archive(updatePreferences(current(), { controllerBoostMode: 'toggle' })),
    optionsFor(),
  );
  assert.equal(await transferFingerprint(absent), await transferFingerprint(hold));
  assert.notEqual(await transferFingerprint(hold), await transferFingerprint(toggle));
});
