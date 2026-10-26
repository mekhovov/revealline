import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import {
  createEncounterStudioSession,
  validateEncounterStudioBundle,
  mountEncounterEditor,
} from '../../optional-practice/civilian-fpv/world-encounter-editor.mjs';

function definition() {
  const actor = (id) => ({
    id,
    type: 'patrol',
    role: 'hostile',
    position: { x: 10000, y: 12, z: 10000 },
    path: [{ x: 15000, y: 12, z: 10000 }],
    speed: 1200,
    radius: 350,
    height: 1800,
    health: 50,
    fireEveryTicks: 100,
    damage: 10,
    projectileSpeed: 8000,
    range: 20000,
    family: 'runner',
    material: 'organic',
    appearance: { family: 'runner', cast: 'authored' },
    destructible: true,
    groundMotion: 'support-v1',
  });
  return {
    format: 'FPVEncounterDefinition.v1',
    revision: 'r1',
    baseIdentity: 'map:r1',
    activity: 'continuous',
    difficulty: 'normal',
    population: 6,
    seed: 1,
    bounds: { min: { x: -30000, y: -1000, z: -30000 }, max: { x: 30000, y: 10000, z: 30000 } },
    spawn: { x: 0, y: 1000, z: 0 },
    actors: [actor('runner-a'), actor('runner-b')],
  };
}

test('Studio companion export/import and undo/redo preserve exact schema and author IDs', () => {
  const source = definition(),
    changes = [];
  const editor = createEncounterStudioSession({
    definition: source,
    onChange: (value) => changes.push(value),
  });
  const edit = editor.snapshot();
  edit.actors[0].health = 125;
  edit.activity = 'elimination';
  editor.apply(edit);
  const encoded = editor.exportBundle(),
    restored = validateEncounterStudioBundle(encoded, { baseIdentity: 'map:r1' });
  assert.deepEqual(restored.sourceDefinition, source);
  assert.deepEqual(restored.definition, edit);
  assert.equal(editor.undo(), true);
  assert.deepEqual(editor.snapshot(), source);
  assert.equal(editor.redo(), true);
  assert.deepEqual(editor.snapshot(), edit);
  assert.equal(editor.exportBundle(), encoded);
  assert.throws(
    () => editor.importBundle({ ...restored, baseIdentity: 'map:r2' }),
    /identity mismatch/,
  );
  assert.deepEqual(editor.snapshot(), edit);
  assert.equal(changes.length, 3);
});

test('source reimport resolves missing stable IDs visibly and keeps authored field overrides', () => {
  const source = definition(),
    editor = createEncounterStudioSession({ definition: source });
  const edit = editor.snapshot();
  edit.actors[0].health = 125;
  editor.apply(edit);
  const incoming = definition();
  incoming.baseIdentity = 'map:r2';
  incoming.actors.pop();
  incoming.actors[0].damage = 25;
  assert.deepEqual(editor.reimport(incoming).unresolved, ['runner-b']);
  assert.equal(editor.status().pending, true);
  assert.throws(() => editor.apply(edit), /Resolve/);
  assert.equal(editor.snapshot().baseIdentity, 'map:r1');
  editor.resolveSource({ keepMissing: true });
  assert.equal(editor.snapshot().baseIdentity, 'map:r2');
  assert.equal(editor.snapshot().actors[0].health, 125);
  assert.equal(editor.snapshot().actors[0].damage, 25);
  assert.equal(editor.snapshot().actors[1].id, 'runner-b');
  editor.undo();
  editor.reimport(incoming);
  editor.resolveSource();
  assert.equal(editor.snapshot().actors.length, 1);
});

test('invalid geometry, bounds, duplicate IDs and host rejection are atomic', () => {
  const source = definition();
  const editor = createEncounterStudioSession({
    definition: source,
    admitActor: (actor) => (actor.position.x < 20000 ? actor : null),
    onChange: (value) => value.seed !== 42,
  });
  for (const mutate of [
    (value) => (value.actors[0].position.x = 25000),
    (value) => (value.actors[0].path[0].x = 40000),
    (value) => (value.actors[1].id = 'runner-a'),
    (value) => (value.seed = 42),
  ]) {
    const value = editor.snapshot();
    mutate(value);
    assert.throws(() => editor.apply(value));
    assert.deepEqual(editor.snapshot(), source);
  }
  const adjust = createEncounterStudioSession({
    definition: source,
    admitActor: (actor) => ({ ...actor, position: { ...actor.position, y: 24 } }),
  });
  assert.throws(() => adjust.apply(source), /aligned/);
  const invalidZone = editor.snapshot();
  invalidZone.actors[0].spawnZone = {
    min: { x: 9000, y: 0, z: 9000 },
    max: { x: 11000, y: 1000, z: 11000 },
  };
  assert.throws(() => editor.apply(invalidZone), /outside bounds/);
});

