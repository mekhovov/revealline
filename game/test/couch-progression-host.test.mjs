import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import {
  createMediaIdentityCatalog,
  MEDIA_LIBRARY_FORMAT,
  MEDIA_PRESENTATION_FORMAT,
} from '../media-library.mjs';
import { createManagedMediaStore, MANAGED_MEDIA_DATABASE } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { deferred } from './helpers/media-fixtures.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [base, classes, themes] = await Promise.all([
  json('../content/campaign.json'),
  json('../content/classes.json'),
  json('../content/themes.json'),
]);
// Explicit test campaign, not modified delivered campaign authority. The three
// new identities use legal First Signal geometry. Bravo shifts its
// spawn/bouncer/supply two cells right while retaining this campaign's 48×36
// simulation version. Actual input and duel ticks earn every result; no run
// state is assigned. The two tiny saved originals are explicit test media.
const campaign = {
  version: base.version,
  id: 'tour-host-fixture',
  revision: '1',
  title: 'Three mission host fixture',
  levels: ['Alpha', 'Bravo', 'Charlie'].map((name, index) => ({
    ...structuredClone(base.levels[0]),
    id: `tour-fixture-${index + 1}`,
    name: `Fixture ${name}`,
    ...(index === 1
      ? {
          spawn: { ...base.levels[0].spawn, x: base.levels[0].spawn.x + 2 },
          enemies: base.levels[0].enemies.map((enemy) => ({ ...enemy, x: enemy.x + 2 })),
          supplies: base.levels[0].supplies.map((supply) => ({ ...supply, x: supply.x + 2 })),
        }
      : {}),
  })),
};
const catalog = createExecutionCatalog([
  {
    campaign: { ...campaign, classRecipes: classes },
    classRecipes: classes,
    themes: themes.themes,
  },
]);
const entry = catalog.entries.find((row) => row.difficulty === 'standard');
const identities = createMediaIdentityCatalog(catalog);
const originals = [
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=',
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
].map((value) => Buffer.from(value, 'base64'));
const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });

