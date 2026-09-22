import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { journeyLibrarySource } from '../mission-library/journey-source.mjs';
import { createJourneyCatalog } from '../journey/catalog.mjs';
import { emptyJourneyProfile } from '../journey/profile.mjs';
import { attachJourneyChooser } from '../ui/journey-chooser.mjs';
import { createMissionLibrarySessionState } from '../mission-library/handoff.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('filtered, closed and background cards cannot launch or prepare an old selection', async () => {
  let launches = 0,
    preparations = 0;
  const { doc, $, chooser } = setup([
    owner({ launch: () => ++launches }),
    owner({
      id: 'missing',
      entries: [row('missing')],
      availability: () => ({ state: 'download', bytes: 1024 }),
      prepare: () => ++preparations,
    }),
  ]);
  const oldCards = [...$('journey-cards').children];
  $('journey-search').value = 'no match';
  $('journey-search').emit('input');
  for (const card of oldCards) card.click();
  await tick();
  assert.equal(launches, 0);
  assert.equal(preparations, 0);
  $('journey-search').value = '';
  $('journey-search').emit('input');
  doc.hidden = true;
  for (const card of oldCards) card.click();
  await tick();
  doc.hidden = false;
  chooser.close();
  for (const card of oldCards) card.click();
  await tick();
  assert.equal(launches, 0);
  assert.equal(preparations, 0);
  chooser.destroy();
});

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

test('controller clears persisted no-match search without resetting filters or launching, and reopen retains the repair', () => {
  const expected = createMissionLibrary([owner()]).missions[0];
  let saved = {
      mode: 'versus',
      collection: 'Classic',
      campaign: expected.campaignKey,
      search: 'no such mission',
      selectedId: expected.id,
      scroll: 99,
    },
    launches = 0,
    inputs = 0;
  const options = {
    readState: () => saved,
    writeState: (value) => (saved = structuredClone(value)),
  };
  const source = owner({ launch: () => ++launches });
  const p = setup([source], options);
  p.doc.addEventListener('input', (event) => {
    if (event.target === p.$('journey-search')) inputs++;
  });
  const navigation = attachControllerNavigation({
    document: p.doc,
    getRoot: () => p.$('journey-chooser'),
    getScope: () => 'missions',
  });
  assert.equal(p.$('journey-cards').children.length, 0);
  assert.equal(p.$('journey-search-clear').hidden, false);
  assert.equal(p.doc.activeElement, p.$('journey-search'));
  navigation.handle({ direction: 'right' });
  assert.equal(p.doc.activeElement, p.$('journey-search-clear'));
  navigation.handle({ confirm: true });
  assert.equal(inputs, 1, 'Clear uses the host-observable typing invalidation path.');
  assert.equal(p.$('journey-search').value, '');
  assert.equal(p.$('journey-search-clear').hidden, true);
  assert.equal(p.$('journey-mode').value, 'versus');
  assert.equal(p.$('journey-collection').value, 'Classic');
  assert.equal(p.$('journey-campaign').value, expected.campaignKey);
  assert.equal(p.$('journey-cards').children.length, 1);
  assert.equal(p.doc.activeElement, p.$('journey-cards').children[0]);
  assert.equal(p.$('journey-cards').scrollTop, 0);
  assert.equal(launches, 0);
  navigation.destroy();
  p.chooser.destroy();
  const reopened = setup([source], options);
  assert.equal(reopened.$('journey-search').value, '');
  assert.equal(reopened.$('journey-search-clear').hidden, true);
  assert.equal(reopened.$('journey-mode').value, 'versus');
  assert.equal(reopened.$('journey-campaign').value, expected.campaignKey);
  assert.equal(reopened.doc.activeElement.dataset.missionId, expected.id);
  assert.equal(launches, 0);
  reopened.chooser.destroy();
});

test('clearing search retires late preparation feedback while keeping current filters and focus', async () => {
  let ready = false,
    finish;
  const { doc, $, chooser } = setup([
    owner({
      availability: () => (ready ? { state: 'ready' } : { state: 'download', bytes: 12 }),
      prepare: () =>
        new Promise((resolve) => {
          finish = () => {
            ready = true;
            resolve();
          };
        }),
    }),
  ]);
  const card = $('journey-cards').children[0];
  card.click();
  await tick();
  $('journey-search').value = 'no such mission';
  $('journey-search').emit('input');
  $('journey-search-clear').focus();
  $('journey-search-clear').click();
  assert.equal(doc.activeElement, card);
  finish();
  await tick();
  assert.equal(doc.activeElement, card);
  assert.equal($('journey-search').value, '');
  assert.equal($('journey-chooser-status').textContent, '1 mission · Solo');
  assert.equal($('journey-chooser').open, true);
  chooser.destroy();
});

