import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import {
  combatEditionSources,
  createCombatSoloHost,
  createCombatVersusHost,
} from '../content-design/combat-host.mjs';
import { createCombatCandidates } from '../content-design/combat-candidates.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { acquireCandidatePicture, isCandidatePictureFor } from '../content-design/picture.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { authoritativeCheckpoint, recordInput } from '../replay.mjs';
import { stepRun, FIXED_DT } from '../core/index.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';

const { themes } = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
);
const options = { themes, corePackIds: ['optional-robots'], buildVersion: 'combat-host-test' };
const modes = ['authored', 'on', 'off'];
const difficulties = ['gentle', 'standard', 'expert'];
const studySource = () => {
  const source = createCombatCandidates();
  // Host-contract fixture uses an existing exact theme, without claiming the
  // unqualified combat greybox has a released picture/theme edition.
  for (const mission of source.missions) mission.presentation.themeId = themes[0].id;
  return source;
};
const makeSolo = (source = studySource(), extra = {}) =>
  createCombatSoloHost(source, { ...options, ...extra });
const request = (host, mission = host.catalog.missions[0], difficulty = 'standard') => ({
  missionId: mission.id,
  difficulty,
  seed: 42,
  turnPolicy: 'immediate',
  executionKey: host.select(mission, difficulty).executionKey,
});
const frozen = (value) => {
  if (!value || typeof value !== 'object') return;
  assert(Object.isFrozen(value), 'Every exposed edition node is immutable');
  for (const child of Object.values(value)) frozen(child);
};
const absentSource = () => {
  const source = createCombatCandidates();
  for (const mission of source.missions) {
    delete mission.combat;
    mission.actors = mission.actors.filter((actor) => !actor.role.startsWith('optional-'));
  }
  return source;
};

// Complete one-pixel PNG fixture, not artwork qualification. The same real
// digest/byte/dimension gate used by shipped originals remains in the test.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const asset = {
  format: 'AssetRevisionV1',
  id: 'combat-host-fixture',
  revision: 'r1',
  kind: 'reveal-background',
  path: 'content-design/assets/combat-host-fixture/pixel.png',
  sha256: createHash('sha256').update(png).digest('hex'),
  bytes: png.length,
  width: 1,
  height: 1,
  alt: 'Synthetic one-pixel host-boundary test fixture.',
  review: 'candidate',
};
const picturedSource = () => {
  const source = studySource();
  source.assets = [structuredClone(asset)];
  for (const mission of source.missions) mission.presentation.backgroundAssetId = asset.id;
  return source;
};
const mediaFor = (pin = asset, bytes = png) =>
  loadPreviewArtwork(pin, {
    fetchAsset: async () => new Response(bytes),
    digest: (value) => webcrypto.subtle.digest('SHA-256', value),
  });
function pictureBrowser(t, fetchFixture = async () => new Response(png)) {
  const images = [];
  class FixtureImage {
    width = 1;
    height = 1;
    naturalWidth = 1;
    naturalHeight = 1;
    closed = 0;
    removed = 0;
    constructor() {
      images.push(this);
    }
    set src(value) {
      assert.equal(value, `data:image/png;base64,${png.toString('base64')}`);
      queueMicrotask(() => this.onload?.());
    }
    async decode() {}
    removeAttribute() {
      this.removed++;
    }
    close() {
      this.closed++;
    }
  }
  for (const [key, value] of [
    ['Image', FixtureImage],
    ['crypto', webcrypto],
  ]) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() =>
      descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key],
    );
  }
  t.mock.method(globalThis, 'fetch', (url, controls) => {
    assert(String(url).endsWith(asset.path));
    return fetchFixture(url, controls);
  });
  return images;
}

