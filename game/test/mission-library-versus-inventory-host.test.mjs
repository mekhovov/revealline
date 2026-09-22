import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveObjectURL } from 'node:buffer';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { createExternalChapterPointerStore } from '../external-chapter-pointer.mjs';
import { preparePack, emptyPackLibrary, installPack, exportPackLibrary } from '../packs.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { pngBytes, deferred } from './helpers/media-fixtures.mjs';
import { metadataCustomLibrarySources } from '../mission-library/metadata-custom-source.mjs';
import { inspectPackLibraryMetadata, PACK_LIBRARY_VERSION } from '../packs.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { classicLibrarySources } from '../mission-library/classic-source.mjs';
import { createCouchChapterInstaller } from '../couch/couch-chapter-install.mjs';

let worldPromise;
const realWorld = () =>
  (worldPromise ??= import('../../authoring/library/route-worlds/build.mjs').then(
    ({ buildRouteWorld }) => buildRouteWorld('retro'),
  ));

const recipe = JSON.parse(
  await readFile(new URL('../content/packs/night-shift.json', import.meta.url)),
);
const png = `data:image/png;base64,${pngBytes().toString('base64')}`;
const source = {
  ...recipe,
  name: 'Player-owned night shift',
  visualOverrides: { background: { dataUrl: png, fit: 'contain' } },
};
const decodeHeader = async (value) => {
  const source =
    typeof value === 'string'
      ? value
      : `data:image/png;base64,${Buffer.from(await value.arrayBuffer()).toString('base64')}`;
  const header = inspectImageDataUrl(source);
  assert(header.valid);
  return { naturalWidth: header.width, naturalHeight: header.height };
};
class Locks {
  held = new Set();
  async request(key, _options, work) {
    if (this.held.has(key)) return work(null);
    this.held.add(key);
    try {
      return await work({ name: key });
    } finally {
      this.held.delete(key);
    }
  }
}
async function fixture(
  t,
  { href, installedSource = source, fetchResponse, pairedWorld, initialDecode } = {},
) {
  const databases = new Map(),
    values = new Map(),
    images = [];
  const indexedDB = {
    open(name, ...args) {
      if (!databases.has(name)) databases.set(name, managedIndexedDB());
      return databases.get(name).indexedDB.open(name, ...args);
    },
  };
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const pointer = createExternalChapterPointerStore({
    indexedDB,
    profileKey: 'revealline.library.dev.v1',
    packsKey: 'revealline.packs.dev.v1',
  });
  if (installedSource) {
    const { pack } = await preparePack(installedSource, { decodeImage: decodeHeader });
    await pointer.compareAndSwap(await pointer.snapshot(), {
      packs: exportPackLibrary(installPack(emptyPackLibrary(), pack)),
      index: null,
      journal: null,
    });
  }
  let decodeHook = null;
  class Image {
    constructor() {
      images.push(this);
    }
    set src(value) {
      this.source = value;
      void decodeHeader(resolveObjectURL(value) ?? value).then(
        (dimensions) => {
          Object.assign(this, dimensions);
          this.width = dimensions.naturalWidth;
          this.height = dimensions.naturalHeight;
          this.onload?.();
        },
        () => this.onerror?.(),
      );
    }
    async decode() {
      await decodeHook?.(this);
    }
    removeAttribute() {
      this.released = (this.released ?? 0) + 1;
    }
  }
  const locks = new Locks();
  if (pairedWorld) {
    const index = JSON.parse(
      await readFile(new URL('../content/mission-library-index.json', import.meta.url)),
    );
    const seed = createCouchChapterInstaller({
      channel: 'dev',
      registeredEntries: [],
      indexedDB,
      storage,
      lockManager: locks,
      ImageClass: Image,
      missionIndex: index,
      baseURL: 'http://localhost/',
      fetch: async (url) =>
        new Response(
          url.endsWith('/pack.json') ? pairedWorld.payloads.pack : pairedWorld.payloads.media,
        ),
    });
    try {
      const result = await seed.installExternal(
        index.missions.find((row) => row.packId === pairedWorld.descriptor.id),
      );
      assert(result.ready);
    } finally {
      seed.dispose();
    }
  }
  decodeHook = initialDecode ?? null;
  t.after(() => pointer.close());
  const p = await couchPage(t, {
    initialLevel: null,
    href: href ?? 'http://localhost/game/couch/?journey=legacy',
    storage,
    previewStorage: storage,
    lockManager: locks,
    assetDatabase: indexedDB,
    ImageClass: Image,
    fetchResponse: async (path) => {
      const response = await fetchResponse?.(path);
      if (response !== undefined) return response;
      if (String(path).includes('/content-design/assets/'))
        return new Response(await readFile(path));
      if (path === '../content/packs/fpv-arcade-r5.json')
        return new Response('Isolated Base fixture', { status: 503 });
    },
  });
  return {
    ...p,
    images,
    databases,
    values,
    pointer,
    set decodeHook(value) {
      decodeHook = value;
    },
  };
}
const settle = (predicate) => waitFor(predicate, { timeoutMs: 15000 });
async function replacement(p) {
  await waitFor(
    () =>
      p.$('race-library-replace')?.open ||
      (p.$('journey-chooser')?.open &&
        /Could not open/.test(p.$('journey-chooser-status').textContent)),
    { timeoutMs: 60000 },
  );
  assert.equal(
    p.$('race-library-replace')?.open,
    true,
    JSON.stringify({
      status: p.$('journey-chooser-status')?.textContent,
      message: p.$('race-message').textContent,
      inventory: p.$('race-library-inventory-status')?.textContent,
    }),
  );
}
async function open(p) {
  p.$('race-library-switch').focus();
  p.$('race-library-switch').click();
  await settle(() => p.$('journey-chooser')?.open);
  p.frame(0);
}
function custom(p) {
  p.$('journey-collection').value = 'Custom';
  p.$('journey-collection').emit('change');
  return [...p.$('journey-cards').children];
}

