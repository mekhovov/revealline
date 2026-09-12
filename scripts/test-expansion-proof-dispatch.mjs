import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  expansionSources,
  verifyExpansionRoutes,
  verifyExpansionProofs,
  assertDiscoverySupported,
} from './verify-packs.mjs';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../game/core/index.mjs';
import { createRecorder, recordInput, recordRelease, exportReplay } from '../game/replay.mjs';

const legacyURL = new URL('../game/replays/expansion-routes.json', import.meta.url);
const bytes = await readFile(legacyURL),
  proof = JSON.parse(bytes);
const encounterProof = JSON.parse(
  await readFile(new URL('../game/replays/sentinel-routes.json', import.meta.url)),
);
const packs = await expansionSources(),
  sentinel = packs.find((pack) => pack.id === encounterProof.packId),
  legacy = packs[0];
const originalSHA = '22886cf439f716db31333b3b6d9fae0478f8007aff734632badc7c2f38dc53c8';
const sha = (value) => createHash('sha256').update(value).digest('hex');
function fixture() {
  return structuredClone({
    packs: [legacy, sentinel],
    proof: { ...proof, routes: proof.routes.filter((route) => route.packId === legacy.id) },
    encounterProof,
  });
}
const selected = (value) =>
  value.encounterProof.routes.find(
    (route) =>
      route.variant === 'ordinary' &&
      route.classId === 'interceptor' &&
      route.turnPolicy === 'immediate',
  );
const verify = (value) => verifyExpansionProofs(value);

