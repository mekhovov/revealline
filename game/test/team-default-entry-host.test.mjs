import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { page } from './helpers/coop-host.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';
import { createTeamSpatialOriginalCandidates } from '../content-design/team-spatial-originals.mjs';
import { teamPressureFixtures } from './helpers/team-pressure-fixtures.mjs';
import { createModeReturn } from '../mode-return.mjs';

const base = 'http://localhost/game/couch/relay-rescue.html';
const source = createTeamSpatialOriginalCandidates();
const originals = new Map(
  await Promise.all(
    source.assets.map(async (asset) => [
      asset.path,
      await readFile(new URL('../' + asset.path, import.meta.url)),
    ]),
  ),
);
const routes = await teamPressureFixtures();
const enter = (f, id) => {
  f.$(id).focus();
  f.tap('Enter');
};

async function fresh(t, href = base, extra = {}) {
  return page(t, {
    href,
    nativeFocus: true,
    nativeVisibility: true,
    retainInitialDifficulty: true,
    ...extra,
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
      install('fetch', {
        value: async (url) => {
          const asset = source.assets.find((row) => new URL(url).pathname.endsWith('/' + row.path));
          assert(asset, 'Only registered original artwork is requested');
          return new Response(originals.get(asset.path));
        },
      });
    },
  });
}

