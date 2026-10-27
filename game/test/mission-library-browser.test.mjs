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

for (const randomDownloadable of [false, true]) {
  test(`Random selection ${randomDownloadable ? 'prepares downloadable SIM maps' : 'keeps other hosts limited to ready missions'}`, async () => {
    const doc = new Document();
    let installed = false,
      downloads = 0,
      launches = 0;
    const entry = {
      id: 'download-map',
      name: 'Railway Valley',
      campaignKey: 'maps',
      campaignTitle: 'World maps',
      levelIndex: 0,
      modes: ['solo'],
    };
    const library = createMissionLibrary([
      {
        id: 'maps',
        editionId: 'maps',
        edition: 'SIM',
        collection: 'Custom',
        entries: [entry],
        describe: (value) => value,
        availability: () => (installed ? { state: 'ready' } : { state: 'download', bytes: 1024 }),
        async prepare(value, { signal }) {
          assert.equal(value, entry);
          signal.throwIfAborted();
          downloads++;
          installed = true;
        },
        launch(value) {
          assert.equal(value, entry);
          launches++;
        },
      },
    ]);
    const chooser = attachMissionLibraryBrowser({ document: doc, library, randomDownloadable });
    chooser.open();
    assert.equal(
      doc.getElementById('journey-random-level').disabled,
      !randomDownloadable,
      'Download-only results must enable the SIM Random button',
    );
    assert.equal(chooser.playRandom(), randomDownloadable);
    for (let i = 0; i < 8; i++) await new Promise((resolve) => setImmediate(resolve));
    assert.equal(downloads, Number(randomDownloadable));
    assert.equal(launches, Number(randomDownloadable));
    chooser.destroy();
    library.dispose();
  });
}

test('Host Random filter scopes candidates without removing manually selectable levels', async () => {
  const doc = new Document();
  const entries = ['flight', 'learning'].map((id, levelIndex) => ({
    id,
    levelIndex,
    name: id,
    campaignKey: 'sim',
    campaignTitle: 'SIM',
    modes: ['solo'],
  }));
  const launches = [];
  const library = createMissionLibrary([
    {
      id: 'sim',
      editionId: 'sim',
      edition: 'SIM',
      collection: 'Classic',
      entries,
      describe: (entry) => entry,
      availability: () => ({ state: 'ready' }),
      launch: (entry) => launches.push(entry.id),
    },
  ]);
  let selectedType = 'learning';
  const chooser = attachMissionLibraryBrowser({
    document: doc,
    library,
    random: () => 0,
    randomFilter: (row) => row.runtimeId === selectedType,
  });
  chooser.open();
  assert.equal(chooser.elements.list.children.length, 2);
  chooser.playRandom();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(launches, ['learning']);
  chooser.open();
  selectedType = 'flight';
  chooser.refresh();
  chooser.playRandom();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(launches, ['learning', 'flight']);
  chooser.destroy();
  library.dispose();
});

for (const count of [1, 128]) {
  test(`current mission lookup stays bounded across ${count} cards and updates on later renders`, (t) => {
    const doc = new Document();
    const entries = Array.from({ length: count }, (_, index) => ({
      id: `route-${index}`,
      name: `Route ${index}`,
      levelIndex: index,
      campaignKey: 'chapter',
      campaignTitle: 'Chapter',
      modes: ['solo'],
      tags: [],
      rules: '',
    }));
    const library = createMissionLibrary([
      {
        id: 'engine',
        collection: 'Classic',
        editionId: 'engine',
        edition: 'Engine',
        entries,
        describe: (entry) => entry,
        availability: () => ({ state: 'ready' }),
        launch: () => assert.fail('Refreshing current-state markers must not launch a mission'),
      },
    ]);
    let target = entries.at(-1).id,
      reads = 0,
      comparisons = 0;
    const chooser = attachMissionLibraryBrowser({
      document: doc,
      library,
      getCurrentId() {
        reads++;
        return (
          library.missions.find((row) => {
            comparisons++;
            return row.runtimeId === target;
          })?.id ?? null
        );
      },
    });
    t.after(() => {
      chooser.destroy();
      library.dispose();
    });
    chooser.open();
    const cards = [...chooser.elements.list.children];
    const focused = doc.activeElement;
    const marked = () =>
      cards.filter((card) => card.dataset.current === 'true').map((card) => card.dataset.missionId);
    assert.deepEqual(marked(), [library.missions.at(-1).id]);

    for (const next of [entries[0].id, null, entries.at(-1).id]) {
      target = next;
      reads = comparisons = 0;
      chooser.refresh();
      assert.equal(reads, 1, 'A synchronous render resolves current mission once');
      assert(comparisons <= count, 'The host scan stays linear in total library size');
      const current = library.missions.find((row) => row.runtimeId === target);
      assert.deepEqual(marked(), current ? [current.id] : []);
      assert.equal(chooser.elements.list.children.length, cards.length);
      cards.forEach((card, index) =>
        assert.equal(
          chooser.elements.list.children[index],
          card,
          'Existing card controls are reused',
        ),
      );
      assert.equal(doc.activeElement, focused, 'A new current marker does not move browsing focus');
    }
    const search = doc.getElementById('journey-search');
    search.value = 'no-matching-mission';
    reads = comparisons = 0;
    chooser.refresh();
    assert.equal(chooser.elements.list.children.length, 0);
    assert.equal(reads, 0, 'An empty render adds no current-ID read when selection is retained');
    assert.equal(comparisons, 0);

    target = entries[0].id;
    search.value = '';
    reads = comparisons = 0;
    chooser.refresh();
    assert.equal(reads, 1);
    assert.deepEqual(marked(), [library.missions[0].id]);
    assert.equal(chooser.elements.list.children.length, cards.length);
    cards.forEach((card, index) =>
      assert.equal(
        chooser.elements.list.children[index],
        card,
        'Clearing a filter reuses each card',
      ),
    );

    // Public typing clears selection; retain its existing single campaign-rail
    // fallback lookup while proving empty row rendering does not add another.
    search.focus();
    search.value = 'no-matching-mission';
    reads = comparisons = 0;
    search.emit('input');
    assert.equal(chooser.elements.list.children.length, 0);
    assert.equal(reads, 1, 'Only the existing campaign-rail lookup remains with no matches');
    assert(comparisons <= count);
    target = entries.at(-1).id;
    reads = comparisons = 0;
    doc.getElementById('journey-search-clear').click();
    assert.equal(search.value, '');
    assert.equal(
      reads,
      2,
      'Rows and the existing campaign rail each resolve current identity once',
    );
    assert(comparisons <= 2 * count);
    assert.deepEqual(marked(), [library.missions.at(-1).id]);
    assert.equal(chooser.elements.list.children.length, cards.length);
    cards.forEach((card, index) =>
      assert.equal(chooser.elements.list.children[index], card, 'Public Clear reuses each card'),
    );
  });
}
