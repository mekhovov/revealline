import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { Document } from './helpers/couch-dom.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { createCompanyWorkspaceFiles } from '../../scripts/company-studio.mjs';
import {
  DRAFT_FORMAT,
  REPORT_FORMAT,
  STUDIO_REPORT_CHECKS,
  declaredJSONPaths,
  validateStudioDraft,
  validateStudioHistory,
} from '../../authoring/company-studio/model.mjs';
import { mountAuthoringInputHost } from '../ui/authoring-input-host.mjs';
import { getLocale, setLocale, t as translate } from '../i18n/index.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { reviseStudioTheme } from '../presentation/studio-session.mjs';
import { createThemeCandidate, saveThemePreview } from '../presentation/theme-preview.mjs';
import {
  COMPANY_PLAYTEST_FIXTURES,
  companyPlaytestTask,
} from '../company-campaigns/playtest-fixtures.mjs';

const html = await readFile(
  new URL('../../authoring/company-studio/index.html', import.meta.url),
  'utf8',
);
const practiceHTML = await readFile(
  new URL('../../authoring/company-studio/playtest.html', import.meta.url),
  'utf8',
);
let serial = 0;
const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise((resolve) => setImmediate(resolve));
};
function sourcePacket(name = 'Acme') {
  const workspace = createCompanyWorkspaceFiles({
    brandId: 'acme',
    editionId: 'acme-public',
    name,
  });
  const catalog = JSON.parse(workspace.files.get('game/editions/catalog.json'));
  return {
    workspace,
    packet: {
      format: DRAFT_FORMAT,
      catalog,
      files: declaredJSONPaths(catalog).map((path) => ({
        path,
        data: JSON.parse(workspace.files.get(path)),
      })),
    },
  };
}