test('clear search cannot act from a closed or background chooser or steal newer input focus', () => {
  const { doc, $, chooser, opener } = setup([owner()]);
  const search = $('journey-search'),
    clear = $('journey-search-clear');
  assert.equal(clear.hidden, true);
  search.value = 'no such mission';
  search.emit('input');
  chooser.close();
  clear.onclick();
  assert.equal(search.value, 'no such mission');
  chooser.open(opener);
  doc.hidden = true;
  clear.onclick();
  assert.equal(search.value, 'no such mission');
  doc.hidden = false;
  doc.addEventListener('input', () => $('journey-back').focus());
  clear.focus();
  clear.click();
  assert.equal(search.value, '');
  assert.equal(doc.activeElement, $('journey-back'));
  chooser.destroy();
});

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

test('restores another-mode filters only from the same host session key', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const session = (mode) => createMissionLibrarySessionState({ mode, storage });
  const firstState = session('team');
  const first = setup([owner()], {
    mode: 'team',
    readState: firstState.read,
    writeState: firstState.write,
  });
  first.$('journey-mode').value = 'versus';
  first.$('journey-mode').emit('change');
  first.$('journey-search').value = 'Last';
  first.$('journey-search').emit('input');
  first.$('journey-collection').value = 'Classic';
  first.$('journey-collection').emit('change');
  const campaign = first.library.missions[0].campaignKey;
  first.$('journey-campaign').value = campaign;
  first.$('journey-campaign').emit('change');
  first.$('journey-cards').children[0].focus();
  first.$('journey-cards').scrollTop = 25;
  first.chooser.destroy();

  const restoredState = session('team');
  const restored = setup([owner()], {
    mode: 'team',
    readState: restoredState.read,
    writeState: restoredState.write,
  });
  assert.equal(restored.$('journey-mode').value, 'versus');
  assert.equal(restored.$('journey-search').value, 'Last');
  assert.equal(restored.$('journey-collection').value, 'Classic');
  assert.equal(restored.$('journey-campaign').value, campaign);
  assert.equal(restored.doc.activeElement, restored.$('journey-cards').children[0]);
  assert.equal(restored.$('journey-cards').scrollTop, 25);
  restored.chooser.destroy();

  const otherState = session('solo');
  const other = setup([owner()], {
    mode: 'solo',
    readState: otherState.read,
    writeState: otherState.write,
  });
  assert.equal(other.$('journey-mode').value, 'solo');
  assert.equal(other.$('journey-search').value, '');
  assert.equal(other.$('journey-collection').value, '');
  assert.equal(other.$('journey-campaign').value, '');
  other.chooser.destroy();
});

test('an untouched saved other-mode selection restores exact card and scroll after lazy metadata', async () => {
  const expected = createMissionLibrary([owner()]).missions[0];
  const { doc, $, library, chooser } = setup([], {
    mode: 'team',
    readState: () => ({
      mode: 'versus',
      search: 'Last',
      collection: 'Classic',
      campaign: expected.campaignKey,
      selectedId: expected.id,
      scroll: 123,
    }),
  });
  assert.equal($('journey-mode').value, 'versus');
  assert.equal($('journey-campaign').value, '');
  assert.equal(chooser.state().campaign, expected.campaignKey);
  assert.equal($('journey-cards').children.length, 0);
  await tick();
  // A real empty scroll container clamps the initial scroll position to zero.
  $('journey-cards').scrollTop = 0;
  library.register(owner());
  assert.equal($('journey-campaign').value, expected.campaignKey);
  assert.equal($('journey-cards').children.length, 1);
  assert.equal(chooser.state().selectedId, expected.id);
  assert.equal(doc.activeElement, $('journey-cards').children[0]);
  assert.equal($('journey-cards').scrollTop, 123);
  assert.equal(doc.captureListeners.get('focusin')?.size, 0);
  chooser.destroy();
});

for (const action of ['keydown', 'pointerdown', 'click', 'focus', 'input', 'hidden', 'close'])
  test(`lazy saved selection cannot steal focus or scroll after ${action}`, async () => {
    const expected = createMissionLibrary([owner()]).missions[0];
    const { doc, $, library, chooser, opener } = setup([], {
      mode: 'team',
      readState: () => ({ mode: 'solo', selectedId: expected.id, scroll: 123 }),
    });
    await tick();
    if (action === 'focus') $('journey-mode').focus();
    else if (action === 'hidden') {
      doc.hidden = true;
      doc.emit('visibilitychange');
      doc.hidden = false;
    } else if (action === 'close') chooser.close();
    else $('journey-search').emit(action, { key: 'Shift' });
    const focused = action === 'close' ? opener : doc.activeElement;
    $('journey-cards').scrollTop = 9;
    library.register(owner());
    assert.equal(doc.activeElement, focused);
    assert.equal($('journey-cards').scrollTop, 9);
    assert.equal(doc.captureListeners.get('focusin')?.size, 0);
    chooser.destroy();
  });

