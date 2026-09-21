import assert from 'node:assert/strict';
import test from 'node:test';
import { SOUNDTRACK_CATALOGUE, SOUNDTRACK_COLLECTIONS } from '../content/soundtrack-catalogue.mjs';
import {
  emptySoundtrackLibrary,
  resolveCatalogueTrack,
  resolveSoundtrackCatalogue,
  resolveSoundtrackLibrary,
  setCatalogueTracks,
  soundtrackPlaylists,
  soundtrackRecoveryPlan,
} from '../soundtrack.mjs';
import {
  portableSoundtrackLibrary,
  soundtrackPortableRecoveryPlan,
} from '../soundtrack-portable.mjs';
import { exportSoundtrackBundle, importSoundtrackBundle } from '../soundtrack-bundle.mjs';
import { fixture, structuralProbe } from './helpers/soundtrack-fixtures.mjs';

const original = await fixture('portable-owned'),
  other = await fixture('portable-other');
function recording(raw, name, redistribute = 'allowed') {
  const id = `builtin.catalog.portable.${name}`;
  return resolveCatalogueTrack({
    ...raw.track,
    id,
    edition: 'portable-1',
    path: `optional/${name}.mp3`,
    tags: { genres: ['synth90s'], role: 'any', energy: 3, themes: ['retro'] },
    policy: {
      id,
      sha256: raw.track.asset.sha256,
      webPlayback: 'allowed',
      offlineCache: 'allowed',
      redistribute,
      modify: 'allowed',
      gameplayVideo: 'allowed',
      contentId: 'unknown',
    },
  });
}
const first = recording(original, 'first'),
  second = recording(other, 'second'),
  catalogue = resolveSoundtrackCatalogue({
    format: 'revealline-soundtrack-catalogue.v2',
    edition: 'portable-1',
    tracks: [first, second],
  }),
  adopt = () => setCatalogueTracks(emptySoundtrackLibrary(), catalogue.tracks),
  options = { catalogue, probeMedia: structuralProbe },
  ids = (library) => library.catalogTracks.map((track) => track.id);

test('fresh default and automatic genre preferences back up without downloading the shipped catalogue', async () => {
  assert.equal(SOUNDTRACK_CATALOGUE.tracks.length, 70);
  const adopted = setCatalogueTracks(emptySoundtrackLibrary(), SOUNDTRACK_CATALOGUE.tracks);
  for (const mode of ['auto', 'metal', 'mix']) {
    const library = resolveSoundtrackLibrary({
      ...adopted,
      listening: { ...adopted.listening, mode, genres: ['metal', 'chiptune'] },
    });
    const plan = soundtrackPortableRecoveryPlan(library, { catalogue: SOUNDTRACK_CATALOGUE });
    assert.equal(plan.omittedCatalogueTrackIds.length, 70);
    assert.deepEqual(plan.requiredTracks, []);
    assert.deepEqual(plan.referenceOnlyTrackIds, []);
    assert.match(plan.notice, /unused online catalogue/);
    const bundle = await exportSoundtrackBundle(library, [], { catalogue: SOUNDTRACK_CATALOGUE });
    assert(bundle.size < 4096);
    const restored = await importSoundtrackBundle(bundle, {
      catalogue: SOUNDTRACK_CATALOGUE,
      probeMedia: structuralProbe,
    });
    assert.deepEqual(restored.assets, []);
    assert.deepEqual(restored.library.listening, library.listening);
    assert.deepEqual(restored.library.catalogTracks, []);
    assert.deepEqual(restored.library.referenceOnlyTrackIds, []);
    assert.deepEqual(setCatalogueTracks(restored.library, SOUNDTRACK_CATALOGUE.tracks), library);
    assert.equal(library.catalogTracks.length, 70, 'Export cannot mutate the saved inventory.');
  }
});

