import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { createCandidateSoloHost } from '../content-design/solo-host.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { acquireCandidatePicture, claimCandidatePicture } from '../content-design/picture.mjs';
import { emptyJourneyProfile } from '../journey/profile.mjs';
import { emptyJourneyPictures } from '../journey/pictures.mjs';
import { campaignKey } from '../library.mjs';
import { resolveDemoJourneyPicture } from '../ui/demo-journey-picture.mjs';

const source = createOpeningCandidates({ artwork: true });
const { themes } = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
);
const host = createCandidateSoloHost(source, { themes, buildVersion: 'demo-picture-test' });
const entry = host.entries.find((item) => item.difficulty === 'standard');
const level = entry.campaign.levels[0];
const manifest = entry.manifests[0];
const theme = entry.themes.find((item) => item.id === manifest.presentation.themeId);
const asset = manifest.background;
const bytes = await readFile(new URL(`../${asset.path}`, import.meta.url));
const media = await loadPreviewArtwork(asset, {
  fetchAsset: async () => new Response(bytes),
  digest: (value) => webcrypto.subtle.digest('SHA-256', value),
});

function fixture(difficulty = 'standard') {
  const owner = host.entries.find(
    (item) =>
      item.campaignId === entry.campaignId &&
      item.sourcePackId === entry.sourcePackId &&
      item.difficulty === difficulty,
  );
  const original = owner.campaign.levels[0];
  const mission = host.mission(owner, 0);
  const profile = emptyJourneyProfile();
  const pictures = emptyJourneyPictures();
  const record = {
    mode: 'solo',
    editionId: 'opening-test',
    missionId: mission.id,
    campaignKey: campaignKey(owner.campaign),
    levelId: original.id,
    levelRevision: String(original.revision),
    runId: 'earned-first-run',
    gameplayId: 'earned-exact-gameplay',
    difficulty,
    name: original.name,
    campaignTitle: owner.campaign.name ?? owner.campaign.title,
    themeId: theme.id,
    asset: structuredClone(owner.manifests[0].background),
  };
  profile.clears.solo[mission.id] = {
    runId: record.runId,
    gameplayId: record.gameplayId,
    difficulty,
  };
  pictures.records.push(record);
  const images = [],
    requested = [];
  const acquire = async (pin, options) => {
    requested.push(pin);
    const image = {
      width: asset.width,
      height: asset.height,
      closed: 0,
      close() {
        this.closed++;
      },
    };
    images.push(image);
    return acquireCandidatePicture(pin, {
      ...options,
      loadArtwork: async () => media,
      decodeImage: async () => image,
    });
  };
  const request = {
    entry,
    level,
    theme,
    journey: {
      editionId: record.editionId,
      missionId: mission.id,
      profile,
      pictures,
      entries: host.entries,
    },
    acquire,
  };
  return { request, record, profile, pictures, requested, images };
}

test('an exact earned Journey original is clear, owns the actual candidate image, and never changes progress', async () => {
  const f = fixture();
  const before = JSON.stringify({ entry, profile: f.profile, pictures: f.pictures });
  const picture = await resolveDemoJourneyPicture(f.request);
  assert.equal(picture.pictureVisibility, 'clear');
  assert.equal(picture.artSeed, null);
  assert.equal(picture.backdrop.kind, 'candidate-picture');
  assert.equal(picture.backdrop.image, f.images[0]);
  assert.deepEqual(picture.backdrop.assetRevision, asset);
  assert.deepEqual(f.requested, [asset]);
  assert.equal(JSON.stringify({ entry, profile: f.profile, pictures: f.pictures }), before);
  picture.dispose();
  picture.dispose();
  assert.equal(f.images[0].closed, 1);
});

