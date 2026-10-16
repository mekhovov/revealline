import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getLocale, setLocale, t } from '../i18n/index.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { createImageWorkbench } from '../studio/image-workbench.mjs';
import { createTraceRecovery } from '../studio/trace-recovery.mjs';
import { imageTraceOwner } from '../content-design/image-trace.mjs';
import { validateReferenceCrop } from '../content-design/image-authoring.mjs';
import { createImageTraceBackend } from '../content-design/image-trace-storage.mjs';
import { editorErrorText } from '../studio/editor-copy.mjs';
import { Document } from './helpers/couch-dom.mjs';

const png = await readFile(
  new URL('../content-design/assets/horizon-r1/first-return.png', import.meta.url),
);
const reference = {
  name: 'My authored reference.png',
  dataUrl: `data:image/png;base64,${png.toString('base64')}`,
};
const source = createStarterProject();
const savedTrace = () => ({
  format: 'ContentImageTraceV1',
  ...imageTraceOwner(source, 'nearby-shore'),
  reference,
  crop: { x: 0, y: 0, w: 1774, h: 887 },
  rectangles: [{ surface: 'foundations', x: 12, y: 12, w: 4, h: 3 }],
  visible: true,
});
const settle = () => new Promise((resolve) => setImmediate(resolve));
function nodes(ids) {
  const document = new Document();
  for (const id of ids.split(' ')) {
    const node = document.createElement(id === 'reference-preview' ? 'canvas' : 'input');
    node.id = id;
    document.body.append(node);
  }
  return { document, $: (id) => document.getElementById(id) };
}

test('manual inspection keeps its exact candidate and pending fields while queue, status and canvas refresh', async () => {
  const previous = getLocale(),
    f = nodes(
      'reference-status reference-queue reference-file reference-show reference-tools reference-apply reference-play reference-preview reference-crop reference-clear reference-queue-add reference-queue-undo reference-inspect crop-x crop-y crop-w crop-h surface x y w h',
    );
  let reads = 0,
    changes = 0,
    applies = 0,
    plays = 0,
    draws = 0,
    disposed = 0;
  const context = new Proxy(
    {},
    {
      get: (target, key) =>
        target[key] ??
        (() => {
          draws++;
        }),
      set: (target, key, value) => {
        target[key] = value;
        return true;
      },
    },
  );
  f.$('reference-preview').width = 1008;
  f.$('reference-preview').getContext = () => context;
  const api = createImageWorkbench({
    document: f.document,
    getSource() {
      reads++;
      return source;
    },
    getMission() {
      reads++;
      return source.missions[0];
    },
    getDifficulty() {
      reads++;
      return 'expert';
    },
    redraw() {},
    onChange() {
      changes++;
    },
    apply() {
      applies++;
      return true;
    },
    play() {
      plays++;
    },
    loadReference: async () => ({
      image: {},
      width: 1774,
      height: 887,
      source: reference,
      dispose() {
        disposed++;
      },
    }),
  });
  api.sync();
  f.$('reference-file').files = [{ name: reference.name }];
  await f.$('reference-file').onchange();
  f.$('surface').value = 'foundations';
  for (const [key, value] of Object.entries({ x: 12, y: 12, w: 4, h: 3 }))
    f.$(key).value = String(value);
  await f.$('reference-queue-add').onclick();
  await f.$('reference-inspect').onclick();
  const original = JSON.stringify(source),
    snapshot = JSON.stringify(api.snapshot());
  f.$('x').value = '14';
  f.$('x').selectionStart = 0;
  f.$('x').selectionEnd = 1;
  f.$('x').focus();
  f.$('reference-queue').scrollTop = 30;
  try {
    for (const locale of ['uk', 'en', 'uk']) {
      const expectedReads = reads,
        expectedChanges = changes,
        expectedDraws = draws;
      setLocale(locale, { persist: false });
      assert.equal(reads, expectedReads);
      assert.equal(changes, expectedChanges);
      assert.equal(applies, 0);
      assert.equal(plays, 0);
      assert.equal(disposed, 0);
      assert(draws > expectedDraws);
      assert.equal(f.$('x').value, '14');
      assert.equal(f.$('x').selectionStart, 0);
      assert.equal(f.$('x').selectionEnd, 1);
      assert.equal(f.document.activeElement, f.$('x'));
      assert.equal(f.$('reference-queue').scrollTop, 30);
      assert.equal(f.$('reference-apply').disabled, false);
      assert.equal(f.$('reference-play').disabled, false);
      assert.equal(f.$('reference-preview').hidden, false);
      assert.equal(JSON.stringify(api.snapshot()), snapshot);
      assert.equal(JSON.stringify(source), original);
      assert.match(f.$('reference-queue').textContent, locale === 'uk' ? /основ/i : /Foundation/);
      assert.match(
        f.$('reference-status').textContent,
        locale === 'uk' ? /Перевірено 1 прямокутник/ : /Inspected 1 rectangle/,
      );
    }
    await f.$('reference-play').onclick();
    assert.equal(plays, 1);
    assert.equal(applies, 0);
    await f.$('reference-apply').onclick();
    assert.equal(applies, 1);
    assert.equal(api.hasPending(), false);
  } finally {
    api.dispose();
    setLocale(previous, { persist: false });
  }
});

