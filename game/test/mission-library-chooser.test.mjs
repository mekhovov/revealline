import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { journeyLibrarySource } from '../mission-library/journey-source.mjs';
import { createJourneyCatalog } from '../journey/catalog.mjs';
import { emptyJourneyProfile } from '../journey/profile.mjs';
import {
  JOURNEY_PICTURES_LIMIT,
  JOURNEY_PICTURES_VERSION,
  validateJourneyPictures,
} from '../journey/pictures.mjs';
import { attachJourneyChooser } from '../ui/journey-chooser.mjs';
import { createMissionLibrarySessionState } from '../mission-library/handoff.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

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

test('opening and controller fallback focus the first enabled mission without a search step', () => {
  const { doc, $, chooser } = setup([
    owner({
      entries: [row('blocked'), row('playable')],
      availability: (entry) =>
        entry.id === 'blocked'
          ? { state: 'unavailable', reason: 'Content needs repair.' }
          : { state: 'ready' },
    }),
  ]);
  const cards = $('journey-cards').children;
  assert.equal(cards[0].disabled, true);
  assert.equal(doc.activeElement, cards[1]);
  assert.equal(chooser.primary(), cards[1]);
  $('journey-search').value = 'no matching mission';
  $('journey-search').emit('input');
  assert.equal(chooser.primary(), $('journey-search'));
  chooser.destroy();
});

test('current mission is the initial target, then an explicit retained selection takes precedence', () => {
  const source = owner({
    entries: [row('first'), row('current'), row('selected')],
  });
  const rows = createMissionLibrary([source]).missions;
  const { doc, $, chooser, opener } = setup([source], {
    getCurrentId: () => rows[1].id,
  });
  assert.equal(doc.activeElement.dataset.missionId, rows[1].id);
  assert.ok(doc.activeElement.scrolled > 0, 'A current mission below the fold is made visible.');
  $('journey-cards').children[2].focus();
  chooser.close();
  chooser.open(opener);
  assert.equal(doc.activeElement.dataset.missionId, rows[2].id);
  assert.equal(chooser.primary(), doc.activeElement);
  chooser.destroy();
});

for (const currentId of [null, 'unavailable-current-edition'])
  test(`an ${currentId === null ? 'absent' : 'unknown'} current identity leaves ordinary browsing usable`, () => {
    let launches = 0;
    const { doc, $, chooser } = setup([owner({ launch: () => ++launches })], {
      getCurrentId: () => currentId,
    });
    assert.equal($('journey-chooser').open, true);
    assert.equal(doc.activeElement, $('journey-cards').children[0]);
    assert.equal(chooser.primary(), doc.activeElement);
    assert.equal(launches, 0, 'Focus fallback never adopts or launches another mission.');
    chooser.destroy();
  });

test('a known filtered or disabled selection yields to an enabled visible mission', () => {
  const source = owner({
    entries: [row('blocked'), { ...row('available'), name: 'Another mission' }],
    availability: (entry) =>
      entry.id === 'blocked'
        ? { state: 'unavailable', reason: 'Content needs repair.' }
        : { state: 'ready' },
  });
  const rows = createMissionLibrary([source]).missions;
  for (const search of ['', 'Another']) {
    const { doc, chooser } = setup([source], {
      readState: () => ({ mode: 'solo', selectedId: rows[0].id, search }),
    });
    assert.equal(doc.activeElement.dataset.missionId, rows[1].id);
    assert.equal(chooser.primary(), doc.activeElement);
    chooser.destroy();
  }
});

test('an unresolved saved selection keeps Search until its remote mission arrives', async () => {
  const delayed = owner({ id: 'delayed' });
  const expected = createMissionLibrary([delayed]).missions[0];
  const { doc, $, library, chooser } = setup([owner()], {
    readState: () => ({ mode: 'solo', selectedId: expected.id }),
    getCurrentId: () => createMissionLibrary([owner()]).missions[0].id,
  });
  assert.equal($('journey-cards').children.length, 1);
  assert.equal(doc.activeElement, $('journey-search'));
  assert.equal(chooser.primary(), $('journey-search'));
  await tick();
  library.register(delayed);
  assert.equal(doc.activeElement.dataset.missionId, expected.id);
  assert.equal(chooser.primary(), doc.activeElement);
  chooser.destroy();
});

