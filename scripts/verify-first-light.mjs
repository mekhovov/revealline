#!/usr/bin/env node
/** Input-only wide-chapter proofs. --write searches; default replays frozen routes. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../game/replay.mjs';
import { validatePack } from '../game/packs.mjs';
import { campaignKey } from '../game/library.mjs';
import { digest, findRoute } from './verify-campaign.mjs';

const root = new URL('../', import.meta.url);
const proofURL = new URL('game/replays/first-light-routes.json', root);
export async function verifyFirstLight({ write = false } = {}) {
  const pack = JSON.parse(
    await readFile(new URL('game/content/packs/fpv-arcade.json', root), 'utf8'),
  );
  const check = validatePack(pack);
  assert.equal(check.valid, true, check.errors.join('; '));
  const levels = pack.campaigns[0].levels;
  const proof = write
    ? {
        format: 'revealline-first-light-proof.v1',
        packId: pack.id,
        packVersion: pack.version,
        packSha256: digest(pack),
        campaignId: pack.campaigns[0].id,
        campaignKey: campaignKey({ ...pack.campaigns[0], classRecipes: pack.classRecipes }),
        routes: [],
      }
    : JSON.parse(await readFile(proofURL, 'utf8'));
  assert.equal(proof.format, 'revealline-first-light-proof.v1');
  assert.equal(proof.packId, pack.id);
  assert.equal(proof.packVersion, pack.version);
  assert.equal(proof.packSha256, digest(pack));
  assert.equal(proof.campaignId, pack.campaigns[0].id);
  assert.equal(
    proof.campaignKey,
    campaignKey({ ...pack.campaigns[0], classRecipes: pack.classRecipes }),
  );
  const results = [];
  for (const level of levels)
    for (const turnPolicy of ['immediate', 'grid-center']) {
      const options = { classId: 'scout', classRecipes: pack.classRecipes, turnPolicy, seed: 1 };
      let route = proof.routes.find(
        (entry) => entry.levelId === level.id && entry.turnPolicy === turnPolicy,
      );
      if (write) {
        const found = findRoute(level, pack.classRecipes, turnPolicy, { classId: 'scout' });
        assert.equal(found.won, true, `${level.id}: ${found.reason}`);
        route = {
          levelId: level.id,
          turnPolicy,
          levelSha256: digest(level),
          classesSha256: digest(pack.classRecipes),
          segments: found.segments,
        };
      }
      assert.ok(route, `Missing ${level.id}/${turnPolicy} proof`);
      assert.equal(route.levelSha256, digest(level));
      assert.equal(route.classesSha256, digest(pack.classRecipes));
      const state = createRun(level, options),
        recorder = createRecorder(level, options, 'first-light-proof');
      const events = {};
      for (const segment of route.segments) {
        assert.ok(Number.isInteger(segment.ticks) && segment.ticks > 0);
        assert.ok(
          ['up', 'right', 'down', 'left'].includes(segment.input.direction),
          'Arcade routes must use persistent direction commands.',
        );
        for (let tick = 0; tick < segment.ticks; tick++) {
          assert.equal(state.status, 'running', 'No input may be applied after completion.');
          stepRun(state, segment.input, FIXED_DT);
          recordInput(recorder, segment.input);
          for (const event of state.events) events[event.type] = (events[event.type] ?? 0) + 1;
        }
      }
      const replay = exportReplay(recorder, state);
      assert.equal(replay.version, 'xonix-replay.v5');
      assert.equal(verifyReplay(replay).match, true);
      assert.equal(state.status, 'won');
      assert.equal(state.lives, 3);
      assert.ok(state.coverage >= level.goal.coverage);
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
        lives: state.lives,
        coverage: state.coverage,
        score: state.score,
        events,
      });
    }
  assert.equal(proof.routes.length, 6);
  if (write) await writeFile(proofURL, JSON.stringify(proof, null, 2) + '\n');
  return {
    routes: results,
    note: 'Legal deterministic winning routes establish solvability; they do not measure human enjoyment or controller comfort.',
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(
    args.length === 0 || (args.length === 1 && args[0] === '--write'),
    'Usage: node scripts/verify-first-light.mjs [--write]',
  );
  console.log(JSON.stringify(await verifyFirstLight({ write: args[0] === '--write' }), null, 2));
}
