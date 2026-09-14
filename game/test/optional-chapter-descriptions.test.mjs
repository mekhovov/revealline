// Actual solo host and optional panel; browser DOM/fetch/keyboard defaults are
// finite boundaries. No physical-controller, layout or browser-rendering claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle, SoloElement } from './helpers/solo-dom.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { attachOptionalChaptersPanel } from '../ui/optional-chapters-panel.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const catalog = JSON.parse(
  await readFile(new URL('../content/optional-worlds.json', import.meta.url)),
);
const descriptionId = (item) => `optional-worlds-description-${item.id}`;

function catalogTransport(t) {
  const original = globalThis.fetch;
  const requests = [];
  let response = async () => new Response(JSON.stringify(catalog));
  globalThis.fetch = async (url, options) => {
    if (!String(url).startsWith('http')) return original(url, options);
    assert.ok(
      String(url).endsWith('game/content/optional-worlds.json'),
      'Reading cards must not fetch a pack body.',
    );
    requests.push({ url: String(url), signal: options?.signal });
    return response();
  };
  t.after(() => {
    globalThis.fetch = original;
  });
  return {
    requests,
    set response(value) {
      response = value;
    },
  };
}

async function open(page) {
  page.$('shell-menu').click();
  page.$('shell-worlds').click();
  await settle(
    () =>
      !!page.$(`optional-worlds-install-${catalog.packs[0].id}`) &&
      !page.$('optional-worlds-reload').disabled,
  );
}

function tab(page) {
  const target = page.doc.activeElement;
  const event = target.emit('keydown', { key: 'Tab', code: 'Tab', repeat: false });
  if (!event.defaultPrevented) {
    // The finite DOM has no browser default Tab action. Native dialog controls
    // and explicit tabIndex still determine that action; no ID list drives it.
    const descendants = (node) => node.children.flatMap((child) => [child, ...descendants(child)]);
    const dialog = target.closest('dialog[open]');
    const controls = descendants(dialog).filter(
      (node) =>
        node.tabIndex >= 0 &&
        !node.disabled &&
        !node.closest('[hidden],[inert],[aria-hidden="true"]') &&
        (() => {
          // Native Tab excludes a closed details body while retaining its summary.
          for (let parent = node.parentElement; parent; parent = parent.parentElement)
            if (parent.tagName === 'DETAILS' && !parent.open) {
              const summary = parent.querySelector('summary');
              if (node !== summary && !summary?.contains(node)) return false;
            }
          return true;
        })(),
    );
    controls[(controls.indexOf(target) + 1) % controls.length].focus();
  }
  target.emit('keyup', { key: 'Tab', code: 'Tab' });
}

test('More worlds shows all authored layout/equipment descriptions before downloading, without changing a paused cut or Tab controls', async (t) => {
  const page = await soloPage(t);
  page.$('start-button').click();
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let i = 0; i < 13; i++) page.frame();
  assert.equal(page.rendered.run.player.cutting, true);
  const run = page.rendered.run,
    before = authoritativeCheckpoint(run);
  const transport = catalogTransport(t);
  await open(page);
  page.frame(0);
  const saved = new Map(page.storage.map);
  assert.equal(catalog.packs.length, 5);
  for (const item of catalog.packs) {
    const description = page.$(descriptionId(item));
    assert.ok(description, `Visible description for ${item.id}`);
    assert.equal(description.tagName, 'P');
    assert.equal(description.textContent, item.description);
    assert.equal(description.tabIndex, -1);
    assert.equal(description.children.length, 0);
  }
  for (const item of catalog.packs.slice(0, 4)) {
    assert.match(page.$(descriptionId(item)).textContent, /proven Pressure Lines layouts/);
    assert.match(page.$(descriptionId(item)).textContent, /Direction-only Arcade/);
  }
  const tactical = catalog.packs.find((item) => item.id === 'fpv-route-choices');
  assert.match(page.$(descriptionId(tactical)).textContent, /Tactical: three distinct routes/);
  assert.match(page.$(descriptionId(tactical)).textContent, /Manual equipment/);
  const expected = new Set([
    'optional-worlds-top-back',
    'optional-worlds-summary',
    'optional-worlds-theme',
    'optional-worlds-mode',
    'optional-worlds-previous',
    'optional-worlds-next',
    ...catalog.packs.map((item) => `optional-worlds-install-${item.id}`),
    'optional-worlds-source-recovery-summary',
    ...['ukraine', 'retro', 'coupa'].map(
      (theme) => `optional-worlds-source-route-worlds-${theme}-recovery-summary`,
    ),
    ...['fpv', 'ukraine', 'retro', 'coupa'].map(
      (theme) => `optional-worlds-source-sentinel-circuit-${theme}-recovery-summary`,
    ),
    ...['fpv', 'ukraine', 'retro', 'coupa'].map(
      (theme) => `optional-worlds-source-fracture-lines-${theme}-recovery-summary`,
    ),
    ...['fpv', 'ukraine', 'retro', 'coupa'].map(
      (theme) => `optional-worlds-source-countercurrent-${theme}-recovery-summary`,
    ),
    'optional-worlds-read',
    'optional-worlds-reload',
    'optional-worlds-manage',
    'optional-worlds-back',
  ]);
  const visited = new Set();
  while (true) {
    page.$('optional-worlds-top-back').focus();
    for (let i = 0; i < expected.size * 2; i++) {
      const target = page.doc.activeElement;
      visited.add(target.id);
      tab(page);
    }
    if (page.$('optional-worlds-next').disabled) break;
    page.$('optional-worlds-next').click();
  }
  assert.deepEqual(visited, expected);
  page.frame(0);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(page.storage.map, saved);
  assert.equal(transport.requests.length, 1);
  assert.deepEqual(page.errors, []);
});

