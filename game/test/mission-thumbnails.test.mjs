import test from 'node:test';
import assert from 'node:assert/strict';
import { createMissionPictureThumbnails } from '../ui/mission-thumbnails.mjs';
import { acquireEarnedPicture } from '../ui/earned-picture.mjs';
import { attachMissionGallery } from '../ui/mission-gallery.mjs';
import { earnedPictureFixture } from './helpers/earned-picture-fixture.mjs';
import { deferred, pngBytes } from './helpers/media-fixtures.mjs';
import { Document } from './helpers/couch-dom.mjs';

const image = `data:image/png;base64,${pngBytes().toString('base64')}`;
const button = () => ({ dataset: {}, isConnected: true });
const argumentsFor = (f, target = button()) => ({
  library: f.profile,
  entries: f.entries,
  entry: f.entries[0],
  themeId: 'fpv',
  targets: [{ button: target, level: f.entries[0].campaign.levels[0], earned: true }],
});
test('mission thumbnails use the first-earned pin and seed despite a newer assignment and best-score row', async (t) => {
  const f = await earnedPictureFixture();
  t.after(() => f.manager.close());
  const saved = await f.store.read(),
    edited = structuredClone(saved.document.library);
  edited.presentations.push({ ...edited.presentations[0], revision: 2 });
  edited.assignments[0].revision = 2;
  await f.store.commit(
    await f.store.prepare(edited, saved.assets, {
      executionCatalog: f.catalog,
      previous: saved.document,
    }),
    { expectedGeneration: saved.generation },
  );
  const target = button(),
    seen = [],
    disposed = [];
  const thumbnails = createMissionPictureThumbnails({
    readMedia: async () => ({ store: f.store, metadata: await f.store.readMetadata() }),
    acquire: (source, options) =>
      acquireEarnedPicture(source, {
        ...options,
        URLImpl: {
          createObjectURL: () => 'blob:earned',
          revokeObjectURL: (url) => disposed.push(url),
        },
        decodeImage: async () => ({ width: 1, height: 1, close: () => disposed.push('image') }),
      }),
    render(picture, backdrop) {
      seen.push({ pin: backdrop.pin, seed: picture.item.seed });
      return image;
    },
  });
  const args = argumentsFor(f, target);
  args.library = { ...f.profile, gallery: [{ ...f.item, seed: 999 }] };
  const before = JSON.stringify(args.library);
  await thumbnails.refresh(args);
  assert.equal(target.dataset.pictureState, 'earned');
  assert.equal(target.dataset.missionArtwork, image);
  assert.deepEqual(seen, [{ pin: f.receipt.presentationPin, seed: f.receipt.seed }]);
  assert.deepEqual(disposed.sort(), ['blob:earned', 'image']);
  assert.equal(JSON.stringify(args.library), before);
  thumbnails.close();
});
test('missing earned originals stay unavailable and never fall back to the current authored picture', async (t) => {
  const f = await earnedPictureFixture();
  t.after(() => f.manager.close());
  const target = button(),
    thumbnails = createMissionPictureThumbnails({
      readMedia: async () => {
        throw new Error('Missing earned original');
      },
      acquire: () => assert.fail('Failed pinned media cannot substitute source artwork.'),
      render: () => assert.fail('Failed pinned media cannot paint source artwork.'),
    });
  await thumbnails.refresh(argumentsFor(f, target));
  assert.equal(target.dataset.pictureState, 'unavailable');
  assert.equal(target.dataset.missionArtwork, undefined);
  thumbnails.close();
});
test('changing mission/world while acquisition is pending releases late art without changing either tile', async (t) => {
  const f = await earnedPictureFixture();
  t.after(() => f.manager.close());
  const gate = deferred(),
    started = deferred(),
    old = button(),
    next = button();
  let releases = 0;
  const thumbnails = createMissionPictureThumbnails({
    readMedia: async () => ({ store: f.store, metadata: f.metadata }),
    acquire: async () => {
      started.resolve();
      await gate.promise;
      return { picture: {}, backdrop: {}, release: () => releases++ };
    },
    render: () => assert.fail('Cancelled thumbnail cannot paint.'),
  });
  const loading = thumbnails.refresh(argumentsFor(f, old));
  await started.promise;
  await thumbnails.refresh({ ...argumentsFor(f, next), themeId: 'ukraine' });
  gate.resolve();
  await loading;
  assert.equal(releases, 1);
  assert.equal(old.dataset.missionArtwork, undefined);
  assert.equal(next.dataset.missionArtwork, undefined);
  thumbnails.close();
});
test('unearned missions never read originals and old receipt-free gallery rows retain installed legacy art', async (t) => {
  const f = await earnedPictureFixture();
  t.after(() => f.manager.close());
  const target = button(),
    seen = [],
    thumbnails = createMissionPictureThumbnails({
      readMedia: () => assert.fail('Unearned and legacy thumbnails need no managed media.'),
      render(picture, backdrop) {
        seen.push({ picture, backdrop });
        return image;
      },
    });
  const args = argumentsFor(f, target);
  await thumbnails.refresh({ ...args, targets: [{ ...args.targets[0], earned: false }] });
  assert.equal(target.dataset.pictureState, 'concealed');
  assert.equal(seen.length, 0);
  await thumbnails.refresh({ ...args, library: { ...f.profile, pictureReceipts: [] } });
  assert.equal(target.dataset.pictureState, 'earned');
  assert.equal(seen[0].picture.receipt, null);
  assert.equal(seen[0].backdrop, null);
  thumbnails.close();
});
test('an existing mission tile refreshes its exact image without replacing the focusable mission button', () => {
  const doc = new Document(),
    missions = doc.createElement('div'),
    mission = doc.createElement('button'),
    name = doc.createElement('span');
  name.className = 'name';
  name.textContent = 'Mission';
  mission.append(name);
  mission.dataset.pictureState = 'unavailable';
  missions.append(mission);
  doc.body.append(missions);
  const gallery = attachMissionGallery({ document: doc, missions });
  mission.focus();
  mission.dataset.pictureState = 'earned';
  mission.dataset.missionArtwork = image;
  gallery.sync();
  assert.equal(mission.querySelector('img').src, image);
  assert.equal(doc.activeElement, mission);
  assert.equal(mission.querySelectorAll('.mission-gallery-art').length, 1);
  delete mission.dataset.missionArtwork;
  mission.dataset.pictureState = 'unavailable';
  gallery.sync();
  assert.equal(mission.querySelector('img'), null);
  assert.equal(doc.activeElement, mission);
  gallery.destroy();
});
