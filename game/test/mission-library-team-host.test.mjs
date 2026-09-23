import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { page } from './helpers/coop-host.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import { createTeamSpatialOriginalCandidates } from '../content-design/team-spatial-originals.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { teamJourneyLibrarySource } from '../mission-library/team-source.mjs';
import { JOURNEY_PREFERENCES_KEY, JOURNEY_PREFERENCES_VERSION } from '../journey/preferences.mjs';

const source = createTeamSpatialOriginalCandidates();
const journey = createCandidateTeamHost(source, {
  corePackIds: source.packs.map((pack) => pack.id),
});
const model = createMissionLibrary([teamJourneyLibrarySource({ journey, launch: () => true })]);
const originals = new Map(
  await Promise.all(
    source.assets.map(async (asset) => [
      asset.path,
      await readFile(new URL('../' + asset.path, import.meta.url)),
    ]),
  ),
);
const base = 'http://localhost/game/couch/relay-rescue.html';
async function fixture(t, { difficulty = 'standard', beforeImport, holdAsset, ...options } = {}) {
  const values = new Map([
      [
        JOURNEY_PREFERENCES_KEY,
        JSON.stringify({
          format: JOURNEY_PREFERENCES_VERSION,
          difficulty,
        }),
      ],
    ]),
    reads = [];
  const f = await page(t, {
    href: base,
    nativeFocus: true,
    nativeVisibility: true,
    retainInitialDifficulty: true,
    capturePaint: true,
    ...options,
    beforeImport(context) {
      const { install } = context,
        BaseImage = globalThis.Image;
      context.$('coop-discovery-preview-canvas').getContext = () => ({
        drawImage() {},
        fillRect() {},
      });
      class OriginalImage extends BaseImage {
        async decode() {
          if (!this.source.startsWith('data:image/png;base64,')) return super.decode();
          const bytes = Buffer.from(this.source.split(',')[1], 'base64');
          this.width = this.naturalWidth = bytes.readUInt32BE(16);
          this.height = this.naturalHeight = bytes.readUInt32BE(20);
          this.sha256 = createHash('sha256').update(bytes).digest('hex');
        }
      }
      install('localStorage', {
        value: {
          getItem: (key) => values.get(key) ?? null,
          setItem: (key, value) => values.set(key, value),
        },
      });
      install('Image', { value: OriginalImage });
      install('crypto', { value: webcrypto });
      install('fetch', {
        value: async (url) => {
          const asset = source.assets.find((row) => new URL(url).pathname.endsWith('/' + row.path));
          assert(asset, 'Only registered Team artwork is fetched');
          reads.push(asset.id);
          await holdAsset?.(asset);
          return new Response(originals.get(asset.path));
        },
      });
      beforeImport?.(context);
    },
  });
  return Object.assign(f, { reads, values });
}
async function open(f, paused = false) {
  const button = f.$(paused ? 'coop-discovery-paused' : 'coop-discovery-open');
  button.focus();
  f.tap('Enter');
  await waitFor(
    () => f.$('journey-chooser')?.open,
    () => f.$('coop-discovery-status').textContent,
  );
}
const cards = (f) => [...f.$('journey-cards').querySelectorAll('.journey-card')];
const card = (f, name) =>
  cards(f).find((button) => button.querySelector('strong').textContent === name);
async function play(f, name) {
  const button = card(f, name);
  assert(button, name);
  button.focus();
  f.tap('Enter');
  await waitFor(
    () =>
      f.$('coop-stage').textContent === name.toUpperCase() &&
      f.$('coop-overlay').hidden &&
      !f.$('journey-chooser').open,
    () =>
      `${f.$('coop-discovery-status').textContent} ${f.$('journey-chooser-status').textContent}`,
  );
}

