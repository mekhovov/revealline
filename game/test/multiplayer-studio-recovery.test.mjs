import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  multiplayerStudioFixture,
  decodeStudioPNG,
  inspectStudioPNG,
} from './helpers/multiplayer-studio-fixture.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createStudioStore } from '../presentation/studio-store.mjs';
import { exportThemeBundle, importThemeBundle } from '../presentation/bundle.mjs';
import { exportRuntimeTheme, importRuntimeTheme } from '../presentation/runtime-transfer.mjs';
import { reviseStudioTheme, adoptStudioBundle } from '../presentation/studio-session.mjs';
import { decodePresentationDocument } from '../presentation/document-codec.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import { createPresentationHost } from '../presentation/host.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { prepareTeamPilots } from '../couch/coop-pilot-slots.mjs';
import { createMultiplayerExpansionCandidates } from '../content-design/multiplayer-expansion.mjs';
import { prepareCreatorTeamSourceCampaign } from '../creator/team.mjs';
import {
  prepareCreatorTeamMediaCampaign,
  exportCreatorTeamMediaCampaign,
  createCreatorTeamMediaPictureLease,
} from '../creator/team-media.mjs';
import { readPlayableTeamCampaign } from '../couch/creator-team-import.mjs';

const raw = async (blob) => Buffer.from(await blob.arrayBuffer());

test('terrain, both Team pilots, Duel scout and real sound bytes survive fresh Studio and runtime recovery', async () => {
  const f = await multiplayerStudioFixture();
  const shipped = decodePresentationDocument(
    await readFile(new URL('../presentation/compiled/studio.json', import.meta.url), 'utf8'),
  );
  const adopted = resolvePresentation(adoptStudioBundle(shipped, f.document));
  for (const slot of Object.keys(f.bindings))
    assert.equal(
      adopted.assets[slot].file.sha256,
      resolvePresentation(f.document).assets[slot].file.sha256,
    );
  const originalDB = managedIndexedDB(),
    freshDB = managedIndexedDB();
  const original = createStudioStore({ indexedDB: originalDB.indexedDB });
  const restored = createStudioStore({ indexedDB: freshDB.indexedDB });
  await original.save(f.document, f.assets);
  const backup = await exportThemeBundle(f.document, f.assets, { decodeImage: decodeStudioPNG });
  const imported = await importThemeBundle(backup, { decodeImage: decodeStudioPNG });
  await restored.save(imported.document, imported.assets);
  const saved = await restored.load();
  assert.deepEqual(saved.document, f.document);
  for (const [hash, blob] of f.assets)
    assert.deepEqual(await raw(saved.assets.get(hash)), await raw(blob));
  const runtime = await importRuntimeTheme(await exportRuntimeTheme(saved.document, saved.assets));
  assert.deepEqual(
    runtime.manifest.resolved.bindings,
    (await importRuntimeTheme(await exportRuntimeTheme(f.document, f.assets))).manifest.resolved
      .bindings,
  );
  const compiled = await compilePresentation(saved.document, saved.assets);
  const root = 'https://studio.test/compiled/';
  const host = createPresentationHost({
    profile: 'board',
    baseURL: root,
    fetch: async (url) =>
      compiled.files.has(url.slice(root.length))
        ? new Response(compiled.files.get(url.slice(root.length)))
        : new Response(null, { status: 404 }),
    decodeImage: decodeStudioPNG,
  });
  const snapshot = await host.load();
  for (const slot of Object.keys(f.bindings))
    assert.equal(snapshot.resolved.assets[slot].id, f.bindings[slot].id);
  for (const seat of [1, 2])
    for (const state of ['normal', 'cutting'])
      for (const size of ['compact', 'detailed'])
        assert(prepareTeamPilots(snapshot).has(`team.pilot.p${seat}.${state}.${size}`));
  assert(snapshot.image('player.scout.compact'));
  const corrupt = await raw(backup);
  corrupt[corrupt.length - 1] ^= 1;
  await assert.rejects(
    importThemeBundle(new Blob([corrupt]), { decodeImage: decodeStudioPNG }),
    /hash|bytes/i,
  );
  await assert.rejects(exportThemeBundle(f.document, new Map()), /exactly match the manifest/i);
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(
    importThemeBundle(backup, { signal: cancelled.signal, decodeImage: decodeStudioPNG }),
    { name: 'AbortError' },
  );
  freshDB.failAnyPutAt = 1;
  await assert.rejects(
    restored.save(
      reviseStudioTheme(saved.document, { tokens: { amber: '#ffaa00' } }),
      saved.assets,
      { expectedGeneration: 1 },
    ),
    /write failure/,
  );
  assert.deepEqual((await restored.load()).document, saved.document);
  host.close();
  original.close();
  restored.close();
});

