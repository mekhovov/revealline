import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createStudioReviewPane } from '../../authoring/company-studio/review-pane.mjs';
import { STUDIO_REVIEW_CHECKS } from '../../authoring/company-studio/review-model.mjs';

const html = await readFile(
  new URL('../../authoring/company-studio/index.html', import.meta.url),
  'utf8',
);
function fixture() {
  const elements = new Map(),
    exports = [],
    messages = [];
  class Element {
    constructor(tag = 'div') {
      this.tag = tag;
      this.children = [];
      this.value = '';
      this.files = [];
    }
    set id(value) {
      this._id = value;
      elements.set(value, this);
    }
    get id() {
      return this._id;
    }
    append(...nodes) {
      this.children.push(...nodes);
      if (this.tag === 'select' && !this.value) this.value = this.children[0]?.value ?? '';
    }
    replaceChildren(...nodes) {
      this.children = [];
      if (this.tag === 'select') this.value = '';
      this.append(...nodes);
    }
    focus() {}
  }
  for (const [, tag, id] of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"/g)) {
    const el = new Element(tag);
    el.id = id;
  }
  const documentRef = {
    getElementById: (id) => {
      assert(elements.has(id), id);
      return elements.get(id);
    },
    createElement: (tag) => new Element(tag),
  };
  const pane = createStudioReviewPane({
    documentRef,
    download: (name, packet) => exports.push({ name, packet }),
    status: (message, error) => messages.push({ message, error }),
  });
  const context = {
    editionId: 'acme-public',
    editionName: 'Acme',
    artifact: { path: 'edition-build.json', bytes: 12, sha256: 'a'.repeat(64) },
    missions: [
      {
        id: 'acme-01',
        name: 'First scene',
        campaignName: 'Acme campaign',
        picture: null,
        sources: [],
        notice: 'Fictional illustration.',
      },
    ],
  };
  const $ = (id) => elements.get(id);
  const save = async () => {
    $('review-observer').value = 'Synthetic fixture observer';
    $('review-width').value = '1280';
    $('review-height').value = '720';
    $('review-motion').value = 'standard';
    $('review-scene').value = 'initial';
    for (const { id } of STUDIO_REVIEW_CHECKS) {
      $(`review-check-${id}`).value = 'not-observed';
      $(`review-note-${id}`).value = '';
    }
    $('review-check-identity-story').value = 'observed';
    $('review-note-identity-story').value = 'Synthetic fixture only, not a human approval.';
    $('review-notes').value = 'Keep this original observation.';
    await $('review-form').onsubmit({ preventDefault() {} });
  };
  return { pane, context, $, exports, messages, save };
}

test('invalidation preserves old observations for export and never rebinds them to a new artifact', async () => {
  const f = fixture();
  f.pane.adopt(f.context);
  await f.save();
  const staleRemove = f.$('review-observation-list').children[0].children[1];
  f.pane.invalidate();
  staleRemove.onclick();
  assert.equal(f.$('review-observation-list').children[0].children[1].disabled, true);
  assert.equal(f.$('review-fields').disabled, true);
  assert.equal(f.$('export-observations').disabled, false);
  await f.$('export-observations').onclick();
  assert.equal(f.exports[0].packet.artifact.sha256, 'a'.repeat(64));
  assert.equal(f.exports[0].packet.observations[0].notes, 'Keep this original observation.');
  const next = { ...f.context, artifact: { ...f.context.artifact, sha256: 'b'.repeat(64) } };
  f.pane.adopt(next);
  assert.equal(f.$('review-fields').disabled, true);
  assert.equal(f.$('review-new-artifact').hidden, false);
  await f.save();
  assert.equal(f.messages.at(-1).error, true);
  await f.$('export-observations').onclick();
  assert.equal(f.exports[1].packet.artifact.sha256, 'a'.repeat(64));
  f.$('review-new-artifact').onclick();
  assert.equal(f.$('review-fields').disabled, false);
  assert.equal(f.$('export-observations').disabled, true);
  await f.save();
  await f.$('export-observations').onclick();
  assert.equal(f.exports.at(-1).packet.artifact.sha256, 'b'.repeat(64));
});

test('same-artifact revalidation retains notes while duplicate imports do not replace them', async () => {
  const f = fixture();
  f.pane.adopt(f.context);
  await f.save();
  await f.$('export-observations').onclick();
  const text = JSON.stringify(f.exports[0].packet);
  f.pane.invalidate();
  f.pane.adopt(f.context);
  f.$('import-observations').files = [{ size: text.length, text: async () => text }];
  await f.$('import-observations').onchange();
  assert.match(f.messages.at(-1).message, /Duplicate/);
  await f.$('export-observations').onclick();
  assert.deepEqual(f.exports.at(-1).packet, f.exports[0].packet);
});

test('late import cannot adopt observations after invalidation even if the same artifact returns', async () => {
  const f = fixture();
  f.pane.adopt(f.context);
  await f.save();
  await f.$('export-observations').onclick();
  let finish;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  f.$('import-observations').files = [{ size: 100, text: () => pending }];
  const operation = f.$('import-observations').onchange();
  f.pane.invalidate();
  f.pane.adopt(f.context);
  const messagesBeforeFinish = f.messages.length;
  finish(JSON.stringify(f.exports[0].packet));
  await operation;
  assert.equal(f.messages.length, messagesBeforeFinish);
  await f.$('export-observations').onclick();
  assert.equal(f.exports.at(-1).packet.observations.length, 1);
});

test('unsaved form notes survive invalidation and require explicit discard for another artifact', () => {
  const f = fixture();
  f.pane.adopt(f.context);
  f.$('review-notes').value = 'Unfinished manual observation';
  f.$('review-form').oninput();
  f.pane.invalidate();
  f.pane.adopt({ ...f.context, artifact: { ...f.context.artifact, sha256: 'b'.repeat(64) } });
  assert.equal(f.$('review-notes').value, 'Unfinished manual observation');
  assert.equal(f.$('review-new-artifact').hidden, false);
  assert.equal(f.$('review-fields').disabled, true);
});

test('late rejected file reads do not overwrite the current artifact status', async () => {
  const f = fixture();
  f.pane.adopt(f.context);
  let fail;
  f.$('import-generation-notes').files = [
    {
      size: 100,
      text: () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    },
  ];
  const operation = f.$('import-generation-notes').onchange();
  f.pane.invalidate();
  const count = f.messages.length;
  fail(new Error('old file read failed'));
  await operation;
  assert.equal(f.messages.length, count);
});
