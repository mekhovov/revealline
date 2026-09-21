import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { createStudioStore, STUDIO_DATABASE } from '../presentation/studio-store.mjs';
import { TEAM_ACTOR_SLOTS } from '../presentation/team-actor-slots.mjs';
import { TEAM_ANCHOR_SLOTS } from '../presentation/team-anchor-slots.mjs';
import { TEAM_EFFECT_SLOTS } from '../presentation/team-effect-slots.mjs';
import { TEAM_THREAT_SLOTS } from '../presentation/team-threat-slots.mjs';
import { TEAM_EVENT_SLOTS } from '../presentation/team-event-slots.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import { reviseStudioTheme } from '../presentation/studio-session.mjs';
import { verifyThemeAssets } from '../presentation/bundle.mjs';

// A deliberately incomplete local workspace, not a claim that the live release
// lacks Team artwork. Keep exact published body records, parents and originals.
async function incompleteTeamWorkspace() {
  const published = JSON.parse(
      await readFile(new URL('../presentation/compiled/studio.json', import.meta.url), 'utf8'),
    ),
    unchanged = JSON.stringify(published),
    base = createDefaultThemeBundle(),
    view = resolvePresentation(published),
    records = new Map(published.assets.map((asset) => [`${asset.id}@${asset.revision}`, asset])),
    existing = new Map(base.assets.map((asset) => [`${asset.id}@${asset.revision}`, asset])),
    added = new Map(),
    bindings = {};
  const retain = (asset) => {
    assert.ok(asset, 'Every published provenance parent exists');
    const key = `${asset.id}@${asset.revision}`;
    if (existing.has(key)) {
      assert.deepEqual(existing.get(key), asset);
      return;
    }
    if (added.has(key)) return;
    // Studio append validation retains every intermediate immutable revision.
    for (const earlier of published.assets
      .filter((item) => item.id === asset.id && item.revision < asset.revision)
      .sort((a, b) => a.revision - b.revision))
      retain(earlier);
    if (asset.provenance.parent)
      retain(records.get(`${asset.provenance.parent.id}@${asset.provenance.parent.revision}`));
    added.set(key, asset);
  };
  for (const source of new Set(TEAM_ACTOR_SLOTS.map((row) => row.source))) {
    const asset = view.assets[source];
    assert.equal(asset.kind, 'image', `${source} needs real original raster bytes`);
    retain(asset);
    bindings[source] = { id: asset.id, revision: asset.revision };
  }
  let document = base;
  for (const asset of added.values()) document = reviseStudioTheme(document, { assets: [asset] });
  document = reviseStudioTheme(document, { bindings });
  const assets = new Map();
  for (const asset of document.assets)
    if (asset.file && !assets.has(asset.file.sha256)) {
      assert.equal(asset.file.mime, 'image/png');
      const bytes = await readFile(
        new URL(`../presentation/compiled/assets/${asset.file.sha256}.png`, import.meta.url),
      );
      assets.set(asset.file.sha256, new Blob([bytes], { type: asset.file.mime }));
    }
  const verified = await verifyThemeAssets(document, assets, { decodeImage: null }),
    resolved = resolvePresentation(document);
  for (const row of [
    ...TEAM_ACTOR_SLOTS,
    ...TEAM_ANCHOR_SLOTS,
    ...TEAM_EFFECT_SLOTS,
    ...TEAM_THREAT_SLOTS,
    ...TEAM_EVENT_SLOTS,
  ]) {
    assert.equal(resolved.assets[row.id], undefined, `Fixture deliberately omits ${row.id}`);
    assert.equal(
      document.slots.some((slot) => slot.id === row.id),
      false,
    );
  }
  assert.equal(
    JSON.stringify(published),
    unchanged,
    'Constructing the local fixture leaves published records untouched',
  );
  return { document, assets: verified };
}
function mount(doc, html) {
  const stack = [doc.body];
  for (const [token] of html
    .split(/<body\b[^>]*>/)[1]
    .split('</body>')[0]
    .matchAll(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g)) {
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!token.startsWith('<')) continue;
    const tag = token.match(/^<([\w-]+)/)[1];
    const element = doc.createElement(tag);
    for (const [, name, quoted, bare] of token
      .slice(tag.length + 1, -1)
      .matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|([^\s]+)))?/g)) {
      const value = quoted ?? bare ?? '';
      element.setAttribute(name, value);
      if (name === 'class') element.className = value;
      if (name.startsWith('data-'))
        element.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      if (['type', 'value'].includes(name)) element[name] = value;
      if (['hidden', 'disabled', 'checked', 'inert'].includes(name)) element[name] = true;
    }
    stack.at(-1).append(element);
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag)) stack.push(element);
  }
}

