import test from 'node:test';
import assert from 'node:assert/strict';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import {
  createOverflightRiyProject,
  compileOverflightRiyProject,
} from '../overflight/riy-project.mjs';
import {
  createOverflightPackage,
  createOverflightLibrary,
  exportOverflightPackage,
  importOverflightPackage,
} from '../overflight/community.mjs';
import {
  createOverflightHuntPackage,
  createOverflightHuntLibrary,
  exportOverflightHuntPackage,
  importOverflightHuntPackage,
} from '../overflight/raid-community.mjs';
import {
  createOverflightRiyPackage,
  createOverflightRiyLibrary,
  exportOverflightRiyPackage,
  importOverflightRiyPackage,
} from '../overflight/riy-community.mjs';
import { upgradeOverflightProjectCopy } from '../overflight/project-upgrade.mjs';
import { upgradeOverflightRiyProjectCopy } from '../overflight/riy-project.mjs';
import { inspectCommunityPackage } from '../community/package-family.mjs';
import { createOverflightRun } from '../overflight/core.mjs';
import { createOverflightHuntRun } from '../overflight/raid-core.mjs';
import { overflightCombatEditor } from '../studio/overflight-combat-editor.mjs';
import { overflightAttackLayers } from '../overflight/tactical-view.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const families = [
  [
    'overflight',
    createOverflightProject,
    compileOverflightProject,
    createOverflightPackage,
    createOverflightLibrary,
    exportOverflightPackage,
    importOverflightPackage,
    createOverflightRun,
  ],
  [
    'overflight-hunt',
    createOverflightHuntProject,
    compileOverflightHuntProject,
    createOverflightHuntPackage,
    createOverflightHuntLibrary,
    exportOverflightHuntPackage,
    importOverflightHuntPackage,
    createOverflightHuntRun,
  ],
  [
    'overflight-riy',
    createOverflightRiyProject,
    compileOverflightRiyProject,
    createOverflightRiyPackage,
    createOverflightRiyLibrary,
    exportOverflightRiyPackage,
    importOverflightRiyPackage,
    createOverflightRun,
  ],
];
for (const [
  family,
  create,
  compile,
  packageOf,
  libraryOf,
  exportPackage,
  importPackage,
  start,
] of families) {
  test(`${family} V3 authoring reaches global admission, fresh-profile import and native rules without replacing legacy content`, async (t) => {
    const old = create(),
      original = JSON.stringify(old),
      legacyCompiled = compile(old);
    const project = create({ rulesVersion: 3, difficulty: 'relaxed' });
    project.combat.attacks.warningSeconds = 1.7;
    if (family === 'overflight-riy') project.riy.escorts[0].damage = 19;
    const compiled = compile(project);
    assert.equal(compiled.rulesVersion, 3);
    assert.equal(compiled.balanceRevision, 'overflight-balance.v3');
    assert.equal(legacyCompiled.rulesVersion, 2);
    const bytes = exportPackage(packageOf(project));
    const inspected = await inspectCommunityPackage(bytes);
    assert.equal(inspected.family, family);
    const first = libraryOf({ indexedDB: managedIndexedDB().indexedDB });
    const fresh = libraryOf({ indexedDB: managedIndexedDB().indexedDB });
    t.after(() => {
      first.dispose();
      fresh.dispose();
    });
    const oldId = await first.install(packageOf(old));
    const nextId = await first.install(inspected.pack);
    assert.notEqual(nextId, oldId);
    assert.deepEqual(compile((await first.load(oldId)).project), legacyCompiled);
    const reexported = exportPackage(await first.load(nextId));
    assert.equal(await reexported.text(), await bytes.text());
    const freshId = await fresh.install(await importPackage(reexported));
    const restored = compile((await fresh.load(freshId)).project);
    assert.deepEqual(restored, compiled);
    assert.equal(start(restored).rulesVersion, 3);
    assert.equal(JSON.stringify(old), original);
    const unsupported = structuredClone(inspected.pack);
    unsupported.project.balanceRevision = 'overflight-balance.v99';
    await assert.rejects(inspectCommunityPackage(new Blob([JSON.stringify(unsupported)])));
  });
}

test('Creator exposes bounded V3 controls and keeps legacy projects free of unsupported controls', () => {
  for (const [family, create] of families) {
    for (const rulesVersion of [2, 3]) {
      const project = create({ rulesVersion });
      let changed = 0;
      const editor = overflightCombatEditor({
        document: new Document(),
        project,
        locale: 'en',
        onChange: () => changed++,
      });
      const labels = editor.children[1].children;
      const control = (title) =>
        labels.find((label) => label.textContent.startsWith(title))?.children[0];
      assert.equal(
        !!control('Minimum firing distance'),
        rulesVersion === 3 && family !== 'overflight-hunt',
      );
      assert.equal(
        !!control('Stored Overdrive supply reward'),
        rulesVersion === 3 && family !== 'overflight-hunt',
      );
      const choices = control('Difficulty').children.map((option) => option.value);
      assert.equal(choices.includes('relaxed'), rulesVersion === 3);
      if (rulesVersion === 3 && family !== 'overflight-hunt') {
        const firing = control('Minimum firing distance');
        assert.equal(Number(firing.min), 120);
        assert.equal(Number(firing.max), 220);
        firing.value = '190';
        firing.dispatchEvent({ type: 'input' });
        assert.equal(project.combat.threats.standoffMin, 190);
        assert.equal(changed, 1);
      }
    }
  }
});

test('active ground danger retains a filled geometric distinction from its warning without motion', () => {
  const attack = { kind: 'ground', x: 100, y: 90, radius: 50 };
  const warning = overflightAttackLayers({ ...attack, stage: 'warning' });
  const active = overflightAttackLayers({ ...attack, stage: 'active' });
  assert.deepEqual(active[0], warning[0]);
  assert.equal(warning.length, 1);
  assert.equal(active.length, 7);
  for (const layer of active.slice(1)) {
    assert.ok(layer.width <= 100 && layer.height <= 100);
    assert.equal(layer.frame, 'bar');
  }
});

test('explicit updated copies preserve both legacy revisions and their authored layouts', async () => {
  for (const [family, create, compile, packageOf, , exportPackage, importPackage] of families) {
    for (const legacy of [true, false]) {
      const source = create({ legacy });
      source.props[0].x += 13;
      const before = JSON.stringify(source),
        compiledBefore = compile(source);
      const upgrade =
        family === 'overflight-riy'
          ? upgradeOverflightRiyProjectCopy
          : upgradeOverflightProjectCopy;
      const copy = upgrade(source, {
        rulesVersion: 3,
        hunt: family === 'overflight-hunt',
        difficulty: 'relaxed',
      });
      assert.equal(compile(copy).rulesVersion, 3);
      assert.notEqual(compile(copy).projectIdentity, compiledBefore.projectIdentity);
      assert.deepEqual(copy.encounters, source.encounters);
      assert.deepEqual(copy.props, source.props);
      assert.equal(JSON.stringify(source), before);
      const imported = await importPackage(exportPackage(packageOf(copy)));
      assert.deepEqual(compile(imported.project), compile(copy));
      assert.deepEqual(compile(source), compiledBefore);
    }
  }
});
