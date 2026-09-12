#!/usr/bin/env node
/** Author legal input traces explicitly; ordinary tests only read the frozen result file. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRun, stepRun, FIXED_DT, CELL } from '../../../game/core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../../../game/replay.mjs';
import { preparePack, resolvePackCampaign } from '../../../game/packs.mjs';
import { campaignKey } from '../../../game/library.mjs';

const root = new URL('../../../', import.meta.url);
const sourceURL = new URL('proposedpack-source.json', import.meta.url);
const packURL = new URL('game/content/packs/sentinel-relay.json', root);
const proofURL = new URL('game/replays/sentinel-routes.json', root);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const digest = (value) => sha(JSON.stringify(value));
const readJSON = async (url) => JSON.parse(await readFile(url, 'utf8'));
const noImage = async () => {
  throw new Error('Sentinel uses existing procedural themes, not embedded media.');
};
const ordinary = { direction: null, boost: false, action: false, pickup: false, switchClass: null };

function authorRoute(pack, turnPolicy, variant, classId) {
  const level = pack.campaigns[0].levels[0];
  const options = { turnPolicy, classId, classRecipes: pack.classRecipes, seed: 1 };
  const run = createRun(level, options);
  const recorder = createRecorder(level, options, 'sentinel-relay-proof');
  const events = [],
    phases = [];
  let previousPhase = '';
  function step(direction = null) {
    assert.ok(
      ['running', 'respawning'].includes(run.status),
      `Unexpected terminal state at ${run.tick}`,
    );
    const input = { ...ordinary, direction };
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
    events.push(
      ...run.events
        .filter((event) => !['cells.claimed', 'run.completed'].includes(event.type))
        .map((event) => structuredClone(event)),
    );
    const phase = JSON.stringify([run.encounter.stage, run.encounter.phase, run.encounter.cycle]);
    if (phase !== previousPhase) {
      phases.push({
        tick: run.tick,
        stage: run.encounter.stage,
        phase: run.encounter.phase,
        phaseStartTick: run.encounter.phaseStartTick,
        phaseEndTick: run.encounter.phaseEndTick,
        cycle: run.encounter.cycle,
        lane: run.encounter.lane,
        lives: run.lives,
        remainingField: run.cells.reduce((n, cell) => n + Number(cell === CELL.FIELD), 0),
      });
      previousPhase = phase;
    }
    assert.ok(run.tick < 30000, 'Author route exceeded its bounded tick budget.');
  }
  function move(direction, cells) {
    // All supplied recipes retain 8 cells/s. Positions/timing are produced by the core.
    assert.equal(run.rules.moveSpeed, 8);
    assert.equal(run.classRecipe.moveSpeedMultiplier ?? 1, 1);
    for (let i = 0; i < Math.round(cells * 15) && !['won', 'lost'].includes(run.status); i++)
      step(direction);
  }
  function wait(predicate, limit = 6000) {
    for (let i = 0; !predicate(); i++) {
      assert.ok(i < limit, `Wait exceeded its budget at ${run.tick}`);
      step();
    }
  }
  const open = () => run.encounter.stage === 'exposed' && run.encounter.phase === 'open';
  function freshOpen() {
    if (open()) wait(() => !open());
    wait(open);
  }

  move('up', 18);
  move('right', 12);
  wait(() => run.tick >= 566);
  move('down', 35);
  assert.equal(run.objectives.find((o) => o.id === 'shield-relay').captured, true);
  if (variant === 'isolation') {
    move('up', 35);
    move('right', 21);
    freshOpen();
    move('down', 35);
    assert.equal(run.status, 'running', 'The long cut must close after the opening.');
    move('right', 2);
    freshOpen();
    move('up', 35);
    assert.equal(run.status, 'running', 'The second narrowing cut must not defeat early.');
    move('down', 17);
    freshOpen();
    move('left', 2);
    move('down', 2);
    move('right', 2);
    if (run.status !== 'won') wait(() => run.status === 'won');
  } else {
    move('right', 8);
    if (variant === 'recovered') {
      wait(() => run.encounter.stage === 'exposed' && run.encounter.phase === 'warning');
      move('up', 6);
      wait(() => run.lives === 2);
      wait(() => run.status === 'running');
      move('down', 17);
      move('right', 20);
    }
    for (let n = 0; n < (variant === 'missed-windows' ? 3 : 1); n++) freshOpen();
    move('up', 6);
    move('left', 8);
    if (run.status !== 'won') wait(() => run.status === 'won');
  }
  const replay = exportReplay(recorder, run);
  assert.equal(verifyReplay(replay).match, true, 'New replay must independently reconstruct.');
  assert.equal(run.status, 'won');
  assert.equal(run.encounter.defeatCause, variant === 'isolation' ? 'isolated' : 'cut-release');
  assert.equal(run.lives, variant === 'recovered' ? 2 : 3);
  assert.equal(events.filter((e) => e.type === 'ability.used').length, 0);
  assert.equal(events.filter((e) => e.type === 'encounter.defeated').length, 1);
  return {
    id: `${level.id}/${turnPolicy}/${variant}/${classId}`,
    levelId: level.id,
    turnPolicy,
    classId,
    seed: 1,
    variant,
    segments: replay.segments,
    releaseAfter: replay.releaseAfter,
    expected: replay.summary,
    checkpoint: replay.checkpoint,
    phases,
    events,
  };
}

export async function generateSentinelProof() {
  const source = await readJSON(sourceURL);
  const { pack } = await preparePack(source, { decodeImage: noImage });
  const routes = [];
  for (const policy of ['immediate', 'grid-center']) {
    for (const recipe of pack.classRecipes)
      routes.push(authorRoute(pack, policy, 'ordinary', recipe.id));
    for (const variant of ['missed-windows', 'isolation', 'recovered'])
      routes.push(authorRoute(pack, policy, variant, 'scout'));
  }
  const { campaign } = resolvePackCampaign(pack, 'sentinel-relay');
  return {
    pack,
    proof: {
      format: 'xonix-sentinel-proof.v1',
      packId: pack.id,
      packVersion: pack.version,
      packSha256: digest(pack),
      levelSha256: digest(campaign.levels[0]),
      classesSha256: digest(pack.classRecipes),
      campaignKey: campaignKey(campaign),
      method:
        'Fourteen ordinary no-ability/no-boost legal clears plus both-policy missed-window, field-isolation and post-contact recovery routes. Every fixed input trace independently verifies as replay v4; no state assignments or forced wins.',
      routes,
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  assert.ok(
    args.length === 0 || (args.length === 1 && args[0] === '--write'),
    'Use no arguments to verify, or --write to deliberately author current new fixtures.',
  );
  const { pack, proof } = await generateSentinelProof();
  if (args[0] === '--write') {
    // Validate/prove everything before replacing either owned output.
    await writeFile(packURL, `${JSON.stringify(pack, null, 2)}\n`);
    await writeFile(proofURL, `${JSON.stringify(proof, null, 2)}\n`);
  } else {
    assert.deepEqual(await readJSON(packURL), pack, 'Runtime pack differs from its source.');
    assert.deepEqual(
      await readJSON(proofURL),
      proof,
      'New proof differs; investigate, never regenerate frozen releases.',
    );
  }
  console.log(
    JSON.stringify({
      mode: args[0] === '--write' ? 'authored' : 'verified',
      routes: proof.routes.length,
      ordinary: proof.routes.filter((r) => r.variant === 'ordinary').length,
      campaignKey: proof.campaignKey,
      summary: proof.routes
        .filter((r) => r.classId === 'scout')
        .map((r) => ({
          policy: r.turnPolicy,
          variant: r.variant,
          ticks: r.expected.tick,
          lives: r.expected.lives,
        })),
    }),
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main();
