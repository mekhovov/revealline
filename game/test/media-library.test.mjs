import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRun, stepRun, FIXED_DT, getSummary } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import {
  campaignKey,
  boardIdentity,
  emptyLibrary,
  recordLibraryCompletion,
  exportLibrary,
} from '../library.mjs';
import { canonicalJSON } from '../data-json.mjs';
import {
  createMediaIdentityCatalog,
  validateMediaLibrary,
  validateStillAsset,
  MEDIA_LIMITS,
} from '../media-library.mjs';
import { createPresentationResolver } from '../media-presentation.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import {
  mediaFixture,
  libraryRecord,
  assetRecord,
  presentationRecord,
  pngBytes,
  provenance,
} from './helpers/media-fixtures.mjs';

test('exact execution keys and derived Gentle map revisions resolve to one authored identity', () => {
  for (const classic of [false, true]) {
    const f = mediaFixture(classic);
    assert.notEqual(f.request('gentle').levelRevision, f.identity.levelRevision);
    for (const mode of ['standard', 'gentle'])
      assert.deepEqual(f.identityCatalog.resolve(f.request(mode)), f.identity);
    const library = validateMediaLibrary(libraryRecord(f.identity), f),
      resolver = createPresentationResolver(library, f.identityCatalog);
    assert.equal(resolver.resolve(f.request()).kind, 'still');
    assert.equal(resolver.resolve(f.request()), resolver.resolve(f.request('gentle')));
    for (const field of ['executionKey', 'levelId', 'levelRevision', 'themeId'])
      assert.deepEqual(resolver.resolve({ ...f.request(), [field]: 'missing' }), {
        kind: 'legacy',
        reason: 'unavailable-context',
      });
    assert.equal(
      f.identityCatalog.resolve({
        ...f.request('gentle'),
        levelRevision: f.identity.levelRevision,
      }),
      null,
    );
    assert.deepEqual(resolver.resolve(f.request('standard', 'retro')), {
      kind: 'legacy',
      reason: 'unassigned',
    });
  }
});

test('four themes require four explicit assignments; same IDs in another campaign do not alias', () => {
  const f = mediaFixture(),
    source = libraryRecord(f.identity);
  for (const themeId of ['ukraine', 'retro', 'network']) {
    const identity = { ...f.identity, themeId },
      id = `picture-${themeId}`;
    source.assets.push({
      ...assetRecord(id),
      sha256: themeId[0].charCodeAt(0).toString(16).repeat(32),
    });
    source.presentations.push({ ...presentationRecord(identity, 1, id), id });
    source.assignments.push({ identity, presentationId: id, revision: 1 });
  }
  const accepted = validateMediaLibrary(source, f),
    resolver = createPresentationResolver(accepted, f.identityCatalog);
  assert.equal(
    new Set(
      ['fpv', 'ukraine', 'retro', 'network'].map(
        (theme) => resolver.resolve(f.request('gentle', theme)).asset.id,
      ),
    ).size,
    4,
  );
  const forged = structuredClone(source);
  forged.presentations[0].identity.baseCampaignKey += '-other';
  assert.throws(() => validateMediaLibrary(forged, f), /execution catalog/);
  const before = canonicalJSON(accepted);
  source.assets[0].provenance.credit = 'late edit';
  source.assignments.length = 0;
  assert.equal(canonicalJSON(accepted), before);
  assert.throws(() => {
    accepted.presentations[0].poster.assetId = 'another';
  }, TypeError);
});

test('revision adoption retains immutable history, only explicit assignments change the current image', () => {
  const f = mediaFixture(),
    first = validateMediaLibrary(libraryRecord(f.identity), f),
    source = structuredClone(first);
  source.assets.push({ ...assetRecord('picture-b'), sha256: 'b'.repeat(64) });
  source.presentations.push(presentationRecord(f.identity, 2, 'picture-b'));
  source.assignments[0].revision = 2;
  const second = validateMediaLibrary(source, { ...f, previous: first });
  const firstResolver = createPresentationResolver(first, f.identityCatalog),
    secondResolver = createPresentationResolver(second, f.identityCatalog);
  assert.equal(firstResolver.resolve(f.request()).asset.id, 'picture-a');
  assert.equal(secondResolver.resolve(f.request()).asset.id, 'picture-b');
  const unassign = structuredClone(second);
  unassign.assignments = [];
  assert.equal(
    createPresentationResolver(
      validateMediaLibrary(unassign, { ...f, previous: second }),
      f.identityCatalog,
    ).resolve(f.request()).reason,
    'unassigned',
  );
  for (const mutate of [
    (v) => {
      v.assets[0].sha256 = 'c'.repeat(64);
    },
    (v) => {
      v.presentations[0].description = 'silent rewrite';
    },
    (v) => {
      v.presentations.shift();
    },
    (v) => {
      v.assets.shift();
    },
  ]) {
    const bad = structuredClone(second);
    mutate(bad);
    assert.throws(() => validateMediaLibrary(bad, { ...f, previous: first }));
  }
  const moved = structuredClone(second);
  moved.presentations[1].identity.themeId = 'retro';
  assert.throws(() => validateMediaLibrary(moved, { ...f, previous: first }), /cannot move/);
  const historical = structuredClone(second);
  historical.presentations = historical.presentations.filter((p) => p.revision === 2);
  const imported = validateMediaLibrary(historical, f);
  assert.throws(() => validateMediaLibrary(second, { ...f, previous: imported }), /must increase/);
});

