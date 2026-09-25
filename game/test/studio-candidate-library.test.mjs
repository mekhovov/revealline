import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document } from './helpers/couch-dom.mjs';
import { mountCouch } from './helpers/mount-html.mjs';
import { createCandidateLibrary } from '../studio/candidate-library.mjs';
import { getLocale, setLocale, t } from '../i18n/index.mjs';

const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
const controls = [
  'opening',
  'border',
  'timed-border',
  'combat-study',
  'cultural-workshop',
  'pursuit-intercept',
  'whole-spatial',
  'whole-field',
  'whole-timed',
  'whole-variety',
  'fracture-spatial',
  'phase-spatial',
  'sentinel-spatial',
  'apex-spatial',
  'apex-field',
  'whole-journey',
  'whole-journey-actors',
  'team-journey',
  'team-timed',
  'team-timed-originals',
  'team-signal',
  'signal',
  'neon',
  'rover',
  'fracture',
  'phase',
  'livewire',
  'relay',
  'crosswind',
  'sentinel',
  'apex',
];
function setup() {
  const document = new Document();
  mountCouch(document, html);
  const $ = (id) => document.getElementById(id);
  const api = createCandidateLibrary({ document });
  const entries = [...$('candidate-library').querySelectorAll('[data-library-entry]')];
  const visible = () => entries.filter((entry) => !entry.hidden);
  const search = (value) => {
    $('candidate-search').value = value;
    $('candidate-search').emit('input');
  };
  return { document, $, api, entries, visible, search };
}

for (const initialLocale of ['en', 'uk'])
  test(`candidate search includes both catalog languages from ${initialLocale} startup and preserves its controls`, () => {
    const previous = getLocale();
    try {
      setLocale(initialLocale, { persist: false });
      const { document, $, visible, search, entries } = setup();
      for (const [query, id] of [
        ['внутрішнього приймача', 'sentinel-spatial'],
        ['inner receiver', 'sentinel-spatial'],
        ['Культурні з’єднання Горизонту', 'whole-variety'],
        ['whole-spatial-v11', 'whole-variety'],
      ]) {
        search(query);
        assert.equal(visible().length, 1, query);
        assert(visible()[0].querySelector('#' + id), query);
      }
      const accepted = visible()[0];
      const options = [...$('whole-variety-edition').options];
      $('whole-variety-edition').value = 'horizon-cultural-joins-1';
      $('source').value = '{"unapplied":"Україна"}';
      $('project-id').value = 'custom-project';
      $('checkpoint').value = '7';
      $('apply').disabled = true;
      $('candidate-search').focus();
      $('candidate-search').selectionStart = 1;
      $('candidate-search').selectionEnd = 3;
      $('candidate-library').scrollTop = 47;
      for (const locale of ['uk', 'en', 'uk', 'en']) {
        setLocale(locale, { persist: false });
        assert.equal(visible()[0], accepted);
        assert.equal(visible().length, 1);
        assert.deepEqual(
          [...$('candidate-library').querySelectorAll('[data-library-entry]')],
          entries,
        );
        assert.equal(
          $('candidate-count').textContent,
          locale === 'uk'
            ? 'Показано 1 запис із 31. Деякі записи мають спільні елементи вибору версії.'
            : '1 of 31 entries shown. Some entries share edition controls.',
        );
        assert.equal($('candidate-search').value, 'whole-spatial-v11');
        assert.equal($('source').value, '{"unapplied":"Україна"}');
        assert.equal($('project-id').value, 'custom-project');
        assert.equal($('checkpoint').value, '7');
        assert.equal($('apply').disabled, true);
        assert.equal(document.activeElement, $('candidate-search'));
        assert.equal($('candidate-search').selectionStart, 1);
        assert.equal($('candidate-search').selectionEnd, 3);
        assert.equal($('candidate-library').scrollTop, 47);
        assert.equal($('whole-variety-edition').value, 'horizon-cultural-joins-1');
        assert.deepEqual([...$('whole-variety-edition').options], options);
      }
    } finally {
      setLocale(previous, { persist: false });
    }
  });