test('mounted Studio edits metres, shield family and previews the exact accepted runtime definition', () => {
  const doc = new Document(),
    container = doc.createElement('section');
  doc.body.append(container);
  const source = definition(),
    previews = [];
  let identity = source.baseIdentity;
  const editor = mountEncounterEditor({
    container,
    definition: source,
    getCourse: () => ({}),
    getBaseIdentity: () => identity,
    onPreview: (value) => previews.push(value),
  });
  const field = (name) => container.querySelector(`[data-encounter-field="${name}"]`);
  const click = (title) => {
    const button = [...container.querySelectorAll('button')].find(
      (node) => node.textContent === title,
    );
    assert.ok(button, title);
    button.click();
  };
  field('speed').value = '2.5';
  field('health').value = '100';
  field('family').value = 'shield-bearer';
  click('Apply target settings');
  assert.equal(editor.snapshot().actors[0].speed, 2500);
  assert.equal(editor.snapshot().actors[0].family, 'shield-bearer');
  click('Preview blood and remains');
  assert.deepEqual(previews[0], {
    definition: editor.snapshot(),
    actorId: 'runner-a',
    destruction: { brutal: true, blood: true, showRemains: true },
    weapon: 'precision',
    outcome: 'breakup',
  });
  click('Export encounter');
  assert.deepEqual(
    validateEncounterStudioBundle(field('bundle').value).definition,
    editor.snapshot(),
  );
  identity = 'map:r2';
  editor.refresh();
  assert.equal(
    [...container.querySelectorAll('button')].find(
      (node) => node.textContent === 'Apply target settings',
    ).disabled,
    true,
  );
  assert.match(container.textContent, /Map source changed/);
  editor.dispose();
  assert.equal(container.children.length, 0);
});

test('saved companions from an older map revision stay readable for explicit source reimport', () => {
  const source = definition(),
    session = createEncounterStudioSession({ definition: source });
  const doc = new Document(),
    container = doc.createElement('section');
  doc.body.append(container);
  const editor = mountEncounterEditor({
    container,
    bundle: session.exportBundle(),
    getCourse: () => ({}),
    getBaseIdentity: () => 'map:r2',
  });
  assert.equal(editor.snapshot().baseIdentity, 'map:r1');
  assert.match(container.textContent, /Map source changed/);
  assert.equal(
    [...container.querySelectorAll('button')].find(
      (node) => node.textContent === 'Apply target settings',
    ).disabled,
    true,
  );
  const incoming = definition();
  incoming.baseIdentity = 'map:r2';
  incoming.actors.pop();
  editor.reimport(incoming);
  assert.match(container.textContent, /runner-b/);
  [...container.querySelectorAll('button')]
    .find((node) => node.textContent === 'Keep them as authored targets')
    .click();
  assert.equal(editor.snapshot().baseIdentity, 'map:r2');
  assert.equal(editor.snapshot().actors.length, 2);
  editor.dispose();
});