test('Team unified chooser has12 missions plus2 retained arenas; browsing is artwork-lazy', async (t) => {
  const f = await fixture(t);
  const reads = f.reads.length;
  await open(f);
  assert.equal(cards(f).length, 14);
  assert.equal(cards(f).filter((row) => row.textContent.includes('Classic')).length, 2);
  assert.equal(f.reads.length, reads);
  assert.equal(f.$('journey-mode').value, 'team');
  assert.match(cards(f)[0].querySelector('.journey-card-challenge').textContent, /band|Band/);
  f.$('journey-back').click();
  assert.equal(f.doc.activeElement.id, 'coop-discovery-open');
  assert.equal(f.$('coop-level').value, 'twin-landings');
});

test('explicit current Team handoff shows player-facing edition and retains every exact mission ID', async (t) => {
  const f = await fixture(t, { href: `${base}?journey=team-spatial-originals-1` });
  await open(f);
  const journeyCards = cards(f).filter((row) => row.textContent.includes('Journey'));
  assert.equal(journeyCards.length, 12);
  assert.deepEqual(
    journeyCards.map((row) => row.dataset.missionId),
    model.missions.map((row) => row.id),
  );
  for (const row of journeyCards) {
    assert.equal(row.querySelector('.journey-card-edition').textContent, 'Team Journey');
    assert.doesNotMatch(
      row.textContent,
      /team-spatial-originals|visual qualification|Geometry test/,
    );
  }
  assert.match(f.$('journey-campaign').textContent, /Horizon partners/);
});

test('Team library plays an exact nonfirst mission at the selected Expert preset and keeps original Next', async (t) => {
  const f = await fixture(t, { difficulty: 'expert' });
  await open(f);
  await play(f, 'Shared lookout');
  assert.equal(f.$('coop-level').value, 'shared-lookout');
  assert.equal(f.$('coop-difficulty').value, 'expert');
  assert.equal(f.$('coop-reserves').textContent, '1 reserve');
  f.$('coop-journey-skip').click();
  f.$('coop-journey-skip-confirm').click();
  await waitFor(() => f.$('coop-level').value === 'twin-depots');
  assert.equal(f.$('coop-difficulty').value, 'expert');
});

test('incoming opaque Team ID resolves exact nonfirst mission before any artwork preparation', async (t) => {
  const target = model.missions.find((row) => row.name === 'Shared lookout');
  const params = new URLSearchParams({
    journey: 'team-spatial-originals-1',
    'library-mission': target.id,
  });
  const f = await fixture(t, { href: `${base}?${params}`, difficulty: 'expert' });
  assert.equal(f.$('coop-level').value, 'shared-lookout');
  assert.equal(f.$('coop-difficulty').value, 'expert');
  const mission = source.missions.find((row) => row.id === 'shared-lookout');
  assert.deepEqual(f.reads, [mission.presentation.backgroundAssetId]);
  assert.equal(f.$('coop-menu').hidden, true, 'Incoming Play needs no second Start activation');
  assert.equal(f.$('coop-stage').textContent, 'SHARED LOOKOUT');
});

for (const query of ['library-mission=retired-visit', 'library-mission=x&library-mission=y'])
  test(`invalid Team handoff does not silently prepare another arena: ${query}`, async (t) => {
    const f = await fixture(t, { href: `${base}?journey=legacy&${query}`, expectError: true });
    assert.equal(f.doc.documentElement.dataset.toolState, 'error');
    assert.equal(f.reads.length, 0);
    assert.equal(f.artwork.calls.reads.length, 0);
  });

test('same-ID imported Team edition stays Custom and launches its own preset', async (t) => {
  const f = await fixture(t);
  await f.selectFile(JSON.stringify(createTeamTestPack(source, 'twin-landings', 'expert')));
  await open(f);
  assert.equal(cards(f).length, 15);
  const same = cards(f).filter(
    (button) => button.querySelector('strong').textContent === 'Twin landings',
  );
  assert.equal(same.length, 2);
  assert.notEqual(same[0].dataset.missionId, same[1].dataset.missionId);
  const custom = same.find(
    (button) => button.querySelector('.journey-card-tags').textContent === 'Custom',
  );
  assert(custom);
  custom.focus();
  f.tap('Enter');
  await waitFor(() => f.$('coop-stage').textContent === 'TWIN LANDINGS' && f.$('coop-menu').hidden);
  assert.equal(f.$('coop-difficulty').value, 'expert');
  assert.equal(f.$('coop-journey-skip').hidden, true);
});