test('installed originals survive projection and byte-exact roundtrip; missing bytes still fail', async () => {
  const library = resolveSoundtrackLibrary({ ...adopt(), installedTrackIds: [first.id] }),
    plan = soundtrackPortableRecoveryPlan(library, { catalogue });
  assert.deepEqual(ids(plan.library), [first.id]);
  assert.deepEqual(plan.omittedCatalogueTrackIds, [second.id]);
  assert.deepEqual(
    plan.requiredTracks.map((track) => track.id),
    [first.id],
  );
  await assert.rejects(exportSoundtrackBundle(library, [], options), /every referenced asset/);
  const restored = await importSoundtrackBundle(
    await exportSoundtrackBundle(library, original.assets, options),
    options,
  );
  assert.deepEqual(restored.library, plan.library);
  assert.deepEqual(await restored.assets[0].blob.arrayBuffer(), await original.blob.arrayBuffer());
});

test('unselected custom playlist membership, duplicate order and assignments retain permitted originals', async () => {
  const library = resolveSoundtrackLibrary({
    ...adopt(),
    playlists: [
      {
        id: 'personal',
        title: 'Personal order',
        trackIds: [first.id, first.id],
        order: 'ordered',
        repeat: 'one',
      },
    ],
    assignments: [{ scope: 'theme', key: 'fpv', playlistId: 'personal' }],
  });
  const plan = soundtrackPortableRecoveryPlan(library, { catalogue });
  assert.deepEqual(ids(plan.library), [first.id]);
  assert.deepEqual(plan.library.playlists, library.playlists);
  assert.deepEqual(plan.library.assignments, library.assignments);
  await assert.rejects(exportSoundtrackBundle(library, [], options), /every referenced asset/);
  const restored = await importSoundtrackBundle(
    await exportSoundtrackBundle(library, original.assets, options),
    options,
  );
  assert.deepEqual(restored.library.playlists, library.playlists);
  assert.deepEqual(restored.library.assignments, library.assignments);
});

for (const reference of ['selection', 'assignment'])
  test(`an explicit built-in album ${reference} keeps every adopted member`, () => {
    const album = SOUNDTRACK_COLLECTIONS[0],
      adopted = setCatalogueTracks(emptySoundtrackLibrary(), SOUNDTRACK_CATALOGUE.tracks),
      library = resolveSoundtrackLibrary({
        ...adopted,
        ...(reference === 'selection'
          ? { selection: { playlistId: album.id } }
          : { assignments: [{ scope: 'map', key: 'flight-1', playlistId: album.id }] }),
      }),
      plan = soundtrackPortableRecoveryPlan(library, { catalogue: SOUNDTRACK_CATALOGUE });
    assert.deepEqual(ids(plan.library), album.trackIds);
    assert.deepEqual(
      plan.requiredTracks.map((track) => track.id),
      album.trackIds,
    );
    assert.deepEqual(plan.library.selection, library.selection);
    assert.deepEqual(plan.library.assignments, library.assignments);
    assert.deepEqual(
      soundtrackPlaylists(plan.library).find((playlist) => playlist.id === album.id).trackIds,
      album.trackIds,
    );
  });

test('explicit All Music is complete-required even when the entire hosted catalogue exceeds the budget', async () => {
  const library = resolveSoundtrackLibrary({
    ...setCatalogueTracks(emptySoundtrackLibrary(), SOUNDTRACK_CATALOGUE.tracks),
    selection: { playlistId: 'builtin.playlist.mix' },
  });
  const plan = soundtrackPortableRecoveryPlan(library, { catalogue: SOUNDTRACK_CATALOGUE });
  assert.equal(plan.omittedCatalogueTrackIds.length, 0);
  assert.equal(plan.requiredTracks.length, 70);
  assert(
    plan.requiredTracks.reduce((sum, track) => sum + track.asset.bytes, 0) > 256 * 1024 * 1024,
  );
  await assert.rejects(
    exportSoundtrackBundle(library, [], { catalogue: SOUNDTRACK_CATALOGUE }),
    /every referenced asset/,
  );
});

test('uploads remain mandatory even unreferenced or identical to an unused online pin', async () => {
  const library = resolveSoundtrackLibrary({ ...adopt(), tracks: [original.track] }),
    plan = soundtrackPortableRecoveryPlan(library, { catalogue });
  assert.deepEqual(ids(plan.library), []);
  assert.deepEqual(
    plan.requiredTracks.map((track) => track.id),
    [original.track.id],
  );
  await assert.rejects(exportSoundtrackBundle(library, [], options), /every referenced asset/);
  const restored = await importSoundtrackBundle(
    await exportSoundtrackBundle(library, original.assets, options),
    options,
  );
  assert.deepEqual(restored.library.tracks, [original.track]);
  assert.deepEqual(await restored.assets[0].blob.arrayBuffer(), await original.blob.arrayBuffer());
});