// Native form controls inherit disabled fieldsets except through their first
// direct legend. A refused browser focus must not look successful in this host.
function effectivelyDisabled(node) {
  if (!['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'FIELDSET'].includes(node.tagName)) return false;
  if (node.disabled) return true;
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    if (parent.tagName !== 'FIELDSET' || !parent.disabled) continue;
    const firstLegend = parent.children.find((child) => child.tagName === 'LEGEND');
    if (!firstLegend?.contains(node)) return true;
  }
  return false;
}

// Load the production entry and real markup. Only browser I/O, time and finite
// DOM geometry are supplied here; no Studio callbacks are extracted or replaced.
async function fixture(t, { controller = false, practice = false, candidate, query = '' } = {}) {
  const doc = new Document(),
    win = doc.defaultView;
  doc.parentNode = win;
  const { workspace, packet } = sourcePacket();
  const observers = new Set();
  const frames = new Map(),
    timers = new Map(),
    blobs = new Map(),
    downloads = [];
  let frameSerial = 0,
    timerSerial = 0,
    now = 1000;
  let fetchOverride = null;
  const previewStorage = new Map(),
    previewId = '10000000-0000-4000-8000-000000000001',
    sessionStorage = {
      getItem: (key) => previewStorage.get(key) ?? null,
      setItem: (key, value) => previewStorage.set(key, value),
      removeItem: (key) => previewStorage.delete(key),
    };
  if (candidate) {
    saveThemePreview(sessionStorage, candidate, { id: previewId });
    query = `?appearanceCandidate=${previewId}`;
  }
  const pad = {
    id: 'Company Studio host test pad',
    index: 0,
    mapping: 'standard',
    connected: true,
    timestamp: now,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  Object.assign(win, {
    location: new URL(
      `https://company.example/authoring/company-studio/${practice ? 'playtest.html' : ''}${query}`,
    ),
    sessionStorage,
    performance: { now: () => now },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
      }
      observe() {
        observers.add(this);
      }
      disconnect() {
        observers.delete(this);
      }
    },
    requestAnimationFrame(fn) {
      frames.set(++frameSerial, fn);
      return frameSerial;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
  });
  const create = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const node = create(tag);
    const matches = node.matches.bind(node),
      nativeFocus = node.focus.bind(node);
    node.matches = (selector) =>
      selector === ':disabled' ? effectivelyDisabled(node) : matches(selector);
    node.focus = (...args) => {
      if (!effectivelyDisabled(node)) nativeFocus(...args);
    };
    let value = '',
      disabled = false;
    Object.defineProperty(node, 'value', {
      get: () => value,
      set(next) {
        value = String(next ?? '');
      },
    });
    Object.defineProperty(node, 'disabled', {
      get: () => disabled,
      set(next) {
        disabled = !!next;
        if (disabled && doc.activeElement === node) doc.activeElement = doc.body;
      },
    });
    Object.defineProperty(node, 'childNodes', {
      get: () => [
        ...(node._text ? [{ nodeType: 3, textContent: node._text }] : []),
        ...node.children,
      ],
    });
    Object.defineProperty(node, 'labels', {
      get: () =>
        doc
          .querySelectorAll('label')
          .filter(
            (label) => label.contains(node) || (node.id && label.getAttribute('for') === node.id),
          ),
    });
    Object.defineProperty(node, 'selectedOptions', {
      get: () => node.options.filter((option) => option.selected || option.value === node.value),
    });
    node.before = (sibling) => node.parentNode.insertBefore(sibling, node);
    const click = node.click.bind(node);
    node.click = () => {
      if (effectivelyDisabled(node)) return;
      if (node.tagName === 'A' && node.download)
        downloads.push({ name: node.download, href: node.href });
      return click();
    };
    return node;
  };
  function append(parent, source) {
    if (source.nodeName === '#text') {
      parent._text = (parent._text || '') + source.value;
      return;
    }
    if (!source.tagName) return;
    const node = doc.createElement(source.tagName);
    for (const { name, value } of source.attrs || []) {
      node.setAttribute(name, value);
      if (name === 'class') node.className = value;
      if (['type', 'value', 'min', 'max', 'step', 'href'].includes(name)) node[name] = value;
      if (['hidden', 'disabled', 'inert', 'open', 'checked', 'selected'].includes(name))
        node[name] = true;
    }
    parent.append(node);
    for (const child of source.childNodes || []) append(node, child);
    if (node.tagName === 'TEXTAREA') node.value = node.textContent;
  }
  const body = parse(practice ? practiceHTML : html)
    .childNodes.find((node) => node.tagName === 'html')
    .childNodes.find((node) => node.tagName === 'body');
  for (const child of body.childNodes) append(doc.body, child);
  const restores = [];
  const install = (key, value) => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    restores.push(() =>
      previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key],
    );
  };
  install('document', doc);
  install('window', win);
  install('location', win.location);
  install('navigator', { getGamepads: () => (controller ? [pad] : []) });
  install('localStorage', {
    getItem: () => null,
    setItem: () => assert.fail('Company Studio must not write player storage.'),
  });
  const URLImpl = globalThis.URL;
  install(
    'URL',
    class extends URLImpl {
      static createObjectURL(blob) {
        const url = `blob:company-test/${blobs.size + 1}`;
        blobs.set(url, blob);
        return url;
      }
      static revokeObjectURL() {}
    },
  );
  install('setTimeout', (fn, ms) => {
    timers.set(++timerSerial, { fn, ms });
    return timerSerial;
  });
  install('clearTimeout', (id) => timers.delete(id));
  install('fetch', async (url, options = {}) => {
    const path = [...workspace.files.keys()].find((key) =>
      new URL(url).pathname.endsWith(`/${key}`),
    );
    const override = fetchOverride?.(path, options);
    if (override) return override;
    if (new URL(url).pathname.endsWith('/game/editions/runtime-assets.json'))
      return new Response('[]');
    assert.ok(path, `Unexpected source fetch ${url}`);
    return new Response(workspace.files.get(path));
  });
  let inputHost;
  t.after(() => {
    win.emit('pagehide', { persisted: false });
    inputHost?.destroy();
    restores.reverse().forEach((restore) => restore());
  });
  await import(
    `../../authoring/company-studio/${practice ? 'playtest' : 'studio'}.mjs?actual-host=${++serial}`
  );
  await settle();
  const $ = (id) => doc.getElementById(id);
  if (!practice && !query) assert.match($('status').textContent, /Registered source loaded/);
  if (controller) inputHost = mountAuthoringInputHost({ document: doc, window: win });
  function focus(id) {
    const node = $(id);
    for (let parent = node.parentElement; parent; parent = parent.parentElement)
      if (parent.tagName === 'DETAILS') {
        parent.open = true;
        parent.setAttribute('open', '');
      }
    node.focus();
  }
  async function click(id) {
    focus(id);
    $(id).click();
    await settle();
  }
  function edit(id, value) {
    $(id).value = value;
    $(id).emit('input');
  }
  const tick = () => {
    now += 50;
    pad.timestamp = now;
    const pending = [...frames];
    frames.clear();
    pending.forEach(([, fn]) => fn(now));
    for (const observer of [...observers]) observer.callback([]);
  };
  async function pulse(index) {
    tick();
    pad.buttons[index] = { pressed: true, value: 1 };
    tick();
    pad.buttons[index] = { pressed: false, value: 0 };
    tick();
    await settle();
  }
  async function importFile(id, text, { confirm = true } = {}) {
    focus(id);
    $(id).files = [{ size: 100, text: () => Promise.resolve(text) }];
    $(id).emit('change');
    await settle();
    if (confirm && $('company-operation-confirm') && !$('company-operation-confirm').hidden)
      await click('company-operation-confirm');
  }
  return {
    doc,
    win,
    $,
    focus,
    click,
    edit,
    tick,
    pulse,
    importFile,
    packet,
    workspace,
    inputHost,
    downloads,
    blobs,
    timers,
    previewStorage,
    setFetch: (fn) => {
      fetchOverride = fn;
    },
  };
}