test('Studio authors version-two loadouts and Survival populations while preserving imported historical definitions', () => {
  const source = definition();
  source.actors[1].type = 'drone';
  source.actors[1].material = 'electronic';
  delete source.actors[1].groundMotion;
  const doc = new Document(),
    container = doc.createElement('section');
  doc.body.append(container);
  const editor = mountEncounterEditor({
    container,
    definition: source,
    getCourse: () => ({}),
    getBaseIdentity: () => 'map:r1',
  });
  const field = (name) => container.querySelector(`[data-encounter-field="${name}"]`);
  const apply = () =>
    [...container.querySelectorAll('button')]
      .find((b) => b.textContent === 'Apply encounter settings')
      .click();
  try {
    assert.equal(
      editor.snapshot().format,
      'FPVEncounterDefinition.v1',
      'opening a historical bundle does not mutate it',
    );
    field('activity').value = 'survival';
    field('activity').dispatchEvent({ type: 'change' });
    assert.equal(field('population').value, '96');
    field('population').value = '128';
    field('survivalMode').value = 'endless';
    field('primaryWeapon').value = 'rocket';
    field('secondaryWeapon').value = 'precision';
    field('ammoPreset').value = 'tactical';
    field('servicePadEnabled').checked = true;
    field('payload').value = 'remote';
    field('playerDamage').value = 'invulnerable';
    apply();
    const next = editor.snapshot();
    assert.equal(next.format, 'FPVEncounterDefinition.v2');
    assert.equal(next.crowdModel, 'squad-lanes-v1');
    assert.equal(next.population, 128);
    assert.equal(next.survivalMode, 'endless');
    assert.deepEqual(next.loadout, ['rocket', 'precision']);
    assert.equal(next.payload, 'remote');
    assert.equal(next.ammoPreset, 'tactical');
    assert.ok(
      next.actors.every(
        (a) =>
          a.role === 'hostile' &&
          ['military-trooper', 'military-uav'].includes(a.appearance.archetype),
      ),
    );
    assert.deepEqual(validateEncounterStudioBundle(editor.exportBundle()).definition, next);
    field('secondaryWeapon').value = 'rocket';
    apply();
    assert.deepEqual(editor.snapshot(), next);
    assert.match(container.textContent, /two different weapons/);
  } finally {
    editor.dispose();
  }
});

test('Studio target type changes keep body dimensions, material and motion ownership consistent', () => {
  const source = definition();
  source.actors[0] = {
    ...source.actors[0],
    type: 'vehicle',
    material: 'metal',
    vehicleModel: 'field-utility',
    radius: 900,
  };
  const doc = new Document(),
    container = doc.createElement('section');
  doc.body.append(container);
  const editor = mountEncounterEditor({
    container,
    definition: source,
    getCourse: () => ({}),
    getBaseIdentity: () => 'map:r1',
  });
  const field = (name) => container.querySelector(`[data-encounter-field="${name}"]`);
  const apply = () =>
    [...container.querySelectorAll('button')]
      .find((b) => b.textContent === 'Apply target settings')
      .click();
  try {
    field('type').value = 'drone';
    field('type').dispatchEvent({ type: 'change' });
    assert.equal(field('material').value, 'electronic');
    assert.equal(field('radius').value, '0.45');
    assert.equal(field('height').value, '0.9');
    apply();
    const drone = editor.snapshot().actors[0];
    assert.equal(drone.type, 'drone');
    assert.equal(drone.vehicleModel, undefined);
    assert.equal(drone.groundMotion, undefined);
    assert.equal(drone.radius, 450);
    assert.equal(drone.height, 900);
    field('type').value = 'patrol';
    field('type').dispatchEvent({ type: 'change' });
    apply();
    const trooper = editor.snapshot().actors[0];
    assert.equal(trooper.material, 'organic');
    assert.equal(trooper.groundMotion, 'support-v1');
    assert.equal(trooper.height, 1800);
  } finally {
    editor.dispose();
  }
});

test('Studio rejects Tactical without a supported pad and admits an explicit landing point atomically', () => {
  const doc = new Document(),
    container = doc.createElement('section');
  doc.body.append(container);
  const editor = mountEncounterEditor({
    container,
    definition: definition(),
    getCourse: () => ({}),
    getBaseIdentity: () => 'map:r1',
    admitServicePad: (position) => (position.x === 2000 ? { ...position, y: 12 } : null),
  });
  const field = (name) => container.querySelector(`[data-encounter-field="${name}"]`);
  const apply = () =>
    [...container.querySelectorAll('button')]
      .find((node) => node.textContent === 'Apply encounter settings')
      .click();
  try {
    field('ammoPreset').value = 'tactical';
    apply();
    assert.match(container.textContent, /Tactical ammunition needs/);
    assert.equal(editor.snapshot().format, 'FPVEncounterDefinition.v1');
    field('ammoPreset').value = 'tactical';
    field('servicePadEnabled').checked = true;
    field('servicePad-x').value = '1';
    apply();
    assert.match(container.textContent, /clear supported surface/);
    field('ammoPreset').value = 'tactical';
    field('servicePadEnabled').checked = true;
    field('servicePad-x').value = '2';
    apply();
    assert.deepEqual(editor.snapshot().servicePad, { x: 2000, y: 12, z: 0 });
    assert.equal(editor.snapshot().ammoPreset, 'tactical');
    assert.deepEqual(
      validateEncounterStudioBundle(editor.exportBundle()).definition.servicePad,
      editor.snapshot().servicePad,
    );
  } finally {
    editor.dispose();
  }
});

