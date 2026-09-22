import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import {
  createTeamPressureOriginalCandidates,
  TEAM_PRESSURE_PROFILE_KEY,
} from '../content-design/team-pressure-originals.mjs';
import {
  createTeamSpatialOriginalCandidates,
  TEAM_SPATIAL_PROFILE_KEY,
} from '../content-design/team-spatial-originals.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { page } from './helpers/coop-host.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';
import { teamPressureFixtures } from './helpers/team-pressure-fixtures.mjs';

const source = createTeamPressureOriginalCandidates(),
  host = createCandidateTeamHost(source, { corePackIds: source.packs.map((p) => p.id) });
const rows = await teamPressureFixtures();
const originals = new Map(
  await Promise.all(
    source.assets.map(async (a) => [
      a.path,
      await readFile(new URL('../' + a.path, import.meta.url)),
    ]),
  ),
);
const keys = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
];
// Actual keyboard-host baseline: live seed17, initial1tick, no state injection.
const hostClears = [
  [3200, '66.8%'],
  [3186, '81.7%'],
  [2513, '83.7%'],
  [2866, '74.8%'],
  [4037, '82.9%'],
  [4361, '73.8%'],
  [2357, '87.7%'],
  [3927, '77.3%'],
  [2901, '81.6%'],
  [2194, '77.8%'],
  [3216, '80.8%'],
  [3095, '89.8%'],
];
const enter = (f, node) => {
  node.focus();
  f.tap('Enter');
};
function environment(install, failures) {
  const BaseImage = globalThis.Image;
  class CandidateImage extends BaseImage {
    releases = 0;
    async decode() {
      if (!this.source.startsWith('data:image/png;base64,')) return super.decode();
      const b = Buffer.from(this.source.split(',')[1], 'base64');
      this.width = this.naturalWidth = b.readUInt32BE(16);
      this.height = this.naturalHeight = b.readUInt32BE(20);
      this.sha256 = createHash('sha256').update(b).digest('hex');
    }
    removeAttribute(name) {
      if (name === 'src') this.releases++;
      super.removeAttribute(name);
    }
  }
  install('Image', { value: CandidateImage });
  install('crypto', { value: webcrypto });
  install('fetch', {
    value: async (url) => {
      const a = source.assets.find((a) => new URL(url).pathname.endsWith('/' + a.path));
      assert(a);
      if (failures.has(a.id)) throw Error('Modeled pressure original offline');
      return new Response(originals.get(a.path));
    },
  });
}
async function pressurePage(t, { memory, failures = new Set(), ...rest } = {}) {
  return page(t, {
    href: 'http://localhost/game/couch/relay-rescue.html?journey=team-pressure-originals-1',
    nativeFocus: true,
    nativeVisibility: true,
    retainInitialDifficulty: true,
    ...rest,
    beforeImport({ install }) {
      environment(install, failures);
      if (memory) install('indexedDB', { value: memory.indexedDB });
    },
  });
}

test('twelve pressure originals play across all five campaigns; failed Next keeps current run and old progress', async (t) => {
  const memory = managedIndexedDB(),
    failures = new Set();
  const old = createJourneyBackend({ ...memory, profileKey: 'journey' });
  const before = await old.commit([
    { type: 'select', mode: 'team', missionId: host.catalog.missions[8].id },
  ]);
  const f = await pressurePage(t, { memory, failures });
  assert.equal(f.$('coop-level').value, 'twin-landings');
  assert.match(
    f.$('coop-boot').textContent,
    /pressure edition.*enemy speed Gentle ×1 \/ Standard ×1.4 \/ Expert ×1.75.*human validation pending/,
  );
  enter(f, f.$('coop-start'));
  for (const [index, mission] of source.missions.entries()) {
    assert.equal(f.$('coop-level').value, mission.id);
    assert.equal(f.$('coop-menu').hidden, true);
    assert.equal(f.$('coop-difficulty').value, 'standard');
    f.tick(2);
    const picture = f.drawImages.at(-1),
      asset = source.assets.find((a) => a.id === mission.presentation.backgroundAssetId);
    assert.equal(picture.sha256, asset.sha256);
    const row = rows.find((r) => r.missionId === mission.id && r.difficulty === 'standard');
    let previous = [null, null],
      frames = 1;
    for (const segment of row.log) {
      for (const [seat, d] of [segment.a, segment.b].entries())
        if (d && d !== previous[seat]) f.tap(keys[seat][d]);
      previous = [segment.a, segment.b];
      for (let n = 0; n < segment.ticks && f.$('coop-overlay').hidden; n++) {
        f.tick();
        frames++;
      }
      if (!f.$('coop-overlay').hidden) break;
    }
    assert.equal(
      f.$('coop-overlay-kicker').textContent,
      'A WORLD YOU REVEALED TOGETHER',
      mission.id,
    );
    assert.equal(f.$('coop-reserves').textContent, '2 reserves', mission.id);
    assert.deepEqual([frames, f.$('coop-coverage').textContent], hostClears[index], mission.id);
    t.diagnostic(
      `${mission.id}: host ${frames}ticks, ${f.$('coop-coverage').textContent}; live seed17 + initial1tick (not historical delay0 checkpoint)`,
    );
    assert.equal(f.drawImages.at(-1), picture);
    if (index === 0) {
      const next = source.missions[1].presentation.backgroundAssetId;
      failures.add(next);
      enter(f, f.$('coop-next'));
      await waitFor(() => f.$('coop-next-status').textContent.includes('Try Next again'));
      assert.equal(f.$('coop-level').value, mission.id);
      assert.equal(picture.releases, 0);
      assert.equal(f.$('coop-overlay').hidden, false);
      failures.delete(next);
    }
    if (index < 11) {
      enter(f, f.$('coop-next'));
      await waitFor(() => f.$('coop-overlay').hidden);
      assert.equal(picture.releases, 1);
      assert.equal(f.$('coop-coverage').textContent, '0.0%');
    } else assert.equal(f.$('coop-next').hidden, true);
  }
  await new Promise((resolve) => setImmediate(resolve));
  const next = await createJourneyBackend({
    ...memory,
    profileKey: TEAM_PRESSURE_PROFILE_KEY,
  }).read();
  assert.deepEqual(
    Object.keys(next.clears.team).sort(),
    host.catalog.missions.map((m) => m.id).sort(),
  );
  assert.deepEqual(await old.read(), before);
  assert.deepEqual(f.visits, []);
});

