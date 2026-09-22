import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { page } from './helpers/coop-host.mjs';
import { waitFor, deferred } from './helpers/coop-presentation-fixture.mjs';
import { createTeamTimedOriginalCandidates } from '../content-design/team-timed-originals.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import {
  TEAM_TIMED_PROFILE_KEY,
  TEAM_WINDOW_SPATIAL_PROFILE_KEY,
  TEAM_DEPOT_SPATIAL_PROFILE_KEY,
} from '../content-design/team-timed-entry.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const source = createTeamTimedOriginalCandidates();
const href = 'http://localhost/game/couch/relay-rescue.html?journey=team-timed-originals';
const read = async (name) =>
  JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url)));
const qualification = await read('team-timed-qualification');
const routes = await read('team-timed-host-routes');
const originals = new Map(
  await Promise.all(
    source.assets.map(async (a) => [
      a.id,
      await readFile(new URL('../' + a.path, import.meta.url)),
    ]),
  ),
);
const keys = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
];
const enter = (f, node) => {
  node.focus();
  f.tap('Enter');
};

function environment(install, { failures = new Set(), gates = new Map() } = {}) {
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
      const asset = source.assets.find((a) => new URL(url).pathname.endsWith('/' + a.path));
      assert(asset, 'Only exact registered pictures may be fetched');
      if (failures.has(asset.id)) throw Error('Modeled timed original offline');
      if (gates.has(asset.id)) await gates.get(asset.id).promise;
      return new Response(originals.get(asset.id));
    },
  });
}
async function timedPage(t, options = {}) {
  const { failures, gates, memory, ...rest } = options;
  return page(t, {
    href,
    nativeFocus: true,
    nativeVisibility: true,
    retainInitialDifficulty: true,
    ...rest,
    beforeImport({ install }) {
      environment(install, { failures, gates });
      if (memory) install('indexedDB', { value: memory.indexedDB });
    },
  });
}
function clear(f, id) {
  const row = routes.rows.find((r) => r.missionId === id && r.difficulty === 'standard');
  const log = structuredClone(
    qualification.rows.find(
      (r) => r.missionId === id && r.difficulty === 'standard' && r.kind === 'alternate-taking',
    ).log,
  );
  for (const change of row.keyboard.adjustments) {
    assert.equal(log[change.segment].ticks, change.fromTicks);
    log[change.segment].ticks = change.toTicks;
  }
  f.tick(31);
  let previous = [null, null],
    frames = 30;
  for (const segment of log) {
    for (const [seat, direction] of [segment.a, segment.b].entries())
      if (direction && direction !== previous[seat]) f.tap(keys[seat][direction]);
    previous = [segment.a, segment.b];
    for (let n = 0; n < segment.ticks && f.$('coop-overlay').hidden; n++) {
      f.tick();
      frames++;
      assert.equal(f.$('coop-reserves').textContent, '2 reserves');
    }
    if (!f.$('coop-overlay').hidden) break;
  }
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
  assert.equal(f.$('coop-coverage').textContent, row.keyboard.coverageText);
  assert.equal(frames, row.keyboard.tick);
}

