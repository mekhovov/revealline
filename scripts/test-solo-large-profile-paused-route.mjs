import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { validateQualification } from './solo-qualification.mjs';

const root = new URL('../docs/performance/fixtures/solo-remote-supplemental/', import.meta.url);
const originalBytes = await readFile(new URL('large-profile.qualification.fixture', root));
assert.equal(originalBytes.length, 4804);
assert.equal(
  createHash('sha256').update(originalBytes).digest('hex'),
  '228647a8fbceaf368872adecc8ee88c6b4fc57f55567ea9d8ea79ef4ee87f30e',
  'The executed original recipe remains immutable.',
);
const original = JSON.parse(originalBytes);
const proposed = JSON.parse(
  await readFile(new URL('large-profile-paused-settings-route.qualification.fixture', root)),
);
function assertRoute(recipe) {
  validateQualification(recipe);
  const expected = structuredClone(original);
  expected.id = 'large-profile-public-import-and-reload-paused-settings-route-v2';
  expected.actions = original.actions.flatMap((action, index) => {
    if ([4, 17].includes(index)) return [{ type: 'click', selector: '#overlay-settings' }];
    if ([5, 18].includes(index)) return [];
    if (index === 24)
      return [
        {
          type: 'expect',
          selector: 'body:not(:has(dialog[open])) #start-button',
          timeoutMs: 30000,
        },
      ];
    return [action];
  });
  assert.deepEqual(recipe, expected, 'Only the reviewed Settings route may change.');
}

test('separate paused Settings fixture preserves every import, reload, input and replay requirement', async () => {
  assertRoute(proposed);
  const profile = await readFile(new URL('large-profile.library.fixture', root));
  assert.equal(profile.length, 2788121);
  assert.equal(
    createHash('sha256').update(profile).digest('hex'),
    'a71209967e8c3e3b687a0488075d59301a7adea62ea43fa60eba7a83d7df4e07',
  );
  assert.equal(proposed.timeoutMs, 360000);
  assert.equal(proposed.actions.filter((a) => a.selector === '#overlay-settings').length, 2);
  assert.equal(proposed.actions.filter((a) => a.type === 'reload').length, 1);
  const repeat = proposed.actions.find((a) => a.type === 'repeat');
  assert.equal(repeat.count * repeat.actions.length, 60);
  assert.deepEqual(proposed.actions.at(-1), { type: 'exportReplay' });
  assert.deepEqual(proposed.expectedReplayDefinition, original.expectedReplayDefinition);
});

test('route control rejects changed deadlines, automatic-pause bypasses and weakened replay or import', () => {
  for (const change of [
    (p) => p.timeoutMs++,
    (p) => (p.id = original.id),
    (p) => (p.actions[2].optional = true),
    (p) => (p.actions[2].selector = '#start-button'),
    (p) => p.actions.splice(2, 1),
    (p) => (p.actions.find((a) => a.type === 'upload').file = 'other.json'),
    (p) => (p.actions.find((a) => a.contains === '480').contains = '0'),
    (p) => (p.actions.find((a) => a.type === 'reload').timeoutMs = 120001),
    (p) => (p.actions.find((a) => a.selector?.startsWith('body:not')).selector = '#start-button'),
    (p) => (p.actions.find((a) => a.selector?.startsWith('body:not')).timeoutMs = 60000),
    (p) => (p.actions.find((a) => a.type === 'repeat').count = 1),
    (p) => p.actions.pop(),
    (p) => delete p.expectedReplayDefinition,
  ]) {
    const recipe = structuredClone(proposed);
    change(recipe);
    assert.throws(() => assertRoute(recipe));
  }
});