test('removed execution contexts retain validated history but always choose the old-art fallback', () => {
  const f = mediaFixture(),
    first = validateMediaLibrary(libraryRecord(f.identity), f),
    absent = createMediaIdentityCatalog({ entries: [] });
  assert.throws(
    () => validateMediaLibrary(first, { identityCatalog: absent }),
    /execution catalog/,
  );
  // A restart has JSON, not the in-memory accepted capability. Missing owners
  // need a future hydration contract; this foundation must reject honestly.
  const stored = JSON.stringify(first);
  assert.throws(
    () => validateMediaLibrary(stored, { identityCatalog: absent, previous: null }),
    /execution catalog/,
  );
  assert.throws(
    () => validateMediaLibrary(stored, { identityCatalog: absent, previous: JSON.parse(stored) }),
    /must be validated/,
  );
  assert.deepEqual(validateMediaLibrary(stored, f), first);
  const retained = validateMediaLibrary(first, { identityCatalog: absent, previous: first });
  assert.equal(
    createPresentationResolver(retained, absent).resolve(f.request()).reason,
    'unavailable-context',
  );
  const rewritten = structuredClone(retained);
  rewritten.presentations.push(presentationRecord(f.identity, 2));
  assert.throws(
    () => validateMediaLibrary(rewritten, { identityCatalog: absent, previous: first }),
    /execution catalog/,
  );
});

test('reject forged ownership, hostile data and unknown contracts without invoking getters', () => {
  const f = mediaFixture();
  let calls = 0;
  const getter = {
    get entries() {
      calls++;
      return f.catalog.entries;
    },
  };
  assert.throws(() => createMediaIdentityCatalog(getter));
  const bad = structuredClone(f.catalog.entries);
  bad[1].baseCampaignKey = 'forged';
  assert.throws(() => createMediaIdentityCatalog({ entries: bad }), /verified base/);
  const wrong = structuredClone(f.catalog.entries);
  wrong[1].campaign.levels[0].rules.lives++;
  assert.throws(() => createMediaIdentityCatalog({ entries: wrong }), /verified base/);
  assert.throws(
    () => createMediaIdentityCatalog({ entries: [f.catalog.entries[0], f.catalog.entries[0]] }),
    /Duplicate/,
  );
  const source = libraryRecord(f.identity);
  Object.defineProperty(source.assets[0], 'bytes', {
    enumerable: true,
    get() {
      calls++;
      return 68;
    },
  });
  assert.throws(() => validateMediaLibrary(source, f), /accessors/);
  assert.equal(calls, 0);
  assert.throws(
    () => validateMediaLibrary(libraryRecord(f.identity), { identityCatalog: { has: () => true } }),
    /validated/,
  );
  assert.throws(
    () =>
      validateMediaLibrary(libraryRecord(f.identity), {
        ...f,
        previous: libraryRecord(f.identity),
      }),
    /validated/,
  );
  assert.throws(
    () => createPresentationResolver(libraryRecord(f.identity), f.identityCatalog),
    /validated/,
  );
  const resolver = createPresentationResolver(
    validateMediaLibrary(libraryRecord(f.identity), f),
    f.identityCatalog,
  );
  assert.throws(
    () =>
      resolver.resolve({
        ...f.request(),
        get extra() {
          calls++;
          return true;
        },
      }),
    /accessors/,
  );
  assert.equal(calls, 0);
});

