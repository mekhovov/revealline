import test from 'node:test';
import assert from 'node:assert/strict';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { createControllerRouter, neutralControllerFlight } from '../ui/controller-router.mjs';
import { resolveControllerBindings } from '../controller-bindings.mjs';
import { attachControllerReading } from '../ui/controller-reading.mjs';
import { attachControllerBoostSettings } from '../ui/controller-boost-settings.mjs';

function readingSurface(h, options = {}) {
  const origin = h.control('button', { id: 'read-details', textContent: 'Read details' });
  const region = h.control('div', {
    id: 'reading-region',
    textContent: 'The full authored details. Last line.',
    tabIndex: 0,
    clientHeight: 100,
    scrollHeight: 400,
    ...options,
  });
  region.setAttribute('data-game-reading', '');
  region.setAttribute('aria-label', 'Mission details');
  region.setAttribute('role', 'region');
  const request = { region, origin, label: 'Mission details' };
  origin.addEventListener('click', () => h.api.beginReading(request));
  return { ...request, begin: () => h.api.beginReading(request) };
}

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
    this.clientHeight = 44;
    this.scrollHeight = 44;
    this.scrollTop = 0;
    this.scrollLeft = 0;
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

test('Boost preference previews cancel without writes and commit once through the native setting', (t) => {
  const h = setup(t),
    select = h.select(['Hold', 'Toggle']),
    status = h.control('p');
  const router = createControllerRouter({ readPads: () => [], eventTarget: null });
  let mode = 'hold',
    writes = 0;
  const settings = attachControllerBoostSettings({
    select,
    status,
    getMode: () => mode,
    applyMode(value) {
      writes++;
      mode = value;
      router.setBoostMode(value);
      return { ok: true };
    },
  });
  t.after(() => {
    settings.destroy();
    router.destroy();
  });
  h.setScope('modal:settings');
  select.focus();
  h.api.handle({ confirm: true });
  h.api.handle({ direction: 'down' });
  assert.equal(mode, 'hold');
  h.api.handle({ back: true });
  assert.equal(writes, 0);
  assert.equal(select.value, 'hold');
  h.api.handle({ confirm: true });
  h.api.handle({ direction: 'down' });
  h.api.handle({ confirm: true });
  assert.equal(writes, 1);
  assert.equal(mode, 'toggle');
  assert.deepEqual(router.boostState(), { mode: 'toggle', latched: false });
  assert.match(status.textContent, /Toggle\. Saved/);
  assert.equal(h.calls.menu, 0);
  assert.equal(h.calls.back, 0);
  assert.equal(h.document.activeElement, select);
});

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

