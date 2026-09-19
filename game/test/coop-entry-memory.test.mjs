import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { page } from './helpers/coop-host.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { COOP_PICTURE_BINDINGS } from '../couch/coop-picture-bindings.mjs';
import { TEAM_ARENA_PREFERENCE_KEY as key } from '../couch/team-arena-preference.mjs';

const bookmark = (levelId, extra = {}) =>
  JSON.stringify({
    version: 'revealline-team-arena.v1',
    packId: COOP_STARTER_PACK.id,
    packRevision: COOP_STARTER_PACK.revision,
    levelId,
    ...extra,
  });
function storage(raw) {
  const values = new Map([
    ['solo-save', 'untouched'],
    ['earned-media', 'untouched'],
  ]);
  if (raw !== undefined) values.set(key, raw);
  const writes = [];
  return {
    values,
    writes,
    getItem: (name) => values.get(name) ?? null,
    setItem(name, value) {
      writes.push([name, value]);
      values.set(name, value);
    },
  };
}
const installStorage =
  (store, then = () => {}) =>
  (context) => {
    context.install('localStorage', { value: store });
    then(context);
  };
function ready(f, id) {
  assert.equal(f.$('coop-level').value, id);
  assert.equal(f.$('coop-play').hidden, true, 'Preparation does not start play.');
  assert.equal(f.$('coop-start').disabled, false);
  assert.equal(f.drawImages.length, 0);
  const binding = COOP_PICTURE_BINDINGS[id === 'first-connection' ? 0 : 1];
  assert.equal(f.previewDrawImages.at(-1).sha256, binding.picture.sha256);
}

test('the blocking intent tracker follows visible loading feedback and precedes native Arena markup', async () => {
  const html = await readFile(new URL('../couch/relay-rescue.html', import.meta.url), 'utf8');
  assert.match(
    html,
    /id="coop-boot"[\s\S]*<script src="team-entry\.js"><\/script>[\s\S]*id="coop-level"/,
  );
  assert.match(html, /<option value="first-connection" selected>/);
  assert.doesNotMatch(html, /<option value="relay-yard" selected>/);
});

test('a fresh first visit shows and starts the exact First Connection without creating a bookmark', async (t) => {
  const store = storage();
  const f = await page(t, { beforeImport: installStorage(store) });
  ready(f, 'first-connection');
  assert.match(f.$('coop-menu-goal').textContent, /Reveal 65%/);
  assert.equal(f.$('coop-stronghold-help').hidden, true);
  f.$('coop-start').click();
  assert.equal(f.$('coop-stage').textContent, 'FIRST CONNECTION');
  assert.equal(f.$('coop-objective').textContent, 'Reveal 65% together');
  assert.deepEqual(store.writes, []);
});

test('a deliberate built-in selection survives a fresh page without storing a flight', async (t) => {
  const store = storage();
  await t.test('choose Relay Yard', async (t) => {
    const f = await page(t, { beforeImport: installStorage(store) });
    await f.choose('coop-level', 'relay-yard');
    ready(f, 'relay-yard');
    assert.deepEqual(store.writes, [[key, bookmark('relay-yard')]]);
  });
  await t.test('fresh entry restores the exact arena and waits for Start', async (t) => {
    const f = await page(t, { beforeImport: installStorage(store) });
    ready(f, 'relay-yard');
    assert.equal(f.$('coop-stronghold-help').hidden, false);
    assert.deepEqual(store.writes, [[key, bookmark('relay-yard')]]);
    assert.equal(store.values.get('solo-save'), 'untouched');
    assert.equal(store.values.get('earned-media'), 'untouched');
  });
});

for (const [saved, choices] of [
  ['relay-yard', ['first-connection']],
  ['relay-yard', ['relay-yard', 'first-connection']],
  ['first-connection', ['relay-yard']],
])
  test(`early ${choices.join(' → ')} wins over saved ${saved}`, async (t) => {
    const store = storage(bookmark(saved));
    const f = await page(t, {
      nativeFocus: true,
      beforeImport: installStorage(store, ({ $ }) => {
        for (const id of choices) {
          $('coop-level').value = id;
          $('coop-level').emit('change');
        }
        $('coop-level').focus();
      }),
    });
    const accepted = choices.at(-1);
    ready(f, accepted);
    assert.equal(f.doc.activeElement.id, 'coop-level');
    assert.equal(store.getItem(key), bookmark(accepted));
    assert.equal(store.writes.length, 1);
  });