test('Company appearance translates live without changing staged choices, focus or catalog JSON', async (context) => {
  const previousLocale = getLocale();
  context.after(() => setLocale(previousLocale, { persist: false }));
  setLocale('en', { persist: false });
  const h = await fixture(context),
    select = h.$('appearance-default-community'),
    caption = select.parentElement.querySelector('span'),
    original = h.$('catalog-json').value;
  select.value = 'vyshyvanka@r1';
  select.focus();
  assert.equal(select.getAttribute('aria-labelledby'), caption.id);
  for (const locale of ['uk', 'en', 'uk']) {
    setLocale(locale, { persist: false });
    assert.equal(h.$('appearance-default-community'), select);
    assert.equal(select.value, 'vyshyvanka@r1');
    assert.equal(h.doc.activeElement, select);
    assert.equal(h.$('catalog-json').value, original);
    assert.equal(
      caption.textContent,
      translate('tools:studio.appearance.community.label', { name: 'Acme' }),
    );
    assert.equal(
      h.$('community-appearance-heading').textContent,
      translate('tools:studio.appearance.title'),
    );
    assert.match(
      h.$('community-appearance-heading').textContent,
      locale === 'uk' ? /[А-ЯІЇЄҐа-яіїєґ]/ : /^Default appearance$/,
    );
    assert.equal(
      h.$('apply-appearance-community').textContent,
      translate('tools:studio.appearance.community.apply'),
    );
    assert.equal(
      select.options.find((option) => option.value === 'vyshyvanka@r1').textContent,
      translate('tools:studio.appearance.retained', {
        name: translate('interface:workshop.theme.vyshyvanka'),
        revision: 'r1',
      }),
    );
  }
  await h.click('apply-appearance-community');
  assert.equal(h.doc.activeElement.id, 'apply-appearance-community');
  const applied = h.$('catalog-json').value;
  assert.deepEqual(JSON.parse(applied).brands[0].appearanceDefault, {
    familyId: 'vyshyvanka',
    revision: 'r1',
  });
  setLocale('en', { persist: false });
  assert.equal(h.$('catalog-json').value, applied);
  assert.equal(h.$('status').textContent, translate('tools:studio.appearance.community.applied'));
});

test('Company appearance validation remains translated while unapplied JSON stays untouched', async (context) => {
  const previousLocale = getLocale();
  context.after(() => setLocale(previousLocale, { persist: false }));
  setLocale('en', { persist: false });
  const h = await fixture(context);
  h.edit('catalog-json', '{keep my pending catalog');
  h.$('appearance-default-community').value = 'dnipro-porcelain@r1';
  await h.click('apply-appearance-community');
  for (const locale of ['uk', 'en']) {
    setLocale(locale, { persist: false });
    assert.equal(h.$('status').dataset.error, 'true');
    assert.equal(h.$('status').textContent, translate('tools:studio.appearance.pendingCatalog'));
    assert.equal(h.$('catalog-json').value, '{keep my pending catalog');
    assert.equal(h.doc.activeElement.id, 'apply-appearance-community');
  }
});

test('controller Confirm applies the selected Company appearance and retains the semantic action focus', async (context) => {
  const h = await fixture(context, { controller: true });
  h.doc.querySelector('[data-step="2"]').focus();
  await h.pulse(0);
  h.$('appearance-default-campaign').value = 'dnipro-porcelain@r1';
  h.focus('apply-appearance-campaign');
  await h.pulse(0);
  assert.equal(h.doc.activeElement.id, 'apply-appearance-campaign');
  const catalog = JSON.parse(h.$('catalog-json').value);
  assert.deepEqual(catalog.campaigns[0].appearanceDefault, {
    familyId: 'dnipro-porcelain',
    revision: 'r1',
  });
  h.tick();
  assert.equal(h.doc.activeElement.id, 'apply-appearance-campaign');
});

test('Studio candidate handoff is reviewed before registration and exports only after explicit Apply', async (context) => {
  const candidate = createThemeCandidate(
      reviseStudioTheme(createDefaultThemeBundle(), { tokens: { panel: '#263133' } }),
      { familyId: 'industrial-workshop' },
    ),
    h = await fixture(context, { candidate }),
    original = h.$('catalog-json').value,
    selectedPin = `${candidate.family.id}@${candidate.family.revision}`;
  assert.equal(h.previewStorage.size, 0, 'The one-use transfer is consumed.');
  assert.deepEqual(JSON.parse(original), h.packet.catalog);
  assert.equal(h.$('appearance-default-community').value, selectedPin);
  assert.equal(h.$('appearance-default-campaign').value, selectedPin);
  assert.match(h.$('community-appearance-candidate').textContent, /installed Arcade/);
  await h.click('export-draft');
  const before = validateStudioDraft(await h.blobs.get(h.downloads[0].href).text());
  assert.deepEqual(before.catalog, h.packet.catalog, 'Review does not register or assign.');
  await h.click('apply-appearance-community');
  assert.equal(h.doc.activeElement.id, 'apply-appearance-community');
  assert.match(h.$('community-appearance-candidate').textContent, /^Included Studio theme:/);
  await h.click('export-draft');
  const after = validateStudioDraft(await h.blobs.get(h.downloads[1].href).text());
  assert.deepEqual(after.catalog.brands[0].appearanceDefault, {
    familyId: candidate.family.id,
    revision: candidate.family.revision,
  });
  assert.deepEqual(after.catalog.appearanceThemes, [candidate]);
  assert.equal(after.files.size, before.files.size);
  assert.equal(
    h.$('appearance-default-campaign').options.filter((option) => option.value === selectedPin)
      .length,
    1,
  );
});

