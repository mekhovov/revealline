import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { createMediaIdentityCatalog } from '../media-library.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createFlightPictures } from '../ui/flight-pictures.mjs';
import { acquirePresentationImage } from '../ui/presentation-image.mjs';
import { presentationPicturePins } from '../flight-media-pins.mjs';
import { createCouchStaticPictures } from '../couch/couch-static-pictures.mjs';
import { preparePack, resolvePackCampaign } from '../packs.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { CURRENT_PICTURES } from '../presentation/current-pictures.mjs';
import { CURRENT_ART_SOURCES } from '../presentation/current-art-sources.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import { importThemeBundle } from '../presentation/bundle.mjs';
import {
  createReleasePictureDefaults,
  releasePictureForIdentity,
  matchesReleasePictureBaseline,
} from '../presentation/release-pictures.mjs';
import { SOURCE_EXTERNAL_CHAPTERS } from '../external-chapter-source.mjs';
import { EXTERNAL_CATALOG } from '../external-chapter-catalog.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

// Real source and approved release bytes. The Image/IndexedDB boundaries below
// are finite models; none of these checks establishes native pixel decoding/play.
const file = (p) => fs.readFile(new URL(`../../${p}`, import.meta.url));
const json = async (p) => JSON.parse(await file(p));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sameOwner = (a, b) =>
  ['baseCampaignKey', 'levelId', 'levelRevision', 'themeId'].every((k) => a[k] === b[k]);
const dataBytes = (url) => Buffer.from(url.split(',')[1], 'base64');
const header = (bytes, mime = 'image/png') => {
  const found = inspectImageDataUrl(`data:${mime};base64,${bytes.toString('base64')}`);
  assert.equal(found.valid, true);
  return found;
};
const decodeImage = async (value) => {
  const bytes =
    typeof value === 'string' ? dataBytes(value) : Buffer.from(await value.arrayBuffer());
  const h = header(bytes);
  return { naturalWidth: h.width, naturalHeight: h.height };
};
const runtime = await json('game/presentation/compiled/runtime.json');
const ledger = await importThemeBundle(
  new Blob([await file('authoring/library/fpv-field-kit/production.rltheme')]),
  { decodeImage: null },
);
const approved = resolvePresentation(ledger.document, {
  themeId: runtime.resolved.theme.id,
  collectionId: runtime.resolved.collection?.id ?? null,
});
assert.deepEqual(runtime.source, { id: ledger.document.id, revision: ledger.document.revision });
const releaseFiles = new Map();
async function verifyRelease(identity, row) {
  const choice = releasePictureForIdentity(runtime, identity);
  if (identity.themeId !== 'fpv') {
    assert.equal(choice, null, 'Non-FPV authored content cannot receive an FPV release override.');
    return null;
  }
  assert.ok(choice, `Required registered FPV owner is unbound: ${row.id}`);
  assert.equal(
    choice.slotId,
    row.id,
    'Exact production slots cannot silently fall back to a generic scene.',
  );
  assert.deepEqual(choice.identity, identity);
  assert.deepEqual(
    choice.asset,
    approved.assets[row.id],
    'Runtime slot must match the independent immutable production ledger.',
  );
  const asset = choice.asset;
  assert.equal(
    asset.quality.stage,
    'reviewed',
    'Selected release artwork needs recorded production review.',
  );
  const path = `game/presentation/compiled/assets/${asset.file.sha256}.${asset.file.mime === 'image/jpeg' ? 'jpg' : 'png'}`;
  const bytes = await file(path);
  assert.equal(sha(bytes), asset.file.sha256);
  assert.equal(bytes.length, asset.file.bytes);
  assert.deepEqual(
    [header(bytes, asset.file.mime).width, header(bytes, asset.file.mime).height],
    [asset.file.width, asset.file.height],
  );
  assert.deepEqual(
    bytes,
    Buffer.from(await ledger.assets.get(asset.file.sha256).arrayBuffer()),
    'Compiled derivative must retain approved original bytes.',
  );
  assert.deepEqual(
    [asset.geometry.frame.width, asset.geometry.frame.height],
    [asset.file.width, asset.file.height],
  );
  assert.equal(
    releasePictureForIdentity(runtime, {
      ...identity,
      levelRevision: `${identity.levelRevision}-changed`,
    }),
    null,
  );
  assert.equal(
    releasePictureForIdentity(runtime, {
      ...identity,
      baseCampaignKey: `${identity.baseCampaignKey}-changed`,
    }),
    null,
  );
  releaseFiles.set(row.id, { asset, bytes });
  return choice;
}
function browser() {
  const urls = new Map();
  let serial = 0;
  class ImageClass {
    set src(src) {
      Promise.resolve()
        .then(async () => {
          this.bytes = src.startsWith('data:')
            ? dataBytes(src)
            : Buffer.from(await urls.get(src).arrayBuffer());
          const h = header(this.bytes);
          this.width = this.naturalWidth = h.width;
          this.height = this.naturalHeight = h.height;
          this.onload?.();
        })
        .catch((error) => this.onerror?.(error));
    }
    async decode() {}
    removeAttribute() {}
  }
  const URLImpl = {
    createObjectURL(blob) {
      const key = `blob:inventory/${++serial}`;
      urls.set(key, blob);
      return key;
    },
    revokeObjectURL(key) {
      assert(urls.delete(key));
    },
  };
  return { ImageClass, URLImpl, urls };
}
function exactRow(identity) {
  const matches = CURRENT_PICTURES.filter((row) => sameOwner(row.owner, identity));
  assert.equal(
    matches.length,
    1,
    `Every enumerated owner needs one exact registry row: ${JSON.stringify(identity)}`,
  );
  const source = CURRENT_ART_SOURCES.find((row) => row.id === matches[0].id);
  assert.deepEqual(source?.owner, identity);
  return { row: matches[0], source };
}
const backgroundFor = (entry, level) =>
  entry.levelVisuals?.find((row) => row.levelId === level.id)?.visualOverrides.background ??
  entry.visualOverrides?.background ??
  null;
