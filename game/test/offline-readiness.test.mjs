import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { attachOfflineReadiness } from '../ui/offline-readiness.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

function fixture() {
  const doc = new Document();
  const root = doc.createElement('section');
  doc.body.append(root);
  let checks = 0;
  const panel = attachOfflineReadiness({ root, document: doc, onRecheck: () => checks++ });
  const row = (id) => doc.getElementById(`offline-readiness-${id}`);
  return { root, panel, row, checks: () => checks };
}
const verified = {
  runtime: 'ready',
  content: true,
  launcher: 'ready',
  selection: 'selected',
  retained: false,
  sim: { count: 0, total: 2 },
  music: { count: 0, total: 12 },
};

test('readiness starts unchecked and distinguishes files, app selection and storage protection', () => {
  const h = fixture();
  assert.equal(h.root.dataset.state, 'stale');
  assert.equal(h.row('runtime').textContent, 'Not checked in this visit');
  h.row('check').click();
  assert.equal(h.checks(), 0, 'initialization must finish before a check is offered');
  h.panel.update({ busy: false, installed: true });
  h.row('check').click();
  assert.equal(h.checks(), 1);
  const token = h.panel.begin();
  h.row('check').click();
  assert.equal(h.checks(), 1, 'a second press cannot start a concurrent check');
  h.panel.complete(token, { ...verified, selection: 'other' });
  assert.equal(h.root.dataset.state, 'filesReady');
  assert.equal(h.row('context').textContent, 'This installed app');
  assert.match(h.row('selection').textContent, /different edition/);
  assert.match(h.row('retention').textContent, /not granted/);
  assert.match(h.row('sim').textContent, /0 of 2 bundled packages verified; optional/);
  assert.match(h.row('music').textContent, /0 of 12 recordings verified; optional/);
  assert.match(h.row('status').textContent, /selected game files.*App selection/);
});

test('core and launcher failures cannot be hidden by complete content or granted retention', () => {
  const h = fixture();
  for (const observation of [
    { ...verified, runtime: 'missing', retained: true },
    { ...verified, content: false },
    { ...verified, launcher: 'waiting' },
  ]) {
    h.panel.complete(h.panel.begin(), observation);
    assert.equal(h.root.dataset.state, 'incomplete');
  }
  assert.match(h.row('launcher').textContent, /other app windows/);
  h.panel.complete(h.panel.begin(), { ...verified, bookmark: true, launcher: 'missing' });
  assert.equal(h.root.dataset.state, 'filesReady');
  assert.equal(h.row('launcher').textContent, 'Not required to open this bookmark');
});

test('invalidation and superseded checks cannot restore an old readiness claim', () => {
  const h = fixture();
  const old = h.panel.begin();
  h.panel.invalidate();
  assert.equal(h.panel.complete(old, verified), false);
  assert.equal(h.root.dataset.state, 'stale');
  const earlier = h.panel.begin(),
    current = h.panel.begin();
  assert.equal(h.panel.complete(earlier, verified), false);
  h.panel.fail(earlier);
  assert.equal(h.root.dataset.state, 'checking');
  h.panel.complete(current, verified);
  h.panel.invalidate();
  assert.equal(h.row('runtime').textContent, 'Not checked in this visit');
  assert.equal(h.row('selection').textContent, 'Not checked in this visit');
  assert.equal(h.row('music').textContent, 'Not checked in this visit');
  assert.equal(h.row('retention').textContent, 'Retention has not been confirmed');
});

test('failed and unavailable checks stay usable without claiming download readiness', () => {
  const h = fixture();
  h.panel.update({ busy: false });
  h.panel.fail(h.panel.begin());
  assert.equal(h.row('check').disabled, false);
  assert.equal(h.root.dataset.state, 'stale');
  h.panel.update({ available: false });
  assert.equal(h.row('check').disabled, true);
  assert.equal(h.root.dataset.state, 'unavailable');
  assert.match(h.row('status').textContent, /Reconnect and reload/);
});

test('live English and Ukrainian copy keeps unknowns and optional packages distinct', () => {
  const locale = getLocale();
  try {
    const h = fixture();
    h.panel.complete(h.panel.begin(), {
      ...verified,
      retained: null,
      sim: { count: 0, total: 0 },
      music: { count: 0, total: 0 },
    });
    assert.equal(h.row('sim').textContent, 'No bundled simulator package in this edition');
    assert.equal(h.row('music').textContent, 'No recorded music package in this edition');
    setLocale('uk', { persist: false });
    assert.match(h.row('sim').textContent, /немає вбудованого пакета/);
    assert.doesNotMatch(h.root.textContent, /interface:|readiness\.|\{\{/);
    assert.match(h.row('context').textContent, /браузер/);
    setLocale('en', { persist: false });
    assert.equal(h.row('runtime').textContent, 'Verified on this device');
  } finally {
    setLocale(locale, { persist: false });
  }
});