test('unavailable one-use Studio candidate leaves the source draft usable and reports a localized recovery', async (context) => {
  const previousLocale = getLocale();
  context.after(() => setLocale(previousLocale, { persist: false }));
  const h = await fixture(context, {
    query: '?appearanceCandidate=10000000-0000-4000-8000-000000000001',
  });
  for (const locale of ['uk', 'en']) {
    setLocale(locale, { persist: false });
    assert.equal(
      h.$('status').textContent,
      translate('tools:studio.appearance.handoffUnavailable'),
    );
    assert.equal(h.$('status').dataset.error, 'true');
    assert.deepEqual(JSON.parse(h.$('catalog-json').value), h.packet.catalog);
  }
  await h.click('export-draft');
  assert.equal(h.downloads.length, 1);
});

test('actual Company Studio exports a valid complete source packet and explicitly reopens it', async (t) => {
  const h = await fixture(t);
  await h.click('export-draft');
  assert.equal(h.downloads.length, 1);
  assert.equal(h.downloads[0].name, 'acme-public-draft.json');
  const bytes = await h.blobs.get(h.downloads[0].href).text();
  const checked = validateStudioDraft(bytes);
  await validateStudioHistory(checked.catalog, checked.files);
  assert.equal(checked.files.size, 7);
  await h.importFile('import-draft', bytes);
  assert.equal(h.$('brand-name').value, 'Acme');
  assert.equal(
    h.$('status').textContent,
    'Validated source replaced the current tab draft. Nothing was saved persistently.',
  );
});

test('actual Company Studio rejects unapplied or invalid JSON without changing its applied draft', async (t) => {
  const h = await fixture(t);
  h.edit('catalog-json', '{broken');
  await h.click('apply-catalog');
  assert.equal(h.$('status').dataset.error, 'true');
  assert.equal(h.$('brand-name').value, 'Acme');
  await h.click('export-draft');
  assert.equal(h.downloads.length, 0);
  assert.match(h.$('status').textContent, /Apply your JSON/);
  assert.equal(h.$('catalog-json').value, '{broken');
});

test('a delayed source export cannot claim or replace a newer unapplied edit', async (t) => {
  const h = await fixture(t);
  const pending = deferred();
  const path = h.packet.catalog.editions[0].boot.classes;
  h.setFetch((source) => (source === path ? pending.promise : null));
  await h.click('export-draft');
  h.edit('catalog-json', '{newer draft');
  pending.resolve(new Response(h.workspace.files.get(path)));
  await settle();
  assert.equal(h.downloads.length, 0);
  assert.equal(h.$('catalog-json').value, '{newer draft');
  assert.equal(h.$('draft-state').textContent, 'Unapplied JSON edits');
});

test('a delayed source import cannot erase JSON entered after the read started', async (t) => {
  const h = await fixture(t);
  const pending = deferred();
  h.focus('import-draft');
  h.$('import-draft').files = [{ size: 100, text: () => pending.promise }];
  h.$('import-draft').emit('change');
  h.edit('catalog-json', '{newer draft');
  pending.resolve(JSON.stringify(sourcePacket('Old read').packet));
  await settle();
  assert.equal(h.$('brand-name').value, 'Acme');
  assert.equal(h.$('catalog-json').value, '{newer draft');
});

test('the newest source import wins when two file reads complete out of order', async (t) => {
  const h = await fixture(t);
  const pending = deferred();
  h.focus('import-draft');
  h.$('import-draft').files = [{ size: 100, text: () => pending.promise }];
  h.$('import-draft').emit('change');
  await h.importFile('import-draft', JSON.stringify(sourcePacket('New selection').packet));
  pending.resolve(JSON.stringify(sourcePacket('Old selection').packet));
  await settle();
  assert.equal(h.$('brand-name').value, 'New selection');
});

test('an older pending read cannot clear the newer replacement consent handler', async (t) => {
  const h = await fixture(t);
  const pending = deferred();
  h.focus('import-draft');
  h.$('import-draft').files = [{ size: 100, text: () => pending.promise }];
  h.$('import-draft').emit('change');
  await h.importFile('import-draft', JSON.stringify(sourcePacket('New consent').packet), {
    confirm: false,
  });
  assert.equal(h.$('company-operation').open, true);
  assert.equal(h.doc.activeElement.id, 'company-operation-cancel');
  const status = h.$('status').textContent;
  pending.resolve(JSON.stringify(sourcePacket('Stale consent').packet));
  await settle();
  assert.equal(h.doc.activeElement.id, 'company-operation-cancel');
  assert.equal(h.$('status').textContent, status);
  await h.click('company-operation-confirm');
  assert.equal(h.$('brand-name').value, 'New consent');
  assert.equal(h.$('company-operation').open, false);
  h.$('company-operation-confirm').click();
  assert.equal(h.$('brand-name').value, 'New consent');
});

