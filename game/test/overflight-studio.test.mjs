import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OVERFLIGHT_SOLDIERS,
  OVERFLIGHT_MACHINERY,
  OVERFLIGHT_MODULES,
  compileOverflightProject,
  createOverflightProject,
} from '../overflight/project.mjs';
import { actorDefinition } from '../hunt/actor-catalog.mjs';
import { overflightBuildItems } from '../overflight/upgrades.mjs';
import {
  overflightFamilyOptions,
  overflightModuleLabel,
  toggleOverflightFamily,
} from '../studio/overflight-labels.mjs';

test('Creator enemy names cover the accepted closure and reuse the shared actor catalogue in both languages', () => {
  for (const locale of ['en', 'uk']) {
    const choices = overflightFamilyOptions(locale);
    assert.deepEqual(
      choices.map((entry) => entry.id),
      [...OVERFLIGHT_SOLDIERS, ...OVERFLIGHT_MACHINERY],
    );
    for (const { id, name } of choices) {
      assert.ok(name && name !== id);
      if (locale === 'uk') assert.match(name, /[А-ЯІЇЄҐа-яіїєґ]/u);
      if (OVERFLIGHT_SOLDIERS.includes(id)) assert.equal(name, actorDefinition(id).name[locale]);
    }
  }
});

test('Creator module names are identical to native rank-one upgrade names', () => {
  for (const id of OVERFLIGHT_MODULES) {
    const item = overflightBuildItems({
      primary: { rank: 1, branch: null, evolved: false },
      combat: ['slow-field', 'proximity-pulse', 'side-burst'].includes(id) ? [{ id, rank: 1 }] : [],
      support: ['scanner', 'shield'].includes(id) ? { id, rank: 1 } : null,
    }).find((entry) => entry.id === id);
    for (const locale of ['en', 'uk'])
      assert.equal(overflightModuleLabel(id, locale), item.title[locale]);
  }
  assert.throws(() => overflightModuleLabel('unknown'));
});

test('family selection preserves authored ordering and remains compiler checked', () => {
  const original = ['runner', 'patroller'];
  assert.deepEqual(toggleOverflightFamily(original, 'guard', true), [
    'runner',
    'patroller',
    'guard',
  ]);
  assert.deepEqual(toggleOverflightFamily(original, 'runner', true), original);
  assert.deepEqual(toggleOverflightFamily(original, 'runner', false), ['patroller']);
  assert.deepEqual(original, ['runner', 'patroller']);
  assert.throws(() => toggleOverflightFamily(original, 'unknown', true));
  const project = createOverflightProject();
  project.encounters[0].families = [];
  assert.throws(() => compileOverflightProject(project));
});