async function action(p, id, type = 'click') {
  const target = p.$(id),
    original = target[`on${type}`];
  let result;
  target[`on${type}`] = (event) => (result = original?.(event));
  try {
    target.emit(type);
    await result;
  } finally {
    target[`on${type}`] = original;
  }
  p.frame();
}
async function fixture(t) {
  const memory = managedIndexedDB(),
    assets = managedIndexedDB();
  const manager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true });
  const store = createStillMediaStore({ managedStore: manager, decodeImage });
  const prepared = await Promise.all(
    originals.map((bytes, index) =>
      prepareStillAsset(
        new Blob([bytes], { type: 'image/png' }),
        {
          id: `tour-picture-${index + 1}`,
          provenance: {
            kind: 'original',
            credit: 'Test fixture',
            source: 'Explicit one-pixel host-test media, not production art.',
          },
        },
        { decodeImage },
      ),
    ),
  );
  const library = {
    format: MEDIA_LIBRARY_FORMAT,
    assets: prepared.map((x) => x.asset),
    presentations: [],
    assignments: [],
  };
  for (const [index, level] of entry.campaign.levels.entries()) {
    const identity = identities.resolve({
      executionKey: entry.executionKey,
      levelId: level.id,
      levelRevision: level.revision,
      themeId: 'fpv',
    });
    const id = `tour-presentation-${index + 1}`;
    library.presentations.push({
      format: MEDIA_PRESENTATION_FORMAT,
      id,
      revision: 1,
      identity,
      poster: { assetId: prepared[index % 2].asset.id, fit: 'contain', sampling: 'nearest' },
      story: null,
      description: `Injected mission ${index + 1} picture.`,
    });
    library.assignments.push({ identity, presentationId: id, revision: 1 });
  }
  await store.commit(
    await store.prepare(
      library,
      prepared.map((x) => ({ sha256: x.asset.sha256, blob: x.blob })),
      { executionCatalog: catalog },
    ),
    { expectedGeneration: 0 },
  );
  const beforeWrites = [...memory.allPuts];
  const blobs = new Map(),
    images = [],
    revoked = [];
  let ordinal = 0;
  const media = { onDecode: null, onRelease: null, fail: false, images, revoked };
  class URLImpl extends URL {
    static createObjectURL(blob) {
      const id = `blob:tour-${++ordinal}`;
      blobs.set(id, blob);
      return id;
    }
    static revokeObjectURL(id) {
      revoked.push(id);
      blobs.delete(id);
    }
  }
  class ImageClass {
    constructor() {
      images.push(this);
    }
    set src(value) {
      this.source = value;
      Promise.resolve()
        .then(async () => {
          this.bytes = value.startsWith('data:')
            ? Buffer.from(value.split(',')[1], 'base64')
            : Buffer.from(await blobs.get(value).arrayBuffer());
          this.width = this.naturalWidth = this.bytes.readUInt32BE(16);
          this.height = this.naturalHeight = this.bytes.readUInt32BE(20);
          this.onload?.();
        })
        .catch((error) => this.onerror?.(error));
    }
    async decode() {
      await media.onDecode?.(this);
      if (media.fail) {
        media.fail = false;
        throw new Error('Tour candidate decode refused.');
      }
    }
    removeAttribute(name) {
      assert.equal(name, 'src');
      this.releases = (this.releases || 0) + 1;
      media.onRelease?.(this);
    }
  }
  const p = await couchPage(t, {
    campaign,
    initialLevel: null,
    ImageClass,
    URLImpl,
    assetDatabase: {
      open(name, ...args) {
        return (name === MANAGED_MEDIA_DATABASE ? memory : assets).indexedDB.open(name, ...args);
      },
    },
    storage: {
      getItem: () => null,
      setItem() {
        assert.fail('Tour must not write player preferences or progress.');
      },
    },
    fetchResponse(path) {
      if (path === '../content/packs/fpv-arcade-r5.json') return { ok: false };
    },
  });
  t.after(() => {
    store.close();
    manager.close();
  });
  return {
    p,
    media,
    originals: prepared,
    assertNoWrites() {
      assert.deepEqual(memory.allPuts, beforeWrites);
      assert.deepEqual(assets.allPuts, []);
    },
  };
}
async function format(p, value, selected = 'tour-fixture-1') {
  await action(p, 'race-focus');
  p.$('race-level').value = selected;
  await action(p, 'race-level', 'change');
  p.$('race-format').value = value;
  await action(p, 'race-format', 'change');
  await action(p, 'race-setup-back');
}
async function start(p, id = 'race-start') {
  p.$(id).focus();
  await action(p, id);
  assert.equal(p.state(), 'running');
}
function finish(p, winner = 0) {
  assert.equal(p.state(), 'running');
  const keys = winner === null ? ['KeyS', 'ArrowDown'] : [winner === 0 ? 'KeyS' : 'ArrowDown'];
  for (const key of keys) p.key(key);
  for (let frame = 0; frame < 2000 && p.state() === 'running'; frame++) p.frame();
  for (const key of keys) p.key(key, false);
  assert.equal(
    p.state(),
    'finished',
    'Legal First Signal geometry finishes by an actual downward cut.',
  );
  assert.equal(p.renders.filter((run) => run.status === 'won').length, winner === null ? 2 : 1);
}
function result(p) {
  assert.equal(p.state(), 'finished');
  return {
    runs: [...p.renders],
    checkpoint: p.checkpoint(),
    picture: p.drawOptions[0].backdrop,
    scores: p.$('series-score').textContent,
    rows: [0, 1].map((i) => p.$(`race-result-${i}`).textContent),
    selected: p.$('race-level').value,
    next: p.$('race-start').textContent,
    summary: p.$('race-format-summary').textContent,
  };
}
function retained(p, before) {
  assert.equal(p.state(), 'finished');
  assert.equal(
    p.renders.every((run, i) => run === before.runs[i]),
    true,
  );
  assert.deepEqual(p.checkpoint(), before.checkpoint);
  assert.equal(
    p.drawOptions.every((x) => x.backdrop === before.picture),
    true,
  );
  assert.equal(before.picture.image.releases || 0, 0);
  assert.equal(p.$('series-score').textContent, before.scores);
  assert.deepEqual(
    [0, 1].map((i) => p.$(`race-result-${i}`).textContent),
    before.rows,
  );
  assert.equal(p.$('race-level').value, before.selected);
  assert.equal(p.$('race-start').textContent, before.next);
  assert.equal(p.$('race-format-summary').textContent, before.summary);
  assert.equal(p.$('race-review').hidden, false);
}

