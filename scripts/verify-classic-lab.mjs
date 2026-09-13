#!/usr/bin/env node
/** Strict input-only proofs for the original Classic Lab variants, never reference parity. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import { CLASSIC_VERSIONS } from '../game/core/versions.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  MAX_REPLAY_TICKS,
} from '../game/replay.mjs';
import { validatePack } from '../game/packs.mjs';
import { campaignKey } from '../game/library.mjs';
import { boundedJSON, exactKeys } from '../game/data-json.mjs';
import { digest, findRoute } from './verify-campaign.mjs';

const root = new URL('../', import.meta.url);
const proofURL = new URL('game/replays/classic-lab-routes.json', root);
const policies = ['immediate', 'grid-center'];
const routeId = (route) => `${route.levelId}/${route.turnPolicy}`;
const HEADER = [
  'format',
  'packId',
  'packVersion',
  'packSha256',
  'campaignId',
  'campaignKey',
  'classId',
  'seed',
  'ruleset',
  'routes',
];
const ROUTE = [
  'levelId',
  'turnPolicy',
  'levelSha256',
  'classesSha256',
  'segments',
  'expected',
  'checkpoint',
];

export async function verifyClassicLab({ write = false, proof: supplied } = {}) {
  assert.equal(typeof write, 'boolean');
  assert.ok(
    !write || supplied === undefined,
    'Cannot discover routes while verifying a supplied proof.',
  );
  const pack = JSON.parse(
    await readFile(new URL('game/content/packs/classic-lab.json', root), 'utf8'),
  );
  const checked = validatePack(pack);
  assert.equal(checked.valid, true, checked.errors.join('; '));
  assert.equal(pack.format, 'xonix-pack.v5');
  assert.equal(pack.id, 'classic-lab');
  assert.equal(pack.campaigns.length, 1);
  const campaign = { ...pack.campaigns[0], classRecipes: pack.classRecipes };
  const expectedHeader = {
    format: 'revealline-classic-lab-proof.v1',
    packId: pack.id,
    packVersion: pack.version,
    packSha256: digest(pack),
    campaignId: campaign.id,
    campaignKey: campaignKey(campaign),
    classId: 'scout',
    seed: 1,
    ruleset: CLASSIC_VERSIONS.ruleset,
  };
  const proof = write
    ? { ...expectedHeader, routes: [] }
    : boundedJSON(
        supplied === undefined ? JSON.parse(await readFile(proofURL, 'utf8')) : supplied,
        {
          maxBytes: 2 * 1024 * 1024,
          maxNodes: 50000,
          maxArray: 10000,
          maxDepth: 16,
        },
      );
  exactKeys(proof, HEADER, 'classic proof');
  for (const [key, value] of Object.entries(expectedHeader))
    assert.equal(proof[key], value, `Mismatched ${key}`);
  assert.ok(Array.isArray(proof.routes));
  const expectedIds = campaign.levels
    .flatMap((level) => policies.map((turnPolicy) => `${level.id}/${turnPolicy}`))
    .sort();
  if (!write)
    assert.deepEqual(
      proof.routes.map(routeId).sort(),
      expectedIds,
      'Exactly one proof per map and policy is required.',
    );
  const results = [];
  for (const level of campaign.levels) {
    let discovered;
    for (const turnPolicy of policies) {
      const options = { classId: 'scout', seed: 1, classRecipes: pack.classRecipes, turnPolicy };
      let route = proof.routes.find(
        (candidate) => candidate.levelId === level.id && candidate.turnPolicy === turnPolicy,
      );
      if (write) {
        // Both policies are proved below through their own public simulation and replay.
        // Reuse a center-to-center candidate only as an input proposal, never as an outcome.
        discovered ??= findRoute(level, pack.classRecipes, 'immediate', {
          classId: 'scout',
          maxMilliseconds: 15000,
        });
        assert.equal(discovered.won, true, `${level.id}: ${discovered.reason}`);
        route = {
          levelId: level.id,
          turnPolicy,
          levelSha256: digest(level),
          classesSha256: digest(pack.classRecipes),
          segments: discovered.segments.map(({ ticks, input }) => ({
            ticks,
            input: { direction: input.direction, boost: input.boost === true },
          })),
        };
      } else exactKeys(route, ROUTE, 'classic route');
      assert.equal(route.levelSha256, digest(level));
      assert.equal(route.classesSha256, digest(pack.classRecipes));
      assert.ok(
        Array.isArray(route.segments) &&
          route.segments.length > 0 &&
          route.segments.length <= 10000,
      );
      const state = createRun(level, options),
        recorder = createRecorder(level, options, 'classic-lab-proof');
      const events = {};
      let count = 0;
      for (const segment of route.segments) {
        exactKeys(segment, ['ticks', 'input'], 'classic segment');
        exactKeys(segment.input, ['direction', 'boost'], 'classic input');
        assert.ok(
          ['up', 'right', 'down', 'left'].includes(segment.input.direction),
          'Every segment requires a deliberate persistent direction.',
        );
        assert.equal(typeof segment.input.boost, 'boolean');
        assert.ok(
          Number.isInteger(segment.ticks) &&
            segment.ticks > 0 &&
            count + segment.ticks <= MAX_REPLAY_TICKS,
        );
        count += segment.ticks;
        for (let tick = 0; tick < segment.ticks; tick++) {
          assert.equal(
            state.status,
            'running',
            'No command may follow failure, recovery or completion.',
          );
          recordInput(recorder, segment.input);
          stepRun(state, segment.input, FIXED_DT);
          for (const event of state.events) events[event.type] = (events[event.type] ?? 0) + 1;
        }
      }
      assert.equal(state.status, 'won');
      assert.equal(state.classic.livesLost, 0, 'A collected heart cannot hide a failed cut.');
      assert.equal(
        state.objectives.some((item) => item.required && !item.captured),
        false,
      );
      assert.ok(state.coverage >= level.goal.coverage);
      const replay = exportReplay(recorder, state),
        verified = verifyReplay(replay);
      assert.equal(replay.version, CLASSIC_VERSIONS.replayVersion);
      assert.equal(replay.checkpoint.algorithm, CLASSIC_VERSIONS.checkpointAlgorithm);
      assert.equal(
        verified.match,
        true,
        'Every route must independently replay its complete classic state.',
      );
      if (write) {
        route.expected = replay.summary;
        route.checkpoint = replay.checkpoint;
        proof.routes.push(route);
      } else {
        assert.deepEqual(replay.summary, route.expected);
        assert.deepEqual(replay.checkpoint, route.checkpoint);
      }
      results.push({
        levelId: level.id,
        turnPolicy,
        ticks: state.tick,
        seconds: state.time,
        coverage: state.coverage,
        lives: state.lives,
        livesLost: state.classic.livesLost,
        score: state.score,
        events,
      });
    }
  }
  assert.deepEqual(proof.routes.map(routeId).sort(), expectedIds);
  assert.equal(
    digest(
      JSON.parse(await readFile(new URL('game/content/packs/classic-lab.json', root), 'utf8')),
    ),
    expectedHeader.packSha256,
    'The authored pack changed during verification.',
  );
  if (write) await writeFile(proofURL, JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
  return {
    packId: pack.id,
    campaignKey: expectedHeader.campaignKey,
    routes: results,
    note: 'Legal Scout routes prove solvability of our nine Classic Lab variants in both policies. They use held Boost and no class ability. They do not establish reference-game parity, human enjoyment, or physical-device usability.',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(
    args.length === 0 || (args.length === 1 && args[0] === '--write'),
    'Usage: node scripts/verify-classic-lab.mjs [--write]; discovery refuses to overwrite an existing proof.',
  );
  console.log(JSON.stringify(await verifyClassicLab({ write: args.includes('--write') }), null, 2));
}
