import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { attachMissionLibraryChooser } from '../ui/mission-library-chooser.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const tick = () => new Promise((resolve) => setImmediate(resolve));
function fixture(t, { compact = false, sources, saved = null, ...options } = {}) {
  const doc = new Document();
  doc.defaultView.matchMedia = () => ({
    matches: compact,
    addEventListener() {},
    removeEventListener() {},
  });
  let launches = 0,
    preparations = 0,
    state = saved;
  const source = {
    id: 'current',
    collection: 'Classic',
    editionId: 'one',
    edition: 'Current edition',
    entries: [
      {
        id: 'harbor',
        levelIndex: 0,
        name: 'Harbor line',
        campaignKey: 'coast',
        campaignTitle: 'Coast',
        modes: ['solo', 'versus', 'team'],
      },
    ],
    describe: (row) => row,
    availability: () => ({ state: 'ready' }),
    launch: () => ++launches,
    prepare: () => ++preparations,
  };
  const library = createMissionLibrary(sources ?? [source]);
  const opener = doc.createElement('button');
  doc.body.append(opener);
  const chooser = attachMissionLibraryChooser({
    document: doc,
    library,
    readState: () => state,
    writeState: (value) => {
      state = structuredClone(value);
    },
    ...options,
  });
  chooser.open(opener);
  t.after(() => chooser.destroy());
  const $ = (id) => doc.getElementById(id);
  return {
    doc,
    library,
    chooser,
    opener,
    $,
    source,
    get launches() {
      return launches;
    },
    get preparations() {
      return preparations;
    },
    get saved() {
      return state;
    },
    change(id, value) {
      $(id).value = value;
      $(id).emit(id === 'journey-search' ? 'input' : 'change');
    },
  };
}

test('zero results explain query and selected filters in the existing status; recovery never starts play', (t) => {
  const p = fixture(t);
  p.change('journey-collection', 'Custom');
  p.change('journey-mode', 'team');
  p.change('journey-lifecycle', 'archive');
  p.change('journey-search', 'unmatched');
  const status = p.$('journey-chooser-status');
  assert.equal(status.getAttribute('role'), 'status');
  assert.match(status.textContent, /No missions match this search and these filters/);
  for (const label of ['Custom', 'Archive', 'Team']) assert.ok(status.textContent.includes(label));
  const reset = p.$('journey-filters-reset');
  assert.equal(reset.hidden, false);
  assert.equal(p.$('journey-filter-details').contains(reset), false);
  p.$('journey-detailed-cards').checked = true;
  p.$('journey-detailed-cards').emit('change');
  reset.focus();
  reset.click();
  assert.equal(p.$('journey-search').value, 'unmatched');
  assert.equal(p.$('journey-collection').value, '');
  assert.equal(p.$('journey-mode').value, 'solo');
  assert.equal(p.$('journey-lifecycle').value, 'current');
  assert.equal(p.$('journey-detailed-cards').checked, true);
  assert.equal(p.$('journey-chooser').classList.contains('mission-library-detailed'), true);
  assert.equal(reset.hidden, true);
  assert.match(status.textContent, /No missions match this search\. Clear or change/);
  assert.equal(p.doc.activeElement, p.$('journey-search'));
  assert.equal(p.launches, 0);
  assert.equal(p.preparations, 0);
  p.$('journey-search-clear').focus();
  p.$('journey-search-clear').click();
  assert.equal(p.$('journey-cards').children.length, 1);
  assert.equal(p.launches, 0);
  assert.doesNotMatch(status.textContent, /No missions/);
});

for (const compact of [false, true])
  test(`reset retains the accepted host mode and query with compact=${compact}`, (t) => {
    const p = fixture(t, { compact, mode: 'versus' });
    p.change('journey-collection', 'Custom');
    p.change('journey-mode', 'team');
    p.change('journey-search', 'Harbor');
    p.$('journey-filters-reset').focus();
    p.$('journey-filters-reset').click();
    assert.equal(p.chooser.state().mode, 'versus');
    assert.equal(p.chooser.state().search, 'Harbor');
    assert.equal(p.doc.activeElement, p.$('journey-cards').children[0]);
    p.$('journey-back').click();
    p.chooser.open(p.opener);
    assert.equal(p.chooser.state().mode, 'versus');
    assert.equal(p.chooser.state().search, 'Harbor');
    assert.equal(p.launches, 0);
  });