test('a current host mission cannot override retained other-mode browsing', () => {
  const sources = [owner(), owner({ id: 'team', entries: [row('team', ['team'])] })];
  const team = createMissionLibrary(sources).forMode('team')[0];
  const { doc, $, chooser } = setup(sources, {
    mode: 'team',
    readState: () => ({ mode: 'solo' }),
    getCurrentId: () => team.id,
  });
  assert.equal($('journey-mode').value, 'solo');
  assert.equal(doc.activeElement, $('journey-cards').children[0]);
  assert.notEqual(doc.activeElement.dataset.missionId, team.id);
  chooser.destroy();
});

test('a retained remote mission that arrives unavailable yields to the first enabled card', async () => {
  const delayed = owner({
    id: 'delayed',
    availability: () => ({
      state: 'unavailable',
      reason: 'No compatible runtime.',
    }),
  });
  const expected = createMissionLibrary([delayed]).missions[0];
  const { doc, $, library, chooser } = setup([owner()], {
    readState: () => ({ mode: 'solo', selectedId: expected.id }),
  });
  assert.equal(doc.activeElement, $('journey-search'));
  await tick();
  library.register(delayed);
  assert.equal(doc.activeElement, $('journey-cards').children[0]);
  assert.equal(chooser.primary(), doc.activeElement);
  assert.equal(doc.captureListeners.get('focusin')?.size, 0);
  chooser.destroy();
});

