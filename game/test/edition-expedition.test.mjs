import test from 'node:test';
import assert from 'node:assert/strict';
import { mountEditionExpedition, createExpeditionEntries } from '../ui/edition-expedition.mjs';
import { attachMissionLibraryChooser } from '../ui/mission-library-chooser.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { journeyLibrarySource } from '../mission-library/journey-source.mjs';
import { createJourneyCatalog } from '../journey/catalog.mjs';
import { emptyJourneyProfile, applyJourneyEvent } from '../journey/profile.mjs';
import { reconcileEarnedRewards } from '../rewards/model.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';

const tick = () => new Promise((resolve) => setImmediate(resolve));
const copy = (value) => structuredClone(value);

async function fixture(t, { late = false } = {}) {
  const base = await editionProviderFixture();
  const source = copy(base.source);
  source.missions = Array.from({ length: 6 }, (_, index) => ({
    ...copy(source.missions[0]),
    id: `mission-${index + 1}`,
    name: `Landmark ${index + 1}`,
  }));
  source.campaigns[0].missionIds = source.missions.map((mission) => mission.id);
  source.campaigns[0].discovery = {
    exhibitLayout: 'mosaic',
    finaleRewardRef: { id: 'finale', revision: 'r1' },
  };
  source.missions[0].design.pacingBeat = 'discover';
  source.missions[0].design.rewardRef = { id: 'mission-1-discovery', revision: 'r1' };
  const campaign = source.campaigns[0],
    editionId = 'sample-public';
  const localized = (title, teaser) => ({
    en: { title, teaser },
    uk: { title: `Українська ${title}`, teaser: `Українська ${teaser}` },
  });
  const requirement = (id) => ({
    missionId: id,
    bindings: [{ gameplayId: `gameplay-${id}`, difficulty: 'standard' }],
  });
  const rewards = source.missions.map((mission) => ({
    format: 'revealline-completion-reward.v1',
    id: `${mission.id}-discovery`,
    revision: 'r1',
    brandId: 'sample',
    campaignId: campaign.id,
    scope: { kind: 'mission', id: mission.id },
    locales: localized(`${mission.name} insight`, 'A useful discovery.'),
    requirements: { missions: [requirement(mission.id)], learning: [], mastery: [] },
    payloads: [
      {
        id: 'secret',
        type: 'knowledge',
        locales: {
          en: { title: 'Secret payload', paragraphs: ['Only available after the win.'] },
          uk: { title: 'Секрет', paragraphs: ['Після перемоги.'] },
        },
      },
    ],
  }));
  rewards.push({
    ...copy(rewards[0]),
    id: 'finale',
    scope: { kind: 'campaign', id: campaign.id },
    locales: localized('Workshop atlas', 'Six discoveries make an atlas.'),
    requirements: {
      missions: source.missions.map((mission) => requirement(mission.id)),
      learning: [],
      mastery: [],
    },
  });
  const provider = {
    editionId,
    route: { id: editionId, source },
    selection: { edition: { campaignIds: [campaign.id] } },
    rewards,
  };
  const catalog = createJourneyCatalog([
    {
      source: 'candidate',
      packId: source.packs[0].id,
      id: campaign.id,
      title: campaign.name,
      levels: source.missions.map(({ id, name }) => ({ id, name, modes: ['solo'] })),
    },
  ]);
  let profile = emptyJourneyProfile(),
    rewardSnapshot = null;
  const launches = [];
  const owner = journeyLibrarySource({
    editionId,
    edition: 'Sample edition',
    catalog,
    profile: { snapshot: () => profile },
    launch: (mission) => {
      launches.push(mission);
      return true;
    },
  });
  const library = createMissionLibrary([owner]);
  const doc = new Document(),
    opener = doc.createElement('button');
  doc.body.append(opener);
  let chooser;
  const makeChooser = () => {
    chooser = attachMissionLibraryChooser({
      document: doc,
      library,
      mode: 'solo',
      supportedModes: ['solo'],
      onPause() {},
      onReturn() {},
    });
    return chooser;
  };
  if (!late) makeChooser();
  const view = mountEditionExpedition({
    provider,
    document: doc,
    window: {},
    getJourneyProfile: () => profile,
    getJourneyRevision: () => profile.generation,
    getRewards: () => rewardSnapshot,
  });
  t.after(() => {
    view.dispose();
    chooser?.destroy();
    library.dispose();
  });
  if (late) makeChooser();
  chooser.open(opener);
  view.refresh();
  function win(index) {
    const mission = catalog.missions[index - 1];
    profile = applyJourneyEvent(profile, {
      type: 'complete',
      mode: 'solo',
      missionId: mission.id,
      runId: `run-${index}`,
      gameplayId: `gameplay-${mission.levelId}`,
      difficulty: 'standard',
    });
    const clears = {};
    for (const entry of catalog.missions)
      if (profile.clears.solo[entry.id]) clears[entry.levelId] = profile.clears.solo[entry.id];
    rewardSnapshot = reconcileEarnedRewards(
      rewards,
      { editionId, brandId: 'sample', campaignIds: [campaign.id], clears },
      rewardSnapshot?.state,
    );
    chooser.refresh();
    view.refresh();
  }
  return {
    doc,
    provider,
    catalog,
    library,
    launches,
    chooser,
    view,
    win,
    $: (id) => doc.getElementById(id),
    get snapshot() {
      return rewardSnapshot;
    },
  };
}

