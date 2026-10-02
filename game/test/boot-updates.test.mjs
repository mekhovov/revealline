import test from 'node:test';
import assert from 'node:assert/strict';
import { startupUpdateCandidate } from '../boot-updates.mjs';

const page = new URL('https://example.test/revealline/game/');
const metadata = new URL('../app/update.html', page);
const current = { version: '0.142.4', scope: '../', buildId: 'a'.repeat(64) };
const marker = { format: 'revealline-app-update.v1', scope: '../', buildId: 'b'.repeat(64) };

test('startup detects changes by build identity even when the release number is unchanged', () => {
  assert.equal(startupUpdateCandidate(marker, current, page, metadata).available, true);
  assert.equal(
    startupUpdateCandidate({ ...marker, buildId: current.buildId }, current, page, metadata)
      .available,
    false,
  );
  const old = new URL('https://example.test/revealline/releases/v0.142.3/site/game/');
  assert.equal(
    startupUpdateCandidate(marker, current, old, metadata).candidate.scope,
    'https://example.test/revealline/',
  );
});

test('startup metadata cannot select another origin or community or an invalid build', () => {
  for (const change of [
    { scope: 'https://other.test/' },
    { scope: '../editions/other/' },
    { scope: '../?tracking=1' },
    { buildId: 'broken' },
    { format: 'unknown' },
  ])
    assert.throws(() => startupUpdateCandidate({ ...marker, ...change }, current, page, metadata));
});

test('community startup uses its immutable edition pointer even without a build hash', () => {
  const page = new URL(
    'https://example.test/revealline/editions/coupa/releases/v1.0.0/site/game/company.html',
  );
  const metadata = new URL('https://example.test/revealline/editions/coupa/app/current.json');
  const current = { version: '1.0.0', scope: '../', buildId: 'a'.repeat(64) };
  const pointer = { editionId: 'coupa', version: 'v1.0.0', scope: '../releases/v1.0.0/site/' };
  assert.equal(startupUpdateCandidate(pointer, current, page, metadata, true).available, false);
  assert.equal(
    startupUpdateCandidate(
      { ...pointer, version: 'v1.1.0', scope: '../releases/v1.1.0/site/' },
      current,
      page,
      metadata,
      true,
    ).available,
    true,
  );
  assert.throws(() =>
    startupUpdateCandidate({ ...pointer, editionId: 'other' }, current, page, metadata, true),
  );
});