test('Clear search remains query-only when reset is offered', (t) => {
  const p = fixture(t, { compact: true });
  p.change('journey-collection', 'Custom');
  p.change('journey-lifecycle', 'archive');
  p.change('journey-mode', 'team');
  p.change('journey-search', 'no match');
  p.$('journey-search-clear').focus();
  p.$('journey-search-clear').click();
  assert.equal(p.$('journey-collection').value, 'Custom');
  assert.equal(p.$('journey-lifecycle').value, 'archive');
  assert.equal(p.$('journey-mode').value, 'team');
  assert.equal(p.$('journey-filters-reset').hidden, false);
  assert.equal(p.doc.activeElement, p.$('journey-filter-summary'));
  assert.match(p.$('journey-chooser-status').textContent, /No missions match these filters/);
});

test('a genuinely empty library differs from a current-mode view with no missions', (t) => {
  const empty = fixture(t, { sources: [] });
  assert.match(
    empty.$('journey-chooser-status').textContent,
    /No missions are listed in this view yet/,
  );
  assert.equal(empty.$('journey-filters-reset').hidden, true);
  const archived = fixture(t, {
    sources: [
      {
        id: 'old',
        collection: 'Classic',
        editionId: 'old',
        edition: 'Old',
        launch: () => false,
        availability: () => ({ state: 'ready' }),
        lifecycle: 'archive',
        entries: [
          {
            id: 'old',
            levelIndex: 0,
            name: 'Old route',
            campaignKey: 'old',
            campaignTitle: 'Old',
            modes: ['solo'],
          },
        ],
        describe: (row) => row,
      },
    ],
  });
  assert.match(
    archived.$('journey-chooser-status').textContent,
    /No missions match the current edition and mode/,
  );
  archived.change('journey-lifecycle', 'archive');
  assert.equal(archived.$('journey-cards').children.length, 1);
  assert.doesNotMatch(archived.$('journey-chooser-status').textContent, /No missions|no missions/);
});

test('visible unavailable missions retain their real cards rather than a false empty explanation', (t) => {
  const p = fixture(t);
  p.library.register({
    ...p.source,
    availability: () => ({ state: 'unavailable', reason: 'Needs repair.' }),
  });
  assert.equal(p.$('journey-cards').children.length, 1);
  assert.equal(p.$('journey-cards').children[0].disabled, true);
  assert.doesNotMatch(p.$('journey-chooser-status').textContent, /No missions|no missions/);
  assert.equal(p.$('journey-random-level').disabled, true);
});

for (const blocked of ['closed', 'hidden', 'blurred', 'destroyed'])
  test(`reset cannot change browsing state while ${blocked}`, (t) => {
    const p = fixture(t);
    p.change('journey-collection', 'Custom');
    p.change('journey-search', 'Keep me');
    const reset = p.$('journey-filters-reset');
    const before = p.chooser.state();
    if (blocked === 'closed') p.chooser.close();
    if (blocked === 'hidden') p.doc.hidden = true;
    if (blocked === 'blurred') p.doc.hasFocus = () => false;
    if (blocked === 'destroyed') p.chooser.destroy();
    reset.click();
    assert.deepEqual(p.chooser.state(), before);
    assert.equal(p.launches, 0);
    assert.equal(p.preparations, 0);
  });