test('expedition aliases are identical to canonical library identities, including selected edition ownership', async (t) => {
  const f = await fixture(t);
  const entries = createExpeditionEntries(f.provider);
  assert.equal(entries[0].missions.length, 6);
  for (const [index, mission] of entries[0].missions.entries()) {
    assert.equal(mission.aliases[0].libraryId, f.library.missions[index].id);
    assert.equal(mission.aliases[0].journeyId, f.catalog.missions[index].id);
  }
  const foreign = {
    ...f.provider,
    selection: { edition: { campaignIds: ['unrelated-campaign'] } },
  };
  assert.deepEqual(createExpeditionEntries(foreign), []);
});

test('map and list keep the exact native cards, focus and guarded launch handlers', async (t) => {
  const f = await fixture(t);
  const cards = [...f.$('journey-cards').children],
    original = cards[2],
    launch = original.onclick;
  original.focus();
  assert(f.$('journey-chooser').classList.contains('edition-expedition-map'));
  f.$('edition-expedition-list').click();
  assert(f.$('journey-chooser').classList.contains('edition-expedition-list'));
  assert.deepEqual([...f.$('journey-cards').children], cards);
  assert.equal(original.onclick, launch);
  assert.equal(f.doc.activeElement, original);
  assert.equal(f.$('edition-expedition-list').getAttribute('aria-pressed'), 'true');
  assert.equal(f.$('edition-expedition-map').getAttribute('aria-controls'), 'journey-cards');
  original.click();
  await tick();
  assert.equal(f.launches.length, 1);
  assert.equal(f.launches[0], f.catalog.missions[2]);
  original.click();
  await tick();
  assert.equal(f.launches.length, 1, 'Detached/closed chooser guards remain effective.');
});

test('visible discovery teasers never expose payloads and a five-win finale remains a promise', async (t) => {
  const f = await fixture(t);
  assert(!f.$('journey-chooser').textContent.includes('Secret payload'));
  assert(!f.$('journey-chooser').textContent.includes('Only available after'));
  assert(f.$('journey-cards').children[0].textContent.includes('Landmark 1 insight'));
  for (let index = 2; index <= 6; index++) f.win(index);
  const overview = f.$('edition-expedition-overview');
  assert.equal(overview.children[0].dataset.finaleEarned, 'false');
  assert.equal(f.$('journey-cards').children[0].dataset.expeditionCollected, 'false');
  assert.equal(f.$('journey-cards').children[5].dataset.expeditionCollected, 'true');
  f.win(1);
  assert.equal(overview.children[0].dataset.finaleEarned, 'true');
  assert.equal(overview.children[0].dataset.exhibitLayout, 'mosaic');
});

test('next unfinished action focuses a visible canonical card without launching or clearing filters', async (t) => {
  const f = await fixture(t);
  f.win(1);
  f.$('edition-expedition-next').click();
  assert.equal(f.doc.activeElement, f.$('journey-cards').children[1]);
  assert.equal(f.launches.length, 0);
  f.$('journey-search').value = 'Landmark 6';
  f.$('journey-search').emit('input');
  await tick();
  assert.equal(f.$('journey-cards').children.length, 1);
  f.$('edition-expedition-next').click();
  assert.equal(f.doc.activeElement, f.$('journey-cards').children[0]);
  assert.equal(f.$('journey-search').value, 'Landmark 6');
  f.win(6);
  assert.equal(f.$('edition-expedition-next').disabled, true);
  assert.equal(f.launches.length, 0);
});

