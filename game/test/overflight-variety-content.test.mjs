import test from 'node:test';
import assert from 'node:assert/strict';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import { createOverflightPackage, createOverflightLibrary } from '../overflight/community.mjs';
import {
  createOverflightHuntPackage,
  createOverflightHuntLibrary,
} from '../overflight/raid-community.mjs';
import {
  createOverflightCombatProfile,
  validateOverflightCombatProfile,
} from '../overflight/combat-profile.mjs';
import { upgradeOverflightProjectCopy } from '../overflight/project-upgrade.mjs';
import { inspectCommunityPackage } from '../community/package-family.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { overflightCombatEditor } from '../studio/overflight-combat-editor.mjs';

test('Creator exposes only combat controls used by the selected operation', () => {
  for (const hunt of [false, true]) {
    const project = hunt ? createOverflightHuntProject() : createOverflightProject();
    const editor = overflightCombatEditor({
      document: new Document(),
      project,
      locale: 'en',
      onChange() {},
    });
    const labels = editor.children[1].children.map((label) => label.textContent);
    assert.ok(labels.includes('Facing commitment (s)'));
    assert.ok(labels.includes('Minimum warning (s)'));
    assert.ok(labels.includes('Exposed recovery (s)'));
    assert.ok(labels.includes('Guards per supply case'));
    for (const label of [
      'Guard integrity',
      'Frontal absorption',
      'Armor share of total durability',
      'Exposed damage multiplier',
      'Formation relief (s)',
    ])
      assert.equal(labels.includes(label), !hunt, label);
  }
});

test('shared combat admission protects warning/recovery floors and rejects executable or unknown capabilities', () => {
  assert.equal(
    validateOverflightCombatProfile(createOverflightCombatProfile()).pacing.reliefSeconds,
    8,
  );
  assert.equal(createOverflightCombatProfile('veteran').pacing.reliefSeconds, 5);
  for (const alter of [
    (p) => (p.attacks.warningSeconds = 0.99),
    (p) => (p.attacks.priorityLimit = 3),
    (p) => (p.machinery.exposureSeconds = 2),
    (p) => (p.guard.absorption = 1),
    (p) => (p.supplies.guardCount = 1000),
    (p) => (p.supplies.enabled = 'true'),
    (p) => (p.pacing.reliefSeconds = Infinity),
    (p) => (p.script = 'run()'),
    (p) => delete p.guard,
  ]) {
    const profile = createOverflightCombatProfile();
    alter(profile);
    assert.throws(() => validateOverflightCombatProfile(profile));
  }
});

for (const hunt of [false, true]) {
  const create = hunt ? createOverflightHuntProject : createOverflightProject;
  const compile = hunt ? compileOverflightHuntProject : compileOverflightProject;
  const packageOf = hunt ? createOverflightHuntPackage : createOverflightPackage;
  const libraryOf = hunt ? createOverflightHuntLibrary : createOverflightLibrary;
  test(`${hunt ? 'Raid' : 'Survivor'} author upgrade preserves legacy source and reproduces revised content in a fresh profile`, async (t) => {
    const legacy = create({ legacy: true });
    legacy.props[0].x += 25;
    const original = JSON.stringify(legacy),
      oldCompiled = compile(legacy);
    const revised = upgradeOverflightProjectCopy(legacy, { hunt, difficulty: 'veteran' });
    revised.combat.guard.integrity = 80;
    revised.combat.supplies.repairHull = 25;
    assert.equal(JSON.stringify(legacy), original);
    assert.equal(oldCompiled.rulesVersion, 1);
    assert.deepEqual(revised.encounters, legacy.encounters);
    assert.deepEqual(revised.props, legacy.props);
    assert.equal(compile(revised).rulesVersion, 2);
    assert.notEqual(compile(revised).projectIdentity, oldCompiled.projectIdentity);
    const encoded = new Blob([JSON.stringify(packageOf(revised))], { type: 'application/json' });
    const admitted = await inspectCommunityPackage(encoded);
    const profile = libraryOf({ indexedDB: managedIndexedDB().indexedDB });
    t.after(() => profile.dispose());
    const revisedId = await profile.install(admitted.pack);
    const legacyId = await profile.install(packageOf(legacy));
    assert.notEqual(revisedId, legacyId);
    assert.deepEqual(compile((await profile.load(revisedId)).project), compile(revised));
    assert.deepEqual(compile((await profile.load(legacyId)).project), oldCompiled);
    const fresh = libraryOf({ indexedDB: managedIndexedDB().indexedDB });
    t.after(() => fresh.dispose());
    const exported = packageOf((await profile.load(revisedId)).project);
    assert.equal(await fresh.install(JSON.parse(JSON.stringify(exported))), revisedId);
    assert.deepEqual(compile((await fresh.load(revisedId)).project), compile(revised));
  });
}