function resizeFixture() {
  const doc = new Document(),
    frames = new Map(),
    media = Object.assign(new Events(), { matches: false });
  let nextFrame = 0;
  const view = Object.assign(new Events(), doc.defaultView, {
    matchMedia: () => media,
    requestAnimationFrame(callback) {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  });
  doc.defaultView = view;
  const library = createMissionLibrary([owner({ entries: [row('first'), row('second')] })]);
  const chooser = attachJourneyChooser({ document: doc, library });
  chooser.open();
  return {
    doc,
    view,
    media,
    frames,
    chooser,
    $: (id) => doc.getElementById(id),
    frame() {
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback();
    },
  };
}

test('viewport reflow keeps the focused mission visible without moving focus or taking input ownership', () => {
  const f = resizeFixture(),
    card = f.$('journey-cards').children[1];
  card.focus();
  const before = card.scrolled ?? 0;
  let focusEvents = 0;
  f.doc.addEventListener('focusin', () => focusEvents++);
  f.view.emit('resize');
  f.media.emit('change', { matches: true });
  f.view.emit('resize');
  assert.equal(f.frames.size, 1, 'Repeated layout signals coalesce into one frame.');
  f.frame();
  assert.equal(card.scrolled, before + 1);
  assert.equal(f.doc.activeElement, card);
  assert.equal(f.chooser.state().selectedId, card.dataset.missionId);
  assert.equal(focusEvents, 0, 'Reflow scrolls without another focus event.');
  f.chooser.destroy();
  assert.equal(f.view.listeners.get('resize')?.size, 0);
  assert.equal(f.view.listeners.get('blur')?.size, 0);
});

for (const action of ['search', 'another card', 'hidden', 'blur', 'close', 'destroy'])
  test(`a queued viewport scroll yields to ${action}`, () => {
    const f = resizeFixture(),
      card = f.doc.activeElement,
      before = card.scrolled ?? 0;
    f.view.emit('resize');
    assert.equal(f.frames.size, 1);
    if (action === 'search') f.$('journey-search').focus();
    if (action === 'another card') f.$('journey-cards').children[1].focus();
    if (action === 'hidden') {
      f.doc.hidden = true;
      f.doc.emit('visibilitychange');
      f.doc.hidden = false;
    }
    if (action === 'blur') {
      f.doc.focused = false;
      f.view.emit('blur');
      f.doc.focused = true;
    }
    if (action === 'close') f.chooser.close();
    if (action === 'destroy') f.chooser.destroy();
    const focused = f.doc.activeElement;
    f.frame();
    assert.equal(card.scrolled ?? 0, before);
    assert.equal(f.doc.activeElement, focused);
    assert.equal(f.frames.size, 0);
    if (action !== 'destroy') f.chooser.destroy();
  });

test('viewport changes do not scroll missions while Search, a closed chooser or background owns the page', () => {
  const f = resizeFixture(),
    card = f.doc.activeElement,
    before = card.scrolled ?? 0;
  f.$('journey-search').focus();
  f.view.emit('resize');
  assert.equal(f.frames.size, 0);
  card.focus();
  f.doc.hidden = true;
  f.view.emit('resize');
  assert.equal(f.frames.size, 0);
  f.doc.hidden = false;
  f.doc.focused = false;
  f.view.emit('resize');
  assert.equal(f.frames.size, 0);
  f.doc.focused = true;
  f.chooser.close();
  f.view.emit('resize');
  assert.equal(f.frames.size, 0);
  assert.equal(card.scrolled ?? 0, before);
  f.chooser.destroy();
});

for (const intervention of ['new focus', 'focus away and back', 'new input', 'new filter'])
  test(`ready touch launch yields to ${intervention} during native chooser closure`, async () => {
    let launches = 0,
      retired = 0;
    const { doc, $, chooser, opener } = setup([owner({ launch: () => ++launches })], {
      launchContext: () => ({
        isCurrent: () => !retired,
        retire: () => retired++,
      }),
    });
    chooser.close();
    opener.focus();
    chooser.open(opener);
    const help = doc.createElement('button'),
      card = $('journey-cards').children[0];
    help.id = 'newer-host-help';
    doc.body.append(help);
    $('journey-back').focus();
    $('journey-chooser').addEventListener('close', () => {
      if (intervention.startsWith('focus') || intervention === 'new focus') help.focus();
      if (intervention === 'focus away and back') opener.focus();
      if (intervention === 'new input') opener.emit('keydown', { key: 'Escape' });
      if (intervention === 'new filter') {
        $('journey-search').value = 'newer search';
        $('journey-search').emit('input');
      }
    });
    card.click(); // Touch deliberately does not move focus off Back.
    const newerFocus = doc.activeElement;
    await tick();
    assert.equal(launches, 0, 'Closing the picker cannot grant a new launch after newer input.');
    assert.equal(retired, 1);
    assert.equal($('journey-chooser').open, false);
    assert.equal(doc.activeElement, newerFocus, 'Cancellation cannot restore stale picker focus.');
    for (const type of ['focusin', 'keydown', 'pointerdown', 'click'])
      assert.equal(doc.captureListeners.get(type)?.size ?? 0, 0, 'The close guard is released.');
    if (intervention === 'new focus') assert.equal(doc.activeElement, help);
    if (intervention === 'new filter') assert.equal($('journey-search').value, 'newer search');
    chooser.destroy();
  });

for (const outcome of ['cancel', 'failure'])
  test(`touch ${outcome} restores the activated mission rather than a different focused card`, async () => {
    let saved;
    const { doc, $, chooser } = setup(
      [
        owner({
          entries: [row('first'), row('second')],
          launch: () => {
            if (outcome === 'failure') throw new Error('Picture unavailable');
            return false;
          },
        }),
      ],
      { writeState: (value) => (saved = value) },
    );
    const [first, second] = $('journey-cards').children;
    first.focus();
    second.click(); // A touch tap does not necessarily change native focus.
    await tick();
    assert.equal($('journey-chooser').open, true);
    assert.equal(doc.activeElement, second);
    assert.equal(chooser.state().selectedId, second.dataset.missionId);
    assert.equal(saved.selectedId, second.dataset.missionId);
    chooser.destroy();
  });

for (const input of ['focused card', 'touch from Back'])
  test(`ready ${input} launch accepts normal native return focus exactly once`, async () => {
    let launches = 0;
    const { doc, $, chooser, opener } = setup([owner({ launch: () => ++launches })]);
    chooser.close();
    opener.focus();
    chooser.open(opener);
    const card = $('journey-cards').children[0];
    (input === 'focused card' ? card : $('journey-back')).focus();
    card.click();
    await tick();
    assert.equal(launches, 1);
    assert.equal($('journey-chooser').open, false);
    assert.equal(doc.activeElement, opener, 'Native dialog restoration remains valid admission.');
    for (const type of ['focusin', 'keydown', 'pointerdown', 'click'])
      assert.equal(doc.captureListeners.get(type)?.size ?? 0, 0, 'The close guard is released.');
    chooser.destroy();
  });

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

test('campaign rail keeps the complete gallery and jumps to an exact campaign', () => {
  const source = owner({
    entries: [
      { ...row('first'), campaignTitle: 'First light', levelIndex: 0 },
      { ...row('second'), campaignTitle: 'First light', levelIndex: 1 },
      {
        ...row('third'),
        campaignKey: 'second-v1',
        campaignTitle: 'Crossing lines',
        levelIndex: 0,
      },
    ],
  });
  const { doc, $, library, chooser } = setup([source]);
  const rail = $('journey-campaign-rail'),
    list = $('journey-cards');
  assert.equal(rail.children.length, 2);
  assert.match(rail.children[0].textContent, /First light · 2 missions/);
  assert.match(rail.children[1].textContent, /Crossing lines · 1 mission/);
  assert.equal(list.children.length, 3, 'Campaign shortcuts do not filter the full gallery.');
  const crossing = library.missions.find((mission) => mission.campaignTitle === 'Crossing lines');
  rail.children[1].click();
  assert.equal(list.children.length, 3);
  assert.equal(doc.activeElement.dataset.missionId, crossing.id);
  assert.ok(doc.activeElement.scrolled > 0);
  assert.equal(rail.children[1].getAttribute('aria-pressed'), 'true');
  assert.equal(doc.activeElement.dataset.campaignStart, 'true');
  chooser.destroy();
});

test('campaign shortcut leaves an advanced campaign filter and restores the complete gallery', () => {
  const source = owner({
    entries: [
      { ...row('first'), campaignTitle: 'First light' },
      {
        ...row('second'),
        campaignKey: 'second-v1',
        campaignTitle: 'Crossing lines',
      },
    ],
  });
  const { doc, $, library, chooser } = setup([source]);
  const first = library.missions[0],
    second = library.missions[1];
  $('journey-campaign').value = second.campaignKey;
  $('journey-campaign').emit('change');
  assert.equal($('journey-cards').children.length, 1);
  assert.equal($('journey-cards').children[0].dataset.missionId, second.id);
  $('journey-campaign-rail').children[0].click();
  assert.equal($('journey-campaign').value, '');
  assert.equal($('journey-cards').children.length, 2);
  assert.equal(doc.activeElement.dataset.missionId, first.id);
  chooser.destroy();
});

test('mission cards expose structured current, completion and availability states', () => {
  const source = owner({
    entries: [row('current'), row('earned'), row('download')],
    availability: (entry) =>
      entry.id === 'download' ? { state: 'download', bytes: 2048 } : { state: 'ready' },
    completion: (entry) =>
      entry.id === 'earned'
        ? {
            state: 'earned',
            record: { asset: { width: 2, height: 1 } },
          }
        : { state: 'unfinished' },
  });
  const rows = createMissionLibrary([source]).missions;
  const { $, chooser } = setup([source], { getCurrentId: () => rows[0].id });
  const [current, earned, download] = $('journey-cards').children;
  assert.equal(current.dataset.current, 'true');
  assert.equal(current.dataset.completionState, 'unfinished');
  assert.equal(earned.dataset.completionState, 'earned');
  assert.equal(download.dataset.availabilityState, 'download');
  assert.match(download.querySelector('.journey-card-action').textContent, /Download & play/);
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

test('Journey text refreshes with preset while keeping bounded visible previews and card focus', () => {
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
  assert.equal(
    diagrams,
    2,
    'Open and explicit refresh each rebuild only the visible card preview.',
  );
  chooser.destroy();
});

test('Download & play is one owned action, ignores repeated Confirm and retains return state', async () => {
  let finish,
    ready = false,
    launches = 0,
    preparations = 0;
  const { doc, $, chooser, opener } = setup([
    owner({
      availability: () => (ready ? { state: 'ready' } : { state: 'download', bytes: 1048576 }),
      prepare: () =>
        new Promise((resolve) => {
          preparations++;
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
  assert.match(card.textContent, /Download & play · 1.0 MiB/);
  card.click();
  await tick();
  assert.match(card.textContent, /Preparing…/);
  assert.equal($('journey-chooser').open, true);
  assert.equal(doc.activeElement, card);
  card.click();
  await tick();
  assert.equal(preparations, 1, 'Repeated Confirm cannot cancel or duplicate preparation.');
  finish();
  await tick();
  assert.equal(launches, 1);
  assert.equal($('journey-chooser').open, false);
  assert.equal($('journey-search').value, 'earlier');
  chooser.open(opener);
  assert.equal(doc.activeElement, card);
  assert.equal($('journey-cards').scrollTop, 123);
  chooser.destroy();
});

test('download label switches locale without preparing content', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  let preparations = 0;
  const { $, chooser } = setup([
    owner({
      availability: () => ({ state: 'download', bytes: 1572864 }),
      prepare: () => preparations++,
    }),
  ]);
  context.after(() => chooser.destroy());
  const card = $('journey-cards').children[0];
  assert.match(card.textContent, /Download & play · 1.5 MiB/);

  setLocale('uk', { persist: false });
  assert.match(card.textContent, /Завантажити й грати · 1,5 MiB/);
  assert.equal(preparations, 0);
});

test('failed Download & play retries inline and launches once without losing the selected collection', async () => {
  let attempt = 0,
    ready = false,
    launches = 0;
  const { $, chooser } = setup([
    owner({
      availability: () => (ready ? { state: 'ready' } : { state: 'download', bytes: 4096 }),
      prepare: () => {
        attempt++;
        if (attempt === 1) throw new Error('Network disconnected');
        ready = true;
      },
      launch: () => {
        launches++;
        return false;
      },
    }),
  ]);
  $('journey-collection').value = 'Classic';
  $('journey-collection').emit('change');
  const card = $('journey-cards').children[0];
  card.click();
  await tick();
  assert.match(card.textContent, /Unavailable · Network disconnected · Retry/);
  assert.equal(card.disabled, false);
  card.click();
  await tick();
  assert.match(card.textContent, /Play/);
  assert.equal(attempt, 2);
  assert.equal(launches, 1);
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

test('fallback preview decoding is bounded to the near-viewport budget', () => {
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
  assert.equal(cards, 12);
  chooser.refresh();
  assert.equal(cards, 24, 'Explicit refresh releases and rebuilds only the bounded preview set.');
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

for (const exit of ['Play', 'Back'])
  test(`${exit} then closed cleanup preserves native hidden-scroll position and newer host focus`, async () => {
    let saved,
      writes = 0,
      returns = 0,
      launches = 0;
    const source = owner({
      id: 'installed-player-pack',
      collection: 'Custom',
      entries: [{ ...row('voltage'), name: 'Night Shift Voltage' }],
      launch: () => ++launches,
    });
    const first = setup([source], {
      writeState: (value) => {
        saved = structuredClone(value);
        writes++;
      },
      onReturn: () => returns++,
    });
    const dialog = first.$('journey-chooser'),
      list = first.$('journey-cards');
    let visibleScroll = 0;
    Object.defineProperty(list, 'scrollTop', {
      get: () => (dialog.open ? visibleScroll : 0),
      set: (value) => (visibleScroll = value),
    });
    first.$('journey-mode').value = 'versus';
    first.$('journey-mode').emit('change');
    first.$('journey-collection').value = 'Custom';
    first.$('journey-collection').emit('change');
    first.$('journey-search').value = 'Night Shift';
    first.$('journey-search').emit('input');
    const card = list.children[0],
      selectedId = card.dataset.missionId;
    card.focus();
    list.scrollTop = 490;
    if (exit === 'Play') card.click();
    else first.chooser.close();
    await tick();
    assert.equal(saved.scroll, 490, 'The visible selection is saved before closing.');
    assert.equal(list.scrollTop, 0, 'Native hidden layout no longer exposes the old scroll.');
    assert.equal(launches, exit === 'Play' ? 1 : 0);
    const savedWrites = writes,
      savedReturns = returns,
      newer = first.doc.createElement('button');
    first.doc.body.append(newer);
    newer.focus();
    first.chooser.close(); // A host cleanup may close an already closed chooser.
    first.chooser.destroy(); // Page departure then disposes that same owner.
    assert.equal(saved.scroll, 490, 'Cleanup must not replace visible scroll with hidden zero.');
    assert.equal(first.chooser.state().scroll, 490);
    assert.equal(writes, savedWrites, 'Closed cleanup does not rewrite selector storage.');
    assert.equal(returns, savedReturns, 'Closed cleanup does not request stale return focus.');
    assert.equal(first.doc.activeElement, newer);
    const restored = setup([source], { readState: () => saved });
    assert.equal(restored.$('journey-mode').value, 'versus');
    assert.equal(restored.$('journey-collection').value, 'Custom');
    assert.equal(restored.$('journey-search').value, 'Night Shift');
    assert.equal(restored.doc.activeElement.dataset.missionId, selectedId);
    assert.equal(restored.$('journey-cards').scrollTop, 490);
    restored.chooser.destroy();
  });

test('a different card retires pending preparation and closed cleanup invalidates a late launch', async () => {
  let downloadSignal, finishDownload, finishLaunch;
  const { doc, $, chooser } = setup([
    owner({
      entries: [{ ...row('ready'), name: 'Ready mission' }],
      launch: () => new Promise((resolve) => (finishLaunch = resolve)),
    }),
    owner({
      id: 'download',
      entries: [{ ...row('download'), name: 'Pending mission' }],
      availability: () => ({ state: 'download', bytes: 123 }),
      prepare: (_entry, { signal }) => {
        downloadSignal = signal;
        return new Promise((resolve) => (finishDownload = resolve));
      },
    }),
  ]);
  const cards = [...$('journey-cards').children];
  cards.find((card) => card.querySelector('strong').textContent === 'Pending mission').click();
  await tick();
  cards.find((card) => card.querySelector('strong').textContent === 'Ready mission').click();
  await tick();
  assert.equal($('journey-chooser').open, false);
  assert.equal(
    downloadSignal.aborted,
    true,
    'Choosing another mission retires the stale Download & play intent immediately.',
  );
  const newer = doc.createElement('button');
  doc.body.append(newer);
  newer.focus();
  chooser.close();
  assert.equal(
    downloadSignal.aborted,
    true,
    'Closed cleanup preserves the retired preparation state.',
  );
  finishDownload();
  finishLaunch(false);
  await tick();
  assert.equal($('journey-chooser').open, false, 'Late refusal cannot reopen a retired visit.');
  assert.equal(doc.activeElement, newer);
  chooser.destroy();
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
      readState: () => ({
        mode: 'team',
        search: 'Last',
        campaign: 'not loaded',
      }),
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
    readState: () => ({
      mode: 'online',
      selectedId: 'stale',
      campaign: 'stale',
      scroll: 25,
    }),
  });
  assert.equal($('journey-mode').value, 'solo');
  assert.equal(chooser.state().selectedId, $('journey-cards').children[0].dataset.missionId);
  assert.equal(chooser.state().campaign, '');
  assert.equal($('journey-cards').scrollTop, 0);
  assert.equal(doc.activeElement, $('journey-cards').children[0]);
  chooser.destroy();
});

test('Journey adapter retains exact runtime objects and independent mode progress', () => {
  const catalog = createJourneyCatalog([
    {
      id: 'new',
      title: 'New campaign',
      levels: [{ id: 'one', name: 'First' }],
    },
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

test('Journey adapter indexes a maximum picture ledger once per store revision', () => {
  const catalog = createJourneyCatalog([
      {
        id: 'current',
        title: 'Current campaign',
        levels: [
          { id: 'earned', name: 'Earned' },
          { id: 'earlier', name: 'Earlier' },
          { id: 'unfinished', name: 'Unfinished' },
        ],
      },
    ]),
    profile = emptyJourneyProfile(),
    [earned, earlier, unfinished] = catalog.missions;
  profile.clears.solo[earlier.id] = {
    runId: 'old-run',
    gameplayId: 'old-gameplay',
    difficulty: 'standard',
  };
  let revision = 0,
    profileReads = 0,
    pictureReads = 0;
  const records = Array.from({ length: JOURNEY_PICTURES_LIMIT }, (_, index) => ({
    mode: 'solo',
    editionId: index === JOURNEY_PICTURES_LIMIT - 1 ? 'current-v1' : 'historical-v1',
    missionId: index === JOURNEY_PICTURES_LIMIT - 1 ? earned.id : `historical-${index}`,
    campaignKey: 'campaign@1',
    levelId: `level-${index}`,
    levelRevision: '1',
    runId: `run-${index}`,
    gameplayId: `gameplay-${index}`,
    difficulty: 'standard',
    name: `Mission ${index}`,
    campaignTitle: 'Historical campaign',
    themeId: 'horizon',
    asset: {
      format: 'AssetRevisionV1',
      id: `picture-${index}`,
      revision: '1',
      kind: 'reveal-background',
      path: 'content-design/assets/test/picture.png',
      sha256: 'a'.repeat(64),
      bytes: 100,
      width: 32,
      height: 16,
      alt: 'Historical picture',
      review: 'candidate',
    },
  }));
  assert.equal(
    validateJourneyPictures({ format: JOURNEY_PICTURES_VERSION, records }).records.length,
    JOURNEY_PICTURES_LIMIT,
  );
  const source = journeyLibrarySource({
    editionId: 'current-v1',
    edition: 'Current Journey',
    catalog,
    profile: {
      snapshot: () => {
        profileReads++;
        return structuredClone(profile);
      },
      pictures: () => {
        pictureReads++;
        return { format: JOURNEY_PICTURES_VERSION, records: structuredClone(records) };
      },
      stateRevision: () => revision,
    },
    launch: () => true,
  });
  assert.equal(source.progress(earned, 'solo'), '');
  assert.equal(source.completion(earned, 'solo').state, 'earned');
  assert.equal(source.progress(earlier, 'solo'), 'Cleared');
  assert.equal(source.completion(earlier, 'solo').state, 'unavailable');
  assert.equal(source.completion(unfinished, 'solo').state, 'unfinished');
  assert.deepEqual({ profileReads, pictureReads }, { profileReads: 1, pictureReads: 1 });

  records.at(-1).missionId = unfinished.id;
  revision++;
  assert.equal(source.completion(earned, 'solo').state, 'unfinished');
  assert.equal(source.completion(unfinished, 'solo').state, 'earned');
  assert.deepEqual({ profileReads, pictureReads }, { profileReads: 2, pictureReads: 2 });
});

test('extending the Journey picker preserves optional progress backup and return focus', () => {
  const { doc, $, chooser } = setup([owner()], {
    profile: { snapshot: emptyJourneyProfile },
  });
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