test('translated inspection feedback retains authored names and cannot revive a cleared inspection', () => {
  const previous = getLocale();
  const { $, api } = setup();
  try {
    api.reportInspection(() =>
      t('tools:studio.library.inspected', { name: '<my draft>', count: 2 }),
    );
    setLocale('uk', { persist: false });
    assert.equal(
      $('candidate-inspection-status').textContent,
      '<my draft>: перевірено 2 місії. Застосовану чернетку не змінено. Переглянь джерело перед застосуванням.',
    );
    assert.equal($('candidate-inspection-status').children.length, 0);
    setLocale('en', { persist: false });
    assert.match($('candidate-inspection-status').textContent, /^<my draft>: 2 missions inspected/);
    api.clearInspection();
    setLocale('uk', { persist: false });
    assert.equal($('candidate-inspection-status').textContent, '');
    assert.equal($('candidate-inspection').hidden, true);
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('Ukrainian candidate and inspection counters use the correct plural forms', () => {
  const previous = getLocale();
  try {
    setLocale('uk', { persist: false });
    for (const [count, display, entry, mission] of [
      [0, '0', 'записів', 'місій'],
      [1, '1', 'запис', 'місію'],
      [2, '2', 'записи', 'місії'],
      [5, '5', 'записів', 'місій'],
      [11, '11', 'записів', 'місій'],
      [21, '21', 'запис', 'місію'],
      [22, '22', 'записи', 'місії'],
      [1.5, '1,5', 'запису', 'місії'],
    ]) {
      assert.equal(
        t('tools:studio.library.matches', { count, total: 31 }),
        `Показано ${display} ${entry} із 31. Деякі записи мають спільні елементи вибору версії.`,
      );
      assert.equal(
        t('tools:studio.library.inspected', { count, name: 'Тест' }),
        `Тест: перевірено ${display} ${mission}. Застосовану чернетку не змінено. Переглянь джерело перед застосуванням.`,
      );
    }
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('closed library preserves every static Inspect action, paired edition controls and workbench actions', () => {
  const { document, $, entries } = setup();
  assert.equal($('candidate-library').open, false);
  assert.equal(entries.length, 31);
  const actual = [...$('candidate-library').querySelectorAll('button')]
    .map((button) => button.id)
    .filter((id) => id !== 'candidate-reset');
  assert.deepEqual(actual.toSorted(), controls.toSorted());
  for (const id of controls) {
    assert.equal(document.querySelectorAll('#' + id).length, 1);
    assert.equal($(id).closest('form'), null);
  }
  assert.equal(
    $('rover-edition').closest('[data-library-entry]'),
    $('rover').closest('[data-library-entry]'),
  );
  assert.equal(
    $('spatial-edition').closest('[data-library-entry]'),
    $('pursuit-intercept').closest('[data-library-entry]'),
  );
  assert.equal(
    $('spatial-edition').closest('[data-library-entry]'),
    $('cultural-workshop').closest('[data-library-entry]'),
  );
  for (const id of ['undo', 'redo', 'save', 'export', 'import', 'pressure-edition']) {
    assert.equal($(id).closest('#candidate-library'), null);
  }
  assert.equal($('map-workbench').getAttribute('aria-label'), 'Map workbench');
  for (const group of ['journey', 'chapters', 'mechanics', 'team', 'players'])
    assert.equal($('candidate-group-' + group).tagName, 'H2');
});

test('Sorting successor search preserves the paired Rover edition selector and Inspect action', () => {
  const { search, visible, $ } = setup();
  search('rover sorting');
  assert.equal(visible().length, 1);
  assert.equal(visible()[0], $('rover').closest('[data-library-entry]'));
  assert(visible()[0].querySelector('#rover-edition'));
});

test('inner receiver search keeps the original edition and explicit Inspect in the same entry', () => {
  const { search, visible, $ } = setup();
  search('inner receiver');
  assert.equal(visible().length, 1);
  assert.equal(visible()[0], $('sentinel-spatial').closest('[data-library-entry]'));
  assert.equal($('sentinel-spatial-edition').closest('[data-library-entry]'), visible()[0]);
  const editions = [...$('sentinel-spatial-edition').querySelectorAll('option')];
  assert.deepEqual(
    editions.map((option) => [option.value, option.textContent.trim()]),
    [
      ['original', 'Original receiver galleries'],
      ['inner', 'Inner receiver approach · balance pending'],
    ],
  );
  assert.equal($('sentinel-spatial-edition').value, 'original');
  assert.equal(editions[0].hasAttribute('selected'), false);
});

test('outer-pocket search preserves the Shared windows edition selector beside its Inspect action', () => {
  const { search, visible, $ } = setup();
  search('contested outer pockets');
  assert.equal(visible().length, 1);
  assert.equal(visible()[0], $('team-timed-originals').closest('[data-library-entry]'));
  assert.equal($('team-window-edition').closest('[data-library-entry]'), visible()[0]);
});

test('Team pressure search keeps edition choice, original Inspect and bundled player together', () => {
  const { $, visible, search } = setup();
  search('team-pressure-originals-1');
  assert.equal(visible().length, 1);
  assert.equal($('team-journey-edition').closest('[data-library-entry]'), visible()[0]);
  assert.equal($('team-journey').closest('[data-library-entry]'), visible()[0]);
});

test('all review routes keep explicit external-tab safety and distinct accessible labels', () => {
  const { $ } = setup();
  const links = [...$('candidate-library').querySelectorAll('a')].filter(
    (link) => link.getAttribute('target') === '_blank',
  );
  const journeys = [
    'whole-ornament-v2',
    'whole-ornament-v1',
    'whole-spatial-v11',
    'whole-spatial-v10',
    'whole-spatial-v9',
    'whole-spatial-v8',
    'whole-spatial-v7',
    'whole-spatial-v6',
    'whole-spatial-v4',
    'whole-spatial-v5',
    'whole-spatial-v3',
    'whole-spatial-v2',
    'whole-spatial-v1',
    'whole-originals-v4',
    'whole-originals-v3',
    'authored',
  ];
  const expected = journeys.flatMap((id) => ['../?journey=' + id, '../couch/?journey=' + id]);
  expected.push(
    '../presentation/journey-actor-review.html',
    '../couch/relay-rescue.html?journey=team-timed-originals',
    '../couch/relay-rescue.html?journey=team-window-spatial-1',
    '../couch/relay-rescue.html?journey=team-depot-spatial-1',
    '../couch/relay-rescue.html?journey=team-pressure-originals-1',
    '../couch/relay-rescue.html?journey=team-spatial-originals-1',
    '../couch/relay-rescue.html?journey=team-trail-impact-originals-1',
    '../couch/relay-rescue.html?journey=team-specialist-originals-1',
  );
  assert.deepEqual(links.map((link) => link.getAttribute('href')).toSorted(), expected.toSorted());
  const labels = links.map((link) => link.getAttribute('aria-label'));
  assert.equal(new Set(labels).size, links.length);
  for (const link of links) {
    assert.equal(link.getAttribute('rel'), 'noopener');
    assert.match(link.getAttribute('aria-label'), /new tab/);
    const href = link.getAttribute('href');
    const edition = href.split('journey=')[1];
    if (edition && href.includes('relay-rescue')) {
      assert.equal(
        link.getAttribute('aria-label'),
        edition === 'team-specialist-originals-1'
          ? 'Play bundled Team specialist test (does not include draft edits) · team-specialist-originals-1 (new tab)'
          : edition === 'team-trail-impact-originals-1'
            ? 'Play bundled Team travelling-impact test (does not include draft edits) · team-trail-impact-originals-1 (new tab)'
            : edition === 'team-spatial-originals-1'
              ? 'Play bundled Team changing-return test (does not include draft edits) · team-spatial-originals-1 (new tab)'
              : edition === 'team-pressure-originals-1'
                ? 'Play bundled Team pressure test (does not include draft edits) · team-pressure-originals-1 (new tab)'
                : edition === 'team-depot-spatial-1'
                  ? 'Play bundled depot-lane test (does not include draft edits) · team-depot-spatial-1 (new tab)'
                  : edition === 'team-window-spatial-1'
                    ? 'Play bundled outer-pocket test (does not include draft edits) · team-window-spatial-1 (new tab)'
                    : 'Play bundled Shared windows test (does not include draft edits) · team-timed-originals (new tab)',
      );
    } else if (edition) {
      const mode = href.includes('/couch/') ? 'Versus' : 'Solo';
      assert.equal(link.getAttribute('aria-label'), `${mode} · ${edition} (new tab)`);
    } else {
      assert.equal(
        link.getAttribute('aria-label'),
        'Body studies · actor-material body studies (new tab)',
      );
    }
  }
  assert.equal(documentFromHelpLabel(html), 'Team test player (new tab)');
});

function documentFromHelpLabel(markup) {
  const document = new Document();
  mountCouch(document, markup);
  return document.getElementById('team-test-help').querySelector('a').getAttribute('aria-label');
}

test('each category retains its authored cohort and resetting never reorders entries', () => {
  const { $, entries, visible } = setup();
  for (const [category, count] of [
    ['all', 31],
    ['journey', 6],
    ['chapters', 12],
    ['mechanics', 8],
    ['team', 4],
    ['players', 1],
  ]) {
    $('candidate-category').value = category;
    $('candidate-category').emit('change');
    assert.equal(visible().length, count, category);
  }
  $('candidate-reset').emit('click');
  assert.deepEqual(visible(), entries);
});

test('global token search finds copy, keywords, controls and edition routes with case/diacritic folding', () => {
  const { search, visible } = setup();
  for (const [query, id] of [
    ['  COOLANT   FREEZE  ', 'team-timed-originals'],
    ['výshyvanka', 'cultural-workshop'],
    ['whole-spatial-v4', 'whole-variety'],
    ['fracture-spatial', 'fracture-spatial'],
  ]) {
    search(query);
    assert.equal(visible().length, 1, query);
    assert(visible()[0].querySelector('#' + id), query);
  }
});

test('category and search intersect, empty groups disappear, reset restores order and search focus', () => {
  const { document, $, search, visible, entries } = setup();
  $('candidate-category').value = 'chapters';
  $('candidate-category').emit('change');
  assert.equal(visible().length, 12);
  search('neon');
  assert.equal(visible().length, 1);
  for (const query of ['[', '?', '"', 'no matching mission']) {
    search(query);
    if (query === '?') continue; // Literal query syntax is searchable in test-route hrefs.
    assert.equal(visible().length, 0);
    assert.equal($('candidate-empty').hidden, false);
  }
  assert(
    [...$('candidate-library').querySelectorAll('[data-library-group]')].every((g) => g.hidden),
  );
  $('candidate-reset').emit('click');
  assert.deepEqual(visible(), entries);
  assert.equal(document.activeElement, $('candidate-search'));
  assert.equal($('candidate-empty').hidden, true);
  assert.match($('candidate-count').textContent, /^31 of 31 entries/);
});

test('browsing never edits source, Apply, project/checkpoint, global status, or candidate handlers', () => {
  const { $, search } = setup();
  const state = {
    source: 'unapplied JSON',
    'project-id': 'private-draft',
    checkpoint: '7',
  };
  for (const [id, value] of Object.entries(state)) $(id).value = value;
  $('apply').disabled = true;
  $('status').textContent = 'Unsaved local work';
  let inspections = 0;
  $('whole-variety').onclick = () => inspections++;
  search('ornament');
  $('candidate-category').value = 'team';
  $('candidate-category').emit('change');
  $('candidate-reset').emit('click');
  for (const [id, value] of Object.entries(state)) assert.equal($(id).value, value);
  assert.equal($('apply').disabled, true);
  assert.equal($('status').textContent, 'Unsaved local work');
  assert.equal(inspections, 0);
  $('whole-variety').emit('click');
  assert.equal(inspections, 1);
});

test('inspection feedback is explicit, survives filtering and offers deliberate source focus only', () => {
  const { document, $, api, search } = setup();
  assert.equal($('candidate-inspection').hidden, true);
  $('candidate-library').open = true;
  api.reportInspection('Compiled; Apply to replace the draft.');
  assert.equal($('candidate-library').open, true);
  assert.equal($('candidate-inspection').hidden, false);
  search('no match');
  assert.equal($('candidate-inspection').hidden, false);
  $('candidate-review').emit('click');
  assert.equal($('candidate-library').open, false);
  assert.equal(document.activeElement, $('source'));
  assert.equal($('candidate-search').value, 'no match');
  api.clearInspection();
  assert.equal($('candidate-inspection').hidden, true);
  assert.equal($('candidate-inspection-status').textContent, '');
});

test('host reports success only after compilation and clears feedback at every invalidation boundary', async () => {
  const host = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const inspect = host.slice(
    host.indexOf('function inspectSource('),
    host.indexOf("$('source').addEventListener('input'"),
  );
  assert(
    inspect.indexOf('candidateLibrary.clearInspection()') <
      inspect.indexOf('compileContentProject'),
  );
  assert(
    inspect.indexOf('candidateLibrary.reportInspection(') >
      inspect.indexOf("$('apply').disabled = false"),
  );
  for (const assignment of host.matchAll(/inspected = null;/g)) {
    assert.match(
      host.slice(assignment.index, assignment.index + 100),
      /candidateLibrary.clearInspection\(\)/,
    );
  }
  const handlers = host.slice(
    host.indexOf("$('opening').onclick"),
    host.indexOf("$('undo').onclick"),
  );
  assert.doesNotMatch(handlers, /candidateLibrary.reportInspection/);
  const css = await readFile(new URL('../studio/studio.css', import.meta.url), 'utf8');
  assert.match(css, /\.candidate-library \[hidden\] \{\s*display: none;/);
});
