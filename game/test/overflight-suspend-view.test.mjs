import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { createSurvivalSuspendView } from '../overflight/suspend-view.mjs';
import { overflightText } from '../overflight/copy.mjs';
const settle = () => new Promise((resolve) => setImmediate(resolve));
function fixture(options = {}) {
  const document = new Document();
  let locale = 'en',
    pauses = 0,
    saves = 0,
    restores = 0,
    recoveries = 0;
  let state = { phase: 'saved' };
  const view = createSurvivalSuspendView({
    document,
    text: (key) => overflightText(locale, key),
    onOpen: () => pauses++,
    canSave: () => true,
    inspect: async () => state,
    save: async (replace) => {
      assert.equal(replace, true);
      saves++;
      return state;
    },
    restore: async () => {
      restores++;
      return state;
    },
    recover: async () => {
      recoveries++;
      state = { phase: 'consumed' };
      return state;
    },
    ...options,
  });
  document.body.append(view.opener);
  return {
    document,
    view,
    button: (name) => view.dialog.querySelector(`[data-suspend-action="${name}"]`),
    locale(value) {
      locale = value;
      view.refresh();
    },
    counts: () => ({ pauses, saves, restores, recoveries }),
    setState(value) {
      state = value;
    },
  };
}

test('saved flight uses explicit replace/restore confirmation, Cancel keeps flight and native Close returns focus', async () => {
  const f = fixture();
  try {
    f.view.opener.focus();
    f.view.opener.click();
    await settle();
    assert.equal(f.view.dialog.open, true);
    assert.equal(f.counts().pauses, 1);
    f.button('restore').click();
    assert.equal(f.counts().restores, 0);
    assert.equal(f.document.activeElement, f.button('cancel'));
    f.button('cancel').click();
    assert.equal(f.counts().restores, 0);
    f.button('save').click();
    f.button('confirm').click();
    await settle();
    assert.equal(f.counts().saves, 1);
    f.button('restore').click();
    f.button('confirm').click();
    await settle();
    assert.equal(f.counts().restores, 1);
    assert.match(f.view.dialog.textContent, /restored and paused/);
    f.button('close').click();
    assert.equal(f.view.dialog.open, false);
    assert.equal(f.document.activeElement, f.view.opener);
  } finally {
    f.view.dispose();
  }
});

test('pending result recovery disables replacement and refreshes Ukrainian labels without replaying actions', async () => {
  const f = fixture();
  try {
    f.setState({ phase: 'finishing' });
    f.view.opener.click();
    await settle();
    assert.equal(f.button('save').disabled, true);
    assert.equal(f.button('restore').disabled, true);
    assert.equal(f.button('recover').disabled, false);
    f.locale('uk');
    assert.equal(f.view.opener.textContent, 'Збережений політ');
    assert.equal(f.button('recover').textContent, 'Відновити завершений результат');
    assert.equal(f.counts().recoveries, 0);
    f.button('recover').click();
    await settle();
    assert.equal(f.counts().recoveries, 1);
    assert.match(f.view.dialog.textContent, /Рекорди й майстерність/);
    assert.equal(f.button('restore').disabled, true);
  } finally {
    f.view.dispose();
  }
});

test('unavailable package stays recoverable with Check again and never exposes active save actions', async () => {
  let attempts = 0;
  const f = fixture({
    inspect: async () => {
      attempts++;
      throw Object.assign(new Error('internal package detail'), {
        playerMessage: 'Complete release required.',
      });
    },
  });
  try {
    f.view.opener.click();
    await settle();
    assert.equal(f.button('save').disabled, true);
    assert.equal(f.button('restore').disabled, true);
    assert.match(f.view.dialog.textContent, /Complete release required/);
    assert.doesNotMatch(f.view.dialog.textContent, /internal package detail/);
    f.button('check').click();
    await settle();
    assert.equal(attempts, 2);
    assert.equal(f.button('close').disabled, false);
  } finally {
    f.view.dispose();
  }
});

test('busy writes cannot be double submitted or dismissed as cancelled before their result is known', async () => {
  let resolve,
    writes = 0;
  const pending = new Promise((done) => {
    resolve = done;
  });
  const f = fixture({
    save: () => {
      writes++;
      return pending;
    },
  });
  try {
    f.view.opener.click();
    await settle();
    f.button('save').click();
    f.button('confirm').click();
    f.button('confirm').click();
    assert.equal(writes, 1);
    assert.equal(f.button('close').disabled, true);
    const event = f.view.dialog.emit('cancel', { bubbles: false });
    assert.equal(event.defaultPrevented, true);
    resolve({ phase: 'saved' });
    await settle();
    assert.equal(f.button('close').disabled, false);
    assert.match(f.view.dialog.textContent, /Flight saved/);
  } finally {
    f.view.dispose();
  }
});

test('a failed initial terminal journal still exposes result retry without restoring an older position', async () => {
  const f = fixture();
  try {
    f.setState({ phase: 'saved', resultPending: true });
    f.view.opener.click();
    await settle();
    assert.equal(f.button('recover').disabled, false);
    assert.equal(f.button('restore').disabled, true);
    assert.equal(f.button('save').disabled, true);
    assert.match(f.view.dialog.textContent, /needs result recovery/);
  } finally {
    f.view.dispose();
  }
});