test('real Studio Team preparation, collection prompt, undo, redo, reset, save and reload retain valid selection and isolated history', async (t) => {
  const doc = new Document(),
    window = new Events(),
    db = memoryIndexedDB(),
    writes = [],
    opened = [];
  const fixture = await incompleteTeamWorkspace();
  await createStudioStore({ indexedDB: db.indexedDB }).save(fixture.document, fixture.assets, {
    expectedGeneration: 0,
  });
  class StudioElement extends Element {
    constructor(document, tag) {
      super(document, tag);
      this.style.getPropertyValue = (name) => this.style[name] || '';
      this.style.removeProperty = (name) => delete this.style[name];
    }
    set inert(value) {
      this._inert = value;
      if (value && this.contains(this.ownerDocument.activeElement))
        this.ownerDocument.activeElement = this.ownerDocument.body;
    }
    get inert() {
      return this._inert;
    }
    getContext() {
      return new Proxy({}, { get: () => () => {} });
    }
  }
  doc.createElement = (tag) => new StudioElement(doc, tag);
  doc.createDocumentFragment = () => new StudioElement(doc, 'fragment');
  const matchMedia = () => ({ matches: false });
  window.matchMedia = matchMedia;
  const globals = {
    document: doc,
    window,
    indexedDB: {
      open: (name, version) => {
        opened.push(name);
        return db.indexedDB.open(name, version);
      },
    },
    matchMedia,
    localStorage: { getItem: () => null, setItem: (...args) => writes.push(args) },
    fetch: async (url) => {
      const name = String(url).split('/compiled/')[1];
      return name
        ? new Response(await readFile(new URL('../presentation/compiled/' + name, import.meta.url)))
        : new Response(null, { status: 404 });
    },
    createImageBitmap: async (blob) => {
      const bytes = Buffer.from(await blob.arrayBuffer());
      return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), blob, close() {} };
    },
    cancelAnimationFrame() {},
  };
  const old = Object.fromEntries(Object.keys(globals).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, globals);
  t.after(() => {
    window.emit('pagehide', { persisted: false });
    Object.assign(globalThis, old);
  });
  mount(
    doc,
    await readFile(new URL('../../authoring/asset-studio/index.html', import.meta.url), 'utf8'),
  );
  const $ = (id) => doc.getElementById(id),
    message = () => $('studio-status').querySelector('.operation-status-label').textContent;
  await import(`../../authoring/asset-studio/studio.mjs?team-authoring=${Date.now()}`);
  await waitFor(() => $('cancel-studio-operation').hidden, {
    message: 'Studio startup did not finish',
  });
  assert.ok(
    $('workspace-summary').textContent.includes(
      `document r${fixture.document.revision} · local save 1`,
    ),
  );
  assert.match(message(), /Saved studio workspace loaded/);
  assert.equal($('prepare-team-actors').disabled, false);
  $('prepare-team-actors').focus();
  await $('prepare-team-actors').onclick();
  assert.equal($('prepare-team-actors').disabled, true);
  assert.match(message(), /32 Team body slots/);
  assert.equal($('asset-list').querySelectorAll('button').length, 32);
  assert.equal(doc.activeElement, $('asset-list').querySelector('button[aria-pressed="true"]'));
  const first = $('asset-list').querySelector('input');
  first.checked = true;
  first.onchange();
  const prompt = doc.querySelector('[data-prompt-action="collection"]');
  prompt.onclick();
  assert.match($('generated-prompt').value, /team.player.1.normal.compact/);
  await $('undo-draft').onclick();
  assert.equal($('collection-count').textContent, '0 slots selected');
  assert.equal($('prepare-team-actors').disabled, false);
  assert.equal($('slot-id').textContent, 'ui.panel');
  await $('redo-draft').onclick();
  assert.equal($('prepare-team-actors').disabled, true);
  assert.equal($('asset-list').querySelectorAll('button').length, 32);
  await $('reset-draft').onclick();
  assert.equal($('prepare-team-actors').disabled, false);
  doc.focused = false;
  $('prepare-team-actors').focus();
  await $('prepare-team-actors').onclick();
  assert.equal(doc.activeElement, doc.body, 'background preparation does not reclaim focus');
  doc.focused = true;
  await $('save-workspace').onclick();
  assert.match(message(), /Local revision saved/);
  await $('reload-workspace').onclick();
  assert.equal($('prepare-team-actors').disabled, true);
  assert.equal($('prepare-team-anchors').disabled, false);
  $('prepare-team-anchors').focus();
  await $('prepare-team-anchors').onclick();
  assert.equal($('prepare-team-anchors').disabled, true);
  assert.match(message(), /Both Team anchor states staged/);
  assert.equal($('asset-list').querySelectorAll('button').length, 2);
  assert.equal(doc.activeElement, $('asset-list').querySelector('button[aria-pressed="true"]'));
  assert.match($('generated-prompt').value, /24|anchor/);
  await $('undo-draft').onclick();
  assert.equal($('prepare-team-anchors').disabled, false);
  await $('redo-draft').onclick();
  assert.equal($('prepare-team-anchors').disabled, true);
  await $('save-workspace').onclick();
  await $('reload-workspace').onclick();
  assert.equal($('prepare-team-anchors').disabled, true);
  assert.equal($('prepare-team-effects').disabled, false);
  $('prepare-team-effects').focus();
  await $('prepare-team-effects').onclick();
  assert.equal($('prepare-team-effects').disabled, true);
  assert.match(message(), /Four Team feedback states staged/);
  assert.equal($('asset-list').querySelectorAll('button').length, 4);
  assert.equal(doc.activeElement, $('asset-list').querySelector('button[aria-pressed="true"]'));
  assert.match($('generated-prompt').value, /Support|support/);
  await $('undo-draft').onclick();
  assert.equal($('prepare-team-effects').disabled, false);
  await $('redo-draft').onclick();
  assert.equal($('prepare-team-effects').disabled, true);
  await $('save-workspace').onclick();
  await $('reload-workspace').onclick();
  assert.equal($('prepare-team-effects').disabled, true);
  assert.equal($('prepare-team-threats').disabled, false);
  $('prepare-team-threats').focus();
  await $('prepare-team-threats').onclick();
  assert.equal($('prepare-team-threats').disabled, true);
  assert.match(message(), /Three Team threat states staged/);
  assert.equal($('asset-list').querySelectorAll('button').length, 3);
  assert.equal(doc.activeElement, $('asset-list').querySelector('button[aria-pressed="true"]'));
  assert.match($('generated-prompt').value, /emitter-warning/);
  await $('undo-draft').onclick();
  assert.equal($('prepare-team-threats').disabled, false);
  await $('redo-draft').onclick();
  assert.equal($('prepare-team-threats').disabled, true);
  await $('save-workspace').onclick();
  await $('reload-workspace').onclick();
  assert.equal($('prepare-team-threats').disabled, true);
  assert.equal($('prepare-team-events').disabled, false);
  $('prepare-team-events').focus();
  await $('prepare-team-events').onclick();
  assert.equal($('prepare-team-events').disabled, true);
  assert.match(message(), /Both Team event slots staged/);
  assert.equal($('asset-list').querySelectorAll('button').length, 2);
  assert.equal(doc.activeElement, $('asset-list').querySelector('button[aria-pressed="true"]'));
  assert.match($('generated-prompt').value, /joint-capture/);
  await $('undo-draft').onclick();
  assert.equal($('prepare-team-events').disabled, false);
  await $('redo-draft').onclick();
  assert.equal($('prepare-team-events').disabled, true);
  await $('save-workspace').onclick();
  await $('reload-workspace').onclick();
  assert.equal($('prepare-team-events').disabled, true);
  const store = createStudioStore({ indexedDB: db.indexedDB }),
    saved = await store.load();
  for (const id of [
    'team.anchor.available',
    'team.anchor.captured',
    'team.event.joint-capture',
    'team.event.team-recovery',
  ])
    assert.ok(saved.document.slots.some((slot) => slot.id === id));
  assert.ok(saved.document.slots.every((slot) => typeof slot.id === 'string'));
  for (const field of ['slots', 'assets', 'themes', 'collections'])
    assert.deepEqual(
      saved.document[field].slice(0, fixture.document[field].length),
      fixture.document[field],
    );
  for (const [sha256, blob] of fixture.assets)
    assert.deepEqual(
      Buffer.from(await saved.assets.get(sha256).arrayBuffer()),
      Buffer.from(await blob.arrayBuffer()),
    );

  for (const row of TEAM_ACTOR_SLOTS)
    assert.ok(saved.document.slots.some((slot) => slot.id === row.id));
  assert.equal(
    writes.length,
    0,
    'authoring never writes player saves or interface choices implicitly',
  );
  assert.ok(opened.length > 0);
  assert.ok(opened.every((name) => name === STUDIO_DATABASE));
});
