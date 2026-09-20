import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { editContentStructure } from '../content-design/structure.mjs';
import { createContentDraftSession } from '../content-design/session.mjs';
import { createContentDraftBackend } from '../content-design/drafts.mjs';
import { setBoardAvailability } from '../studio/board-state.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

function emptyProject() {
  return {
    ...createStarterProject('empty-studio-fixture'),
    maps: [],
    missions: [],
    campaigns: [],
    packs: [],
  };
}

test('valid empty Studio projects save, restore, gain a mission and undo without a second schema', async () => {
  const source = emptyProject(),
    backend = createContentDraftBackend(managedIndexedDB()),
    session = createContentDraftSession(source, { backend });
  assert.equal(compileContentProject(source).missions.length, 0);
  await session.save();
  assert.deepEqual((await backend.read(source.id)).project, source);
  session.replace(
    editContentStructure(session.current(), {
      action: 'create',
      kind: 'pack',
      id: 'opening',
      name: 'Opening',
    }),
  );
  session.replace(
    editContentStructure(session.current(), {
      action: 'create',
      kind: 'campaign',
      id: 'first-campaign',
      name: 'First campaign',
      band: 1,
      parentId: 'opening',
    }),
  );
  session.replace(
    editContentStructure(session.current(), {
      action: 'create',
      kind: 'mission',
      id: 'first-mission',
      name: 'First mission',
      parentId: 'first-campaign',
    }),
  );
  await session.save();
  assert.deepEqual((await backend.read(source.id)).project.campaigns[0].missionIds, [
    'first-mission',
  ]);
  assert.equal(session.undo().missions.length, 0);
  await session.save();
  assert.equal((await backend.read(source.id)).project.missions.length, 0);
  assert.equal(session.redo().missions.length, 1);
  assert.deepEqual(JSON.parse(session.export()).packs[0].campaignIds, ['first-campaign']);
});

test('empty board clears stale mission facts and canvas, then re-enables authoring on selection', () => {
  const ids = [
    'mission',
    'difficulty',
    'geometry-tools',
    'show-capture',
    'trail',
    'inspect',
    'clear-inspection',
    'board',
    'empty-board',
    'board-legend',
    'map-name',
    'geometry',
    'lesson',
    'rules',
    'effective',
    'capture',
    'capture-summary',
    'diagnostics',
    'capture-legend',
    'play',
  ];
  const nodes = Object.fromEntries(
    ids.map((id) => [
      id,
      {
        disabled: false,
        hidden: false,
        textContent: 'Previous mission',
        value: '72, 144',
      },
    ]),
  );
  const cleared = [];
  Object.assign(nodes.board, {
    width: 1008,
    height: 504,
    getContext: () => ({ clearRect: (...args) => cleared.push(args) }),
  });
  nodes.diagnostics.replaceChildren = (...children) => {
    nodes.diagnostics.children = children;
  };
  const document = {
    getElementById: (id) => {
      assert(nodes[id], id);
      return nodes[id];
    },
  };
  setBoardAvailability(document, false);
  assert.deepEqual(cleared, [[0, 0, 1008, 504]]);
  assert.equal(nodes.board.hidden, true);
  assert.equal(nodes['empty-board'].hidden, false);
  assert.equal(nodes['geometry-tools'].disabled, true);
  assert.equal(nodes.play.disabled, true);
  assert.equal(nodes.trail.value, '');
  for (const id of ['lesson', 'rules', 'effective', 'capture', 'capture-summary'])
    assert.equal(nodes[id].textContent, '');
  assert.deepEqual(nodes.diagnostics.children, []);
  assert.match(nodes.geometry.textContent, /No mission selected/);
  setBoardAvailability(document, true);
  assert.equal(nodes.board.hidden, false);
  assert.equal(nodes['empty-board'].hidden, true);
  for (const id of [
    'mission',
    'difficulty',
    'geometry-tools',
    'show-capture',
    'trail',
    'inspect',
    'clear-inspection',
  ])
    assert.equal(nodes[id].disabled, false);
  assert.equal(
    nodes.play.disabled,
    true,
    'Mission mode inspection, not empty-state UI, authorizes Solo preview',
  );
});
