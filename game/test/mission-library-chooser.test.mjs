import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { journeyLibrarySource } from '../mission-library/journey-source.mjs';
import { createJourneyCatalog } from '../journey/catalog.mjs';
import { emptyJourneyProfile } from '../journey/profile.mjs';
import { attachJourneyChooser } from '../ui/journey-chooser.mjs';

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('late failed launch cannot reopen the picker over a newer host action', async () => {
  let finish,
    current = true;
  const { $, chooser } = setup(
    [
      owner({
        launch: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      }),
    ],
    { launchContext: () => ({ isCurrent: () => current }) },
  );
  $('journey-cards').children[0].click();
  await tick();
  assert.equal($('journey-chooser').open, false);
  current = false;
  finish(false);
  await tick();
  assert.equal($('journey-chooser').open, false);
  chooser.destroy();
});
const row = (id = 'late', modes = ['solo', 'versus']) => ({
  id,
  name: 'Last mission',
  campaignKey: 'original-v1',
  campaignTitle: 'Original campaign',
  levelIndex: 10,
  modes,
  tags: ['FPV', 'Arcade'],
  rules: '65% coverage · 3 lives',
});
function owner(overrides = {}) {
  return {
    id: 'classic',
    collection: 'Classic',
    editionId: 'v1',
    edition: 'Earlier edition',
    entries: [row()],
    describe: (entry) => entry,
    availability: () => ({ state: 'ready' }),
    launch: () => true,
    ...overrides,
  };
}
function setup(sources, options = {}) {
  const doc = new Document(),
    library = createMissionLibrary(sources);
  const opener = doc.createElement('button');
  doc.body.append(opener);
  const chooser = attachJourneyChooser({ document: doc, library, ...options });
  chooser.open(opener);
  return { doc, library, chooser, opener, $: (id) => doc.getElementById(id) };
}

test('one flat selector defaults to All/current mode, textual collections, campaign and edition', () => {
  const { $, chooser } = setup([
    owner(),
    owner({ id: 'new', collection: 'Journey' }),
    owner({ id: 'custom', collection: 'Custom', edition: 'Player edition' }),
    owner({ id: 'team', entries: [row('team', ['team'])] }),
  ]);
  assert.equal($('journey-collection').value, '');
  assert.equal($('journey-mode').value, 'solo');
  const cards = $('journey-cards').children;
  assert.equal(cards.length, 3);
  assert.match(cards[0].textContent, /Journey.*FPV.*Arcade/);
  assert.match(cards[1].textContent, /Earlier edition.*Classic/);
  assert.match(cards[2].textContent, /Player edition.*Custom/);
  assert(!cards[1].textContent.includes('Band'), 'Classic must not invent Journey difficulty.');
  assert.match(cards[1].textContent, /65% coverage.*3 lives.*Play/);
  $('journey-mode').value = 'team';
  $('journey-mode').emit('change');
  assert.equal($('journey-cards').children.length, 1);
  chooser.destroy();
});

test('restoring a cancelled host transition retains the real opener and return label', () => {
  const { doc, $, chooser } = setup([owner()]);
  const origin = doc.createElement('button');
  doc.body.append(origin);
  chooser.open(origin, { returnLabel: 'Back to Home' });
  $('journey-chooser').close();
  chooser.restore();
  assert.equal($('journey-back').textContent, 'Back to Home');
  $('journey-back').click();
  assert.equal(doc.activeElement, origin);
  chooser.destroy();
});

test('Journey text refreshes with preset without eager board construction or loss of card focus', () => {
  let preset = 'Standard',
    diagrams = 0;
  const { doc, $, chooser } = setup([
    owner({
      collection: 'Journey',
      details: () => ({
        challenge: `Band 3/12 · ${preset}`,
        route: 'Choose a return lane.',
        mastery: 'Use two cuts.',
      }),
      card: () => {
        diagrams++;
        return null;
      },
    }),
  ]);
  const card = $('journey-cards').children[0];
  card.focus();
  assert.match(
    card.textContent,
    /Band 3\/12 · Standard.*Choose a return lane.*Optional challenge: Use two cuts/,
  );
  preset = 'Expert';
  chooser.refresh();
  assert.match(card.textContent, /Band 3\/12 · Expert/);
  assert.equal(doc.activeElement, card);
  assert.equal(diagrams, 0);
  chooser.destroy();
});