test('pressure difficulty, reversible Skip, chooser and reload use scoped bookmarks, not legacy clears', async (t) => {
  const memory = managedIndexedDB();
  const old = createJourneyBackend({ ...memory, profileKey: 'journey' });
  const before = await old.commit([
    { type: 'select', mode: 'team', missionId: host.catalog.missions[8].id },
  ]);
  const backend = createJourneyBackend({ ...memory, profileKey: TEAM_PRESSURE_PROFILE_KEY });
  await t.test(
    'choose Expert deliberately, skip once, select another mission directly',
    async (t) => {
      const f = await pressurePage(t, { memory });
      await f.choose('coop-difficulty', 'expert');
      assert.equal(f.$('coop-menu').hidden, false);
      enter(f, f.$('coop-start'));
      f.tick(2);
      assert.equal(f.$('coop-reserves').textContent, '1 reserve');
      enter(f, f.$('coop-journey-skip'));
      assert.equal(f.$('coop-level').value, 'twin-landings');
      enter(f, f.$('coop-journey-skip-confirm'));
      await waitFor(() => f.$('coop-overlay').hidden);
      assert.equal(f.$('coop-level').value, 'stepping-exchange');
      assert.equal(f.$('coop-difficulty').value, 'expert');
      enter(f, f.$('coop-pause'));
      enter(f, f.$('coop-discovery-paused'));
      const cards = [...f.$('coop-discovery-list').querySelectorAll('article')].filter((c) =>
        c.querySelector('.team-mission-diagram'),
      );
      assert.equal(cards.length, 12);
      const first = cards.find(
        (c) => c.querySelector('button').textContent === 'Play Twin landings',
      );
      assert.equal(
        first.querySelector('.team-mission-completion').textContent,
        'Skipped · revisit whenever you like',
      );
      const destination = cards.find(
        (c) => c.querySelector('button').textContent === 'Play Twin depots',
      );
      enter(f, destination.querySelector('button'));
      await waitFor(() => f.$('coop-discard-dialog').open);
      enter(f, f.$('coop-discard-confirm'));
      await waitFor(() => !f.$('coop-discovery-dialog').open);
      assert.equal(f.$('coop-level').value, 'twin-depots');
      await new Promise((resolve) => setImmediate(resolve));
      const profile = await backend.read();
      assert.deepEqual(Object.keys(profile.clears.team), []);
      assert.deepEqual(profile.skipped.team, [host.catalog.missions[0].id]);
      assert.equal(profile.cursors.team, host.catalog.missions[9].id);
      assert.deepEqual(await old.read(), before);
    },
  );
  const pressureBefore = await backend.read();
  await t.test('reload restores chosen mission but still requires Start', async (t) => {
    const f = await pressurePage(t, { memory });
    assert.equal(f.$('coop-level').value, 'twin-depots');
    assert.equal(f.$('coop-menu').hidden, false);
    assert.equal(f.$('coop-start').disabled, false);
    assert.deepEqual(await backend.read(), pressureBefore);
  });
  await t.test(
    'historical originals retain their own bookmark without touching pressure profile',
    async (t) => {
      const f = await pressurePage(t, {
        memory,
        href: 'http://localhost/game/couch/relay-rescue.html?journey=team-originals',
      });
      assert.equal(f.$('coop-level').value, 'shared-lookout');
      assert.doesNotMatch(f.$('coop-boot').textContent, /pressure edition/);
      enter(f, f.$('coop-start'));
      f.tick(2);
      assert.deepEqual(await backend.read(), pressureBefore);
    },
  );
});