for (const raw of [
  '{',
  bookmark('relay-yard', { version: 'future.v2' }),
  bookmark('relay-yard', { packRevision: 999 }),
])
  test(`unusable bookmark falls back without automatic repair: ${raw}`, async (t) => {
    const store = storage(raw);
    const f = await page(t, { beforeImport: installStorage(store) });
    ready(f, 'first-connection');
    assert.deepEqual(store.writes, []);
    assert.equal(store.getItem(key), raw);
  });

test('missing early tracker conservatively retains native setup instead of overwriting it with storage', async (t) => {
  const store = storage(bookmark('relay-yard'));
  const f = await page(t, { entryBootstrap: false, beforeImport: installStorage(store) });
  ready(f, 'first-connection');
  assert.deepEqual(store.writes, []);
});

test('a failed bookmark write leaves the chosen arena ready and announces a session-only choice', async (t) => {
  const store = storage();
  store.setItem = () => {
    throw new Error('Quota denied');
  };
  const f = await page(t, { beforeImport: installStorage(store) });
  await f.choose('coop-level', 'relay-yard');
  ready(f, 'relay-yard');
  assert.equal(f.$('coop-selection-status').hidden, false);
  assert.match(f.$('coop-selection-status').textContent, /could not be saved/);
  assert.equal(f.$('coop-selection-status').getAttribute('role'), 'status');
  f.$('coop-start').click();
  assert.equal(f.$('coop-stage').textContent, 'RELAY YARD');
});

test('imported arenas remain local and Return restores this visit’s built-in selection', async (t) => {
  const store = storage();
  const f = await page(t, { beforeImport: installStorage(store) });
  await f.choose('coop-level', 'relay-yard');
  const pack = structuredClone(COOP_STARTER_PACK);
  pack.id = 'custom-import';
  pack.levels[0].id = 'custom-field';
  pack.levels[1].id = 'custom-yard';
  await f.selectFile(JSON.stringify(pack));
  await f.choose('coop-level', 'custom-yard');
  assert.equal(f.$('coop-level').value, 'custom-yard');
  assert.deepEqual(store.writes, [[key, bookmark('relay-yard')]]);
  f.$('coop-pack-reset').click();
  await waitFor(() => f.$('coop-picture-status').dataset.state === 'ready');
  ready(f, 'relay-yard');
  assert.deepEqual(store.writes, [[key, bookmark('relay-yard')]]);
});

test('late initial artwork cannot replace a deliberate arena or its bookmark', async (t) => {
  const store = storage(),
    gate = deferred();
  const f = await page(t, {
    waitPicture: false,
    beforeImport: installStorage(store),
    presentation: { read: ({ calls }) => (calls.reads.length === 1 ? gate.promise : undefined) },
  });
  await waitFor(() => f.artwork.calls.reads.length === 1);
  await f.choose('coop-level', 'relay-yard');
  ready(f, 'relay-yard');
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  ready(f, 'relay-yard');
  assert.equal(store.getItem(key), bookmark('relay-yard'));
});

test('BFCache and Settings retain this attempt when another tab changes the bookmark', async (t) => {
  const store = storage(bookmark('relay-yard'));
  const f = await page(t, { nativeFocus: true, beforeImport: installStorage(store) });
  f.$('coop-start').click();
  f.tick(3);
  f.$('coop-pause').click();
  const picture = f.drawImages.at(-1),
    reads = f.artwork.calls.reads.length;
  const hud = ['coop-stage', 'coop-clock', 'coop-coverage', 'coop-reserves'].map(
    (id) => f.$(id).textContent,
  );
  store.values.set(key, bookmark('first-connection'));
  f.win.emit('pagehide', { persisted: true });
  f.win.emit('pageshow', { persisted: true });
  f.$('coop-settings-open').click();
  f.$('coop-settings-close').click();
  assert.equal(f.$('coop-overlay').hidden, false, 'Resume remains explicit.');
  assert.deepEqual(
    ['coop-stage', 'coop-clock', 'coop-coverage', 'coop-reserves'].map((id) => f.$(id).textContent),
    hud,
  );
  assert.equal(f.drawImages.at(-1), picture);
  assert.equal(f.artwork.calls.reads.length, reads);
  assert.equal(f.$('coop-level').value, 'relay-yard');
  assert.deepEqual(store.writes, []);
});