test('cancelled catalog refresh retains prior descriptions; accepted refreshed copy is verbatim inert text', async (t) => {
  const page = await soloPage(t);
  const transport = catalogTransport(t);
  await open(page);
  const first = catalog.packs[0],
    run = page.rendered.run,
    before = authoritativeCheckpoint(run);
  assert.equal(page.$(descriptionId(first))?.textContent, first.description);
  const saved = new Map(page.storage.map);
  let release;
  transport.response = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  // Invoke the actual native handler so the test can await its complete async
  // lifecycle, including a late response after Back, without timing guesses.
  const refresh = page.$('optional-worlds-reload').onclick();
  await settle(() => !!release);
  page.$('optional-worlds-top-back').click();
  assert.equal(transport.requests[1].signal.aborted, true);
  const next = structuredClone(catalog);
  next.packs[0].description =
    '<button id="unexpected-world-action">Tactical?</button> & original text';
  release(new Response(JSON.stringify(next)));
  await refresh;
  assert.equal(page.$('optional-worlds-dialog').open, false);
  assert.equal(page.$(descriptionId(first)).textContent, first.description);
  page.$('shell-worlds').click();
  await settle(() => !page.$('optional-worlds-reload').disabled);
  assert.equal(transport.requests.length, 2, 'Reopening keeps the accepted catalog.');
  transport.response = async () => new Response(JSON.stringify(next));
  await page.$('optional-worlds-reload').onclick();
  const description = page.$(descriptionId(first));
  assert.equal(description.textContent, next.packs[0].description);
  assert.equal(description.children.length, 0);
  assert.equal(description.tabIndex, -1);
  assert.equal(page.$('unexpected-world-action'), null);
  page.frame(0);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.deepEqual(page.storage.map, saved);
  assert.deepEqual(page.errors, []);
});

// Source capabilities below are deferred boundaries; the actual panel owns
// status, cancellation and the stale-operation guards. No storage/codec claim.
function sourcePanel(t, capability) {
  const doc = new Document();
  doc.createElement = (tag) => new SoloElement(doc, tag);
  const panel = attachOptionalChaptersPanel({
    document: doc,
    getLibrary: () => ({ format: 'xonix-pack-library.v1', packs: [] }),
    loadCatalog: async () => catalog,
    sourceChapter: { id: 'test-source', name: 'Source fixture', ...capability },
  });
  t.after(() => panel.dispose());
  return { panel, $: (id) => doc.getElementById(`optional-worlds-${id}`) };
}

test('source install reports checking immediately and late completion after Back cannot publish success', async (t) => {
  let finish, signal, pending;
  const h = sourcePanel(t, {
    inspect: async ({ signal }) => {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      return { status: 'absent' };
    },
    install: async (_files, options) => {
      signal = options.signal;
      await new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  t.after(async () => {
    finish?.();
    await pending;
  });
  await h.panel.open();
  h.$('source-pack').files = [new Blob(['{}'])];
  h.$('source-media').files = [new Blob(['originals'])];
  pending = h.$('source-install').onclick();
  assert.equal(h.$('source-install').disabled, true);
  assert.equal(h.$('status').textContent, 'Checking gameplay and original pictures…');
  h.$('top-back').click();
  assert.equal(signal.aborted, true);
  const cancelled = h.$('status').textContent;
  assert.match(cancelled, /cancelled/);
  finish();
  await pending;
  assert.equal(h.$('dialog').open, false);
  assert.equal(h.$('status').textContent, cancelled);
});

test('source reopen reports checking; obsolete inspection cannot replace the current operation or its ready message', async (t) => {
  const jobs = [],
    pending = [];
  let initial = true;
  const h = sourcePanel(t, {
    inspect: async ({ signal }) => {
      if (initial) return { status: 'absent' };
      return new Promise((resolve) => jobs.push({ resolve, signal }));
    },
  });
  t.after(async () => {
    for (const job of jobs) job.resolve({ status: 'absent' });
    await Promise.all(pending);
  });
  await h.panel.open();
  h.panel.close();
  initial = false;
  pending.push(h.panel.open());
  await waitFor(() => jobs.length === 1);
  assert.equal(h.$('status').textContent, 'Checking installed pictures…');
  assert.equal(h.$('source-install').disabled, true);
  h.panel.close();
  assert.equal(jobs[0].signal.aborted, true);
  pending.push(h.panel.open());
  await waitFor(() => jobs.length === 2);
  assert.equal(h.$('status').textContent, 'Checking installed pictures…');
  jobs[0].resolve({ status: 'unavailable', message: 'Obsolete inspection' });
  await pending[0];
  assert.equal(h.$('status').textContent, 'Checking installed pictures…');
  assert.equal(h.$('reload').disabled, true);
  assert.doesNotMatch(h.$('source-state').textContent, /Obsolete/);
  jobs[1].resolve({ status: 'installed' });
  await pending[1];
  assert.equal(h.$('source-choose').disabled, false);
  assert.equal(h.$('reload').disabled, false);
  assert.match(h.$('status').textContent, /Choose a world/);
  assert.doesNotMatch(h.$('status').textContent, /Checking|cancelled/);
});
