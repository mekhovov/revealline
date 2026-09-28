import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { attachKeySettings } from '../ui/key-settings.mjs';
import { setLocale, t as translate } from '../i18n/index.mjs';
import {
  bindingLabels,
  KEY_ACTION_LABELS,
  KEY_BINDING_PRESETS,
  KEY_BINDING_PRESET_LABELS,
  resolveKeyBindings,
} from '../key-bindings.mjs';

const locale = (value) => setLocale(value, { persist: false });
function fixture(t) {
  const previous = new Map(
    ['document', 'window'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const doc = new Document(),
    win = new Events();
  doc.parentNode = win;
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  locale('en');
  const dialog = doc.createElement('dialog');
  dialog.id = 'settings-dialog';
  doc.body.append(dialog);
  const nodes = {};
  for (const [name, tag, id] of [
    ['list', 'div', 'key-binding-list'],
    ['preset', 'select', 'key-preset'],
    ['reset', 'button', 'reset-key-bindings'],
    ['status', 'p', 'key-capture-status'],
    ['cancel', 'button', 'cancel-key-capture'],
  ]) {
    const node = doc.createElement(tag);
    node.id = id;
    dialog.append(node);
    nodes[name] = node;
  }
  for (const value of ['default', 'left-hand', 'right-hand', 'custom']) {
    const option = doc.createElement('option');
    option.value = value;
    nodes.preset.append(option);
  }
  let value = null,
    reads = 0,
    attempts = 0,
    changes = 0;
  let response = { ok: true },
    failure = null,
    beforeWrite = () => {};
  const writes = [];
  const settings = attachKeySettings({
    getBindings: () => {
      reads++;
      return value;
    },
    setBindings: (candidate) => {
      attempts++;
      beforeWrite();
      if (failure) throw failure;
      value = candidate;
      writes.push(candidate);
      return response;
    },
    onChanged: () => changes++,
  });
  const buttons = Object.fromEntries(
    nodes.list.querySelectorAll('button').map((button) => [button.dataset.keyAction, button]),
  );
  dialog.showModal();
  t.after(() => {
    settings.destroy();
    doc.body.replaceChildren();
    locale('en');
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return {
    doc,
    win,
    dialog,
    nodes,
    buttons,
    settings,
    writes,
    get value() {
      return value;
    },
    get status() {
      return nodes.status.textContent;
    },
    counts: () => ({ reads, attempts, changes, writes: writes.length }),
    capture(action) {
      buttons[action].focus();
      buttons[action].click();
    },
    key(code, extra = {}) {
      return doc.activeElement.emit('keydown', { code, key: code, repeat: false, ...extra });
    },
    preset(id) {
      nodes.preset.value = id;
      nodes.preset.emit('change');
    },
    respond(next) {
      response = next;
    },
    fail(next, callback = () => {}) {
      failure = next;
      beforeWrite = callback;
    },
  };
}
function cycle(h, check) {
  const counts = h.counts(),
    focus = h.doc.activeElement;
  const english = h.status;
  for (const language of ['uk', 'en']) {
    locale(language);
    assert.deepEqual(
      h.counts(),
      counts,
      'Locale refresh performs no host reads, writes or resets.',
    );
    assert.equal(h.doc.activeElement, focus);
    assert.equal(h.dialog.open, true);
    check(language);
    if (language === 'en') assert.equal(h.status, english);
    else assert.notEqual(h.status, english);
  }
}

test('open EN/UK/EN settings translate key names, accessible labels and idle instructions', (t) => {
  const h = fixture(t);
  const boost = h.buttons.boost;
  const englishButton = boost.textContent;
  cycle(h, (language) => {
    const labels = bindingLabels();
    assert.ok(boost.textContent.includes(labels.boost));
    assert.ok(boost.getAttribute('aria-label').includes(labels.boost));
    assert.ok(boost.getAttribute('aria-label').includes(KEY_ACTION_LABELS.boost));
    assert.equal(
      h.status,
      translate('interface:chooseChangeToAssignOnePhysicalKeyEscapeAlwaysPauses'),
    );
    if (language === 'uk') {
      assert.notEqual(boost.textContent, englishButton);
      assert.doesNotMatch(boost.textContent, /Left Shift|Right Shift/);
    } else assert.equal(boost.textContent, englishButton);
  });
  assert.equal(h.value, null);
  assert.equal(h.writes.length, 0);
});

test('locale changes preserve active capture and one fresh physical key applies exactly once', (t) => {
  const h = fixture(t),
    before = resolveKeyBindings();
  h.capture('boost');
  cycle(h, () => {
    assert.equal(h.buttons.boost.getAttribute('aria-pressed'), 'true');
    assert.equal(h.nodes.cancel.hidden, false);
    assert.equal(h.nodes.cancel.disabled, false);
    assert.equal(h.buttons.boost.textContent, translate('interface:pressAKey'));
    assert.equal(
      h.status,
      translate('gameplay:chooseOnePhysicalKeyForEscapeOrTabCancelsExisting', {
        value1: KEY_ACTION_LABELS.boost,
      }),
    );
  });
  const repeated = h.key('KeyZ', { repeat: true });
  assert.equal(repeated.defaultPrevented, true);
  assert.equal(h.writes.length, 0);
  const fresh = h.key('KeyZ', { key: 'я' });
  assert.equal(fresh.defaultPrevented, true);
  assert.equal(h.writes.length, 1);
  assert.equal(h.counts().changes, 1);
  assert.deepEqual(h.value.bindings.boost, ['KeyZ']);
  for (const action of Object.keys(before.bindings).filter((action) => action !== 'boost'))
    assert.deepEqual(h.value.bindings[action], before.bindings[action]);
  h.key('KeyZ', { repeat: true });
  assert.equal(h.writes.length, 1);
  assert.equal(h.doc.activeElement, h.buttons.boost);
  assert.equal(h.buttons.boost.getAttribute('aria-pressed'), 'false');
  cycle(h, () =>
    assert.equal(
      h.status,
      translate('gameplay:changedToEscapeAlwaysPausesTheGame', {
        value1: KEY_ACTION_LABELS.boost,
        value2: 'Z',
      }),
    ),
  );
});

for (const cancellation of ['Escape', 'Tab', 'button'])
  test(`${cancellation} cancellation remains translated and never adopts a binding`, (t) => {
    const h = fixture(t);
    h.capture('ability');
    if (cancellation === 'button') h.nodes.cancel.click();
    else {
      const event = h.key(cancellation);
      assert.equal(event.defaultPrevented, cancellation === 'Escape');
    }
    assert.equal(h.buttons.ability.getAttribute('aria-pressed'), 'false');
    assert.equal(h.nodes.cancel.hidden, true);
    cycle(h, () =>
      assert.equal(
        h.status,
        translate('gameplay:unchangedKeyCaptureCancelled', {
          value1: KEY_ACTION_LABELS.ability,
        }),
      ),
    );
    h.key('KeyZ');
    assert.equal(h.writes.length, 0);
    assert.equal(h.value, null);
  });

for (const [name, extra, message] of [
  [
    'composition',
    { isComposing: true, key: 'Process' },
    'gameplay:textCompositionCannotBeAGameKeyIsUnchangedFinish',
  ],
  ['modifier', { ctrlKey: true }, 'gameplay:cannotBindAModifierCombinationIsUnchangedPressOneKey'],
])
  test(`${name} feedback follows locale while native input and capture ownership remain intact`, (t) => {
    const h = fixture(t);
    h.capture('pickup');
    const event = h.key('KeyZ', extra);
    assert.equal(event.defaultPrevented, false);
    assert.equal(event.cancelBubble, undefined);
    cycle(h, () => {
      assert.equal(h.status, translate(message, { value1: KEY_ACTION_LABELS.pickup }));
      assert.equal(h.buttons.pickup.getAttribute('aria-pressed'), 'true');
    });
    assert.equal(h.writes.length, 0);
    h.key('KeyZ');
    assert.equal(h.writes.length, 1);
    assert.deepEqual(h.value.bindings.pickup, ['KeyZ']);
  });

test('preset and Reset feedback retain their accepted selection through EN/UK/EN', (t) => {
  const h = fixture(t);
  h.preset('left-hand');
  assert.equal(h.writes.length, 1);
  assert.deepEqual(h.value, resolveKeyBindings(KEY_BINDING_PRESETS['left-hand']));
  h.nodes.preset.value = 'right-hand'; // A later uncommitted UI value cannot rewrite the outcome.
  cycle(h, () =>
    assert.equal(
      h.status,
      translate('gameplay:keyboardPresetAppliedEscapeAlwaysPausesTheGame', {
        value1: KEY_BINDING_PRESET_LABELS['left-hand'],
      }),
    ),
  );
  h.nodes.reset.click();
  assert.equal(h.writes.length, 2);
  assert.equal(h.value, null);
  cycle(h, () =>
    assert.equal(
      h.status,
      translate('interface:defaultKeyboardBindingsRestoredEscapeAlwaysPausesTheGame'),
    ),
  );
});

test('session-only success preserves the accepted action, key and exact host warning', (t) => {
  const h = fixture(t);
  const warning = 'Storage <unavailable> & retry with code α.';
  const response = { ok: false, warning };
  h.respond(response);
  h.capture('ability');
  const event = h.key('KeyZ');
  assert.equal(h.writes.length, 1);
  event.code = 'KeyQ';
  response.ok = true;
  response.warning = 'A later result must not replace the warning';
  h.value.bindings.ability = ['KeyQ']; // Locale refresh must keep the accepted UI projection.
  cycle(h, () => {
    assert.equal(
      h.status,
      `${translate('gameplay:changedToEscapeAlwaysPausesTheGame', {
        value1: KEY_ACTION_LABELS.ability,
        value2: 'Z',
      })} ${warning}`,
    );
    assert.ok(h.buttons.ability.textContent.includes('Z'));
    assert.doesNotMatch(h.status, /later result|undefined/);
  });
});

test('session-only fallback warning translates without re-reading a mutated host result', (t) => {
  const h = fixture(t),
    response = { ok: false };
  h.respond(response);
  h.nodes.reset.click();
  response.ok = true;
  response.warning = 'Later warning';
  cycle(h, () =>
    assert.equal(
      h.status,
      `${translate('interface:defaultKeyboardBindingsRestoredEscapeAlwaysPausesTheGame')} ${translate('interface:thisKeyboardMapAppliesToThisSessionOnly')}`,
    ),
  );
});

test('failed capture retains event facts after the host cancels capture and mutates its Error', (t) => {
  const h = fixture(t),
    detail = 'Host rejected <write> & preserved α.';
  const error = new Error(detail);
  h.fail(error, () => h.nodes.reset.focus());
  h.capture('ability');
  const event = h.key('KeyZ');
  assert.equal(h.buttons.ability.getAttribute('aria-pressed'), 'false');
  assert.equal(h.writes.length, 0);
  assert.equal(h.value, null);
  error.message = 'A different later error';
  event.code = 'KeyQ';
  cycle(h, () => {
    assert.equal(
      h.status,
      translate('gameplay:wasNotAssignedIsUnchangedChooseAnotherKeyOrPress', {
        value1: 'Z',
        value2: detail,
        value3: KEY_ACTION_LABELS.ability,
      }),
    );
    assert.doesNotMatch(h.status, /later error|undefined/);
  });
});

for (const operation of ['preset', 'reset'])
  test(`${operation} error feedback translates around unchanged external detail`, (t) => {
    const h = fixture(t),
      detail = 'Write blocked <exact> & code β.',
      error = new Error(detail);
    h.fail(error);
    if (operation === 'preset') h.preset('left-hand');
    else h.nodes.reset.click();
    error.message = 'A later failure';
    cycle(h, () =>
      assert.equal(
        h.status,
        translate(
          operation === 'preset'
            ? 'gameplay:keyboardPresetWasNotApplied'
            : 'gameplay:keyboardBindingsWereNotReset',
          { value1: detail },
        ),
      ),
    );
    assert.equal(h.value, null);
    assert.equal(h.writes.length, 0);
  });

test('destroyed settings cannot re-enter capture or write when locale and old controls change', (t) => {
  const h = fixture(t);
  h.capture('boost');
  h.settings.destroy();
  const counts = h.counts();
  for (const language of ['uk', 'en']) {
    locale(language);
    h.buttons.boost.click();
    h.key('KeyZ');
    assert.deepEqual(h.counts(), counts);
    assert.equal(h.status, '');
    assert.equal(h.nodes.cancel.hidden, true);
  }
});