test('selection previews describe the configured menu buttons without changing draft semantics', (t) => {
  const h = setup(t, {
    getControlLabels: () => ({
      directions: 'Direction controls',
      confirm: 'R1',
      back: 'Square (□)',
    }),
  });
  const select = h.select();
  select.focus();
  h.api.handle({ confirm: true });
  h.api.handle({ direction: 'down' });
  assert.match(
    h.editors()[0].textContent,
    /Second · Direction controls changes · R1 confirms · Square \(□\) cancels/,
  );
  assert.equal(select.value, 'first');
  h.api.handle({ back: true });
  assert.equal(select.value, 'first');
  assert.equal(h.editors().length, 0);
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

test('reading entry focuses a named region before notification and returns owned metadata', (t) => {
  const changes = [];
  const h = setup(t, {
    onReadingChange(state) {
      changes.push(state);
      if (state) {
        assert.equal(h.document.activeElement.id, 'reading-region');
        assert.deepEqual(h.api.readingState(), state);
        state.label = 'Consumer changed its copy';
      }
    },
  });
  const surface = readingSurface(h);
  surface.origin.focus();
  h.api.handle({ confirm: true });
  assert.equal(h.document.activeElement, surface.region);
  assert.ok(surface.region.classList.contains('controller-focus'));
  assert.equal(surface.region.getAttribute('data-controller-reading'), 'true');
  assert.deepEqual(h.api.readingState(), { regionId: 'reading-region', label: 'Mission details' });
  const snapshot = h.api.readingState();
  snapshot.regionId = 'wrong';
  assert.equal(h.api.readingState().regionId, 'reading-region');
  assert.equal(surface.begin(), true);
  assert.equal(changes.length, 1, 'A repeated request for this reader is idempotent.');
  h.api.engage();
  h.api.handle({});
  assert.equal(h.document.activeElement, surface.region);
  assert.equal(changes.length, 1);
});

test('reading hint refresh changes current copy without focus, transitions or stale scope publication', (t) => {
  let prompt = 'Up/Down scroll · Enter or Escape returns',
    transitions = 0;
  const h = setup(t, {
    getReadingPrompt: ({ scrollable }) =>
      scrollable ? prompt : 'All text is visible · Done returns',
    onReadingChange: () => transitions++,
  });
  assert.equal(h.api.refreshReadingHint(), false);
  assert.deepEqual(h.calls.hints, []);
  const surface = readingSurface(h);
  surface.origin.focus();
  surface.begin();
  const active = h.document.activeElement,
    beforeTransitions = transitions;
  surface.region.scrollTop = 80;
  let focuses = 0;
  const originalFocus = surface.region.focus.bind(surface.region);
  surface.region.focus = (...args) => {
    focuses++;
    originalFocus(...args);
  };
  prompt = 'Up/Down scroll · R1 or Square returns';
  assert.equal(h.api.refreshReadingHint(), true);
  assert.match(h.calls.hints.at(-1), /R1 or Square returns/);
  assert.equal(h.document.activeElement, active);
  assert.equal(surface.region.scrollTop, 80);
  assert.equal(focuses, 0);
  assert.equal(transitions, beforeTransitions);
  const hints = [...h.calls.hints];
  surface.origin.hidden = true;
  assert.equal(h.api.refreshReadingHint(), false);
  surface.origin.hidden = false;
  h.setScope('another-visit');
  assert.equal(h.api.refreshReadingHint(), false);
  assert.deepEqual(h.calls.hints, hints);
  assert.equal(h.document.activeElement, active);
  assert.equal(transitions, beforeTransitions, 'Refresh does not perform sync cancellation.');
  h.api.destroy();
  assert.equal(h.api.refreshReadingHint(), false);
});

test('reader scrolls vertically to both endpoints without moving focus, wrapping or repeating edge announcements', (t) => {
  const h = setup(t);
  const surface = readingSurface(h, { scrollTop: 50, scrollLeft: 7 });
  surface.begin();
  const scrolls = surface.region.scrolled;
  for (let i = 0; i < 10; i++) h.api.handle({ direction: 'down' });
  assert.equal(surface.region.scrollTop, 300);
  assert.equal(surface.region.scrollLeft, 0);
  assert.equal(h.document.activeElement, surface.region);
  assert.equal(
    surface.region.scrolled,
    scrolls,
    'Repeated scrolls do not scroll ancestors into view.',
  );
  assert.equal(h.calls.hints.filter((text) => text.startsWith('End of details.')).length, 1);
  h.api.handle({ direction: 'right' });
  h.api.handle({ direction: 'left' });
  assert.equal(surface.region.scrollTop, 300);
  assert.equal(h.document.activeElement, surface.region);
  for (let i = 0; i < 10; i++) h.api.handle({ direction: 'up' });
  assert.equal(surface.region.scrollTop, 0);
  assert.equal(h.calls.hints.filter((text) => text.startsWith('Start of details.')).length, 1);
  assert.equal(h.calls.back + h.calls.menu, 0);
});

test('small and nonoverflowing readers have bounded steps and always permit immediate exit', (t) => {
  const h = setup(t);
  const surface = readingSurface(h, { clientHeight: 31, scrollHeight: 100 });
  surface.begin();
  h.api.handle({ direction: 'down' });
  assert.equal(surface.region.scrollTop, 15);
  surface.region.clientHeight = 150;
  h.api.sync();
  assert.equal(
    surface.region.scrollTop,
    0,
    'Resize clamps position without cancelling the reader.',
  );
  assert.ok(h.api.readingState());
  h.api.handle({ direction: 'down' });
  assert.equal(surface.region.scrollTop, 0);
  assert.match(h.calls.hints.at(-1), /All text is visible/);
  h.api.handle({ back: true });
  assert.equal(h.api.readingState(), null);
  assert.equal(h.document.activeElement, surface.origin);
});

for (const action of ['back', 'confirm', 'menu'])
  test(`reading ${action} ends once and consumes the complete gesture before host actions`, (t) => {
    const order = [];
    const h = setup(t, {
      getControlLabels: () => ({ directions: 'Directions', confirm: 'R1', back: 'Square' }),
      onReadingChange: (value) => order.push(value ? 'entered' : 'ended'),
      onHint: (text) => order.push(text),
    });
    const surface = readingSurface(h);
    let activations = 0;
    surface.origin.addEventListener('click', () => activations++);
    surface.begin();
    assert.match(order.at(-1), /R1 or Square returns/);
    h.api.handle({ [action]: true, direction: 'down' });
    assert.equal(h.api.readingState(), null);
    assert.equal(surface.region.scrollTop, 0);
    assert.equal(surface.region.hasAttribute('data-controller-reading'), false);
    assert.equal(h.document.activeElement, surface.origin);
    assert.equal(activations, 0);
    assert.equal(h.calls.back + h.calls.menu, 0);
    assert.equal(order.at(-2), 'ended');
    assert.match(order.at(-1), /Reading ended/);
    assert.equal(h.api.endReading(), false);
    assert.equal(order.filter((value) => value === 'ended').length, 1);
  });

test('entry validates the entire surface before replacing a reader or cancelling an editor', (t) => {
  const h = setup(t),
    surface = readingSurface(h),
    select = h.select();
  select.focus();
  h.api.handle({ confirm: true });
  h.api.handle({ direction: 'down' });
  assert.equal(h.api.beginReading({ ...surface, label: '' }), false);
  assert.equal(h.editors().length, 1);
  assert.equal(surface.begin(), true);
  assert.equal(h.editors().length, 0);
  assert.equal(select.value, 'first');
  const initial = h.api.readingState();
  for (const request of [
    {},
    { ...surface, label: 'x'.repeat(161) },
    { ...surface, origin: surface.region },
    { ...surface, region: h.control('div', { id: 'unmarked', tabIndex: 0 }) },
    { ...surface, origin: h.control('button', { hidden: true }) },
  ]) {
    assert.equal(h.api.beginReading(request), false);
    assert.deepEqual(h.api.readingState(), initial);
  }
  h.api.endReading({ restoreFocus: false });
  assert.equal(h.document.activeElement, surface.region);
  h.setScope('flight');
  assert.equal(surface.begin(), false);
  h.setScope('ready:again');
  h.api.destroy();
  assert.equal(surface.begin(), false);
});

for (const [name, change] of [
  ['removed region', ({ region }) => region.remove()],
  [
    'changed region identity',
    ({ region }) => {
      region.id = 'another-region';
    },
  ],
  [
    'hidden region',
    ({ region }) => {
      region.hidden = true;
    },
  ],
  [
    'inert region',
    ({ region }) => {
      region.inert = true;
    },
  ],
  ['removed origin', ({ origin }) => origin.remove()],
  [
    'disabled origin',
    ({ origin }) => {
      origin.disabled = true;
    },
  ],
  [
    'replaced content',
    ({ region }) => {
      region.textContent = 'A new mission.';
    },
  ],
  ['removed marker', ({ region }) => region.removeAttribute('data-game-reading')],
  [
    'collapsed viewport',
    ({ region }) => {
      region.clientHeight = 0;
    },
  ],
])
  test(`${name} cancels reading and cannot redirect the invalidating Confirm to another action`, (t) => {
    const changes = [];
    const h = setup(t, { onReadingChange: (value) => changes.push(value) });
    const surface = readingSurface(h),
      start = h.control('button', { id: 'start' });
    let clicks = 0;
    start.addEventListener('click', () => clicks++);
    h.setDefault(start);
    surface.begin();
    change(surface);
    h.api.handle({ confirm: true });
    assert.equal(h.api.readingState(), null);
    assert.equal(h.document.activeElement, start);
    assert.equal(clicks, 0);
    assert.equal(changes.length, 2);
    assert.equal(changes[1], null);
    h.api.handle({ confirm: true });
    assert.equal(clicks, 1);
  });

test('scope and root changes cancel reading without restoring stale focus or activating the next dialog', (t) => {
  const h = setup(t),
    surface = readingSurface(h),
    dialog = h.control('dialog', { open: true }),
    close = h.control('button', {}, dialog);
  let clicks = 0;
  close.addEventListener('click', () => clicks++);
  surface.begin();
  close.focus();
  h.setScope('modal:help', dialog);
  h.setDefault(close);
  h.api.handle({ confirm: true });
  assert.equal(h.api.readingState(), null);
  assert.equal(h.document.activeElement, close);
  assert.equal(clicks, 0);
  assert.equal(h.api.beginReading(surface), false, 'The modal cannot read outside its root.');
});

test('native focus, pointer and keyboard relinquish reading without stealing focus or swallowing native keys', (t) => {
  for (const type of ['focusin', 'pointerdown', 'keydown']) {
    const h = setup(t),
      surface = readingSurface(h),
      other = h.control('button');
    let clicks = 0;
    other.addEventListener('click', () => clicks++);
    surface.begin();
    if (type === 'focusin') other.focus();
    else {
      const event = surface.region.emit(type, { key: 'ArrowDown' });
      assert.equal(event.defaultPrevented, false);
      assert.equal(h.document.activeElement, surface.region);
      other.focus();
    }
    assert.equal(h.api.readingState(), null);
    assert.equal(h.document.activeElement, other);
    h.api.handle({ confirm: true });
    assert.equal(clicks, 0);
    h.api.handle({ confirm: true });
    assert.equal(clicks, 1);
  }
});

test('an end-only Done button stays harmless after pointerdown already cancelled reading', (t) => {
  const h = setup(t),
    surface = readingSurface(h),
    done = h.control('button', { textContent: 'Done reading' });
  let changes = 0;
  done.addEventListener('click', () => {
    if (h.api.endReading()) changes++;
  });
  surface.begin();
  done.emit('pointerdown');
  done.focus();
  done.click();
  assert.equal(h.api.readingState(), null);
  assert.equal(h.document.activeElement, done);
  assert.equal(changes, 0);
  assert.equal(h.calls.back + h.calls.menu, 0);
});

test('lifecycle clear cancels reading once, preserves scroll position and consumes stale input', (t) => {
  const changes = [];
  const h = setup(t, { onReadingChange: (value) => changes.push(value) });
  const surface = readingSurface(h),
    start = h.control('button');
  let clicks = 0;
  start.addEventListener('click', () => clicks++);
  surface.begin();
  h.api.handle({ direction: 'down' });
  h.api.clear();
  h.api.clear();
  assert.equal(changes.length, 2);
  assert.equal(surface.region.scrollTop, 48);
  assert.equal(surface.region.classList.contains('controller-focus'), false);
  start.focus();
  h.api.handle({ confirm: true });
  assert.equal(clicks, 0);
  surface.begin();
  assert.equal(surface.region.scrollTop, 48);
  h.api.destroy();
  h.api.handle({ confirm: true, menu: true, direction: 'down' });
  assert.equal(h.api.readingState(), null);
  assert.equal(surface.region.scrollTop, 48);
  assert.equal(clicks, 0);
});

test('real remapped router drives reading repeats and gates held buttons/sticks across entry and exit', (t) => {
  const config = resolveControllerBindings();
  Object.assign(config.menu.buttons, { confirm: 5, back: 2, menu: 9 });
  Object.assign(config.menu.stick, { xAxis: 2, yAxis: 3, invertY: true });
  const pad = {
    index: 0,
    id: 'Test standard pad',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
  };
  let reads = 0,
    samples = 0,
    time = 0;
  const router = createControllerRouter({
    bindings: config,
    eventTarget: null,
    readPads: () => {
      reads++;
      return [pad];
    },
  });
  t.after(() => router.destroy());
  const h = setup(t, {
    onReadingChange: () => router.clear(),
    getControlLabels: () => ({ confirm: 'Right shoulder', back: 'West' }),
  });
  const surface = readingSurface(h);
  h.setDefault(surface.origin);
  const sample = (scope = 'ready:first', advance = 16) => {
    samples++;
    const frame = router.sample({ scope, timeMs: (time += advance) });
    h.api.handle(frame.ui);
    assert.deepEqual(frame.flight, neutralControllerFlight());
    assert.equal(reads, samples, 'Only the existing router reads hardware.');
    return frame;
  };
  const neutral = () => {
    pad.buttons.forEach((button) => {
      button.pressed = false;
    });
    pad.axes.fill(0);
    return sample();
  };
  sample();
  pad.buttons[0].pressed = true;
  assert.equal(sample().status.code, 'joined');
  neutral();
  pad.buttons[5].pressed = true;
  sample();
  assert.ok(h.api.readingState());
  assert.equal(sample().status.code, 'waiting-neutral');
  assert.ok(h.api.readingState(), 'The held entry Confirm cannot also exit.');
  pad.buttons[5].pressed = false;
  pad.axes[0] = 0.5;
  assert.equal(sample().status.code, 'waiting-neutral', 'Flight stick must also be released.');
  neutral();
  pad.axes[3] = -0.8;
  sample();
  assert.equal(surface.region.scrollTop, 48, 'Inverted right stick means logical Down.');
  sample('ready:first', 100);
  assert.equal(surface.region.scrollTop, 48);
  sample('ready:first', 250);
  assert.equal(surface.region.scrollTop, 96);
  sample('ready:first', 120);
  assert.equal(surface.region.scrollTop, 144);
  pad.buttons[2].pressed = true;
  sample();
  assert.equal(h.api.readingState(), null);
  assert.equal(h.document.activeElement, surface.origin);
  assert.equal(h.calls.back + h.calls.menu, 0);
  assert.equal(sample().status.code, 'waiting-neutral');
  assert.equal(h.document.activeElement, surface.origin);
  neutral();
  pad.buttons[5].pressed = true;
  sample();
  assert.ok(h.api.readingState());
  neutral();
  pad.buttons[9].pressed = true;
  sample();
  assert.equal(h.api.readingState(), null);
  assert.equal(h.calls.menu, 0, 'Menu exits the reader instead of resuming.');
});

test('held Retry Confirm cannot leave the loss reader or leak ability and Toggle Boost into flight', (t) => {
  for (const confirmButton of [0, 5]) {
    const config = resolveControllerBindings();
    config.menu.buttons.confirm = confirmButton;
    const pad = {
      index: 0,
      id: 'Retry boundary standard pad',
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
    };
    let reads = 0,
      samples = 0,
      scope = 'lost:retry',
      retryClicks = 0;
    const router = createControllerRouter({
      bindings: config,
      boostMode: 'toggle',
      eventTarget: null,
      readPads: () => {
        reads++;
        return [pad];
      },
    });
    t.after(() => router.destroy());
    const h = setup(t, { onReadingChange: () => router.clear() });
    h.setScope(scope);
    const surface = readingSurface(h);
    const retry = h.control('button', { textContent: 'Retry' });
    h.setDefault(retry);
    retry.addEventListener('click', () => {
      retryClicks++;
      // Exercise the host's existing input-clear/scope contract, not a game run.
      router.clear();
      h.api.clear();
      scope = 'flight';
      h.setScope(scope);
    });
    const sample = () => {
      const frame = router.sample({ scope, timeMs: ++samples * 16 });
      if (frame.status.code === 'joined') h.api.engage();
      h.api.handle(frame.ui);
      assert.equal(reads, samples, 'Navigation must not perform a second hardware read.');
      return frame;
    };
    const neutral = () => {
      pad.buttons.forEach((button) => {
        button.pressed = false;
      });
      return sample();
    };
    sample();
    pad.buttons[0].pressed = true;
    assert.equal(sample().status.code, 'joined');
    assert.equal(h.document.activeElement, retry);
    assert.equal(retryClicks, 0, 'Joining must not activate the default Retry action.');
    neutral();
    pad.buttons[12].pressed = true;
    sample();
    assert.equal(h.document.activeElement, surface.origin);
    neutral();
    pad.buttons[confirmButton].pressed = true;
    sample();
    assert.ok(h.api.readingState());
    assert.equal(sample().status.code, 'waiting-neutral');
    assert.ok(h.api.readingState(), 'Held entry Confirm must not also end reading.');
    neutral();
    pad.buttons[confirmButton].pressed = true;
    sample();
    assert.equal(h.api.readingState(), null);
    assert.equal(h.document.activeElement, surface.origin);
    assert.equal(sample().status.code, 'waiting-neutral');
    assert.equal(retryClicks, 0, 'The reader exit and its held continuation cannot retry.');
    assert.equal(h.calls.back + h.calls.menu, 0);
    neutral();
    pad.buttons[13].pressed = true;
    sample();
    assert.equal(h.document.activeElement, retry);
    neutral();
    pad.buttons[confirmButton].pressed = true;
    assert.deepEqual(sample().flight, neutralControllerFlight());
    assert.equal(retryClicks, 1);
    assert.equal(scope, 'flight');
    for (let held = 0; held < 4; held++) {
      const frame = sample();
      assert.equal(frame.status.code, 'waiting-neutral');
      assert.deepEqual(frame.flight, neutralControllerFlight());
      assert.equal(retryClicks, 1, 'The held Retry gesture activates its DOM handler once.');
      assert.deepEqual(router.boostState(), { mode: 'toggle', latched: false });
    }
    assert.deepEqual(neutral().flight, neutralControllerFlight());
    pad.buttons[confirmButton].pressed = true;
    const fresh = sample();
    assert.deepEqual(fresh.flight, {
      ...neutralControllerFlight(),
      [confirmButton === 0 ? 'action' : 'boost']: true,
    });
    assert.deepEqual(router.boostState(), { mode: 'toggle', latched: confirmButton === 5 });
    assert.equal(retryClicks, 1, 'A fresh flight gesture does not activate the old Retry button.');
  }
});

test('reopening changed content starts at the top while unchanged content keeps its reading position', (t) => {
  const h = setup(t),
    surface = readingSurface(h);
  surface.begin();
  h.api.handle({ direction: 'down' });
  h.api.endReading();
  surface.begin();
  assert.equal(surface.region.scrollTop, 48);
  surface.region.textContent = 'A different full mission brief.';
  h.api.sync();
  assert.equal(h.api.readingState(), null);
  surface.begin();
  assert.equal(surface.region.scrollTop, 0);
});

test('registered Done preserves the reader until native click and restores the origin after host disables Done', (t) => {
  let done;
  const changes = [];
  const h = setup(t, {
    onReadingChange(state) {
      changes.push(state);
      done.disabled = !state;
    },
  });
  const surface = readingSurface(h);
  done = h.control('button', { disabled: true, textContent: 'Done reading' });
  done.addEventListener('click', () => h.api.endReading({ restoreFocus: true }));
  assert.equal(h.api.beginReading({ ...surface, exit: done }), true);
  assert.equal(done.disabled, false);
  const down = done.emit('pointerdown', { button: 0, isPrimary: true });
  // A real browser ordinarily focuses the down target unless this default was prevented.
  if (!down.defaultPrevented) done.focus();
  assert.equal(down.defaultPrevented, true);
  assert.ok(h.api.readingState());
  assert.equal(h.document.activeElement, surface.region);
  assert.equal(changes.length, 1, 'Pointerdown does not itself activate Done.');
  h.api.handle({});
  done.emit('pointerup');
  done.click();
  assert.equal(h.api.readingState(), null);
  assert.equal(done.disabled, true);
  assert.equal(h.document.activeElement, surface.origin);
  assert.equal(changes.length, 2);
  assert.equal(h.calls.back + h.calls.menu, 0);
  done.emit('click');
  assert.equal(changes.length, 2, 'A queued duplicate click stays end-only.');
});

test('Done descendant taps keep click semantics; pointercancel and other pointer gestures still relinquish', (t) => {
  const h = setup(t),
    surface = readingSurface(h),
    done = h.control('button'),
    label = h.control('span', { textContent: 'Done reading' }, done),
    other = h.control('button');
  const request = { ...surface, exit: done };
  h.api.beginReading(request);
  assert.equal(label.emit('pointerdown', { button: 0 }).defaultPrevented, true);
  label.emit('pointercancel');
  assert.equal(h.api.readingState(), null);
  assert.equal(
    h.document.activeElement,
    surface.region,
    'Cancellation does not move native focus.',
  );
  for (const [target, event] of [
    [other, { button: 0 }],
    [done, { button: 2 }],
    [done, { button: 0, isPrimary: false }],
  ]) {
    h.api.beginReading(request);
    const down = target.emit('pointerdown', event);
    assert.equal(down.defaultPrevented, false);
    assert.equal(h.api.readingState(), null);
  }
});

test('exit registration rejects unrelated or hidden controls without replacing a current reader', (t) => {
  const h = setup(t),
    surface = readingSurface(h),
    outside = new Element(h.document, 'button');
  surface.begin();
  for (const exit of [
    surface.origin,
    surface.region,
    outside,
    h.control('button', { hidden: true }),
    h.control('a'),
    h.control('button', {}, surface.region),
  ]) {
    assert.equal(h.api.beginReading({ ...surface, exit }), false);
    assert.equal(h.api.readingState().regionId, surface.region.id);
  }
});

test('actual two-surface host preserves a native Done click through document capture and returns focus', (t) => {
  let host;
  let transitions = 0;
  const h = setup(t, {
    onReadingChange: (state) => host.changed(state),
    onHint: (message) => host.hint(message),
  });
  const surfaces = ['overlay', 'mission-brief'].map((prefix) => {
    const unit = h.control('div', {
      id: `${prefix === 'overlay' ? 'overlay-reading' : prefix}-unit`,
    });
    const entry = h.control('button', { id: `${prefix}-read`, textContent: 'Read details' }, unit);
    const done = h.control(
      'button',
      { id: `${prefix}-reading-done`, textContent: 'Done reading' },
      unit,
    );
    h.control('p', { id: `${prefix}-reading-hint` }, unit);
    const region = h.control(
      'div',
      {
        id: `${prefix}-reading`,
        tabIndex: 0,
        textContent: 'Full details through the last line.',
        clientHeight: 100,
        scrollHeight: 400,
      },
      unit,
    );
    region.setAttribute('data-game-reading', '');
    region.setAttribute('aria-label', 'Mission details');
    return { entry, done, region };
  });
  host = attachControllerReading({
    document: h.document,
    getNavigation: () => h.api,
    getControlLabels: () => ({ confirm: 'R1', back: 'Square' }),
    getScope: () => 'paused',
    onTransition: () => {
      transitions++;
    },
  });
  t.after(() => host.destroy());
  for (const { entry, done, region } of surfaces) {
    entry.focus();
    h.api.handle({ confirm: true });
    assert.equal(h.document.activeElement, region);
    assert.equal(done.disabled, false);
    const down = done.emit('pointerdown', { button: 0 });
    if (!down.defaultPrevented) done.focus();
    assert.ok(h.api.readingState(), 'Document capture must not disable the active Done target.');
    done.emit('pointerup');
    done.click();
    assert.equal(h.api.readingState(), null);
    assert.equal(h.document.activeElement, entry);
    assert.equal(done.disabled, true);
    assert.equal(h.calls.back + h.calls.menu, 0);
  }
  assert.equal(transitions, 4);
});
