import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { openMissionLibrary, activateMissionCard } from './helpers/library-selection.mjs';
import { DEFAULT_THEME_PREFERENCES, THEME_PREFERENCES_KEY } from '../presentation/theme-system.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { selectedArcadeCollection } from '../presentation/industrial-arcade.mjs';

async function appearanceFixture() {
  const fixture = await editionProviderFixture();
  const catalog = structuredClone(fixture.catalog);
  catalog.format = 'revealline-edition-catalog.v2';
  catalog.brands[0].format = 'revealline-brand-pack.v2';
  catalog.brands[0].appearanceDefault = { familyId: 'vyshyvanka', revision: 'r1' };
  const source = structuredClone(fixture.source);
  source.id = 'porcelain-project';
  source.missions[0].id = 'porcelain-mission';
  source.missions[0].name = 'Porcelain mission';
  source.campaigns[0].id = 'porcelain-campaign';
  source.campaigns[0].name = 'Porcelain campaign';
  source.campaigns[0].missionIds = [source.missions[0].id];
  source.packs[0].id = 'porcelain-pack';
  source.packs[0].campaignIds = [source.campaigns[0].id];
  const campaign = {
    ...catalog.campaigns[0],
    id: source.campaigns[0].id,
    name: source.campaigns[0].name,
    sourcePath: 'game/content/sample/porcelain-project.json',
    appearanceDefault: { familyId: 'dnipro-porcelain', revision: 'r1' },
  };
  catalog.campaigns.push(campaign);
  catalog.editions[0].campaignIds.push(campaign.id);
  fixture.files.set(campaign.sourcePath, source);
  for (const path of ['game/editions/catalog.json', 'edition-catalog.json'])
    fixture.files.set(path, catalog);
  return fixture;
}

for (const personal of [null, 'tryzub']) {
  test(`actual edition campaign adoption updates appearance and SIM context${personal ? ' while preserving a global choice' : ' without saving a preference'}`, async (t) => {
    const fixture = await appearanceFixture();
    const preference = personal
      ? JSON.stringify({ ...DEFAULT_THEME_PREFERENCES, familyId: personal })
      : null;
    const storage = memoryStorage(preference ? { [THEME_PREFERENCES_KEY]: preference } : {});
    const page = await soloPage(t, {
      search: '?edition=sample-public',
      titleScreen: true,
      storage,
      journeyIndexedDB: managedIndexedDB().indexedDB,
      fetchResponse: fixture.fetcher,
    });
    assert.equal(
      page.doc.body.dataset.editionId,
      'sample-public',
      page.errors.map((error) => error.stack).join('\n') + page.$('overlay-copy').textContent,
    );
    const sheet = page.doc.head.querySelector('link[data-industrial-workshop]');
    assert.ok(sheet, JSON.stringify(page.doc.documentElement.dataset));
    sheet.emit('load');
    await settle(
      () => page.doc.documentElement.dataset.interfaceTheme === (personal ?? 'vyshyvanka'),
    );
    let destination;
    page.win.location.assign = (href) => {
      destination = new URL(href);
    };
    page.$('shell-home-fpv').onclick();
    assert.equal(destination.searchParams.get('appearanceFamily'), 'vyshyvanka');

    await openMissionLibrary(page, 'shell-play');
    const card = [...page.$('journey-cards').children].find((row) =>
      row.textContent.includes('Porcelain mission'),
    );
    assert.ok(card, 'The second admitted campaign is available through the real mission library.');
    const captures = [],
      setLevel = BoardPainter.prototype.setLevel;
    BoardPainter.prototype.setLevel = function (level, ...options) {
      captures.push({
        levelId: level.id,
        collection: selectedArcadeCollection(this.arcadeProvider())?.id,
        interfaceTheme: page.doc.documentElement.dataset.interfaceTheme,
      });
      return setLevel.call(this, level, ...options);
    };
    try {
      await activateMissionCard(card);
    } finally {
      BoardPainter.prototype.setLevel = setLevel;
    }
    await settle(() => {
      page.frame(0);
      return (
        page.doc.body.dataset.flightState === 'running' &&
        page.rendered.run.levelId === 'porcelain-mission'
      );
    });
    await settle(
      () => page.doc.documentElement.dataset.interfaceTheme === (personal ?? 'dnipro-porcelain'),
    );
    assert.deepEqual(
      captures.find((row) => row.levelId === 'porcelain-mission'),
      {
        levelId: 'porcelain-mission',
        collection: personal ?? 'dnipro-porcelain',
        interfaceTheme: personal ?? 'dnipro-porcelain',
      },
      'The painter and interface accept the same family at mission adoption.',
    );
    page.$('shell-home-fpv').onclick();
    assert.equal(destination.searchParams.get('appearanceFamily'), 'dnipro-porcelain');
    assert.equal(destination.searchParams.get('appearanceRevision'), 'r1');
    assert.equal(
      destination.searchParams.get('edition'),
      null,
      'SIM receives cosmetic context, not edition admission.',
    );
    assert.equal(storage.getItem(THEME_PREFERENCES_KEY), preference);
    assert.deepEqual(page.errors, []);
  });
}

for (const outcome of ['cancel', 'failure']) {
  test(`a ${outcome === 'cancel' ? 'cancelled' : 'failed'} campaign theme preload retains the active flight and SIM context`, async (t) => {
    const fixture = await appearanceFixture();
    const page = await soloPage(t, {
      search: '?edition=sample-public',
      titleScreen: true,
      journeyIndexedDB: managedIndexedDB().indexedDB,
      fetchResponse: fixture.fetcher,
    });
    page.doc.head.querySelector('link[data-industrial-workshop]').emit('load');
    await settle(() => page.doc.documentElement.dataset.interfaceTheme === 'vyshyvanka');
    page.frame(0);
    const original = page.rendered.run;
    let accept,
      reject,
      loading = false;
    const gate = new Promise((resolve, fail) => {
      accept = resolve;
      reject = fail;
    });
    page.doc.fonts = {
      load: () => {
        loading = true;
        return gate;
      },
    };
    await openMissionLibrary(page, 'shell-play');
    const card = [...page.$('journey-cards').children].find((row) =>
      row.textContent.includes('Porcelain mission'),
    );
    const pending = activateMissionCard(card);
    await settle(() => loading);
    assert.equal(page.doc.documentElement.dataset.interfaceTheme, 'vyshyvanka');
    page.frame(0);
    assert.equal(page.rendered.run, original, 'Font preparation does not adopt the replacement.');
    if (outcome === 'cancel') {
      page.$('flight-preparation-cancel').click();
      accept([]);
    } else reject(new Error('Fixture font decode failed.'));
    await pending;
    page.frame(0);
    assert.equal(page.rendered.run, original);
    assert.equal(page.doc.documentElement.dataset.interfaceTheme, 'vyshyvanka');
    let destination;
    page.win.location.assign = (href) => {
      destination = new URL(href);
    };
    page.$('shell-home-fpv').onclick();
    assert.equal(destination.searchParams.get('appearanceFamily'), 'vyshyvanka');
    assert.equal(page.storage.getItem(THEME_PREFERENCES_KEY), null);
  });
}
