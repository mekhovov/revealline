import test from 'node:test';
import { Element as DOMElement, Events } from './helpers/couch-dom.mjs';
import assert from 'node:assert/strict';
import { attachControllerSettings } from '../ui/controller-settings.mjs';
import {
  CONTROLLER_BINDING_ACTIONS,
  resolveControllerBindings,
  validateControllerBindings,
} from '../controller-bindings.mjs';

class Element extends DOMElement {
  constructor(tag, owner) {
    super(owner, tag);
    this.tagName = tag.toUpperCase();
    this.owner = owner;
    this.listeners = new Map();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.value = '';
    this.textContent = '';
    this.type = '';
    this.disabled = false;
    this.hidden = false;
  }
  get disabled() {
    return this._disabled ?? false;
  }
  set disabled(value) {
    this._disabled = value;
    if (value && this.ownerDocument.activeElement === this) this.blur();
  }
  get hidden() {
    return this._hidden ?? false;
  }
  set hidden(value) {
    this._hidden = value;
    if (value && this.contains(this.ownerDocument.activeElement))
      this.ownerDocument.activeElement.blur();
  }
  set innerHTML(_value) {
    throw new Error('Use text-only DOM.');
  }
  set options(_value) {}
  removeAttribute(key) {
    delete this.attributes[key];
  }
  get options() {
    return this.tagName === 'SELECT' ? this.children : undefined;
  }
  append(...children) {
    super.append(...children);
  }
  replaceChildren(...children) {
    super.replaceChildren(...children);
  }
  setAttribute(key, value) {
    this.attributes[key] = String(value);
  }
  getAttribute(key) {
    return this.attributes[key] ?? null;
  }
  addEventListener(type, fn) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  removeEventListener(type, fn) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((item) => item !== fn),
    );
  }
  async emit(type) {
    for (const listener of this.listeners.get(type) ?? []) await listener({ target: this });
  }
  focus() {
    if (this.disabled) return;
    for (let element = this; element?.nodeType === 1; element = element.parentNode)
      if (element.hidden) return;
    this.owner.activeElement = this;
    this.owner.emit('focusin', { target: this });
  }
  blur() {
    if (this.ownerDocument.activeElement !== this) return;
    this.ownerDocument.blurred.push(this);
    this.ownerDocument.activeElement = this.ownerDocument.body;
  }
}
function fixture(initial = null) {
  const doc = Object.assign(new Events(), {
      nodeType: 9,
      activeElement: null,
      hidden: false,
      focused: true,
      hasFocus() {
        return this.focused;
      },
      defaultView: new Events(),
      blurred: [],
    }),
    all = [];
  doc.createElement = (tag) => {
    const element = new Element(tag, doc);
    all.push(element);
    return element;
  };
  doc.body = doc.createElement('body');
  doc.body.parentNode = doc;
  doc.activeElement = doc.body;
  const container = doc.createElement('section');
  doc.body.append(container);
  container.id = 'controller-settings-root';
  let current = initial,
    before = 0,
    writer = (candidate) => {
      current = candidate;
      return { ok: true };
    };
  const calls = [];
  const api = attachControllerSettings({
    container,
    document: doc,
    getBindings: () => current,
    onBeforeEdit: () => {
      before++;
    },
    onApply: (candidate, guard) => {
      calls.push({ candidate, guard });
      return writer(candidate, guard);
    },
  });
  const action = (value) => all.find((node) => node.dataset.controllerSettingsAction === value),
    field = (path) => all.find((node) => node.dataset.controllerSetting === path),
    status = all.find((node) => node.getAttribute('role') === 'status');
  return {
    doc,
    all,
    container,
    api,
    calls,
    action,
    field,
    status,
    click: async (value) => {
      const button = action(value);
      if (button.disabled || button.hidden || button.parentNode?.hidden) return;
      button.focus();
      await button.emit('click');
    },
    set: async (path, value) => {
      const control = field(path);
      if (control.type === 'checkbox') control.checked = value;
      else control.value = String(value);
      await control.emit('change');
    },
    setCurrent(value) {
      current = value;
    },
    setWriter(fn) {
      writer = fn;
    },
    get current() {
      return current;
    },
    get before() {
      return before;
    },
  };
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

test('mount is inert and renders every button map with sixteen explicit options', () => {
  const f = fixture();
  assert.equal(f.before, 0);
  assert.equal(f.calls.length, 0);
  assert.equal(f.current, null);
  assert.equal(f.container.children[0].tagName, 'H3');
  assert.equal(f.container.children[0].textContent, 'Controller controls');
  assert.equal(f.container.children[0].hidden, false);
  for (const context of ['flight', 'menu'])
    for (const action of CONTROLLER_BINDING_ACTIONS[context]) {
      const select = f.field(`${context}.buttons.${action}`);
      assert.equal(select.tagName, 'SELECT');
      assert.deepEqual(
        select.options.map((option) => option.value),
        Array.from({ length: 16 }, (_, i) => String(i)),
      );
    }
  assert.equal(f.status.getAttribute('aria-live'), 'polite');
  assert.ok(f.all.filter((node) => node.tagName === 'DETAILS').length >= 4);
});

test('generated select, range and checkbox controls expose readable names for controller previews', async () => {
  const f = fixture();
  await f.click('edit');
  assert.equal(f.field('flight.buttons.ability').getAttribute('aria-label'), 'Use ability button');
  assert.equal(f.field('deadZone.press').getAttribute('aria-label'), 'Press threshold');
  assert.equal(f.field('menu.stick.enabled').getAttribute('aria-label'), 'Enable stick input');
  assert.equal(f.field('glyphFamily').getAttribute('aria-label'), 'Button label family');
  for (const control of f.all.filter((node) => node.dataset.controllerSetting)) {
    const label = control.getAttribute('aria-label');
    assert.ok(label && label !== control.id, control.dataset.controllerSetting);
  }
});

test('an explicit draft keeps the original configuration unchanged until canonical Apply', async () => {
  const original = resolveControllerBindings(null),
    snapshot = JSON.stringify(original),
    f = fixture(original);
  await f.click('edit');
  assert.equal(f.before, 1);
  assert.equal(f.doc.activeElement, f.field('glyphFamily'));
  await f.set('glyphFamily', 'playstation');
  await f.set('flight.stick.xAxis', 2);
  await f.set('flight.stick.yAxis', 3);
  await f.set('flight.stick.invertX', true);
  await f.set('menu.stick.enabled', false);
  await f.set('deadZone.press', 0.4);
  await f.set('deadZone.release', 0.25);
  assert.equal(JSON.stringify(original), snapshot);
  assert.equal(f.calls.length, 0);
  await f.click('apply');
  assert.equal(f.calls.length, 1);
  assert.equal(validateControllerBindings(f.current).valid, true);
  assert.equal(f.current.glyphFamily, 'playstation');
  assert.equal(f.current.flight.stick.xAxis, 2);
  assert.equal(f.current.flight.stick.invertX, true);
  assert.equal(f.current.menu.stick.enabled, false);
  assert.equal(f.current.deadZone.release, 0.25);
  assert.match(f.status.textContent, /settings applied/);
  assert.equal(f.doc.activeElement, f.action('edit'));
  assert.equal(JSON.stringify(original), snapshot);
});

test('temporary button conflicts permit complete swaps but invalid Apply never reaches the host', async () => {
  const f = fixture();
  await f.click('edit');
  await f.set('flight.buttons.ability', 2);
  await f.click('apply');
  assert.equal(f.calls.length, 0);
  assert.equal(f.current, null);
  assert.match(f.status.textContent, /already assigned/);
  await f.set('flight.buttons.pickup', 0);
  await f.click('apply');
  assert.equal(f.calls.length, 1);
  assert.equal(f.current.flight.buttons.ability, 2);
  assert.equal(f.current.flight.buttons.pickup, 0);
  assert.equal(f.current.menu.buttons.confirm, 0);
});

test('Cancel discards valid and conflicting draft changes without adoption', async () => {
  const f = fixture();
  await f.click('edit');
  await f.set('menu.buttons.confirm', 1);
  await f.set('glyphFamily', 'xbox');
  await f.click('cancel');
  assert.equal(f.current, null);
  assert.equal(f.calls.length, 0);
  assert.equal(f.doc.activeElement, f.action('edit'));
  await f.click('edit');
  assert.equal(f.field('menu.buttons.confirm').value, '0');
  assert.equal(f.field('glyphFamily').value, 'generic');
});

test('Restore defaults changes only the draft and requires Apply', async () => {
  const original = resolveControllerBindings(null);
  original.glyphFamily = 'xbox';
  original.deadZone.release = 0.2;
  const f = fixture(original);
  await f.click('edit');
  await f.click('defaults');
  assert.equal(f.current.glyphFamily, 'xbox');
  assert.equal(f.calls.length, 0);
  assert.equal(f.field('glyphFamily').value, 'generic');
  assert.match(f.status.textContent, /Defaults are in the draft/);
  await f.click('cancel');
  assert.equal(f.current.deadZone.release, 0.2);
  await f.click('edit');
  await f.click('defaults');
  await f.click('apply');
  assert.deepEqual(f.current, resolveControllerBindings(null));
});

test('button label choices update draft option text without changing saved indices or detecting hardware', async () => {
  const f = fixture();
  await f.click('edit');
  await f.set('glyphFamily', 'playstation');
  assert.match(f.field('flight.buttons.ability').options[0].textContent, /Cross/);
  assert.equal(f.field('flight.buttons.ability').value, '0');
  assert.equal(f.current, null);
  await f.set('glyphFamily', 'xbox');
  assert.equal(f.field('flight.buttons.ability').options[0].textContent, 'A · 0');
});

test('whole-candidate validation rejects axes, bounds and release-above-press conflicts', async () => {
  for (const [path, value, message] of [
    ['flight.stick.xAxis', 1, /axes must be distinct/],
    ['menu.stick.yAxis', 4, /integer 0–3/],
    ['deadZone.press', 0.2, /release must not exceed press/],
    ['deadZone.release', 'NaN', /finite/],
    ['flight.buttons.ability', 16, /system\/home/],
    ['glyphFamily', '<script>', /glyph family/],
  ]) {
    const f = fixture();
    await f.click('edit');
    await f.set(path, value);
    await f.click('apply');
    assert.equal(f.calls.length, 0, path);
    assert.equal(f.current, null, path);
    assert.match(f.status.textContent, message);
    f.api.destroy();
  }
});

test('session-only success adopts the map and displays the host persistence warning as text', async () => {
  const f = fixture();
  f.setWriter((candidate) => {
    f.setCurrent(candidate);
    return { ok: false, warning: 'Session only <local>' };
  });
  await f.click('edit');
  await f.set('glyphFamily', 'xbox');
  await f.click('apply');
  assert.equal(f.current.glyphFamily, 'xbox');
  assert.match(f.status.textContent, /Controller settings applied\. Session only <local>/);
});

test('a thrown host rejection retains the current map and permits repairing the draft', async () => {
  const f = fixture();
  f.setWriter(() => {
    throw new Error('Host rejected this candidate');
  });
  await f.click('edit');
  await f.set('glyphFamily', 'xbox');
  await f.click('apply');
  assert.equal(f.current, null);
  assert.match(f.status.textContent, /not applied.*Host rejected/);
  assert.equal(f.field('glyphFamily').value, 'xbox');
  assert.equal(f.action('apply').disabled, false);
  await f.click('cancel');
  assert.equal(f.current, null);
});

test('source change before Apply discards the old draft without overwriting new preferences', async () => {
  const f = fixture();
  await f.click('edit');
  await f.set('glyphFamily', 'xbox');
  const imported = resolveControllerBindings(null);
  imported.glyphFamily = 'playstation';
  f.setCurrent(imported);
  await f.click('apply');
  assert.equal(f.calls.length, 0);
  assert.equal(f.current, imported);
  assert.match(f.status.textContent, /changed elsewhere/);
  await f.click('edit');
  assert.equal(f.field('glyphFamily').value, 'playstation');
});

test('refresh explicitly invalidates even an unchanged source draft', async () => {
  const f = fixture();
  await f.click('edit');
  await f.set('glyphFamily', 'xbox');
  f.api.refresh();
  await f.click('apply');
  assert.equal(f.calls.length, 0);
  assert.equal(f.current, null);
  await f.click('edit');
  assert.equal(f.field('glyphFamily').value, 'generic');
});

test('async Apply is single-flight and allows its own canonical adoption', async () => {
  const f = fixture(),
    done = deferred();
  f.setWriter(async (candidate, guard) => {
    await done.promise;
    assert.equal(guard.isCurrent(), true);
    f.setCurrent(candidate);
    return { ok: true };
  });
  await f.click('edit');
  await f.set('glyphFamily', 'xbox');
  const operation = f.click('apply');
  await f.click('apply');
  await f.click('cancel');
  await f.click('defaults');
  assert.equal(f.calls.length, 1);
  assert.equal(f.action('apply').disabled, true);
  done.resolve();
  await operation;
  assert.equal(f.current.glyphFamily, 'xbox');
  assert.match(f.status.textContent, /settings applied/);
  assert.equal(f.action('edit').disabled, false);
});

test('native Apply blur restores the same enabled Edit button and releases focus observers', async () => {
  const f = fixture(),
    done = deferred();
  f.setWriter(async (candidate) => {
    await done.promise;
    f.setCurrent(candidate);
    return { ok: true };
  });
  await f.click('edit');
  const edit = f.action('edit'),
    applying = f.click('apply');
  assert.equal(f.doc.blurred.at(-1), f.action('apply'));
  assert.equal(f.doc.activeElement, f.doc.body, 'Native disabling removes action focus.');
  assert.ok(f.doc.listeners.get('focusin').size > 0);
  done.resolve();
  await applying;
  assert.equal(f.doc.activeElement, edit);
  assert.equal(edit.disabled, false);
  assert.equal(edit.hidden, false);
  assert.ok([...f.doc.listeners.values()].every((listeners) => listeners.size === 0));
  assert.ok([...f.doc.defaultView.listeners.values()].every((listeners) => listeners.size === 0));
});

for (const departure of [
  'other modal',
  'other control then blur',
  'pointer on body',
  'keyboard navigation',
  'window blur and return',
  'hidden page',
  'hidden page then return',
])
  test(`pending Apply does not reclaim focus after ${departure}`, async () => {
    const f = fixture(),
      done = deferred(),
      outside = f.doc.createElement('button');
    f.doc.body.append(outside);
    f.setWriter(async (candidate) => {
      await done.promise;
      f.setCurrent(candidate);
      return { ok: true };
    });
    await f.click('edit');
    const applying = f.click('apply');
    assert.equal(f.doc.activeElement, f.doc.body);
    if (departure === 'other modal' || departure === 'other control then blur') {
      outside.focus();
      if (departure === 'other control then blur') outside.blur();
    } else if (departure === 'pointer on body') f.doc.emit('pointerdown', { target: f.doc.body });
    else if (departure === 'keyboard navigation') f.doc.emit('keydown', { key: 'Tab' });
    else if (departure === 'window blur and return') f.doc.defaultView.emit('blur');
    else {
      f.doc.hidden = true;
      f.doc.emit('visibilitychange');
      if (departure === 'hidden page then return') {
        f.doc.hidden = false;
        f.doc.emit('visibilitychange');
      }
    }
    const intendedFocus = f.doc.activeElement;
    done.resolve();
    await applying;
    assert.equal(f.doc.activeElement, intendedFocus);
    assert.match(f.status.textContent, /settings applied/);
    assert.ok([...f.doc.listeners.values()].every((listeners) => listeners.size === 0));
  });

test('programmatic Apply without initial focus ownership does not claim body focus', async () => {
  const f = fixture();
  await f.click('edit');
  f.field('glyphFamily').blur();
  await f.action('apply').emit('click');
  assert.equal(f.doc.activeElement, f.doc.body);
  assert.match(f.status.textContent, /settings applied/);
});

test('refresh aborts a pending ticket; a guarded async host cannot adopt it or overwrite fresh status', async () => {
  const f = fixture(),
    done = deferred();
  f.setWriter(async (candidate, guard) => {
    await done.promise;
    if (guard.isCurrent()) f.setCurrent(candidate);
  });
  await f.click('edit');
  await f.set('glyphFamily', 'xbox');
  const operation = f.click('apply');
  f.api.refresh();
  const message = f.status.textContent;
  assert.equal(f.calls[0].guard.signal.aborted, true);
  assert.equal(f.calls[0].guard.isCurrent(), false);
  assert.ok([...f.doc.listeners.values()].every((listeners) => listeners.size === 0));
  await f.click('edit');
  assert.equal(f.before, 1);
  done.resolve();
  await operation;
  assert.equal(f.current, null);
  assert.equal(f.status.textContent, message);
  assert.equal(f.action('edit').disabled, false);
  assert.equal(f.doc.activeElement, f.doc.body, 'A refreshed ticket cannot restore old focus.');
});

test('source changes during asynchronous preparation invalidate the guard without a refresh', async () => {
  const f = fixture(),
    done = deferred();
  f.setWriter(async (candidate, guard) => {
    await done.promise;
    if (guard.isCurrent()) f.setCurrent(candidate);
  });
  await f.click('edit');
  await f.set('glyphFamily', 'xbox');
  const operation = f.click('apply');
  const imported = resolveControllerBindings(null);
  imported.glyphFamily = 'playstation';
  f.setCurrent(imported);
  assert.equal(f.calls[0].guard.isCurrent(), false);
  done.resolve();
  await operation;
  assert.equal(f.current, imported);
  assert.match(f.status.textContent, /changed before this draft/);
  assert.equal(f.doc.activeElement, f.doc.body, 'Changed source cannot restore old focus.');
});

test('malformed current data fails visibly and a later valid refresh recovers', async () => {
  const f = fixture({ version: 'unknown' });
  assert.equal(f.action('edit').disabled, true);
  assert.match(f.status.textContent, /Invalid controller bindings/);
  f.setCurrent(null);
  f.api.refresh();
  assert.equal(f.action('edit').disabled, false);
  await f.click('edit');
  await f.set('glyphFamily', 'xbox');
  f.setWriter(() => {
    f.setCurrent({});
    throw new Error('Bad host');
  });
  await f.click('apply');
  assert.match(f.status.textContent, /Invalid controller bindings/);
});

test('destroy removes listeners and aborts pending work without late DOM adoption', async () => {
  const f = fixture(),
    done = deferred();
  f.setWriter(async (candidate, guard) => {
    await done.promise;
    if (guard.isCurrent()) f.setCurrent(candidate);
  });
  await f.click('edit');
  const operation = f.click('apply');
  f.api.destroy();
  f.api.destroy();
  assert.equal(f.calls[0].guard.signal.aborted, true);
  assert.ok([...f.doc.listeners.values()].every((listeners) => listeners.size === 0));
  assert.equal(f.container.children.length, 0);
  assert.ok(f.all.every((node) => [...node.listeners.values()].every((list) => list.length === 0)));
  done.resolve();
  await operation;
  assert.equal(f.current, null);
  assert.equal(f.container.children.length, 0);
  assert.equal(f.doc.activeElement, f.doc.body, 'Disposal cannot restore detached focus.');
});
