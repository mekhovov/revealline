// Minimal DOM boundary for the actual couch entry, input and navigation tests.
// Geometry is deterministic test data, not a browser layout claim.
import assert from 'node:assert/strict';

export class Events {
  listeners = new Map();
  captureListeners = new Map();
  addEventListener(type, fn, options) {
    const map = options === true || options?.capture ? this.captureListeners : this.listeners;
    if (!map.has(type)) map.set(type, new Set());
    map.get(type).add(fn);
  }
  removeEventListener(type, fn, options) {
    const map = options === true || options?.capture ? this.captureListeners : this.listeners;
    map.get(type)?.delete(fn);
  }
  dispatchEvent(event) {
    if (!event.target) Object.defineProperty(event, 'target', { configurable: true, value: this });
    const ancestors = [];
    for (let node = this.parentNode; node; node = node.parentNode) ancestors.push(node);
    for (const node of [...ancestors].reverse()) {
      for (const fn of [...(node.captureListeners.get(event.type) || [])]) fn(event);
      if (event.cancelBubble) return !event.defaultPrevented;
    }
    for (const fn of [...(this.captureListeners.get(event.type) || [])]) fn(event);
    const bubble = (node) => {
      for (const fn of [...(node.listeners.get(event.type) || [])]) fn(event);
      node[`on${event.type}`]?.(event);
    };
    bubble(this);
    if (event.bubbles)
      for (const node of ancestors) {
        if (event.cancelBubble) break;
        bubble(node);
      }
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
        this.cancelBubble = true;
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
export class Element extends Events {
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
    this.captures = new Set();
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
      if (this.tagName === 'SELECT') {
        this.options = this.children;
        if (!this.value) this.value = node.value;
      }
    }
  }
  replaceChildren(...nodes) {
    for (const child of [...this.children]) child.remove();
    this.value = '';
    this.append(...nodes);
  }
  setPointerCapture(id) {
    this.captures.add(id);
  }
  hasPointerCapture(id) {
    return this.captures.has(id);
  }
  releasePointerCapture(id) {
    this.captures.delete(id);
    this.emit('lostpointercapture', { pointerId: id });
  }
  getContext() {
    return { id: this.id };
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
      if (part === '.race-pad button')
        return this.tagName === 'BUTTON' && !!this.parentElement?.closest('.race-pad');
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
export class Document extends Events {
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
    this.hidden = false;
    this.focused = true;
    this.defaultView = {
      Event,
      getComputedStyle: (element) => ({
        display: element.style.display || 'block',
        visibility: element.style.visibility || 'visible',
      }),
    };
  }
  hasFocus() {
    return this.focused;
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
