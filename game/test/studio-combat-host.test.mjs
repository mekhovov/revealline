import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createStarterProject } from '../content-design/starter.mjs';
import { createCombatCandidates } from '../content-design/combat-candidates.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { createContentDraftSession } from '../content-design/session.mjs';
import { createActorEditor } from '../studio/actor-editor.mjs';
import { createCombatEditor } from '../studio/combat-editor.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { contentActorDescription } from '../content-design/actor-marker.mjs';
import { journeyPreset } from '../content-design/catalogs.mjs';
import { validateScenario } from '../content.mjs';
import { createRun } from '../core/index.mjs';
import { combatView } from '../ui/combat-view.mjs';

const source = readFileSync(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
const html = readFileSync(new URL('../studio/index.html', import.meta.url), 'utf8');
const themes = JSON.parse(
  readFileSync(new URL('../content-design/themes.json', import.meta.url), 'utf8'),
).themes;
const section = (start, end) => {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, `Missing Studio integration boundary: ${start}`);
  return source.slice(first, last);
};

/** Execute the actual Studio event bindings with real compiler/session/editors.
 * DOM, render and autosave scheduling are controlled seams, not native-browser
 * evidence. This catches a tested editor left disconnected from the host. */
function fixture() {
  const nodes = new Map();
  const element = () => {
    let value = '';
    return {
      get value() {
        return value;
      },
      set value(next) {
        value = String(next);
      },
      textContent: '',
      disabled: false,
      hidden: false,
      checked: false,
      scrollIntoView() {},
      replaceChildren(...children) {
        this.children = children;
        this.value = children[0]?.value ?? '';
      },
    };
  };
  const document = {
    createElement: element,
    getElementById(id) {
      assert(html.includes(`id="${id}"`), `Actual Studio page is missing ${id}`);
      if (!nodes.has(id)) nodes.set(id, element());
      return nodes.get(id);
    },
  };
  const $ = (id) => document.getElementById(id);
  let reject = false,
    queued = 0,
    rendered = 0,
    editors;
  const previewStorage = new Map();
  const context = {
    document,
    $,
    createActorEditor,
    createCombatEditor,
    createCombatCandidates,
    compileContentProject,
    prepareContentPreview,
    contentActorDescription,
    journeyPreset,
    geometryEditor: { sync() {} },
    bonusEditor: { sync() {} },
    objectiveEditor: { sync() {} },
    imageWorkbench: { sync() {} },
    traceRecovery: { sync() {} },
    setBoardAvailability() {},
    draw() {},
    tuningRevision: null,
    inspectedTrail: [],
    AbortController,
    URL,
    location: { href: 'http://localhost/game/studio/' },
    previewController: null,
    previewRevision: 0,
    stopPreviewReadiness() {},
    loadPreviewTheme: async ({ themeId }) => themes.find((theme) => theme.id === themeId),
    loadPreviewArtwork: () => {
      throw new Error('Greybox study should not request an artwork pin.');
    },
    sessionStorage: { setItem: (key, value) => previewStorage.set(key, value) },
    observePreviewReadiness: () => () => {},
    session: createContentDraftSession(createStarterProject()),
    inspected: null,
    sourceChanged: false,
    saveTimer: undefined,
    clearTimeout,
    inspections: { invalidate() {} },
    guarded: (action) => action,
    discardSource: () => !reject,
    currentMission: () =>
      context.session.current().missions.find((mission) => mission.id === $('mission').value),
    queueSave() {
      queued++;
    },
    setSession(project) {
      context.session = createContentDraftSession(project);
      $('mission').value = project.missions[0]?.id ?? '';
    },
    render() {
      rendered++;
      $('source').value = context.session.export();
      context.sourceChanged = false;
      context.inspected = null;
      $('apply').disabled = true;
      editors?.combatEditor.sync();
      editors?.actorEditor.sync();
    },
  };
  $('mission').value = context.session.current().missions[0].id;
  $('difficulty').value = 'standard';
  $('source').value = context.session.export();
  editors = runInNewContext(
    `${section('const actorEditor = ', 'const geometryEditor = ')}\n({ actorEditor, combatEditor });`,
    context,
  );
  runInNewContext(
    section('function inspectSource(', "$('source').addEventListener") +
      section("$('combat-study').onclick", "$('team-signal').onclick") +
      section("$('apply').onclick", "$('load').onclick"),
    context,
  );
  const inspectBoard = runInNewContext(
    section('function inspectBoard(', 'function render(') + '\ninspectBoard;',
    context,
  );
  runInNewContext(section("$('play').onclick", 'function closePreview()'), context);
  context.render();
  return {
    $,
    context,
    inspectBoard,
    previewStorage,
    queued: () => queued,
    rendered: () => rendered,
    reject: () => (reject = true),
  };
}

