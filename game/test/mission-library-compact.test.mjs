import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document } from './helpers/couch-dom.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { attachMissionLibraryChooser } from '../ui/mission-library-chooser.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';

function setup({ compact = true } = {}) {
  const doc = new Document(),
    listeners = new Set();
  let launches = 0,
    observations = 0;
  const media = {
    matches: compact,
    addEventListener(type, listener) {
      assert.equal(type, 'change');
      listeners.add(listener);
    },
    removeEventListener(type, listener) {
      assert.equal(type, 'change');
      listeners.delete(listener);
    },
  };
  doc.defaultView.matchMedia = (query) => {
    assert.equal(query, '(max-width: 600px), (max-height: 720px)');
    return media;
  };
  doc.defaultView.IntersectionObserver = class {
    observe() {
      observations++;
    }
    unobserve() {}
    disconnect() {}
  };
  const library = createMissionLibrary([
    {
      id: 'retained',
      collection: 'Classic',
      editionId: 'original-v1',
      edition: 'Original edition',
      entries: [
        {
          id: 'late',
          name: 'Last mission',
          campaignKey: 'original-campaign',
          campaignTitle: 'Original campaign',
          levelIndex: 10,
          modes: ['solo', 'versus'],
          tags: ['FPV'],
          rules: '65% coverage · 3 lives',
        },
      ],
      describe: (row) => row,
      availability: () => ({ state: 'ready' }),
      launch: () => {
        launches++;
        return true;
      },
    },
  ]);
  const opener = doc.createElement('button');
  doc.body.append(opener);
  const chooser = attachMissionLibraryChooser({ document: doc, library });
  chooser.open(opener);
  return {
    doc,
    chooser,
    opener,
    $: (id) => doc.getElementById(id),
    get launches() {
      return launches;
    },
    get observations() {
      return observations;
    },
    get listenerCount() {
      return listeners.size;
    },
    resize(matches) {
      media.matches = matches;
      for (const listener of listeners) listener(media);
    },
  };
}

test('compact chooser keeps search outside collapsed filters and preserves filter state on Back', () => {
  const p = setup();
  const filters = p.$('journey-filter-details');
  assert.equal(filters.open, false);
  assert.equal(filters.contains(p.$('journey-search')), false);
  assert.equal(filters.contains(p.$('journey-search-clear')), false);
  assert.equal(
    p.$('journey-search-clear').parentElement,
    p.$('journey-search').parentElement.parentElement,
  );
  assert.equal(p.$('journey-back').parentElement.contains(p.$('journey-search-clear')), false);
  for (const id of ['journey-collection', 'journey-campaign', 'journey-mode'])
    assert.equal(filters.contains(p.$(id)), true);
  filters.open = true;
  p.$('journey-collection').value = 'Classic';
  p.$('journey-collection').emit('change');
  p.$('journey-search').value = 'Last';
  p.$('journey-search').emit('input');
  filters.open = false;
  assert.equal(p.$('journey-filter-summary').textContent, 'Filters · active');
  assert.equal(p.$('journey-cards').children.length, 1);
  p.$('journey-back').click();
  assert.equal(p.doc.activeElement, p.opener);
  p.chooser.open(p.opener);
  assert.equal(p.$('journey-search').value, 'Last');
  assert.equal(p.$('journey-collection').value, 'Classic');
  assert.equal(filters.open, false);
  assert.equal(p.launches, 0);
  p.chooser.destroy();
  assert.equal(p.listenerCount, 0);
});

test('clearing search with an empty mode keeps compact filters and sends focus to their reachable summary', () => {
  const p = setup();
  p.$('journey-mode').value = 'team';
  p.$('journey-mode').emit('change');
  p.$('journey-search').value = 'no matches';
  p.$('journey-search').emit('input');
  p.$('journey-search-clear').focus();
  p.$('journey-search-clear').click();
  assert.equal(p.$('journey-search-clear').hidden, true);
  assert.equal(p.$('journey-mode').value, 'team');
  assert.equal(p.$('journey-filter-details').open, false);
  assert.equal(p.doc.activeElement, p.$('journey-filter-summary'));
  assert.equal(p.launches, 0);
  p.chooser.destroy();
});

