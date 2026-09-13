import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalJSON } from '../data-json.mjs';
import { preparePack, resolvePackCampaign } from '../packs.mjs';
import { campaignKey } from '../library.mjs';
import { exportMediaBundle } from '../media-bundle.mjs';
import {
  prepareExternalChapter,
  validateExternalChapter,
  externalChapterHash,
  isPreparedExternalChapter,
} from '../external-chapter.mjs';
import {
  buildExternalPilot,
  decodePilotImage,
} from '../../authoring/library/external-chapter-pilot/build.mjs';

const pilot = await buildExternalPilot();
const clone = (v) => structuredClone(v);
async function changedPack(change) {
  const pack = clone(pilot.prepared.pack);
  change(pack);
  const blob = new Blob([JSON.stringify(pack)]),
    descriptor = clone(pilot.descriptor);
  descriptor.pack = {
    bytes: blob.size,
    sha256: await externalChapterHash(await blob.arrayBuffer()),
  };
  return { descriptor, payloads: { ...pilot.payloads, pack: blob } };
}
test('one concrete fixture preserves all three original byte streams and exact gameplay while changing only explicit edition identities', async () => {
  const { prepared, prior, descriptor } = pilot;
  assert.equal(isPreparedExternalChapter(prepared), true);
  assert.equal(
    descriptor.originals.reduce((n, a) => n + a.bytes, 0),
    8024867,
  );
  assert.ok(descriptor.pack.bytes < 20000);
  assert.deepEqual(prepared.pack.classRecipes, prior.classRecipes);
  assert.deepEqual(prepared.pack.themes, prior.themes);
  assert.deepEqual(prepared.pack.music, prior.music);
  for (let i = 0; i < 3; i++) {
    const old = prior.campaigns[0].levels[i],
      next = prepared.pack.campaigns[0].levels[i];
    assert.notEqual(old.id, next.id);
    assert.deepEqual({ ...old, id: next.id }, next);
    const original = Buffer.from(
      prior.levelVisuals[i].visualOverrides.background.dataUrl.split(',')[1],
      'base64',
    );
    const pin = descriptor.originals[i],
      a = prepared.imported.assets.find((a) => a.sha256 === pin.sha256);
    assert.deepEqual(Buffer.from(await a.blob.arrayBuffer()), original);
    assert.equal(await externalChapterHash(original), pin.sha256);
  }
  const sourceKey = campaignKey(resolvePackCampaign(prior, prior.campaigns[0].id).campaign);
  assert.notEqual(sourceKey, descriptor.campaignKey);
  assert.notEqual(prior.id, prepared.pack.id);
  const artifactDescriptor = JSON.parse(
    await readFile(
      new URL('../../authoring/library/external-chapter-pilot/descriptor.json', import.meta.url),
    ),
  );
  assert.deepEqual(descriptor, artifactDescriptor);
  assert.equal(
    await externalChapterHash(await pilot.payloads.pack.arrayBuffer()),
    descriptor.pack.sha256,
  );
});
test('strict descriptor rejects unsupported, missing, duplicate and oversized claims before payload reads', () => {
  for (const change of [
    (d) => delete d.media,
    (d) => (d.format = 'xonix-pack.v6'),
    (d) => (d.revision = 2),
    (d) => (d.source.id = d.id),
    (d) => (d.originals[1].sha256 = d.originals[0].sha256),
    (d) => (d.originals[1].levelId = d.originals[0].levelId),
    (d) => (d.originals[0].width = 1921),
    (d) => (d.originals[0].bytes = 4 * 1024 * 1024 + 1),
    (d) => (d.extra = true),
  ]) {
    const d = clone(pilot.descriptor);
    change(d);
    assert.throws(() => validateExternalChapter(d));
  }
  for (const d of [null, false, {}, [], { ...pilot.descriptor, media: null }])
    assert.throws(() => validateExternalChapter(d));
});
test('native payload ownership rejects accessors/fakes without invoking them; explicit abort does no decoder work', async () => {
  let calls = 0;
  const bad = { media: pilot.payloads.media };
  Object.defineProperty(bad, 'pack', {
    enumerable: true,
    get() {
      calls++;
      return pilot.payloads.pack;
    },
  });
  await assert.rejects(prepareExternalChapter(pilot.descriptor, bad), /owned/);
  assert.equal(calls, 0);
  for (const payloads of [
    null,
    {},
    { ...pilot.payloads, extra: true },
    {
      ...pilot.payloads,
      media: {
        size: 100,
        arrayBuffer() {
          assert.fail('Fake Blob invoked');
        },
      },
    },
  ])
    await assert.rejects(prepareExternalChapter(pilot.descriptor, payloads));
  const c = new AbortController();
  c.abort();
  await assert.rejects(
    prepareExternalChapter(pilot.descriptor, pilot.payloads, {
      signal: c.signal,
      decodeImage() {
        assert.fail('Unexpected decode');
      },
    }),
    { name: 'AbortError' },
  );
});
test('corrupt/truncated complete payloads fail SHA or size before native decoding', async () => {
  for (const kind of ['pack', 'media']) {
    const raw = new Uint8Array(await pilot.payloads[kind].arrayBuffer());
    raw[raw.length - 1] ^= 1;
    await assert.rejects(
      prepareExternalChapter(
        pilot.descriptor,
        { ...pilot.payloads, [kind]: new Blob([raw]) },
        {
          decodeImage() {
            assert.fail('Unexpected decode');
          },
        },
      ),
      /SHA-256/,
    );
    await assert.rejects(
      prepareExternalChapter(pilot.descriptor, {
        ...pilot.payloads,
        [kind]: new Blob([raw.slice(1)]),
      }),
      /length differs/,
    );
  }
});
test('authenticated but foreign gameplay owner or embedded overrides cannot borrow the paired original bundle', async () => {
  for (const change of [
    (p) => (p.campaigns[0].id = 'foreign-owner'),
    (p) => (p.id = pilot.prior.id),
    (p) => (p.levelVisuals = clone(pilot.prior.levelVisuals)),
  ]) {
    const { descriptor, payloads } = await changedPack(change);
    await assert.rejects(
      prepareExternalChapter(descriptor, payloads, { decodeImage: decodePilotImage }),
    );
  }
});
test('full poster mapping requires exact dimensions, level revision and asset identity even under a valid whole-bundle hash', async () => {
  for (const change of [
    (d) => d.originals[0].width--,
    (d) => (d.originals[0].levelRevision = 'foreign'),
    (d) => (d.originals[0].assetId = 'absent'),
  ]) {
    const d = clone(pilot.descriptor);
    change(d);
    await assert.rejects(
      prepareExternalChapter(d, pilot.payloads, { decodeImage: decodePilotImage }),
      /facts|mapping/,
    );
  }
  const document = clone(pilot.prepared.imported.document);
  document.library.assignments = [];
  const blob = await exportMediaBundle(document, pilot.prepared.imported.assets, {
    decodeImage: decodePilotImage,
  });
  const d = clone(pilot.descriptor);
  d.media = { bytes: blob.size, sha256: await externalChapterHash(await blob.arrayBuffer()) };
  await assert.rejects(
    prepareExternalChapter(
      d,
      { ...pilot.payloads, media: blob },
      { decodeImage: decodePilotImage },
    ),
    /unexpected owners or records/,
  );
});
test('caller descriptor and payload slots are owned before awaits; returned prepared data is immutable and cannot be forged', async () => {
  const d = clone(pilot.descriptor),
    payloads = { ...pilot.payloads };
  const pending = prepareExternalChapter(d, payloads, { decodeImage: decodePilotImage });
  d.originals[0].sha256 = '0'.repeat(64);
  payloads.pack = new Blob(['bad']);
  const prepared = await pending;
  assert.equal(canonicalJSON(prepared.descriptor), canonicalJSON(pilot.descriptor));
  assert.throws(() => prepared.descriptor.originals.push({}), TypeError);
  assert.equal(isPreparedExternalChapter({ ...prepared }), false);
  assert.equal(
    (await preparePack(pilot.prior, { decodeImage: decodePilotImage })).pack.format,
    'xonix-pack.v5',
  );
});