test('actual Studio study button inspects without adoption and Apply owns replacement', async () => {
  const f = fixture();
  const before = f.context.session.export();
  await f.$('combat-study').onclick();
  assert.equal(f.context.session.export(), before);
  assert.equal(f.queued(), 0);
  assert.equal(f.$('apply').disabled, false);
  assert.match(f.$('validation').textContent, /Apply to replace the workbench draft/);
  assert.equal(f.context.inspected.project.missions.length, 3);
  assert.equal(f.context.inspected.project.id, 'journey-combat-authoring-study');
  await f.$('apply').onclick();
  assert.equal(f.context.session.current().id, 'journey-combat-authoring-study');
  assert.equal(f.context.session.current().missions.length, 3);
  assert.equal(f.queued(), 1);
  assert.match(f.$('combat-state').textContent, /Combat enabled/);
  assert.match(f.$('combat-result').textContent, /Solo practice preview is available/);
  assert.match(
    f.$('combat-result').textContent,
    /Human playability and device qualification are still pending/,
  );
  assert(f.$('actor-role').children.some((option) => option.value === 'optional-sentry'));
});

test('actual Studio bindings keep combat and actor edits in undo/autosave history', async () => {
  const f = fixture();
  await f.$('combat-study').onclick();
  await f.$('apply').onclick();
  const before = f.context.session.export();
  f.$('combat-enabled').checked = false;
  f.$('combat-enabled').onchange();
  assert.equal(f.context.session.export(), before, 'An unchecked box is not an applied edit.');
  f.$('combat-apply').onclick();
  const disabled = f.context.session.export();
  assert.notEqual(disabled, before);
  assert.equal(f.context.currentMission().combat.enabled, false);
  assert.equal(f.queued(), 2);
  f.$('actor-select').value = 'bench-scout';
  f.$('actor-select').onchange();
  f.$('actor-heading').value = '0,1';
  f.$('actor-form').onsubmit({ preventDefault() {} });
  assert.deepEqual(
    f.context.currentMission().actors.find((actor) => actor.id === 'bench-scout').heading,
    [0, 1],
  );
  assert.equal(f.queued(), 3);
  f.context.session.undo();
  f.context.render();
  assert.equal(f.context.session.export(), disabled);
  f.context.session.undo();
  f.context.render();
  assert.equal(f.context.session.export(), before);
  assert.equal(f.$('combat-enabled').checked, true);
});

test('declining unapplied-source discard prevents study inspection and editor adoption', () => {
  const f = fixture();
  const before = f.context.session.export();
  f.$('source').value = 'unapplied source';
  f.context.sourceChanged = true;
  f.reject();
  f.$('combat-study').onclick();
  f.$('combat-prepare').onclick();
  assert.equal(f.context.session.export(), before);
  assert.equal(f.$('source').value, 'unapplied source');
  assert.equal(f.context.inspected, null);
  assert.equal(f.queued(), 0);
  assert.equal(f.rendered(), 1);
});

test('actual Studio inspection enables exact validated combat Solo practice, not Team', async () => {
  const f = fixture();
  await f.$('combat-study').onclick();
  await f.$('apply').onclick();
  f.inspectBoard();
  assert.equal(f.$('play').disabled, false);
  assert.equal(f.$('combat-preview-help').hidden, false);
  assert.equal(f.$('export-team').hidden, true);
  assert.equal(f.$('team-test-help').hidden, true);
  assert.equal(JSON.parse(f.$('effective').textContent).combatPatrols.enabled, true);
  const before = f.context.session.export();
  await f.$('play').onclick();
  const scenario = JSON.parse(f.previewStorage.get('revealline.playground.current'));
  assert.equal(validateScenario(scenario).valid, true);
  const expected = prepareContentPreview(f.context.session.current(), f.$('mission').value);
  assert.deepEqual(scenario.level, expected.manifest.level);
  assert.equal(scenario.level.classic.combatPatrols.enabled, true);
  assert.equal(combatView(createRun(scenario.level)).valid, true);
  assert.equal(new URL(f.$('preview').src).searchParams.get('practice'), '1');
  assert.equal(f.context.session.export(), before, 'Preview never changes the draft.');
  assert.equal(f.$('preview-panel').hidden, false);
  const invalid = structuredClone(scenario);
  invalid.level.classic.combatPatrols.actors[0].speed = -1;
  assert.equal(validateScenario(invalid).valid, false);
});

test('combat preview keeps ordinary scenario validation fail-closed before entering the host', async () => {
  const f = fixture();
  await f.$('combat-study').onclick();
  await f.$('apply').onclick();
  f.context.loadPreviewTheme = async () => ({ id: 'rover-yard' });
  await f.$('play').onclick();
  assert.equal(f.previewStorage.size, 0);
  assert.equal(f.$('preview').src, 'about:blank');
  assert.match(f.$('preview-status').textContent, /Close preview and retry/);
});

test('Studio labels technical preview support without claiming human or device qualification', () => {
  assert.match(
    html,
    /Arrow field: faster with, slower against, unchanged across; never forced drift\./,
  );
  assert.match(html, /id="combat-result"[^>]*role="status"/);
  assert.match(html, /Optional robots are not qualified for Team/);
  assert.match(html, /Exact Solo practice preview supports optional robots/);
  assert.match(html, /Human playability and device\s+qualification are still pending/);
  for (const id of ['combat-study', 'combat-tools', 'combat-enabled', 'combat-preview-help'])
    assert.equal(html.split(`id="${id}"`).length - 1, 1, `Unique ${id} control`);
});