test('a rejected old import cannot replace status after a newer raw form edit', async (t) => {
  const h = await fixture(t);
  const pending = deferred();
  h.focus('import-draft');
  h.$('import-draft').files = [{ size: 100, text: () => pending.promise }];
  h.$('import-draft').emit('change');
  await settle();
  h.edit('brand-name', 'Keep newer raw form');
  const status = h.$('status').textContent;
  const error = h.$('status').dataset.error;
  pending.reject(new Error('Late old read failure'));
  await settle();
  assert.equal(h.$('brand-name').value, 'Keep newer raw form');
  assert.equal(h.$('status').textContent, status);
  assert.equal(h.$('status').dataset.error, error);
  assert.equal(h.$('company-operation').open, false);
});

test('controller step selection owns a reachable control after neutral polling', async (t) => {
  const h = await fixture(t, { controller: true });
  const artworkStep = h.doc.querySelector('[data-step="1"]');
  artworkStep.focus();
  await h.pulse(0);
  h.tick();
  assert.equal(h.$('logo-asset').closest('[data-panel]').hidden, false);
  assert.equal(h.doc.activeElement.id, 'logo-asset');
});

test('every Company setup step selects a reachable local control under the real controller owner', async (t) => {
  const h = await fixture(t, { controller: true });
  for (const [index, id] of [
    'brand-name',
    'logo-asset',
    'theme-json',
    'campaign-select',
    'learning-campaign-select',
    'import-report',
    'export-draft-bottom',
  ].entries()) {
    h.doc.querySelector(`[data-step="${index}"]`).focus();
    await h.pulse(0);
    h.tick();
    assert.equal(h.doc.activeElement.id, id, `Step ${index + 1}`);
  }
});

for (const interruption of ['blur', 'hidden', 'pagehide', 'new focus', 'raw identity edit']) {
  test(`pending Company import cannot commit after ${interruption}`, async (t) => {
    const h = await fixture(t);
    const pending = deferred();
    h.focus('import-draft');
    h.$('import-draft').files = [{ size: 100, text: () => pending.promise }];
    h.$('import-draft').emit('change');
    await settle();
    if (interruption === 'blur') {
      h.doc.focused = false;
      h.win.emit('blur');
    } else if (interruption === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    } else if (interruption === 'pagehide') h.win.emit('pagehide', { persisted: true });
    else if (interruption === 'new focus') h.focus('brand-name');
    else h.edit('brand-name', 'New unapplied identity');
    pending.resolve(JSON.stringify(sourcePacket('Stale imported identity').packet));
    await settle();
    assert.equal(
      h.$('brand-name').value,
      interruption === 'raw identity edit' ? 'New unapplied identity' : 'Acme',
    );
    assert.equal(h.$('company-operation')?.open, false);
    if (interruption === 'new focus') assert.equal(h.doc.activeElement.id, 'brand-name');
  });
}

for (const method of ['native cancel', 'controller Back', 'controller Confirm']) {
  test(`${method} cancels pending Company export and restores its owned opener`, async (t) => {
    const h = await fixture(t, { controller: method !== 'native cancel' });
    const pending = deferred();
    const path = h.packet.catalog.editions[0].boot.classes;
    h.setFetch((source) => (source === path ? pending.promise : null));
    await h.click('export-draft');
    assert.equal(h.$('company-operation').open, true);
    assert.equal(h.doc.activeElement.id, 'company-operation-cancel');
    if (method === 'native cancel') h.$('company-operation').emit('cancel');
    else await h.pulse(method === 'controller Back' ? 1 : 0);
    await settle();
    assert.equal(h.$('company-operation').open, false);
    assert.equal(h.doc.activeElement.id, 'export-draft');
    pending.resolve(new Response(h.workspace.files.get(path)));
    await settle();
    assert.equal(h.downloads.length, 0);
    assert.equal(h.doc.activeElement.id, 'export-draft');
    h.setFetch(null);
    await h.click('export-draft');
    assert.equal(h.downloads.length, 1, 'Cancelled collection remains retryable.');
  });
}

test('reopening an exported Company packet is explicit, cancelable and byte-preserving', async (t) => {
  const h = await fixture(t, { controller: true });
  await h.click('export-draft');
  const original = await h.blobs.get(h.downloads[0].href).text();
  h.edit('catalog-json', '{keep my unsaved changes');
  await h.click('reopen-export');
  assert.equal(h.$('company-operation').open, true);
  assert.equal(h.doc.activeElement.id, 'company-operation-cancel');
  await h.pulse(1);
  assert.equal(h.$('catalog-json').value, '{keep my unsaved changes');
  assert.equal(h.doc.activeElement.id, 'reopen-export');
  await h.click('reopen-export');
  h.focus('company-operation-confirm');
  await h.pulse(0);
  assert.deepEqual(JSON.parse(h.$('catalog-json').value), h.packet.catalog);
  assert.equal(h.$('company-operation').open, false);
  await h.click('export-draft');
  assert.equal(await h.blobs.get(h.downloads[1].href).text(), original);
});

