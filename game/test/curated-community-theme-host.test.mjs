import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { openMissionLibrary, activateMissionCard } from './helpers/library-selection.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { duplicateStudioSnapshot, reviseStudioTheme } from '../presentation/studio-session.mjs';
import { createThemeCandidate } from '../presentation/theme-preview.mjs';
import {
  DEFAULT_THEME_PREFERENCES,
  THEME_PREFERENCES_KEY,
  loadAcceptedAppearance,
} from '../presentation/theme-system.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { selectedArcadeCollection } from '../presentation/industrial-arcade.mjs';
import { installThemeHost } from '../presentation/theme-host.mjs';
import {
  resolveEditionAppearanceDefault,
  resolveEditionAppearanceThemes,
} from '../editions/model.mjs';
import { Document } from './helpers/couch-dom.mjs';

const candidate = (id, familyId, panel) =>
  createThemeCandidate(
    reviseStudioTheme(duplicateStudioSnapshot(createDefaultThemeBundle(), { id, name: id }), {
      tokens: { panel },
    }),
    { familyId },
  );
const first = candidate('community-host-first', 'vyshyvanka', '#282428');
const second = candidate('community-host-second', 'dnipro-porcelain', '#253144');
const pin = (value) => ({ familyId: value.family.id, revision: value.family.revision });

async function fixtureWithCustomCampaigns() {
  const fixture = await editionProviderFixture();
  const catalog = structuredClone(fixture.catalog);
  catalog.format = 'revealline-edition-catalog.v3';
  catalog.appearanceThemes = [first, second];
  catalog.brands[0].format = 'revealline-brand-pack.v2';
  catalog.brands[0].appearanceDefault = pin(first);
  const source = structuredClone(fixture.source);
  source.id = 'custom-theme-project';
  source.missions[0].id = 'custom-theme-mission';
  source.missions[0].name = 'Custom theme mission';
  source.campaigns[0].id = 'custom-theme-campaign';
  source.campaigns[0].name = 'Custom theme campaign';
  source.campaigns[0].missionIds = [source.missions[0].id];
  source.packs[0].id = 'custom-theme-pack';
  source.packs[0].campaignIds = [source.campaigns[0].id];
  const campaign = {
    ...catalog.campaigns[0],
    id: source.campaigns[0].id,
    name: source.campaigns[0].name,
    sourcePath: 'game/content/sample/custom-theme-project.json',
    appearanceDefault: pin(second),
  };
  catalog.campaigns.push(campaign);
  catalog.editions[0].campaignIds.push(campaign.id);
  fixture.files.set(campaign.sourcePath, source);
  for (const path of ['game/editions/catalog.json', 'edition-catalog.json'])
    fixture.files.set(path, catalog);
  return fixture;
}

async function openCustomMission(page) {
  await openMissionLibrary(page, 'shell-play');
  const card = [...page.$('journey-cards').children].find((row) =>
    row.textContent.includes('Custom theme mission'),
  );
  assert.ok(card, 'The admitted custom campaign is in the real mission library.');
  return card;
}

