import test from 'node:test';
import assert from 'node:assert/strict';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';

class Events {
  listeners = new Map();
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }
  dispatchEvent(event) {
    if (!event.target) Object.defineProperty(event, 'target', { configurable: true, value: this });
    for (const fn of [...(this.listeners.get(event.type) || [])]) fn(event);
    if (event.bubbles && this.parentNode) this.parentNode.dispatchEvent(event);
    return !event.defaultPrevented;
  }
  emit(type, extra = {}) {
    const event = {
      type,
      target: this,
      bubbles: true,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {
        this.bubbles = false;
      },
      ...extra,
    };
    this.dispatchEvent(event);
    return event;
  }
}
class Classes {
  values = new Set();
  add(...names) {
    for (const name of names) this.values.add(name);
  }
  remove(...names) {
    for (const name of names) this.values.delete(name);
  }
  contains(name) {
    return this.values.has(name);
  }
  toggle(name, force) {
    const add = force ?? !this.contains(name);
    if (add) this.add(name);
    else this.remove(name);
    return add;
  }
}
class Element extends Events {
  constructor(document, tag = 'button', options = {}) {
    super();
    this.ownerDocument = document;
    this.tagName = tag.toUpperCase();
    this.nodeName = this.tagName;
    this.nodeType = 1;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.classList = new Classes();
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.inert = false;
    this.checked = false;
    this.open = false;
    this.tabIndex = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A', 'SUMMARY'].includes(this.tagName)
      ? 0
      : -1;
    this.type = tag === 'input' ? 'text' : '';
    this.value = '';
    this.textContent = '';
    this.options = [];
    this.id = '';
    this._rect = { x: 0, y: 0, width: 100, height: 44 };
    Object.assign(this, options);
  }
  get parentElement() {
    return this.parentNode?.nodeType === 1 ? this.parentNode : null;
  }
  get isConnected() {
    return this.parentNode?.nodeType === 9 || !!this.parentNode?.isConnected;
  }
  get selectedIndex() {
    return this.options.findIndex((option) => option.value === this.value);
  }
  set selectedIndex(index) {
    this.value = this.options[index]?.value ?? '';
  }
  set className(value) {
    this.classList = new Classes();
    this.classList.add(...value.split(/\s+/).filter(Boolean));
  }
  get className() {
    return [...this.classList.values].join(' ');
  }
  set innerHTML(_value) {
    throw new Error('Controller navigation must use safe DOM text.');
  }
  append(...nodes) {
    for (const node of nodes) {
      node.remove?.();
      this.children.push(node);
      node.parentNode = this;
    }
  }
  appendChild(node) {
    this.append(node);
    return node;
  }
  after(node) {
    const siblings = this.parentNode.children;
    node.remove?.();
    siblings.splice(siblings.indexOf(this) + 1, 0, node);
    node.parentNode = this.parentNode;
  }
  insertAdjacentElement(position, node) {
    assert.equal(position, 'afterend');
    this.after(node);
  }
  remove() {
    if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
    this.parentNode = null;
  }
  contains(node) {
    return node === this || this.children.some((child) => child.contains(node));
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'id') this.id = String(value);
    if (name === 'tabindex') this.tabIndex = Number(value);
  }
  getAttribute(name) {
    if (name === 'id') return this.id || null;
    if (name === 'type') return this.type || null;
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name) {
    return this.attributes.has(name);
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  matches(selector) {
    return selector.split(',').some((part) => {
      part = part.trim();
      if (part === ':disabled') return this.disabled;
      if (part.startsWith('.')) return this.classList.contains(part.slice(1));
      if (part.startsWith('#')) return this.id === part.slice(1);
      const excluded = [...part.matchAll(/:not\(([^)]+)\)/g)].map((match) => match[1]);
      if (excluded.some((item) => this.matches(item))) return false;
      part = part.replace(/:not\([^)]+\)/g, '');
      const tag = part.match(/^[a-z]+/i)?.[0];
      if (tag && this.tagName !== tag.toUpperCase()) return false;
      for (const match of part.matchAll(/\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]/g)) {
        const [, key, value] = match;
        const actual =
          key === 'hidden'
            ? this.hidden
              ? ''
              : null
            : key === 'disabled'
              ? this.disabled
                ? ''
                : null
              : key === 'inert'
                ? this.inert
                  ? ''
                  : null
                : key === 'open'
                  ? this.open
                    ? ''
                    : null
                  : this.getAttribute(key);
        if (actual === null || (value !== undefined && actual !== value)) return false;
      }
      return !!tag || part.startsWith('[') || part === '*';
    });
  }
  closest(selector) {
    for (let node = this; node?.nodeType === 1; node = node.parentNode)
      if (node.matches(selector)) return node;
    return null;
  }
  querySelectorAll(selector) {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  getBoundingClientRect() {
    const r = this._rect;
    return { ...r, left: r.x, top: r.y, right: r.x + r.width, bottom: r.y + r.height };
  }
  getClientRects() {
    for (let node = this; node?.nodeType === 1; node = node.parentNode)
      if (node.hidden || node.style.display === 'none') return [];
    return this.isConnected ? [this.getBoundingClientRect()] : [];
  }
  focus() {
    this.ownerDocument.activeElement = this;
    this.emit('focusin');
  }
  blur() {
    this.ownerDocument.activeElement = this.ownerDocument.body;
  }
  scrollIntoView() {
    this.scrolled = (this.scrolled ?? 0) + 1;
  }
  click() {
    if (this.disabled) return;
    if (this.tagName === 'INPUT' && this.type === 'checkbox') this.checked = !this.checked;
    this.emit('click');
    if (this.tagName === 'INPUT' && this.type === 'checkbox') {
      this.emit('input');
      this.emit('change');
    }
  }
}
class Document extends Events {
  constructor() {
    super();
    this.nodeType = 9;
    this.children = [];
    this.documentElement = new Element(this, 'html');
    this.documentElement.parentNode = this;
    this.children.push(this.documentElement);
    this.body = new Element(this, 'body');
    this.documentElement.append(this.body);
    this.activeElement = this.body;
    this.defaultView = {
      Event,
      getComputedStyle: (element) => ({
        display: element.style.display || 'block',
        visibility: element.style.visibility || 'visible',
      }),
    };
  }
  createElement(tag) {
    return new Element(this, tag);
  }
  contains(node) {
    return node === this || this.documentElement.contains(node);
  }
  querySelectorAll(selector) {
    return this.documentElement.querySelectorAll(selector);
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  getElementById(id) {
    return this.querySelector(`#${id}`);
  }
}

function setup(t, overrides = {}) {
  const document = new Document();
  let scope = 'ready:first',
    root = document,
    defaultFocus = null;
  const calls = { back: 0, menu: 0, hints: [] };
  const api = attachControllerNavigation({
    document,
    getScope: () => scope,
    getRoot: () => root,
    getDefaultFocus: () => defaultFocus,
    onBack: () => {
      calls.back++;
    },
    onMenu: () => {
      calls.menu++;
    },
    onHint: (text) => calls.hints.push(text),
    ...overrides,
  });
  const control = (tag = 'button', options = {}, parent = document.body) => {
    const node = new Element(document, tag, options);
    parent.append(node);
    return node;
  };
  t.after(() => api.destroy());
  return {
    api,
    document,
    calls,
    control,
    select(options = ['First', 'Second', 'Third']) {
      return control('select', {
        value: options[0].toLowerCase(),
        options: options.map((text) => ({
          value: text.toLowerCase(),
          text,
          textContent: text,
          label: text,
          disabled: false,
          hidden: false,
        })),
      });
    },
    setScope(next, nextRoot = root) {
      scope = next;
      root = nextRoot;
    },
    setDefault(node) {
      defaultFocus = node;
    },
    editors: () => document.querySelectorAll('.controller-editor'),
  };
}

test('select browsing uses a separate preview, and Back cancels without changing or firing native handlers', (t) => {
  const h = setup(t),
    select = h.select();
  let changes = 0;
  select.addEventListener('change', () => changes++);
  select.focus();
  h.api.handle({ confirm: true });
  assert.equal(h.editors().length, 1);
  assert.equal(h.editors()[0].getAttribute('role'), 'status');
  h.api.handle({ direction: 'down' });
  assert.match(h.editors()[0].textContent, /Second/);
  assert.equal(select.value, 'first');
  assert.equal(changes, 0);
  h.api.handle({ back: true });
  assert.equal(select.value, 'first');
  assert.equal(changes, 0);
  assert.equal(h.editors().length, 0);
  assert.equal(h.calls.back, 0);
  assert.equal(select.hasAttribute('data-controller-editing'), false);
  assert.equal(h.document.activeElement, select);
});

test('select Confirm commits once through the existing change handler and ignores disabled choices', (t) => {
  const h = setup(t),
    select = h.select(['First', 'Disabled', 'Group', 'Last']);
  select.options[1].disabled = true;
  select.options[2].parentElement = { disabled: true };
  const values = [];
  select.addEventListener('change', () => values.push(select.value));
  select.focus();
  h.api.handle({ confirm: true });
  h.api.handle({ direction: 'right' });
  assert.match(h.editors()[0].textContent, /Last/);
  assert.equal(select.value, 'first');
  h.api.handle({ confirm: true });
  h.api.handle({});
  assert.deepEqual(values, ['last']);
  assert.equal(h.editors().length, 0);
  h.api.handle({ confirm: true });
  h.api.handle({ confirm: true });
  assert.deepEqual(values, ['last'], 'Confirming the unchanged value must not restart a mission.');
});

for (const change of ['disabled', 'hidden', 'detached', 'options', 'value', 'focus', 'scope'])
  test(`stale ${change} cancels a select preview without activating its replacement on the same Confirm`, (t) => {
    const h = setup(t),
      select = h.select(),
      fallback = h.control();
    let changes = 0,
      clicks = 0;
    select.addEventListener('change', () => changes++);
    fallback.addEventListener('click', () => clicks++);
    h.setDefault(fallback);
    select.focus();
    h.api.handle({ confirm: true });
    h.api.handle({ direction: 'down' });
    if (change === 'disabled') select.disabled = true;
    if (change === 'hidden') select.hidden = true;
    if (change === 'detached') select.remove();
    if (change === 'options') select.options[1].label = 'Changed externally';
    if (change === 'value') select.value = 'third';
    if (change === 'focus') h.document.activeElement = fallback;
    if (change === 'scope') h.setScope('modal:replacement');
    const expected = select.value;
    h.api.handle({ confirm: true });
    assert.equal(changes, 0);
    assert.equal(select.value, expected);
    assert.equal(clicks, 0, 'A canceled editor cannot forward its Confirm to a different button.');
    assert.equal(h.editors().length, 0, 'A stale editor must not reopen on the same Confirm.');
  });

test('modal root traps navigation and delegates protected Back without closing or touching background actions', (t) => {
  const h = setup(t),
    background = h.control(),
    modal = h.control('dialog', { open: true });
  const first = h.control('button', {}, modal),
    second = h.control('button', {}, modal);
  let backgroundClicks = 0;
  background.addEventListener('click', () => backgroundClicks++);
  h.setScope('modal:library', modal);
  h.setDefault(first);
  background.focus();
  h.api.handle({ direction: 'down' });
  assert.ok([first, second].includes(h.document.activeElement));
  for (let i = 0; i < 8; i++) h.api.handle({ direction: 'down' });
  assert.ok(modal.contains(h.document.activeElement));
  h.api.handle({ back: true });
  h.api.handle({ menu: true });
  assert.equal(h.calls.back, 1);
  assert.equal(h.calls.menu, 1);
  assert.equal(modal.open, true);
  assert.equal(backgroundClicks, 0);
});

test('linear navigation skips hidden, disabled, inert, closed disclosure and host-rejected controls', (t) => {
  const h = setup(t, { accept: (element) => element.id !== 'gameplay-only' });
  const first = h.control();
  h.control('button', { disabled: true });
  h.control('button', { hidden: true });
  const inert = h.control('div', { inert: true });
  h.control('button', {}, inert);
  const hiddenByAria = h.control('div');
  hiddenByAria.setAttribute('aria-hidden', 'true');
  h.control('button', {}, hiddenByAria);
  h.control('button', { style: { visibility: 'hidden' } });
  h.control('button', { id: 'gameplay-only' });
  const details = h.control('details'),
    summary = h.control('summary', {}, details);
  h.control('button', {}, details);
  const last = h.control();
  first.focus();
  h.api.handle({ direction: 'down' });
  assert.equal(h.document.activeElement, summary);
  h.api.handle({ direction: 'down' });
  assert.equal(h.document.activeElement, last);
  h.api.handle({ direction: 'down' });
  assert.equal(h.document.activeElement, first);
  h.api.handle({ direction: 'up' });
  assert.equal(h.document.activeElement, last);
});

for (const id of ['gallery-grid', 'missions'])
  test(`${id} uses geometric neighbors within a two-column layout`, (t) => {
    const h = setup(t),
      grid = h.control('div', { id });
    const a = h.control('button', { _rect: { x: 0, y: 0, width: 100, height: 44 } }, grid);
    const b = h.control('button', { _rect: { x: 130, y: 0, width: 100, height: 44 } }, grid);
    const c = h.control('button', { _rect: { x: 0, y: 70, width: 100, height: 44 } }, grid);
    const d = h.control('button', { _rect: { x: 130, y: 70, width: 100, height: 44 } }, grid);
    a.focus();
    h.api.handle({ direction: 'down' });
    assert.equal(h.document.activeElement, c);
    h.api.handle({ direction: 'right' });
    assert.equal(h.document.activeElement, d);
    h.api.handle({ direction: 'up' });
    assert.equal(h.document.activeElement, b);
    h.api.handle({ direction: 'left' });
    assert.equal(h.document.activeElement, a);
    assert.ok(a.scrolled > 0);
    assert.ok(a.classList.contains('controller-focus'));
  });

test('slider draft clamps and commits one input/change pair; cancellation never writes the real value', (t) => {
  const h = setup(t),
    range = h.control('input', { type: 'range', min: '0', max: '1', step: '0.1', value: '0.5' });
  const events = [];
  for (const type of ['input', 'change'])
    range.addEventListener(type, () => events.push([type, range.value]));
  range.focus();
  h.api.handle({ confirm: true });
  h.api.handle({ direction: 'right' });
  assert.equal(range.value, '0.5');
  assert.deepEqual(events, []);
  assert.match(h.editors()[0].textContent, /0\.6/);
  h.api.handle({ back: true });
  assert.equal(range.value, '0.5');
  assert.deepEqual(events, []);
  h.api.handle({ confirm: true });
  for (let i = 0; i < 20; i++) h.api.handle({ direction: 'right' });
  assert.equal(range.value, '0.5');
  h.api.handle({ confirm: true });
  assert.equal(range.value, '1');
  assert.deepEqual(events, [
    ['input', '1'],
    ['change', '1'],
  ]);
});

test('buttons and checkboxes activate through their existing handlers once per logical edge', (t) => {
  const h = setup(t),
    button = h.control(),
    checkbox = h.control('input', { type: 'checkbox' });
  let clicks = 0,
    changes = 0;
  button.addEventListener('click', () => clicks++);
  checkbox.addEventListener('change', () => changes++);
  button.focus();
  h.api.handle({ confirm: true, direction: 'down' });
  h.api.handle({});
  assert.equal(clicks, 1);
  assert.equal(h.document.activeElement, button);
  checkbox.focus();
  h.api.handle({ confirm: true });
  h.api.handle({});
  assert.equal(checkbox.checked, true);
  assert.equal(changes, 1);
});

test('file and text controls explain the host limitation without opening a picker or changing text', (t) => {
  const h = setup(t);
  for (const [tag, type] of [
    ['input', 'file'],
    ['input', 'text'],
    ['textarea', ''],
  ]) {
    const element = h.control(tag, { type, value: 'unchanged' });
    let clicks = 0;
    element.addEventListener('click', () => clicks++);
    element.focus();
    h.api.handle({ confirm: true });
    assert.equal(clicks, 0);
    assert.equal(element.value, 'unchanged');
    assert.equal(h.editors().length, 0);
    assert.match(h.calls.hints.at(-1), /keyboard or touch/);
  }
});

for (const event of ['pointerdown', 'keydown'])
  test(`${event} relinquishes controller focus and cancels an uncommitted edit`, (t) => {
    const h = setup(t),
      select = h.select();
    select.focus();
    h.api.handle({ confirm: true });
    h.api.handle({ direction: 'down' });
    assert.ok(select.classList.contains('controller-focus'));
    select.emit(event);
    h.api.sync();
    assert.equal(select.classList.contains('controller-focus'), false);
    assert.equal(select.value, 'first');
    assert.equal(h.editors().length, 0);
  });

test('external focus changes cancel editing and a flight scope suppresses all menu actions', (t) => {
  const h = setup(t),
    select = h.select(),
    other = h.control();
  select.focus();
  h.api.handle({ confirm: true });
  h.api.handle({ direction: 'down' });
  other.focus();
  assert.equal(h.editors().length, 0);
  assert.equal(select.value, 'first');
  let clicks = 0;
  other.addEventListener('click', () => clicks++);
  h.setScope('flight');
  h.api.sync();
  h.api.handle({ direction: 'left', confirm: true, back: true, menu: true });
  assert.equal(clicks, 0);
  assert.equal(h.calls.back, 0);
  assert.equal(h.calls.menu, 0);
  assert.equal(other.classList.contains('controller-focus'), false);
});

test('destroy removes listeners and prevents all later controller actions', (t) => {
  const h = setup(t),
    button = h.control();
  let clicks = 0;
  button.addEventListener('click', () => clicks++);
  button.focus();
  h.api.handle({ confirm: true });
  assert.equal(clicks, 1);
  h.api.destroy();
  h.api.destroy();
  h.api.handle({ confirm: true });
  h.api.sync();
  button.emit('pointerdown');
  button.emit('keydown');
  button.focus();
  assert.equal(clicks, 1);
  assert.equal(button.classList.contains('controller-focus'), false);
  assert.equal(
    [...h.document.listeners.values()].reduce((sum, handlers) => sum + handlers.size, 0),
    0,
  );
});

test('sync cancels a stale editor immediately, and an unchanged scope token cannot retain the old modal root', (t) => {
  const h = setup(t),
    firstRoot = h.control('dialog', { open: true });
  const secondRoot = h.control('dialog', { open: true });
  const select = h.select(),
    fallback = h.control('button', {}, secondRoot);
  firstRoot.append(select);
  let writes = 0,
    clicks = 0;
  select.addEventListener('change', () => writes++);
  fallback.addEventListener('click', () => clicks++);
  h.setScope('modal:panel', firstRoot);
  select.focus();
  h.api.handle({ confirm: true });
  h.api.handle({ direction: 'down' });
  h.setDefault(fallback);
  h.setScope('modal:panel', secondRoot);
  h.api.handle({ confirm: true });
  assert.equal(writes, 0);
  assert.equal(clicks, 0);
  assert.equal(h.editors().length, 0);
  assert.equal(h.document.activeElement, fallback);
  h.setScope('modal:panel', firstRoot);
  h.setDefault(select);
  h.api.sync();
  h.api.handle({ confirm: true });
  h.api.handle({ direction: 'down' });
  select.value = 'third';
  h.api.sync();
  assert.equal(h.editors().length, 0);
  assert.equal(writes, 0);
  assert.equal(select.value, 'third');
});

test('a slider range change invalidates the draft before Confirm can commit an obsolete value', (t) => {
  const h = setup(t),
    range = h.control('input', { type: 'range', min: '0', max: '1', step: '0.1', value: '0.5' });
  let changes = 0;
  range.addEventListener('change', () => changes++);
  range.focus();
  h.api.handle({ confirm: true });
  h.api.handle({ direction: 'right' });
  range.max = '0.5';
  h.api.handle({ confirm: true });
  assert.equal(changes, 0);
  assert.equal(range.value, '0.5');
  assert.equal(h.editors().length, 0);
});

test('Menu cancels an editor first; clear relinquishes navigation without destroying normal DOM controls', (t) => {
  const h = setup(t),
    select = h.select();
  let changes = 0;
  select.addEventListener('change', () => changes++);
  select.focus();
  h.api.handle({ confirm: true });
  h.api.handle({ direction: 'down' });
  h.api.handle({ menu: true });
  assert.equal(h.calls.menu, 0);
  assert.equal(select.value, 'first');
  assert.equal(changes, 0);
  h.api.handle({ menu: true });
  assert.equal(h.calls.menu, 1);
  h.api.handle({ confirm: true });
  h.api.handle({ direction: 'down' });
  h.api.clear();
  h.api.sync();
  assert.equal(h.editors().length, 0);
  assert.equal(select.classList.contains('controller-focus'), false);
  select.value = 'third';
  select.emit('change');
  assert.equal(changes, 1, 'Relinquishing controller mode must preserve ordinary form handlers.');
});

test('a disabled focused button cannot redirect its Confirm into a neighboring destructive action', (t) => {
  const h = setup(t),
    original = h.control(),
    other = h.control();
  let clicks = 0;
  other.addEventListener('click', () => clicks++);
  original.focus();
  h.api.handle({ confirm: true });
  h.setDefault(other);
  original.disabled = true;
  h.api.handle({ confirm: true });
  assert.equal(clicks, 0);
  assert.equal(h.document.activeElement, other);
  h.api.handle({ confirm: true });
  assert.equal(clicks, 1);
});

test('returning from a picture preserves the newly restored gallery origin instead of the modal default', (t) => {
  const h = setup(t),
    collection = h.control('dialog', { open: true });
  const first = h.control('button', {}, collection),
    origin = h.control('button', {}, collection);
  const picture = h.control('dialog', { open: true }),
    close = h.control('button', {}, picture);
  h.setScope('modal:collection', collection);
  h.setDefault(first);
  origin.focus();
  h.api.handle({ confirm: true });
  h.setScope('modal:picture', picture);
  h.setDefault(close);
  close.focus();
  h.api.sync();
  assert.equal(h.document.activeElement, close);
  // The gallery rebuilds its cards on close and resolves the stable originating
  // picture key before the navigation adapter sees the next frame's new root.
  origin.remove();
  const restoredOrigin = h.control('button', {}, collection);
  restoredOrigin.focus();
  h.setScope('modal:collection', collection);
  h.setDefault(first);
  h.api.sync();
  assert.equal(h.document.activeElement, restoredOrigin);
  assert.ok(restoredOrigin.classList.contains('controller-focus'));
  assert.equal(first.classList.contains('controller-focus'), false);
});

test('joining engages the default focus without activating it or leaking the join into Confirm', (t) => {
  const h = setup(t),
    first = h.control(),
    start = h.control();
  let clicks = 0;
  start.addEventListener('click', () => clicks++);
  h.setDefault(start);
  h.api.engage();
  assert.equal(h.document.activeElement, start);
  assert.ok(start.classList.contains('controller-focus'));
  assert.equal(first.classList.contains('controller-focus'), false);
  assert.equal(clicks, 0);
  h.api.engage();
  h.api.handle({});
  assert.equal(clicks, 0);
  assert.equal(h.calls.back, 0);
  assert.equal(h.calls.menu, 0);
  h.api.handle({ confirm: true });
  assert.equal(clicks, 1, 'Only the subsequent explicit Confirm may activate the focused control.');
});

test('engaging a new scope preserves a host-restored gallery card without opening it', (t) => {
  const h = setup(t),
    picture = h.control('dialog', { open: true }),
    close = h.control('button', {}, picture),
    collection = h.control('dialog', { open: true }),
    first = h.control('button', {}, collection),
    restored = h.control('button', {}, collection);
  let clicks = 0;
  restored.addEventListener('click', () => clicks++);
  h.setScope('modal:picture', picture);
  h.setDefault(close);
  h.api.engage();
  assert.equal(h.document.activeElement, close);
  restored.focus();
  h.setScope('modal:collection', collection);
  h.setDefault(first);
  h.api.engage();
  assert.equal(h.document.activeElement, restored);
  assert.ok(restored.classList.contains('controller-focus'));
  assert.equal(first.classList.contains('controller-focus'), false);
  assert.equal(close.classList.contains('controller-focus'), false);
  assert.equal(clicks, 0);
});

test('engage never enters menu navigation during flight or after destruction', (t) => {
  const h = setup(t),
    button = h.control();
  let clicks = 0;
  button.addEventListener('click', () => clicks++);
  h.setDefault(button);
  h.setScope('flight');
  h.api.engage();
  assert.equal(h.document.activeElement, h.document.body);
  assert.equal(button.classList.contains('controller-focus'), false);
  h.setScope('paused:first');
  h.api.engage();
  assert.ok(button.classList.contains('controller-focus'));
  h.setScope('flight');
  h.api.engage();
  assert.equal(button.classList.contains('controller-focus'), false);
  h.api.handle({ confirm: true, menu: true, back: true });
  assert.equal(clicks, 0);
  assert.equal(h.calls.menu, 0);
  assert.equal(h.calls.back, 0);
  h.api.destroy();
  button.blur();
  h.setScope('paused:first');
  h.api.engage();
  assert.equal(h.document.activeElement, h.document.body);
  assert.equal(button.classList.contains('controller-focus'), false);
  assert.equal(clicks, 0);
});

for (const type of ['select', 'range'])
  test(`${type} previews stay outside the enclosing label and preserve its name source`, (t) => {
    const h = setup(t),
      label = h.control('label'),
      control =
        type === 'select'
          ? h.select(['Scout', 'Carrier'])
          : h.control('input', { type: 'range', min: '0', max: '1', step: '0.1', value: '0.5' });
    label.append(control);
    const caption = { nodeType: 3, textContent: type === 'select' ? 'Choose craft ' : 'Volume ' };
    // Model the label's direct text and descendant text, not a browser's full
    // accessibility tree. An editor inserted inside this label changes both
    // its descendant text and the DOM source used to calculate its name.
    Object.defineProperties(label, {
      childNodes: { get: () => [caption, ...label.children] },
      textContent: {
        get: () => caption.textContent + label.children.map((child) => child.textContent).join(''),
      },
    });
    control.labels = [label];
    const originalLabelText = label.textContent,
      originalValue = control.value;
    let changes = 0;
    control.addEventListener('change', () => changes++);
    control.focus();
    h.api.handle({ confirm: true });
    const preview = h.editors()[0];
    assert.ok(preview);
    assert.equal(preview.parentNode, label.parentNode);
    assert.equal(
      label.parentNode.children.indexOf(preview),
      label.parentNode.children.indexOf(label) + 1,
    );
    assert.equal(label.contains(preview), false);
    assert.equal(label.textContent, originalLabelText);
    assert.ok(preview.textContent.includes(caption.textContent.trim()));
    h.api.handle({ direction: 'right' });
    assert.equal(label.textContent, originalLabelText);
    assert.equal(control.value, originalValue);
    assert.equal(changes, 0);
    assert.equal(control.labels[0], label);
    h.api.handle({ back: true });
    assert.equal(h.editors().length, 0);
    assert.equal(label.textContent, originalLabelText);
    assert.equal(control.value, originalValue);
    assert.equal(changes, 0);
  });
