import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { createTeamCampaignTestPack } from '../content-design/team-export.mjs';
import { page } from './helpers/coop-host.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';
import { playCurrentTeamRoute } from './helpers/current-team-route.mjs';

const source = createTeamJourneyCandidates();

for (const campaignId of ['shared-returns', 'shared-material-routes', 'changing-common-ground'])
  for (const difficulty of ['gentle', 'standard', 'expert'])
    test(`authored ${campaignId}/${difficulty} Team campaign earns consecutive real-host clears with one Next and no lobby between`, async (t) => {
      const pack = createTeamCampaignTestPack(source, campaignId, difficulty);
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
        if (level.enemies.some((enemy) => enemy.type === 'claimed-rover')) {
          assert.equal(f.$('coop-state-0').textContent, 'On reclaimed ground');
          assert.equal(f.$('coop-state-1').textContent, 'On reclaimed ground');
          assert.match(f.$('coop-threat-help').textContent, /not universally safe/);
        }
        playCurrentTeamRoute(f, source, level.id, difficulty);
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
          assert.match(f.$('coop-overlay-copy').textContent, /End of the Team mission library/);
        }
      }
      t.diagnostic(
        'Real Team host and keyboard events with modeled DOM/Canvas. Not a native-device or human pacing claim.',
      );
    });
