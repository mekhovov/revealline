import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { canonicalJSON } from '../data-json.mjs';
import { readPlayableTeamCampaign } from '../couch/creator-team-import.mjs';
import { generateCreatorTeamCampaign, prepareCreatorTeamCampaign } from '../creator/team.mjs';
import { createInstalledTeamCampaignStore } from '../creator/team-installed.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import {
  CREATOR_TEAM_MEDIA_FORMAT,
  CREATOR_TEAM_MEDIA_LIMITS,
  CREATOR_TEAM_MEDIA_MIME,
  createCreatorTeamMediaPictureLease,
  creatorTeamMediaForLevel,
  exportCreatorTeamMediaCampaign,
  importCreatorTeamMediaCampaign,
  prepareCreatorTeamMediaCampaign,
} from '../creator/team-media.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');

function png(mark = 0) {
  const chunk = (type, body) => {
    const bytes = Buffer.concat([Buffer.from(type), body]);
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const size = Buffer.alloc(4),
      tail = Buffer.alloc(4);
    size.writeUInt32BE(body.length);
    tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([size, bytes, tail]);
  };
  const width = 1152,
    height = 576,
    header = Buffer.alloc(13),
    pixels = Buffer.alloc((width * 4 + 1) * height);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  pixels[1] = mark;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function fixture() {
  const generated = generateCreatorTeamCampaign({
      id: 'team-media-test',
      name: 'Team media test',
      seed: 4,
    }),
    gameplay = await prepareCreatorTeamCampaign(generated.pack, generated.provenance),
    first = png(17),
    second = png(93),
    video = Buffer.from('modeled complete inspected mp4 bytes'),
    firstHash = hash(first),
    secondHash = hash(second),
    videoHash = hash(video),
    bindings = gameplay.pack.levels.map((level, index) => ({
      levelId: level.id,
      pictureSha256: index ? secondHash : firstHash,
      ...(index
        ? {}
        : {
            story: {
              videoSha256: videoHash,
              startSeconds: 1,
              endSeconds: 4,
              description: 'A short optional shared victory story.',
            },
          }),
    })),
    assets = [first, second, video].map((bytes) => ({
      sha256: hash(bytes),
      blob: new Blob([bytes]),
    })),
    options = {
      credits: {
        creator: 'Test creator',
        media: 'Synthetic fixtures',
        license: 'Shareable test-only bytes',
      },
      decodeImage: async () => ({ naturalWidth: 1152, naturalHeight: 576 }),
      inspectVideo: async (blob) => ({
        info: {
          sha256: videoHash,
          bytes: blob.size,
          mime: 'video/mp4',
          width: 1280,
          height: 720,
          durationSeconds: 6,
        },
        dispose() {},
      }),
    };
  return { gameplay, bindings, assets, options, firstHash, secondHash, videoHash };
}

test('Team media limits reuse managed-media budgets', () => {
  assert.equal(CREATOR_TEAM_MEDIA_FORMAT, 'revealline-creator-team-media.v1');
  assert.equal(CREATOR_TEAM_MEDIA_MIME, 'application/vnd.revealline.team-media');
  assert.equal(CREATOR_TEAM_MEDIA_LIMITS.bytes, 256 * 1024 * 1024);
  assert.equal(CREATOR_TEAM_MEDIA_LIMITS.videoBytes, 64 * 1024 * 1024);
  assert.equal(CREATOR_TEAM_MEDIA_LIMITS.manifestBytes, 2 * 1024 * 1024);
});

test('qualified gameplay, exact pictures and an optional story round-trip as one closure', async () => {
  const f = await fixture(),
    prepared = await prepareCreatorTeamMediaCampaign(f.gameplay, f.bindings, f.assets, f.options),
    exported = exportCreatorTeamMediaCampaign(prepared),
    imported = await importCreatorTeamMediaCampaign(exported, f.options);
  assert.equal(exported.type, CREATOR_TEAM_MEDIA_MIME);
  assert.equal(exported.size, prepared.bytes);
  assert.equal(canonicalJSON(imported.manifest), canonicalJSON(prepared.manifest));
  assert.equal(canonicalJSON(imported.evidence), canonicalJSON(f.gameplay.evidence));
  const first = creatorTeamMediaForLevel(imported, f.gameplay.pack.levels[0].id),
    second = creatorTeamMediaForLevel(imported, f.gameplay.pack.levels[1].id);
  assert.equal(first.picture.descriptor.sha256, f.firstHash);
  assert.equal(first.picture.blob.size, f.assets[0].blob.size);
  assert.equal(first.story.descriptor.video.sha256, f.videoHash);
  assert.deepEqual(
    {
      startSeconds: first.story.descriptor.startSeconds,
      endSeconds: first.story.descriptor.endSeconds,
      description: first.story.descriptor.description,
    },
    {
      startSeconds: 1,
      endSeconds: 4,
      description: 'A short optional shared victory story.',
    },
  );
  assert.equal(second.picture.descriptor.sha256, f.secondHash);
  assert.equal(second.story, null);
  assert.equal(creatorTeamMediaForLevel(imported, f.gameplay.pack.levels[0].id), first);
});

test('Team media preparation rejects missing, unrelated, ambiguous and out-of-range dependencies', async () => {
  const f = await fixture();
  await assert.rejects(
    prepareCreatorTeamMediaCampaign(f.gameplay, f.bindings, f.assets, {
      ...f.options,
      credits: undefined,
    }),
    /plain JSON|creator, media credit|Team media credits/,
  );
  await assert.rejects(
    prepareCreatorTeamMediaCampaign(f.gameplay, f.bindings, f.assets.slice(0, 2), f.options),
    /exactly the selected campaign dependencies/,
  );
  await assert.rejects(
    prepareCreatorTeamMediaCampaign(
      f.gameplay,
      f.bindings,
      [...f.assets, { sha256: 'f'.repeat(64), blob: new Blob(['unrelated']) }],
      f.options,
    ),
    /exactly the selected campaign dependencies/,
  );
  await assert.rejects(
    prepareCreatorTeamMediaCampaign(
      f.gameplay,
      f.bindings.map((row, index) =>
        index
          ? row
          : {
              ...row,
              story: { ...row.story, videoSha256: row.pictureSha256 },
            },
      ),
      f.assets,
      f.options,
    ),
    /both picture and video/,
  );
  await assert.rejects(
    prepareCreatorTeamMediaCampaign(
      f.gameplay,
      f.bindings.map((row, index) =>
        index ? row : { ...row, story: { ...row.story, endSeconds: 7 } },
      ),
      f.assets,
      f.options,
    ),
    /exceeds its inspected video duration/,
  );
});

test('changed or trailing Team media payload bytes fail closed', async () => {
  const f = await fixture(),
    prepared = await prepareCreatorTeamMediaCampaign(f.gameplay, f.bindings, f.assets, f.options),
    bytes = new Uint8Array(await exportCreatorTeamMediaCampaign(prepared).arrayBuffer());
  bytes[bytes.length - 1] ^= 0xff;
  await assert.rejects(
    importCreatorTeamMediaCampaign(new Blob([bytes], { type: CREATOR_TEAM_MEDIA_MIME }), f.options),
    /differs from its SHA-256 inventory/,
  );
  await assert.rejects(
    importCreatorTeamMediaCampaign(
      new Blob([exportCreatorTeamMediaCampaign(prepared), 'trailing'], {
        type: CREATOR_TEAM_MEDIA_MIME,
      }),
      f.options,
    ),
    /trailing or missing payload bytes/,
  );
});

test('runtime picture lease rechecks exact bytes and releases replaced decoded images', async () => {
  const f = await fixture(),
    prepared = await prepareCreatorTeamMediaCampaign(f.gameplay, f.bindings, f.assets, f.options);
  let releases = 0;
  const lease = createCreatorTeamMediaPictureLease(prepared, {
      decodeImage: async () => ({
        image: { naturalWidth: 1152, naturalHeight: 576 },
        release: () => releases++,
      }),
    }),
    first = { pack: prepared.pack, levelId: prepared.pack.levels[0].id },
    second = { pack: prepared.pack, levelId: prepared.pack.levels[1].id },
    binding = await lease.select(first);
  assert.equal(binding.choice.kind, 'image');
  assert.equal(binding.choice.sourceKind, 'creator-team-media');
  assert.equal(binding.choice.picture.sha256, f.firstHash);
  assert.equal(lease.confirm(first), binding);
  await lease.select(second);
  assert.equal(releases, 1);
  assert.throws(() => lease.confirm(first), /differs from its preparation/);
  lease.dispose();
  assert.equal(releases, 2);
});

test('installed Team media editions retain the hash of the complete portable payload', async () => {
  const f = await fixture(),
    prepared = await prepareCreatorTeamMediaCampaign(f.gameplay, f.bindings, f.assets, f.options),
    portable = exportCreatorTeamMediaCampaign(prepared),
    expectedEdition = hash(new Uint8Array(await portable.arrayBuffer())),
    memory = managedIndexedDB(),
    store = createInstalledTeamCampaignStore({
      indexedDB: memory.indexedDB,
      now: () => 91,
      ...f.options,
    }),
    installed = await store.install(prepared),
    inventory = await store.inventory();
  assert.equal(installed.editionId, expectedEdition);
  assert.equal(inventory.editions[0].editionId, expectedEdition);
  assert.equal(inventory.editions[0].hasMedia, true);
  assert.equal(inventory.editions[0].bytes, portable.size);
  const loaded = await store.load(expectedEdition, f.options),
    story = creatorTeamMediaForLevel(loaded.media, prepared.pack.levels[0].id).story;
  assert.equal(story.descriptor.video.sha256, f.videoHash);
  await assert.rejects(
    store.recordCompletion({
      editionId: expectedEdition,
      levelId: prepared.pack.levels[0].id,
      runId: 'wrong-reward-run',
      gameplayId: 'wrong-reward-gameplay',
      difficulty: 'standard',
      presetId: 'full',
      attempt: {},
      reward: {
        kind: 'picture',
        sourceKind: 'creator-team-media',
        sha256: 'f'.repeat(64),
        bytes: 1,
        mime: 'image/png',
        width: 1152,
        height: 576,
      },
    }),
    /differs from this exact media edition/,
  );
  store.close();
});

test('Team installation reviews, claims and commits bytes in the shared managed-media ledger', async () => {
  const f = await fixture(),
    prepared = await prepareCreatorTeamMediaCampaign(f.gameplay, f.bindings, f.assets, f.options),
    memory = managedIndexedDB(),
    claims = [],
    finalized = [],
    reconciliations = [];
  let items = [];
  const managedStore = {
      async reconcileExternalUsage(owner, next) {
        reconciliations.push({ owner, next: structuredClone(next) });
        items = next.map((item) => ({ ...item, state: 'committed' }));
        return {
          bytes: items.reduce((sum, item) => sum + item.bytes, 0),
          usedBytes: items.reduce((sum, item) => sum + item.bytes, 4096),
          limitBytes: 256 * 1024 * 1024,
          overBudget: false,
        };
      },
      async usage() {
        const externalBytes = items.reduce((sum, item) => sum + item.bytes, 0);
        return {
          usedBytes: externalBytes + 4096,
          externalBytes,
          reservedBytes: 0,
          limitBytes: 256 * 1024 * 1024,
        };
      },
      async claimExternalUsage(claim) {
        claims.push({ ...claim, signal: undefined });
        items.push({ id: claim.id, bytes: claim.bytes, state: 'pending' });
      },
      async finalizeExternalUsage(claim) {
        finalized.push({ ...claim, signal: undefined });
        items = items.map((item) =>
          item.id === claim.id ? { ...item, state: 'committed' } : item,
        );
      },
      close() {},
    },
    store = createInstalledTeamCampaignStore({
      indexedDB: memory.indexedDB,
      now: () => 92,
      managedStore,
      ...f.options,
    }),
    review = await store.reviewInstall(prepared);
  assert.equal(review.enoughManagedSpace, true);
  assert.equal(review.stagingBytes, prepared.bytes);
  const installed = await store.install(prepared);
  assert.equal(claims.length, 1);
  assert.equal(claims[0].owner, 'creator-team');
  assert.equal(claims[0].id, installed.editionId);
  assert.equal(claims[0].bytes, prepared.bytes);
  assert.equal(finalized.length, 1);
  await store.inventory();
  assert.equal(reconciliations.at(-1).next[0].id, installed.editionId);
  assert.equal((await store.reviewInstall(prepared)).stagingBytes, 0);
});

test('production Team intake recognizes media magic even when the browser omits MIME', async () => {
  const f = await fixture(),
    prepared = await prepareCreatorTeamMediaCampaign(f.gameplay, f.bindings, f.assets, f.options),
    bytes = await exportCreatorTeamMediaCampaign(prepared).arrayBuffer(),
    playable = await readPlayableTeamCampaign(new Blob([bytes]), f.options);
  assert.equal(playable.kind, 'creator-media');
  assert.equal(playable.pack.id, prepared.pack.id);
  assert.equal(playable.media.manifest.format, CREATOR_TEAM_MEDIA_FORMAT);
  assert.equal(playable.prepared, playable.media.gameplay);
});