test('all twelve new edition routes execute ordinary input, exact original pins, replay and saved suffixes in both policies and difficulties', async (t) => {
  const { createRun, stepRun, FIXED_DT, getSummary } = await import('../core/index.mjs');
  const { createRecorder, recordInput, authoritativeCheckpoint, exportReplay, verifyReplay } =
    await import('../replay.mjs');
  const { suspendSession, restoreSession } = await import('../sessions.mjs');
  const { hydrateStoredStillMedia } = await import('../media-storage-record.mjs');
  const { createMediaIdentityCatalog } = await import('../media-library.mjs');
  const { createPresentationPins, resolvePinnedPicture } = await import('../presentation-pins.mjs');
  const routes = JSON.parse(
    await readFile(
      new URL('../../authoring/library/four-worlds-chapters/routes.json', import.meta.url),
    ),
  ).routes.filter((r) => r.packId === pilot.prior.id);
  assert.equal(routes.length, 12);
  const item = pilot.prepared,
    identityCatalog = createMediaIdentityCatalog(item.executionCatalog),
    library = hydrateStoredStillMedia(item.imported.document).library;
  for (const route of routes)
    await t.test(`${route.difficulty}/${route.turnPolicy}/${route.levelId}`, async () => {
      const context = item.executionCatalog.select(item.descriptor.campaignKey, route.difficulty),
        level = context.campaign.levels.find((l) => l.id === route.levelId + '-external');
      const setup = {
        classId: 'scout',
        classRecipes: item.pack.classRecipes,
        seed: 1,
        turnPolicy: route.turnPolicy,
      };
      const run = createRun(level, setup),
        recorder = createRecorder(level, setup);
      const pins = createPresentationPins({
        library,
        identityCatalog,
        executionKey: context.executionKey,
        levelId: level.id,
        levelRevision: level.revision,
        themeIds: [item.descriptor.themeId],
      });
      assert.equal(pins.choices[0].kind, 'still');
      let saved, prefix;
      for (const segment of route.segments)
        for (let i = 0; i < segment.ticks; i++) {
          assert.equal(run.status, 'running');
          recordInput(recorder, segment.input);
          stepRun(run, segment.input, FIXED_DT);
          if (run.tick === route.savePrefix.tick) {
            prefix = authoritativeCheckpoint(run);
            saved = JSON.parse(
              JSON.stringify(
                suspendSession({
                  run,
                  recorder,
                  campaignKey: context.executionKey,
                  themeId: item.descriptor.themeId,
                  bodyId: item.pack.themes[0].player,
                  runId: 'external-pilot-route',
                  savedAt: '2026-09-13T00:00:00.000Z',
                  continuation: { direction: segment.input.direction },
                  presentationPins: pins,
                }),
              ),
            );
          }
        }
      assert.equal(run.status, 'won');
      const checkpoint = authoritativeCheckpoint(run);
      const physical = (s) =>
        Object.fromEntries(Object.entries(s).filter(([k]) => !['levelId', 'revision'].includes(k)));
      assert.deepEqual(physical(getSummary(run)), physical(route.expected));
      assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
      const restored = await restoreSession(saved, {
        campaign: context.campaign,
        campaignKey: context.executionKey,
        mediaIdentityCatalog: identityCatalog,
      });
      assert.deepEqual(authoritativeCheckpoint(restored.run), prefix);
      assert.deepEqual(restored.session.presentationPins, pins);
      assert.equal(resolvePinnedPicture(pins, item.descriptor.themeId, library).kind, 'still');
      let skip = route.savePrefix.tick;
      for (const segment of route.segments) {
        const n = Math.min(skip, segment.ticks);
        skip -= n;
        for (let i = n; i < segment.ticks; i++) {
          recordInput(restored.recorder, segment.input);
          stepRun(restored.run, segment.input, FIXED_DT);
        }
      }
      assert.deepEqual(authoritativeCheckpoint(restored.run), checkpoint);
      assert.equal(verifyReplay(exportReplay(restored.recorder, restored.run)).match, true);
    });
});