test('Shared windows clears all three originals across two Next boundaries and one failed picture load', async (t) => {
  const failures = new Set(),
    memory = managedIndexedDB();
  const old = await createJourneyBackend(memory).commit([
    { type: 'select', mode: 'team', missionId: 'existing-team-bookmark' },
  ]);
  const f = await timedPage(t, { failures, memory });
  assert.match(
    f.$('coop-boot').textContent,
    /original-art test · 3 missions · human validation pending/,
  );
  assert.equal(f.$('coop-level').value, 'window-exchange');
  enter(f, f.$('coop-start'));
  for (const [index, mission] of source.missions.entries()) {
    assert.equal(f.$('coop-level').value, mission.id);
    assert.equal(f.$('coop-menu').hidden, true);
    assert.equal(f.$('coop-difficulty').value, 'standard');
    clear(f, mission.id);
    const asset = source.assets.find((a) => a.id === mission.presentation.backgroundAssetId);
    const image = f.drawImages.at(-1);
    assert.equal(image.sha256, asset.sha256);
    assert.equal(image.releases, 0);
    assert.deepEqual(f.visits, []);
    if (index === 0) {
      const nextAsset = source.missions[1].presentation.backgroundAssetId;
      failures.add(nextAsset);
      enter(f, f.$('coop-next'));
      await waitFor(() => f.$('coop-next-status').textContent.includes('Try Next again'));
      assert.equal(f.$('coop-level').value, mission.id);
      assert.equal(f.$('coop-overlay').hidden, false);
      assert.equal(image.releases, 0);
      failures.delete(nextAsset);
    }
    if (index < 2) {
      enter(f, f.$('coop-next'));
      await waitFor(
        () => f.$('coop-overlay').hidden,
        () => f.$('coop-next-status').textContent,
      );
      assert.equal(image.releases, 1);
      assert.equal(f.$('coop-coverage').textContent, '0.0%');
    } else {
      assert.equal(f.$('coop-next').hidden, true);
      assert.equal(f.$('coop-journey-skip').hidden, true);
    }
  }
  await new Promise((resolve) => setImmediate(resolve));
  const profile = await createJourneyBackend({
    ...memory,
    profileKey: TEAM_TIMED_PROFILE_KEY,
  }).read();
  assert.equal(Object.keys(profile.clears.team).length, 3);
  assert.deepEqual(profile.skipped.team, []);
  assert.deepEqual(await createJourneyBackend(memory).read(), old);
  t.diagnostic(
    'Exact image bytes and production host/input; finite decode/DOM/frame clock, not native performance or human acceptance.',
  );
});

test('Shared windows Skip needs two activations, grants no clear and remains directly replayable', async (t) => {
  const memory = managedIndexedDB(),
    f = await timedPage(t, { memory });
  enter(f, f.$('coop-start'));
  f.tick(2);
  enter(f, f.$('coop-journey-skip'));
  assert.equal(f.$('coop-level').value, 'window-exchange');
  assert.equal(f.doc.activeElement.id, 'coop-journey-skip-confirm');
  enter(f, f.$('coop-journey-skip-confirm'));
  await waitFor(() => f.$('coop-overlay').hidden);
  assert.equal(f.$('coop-level').value, 'coolant-crossing');
  enter(f, f.$('coop-pause'));
  enter(f, f.$('coop-discovery-paused'));
  await waitFor(() => f.$('journey-chooser')?.open);
  const cards = [...f.$('journey-cards').querySelectorAll('.journey-card')].filter((c) =>
    c.querySelector('.journey-card-tags').textContent.includes('Journey'),
  );
  assert.equal(cards.length, 3);
  const first = cards.find((c) => c.querySelector('strong').textContent === 'Window exchange');
  assert.equal(first.querySelector('.journey-card-progress').textContent, 'Skipped · try again');
  enter(f, first);
  await waitFor(() => f.$('coop-discard-dialog').open);
  enter(f, f.$('coop-discard-confirm'));
  await waitFor(() => !f.$('journey-chooser').open && f.$('coop-overlay').hidden);
  assert.equal(f.$('coop-level').value, 'window-exchange');
  const profile = await createJourneyBackend({
    ...memory,
    profileKey: TEAM_TIMED_PROFILE_KEY,
  }).read();
  assert.equal(Object.keys(profile.clears.team).length, 0);
  assert.equal(profile.skipped.team.length, 1);
});

test('cancelling a Shared windows picture preparation keeps the finished source and rejects its late result', async (t) => {
  const gates = new Map(),
    f = await timedPage(t, { gates });
  enter(f, f.$('coop-start'));
  clear(f, 'window-exchange');
  const old = f.drawImages.at(-1),
    gate = deferred();
  gates.set(source.missions[1].presentation.backgroundAssetId, gate);
  enter(f, f.$('coop-next'));
  await waitFor(() => !f.$('coop-next-cancel').hidden);
  enter(f, f.$('coop-next-cancel'));
  assert.equal(f.$('coop-level').value, 'window-exchange');
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(old.releases, 0);
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.$('coop-level').value, 'window-exchange');
  assert.equal(old.releases, 0);
  assert.equal(f.$('coop-next').disabled, false);
});

