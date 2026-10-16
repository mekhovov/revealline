import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document, Element } from './helpers/couch-dom.mjs';
import { attachJourneySaveNotice } from '../ui/journey-save-notice.mjs';

function fixture() {
  const doc = new Document();
  const add = (id, tag = 'button', parent = doc.body) => {
    const node = new Element(doc, tag);
    node.id = id;
    parent.append(node);
    return node;
  };
  const menu = add('shell-menu');
  menu.setAttribute('aria-label', 'Game menu');
  const home = add('shell-home', 'dialog');
  const recovery = add('journey-save-status', 'aside', home);
  const retry = add('journey-save-retry', 'button', recovery);
  add('journey-save-export', 'button', recovery);
  add('journey-save-message', 'p', recovery);
  add('journey-save-badge', 'span', menu);
  add('journey-save-announcement', 'p');
  const options = add('journey-save-options');
  let menuVisits = 0;
  menu.onclick = () => {
    menuVisits++;
    home.open = true;
  };
  const notice = attachJourneySaveNotice({ document: doc });
  return { doc, menu, home, recovery, retry, options, notice, visits: () => menuVisits };
}
const failed = { ready: true, durable: false, error: 'Disk full' };

test('markup keeps primary play before recovery and warning before secondary result actions', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('id="next-button"') < html.indexOf('id="journey-save-options"'));
  assert.ok(html.indexOf('id="journey-save-options"') < html.indexOf('id="view-picture"'));
  assert.ok(html.indexOf('id="shell-featured"') < html.indexOf('id="journey-save-status"'));
  assert.ok(html.indexOf('id="shell-home"') < html.indexOf('id="journey-save-status"'));
});

test('failed saving projects a visible warning without opening a menu or moving focus', () => {
  const f = fixture();
  f.menu.focus();
  f.notice.update(failed);
  assert.equal(f.visits(), 0);
  assert.equal(f.doc.activeElement, f.menu);
  assert.equal(f.options.hidden, false);
  assert.equal(f.doc.getElementById('journey-save-badge').hidden, false);
  assert.match(f.menu.getAttribute('aria-label'), /Journey progress not saved/);
  assert.match(f.doc.getElementById('journey-save-message').textContent, /session-only.*Disk full/);
});

test('Save options uses the existing menu action before focusing recovery', () => {
  const f = fixture();
  f.notice.update(failed);
  f.options.click();
  assert.equal(f.visits(), 1);
  assert.equal(f.home.open, true);
  assert.equal(f.doc.activeElement, f.retry);
});

test('a refused menu opening cannot focus recovery behind a closed dialog', () => {
  const f = fixture();
  f.notice.update(failed);
  f.menu.onclick = () => {};
  f.options.focus();
  f.options.click();
  assert.equal(f.doc.activeElement, f.options);
});

test('successful retry clears warnings without removing the focused recovery controls', () => {
  const f = fixture();
  f.notice.update(failed);
  f.options.click();
  f.notice.update({ ready: true, durable: true, error: null });
  assert.equal(f.options.hidden, true);
  assert.equal(f.doc.getElementById('journey-save-badge').hidden, true);
  assert.equal(f.menu.getAttribute('aria-label'), 'Game menu');
  assert.equal(f.doc.activeElement, f.retry);
  assert.equal(f.recovery.hidden, false);
  assert.match(f.doc.getElementById('journey-save-message').textContent, /saved locally/);
  f.menu.focus();
  f.notice.update({ ready: true, durable: true, error: null });
  assert.equal(f.recovery.hidden, true);
});

test('loading and a pending ordinary save are not presented as storage failures', () => {
  const f = fixture();
  for (const status of [
    { ready: false, durable: false, error: 'not ready' },
    { ready: true, durable: false, error: null },
    { ready: true, durable: true, error: null },
  ]) {
    f.notice.update(status);
    assert.equal(f.options.hidden, true);
    assert.equal(f.recovery.hidden, true);
    assert.equal(f.visits(), 0);
  }
});

test('background retry success preserves focused Save options until focus leaves', () => {
  const f = fixture();
  f.notice.update(failed);
  f.options.focus();
  f.notice.update({ ready: true, durable: true, error: null });
  assert.equal(f.doc.activeElement, f.options);
  assert.equal(f.options.hidden, false);
  assert.equal(f.options.textContent, 'Progress saved · Game menu');
  assert.equal(f.visits(), 0);
  f.menu.focus();
  f.options.dispatchEvent({ type: 'blur' });
  assert.equal(f.options.hidden, true);
});
