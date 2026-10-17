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
  assert.equal(old.dataset.pictureState, 'loading');
  await thumbnails.refresh({ ...argumentsFor(f, next), themeId: 'ukraine' });
  gate.resolve();
  await loading;
  assert.equal(releases, 1);
  assert.equal(old.dataset.pictureState, 'unavailable');
  assert.equal(old.dataset.missionArtwork, undefined);
  assert.equal(next.dataset.missionArtwork, undefined);
  thumbnails.close();
});
test('an aborted original acquisition clears activity from all pending mission tiles', async (t) => {
  const f = await earnedPictureFixture();
  t.after(() => f.manager.close());
  const first = button(),
    second = button(),
    args = argumentsFor(f, first),
    gate = deferred(),
    thumbnails = createMissionPictureThumbnails({
      readMedia: () => gate.promise,
      acquire: () => {
        throw new DOMException('Original read cancelled.', 'AbortError');
      },
      render: () => assert.fail('Cancelled originals cannot paint.'),
    });
  const pending = thumbnails.refresh({
    ...args,
    targets: [...args.targets, { ...args.targets[0], button: second }],
  });
  assert.equal(first.dataset.pictureState, 'loading');
  assert.equal(second.dataset.pictureState, 'loading');
  gate.resolve({ metadata: f.metadata, store: f.store });
  await pending;
  assert.equal(first.dataset.pictureState, 'unavailable');
  assert.equal(second.dataset.pictureState, 'unavailable');
  assert.equal(first.dataset.missionArtwork, undefined);
  assert.equal(second.dataset.missionArtwork, undefined);
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

test('inactive mission lists do not start optional media reads, acquisitions or rendering', async (t) => {
  const f = await earnedPictureFixture();
  t.after(() => f.manager.close());
  const target = button();
  const thumbnails = createMissionPictureThumbnails({
    isActive: () => false,
    readMedia: () => assert.fail('A closed list cannot read optional media.'),
    acquire: () => assert.fail('A closed list cannot acquire an earned image.'),
    render: () => assert.fail('A closed list cannot render an earned image.'),
    onUpdate: () => assert.fail('A closed list cannot synchronize its gallery.'),
  });
  await thumbnails.refresh(argumentsFor(f, target));
  assert.equal(target.dataset.missionArtwork, undefined);
  thumbnails.close();
});

test('closing during an owned read prevents acquisition and reopening admits fresh earned art', async (t) => {
  const f = await earnedPictureFixture();
  t.after(() => f.manager.close());
  let active = true;
  let acquisitions = 0;
  let renders = 0;
  let releases = 0;
  const gate = deferred();
  const target = button();
  const thumbnails = createMissionPictureThumbnails({
    isActive: () => active,
    readMedia: () => gate.promise,
    acquire: async () => {
      acquisitions++;
      return { picture: {}, release: () => releases++ };
    },
    render: () => {
      renders++;
      return image;
    },
  });
  const pending = thumbnails.refresh(argumentsFor(f, target));
  active = false;
  gate.resolve({ metadata: f.metadata, store: f.store });
  await pending;
  assert.equal(acquisitions, 0);
  assert.equal(renders, 0);
  assert.equal(target.dataset.pictureState, 'unavailable');
  active = true;
  await thumbnails.refresh(argumentsFor(f, target));
  assert.equal(acquisitions, 1);
  assert.equal(renders, 1);
  assert.equal(releases, 1);
  assert.equal(target.dataset.pictureState, 'earned');
  thumbnails.close();
});

test('Resume during acquisition releases the late lease once without rendering or hidden updates', async (t) => {
  const f = await earnedPictureFixture();
  t.after(() => f.manager.close());
  let active = true;
  let releases = 0;
  let updates = 0;
  const gate = deferred();
  const entered = deferred();
  const target = button();
  const thumbnails = createMissionPictureThumbnails({
    isActive: () => active,
    readMedia: async () => ({ metadata: f.metadata, store: f.store }),
    acquire: async () => {
      entered.resolve();
      await gate.promise;
      return { picture: {}, release: () => releases++ };
    },
    render: () => assert.fail('Late optional work cannot render during gameplay.'),
    onUpdate: () => updates++,
  });
  const pending = thumbnails.refresh(argumentsFor(f, target));
  await entered.promise;
  active = false;
  const priorUpdates = updates;
  gate.resolve();
  await pending;
  assert.equal(releases, 1);
  assert.equal(updates, priorUpdates);
  assert.equal(target.dataset.missionArtwork, undefined);
  assert.equal(target.dataset.pictureState, 'unavailable');
  thumbnails.close();
});