test('prepared import consent expires when an underlying form changes', async (t) => {
  const h = await fixture(t);
  await h.importFile('import-draft', JSON.stringify(sourcePacket('Replacement').packet), {
    confirm: false,
  });
  assert.equal(h.$('company-operation').open, true);
  h.edit('brand-name', 'Typed after validation');
  h.$('company-operation-confirm').click();
  await settle();
  assert.equal(h.$('brand-name').value, 'Typed after validation');
  assert.equal(h.$('company-operation').open, false);
});

test('failed Company collection settles its busy owner and permits a fresh valid export', async (t) => {
  const h = await fixture(t);
  const path = h.packet.catalog.editions[0].boot.classes;
  h.setFetch((source) =>
    source === path ? Promise.reject(new Error('Controlled source read failed')) : null,
  );
  await h.click('export-draft');
  assert.equal(h.downloads.length, 0);
  assert.equal(h.$('company-operation').open, false);
  assert.equal(h.doc.activeElement.id, 'export-draft');
  assert.match(h.$('status').textContent, /Controlled source read failed/);
  h.setFetch(null);
  await h.click('export-draft');
  assert.equal(h.downloads.length, 1);
});

test('invalid imported source retains the complete current applied and unapplied draft', async (t) => {
  const h = await fixture(t);
  h.edit('catalog-json', '{my unapplied source');
  h.edit('brand-name', 'My unapplied identity');
  const invalid = sourcePacket('Invalid replacement').packet;
  invalid.files.pop();
  await h.importFile('import-draft', JSON.stringify(invalid));
  assert.equal(h.$('catalog-json').value, '{my unapplied source');
  assert.equal(h.$('brand-name').value, 'My unapplied identity');
  assert.equal(h.$('status').dataset.error, 'true');
  assert.equal(h.$('company-operation').open, false);
  assert.equal(h.doc.activeElement.id, 'import-draft');
});

test('oversized source imports are rejected before reading any file bytes', async (t) => {
  const h = await fixture(t);
  h.focus('import-draft');
  h.$('import-draft').files = [
    { size: 16 * 1024 * 1024 + 1, text: () => assert.fail('Oversized source must not be read.') },
  ];
  h.$('import-draft').emit('change');
  await settle();
  assert.equal(h.$('brand-name').value, 'Acme');
  assert.equal(h.$('status').dataset.error, 'true');
  assert.match(h.$('status').textContent, /16 MB/);
  assert.equal(h.doc.activeElement.id, 'import-draft');
});

test('a catalog-only import cannot partially replace the draft when a declared source fails', async (t) => {
  const h = await fixture(t);
  const other = createCompanyWorkspaceFiles({
    brandId: 'missing',
    editionId: 'missing-public',
    name: 'Unavailable source',
  });
  h.edit('catalog-json', '{keep existing source');
  await h.importFile('import-draft', other.files.get('game/editions/catalog.json'));
  assert.equal(h.$('brand-name').value, 'Acme');
  assert.equal(h.$('catalog-json').value, '{keep existing source');
  assert.equal(h.$('status').dataset.error, 'true');
  assert.equal(h.$('company-operation').open, false);
});

test('delayed compiler report import cannot revive a report for an edited draft', async (t) => {
  const h = await fixture(t);
  const pending = deferred();
  h.doc.querySelector('[data-step="5"]').click();
  h.focus('import-report');
  h.$('import-report').files = [{ size: 100, text: () => pending.promise }];
  h.$('import-report').emit('change');
  h.edit('catalog-json', '{newer source');
  pending.resolve(
    JSON.stringify({
      format: REPORT_FORMAT,
      editionId: 'acme-public',
      brandId: 'acme',
      name: 'Acme',
      summary: {
        campaigns: 1,
        missions: 1,
        lessons: 0,
        assets: 0,
        runtimeFiles: 20,
        runtimeBytes: 1000,
      },
      admittedPaths: ['game/company.html'],
      excluded: { editionIds: [], brandIds: [], campaignIds: [], assetIds: [] },
      checks: STUDIO_REPORT_CHECKS,
      artifact: { path: 'edition-build.json', bytes: 123, sha256: '1'.repeat(64) },
      previewURL: '/dist/company-previews/acme/game/company.html',
    }),
  );
  await settle();
  assert.equal(h.$('open-preview').disabled, true);
  assert.equal(h.$('report-checks').hidden, true);
  assert.equal(h.$('catalog-json').value, '{newer source');
});

