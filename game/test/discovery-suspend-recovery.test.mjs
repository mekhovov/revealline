import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from 'acorn';
import { createStarterProject } from '../content-design/starter.mjs';
import { createDiscoveryEditor } from '../studio/discovery-editor.mjs';
import { createCampaignFeedbackEditor } from '../studio/campaign-feedback-editor.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

function fixture() {
  const document = new Document();
  const source = createStarterProject();
  const window = new Events();
  window.URL = { createObjectURL: () => 'blob:preview', revokeObjectURL() {} };
  window.setTimeout = setTimeout;
  for (const id of [
    'tools',
    'campaign',
    'beat',
    'reward',
    'layout',
    'finale',
    'locale',
    'form',
    'show',
    'preview',
    'result',
    'import',
  ]) {
    const node = document.createElement(
      id === 'import'
        ? 'input'
        : ['campaign', 'beat', 'reward', 'layout', 'finale', 'locale'].includes(id)
          ? 'select'
          : 'div',
    );
    node.id = 'discovery-' + id;
    document.body.append(node);
  }
  let writes = 0;
  const editor = createDiscoveryEditor({
    document,
    window,
    getSource: () => source,
    getMission: () => source.missions[0],
    apply: () => {
      writes++;
    },
  });
  editor.sync();
  return { document, editor, writes: () => writes };
}

test('Discovery suspension keeps the same unsaved controls and does not resume previews on unchanged sync', () => {
  const h = fixture();
  const fields = h.document.querySelectorAll('input,textarea,select');
  fields.forEach((field, i) => {
    if (field.type !== 'file') field.value = 'pending-' + i;
  });
  const snapshot = fields.map((field) => ({
    field,
    value: field.value,
    checked: field.checked,
  }));
  h.editor.suspend();
  h.editor.suspend();
  h.editor.sync();
  for (const { field, value, checked } of snapshot) {
    assert.equal(field.isConnected, true);
    assert.equal(field.value, value);
    assert.equal(field.checked, checked);
  }
  assert.equal(h.writes(), 0);
  assert.equal(h.document.getElementById('discovery-preview').children.length, 0);
  h.editor.dispose();
  h.editor.dispose();
});

for (const rejected of [false, true]) {
  test(
    'Discovery suspension retires a pending sidecar ' + (rejected ? 'failure' : 'success'),
    async () => {
      const h = fixture();
      const input = h.document.getElementById('discovery-import');
      const result = h.document.getElementById('discovery-result');
      const field = h.document.querySelector('[data-exploration-field="json"]');
      let resolve, reject;
      input.files = [
        {
          size: 2,
          text: () =>
            new Promise((yes, no) => {
              resolve = yes;
              reject = no;
            }),
        },
      ];
      const pending = input.onchange();
      field.value = 'unsaved exploration text';
      result.textContent = 'newer owner';
      h.editor.suspend();
      if (rejected) reject(new Error('late read failure'));
      else resolve('[]');
      await pending;
      assert.equal(field.value, 'unsaved exploration text');
      assert.equal(result.textContent, 'newer owner');
      assert.equal(h.writes(), 0);
      h.editor.dispose();
    },
  );
}

for (const kind of ['asset-handoff', 'audio-handoff', 'video-handoff', 'cosmetic']) {
  test(kind + ' pending packet cannot repaint after parent suspension', async () => {
    const h = fixture();
    const input = h.document.querySelector('[data-' + kind + '-field="packet"]');
    const root = input.closest('fieldset');
    let resolve;
    input.files = [
      {
        size: 1,
        text: () =>
          new Promise((done) => {
            resolve = done;
          }),
      },
    ];
    const pending = input.onchange();
    const before = root.textContent;
    h.editor.suspend();
    resolve('{');
    await pending;
    assert.equal(input.isConnected, true);
    assert.equal(root.textContent, before);
    assert.equal(h.writes(), 0);
    h.editor.dispose();
  });
}

test('suspending an audition preserves its draft and vetoes delayed audio enable', async () => {
  const document = new Document();
  const container = document.createElement('section');
  document.body.append(container);
  const source = createStarterProject();
  let release,
    played = 0,
    disposed = 0;
  const editor = createCampaignFeedbackEditor({
    container,
    window: new Events(),
    getSource: () => source,
    getCampaignId: () => source.campaigns[0].id,
    getLocale: () => 'en',
    apply: () => assert.fail('suspension must not apply a draft'),
    createSound: () => ({
      configure() {},
      enable: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
      event: () => played++,
      dispose: () => disposed++,
    }),
  });
  editor.sync();
  const field = container.querySelector('[data-campaign-feedback-field="en"]');
  field.value = 'Unsaved feedback';
  const pending = container.querySelector('[data-campaign-feedback-action="audition"]').onclick();
  editor.suspend();
  release(true);
  await pending;
  assert.equal(played, 0);
  assert.equal(disposed, 1);
  assert.equal(field.value, 'Unsaved feedback');
  assert.equal(field.isConnected, true);
  editor.dispose();
});

for (const host of ['content', 'company']) {
  for (const persisted of [true, false]) {
    test(
      host + ' actual pagehide callback ' + (persisted ? 'suspends' : 'disposes') + ' Discovery',
      async () => {
        const path =
          host === 'content' ? '../studio/studio.mjs' : '../../authoring/company-studio/studio.mjs';
        const source = await readFile(new URL(path, import.meta.url), 'utf8');
        const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
        const callbacks = [];
        function visit(node) {
          if (!node || typeof node !== 'object') return;
          if (
            node.type === 'CallExpression' &&
            node.callee?.object?.name === 'window' &&
            node.callee?.property?.name === 'addEventListener' &&
            node.arguments[0]?.value === 'pagehide'
          )
            callbacks.push(node.arguments[1]);
          for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(visit);
            else if (value && typeof value === 'object') visit(value);
          }
        }
        visit(tree);
        assert.equal(callbacks.length, 1, 'one owned pagehide handler');
        const calls = [];
        const call = (name) => () => calls.push(name);
        const context = vm.createContext({
          discoveryEditor: {
            suspend: call('discovery.suspend'),
            dispose: call('discovery.dispose'),
          },
          lessonEditor: { suspend: call('lesson.suspend'), dispose: call('lesson.dispose') },
          previewController: { abort: call('preview.abort') },
          retirePreview: call('preview.retire'),
          sourceDiscard: { destroy: call('discard.destroy') },
          stopSpatialReviews: call('spatial.stop'),
          stopGameplayTuning: call('tuning.stop'),
          gameplayTuning: { dispose: call('tuning.dispose') },
          stopMapLocale: call('locale.stop'),
          paintedPreview: {},
          imageWorkbench: { dispose: call('image.dispose') },
          clearTimeout: call('timer.clear'),
          saveTimer: 1,
        });
        const callback = callbacks[0];
        vm.runInContext(
          '(' + source.slice(callback.start, callback.end) + ')',
          context,
        )({ persisted });
        assert.equal(calls.filter((value) => value === 'discovery.suspend').length, 1);
        assert.equal(calls.includes('discovery.dispose'), !persisted);
        if (host === 'company') {
          assert.equal(context.previewController, null);
          assert.equal(calls.includes('lesson.suspend'), persisted);
          assert.equal(calls.includes('lesson.dispose'), !persisted);
        }
      },
    );
  }
}
