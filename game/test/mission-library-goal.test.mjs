import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { attachJourneyChooser } from '../ui/journey-chooser.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { createStudioPreviewSession } from '../studio-preview-session.mjs';

function setup({
  mode = 'solo',
  storage = memoryStorage(),
  editionId = 'museum',
  availability = () => ({ state: 'ready' }),
  prepare = () => {
    throw Error('Pinning cannot prepare');
  },
} = {}) {
  const doc = new Document();
  doc.defaultView = Object.assign(new Events(), doc.defaultView);
  const source = {
    id: 'test',
    collection: 'Journey',
    editionId: 'test-r1',
    edition: 'Test',
    entries: [
      {
        id: 'first',
        name: 'First',
        campaignKey: 'campaign',
        campaignTitle: 'Campaign',
        levelIndex: 0,
        modes: ['solo', 'versus', 'team'],
        tags: [],
      },
    ],
    describe: (value) => value,
    availability,
    prepare,
    launch: () => {
      throw Error('Goal navigation cannot launch');
    },
  };
  const library = createMissionLibrary([source]),
    chooser = attachJourneyChooser({
      document: doc,
      library,
      mode,
      goalPreferenceOptions: { editionId, getStorage: () => storage },
    }),
    opener = doc.createElement('button');
  doc.body.append(opener);
  chooser.open(opener);
  return { doc, source, library, chooser, storage, opener, $: (id) => doc.getElementById(id) };
}

for (const mode of ['solo', 'versus', 'team'])
  test(`${mode} pins the keyboard-focused mission and controller Find reveals without launching, preparing or changing other modes`, () => {
    const f = setup({ mode });
    const id = f.doc.activeElement.dataset.missionId;
    f.$('journey-goal-pin').focus();
    f.$('journey-goal-pin').click();
    const key = `revealline.mission-goal.v1.museum.${mode}`;
    assert.equal(JSON.parse(f.storage.getItem(key)).missionId, id);
    f.$('journey-search').value = 'none';
    f.$('journey-search').emit('input');
    assert.equal(f.$('journey-cards').children.length, 0);
    const navigation = attachControllerNavigation({
      document: f.doc,
      getRoot: () => f.$('journey-chooser'),
      getScope: () => 'missions',
    });
    f.$('journey-goal-find').focus();
    navigation.handle({ confirmStart: true });
    navigation.handle({ confirmCommit: true });
    assert.equal(f.doc.activeElement.dataset.missionId, id);
    assert.equal(f.$('journey-search').value, '');
    const otherMode = mode === 'solo' ? 'team' : 'solo';
    f.$('journey-mode').value = otherMode;
    f.$('journey-mode').emit('change');
    assert.equal(f.$('journey-goal-find').disabled, true);
    f.$('journey-mode').value = mode;
    f.$('journey-mode').emit('change');
    assert.equal(f.$('journey-goal-find').disabled, false);
    f.$('journey-goal-clear').click();
    assert.equal(JSON.parse(f.storage.getItem(key)).missionId, null);
    const choose = f.$('journey-goal-pin').onclick;
    f.chooser.close();
    const writes = f.storage.writes.length;
    choose();
    assert.equal(f.storage.writes.length, writes);
    navigation.destroy();
    f.chooser.destroy();
    assert.equal(f.doc.defaultView.listeners.get('storage').size, 0);
  });

test('omitted goal remains unavailable without loading hidden content and returns when its exact row is restored', () => {
  const f = setup({ availability: () => ({ state: 'download', bytes: 12 }) });
  const id = f.doc.activeElement.dataset.missionId;
  f.$('journey-goal-pin').click();
  f.library.register({ ...f.source, entries: [] });
  assert.equal(f.$('journey-goal-find').disabled, true);
  assert.equal(f.$('journey-goal-clear').disabled, false);
  f.$('journey-goal-find').onclick();
  assert.equal(f.$('journey-cards').children.length, 0);
  assert.equal(
    JSON.parse(f.storage.getItem('revealline.mission-goal.v1.museum.solo')).missionId,
    id,
  );
  f.library.register(f.source);
  assert.equal(f.$('journey-goal-find').disabled, false);
  f.$('journey-goal-find').click();
  assert.equal(f.doc.activeElement.dataset.missionId, id);
  f.chooser.destroy();
});

test('a goal action cancels an older download intent without starting its mission after completion', async () => {
  let finish, signal;
  const f = setup({
    availability: () => ({ state: 'download', bytes: 12 }),
    prepare: (_row, options) => {
      signal = options.signal;
      return new Promise((resolve) => (finish = resolve));
    },
  });
  f.doc.activeElement.click();
  await new Promise((resolve) => setImmediate(resolve));
  f.$('journey-goal-pin').onclick();
  assert.equal(signal.aborted, true);
  finish({});
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.$('journey-chooser').open, true);
  f.chooser.destroy();
});

test('Studio goal preferences are isolated and fresh on the next preview visit', () => {
  const session = createStudioPreviewSession('http://localhost/game/?studio-preview=1'),
    next = createStudioPreviewSession('http://localhost/game/?studio-preview=1');
  const f = setup({ storage: session.storage });
  f.$('journey-goal-pin').click();
  assert.equal(f.$('journey-goal-find').disabled, false);
  f.chooser.destroy();
  const reopened = setup({ storage: next.storage });
  assert.equal(reopened.$('journey-goal-find').disabled, true);
  reopened.chooser.destroy();
});

test('goal actions share a dedicated responsive group without inline layout overrides', () => {
  const f = setup(),
    goal = f.$('journey-goal'),
    actions = f.$('journey-goal-pin').parentElement;
  assert.equal(actions.className, 'journey-goal-actions');
  assert.equal(actions.parentElement, goal);
  assert.equal(goal.getAttribute('style'), null);
  assert.equal(f.$('journey-goal-status').getAttribute('style'), null);
  f.chooser.destroy();
});
