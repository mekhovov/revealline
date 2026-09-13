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
const wideURL = new URL('../game/replays/first-light-routes.json', import.meta.url),
  wideBytes = await readFile(wideURL),
  wideProof = JSON.parse(wideBytes);
const r2URL = new URL('../game/replays/fpv-arcade-r2-routes.json', import.meta.url),
  r2Bytes = await readFile(r2URL),
  r2Proof = JSON.parse(r2Bytes);
const r3Proof = JSON.parse(
  await readFile(new URL('../game/replays/fpv-arcade-r3-routes.json', import.meta.url)),
);
const impactDemo = JSON.parse(
  await readFile(new URL('../game/content/scenarios/line-impact-demo.json', import.meta.url)),
);
const packs = await expansionSources(),
  sentinel = packs.find((pack) => pack.id === encounterProof.packId),
  legacy = packs.find((pack) => pack.id === proof.routes[0].packId);
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

test('aggregate coverage preserves 32 existing and two Sentinel outcomes, then verifies six wide plus six R2 and six R3 Standard outcomes with twelve separate Gentle outcomes', async () => {
  assert.equal(sha(bytes), originalSHA);
  assert.equal(proof.routes.length, 32);
  const result = await verifyExpansionRoutes();
  assert.equal(result.verified, 52);
  assert.equal(result.supplementalGentleVerified, 12);
  assert.deepEqual(
    result.results.slice(0, 32),
    proof.routes.map((route) => route.expected),
  );
  assert.deepEqual(
    result.results
      .slice(32, 34)
      .map((value) => [value.levelId, value.turnPolicy, value.classId, value.ruleset]),
    [
      ['sentinel-relay-01', 'immediate', 'interceptor', 'xonix-core.v3'],
      ['sentinel-relay-01', 'grid-center', 'interceptor', 'xonix-core.v3'],
    ],
  );
  assert.deepEqual(
    result.results.slice(34, 40),
    wideProof.routes.map((route) => route.expected),
  );
  assert.deepEqual(
    result.results.slice(40, 46),
    r2Proof.routes
      .filter((route) => route.difficulty === 'standard')
      .map((route) => route.expected),
  );
  assert.deepEqual(
    result.supplementalGentleResults.slice(0, 6),
    r2Proof.routes.filter((route) => route.difficulty === 'gentle').map((route) => route.expected),
  );
  assert.deepEqual(
    result.results.slice(46),
    r3Proof.routes.filter((r) => r.difficulty === 'standard').map((r) => r.expected),
  );
  assert.deepEqual(
    result.supplementalGentleResults.slice(6),
    r3Proof.routes.filter((r) => r.difficulty === 'gentle').map((r) => r.expected),
  );
  assert.equal(result.impactDemonstrations.length, 4);
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

function wideFixture() {
  return structuredClone({
    packs: [packs.find((pack) => pack.id === 'fpv-arcade')],
    proof: { ...proof, routes: [] },
    encounterProof: null,
    wideProof,
  });
}
test('wide proof is optional for old contexts and required for every indexed wide outcome', () => {
  const old = fixture();
  assert.equal(verify(old).verified, old.proof.routes.length + 2);
  old.wideProof = null;
  assert.equal(verify(old).verified, old.proof.routes.length + 2);
  for (const remove of [
    (input) => {
      delete input.wideProof;
    },
    (input) => {
      input.wideProof = null;
    },
    (input) => {
      input.wideProof.routes.pop();
    },
    (input) => {
      input.wideProof.routes[1] = structuredClone(input.wideProof.routes[0]);
    },
  ]) {
    const input = wideFixture();
    remove(input);
    assert.throws(() => verify(input), /Incomplete|wide route list|Duplicate proof/);
  }
});
test('wide proof binds its exact pack, campaign, map and effective roster', () => {
  for (const field of [
    'format',
    'packId',
    'packVersion',
    'packSha256',
    'campaignId',
    'campaignKey',
  ]) {
    const input = wideFixture();
    input.wideProof[field] = 'wrong';
    assert.throws(() => verify(input), /wide proof|Wide proof/);
  }
  for (const field of ['levelId', 'turnPolicy', 'levelSha256', 'classesSha256']) {
    const input = wideFixture();
    input.wideProof.routes[0][field] = 'wrong';
    assert.throws(() => verify(input), /Unknown expansion|Wide proof/);
  }
  const changed = wideFixture();
  changed.packs[0].campaigns[0].levels[0].rules.moveSpeed += 1;
  assert.throws(() => verify(changed), /content identity changed/);
});
test('wide proof reconstructs commands, summary and every checkpoint rather than trusting won flags', () => {
  for (const change of [
    (route) => {
      route.expected.score += 1;
    },
    (route) => {
      route.expected.tick += 1;
    },
    (route) => {
      route.expected.ruleset = 'xonix-core.v3';
    },
    (route) => {
      route.expected.classId = 'interceptor';
    },
    (route) => {
      route.expected.seed = 2;
    },
    (route) => {
      route.checkpoint.algorithm = 'fnv1a64-state-v3';
    },
    (route) => {
      route.checkpoint.sections.board = '0000000000000000';
    },
    (route) => {
      route.checkpoint.hash = '0000000000000000';
    },
    (route) => {
      route.segments[0].input.direction = 'left';
    },
  ]) {
    const input = wideFixture();
    change(input.wideProof.routes[0]);
    assert.throws(() => verify(input));
  }
});
test('wide Arcade proof cannot silently discard releases, malformed inputs or time segments', () => {
  for (const change of [
    (route) => {
      route.releaseAfter = true;
    },
    (route) => {
      route.segments[0].releaseBefore = true;
    },
    (route) => {
      route.segments[0].input.direction = null;
    },
    (route) => {
      route.segments[0].input.explode = true;
    },
    (route) => {
      route.segments[0].ticks = 0;
    },
    (route) => {
      route.segments[0].ticks = 0.5;
    },
    (route) => {
      route.segments[0].ticks = 216001;
    },
  ]) {
    const input = wideFixture();
    change(input.wideProof.routes[0]);
    assert.throws(() => verify(input));
  }
});
test('wide proof coverage cannot hide another indexed campaign or substitute legacy proof authority', () => {
  const extra = wideFixture(),
    pack = structuredClone(extra.packs[0]);
  pack.id = 'other-wide-pack';
  pack.campaigns[0].id = 'other-wide-campaign';
  extra.packs.push(pack);
  assert.throws(() => verify(extra), /Incomplete/);
  const oldAsWide = wideFixture();
  oldAsWide.wideProof.routes[0].expected = proof.routes[0].expected;
  assert.throws(() => verify(oldAsWide), /Wide expected identity differs/);
  const noPack = wideFixture();
  noPack.packs = [];
  assert.throws(() => verify(noPack), /unknown wide proof/);
  assert.throws(() => assertDiscoverySupported(wideFixture().packs), /discovery is unsupported/);
});
test('wide proof snapshots own data without invoking nested accessors or changing any proof bytes', async () => {
  const input = wideFixture(),
    before = structuredClone(input);
  const result = verify(input);
  assert.equal(result.verified, 6);
  assert.deepEqual(input, before);
  let reads = 0;
  Object.defineProperty(input.wideProof.routes[0], 'segments', {
    enumerable: true,
    get() {
      reads++;
      return [];
    },
  });
  assert.throws(() => verify(input), /accessors/);
  assert.equal(reads, 0);
  assert.deepEqual(await readFile(wideURL), wideBytes);
  assert.equal(sha(await readFile(legacyURL)), originalSHA);
});

function r2Fixture() {
  return structuredClone({
    packs: packs.filter((pack) => ['fpv-arcade', 'fpv-arcade-r2'].includes(pack.id)),
    proof: { ...proof, routes: [] },
    encounterProof: null,
    wideProof,
    r2Proof,
  });
}
test('R2 is optional for historical contexts but requires all twelve exact outcomes when indexed', () => {
  const historical = wideFixture();
  historical.r2Proof = null;
  assert.equal(verify(historical).verified, 6);
  for (const change of [
    (input) => {
      delete input.r2Proof;
    },
    (input) => {
      input.r2Proof = null;
    },
    (input) => {
      input.r2Proof.routes.pop();
    },
    (input) => {
      input.r2Proof.routes[7] = structuredClone(input.r2Proof.routes[6]);
    },
    (input) => {
      input.r2Proof.routes = input.r2Proof.routes.filter(
        (route) => route.difficulty === 'standard',
      );
    },
  ]) {
    const input = r2Fixture();
    change(input);
    assert.throws(() => verify(input));
  }
});
test('R2 aggregate rechecks Gentle commands, stop barriers, summaries and complete checkpoint authority', () => {
  for (const change of [
    (input) => {
      input.r2Proof.packSha256 = 'foreign';
    },
    (input) => {
      input.r2Proof.routes[6].campaignKey = 'foreign';
    },
    (input) => {
      input.r2Proof.routes[6].expected.score++;
    },
    (input) => {
      input.r2Proof.routes[6].checkpoint.hash = 'forged';
    },
    (input) => {
      const segments = input.r2Proof.routes[6].segments;
      segments.splice(
        segments.findIndex((segment) => segment.input.direction === null),
        1,
      );
    },
    (input) => {
      input.r2Proof.controls[0].straight.summary.won = true;
    },
  ]) {
    const input = r2Fixture();
    change(input);
    assert.throws(() => verify(input));
  }
});
test('R2 coverage cannot hide another classic campaign or fall back to a proof from an absent original edition', () => {
  const extra = r2Fixture(),
    pack = structuredClone(extra.packs.find((item) => item.id === 'fpv-arcade-r2'));
  pack.id = 'another-classic';
  pack.campaigns[0].id = 'another-classic';
  extra.packs.push(pack);
  assert.throws(() => verify(extra), /Incomplete/);
  const missing = r2Fixture();
  missing.packs = missing.packs.filter((item) => item.id !== 'fpv-arcade');
  missing.wideProof = null;
  assert.throws(() => verify(missing), /R2 proof context/);
  assert.throws(() => assertDiscoverySupported(r2Fixture().packs), /discovery is unsupported/);
});
test('R2 aggregate owns hostile input without invoking accessors or editing historical proof bytes', async () => {
  const input = r2Fixture(),
    before = structuredClone(input);
  const result = verify(input);
  assert.equal(result.verified, 12);
  assert.equal(result.supplementalGentleVerified, 6);
  assert.deepEqual(input, before);
  let reads = 0;
  Object.defineProperty(input.r2Proof.routes[0], 'segments', {
    enumerable: true,
    get() {
      reads++;
      return [];
    },
  });
  assert.throws(() => verify(input), /accessors/);
  assert.equal(reads, 0);
  assert.deepEqual(await readFile(r2URL), r2Bytes);
  assert.deepEqual(await readFile(wideURL), wideBytes);
  assert.equal(sha(await readFile(legacyURL)), originalSHA);
});

function r3Fixture() {
  return {
    ...r2Fixture(),
    packs: packs.filter((p) => ['fpv-arcade', 'fpv-arcade-r2', 'fpv-arcade-r3'].includes(p.id)),
    r3Proof: structuredClone(r3Proof),
    impactDemo: structuredClone(impactDemo),
  };
}
test('indexed R3 cannot omit or borrow proof and demo authority', () => {
  for (const change of [
    (p) => {
      delete p.r3Proof;
      delete p.impactDemo;
    },
    (p) => {
      p.r3Proof.routes.pop();
    },
    (p) => {
      p.r3Proof.routes[1] = structuredClone(p.r3Proof.routes[0]);
    },
    (p) => {
      p.r3Proof.demoSha256 = 'wrong';
    },
    (p) => {
      p.impactDemo.level.classic.lineImpact.speed++;
    },
    (p) => {
      p.r3Proof.routes[0].expected.score++;
    },
    (p) => {
      p.r3Proof.routes[0].checkpoint.hash = 'wrong';
    },
  ]) {
    const input = r3Fixture();
    change(input);
    assert.throws(() => verify(input));
  }
});
test('unrecognized extra classic campaign cannot hide behind the R3 outcome count', () => {
  const input = r3Fixture(),
    extra = structuredClone(input.packs.find((p) => p.id === 'fpv-arcade-r3'));
  extra.id = 'foreign-impact-pack';
  extra.campaigns[0].id = 'foreign-impact-campaign';
  input.packs.push(extra);
  assert.throws(() => verify(input), /Incomplete/);
});
