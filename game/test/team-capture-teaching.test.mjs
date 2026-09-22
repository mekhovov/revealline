import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createTeamJourneyCandidates,
  TEAM_JOURNEY_LEARNING_ARCS,
} from '../content-design/team-journey-candidates.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createTeamCaptureTeaching } from '../content-design/team-capture-teaching.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { page } from './helpers/coop-host.mjs';

const source = createTeamJourneyCandidates(),
  journey = createCandidateTeamHost(source, { corePackIds: source.packs.map((pack) => pack.id) }),
  teach = createTeamCaptureTeaching(journey, TEAM_JOURNEY_LEARNING_ARCS[0].missionIds);
const rowFor = (id, difficulty = 'standard') =>
  journey.rows.find((row) => row.level.id === id && row.difficulty === difficulty);
const read = async (name) =>
  JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url)));
const routes = [
  (await read('team-opening-routes')).routes[0],
  ...(await read('team-foundation-routes')).clear,
];

test('authored first-arc command closures explain actual retained regions without mutating runtime or event bytes', () => {
  let lineOnly = 0,
    captions = 0;
  for (const route of routes) {
    const row = rowFor(route.missionId, route.difficulty),
      run = startCoop(createCoop(row.level, { seed: 1 }));
    let observed = 0;
    outer: for (const segment of route.log) {
      for (let i = 0; i < segment.ticks && run.status === 'running'; i++) {
        const trail = new Set(
          run.players.flatMap((player) => player.trail.map((cell) => cell.index)),
        );
        stepCoop(
          run,
          [segment.a, segment.b].map((direction) => ({ direction, boost: false, support: false })),
        );
        const before = JSON.stringify(run),
          caption = teach(row, run, run.events);
        assert.equal(JSON.stringify(run), before);
        if (!run.events.some((event) => event.type === 'cut.closed')) {
          assert.equal(caption, null);
          continue;
        }
        const regions = inspectCaptureSnapshot(run).components.filter((region) => region.retained);
        assert.match(caption, new RegExp(`${regions.length} enemy-held region`));
        for (const region of regions)
          for (const id of region.enemyIds) assert(caption.includes(id.replaceAll('-', ' ')));
        assert.match(caption, /Empty regions fill; occupied regions stay unclaimed/);
        captions++;
        const claimed = run.events.find((event) => event.type === 'cells.claimed');
        if (claimed.indices.every((index) => trail.has(index))) lineOnly++;
        if (++observed === 2) break outer;
      }
    }
    assert(observed > 0, route.missionId);
  }
  assert(captions >= routes.length);
  assert(lineOnly > 0, 'At least one public-input line-only closure receives the explanation');
});

test('teaching is silent before closure, outside the authored arc and for unowned or mismatched editions', () => {
  const row = rowFor('twin-landings'),
    run = startCoop(createCoop(row.level));
  const events = [{ type: 'cells.claimed', cells: 1 }, { type: 'cut.closed' }];
  assert.equal(teach(row, run, []), null);
  assert.equal(teach({ ...row }, run, events), null);
  assert.equal(teach(null, run, events), null);
  assert.equal(teach(rowFor('twin-landings', 'expert'), run, events), null);
  const later = rowFor('shared-lookout');
  assert.equal(teach(later, startCoop(createCoop(later.level)), events), null);
  assert.throws(() => createTeamCaptureTeaching(journey, ['missing']), /owned mission/);
});

test('actual Team joint bridge explains a line-only closure without pausing or opening a tutorial dialog', async (t) => {
  const f = await page(t, {
    href: 'http://localhost/game/couch/relay-rescue.html?journey=team-greybox',
    nativeFocus: true,
    nativeVisibility: true,
  });
  f.$('coop-start').click();
  f.tick(2);
  f.tap('KeyD');
  f.tap('ArrowLeft');
  f.tick(220);
  assert.match(f.$('coop-message').textContent, /^Joint Cut! Cut banked\./);
  assert.match(f.$('coop-message').textContent, /enemy-held region.*north keeper.*south keeper/);
  assert.match(f.$('coop-message').textContent, /Choose a fresh direction/);
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-discovery-dialog').open, false);
  const percent = Number.parseFloat(f.$('coop-coverage').textContent);
  assert(percent > 0 && percent < 5, `Short bridge earns its line, not occupied field: ${percent}`);
  for (const seat of [0, 1])
    assert.equal(f.$(`coop-state-${seat}`).textContent, 'On reclaimed ground');
});
