#!/usr/bin/env node
/** Legal direction-only R4 inputs; no simulation state mutation or fabricated outcome. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRun, stepRun, getSummary, FIXED_DT } from '../game/core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../game/replay.mjs';
import { campaignKey } from '../game/library.mjs';
import { createDifficultyContext } from '../game/campaign-difficulty.mjs';
import { boundedJSON, exactKeys } from '../game/data-json.mjs';
import { buildArcadeEdition } from '../authoring/library/fpv-arcade-r4/build.mjs';
import { digest } from './verify-campaign.mjs';

const root = new URL('../', import.meta.url),
  proofFile = new URL('game/replays/fpv-arcade-r4-routes.json', root);
const load = async (file) => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const key = (r) => `${r.difficulty}/${r.levelId}/${r.turnPolicy}`;
const policies = ['immediate', 'grid-center'],
  difficulties = ['standard', 'gentle'];

function simulate(level, recipes, turnPolicy, segments) {
  assert.ok(Array.isArray(segments) && segments.length > 0 && segments.length <= 1000);
  const options = { classId: 'scout', classRecipes: recipes, turnPolicy, seed: 1 };
  const run = createRun(level, options),
    recorder = createRecorder(level, options, 'fpv-r4-proof');
  let total = 0,
    releaseNeeded = false;
  const eventCounts = {};
  for (const segment of segments) {
    exactKeys(segment, ['ticks', 'input'], 'R4 segment');
    exactKeys(segment.input, ['direction'], 'R4 direction-only command');
    assert.ok(
      Number.isInteger(segment.ticks) && segment.ticks > 0 && (total += segment.ticks) <= 18000,
    );
    if (releaseNeeded) {
      assert.deepEqual(segment, { ticks: 1, input: { direction: null } });
      releaseNeeded = false;
    } else assert.ok(['up', 'right', 'down', 'left'].includes(segment.input.direction));
    for (let i = 0; i < segment.ticks; i++) {
      assert.equal(run.status, 'running');
      recordInput(recorder, segment.input);
      stepRun(run, segment.input, FIXED_DT);
      for (const event of run.events) eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
      if (run.events.some((e) => e.type === 'capture.stopped')) {
        assert.equal(i, segment.ticks - 1, 'A successful closure ends the held direction segment.');
        releaseNeeded = run.status === 'running';
      }
    }
  }
  assert.equal(run.status, 'won');
  assert.equal(run.classic.livesLost, 0);
  assert.equal(eventCounts['ability.used'] ?? 0, 0);
  assert.equal(eventCounts['pickup.collected'] ?? 0, 0);
  const replay = exportReplay(recorder, run),
    verified = verifyReplay(replay),
    checkpoint = authoritativeCheckpoint(run);
  assert.equal(verified.match, true);
  assert.deepEqual(authoritativeCheckpoint(verified.state), checkpoint);
  return { expected: getSummary(run), checkpoint, metrics: { ticks: total, eventCounts } };
}

function evaluate({ pack, prior, priorProof, proof }, write = false) {
  assert.deepEqual(
    pack,
    buildArcadeEdition(prior),
    'R4 is exactly the declared immutable R3 derivation.',
  );
  assert.equal(priorProof.packId, prior.id);
  assert.equal(priorProof.packSha256, digest(prior));
  const base = { ...pack.campaigns[0], classRecipes: pack.classRecipes };
  const ids = difficulties.flatMap((difficulty) =>
    base.levels.flatMap((level) =>
      policies.map((turnPolicy) => key({ difficulty, levelId: level.id, turnPolicy })),
    ),
  );
  assert.equal(priorProof.format, 'revealline-first-light-r3-proof.v1');
  assert.deepEqual(priorProof.routes.map(key).sort(), [...ids].sort());
  const header = {
    format: 'revealline-first-light-r4-proof.v1',
    packId: pack.id,
    packVersion: pack.version,
    packSha256: digest(pack),
    baseCampaignKey: campaignKey(base),
    classesSha256: digest(pack.classRecipes),
    r3PackSha256: digest(prior),
    r3ProofSha256: digest(priorProof),
    classId: 'scout',
    seed: 1,
  };
  if (write) proof = { ...header, routes: [] };
  else {
    exactKeys(proof, [...Object.keys(header), 'routes'], 'R4 proof');
    for (const [field, value] of Object.entries(header))
      assert.deepEqual(proof[field], value, `R4 ${field}`);
    assert.ok(Array.isArray(proof.routes));
    assert.deepEqual(proof.routes.map(key).sort(), [...ids].sort());
  }
  const routes = [];
  for (const difficulty of difficulties) {
    const context = createDifficultyContext(base, difficulty);
    for (const level of context.campaign.levels)
      for (const turnPolicy of policies) {
        const identity = {
            difficulty,
            levelId: level.id,
            turnPolicy,
            campaignKey: context.campaignKey,
            levelSha256: digest(level),
          },
          id = key(identity);
        const old = priorProof.routes.find((r) => key(r) === id);
        const segments = old.segments.map((segment) => {
          assert.equal(segment.input.boost, segment.input.direction !== null);
          return { ticks: segment.ticks, input: { direction: segment.input.direction } };
        });
        const record = write ? { ...identity, segments } : proof.routes.find((r) => key(r) === id);
        if (!write) {
          exactKeys(
            record,
            [...Object.keys(identity), 'segments', 'expected', 'checkpoint', 'metrics'],
            'R4 route',
          );
          for (const [field, value] of Object.entries(identity))
            assert.deepEqual(record[field], value);
          assert.deepEqual(
            record.segments,
            segments,
            'Only the old explicit Boost flag is removed.',
          );
        }
        const result = simulate(level, pack.classRecipes, turnPolicy, record.segments);
        for (const field of [
          'tick',
          'time',
          'lives',
          'livesLost',
          'score',
          'coverage',
          'claimedCount',
          'totalClaimable',
          'medal',
        ])
          assert.deepEqual(
            result.expected[field],
            old.expected[field],
            `Authored cruise preserves prior boosted ${field}.`,
          );
        if (write) proof.routes.push({ ...record, ...result });
        else
          for (const [field, value] of Object.entries(result))
            assert.deepEqual(record[field], value);
        routes.push({ id, ...result.expected, metrics: result.metrics });
      }
  }
  return {
    proof,
    report: {
      packId: pack.id,
      campaignKey: header.baseCampaignKey,
      routes,
      note: 'Twelve real direction-only Scout wins; prior R3 geometry, enemy timing and original images. Contact pickups remain authored. No new artwork or human/device qualification.',
    },
  };
}

export function verifyFpvR4Proof(candidate) {
  const owned = boundedJSON(candidate, {
    maxBytes: 64 * 1024 * 1024,
    maxNodes: 400000,
    maxDepth: 24,
    maxArray: 20000,
    maxString: 24 * 1024 * 1024,
  });
  exactKeys(owned, ['pack', 'prior', 'priorProof', 'proof'], 'R4 verification request');
  return evaluate(owned).report;
}
export async function verifyFpvR4({ write = false } = {}) {
  assert.equal(typeof write, 'boolean');
  const paths = [
    'game/content/packs/fpv-arcade-r4.json',
    'game/content/packs/fpv-arcade-r3.json',
    'game/replays/fpv-arcade-r3-routes.json',
  ];
  const [pack, prior, priorProof] = await Promise.all(paths.map(load));
  const input = {
    pack,
    prior,
    priorProof,
    proof: write ? null : JSON.parse(await readFile(proofFile, 'utf8')),
  };
  const result = write ? evaluate(input, true) : { report: verifyFpvR4Proof(input) };
  for (const [i, value] of [pack, prior, priorProof].entries())
    assert.equal(digest(await load(paths[i])), digest(value));
  if (write)
    await writeFile(proofFile, JSON.stringify(result.proof, null, 2) + '\n', { flag: 'wx' });
  return result.report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--write'));
  console.log(JSON.stringify(await verifyFpvR4({ write: args.includes('--write') }), null, 2));
}
