import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { Document } from './helpers/couch-dom.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import {
  NATIVE_PURSUIT_CATALOGUE,
  NATIVE_PURSUIT_V2_CATALOGUE,
} from '../../optional-practice/civilian-fpv/native-pursuit-courses.mjs';
import {
  militaryCoreLevels,
  militaryFlightLevels,
  loadMilitaryFlightLevels,
  filterMilitaryLevels,
  militaryLevelURL,
} from '../hunt/military-level-catalogue.mjs';
import { mountMilitaryLevelDirectory } from '../hunt/military-levels.mjs';

const base = 'http://localhost/game/hunt/military-levels.html';
const rows = militaryCoreLevels();
const flightRows = militaryFlightLevels([
  ...NATIVE_PURSUIT_V2_CATALOGUE,
  ...NATIVE_PURSUIT_CATALOGUE,
]);
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function fixture(t, options = {}) {
  const document = new Document();
  const source = parse(
    await readFile(new URL('../hunt/military-levels.html', import.meta.url), 'utf8'),
  );
  function append(parent, item) {
    if (item.nodeName === '#text') {
      parent.append(document.createTextNode(item.value));
      return;
    }
    if (!item.tagName) {
      for (const child of item.childNodes ?? []) append(parent, child);
      return;
    }
    const element = document.createElement(item.tagName);
    for (const { name, value } of item.attrs ?? []) element.setAttribute(name, value);
    const value = item.attrs?.find((attr) => attr.name === 'value');
    if (value) element.value = value.value;
    if (item.attrs?.some((attr) => attr.name === 'checked')) element.checked = true;
    if (item.attrs?.some((attr) => attr.name === 'hidden')) element.hidden = true;
    parent.append(element);
    for (const child of item.childNodes ?? []) append(element, child);
    if (element.tagName === 'SELECT') {
      element.options = element.children.filter((child) => child.tagName === 'OPTION');
      element.value = element.options[0]?.value ?? '';
    }
  }
  append(document.body, source);
  const changes = [],
    applied = [];
  let state = { style: 'authored', durable: true };
  const artwork = {
    set(value) {
      changes.push(value);
      state = { ...state, ...value };
    },
    snapshot: () => state,
  };
  const directory = mountMilitaryLevelDirectory({
    document,
    href: base,
    rows,
    loadFlights: async () => flightRows,
    artwork,
    applyMilitary: async () => applied.push('military-field'),
    ...options,
  });
  t.after(() => directory.dispose());
  return { document, $: (id) => document.getElementById(id), directory, changes, applied };
}

test('directory derives current Capture chapters and all actual Snake layouts without duplicate pilot entries', () => {
  assert.equal(rows.filter((row) => row.engine === 'capture').length, 175);
  assert.deepEqual(
    rows.filter((row) => row.engine === 'snake').map((row) => row.id),
    CLASSIC_SNAKE_LEVELS.map((row) => row.id),
  );
  assert.equal(new Set(rows.map((row) => row.key)).size, rows.length);
  for (const id of ['crossing-post', 'pincer-yard', 'relay-rendezvous']) {
    const found = rows.filter((row) => row.id === id);
    assert.equal(found.length, 1);
    assert.equal(found[0].journey, 'pursuit-pilots-v1');
  }
  assert.deepEqual(rows.find((row) => row.id === 'classic-living-cable-cutoff').families, [
    'refuge-seeker',
    'switchback',
  ]);
  assert.deepEqual(rows.find((row) => row.id === 'return-in-reserve').families, []);
  assert.deepEqual(rows.find((row) => row.id === 'first-fracture').vehicles, [
    'tracked-tank',
    'utility-car',
    'armored-carrier',
  ]);
  for (const row of rows.filter((row) => row.engine === 'snake'))
    assert.deepEqual(row.vehicles, []);
  assert.ok(
    rows
      .filter((row) => row.modes[0] === 'team')
      .every((row) => row.vehicles.every((role) => role === 'utility-car')),
  );
});

