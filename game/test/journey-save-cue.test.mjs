import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Element } from './helpers/couch-dom.mjs';
import { attachJourneySaveCue } from '../ui/journey-save-cue.mjs';

function fixture(description = '') {
  const document = new Document();
  const add = (id) => {
    const node = new Element(document, 'button');
    node.id = id;
    document.body.append(node);
    return node;
  };
  const target = add('pause'),
    action = add('options'),
    announcement = add('announcement');
  if (description) target.setAttribute('aria-describedby', description);
  let opens = 0;
  const cue = attachJourneySaveCue({
    document,
    target,
    action,
    announcement,
    onOpen() {
      opens++;
    },
  });
  return { document, target, action, announcement, cue, opens: () => opens };
}
const failed = { ready: true, durable: false, error: 'Storage refused' };

test('couch warning annotates existing Pause without changing its text or focus', () => {
  const f = fixture('existing-description');
  f.target.textContent = 'Pause';
  f.target.focus();
  f.cue.update(failed);
  assert.equal(f.document.activeElement, f.target);
  assert.equal(f.target.textContent, 'Pause');
  assert.equal(f.target.dataset.journeyUnsaved, 'true');
  assert.equal(f.target.getAttribute('aria-describedby'), 'existing-description announcement');
  assert.equal(f.action.hidden, false);
  assert.match(f.announcement.textContent, /Pause for Save options/);
  assert.equal(f.opens(), 0);
  f.action.click();
  assert.equal(f.opens(), 1);
  f.cue.update({ ready: true, durable: true });
  assert.equal(f.target.getAttribute('aria-describedby'), 'existing-description');
});

test('background success retains focused recovery shortcut until deliberate focus departure', () => {
  const f = fixture();
  f.cue.update(failed);
  f.action.focus();
  f.cue.update({ ready: true, durable: true });
  assert.equal(f.document.activeElement, f.action);
  assert.equal(f.action.hidden, false);
  assert.equal(f.action.textContent, 'Progress saved · Return to controls');
  assert.equal(f.target.getAttribute('aria-describedby'), null);
  f.target.focus();
  f.action.dispatchEvent({ type: 'blur' });
  assert.equal(f.action.hidden, true);
});

test('loading and pending writes do not produce false storage warnings', () => {
  const f = fixture();
  for (const status of [
    { ready: false, durable: false, error: 'not ready' },
    { durable: false },
    { durable: true },
  ]) {
    f.cue.update(status);
    assert.equal(f.action.hidden, true);
    assert.equal(f.target.dataset.journeyUnsaved, 'false');
    assert.equal(f.announcement.textContent, '');
  }
});
