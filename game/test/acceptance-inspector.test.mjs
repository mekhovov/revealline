import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import {
  inspectMissionAcceptance,
  missionEvidenceTarget,
  readPlaytestLedger,
  appendPlaytestEvidence,
} from '../content-design/acceptance-evidence.mjs';
import { createAcceptanceInspector } from '../studio/acceptance-inspector.mjs';
import { syncStudioDifficulty } from '../studio/difficulty-view.mjs';

const sourceCommit = 'a'.repeat(40);
function element() {
  return {
    value: '',
    textContent: '',
    files: [],
    children: [],
    disabled: false,
    replaceChildren(...children) {
      this.children = children;
    },
  };
}
function setup(source = createStarterProject()) {
  const state = { source, missionId: source.missions[0].id, difficulty: 'standard' };
  const nodes = Object.fromEntries(
    [
      'mode',
      'commit',
      'file',
      'clear',
      'inspect',
      'summary',
      'checks',
      'report',
      'selection',
      'ledger-status',
    ].map((id) => [id, element()]),
  );
  nodes.commit.value = sourceCommit;
  const inspector = createAcceptanceInspector({
    document: {
      getElementById: (id) => nodes[id.replace('acceptance-', '')],
      createElement: element,
    },
    getSource: () => state.source,
    getMission: () => state.source.missions.find((mission) => mission.id === state.missionId),
    getDifficulty: () => state.difficulty,
  });
  inspector.sync();
  const importFile = async (text, size = new TextEncoder().encode(text).length) => {
    nodes.file.files = [{ size, text: async () => text }];
    await nodes.file.onchange();
  };
  return { state, nodes, inspector, importFile };
}
function syntheticLedger(source, mode = 'solo') {
  return appendPlaytestEvidence(readPlaytestLedger(), {
    format: 'PlaytestEvidenceV1',
    id: 'synthetic-inspector-test',
    target: missionEvidenceTarget(source, source.missions[0].id, { sourceCommit, mode }),
    kind: 'automated',
    observedAt: '2026-09-21T10:00:00.000Z',
    method: 'Synthetic fixture, not observed testing.',
    checks: [
      {
        id: 'capture-contract',
        outcome: 'fail',
        detail: '<img src=x onerror=alert(1)> is inert text, not markup.',
      },
    ],
    artifacts: [],
    supersedes: null,
  });
}
test('Studio shows the same exact acceptance report as the shared compiler for all modes and presets', () => {
  for (const source of [createStarterProject(), createTeamOpeningCandidates()]) {
    const before = JSON.stringify(source),
      { state, nodes, inspector } = setup(source);
    for (const mode of source.missions[0].modes)
      for (const difficulty of ['gentle', 'standard', 'expert']) {
        state.difficulty = difficulty;
        inspector.sync();
        nodes.mode.value = mode;
        const direct = inspectMissionAcceptance(source, state.missionId, {
          sourceCommit,
          mode,
          difficulty,
        });
        assert.deepEqual(nodes.inspect.onclick(), direct);
        assert.deepEqual(JSON.parse(nodes.report.textContent), direct);
        assert.equal(nodes.checks.children.length, direct.checks.length);
        assert.match(nodes.summary.textContent, /not human authentication/);
        assert.match(nodes.selection.textContent, /not unapplied JSON/);
      }
    assert.equal(JSON.stringify(source), before);
  }
});
test('local import is explicit, inert and visit-only; failures cannot silently reuse old claims', async () => {
  const { state, nodes, importFile } = setup(),
    ledger = syntheticLedger(state.source);
  await importFile(JSON.stringify(ledger));
  assert.equal(nodes.report.textContent, '');
  assert.match(nodes['ledger-status'].textContent, /1 declared records/);
  const report = nodes.inspect.onclick();
  assert.deepEqual(report.currentEvidenceIds, ['synthetic-inspector-test']);
  assert.equal(report.checks[0].status, 'reported-fail');
  assert.match(nodes.checks.children[0].textContent, /<img src=x/);
  assert.equal(nodes.checks.children[0].innerHTML, undefined);
  await importFile('{invalid json');
  assert.match(nodes['ledger-status'].textContent, /Ledger rejected.*No records loaded/);
  assert.deepEqual(nodes.inspect.onclick().currentEvidenceIds, []);
  await importFile(JSON.stringify(ledger));
  nodes.clear.onclick();
  assert.equal(nodes.report.textContent, '');
  assert.deepEqual(nodes.inspect.onclick().currentEvidenceIds, []);
  assert.deepEqual(setup().nodes.inspect.onclick().currentEvidenceIds, []);
});
test('selection, source and preset changes clear reports and old-edition claims remain explicitly stale', async () => {
  const { state, nodes, inspector, importFile } = setup();
  await importFile(JSON.stringify(syntheticLedger(state.source)));
  nodes.inspect.onclick();
  state.difficulty = 'expert';
  inspector.sync();
  assert.equal(nodes.report.textContent, '');
  assert.equal(nodes.checks.children.length, 0);
  assert.deepEqual(nodes.inspect.onclick().staleEvidenceIds, ['synthetic-inspector-test']);
  state.difficulty = 'standard';
  state.source = structuredClone(state.source);
  state.source.missions[0].name = 'Changed presentation';
  inspector.sync();
  assert.equal(nodes.report.textContent, '');
  assert.deepEqual(nodes.inspect.onclick().staleEvidenceIds, ['synthetic-inspector-test']);
  nodes.commit.value = 'HEAD';
  nodes.commit.oninput();
  assert.equal(nodes.report.textContent, '');
  assert.equal(nodes.inspect.onclick(), null);
  assert.match(nodes.summary.textContent, /exact source commit/);
  nodes.mode.onchange();
  assert.equal(nodes.report.textContent, '');
  state.missionId = 'missing';
  inspector.sync();
  assert.equal(nodes.inspect.disabled, true);
  assert.deepEqual(nodes.mode.children, []);
});
test('oversized and multiple files fail before reading; a dishonest byte size cannot bypass the parser budget', async () => {
  const { nodes, importFile } = setup();
  let calls = 0;
  for (const files of [
    [{ size: 8 * 1024 * 1024 + 1 }],
    [{ size: 0 }],
    [{ size: 1 }, { size: 1 }],
  ]) {
    nodes.file.files = files.map((file) => ({
      ...file,
      text: () => {
        calls++;
        throw new Error('Must not read');
      },
    }));
    await nodes.file.onchange();
    assert.match(nodes['ledger-status'].textContent, /Ledger rejected/);
  }
  assert.equal(calls, 0);
  await importFile(' '.repeat(8 * 1024 * 1024 + 1), 1);
  assert.match(nodes['ledger-status'].textContent, /Ledger rejected/);
  assert.deepEqual(nodes.inspect.onclick().currentEvidenceIds, []);
});
test('late file success or failure cannot replace a newer selection, clear action or ledger', async () => {
  for (const action of ['new-file', 'sync', 'clear', 'commit', 'mode'])
    for (const fails of [false, true]) {
      const { state, nodes, inspector, importFile } = setup();
      let resolve, reject;
      nodes.file.files = [
        {
          size: 100,
          text: () =>
            new Promise((yes, no) => {
              resolve = yes;
              reject = no;
            }),
        },
      ];
      const pending = nodes.file.onchange();
      assert.equal(nodes.inspect.disabled, true);
      assert.equal(nodes.inspect.onclick(), null);
      const ledger = syntheticLedger(state.source);
      if (action === 'new-file') await importFile(JSON.stringify(ledger));
      else if (action === 'sync') inspector.sync();
      else if (action === 'clear') nodes.clear.onclick();
      else if (action === 'commit') nodes.commit.oninput();
      else nodes.mode.onchange();
      const before = nodes['ledger-status'].textContent;
      if (fails) reject(new Error('Late failure must be ignored'));
      else resolve(JSON.stringify(ledger));
      await pending;
      assert.equal(nodes['ledger-status'].textContent, before);
      assert.equal(nodes.inspect.disabled, false);
      assert.equal(
        nodes.inspect.onclick().currentEvidenceIds.length,
        action === 'new-file' ? 1 : 0,
      );
    }
});
test('Studio owns the inspector and synchronizes it when the applied board selection changes', () => {
  const host = readFileSync(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../studio/index.html', import.meta.url), 'utf8');
  assert.match(host, /const acceptanceInspector = createAcceptanceInspector\(/);
  const inspect = host.slice(
    host.indexOf('function inspectBoard('),
    host.indexOf('function render('),
  );
  assert(inspect.startsWith('function inspectBoard('));
  for (const source of [createStarterProject(), createTeamOpeningCandidates()])
    for (const empty of [false, true]) {
      const { state, nodes, inspector } = setup(source);
      state.difficulty = 'expert';
      if (empty) state.missionId = '';
      const mission = source.missions.find((item) => item.id === state.missionId);
      const selector = {
        value: state.difficulty,
        options: ['gentle', 'standard', 'expert'].map((value) => ({ value, textContent: 'stale' })),
      };
      const calls = [],
        boardNodes = { difficulty: selector },
        stopAtPreview = new Error('Preview boundary');
      nodes.report.textContent = 'Stale report';
      const context = {
        currentMission: () => mission,
        session: { current: () => source },
        $: (id) => (boardNodes[id] ??= {}),
        syncStudioDifficulty,
        acceptanceInspector: {
          sync() {
            assert(selector.options.every((option) => option.textContent !== 'stale'));
            calls.push('acceptance');
            inspector.sync();
          },
        },
        ...Object.fromEntries(
          [
            'actorEditor',
            'combatEditor',
            'geometryEditor',
            'bonusEditor',
            'timedBonusEditor',
            'objectiveEditor',
            'relayEditor',
            'directionalEditor',
            'encounterEditor',
            'imageWorkbench',
            'traceRecovery',
          ].map((name) => [name, { sync() {} }]),
        ),
        document: {},
        setBoardAvailability: (_document, available) => assert.equal(available, !!mission),
        prepareContentPreview: (applied, id, options) => {
          assert.equal(applied, source);
          assert.equal(id, mission.id);
          assert.equal(options.difficulty, 'expert');
          calls.push('preview');
          throw stopAtPreview;
        },
        inspectedTrail: [1],
        tuningRevision: 'old',
      };
      const invoke = () => runInNewContext(`${inspect}\ninspectBoard();`, context);
      if (empty) invoke();
      else assert.throws(invoke, (error) => error === stopAtPreview);
      assert.deepEqual(calls, empty ? ['acceptance'] : ['acceptance', 'preview']);
      assert.equal(nodes.report.textContent, '');
      assert.equal(nodes.inspect.disabled, empty);
      assert.equal(selector.value, 'expert');
      if (empty) {
        assert.equal(nodes.selection.textContent, 'Choose an applied mission above.');
        assert.equal(context.inspectedTrail.length, 0);
        assert.equal(context.tuningRevision, null);
      } else assert(nodes.selection.textContent.includes(`${mission.id} · expert`));
    }
  for (const id of [
    'mode',
    'commit',
    'file',
    'clear',
    'inspect',
    'summary',
    'checks',
    'report',
    'selection',
    'ledger-status',
  ])
    assert.equal(html.split(`id="acceptance-${id}"`).length, 2);
  assert.match(html, /Studio cannot verify/);
});