test('default one race ends with an explicit same-mission rematch and never increments twice', async (t) => {
  const f = await fixture(t),
    { p } = f;
  assert.equal(p.$('race-format').value, 'one-race');
  await start(p);
  finish(p);
  assert.match(p.$('race-start').textContent, /^Rematch · Fixture Alpha$/);
  assert.equal(p.$('race-rematch').hidden, true);
  assert.equal(p.$('series-score').textContent, '1 : 0');
  const before = result(p);
  p.frames(50);
  retained(p, before);
  await start(p);
  assert.equal(p.renders[0].levelId, 'tour-fixture-1');
  assert.equal(p.$('series-score').textContent, '0 : 0');
  finish(p, null);
  assert.equal(p.$('series-score').textContent, '0 : 0');
  f.assertNoWrites();
});

test('explicit first-to-two retains wins through a draw and resets only accepted match rematch', async (t) => {
  const f = await fixture(t),
    { p } = f;
  await format(p, 'first-to-two');
  await start(p);
  finish(p);
  assert.match(p.$('race-start').textContent, /^Next round · Fixture Alpha$/);
  await start(p);
  finish(p, null);
  assert.equal(p.$('series-score').textContent, '1 : 0');
  await start(p);
  finish(p);
  assert.equal(p.$('series-score').textContent, '2 : 0');
  assert.match(p.$('race-start').textContent, /^Rematch match · Fixture Alpha$/);
  const before = result(p);
  f.media.fail = true;
  await action(p, 'race-start');
  retained(p, before);
  await start(p);
  assert.equal(p.$('series-score').textContent, '0 : 0');
  f.assertNoWrites();
});

test('tour selects authored first mission, advances exact distinct pictures, and ends without wrapping', async (t) => {
  const f = await fixture(t),
    { p } = f;
  await format(p, 'campaign-tour', 'tour-fixture-3');
  assert.equal(p.$('race-level').value, 'tour-fixture-1');
  assert.match(p.$('race-format-note').textContent, /3 missions.*First: Fixture Alpha/);
  assert.match(p.$('race-start').textContent, /^Start tour/);
  await start(p);
  finish(p);
  const first = p.drawOptions[0].backdrop;
  assert.equal(p.$('race-canvas-0').width, 768);
  assert.deepEqual(first.image.bytes, originals[0]);
  assert.match(p.$('race-start').textContent, /^Next · Fixture Bravo$/);
  assert.equal(p.$('race-rematch').hidden, false);
  await start(p);
  assert.equal(p.renders[0].levelId, 'tour-fixture-2');
  assert.equal(p.renders[0].level.width, 48);
  assert.equal(p.renders[0].level.spawn.x, campaign.levels[1].spawn.x);
  assert.notEqual(p.renders[0].level.spawn.x, campaign.levels[0].spawn.x);
  assert.equal(p.$('race-canvas-0').width, 768);
  assert.equal(p.$('race-canvas-1').width, 768);
  assert.equal(p.$('race-level').value, 'tour-fixture-2');
  assert.deepEqual(p.drawOptions[0].backdrop.image.bytes, originals[1]);
  assert.equal(p.drawOptions[0].backdrop === p.drawOptions[1].backdrop, true);
  assert.equal(first.image.releases, 1);
  finish(p, 1);
  assert.equal(p.$('series-score').textContent, '1 : 1');
  assert.match(p.$('race-start').textContent, /^Next · Fixture Charlie$/);
  await start(p);
  finish(p, null);
  assert.equal(p.$('race-start').textContent, 'Choose campaign');
  assert.match(p.$('race-format-summary').textContent, /3\/3 missions complete/);
  assert.equal(p.$('series-score').textContent, '1 : 1');
  const before = result(p);
  await action(p, 'race-start');
  assert.equal(p.$('race-confirm').hidden, false);
  assert.equal(
    p.renders.every((run, i) => run === before.runs[i]),
    true,
  );
  await action(p, 'race-confirm-back');
  retained(p, before);
  f.assertNoWrites();
});

test('tour rematch retains previous point while pending and running, then replaces it with a draw', async (t) => {
  const f = await fixture(t),
    { p } = f;
  await format(p, 'campaign-tour');
  await start(p);
  finish(p);
  const before = result(p),
    entered = deferred(),
    gate = deferred();
  f.media.onDecode = async () => {
    entered.resolve();
    await gate.promise;
  };
  p.$('race-rematch').focus();
  const pending = action(p, 'race-rematch');
  await entered.promise;
  retained(p, before);
  gate.resolve();
  await pending;
  assert.equal(
    p.state(),
    'running',
    'Still-owned secondary Rematch can transfer focus and start shipped content.',
  );
  assert.equal(p.renders[0].levelId, 'tour-fixture-1');
  assert.equal(p.$('series-score').textContent, '1 : 0');
  finish(p, null);
  assert.equal(p.$('series-score').textContent, '0 : 0');
  assert.match(p.$('race-format-summary').textContent, /1\/3 missions complete/);
  assert.match(p.$('race-start').textContent, /^Next · Fixture Bravo$/);
  f.assertNoWrites();
});

