import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOverflightProject,
  compileOverflightProject,
  validateOverflightProject,
} from '../overflight/project.mjs';
import {
  createOverflightRiyProject,
  validateOverflightRiyProject,
  compileOverflightRiyProject,
  overflightRiySurvivorProject,
  upgradeOverflightRiyProjectCopy,
} from '../overflight/riy-project.mjs';
import {
  createOverflightRiyPackage,
  exportOverflightRiyPackage,
  importOverflightRiyPackage,
  createOverflightRiyLibrary,
  overflightRiyPackageIdentity,
  validateOverflightRiyPackage,
} from '../overflight/riy-community.mjs';
import { overflightRiyEditor } from '../studio/riy-editor.mjs';
import { Document } from './helpers/couch-dom.mjs';

test('Riy compiles shared Survivor rules and resources with distinct authored identity', () => {
  for (const legacy of [false, true]) {
    const source = createOverflightRiyProject({ legacy });
    const compiled = compileOverflightRiyProject(source);
    const base = compileOverflightProject(overflightRiySurvivorProject(source));
    assert.equal(compiled.format, base.format);
    assert.equal(compiled.rulesVersion, legacy ? 1 : 2);
    assert.deepEqual(compiled.resources, base.resources);
    assert.notEqual(compiled.projectIdentity, base.projectIdentity);
    assert.ok(Object.isFrozen(compiled.riy.escorts[0]));
    const before = compiled.projectIdentity;
    source.riy.escorts[0].lateral = -70;
    assert.notEqual(compileOverflightRiyProject(source).projectIdentity, before);
    assert.throws(() => validateOverflightProject(source));
  }
  assert.deepEqual(validateOverflightProject(createOverflightProject()), createOverflightProject());
});

test('Riy rejects unsafe settings, unsupported capabilities and malformed shared encounters', () => {
  for (const mutate of [
    (p) => {
      p.riy.leash = 20;
    },
    (p) => {
      p.riy.focusSeconds = 6;
      p.riy.commandCooldown = 2;
    },
    (p) => {
      p.riy.defendRange = 180;
    },
    (p) => {
      p.riy.escorts.push({ ...p.riy.escorts[0] });
    },
    (p) => {
      p.riy.escorts[1].role = 'sweeper';
    },
    (p) => {
      p.riy.escorts[1].lateral = -52;
    },
    (p) => {
      p.riy.escorts[0].damage = Infinity;
    },
    (p) => {
      p.riy.script = 'javascript:attack()';
    },
    (p) => {
      p.riy.escorts[0].asset = 'https://example.invalid/remote.png';
    },
    (p) => {
      p.encounters[0].families = ['unknown'];
    },
    (p) => {
      p.resources.effects.revision++;
    },
    (p) => {
      p.survivorFormat = 'OverflightProjectV9';
    },
    (p) => {
      p.extra = true;
    },
  ]) {
    const project = createOverflightRiyProject();
    mutate(project);
    assert.throws(() => validateOverflightRiyProject(project));
  }
});

test('Riy package fresh-library round trip preserves source and native compiled identity', async () => {
  const project = createOverflightRiyProject({ encounterSet: 'mixed' });
  project.riy.escorts[1].damage = 28;
  project.riy.focusSeconds = 4;
  const pack = createOverflightRiyPackage(project);
  const blob = exportOverflightRiyPackage(pack);
  const imported = await importOverflightRiyPackage(blob);
  let state = { format: 'revealline-overflight-riy-library.v1', packages: {} };
  const library = createOverflightRiyLibrary({
    backend: {
      read: async () => structuredClone(state),
      update: async (fn) => (state = fn(structuredClone(state))),
      close() {},
    },
  });
  const id = await library.install(imported);
  assert.equal(id, overflightRiyPackageIdentity(pack));
  const loaded = (await library.load(id)).project;
  assert.deepEqual(compileOverflightRiyProject(loaded), compileOverflightRiyProject(project));
  assert.equal(
    await exportOverflightRiyPackage(createOverflightRiyPackage(loaded)).text(),
    await blob.text(),
  );
  const invalid = structuredClone(pack);
  invalid.dependencies.motion.revision++;
  assert.throws(() => validateOverflightRiyPackage(invalid));
  library.dispose();
});

test('updating a legacy Riy copy preserves escort authoring without rewriting source', () => {
  const original = createOverflightRiyProject({ legacy: true });
  original.riy.escorts[0].damage = 20;
  const changed = upgradeOverflightRiyProjectCopy(original, {
    difficulty: 'veteran',
  });
  assert.equal(original.survivorFormat, 'OverflightProjectV1');
  assert.equal(changed.survivorFormat, 'OverflightProjectV2');
  assert.equal(changed.difficulty, 'veteran');
  assert.notEqual(changed.id, original.id);
  assert.deepEqual(changed.riy, original.riy);
  assert.equal(compileOverflightRiyProject(changed).rulesVersion, 2);
});

test('shared Studio escort controls edit the same validated config used by native play', () => {
  const document = new Document();
  const project = createOverflightRiyProject();
  let edits = 0;
  const editor = overflightRiyEditor({
    document,
    project,
    locale: 'en',
    onChange: () => edits++,
  });
  const inputs = editor.querySelectorAll('input');
  assert.equal(inputs.length, 18);
  inputs[2].value = '4';
  inputs[2].dispatchEvent({ type: 'input' });
  inputs[10].value = '18';
  inputs[10].dispatchEvent({ type: 'input' });
  assert.equal(edits, 2);
  const compiled = compileOverflightRiyProject(project);
  assert.equal(compiled.riy.focusSeconds, 4);
  assert.equal(compiled.riy.escorts[0].damage, 18);
  const uk = overflightRiyEditor({
    document,
    project,
    locale: 'uk',
    onChange() {},
  });
  assert.match(uk.textContent, /Стрій/);
});