test('the retained first-earned original survives a later legitimate win and another installed difficulty', async () => {
  const f = fixture('gentle');
  const before = JSON.stringify(f.record);
  f.profile.clears.solo[f.record.missionId] = {
    runId: 'later-standard-run',
    gameplayId: 'later-exact-gameplay',
    difficulty: 'standard',
  };
  const picture = await resolveDemoJourneyPicture(f.request);
  assert.equal(picture.pictureVisibility, 'clear');
  assert.equal(JSON.stringify(f.record), before);
  picture.dispose();
  const withoutRecordedOwner = await resolveDemoJourneyPicture({
    ...f.request,
    journey: { ...f.request.journey, entries: [entry] },
  });
  assert.equal(withoutRecordedOwner.pictureVisibility, 'blurred');
  assert.ok(
    withoutRecordedOwner.backdrop,
    'The current original still supplies the concealed preview.',
  );
  withoutRecordedOwner.dispose();
});

test('missing, malformed, foreign and wrong-mode receipts retain the current image but cannot reveal it', async () => {
  const changes = [
    (f) => {
      f.pictures.records = [];
    },
    (f) => {
      f.profile.clears.solo = {};
    },
    (f) => {
      f.profile.clears.solo[f.record.missionId].runId = '';
    },
    (f) => {
      f.record.mode = 'versus';
    },
    (f) => {
      f.record.editionId = 'other-edition';
    },
    (f) => {
      f.record.missionId += '-other';
    },
    (f) => {
      f.record.campaignKey += '-other';
    },
    (f) => {
      f.record.levelId += '-other';
    },
    (f) => {
      f.record.levelRevision += '-other';
    },
    (f) => {
      f.record.themeId = 'other-world';
    },
    (f) => {
      f.record.difficulty = 'expert';
    },
    (f) => {
      f.record.asset.id += '-other';
    },
    (f) => {
      f.record.asset.revision += '-other';
    },
    (f) => {
      f.record.asset.sha256 = 'f'.repeat(64);
    },
    (f) => {
      f.record.asset.path = 'content-design/assets/other.png';
    },
    (f) => {
      f.record.asset.bytes++;
    },
    (f) => {
      f.record.asset.width++;
    },
    (f) => {
      f.record.asset.alt = 'Another description';
    },
  ];
  for (const change of changes) {
    const f = fixture();
    change(f);
    const before = JSON.stringify({ profile: f.profile, pictures: f.pictures });
    const picture = await resolveDemoJourneyPicture(f.request);
    assert.equal(picture.pictureVisibility, 'blurred', change.toString());
    assert.deepEqual(picture.backdrop.assetRevision, asset);
    assert.deepEqual(f.requested, [asset], 'The ledger never chooses the displayed original.');
    assert.equal(JSON.stringify({ profile: f.profile, pictures: f.pictures }), before);
    picture.dispose();
    assert.equal(f.images[0].closed, 1);
  }
});

test('a foreign company cannot authorize the same exact asset through a matching historical campaign', async () => {
  const f = fixture();
  const foreign = structuredClone(entry);
  foreign.sourceProjectId = 'foreign-company-project';
  foreign.sourcePackId = 'foreign-company-pack';
  foreign.campaignId = 'foreign-company-campaign';
  foreign.campaign.id = 'foreign-company-runtime';
  f.record.campaignKey = campaignKey(foreign.campaign);
  f.request.journey.entries = [entry, foreign];
  assert.deepEqual(foreign.manifests[0].background, asset);
  const picture = await resolveDemoJourneyPicture(f.request);
  assert.equal(picture.pictureVisibility, 'blurred');
  assert.deepEqual(picture.backdrop.assetRevision, asset);
  picture.dispose();
  assert.equal(f.images[0].closed, 1);
});

