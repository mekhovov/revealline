import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { page } from './helpers/coop-host.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';
import { createTeamSpatialOriginalCandidates } from '../content-design/team-spatial-originals.mjs';
import { createRemoteTeamLibrarySources } from '../mission-library/remote-team.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { missionLibraryHref } from '../mission-library/handoff.mjs';
import { createModeReturn } from '../mode-return.mjs';
import { JOURNEY_PREFERENCES_KEY, JOURNEY_PREFERENCES_VERSION } from '../journey/preferences.mjs';

const root = 'http://localhost/releases/v-test/game/';
const source = createTeamSpatialOriginalCandidates();
const library = createMissionLibrary(createRemoteTeamLibrarySources({ launch: () => true }));
const originals = new Map(
  await Promise.all(
    source.assets.map(async (asset) => [
      asset.path,
      await readFile(new URL('../' + asset.path, import.meta.url)),
    ]),
  ),
);
const metadata = new Map(
  await Promise.all(
    [
      'content/mission-library-index.json',
      'content-design/themes.json',
      'content/campaign.json',
      'content/classes.json',
    ].map(async (path) => [path, await readFile(new URL('../' + path, import.meta.url))]),
  ),
);
const target = (collection) =>
  library.missions.filter((row) => row.collection === collection).at(-1);
function memory() {
  const map = new Map();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
}
function href(mode, journey, collection, returnToken) {
  return missionLibraryHref({
    baseURL: mode === 'solo' ? root : root + 'couch/',
    currentMode: mode,
    mode: 'team',
    journey: collection === 'Journey' ? 'team-spatial-originals-1' : 'legacy',
    sourceJourney: journey,
    missionId: target(collection).id,
    returnToken,
  });
}
async function fixture(t, href, returnStorage = memory()) {
  const settings = memory();
  settings.setItem(
    JOURNEY_PREFERENCES_KEY,
    JSON.stringify({ format: JOURNEY_PREFERENCES_VERSION, difficulty: 'expert' }),
  );
  return page(t, {
    href,
    returnStorage,
    nativeFocus: true,
    nativeVisibility: true,
    retainInitialDifficulty: true,
    beforeImport({ install }) {
      const BaseImage = globalThis.Image;
      class OriginalImage extends BaseImage {
        async decode() {
          if (!this.source.startsWith('data:image/png;base64,')) return super.decode();
          const bytes = Buffer.from(this.source.split(',')[1], 'base64');
          this.width = this.naturalWidth = bytes.readUInt32BE(16);
          this.height = this.naturalHeight = bytes.readUInt32BE(20);
          this.sha256 = createHash('sha256').update(bytes).digest('hex');
        }
      }
      install('Image', { value: OriginalImage });
      install('crypto', { value: webcrypto });
      install('localStorage', { value: settings });
      install('fetch', {
        value: async (url) => {
          const path = new URL(url).pathname.split('/game/')[1];
          if (metadata.has(path)) return new Response(metadata.get(path));
          const asset = source.assets.find((row) => new URL(url).pathname.endsWith('/' + row.path));
          assert(asset, 'Only the selected Team original may be fetched');
          return new Response(originals.get(asset.path));
        },
      });
    },
  });
}
for (const [mode, journey, collection] of [
  ['solo', 'legacy', 'Journey'],
  ['solo', 'whole-spatial-v5', 'Classic'],
  ['solo', 'whole-spatial-v2', 'Classic'],
  ['versus', 'legacy', 'Journey'],
  ['versus', 'whole-spatial-v5', 'Classic'],
  ['versus', 'whole-spatial-v2', 'Journey'],
])
  test(`Team ${collection} keeps exact selected owner and ${mode}/${journey} return edition`, async (t) => {
    const f = await fixture(t, href(mode, journey, collection));
    assert.equal(f.$('coop-level').value, target(collection).runtimeId.split('/').at(-1));
    if (collection === 'Journey') assert.equal(f.$('coop-difficulty').value, 'expert');
    assert.equal(f.$('coop-home').getAttribute('href'), `../?journey=${journey}`);
    assert.equal(f.$('coop-versus').getAttribute('href'), `./?journey=${journey}`);
    assert.equal(
      f.$('coop-race').getAttribute('href'),
      `${mode === 'solo' ? '../' : './'}?journey=${journey}`,
    );
    assert.equal(f.$('coop-race').textContent, mode === 'solo' ? 'Back to Solo' : 'Race mode ↗');
    assert.equal(
      new URL(f.$('coop-race').getAttribute('href'), globalThis.location.href).pathname,
      '/releases/v-test/game/' + (mode === 'versus' ? 'couch/' : ''),
    );
  });