for (const depot of [false, true])
  test(`${depot ? 'depot-lane' : 'outer-pocket'} successor uses exact originals, direct Next/Skip and independent progress`, async (t) => {
    const memory = managedIndexedDB();
    const oldBackend = createJourneyBackend({ ...memory, profileKey: TEAM_TIMED_PROFILE_KEY });
    const windowBackend = createJourneyBackend({
      ...memory,
      profileKey: TEAM_WINDOW_SPATIAL_PROFILE_KEY,
    });
    const windowBefore = depot
      ? await windowBackend.commit([
          {
            type: 'select',
            mode: 'team',
            missionId: 'candidate/shared-windows/coolant-crossing-study/coolant-crossing',
          },
        ])
      : null;
    const before = await oldBackend.commit([
      {
        type: 'select',
        mode: 'team',
        missionId: 'candidate/shared-windows/depot-dash-study/depot-dash',
      },
    ]);
    const f = await timedPage(t, {
      memory,
      href: `http://localhost/game/couch/relay-rescue.html?journey=team-${depot ? 'depot' : 'window'}-spatial-1`,
    });
    assert.equal(f.$('coop-level').value, 'window-exchange');
    assert.match(
      f.$('coop-boot').textContent,
      /original-art test · 3 missions · human validation pending/,
    );
    enter(f, f.$('coop-start'));
    f.tick(2);
    const row = (await read('team-window-spatial-routes')).rows.find(
      (r) => r.difficulty === 'standard' && r.kind === 'cooperation',
    );
    let previous = [null, null],
      frames = 1;
    for (const segment of row.log) {
      for (const [seat, direction] of [segment.a, segment.b].entries())
        if (direction && direction !== previous[seat]) f.tap(keys[seat][direction]);
      previous = [segment.a, segment.b];
      for (let n = 0; n < segment.ticks && f.$('coop-overlay').hidden; n++) {
        f.tick();
        frames++;
      }
      if (!f.$('coop-overlay').hidden) break;
    }
    assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
    assert.equal(frames, row.checks[1].result.tick);
    assert.equal(
      f.drawImages.at(-1).sha256,
      source.assets.find((a) => a.id === 'team-windows-window-exchange').sha256,
    );
    enter(f, f.$('coop-next'));
    await waitFor(() => f.$('coop-overlay').hidden);
    assert.equal(f.$('coop-level').value, 'coolant-crossing');
    assert.equal(f.$('coop-menu').hidden, true);
    enter(f, f.$('coop-journey-skip'));
    assert.equal(f.$('coop-level').value, 'coolant-crossing');
    enter(f, f.$('coop-journey-skip-confirm'));
    await waitFor(() => f.$('coop-overlay').hidden);
    assert.equal(f.$('coop-level').value, 'depot-dash');
    assert.equal(f.$('coop-difficulty').value, 'standard');
    await new Promise((resolve) => setImmediate(resolve));
    const profile = await createJourneyBackend({
      ...memory,
      profileKey: depot ? TEAM_DEPOT_SPATIAL_PROFILE_KEY : TEAM_WINDOW_SPATIAL_PROFILE_KEY,
    }).read();
    assert.deepEqual(Object.keys(profile.clears.team), [
      'candidate/shared-windows/window-exchange-study/window-exchange',
    ]);
    assert.deepEqual(profile.skipped.team, [
      'candidate/shared-windows/coolant-crossing-study/coolant-crossing',
    ]);
    assert.equal(profile.cursors.team, 'candidate/shared-windows/depot-dash-study/depot-dash');
    assert.deepEqual(await oldBackend.read(), before);
    assert.deepEqual(f.visits, []);
    if (depot) {
      const row = (await read('team-depot-spatial-routes')).rows.find(
        (r) => r.difficulty === 'standard',
      );
      f.tick(2);
      let previous = [null, null],
        frames = 1;
      for (const s of row.log) {
        for (const [seat, direction] of [s.a, s.b].entries())
          if (direction && direction !== previous[seat]) f.tap(keys[seat][direction]);
        previous = [s.a, s.b];
        for (let n = 0; n < s.ticks && f.$('coop-overlay').hidden; n++) {
          f.tick();
          frames++;
        }
        if (!f.$('coop-overlay').hidden) break;
      }
      assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
      assert.equal(frames, 3217);
      assert.equal(f.$('coop-coverage').textContent, '78.7%');
      assert.equal(f.$('coop-next').hidden, true);
      assert.equal(
        f.drawImages.at(-1).sha256,
        source.assets.find((a) => a.id === 'team-windows-depot-dash').sha256,
      );
      assert.deepEqual(await oldBackend.read(), before);
      assert.deepEqual(await windowBackend.read(), windowBefore);
    }
  });