test('Versus browses installed artwork metadata without any additional decodes and explicitly materializes exact late Custom Play', async (t) => {
  const p = await fixture(t);
  const beforeImages = p.images.length;
  const before = p.checkpoint(),
    stored = await p.pointer.snapshot();
  await open(p);
  const rows = custom(p);
  assert.equal(rows.length, 3);
  assert.equal(
    p.images.length,
    beforeImages,
    'Browsing must not use full installed-library inspection.',
  );
  assert.deepEqual(await p.pointer.snapshot(), stored);
  const last = rows.find(
    (card) => JSON.parse(card.dataset.missionId)[3] === source.campaigns[0].levels.at(-1).id,
  );
  last.click();
  await settle(() => {
    p.frame(0);
    return p.state() === 'running';
  });
  assert.equal(p.renders[0].level.id, source.campaigns[0].levels.at(-1).id);
  assert.equal(p.renders[1].level.id, p.renders[0].level.id);
  assert(p.images.length > beforeImages, 'Explicit Play owns real image verification.');
  assert.notDeepEqual(p.checkpoint(), before);
});

test('failed inventory refresh retains Custom rows as unavailable and vetoes missing Classic downloads', async (t) => {
  const p = await fixture(t);
  await open(p);
  const rows = custom(p),
    ids = rows.map((card) => card.dataset.missionId);
  p.$('journey-back').click();
  p.values.set('revealline.library.dev.v1.backup-lock', 'preserve backup');
  await open(p);
  const stale = custom(p);
  assert.deepEqual(
    stale.map((card) => card.dataset.missionId),
    ids,
  );
  assert(stale.every((card) => card.disabled && /Unavailable/.test(card.textContent)));
  assert.match(p.$('race-library-inventory-status').textContent, /Existing packs are kept/);
  assert.equal(p.$('journey-chooser-status').parentElement, p.$('race-library-status'));
  assert.equal(p.$('race-library-inventory-status').parentElement, p.$('race-library-status'));
  assert.equal(
    p
      .$('journey-chooser')
      .querySelector('.journey-footer')
      .contains(p.$('race-library-inventory-status')),
    false,
  );
  p.$('journey-collection').value = 'Classic';
  p.$('journey-collection').emit('change');
  assert(![...p.$('journey-cards').children].some((card) => /Download/.test(card.textContent)));
  p.$('journey-back').click();
  p.values.delete('revealline.library.dev.v1.backup-lock');
  await open(p);
  assert.equal(custom(p).length, 3);
  assert(custom(p).every((card) => /Play/.test(card.textContent)));
});

