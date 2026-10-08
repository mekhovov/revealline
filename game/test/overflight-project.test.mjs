import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileOverflightProject,
  createOverflightProject,
  DEFAULT_OVERFLIGHT_PROJECT,
  OVERFLIGHT_SOLDIERS,
  OVERFLIGHT_MACHINERY,
} from '../overflight/project.mjs';
import {
  createOverflightPackage,
  validateOverflightPackage,
  exportOverflightPackage,
  importOverflightPackage,
  createOverflightLibrary,
  overflightPackageIdentity,
} from '../overflight/community.mjs';
import { overflightLaunchURL } from '../fpv-entry.mjs';

test('native and Studio compilation are identical, immutable and isolated from draft edits', () => {
  const draft = createOverflightProject();
  const native = compileOverflightProject(draft),
    studio = compileOverflightProject(JSON.stringify(draft));
  assert.deepEqual(native, studio);
  assert.ok(Object.isFrozen(native.encounters[0]));
  draft.encounters[0].hp = 100;
  assert.equal(native.encounters[0].hp, 30);
  assert.notEqual(compileOverflightProject(draft).projectIdentity, native.projectIdentity);
});
test('three encounter sets cover every admitted soldier and machinery family', () => {
  const families = new Set();
  for (const encounterSet of ['front', 'crossing', 'mixed']) {
    const project = compileOverflightProject(createOverflightProject({ encounterSet }));
    project.encounters.forEach((row) => row.families.forEach((id) => families.add(id)));
    assert.equal(project.encounters.at(-1).end, 360);
    assert.ok(project.encounters.filter((row) => row.pattern === 'relief').length >= 8);
    for (const encounter of project.encounters.filter((row) => row.pattern === 'relief'))
      assert.ok(encounter.end - encounter.start >= project.combat.pacing.reliefSeconds);
  }
  // Tanks are authored elite/final encounters, not members of ordinary spawn waves.
  families.add('tracked-tank');
  for (const id of [...OVERFLIGHT_SOLDIERS, ...OVERFLIGHT_MACHINERY])
    assert.ok(families.has(id), id);
});
test('reject ambiguous schedules, unsupported resources, malformed thresholds and executable data', () => {
  for (const mutate of [
    (p) => (p.encounters[1].start = 1),
    (p) => (p.encounters[0].families = ['unregistered']),
    (p) => (p.resources.actorArtRevision = 'future'),
    (p) => (p.resources.url = 'https://example.test/untrusted.js'),
    (p) => (p.upgrades.thresholds[2] = p.upgrades.thresholds[1]),
    (p) => p.upgrades.modules.push('shield'),
    (p) => (p.goals.finalAt = 1),
    (p) => (p.population.priorityAttacks = 3),
    (p) => (p.arena.cameraWidth = 1920),
    (p) => (p.props[0].x = -1),
  ]) {
    const draft = createOverflightProject();
    mutate(draft);
    assert.throws(() => compileOverflightProject(draft));
  }
  const draft = createOverflightProject();
  Object.defineProperty(draft, 'seed', {
    enumerable: true,
    get() {
      throw new Error('getter executed');
    },
  });
  assert.throws(
    () => compileOverflightProject(draft),
    (error) => !error.message.includes('getter executed'),
  );
});
test('export → fresh-profile import → native compile preserves exact content and dependency closure', async () => {
  const pack = createOverflightPackage(DEFAULT_OVERFLIGHT_PROJECT);
  const imported = await importOverflightPackage(exportOverflightPackage(pack));
  assert.deepEqual(imported, pack);
  let state = { format: 'revealline-overflight-library.v1', packages: {} },
    closed = false;
  const backend = {
    async read() {
      return structuredClone(state);
    },
    async update(fn) {
      state = fn(structuredClone(state));
      return state;
    },
    close() {
      closed = true;
    },
  };
  const library = createOverflightLibrary({ backend });
  const identity = await library.install(imported);
  assert.equal(identity, overflightPackageIdentity(pack));
  assert.deepEqual(
    compileOverflightProject((await library.load(identity)).project),
    compileOverflightProject(DEFAULT_OVERFLIGHT_PROJECT),
  );
  assert.equal((await library.list()).length, 1);
  await library.remove(identity);
  assert.equal((await library.list()).length, 0);
  await assert.rejects(() => library.load(identity));
  library.dispose();
  assert.equal(closed, true);
  const corrupt = structuredClone(pack);
  corrupt.dependencies.effects.revision = 2;
  assert.throws(() => validateOverflightPackage(corrupt));
});
test('native launch retains same-build scope and removes arbitrary caller state', () => {
  const url = new URL(
    overflightLaunchURL('https://example.test/releases/v1/game/couch/?secret=ignored', 'uk'),
  );
  assert.equal(url.pathname, '/releases/v1/game/overflight/play.html');
  assert.equal(url.searchParams.get('lang'), 'uk');
  assert.equal(url.searchParams.has('secret'), false);
  assert.equal(overflightLaunchURL('https://user:pass@example.test/game/'), null);
  assert.equal(overflightLaunchURL('https://example.test/unrelated/'), null);
});
