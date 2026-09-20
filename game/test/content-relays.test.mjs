import test from 'node:test';
import assert from 'node:assert/strict';
import { dataIdentity } from '../data-json.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { editContentRelay } from '../content-design/relays.mjs';
import { editContentObjective } from '../content-design/objectives.mjs';
import { createDraftHistory } from '../content-design/drafts.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRelayEditor } from '../studio/relay-editor.mjs';
import { inspectManualImageMap } from '../content-design/image-authoring.mjs';
import { editContentStructure } from '../content-design/structure.mjs';

const missionId = 'nearby-shore';
const mapFor = (p) =>
  p.maps.find(
    (map) => map.id === p.missions[0].map.id && map.revision === p.missions[0].map.revision,
  );
const command = (p, action, rest = {}) => ({
  action,
  expectedMap: dataIdentity(mapFor(p)),
  expectedMission: dataIdentity(p.missions[0]),
  ...rest,
});
function starter() {
  const p = createStarterProject();
  p.missions[0].objectives = [
    { id: 'relay', x: 20.5, y: 10.5, required: true, hidden: false },
    { id: 'alternate', x: 22.5, y: 12.5, required: false, hidden: false },
  ];
  return p;
}
const enable = (p = starter()) => editContentRelay(p, missionId, command(p, 'enable'));
const add = (p) =>
  editContentRelay(
    p,
    missionId,
    command(p, 'add', { id: 'shortcut', gate: { x: 40, y: 10, w: 2, h: 3, objectiveId: 'relay' } }),
  );

test('manual image geometry preserves relay editions and links; overlapping trace cannot replace a gate', () => {
  const source = add(enable()),
    before = structuredClone(source);
  const { candidate } = inspectManualImageMap(source, missionId, [
    { surface: 'slow', x: 45, y: 22, w: 3, h: 3 },
  ]);
  assert.equal(mapFor(candidate).format, 'MapDesignV2');
  assert.deepEqual(mapFor(candidate).gates, mapFor(before).gates);
  assert.deepEqual(candidate.missions[0].relayLinks, before.missions[0].relayLinks);
  assert.notEqual(candidate.missions[0].map.revision, before.missions[0].map.revision);
  for (const surface of ['foundations', 'walls', 'slow', 'lethal'])
    assert.throws(
      () => inspectManualImageMap(source, missionId, [{ surface, x: 40, y: 10, w: 2, h: 3 }]),
      /overlap/,
    );
  assert.deepEqual(source, before);
  assert.equal(JSON.stringify(candidate).includes('data:image'), false);
});

test('duplicating a relay campaign keeps local objective links while later edits fork only the copy', () => {
  const source = add(enable());
  const next = editContentStructure(source, {
    action: 'duplicate',
    kind: 'campaign',
    sourceId: 'horizon-school',
    id: 'relay-copy',
    name: 'Relay copy',
  });
  const campaign = next.campaigns.find((c) => c.id === 'relay-copy'),
    copy = next.missions.find((m) => m.id === campaign.missionIds[0]);
  assert.notEqual(copy.id, missionId);
  assert.deepEqual(copy.map, source.missions[0].map);
  assert.deepEqual(copy.relayLinks, source.missions[0].relayLinks);
  const modified = editContentRelay(next, copy.id, {
    action: 'replace',
    id: 'shortcut',
    expectedMap: dataIdentity(mapFor(next)),
    expectedMission: dataIdentity(copy),
    gate: { x: 42, y: 10, w: 2, h: 3, objectiveId: 'alternate' },
  });
  const compiled = compileContentProject(modified);
  assert.deepEqual(
    resolveMission(compiled, missionId).level.relayGates,
    resolveMission(compileContentProject(source), missionId).level.relayGates,
  );
  assert.equal(
    resolveMission(compiled, copy.id).level.relayGates.gates[0].objectiveId,
    'alternate',
  );
  assert.throws(
    () =>
      editContentObjective(source, missionId, {
        action: 'replace',
        id: 'relay',
        objective: { ...source.missions[0].objectives[0], hidden: true },
      }),
    /must be visible/,
  );
});

test('relay opt-in forks one mission/map, preserves historical consumers and supports Undo/Redo', () => {
  const source = starter();
  source.missions.push({ ...structuredClone(source.missions[0]), id: 'shared' });
  const before = structuredClone(source),
    history = createDraftHistory(source);
  const enabled = enable(source),
    next = add(enabled);
  assert.deepEqual(source, before);
  assert.deepEqual(next.maps[0], before.maps[0]);
  assert.deepEqual(next.missions[1], before.missions[1]);
  assert.equal(next.missions[0].format, 'MissionDesignV2');
  assert.equal(mapFor(next).format, 'MapDesignV2');
  assert.equal(
    resolveMission(compileContentProject(next), missionId).level.version,
    'xonix-level.v6',
  );
  assert.equal(
    resolveMission(compileContentProject(next), 'shared').level.version,
    'xonix-level.v5',
  );
  history.replace(next);
  assert.deepEqual(history.undo(), before);
  assert.deepEqual(history.redo(), next);
});

