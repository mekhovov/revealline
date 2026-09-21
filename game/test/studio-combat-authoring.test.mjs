import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareCombatAuthoring } from '../content-design/combat-authoring.mjs';
import { createCombatEditor } from '../studio/combat-editor.mjs';
import { createActorEditor } from '../studio/actor-editor.mjs';

function fixture({ source: initial = createStarterProject(), deferredSource = false } = {}) {
  const nodes = new Map();
  function element() {
    let value = '';
    return {
      get value() {
        return value;
      },
      set value(next) {
        value = String(next);
      },
      checked: false,
      textContent: '',
      disabled: false,
      hidden: false,
      replaceChildren(...children) {
        this.children = children;
        this.value = children[0]?.value ?? '';
      },
    };
  }
  const document = {
    createElement: element,
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, element());
      return nodes.get(id);
    },
  };
  let source = initial,
    selected = source.missions[0]?.id,
    difficulty = 'standard',
    ready = !deferredSource,
    reject = false,
    attempts = 0;
  const sync = () => {
    combat.sync();
    actor.sync();
  };
  const shared = {
    document,
    getSource() {
      assert(ready, 'Draft session has not been adopted yet.');
      return source;
    },
    getMission: () => source.missions.find((entry) => entry.id === selected),
    apply(next) {
      attempts++;
      if (reject) return false;
      source = next;
      sync();
      return true;
    },
  };
  const combat = createCombatEditor(shared);
  const actor = createActorEditor({ ...shared, getDifficulty: () => difficulty });
  if (ready) sync();
  return {
    combat: (id) => document.getElementById(`combat-${id}`),
    actor: (id) => document.getElementById(`actor-${id}`),
    source: () => source,
    attempts: () => attempts,
    sync,
    adopt() {
      ready = true;
      sync();
    },
    reject() {
      reject = true;
    },
    update(next, refresh = true) {
      source = next;
      if (refresh) sync();
    },
    select(next, refresh = true) {
      selected = next;
      if (refresh) sync();
    },
    preset(next) {
      difficulty = next;
      sync();
    },
  };
}
const mission = (f) => f.source().missions[0];
const roleValues = (f) => f.actor('role').children.map((entry) => entry.value);
const submit = (f) => f.actor('form').onsubmit({ preventDefault() {} });
function selectRole(f, role) {
  f.actor('role').value = role;
  f.actor('role').onchange();
}
function fillActor(f, { id = 'optional', role = 'optional-scout', x = '8.5', y = '8.5' } = {}) {
  f.actor('select').value = '';
  f.actor('select').onchange();
  selectRole(f, role);
  f.actor('id').value = id;
  f.actor('x').value = x;
  f.actor('y').value = y;
  f.actor('heading').value = '-1,1';
}

test('combat preparation creates disabled authoring; checkbox selections require explicit Apply', () => {
  const f = fixture(),
    original = structuredClone(f.source());
  assert.equal(f.combat('tools').disabled, false);
  assert.equal(f.combat('prepare').disabled, false);
  assert.equal(f.combat('enabled').disabled, true);
  assert.equal(f.combat('apply').disabled, true);
  f.combat('prepare').onclick();
  assert.equal(f.source().actorCatalogId, 'journey-actors-v8');
  assert.deepEqual(mission(f).combat, { version: 'mission-combat.v1', enabled: false });
  assert.deepEqual(mission(f).actors, original.missions[0].actors);
  assert.deepEqual(f.source().maps, original.maps);
  assert.equal(f.combat('prepare').disabled, true);
  assert.equal(f.combat('enabled').disabled, false);
  assert.match(f.combat('state').textContent, /authored but inactive/);
  const disabled = structuredClone(f.source()),
    attempts = f.attempts();
  f.combat('enabled').checked = true;
  f.combat('enabled').onchange();
  assert.match(f.combat('result').textContent, /Unapplied/);
  assert.deepEqual(f.source(), disabled);
  assert.equal(f.attempts(), attempts);
  f.combat('apply').onclick();
  assert.equal(mission(f).combat.enabled, true);
  assert.match(f.combat('state').textContent, /Combat enabled/);
  assert.match(f.combat('result').textContent, /local draft.*no publication/);
  const enabled = structuredClone(f.source());
  f.combat('apply').onclick();
  assert.deepEqual(f.source(), enabled, 'Unchanged Apply preserves every edition token.');
  f.combat('prepare').onclick();
  assert.deepEqual(f.source(), enabled, 'A redundant preparation cannot disable combat.');
  f.combat('enabled').checked = false;
  f.combat('enabled').onchange();
  assert.deepEqual(f.source(), enabled);
  f.combat('apply').onclick();
  assert.equal(mission(f).combat.enabled, false);
  assert.notEqual(f.source().revision, disabled.revision);
});

