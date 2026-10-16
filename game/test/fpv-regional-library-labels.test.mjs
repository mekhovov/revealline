import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document } from './helpers/couch-dom.mjs';
import {
  REGIONAL_LIBRARY_PINS,
  applyRegionalAppearance,
  mountRegionalLibrary,
} from '../../optional-practice/civilian-fpv/regional-library.mjs';
import { regionalLibraryEntry } from '../../optional-practice/civilian-fpv/regional-session.mjs';

const metadata = JSON.parse(
  await readFile(new URL('./fixtures/fpv-regional-labels-metadata.json', import.meta.url)),
);
const copy = (value) => structuredClone(value);
const descriptor = (row) => ({
  id: row.id,
  revision: row.revision,
  title: copy(row.descriptorTitle),
});
// Schema-valid presentation metadata only. No declared asset is fetched, rendered,
// installed or treated as flight/progress evidence by these isolated UI tests.
function configuration(row, pin) {
  return {
    manifest: {
      format: 'FPVRegionManifest.v1',
      id: row.id,
      revision: 'fixture-r1',
      title: { en: 'Source terrain name', uk: 'Назва вихідного рельєфу' },
      grid: {
        cellSizeMm: 128000,
        minX: 0,
        minZ: 0,
        width: 1,
        depth: 1,
        floorMm: 0,
        ceilingMm: 20000,
      },
      assets: [
        { id: 'scene', path: 'scene.glb', sha256: '0'.repeat(64), bytes: 1, kind: 'scene' },
        {
          id: 'collision',
          path: 'collision.json',
          sha256: '1'.repeat(64),
          bytes: 1,
          kind: 'collision',
        },
      ],
      chunks: [{ id: 'cell', x: 0, z: 0, assets: ['scene', 'collision'] }],
      spawns: (Object.keys(pin?.startHeadings ?? {}).length
        ? Object.keys(pin.startHeadings)
        : ['start']
      ).map((id) => ({ id, position: { x: 1000, y: 1000, z: 1000 } })),
    },
    source: { baseURL: 'https://presentation.invalid/', marker: 'unchanged' },
  };
}
const known = (row) =>
  REGIONAL_LIBRARY_PINS.find((pin) => pin.id === row.id && pin.pin.sha256 === row.pin.sha256);

test('all previously offered immutable pins stay identical and advertised download totals include descriptor bytes', () => {
  for (const row of metadata.rows) {
    const pin = known(row);
    assert.ok(pin, `Retain exact offer ${row.id}/${row.revision}`);
    assert.deepEqual(pin.pin, row.pin);
    assert.equal(pin.bytes, row.filesBytes + row.pin.bytes, `${row.id}/${row.revision}`);
  }
});

test('each exact offered title is also the installed flight presentation in both languages without changing identity', () => {
  for (const row of metadata.rows) {
    const pin = known(row),
      input = configuration(row, pin),
      original = copy(input),
      installed = descriptor(row),
      originalDescriptor = copy(installed);
    const bound = applyRegionalAppearance(input, { id: row.id, sha256: row.pin.sha256 });
    const entry = regionalLibraryEntry(bound, { sha256: row.pin.sha256, descriptor: installed });
    for (const lang of ['en', 'uk'])
      assert.equal(
        entry.course.locales[lang].title,
        pin.title[lang],
        `${row.id}/${row.revision}/${lang}`,
      );
    assert.equal(entry.packIdentity, `regional-installed:${row.pin.sha256}`);
    assert.equal(entry.id, `regional-${row.id}-${row.pin.sha256.slice(0, 12)}`);
    assert.equal(entry.installedRevision, row.revision);
    assert.deepEqual(input, original);
    assert.deepEqual(installed, originalDescriptor);
    assert.deepEqual(entry.configuration.manifest, original.manifest);
  }
});

test('same-ID editions bind separate copied labels and an unknown hash clears stale catalogue presentation', () => {
  const rows = metadata.rows.filter((row) => row.id === 'desert-expedition-study');
  const first = rows[0],
    pin = known(first),
    input = configuration(first, pin);
  const bound = applyRegionalAppearance(input, { id: first.id, sha256: first.pin.sha256 });
  assert.deepEqual(bound.catalogueTitle, pin.title);
  assert.notEqual(bound.catalogueTitle, pin.title);
  assert.equal(Object.isFrozen(bound.catalogueTitle), true);
  const second = rows[1],
    other = applyRegionalAppearance(input, { id: second.id, sha256: second.pin.sha256 });
  assert.deepEqual(other.catalogueTitle, known(second).title);
  assert.notEqual(bound.catalogueTitle.en, other.catalogueTitle.en);
  const unknown = applyRegionalAppearance(bound, { id: first.id, sha256: 'f'.repeat(64) });
  assert.equal(unknown.catalogueTitle, null);
  const entry = regionalLibraryEntry(unknown, {
    sha256: 'f'.repeat(64),
    descriptor: descriptor(first),
  });
  assert.equal(entry.course.locales.en.title, first.descriptorTitle.en);
});

