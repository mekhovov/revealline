import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { validateThemeBundle } from '../presentation/model.mjs';
import {
  duplicateStudioSnapshot,
  reviseStudioTheme,
  setStudioAppearanceBasis,
} from '../presentation/studio-session.mjs';
import { exportThemeBundle, importThemeBundle } from '../presentation/bundle.mjs';
import { exportRuntimeTheme, importRuntimeTheme } from '../presentation/runtime-transfer.mjs';
import { createThemeCandidate } from '../presentation/theme-preview.mjs';
import { COMPONENT_ROLES, getThemeFamily } from '../presentation/theme-system.mjs';
import { installThemeHost } from '../presentation/theme-host.mjs';
import { createStudioStore } from '../presentation/studio-store.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { mountThemeWorkbench } from '../../authoring/asset-studio/theme-workbench.mjs';

const basis = (id, revision) => {
  const family = getThemeFamily(id, revision);
  return {
    familyId: family.id,
    familyRevision: family.revision,
    interfaceId: family.interface.id,
    interfaceRevision: family.interface.revision,
  };
};

for (const pin of [basis('dnipro-porcelain'), basis('industrial-workshop', 'r1')]) {
  test(`saved workspace, duplicate, native and runtime exports retain ${pin.familyId}@${pin.familyRevision}`, async () => {
    const legacy = createDefaultThemeBundle();
    const source = reviseStudioTheme(setStudioAppearanceBasis(legacy, pin), {
      tokens: { panel: '#253144' },
    });
    assert.equal(legacy.format, 'revealline-theme-bundle.v1');
    assert.equal(Object.hasOwn(legacy, 'appearanceBasis'), false);
    assert.equal(source.format, 'revealline-theme-bundle.v2');
    assert.equal(
      setStudioAppearanceBasis(source, pin),
      source,
      'Selecting the same exact basis is a no-op',
    );
    const store = createStudioStore({ indexedDB: memoryIndexedDB().indexedDB });
    const saved = await store.createWorkspace(source, new Map());
    const reloaded = await store.loadWorkspace(saved.id);
    const portable = await exportThemeBundle(reloaded.document);
    const imported = await importThemeBundle(portable, { decodeImage: null });
    const duplicate = duplicateStudioSnapshot(imported.document, {
      id: 'basis-copy',
      name: 'Basis copy',
    });
    for (const document of [reloaded.document, imported.document, duplicate]) {
      assert.deepEqual(document.appearanceBasis, pin);
      const candidate = createThemeCandidate(document);
      assert.deepEqual(candidate.basis, pin);
      assert.deepEqual(
        candidate.family.arcade,
        getThemeFamily(pin.familyId, pin.familyRevision).arcade,
      );
      assert.deepEqual(
        (await importRuntimeTheme(await exportRuntimeTheme(document, new Map()))).candidate,
        candidate,
      );
    }
    const overridden = await importRuntimeTheme(await exportRuntimeTheme(legacy, new Map(), pin));
    assert.deepEqual(
      overridden.candidate.basis,
      pin,
      'Explicit retained export pins must not be dropped',
    );
    store.close();
  });
}

test('missing exact basis stays portable and editable without silently becoming latest Industrial', async () => {
  const unavailable = { ...basis('industrial-workshop'), familyRevision: 'r999' };
  const source = setStudioAppearanceBasis(createDefaultThemeBundle(), unavailable);
  const exported = await exportThemeBundle(source);
  const imported = await importThemeBundle(exported, { decodeImage: null });
  assert.deepEqual(imported.document.appearanceBasis, unavailable);
  assert.throws(() => createThemeCandidate(imported.document), /Unknown candidate family/);
  await assert.rejects(
    exportRuntimeTheme(imported.document, new Map()),
    /Unknown candidate family/,
  );
  const repaired = setStudioAppearanceBasis(imported.document, basis('tryzub'));
  assert.equal(repaired.revision, imported.document.revision + 1);
  assert.equal(createThemeCandidate(repaired).basis.familyId, 'tryzub');
  assert.deepEqual(imported.document.appearanceBasis, unavailable);
});