test('compact Filters close when checkbox focus moves to a card or footer, retaining values and focus', () => {
  const p = setup();
  const filters = p.$('journey-filter-details'),
    detail = p.$('journey-detailed-cards');
  assert.equal(p.doc.activeElement, p.$('journey-cards').children[0]);
  p.$('journey-filter-summary').focus();
  filters.open = true;
  p.$('journey-collection').focus();
  p.$('journey-collection').value = 'Classic';
  p.$('journey-collection').emit('change');
  assert.equal(filters.open, true);
  assert.equal(p.doc.activeElement, p.$('journey-collection'));
  p.$('journey-mode').focus();
  p.$('journey-mode').value = 'versus';
  p.$('journey-mode').emit('change');
  assert.equal(filters.open, true);
  assert.equal(p.doc.activeElement, p.$('journey-mode'));
  detail.focus();
  detail.click();
  assert.equal(filters.open, true);
  assert.equal(p.doc.activeElement, detail);
  const card = p.$('journey-cards').children[0];
  card.focus();
  assert.equal(filters.open, false);
  assert.equal(p.doc.activeElement, card);
  p.$('journey-back').focus();
  assert.equal(filters.open, false);
  assert.equal(p.doc.activeElement, p.$('journey-back'));
  filters.open = true;
  detail.focus();
  p.$('journey-back').focus();
  assert.equal(filters.open, false);
  assert.equal(p.doc.activeElement, p.$('journey-back'));
  assert.equal(p.$('journey-collection').value, 'Classic');
  assert.equal(p.$('journey-mode').value, 'versus');
  assert.equal(detail.checked, true);
  assert.equal(p.$('journey-cards').children[0], card);
  assert.equal(p.launches, 0);
  p.chooser.destroy();
});

test('compact filter traversal and controller select preview stay open until focus reaches a card', () => {
  const p = setup();
  const filters = p.$('journey-filter-details');
  filters.open = true;
  const navigation = attachControllerNavigation({
    document: p.doc,
    getRoot: () => p.$('journey-chooser'),
    getScope: () => 'missions',
  });
  for (const id of ['journey-collection', 'journey-campaign', 'journey-mode']) {
    p.$(id).focus();
    assert.equal(filters.open, true);
  }
  navigation.handle({ confirm: true });
  assert.equal(p.$('journey-mode').hasAttribute('data-controller-editing'), true);
  navigation.handle({ direction: 'down' });
  assert.equal(filters.open, true);
  assert.equal(p.$('journey-mode').value, 'solo', 'Preview has not committed a filter.');
  navigation.handle({ confirm: true });
  assert.equal(filters.open, true);
  assert.equal(p.$('journey-mode').value, 'versus');
  navigation.handle({ direction: 'down' });
  assert.equal(p.doc.activeElement, p.$('journey-detailed-cards'));
  assert.equal(filters.open, true);
  navigation.handle({ direction: 'down' });
  assert.equal(p.doc.activeElement, p.$('journey-cards').children[0]);
  assert.equal(filters.open, false);
  assert.equal(p.launches, 0);
  navigation.destroy();
  p.chooser.destroy();
});

test('wide filters remain expanded when focus moves to cards and footer', () => {
  const p = setup({ compact: false });
  p.$('journey-detailed-cards').focus();
  p.$('journey-cards').children[0].focus();
  assert.equal(p.$('journey-filter-details').open, true);
  p.$('journey-back').focus();
  assert.equal(p.$('journey-filter-details').open, true);
  p.chooser.destroy();
});