test('download stays in picker, preserves search/focus/scroll, and requires a deliberate Play', async () => {
  let finish,
    ready = false,
    launches = 0;
  const { doc, $, chooser, opener } = setup([
    owner({
      availability: () => (ready ? { state: 'ready' } : { state: 'download', bytes: 1048576 }),
      prepare: () =>
        new Promise((resolve) => {
          finish = () => {
            ready = true;
            resolve();
          };
        }),
      launch: () => {
        launches++;
        return true;
      },
    }),
  ]);
  $('journey-search').value = 'earlier';
  $('journey-search').emit('input');
  const card = $('journey-cards').children[0];
  card.focus();
  $('journey-cards').scrollTop = 123;
  assert.match(card.textContent, /Download · 1.0 MiB/);
  card.click();
  await tick();
  assert.match(card.textContent, /Preparing · Cancel/);
  assert.equal($('journey-chooser').open, true);
  assert.equal(doc.activeElement, card);
  finish();
  await tick();
  assert.match(card.textContent, /Play/);
  assert.equal(launches, 0);
  assert.equal($('journey-search').value, 'earlier');
  assert.equal($('journey-cards').scrollTop, 123);
  card.click();
  await tick();
  assert.equal(launches, 1);
  assert.equal($('journey-chooser').open, false);
  chooser.open(opener);
  assert.equal(doc.activeElement, card);
  assert.equal($('journey-cards').scrollTop, 123);
  chooser.destroy();
});

test('cancel and failed download Retry remain inline without losing the selected collection', async () => {
  let attempt = 0,
    ready = false;
  const { $, chooser } = setup([
    owner({
      availability: () => (ready ? { state: 'ready' } : { state: 'download', bytes: 4096 }),
      prepare: () => {
        attempt++;
        if (attempt === 1) return new Promise(() => {});
        if (attempt === 2) throw new Error('Network disconnected');
        ready = true;
      },
    }),
  ]);
  $('journey-collection').value = 'Classic';
  $('journey-collection').emit('change');
  const card = $('journey-cards').children[0];
  card.click();
  await tick();
  card.click();
  await tick();
  assert.match($('journey-chooser-status').textContent, /cancelled/);
  card.click();
  await tick();
  assert.match(card.textContent, /Unavailable · Network disconnected · Retry/);
  assert.equal(card.disabled, false);
  card.click();
  await tick();
  assert.match(card.textContent, /Play/);
  assert.equal($('journey-collection').value, 'Classic');
  assert.equal($('journey-chooser').open, true);
  chooser.destroy();
});

test('Back cancels active preparation and restores opener, without late focus theft', async () => {
  let finish;
  const { doc, $, opener, chooser } = setup([
    owner({
      availability: () => ({ state: 'download', bytes: 4096 }),
      prepare: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    }),
  ]);
  $('journey-cards').children[0].click();
  await tick();
  $('journey-back').click();
  assert.equal($('journey-chooser').open, false);
  assert.equal(doc.activeElement, opener);
  finish();
  await tick();
  assert.equal($('journey-chooser').open, false);
  assert.equal(doc.activeElement, opener);
  chooser.destroy();
});

test('failed launch reopens the same result without losing search, scroll or selected card', async () => {
  const { doc, $, chooser } = setup([owner({ launch: async () => false })]);
  $('journey-search').value = 'Last';
  $('journey-search').emit('input');
  const card = $('journey-cards').children[0];
  card.focus();
  $('journey-cards').scrollTop = 70;
  card.click();
  await tick();
  assert.equal($('journey-chooser').open, true);
  assert.equal($('journey-search').value, 'Last');
  assert.equal(doc.activeElement, card);
  assert.equal($('journey-cards').scrollTop, 70);
  assert.match($('journey-chooser-status').textContent, /current game is kept/);
  chooser.destroy();
});

test('browsing never fetches/decode backgrounds or eagerly builds every diagram', () => {
  let cards = 0;
  const { chooser, $ } = setup([
    owner({
      entries: Array.from({ length: 200 }, (_, index) => row(String(index))),
      card: () => {
        cards++;
        throw new Error('Should not be reached without a visibility observation');
      },
    }),
  ]);
  assert.equal($('journey-cards').children.length, 200);
  assert.equal(cards, 0);
  chooser.refresh();
  assert.equal(cards, 0);
  chooser.destroy();
});