for (const [type, detail] of [
  ['pointerdown', { button: 0, isPrimary: true }],
  ['click', { button: 0 }],
  ['keydown', { key: 'Enter' }],
  ['keydown', { key: 'f' }],
  ['keydown', { key: 'F4' }],
]) {
  test(`same-value ${type} ${detail.key ?? ''} retains visible First Connection without manufacturing a change`, async (t) => {
    const store = storage(bookmark('relay-yard'));
    let originalOptions;
    const f = await page(t, {
      beforeImport: installStorage(store, ({ $ }) => {
        originalOptions = [...$('coop-level').options];
        assert.equal($('coop-level').value, 'first-connection');
        assert.equal($('coop-level').emit(type, detail).defaultPrevented, false);
      }),
    });
    ready(f, 'first-connection');
    assert.equal(
      [...f.$('coop-level').options].every((option, index) => option === originalOptions[index]),
      true,
      'Boot retains native option nodes.',
    );
    assert.deepEqual(store.writes, [], 'Opening or cancelling a native selector does not write.');
    assert.equal(store.getItem(key), bookmark('relay-yard'));
    f.$('coop-start').click();
    assert.equal(f.$('coop-stage').textContent, 'FIRST CONNECTION');
    assert.deepEqual(
      store.writes,
      [[key, bookmark('first-connection')]],
      'A successful explicit Start remembers the accepted visible arena.',
    );
  });
}

test('focus and Tab alone still restore the returning arena without replacing its native options', async (t) => {
  const store = storage(bookmark('relay-yard'));
  let originalOptions;
  const f = await page(t, {
    nativeFocus: true,
    beforeImport: installStorage(store, ({ $ }) => {
      originalOptions = [...$('coop-level').options];
      $('coop-level').focus();
      $('coop-level').emit('keydown', { key: 'Tab' });
    }),
  });
  ready(f, 'relay-yard');
  assert.equal(
    [...f.$('coop-level').options].every((option, index) => option === originalOptions[index]),
    true,
  );
  assert.equal(f.doc.activeElement.id, 'coop-level');
  assert.deepEqual(store.writes, []);
});

test('failed Start after a claim-only selection leaves the existing bookmark unchanged', async (t) => {
  const errors = [];
  t.mock.method(console, 'error', (error) => errors.push(error));
  const store = storage(bookmark('relay-yard'));
  const f = await page(t, {
    beforeImport: installStorage(store, ({ $ }) =>
      $('coop-level').emit('pointerdown', { button: 0 }),
    ),
  });
  ready(f, 'first-connection');
  f.failNextPaint();
  f.$('coop-start').click();
  assert.equal(errors.length, 1);
  assert.equal(f.$('coop-resume').hidden, true);
  assert.equal(store.getItem(key), bookmark('relay-yard'));
  assert.deepEqual(store.writes, []);
});

test('starting an imported pack after claiming the built-in selector never saves imported identity', async (t) => {
  const store = storage(bookmark('relay-yard'));
  const f = await page(t, {
    beforeImport: installStorage(store, ({ $ }) =>
      $('coop-level').emit('pointerdown', { button: 0 }),
    ),
  });
  ready(f, 'first-connection');
  const pack = structuredClone(COOP_STARTER_PACK);
  pack.id = 'claim-import';
  await f.selectFile(JSON.stringify(pack));
  f.$('coop-start').click();
  assert.equal(f.$('coop-play').hidden, false);
  assert.deepEqual(store.writes, []);
  assert.equal(store.getItem(key), bookmark('relay-yard'));
});
