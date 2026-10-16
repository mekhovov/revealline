import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { attachMissionLibraryBrowser } from '../ui/mission-library-browser.mjs';

test('engine previews share flat browsing, bounded leases and exact one-action launches', async () => {
  const doc = new Document();
  let notify,
    released = 0,
    launched = null;
  doc.defaultView.IntersectionObserver = class {
    constructor(callback) {
      notify = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  const entries = Array.from({ length: 18 }, (_, index) => ({
    id: `route-${index}`,
    name: `Route ${index}`,
    levelIndex: index,
    campaignKey: `chapter-${Math.floor(index / 6)}`,
    campaignTitle: `Chapter ${Math.floor(index / 6)}`,
    modes: ['solo'],
    tags: [],
    rules: '',
  }));
  const diagrams = new Map(entries.map((entry) => [entry, { width: 24, height: 18, entry }]));
  const library = createMissionLibrary([
    {
      id: 'engine',
      collection: 'Classic',
      editionId: 'engine',
      edition: 'Engine',
      entries,
      describe: (entry) => entry,
      availability: () => ({ state: 'ready' }),
      card: (entry) => diagrams.get(entry),
      launch: (entry) => {
        launched = entry;
        return true;
      },
    },
  ]);
  const chooser = attachMissionLibraryBrowser({
    document: doc,
    library,
    supportedModes: ['solo'],
    renderPreview({ container, diagram, document, row }) {
      assert.equal(diagram.entry.id, JSON.parse(row.id)[3]);
      const image = document.createElement('svg');
      image.className = 'journey-card-map';
      container.append(image);
      return {
        release() {
          released++;
        },
      };
    },
  });
  chooser.open();
  const { list, dialog } = chooser.elements;
  const cards = [...list.children];
  assert.equal(cards.length, 18, 'all chapters share one list without paging');
  assert.equal(doc.getElementById('journey-mode').parentElement.hidden, true);
  assert.equal(list.querySelectorAll('svg').length, 0, 'offscreen diagrams are not allocated');
  notify([{ target: cards[13], isIntersecting: true }]);
  assert.equal(list.querySelectorAll('svg').length, 1);
  list.scrollTop = 700;
  notify([{ target: cards[13], isIntersecting: false }]);
  assert.equal(released, 1);
  assert.equal(list.scrollTop, 700, 'recycling previews does not snap the list');
  assert.equal(list.querySelectorAll('svg').length, 0);
  notify([{ target: cards[13], isIntersecting: true }]);
  cards[13].click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(launched, entries[13]);
  assert.equal(dialog.open, false);
  assert.equal(released, 2, 'launch releases the visible preview');
  chooser.open();
  notify([{ target: cards[13], isIntersecting: true }]);
  library.remove('engine');
  assert.equal(released, 3, 'removing a catalogue releases its visible preview lease');
  assert.equal(list.children.length, 0);
  chooser.destroy();
});

test('search and Back never launch a game and a stale card cannot launch after closing', () => {
  const doc = new Document();
  let launches = 0;
  const library = createMissionLibrary([
    {
      id: 'engine',
      collection: 'Classic',
      editionId: 'engine',
      edition: 'Engine',
      entries: [
        {
          id: 'one',
          name: 'One',
          campaignKey: 'one',
          campaignTitle: 'One',
          levelIndex: 0,
          modes: ['solo'],
          tags: [],
          rules: '',
        },
      ],
      describe: (entry) => entry,
      availability: () => ({ state: 'ready' }),
      launch: () => {
        launches++;
      },
    },
  ]);
  const chooser = attachMissionLibraryBrowser({ document: doc, library });
  chooser.open();
  const card = chooser.elements.list.children[0];
  doc.getElementById('journey-search').value = 'unmatched';
  doc.getElementById('journey-search').emit('input');
  card.click();
  doc.getElementById('journey-back').click();
  card.click();
  assert.equal(launches, 0);
  chooser.destroy();
});