test('repeated lazy opens replace the pending lease and exact reveal retires it', async () => {
  const expected = createMissionLibrary([owner()]).missions[0];
  const { doc, library, chooser, opener } = setup([], {
    readState: () => ({ mode: 'solo', selectedId: expected.id, scroll: 123 }),
  });
  chooser.open(opener);
  await tick();
  assert.equal(doc.captureListeners.get('focusin')?.size, 1);
  assert.equal(doc.captureListeners.get('keydown')?.size, 1);
  chooser.close();
  assert.equal(doc.captureListeners.get('focusin')?.size, 0);
  chooser.open(opener);
  await tick();
  library.register(owner({ id: 'other' }));
  assert.equal(chooser.reveal(library.missions[0].id), true);
  const revealed = doc.activeElement;
  assert.equal(doc.captureListeners.get('focusin')?.size, 0);
  library.register(owner());
  assert.equal(doc.activeElement, revealed);
  chooser.destroy();
  assert.equal(doc.listeners.get('visibilitychange')?.size, 0);
});

for (const action of ['mode', 'campaign', 'collection', 'search', 'reveal'])
  test(`a deliberate ${action} choice retires a pending restored campaign`, () => {
    const pending = owner({ id: 'later' });
    const expected = createMissionLibrary([pending]).missions[0];
    const { $, library, chooser } = setup([owner()], {
      mode: action === 'reveal' ? 'solo' : 'team',
      readState: () => ({ mode: 'solo', campaign: expected.campaignKey }),
    });
    if (action === 'reveal') assert.equal(chooser.reveal(library.missions[0].id), true);
    else {
      const control = $(`journey-${action}`);
      control.value = action === 'mode' ? 'versus' : action === 'search' ? 'Last' : '';
      control.emit(action === 'search' ? 'input' : 'change');
    }
    library.register(pending);
    assert.equal($('journey-campaign').value, '');
    assert.equal(chooser.state().campaign, '');
    assert.equal($('journey-cards').children.length, 2);
    chooser.destroy();
  });

test('a new search keeps an already-visible explicitly selected campaign', () => {
  const { $, library, chooser } = setup([owner(), owner({ id: 'other' })]);
  const campaign = library.missions[0].campaignKey;
  $('journey-campaign').value = campaign;
  $('journey-campaign').emit('change');
  $('journey-search').value = 'Last';
  $('journey-search').emit('input');
  assert.equal($('journey-campaign').value, campaign);
  assert.equal(chooser.state().campaign, campaign);
  assert.equal($('journey-cards').children.length, 1);
  chooser.destroy();
});

test('an exact host-local reveal overrides a restored remote filter without launching', () => {
  let launches = 0;
  const { doc, $, library, chooser } = setup(
    [owner({ launch: () => ++launches }), owner({ id: 'team', entries: [row('team', ['team'])] })],
    {
      mode: 'solo',
      readState: () => ({ mode: 'team', search: 'Last', campaign: 'not loaded' }),
    },
  );
  const selected = library.forMode('solo')[0];
  assert.equal(chooser.reveal(selected.id), true);
  assert.equal($('journey-mode').value, 'solo');
  assert.equal($('journey-search').value, '');
  assert.equal(chooser.state().campaign, '');
  assert.equal(doc.activeElement.dataset.missionId, selected.id);
  assert.equal(launches, 0);
  assert.equal(chooser.reveal(library.forMode('team')[0].id), false);
  assert.equal($('journey-mode').value, 'solo');
  assert.equal(doc.activeElement.dataset.missionId, selected.id);
  chooser.destroy();
});

test('an invalid saved mode cannot override the current host default or restore stale selection', () => {
  const { doc, $, chooser } = setup([owner()], {
    mode: 'solo',
    readState: () => ({ mode: 'online', selectedId: 'stale', campaign: 'stale', scroll: 25 }),
  });
  assert.equal($('journey-mode').value, 'solo');
  assert.equal(chooser.state().selectedId, '');
  assert.equal(chooser.state().campaign, '');
  assert.equal($('journey-cards').scrollTop, 0);
  assert.equal(doc.activeElement.id, 'journey-search');
  chooser.destroy();
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