test('rejected preparation or toggle adoption leaves the owner draft intact', () => {
  for (const prepared of [false, true]) {
    const f = fixture();
    if (prepared) f.combat('prepare').onclick();
    const before = structuredClone(f.source());
    f.reject();
    if (prepared) {
      f.combat('enabled').checked = true;
      f.combat('enabled').onchange();
      f.combat('apply').onclick();
    } else f.combat('prepare').onclick();
    assert.deepEqual(f.source(), before);
    assert.equal(f.combat('enabled').disabled, !prepared);
    assert.doesNotMatch(f.combat('result').textContent, /edition applied/);
  }
});

test('combat controls reject stale maps, flags and mission selections until refreshed', () => {
  for (const change of [
    (source) => {
      source.maps[0].foundations[0].w = 6;
    },
    (source) => {
      source.missions[0].combat.enabled = true;
    },
    (source) => {
      source.difficultyCatalogId = 'journey-difficulty-v2';
    },
  ]) {
    const f = fixture();
    f.combat('prepare').onclick();
    const next = structuredClone(f.source());
    change(next);
    f.update(next, false);
    const attempts = f.attempts();
    f.combat('enabled').checked = true;
    f.combat('apply').onclick();
    assert.match(f.combat('result').textContent, /Not applied.*context changed/);
    assert.deepEqual(f.source(), next);
    assert.equal(f.attempts(), attempts);
    f.sync();
    assert.equal(f.combat('enabled').checked, next.missions[0].combat.enabled);
  }
  const f = fixture(),
    before = structuredClone(f.source());
  f.select('missing', false);
  f.combat('prepare').onclick();
  assert.match(f.combat('result').textContent, /context changed/);
  assert.deepEqual(f.source(), before);
});

test('Team and empty selections disable combat controls and cannot apply editions', () => {
  const source = createTeamOpeningCandidates();
  source.actorCatalogId = 'journey-actors-v8';
  const f = fixture({ source }),
    original = structuredClone(source);
  for (const name of ['tools', 'prepare', 'enabled', 'apply'])
    assert.equal(f.combat(name).disabled, true, name);
  assert.match(f.combat('state').textContent, /not qualified for Team/);
  assert(!roleValues(f).includes('optional-scout'));
  assert(!roleValues(f).includes('optional-sentry'));
  f.combat('prepare').onclick();
  assert.match(f.combat('result').textContent, /non-Team/);
  assert.deepEqual(f.source(), original);
  f.select('missing');
  for (const name of ['tools', 'prepare', 'enabled', 'apply'])
    assert.equal(f.combat(name).disabled, true, name);
  f.combat('apply').onclick();
  assert.match(f.combat('result').textContent, /non-Team/);
  assert.deepEqual(f.source(), original);
  assert.equal(f.actor('tools').disabled, true);
});

test('both editors initialize before deferred source adoption without reading a draft', () => {
  const f = fixture({ deferredSource: true });
  assert.equal(f.combat('tools').disabled, true);
  assert.equal(f.actor('tools').disabled, true);
  assert.equal(f.actor('role').children, undefined);
  assert.equal(f.attempts(), 0);
  f.adopt();
  assert.equal(f.combat('tools').disabled, false);
  assert.equal(f.combat('prepare').disabled, false);
  assert.equal(f.actor('tools').disabled, false);
  f.combat('prepare').onclick();
  assert.equal(mission(f).combat.enabled, false);
});

test('optional actor choices require both catalogue v8 and a prepared mission setting', () => {
  const f = fixture();
  const absent = () => {
    assert(!roleValues(f).includes('optional-scout'));
    assert(!roleValues(f).includes('optional-sentry'));
  };
  absent();
  const upgraded = structuredClone(f.source());
  upgraded.actorCatalogId = 'journey-actors-v8';
  f.update(upgraded);
  absent();
  f.combat('prepare').onclick();
  assert(roleValues(f).includes('optional-scout'));
  assert(roleValues(f).includes('optional-sentry'));
  const oldCatalog = structuredClone(f.source());
  oldCatalog.actorCatalogId = 'journey-actors-v7';
  f.update(oldCatalog); // Inspecting unvalidated fields must not unlock a missing recipe.
  absent();
});

