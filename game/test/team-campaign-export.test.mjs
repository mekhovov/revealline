import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamCampaignTestPack } from '../content-design/team-export.mjs';
import { readCoopPack, coopPackDestination } from '../coop/library.mjs';

test('Team campaign export preserves authored order, selected preset and immutable exact Next destinations', () => {
  const source = createTeamJourneyCandidates(),
    before = structuredClone(source);
  const project = compileContentProject(source),
    revisions = new Set();
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const pack = createTeamCampaignTestPack(source, 'shared-returns', difficulty);
    assert.equal(pack.levels.length, 3);
    assert.equal(pack.version, 'revealline-coop-pack.v2');
    assert.equal(pack.ruleset, 'revealline-coop.v4');
    assert.deepEqual(readCoopPack(JSON.stringify(pack)), pack);
    assert(Object.isFrozen(pack.levels[0]));
    for (const [index, id] of [
      'stepping-exchange',
      'divided-workshop',
      'switchback-partners',
    ].entries()) {
      assert.deepEqual(
        pack.levels[index],
        resolveMission(project, id, { mode: 'team', difficulty }).level,
      );
      assert.deepEqual(coopPackDestination(pack, pack.levels[index]), {
        next: pack.levels[index + 1] ?? null,
        final: index === 2,
      });
    }
    revisions.add(pack.revision);
  }
  assert.equal(revisions.size, 3);
  assert.deepEqual(source, before);
  const original = createTeamCampaignTestPack(source, 'shared-returns');
  source.campaigns.find((c) => c.id === 'shared-returns').missionIds.reverse();
  const reordered = createTeamCampaignTestPack(source, 'shared-returns');
  assert.equal(reordered.id, original.id);
  assert.notEqual(reordered.revision, original.revision);
  assert.equal(original.levels[0].id, 'stepping-exchange');
});

test('campaign export does not upgrade old editions, resurrect archives or grant unsupported content', () => {
  const source = createTeamJourneyCandidates();
  const campaign = source.campaigns.find((c) => c.id === 'shared-returns');
  for (const id of ['', 'missing'])
    assert.throws(() => createTeamCampaignTestPack(source, id), /active Team campaign/);
  assert.throws(() => createTeamCampaignTestPack(source, campaign.id, 'random'));
  const terrain = createTeamCampaignTestPack(source, 'signal-partners');
  assert.equal(terrain.version, 'revealline-coop-pack.v3');
  assert.equal(terrain.levels[0].version, 'revealline-coop-level.v3');
  campaign.missionIds.push('shared-detour');
  assert.throws(() => createTeamCampaignTestPack(source, campaign.id), /not silently upgraded/);
  campaign.missionIds.pop();
  source.missions.find((m) => m.id === 'stepping-exchange').archived = true;
  assert.deepEqual(
    createTeamCampaignTestPack(source, campaign.id).levels.map((l) => l.id),
    ['divided-workshop', 'switchback-partners'],
  );
  campaign.archived = true;
  assert.throws(() => createTeamCampaignTestPack(source, campaign.id), /active Team campaign/);
});

test('Studio requires explicit draft Apply and an explicit campaign choice for Team sequence export', async () => {
  const studio = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="team-journey">Inspect Team Journey greyboxes/);
  assert.match(html, /id="team-test-campaign"/);
  const inspect = studio.match(
    /\$\('team-journey'\)\.onclick = guarded\(\(\) => \{([\s\S]*?)\n\}\);/,
  )[1];
  assert.match(inspect, /discardSource\(\)/);
  assert.match(inspect, /inspectSource\(\)/);
  assert.doesNotMatch(inspect, /session\.(?:apply|replace|transact)|publish/i);
  const handler = studio.match(
    /\$\('export-team-campaign'\)\.onclick = guarded\(async \(\) => \{([\s\S]*?)\n\}\);/,
  )[1];
  assert.match(handler, /if \(sourceChanged\)/);
  assert.match(handler, /\$\('team-test-campaign'\)\.value/);
  assert.match(
    handler,
    /createTeamCampaignTestPack\(session.current\(\), campaignId, difficulty\)/,
  );
  assert.doesNotMatch(handler, /session\.(?:apply|replace|transact)|location\./);
});
