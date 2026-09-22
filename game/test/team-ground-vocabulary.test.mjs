import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { coopGroundName } from '../couch/coop-ground.mjs';
import { coopArenaGuidance } from '../couch/coop-briefing.mjs';
import { coopFailureFeedback } from '../couch/coop-feedback.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { page } from './helpers/coop-host.mjs';

const source = createTeamJourneyCandidates(),
  journey = createCandidateTeamHost(source, { corePackIds: source.packs.map((pack) => pack.id) });

test('every Journey Team edition uses reclaimed ground regardless of currently authored enemy roles', () => {
  for (const row of journey.rows) {
    const level = row.level;
    assert.equal(coopGroundName(level), 'reclaimed ground');
    for (const jointCuts of [true, false]) {
      const guidance = coopArenaGuidance(level, { jointCuts });
      assert.match(guidance.supportText, /Hold Support on reclaimed ground/);
      assert.doesNotMatch(Object.values(guidance).join(' '), /safe ground|safe routes/);
    }
    assert.match(
      coopFailureFeedback({ level }, { cause: 'self-trail' }).advice,
      /reclaimed ground/,
    );
  }
});

test('historical Team wording remains unchanged and no level data is rewritten', () => {
  const before = JSON.stringify(COOP_STARTER_PACK);
  for (const level of COOP_STARTER_PACK.levels) {
    assert.equal(coopGroundName(level), 'safe ground');
    assert.match(coopArenaGuidance(level).supportText, /Hold Support on safe ground/);
    assert.match(coopFailureFeedback({ level }, { cause: 'self-trail' }).advice, /safe ground/);
  }
  assert.equal(JSON.stringify(COOP_STARTER_PACK), before);
});

for (const mission of ['twin-landings', 'shared-detour', 'shared-lookout'])
  test(`real Team setup, independent controls, HUD and paused Help share the vocabulary: ${mission}`, async (t) => {
    const f = await page(t);
    await f.selectFile(JSON.stringify(createTeamTestPack(source, mission, 'standard')));
    assert.match(f.$('coop-closure-help').textContent, /back to reclaimed ground/);
    assert.match(f.$('coop-help-support').textContent, /crawl along reclaimed ground/);
    f.choose('coop-experiment', 'independent');
    assert.match(f.$('coop-cut-help').textContent, /Return to reclaimed ground/);
    assert.match(f.$('coop-intro').textContent, /return to reclaimed ground/);
    f.$('coop-start').click();
    f.tick(2);
    for (const seat of [0, 1])
      assert.equal(f.$(`coop-state-${seat}`).textContent, 'On reclaimed ground');
    f.$('coop-pause').click();
    assert.match(
      f.$('coop-help-support').textContent,
      /Hold Support on reclaimed ground.*crawl along reclaimed ground/,
    );
    assert.equal(f.$('coop-overlay-kicker').textContent, 'PAUSED');
  });