test('restores validated same-mode state across host handoff, tolerates unavailable storage', () => {
  let saved;
  const first = setup([owner()], {
    writeState: (value) => {
      saved = value;
    },
  });
  first.$('journey-search').value = 'Last';
  first.$('journey-search').emit('input');
  first.$('journey-cards').children[0].focus();
  first.$('journey-cards').scrollTop = 25;
  first.chooser.close();
  first.chooser.destroy();
  const next = setup([owner()], {
    readState: () => saved,
    writeState: () => {
      throw new Error('Quota');
    },
  });
  assert.equal(next.$('journey-search').value, 'Last');
  assert.equal(next.doc.activeElement, next.$('journey-cards').children[0]);
  assert.equal(next.$('journey-cards').scrollTop, 25);
  next.chooser.destroy();
});

test('Journey adapter retains exact runtime objects and independent mode progress', () => {
  const catalog = createJourneyCatalog([
    { id: 'new', title: 'New campaign', levels: [{ id: 'one', name: 'First' }] },
  ]);
  const profile = emptyJourneyProfile();
  profile.clears.solo[catalog.missions[0].id] = { complete: true };
  let selected;
  const library = createMissionLibrary([
    journeyLibrarySource({
      editionId: 'new-v5',
      edition: 'New Journey',
      catalog,
      profile: { snapshot: () => profile },
      launch: (mission) => {
        selected = mission;
        return true;
      },
    }),
  ]);
  const mission = library.missions[0];
  assert.equal(library.progress(mission, 'solo'), 'Cleared');
  assert.equal(library.progress(mission, 'versus'), '');
  library.launch(mission, { mode: 'solo' });
  assert.equal(selected, catalog.missions[0]);
});

test('extending the Journey picker preserves optional progress backup and return focus', () => {
  const { doc, $, chooser } = setup([owner()], { profile: { snapshot: emptyJourneyProfile } });
  const backup = $('journey-backup-open');
  backup.click();
  assert.equal($('journey-backup').open, true);
  $('journey-backup-back').click();
  assert.equal(doc.activeElement, backup);
  assert.equal($('journey-chooser').open, true);
  chooser.destroy();
  assert.equal($('journey-backup'), null);
});

test('exact source refresh replaces stale row authority but preserves focused display identity', () => {
  const { library, doc, $, chooser } = setup([owner()]);
  const old = $('journey-cards').children[0];
  old.focus();
  $('journey-cards').scrollTop = 40;
  library.register(owner());
  const replacement = $('journey-cards').children[0];
  assert.notEqual(replacement, old);
  assert.equal(replacement.dataset.missionId, old.dataset.missionId);
  assert.equal(doc.activeElement, replacement);
  assert.equal($('journey-cards').scrollTop, 40);
  chooser.destroy();
});

test('switching mode during Solo preparation still offers ready Versus Play after a Solo failure', async () => {
  let reject;
  const { $, chooser } = setup([
    owner({
      availability: (_, mode) =>
        mode === 'versus' ? { state: 'ready' } : { state: 'download', bytes: 4096 },
      prepare: () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    }),
  ]);
  $('journey-cards').children[0].click();
  await tick();
  $('journey-mode').value = 'versus';
  $('journey-mode').emit('change');
  assert.match($('journey-cards').children[0].textContent, /Play/);
  reject(new Error('Solo unavailable'));
  await tick();
  const card = $('journey-cards').children[0];
  assert.match(card.textContent, /Play/);
  assert(!card.textContent.includes('Unavailable'));
  assert(!$('journey-chooser-status').textContent.includes('Solo unavailable'));
  assert.equal(card.disabled, false);
  chooser.destroy();
});

test('a late download completion does not replace feedback after changing the search', async () => {
  let finish;
  const { $, chooser } = setup([
    owner({
      availability: () => ({ state: 'download', bytes: 4096 }),
      prepare: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    }),
  ]);
  $('journey-cards').children[0].click();
  await tick();
  $('journey-search').value = 'no matching mission';
  $('journey-search').emit('input');
  const status = $('journey-chooser-status').textContent;
  finish();
  await tick();
  assert.equal($('journey-chooser-status').textContent, status);
  chooser.destroy();
});
