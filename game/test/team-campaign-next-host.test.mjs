import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { createTeamCampaignTestPack } from '../content-design/team-export.mjs';
import { page } from './helpers/coop-host.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';

const routes = JSON.parse(
  await readFile(new URL('./fixtures/team-foundation-routes.json', import.meta.url)),
).clear;
const keys = [
  { up: 'KeyW', right: 'KeyD', down: 'KeyS', left: 'KeyA' },
  { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' },
];

for (const difficulty of ['gentle', 'standard', 'expert'])
  test(`authored ${difficulty} Team campaign earns three real-host clears with one Next and no lobby between`, async (t) => {
    const pack = createTeamCampaignTestPack(
      createTeamJourneyCandidates(),
      'shared-returns',
      difficulty,
    );
    const f = await page(t, { nativeFocus: true, nativeVisibility: true });
    await f.selectFile(JSON.stringify(pack));
    assert.equal(f.$('coop-difficulty').value, difficulty);
    assert.equal(f.$('coop-difficulty').disabled, true);
    f.$('coop-start').focus();
    f.tap('Enter');
    for (const [index, level] of pack.levels.entries()) {
      assert.equal(f.$('coop-level').value, level.id);
      assert.equal(f.$('coop-menu').hidden, true);
      assert.equal(f.$('coop-overlay').hidden, true);
      assert.equal(f.$('coop-coverage').textContent, '0.0%');
      const route = routes.find((r) => r.missionId === level.id && r.difficulty === difficulty);
      f.tick(2);
      for (const segment of route.log) {
        for (const [seat, direction] of [segment.a, segment.b].entries())
          if (direction) f.tap(keys[seat][direction]);
        for (let tick = 0; tick < segment.ticks && f.$('coop-overlay').hidden; tick++) f.tick();
        if (!f.$('coop-overlay').hidden) break;
      }
      assert.equal(
        f.$('coop-overlay-kicker').textContent,
        'A WORLD YOU REVEALED TOGETHER',
        `${level.id}: ${f.$('coop-message').textContent}, ${f.$('coop-coverage').textContent}`,
      );
      assert.equal(
        f.$('coop-reserves').textContent,
        { gentle: '4 reserves', standard: '2 reserves', expert: '1 reserve' }[difficulty],
      );
      assert.equal(f.$('coop-discard-dialog').open, false);
      assert.deepEqual(f.visits, []);
      if (index < pack.levels.length - 1) {
        assert.equal(f.doc.activeElement.id, 'coop-next');
        f.$('coop-difficulty').value = difficulty === 'expert' ? 'gentle' : 'expert';
        f.tap('Enter');
        await waitFor(
          () => f.$('coop-overlay').hidden,
          () => f.$('coop-next-status').textContent,
        );
        assert.equal(f.doc.activeElement.id, 'coop-canvas');
        assert.equal(f.$('coop-difficulty').value, difficulty);
      } else {
        assert.equal(f.$('coop-next').hidden, true);
        assert.match(f.$('coop-overlay-copy').textContent, /Pack complete/);
      }
    }
    t.diagnostic(
      'Real Team host and keyboard events with modeled DOM/Canvas. Not a native-device or human pacing claim.',
    );
  });