test('compact transition keeps focused filters reachable without resetting mode or selection', () => {
  const p = setup({ compact: false });
  assert.equal(p.$('journey-filter-details').open, true);
  p.$('journey-mode').value = 'versus';
  p.$('journey-mode').emit('change');
  const card = p.$('journey-cards').children[0];
  p.$('journey-mode').focus();
  p.resize(true);
  assert.equal(p.$('journey-filter-details').open, false);
  assert.equal(p.doc.activeElement, p.$('journey-filter-summary'));
  assert.equal(p.$('journey-mode').value, 'versus');
  assert.equal(p.$('journey-cards').children[0], card);
  p.resize(false);
  assert.equal(p.$('journey-filter-details').open, true);
  assert.equal(p.doc.activeElement, p.$('journey-collection'));
  assert.equal(p.$('journey-mode').value, 'versus');
  assert.equal(p.launches, 0);
  p.chooser.destroy();
});

test('compact cards keep image previews while optional details do not rebuild or launch', () => {
  const p = setup();
  const card = p.$('journey-cards').children[0];
  assert(p.observations > 0, 'Image-led compact cards observe near-viewport previews.');
  p.$('journey-filter-details').open = true;
  const control = p.$('journey-detailed-cards');
  control.focus();
  control.checked = true;
  control.emit('change');
  assert.equal(p.$('journey-chooser').classList.contains('mission-library-detailed'), true);
  assert.equal(p.doc.activeElement, control);
  assert.equal(p.$('journey-cards').children[0], card);
  assert(p.observations > 0);
  control.checked = false;
  control.emit('change');
  assert.equal(p.$('journey-chooser').classList.contains('mission-library-detailed'), false);
  assert.match(card.textContent, /Original edition.*Classic.*65% coverage.*Play/);
  assert.equal(p.launches, 0);
  p.chooser.destroy();
});

