import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {
  loadInputs,
  PROOF_FILE,
  replayProof,
  verifyCampaign,
} from '../../scripts/verify-campaign.mjs';

const { campaign, classes } = await loadInputs();
const proof = JSON.parse(await fs.readFile(PROOF_FILE, 'utf8'));

test('campaign proof covers every authored level in both supported steering policies', async () => {
  const before = JSON.stringify({ campaign, classes });
  const result = await verifyCampaign();
  assert.equal(result.verified, campaign.levels.length * 2);
  assert.equal(JSON.stringify({ campaign, classes }), before);
});

for (const route of proof.routes)
  test(`${route.levelId} completes via recorded ${route.turnPolicy} controls from a normal run`, () => {
    const level = campaign.levels.find((l) => l.id === route.levelId);
    const summary = replayProof(level, classes, route);
    assert.deepEqual(summary, route.expected);
    assert.equal(summary.won, true);
    assert.equal(summary.status, 'won');
    assert.ok(summary.lives > 0);
    assert.ok(summary.coverage >= level.goal.coverage - 1e-9);
  });

test('proof rejects changed content and unfinished input sequences', () => {
  const route = proof.routes[0],
    level = campaign.levels.find((l) => l.id === route.levelId);
  assert.throws(
    () => replayProof({ ...level, revision: 'changed' }, classes, route),
    /content changed/,
  );
  assert.throws(() => replayProof(level, classes, { ...route, segments: [] }), /did not complete/);
  assert.throws(
    () => replayProof(level, classes, { ...route, segments: [{ ticks: 20001, input: {} }] }),
    /tick budget/,
  );
});