test('Stay after Team library replacement retains exact attempt and returns to the same filtered mission', async (t) => {
  const f = await fixture(t);
  f.$('coop-start').click();
  f.$('coop-pause').click();
  const image = f.drawImages.at(-1),
    coverage = f.$('coop-coverage').textContent;
  await open(f, true);
  f.$('journey-search').value = 'Shared lookout';
  f.$('journey-search').emit('input');
  card(f, 'Shared lookout').click();
  await waitFor(() => f.$('coop-discard-dialog').open);
  f.$('coop-discard-stay').click();
  await waitFor(() => f.$('journey-chooser').open);
  assert.equal(f.$('journey-search').value, 'Shared lookout');
  assert.equal(f.$('coop-coverage').textContent, coverage);
  assert.equal(f.drawImages.at(-1), image);
  f.$('journey-back').click();
  assert.equal(f.doc.activeElement.id, 'coop-discovery-paused');
  assert.match(f.$('coop-overlay-title').textContent, /paused/i);
});

test('newer focus during held Team preparation cancels without replacing or reopening', async (t) => {
  const gate = deferred();
  let held = false;
  t.after(() => gate.resolve());
  const target = source.missions.find((row) => row.id === 'shared-lookout');
  const f = await fixture(t, {
    holdAsset: async (asset) => {
      if (asset.id === target.presentation.backgroundAssetId) {
        held = true;
        await gate.promise;
      }
    },
  });
  await open(f);
  card(f, 'Shared lookout').click();
  await waitFor(() => held);
  f.$('coop-settings-open').focus();
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.$('coop-level').value, 'twin-landings');
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('journey-chooser').open, false);
  assert.equal(f.doc.activeElement.id, 'coop-settings-open');
});

test('Legacy Team library contains currentJourney metadata and fixed exact handoffs without eager artwork', async (t) => {
  const f = await fixture(t, { href: `${base}?journey=legacy` });
  await open(f);
  assert.equal(cards(f).length, 14);
  const target = card(f, 'Shared lookout');
  target.click();
  await waitFor(() => f.visits.length === 1);
  const url = new URL(f.visits[0]);
  assert.equal(url.searchParams.get('journey'), 'team-spatial-originals-1');
  assert.equal(url.searchParams.get('library-mission'), target.dataset.missionId);
  assert.equal(f.reads.length, 0);
});

for (const action of ['focus', 'key', 'blur'])
  test(`newer ${action} while incoming Team artwork prepares retires automatic Play`, async (t) => {
    const gate = deferred();
    t.after(() => gate.resolve());
    const target = model.missions.find((row) => row.name === 'Shared lookout');
    const params = new URLSearchParams({
      journey: 'team-spatial-originals-1',
      'library-mission': target.id,
    });
    let held = false;
    const f = await fixture(t, {
      href: `${base}?${params}`,
      waitPicture: false,
      holdAsset: async () => {
        held = true;
        await gate.promise;
      },
    });
    await waitFor(() => held);
    if (action === 'focus') f.$('coop-settings-open').focus();
    if (action === 'key') f.tap('Tab');
    if (action === 'blur') f.win.emit('blur');
    gate.resolve();
    await waitFor(
      () =>
        f.$('coop-picture-status').dataset.state === (action === 'blur' ? 'cancelled' : 'ready'),
    );
    assert.equal(f.$('coop-level').value, 'shared-lookout');
    assert.equal(f.$('coop-menu').hidden, false);
    if (action === 'focus') assert.equal(f.doc.activeElement.id, 'coop-settings-open');
  });