test('optional controls expose headings, tiers, exact pressure-v2 sentry timing and keeper distinction', () => {
  const source = createStarterProject();
  source.difficultyCatalogId = 'journey-difficulty-v2';
  const f = fixture({ source: prepareCombatAuthoring(source, 'nearby-shore') });
  for (const role of ['optional-scout', 'optional-sentry']) {
    selectRole(f, role);
    assert.equal(f.actor('heading-row').hidden, false);
    assert.equal(f.actor('clockwise-row').hidden, true);
    assert.equal(f.actor('axis-row').hidden, true);
    assert.equal(f.actor('edge-row').hidden, true);
    assert.deepEqual(
      f.actor('tier').children.map((entry) => entry.value),
      ['measured', 'standard', 'brisk'],
    );
    assert.match(f.actor('tier').children[0].textContent, /2.52 cells\/s/);
    assert.match(f.actor('position-help').textContent, /Inactive authored actor/);
    assert.match(
      f.actor('position-help').textContent,
      /Removed by craft contact or capture; never retains field/,
    );
    assert.match(f.actor('description').textContent, /Does not retain field regions/);
    assert.match(
      f.actor('description').textContent,
      /ordinary keepers (still damage body and trail|remain dangerous)/i,
    );
  }
  assert.match(
    f.actor('position-help').textContent,
    /4s opening \/ 1.5s locked warning \/ 1.5s recovery \/ 8.5s rest/,
  );
  assert.match(f.actor('position-help').textContent, /Only its projectile harms/);
  f.preset('expert');
  selectRole(f, 'optional-sentry');
  assert.match(
    f.actor('position-help').textContent,
    /1.5s locked warning \/ 1.5s recovery \/ 6.5s rest/,
  );
  assert.match(f.actor('tier').children[0].textContent, /3.15 cells\/s/);
  selectRole(f, 'optional-scout');
  assert.match(f.actor('position-help').textContent, /No contact damage/);
  assert.doesNotMatch(f.actor('position-help').textContent, /locked warning|rest\./);
  selectRole(f, 'field-keeper');
  assert.match(f.actor('description').textContent, /Retains its field region/);
  assert.doesNotMatch(f.actor('position-help').textContent, /Removed by craft|Inactive authored/);
});

test('optional actor CRUD applies through shared validation, rolls back invalid fields and retains combat after removal', () => {
  const f = fixture();
  f.combat('prepare').onclick();
  const prepared = structuredClone(f.source());
  fillActor(f);
  assert.deepEqual(f.source(), prepared, 'Filling controls has no authoring side effect.');
  submit(f);
  assert.match(f.actor('result').textContent, /Actor applied/);
  assert.deepEqual(mission(f).actors.at(-1), {
    id: 'optional',
    role: 'optional-scout',
    tier: 'measured',
    x: 8.5,
    y: 8.5,
    heading: [-1, 1],
  });
  assert.equal(mission(f).combat.enabled, false);
  const before = structuredClone(f.source());
  f.actor('heading').value = '0,0';
  submit(f);
  assert.match(f.actor('result').textContent, /Not applied/);
  assert.deepEqual(f.source(), before);
  f.actor('heading').value = '1,0';
  selectRole(f, 'optional-sentry');
  f.actor('tier').value = 'brisk';
  submit(f);
  assert.match(f.actor('result').textContent, /Actor applied/);
  assert.equal(mission(f).actors.at(-1).role, 'optional-sentry');
  assert.equal(mission(f).actors.at(-1).tier, 'brisk');
  const level = resolveMission(compileContentProject(f.source()), 'nearby-shore').level;
  assert.deepEqual(
    level.enemies.map((entry) => entry.id),
    ['keeper'],
  );
  assert.equal(level.classic.combatPatrols.actors[0].role, 'sentry');
  f.combat('enabled').checked = true;
  f.combat('apply').onclick();
  assert.match(f.actor('position-help').textContent, /Combat enabled/);
  f.actor('remove').onclick();
  assert.match(f.actor('remove').textContent, /Confirm remove/);
  assert.equal(mission(f).actors.length, 2);
  f.actor('remove').onclick();
  assert.equal(mission(f).actors.length, 1);
  assert.deepEqual(mission(f).combat, { version: 'mission-combat.v1', enabled: true });
  assert.equal(f.source().actorCatalogId, 'journey-actors-v8');
});
