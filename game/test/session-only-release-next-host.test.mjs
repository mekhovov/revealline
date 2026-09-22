import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { pngBytes, deferred } from './helpers/media-fixtures.mjs';
import { encodeSpritePNG } from '../../scripts/produce-field-kit-sprites.mjs';
import { CURRENT_PICTURES } from '../presentation/current-pictures.mjs';
import { FORMATS, TOKEN_DEFAULTS } from '../presentation/model.mjs';
import { COMPILED_PRESENTATION_FORMAT } from '../presentation/host.mjs';
import { importMediaBundle } from '../media-bundle.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';

// Modeled host journey. Injected one-pixel art is not production visual evidence.
const campaign = JSON.parse(await readFile(new URL('../content/campaign.json', import.meta.url)));
const writerKey = 'revealline.library.dev.v1.writer';
class Locks {
  held = new Set();
  async request(key, options, callback) {
    const work = callback ?? options;
    if (this.held.has(key)) return work(null);
    this.held.add(key);
    try {
      return await work({ name: key });
    } finally {
      this.held.delete(key);
    }
  }
}
class Picture {
  constructor() {
    this.width = this.height = this.naturalWidth = this.naturalHeight = 1;
  }
  set src(value) {
    this.url = value;
    if (value) queueMicrotask(() => this.onload?.());
  }
  decode() {
    return Promise.resolve();
  }
  removeAttribute() {
    this.url = '';
  }
}
test('session-only Next prepares a new exact original without persistent writes', async (t) => {
  const fetchBlob = globalThis.fetch;
  const bytes = pngBytes();
  const sha256 = await hashPresentationBytes(bytes);
  const asset = {
    format: FORMATS.asset,
    id: 'test.session-next',
    revision: 1,
    kind: 'image',
    description: 'One-pixel diagnostic fixture, not production artwork.',
    provenance: {
      creator: 'Test',
      source: 'Owned fixture',
      license: 'Test only',
      prompt: '',
      parent: null,
    },
    file: { sha256, bytes: bytes.length, mime: 'image/png', width: 1, height: 1 },
    recipe: null,
    geometry: {
      frame: { x: 0, y: 0, width: 1, height: 1 },
      pivot: { x: 0.5, y: 0.5 },
      occupiedBounds: null,
      rotorAnchors: [],
      nineSlice: null,
    },
    quality: { stage: 'produced', evidence: [] },
  };
  const nextBytes = encodeSpritePNG({
    width: 1,
    height: 1,
    rgba: new Uint8Array([40, 80, 160, 255]),
  });
  const nextHash = await hashPresentationBytes(nextBytes);
  assert.notEqual(nextHash, sha256);
  const nextAsset = {
    ...asset,
    id: 'test.session-next-second',
    file: { ...asset.file, sha256: nextHash, bytes: nextBytes.length },
  };
  const slots = campaign.levels
    .slice(0, 2)
    .map((level) =>
      CURRENT_PICTURES.find((row) => row.owner.levelId === level.id && row.owner.themeId === 'fpv'),
    );
  assert.ok(slots.every(Boolean));
  const manifest = {
    format: COMPILED_PRESENTATION_FORMAT,
    source: { id: 'test.session-next', revision: 1 },
    resolved: {
      theme: { id: 'fpv-field-kit', revision: 1, name: 'Session Next fixture' },
      collection: null,
      tokens: TOKEN_DEFAULTS,
      bindings: Object.fromEntries(
        slots.map((slot, i) => [slot.id, { id: i ? nextAsset.id : asset.id, revision: 1 }]),
      ),
      assets: Object.fromEntries(slots.map((slot, i) => [slot.id, i ? nextAsset : asset])),
    },
    urls: { [sha256]: `./assets/${sha256}.png`, [nextHash]: `./assets/${nextHash}.png` },
  };
  const memory = managedIndexedDB(),
    locks = new Locks();
  let reads = 0;
  const nextDownload = deferred();
  const page = await soloPage(t, {
    campaign,
    search: '?journey=1',
    titleScreen: true,
    soundtrackIndexedDB: memory.indexedDB,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    lockManager: locks,
    pictures: { Image: Picture },
    fetchResponse: async (url) => {
      if (!String(url).includes('/presentation/compiled/')) return undefined;
      if (String(url).endsWith('/runtime.json')) return new Response(JSON.stringify(manifest));
      assert.ok([sha256, nextHash].some((hash) => String(url).endsWith(`/assets/${hash}.png`)));
      reads++;
      if (String(url).endsWith(`/assets/${nextHash}.png`)) await nextDownload.promise;
      return new Response(String(url).endsWith(`/assets/${nextHash}.png`) ? nextBytes : bytes);
    },
  });
  page.$('shell-featured').click();
  await settle(() => {
    page.frame(0);
    return page.doc.body.dataset.flightState === 'running';
  });
  assert.equal(page.rendered.run.levelId, campaign.levels[0].id);
  page.win.emit('pagehide', { persisted: true });
  await settle(() => !locks.held.has(writerKey));
  page.win.emit('pageshow', { persisted: true });
  assert.match(page.$('save-warning').textContent, /session-only mode/);
  page.frame(0);
  page.$('start-button').click();
  await settle(() => {
    page.frame(0);
    return page.doc.body.dataset.flightState === 'running';
  });
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let i = 0; i < 1200 && page.rendered.run.status !== 'won'; i++) page.frame();
  assert.equal(page.rendered.run.status, 'won');
  assert.equal(page.$('next-button').hidden, false);
  const won = page.rendered.run,
    writes = memory.allPuts.length,
    priorReads = reads;
  page.$('next-button').click();
  await settle(() => reads === priorReads + 1);
  assert.equal(page.rendered.run, won, 'Won result stays usable while next artwork downloads');
  nextDownload.resolve();
  await settle(() => {
    page.frame(0);
    return page.rendered.run !== won && page.doc.body.dataset.flightState === 'running';
  });
  assert.equal(page.rendered.run.levelId, campaign.levels[1].id);
  assert.equal(memory.allPuts.length, writes, 'No unauthorized media writes');
  assert.equal(reads - priorReads, 1, 'Only the exact new original is downloaded');
  assert.equal(locks.held.has(writerKey), false, 'Writer authority is not reacquired');
  page.key('Escape');
  page.key('Escape', false);
  page.frame(0);
  page.$('library-button').click();
  page.doc.querySelector('[data-library-panel="saves"]').click();
  assert.equal(page.$('library-saves').hidden, false);
  assert.equal(page.$('session-originals').hidden, false);
  assert.match(
    page.$('session-originals-note').textContent,
    /1 picture original.*only in this tab/,
  );
  page.$('prepare-session-originals').click();
  await settle(() => !page.$('download-session-originals').hidden);
  assert.match(page.$('download-session-originals').href, /^blob:/);
  assert.equal(
    page.$('download-session-originals').download,
    'RevealLine-session-originals.rlmedia',
  );
  assert.match(page.$('save-status').textContent, /originals verified/);
  const exported = await (await fetchBlob(page.$('download-session-originals').href)).blob();
  const imported = await importMediaBundle(exported, {
    decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
  });
  assert.equal(imported.assets.length, 1);
  assert.equal(imported.assets[0].sha256, nextHash);
  assert.deepEqual(
    new Uint8Array(await imported.assets[0].blob.arrayBuffer()),
    new Uint8Array(nextBytes),
  );
  assert.deepEqual(
    imported.document.library.assignments,
    [],
    'Restoring originals must not replace manual assignments',
  );
  assert.equal(imported.document.library.presentations[0].identity.levelId, campaign.levels[1].id);
  page.doc.getElementById('library-dialog').close();
  assert.equal(page.$('download-session-originals').hidden, true);
  let protectedLeave = false;
  page.win.emit('beforeunload', {
    preventDefault() {
      protectedLeave = true;
    },
  });
  assert(protectedLeave, 'Leaving must acknowledge session-only originals');
  assert.equal(memory.allPuts.length, writes);
  assert.deepEqual(page.errors, []);
});
