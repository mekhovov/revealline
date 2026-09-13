// Actual solo host and optional panel; browser DOM/fetch/keyboard defaults are
// finite boundaries. No physical-controller, layout or browser-rendering claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
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
        !node.closest('[hidden],[inert],[aria-hidden="true"]'),
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
    ...catalog.packs.map((item) => `optional-worlds-install-${item.id}`),
    'optional-worlds-source-pack',
    'optional-worlds-source-media',
    'optional-worlds-source-install',
    'optional-worlds-read',
    'optional-worlds-reload',
    'optional-worlds-manage',
    'optional-worlds-back',
  ]);
  const visited = new Set();
  for (let i = 0; i < expected.size * 2; i++) {
    const target = page.doc.activeElement;
    visited.add(target.id);
    tab(page);
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