test('v1 native data remains exact and malformed or unversioned basis metadata is rejected', async () => {
  const source = createDefaultThemeBundle();
  const imported = await importThemeBundle(await exportThemeBundle(source), { decodeImage: null });
  assert.deepEqual(imported.document, source);
  assert.throws(
    () => validateThemeBundle({ ...source, appearanceBasis: basis('dos') }),
    /not supported/,
  );
  for (const bad of [
    { ...basis('dos'), familyRevision: 'latest' },
    { ...basis('dos'), interfaceRevision: 1 },
    { ...basis('dos'), code: 'alert(1)' },
    { ...basis('dos'), familyId: '../private' },
  ])
    assert.throws(() => setStudioAppearanceBasis(source, bad));
  let called = false;
  assert.throws(() =>
    setStudioAppearanceBasis(source, {
      get familyId() {
        called = true;
        return 'dos';
      },
    }),
  );
  assert.equal(called, false);
  const saved = setStudioAppearanceBasis(source, basis('dos'));
  assert.throws(
    () => validateThemeBundle({ ...source, revision: saved.revision + 1 }, { previous: saved }),
    /discard.*basis/,
  );
});

test('workbench reload shows the saved exact basis, stages changes and visibly blocks unavailable exports', () => {
  const document = new Document();
  const header = document.createElement('header');
  header.className = 'studio-header';
  document.body.append(header);
  let source = setStudioAppearanceBasis(
    createDefaultThemeBundle(),
    basis('industrial-workshop', 'r1'),
  );
  const actions = [];
  const workbench = mountThemeWorkbench({
    document,
    window: document.defaultView,
    onAction(action, options) {
      actions.push({ action, options });
      if (action === 'set-basis') {
        source = setStudioAppearanceBasis(source, options);
        update();
      }
    },
  });
  const update = () =>
    workbench.update({
      library: { entries: [] },
      activeId: null,
      document: source,
      assets: new Map(),
      selected: source.slots[0].id,
    });
  update();
  const select = document.getElementById('theme-candidate-family');
  assert.equal(select.value, 'industrial-workshop@r1');
  document.getElementById('theme-export-runtime').onclick();
  assert.deepEqual(actions.at(-1).options, basis('industrial-workshop', 'r1'));
  select.value = 'dnipro-porcelain';
  select.onchange();
  assert.deepEqual(source.appearanceBasis, basis('dnipro-porcelain'));
  assert.equal(select.value, 'dnipro-porcelain');
  source = setStudioAppearanceBasis(source, { ...basis('dos'), interfaceRevision: 'r999' });
  update();
  assert.equal(document.getElementById('theme-export-runtime').disabled, true);
  assert.equal(document.getElementById('theme-community-defaults').disabled, true);
  assert.ok(document.getElementById('theme-candidate-basis-status').textContent.length > 0);
  assert.equal(source.appearanceBasis.interfaceRevision, 'r999');
  workbench.dispose();
});