test('gate updates and objective relinks preserve old geometry and protect dependent deletion', () => {
  const source = add(enable()),
    oldMap = structuredClone(mapFor(source));
  assert.throws(
    () => editContentObjective(source, missionId, { action: 'remove', id: 'relay' }),
    /controls relay gates: shortcut/,
  );
  const next = editContentRelay(
    source,
    missionId,
    command(source, 'replace', {
      id: 'shortcut',
      gate: { x: 42, y: 10, w: 2, h: 4, objectiveId: 'alternate' },
    }),
  );
  assert(next.maps.some((map) => dataIdentity(map) === dataIdentity(oldMap)));
  assert.equal(next.missions[0].relayLinks[0].objectiveId, 'alternate');
  const removedObjective = editContentObjective(next, missionId, { action: 'remove', id: 'relay' });
  const removedGate = editContentRelay(
    removedObjective,
    missionId,
    command(removedObjective, 'remove', { id: 'shortcut' }),
  );
  assert.equal(mapFor(removedGate).gates.length, 0);
  assert.equal(removedGate.missions[0].relayLinks.length, 0);
  assert.equal(
    removedGate.missions[0].format,
    'MissionDesignV2',
    'Removal never silently downgrades editions.',
  );
  assert.equal(
    editContentObjective(removedGate, missionId, { action: 'remove', id: 'alternate' }).missions[0]
      .objectives.length,
    0,
  );
});

test('relay changes reject stale pins, missing links, collisions and unqualified modes atomically', () => {
  const p = enable(),
    before = structuredClone(p);
  const good = command(p, 'add', {
    id: 'shortcut',
    gate: { x: 40, y: 10, w: 2, h: 3, objectiveId: 'relay' },
  });
  for (const change of [
    { expectedMap: 'stale' },
    { expectedMission: 'stale' },
    { action: 'remove' },
    { gate: { ...good.gate, objectiveId: 'missing' } },
    { gate: { ...good.gate, x: 30, y: 15 } },
    { gate: { ...good.gate, x: 0 } },
    { gate: { ...good.gate, script: 'open-all' } },
    { publish: true },
  ]) {
    assert.throws(() => editContentRelay(p, missionId, { ...good, ...change }));
    assert.deepEqual(p, before);
  }
  assert.throws(() => add(starter()), /Explicitly enable/);
  assert.throws(() => enable(p), /already uses/);
  const added = add(p);
  assert.throws(() => add(added), /already exists/);
  assert.throws(() => editContentRelay(added, missionId, good), /changed/);
  const team = createTeamOpeningCandidates();
  assert.throws(
    () => editContentRelay(team, 'twin-landings', command(team, 'enable')),
    /not qualified for Team/,
  );
});

function uiFixture() {
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
      disabled: false,
      textContent: '',
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
  let source = starter(),
    cancelled = false;
  const editor = createRelayEditor({
    document,
    getSource: () => source,
    getMission: () => source.missions[0],
    apply(next) {
      if (cancelled) return false;
      source = next;
      editor.sync();
      return true;
    },
  });
  editor.sync();
  return {
    editor,
    node: (id) => document.getElementById(`relay-${id}`),
    source: () => source,
    update(next, sync = true) {
      source = next;
      if (sync) editor.sync();
    },
    cancel() {
      cancelled = true;
    },
  };
}
function fillGate(f) {
  f.node('id').value = 'shortcut';
  for (const [key, value] of Object.entries({ x: 40, y: 10, w: 2, h: 3 }))
    f.node(key).value = value;
  f.node('objective').value = 'relay';
}
const submit = (f) => f.node('form').onsubmit({ preventDefault() {} });

test('relay controls explicitly enable an edition, add/relink a gate and require a fresh two-action removal', () => {
  const f = uiFixture();
  assert.equal(f.node('tools').disabled, true);
  f.node('enable').onclick();
  assert.equal(f.node('enable').disabled, true);
  assert.equal(f.node('tools').disabled, false);
  fillGate(f);
  submit(f);
  assert.equal(mapFor(f.source()).gates.length, 1);
  assert.equal(f.node('id').disabled, true);
  f.node('objective').value = 'alternate';
  submit(f);
  assert.equal(f.source().missions[0].relayLinks[0].objectiveId, 'alternate');
  f.node('x').value = '0';
  submit(f);
  assert.match(f.node('result').textContent, /Not applied/);
  assert.equal(mapFor(f.source()).gates[0].x, 40);
  f.node('select').onchange();
  f.node('remove').onclick();
  f.node('form').oninput();
  f.node('remove').onclick();
  assert.equal(mapFor(f.source()).gates.length, 1);
  f.node('remove').onclick();
  assert.equal(mapFor(f.source()).gates.length, 0);
  assert.equal(f.source().missions[0].objectives.length, 2);
});

test('relay controls reject stale same-revision source, respect cancelled adoption and disable Team', () => {
  const f = uiFixture();
  f.node('enable').onclick();
  fillGate(f);
  const changed = f.source();
  changed.missions[0].objectives[0].x = 21.5;
  f.update(changed, false);
  submit(f);
  assert.match(f.node('result').textContent, /context changed/);
  assert.equal(mapFor(f.source()).gates.length, 0);
  f.editor.sync();
  fillGate(f);
  f.cancel();
  submit(f);
  assert.equal(mapFor(f.source()).gates.length, 0);
  f.update(createTeamOpeningCandidates());
  assert.equal(f.node('enable').disabled, true);
  assert.equal(f.node('tools').disabled, true);
  assert.match(f.node('qualification').textContent, /not yet qualified/);
  f.update({ ...starter(), missions: [], campaigns: [], packs: [] });
  assert.equal(f.node('tools').disabled, true);
});
