import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightPictures } from '../ui/flight-pictures.mjs';
import {
  createPictureIdentityCatalog,
  createBackupPictureIdentityResolver,
} from '../ui/picture-identity.mjs';
import { validateMediaLibrary } from '../media-library.mjs';
import { mediaFixture, libraryRecord, deferred } from './helpers/media-fixtures.mjs';

function setup() {
  const f = mediaFixture(true),
    request = f.request('gentle');
  const library = validateMediaLibrary(libraryRecord(f.identity), {
    identityCatalog: f.identityCatalog,
  });
  const options = {
    context: { runId: 'actual-attempt', ...request },
    level: f.catalog.entries[1].campaign.levels[0],
    themeIds: ['fpv', 'ukraine'],
    identityCatalog: f.identityCatalog,
    readMedia: async () => ({ store: {}, metadata: { document: { library } } }),
  };
  return { f, options };
}
test('one attempt freezes managed and explicit legacy worlds; art failure keeps its exact original choice', async () => {
  const { options } = setup();
  let fail = true,
    calls = 0;
  const owner = createFlightPictures({
    ...options,
    acquire: async ({ pin }) => {
      calls++;
      if (fail) throw new Error('Missing original');
      return { pin, image: {}, release() {} };
    },
  });
  await assert.rejects(owner.ensure(), /Missing original/);
  const pins = owner.pins();
  assert.equal(pins.choices[0].assetId, 'picture-a');
  assert.equal(pins.choices[1].kind, 'legacy');
  assert.equal(owner.current(), null);
  fail = false;
  await owner.ensure();
  const image = owner.current();
  assert.equal(owner.pins(), pins);
  assert.equal(calls, 2);
  await owner.ensure('ukraine');
  assert.equal(owner.current(), null);
  assert.equal(owner.pins(), pins);
  assert.ok(image);
  owner.dispose();
});
test('cancelled pending display releases late candidate and never replaces the owned picture', async () => {
  const { options } = setup(),
    gate = deferred();
  let releases = 0;
  const owner = createFlightPictures({
    ...options,
    acquire: async () => {
      await gate.promise;
      return {
        image: {},
        release() {
          releases++;
        },
      };
    },
  });
  const pending = owner.ensure();
  await new Promise((r) => setImmediate(r));
  owner.cancel();
  gate.resolve();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(owner.current(), null);
  assert.equal(releases, 1);
  owner.dispose();
});
test('old sessions and training never read or mint managed choices', async () => {
  const { options } = setup();
  const owner = createFlightPictures({
    ...options,
    legacy: true,
    readMedia: () => assert.fail('Legacy path must not read media'),
  });
  assert.equal(owner.ready('fpv'), true);
  await owner.ensure('ukraine');
  assert.equal(owner.pins(), undefined);
  assert.equal(owner.current(), null);
  owner.dispose();
});
test('explicit original-art fallback creates validated legacy choices without pretending storage succeeded', async () => {
  const { options } = setup();
  const owner = createFlightPictures({
    ...options,
    explicitLegacy: true,
    readMedia: () => assert.fail('Explicit authored artwork does not read failed storage'),
  });
  await owner.ensure();
  assert.ok(owner.pins().choices.every((x) => x.kind === 'legacy'));
  assert.equal(owner.current(), null);
  owner.dispose();
});
test('picture owner factory strips art, preserves exact Standard/Gentle world authority, and rejects invented themes', () => {
  const { f } = setup();
  const entries = f.catalog.entries;
  const before = JSON.stringify(entries),
    catalog = createPictureIdentityCatalog({ entries });
  assert.deepEqual(catalog.resolve(f.request('standard')), f.identity);
  assert.deepEqual(catalog.resolve(f.request('gentle')), f.identity);
  assert.equal(catalog.resolve({ ...f.request(), themeId: 'unrelated' }), null);
  assert.equal(JSON.stringify(entries), before);
});
test('backup factory never borrows a similarly named unrelated installed campaign', () => {
  const { f } = setup();
  const resolve = createBackupPictureIdentityResolver({ baseEntries: [f.catalog.entries[0]] });
  const original = structuredClone(f.campaign);
  original.revision = 'foreign';
  const catalog = resolve({ originals: [original], packs: { packs: [] }, campaigns: [original] });
  assert.equal(catalog.resolve(f.request()), null);
  const valid = resolve({
    originals: [f.catalog.entries[0].baseCampaign],
    packs: { packs: [] },
    campaigns: [f.catalog.entries[1].campaign],
  });
  assert.deepEqual(valid.resolve(f.request('gentle')), f.identity);
});

test('returning to ready A cancels pending B and releases its late image', async () => {
  const { f, options } = setup(),
    source = libraryRecord(f.identity),
    gate = deferred();
  const identity = { ...f.identity, themeId: 'ukraine' };
  source.presentations.push({ ...source.presentations[0], id: 'ukraine-picture', identity });
  source.assignments.push({ identity, presentationId: 'ukraine-picture', revision: 1 });
  const library = validateMediaLibrary(source, { identityCatalog: f.identityCatalog });
  let releases = 0;
  const owner = createFlightPictures({
    ...options,
    readMedia: async () => ({ store: {}, metadata: { document: { library } } }),
    acquire: async ({ pin }) => {
      if (pin.identity.themeId === 'ukraine') await gate.promise;
      return {
        image: { theme: pin.identity.themeId },
        release() {
          releases++;
        },
      };
    },
  });
  await owner.ensure('fpv');
  const a = owner.current();
  const pending = owner.ensure('ukraine');
  await new Promise((r) => setImmediate(r));
  await owner.ensure('fpv');
  gate.resolve();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(owner.current(), a);
  assert.equal(releases, 1);
  owner.dispose();
  assert.equal(releases, 2);
});