test('failed different-mission Next preserves result/cursor/art and retry publishes the captured mission before retirement', async (t) => {
  const f = await fixture(t),
    { p } = f;
  await format(p, 'campaign-tour');
  await start(p);
  finish(p);
  const before = result(p);
  f.media.fail = true;
  p.$('race-start').focus();
  await action(p, 'race-start');
  retained(p, before);
  assert.match(p.$('race-message').textContent, /Results are kept.*Next/);
  let observed;
  f.media.onRelease = (image) => {
    if (image !== before.picture.image) return;
    p.frame(0);
    observed = {
      state: p.state(),
      level: p.renders[0].levelId,
      selected: p.$('race-level').value,
      points: p.$('series-score').textContent,
      summary: p.$('race-format-summary').textContent,
      newRuns: p.renders.every((run, i) => run !== before.runs[i]),
      bytes: p.drawOptions[0].backdrop.image.bytes,
    };
  };
  await start(p);
  assert.equal(observed.state, 'ready');
  assert.equal(observed.level, 'tour-fixture-2');
  assert.equal(observed.newRuns, true);
  assert.equal(observed.points, '1 : 0');
  assert.match(observed.summary, /1\/3 missions complete/);
  assert.deepEqual(observed.bytes, originals[1]);
  assert.equal(p.$('race-level').value, 'tour-fixture-2');
  assert.equal(before.picture.image.releases, 1);
  f.assertNoWrites();
});

for (const origin of ['race-start', 'race-rematch'])
  test(`tour ${origin} Cancel retains results and ignores late decode before explicit retry`, async (t) => {
    const f = await fixture(t),
      { p } = f;
    await format(p, 'campaign-tour');
    await start(p);
    finish(p);
    const before = result(p),
      entered = deferred(),
      gate = deferred();
    f.media.onDecode = async () => {
      entered.resolve();
      await gate.promise;
    };
    p.$(origin).focus();
    const pending = action(p, origin);
    await entered.promise;
    assert.equal(p.doc.activeElement === p.$('race-picture-cancel'), true);
    await action(p, 'race-picture-cancel');
    assert.equal(p.doc.activeElement === p.$(origin), true);
    retained(p, before);
    gate.resolve();
    await pending;
    retained(p, before);
    f.media.onDecode = null;
    await start(p, origin);
    assert.equal(
      p.renders[0].levelId,
      origin === 'race-start' ? 'tour-fixture-2' : 'tour-fixture-1',
    );
    assert.equal(p.$('series-score').textContent, '1 : 0');
    f.assertNoWrites();
  });

for (const interruption of ['foreign-focus', 'blur', 'restore-reentry'])
  test(`secondary tour Rematch preserves credit and requires fresh Start after ${interruption}`, async (t) => {
    const f = await fixture(t),
      { p } = f;
    await format(p, 'campaign-tour');
    await start(p);
    finish(p);
    const entered = deferred(),
      gate = deferred();
    f.media.onDecode = async () => {
      entered.resolve();
      await gate.promise;
    };
    p.$('race-rematch').focus();
    const pending = action(p, 'race-rematch');
    await entered.promise;
    if (interruption === 'foreign-focus') p.$('race-help').focus();
    if (interruption === 'blur') p.win.emit('blur');
    if (interruption === 'restore-reentry') {
      const target = p.$('race-start'),
        focus = target.focus.bind(target);
      target.focus = (...args) => {
        focus(...args);
        p.$('race-help').focus();
        p.doc.body.focus();
      };
    }
    gate.resolve();
    await pending;
    assert.equal(p.state(), 'ready');
    assert.equal(p.$('series-score').textContent, '1 : 0');
    assert.equal(p.renders[0].levelId, 'tour-fixture-1');
    if (interruption === 'foreign-focus')
      assert.equal(p.doc.activeElement === p.$('race-help'), true);
    p.frames(20);
    assert.equal(p.state(), 'ready');
    await start(p);
    f.assertNoWrites();
  });