test('company startup presentation block supplies the admitted candidate and waits for its resources', async () => {
  const source = await readFile(new URL('../company-player.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('  const themeHost = installThemeHost({');
  const end = source.indexOf('  displayPreferences.subscribe(', start);
  assert.ok(start >= 0 && end > start, 'The production company startup presentation block exists.');
  const fixture = await fixtureWithCustomCampaigns();
  const catalog = fixture.files.get('game/editions/catalog.json');
  const selection = {
    brand: catalog.brands[0],
    edition: catalog.editions[0],
    campaigns: [catalog.campaigns[0]],
  };
  const document = new Document();
  let accept;
  const resources = new Promise((resolve) => {
    accept = resolve;
  });
  let finished = false;
  const loading = vm
    .runInNewContext(`(async () => { ${source.slice(start, end)} return themeHost; })()`, {
      document,
      window: document.defaultView,
      catalog,
      selection,
      storage: memoryStorage(),
      displayPreferences: undefined,
      resolveEditionAppearanceDefault,
      resolveEditionAppearanceThemes,
      installThemeHost: (options) =>
        installThemeHost({ ...options, prepareStyles: () => resources }),
    })
    .then((value) => {
      finished = true;
      return value;
    });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(finished, false, 'Startup must wait before latching the first board appearance.');
  accept();
  const host = await loading;
  assert.equal(host.snapshot().familyId, first.family.id);
  assert.equal(host.snapshot().tokens.panel, first.interfaceTheme.tokens.panel);
  assert.equal(selectedArcadeCollection(host.effectivePreferences()).id, first.family.arcade.id);
  host.dispose();
});

for (const personal of [null, 'tryzub']) {
  test(`actual custom campaign adoption latches interface and exact arcade dependency${personal ? ' while preserving the personal choice' : ''}`, async (t) => {
    const fixture = await fixtureWithCustomCampaigns();
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
    assert.equal(page.doc.body.dataset.editionId, 'sample-public');
    page.doc.head.querySelector('link[data-industrial-workshop]').emit('load');
    await settle(
      () => page.doc.documentElement.dataset.interfaceTheme === (personal ?? first.family.id),
    );
    assert.equal(
      loadAcceptedAppearance(page.win.sessionStorage)?.family.id ?? null,
      personal ? null : first.family.id,
    );
    const card = await openCustomMission(page);
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
        page.rendered.run.levelId === 'custom-theme-mission'
      );
    });
    assert.deepEqual(
      captures.find((row) => row.levelId === 'custom-theme-mission'),
      {
        levelId: 'custom-theme-mission',
        collection: personal ?? second.family.arcade.id,
        interfaceTheme: personal ?? second.family.id,
      },
    );
    assert.equal(
      loadAcceptedAppearance(page.win.sessionStorage)?.family.id ?? null,
      personal ? null : second.family.id,
    );
    let destination;
    page.win.location.assign = (href) => {
      destination = new URL(href);
    };
    page.$('shell-home-fpv').onclick();
    assert.equal(destination.searchParams.get('appearanceFamily'), second.family.id);
    assert.equal(destination.searchParams.get('appearanceRevision'), second.family.revision);
    assert.equal(destination.searchParams.get('edition'), null);
    assert.equal(storage.getItem(THEME_PREFERENCES_KEY), preference);
    assert.deepEqual(page.errors, []);
  });
}

for (const outcome of ['cancel', 'failure']) {
  test(`a ${outcome === 'cancel' ? 'cancelled' : 'failed'} custom campaign load preserves the active run, interface and SIM pin`, async (t) => {
    const fixture = await fixtureWithCustomCampaigns();
    const page = await soloPage(t, {
      search: '?edition=sample-public',
      titleScreen: true,
      journeyIndexedDB: managedIndexedDB().indexedDB,
      fetchResponse: fixture.fetcher,
    });
    page.doc.head.querySelector('link[data-industrial-workshop]').emit('load');
    await settle(() => page.doc.documentElement.dataset.interfaceTheme === first.family.id);
    assert.equal(loadAcceptedAppearance(page.win.sessionStorage)?.family.id, first.family.id);
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
    const card = await openCustomMission(page);
    const pending = activateMissionCard(card);
    await settle(() => loading);
    page.frame(0);
    assert.equal(page.rendered.run, original);
    assert.equal(page.doc.documentElement.dataset.interfaceTheme, first.family.id);
    assert.equal(loadAcceptedAppearance(page.win.sessionStorage)?.family.id, first.family.id);
    if (outcome === 'cancel') {
      page.$('flight-preparation-cancel').click();
      accept([]);
    } else reject(new Error('Review fixture custom theme font decode failed.'));
    await pending;
    page.frame(0);
    assert.equal(page.rendered.run, original);
    assert.equal(page.doc.documentElement.dataset.interfaceTheme, first.family.id);
    assert.equal(loadAcceptedAppearance(page.win.sessionStorage)?.family.id, first.family.id);
    let destination;
    page.win.location.assign = (href) => {
      destination = new URL(href);
    };
    page.$('shell-home-fpv').onclick();
    assert.equal(destination.searchParams.get('appearanceFamily'), first.family.id);
    assert.equal(page.storage.getItem(THEME_PREFERENCES_KEY), null);
  });
}