test('Studio validates v2 firing access with the equipped weapon and preserves exact service pad admission', () => {
  const source = {
    ...definition(),
    format: 'FPVEncounterDefinition.v2',
    revision: 'r2',
    loadout: ['scatter', 'rocket'],
    payload: 'bomb',
    ammoPreset: 'balanced',
    survivalMode: 'timed',
    playerDamage: 'normal',
    enemyDamage: 'normal',
    servicePad: { x: 2000, y: 12, z: 0 },
  };
  for (const actor of source.actors)
    actor.appearance = { ...actor.appearance, cast: 'tactical', archetype: 'military-trooper' };
  const calls = [],
    pads = [];
  const editor = createEncounterStudioSession({
    definition: source,
    admitActor(actor, options) {
      calls.push(options);
      return options?.attackRadius === 100 ? actor : null;
    },
    admitServicePad(point, options) {
      pads.push(options);
      return point;
    },
  });
  editor.apply(source);
  assert.equal(editor.snapshot().crowdModel, undefined, 'import preserves historical v2 rules');
  assert.ok(
    calls.every(
      (options) =>
        options.requireAttackPosition &&
        options.attackRange === 100000 &&
        options.attackRadius === 100,
    ),
  );
  assert.ok(pads.every((options) => options.exact === true));
  const changed = { ...editor.snapshot(), loadout: ['scatter', 'autocannon'] };
  assert.throws(() => editor.apply(changed), /supported route and a reachable firing position/);
  assert.deepEqual(editor.snapshot().loadout, ['scatter', 'rocket']);
  editor.apply({ ...editor.snapshot(), crowdModel: 'squad-lanes-v1' });
  const incoming = structuredClone(source);
  incoming.baseIdentity = 'map:r2';
  editor.reimport(incoming);
  editor.resolveSource();
  assert.equal(editor.snapshot().crowdModel, 'squad-lanes-v1');
  assert.equal(
    validateEncounterStudioBundle(editor.exportBundle()).definition.crowdModel,
    'squad-lanes-v1',
  );
  const legacy = [],
    historical = createEncounterStudioSession({
      definition: definition(),
      admitActor(actor, options) {
        legacy.push(options);
        return actor;
      },
    });
  historical.apply(definition());
  assert.ok(
    legacy.every((options) => options === undefined),
    'historical course admission stays unchanged',
  );
});

test('Studio round-trips complete 128-target Survival routes and their source baseline', () => {
  const source = definition();
  Object.assign(source, {
    format: 'FPVEncounterDefinition.v2',
    revision: 'r2',
    activity: 'survival',
    population: 128,
    survivalMode: 'timed',
    loadout: ['autocannon', 'rocket'],
    payload: 'bomb',
    ammoPreset: 'balanced',
    playerDamage: 'normal',
    enemyDamage: 'normal',
  });
  const template = source.actors[0];
  source.actors = Array.from({ length: 128 }, (_, i) => ({
    ...structuredClone(template),
    id: `target-${i}`,
    path: Array.from({ length: 64 }, (_, n) => ({ x: 10000 + n * 100, y: 12, z: 10000 })),
    appearance: { family: template.family, cast: 'tactical', archetype: 'military-trooper' },
  }));
  source.actors[127].type = 'drone';
  source.actors[127].material = 'electronic';
  source.actors[127].appearance.archetype = 'military-uav';
  delete source.actors[127].groundMotion;
  const session = createEncounterStudioSession({ definition: source });
  const encoded = session.exportBundle();
  assert.ok(encoded.length > 256 * 1024);
  const restored = validateEncounterStudioBundle(encoded, { baseIdentity: 'map:r1' });
  assert.deepEqual(restored.definition, source);
  assert.deepEqual(restored.sourceDefinition, source);
});
