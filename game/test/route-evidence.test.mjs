import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { createWholeSortingCandidates } from '../content-design/whole-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import {
  ROUTE_EVIDENCE_FORMAT,
  ROUTE_EVIDENCE_MAX_ABSOLUTE_ERROR,
  ROUTE_EVIDENCE_PATHS,
  expectedRouteEvidence,
  routeEvidenceCheckpoint,
  assertRouteEvidence,
} from './helpers/route-evidence.mjs';

const project = compileContentProject(createWholeSortingCandidates({ artwork: true }));
const fixture = () => createRun(resolveMission(project, 'dnipro-crossings').level, { seed: 1 });
const witness = (run, paths) => routeEvidenceCheckpoint(run, paths);

test('route evidence uses only explicit finite scalar exceptions without mutating typed state or runtime hashes', () => {
  const run = fixture(),
    before = structuredClone(run),
    raw = authoritativeCheckpoint(run);
  const expected = witness(run, ['enemies[0].vx']);
  const changed = structuredClone(run);
  changed.enemies[0].vx += 5e-13;
  assert.notDeepEqual(authoritativeCheckpoint(changed), raw);
  assertRouteEvidence(changed, expected);
  assert.deepEqual(structuredClone(run), before);
  assert.equal(Object.getPrototypeOf(run._loadouts), null);
  assert(run.cells instanceof Uint8Array);
  assert(run.classic.terrain instanceof Uint8Array);
  assert(run.classic.eligible instanceof Uint8Array);
  assert(run.classic.everClaimed instanceof Uint8Array);
  assert(run.foundation.permanent instanceof Uint8Array);
  assert.deepEqual(authoritativeCheckpoint(run), raw);
  assert.throws(() => assertRouteEvidence(changed, witness(run, [])));
});

test('route evidence validates format, tolerance, allowed paths and required witness', () => {
  const evidence = {
    format: ROUTE_EVIDENCE_FORMAT,
    maxAbsoluteError: ROUTE_EVIDENCE_MAX_ABSOLUTE_ERROR,
    paths: [...ROUTE_EVIDENCE_PATHS],
    checkpoints: { sample: witness(fixture(), []) },
  };
  assert.equal(expectedRouteEvidence(evidence, 'sample'), evidence.checkpoints.sample);
  for (const patch of [
    { format: 'other' },
    { maxAbsoluteError: 1e-9 },
    { paths: ['time'] },
    { checkpoints: {} },
  ])
    assert.throws(() => expectedRouteEvidence({ ...evidence, ...patch }, 'sample'));
  const run = fixture();
  for (const paths of [
    ['score'],
    ['player.speed'],
    ['enemies[0].slowUntil'],
    ['time', 'time'],
    ['enemies[999].x'],
    ['result.time'],
  ])
    assert.throws(() => witness(run, paths));
  for (const value of [NaN, Infinity, -Infinity, '0', null, undefined]) {
    const changed = structuredClone(run);
    changed.enemies[0].vx = value;
    assert.throws(() => witness(changed, ['enemies[0].vx']));
    const expected = witness(run, ['enemies[0].vx']);
    expected.scalars[0].value = value;
    assert.throws(() => assertRouteEvidence(run, expected));
  }
  const extra = witness(run, ['enemies[0].vx']);
  extra.scalars[0].tolerance = 1;
  assert.throws(() => assertRouteEvidence(run, extra));
  const duplicate = witness(run, ['enemies[0].vx']);
  duplicate.scalars.push({ ...duplicate.scalars[0] });
  assert.throws(() => assertRouteEvidence(run, duplicate));
  const missing = structuredClone(run);
  delete missing.enemies[0].vx;
  assert.throws(() => witness(missing, ['enemies[0].vx']));
});

for (const [name, change] of [
  [
    'level identity',
    (r) => {
      r.levelId += '-changed';
    },
  ],
  [
    'revision',
    (r) => {
      r.revision += '-changed';
    },
  ],
  [
    'status',
    (r) => {
      r.status = 'lost';
    },
  ],
  [
    'tick',
    (r) => {
      r.tick++;
    },
  ],
  [
    'unlisted elapsed time',
    (r) => {
      r.time += 1e-14;
    },
  ],
  [
    'lives',
    (r) => {
      r.lives--;
    },
  ],
  [
    'score',
    (r) => {
      r.score++;
    },
  ],
  [
    'board cells',
    (r) => {
      r.cells[0] ^= 1;
    },
  ],
  [
    'coverage',
    (r) => {
      r.coverage += 0.0001;
    },
  ],
  [
    'player direction',
    (r) => {
      r.player.direction = 'left';
    },
  ],
  [
    'player cutting',
    (r) => {
      r.player.cutting = !r.player.cutting;
    },
  ],
  [
    'actor inventory',
    (r) => {
      r.enemies.pop();
    },
  ],
  [
    'actor identity',
    (r) => {
      r.enemies[0].id += '-changed';
    },
  ],
  [
    'goal',
    (r) => {
      r.level.goal.coverage += 0.01;
    },
  ],
  [
    'cooldown',
    (r) => {
      r.ability.cooldownUntil += 1e-14;
    },
  ],
  [
    'unlisted enemy coordinate',
    (r) => {
      r.enemies[0].x += 5e-13;
    },
  ],
])
  test(`route evidence retains exact ${name}`, () => {
    const run = fixture(),
      expected = witness(run, ['enemies[0].vx']),
      changed = structuredClone(run);
    change(changed);
    assert.throws(() => assertRouteEvidence(changed, expected));
  });

for (const path of [
  'player.x',
  'player.y',
  'enemies[0].x',
  'enemies[0].y',
  'enemies[0].vx',
  'enemies[0].vy',
  'enemies[2].perimeter',
  'classic.actorTime',
  'time',
  'result.time',
])
  test(`route evidence bounds only the declared ${path} scalar`, () => {
    const run = fixture();
    // A terminal elapsed time is the only additional clock exception in Dnipro's
    // witnessed ending; no status, score or result field is generally ignored.
    run.result = { time: run.time, score: run.score };
    const expected = witness(run, [path]),
      changed = structuredClone(run);
    const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.'),
      key = parts.pop();
    let owner = changed;
    for (const part of parts) owner = owner[part];
    owner[key] += 5e-13;
    assertRouteEvidence(changed, expected);
    owner[key] += 1e-9;
    assert.throws(() => assertRouteEvidence(changed, expected));
    const unlisted = structuredClone(run);
    unlisted.result.score++;
    assert.throws(() => assertRouteEvidence(unlisted, expected));
  });