test('new focus during metadata-to-runtime preparation preserves both boards and cannot open replacement', async (t) => {
  const p = await fixture(t);
  await open(p);
  const rows = custom(p),
    gate = deferred();
  let decoding = false;
  p.decodeHook = async () => {
    decoding = true;
    await gate.promise;
  };
  const before = p.checkpoint();
  rows.at(-1).click();
  await settle(() => decoding);
  const held = p.images.at(-1);
  p.$('race-level').focus();
  gate.resolve();
  await settle(() => held.released);
  p.frame(0);
  assert.deepEqual(p.checkpoint(), before);
  assert.equal(p.$('race-library-replace'), null);
  assert.notEqual(p.state(), 'running');
  assert.equal(p.doc.activeElement, p.$('race-level'));
});

test('incoming exact late Custom identity materializes under its original ownership without opening a substitute', async (t) => {
  const metadata = await inspectPackLibraryMetadata({
    format: PACK_LIBRARY_VERSION,
    packs: [source],
  });
  const model = createMissionLibrary(
    await metadataCustomLibrarySources(metadata, {
      isCurrent: () => true,
      compatibility: () => ['solo', 'versus'],
      describe: ({ level }) => ({ rules: `${level.rules.lives} authored lives` }),
      availability: () => ({ state: 'ready' }),
      launch: () => true,
    }),
  );
  const last = model.missions.at(-1);
  const params = new URLSearchParams({ journey: 'legacy', 'library-mission': last.id });
  const p = await fixture(t, { href: `http://localhost/game/couch/?${params}` });
  await settle(() => {
    p.frame(0);
    return p.state() === 'running';
  });
  assert.equal(p.renders[0].level.id, last.runtimeId);
  assert.equal(p.renders[1].level.id, last.runtimeId);
  assert.equal(p.$('journey-chooser').open, false);
});

test('replacing installed Custom storage while Stay/Replace is open prevents stale cross-mode departure', async (t) => {
  const p = await fixture(t);
  p.$('race-start').click();
  await settle(() => {
    p.frame(0);
    return p.state() === 'running';
  });
  await open(p);
  p.$('journey-mode').value = 'solo';
  p.$('journey-mode').emit('change');
  const cards = custom(p),
    before = p.checkpoint(),
    href = globalThis.location.href;
  cards.at(-1).click();
  await replacement(p);
  await p.pointer.compareAndSwap(await p.pointer.snapshot(), {
    packs: exportPackLibrary(emptyPackLibrary()),
    index: null,
    journal: null,
  });
  p.$('race-library-play').click();
  await settle(() => p.$('journey-chooser')?.open);
  p.frame(0);
  assert.equal(globalThis.location.href, href);
  assert.deepEqual(p.checkpoint(), before);
  assert.match(p.$('journey-chooser-status').textContent, /changed/i);
});

test('paired originals download inline, never autostart, and exact late Play preserves Stay before replacement', async (t) => {
  const world = await realWorld();
  const index = JSON.parse(
    await readFile(new URL('../content/mission-library-index.json', import.meta.url)),
  );
  const model = createMissionLibrary(
    classicLibrarySources(index, {
      availability: () => ({ state: 'ready' }),
      launch: () => true,
    }),
  );
  const target = model.missions.find(
    (item) => item.runtimeId === world.prepared.pack.campaigns[0].levels.at(-1).id,
  );
  const requests = [];
  const p = await fixture(t, {
    installedSource: null,
    fetchResponse: async (path) => {
      if (!String(path).includes('/optional/external-chapters/')) return;
      requests.push(String(path));
      return new Response(
        String(path).endsWith('/pack.json') ? world.payloads.pack : world.payloads.media,
      );
    },
  });
  p.$('race-start').click();
  await settle(() => {
    p.frame(0);
    return p.state() === 'running';
  });
  await open(p);
  const before = p.checkpoint();
  const card = () =>
    [...p.$('journey-cards').children].find((item) => item.dataset.missionId === target.id);
  assert.match(card().textContent, /Download/);
  card().click();
  await waitFor(() => /Play/.test(card().querySelector('.journey-card-action').textContent), {
    timeoutMs: 60000,
  });
  assert.equal(p.$('journey-chooser').open, true);
  assert.equal(p.state(), 'paused');
  assert.deepEqual(p.checkpoint(), before);
  assert.equal(requests.length, 2);
  assert.equal((await p.pointer.snapshot()).journal, null);
  card().click();
  await replacement(p);
  p.$('race-library-stay').click();
  await settle(() => p.$('journey-chooser')?.open);
  assert.deepEqual(p.checkpoint(), before);
  card().click();
  await replacement(p);
  p.$('race-library-play').click();
  await waitFor(
    () => {
      p.frame(0);
      return p.state() === 'running' && p.renders[0]?.level.id === target.runtimeId;
    },
    { timeoutMs: 60000 },
  );
  assert.equal(p.renders[1].level.id, target.runtimeId);
  assert.equal(requests.length, 2);
});