test('authored/on/off editions own frozen canonical snapshots and deduplicate only identical editions', () => {
  const source = createCombatCandidates(),
    before = structuredClone(source);
  const editions = combatEditionSources(source);
  assert.deepEqual([...editions.keys()], modes);
  assert.equal(editions.get('authored'), editions.get('on'));
  assert.notEqual(editions.get('authored'), editions.get('off'));
  for (const edition of new Set(editions.values())) frozen(edition);
  assert.deepEqual(source, before);
  for (const mode of modes) {
    const edition = editions.get(mode);
    assert.deepEqual(edition.maps, before.maps);
    assert.deepEqual(
      edition.missions.map((m) => m.actors),
      before.missions.map((m) => m.actors),
    );
    assert(edition.missions.every((m) => m.combat.enabled === (mode !== 'off')));
  }
  source.missions[0].actors[0].x = 999;
  assert.deepEqual(editions.get('authored'), compileContentProject(before).source);
  const repeated = combatEditionSources(before);
  for (const mode of modes) assert.deepEqual(repeated.get(mode), editions.get(mode));
});

test('mixed authored flags produce three deterministic editions directly from canonical source', () => {
  const source = createCombatCandidates();
  source.missions[1].combat.enabled = false;
  const editions = combatEditionSources(source);
  assert.equal(new Set(editions.values()).size, 3);
  assert.deepEqual(
    editions.get('authored').missions.map((m) => m.combat.enabled),
    [true, false, true],
  );
  for (const mode of modes) {
    const a = createContentExecutionCatalog(editions.get(mode));
    const b = createContentExecutionCatalog(combatEditionSources(source).get(mode));
    assert.deepEqual(
      a.entries.map((e) => e.executionKey),
      b.entries.map((e) => e.executionKey),
    );
  }
});

test('absence is not disabled authoring and On never inserts optional actors into unauthored maps', () => {
  const source = absentSource(),
    editions = combatEditionSources(source);
  assert.equal(new Set(editions.values()).size, 1);
  const host = makeSolo(source);
  assert.equal(host.entries.length, 3);
  assert(
    host.entries.every((e) =>
      e.campaign.levels.every((l) => !Object.hasOwn(l.classic, 'combatPatrols')),
    ),
  );
  host.preparer.dispose();
  for (const mission of source.missions)
    mission.combat = { version: 'mission-combat.v1', enabled: false };
  const disabled = combatEditionSources(source);
  assert.equal(disabled.get('authored'), disabled.get('off'));
  assert.notEqual(disabled.get('on'), disabled.get('off'));
  const off = createContentExecutionCatalog(disabled.get('off'));
  assert(
    off.entries.every((e) =>
      e.campaign.levels.every(
        (l) =>
          l.classic.combatPatrols.enabled === false && l.classic.combatPatrols.actors.length === 0,
      ),
    ),
  );
});

test('Solo union owns every stable variant, maps back to canonical missions, and rejects lookalikes', () => {
  let mode = 'authored';
  const host = makeSolo(undefined, { getCombatMode: () => mode });
  const mission = host.catalog.missions[0],
    selected = new Map();
  assert.equal(host.entries.length, 6);
  frozen(host.entries);
  for (const choice of modes) {
    mode = choice;
    const entry = host.select(mission, 'standard');
    selected.set(choice, entry);
    assert(host.owns(entry));
    assert.equal(host.mission(entry, 0), mission);
    assert.equal(host.select(mission, 'standard'), entry);
    assert.equal(host.card(mission).preset, 'standard');
    assert.equal(host.card(mission), host.card(mission));
    assert.equal(
      host.visualThemeSelection(entry, entry.campaign.levels[0]).level,
      entry.campaign.levels[0],
    );
    assert.equal(host.visualThemeSelection(entry, structuredClone(entry.campaign.levels[0])), null);
  }
  assert.equal(selected.get('authored'), selected.get('on'));
  assert.notEqual(selected.get('authored'), selected.get('off'));
  assert.notEqual(selected.get('authored').executionKey, selected.get('off').executionKey);
  assert.equal(host.owns({ ...selected.get('authored') }), false);
  assert.equal(host.select({ ...mission }, 'standard'), null);
  assert.equal(host.card({ ...mission }), null);
  assert.equal(host.mission({}, 0), null);
  assert.equal(host.isCore(mission.id), true);
  assert.equal(host.next(mission.id), host.catalog.missions[1]);
  mode = 'invalid';
  assert.throws(() => host.select(mission, 'standard'), /preference/);
  host.preparer.dispose();
});