test('explicit Team library full preview has a separate lease and clears on selection/Back', async (t) => {
  const f = await fixture(t);
  const image = f.previewDrawImages.at(-1);
  await open(f);
  card(f, 'Shared lookout').focus();
  card(f, 'Shared lookout').emit('focus', { bubbles: false });
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.equal(f.$('coop-library-preview').disabled, false);
  f.$('coop-library-preview').click();
  await waitFor(
    () => !f.$('coop-discovery-preview-canvas').hidden,
    () => f.$('coop-discovery-preview-status').textContent,
  );
  assert.equal(f.previewDrawImages.at(-1), image);
  assert.match(
    f.$('coop-discovery-preview-status').textContent,
    /Full picture preview.*does not complete an arena or earn a picture/i,
  );
  card(f, 'Twin landings').focus();
  card(f, 'Twin landings').emit('focus', { bubbles: false });
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.equal(f.$('coop-discovery-preview').hidden, true);
  assert.equal(f.$('coop-discovery-preview-canvas').width, 0);
  f.$('journey-back').click();
  assert.equal(f.previewDrawImages.at(-1), image);
  assert.equal(f.$('coop-level').value, 'twin-landings');
});

test('retired Team preview cannot repaint a reopened library or steal its newer selection', async (t) => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const target = source.missions.find((row) => row.id === 'shared-lookout');
  let held = false;
  const f = await fixture(t, {
    holdAsset: async (asset) => {
      if (asset.id === target.presentation.backgroundAssetId) {
        held = true;
        await gate.promise;
      }
    },
  });
  await open(f);
  card(f, 'Shared lookout').focus();
  card(f, 'Shared lookout').emit('focus', { bubbles: false });
  await new Promise((resolve) => queueMicrotask(resolve));
  f.$('coop-library-preview').click();
  await waitFor(() => held);
  f.$('journey-back').click();
  await open(f);
  card(f, 'Twin landings').focus();
  card(f, 'Twin landings').emit('focus', { bubbles: false });
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.$('coop-discovery-preview').hidden, true);
  assert.equal(f.doc.activeElement, card(f, 'Twin landings'));
  assert.equal(f.$('coop-level').value, 'twin-landings');
});

test('a cancelled older Team Play cannot hide the newer Cancel action or detach its input lease', async (t) => {
  const oldGate = deferred(),
    newGate = deferred();
  t.after(() => {
    oldGate.resolve();
    newGate.resolve();
  });
  const oldAsset = source.missions.find((row) => row.id === 'shared-lookout').presentation
    .backgroundAssetId;
  const newAsset = source.missions.find((row) => row.id === 'twin-depots').presentation
    .backgroundAssetId;
  let oldHeld = false,
    newHeld = false;
  const f = await fixture(t, {
    holdAsset: async (asset) => {
      if (asset.id === oldAsset) {
        oldHeld = true;
        await oldGate.promise;
      }
      if (asset.id === newAsset) {
        newHeld = true;
        await newGate.promise;
      }
    },
  });
  await open(f);
  card(f, 'Shared lookout').click();
  await waitFor(() => oldHeld);
  f.$('coop-discovery-cancel').click();
  await waitFor(() => f.$('journey-chooser').open);
  card(f, 'Twin depots').click();
  await waitFor(() => newHeld);
  assert.equal(f.$('coop-discovery-cancel').hidden, false);
  oldGate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.$('coop-discovery-cancel').hidden, false, 'Old finally cannot hide newer Cancel');
  f.doc.body.emit('keydown', { key: 'x', code: 'KeyX' });
  assert.equal(
    f.$('coop-discovery-cancel').hidden,
    true,
    'New input lease still cancels its operation',
  );
  newGate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.$('coop-level').value, 'twin-landings');
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('journey-chooser').open, false);
});

test('a background Team preview activation does not fetch or decode artwork', async (t) => {
  const f = await fixture(t);
  await open(f);
  const selected = card(f, 'Shared lookout');
  selected.focus();
  selected.emit('focus', { bubbles: false });
  await new Promise((resolve) => queueMicrotask(resolve));
  const reads = f.reads.length;
  f.doc.hidden = true;
  await f.$('coop-library-preview').onclick();
  assert.equal(f.reads.length, reads);
  assert.equal(f.$('coop-discovery-preview').hidden, true);
  f.doc.hidden = false;
});