test('edited and unknown catalogue pins stay present and retain their existing rights boundary', async () => {
  const library = adopt();
  assert.deepEqual(portableSoundtrackLibrary(library), library);
  const edited = resolveSoundtrackLibrary({
    ...library,
    catalogTracks: [{ ...first, title: 'Changed pin' }],
  });
  const empty = { ...catalogue, tracks: [] };
  assert.deepEqual(portableSoundtrackLibrary(edited, { catalogue }), edited);
  await assert.rejects(exportSoundtrackBundle(edited, [], { catalogue }), /every referenced asset/);
  for (const authority of [empty, undefined]) {
    const plan = soundtrackPortableRecoveryPlan(library, { catalogue: authority });
    assert.deepEqual(plan.library, library);
    assert.deepEqual(plan.omittedCatalogueTrackIds, []);
    // An imported policy is not authority. Existing v3 recovery explicitly
    // preserves these unknown recordings as references, not missing pins.
    assert.deepEqual(plan.referenceOnlyTrackIds, [first.id, second.id]);
    const restored = await importSoundtrackBundle(
      await exportSoundtrackBundle(library, [], { catalogue: authority }),
      { catalogue: authority, probeMedia: structuralProbe },
    );
    assert.deepEqual(ids(restored.library), [first.id, second.id]);
    assert.deepEqual(restored.library.referenceOnlyTrackIds, [first.id, second.id]);
  }
});

test('restricted references and invalid permitted reference markers remain at the strict import boundary', async () => {
  const restricted = recording(other, 'restricted', 'denied'),
    authority = resolveSoundtrackCatalogue({ ...catalogue, tracks: [first, restricted] }),
    library = setCatalogueTracks(emptySoundtrackLibrary(), authority.tracks),
    plan = soundtrackPortableRecoveryPlan(library, { catalogue: authority });
  assert.deepEqual(ids(plan.library), [restricted.id]);
  assert.deepEqual(plan.referenceOnlyTrackIds, [restricted.id]);
  const restored = await importSoundtrackBundle(
    await exportSoundtrackBundle(library, [], { catalogue: authority }),
    { catalogue: authority, probeMedia: structuralProbe },
  );
  assert.deepEqual(restored.library.referenceOnlyTrackIds, [restricted.id]);
  const falseReference = resolveSoundtrackLibrary({
    ...adopt(),
    referenceOnlyTrackIds: [first.id],
  });
  assert.deepEqual(ids(portableSoundtrackLibrary(falseReference, { catalogue })), [first.id]);
  await assert.rejects(
    exportSoundtrackBundle(falseReference, [], options),
    /every referenced asset/,
  );
  assert.deepEqual(soundtrackRecoveryPlan(falseReference, options).referenceOnlyTrackIds, []);
});

test('legacy v1 and v2 keep complete-original recovery semantics and formats', async () => {
  const { policy: _policy, ...legacyPin } = first,
    authority = {
      format: 'revealline-soundtrack-catalogue.v1',
      edition: 'portable-1',
      tracks: [legacyPin],
    },
    v2 = resolveSoundtrackLibrary({
      ...emptySoundtrackLibrary({ catalogue: true, version: 2 }),
      catalogTracks: [legacyPin],
    });
  for (const library of [original.library, v2]) {
    assert.deepEqual(portableSoundtrackLibrary(library, { catalogue: authority }), library);
    await assert.rejects(
      exportSoundtrackBundle(library, [], { catalogue: authority }),
      /every referenced asset/,
    );
    const restored = await importSoundtrackBundle(
      await exportSoundtrackBundle(library, original.assets, { catalogue: authority }),
      { catalogue: authority, probeMedia: structuralProbe },
    );
    assert.equal(restored.library.format, library.format);
    assert.deepEqual(restored.library.tracks, library.tracks);
    assert.deepEqual(
      await restored.assets[0].blob.arrayBuffer(),
      await original.blob.arrayBuffer(),
    );
  }
});