test('exact execution key prepares and restores the selected edition after preference changes', async () => {
  let mode = 'on';
  const source = studySource();
  const host = makeSolo(source, { getCombatMode: () => mode });
  const selected = request(host),
    onEntry = host.select(host.catalog.missions[0], 'standard');
  mode = 'off';
  const prepared = await host.preparer.prepare(selected);
  assert.equal(prepared.entry.executionKey, onEntry.executionKey);
  assert.equal(prepared.run.level.classic.combatPatrols.enabled, true);
  assert(host.preparer.current(prepared));
  for (let tick = 0; tick < 12; tick++) {
    const input = { direction: 'right' };
    recordInput(prepared.recorder, input);
    stepRun(prepared.run, input, FIXED_DT);
  }
  const saved = suspendSession({
    run: prepared.run,
    recorder: prepared.recorder,
    campaignKey: onEntry.executionKey,
    themeId: prepared.theme.id,
    bodyId: 'scout',
    runId: 'combat-host-restore',
    savedAt: '2026-09-21T12:00:00.000Z',
  });
  const restoredHost = makeSolo(source, { getCombatMode: () => 'off' });
  const owned = restoredHost.entries.find((e) => e.executionKey === saved.campaignKey);
  assert(owned && restoredHost.owns(owned));
  assert.equal(restoredHost.mission(owned, 0), restoredHost.catalog.missions[0]);
  const restored = await restoreSession(saved, {
    campaign: owned.campaign,
    campaignKey: owned.executionKey,
  });
  assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(prepared.run));
  assert.equal(restored.run.level.classic.combatPatrols.enabled, true);
  const off = restoredHost.select(restoredHost.catalog.missions[0], 'standard');
  await assert.rejects(
    restoreSession(saved, { campaign: off.campaign, campaignKey: off.executionKey }),
    /different campaign/,
  );
  host.preparer.dispose();
  restoredHost.preparer.dispose();
});

test('invalid and pre-aborted requests preserve the existing prepared replacement', async () => {
  const host = makeSolo(),
    selected = request(host);
  const prepared = await host.preparer.prepare(selected);
  for (const changes of [
    { missionId: 'foreign' },
    { difficulty: 'automatic' },
    { seed: -1 },
    { seed: 2 ** 32 },
    { turnPolicy: 'automatic' },
    { executionKey: 'foreign' },
    { officialProgressEligible: true },
    { difficulty: 'gentle', executionKey: selected.executionKey },
  ]) {
    await assert.rejects(host.preparer.prepare({ ...selected, ...changes }));
    assert(host.preparer.current(prepared));
  }
  const missing = { ...selected };
  delete missing.executionKey;
  await assert.rejects(host.preparer.prepare(missing));
  let reads = 0;
  await assert.rejects(
    host.preparer.prepare({
      ...selected,
      get seed() {
        reads++;
        return 1;
      },
    }),
  );
  assert.equal(reads, 0);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(host.preparer.prepare(selected, { signal: controller.signal }), {
    name: 'AbortError',
  });
  assert(host.preparer.current(prepared));
  host.preparer.dispose();
});

test('Solo cancellation, replacement, take-once and disposal retain exact candidate ownership', async () => {
  const host = makeSolo(),
    selected = request(host);
  const first = await host.preparer.prepare(selected);
  assert.equal(host.preparer.current({ ...first }), false);
  assert.throws(() => host.preparer.take({ ...first }), /current/);
  host.preparer.cancel();
  assert.equal(host.preparer.current(first), false);
  assert.throws(() => host.preparer.take(first), /current/);
  const second = await host.preparer.prepare(selected);
  assert.equal(host.preparer.take(second), second);
  assert.equal(host.preparer.current(second), false);
  assert.throws(() => host.preparer.take(second), /current/);
  const third = await host.preparer.prepare(selected);
  const fourth = await host.preparer.prepare({ ...selected, seed: 43 });
  assert.equal(host.preparer.current(third), false);
  assert(host.preparer.current(fourth));
  host.preparer.dispose();
  host.preparer.dispose();
  assert.equal(host.preparer.current(fourth), false);
  await assert.rejects(host.preparer.prepare(selected), /disposed/);
});

