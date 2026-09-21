import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const late = new URL('../../scripts/probe-late-journey-pressure.mjs', import.meta.url);
const spatial = new URL('../../scripts/probe-relay-fracture-pressure.mjs', import.meta.url);
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