test('queryless Team offers all twelve original missions across five campaigns and starts directly', async (t) => {
  const f = await fresh(t);
  assert.equal(source.missions.length, 12);
  assert.equal(source.campaigns.length, 5);
  assert.equal(f.$('coop-level').value, source.missions[0].id);
  assert.match(f.$('coop-boot').textContent, /Team Journey.*12 missions.*original artwork/);
  assert.match(
    f.$('coop-boot').textContent,
    /Pictures need a connection; core offline preparation does not save them/,
  );
  assert.doesNotMatch(f.$('coop-boot').textContent, /test|candidate|validation pending/);
  assert.doesNotMatch(f.$('coop-pack-status').textContent, /test|candidate|validated/);
  assert.equal(f.$('coop-catalogue').textContent, 'Legacy arenas');
  assert.equal(f.$('coop-catalogue').getAttribute('href'), 'relay-rescue.html?journey=legacy');
  assert.equal(f.$('coop-solo').getAttribute('href'), '../');
  assert.equal(f.$('coop-versus').getAttribute('href'), './');
  enter(f, 'coop-discovery-open');
  await waitFor(() => f.$('journey-chooser')?.open);
  const cards = [...f.$('journey-cards').querySelectorAll('.journey-card')];
  assert.equal(cards.length, 14, 'Twelve new missions plus two retained legacy arenas');
  const missionCards = cards.filter((card) =>
    card.querySelector('.journey-card-tags').textContent.includes('Journey'),
  );
  assert.equal(missionCards.length, 12);
  for (const card of missionCards) {
    assert.match(
      card.querySelector('.journey-card-challenge').textContent,
      /Band \d+\/12 · Standard/,
    );
    assert(card.querySelector('.journey-card-route').textContent);
    assert.doesNotMatch(card.textContent, /candidate|test;|validation pending/);
  }
  for (const mission of source.missions)
    assert(
      cards.some((card) => card.querySelector('strong').textContent === mission.name),
      mission.id,
    );
  assert.equal(
    f.$('journey-campaign').querySelectorAll('option').length,
    7,
    'All + five campaigns + legacy pack',
  );
  enter(f, 'journey-back');
  enter(f, 'coop-start');
  assert.equal(f.$('coop-menu').hidden, true);
  f.tick(2);
  const first = source.missions[0];
  assert.equal(
    f.drawImages.at(-1).sha256,
    source.assets.find((asset) => asset.id === first.presentation.backgroundAssetId).sha256,
  );
  const route = routes.find((row) => row.missionId === first.id && row.difficulty === 'standard');
  const keys = [
    { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
    { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
  ];
  let previous = [null, null];
  for (const segment of route.log) {
    for (const [seat, direction] of [segment.a, segment.b].entries())
      if (direction && direction !== previous[seat]) f.tap(keys[seat][direction]);
    previous = [segment.a, segment.b];
    for (let n = 0; n < segment.ticks && f.$('coop-overlay').hidden; n++) f.tick();
    if (!f.$('coop-overlay').hidden) break;
  }
  assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
  enter(f, 'coop-next');
  await waitFor(() => f.$('coop-overlay').hidden);
  assert.equal(f.$('coop-level').value, source.missions[1].id);
  assert.equal(f.$('coop-menu').hidden, true, 'Next does not require another Start');
  assert.deepEqual(f.visits, []);
});

test('explicit legacy retains both arenas and provides a deliberate New journey return', async (t) => {
  const f = await page(t, { nativeFocus: true, nativeVisibility: true });
  assert.equal(f.$('coop-level').value, 'first-connection');
  assert.equal(f.$('coop-level').querySelectorAll('option').length, 2);
  assert.equal(f.$('coop-solo').getAttribute('href'), '../?journey=legacy');
  assert.equal(f.$('coop-versus').getAttribute('href'), './?journey=legacy');
  assert.equal(f.$('coop-catalogue').textContent, 'New journey');
  enter(f, 'coop-catalogue');
  assert.deepEqual(f.visits, [base]);
});

test('explicit spatial review entry retains its original review labels and exact first artwork', async (t) => {
  const f = await fresh(t, base + '?journey=team-spatial-originals-1');
  assert.match(
    f.$('coop-boot').textContent,
    /changing-return pressure edition.*human validation pending/,
  );
  assert.match(f.$('coop-pack-status').textContent, /Original-art candidate.*not human validated/);
  enter(f, 'coop-discovery-open');
  await waitFor(() => f.$('journey-chooser')?.open);
  const caption = f.$('journey-cards').querySelector('.journey-card-edition');
  assert.match(caption.textContent, /Original-art test; visual qualification pending/);
  enter(f, 'journey-back');
  enter(f, 'coop-start');
  f.tick(2);
  const asset = source.assets.find(
    (item) => item.id === source.missions[0].presentation.backgroundAssetId,
  );
  assert.equal(f.drawImages.at(-1).sha256, asset.sha256);
});

test('catalogue switching keeps origin but clears legacy return tokens and requires unfinished-attempt confirmation', async (t) => {
  const f = await fresh(t, base + '?return=solo&journey-return=whole-spatial-v5');
  assert.equal(f.$('coop-solo').getAttribute('href'), '../?journey=whole-spatial-v5');
  assert.equal(
    f.$('coop-catalogue').getAttribute('href'),
    'relay-rescue.html?journey=legacy&return=solo',
  );
  enter(f, 'coop-start');
  f.tick(2);
  enter(f, 'coop-pause');
  assert.equal(f.$('coop-overlay').contains(f.$('coop-catalogue')), true);
  enter(f, 'coop-catalogue');
  assert.equal(f.$('coop-discard-dialog').open, true);
  assert.deepEqual(f.visits, []);
  enter(f, 'coop-discard-stay');
  assert.equal(f.$('coop-overlay-kicker').textContent, 'PAUSED');
  assert.equal(f.doc.activeElement, f.$('coop-catalogue'));
  enter(f, 'coop-catalogue');
  enter(f, 'coop-discard-confirm');
  assert.deepEqual(f.visits, [base + '?journey=legacy&return=solo']);
});

for (const query of [
  '?journey=unknown',
  '?journey=team-spatial-originals-1&journey=legacy',
  '?practice=1',
  '?pack=created',
  '?return=solo&return-token=invalid',
])
  test(`explicit historical or ambiguous intent remains legacy: ${query}`, async (t) => {
    const f = await page(t, { href: base + query });
    assert.equal(f.$('coop-level').value, 'first-connection');
    assert.equal(f.$('coop-catalogue').textContent, 'New journey');
    assert.equal(f.$('coop-home').getAttribute('href'), '../?journey=legacy');
    assert.equal(f.$('coop-solo').getAttribute('href'), '../?journey=legacy');
    assert.equal(f.$('coop-versus').getAttribute('href'), './?journey=legacy');
    assert.equal(
      f.$('coop-race').getAttribute('href'),
      query.includes('return=solo') ? '../?journey=legacy' : './?journey=legacy',
    );
  });

test('legacy Team fallback keeps a valid Solo return token and does not consume its record', async (t) => {
  const entries = new Map();
  const returnStorage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
  const api = createModeReturn({
    storage: returnStorage,
    baseURL: 'http://localhost/game/',
    authority: { channel: 'dev', version: 'dev', sourceRevision: null },
  });
  const ticket = api.prepare({
    campaignKey: 'first-signal/2/88639f3aab7b6cc1',
    levelId: 'signal-01',
    themeId: 'fpv',
  });
  const before = [...entries];
  const f = await page(t, { href: ticket.href, returnStorage, nativeFocus: true });
  assert.equal(f.$('coop-level').value, 'first-connection');
  assert.equal(f.$('coop-home').getAttribute('href'), '../?journey=legacy');
  assert.equal(f.$('coop-versus').getAttribute('href'), './?journey=legacy');
  assert.equal(f.$('coop-solo').getAttribute('href'), `../?mode-return=${ticket.token}`);
  assert.equal(f.$('coop-race').getAttribute('href'), `../?mode-return=${ticket.token}`);
  enter(f, 'coop-solo');
  assert.deepEqual(f.visits, [`http://localhost/game/?mode-return=${ticket.token}`]);
  assert.deepEqual([...entries], before);
});

test('New journey return from explicit legacy clears stale authored and save-return hints', async (t) => {
  const f = await page(t, {
    href:
      base +
      '?journey=legacy&return=versus&journey-return=whole-spatial-v5&return-token=old&mode-return=old',
  });
  assert.equal(f.$('coop-catalogue').getAttribute('href'), 'relay-rescue.html?return=versus');
});

test('modeled controller reaches the same catalogue switch inside Pause and restores it on Stay', async (t) => {
  const f = await page(t, { nativeFocus: true, nativeVisibility: true });
  f.$('coop-start').click();
  f.tick(2);
  f.$('coop-pause').click();
  const pad = {
    index: 0,
    id: 'Team catalogue controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  f.pads.push(pad);
  const button = (index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    f.tick(2);
    pad.buttons[index] = { pressed: false, value: 0 };
    f.tick(2);
  };
  f.tick(2);
  button(0); // Adopt, then release before deliberate navigation.
  for (let n = 0; n < 40 && f.doc.activeElement.id !== 'coop-catalogue'; n++) button(13);
  assert.equal(f.doc.activeElement.id, 'coop-catalogue');
  button(0);
  assert.equal(f.$('coop-discard-dialog').open, true);
  button(1);
  assert.equal(f.$('coop-discard-dialog').open, false);
  assert.equal(f.doc.activeElement.id, 'coop-catalogue');
  assert.equal(f.$('coop-overlay-kicker').textContent, 'PAUSED');
  assert.deepEqual(f.visits, []);
  button(0);
  button(13);
  assert.equal(f.doc.activeElement.id, 'coop-discard-confirm');
  button(0);
  assert.deepEqual(f.visits, [base]);
});
