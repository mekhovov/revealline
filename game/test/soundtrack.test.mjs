import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUILTIN_SOUNDTRACK_TRACKS,
  BUILTIN_SOUNDTRACK_PLAYLISTS,
  SOUNDTRACK_LIMITS,
  emptySoundtrackLibrary,
  resolveAudioTrack,
  resolveSoundtrackLibrary,
  resolveSoundtrackSelection,
  soundtrackOrder,
} from '../soundtrack.mjs';
import {
  exportSoundtrackBundle,
  importSoundtrackBundle,
  isPreparedSoundtrackLibrary,
  prepareSoundtrackLibrary,
} from '../soundtrack-bundle.mjs';
import { fixture, structuralProbe } from './helpers/soundtrack-fixtures.mjs';

const base = await fixture();
const clone = (value) => structuredClone(value);
test('mixed soundtrack owns metadata, references existing synth recipes, and freezes output', () => {
  const value = clone(base.library),
    resolved = resolveSoundtrackLibrary(value);
  value.tracks[0].title = 'Changed';
  assert.equal(resolved.tracks[0].title, base.track.title);
  assert(Object.isFrozen(resolved.playlists[0].trackIds));
  assert.equal(BUILTIN_SOUNDTRACK_TRACKS.length, 5);
  assert.equal(BUILTIN_SOUNDTRACK_PLAYLISTS[0].trackIds.length, 5);
  assert.equal(SOUNDTRACK_LIMITS.managedBytes, 256 * 1024 * 1024);
});
test('model rejects accessors, coercion, missing fields, reserved identities and unresolved references', () => {
  let reads = 0;
  const getter = {
    get format() {
      reads++;
      return 'revealline-soundtrack.v1';
    },
  };
  assert.throws(() => resolveSoundtrackLibrary(getter), /accessors/);
  assert.equal(reads, 0);
  const cases = [
    (value) => {
      value.tracks[0].asset.sha256 = [base.track.asset.sha256];
    },
    (value) => {
      delete value.tracks[0].rights;
    },
    (value) => {
      value.tracks[0].id = BUILTIN_SOUNDTRACK_TRACKS[0].id;
    },
    (value) => {
      value.playlists[0].trackIds = ['missing'];
    },
    (value) => {
      value.selection.playlistId = 'missing';
    },
    (value) => {
      value.tracks[0].url = 'https://example.test/audio.mp3';
    },
    (value) => {
      value.tracks[0].asset.durationSeconds = 721;
    },
  ];
  for (const mutate of cases) {
    const value = clone(base.library);
    mutate(value);
    assert.throws(() => resolveSoundtrackLibrary(value));
  }
});
test('total track/playlist and entry limits include the immutable builtin collection', () => {
  const value = clone(base.library);
  value.tracks = Array.from({ length: 123 }, (_, i) => ({ ...clone(base.track), id: `track${i}` }));
  value.playlists = [];
  assert.equal(resolveSoundtrackLibrary(value).tracks.length, 123);
  value.tracks.push({ ...clone(base.track), id: 'over' });
  assert.throws(() => resolveSoundtrackLibrary(value), /count/);
  const p = clone(base.library);
  p.playlists = Array.from({ length: 32 - BUILTIN_SOUNDTRACK_PLAYLISTS.length }, (_, i) => ({
    ...clone(p.playlists[0]),
    id: `list${i}`,
  }));
  assert.equal(resolveSoundtrackLibrary(p).playlists.length, 26);
  p.playlists.push({ ...p.playlists[0], id: 'over' });
  assert.throws(() => resolveSoundtrackLibrary(p), /count/);
  const entries = clone(base.library);
  entries.playlists[0].trackIds = Array(128).fill(base.track.id);
  resolveSoundtrackLibrary(entries);
  entries.playlists[0].trackIds.push(base.track.id);
  assert.throws(() => resolveSoundtrackLibrary(entries), /entry count/);
});
test('duplicate hash metadata uses canonical fields and rejects actual conflicting facts', () => {
  const value = clone(base.library),
    second = { ...clone(base.track), id: 'second' };
  second.asset = Object.fromEntries(Object.entries(second.asset).reverse());
  value.tracks.push(second);
  resolveSoundtrackLibrary(value);
  second.asset.bytes++;
  assert.throws(() => resolveSoundtrackLibrary(value), /conflicting metadata/);
});
test('explicit selection wins over authored map, campaign, theme and global assignment', () => {
  const value = clone(base.library);
  for (const id of ['map', 'campaign', 'theme', 'global'])
    value.playlists.push({ ...clone(value.playlists[0]), id });
  value.assignments = [
    { scope: 'global', key: null, playlistId: 'global' },
    { scope: 'theme', key: 'fpv', playlistId: 'theme' },
    { scope: 'campaign', key: 'campaign-key', playlistId: 'campaign' },
    { scope: 'map', key: 'map-key', playlistId: 'map' },
  ];
  const context = { themeId: 'fpv', campaignKey: 'campaign-key', mapKey: 'map-key' };
  assert.equal(resolveSoundtrackSelection(value, context).source, 'map');
  delete context.mapKey;
  assert.equal(resolveSoundtrackSelection(value, context).source, 'campaign');
  delete context.campaignKey;
  assert.equal(resolveSoundtrackSelection(value, context).source, 'theme');
  delete context.themeId;
  assert.equal(resolveSoundtrackSelection(value, context).source, 'global');
  value.selection.playlistId = 'qa.mix';
  assert.equal(resolveSoundtrackSelection(value, { mapKey: 'map-key' }).source, 'explicit');
  assert.equal(resolveSoundtrackSelection(emptySoundtrackLibrary()).source, 'default');
});
test('presentation shuffle preserves duplicates, avoids a boundary repeat when possible, and rejects invalid randomness', () => {
  const playlist = {
    ...base.library.playlists[0],
    order: 'shuffle',
    trackIds: ['a', 'a', 'b', 'c'],
  };
  const order = soundtrackOrder(playlist, { random: () => 0.99, previousTrackId: 'a' });
  assert.notEqual(order[0], 'a');
  assert.deepEqual([...order].sort(), ['a', 'a', 'b', 'c']);
  assert.deepEqual(playlist.trackIds, ['a', 'a', 'b', 'c']);
  assert.throws(() => soundtrackOrder(playlist, { random: () => 1 }), /randomness/);
  assert.deepEqual(
    soundtrackOrder(
      { ...playlist, order: 'ordered' },
      {
        random: () => {
          throw Error('unused');
        },
      },
    ),
    playlist.trackIds,
  );
});
test('complete binary round trip preserves every raw MP3 byte and mixed playlist metadata', async () => {
  const output = await exportSoundtrackBundle(base.library, base.assets);
  const imported = await importSoundtrackBundle(output, { probeMedia: structuralProbe });
  assert.deepEqual(imported.library, resolveSoundtrackLibrary(base.library));
  assert(isPreparedSoundtrackLibrary(imported));
  assert(!isPreparedSoundtrackLibrary({ ...imported }));
  assert.deepEqual(await imported.assets[0].blob.arrayBuffer(), await base.blob.arrayBuffer());
  const second = await exportSoundtrackBundle(imported.library, imported.assets);
  assert.deepEqual(await second.arrayBuffer(), await output.arrayBuffer());
});
test('two track records sharing one original transfer exactly one payload', async () => {
  const library = clone(base.library);
  library.tracks.push({ ...clone(base.track), id: 'second' });
  library.playlists[0].trackIds.push('second');
  let probes = 0;
  const imported = await importSoundtrackBundle(
    await exportSoundtrackBundle(library, base.assets),
    {
      probeMedia: async (b) => {
        probes++;
        return structuralProbe(b);
      },
    },
  );
  assert.equal(imported.library.tracks.length, 2);
  assert.equal(imported.assets.length, 1);
  assert.equal(probes, 1);
});
test('complete export/import fail on missing/extra/hash-corrupt media instead of producing partial backups', async () => {
  await assert.rejects(exportSoundtrackBundle(base.library, []), /every referenced/);
  await assert.rejects(
    prepareSoundtrackLibrary(base.library, [...base.assets, ...base.assets], {
      probeMedia: structuralProbe,
    }),
    /duplicate/,
  );
  const bytes = new Uint8Array(await base.blob.arrayBuffer());
  bytes[30] = 1;
  await assert.rejects(
    exportSoundtrackBundle(base.library, [
      { sha256: base.track.asset.sha256, blob: new Blob([bytes]) },
    ]),
    /differ/,
  );
});
test('bundle rejects truncated/trailing payload, invalid magic and manifest allocation abuse', async () => {
  const output = await exportSoundtrackBundle(base.library, base.assets);
  await assert.rejects(
    importSoundtrackBundle(output.slice(0, -1), { probeMedia: structuralProbe }),
    /truncated/,
  );
  await assert.rejects(
    importSoundtrackBundle(new Blob([output, 'x']), { probeMedia: structuralProbe }),
    /trailing/,
  );
  const header = new Uint8Array(await output.slice(0, 12).arrayBuffer());
  header[0] = 0;
  await assert.rejects(importSoundtrackBundle(new Blob([header, output.slice(12)])), /Unsupported/);
  header[0] = 82;
  new DataView(header.buffer).setUint32(8, 0xffffffff, false);
  await assert.rejects(importSoundtrackBundle(new Blob([header])), /manifest length/);
});
test('metadata and asset getters are never invoked and asynchronous caller edits cannot enter prepared import', async () => {
  let reads = 0;
  const bad = [
    {
      sha256: base.track.asset.sha256,
      get blob() {
        reads++;
        return base.blob;
      },
    },
  ];
  await assert.rejects(prepareSoundtrackLibrary(base.library, bad));
  assert.equal(reads, 0);
  const library = clone(base.library);
  let release;
  const pending = prepareSoundtrackLibrary(library, base.assets, {
    probeMedia: async (b) => {
      await new Promise((r) => (release = r));
      return structuralProbe(b);
    },
  });
  while (!release) await new Promise((r) => setImmediate(r));
  library.tracks[0].title = 'Caller edit';
  release();
  assert.equal((await pending).library.tracks[0].title, base.track.title);
});
test('media probe rejection, omitted environment probe, and cancellation cannot authorize an import', async () => {
  await assert.rejects(
    prepareSoundtrackLibrary(base.library, base.assets, { probeMedia: null }),
    /probe/,
  );
  await assert.rejects(
    prepareSoundtrackLibrary(base.library, base.assets, {
      probeMedia: async () => {
        throw Error('decode failed');
      },
    }),
    /decode failed/,
  );
  await assert.rejects(prepareSoundtrackLibrary(base.library, base.assets), /probe/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    importSoundtrackBundle(await exportSoundtrackBundle(base.library, base.assets), {
      signal: controller.signal,
      probeMedia: structuralProbe,
    }),
    { name: 'AbortError' },
  );
});
test('audio metadata validates provenance and frame-derived duration rather than trusting arbitrary imported duration', () => {
  const track = clone(base.track);
  track.rights = { kind: 'licensed', credit: 'Composer', license: '', source: '' };
  assert.throws(() => resolveAudioTrack(track), /provenance/);
  track.rights.license = 'Written permission recorded';
  resolveAudioTrack(track);
  track.asset.durationSeconds += 0.01;
  assert.throws(() => resolveAudioTrack(track), /Inconsistent/);
});

test('five reserved genre playlists resolve each existing recipe through explicit selection', () => {
  assert.equal(BUILTIN_SOUNDTRACK_PLAYLISTS.length, 6);
  for (const genre of ['synthwave', 'chiptune', 'rock', 'metal', 'ambient']) {
    const value = {
      ...emptySoundtrackLibrary(),
      selection: { playlistId: `builtin.genre.${genre}` },
    };
    const selected = resolveSoundtrackSelection(value);
    assert.equal(selected.source, 'explicit');
    assert.equal(selected.playlist.trackIds.length, 1);
    const track = BUILTIN_SOUNDTRACK_TRACKS.find((t) => t.id === selected.playlist.trackIds[0]);
    assert.equal(track.recipe.genre, genre);
    assert(Object.isFrozen(selected.playlist.trackIds));
  }
});
