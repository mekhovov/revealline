import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const late = new URL('../../scripts/probe-late-journey-pressure.mjs', import.meta.url);
const spatial = new URL('../../scripts/probe-relay-fracture-pressure.mjs', import.meta.url);
const district = new URL('../../scripts/probe-fracture-spatial.mjs', import.meta.url);
const field = new URL('../../scripts/probe-apex-field.mjs', import.meta.url);
const fixture = new URL('./fixtures/late-journey-pressure-routes.json', import.meta.url);
const run = (cli, ...args) =>
  spawnSync(process.execPath, [cli.pathname, ...args], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    timeout: 30000,
  });

test('shared offline probe resumes only a matching public-input/checkpoint prefix', () => {
  const row = JSON.parse(readFileSync(fixture, 'utf8')).rows[0];
  const result = run(
    late,
    row.id,
    row.difficulty,
    row.turnPolicy,
    `--resume=${fixture.pathname}`,
    '--max-ms=1000',
  );
  assert.equal(result.status, 0, result.stderr);
  const actual = JSON.parse(result.stdout);
  for (const field of [
    'id',
    'difficulty',
    'turnPolicy',
    'status',
    'simulationIdentity',
    'ticks',
    'lives',
    'coverage',
    'cuts',
    'checkpoint',
    'events',
    'closures',
    'segments',
  ])
    assert.deepEqual(actual[field], row[field], field);
});

test('targeted hazard probe never treats a completed ordinary prefix as mastery', () => {
  const ordinary = new URL('./fixtures/fracture-spatial-clear-routes.json', import.meta.url);
  const result = run(
    district,
    'two-districts',
    'standard',
    'immediate',
    '--hazard-first',
    `--resume=${ordinary.pathname}`,
    '--max-ms=1000',
  );
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Completed prefix does not meet the requested offline target/);
});

test('no-wait experiment records only the declared initial delay before ordinary public movement', () => {
  const result = run(
    field,
    'home-signal',
    'gentle',
    'immediate',
    '--bent',
    '--teach-opening',
    '--no-wait',
    '--seed=2',
    '--delay=0.5',
    '--max-ms=1000',
  );
  assert.equal(result.status, 0, result.stderr);
  const actual = JSON.parse(result.stdout);
  assert.deepEqual(actual.searchWaitTicks, [0]);
  assert.equal(actual.seed, 2);
  assert.equal(actual.delaySeconds, 0.5);
  assert.deepEqual(actual.segments[0], { direction: null, ticks: 60 });
  assert(actual.segments.slice(1).every((segment) => segment.direction !== null));
  assert.equal(actual.closures[0][0], 162);
  assert(actual.coverage > 0);
  assert.equal(actual.lives, 5);
});

test('no-wait search does not rewrite waits in an immutable completed prefix', () => {
  const existing = new URL('./fixtures/apex-field-clear-routes.json', import.meta.url);
  const row = JSON.parse(readFileSync(existing, 'utf8')).rows.find(
    (r) => r.difficulty === 'expert' && r.turnPolicy === 'immediate',
  );
  assert(row.segments.some((s) => s.direction === null));
  const result = run(
    field,
    row.id,
    row.difficulty,
    row.turnPolicy,
    '--no-wait',
    `--resume=${existing.pathname}`,
    '--max-ms=1000',
  );
  assert.equal(result.status, 0, result.stderr);
  const actual = JSON.parse(result.stdout);
  assert.deepEqual(actual.searchWaitTicks, [0]);
  assert.equal(actual.checkpoint, row.checkpoint);
  assert.deepEqual(actual.segments, row.segments);
});

test('bounded pressure probes reject unsupported missions and invalid input domains', () => {
  for (const [cli, args, message] of [
    [late, ['first-link'], /supported mission/],
    [spatial, ['home-signal'], /supported mission/],
    [spatial, ['first-link', 'impossible'], /Unknown preset/],
    [spatial, ['first-link', 'standard', 'drift'], /Unknown preset/],
    [spatial, ['first-link', '--seed=0'], /positive int32/],
    [spatial, ['first-link', 'standard', 'immediate', '--max-ms=0'], /Budget/],
    [spatial, ['first-link', 'standard', 'immediate', '--delay=11'], /Delay/],
    [
      spatial,
      ['first-link', 'standard', 'immediate', `--resume=${fixture.pathname}`],
      /Missing or stale prefix/,
    ],
  ]) {
    const result = run(cli, ...args);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, message);
  }
});