test('late mounted chooser, filtering and refresh do not duplicate decorations or replace native cards', async (t) => {
  const f = await fixture(t, { late: true });
  const first = f.$('journey-cards').children[0];
  for (let index = 0; index < 20; index++) f.view.refresh();
  assert.equal(first.querySelectorAll('.edition-expedition-discovery').length, 1);
  assert.equal(f.doc.querySelectorAll('#edition-expedition-toolbar').length, 1);
  f.$('journey-search').value = 'no match';
  f.$('journey-search').emit('input');
  await tick();
  assert.equal(f.$('edition-expedition-toolbar').hidden, true);
  f.$('journey-search').value = '';
  f.$('journey-search').emit('input');
  await tick();
  assert.equal(f.$('journey-cards').children[0], first);
  assert.equal(first.querySelectorAll('.edition-expedition-discovery').length, 1);
  f.view.dispose();
  assert.equal(first.querySelectorAll('.edition-expedition-discovery').length, 0);
  assert.equal(f.$('edition-expedition-toolbar'), null);
  assert.equal(f.$('journey-cards').children[0], first);
});

test('locale changes update reward hints while retaining the same card and selected presentation', async (t) => {
  const initial = getLocale();
  t.after(() => setLocale(initial));
  await setLocale('en');
  const f = await fixture(t);
  const first = f.$('journey-cards').children[0];
  f.$('edition-expedition-list').click();
  await setLocale('uk');
  f.view.refresh();
  assert.equal(f.$('journey-cards').children[0], first);
  assert(first.textContent.includes('Українська Landmark 1 insight'));
  assert.equal(f.$('edition-expedition-list').getAttribute('aria-pressed'), 'true');
});

test('keyboard and controller navigation use the same map and list cards without extra launch controls', async (t) => {
  const f = await fixture(t);
  const cards = [...f.$('journey-cards').children];
  const navigation = attachControllerNavigation({
    document: f.doc,
    getScope: () => 'modal:journey',
    getRoot: () => f.$('journey-chooser'),
    getDefaultFocus: () => cards[0],
    keyboard: true,
  });
  t.after(() => navigation.destroy());
  const geometry = (columns) =>
    cards.forEach((card, index) => {
      card._rect = {
        x: (index % columns) * 200,
        y: Math.floor(index / columns) * 200,
        width: 180,
        height: 160,
      };
    });
  geometry(3);
  cards[0].focus();
  const down = cards[0].emit('keydown', { key: 'ArrowDown' });
  assert.equal(down.defaultPrevented, true);
  assert.equal(f.doc.activeElement, cards[3]);
  navigation.handle({ direction: 'right' });
  assert.equal(f.doc.activeElement, cards[4]);
  f.$('edition-expedition-list').click();
  geometry(1);
  cards[0].focus();
  navigation.handle({ direction: 'down' });
  assert.equal(f.doc.activeElement, cards[1]);
  navigation.handle({ confirm: true });
  await tick();
  assert.equal(f.launches[0], f.catalog.missions[1]);
});

test('twenty map/list cycles keep native nodes and clean refreshes perform no DOM allocations', async (t) => {
  const f = await fixture(t);
  const cards = [...f.$('journey-cards').children];
  for (let index = 0; index < 20; index++) {
    f.$('edition-expedition-list').click();
    f.$('edition-expedition-map').click();
  }
  assert.deepEqual([...f.$('journey-cards').children], cards);
  assert.equal(f.doc.querySelectorAll('.edition-expedition-discovery').length, 6);
  assert.equal(f.doc.querySelectorAll('#edition-expedition-toolbar').length, 1);
  const create = f.doc.createElement.bind(f.doc);
  let created = 0;
  f.doc.createElement = (...args) => {
    created++;
    return create(...args);
  };
  for (let index = 0; index < 20; index++) f.view.refresh();
  assert.equal(created, 0);
});

test('new reward revisions cannot replace the existing promised expedition discovery', async (t) => {
  const f = await fixture(t);
  f.win(1);
  f.provider.rewards[0].revision = 'r2';
  f.provider.rewards[0].locales.en.title = 'Replacement discovery';
  f.provider.route.source.missions[0].design.rewardRef.revision = 'r2';
  f.view.refresh(true);
  const card = f.$('journey-cards').children[0];
  assert(card.textContent.includes('Landmark 1 insight'));
  assert(!card.textContent.includes('Replacement discovery'));
  assert.equal(card.dataset.expeditionCollected, 'true');
});