test('incoming installed paired late mission checks originals and directly starts only its exact boards', async (t) => {
  const world = await realWorld();
  const index = JSON.parse(
    await readFile(new URL('../content/mission-library-index.json', import.meta.url)),
  );
  const model = createMissionLibrary(
    classicLibrarySources(index, {
      availability: () => ({ state: 'ready' }),
      launch: () => true,
    }),
  );
  const target = model.missions.find(
    (item) => item.runtimeId === world.prepared.pack.campaigns[0].levels.at(-1).id,
  );
  const params = new URLSearchParams({ journey: 'legacy', 'library-mission': target.id });
  const p = await fixture(t, {
    installedSource: null,
    pairedWorld: world,
    href: `http://localhost/game/couch/?${params}`,
    fetchResponse: (path) => {
      if (String(path).includes('/optional/external-chapters/'))
        assert.fail('Installed incoming pair must not download.');
    },
  });
  await settle(() => {
    p.frame(0);
    return p.state() === 'running';
  });
  assert.equal(p.renders[0].level.id, target.runtimeId);
  assert.equal(p.renders[1].level.id, target.runtimeId);
  assert.equal(p.$('journey-chooser').open, false);
});

test('window blur cancels held incoming paired decode immediately without requiring focus movement', async (t) => {
  const world = await realWorld(),
    gate = deferred();
  const index = JSON.parse(
    await readFile(new URL('../content/mission-library-index.json', import.meta.url)),
  );
  const model = createMissionLibrary(
    classicLibrarySources(index, {
      availability: () => ({ state: 'ready' }),
      launch: () => true,
    }),
  );
  const target = model.missions.find(
    (item) => item.runtimeId === world.prepared.pack.campaigns[0].levels.at(-1).id,
  );
  const params = new URLSearchParams({ journey: 'legacy', 'library-mission': target.id });
  let held = null,
    focusBefore = null;
  const p = await fixture(t, {
    installedSource: null,
    pairedWorld: world,
    href: `http://localhost/game/couch/?${params}`,
    initialDecode: async (image) => {
      if (!held && globalThis.document.documentElement.dataset.toolState === 'ready') {
        held = image;
        focusBefore = globalThis.document.activeElement;
        globalThis.window.emit('blur');
        await gate.promise;
      }
    },
  });
  assert(held, 'The deliberate incoming check reached actual original decoding.');
  assert.equal(held.released, 1, 'Blur must abort the owned decoder before its promise settles.');
  assert.equal(
    p.doc.activeElement,
    focusBefore,
    'This case has no synthetic focusin cancellation.',
  );
  p.frame(0);
  assert.notEqual(p.state(), 'running');
  assert.notEqual(p.renders[0].level.id, target.runtimeId);
  assert.equal(p.$('journey-chooser')?.open ?? false, false);
  gate.resolve();
});

test('Versus inventory warning shares the bounded compact status row without changing action target sizing', async () => {
  const css = await readFile(new URL('../ui/journey.css', import.meta.url), 'utf8');
  assert.match(
    css,
    /#journey-chooser #coop-library-status,\s*#journey-chooser #race-library-status \{[^}]*display: grid;[^}]*min-width: 0;/s,
  );
  assert.match(
    css,
    /#journey-chooser #coop-library-status p,\s*#journey-chooser #race-library-status p \{[^}]*margin: 0;/s,
  );
  assert.match(
    css,
    /#journey-chooser #coop-library-status,\s*#journey-chooser #race-library-status \{[^}]*max-height: 5rem;[^}]*overflow: auto;/s,
  );
  assert.match(css, /grid-template-rows: auto auto auto minmax\(9rem, 1fr\) auto/);
  assert.match(css, /journey-footer > button \{[^}]*min-height: 44px;/s);
  // Structural CSS/DOM contract only; native short-landscape inspection remains separate.
});