function ticket(storage) {
  return createModeReturn({
    storage,
    baseURL: root,
    authority: { channel: 'dev', version: '0.84.0', sourceRevision: null },
    nonce: () => '1'.repeat(32),
  }).prepare({
    campaignKey: 'first-signal/2/88639f3aab7b6cc1',
    levelId: 'signal-02',
    themeId: 'ukraine',
  });
}
test('checked Legacy Solo return ticket takes precedence without being consumed by Team', async (t) => {
  const storage = memory(),
    saved = ticket(storage),
    before = [...storage.map];
  const f = await fixture(t, href('solo', 'legacy', 'Journey', saved.token), storage);
  assert.equal(f.$('coop-race').getAttribute('href'), `../?mode-return=${saved.token}`);
  assert.equal(f.$('coop-solo').getAttribute('href'), `../?mode-return=${saved.token}`);
  assert.equal(f.$('coop-home').getAttribute('href'), '../?journey=legacy');
  assert.equal(f.$('coop-level').value, target('Journey').runtimeId.split('/').at(-1));
  assert.deepEqual([...storage.map], before);
});

for (const invalid of ['arbitrary', 'duplicate', 'wrong-token-mode', 'token-on-new-edition'])
  test(`invalid ${invalid} source hint cannot redirect or bypass checked library-return parsing`, async (t) => {
    const storage = memory(),
      saved = ticket(storage),
      before = [...storage.map];
    const url = new URL(href('solo', 'legacy', 'Classic', saved.token));
    if (invalid === 'arbitrary') url.searchParams.set('journey-return', 'https://outside.invalid/');
    if (invalid === 'duplicate') url.searchParams.append('journey-return', 'legacy');
    if (invalid === 'wrong-token-mode') url.searchParams.append('return-token-v2', saved.token);
    if (invalid === 'token-on-new-edition')
      url.searchParams.set('journey-return', 'whole-spatial-v5');
    const f = await fixture(t, url.href, storage);
    assert.equal(f.$('coop-level').value, target('Classic').runtimeId);
    assert.equal(f.$('coop-race').getAttribute('href'), '../?journey=legacy');
    assert.deepEqual([...storage.map], before);
  });

test('older exact library links without source hints keep the existing checked-token fallback', async (t) => {
  const storage = memory(),
    saved = ticket(storage);
  const url = new URL(href('solo', 'legacy', 'Classic', saved.token));
  url.searchParams.delete('journey-return');
  const f = await fixture(t, url.href, storage);
  assert.equal(f.$('coop-race').getAttribute('href'), `../?mode-return=${saved.token}`);
  assert.equal(f.$('coop-level').value, target('Classic').runtimeId);
});

for (const route of ['legacy', 'team-spatial-originals-1', 'team-greybox'])
  test(`outgoing Team ${route} mission handoff preserves its exact finite source route`, async (t) => {
    const f = await fixture(t, root + `couch/relay-rescue.html?journey=${route}`);
    const opener = f.$('coop-discovery-open'),
      handler = opener.onclick;
    let opening;
    opener.onclick = (...args) => (opening = handler.apply(opener, args));
    try {
      opener.focus();
      f.tap('Enter');
    } finally {
      opener.onclick = handler;
    }
    assert(opening instanceof Promise, 'Keyboard activation owns catalogue preparation.');
    await opening;
    assert.equal(f.$('journey-chooser').open, true);
    const mode = f.$('journey-mode'),
      listeners = mode.listeners.get('change'),
      pending = [];
    mode.listeners.set(
      'change',
      new Set(
        [...listeners].map((listener) => (event) => {
          const result = listener.call(mode, event);
          if (result instanceof Promise) pending.push(result);
          return result;
        }),
      ),
    );
    try {
      mode.focus();
      mode.value = 'solo';
      mode.emit('change');
    } finally {
      mode.listeners.set('change', listeners);
    }
    assert.equal(pending.length, 1, 'Mode selection owns one remote metadata operation.');
    await pending[0];
    assert.equal(f.$('journey-cards').children.length, 201);
    const selected = f.$('journey-cards').children[8];
    selected.focus();
    f.tap('Enter');
    await waitFor(() => f.visits.length === 1);
    const destination = new URL(f.visits[0]);
    assert.equal(destination.pathname, '/releases/v-test/game/');
    assert.equal(destination.searchParams.get('journey'), 'whole-spatial-v5');
    assert.equal(destination.searchParams.get('library-mission'), selected.dataset.missionId);
    assert.equal(destination.searchParams.get('return'), 'team');
    assert.equal(destination.searchParams.get('journey-return'), route);
    assert.equal(destination.searchParams.size, 4);
  });