test('Company compiler commands support explicit controller reading and exact Back return', async (t) => {
  const h = await fixture(t, { controller: true });
  h.doc.querySelector('[data-step="6"]').click();
  const region = h.$('compile-commands');
  region.clientHeight = 100;
  region.scrollHeight = 700;
  h.focus('company-read-commands');
  await h.pulse(0);
  assert.equal(region.getAttribute('data-controller-reading'), 'true');
  await h.pulse(13);
  assert.ok(region.scrollTop > 0);
  await h.pulse(1);
  assert.notEqual(region.getAttribute('data-controller-reading'), 'true');
  assert.equal(h.doc.activeElement.id, 'company-read-commands');
  assert.equal(h.downloads.length, 0);
});

test('leaving an active Company reading region does not steal newer focus', async (t) => {
  const h = await fixture(t, { controller: true });
  h.doc.querySelector('[data-step="6"]').click();
  h.focus('company-read-commands');
  await h.pulse(0);
  h.focus('export-draft-bottom');
  h.tick();
  assert.notEqual(h.$('compile-commands').getAttribute('data-controller-reading'), 'true');
  assert.equal(h.doc.activeElement.id, 'export-draft-bottom');
});

async function openPractice(h, id = 'playtest-foundations-requirement') {
  h.$('practice-select').value = id;
  h.$('practice-select').emit('change');
  await h.click('open-practice');
  return COMPANY_PLAYTEST_FIXTURES.find((row) => row.id === id);
}
async function activatePractice(h, control) {
  const node = h.$('practice-workbench').querySelector(`[data-control="${control}"]`);
  assert.ok(node, control);
  node.focus();
  await h.pulse(0);
}

test('actual transfer practice enters a readable brief and returns exactly after controller Back', async (t) => {
  const h = await fixture(t, { controller: true, practice: true });
  await openPractice(h);
  h.tick();
  assert.equal(h.doc.activeElement.id, 'company-read-practice');
  const region = h.$('company-read-practice-region');
  region.clientHeight = 100;
  region.scrollHeight = 500;
  await h.pulse(0);
  await h.pulse(13);
  assert.ok(region.scrollTop > 0);
  await h.pulse(1);
  assert.equal(h.doc.activeElement.id, 'company-read-practice');
  await activatePractice(h, 'close');
  assert.equal(h.$('practice-workbench').hidden, true);
  assert.equal(h.doc.activeElement.id, 'practice-select');
  assert.equal(h.$('restart-practice').disabled, true);
});

test('incomplete practice commit leads to readable feedback and leaves a retryable handoff', async (t) => {
  const h = await fixture(t, { controller: true, practice: true });
  await openPractice(h);
  await activatePractice(h, 'commit');
  assert.equal(h.doc.activeElement.id, 'company-read-feedback');
  assert.equal(h.$('practice-workbench').querySelector('[data-control="commit"]').disabled, false);
  assert.match(h.$('status').textContent, /needs another look/);
  await h.pulse(0);
  assert.equal(h.$('company-read-feedback-region').getAttribute('data-controller-reading'), 'true');
  await h.pulse(1);
  assert.equal(h.doc.activeElement.id, 'company-read-feedback');
});

test('completed transfer practice remains readable, exports task cards only and clears answers on restart', async (t) => {
  const h = await fixture(t, { controller: true, practice: true });
  const task = await openPractice(h);
  for (const record of task.lesson.records) await activatePractice(h, `inspect-${record.id}`);
  for (const field of task.lesson.fields) {
    const select = h.$('practice-workbench').querySelector(`[data-control="field-${field.id}"]`);
    select.value = field.expected;
    select.emit('change');
  }
  await activatePractice(h, 'commit');
  assert.equal(h.doc.activeElement.id, 'company-read-feedback');
  assert.equal(h.$('practice-workbench').querySelector('[data-control="commit"]').disabled, true);
  assert.match(h.$('status').textContent, /Local practice complete/);
  await h.click('export-task');
  assert.equal(h.downloads.length, 1);
  assert.equal(h.downloads[0].name, `${task.id}-task.json`);
  assert.deepEqual(
    JSON.parse(await h.blobs.get(h.downloads[0].href).text()),
    companyPlaytestTask(task.id),
  );
  await h.click('restart-practice');
  assert.equal(h.doc.activeElement.id, 'company-read-practice');
  assert.equal(h.$('practice-workbench').querySelector('[data-control="commit"]').disabled, false);
  for (const field of task.lesson.fields)
    assert.equal(
      h.$('practice-workbench').querySelector(`[data-control="field-${field.id}"]`).value,
      '',
    );
});

test('leaving transfer practice removes its readers and clears in-memory answers', async (t) => {
  const h = await fixture(t, { controller: true, practice: true });
  await openPractice(h);
  await h.pulse(0);
  const oldReader = h.$('company-read-practice');
  h.win.emit('pagehide', { persisted: true });
  assert.equal(h.$('practice-workbench').hidden, true);
  assert.equal(oldReader.isConnected, false);
  h.win.emit('pageshow', { persisted: true });
  await h.click('open-practice');
  assert.equal(h.doc.activeElement.id, 'company-read-practice');
  await h.pulse(0);
  assert.equal(h.$('company-read-practice-region').getAttribute('data-controller-reading'), 'true');
  await h.pulse(1);
  assert.equal(h.doc.activeElement.id, 'company-read-practice');
});

