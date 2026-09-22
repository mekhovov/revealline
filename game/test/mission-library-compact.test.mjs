import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document } from './helpers/couch-dom.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { attachMissionLibraryChooser } from '../ui/mission-library-chooser.mjs';

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
    assert.equal(query, '(max-width: 600px), (max-height: 480px)');
    return media;
  };
  doc.defaultView.IntersectionObserver = class {
    observe() {
      observations++;
    }
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

test('detailed compact cards are opt-in without rebuilding buttons or launching missions', () => {
  const p = setup();
  const card = p.$('journey-cards').children[0];
  assert.equal(p.observations, 0, 'Compact browsing does not build hidden diagrams.');
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
  assert.match(css, /@media \(max-width: 600px\), \(max-height: 480px\)/);
  assert.match(css, /grid-template-rows: auto auto auto minmax\(9rem, 1fr\) auto/);
  assert.match(css, /journey-filter-details > summary \{[^}]*min-height: 44px/s);
  assert.match(css, /mission-library-setup > summary \{[^}]*min-height: 44px/s);
  assert.match(css, /mission-library-chooser \.journey-filter-options \{[^}]*overflow: auto/s);
  assert.match(css, /mission-library-chooser:not\(\.mission-library-detailed\) \.journey-card-map/);
});