async function uiFixture() {
  const rows = metadata.rows.filter((row) => row.id === 'desert-expedition-study'),
    pins = rows.map(known),
    doc = new Document(),
    parent = doc.createElement('div');
  doc.body.append(parent);
  let locale = 'en',
    records = [];
  const flights = [];
  const store = {
    list: async () => [...records],
    inspect: async (pin) => ({
      descriptor: descriptor(rows.find((row) => row.pin.sha256 === pin.sha256)),
    }),
    install: async (pin) => {
      const row = rows.find((row) => row.pin.sha256 === pin.sha256);
      records.push({
        id: row.id,
        sha256: row.pin.sha256,
        descriptor: descriptor(row),
        bytes: row.filesBytes + row.pin.bytes,
      });
    },
    load: async (id, { sha256 }) =>
      configuration(
        rows.find((row) => row.id === id && row.pin.sha256 === sha256),
        pins.find((row) => row.pin.sha256 === sha256),
      ),
    close() {},
  };
  const ui = mountRegionalLibrary({
    parent,
    pins,
    openLibrary: async () => store,
    txt: (en, uk) => (locale === 'uk' ? uk : en),
    window: { location: { href: 'https://presentation.invalid/sim' }, setTimeout, clearTimeout },
    el(tag, text, className) {
      const node = doc.createElement(tag);
      if (text !== undefined) node.textContent = text;
      if (className) node.className = className;
      return node;
    },
    fly: async (config, record) =>
      flights.push(
        regionalLibraryEntry(config, { sha256: record.sha256, descriptor: record.descriptor }),
      ),
  });
  return {
    rows,
    pins,
    doc,
    ui,
    flights,
    language(lang) {
      locale = lang;
      ui.refresh();
    },
    records: () => records,
    setRecords(value) {
      records = value;
    },
  };
}
const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};
const card = (f, hash) =>
  [...f.doc.querySelectorAll('[data-region-key]')].find((node) => node.dataset.regionKey === hash);

test('real Library handlers preserve offered card and Fly labels after install, refresh and locale changes', async () => {
  const f = await uiFixture();
  try {
    f.ui.open();
    await settle();
    for (const pin of f.pins) {
      card(f, pin.pin.sha256).querySelector('[data-region-action="install"]').click();
      await settle();
    }
    const descriptors = copy(f.records().map((row) => row.descriptor));
    for (const lang of ['en', 'uk']) {
      f.language(lang);
      await settle();
      for (const pin of f.pins) {
        const node = card(f, pin.pin.sha256),
          fly = node.querySelector('[data-region-action="fly"]');
        assert.equal(node.querySelector('strong').textContent, pin.title[lang]);
        assert.ok(fly.getAttribute('aria-label').includes(pin.title[lang]));
        fly.click();
        await settle();
        assert.equal(f.flights.at(-1).course.locales[lang].title, pin.title[lang]);
        assert.equal(f.flights.at(-1).packIdentity, `regional-installed:${pin.pin.sha256}`);
      }
    }
    assert.deepEqual(
      f.records().map((row) => row.descriptor),
      descriptors,
    );
  } finally {
    f.ui.dispose();
  }
});

test('unoffered retained versions keep their immutable descriptor title rather than a same-ID current alias', async () => {
  const f = await uiFixture();
  const original = {
    id: f.rows[0].id,
    sha256: 'f'.repeat(64),
    descriptor: {
      id: f.rows[0].id,
      revision: 'old-r1',
      title: { en: 'Retained original', uk: 'Збережений оригінал' },
    },
    bytes: 10,
  };
  f.setRecords([copy(original)]);
  try {
    f.ui.open();
    await settle();
    for (const lang of ['en', 'uk']) {
      f.language(lang);
      await settle();
      assert.equal(
        card(f, original.sha256).querySelector('strong').textContent,
        original.descriptor.title[lang],
      );
    }
    assert.deepEqual(f.records(), [original]);
  } finally {
    f.ui.dispose();
  }
});

test('catalogue display labels cannot bypass installed descriptor identity validation', () => {
  const row = metadata.rows[0],
    input = applyRegionalAppearance(configuration(row, known(row)), {
      id: row.id,
      sha256: row.pin.sha256,
    });
  assert.throws(
    () =>
      regionalLibraryEntry(input, {
        sha256: row.pin.sha256,
        descriptor: { ...descriptor(row), id: 'wrong-region' },
      }),
    /identity is invalid/,
  );
  assert.throws(
    () =>
      regionalLibraryEntry(input, {
        sha256: row.pin.sha256,
        descriptor: { ...descriptor(row), title: { en: '', uk: 'Назва' } },
      }),
    /identity is invalid/,
  );
  for (const catalogueTitle of [
    { en: '', uk: 'Назва' },
    { en: 'x'.repeat(121), uk: 'Назва' },
  ]) {
    assert.throws(
      () =>
        regionalLibraryEntry(
          { ...input, catalogueTitle },
          { sha256: row.pin.sha256, descriptor: descriptor(row) },
        ),
      /catalogue title is invalid/,
    );
  }
});
