#!/usr/bin/env node
/** Exact R3 routes and an original playable impact demonstration; no run state patches. */
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
import { validatePack } from '../game/packs.mjs';
import { validateScenario } from '../game/content.mjs';
import { campaignKey } from '../game/library.mjs';
import { createDifficultyContext } from '../game/campaign-difficulty.mjs';
import { boundedJSON, exactKeys } from '../game/data-json.mjs';
import { digest } from './verify-campaign.mjs';
const root = new URL('../', import.meta.url),
  proofURL = new URL('game/replays/fpv-arcade-r3-routes.json', root);
const load = async (name) => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const policies = ['immediate', 'grid-center'],
  modes = ['standard', 'gentle'];
const routeId = (r) => `${r.difficulty}/${r.levelId}/${r.turnPolicy}`;
function simulate(level, recipes, policy, segments, expectedStatus = 'won') {
  assert.ok(Array.isArray(segments) && segments.length > 0 && segments.length <= 1000);
  const options = { classId: 'scout', classRecipes: recipes, turnPolicy: policy, seed: 1 };
  const run = createRun(level, options),
    recorder = createRecorder(level, options, 'fpv-r3-proof'),
    eventCounts = {};
  let needsRelease = false,
    total = 0,
    maxFronts = 0;
  for (const segment of segments) {
    exactKeys(segment, ['ticks', 'input'], 'R3 segment');
    exactKeys(segment.input, ['direction', 'boost'], 'R3 input');
    assert.equal(typeof segment.input.boost, 'boolean');
    assert.ok(
      Number.isInteger(segment.ticks) && segment.ticks > 0 && (total += segment.ticks) <= 18000,
    );
    if (needsRelease) {
      assert.deepEqual(segment, { ticks: 1, input: { direction: null, boost: false } });
      needsRelease = false;
    } else assert.ok(['up', 'right', 'down', 'left'].includes(segment.input.direction));
    for (let i = 0; i < segment.ticks; i++) {
      assert.equal(run.status, 'running', 'Only ordinary active commands are accepted.');
      recordInput(recorder, segment.input);
      stepRun(run, segment.input, FIXED_DT);
      maxFronts = Math.max(maxFronts, run.classic.lineImpact.fronts.length);
      for (const event of run.events) eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
      if (run.events.some((e) => e.type === 'capture.stopped')) {
        assert.equal(i, segment.ticks - 1);
        needsRelease = run.status === 'running';
      }
    }
  }
  assert.equal(run.status, expectedStatus);
  if (expectedStatus === 'won') assert.equal(run.classic.livesLost, 0);
  assert.deepEqual(run.classic.lineImpact.fronts, []);
  const replay = exportReplay(recorder, run),
    verified = verifyReplay(replay);
  assert.equal(replay.version, 'xonix-replay.v6');
  assert.equal(verified.match, true);
  const checkpoint = authoritativeCheckpoint(run);
  assert.deepEqual(authoritativeCheckpoint(verified.state), checkpoint);
  return {
    expected: getSummary(run),
    checkpoint,
    metrics: { ticks: total, maxFronts, eventCounts },
  };
}
function evaluate({ pack, prior, priorProof, demo, proof }, write = false) {
  const checked = validatePack(pack);
  assert.equal(checked.valid, true, checked.errors.join('; '));
  assert.equal(pack.id, 'fpv-arcade-r3');
  assert.equal(pack.format, 'xonix-pack.v5');
  assert.equal(pack.engine, 'xonix-core.v5');
  assert.equal(pack.campaigns.length, 1);
  assert.equal(pack.campaigns[0].id, 'fpv-first-light-r3');
  assert.equal(pack.campaigns[0].revision, '3');
  assert.deepEqual(
    pack.campaigns[0].levels.map((l) => l.id),
    ['orchard-window', 'split-courtyard', 'night-signal'],
  );
  for (const level of pack.campaigns[0].levels) {
    assert.equal(level.revision, '3');
    assert.deepEqual(level.classic.lineImpact, { version: 'line-impact.v1', speed: 24 });
    assert.equal(level.rules.stopOnCapture, true);
  }
  assert.equal(prior.id, 'fpv-arcade-r2');
  assert.equal(priorProof.packSha256, digest(prior));
  const oldLevels = structuredClone(pack.campaigns[0].levels);
  for (const level of oldLevels) {
    level.revision = '2';
    delete level.classic.lineImpact;
  }
  assert.deepEqual(oldLevels, prior.campaigns[0].levels, 'R3 preserves the authored R2 boards.');
  assert.deepEqual(pack.levelVisuals, prior.levelVisuals);
  assert.deepEqual(pack.classRecipes, prior.classRecipes);
  assert.equal(validateScenario(demo).valid, true);
  assert.equal(demo.level.id, 'line-impact-demo');
  assert.deepEqual(demo.classRecipes, pack.classRecipes);
  const base = { ...pack.campaigns[0], classRecipes: pack.classRecipes };
  const header = {
    format: 'revealline-first-light-r3-proof.v1',
    packId: pack.id,
    packVersion: pack.version,
    packSha256: digest(pack),
    baseCampaignKey: campaignKey(base),
    classesSha256: digest(pack.classRecipes),
    r2PackSha256: digest(prior),
    r2ProofSha256: digest(priorProof),
    demoSha256: digest(demo),
    classId: 'scout',
    seed: 1,
  };
  if (write) proof = { ...header, routes: [], demonstrations: [] };
  else {
    exactKeys(proof, [...Object.keys(header), 'routes', 'demonstrations'], 'R3 proof');
    for (const [key, value] of Object.entries(header))
      assert.deepEqual(proof[key], value, `R3 ${key}`);
    assert.ok(Array.isArray(proof.routes) && Array.isArray(proof.demonstrations));
    const expectedIds = modes.flatMap((difficulty) =>
      pack.campaigns[0].levels.flatMap((level) =>
        policies.map((turnPolicy) => routeId({ difficulty, levelId: level.id, turnPolicy })),
      ),
    );
    assert.deepEqual(proof.routes.map(routeId).sort(), expectedIds.sort());
    assert.deepEqual(
      proof.demonstrations.map((r) => r.id).sort(),
      policies.flatMap((policy) => [`${policy}/close-before-arrival`, `${policy}/arrival`]).sort(),
    );
  }
  const ids = [],
    routes = [];
  for (const difficulty of modes) {
    const context = createDifficultyContext(base, difficulty);
    for (const level of context.campaign.levels)
      for (const turnPolicy of policies) {
        const identity = {
          difficulty,
          levelId: level.id,
          turnPolicy,
          campaignKey: context.campaignKey,
          levelSha256: digest(level),
        };
        const id = routeId(identity);
        ids.push(id);
        const record = write
          ? {
              ...identity,
              segments: structuredClone(priorProof.routes.find((r) => routeId(r) === id).segments),
            }
          : proof.routes.find((r) => routeId(r) === id);
        assert.ok(record, `Missing R3 route ${id}`);
        exactKeys(
          record,
          [
            ...Object.keys(identity),
            'segments',
            ...(write ? [] : ['expected', 'checkpoint', 'metrics']),
          ],
          'R3 route',
        );
        for (const [key, value] of Object.entries(identity)) assert.deepEqual(record[key], value);
        const result = simulate(level, pack.classRecipes, turnPolicy, record.segments);
        if (write) proof.routes.push({ ...record, ...result });
        else
          for (const [key, value] of Object.entries(result))
            assert.deepEqual(record[key], value, `${id} ${key}`);
        routes.push({ id, ...result.expected, metrics: result.metrics });
      }
  }
  assert.deepEqual(proof.routes.map(routeId).sort(), ids.sort());
  const demoIds = [],
    demonstrations = [];
  for (const turnPolicy of policies)
    for (const boost of [true, false]) {
      const id = `${turnPolicy}/${boost ? 'close-before-arrival' : 'arrival'}`;
      demoIds.push(id);
      const segments = [{ ticks: boost ? 276 : 292, input: { direction: 'down', boost } }];
      const result = simulate(
        demo.level,
        demo.classRecipes,
        turnPolicy,
        segments,
        boost ? 'won' : 'lost',
      );
      assert.equal(result.metrics.eventCounts['lineImpact.seeded'], 1);
      assert.equal(result.metrics.maxFronts, 2);
      assert.equal(result.metrics.eventCounts['lineImpact.arrived'] ?? 0, boost ? 0 : 1);
      const record = { id, turnPolicy, segments, ...result };
      if (write) proof.demonstrations.push(record);
      else
        assert.deepEqual(
          proof.demonstrations.find((r) => r.id === id),
          record,
        );
      demonstrations.push({ id, ...result.expected, metrics: result.metrics });
    }
  assert.deepEqual(proof.demonstrations.map((r) => r.id).sort(), demoIds.sort());
  return {
    proof,
    report: {
      packId: pack.id,
      campaignKey: header.baseCampaignKey,
      routes,
      demonstrations,
      note: 'Twelve legal Scout wins and four original mechanic demonstrations. Reuses R2 boards and the exact original images; no new unique-art, reference-timing, human-fun or device claim.',
    },
  };
}
export function verifyFpvR3Proof(source) {
  const owned = boundedJSON(source, {
    maxBytes: 64 * 1024 * 1024,
    maxNodes: 400000,
    maxDepth: 24,
    maxArray: 20000,
    maxString: 24 * 1024 * 1024,
  });
  exactKeys(owned, ['pack', 'prior', 'priorProof', 'demo', 'proof'], 'R3 verification request');
  return evaluate(owned).report;
}
export async function verifyFpvR3({ write = false, proof: supplied } = {}) {
  assert.equal(typeof write, 'boolean');
  assert.ok(!write || supplied === undefined);
  const paths = [
    'game/content/packs/fpv-arcade-r3.json',
    'game/content/packs/fpv-arcade-r2.json',
    'game/replays/fpv-arcade-r2-routes.json',
    'game/content/scenarios/line-impact-demo.json',
  ];
  const [pack, prior, priorProof, demo] = await Promise.all(paths.map(load));
  const proof =
    supplied === undefined && !write ? JSON.parse(await readFile(proofURL, 'utf8')) : supplied;
  const result = write
    ? evaluate({ pack, prior, priorProof, demo, proof }, true)
    : { report: verifyFpvR3Proof({ pack, prior, priorProof, demo, proof }) };
  for (const [i, input] of [pack, prior, priorProof, demo].entries())
    assert.equal(digest(await load(paths[i])), digest(input));
  if (write)
    await writeFile(proofURL, JSON.stringify(result.proof, null, 2) + '\n', { flag: 'wx' });
  return result.report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--write'));
  console.log(JSON.stringify(await verifyFpvR3({ write: args.includes('--write') }), null, 2));
}