test('reset retires pending download authority without admitting its later ready result', async (t) => {
  let finish,
    launches = 0,
    preparations = 0;
  const p = fixture(t, {
    sources: [
      {
        id: 'download',
        collection: 'Classic',
        editionId: 'one',
        edition: 'One',
        entries: [
          {
            id: 'route',
            levelIndex: 0,
            name: 'Route',
            campaignKey: 'one',
            campaignTitle: 'One',
            modes: ['solo'],
          },
        ],
        describe: (row) => row,
        availability: () => ({ state: 'download', bytes: 128 }),
        prepare: () => {
          preparations++;
          return new Promise((resolve) => {
            finish = resolve;
          });
        },
        launch: () => ++launches,
      },
    ],
  });
  p.change('journey-collection', 'Classic');
  p.$('journey-cards').children[0].click();
  await tick();
  assert.equal(preparations, 1);
  p.$('journey-filters-reset').focus();
  p.$('journey-filters-reset').click();
  const focused = p.doc.activeElement;
  finish({ state: 'ready' });
  await tick();
  assert.equal(launches, 0);
  assert.equal(preparations, 1);
  assert.equal(p.$('journey-chooser').open, true);
  assert.equal(p.doc.activeElement, focused);
});

test('reset does not reclaim focus from reentrant host persistence', (t) => {
  let intervene = false;
  const p = fixture(t, {
    writeState() {
      if (intervene) p.opener.focus();
    },
  });
  p.change('journey-collection', 'Custom');
  p.$('journey-filters-reset').focus();
  intervene = true;
  p.$('journey-filters-reset').click();
  assert.equal(p.doc.activeElement, p.opener);
  assert.equal(p.launches, 0);
});

test('existing controller can reach and activate browse-only Reset filters', (t) => {
  const p = fixture(t);
  p.change('journey-collection', 'Custom');
  const navigation = attachControllerNavigation({
    document: p.doc,
    getRoot: () => p.$('journey-chooser'),
    getScope: () => 'missions',
  });
  t.after(() => navigation.destroy());
  p.$('journey-search').focus();
  for (let step = 0; step < 16 && p.doc.activeElement !== p.$('journey-filters-reset'); step++)
    navigation.handle({ direction: 'right' });
  assert.equal(p.doc.activeElement, p.$('journey-filters-reset'));
  navigation.handle({ confirm: true });
  assert.equal(p.chooser.state().collection, '');
  assert.equal(p.doc.activeElement, p.$('journey-cards').children[0]);
  assert.equal(p.launches, 0);
});

test('Ukrainian recovery updates the existing status and buttons without moving field focus', (t) => {
  const locale = getLocale();
  t.after(() => setLocale(locale));
  setLocale('en');
  const p = fixture(t, { compact: true });
  p.change('journey-collection', 'Custom');
  p.change('journey-mode', 'team');
  p.change('journey-lifecycle', 'archive');
  p.change('journey-search', 'no match');
  const status = p.$('journey-chooser-status'),
    reset = p.$('journey-filters-reset');
  p.$('journey-search').focus();
  setLocale('uk');
  assert.equal(p.$('journey-chooser-status'), status);
  assert.equal(p.$('journey-filters-reset'), reset);
  assert.match(reset.textContent, /Скинути фільтри/);
  for (const label of ['Архів', 'Команда']) assert.ok(status.textContent.includes(label));
  assert.match(status.textContent, /Жодна місія/);
  assert.equal(p.doc.activeElement, p.$('journey-search'));
  assert.equal(p.$('journey-filter-details').open, false);
});

test('an empty refreshed list preserves the current failed-download feedback', async (t) => {
  const p = fixture(t);
  p.library.register({
    ...p.source,
    availability: () => ({ state: 'download', bytes: 128 }),
    prepare() {
      throw new Error('Network unavailable');
    },
  });
  p.$('journey-cards').children[0].click();
  await tick();
  assert.match(p.$('journey-chooser-status').textContent, /Network unavailable/);
  p.library.remove(p.source.id);
  assert.equal(p.$('journey-cards').children.length, 0);
  assert.match(
    p.$('journey-chooser-status').textContent,
    /No missions are listed in this view yet/,
  );
  assert.match(p.$('journey-chooser-status').textContent, /Network unavailable/);
  assert.equal(p.launches, 0);
});