test('changing-return edition crosses into both revised maps and exits to the unchanged finale with isolated receipts', async (t) => {
  const spatial = createTeamSpatialOriginalCandidates();
  const journey = createCandidateTeamHost(spatial, { corePackIds: spatial.packs.map((p) => p.id) });
  const revised = JSON.parse(
    await readFile(new URL('./fixtures/team-roamer-spatial-routes.json', import.meta.url)),
  ).rows;
  const memory = managedIndexedDB(),
    failures = new Set();
  const pressure = createJourneyBackend({ ...memory, profileKey: TEAM_PRESSURE_PROFILE_KEY });
  const historical = createJourneyBackend({ ...memory, profileKey: 'journey' });
  const oldPressure = await pressure.commit([
    { type: 'select', mode: 'team', missionId: journey.catalog.missions[9].id },
  ]);
  const oldHistorical = await historical.commit([
    { type: 'select', mode: 'team', missionId: journey.catalog.missions[8].id },
  ]);
  const backend = createJourneyBackend({ ...memory, profileKey: TEAM_SPATIAL_PROFILE_KEY });
  await backend.commit([
    { type: 'select', mode: 'team', missionId: journey.catalog.missions[7].id },
  ]);
  const f = await pressurePage(t, {
    memory,
    failures,
    href: 'http://localhost/game/couch/relay-rescue.html?journey=team-spatial-originals-1',
  });
  assert.equal(f.$('coop-level').value, 'weaver-crossing');
  assert.match(f.$('coop-boot').textContent, /changing-return pressure edition/);
  enter(f, f.$('coop-start'));
  for (let index = 7; index < 12; index++) {
    const mission = spatial.missions[index];
    assert.equal(f.$('coop-level').value, mission.id);
    assert.equal(f.$('coop-menu').hidden, true);
    f.tick(2);
    const row = [...revised, ...rows].find(
      (r) => r.missionId === mission.id && r.difficulty === 'standard',
    );
    const picture = f.drawImages.at(-1),
      asset = spatial.assets.find((a) => a.id === mission.presentation.backgroundAssetId);
    assert.equal(picture.sha256, asset.sha256);
    let previous = [null, null],
      frames = 1;
    for (const s of row.log) {
      for (const [seat, d] of [s.a, s.b].entries())
        if (d && d !== previous[seat]) f.tap(keys[seat][d]);
      previous = [s.a, s.b];
      for (let n = 0; n < s.ticks && f.$('coop-overlay').hidden; n++) {
        f.tick();
        frames++;
      }
      if (!f.$('coop-overlay').hidden) break;
    }
    assert.equal(
      f.$('coop-overlay-kicker').textContent,
      'A WORLD YOU REVEALED TOGETHER',
      mission.id,
    );
    assert.equal(f.$('coop-reserves').textContent, '2 reserves');
    const expected =
      index === 8 ? [4422, '81.5%'] : index === 9 ? [4303, '76.3%'] : hostClears[index];
    assert.deepEqual([frames, f.$('coop-coverage').textContent], expected, mission.id);
    if (index === 7) {
      const next = spatial.missions[8].presentation.backgroundAssetId;
      failures.add(next);
      enter(f, f.$('coop-next'));
      await waitFor(() => f.$('coop-next-status').textContent.includes('Try Next again'));
      assert.equal(f.$('coop-level').value, mission.id);
      assert.equal(picture.releases, 0);
      failures.delete(next);
    }
    if (index < 11) {
      enter(f, f.$('coop-next'));
      await waitFor(() => f.$('coop-overlay').hidden);
      assert.equal(picture.releases, 1);
    } else assert.equal(f.$('coop-next').hidden, true);
  }
  await new Promise((resolve) => setImmediate(resolve));
  const profile = await backend.read();
  assert.deepEqual(
    Object.keys(profile.clears.team).sort(),
    journey.catalog.missions
      .slice(7)
      .map((m) => m.id)
      .sort(),
  );
  for (const mission of journey.catalog.missions.slice(7))
    assert.equal(
      profile.clears.team[mission.id].gameplayId,
      journey.row(mission, 'standard').simulationIdentity,
    );
  assert.deepEqual(await pressure.read(), oldPressure);
  assert.deepEqual(await historical.read(), oldHistorical);
  assert.deepEqual(f.visits, []);
});

for (const query of [
  'team-pressure-originals-2',
  'team-pressure-originals-1&journey=team-originals',
  'team-spatial-originals-2',
  'team-spatial-originals-1&journey=team-pressure-originals-1',
])
  test(`unrecognized or duplicated entry does not enroll a pressure candidate: ${query}`, async (t) => {
    const f = await pressurePage(t, {
      href: `http://localhost/game/couch/relay-rescue.html?journey=${query}`,
    });
    assert.equal(f.$('coop-level').value, 'first-connection');
    assert.doesNotMatch(f.$('coop-boot').textContent, /pressure edition/);
  });