for (const chapterId of ['harbors', 'aurora'])
  test(`${chapterId}: edited Team campaign restores custom original bytes and retains its working picture on cancelled Next`, async () => {
    const source = createMultiplayerExpansionCandidates({ chapterId });
    source.revision += '-studio-review';
    source.missions[0].name += ' · edited';
    const prepared = await prepareCreatorTeamSourceCampaign(source, {
      sourcePackId: source.packs[0].id,
      campaignId: source.campaigns[0].id,
      difficulty: 'standard',
    });
    const png = await readFile(
      new URL(
        '../presentation/compiled/assets/d76f309d8385cd5d20fc2fff72b7f3abc19299cccdde767d76dd9f4a4960929d.png',
        import.meta.url,
      ),
    );
    const hash = createHash('sha256').update(png).digest('hex'),
      blob = new Blob([png], { type: 'image/png' });
    const media = await prepareCreatorTeamMediaCampaign(
      prepared,
      prepared.pack.levels.map((l) => ({ levelId: l.id, pictureSha256: hash })),
      [{ sha256: hash, blob }],
      {
        decodeImage: inspectStudioPNG,
        credits: {
          creator: 'RevealLine Studio recovery check',
          media: 'Existing RevealLine Team artwork reused unchanged',
          license: 'Project artwork; verification only',
        },
      },
    );
    const portable = exportCreatorTeamMediaCampaign(media);
    const restored = await readPlayableTeamCampaign(portable, { decodeImage: inspectStudioPNG });
    assert.equal(restored.kind, 'creator-media');
    assert.deepEqual(restored.pack, prepared.pack);
    assert.deepEqual(restored.prepared.provenance.sourceProject, source);
    assert.deepEqual(await raw(restored.media.assets[0].blob), png);
    const lease = createCreatorTeamMediaPictureLease(restored.media, {
      getSnapshot: () => ({}),
      decodeImage: async (blob) => ({ image: await decodeStudioPNG(blob), release() {} }),
    });
    const first = { pack: restored.pack, levelId: restored.pack.levels[0].id };
    const accepted = await lease.select(first);
    assert.equal(accepted.choice.picture.sha256, hash);
    const cancelled = new AbortController();
    cancelled.abort();
    await assert.rejects(
      lease.select({ ...first, levelId: restored.pack.levels[1].id, signal: cancelled.signal }),
      { name: 'AbortError' },
    );
    assert.equal(lease.confirm(first), accepted);
    const next = { ...first, levelId: restored.pack.levels[1].id };
    assert.equal((await lease.select(next)).choice.picture.sha256, hash);
    assert.equal(
      (await lease.select(next)).choice.picture.sha256,
      hash,
      'Retry keeps the same custom picture',
    );
    const corrupt = await raw(portable);
    corrupt[corrupt.length - 1] ^= 1;
    await assert.rejects(
      readPlayableTeamCampaign(new Blob([corrupt]), { decodeImage: inspectStudioPNG }),
    );
    assert.equal(lease.confirm(next).choice.picture.sha256, hash);
    lease.dispose();
  });