test('SIM directory keeps exact current revisions, optional Courier and native authored vehicle identities', async () => {
  assert.equal(flightRows.length, 6);
  const refuge = flightRows.find((row) => row.id === 'native-pursuit-refuge-return');
  assert.match(refuge.title.en, /Committed routes/);
  assert.deepEqual(refuge.families, ['refuge-seeker', 'courier']);
  assert.deepEqual(refuge.vehicles, ['armored-carrier']);
  assert.deepEqual(
    flightRows.find((row) => row.id === 'native-pursuit-armor-windows').vehicles,
    [],
  );
  const all = await loadMilitaryFlightLevels();
  assert.equal(all.length, 54);
  assert.equal(new Set(all.map((row) => row.id)).size, 54);
});

test('native links preserve deployment roots, accepted preview and exact route semantics without silently applying appearance', () => {
  for (const origin of [
    'https://example.test/site/',
    'file:///app/site/',
    'capacitor://localhost/',
  ]) {
    const href = `${origin}game/hunt/military-levels.html?lang=en&artReview=industrial-roster-v3`;
    for (const id of ['crossing-post', 'pincer-yard', 'classic-living-shield-window']) {
      const row = rows.find((row) => row.id === id);
      for (const mode of row.modes) {
        const url = new URL(militaryLevelURL(row, mode, href, 'uk'));
        assert.equal(url.searchParams.get('lang'), 'uk');
        assert.equal(url.searchParams.get('artReview'), 'industrial-roster-v3');
        assert.equal(url.searchParams.has('appearanceFamily'), false);
        assert.ok(url.href.startsWith(origin));
        if (row.engine === 'capture') {
          assert.equal(url.searchParams.get('journey'), 'pursuit-pilots-v1');
          assert.equal(url.searchParams.has('mission'), false);
          assert.equal(url.searchParams.has('level'), false);
        } else {
          assert.equal(url.searchParams.get('level'), row.id);
          assert.equal(url.searchParams.get('mode'), mode);
        }
      }
    }
    const flight = new URL(militaryLevelURL(flightRows[0], 'sim', href));
    assert.equal(flight.searchParams.get('snake-course'), flightRows[0].id);
    assert.equal(
      flight.pathname,
      new URL('optional-practice/fpv-worlds/index.html', origin).pathname,
    );
  }
  assert.equal(
    new URL(militaryLevelURL(rows[0], 'solo', base)).searchParams.has('artReview'),
    false,
  );
  assert.throws(() => militaryLevelURL(rows[0], 'sim', base), /available level mode/);
});

test('search finds exact English/Ukrainian titles and filters compatible modes/vehicle presence', () => {
  assert.equal(
    filterMilitaryLevels(rows, { query: 'A return in reserve' })[0].id,
    'return-in-reserve',
  );
  assert.equal(
    filterMilitaryLevels(rows, { query: 'Кабельний заслін', locale: 'uk' })[0].id,
    'classic-living-cable-cutoff',
  );
  assert.deepEqual(filterMilitaryLevels(rows, { query: 'classic-living-', vehicles: 'yes' }), []);
  assert.ok(
    filterMilitaryLevels(rows, { mode: 'team', vehicles: 'yes' }).every(
      (row) => row.modes.includes('team') && row.vehicles.length,
    ),
  );
});

