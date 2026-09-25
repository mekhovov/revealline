import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { createOperationStatus } from '../ui/operation-status.mjs';
import { getLocale, setLocale, localizedMessage, t } from '../i18n/index.mjs';

function boundary(options) {
  const doc = new Document();
  const target = doc.createElement('p');
  target.setAttribute('role', 'status');
  doc.body.append(target);
  const presenter = createOperationStatus(target, options);
  return { doc, target, presenter, label: target.querySelector('.operation-status-label') };
}

test('accepted status producers translate live while obsolete leases stay fenced', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const { presenter, target, label, doc } = boundary();
  context.after(() => presenter.dispose());
  const old = presenter.begin({
    message: localizedMessage('interface:teamPictureReadyStartRemainsASeparateAction'),
  });
  const current = presenter.begin({
    message: () => t('interface:teamPictureIsReadyForThisAttempt'),
  });
  const english = label.textContent;
  setLocale('uk', { persist: false });
  assert.notEqual(label.textContent, english);
  assert.equal(label.textContent, t('interface:teamPictureIsReadyForThisAttempt'));
  assert.equal(old.finish({ message: 'Obsolete completion' }), false);
  assert.equal(target.dataset.state, 'busy');
  assert.equal(doc.activeElement, doc.body);
  current.finish({ message: localizedMessage('interface:teamPictureReady') });
  setLocale('en', { persist: false });
  assert.equal(label.textContent, t('interface:teamPictureReady'));
  assert.equal(target.dataset.state, 'ready');
});

test('a newer operation retains its status when an older completion or finally arrives', () => {
  const { presenter, target, label, doc } = boundary();
  const old = presenter.begin({ message: 'Reading old picture…' });
  const current = presenter.begin({ message: 'Saving new picture…', stage: 'saving' });
  assert.equal(old.finish({ message: 'Old picture ready.' }), false);
  assert.equal(old.clear(), false);
  assert.equal(label.textContent, 'Saving new picture…');
  assert.equal(target.dataset.state, 'busy');
  assert.equal(target.dataset.stage, 'saving');
  assert.equal(doc.activeElement, doc.body, 'Async status never steals input focus');
  current.finish({ message: 'New picture saved.' });
  assert.equal(target.dataset.state, 'ready');
  assert.equal(label.textContent, 'New picture saved.');
});

test('closing a host, cancelling a lease and disposal fence late status updates', () => {
  let open = true;
  const { presenter, target, label } = boundary({ isCurrent: () => open });
  let selected = true;
  const lease = presenter.begin({ message: 'Downloading…', isCurrent: () => selected });
  selected = false;
  assert.equal(lease.update({ message: 'Wrong selection' }), false);
  selected = true;
  open = false;
  assert.equal(lease.finish({ message: 'Closed screen' }), false);
  presenter.clear();
  open = true;
  assert.equal(lease.finish({ message: 'Reopened screen' }), false);
  assert.equal(target.hidden, true);
  const latest = presenter.begin({ message: 'Checking…' });
  presenter.dispose();
  assert.equal(latest.update({ message: 'Late progress' }), false);
  presenter.begin({ message: 'Disposed' });
  assert.equal(label.textContent, '');
  assert.equal(target.hidden, true);
});

test('detached observation can reconcile an actual save, but cannot overwrite a newer task', () => {
  const { presenter, target, label } = boundary();
  const save = presenter.begin({ message: 'Saving…' });
  save.finish({ state: 'detached', message: 'Save is still running.' });
  assert.equal(target.dataset.state, 'detached');
  save.finish({ message: 'Saved.' });
  assert.equal(label.textContent, 'Saved.');
  presenter.begin({ message: 'Reading another asset…' });
  assert.equal(save.finish({ state: 'error', message: 'Old result' }), false);
  assert.equal(label.textContent, 'Reading another asset…');
});

test('measured progress is accessible without repeating the live phase announcement', () => {
  const { presenter, target, label } = boundary();
  let announcements = 0;
  let text = '';
  Object.defineProperty(label, 'textContent', {
    get: () => text,
    set: (value) => {
      text = value;
      announcements++;
    },
  });
  const lease = presenter.begin({ message: 'Verifying files…', stage: 'verifying' });
  const meter = target.querySelector('progress');
  assert.equal(meter.hidden, true);
  for (let completed = 1; completed <= 3; completed++)
    lease.update({
      message: 'Verifying files…',
      progress: { completed, total: 3, unit: 'files' },
    });
  assert.equal(announcements, 1);
  assert.equal(target.getAttribute('role'), null);
  assert.equal(label.getAttribute('role'), 'status');
  assert.equal(meter.hidden, false);
  assert.equal(meter.value, 3);
  assert.equal(meter.max, 3);
  assert.equal(meter.getAttribute('aria-label'), '3 / 3 files');
  assert.throws(() => lease.update({ progress: { completed: 4, total: 3, unit: 'files' } }));
  assert.throws(() => lease.update({ progress: { completed: 0, total: 0, unit: 'files' } }));
  assert.equal(meter.value, 3, 'Invalid estimates cannot replace the measured result');
  lease.finish({ message: 'Verified.' });
  assert.equal(announcements, 2);
  assert.equal(meter.hidden, true);
});