test('compact CSS reserves mission space and retains accessible target sizing', async () => {
  const css = await readFile(new URL('../ui/journey.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(max-width: 600px\), \(max-height: 720px\)/);
  assert.match(css, /grid-template-rows: auto auto auto auto minmax\(9rem, 1fr\) auto auto/);
  assert.match(
    css,
    /#journey-chooser\.mission-library-chooser\[open\] \{[^}]*grid-template-rows: auto auto auto auto auto minmax\(0, 1fr\) auto auto;[^}]*overflow: hidden;/s,
    'The setup summary owns an explicit row while the mission grid owns bounded scrolling.',
  );
  assert.match(
    css,
    /@media \(min-width: 1200px\) and \(max-height: 720px\) \{\s*#journey-chooser\.mission-library-chooser \.journey-cards \{\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/s,
    'Short handheld and desktop layouts keep mission names readable instead of forcing six narrow columns.',
  );
  assert.match(
    css,
    /mission-library-chooser:not\(\.mission-library-detailed\)[^{]*\.journey-card[^{]*:is\([^{]*\.journey-card-campaign/s,
    'Compact cards do not repeat the campaign title beside the mission name.',
  );
  assert.match(
    css,
    /mission-library-chooser:not\(\.mission-library-detailed\) \.journey-card > strong \{[^}]*grid-column: 2;[^}]*grid-row: 2;/s,
    'Compact mission names own the readable content column instead of falling into the number column.',
  );
  assert.match(css, /journey-filter-details > summary \{[^}]*min-height: 44px/s);
  assert.match(css, /mission-library-setup > summary \{[^}]*min-height: 44px/s);
  assert.match(css, /mission-library-chooser \.journey-filter-options \{[^}]*overflow: auto/s);
  assert.match(css, /journey-campaign-shortcut \{[^}]*min-height: 44px/s);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(
    css,
    /mission-library-chooser:not\(\.mission-library-detailed\) \.journey-card-map/,
    'Compact cards keep their map or earned-art preview visible.',
  );
  assert.match(
    css,
    /\.journey-search-controls \{[^}]*display: flex;[^}]*align-items: end;[^}]*min-width: 0;/s,
    'Search and Clear share one row above cards in portrait and short landscape.',
  );
  assert.match(
    css,
    /#journey-chooser #journey-search-clear \{[^}]*flex: 0 0 auto;[^}]*min-height: 44px;[^}]*min-block-size: 44px;[^}]*margin: 0;/s,
  );
  assert.match(css, /#journey-chooser #journey-search-clear\[hidden\] \{\s*display: none;/);
});

test('compact controls override inherited dialog panel spacing without shrinking targets', async () => {
  const css = await readFile(new URL('../ui/journey.css', import.meta.url), 'utf8');
  const compact = css.slice(css.indexOf('@media (max-width: 600px), (max-height: 720px)'));
  assert.match(
    compact,
    /#journey-chooser\.mission-library-chooser \.journey-filter-details,\s*#journey-chooser\.mission-library-chooser \.mission-library-setup \{[^}]*margin: 0;[^}]*padding: 0;[^}]*border: 0;/s,
    'Both compact details controls must beat the later Field Kit dialog details spacing.',
  );
  assert.match(compact, /#journey-chooser\.mission-library-chooser h2 \{[^}]*margin: 0;/s);
  for (const control of ['journey-filter-details', 'mission-library-setup'])
    assert.match(
      compact,
      new RegExp(
        `#journey-chooser\\.mission-library-chooser \\.${control} > summary \\{[^}]*box-sizing: border-box;[^}]*min-height: 44px;[^}]*min-block-size: 44px;`,
        's',
      ),
    );
  assert.match(
    compact,
    /#journey-chooser\.mission-library-chooser \.journey-footer > button \{[^}]*min-block-size: 44px;[^}]*margin: 0;/s,
  );
});

test('narrow large-text and forced-colour layouts keep one readable column and native state cues', async () => {
  const css = await readFile(new URL('../ui/journey.css', import.meta.url), 'utf8');
  assert.match(
    css,
    /@media \(max-width: 600px\) \{\s*\.game-shell\[data-text-size='large'\][^{]*#journey-chooser\.mission-library-chooser[^{]*\.journey-cards \{\s*grid-template-columns: minmax\(0, 1fr\);/s,
    'Large text must not share two narrow mission columns on compact screens.',
  );
  assert.match(
    css,
    /@media \(max-width: 380px\) \{\s*#journey-chooser\.mission-library-chooser \.journey-cards \{\s*grid-template-columns: minmax\(0, 1fr\);/s,
    'Very narrow standard-text screens retain a readable single column too.',
  );
  const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
  assert.match(forced, /#journey-chooser \.journey-card,[^}]*border-image: none;/s);
  assert.match(
    forced,
    /\.journey-card\[data-current='true'\] \{[^}]*outline: 2px solid Highlight;[^}]*box-shadow: none;/s,
  );
  assert.match(
    forced,
    /\.journey-card\[data-availability-state='unavailable'\] \{[^}]*color: GrayText;[^}]*border-style: dashed;/s,
    'Unavailable remains a textual and border-style state rather than colour alone.',
  );
  assert.match(
    forced,
    /\.journey-campaign-shortcut\[aria-pressed='true'\] \{[^}]*color: HighlightText;[^}]*background: Highlight;/s,
  );
});

test('short landscape setup fields scroll above an unchanged reachable footer', async () => {
  const css = await readFile(new URL('../ui/journey.css', import.meta.url), 'utf8');
  const landscape = css.slice(css.lastIndexOf('@media (max-height: 480px)'));
  assert.match(landscape, /\.journey-footer \{\s*position: relative;/);
  assert.match(
    landscape,
    /\.mission-library-setup\[open\] \{\s*flex-basis: 13rem;\s*max-height: none;\s*overflow: visible;/,
  );
  assert.match(
    landscape,
    /\.mission-library-setup\s+>\s+\.mission-picker-setup-fields \{[^}]*position: absolute;[^}]*bottom: calc\(100% \+ 0\.35rem\);[^}]*max-height: min\(24rem, calc\(100dvh - 8rem\)\);[^}]*overflow: auto;/s,
    'Opening settings must not grow the footer beyond the short viewport.',
  );
});
