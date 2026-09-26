import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  chapterSource,
  addAuthoredRuntimeSnapshots,
} from '../../scripts/authored-runtime-snapshots.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { loadRouteSnapshot } from '../content-design/route-snapshot.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { authoredMissionDownloadGroup } from '../content-design/offline-packages.mjs';

const route = await loadAuthoredJourneyRoute('whole-spatial-v11');

test('complete chapter snapshots retain every preset execution and campaign identity', () => {
  for (const mode of ['solo', 'versus']) {
    const complete = createContentExecutionCatalog(route.source, { mode });
    for (const pack of route.source.packs) {
      const source = chapterSource(route.source, pack.id);
      assert.equal(source.id, route.source.id);
      assert.equal(source.revision, route.source.revision);
      assert.deepEqual(
        createContentExecutionCatalog(source, { mode }).entries,
        complete.entries.filter((entry) => entry.sourcePackId === pack.id),
      );
      const references = new Set(
        source.missions.map((mission) => mission.presentation.backgroundAssetId),
      );
      assert(source.assets.every((asset) => references.has(asset.id)));
    }
  }
});

test('the nine-mission Horizon starter excludes the remix and other modes', () => {
  const starter = chapterSource(route.source, 'journey-opening');
  assert.equal(starter.missions.length, 9);
  assert.equal(starter.assets.length, 9);
  assert(!starter.missions.some((mission) => mission.id === 'horizon-remix'));
  for (const mission of starter.missions) {
    assert.equal(authoredMissionDownloadGroup(route, 'solo', mission.id), 'solo:horizon-starter');
    assert.equal(authoredMissionDownloadGroup(route, 'versus', mission.id), 'versus:horizon');
  }
  assert.equal(
    authoredMissionDownloadGroup(route, 'solo', 'horizon-remix'),
    'solo:horizon-remixes',
  );
  assert.equal(authoredMissionDownloadGroup(route, 'solo', 'absent'), null);
  assert.throws(() => chapterSource(route.source, 'absent'), /Unknown authored/);
});

test('archive package mapping keeps exact old route ownership', async () => {
  const archived = await loadAuthoredJourneyRoute('opening');
  assert.equal(
    authoredMissionDownloadGroup(archived, 'solo', archived.source.missions[0].id),
    'archive:journey:opening',
  );
});

test('published current source snapshot keeps the complete route byte for byte', async () => {
  const entries = [
    {
      name: 'game/content-design/route-loader.mjs',
      bytes: await readFile(new URL('../content-design/route-loader.mjs', import.meta.url)),
    },
  ];
  const generated = await addAuthoredRuntimeSnapshots(entries);
  assert.equal(generated.chapters.length, route.source.packs.length);
  const entry = entries.find((item) => item.name.endsWith('/whole-spatial-v11.json'));
  assert.equal(entry.bytes.toString(), JSON.stringify(route));
  const descriptor = {
    id: route.id,
    path: 'runtime/whole-spatial-v11.json',
    bytes: entry.bytes.length,
    sha256: createHash('sha256').update(entry.bytes).digest('hex'),
  };
  assert(entries[0].bytes.toString().includes(descriptor.sha256));
  const restored = await loadRouteSnapshot(descriptor, {
    fetchAsset: async () => new Response(entry.bytes),
  });
  assert.deepEqual(restored, route);
  assert(Object.isFrozen(restored.source.missions));
  await assert.rejects(
    loadRouteSnapshot(descriptor, {
      fetchAsset: async () => new Response(entry.bytes.subarray(1)),
    }),
    /incomplete/,
  );
  const corrupt = Buffer.from(entry.bytes);
  corrupt[0] ^= 1;
  await assert.rejects(
    loadRouteSnapshot(descriptor, {
      fetchAsset: async () => new Response(corrupt),
    }),
    /integrity/,
  );
  await assert.rejects(loadRouteSnapshot({ ...descriptor, path: '../untrusted.json' }), /Invalid/);
});