test('real directory markup starts with recommendations, searches all levels, bounds cards and keeps exact links', async (t) => {
  const f = await fixture(t, {
    href: `${base}?artReview=industrial-roster-v3`,
    locale: () => 'uk',
  });
  await f.directory.ready;
  assert.deepEqual(f.changes, []);
  assert.deepEqual(f.applied, []);
  assert.match(f.$('intro').textContent, /Набір оформлення ворогів/);
  assert.ok(f.$('levels').children.length < 36);
  f.$('search').value = 'A return in reserve';
  f.$('search').emit('input');
  assert.equal(f.$('featured').checked, false);
  assert.equal(f.$('levels').children.length, 1);
  assert.match(f.$('levels').textContent, /Відкривається добірка/);
  const link = f.$('levels').querySelector('a');
  assert.equal(new URL(link.href).searchParams.get('journey'), 'whole-spatial-v25');
  assert.equal(new URL(link.href).searchParams.get('artReview'), 'industrial-roster-v3');
  f.$('search').value = '';
  f.$('search').emit('input');
  assert.equal(f.$('levels').children.length, 36);
  f.$('more').click();
  assert.equal(f.$('levels').children.length, 72);
  f.$('mode').value = 'sim';
  f.$('mode').emit('change');
  assert.equal(f.$('levels').children.length, 6);
  assert.match(f.$('levels').textContent, /не входить до обов’язкової квоти/);
});

test('Military Field changes both shared appearance choices only after an explicit action and joins preparation', async (t) => {
  const gate = deferred();
  const f = await fixture(t, { applyMilitary: () => gate.promise });
  await f.directory.ready;
  assert.equal(f.changes.length, 0);
  f.$('apply').click();
  f.$('apply').click();
  assert.deepEqual(f.changes, [{ style: 'military' }]);
  assert.equal(f.$('apply').disabled, true);
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.$('apply').disabled, false);
  assert.match(f.$('apply-status').textContent, /Military Field selected/);
});

test('optional course failure leaves Capture/Snake searchable and denied preference persistence is honest', async (t) => {
  const f = await fixture(t, {
    loadFlights: async () => {
      throw new Error('Optional package absent');
    },
    artwork: { set() {}, snapshot: () => ({ style: 'military', durable: false }) },
  });
  await f.directory.ready;
  assert.match(f.$('flight-status').textContent, /Flight catalogue unavailable/);
  assert.ok(f.$('levels').children.length);
  f.$('apply').click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(f.$('apply-status').textContent, /could not be saved/);
  assert.doesNotMatch(f.$('apply-status').textContent, /selected/);
});

test('retired directory ignores late optional responses and appearance failures can be retried', async (t) => {
  const gate = deferred();
  const f = await fixture(t, {
    loadFlights: () => gate.promise,
    applyMilitary: async () => {
      throw new Error('Decode unavailable');
    },
  });
  f.$('apply').click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(f.$('apply-status').textContent, /could not be prepared/);
  assert.equal(f.$('apply').disabled, false);
  const count = f.$('levels').children.length;
  f.directory.dispose();
  gate.resolve(flightRows);
  await f.directory.ready;
  assert.equal(f.$('levels').children.length, count);
  assert.match(f.$('flight-status').textContent, /Loading/);
});

test('explicit directory preset clears its supported review pin and refreshes owned level and menu links', async (t) => {
  const location = { href: `${base}?lang=uk&artReview=industrial-overhead-v2#kept` },
    replacements = [],
    history = {
      state: { owner: 'directory' },
      replaceState(state, title, href) {
        replacements.push({ state, title, href });
        location.href = href;
      },
    },
    f = await fixture(t, { href: location.href, location, history });
  await f.directory.ready;
  for (const link of f.$('levels').querySelectorAll('a'))
    assert.equal(new URL(link.href).searchParams.get('artReview'), 'industrial-overhead-v2');
  assert.deepEqual(replacements, []);
  f.$('apply').click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(location.href, `${base}?lang=uk#kept`);
  assert.equal(replacements.length, 1);
  assert.equal(replacements[0].state, history.state);
  assert.deepEqual(f.applied, ['military-field']);
  assert.deepEqual(f.changes, [{ style: 'military' }]);
  for (const link of [
    ...f.$('levels').querySelectorAll('a'),
    ...f.document.querySelectorAll('a[data-native-review-link]'),
  ])
    assert.equal(new URL(link.href).searchParams.has('artReview'), false);
  f.directory.refresh();
  assert.equal(replacements.length, 1, 'Rendering cannot rewrite browser history');
});