test('aggregate coverage is exactly 32 existing plus two Sentinel map-policy outcomes, with old bytes preserved', async () => {
  assert.equal(sha(bytes), originalSHA);
  assert.equal(proof.routes.length, 32);
  const result = await verifyExpansionRoutes();
  assert.equal(result.verified, 34);
  assert.deepEqual(
    result.results.slice(0, 32),
    proof.routes.map((route) => route.expected),
  );
  assert.deepEqual(
    result.results
      .slice(32)
      .map((value) => [value.levelId, value.turnPolicy, value.classId, value.ruleset]),
    [
      ['sentinel-relay-01', 'immediate', 'interceptor', 'xonix-core.v3'],
      ['sentinel-relay-01', 'grid-center', 'interceptor', 'xonix-core.v3'],
    ],
  );
  assert.equal(sha(await readFile(legacyURL)), originalSHA);
});
test('exact indexed identities reject missing, duplicate, unknown and unsupported legacy policy entries', () => {
  for (const change of [
    (value) => {
      value.proof.routes.pop();
    },
    (value) => {
      value.proof.routes[1] = structuredClone(value.proof.routes[0]);
    },
    (value) => {
      value.proof.routes[0].packId = 'unknown-pack';
    },
    (value) => {
      value.proof.routes[0].levelId = 'unknown-map';
    },
    (value) => {
      value.proof.routes[0].turnPolicy = 'diagonal';
    },
    (value) => {
      value.proof.routes[0].expected.ruleset = 'xonix-core.v3';
    },
  ]) {
    const input = fixture();
    change(input);
    assert.throws(() => verify(input));
  }
});
test('legacy adapter rejects releases or unknown commands that replayProof cannot account for', () => {
  for (const change of [
    (route) => {
      route.releaseAfter = true;
    },
    (route) => {
      route.segments[0].releaseBefore = true;
    },
    (route) => {
      route.segments[0].input.explode = true;
    },
    (route) => {
      route.segments[0].input.direction = 'diagonal';
    },
  ]) {
    const input = fixture();
    change(input.proof.routes[0]);
    assert.throws(() => verify(input), /release|Input|direction/);
  }
});
test('Sentinel selection cannot substitute extra demonstrations for a missing ordinary Interceptor policy', () => {
  const missing = fixture();
  missing.encounterProof.routes = missing.encounterProof.routes.filter(
    (route) => route !== selected(missing),
  );
  assert.throws(() => verify(missing), /Incomplete/);
  const duplicate = fixture();
  duplicate.encounterProof.routes.push(structuredClone(selected(duplicate)));
  assert.throws(() => verify(duplicate), /Duplicate/);
  for (const change of [
    (route) => {
      route.variant = 'unknown';
    },
    (route) => {
      route.classId = 'unknown';
    },
    (route) => {
      route.turnPolicy = 'unknown';
    },
    (route) => {
      route.levelId = 'unknown';
    },
    (route) => {
      route.id = 'made-up-identity';
    },
  ]) {
    const input = fixture();
    change(selected(input));
    assert.throws(() => verify(input), /identity/);
  }
});
test('separate proof format, pack, campaign, level and roster identities are mandatory', () => {
  for (const field of [
    'format',
    'packId',
    'packVersion',
    'packSha256',
    'campaignKey',
    'levelSha256',
    'classesSha256',
  ]) {
    const input = fixture();
    input.encounterProof[field] = 'wrong';
    assert.throws(() => verify(input));
  }
  const missing = fixture();
  missing.encounterProof = null;
  assert.throws(() => verify(missing), /Incomplete/);
  const unknown = fixture();
  unknown.packs = [legacy];
  assert.throws(() => verify(unknown), /unknown encounter/);
});
test('selected version, commands, summary and checkpoint tampering cannot pass normal reconstruction', () => {
  for (const change of [
    (route) => {
      route.expected.ruleset = 'xonix-core.v2';
    },
    (route) => {
      route.checkpoint.algorithm = 'fnv1a64-state-v2';
    },
    (route) => {
      route.segments[0].input.direction = 'down';
    },
    (route) => {
      route.expected.score += 1;
    },
    (route) => {
      route.checkpoint.sections.encounter = '0000000000000000';
    },
    (route) => {
      route.releaseAfter = 'true';
    },
  ]) {
    const input = fixture();
    change(selected(input));
    assert.throws(() => verify(input));
  }
});
test('selected new proof processes explicit release markers instead of silently dropping them', () => {
  const input = fixture(),
    route = selected(input),
    level = sentinel.campaigns[0].levels[0];
  const options = {
    seed: route.seed,
    classId: route.classId,
    turnPolicy: route.turnPolicy,
    classRecipes: sentinel.classRecipes,
  };
  const run = createRun(level, options),
    recorder = createRecorder(level, options, 'release-proof');
  for (const segment of route.segments) {
    releaseInputs(run);
    recordRelease(recorder);
    const command = { ...segment.input, action: true };
    for (let i = 0; i < segment.ticks; i++) {
      stepRun(run, command, FIXED_DT);
      recordInput(recorder, command);
    }
  }
  releaseInputs(run);
  recordRelease(recorder);
  const released = exportReplay(recorder, run);
  assert.notEqual(released.checkpoint.hash, route.checkpoint.hash);
  route.segments = released.segments;
  route.releaseAfter = released.releaseAfter;
  route.checkpoint = released.checkpoint;
  route.expected = released.summary;
  assert.equal(verify(input).verified, input.proof.routes.length + 2);
  // Ignoring releases leaves the ability latch held: the same summary now has a different checkpoint.
  for (const segment of route.segments) segment.releaseBefore = false;
  assert.throws(() => verify(input), /Encounter result changed/);
});
test('an additional indexed encounter cannot be silently skipped by a count-only assertion', () => {
  const input = fixture(),
    extra = structuredClone(sentinel);
  extra.id = 'second-sentinel';
  extra.campaigns[0].id = 'second-sentinel';
  input.packs.push(extra);
  assert.throws(() => verify(input), /Incomplete/);
});
test('injected proof snapshots reject executable accessors, unknown fields and malformed structures', () => {
  const input = fixture();
  let reads = 0;
  Object.defineProperty(input, 'proof', {
    enumerable: true,
    get() {
      reads++;
      return proof;
    },
  });
  assert.throws(() => verify(input), /accessors/);
  assert.equal(reads, 0);
  const unknown = fixture();
  unknown.execute = 'script()';
  assert.throws(() => verify(unknown), /not supported/);
  const malformed = fixture();
  selected(malformed).segments = null;
  assert.throws(() => verify(malformed));
});
test('discovery guard refuses staged generation before its writer, without running --discover', async () => {
  assert.throws(() => assertDiscoverySupported(packs), /Staged encounter discovery is unsupported/);
  assert.doesNotThrow(() => assertDiscoverySupported([legacy]));
  assert.equal(sha(await readFile(legacyURL)), originalSHA);
});