test('a current replacement original supplies the concealed backdrop without inheriting the old earned receipt', async () => {
  const f = fixture();
  const current = structuredClone(entry);
  const replacement = { ...asset, revision: 'replacement-r2', alt: 'Replacement original' };
  current.manifests[0].background = replacement;
  const replacementMedia = await loadPreviewArtwork(replacement, {
    fetchAsset: async () => new Response(bytes),
    digest: (value) => webcrypto.subtle.digest('SHA-256', value),
  });
  const image = {
    width: replacement.width,
    height: replacement.height,
    closed: 0,
    close() {
      this.closed++;
    },
  };
  const before = JSON.stringify(f.pictures);
  const picture = await resolveDemoJourneyPicture({
    ...f.request,
    entry: current,
    level: current.campaign.levels[0],
    journey: { ...f.request.journey, entries: [current, entry] },
    acquire: (pin, options) => {
      assert.deepEqual(pin, replacement, 'The current manifest, never the ledger, selects art.');
      return acquireCandidatePicture(pin, {
        ...options,
        loadArtwork: async () => replacementMedia,
        decodeImage: async () => image,
      });
    },
  });
  assert.equal(picture.pictureVisibility, 'blurred');
  assert.deepEqual(picture.backdrop.assetRevision, replacement);
  assert.equal(picture.backdrop.image, image);
  assert.equal(JSON.stringify(f.pictures), before);
  picture.dispose();
  picture.dispose();
  assert.equal(image.closed, 1);
});

test('unowned entries, changed levels, foreign mission context and unavailable backgrounds fail before acquisition', async () => {
  for (const kind of ['unowned', 'level', 'mission', 'theme', 'no-background']) {
    const f = fixture();
    if (kind === 'unowned') f.request.entry = structuredClone(entry);
    if (kind === 'level') f.request.level = { ...level, revision: 'another-revision' };
    if (kind === 'mission') f.request.journey.missionId += '-other';
    if (kind === 'theme') f.request.theme = { ...theme, id: 'other-world' };
    if (kind === 'no-background') {
      const replacement = structuredClone(entry);
      replacement.manifests[0].background = null;
      f.request.entry = replacement;
      f.request.journey.entries = [replacement];
    }
    const picture = await resolveDemoJourneyPicture(f.request);
    assert.equal(picture.pictureVisibility, 'blurred', kind);
    assert.equal(picture.backdrop, null);
    assert.equal(f.requested.length, 0);
    picture.dispose();
  }
});

test('acquisition failures and bindings owned by another display never become clear or steal ownership', async () => {
  const f = fixture();
  const failed = await resolveDemoJourneyPicture({
    ...f.request,
    acquire: async () => {
      throw Error('decode failed');
    },
  });
  assert.equal(failed.pictureVisibility, 'blurred');
  assert.equal(failed.backdrop, null);
  const binding = await f.request.acquire(asset, {});
  claimCandidatePicture(asset, binding);
  const borrowed = await resolveDemoJourneyPicture({ ...f.request, acquire: async () => binding });
  assert.equal(borrowed.backdrop, null);
  assert.equal(f.images[0].closed, 0, 'A different display keeps its claimed original.');
  binding.release();
  assert.equal(f.images[0].closed, 1);
  let forgedRelease = 0;
  const forged = await resolveDemoJourneyPicture({
    ...f.request,
    acquire: async () => ({
      image: f.images[0],
      assetRevision: asset,
      release: () => forgedRelease++,
    }),
  });
  assert.equal(forged.backdrop, null);
  assert.equal(forged.pictureVisibility, 'blurred');
  assert.equal(forgedRelease, 0, 'Unbranded objects never acquire display ownership.');
});

test('cancellation releases a late verified decode once and does not display an earned original', async () => {
  const f = fixture();
  const abort = new AbortController();
  let finish;
  const pending = resolveDemoJourneyPicture({
    ...f.request,
    signal: abort.signal,
    acquire: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  abort.abort();
  finish(await f.request.acquire(asset, {}));
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(f.images[0].closed, 1);
  await assert.rejects(resolveDemoJourneyPicture({ ...f.request, signal: abort.signal }), {
    name: 'AbortError',
  });
  assert.equal(f.requested.length, 1, 'Already cancelled requests never acquire.');
});