test('Studio chrome lists and immediately applies admitted custom themes without editing the workspace', async () => {
  const document = new Document(),
    window = document.defaultView;
  const header = document.createElement('header');
  header.className = 'studio-header';
  document.body.append(header);
  const source = duplicateStudioSnapshot(createDefaultThemeBundle(), {
    id: 'community-theme',
    name: 'Community theme',
  });
  const candidate = createThemeCandidate(source);
  const before = JSON.stringify(source),
    actions = [],
    values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const host = installThemeHost({
    document,
    window,
    getStorage: () => storage,
    appearanceThemes: [candidate],
    prepareStyles: () => Promise.resolve(),
  });
  await host.ready;
  const workbench = mountThemeWorkbench({
    document,
    window,
    onAction: (...args) => actions.push(args),
  });
  const input = document.getElementById('studio-theme-family');
  assert.deepEqual(
    Array.from(input.children, (option) => option.value),
    host.availableThemeChoices().map((choice) => choice.id),
  );
  assert.equal(
    Array.from(input.children).find((option) => option.value === candidate.family.id).textContent,
    `${candidate.family.name} · ${candidate.family.revision}`,
  );
  input.focus();
  input.value = candidate.family.id;
  input.onchange();
  await host.ready;
  assert.equal(host.snapshot().familyId, candidate.family.id);
  assert.equal(input.value, candidate.family.id);
  assert.equal(document.activeElement, input);
  assert.deepEqual(actions, [], 'Changing editor appearance is not an authoring action.');
  assert.equal(JSON.stringify(source), before);
  workbench.dispose();
  host.dispose();
});

test('role inspector uses runtime semantics without inline paint or stealing selector focus', (t) => {
  const document = new Document(),
    header = document.createElement('header');
  header.className = 'studio-header';
  document.body.append(header);
  const source = setStudioAppearanceBasis(createDefaultThemeBundle(), basis('industrial-workshop'));
  const workbench = mountThemeWorkbench({
    document,
    window: document.defaultView,
    onAction() {},
  });
  t.after(() => workbench.dispose());
  workbench.update({
    library: { entries: [] },
    activeId: null,
    document: source,
    assets: new Map(),
    selected: source.slots[0].id,
  });
  const role = document.getElementById('theme-recipe-role'),
    state = document.getElementById('theme-recipe-state'),
    preview = document.getElementById('theme-recipe-preview');
  for (const name of COMPONENT_ROLES) {
    role.focus();
    role.value = name;
    role.onchange();
    assert.equal(document.activeElement, role);
    for (const value of ['default', 'hover', 'focus', 'pressed', 'selected', 'disabled', 'error']) {
      state.focus();
      state.value = value;
      state.onchange();
      assert.equal(document.activeElement, state, 'Simulated focus must not steal actual focus');
      const sample = preview.querySelector(`[data-component='${name}']`);
      assert.ok(sample, name);
      assert.equal(sample.dataset.state, value);
      for (const property of [
        'backgroundColor',
        'backgroundImage',
        'color',
        'borderColor',
        'borderImageSource',
        'borderImageSlice',
        'outline',
        'minHeight',
      ])
        assert.equal(sample.style[property] ?? '', '', `${name}/${value}: ${property}`);
      if (['primary', 'danger'].includes(name)) assert.equal(sample.dataset.uiAction, name);
      if (name === 'panel') assert.equal(sample.dataset.uiSurface, 'panel');
      if (['checkbox', 'radio'].includes(name)) {
        assert.equal(sample.type, name);
        assert.equal(sample.checked, value === 'selected');
        assert.equal(sample.parentNode.tagName, 'LABEL');
      }
      if (name === 'tab') {
        assert.equal(sample.getAttribute('role'), 'tab');
        assert.equal(sample.getAttribute('aria-selected'), String(value === 'selected'));
        assert.equal(sample.getAttribute('aria-pressed'), null);
        assert.equal(sample.parentNode.getAttribute('role'), 'tablist');
      }
      if (name === 'slider') {
        assert.equal(sample.type, 'range');
        assert.equal(sample.value, '68');
      }
      if (value === 'disabled' && ['BUTTON', 'INPUT'].includes(sample.tagName))
        assert.equal(sample.disabled, true);
    }
  }
  role.value = 'button';
  state.value = 'default';
  role.onchange();
  const before = preview.querySelector('[data-component="button"]');
  before.focus();
  const family = document.getElementById('theme-specimen-family');
  family.value = 'tryzub';
  family.onchange();
  const after = preview.querySelector('[data-component="button"]');
  assert.notEqual(after, before);
  assert.equal(document.activeElement, after, 'Repainting preserves the focused sample');
});
