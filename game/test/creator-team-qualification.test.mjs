import test from 'node:test';
import assert from 'node:assert/strict';
import { getCoopSummary, stepCoop } from '../coop/core.mjs';
import { readCoopPack } from '../coop/library.mjs';
import { CREATOR_COMPATIBILITY, CREATOR_VERSUS_COMPATIBILITY } from '../creator/bundle.mjs';
import { generateCreatorProject } from '../creator/templates.mjs';
import {
  CREATOR_TEAM_INPUT_POLICY,
  CREATOR_TEAM_PRESETS,
  CREATOR_TEAM_TEMPLATE_VERSION,
  createCreatorTeamAttempt,
  creatorTeamSuccessor,
  exportCreatorTeamCampaign,
  generateCreatorTeamCampaign,
  importCreatorTeamCampaign,
  prepareCreatorTeamCampaign,
  validateCreatorTeamCampaign,
  verifyCreatorTeamCampaign,
} from '../creator/team.mjs';

const directions = (left, right) => [
  { direction: left, boost: true, support: false },
  { direction: right, boost: true, support: false },
];

test('Team generation uses a separate bounded registry and deterministic campaign order', () => {
  const even = generateCreatorTeamCampaign({ id: 'team-even', name: 'Team Even', seed: 8 });
  const same = generateCreatorTeamCampaign({ id: 'team-even', name: 'Team Even', seed: 8 });
  const odd = generateCreatorTeamCampaign({ id: 'team-odd', name: 'Team Odd', seed: 9 });
  assert.deepEqual(even, same);
  assert.deepEqual(
    even.provenance.levels.map((row) => row.templateId),
    ['coverage', 'stronghold'],
  );
  assert.deepEqual(
    odd.provenance.levels.map((row) => row.templateId),
    ['stronghold', 'coverage'],
  );
  for (const made of [even, odd]) {
    assert.equal(made.provenance.templateVersion, CREATOR_TEAM_TEMPLATE_VERSION);
    assert(made.pack.levels.every((level) => level.spawns.length === 2));
    assert(made.pack.levels.every((level) => level.enemies.length >= 4));
    validateCreatorTeamCampaign(made.pack, made.provenance);
  }

  const solo = generateCreatorProject({ id: 'still-separate', name: 'Still separate', seed: 0 });
  assert.deepEqual(solo.project.missions[0].modes, ['solo', 'versus']);
  assert.deepEqual(CREATOR_COMPATIBILITY.modes, ['solo']);
  assert.equal(CREATOR_COMPATIBILITY.format, 'revealline-creator-runtime.v1');
  assert.deepEqual(CREATOR_VERSUS_COMPATIBILITY.modes, ['solo', 'versus']);
  assert.equal(CREATOR_VERSUS_COMPATIBILITY.format, 'revealline-creator-runtime.v2');
});

test('every generated Team template passes all advertised difficulties and presets with two contributors', async () => {
  const made = generateCreatorTeamCampaign({
    id: 'qualified-team',
    name: 'Qualified Team',
    seed: 0,
  });
  const evidence = await verifyCreatorTeamCampaign(made.pack, made.provenance);
  assert.equal(evidence.length, made.pack.levels.length * 3 * CREATOR_TEAM_PRESETS.length);
  assert.deepEqual(
    new Set(evidence.map((row) => row.difficulty)),
    new Set(['gentle', 'standard', 'expert']),
  );
  assert.deepEqual(
    new Set(evidence.map((row) => row.presetId)),
    new Set(CREATOR_TEAM_PRESETS.map((preset) => preset.id)),
  );
  assert(
    evidence.every(
      (row) =>
        row.inputPolicy === CREATOR_TEAM_INPUT_POLICY &&
        row.contributions.length === 2 &&
        row.contributions.every((count) => count > 0) &&
        row.jointCuts > 0 &&
        row.inputIdentity.length === 16 &&
        row.terminalIdentity.length === 16,
    ),
  );
});

test('template claims fail closed when geometry, provenance, or a Team objective changes', () => {
  const made = generateCreatorTeamCampaign({ id: 'closed-team', name: 'Closed Team', seed: 0 });
  for (const mutate of [
    (pack) => pack.levels[0].spawns.reverse(),
    (pack) => (pack.levels[0].goal.coverage = 0.4),
    (pack) => pack.levels[1].walls[0].x++,
  ]) {
    const pack = structuredClone(made.pack);
    mutate(pack);
    assert.throws(
      () => validateCreatorTeamCampaign(pack, made.provenance),
      /differs from|provenance|template/i,
    );
  }
  const provenance = structuredClone(made.provenance);
  provenance.levels[0].templateId = 'stronghold';
  assert.throws(() => validateCreatorTeamCampaign(made.pack, provenance), /differs from|template/i);
});

test('a legal failure consumes shared reserves and Retry restarts the exact selected attempt', () => {
  const made = generateCreatorTeamCampaign({ id: 'retry-team', name: 'Retry Team', seed: 0 });
  const level = made.pack.levels[0];
  const failed = createCreatorTeamAttempt(made.pack, level.id, 'expert', 'full');
  const initial = {
    summary: getCoopSummary(failed),
    cells: [...failed.cells],
    enemies: structuredClone(failed.enemies),
  };
  for (let cycle = 0; cycle < 4 && failed.status === 'running'; cycle++) {
    for (let tick = 0; tick < 40 && failed.status === 'running'; tick++)
      stepCoop(failed, directions('right', 'left'));
    for (let tick = 0; tick < 40 && failed.status === 'running'; tick++)
      stepCoop(failed, directions('left', 'right'));
    for (let tick = 0; tick < 200 && failed.status === 'running'; tick++)
      stepCoop(failed, directions(null, null));
  }
  assert.equal(failed.status, 'lost');
  assert.equal(failed.team.reserves, 0);

  const retry = createCreatorTeamAttempt(made.pack, level.id, 'expert', 'full');
  assert.deepEqual(getCoopSummary(retry), initial.summary);
  assert.deepEqual([...retry.cells], initial.cells);
  assert.deepEqual(retry.enemies, initial.enemies);
  assert.equal(retry.status, 'running');
});

test('Next follows immutable authored order and portable transfer re-verifies exact evidence', async () => {
  const made = generateCreatorTeamCampaign({
    id: 'portable-team',
    name: 'Portable Team',
    seed: 1,
  });
  const first = made.pack.levels[0],
    second = made.pack.levels[1];
  assert.equal(creatorTeamSuccessor(made.pack, first.id)?.id, second.id);
  assert.equal(creatorTeamSuccessor(made.pack, second.id), null);

  const prepared = await prepareCreatorTeamCampaign(made.pack, made.provenance);
  const transfer = exportCreatorTeamCampaign(prepared);
  assert.equal(transfer.type, 'application/vnd.revealline.team+json');
  const imported = await importCreatorTeamCampaign(transfer);
  assert.deepEqual(imported, prepared);
  assert.deepEqual(readCoopPack(JSON.stringify(imported.pack)), imported.pack);

  const tampered = JSON.parse(await transfer.text());
  tampered.evidence[0].contributions[0]++;
  await assert.rejects(
    importCreatorTeamCampaign(new Blob([JSON.stringify(tampered)])),
    /evidence differs/,
  );
});