const contexts = (entry) => {
  const catalog = createExecutionCatalog([entry]);
  return {
    catalog,
    context: catalog.entries.find((row) => row.difficulty === 'standard'),
    identities: createMediaIdentityCatalog(catalog),
  };
};
const requestFor = (context, level, theme) => ({
  executionKey: context.executionKey,
  levelId: level.id,
  levelRevision: level.revision,
  themeId: theme.id,
});

test('every built-in Solo/Versus owner acquires the exact approved release or explicit procedural presentation', async (t) => {
  const campaign = await json('game/content/campaign.json'),
    classes = await json('game/content/classes.json'),
    themes = await json('game/content/themes.json');
  const pack = (
    await preparePack(await json('game/content/packs/fpv-arcade-r5.json'), { decodeImage })
  ).pack;
  const entries = [
    {
      campaign: { ...campaign, classRecipes: classes },
      classRecipes: classes,
      themes: themes.themes,
    },
    ...pack.campaigns.map((c) => resolvePackCampaign(pack, c.id)),
  ];
  let total = 0,
    images = 0,
    procedures = 0;
  for (const entry of entries) {
    const { catalog, context, identities } = contexts(entry);
    for (const level of entry.campaign.levels)
      for (const theme of entry.themes) {
        total++;
        await t.test(`${entry.campaign.id}/${level.id}/${theme.id}`, async (st) => {
          const request = requestFor(context, level, theme),
            identity = identities.resolve(request);
          const { row, source } = exactRow(identity),
            background = backgroundFor(entry, level);
          const choice = await verifyRelease(identity, row);
          assert.equal(
            await matchesReleasePictureBaseline(identity, background),
            theme.id === 'fpv',
          );
          const memory = managedIndexedDB(),
            model = browser();
          let committedWrites = 0;
          memory.afterAnyCommit = () => committedWrites++;
          const manager = createManagedMediaStore({
            indexedDB: memory.indexedDB,
            storyMedia: true,
          });
          const store = createStillMediaStore({ managedStore: manager, decodeImage });
          const page = {
            ready: Promise.resolve(runtime),
            current: () => runtime,
            async readPicture(slotId, options) {
              assert.equal(options.snapshot, runtime);
              const data = releaseFiles.get(slotId);
              assert(data);
              return {
                asset: data.asset,
                blob: new Blob([data.bytes], { type: data.asset.file.mime }),
              };
            },
          };
          const readMedia = async (options) => ({
            store,
            ...(await store.readPresentationMetadata(options)),
          });
          const defaults = createReleasePictureDefaults({
            getHost: () => page,
            executionCatalog: () => catalog,
            readMedia,
          });
          const solo = createFlightPictures({
            context: { runId: `inventory-${total}`, ...request },
            level,
            themeIds: [theme.id],
            identityCatalog: identities,
            readMedia,
            prepareSelection: (options) =>
              defaults.prepareSelection({ ...options, authoredBackground: background }),
            acquire: (input, options) => acquirePresentationImage(input, { ...options, ...model }),
          });
          const versus = createCouchStaticPictures({
            entries: [entry],
            presentationPage: page,
            indexedDB: memory.indexedDB,
            ...model,
          });
          st.after(() => {
            solo.dispose();
            versus.dispose();
            store.close();
            manager.close();
            assert.equal(model.urls.size, 0);
          });
          await solo.ensure();
          const soloPin = presentationPicturePins(solo.pins()).choices[0];
          assert.deepEqual(soloPin.identity, identity);
          const beforeWrites = [memory.allPuts.length, committedWrites];
          const raceRow = {
            level,
            pictureEntry: entry,
            authoredBackground: background,
            defaultThemeId: theme.id,
          };
          const current = await versus.select(raceRow, { raceId: total, themeId: theme.id });
          assert.equal(await versus.confirm(raceRow, { raceId: total }), current);
          assert.deepEqual(
            [memory.allPuts.length, committedWrites],
            beforeWrites,
            'Versus must consume without materializing assignments or progress.',
          );
          assert.deepEqual(current.choice.identity, identity);
          if (choice) {
            images++;
            assert.equal(soloPin.kind, 'still');
            for (const picture of [solo.current(), current]) {
              assert.equal(sha(picture.image.bytes), choice.asset.file.sha256);
              assert.equal(picture.fit, 'contain');
              assert.equal(picture.sampling, 'nearest');
            }
          } else {
            procedures++;
            assert.equal(source.kind, 'procedural');
            assert.equal(source.source.kind, 'base');
            assert.equal(background, null);
            assert.equal(soloPin.kind, 'legacy');
            assert.equal(solo.current(), null);
            assert.equal(current.image, null);
            assert.deepEqual(
              source.theme,
              theme,
              'Procedural presentation must retain the complete authored theme.',
            );
            assert.deepEqual(
              source.level,
              level,
              'Procedural presentation must retain the complete authored level.',
            );
            for (const locator of [source.source, ...source.source.contracts]) {
              const original = await file(locator.path);
              assert.equal(sha(original), locator.sha256);
              assert.equal(original.length, locator.bytes);
            }
          }
          assert.deepEqual(
            (await store.read()).document.library.assignments,
            [],
            'Fresh visual selection is not an earned/saved assignment.',
          );
        });
      }
  }
  assert.deepEqual({ total, images, procedures }, { total: 51, images: 15, procedures: 36 });
});

