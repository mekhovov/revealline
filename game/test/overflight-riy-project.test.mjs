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

for (const rulesVersion of [3, 4]) {
  test(`Riy rules ${rulesVersion} exposes current escort ranges, arcs and introduction controls`, () => {
    const project = createOverflightRiyProject({ rulesVersion });
    let edits = 0;
    const editor = overflightRiyEditor({
      document: new Document(),
      project,
      locale: 'en',
      onChange: () => edits++,
    });
    const labels = editor.querySelectorAll('label');
    const controls = (text) =>
      labels
        .filter((label) => label.textContent === text)
        .map((label) => label.querySelector('input'));
    assert.equal(editor.querySelectorAll('input').length, 27);
    assert.equal(controls('Follow-mode targeting range').length, 0);
    const set = (input, value) => {
      assert.ok(input);
      input.value = String(value);
      input.dispatchEvent({ type: 'input' });
    };
    set(controls('Maximum focus approach (seconds)')[0], 1.5);
    set(controls('Follow firing arc (degrees)')[0], 150);
    set(controls('Attack range')[1], 200);
    set(controls('Infantry in this pack')[0], 20);
    const compiled = compileOverflightRiyProject(project);
    assert.equal(edits, 4);
    assert.equal(compiled.riy.approachSeconds, 1.5);
    assert.equal(compiled.riy.escorts[0].followArc, 150);
    assert.equal(compiled.riy.escorts[1].attackRange, 200);
    assert.equal(compiled.riy.intro[0].count, 20);
    assert.equal(Object.hasOwn(project.riy, 'attackRange'), false);
    assert.equal(Object.hasOwn(project.riy, 'defendRange'), false);
  });
}

test('legacy Riy editor retains shared ranges without adding modern fields', () => {
  for (const options of [{ legacy: true }, { rulesVersion: 2 }]) {
    const project = createOverflightRiyProject(options);
    const editor = overflightRiyEditor({
      document: new Document(),
      project,
      locale: 'en',
      onChange() {},
    });
    assert.equal(editor.querySelectorAll('input').length, 18);
    const labels = editor.querySelectorAll('label');
    assert.ok(labels.some((label) => label.textContent === 'Follow-mode targeting range'));
    assert.equal(
      labels.some((label) => label.textContent === 'Maximum focus approach (seconds)'),
      false,
    );
    const input = labels
      .find((label) => label.textContent === 'Attack range')
      .querySelector('input');
    input.value = '140';
    input.dispatchEvent({ type: 'input' });
    assert.equal(compileOverflightRiyProject(project).riy.attackRange, 140);
    assert.equal(Object.hasOwn(project.riy, 'approachSeconds'), false);
    assert.equal(Object.hasOwn(project.riy, 'intro'), false);
  }
});
