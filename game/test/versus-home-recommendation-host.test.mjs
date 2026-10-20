import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { activateMissionCard, openMissionLibrary } from './helpers/library-selection.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import { createJourneyBackend, JOURNEY_PROFILE_DATABASE } from '../journey/profile.mjs';

const edition = DEFAULT_JOURNEY_ROUTES.versus;
// Exact independently reviewed route-definition metadata, without constructing
// a second full Journey project merely to obtain its storage scope.
assert.equal(edition, 'whole-spatial-v25');
const profileKey = 'journey-whole-spatial-v25';
const firstId = JSON.stringify([
  `journey:${edition}`,
  edition,
  JSON.stringify(['candidate', 'journey-opening', 'prologue']),
  'candidate/journey-opening/prologue/first-return',
  '',
]);
function database() {
  const memory = managedIndexedDB();
  const databases = new Map([[JOURNEY_PROFILE_DATABASE, memory]]);
  return {
    memory,
    backend: createJourneyBackend({ ...memory, profileKey }),
    assetDatabase: {
      open(name, ...args) {
        if (!databases.has(name)) databases.set(name, managedIndexedDB());
        return databases.get(name).indexedDB.open(name, ...args);
      },
    },
  };
}
async function page(t, { db = database(), ...options } = {}) {
  const prior = getLocale();
  setLocale('en', { persist: false });
  t.after(() => setLocale(prior, { persist: false }));
  t.diagnostic(
    `before actual native boot: RSS ${Math.round(process.memoryUsage().rss / 1048576)} MiB`,
  );
  const p = await couchPage(t, {
    href: `http://localhost/game/couch/?journey=${edition}`,
    initialLevel: null,
    assetDatabase: db.assetDatabase,
    storage: memoryStorage(),
    fetchResponse: async (url) => {
      if (String(url).includes('/content-design/assets/')) return new Response(await readFile(url));
    },
    ...options,
  });
  t.diagnostic(
    `actual native boot settled: RSS ${Math.round(process.memoryUsage().rss / 1048576)} MiB`,
  );
  if (
    new URL(options.href || `http://localhost/game/couch/?journey=${edition}`).searchParams.get(
      'journey',
    ) === edition
  ) {
    await db.backend.read();
    assert.ok(
      db.memory.allPuts.some(([, key]) => key === profileKey),
      'The real host writes its actual pinned Journey profile scope.',
    );
  }
  p.db = db;
  return p;
}
const explanation = (p) => p.$('race-home-recommendation');
function visible(p) {
  assert.equal(
    explanation(p).closest('[hidden],[inert]') === null,
    true,
    'Description is visible.',
  );
  assert.equal(p.$('race-start').closest('[hidden],[inert]') === null, true, 'Start is visible.');
  assert.equal(p.$('race-start').disabled, false);
  assert.ok(
    p.$('race-start').getAttribute('aria-describedby').split(/\s+/).includes(explanation(p).id),
  );
  assert.equal(
    explanation(p).closest('.landing-commands') === p.$('race-start').closest('.landing-commands'),
    true,
    'Start and its explanation share the actual command column.',
  );
}
function absent(p) {
  assert.equal(explanation(p).hidden, true);
  assert.ok(
    !(p.$('race-start').getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .includes(explanation(p).id),
  );
}
async function start(p) {
  const button = p.$('race-start'),
    handler = button.onclick;
  let pending;
  button.onclick = (...args) => (pending = handler.apply(button, args));
  try {
    button.focus();
    button.click();
  } finally {
    button.onclick = handler;
  }
  assert(pending instanceof Promise, 'The real Start owns preparation and resume.');
  await pending;
  await waitFor(() => {
    p.frame(0);
    return !p.$('race-pause').disabled;
  });
  assert.equal(button.onclick === handler, true, 'The actual Start handler is retained.');
}

test(
  'default Versus landing explains first and preserves exact direct card launch and Resume',
  { timeout: 60000 },
  async (t) => {
    const p = await page(t),
      button = p.$('race-start'),
      handler = button.onclick;
    visible(p);
    assert.match(explanation(p).textContent, /Suggested race: First return.*first mission/s);
    const checkpoint = p.checkpoint();
    button.focus();
    setLocale('uk', { persist: false });
    assert.match(explanation(p).textContent, /Пропонована місія для змагання:.*Почніть/s);
    assert.equal(p.doc.activeElement === button, true, 'Locale changes retain exact Start focus.');
    assert.deepEqual(p.checkpoint(), checkpoint);
    setLocale('en', { persist: false });
    const profile = await p.db.backend.read();
    await openMissionLibrary(p, 'race-chapters');
    p.$('journey-back').click();
    assert.equal(
      p.doc.activeElement === p.$('race-chapters'),
      true,
      'Back restores its exact visible opener.',
    );
    assert.deepEqual(p.checkpoint(), checkpoint);
    assert.deepEqual((await p.db.backend.read()).clears, profile.clears);
    await openMissionLibrary(p, 'race-chapters');
    const matches = [...p.$('journey-cards').children].filter(
      (card) => card.dataset.missionId === firstId,
    );
    assert.equal(matches.length, 1);
    await activateMissionCard(matches[0]);
    p.frame(0);
    assert.equal(p.renders[0].status, 'running');
    assert.equal(p.renders[1].status, 'running');
    assert.equal(p.renders[0].levelId, 'first-return');
    assert.equal(p.renders[1].levelId, 'first-return');
    absent(p);
    assert.equal(
      button.onclick === handler,
      true,
      'Exact mission Play retains the actual Start handler.',
    );
    p.$('race-pause').click();
    p.frame(0);
    absent(p);
    const paused = p.checkpoint();
    assert.equal(button.onclick === handler, true, 'Resume retains the actual Start handler.');
    await start(p);
    absent(p);
    assert.deepEqual(p.checkpoint(), paused, 'Resume retains both accepted boards.');
  },
);

test(
  'a legally recorded default Journey clear explains the host-selected successor on re-entry',
  { timeout: 60000 },
  async (t) => {
    const db = database();
    let cleared;
    await t.test('earn through both real keyboard seats', async (t) => {
      const p = await page(t, { db });
      await start(p);
      p.key('KeyS');
      p.key('ArrowDown');
      for (let i = 0; i < 1800 && p.renders[0].status === 'running'; i++) p.frame();
      p.key('KeyS', false);
      p.key('ArrowDown', false);
      assert.equal(p.renders[0].status, 'won');
      assert.equal(p.renders[1].status, 'won');
      absent(p);
      await new Promise((resolve) => setImmediate(resolve));
      cleared = (await db.backend.read()).clears.versus;
      assert.ok(
        Object.keys(cleared).length > 0,
        'Only an actual accepted win supplies completion evidence.',
      );
    });
    await t.test('read the existing next owner without awarding another clear', async (t) => {
      const p = await page(t, { db });
      visible(p);
      assert.equal(p.renders[0].levelId, 'choose-your-share');
      assert.match(
        explanation(p).textContent,
        /Suggested race: Choose your share.*First return.*completion is recorded/s,
      );
      assert.doesNotMatch(explanation(p).textContent, /master|both players won|match winner/i);
      const before = p.checkpoint();
      const handler = p.$('race-start').onclick;
      setLocale('uk', { persist: false });
      assert.match(explanation(p).textContent, /після місії «.*», завершення якої записано/);
      assert.deepEqual(p.checkpoint(), before);
      assert.deepEqual((await db.backend.read()).clears.versus, cleared);
      assert.equal(p.$('race-start').onclick === handler, true);
    });
  },
);

test(
  'first-to-two intermediate rounds and Rematch never regain an initial progress explanation',
  { timeout: 60000 },
  async (t) => {
    const p = await page(t);
    p.$('race-options').click();
    p.$('race-settings-tab-gameplay').click();
    const format = p.$('race-format'),
      onChange = format.onchange;
    let preparing;
    format.onchange = (...args) => (preparing = onChange.apply(format, args));
    try {
      format.value = 'first-to-two';
      format.emit('change');
    } finally {
      format.onchange = onChange;
    }
    assert(preparing instanceof Promise);
    await preparing;
    p.$('race-options-back').click();
    p.frame(0);
    visible(p);
    assert.match(explanation(p).textContent, /Selected race: First return/);
    await start(p);
    p.key('KeyS');
    p.key('ArrowDown');
    for (let i = 0; i < 1800 && p.renders[0].status === 'running'; i++) p.frame();
    p.key('KeyS', false);
    p.key('ArrowDown', false);
    assert.equal(p.renders[0].status, 'won');
    assert.equal(p.renders[1].status, 'won');
    assert.match(p.$('race-message').textContent, /Draw/);
    absent(p);
    const previous = p.renders[0];
    await start(p);
    assert.equal(p.renders[0] === previous, false, 'The next round has a fresh accepted run.');
    assert.equal(p.renders[0].levelId, 'first-return');
    assert.equal(p.$('race-format').value, 'first-to-two');
    absent(p);
  },
);

test(
  'a stale persisted cursor has no fabricated reason for the existing fallback',
  { timeout: 60000 },
  async (t) => {
    const db = database();
    await db.backend.commit([
      { type: 'select', mode: 'versus', missionId: 'unavailable/retired-mission' },
    ]);
    const p = await page(t, { db });
    assert.equal(p.renders[0].levelId, 'first-return');
    absent(p);
    assert.deepEqual((await db.backend.read()).clears.versus, {});
  },
);

test(
  'validated incoming continuation retains its exact setup without an initial recommendation',
  { timeout: 60000 },
  async (t) => {
    const params = new URLSearchParams({
      journey: edition,
      'library-mission': firstId,
      'library-intent': 'select',
      'versus-next': JSON.stringify({
        mission: firstId,
        format: 'first-to-two',
        turnPolicy: 'grid-center',
        seconds: 90,
        difficulty: 'standard',
        tap: false,
        slots: [null, null],
      }),
    });
    const p = await page(t, { href: `http://localhost/game/couch/?${params}` });
    absent(p);
    assert.equal(p.$('race-format').value, 'first-to-two');
    assert.equal(p.$('race-turn').value, 'grid-center');
    assert.equal(p.$('journey-chooser').open, true);
    assert.equal(p.doc.activeElement.dataset.missionId, firstId);
    assert.deepEqual((await p.db.backend.read()).clears.versus, {});
  },
);

test(
  'cancelled original-picture preparation cannot reveal a stale initial explanation',
  { timeout: 60000 },
  async (t) => {
    const held = deferred(),
      decoding = deferred();
    t.after(() => held.resolve());
    class Picture {
      set src(value) {
        this.source = value;
        const bytes = Buffer.from(value.split(',')[1], 'base64');
        this.width = this.naturalWidth = bytes.readUInt32BE(16);
        this.height = this.naturalHeight = bytes.readUInt32BE(20);
        queueMicrotask(() => this.onload?.());
      }
      async decode() {
        decoding.resolve();
        await held.promise;
      }
      removeAttribute() {
        this.source = '';
      }
    }
    const pending = page(t, { ImageClass: Picture });
    await decoding.promise;
    const doc = globalThis.document;
    assert.equal(doc.getElementById('race-home-recommendation').hidden, true);
    doc.getElementById('race-picture-cancel').click();
    const p = await pending;
    const checkpoint = p.checkpoint();
    absent(p);
    held.resolve();
    await new Promise((resolve) => setImmediate(resolve));
    p.frame(0);
    absent(p);
    assert.deepEqual(p.checkpoint(), checkpoint);
    assert.equal(p.$('race-start').disabled, true);
  },
);

for (const journey of ['legacy', 'opening'])
  test(
    `${journey} keeps its existing landing without a default Journey explanation`,
    { timeout: 60000 },
    async (t) => {
      const p = await page(t, { href: `http://localhost/game/couch/?journey=${journey}` });
      absent(p);
      assert.equal(p.$('race-start').disabled, false);
    },
  );
