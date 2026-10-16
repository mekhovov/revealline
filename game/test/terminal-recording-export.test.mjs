import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { attachTerminalRecordingExport } from '../ui/terminal-recording-export.mjs';
import { exportJSONFile } from '../platform.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture(t, { clipboard = null, exportFile } = {}) {
  const document = new Document(),
    container = document.createElement('div'),
    status = document.createElement('p');
  container.id = 'terminal-recording-copy';
  document.body.append(container, status);
  const state = { owner: { status: 'won' }, downloads: [], clicks: [], selected: 0 },
    panel = attachTerminalRecordingExport({
      document,
      container,
      status,
      getOwner: () => state.owner,
      isTerminal: (owner) => owner?.status === 'won',
      getClipboard: () => clipboard,
      exportFile:
        exportFile ??
        ((value, name) =>
          exportJSONFile(value, name, {
            documentRef: {
              createElement() {
                return {
                  click() {
                    state.clicks.push({ name: this.download, copy: output.value });
                  },
                };
              },
            },
            locationRef: { href: 'https://example.test/game/couch/' },
            URLImpl: {
              createObjectURL(blob) {
                state.downloads.push(blob);
                return 'blob:terminal-recording';
              },
              revokeObjectURL() {},
            },
            schedule() {},
          })),
    }),
    output = container.querySelector('textarea'),
    copy = container.querySelector('#terminal-recording-copy-copy'),
    select = container.querySelector('#terminal-recording-copy-select');
  // Only the browser selection boundary is modeled. The real shared export UI,
  // JSON serialization and web download adapter remain in this fixture.
  output.select = () => state.selected++;
  const originalLocale = getLocale();
  setLocale('en', { persist: false });
  t.after(() => {
    panel.dispose();
    setLocale(originalLocale, { persist: false });
  });
  const recording = {
      format: 'revealline-local-capture-recording.v2',
      build: 'UI-only-fixture',
      segments: [{ release: [0, 1] }],
      note: 'Retain exact bytes: Україна',
    },
    recorder = { snapshot: async () => structuredClone(recording) };
  return { panel, container, status, document, state, output, copy, select, recording, recorder };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('terminal exports expose exact copyable bytes before the web download and never auto-copy', async (t) => {
  const writes = [],
    h = fixture(t, { clipboard: { writeText: async (text) => writes.push(text) } });
  await h.panel.request(h.state.owner, h.recorder, 'finished-team.json');
  const text = JSON.stringify(h.recording);
  assert.equal(h.container.hidden, false);
  assert.equal(h.container.querySelector('details').open, true);
  assert.equal(h.output.readOnly, true);
  assert.equal(h.output.value, text);
  assert.deepEqual(h.state.clicks, [{ name: 'finished-team.json', copy: text }]);
  assert.equal(await h.state.downloads[0].text(), text);
  assert.deepEqual(writes, []);
  h.copy.click();
  await settle();
  assert.deepEqual(writes, [text]);
  h.select.click();
  assert.equal(h.state.selected, 1);
  assert.equal(h.document.activeElement, h.output);
  setLocale('uk', { persist: false });
  assert.equal(h.output.value, text, 'Locale changes must not reserialize recording bytes.');
  assert.equal(h.copy.textContent, 'Копіювати JSON');
});

test('download and clipboard denial retain manual selection without claiming a file was saved', async (t) => {
  const h = fixture(t, {
    exportFile: async () => {
      throw new Error('Modeled download denial');
    },
  });
  await h.panel.request(h.state.owner, h.recorder, 'finished-team.json');
  assert.equal(h.output.value, JSON.stringify(h.recording));
  assert.match(h.status.textContent, /could not be requested.*ready to copy/);
  h.copy.click();
  await settle();
  assert.match(h.container.textContent, /Clipboard unavailable/);
  assert.notEqual(h.document.activeElement, h.output, 'Async denial must not steal focus.');
  h.select.click();
  assert.equal(h.state.selected, 1);
});

test('Retry clears the retained recording and late export or clipboard completion stays silent', async (t) => {
  const exportGate = deferred(),
    copyGate = deferred(),
    h = fixture(t, {
      exportFile: () => exportGate.promise,
      clipboard: { writeText: () => copyGate.promise },
    });
  const pending = h.panel.request(h.state.owner, h.recorder, 'old-round.json');
  await settle();
  assert.equal(h.container.hidden, false);
  h.copy.click();
  h.state.owner = { status: 'running' };
  h.panel.refresh();
  assert.equal(h.output.value, '');
  assert.equal(h.container.hidden, true);
  exportGate.resolve({ status: 'requested' });
  copyGate.resolve();
  await pending;
  await settle();
  assert.equal(h.status.textContent, '');
  assert.doesNotMatch(h.container.textContent, /JSON copied/);
});

test('replacement during hashing discards the old copy before requesting any platform export', async (t) => {
  const gate = deferred(),
    h = fixture(t),
    pending = h.panel.request(h.state.owner, { snapshot: () => gate.promise }, 'old-round.json');
  h.state.owner = { status: 'won' };
  h.panel.refresh();
  gate.resolve(h.recording);
  await pending;
  assert.equal(h.state.downloads.length, 0);
  assert.equal(h.output.value, '');
  assert.equal(h.container.hidden, true);
});