test('strict references, duplicate IDs, pixel limits and still-only fields reject before adoption', () => {
  const f = mediaFixture();
  for (const mutate of [
    (v) => v.assets.push(v.assets[0]),
    (v) => v.presentations.push(v.presentations[0]),
    (v) => v.assignments.push(v.assignments[0]),
    (v) => {
      v.assignments[0].identity.themeId = 'retro';
    },
    (v) => {
      v.assignments[0].revision = 2;
    },
    (v) => {
      v.presentations[0].poster.assetId = 'missing';
    },
    (v) => {
      v.presentations[0].poster.fit = 'cover';
    },
    (v) => {
      v.presentations[0].story = { start: 0, end: 20 };
    },
    (v) => {
      v.presentations[0].revision = 0;
    },
    (v) => {
      v.assets[0].width = MEDIA_LIMITS.posterWidth + 1;
    },
    (v) => {
      v.assets[0].height = MEDIA_LIMITS.posterHeight + 1;
    },
    (v) => {
      v.assets[0].url = 'https://example.invalid/image';
    },
    (v) => {
      v.format = 'xonix-pack.v5';
    },
    (v) => {
      v.presentations = Array(257).fill(v.presentations[0]);
    },
    (v) => {
      v.assets = Array(513).fill(v.assets[0]);
    },
  ]) {
    const source = libraryRecord(f.identity);
    mutate(source);
    assert.throws(() => validateMediaLibrary(source, f));
  }
  for (const patch of [
    { mime: 'image/webp' },
    { width: 8193 },
    { width: 8192, height: 8192 },
    { bytes: MEDIA_LIMITS.assetBytes + 1 },
    { sha256: 'bad' },
  ])
    assert.throws(() => validateStillAsset({ ...assetRecord(), ...patch }));
  const conflicting = libraryRecord(f.identity);
  conflicting.assets.push({ ...assetRecord('other'), width: 2 });
  assert.throws(() => validateMediaLibrary(conflicting, f), /different media facts/);
});

for (const classic of [false, true])
  for (const mode of ['standard', 'gentle'])
    for (const turnPolicy of ['immediate', 'grid-center'])
      test(`picture revision leaves real ${classic ? 'classic' : 'legacy'} ${mode}/${turnPolicy} win, replay, board and profile bytes exact`, async () => {
        const f = mediaFixture(classic),
          entry = f.catalog.entries.find((e) => e.difficulty === mode),
          campaign = entry.campaign,
          level = campaign.levels[0];
        const beforeCampaign = canonicalJSON(campaign),
          options = { seed: 1, classId: 'scout', turnPolicy };
        const state = createRun(level, options),
          recorder = createRecorder(level, options, 'media-fixture');
        const prepared = await prepareStillAsset(
          new Blob([pngBytes()]),
          { id: 'picture-a', provenance: provenance() },
          { decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) },
        );
        const source = libraryRecord(f.identity);
        source.assets = [prepared.asset];
        const first = validateMediaLibrary(source, f),
          revised = structuredClone(first);
        const otherBytes = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
          'base64',
        );
        const other = await prepareStillAsset(
          new Blob([otherBytes]),
          { id: 'picture-b', provenance: provenance() },
          { decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) },
        );
        assert.notEqual(other.asset.sha256, prepared.asset.sha256);
        revised.assets.push(other.asset);
        revised.presentations.push(presentationRecord(f.identity, 2, 'picture-b'));
        revised.assignments[0].revision = 2;
        const second = validateMediaLibrary(revised, { ...f, previous: first });
        const resolvers = [first, second].map((l) =>
          createPresentationResolver(l, f.identityCatalog),
        );
        while (state.status === 'running' && state.tick < 2000) {
          const before = authoritativeCheckpoint(state);
          assert.equal(resolvers[state.tick % 2].resolve(f.request(mode)).kind, 'still');
          assert.deepEqual(authoritativeCheckpoint(state), before);
          const input = { direction: 'down' };
          stepRun(state, input, FIXED_DT);
          recordInput(recorder, input);
        }
        assert.equal(state.status, 'won');
        const replay = exportReplay(recorder, state),
          verified = verifyReplay(replay);
        assert.equal(verified.match, true);
        const result = getSummary(state),
          profile = () =>
            exportLibrary(
              recordLibraryCompletion(emptyLibrary(), {
                campaign,
                result,
                runId: 'media-proof',
                themeId: 'fpv',
                bodyId: 'fpv-racer',
                completedAt: '2026-09-13T12:00:00.000Z',
              }),
            );
        const saved = profile(),
          replayBytes = JSON.stringify(replay),
          key = campaignKey(campaign);
        const board = boardIdentity({
          campaign,
          level,
          recipe: state.classRecipes.find((c) => c.id === 'scout'),
          seed: 1,
          turnPolicy,
        });
        assert.notEqual(
          resolvers[0].resolve(f.request(mode)).presentation.revision,
          resolvers[1].resolve(f.request(mode)).presentation.revision,
        );
        assert.equal(profile(), saved);
        assert.equal(canonicalJSON(campaign), beforeCampaign);
        assert.equal(campaignKey(campaign), key);
        assert.equal(
          boardIdentity({
            campaign,
            level,
            recipe: state.classRecipes.find((c) => c.id === 'scout'),
            seed: 1,
            turnPolicy,
          }),
          board,
        );
        assert.equal(JSON.stringify(exportReplay(recorder, state)), replayBytes);
        assert.deepEqual(authoritativeCheckpoint(verified.state), authoritativeCheckpoint(state));
        assert.equal(
          createHash('sha256')
            .update(Buffer.from(await prepared.blob.arrayBuffer()))
            .digest('hex'),
          prepared.asset.sha256,
        );
      });