test('observer cancellation and cross-edition replacement cannot adopt an older preparation', async () => {
  let mode = 'on';
  const host = makeSolo(undefined, { getCombatMode: () => mode });
  const on = request(host);
  mode = 'off';
  const off = request(host);
  await assert.rejects(
    host.preparer.prepare(on, {
      onStatus() {
        host.preparer.cancel();
      },
    }),
    { name: 'AbortError' },
  );
  let replacement;
  await assert.rejects(
    host.preparer.prepare(on, {
      onStatus() {
        replacement ??= host.preparer.prepare(off);
      },
    }),
    { name: 'AbortError' },
  );
  const current = await replacement;
  assert(host.preparer.current(current));
  assert.equal(current.run.level.classic.combatPatrols.enabled, false);
  host.preparer.dispose();
});

test('Solo picture ownership releases canceled editions but transfers a taken picture exactly once', async (t) => {
  const images = pictureBrowser(t);
  let mode = 'on';
  const host = makeSolo(picturedSource(), { getCombatMode: () => mode });
  t.after(() => host.preparer.dispose());
  const first = await host.preparer.prepare(request(host));
  assert(isCandidatePictureFor(asset, first.picture));
  mode = 'off';
  const second = await host.preparer.prepare(request(host));
  assert.equal(images[0].closed, 1);
  assert.equal(images[0].removed, 1);
  assert.equal(isCandidatePictureFor(asset, first.picture), false);
  assert.equal(host.preparer.take(second), second);
  host.preparer.cancel();
  host.preparer.dispose();
  assert.equal(images[1].closed, 0, 'Taking transfers disposal to the accepting host');
  second.picture.release();
  second.picture.release();
  assert.equal(images[1].closed, 1);
});

for (const initialMode of ['on', 'off'])
  test(`reentrant cancellation from ${initialMode} cannot retire a newer cross-edition intent`, async (t) => {
    let fetches = 0,
      entered,
      newer,
      host,
      newestRequest;
    const started = new Promise((resolve) => {
      entered = resolve;
    });
    const images = pictureBrowser(t, async (_url, { signal }) => {
      if (++fetches !== 1) return new Response(png);
      signal.addEventListener(
        'abort',
        () => {
          newer = host.preparer.prepare(newestRequest);
        },
        { once: true },
      );
      entered();
      return new Promise(() => {});
    });
    let mode = initialMode;
    host = makeSolo(picturedSource(), { getCombatMode: () => mode });
    t.after(() => host.preparer.dispose());
    const originalRequest = request(host);
    mode = initialMode === 'on' ? 'off' : 'on';
    newestRequest = { ...request(host), seed: 44 };
    mode = initialMode;
    const original = host.preparer.prepare(originalRequest);
    const rejected = assert.rejects(original, { name: 'AbortError' });
    await started;
    await assert.rejects(host.preparer.prepare(request(host)), /cancel|replac/i);
    await rejected;
    const accepted = await newer;
    assert(host.preparer.current(accepted));
    assert.equal(accepted.selection.seed, 44);
    assert.equal(accepted.run.level.classic.combatPatrols.enabled, initialMode === 'off');
    assert.equal(fetches, 2, 'Superseded middle request must never start another image load');
    host.preparer.dispose();
    assert(images.every((image) => image.closed === 1));
  });

test('Versus requires exact authored themes and original asset descriptors, including combat greyboxes', () => {
  assert.throws(
    () => createCombatVersusHost(createCombatCandidates(), options),
    /exact authored theme and original/,
  );
  assert.throws(
    () => createCombatVersusHost(picturedSource(), { ...options, themes: [] }),
    /exact authored theme and original/,
  );
});