test('tracing recovery translates a pending read, saved state, conflict choice and export without new IO', async () => {
  const previous = getLocale(),
    f = nodes(
      'trace-status trace-restore trace-replace trace-export-saved trace-session-restore trace-read trace-export trace-import trace-import-restore',
    );
  let resolve,
    reads = 0,
    writes = 0,
    snapshots = 0,
    restores = 0,
    exports = 0,
    current = savedTrace();
  const recovery = createTraceRecovery({
    document: f.document,
    getSource: () => source,
    getMission: () => source.missions[0],
    backend: {
      read() {
        reads++;
        return new Promise((yes) => {
          resolve = yes;
        });
      },
      async save() {
        writes++;
        throw new Error('Unexpected save');
      },
    },
    workbench: {
      snapshot() {
        snapshots++;
        return current;
      },
      async restore() {
        restores++;
      },
    },
    exportFile: async () => {
      exports++;
      return { status: 'requested', message: 'Ignored platform implementation prose' };
    },
  });
  recovery.sync();
  try {
    setLocale('uk', { persist: false });
    assert.equal(reads, 1);
    assert.equal(f.$('trace-status').textContent, t('tools:studio.trace.reading'));
    resolve({ revision: 7, trace: savedTrace() });
    await settle();
    const statusValues = { revision: 7, name: reference.name, count: 1 };
    for (const locale of ['en', 'uk']) {
      setLocale(locale, { persist: false });
      assert.equal(f.$('trace-status').textContent, t('tools:studio.trace.saved', statusValues));
      assert.equal(reads, 1);
      assert.equal(writes, 0);
      assert.equal(snapshots, 0);
      assert.equal(restores, 0);
    }
    current = { ...savedTrace(), visible: false };
    recovery.changed();
    const snapshotCalls = snapshots;
    assert.equal(recovery.hasUnsaved(), true);
    for (const locale of ['en', 'uk']) {
      setLocale(locale, { persist: false });
      assert.equal(
        f.$('trace-status').textContent,
        t('tools:studio.trace.unsaved', { revision: 7, count: 1 }),
      );
      assert.equal(f.$('trace-replace').disabled, false);
      assert.equal(writes, 0);
      assert.equal(snapshots, snapshotCalls);
    }
    await f.$('trace-export').onclick();
    assert.equal(exports, 1);
    const exportCalls = snapshots;
    for (const locale of ['en', 'uk']) {
      setLocale(locale, { persist: false });
      assert.equal(
        f.$('trace-status').textContent,
        t('tools:studio.trace.exported', { message: t('common:export.requested') }),
      );
      assert.equal(exports, 1);
      assert.equal(snapshots, exportCalls);
      assert.equal(writes, 0);
      assert.equal(restores, 0);
    }
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('tracing error descriptors keep original Error types and English diagnostics', async () => {
  const previous = getLocale();
  try {
    setLocale('uk', { persist: false });
    assert.throws(
      () => validateReferenceCrop({ x: 0, y: 0, w: 2, h: 2 }, 1, 1),
      (error) => {
        assert.equal(error.constructor, TypeError);
        assert.equal(
          error.message,
          'Crop must be a whole-pixel rectangle inside the reference picture.',
        );
        assert.equal(error.localization.key, 'errors:studio.image.crop');
        assert(Object.isFrozen(error.localization));
        assert(!Object.keys(error).includes('localization'));
        assert.equal(editorErrorText(error), t('errors:studio.image.crop'));
        return true;
      },
    );
    const backend = createImageTraceBackend({ indexedDB: null });
    await assert.rejects(backend.read('my-journey', 'nearby-shore'), (error) => {
      assert.equal(error.constructor, Error);
      assert.equal(error.message, 'Tracing storage is unavailable.');
      assert.equal(error.localization.key, 'errors:studio.trace.storageUnavailable');
      setLocale('en', { persist: false });
      assert.equal(editorErrorText(error), error.message);
      setLocale('uk', { persist: false });
      assert.equal(editorErrorText(error), t('errors:studio.trace.storageUnavailable'));
      return true;
    });
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('all image and tracing count messages use Ukrainian rectangle forms', () => {
  const previous = getLocale();
  try {
    setLocale('uk', { persist: false });
    for (const count of [0, 1, 2, 5, 11, 21, 22, 1.5])
      for (const key of [
        'tools:studio.image.inspected',
        'tools:studio.trace.unsaved',
        'tools:studio.trace.saved',
        'tools:studio.trace.imported',
      ]) {
        const text = t(key, {
          count,
          foundations: 25,
          eligible: 2400,
          summary: '',
          diagnostics: '',
          revision: 3,
          name: 'Author.png',
          project: 'my-journey',
          mission: 'nearby-shore',
        });
        const form = {
          one: 'прямокутник',
          few: 'прямокутники',
          many: 'прямокутників',
          other: 'прямокутника',
        }[new Intl.PluralRules('uk').select(count)];
        assert(text.includes(form));
        assert.doesNotMatch(text, /tools:|\{\{/);
      }
  } finally {
    setLocale(previous, { persist: false });
  }
});