test('completed practice controller navigation skips inherited disabled fields and reaches Restart', async (t) => {
  const h = await fixture(t, { controller: true, practice: true });
  const task = await openPractice(h);
  for (const record of task.lesson.records) await activatePractice(h, `inspect-${record.id}`);
  for (const field of task.lesson.fields) {
    const select = h.$('practice-workbench').querySelector(`[data-control="field-${field.id}"]`);
    select.value = field.expected;
    select.emit('change');
  }
  await activatePractice(h, 'commit');
  assert.equal(h.doc.activeElement.id, 'company-read-feedback');
  for (const select of h.$('practice-workbench').querySelectorAll('select')) {
    assert.equal(select.disabled, false);
    assert.equal(select.matches(':disabled'), true);
    select.focus();
    assert.equal(
      h.doc.activeElement.id,
      'company-read-feedback',
      'The browser refuses inherited-disabled focus.',
    );
  }
  for (let i = 0; i < 30 && h.doc.activeElement.id !== 'restart-practice'; i++) {
    await h.pulse(12);
    h.tick();
    assert.equal(h.doc.activeElement.matches(':disabled'), false);
  }
  assert.equal(h.doc.activeElement.id, 'restart-practice');
  await h.pulse(0);
  assert.equal(h.doc.activeElement.id, 'company-read-practice');
  assert.equal(h.$('practice-workbench').querySelector('fieldset').disabled, false);
});

test('actual Company cached-page return retains the same unstaged guided lesson fields', async (t) => {
  const h = await fixture(t);
  h.doc.querySelector('[data-step="4"]').click();
  await h.click('create-learning');
  const root = h.doc.querySelector('[data-lesson-editor]'),
    field = h.doc.querySelector('[data-lesson-field="brief"]');
  assert.ok(field);
  field.value = 'Keep this guided draft without staging or exporting it.';
  field.focus();
  const source = h.$('learning-json').value;
  for (let visit = 0; visit < 2; visit++) {
    h.win.emit('pagehide', { persisted: true });
    h.win.emit('pageshow', { persisted: true });
    await settle();
    assert.equal(h.doc.querySelector('[data-lesson-editor]'), root);
    assert.equal(h.doc.querySelector('[data-lesson-field="brief"]'), field);
    assert.equal(field.value, 'Keep this guided draft without staging or exporting it.');
    assert.equal(h.$('learning-json').value, source);
    assert.equal(h.downloads.length, 0);
  }
  h.win.emit('pagehide', { persisted: false });
  assert.equal(h.doc.querySelector('[data-lesson-editor]'), null);
});

for (const persisted of [true, false])
  for (const outcome of ['success', 'failure'])
    test(`Company ${persisted ? 'cached' : 'terminal'} departure fences late preview ${outcome}`, async (t) => {
      const h = await fixture(t);
      h.doc.querySelector('[data-step="5"]').click();
      await h.importFile(
        'import-report',
        JSON.stringify({
          format: REPORT_FORMAT,
          editionId: 'acme-public',
          brandId: 'acme',
          name: 'Acme',
          summary: {
            campaigns: 1,
            missions: 1,
            lessons: 0,
            assets: 0,
            runtimeFiles: 20,
            runtimeBytes: 1000,
          },
          admittedPaths: ['game/company.html'],
          excluded: { editionIds: [], brandIds: [], campaignIds: [], assetIds: [] },
          checks: STUDIO_REPORT_CHECKS,
          artifact: { path: 'edition-build.json', bytes: 123, sha256: '1'.repeat(64) },
          previewURL: '/dist/company-previews/acme/game/company.html',
        }),
      );
      const pending = deferred(),
        path = h.packet.catalog.editions[0].boot.classes;
      let signal;
      h.setFetch((source, options) => {
        if (source !== path) return null;
        signal = options.signal;
        return pending.promise;
      });
      await h.click('open-preview');
      assert.ok(signal, 'The real preview reached a held source read.');
      assert.equal(signal.aborted, false);
      h.win.emit('pagehide', { persisted });
      assert.equal(signal.aborted, true);
      if (persisted) h.win.emit('pageshow', { persisted: true });
      h.edit('brand-name', 'Current unsaved identity');
      const status = h.$('status').textContent,
        note = h.$('preview-note').textContent,
        source = h.$('catalog-json').value;
      if (outcome === 'success') pending.resolve(new Response(h.workspace.files.get(path)));
      else pending.reject(new Error('Late failed preview after departure'));
      await settle();
      assert.equal(h.$('status').textContent, status);
      assert.equal(h.$('preview-note').textContent, note);
      assert.equal(h.$('preview-frame').getAttribute('src'), null);
      assert.equal(h.$('brand-name').value, 'Current unsaved identity');
      assert.equal(h.$('catalog-json').value, source);
      assert.equal(h.downloads.length, 0);
    });