test('Versus stable variant rows use canonical mission mapping and equal independent selected boards', () => {
  let mode = 'authored';
  const source = picturedSource(),
    before = structuredClone(source);
  const host = createCombatVersusHost(source, { ...options, getCombatMode: () => mode });
  const repeated = createCombatVersusHost(source, options);
  assert.equal(host.rows.length, 18);
  assert.equal(new Set(host.rows.map((row) => row.key)).size, host.rows.length);
  assert.deepEqual(
    host.rows.map((r) => [r.key, r.executionKey]),
    repeated.rows.map((r) => [r.key, r.executionKey]),
  );
  frozen(host.rows);
  for (const mission of host.catalog.missions)
    for (const difficulty of difficulties) {
      const selections = new Map();
      for (const choice of modes) {
        mode = choice;
        const row = host.row(mission, difficulty);
        selections.set(choice, row);
        assert.equal(row.mission, mission);
        assert.equal(host.row(mission, difficulty), row);
        assert(host.owns(row));
        assert.equal(host.owns({ ...row }), false);
        assert.equal(host.row({ ...mission }, difficulty), null);
        assert.equal(
          host.visualThemeSelection(row, row.level).entry.executionKey,
          row.executionKey,
        );
        assert.equal(host.visualThemeSelection({ ...row }, row.level), null);
        assert.equal(host.visualThemeSelection(row, structuredClone(row.level)), null);
        assert.equal(host.card(mission, difficulty).preset, difficulty);
        const duel = createDuel(
          row.level,
          { seed: 42, classId: 'scout', turnPolicy: 'immediate' },
          { seconds: 0, protocol: UNTIMED_DUEL_PROTOCOL },
        );
        assert.notEqual(duel.runs[0], duel.runs[1]);
        assert.notEqual(duel.runs[0].cells, duel.runs[1].cells);
        resumeDuel(duel);
        for (let tick = 0; tick < 12; tick++)
          stepDuel(duel, [{ direction: 'right' }, { direction: 'right' }]);
        assert.deepEqual(
          authoritativeCheckpoint(duel.runs[0]),
          authoritativeCheckpoint(duel.runs[1]),
        );
        assert.equal(duel.runs[0].level.classic.combatPatrols.enabled, choice !== 'off');
      }
      assert.equal(selections.get('authored'), selections.get('on'));
      assert.notEqual(selections.get('authored'), selections.get('off'));
    }
  assert.deepEqual(source, before);
  mode = 'invalid';
  assert.throws(() => host.row(host.catalog.missions[0], 'standard'), /preference/);
});

test('Versus row assets cross real digest and verification ownership gates before decoded presentation', async () => {
  const host = createCombatVersusHost(picturedSource(), options);
  const row = host.row(host.catalog.missions[0], 'standard');
  assert.deepEqual(row.asset, asset);
  const media = await mediaFor(row.asset);
  let decoded = 0,
    closed = 0;
  const picture = await acquireCandidatePicture(row.asset, {
    loadArtwork: async () => media,
    decodeImage: async () => {
      decoded++;
      return {
        width: 1,
        height: 1,
        close() {
          closed++;
        },
      };
    },
  });
  assert.equal(decoded, 1);
  assert(isCandidatePictureFor(row.asset, picture));
  assert.equal(picture.officialProgressEligible, false);
  picture.release();
  assert.equal(closed, 1);
  assert.equal(isCandidatePictureFor(row.asset, picture), false);
  await assert.rejects(
    acquireCandidatePicture(row.asset, {
      loadArtwork: async () => ({ ...media }),
      decodeImage: () => assert.fail('Unverified media must not decode'),
    }),
    /verify/,
  );
  const corrupt = Buffer.from(png);
  corrupt[corrupt.length - 1] ^= 1;
  await assert.rejects(mediaFor(row.asset, corrupt), /SHA|digest|hash/i);
});