test('every optional embedded mission has exact authored image bytes and a compatible release category', async (t) => {
  const catalog = await json('game/content/optional-worlds.json');
  let total = 0,
    releases = 0;
  for (const item of catalog.packs)
    await t.test(item.id, async () => {
      const bytes = await file(item.path);
      assert.equal(sha(bytes), item.sha256);
      assert.equal(bytes.length, item.bytes);
      const pack = (await preparePack(JSON.parse(bytes), { decodeImage })).pack;
      let count = 0;
      for (const campaign of pack.campaigns) {
        const entry = resolvePackCampaign(pack, campaign.id),
          { context, identities } = contexts(entry);
        for (const level of entry.campaign.levels) {
          const theme = entry.themes.find((theme) => theme.id === item.themeId);
          assert(theme);
          const identity = identities.resolve(requestFor(context, level, theme));
          assert.equal(identity.baseCampaignKey, item.campaignKey);
          const { row, source } = exactRow(identity);
          assert.equal(source.kind, 'embedded');
          const background = backgroundFor(entry, level);
          assert(background);
          const original = dataBytes(background.dataUrl);
          assert.equal(sha(original), source.image.sha256);
          assert.equal(original.length, source.image.bytes);
          assert.deepEqual(
            [header(original).width, header(original).height],
            [source.image.width, source.image.height],
          );
          assert.equal(background.fit ?? 'cover', source.fit);
          assert.equal(
            await matchesReleasePictureBaseline(identity, background),
            theme.id === 'fpv',
          );
          if (await verifyRelease(identity, row)) releases++;
          total++;
          count++;
        }
      }
      assert.equal(count, item.levels);
    });
  assert.deepEqual({ total, releases }, { total: 15, releases: 6 });
});

test('every external mission preserves descriptor ownership and original byte readiness independently of release selection', async (t) => {
  let total = 0,
    releases = 0;
  for (const descriptor of SOURCE_EXTERNAL_CHAPTERS)
    await t.test(descriptor.id, async () => {
      const item = EXTERNAL_CATALOG.chapters.find((item) => item.id === descriptor.id);
      assert(item);
      assert.equal(item.campaignKey, descriptor.campaignKey);
      assert.equal(item.themeId, descriptor.themeId);
      for (const original of descriptor.originals) {
        const identity = {
          baseCampaignKey: descriptor.campaignKey,
          levelId: original.levelId,
          levelRevision: original.levelRevision,
          themeId: descriptor.themeId,
        };
        const { row, source } = exactRow(identity);
        assert.equal(source.kind, 'external');
        assert.equal(source.source.descriptorId, descriptor.id);
        assert.deepEqual(source.source.pack, item.pack);
        assert.deepEqual(source.source.media, item.media);
        for (const key of ['sha256', 'bytes', 'mime', 'width', 'height'])
          assert.equal(source.image[key], original[key]);
        assert(
          source.sourceImagePath,
          'A descriptor must have a reproducible original in the source distribution.',
        );
        const bytes = await file(source.sourceImagePath);
        assert.equal(sha(bytes), original.sha256);
        assert.equal(bytes.length, original.bytes);
        assert.deepEqual(
          [header(bytes, original.mime).width, header(bytes, original.mime).height],
          [original.width, original.height],
        );
        assert.equal(
          await matchesReleasePictureBaseline(identity, null),
          descriptor.themeId === 'fpv',
        );
        if (await verifyRelease(identity, row)) releases++;
        total++;
      }
      assert.equal(descriptor.originals.length, item.levels);
    });
  // Source readiness is not an IndexedDB installation proof: the external-host
  // parity tests separately require authenticated descriptor originals in storage.
  assert.deepEqual({ total, releases }, { total: 48, releases: 12 });
});
