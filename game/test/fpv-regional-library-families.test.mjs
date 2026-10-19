import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import {
  REGIONAL_LIBRARY_PINS,
  regionalLibraryFamilies,
  mountRegionalLibrary,
} from '../../optional-practice/civilian-fpv/regional-library.mjs';
import { createFlightMenuNavigation } from '../../optional-practice/civilian-fpv/input.mjs';

const copy = (value) => structuredClone(value);
const identity = (row) => `${row.id}:${row.saved?.sha256 ?? row.pin.sha256}`;
const desert = REGIONAL_LIBRARY_PINS.filter((row) => row.id === 'desert-expedition-study');
const saved = (pin, active = false) => ({
  id: pin.id,
  sha256: pin.pin.sha256,
  active,
  bytes: pin.bytes,
  descriptor: {
    id: pin.id,
    revision: `saved-${pin.pin.sha256.slice(0, 8)}`,
    title: copy(pin.title),
  },
});
const retained = (id = desert[0].id, hash = 'f'.repeat(64)) => ({
  id,
  sha256: hash,
  active: true,
  bytes: 123,
  descriptor: {
    id,
    revision: 'retained-r1',
    title: { en: 'My retained landscape', uk: 'Моя збережена місцевість' },
  },
});

// Presentation-only metadata and a minimal DOM boundary. No asset bytes, flight
// progress, native layout, hardware support or storage persistence are simulated.
async function fixture({ pins = desert, records: initial = [] } = {}) {
  const doc = new Document(),
    parent = doc.createElement('div'),
    calls = [],
    flights = [];
  doc.body.append(parent);
  let records = copy(initial),
    locale = 'en',
    generation = 1,
    failLoad = false;
  const win = Object.assign(new Events(), {
    location: { href: 'https://presentation.invalid/sim' },
    setTimeout,
    clearTimeout,
    performance: { now: () => 0 },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
  });
  const pinFor = (hash) => pins.find((row) => row.pin.sha256 === hash);
  const store = {
    list: async () => copy(records),
    inspect: async (pin) => {
      calls.push(['inspect', pin.sha256]);
      return { descriptor: saved(pinFor(pin.sha256)).descriptor };
    },
    install: async (pin) => {
      calls.push(['install', pin.sha256]);
      const offered = pinFor(pin.sha256);
      for (const row of records) if (row.id === offered.id) row.active = false;
      records.push(saved(offered, true));
      generation++;
    },
    load: async (id, { sha256 }) => {
      calls.push(['load', id, sha256]);
      if (failLoad) {
        const error = new TypeError('Fixture selected bytes failed verification');
        error.code = 'regional-cache-invalid';
        throw error;
      }
      const offered = pinFor(sha256);
      return {
        manifest: { spawns: Object.keys(offered?.startHeadings ?? {}).map((id) => ({ id })) },
        source: { baseURL: 'https://presentation.invalid/' },
      };
    },
    repair: async (pin, { id }) => {
      calls.push(['repair', id, pin.sha256]);
      failLoad = false;
      generation++;
    },
    removalSnapshot: async (id, { sha256 } = {}) => {
      calls.push(['review-remove', id, sha256 ?? 'all']);
      const rows = records.filter((row) => row.id === id && (!sha256 || row.sha256 === sha256));
      return {
        id,
        generation,
        sha256,
        revision: rows[0]?.descriptor.revision,
        revisions: rows.map((row) => ({ sha256: row.sha256 })),
        bytes: rows.reduce((sum, row) => sum + row.bytes, 0),
      };
    },
    removeRevision: async (id, sha256, { expectedGeneration }) => {
      assert.equal(expectedGeneration, generation);
      calls.push(['remove-revision', id, sha256]);
      records = records.filter((row) => row.id !== id || row.sha256 !== sha256);
      generation++;
    },
    remove: async (id, { expectedGeneration }) => {
      assert.equal(expectedGeneration, generation);
      calls.push(['remove-all', id]);
      records = records.filter((row) => row.id !== id);
      generation++;
    },
    activate: async () => {
      calls.push(['unexpected-activate']);
      throw new Error('Rendering cannot activate');
    },
    close() {},
  };
  const ui = mountRegionalLibrary({
    parent,
    pins,
    window: win,
    openLibrary: async () => store,
    txt: (en, uk) => (locale === 'uk' ? uk : en),
    el(tag, text, className) {
      const node = doc.createElement(tag);
      if (text !== undefined) node.textContent = text;
      if (className) node.className = className;
      return node;
    },
    fly: async (configuration, row) => flights.push({ configuration, row }),
  });
  ui.open();
  await settle();
  return {
    doc,
    win,
    ui,
    store,
    calls,
    flights,
    root: () => doc.querySelector('#regional-world-library'),
    family: (key = 'desert') =>
      [...doc.querySelectorAll('[data-region-family]')].find(
        (node) => node.dataset.regionFamily === key,
      ),
    version: (hash) =>
      [...doc.querySelectorAll('[data-region-key]')].find(
        (node) => node.dataset.regionKey === hash,
      ),
    records: () => copy(records),
    locale(lang) {
      locale = lang;
      ui.refresh();
    },
    corrupt() {
      failLoad = true;
    },
  };
}
async function settle() {
  for (let i = 0; i < 8; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}
const mutations = (f) =>
  f.calls.filter(([name]) =>
    ['install', 'repair', 'remove-revision', 'remove-all', 'unexpected-activate'].includes(name),
  );

test('24 exact current offers form ten explicit families without changing pins or choosing by title/hash order', () => {
  const before = copy(REGIONAL_LIBRARY_PINS),
    groups = regionalLibraryFamilies();
  assert.equal(REGIONAL_LIBRARY_PINS.length, 24);
  assert.equal(groups.length, 10);
  assert.deepEqual(
    groups
      .flatMap((family) => family.rows)
      .map(identity)
      .sort(),
    REGIONAL_LIBRARY_PINS.map(identity).sort(),
  );
  for (const group of groups) {
    assert.equal(group.primary, group.rows[0]);
    for (const row of group.rows)
      assert.equal(
        row.pin,
        REGIONAL_LIBRARY_PINS.find((pin) => identity(pin) === identity(row)).pin,
      );
  }
  assert.equal(groups.find((row) => row.key === 'tropical').rows.length, 3);
  assert.equal(groups.find((row) => row.key === 'railway').rows.length, 2);
  assert.equal(groups.find((row) => row.key === 'canyon').rows.length, 3);
  assert.deepEqual(REGIONAL_LIBRARY_PINS, before);
});

test('active saved editions win defaults, unoffered revisions remain exact, and unfamiliar retained IDs stay visible', () => {
  const older = saved(desert.at(-1), true),
    unknown = retained(),
    personal = retained('personal-landscape', 'e'.repeat(64));
  const input = [saved(desert[0]), older, unknown, personal],
    before = copy(input);
  let groups = regionalLibraryFamilies(desert, input);
  assert.equal(groups[0].primary.saved.sha256, older.sha256);
  assert.equal(groups[0].rows.length, 3);
  assert.deepEqual(groups[0].rows.at(-1).title, unknown.descriptor.title);
  assert.deepEqual(groups[1].title, personal.descriptor.title);
  assert.equal(groups[1].primary.saved, personal);
  groups = regionalLibraryFamilies(desert, [unknown]);
  assert.equal(groups[0].primary.saved.sha256, unknown.sha256);
  // Same bytes do not bind a different ID to an offered alias or hide that row.
  const differentId = retained('different-id', desert[0].pin.sha256);
  assert.equal(regionalLibraryFamilies(desert, [differentId]).length, 2);
  assert.deepEqual(input, before);
});

test('one family card retains every exact version and performs no mutation during open/refresh/locale changes', async () => {
  const f = await fixture({ pins: REGIONAL_LIBRARY_PINS });
  try {
    assert.equal(f.doc.querySelectorAll('[data-region-family]').length, 10);
    assert.equal(f.doc.querySelectorAll('[data-region-key]').length, 24);
    for (const lang of ['en', 'uk']) {
      f.locale(lang);
      await settle();
      for (const pin of REGIONAL_LIBRARY_PINS) {
        assert.equal(
          f.version(pin.pin.sha256).querySelector('strong').textContent,
          pin.title[lang],
        );
        assert.ok(
          f
            .version(pin.pin.sha256)
            .querySelector('button')
            .getAttribute('aria-label')
            .includes(pin.title[lang]),
        );
      }
      for (const details of f.doc.querySelectorAll('[data-region-versions]')) {
        assert.equal(details.open, false);
        assert.match(
          details.querySelector('summary').textContent,
          lang === 'en' ? /^Versions \(/ : /^Версії \(/,
        );
      }
    }
    assert.deepEqual(mutations(f), []);
    assert.deepEqual(f.flights, []);
  } finally {
    f.ui.dispose();
  }
});

test('primary Fly keeps the active saved identity; explicit version download is separate and focus stays in its drawer', async () => {
  const old = saved(desert.at(-1), true),
    f = await fixture({ records: [old] });
  try {
    const primary = f.family().querySelector('[data-region-primary]');
    assert.equal(primary.dataset.regionPrimary, old.sha256);
    assert.ok(
      primary.querySelector('[data-region-selected]').textContent.includes(old.descriptor.revision),
    );
    primary.querySelector('button').focus();
    primary.querySelector('button').click();
    await settle();
    assert.equal(f.flights.at(-1).row.sha256, old.sha256);
    assert.deepEqual(mutations(f), []);
    assert.equal(
      f.doc.activeElement.closest('[data-region-primary]').dataset.regionPrimary,
      old.sha256,
    );
    f.family().querySelector('summary').click();
    const download = f
      .version(desert[0].pin.sha256)
      .querySelector('[data-region-action="install"]');
    download.focus();
    download.click();
    await settle();
    assert.deepEqual(mutations(f), [['install', desert[0].pin.sha256]]);
    assert.equal(f.family().querySelector('details').open, true);
    assert.equal(
      f.doc.activeElement.closest('[data-region-key]').dataset.regionKey,
      desert[0].pin.sha256,
    );
    assert.equal(f.doc.activeElement.dataset.regionAction, 'fly');
    assert.equal(
      f.family().querySelector('[data-region-primary]').dataset.regionPrimary,
      desert[0].pin.sha256,
    );
    assert.equal(f.records().length, 2);
    f.locale('uk');
    await settle();
    assert.equal(f.family().querySelector('details').open, true);
    assert.equal(
      f.doc.activeElement.closest('[data-region-key]').dataset.regionKey,
      desert[0].pin.sha256,
    );
  } finally {
    f.ui.dispose();
  }
});

test('failed primary Fly exposes exact repair, and destructive actions still require a reviewed confirmation', async () => {
  const record = saved(desert.at(-1), true),
    other = saved(desert[0]),
    f = await fixture({ records: [record, other] });
  try {
    f.corrupt();
    f.family().querySelector('[data-region-primary] button').click();
    await settle();
    assert.equal(f.family().querySelector('details').open, true);
    assert.equal(f.doc.activeElement.dataset.regionAction, 'repair');
    assert.equal(f.doc.activeElement.closest('[data-region-key]').dataset.regionKey, record.sha256);
    f.doc.activeElement.click();
    await settle();
    assert.deepEqual(mutations(f), [['repair', record.id, record.sha256]]);
    const remove = f.version(record.sha256).querySelector('[data-region-action="remove"]');
    remove.focus();
    remove.click();
    await settle();
    assert.equal(f.doc.activeElement.dataset.regionAction, 'confirm-remove');
    assert.equal(f.records().length, 2);
    assert.equal(mutations(f).length, 1);
    f.doc.activeElement.click();
    await settle();
    assert.deepEqual(mutations(f).at(-1), ['remove-revision', record.id, record.sha256]);
    assert.deepEqual(
      f.records().map((row) => row.sha256),
      [other.sha256],
    );
    assert.equal(f.version(record.sha256).querySelector('button').dataset.regionAction, 'install');
  } finally {
    f.ui.dispose();
  }
});

test('a revealed Repair action does not force Versions open again after the player closes it', async () => {
  const record = saved(desert.at(-1), true),
    f = await fixture({ records: [record] });
  try {
    f.corrupt();
    f.family().querySelector('[data-region-primary] button').click();
    await settle();
    assert.equal(f.family().querySelector('details').open, true);
    const summary = f.family().querySelector('summary');
    summary.focus();
    summary.click();
    f.locale('uk');
    await settle();
    assert.equal(f.family().querySelector('details').open, false);
    assert.equal(f.doc.activeElement.tagName, 'SUMMARY');
    assert.ok(f.version(record.sha256).querySelector('[data-region-action="repair"]'));
    assert.deepEqual(mutations(f), []);
  } finally {
    f.ui.dispose();
  }
});

test('unoffered saved worlds keep localized labels and explicit Fly/removal controls inside Versions', async () => {
  const record = retained('personal-landscape'),
    f = await fixture({ records: [record] });
  try {
    for (const lang of ['en', 'uk']) {
      f.locale(lang);
      await settle();
      const family = f.family('retained:personal-landscape');
      assert.equal(family.querySelector('h3').textContent, record.descriptor.title[lang]);
      assert.ok(
        family
          .querySelector('[data-region-selected]')
          .textContent.includes(record.descriptor.revision),
      );
      assert.ok(f.version(record.sha256).querySelector('[data-region-action="fly"]'));
      assert.ok(f.version(record.sha256).querySelector('[data-region-action="remove"]'));
      assert.equal(f.version(record.sha256).querySelector('[data-region-action="repair"]'), null);
    }
    assert.deepEqual(mutations(f), []);
    assert.deepEqual(f.records(), [record]);
  } finally {
    f.ui.dispose();
  }
});

test('remove-all confirmation stays scoped to its exact world ID, including families with multiple IDs', async () => {
  const pins = REGIONAL_LIBRARY_PINS.filter((row) =>
      ['railway-valley-expanse', 'railway-valley-study'].includes(row.id),
    ),
    current = saved(pins[0], true),
    older = retained(pins[0].id),
    otherWorld = saved(pins[1], true),
    f = await fixture({ pins, records: [current, older, otherWorld] });
  try {
    f.family('railway').querySelector('summary').click();
    const button = f.version(current.sha256).querySelector('[data-region-action="remove-all"]');
    button.focus();
    button.click();
    await settle();
    assert.deepEqual(mutations(f), []);
    assert.equal(f.records().length, 3);
    f.doc.activeElement.click();
    await settle();
    assert.deepEqual(mutations(f), [['remove-all', current.id]]);
    assert.deepEqual(f.records(), [otherWorld]);
    assert.ok(f.version(otherWorld.sha256).querySelector('[data-region-action="fly"]'));
  } finally {
    f.ui.dispose();
  }
});

test('finishing an explicit download does not reopen Versions or steal focus after the player closes its drawer', async () => {
  const f = await fixture();
  let release;
  const pending = new Promise((resolve) => {
      release = resolve;
    }),
    install = f.store.install;
  f.store.install = async (...args) => {
    await pending;
    return install(...args);
  };
  try {
    f.family().querySelector('summary').click();
    const download = f.version(desert[0].pin.sha256).querySelector('button');
    download.focus();
    download.click();
    await settle();
    let summary = f.family().querySelector('summary');
    summary.focus();
    summary.click();
    assert.equal(f.family().querySelector('details').open, false);
    release();
    await settle();
    summary = f.family().querySelector('summary');
    assert.equal(f.family().querySelector('details').open, false);
    assert.equal(f.doc.activeElement, summary);
    assert.deepEqual(mutations(f), [['install', desert[0].pin.sha256]]);
    assert.equal(
      f.family().querySelector('[data-region-primary]').dataset.regionPrimary,
      desert[0].pin.sha256,
    );
  } finally {
    release();
    await settle();
    f.ui.dispose();
  }
});

test('a deferred saved-region refresh preserves the exact focused Fly edition across an active-version change', async () => {
  const old = saved(desert.at(-1), true),
    next = saved(desert[0]),
    f = await fixture({ records: [old, next] }),
    n = navigation(f);
  let release;
  f.store.list = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  try {
    // Joining the real device adapter does not activate an action.
    f.family().querySelector('[data-region-primary] button').focus();
    n.pad();
    n.pad(0);
    n.pad();
    n.pad();
    f.root().querySelector('button').click();
    await settle();
    const prior = f.family().querySelector('[data-region-primary] button');
    assert.equal(prior.disabled, true);
    // The minimal DOM can focus disabled controls; this checks observer ownership,
    // not whether a native browser permits this particular focus operation.
    prior.dataset.fpvMenuFocus = '';
    prior.focus();
    release([
      { ...old, active: false },
      { ...next, active: true },
    ]);
    await settle();
    assert.equal(
      f.family().querySelector('[data-region-primary]').dataset.regionPrimary,
      next.sha256,
    );
    assert.equal(f.doc.activeElement.isConnected, true);
    assert.equal(f.doc.activeElement.closest('[data-region-key]')?.dataset.regionKey, old.sha256);
    assert.equal(f.doc.activeElement.dataset.regionAction, 'fly');
    assert.equal(f.doc.activeElement.dataset.fpvMenuFocus, '');
    assert.equal(f.family().querySelector('details').open, true);
    assert.deepEqual(f.flights, []);
    n.pad(0);
    n.pad();
    await settle();
    assert.equal(f.flights.at(-1).row.sha256, old.sha256);
    assert.deepEqual(mutations(f), []);
  } finally {
    release?.([]);
    n.nav.dispose();
    f.ui.dispose();
  }
});

test('idempotent Library reopen keeps focus before refresh while genuinely required host moves remain intact', async () => {
  const old = saved(desert.at(-1), true),
    next = saved(desert[0]),
    f = await fixture({ records: [old, next] });
  let release;
  f.store.list = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  try {
    const root = f.root(),
      home = root.previousElementSibling,
      after = home.after.bind(home),
      host = f.doc.createElement('div');
    f.doc.body.append(host);
    let moves = 0;
    // The observed native negative lost focus when an already-placed subtree
    // was reinserted before run('refresh') captured intent. Model that DOM
    // boundary on these instances only; no browser/global behavior is patched.
    const moving = (nodes) => {
      moves++;
      if (nodes.some((node) => node.contains(f.doc.activeElement))) f.doc.body.focus();
    };
    home.after = (...nodes) => {
      moving(nodes);
      after(...nodes);
    };
    const append = host.append.bind(host);
    host.append = (...nodes) => {
      moving(nodes);
      append(...nodes);
    };
    f.family().querySelector('[data-region-primary] button').focus();
    f.ui.open();
    await settle();
    assert.equal(moves, 0, 'An already-adjacent root must not be reinserted before focus capture');
    f.doc.body.focus(); // Temporarily disabled native controls can blur later.
    release([
      { ...old, active: false },
      { ...next, active: true },
    ]);
    await settle();
    assert.equal(f.doc.activeElement.closest('[data-region-key]')?.dataset.regionKey, old.sha256);
    f.store.list = async () => [
      { ...old, active: false },
      { ...next, active: true },
    ];
    f.ui.open(host);
    await settle();
    assert.equal(root.parentNode, host);
    assert.equal(moves, 1, 'A new host still requires reparenting');
    f.ui.open(host);
    await settle();
    assert.equal(moves, 1, 'An already-last root must not be reinserted');
    const tail = f.doc.createElement('p');
    host.append(tail);
    f.ui.open(host);
    await settle();
    assert.equal(host.lastElementChild, root);
    assert.equal(moves, 3, 'A following sibling still requires moving the root to the end');
    f.ui.open();
    await settle();
    assert.equal(home.nextSibling, root);
    assert.equal(moves, 4, 'Returning to the home position still requires moving');
    assert.deepEqual(f.flights, []);
    assert.deepEqual(mutations(f), []);
  } finally {
    release?.([]);
    f.ui.dispose();
  }
});

test('refresh keeps a pre-existing radio focus lease through body blur, with full world ID plus hash identity', async () => {
  const pins = REGIONAL_LIBRARY_PINS.filter((row) =>
      ['railway-valley-expanse', 'railway-valley-study'].includes(row.id),
    ).map((pin) => ({ ...pin, pin: { ...pin.pin, sha256: 'a'.repeat(64) } })),
    old = saved(pins[0], true),
    next = saved(pins[1]),
    f = await fixture({ pins, records: [old, next] }),
    n = navigation(f);
  let release;
  f.store.list = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  try {
    const primary = f.family('railway').querySelector('[data-region-primary] button');
    primary.focus();
    n.radio();
    n.radioConfirm();
    n.radio();
    primary.dataset.fpvMenuFocus = '';
    // Programmatic reopening is a metadata refresh, not an explicit install or
    // activation. Body blur models loss of a temporarily disabled focus target.
    f.ui.open();
    await settle();
    f.doc.body.focus();
    release([
      { ...old, active: false },
      { ...next, active: true },
    ]);
    await settle();
    const selected = f.family('railway').querySelector('[data-region-primary]');
    assert.equal(selected.dataset.regionPrimaryId, next.id);
    assert.equal(selected.dataset.regionPrimary, next.sha256);
    assert.equal(f.doc.activeElement.closest('[data-region-key]')?.dataset.regionId, old.id);
    assert.equal(f.doc.activeElement.closest('[data-region-key]')?.dataset.regionKey, old.sha256);
    assert.equal(f.doc.activeElement.dataset.fpvMenuFocus, '');
    assert.match(
      f.family('railway').querySelector('[data-region-focus-notice]').textContent,
      /edition changed/,
    );
    assert.deepEqual(f.flights, []);
    n.radioConfirm();
    await settle();
    assert.equal(f.flights.at(-1).row.id, old.id);
    assert.equal(f.flights.at(-1).row.sha256, old.sha256);
    assert.deepEqual(mutations(f), []);
  } finally {
    release?.([]);
    n.nav.dispose();
    f.ui.dispose();
  }
});

test('refresh never changes a vanished Fly action into Download or a different primary Fly, in EN and UK', async () => {
  for (const lang of ['en', 'uk']) {
    const old = saved(desert.at(-1), true),
      next = saved(desert[0]),
      f = await fixture({ records: [old, next] }),
      n = navigation(f);
    let release;
    f.store.list = () =>
      new Promise((resolve) => {
        release = resolve;
      });
    try {
      f.locale(lang);
      f.family().querySelector('[data-region-primary] button').focus();
      n.pad();
      n.pad(0);
      n.pad();
      n.pad();
      f.ui.open();
      await settle();
      f.doc.body.focus();
      // This is an observed metadata change only; no removal is requested or
      // simulated by the UI. The previously offered identity is still listed.
      release([{ ...next, active: true }]);
      await settle();
      assert.equal(f.doc.activeElement, f.family().querySelector('summary'));
      assert.equal(f.doc.activeElement.dataset.fpvMenuFocus, '');
      assert.equal(f.family().querySelector('details').open, false);
      assert.match(
        f.family().querySelector('[data-region-focus-notice]').textContent,
        lang === 'en' ? /edition changed.*Review Versions/ : /варіант змінився.*«Версії»/,
      );
      assert.equal(f.version(old.sha256).querySelector('button').dataset.regionAction, 'install');
      n.pad(0);
      n.pad();
      await settle();
      assert.equal(f.family().querySelector('details').open, true);
      assert.deepEqual(f.flights, []);
      assert.deepEqual(mutations(f), []);
    } finally {
      release?.([]);
      n.nav.dispose();
      f.ui.dispose();
    }
  }
});

test('refresh keeps Versions as the safe confirmation target when the same displayed edition no longer has Fly', async () => {
  const old = saved(desert[0], true),
    f = await fixture({ records: [old] });
  let release;
  f.store.list = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  try {
    f.family().querySelector('[data-region-primary] button').focus();
    f.ui.open();
    await settle();
    f.doc.body.focus();
    release([]);
    await settle();
    assert.equal(
      f.family().querySelector('[data-region-primary]').dataset.regionPrimary,
      old.sha256,
    );
    assert.equal(f.doc.activeElement, f.family().querySelector('summary'));
    assert.match(
      f.family().querySelector('[data-region-focus-notice]').textContent,
      /available action changed/,
    );
    f.doc.activeElement.click();
    assert.equal(f.family().querySelector('details').open, true);
    assert.deepEqual(f.flights, []);
    assert.deepEqual(mutations(f), []);
  } finally {
    release?.([]);
    f.ui.dispose();
  }
});

test('refresh of a no-longer-listed retained family returns connected focus without implying removal or taking action', async () => {
  const record = retained('personal-landscape'),
    f = await fixture({ records: [record] });
  let release;
  f.store.list = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  try {
    f.family('retained:personal-landscape').querySelector('[data-region-primary] button').focus();
    f.ui.open();
    await settle();
    f.doc.body.focus();
    release([]);
    await settle();
    assert.equal(f.family('retained:personal-landscape'), undefined);
    assert.equal(f.doc.activeElement, f.root().querySelector('button'));
    assert.equal(f.doc.activeElement.isConnected, true);
    assert.match(f.root().textContent, /focused version is no longer listed/);
    assert.deepEqual(f.flights, []);
    assert.deepEqual(mutations(f), []);
  } finally {
    release?.([]);
    f.ui.dispose();
  }
});

test('a pending metadata refresh respects later disclosure and navigation choices instead of restoring stale primary intent', async () => {
  for (const destination of ['summary', 'outside']) {
    const old = saved(desert.at(-1), true),
      next = saved(desert[0]),
      f = await fixture({ records: [old, next] });
    let release;
    f.store.list = () =>
      new Promise((resolve) => {
        release = resolve;
      });
    try {
      f.family().querySelector('[data-region-primary] button').focus();
      f.ui.open();
      await settle();
      let target;
      if (destination === 'summary') {
        target = f.family().querySelector('summary');
        target.focus();
        target.click();
        target.click();
      } else {
        target = f.doc.createElement('button');
        f.doc.body.append(target);
        target.focus();
      }
      release([
        { ...old, active: false },
        { ...next, active: true },
      ]);
      await settle();
      assert.equal(
        f.doc.activeElement,
        destination === 'summary' ? f.family().querySelector('summary') : target,
      );
      assert.equal(f.family().querySelector('details').open, false);
      assert.equal(f.family().querySelector('[data-region-focus-notice]'), null);
      assert.deepEqual(f.flights, []);
      assert.deepEqual(mutations(f), []);
    } finally {
      release?.([]);
      f.ui.dispose();
    }
  }
});

function navigation(f) {
  let now = 0;
  const nav = createFlightMenuNavigation({
    document: f.doc,
    window: f.win,
    locale: () => 'en',
    getContext: () => ({ root: f.root(), key: 'library-families' }),
  });
  const pad = (button = null) => ({
    index: 0,
    id: 'Fixture pad',
    mapping: 'standard',
    axes: [0, 0],
    buttons: Array.from({ length: 16 }, (_, i) => ({ value: i === button ? 1 : 0 })),
  });
  const radio = (yaw = 0, pitch = 0) => ({
    verified: true,
    key: 'fixture-radio',
    controls: { roll: 0, pitch, yaw },
  });
  return {
    nav,
    pad(button = null) {
      nav.poll({ now: (now += 100), gamepads: [pad(button)] });
    },
    radio(yaw = 0, pitch = 0) {
      nav.poll({ now: (now += 100), radio: radio(yaw, pitch) });
    },
    radioConfirm() {
      for (let i = 0; i < 8; i++) this.radio(1);
      this.radio();
    },
  };
}

test('SIM controller navigation opens Versions and reaches exact actions without activating on join or traversing hidden editions', async () => {
  const f = await fixture({ records: [saved(desert[0]), saved(desert.at(-1), true)] }),
    n = navigation(f);
  try {
    let summary = f.family().querySelector('summary');
    summary.focus();
    n.pad();
    n.pad(0);
    n.pad();
    assert.equal(n.nav.snapshot().device, 'pad');
    assert.equal(f.family().querySelector('details').open, false);
    assert.deepEqual(f.calls, []);
    n.pad(); // The joined device must supply a fresh neutral sample.
    n.pad(0);
    n.pad();
    assert.equal(f.family().querySelector('details').open, true);
    n.pad(13);
    assert.equal(
      f.doc.activeElement.closest('[data-region-key]').dataset.regionKey,
      desert[0].pin.sha256,
    );
    n.pad();
    n.pad(0);
    n.pad();
    await settle();
    assert.equal(f.flights.at(-1).row.sha256, desert[0].pin.sha256);
    assert.equal(f.doc.activeElement.dataset.fpvMenuFocus, '');
    assert.deepEqual(mutations(f), []);
    summary = f.family().querySelector('summary');
    summary.focus();
    summary.click();
    f.doc.emit('keydown', { key: 'ArrowDown', target: summary });
    f.doc.emit('keyup', { key: 'ArrowDown', target: summary });
    assert.equal(f.family().querySelector('details').open, false);
    assert.equal(f.doc.activeElement.tagName, 'SUMMARY');
  } finally {
    n.nav.dispose();
    f.ui.dispose();
  }
});

test('calibrated-radio menu gestures open Versions and focus an edition without flying or writing on disclosure', async () => {
  const f = await fixture({ records: [saved(desert[0]), saved(desert.at(-1), true)] }),
    n = navigation(f);
  try {
    f.family().querySelector('summary').focus();
    n.radio();
    n.radioConfirm();
    assert.equal(n.nav.snapshot().device, 'radio');
    assert.equal(f.family().querySelector('details').open, false);
    n.radio(); // Fresh neutral sample after the join resets the input edge state.
    n.radioConfirm();
    assert.equal(f.family().querySelector('details').open, true);
    n.radio(0, -1);
    assert.equal(
      f.doc.activeElement.closest('[data-region-key]').dataset.regionKey,
      desert[0].pin.sha256,
    );
    assert.deepEqual(f.calls, []);
    assert.deepEqual(f.flights, []);
    assert.deepEqual(mutations(f), []);
  } finally {
    n.nav.dispose();
    f.ui.dispose();
  }
});

test('Common selector can download and load an exact regional revision without opening its management browser', async () => {
  const f = await fixture({ records: [] });
  const row = f.ui.missions()[0];
  const load = f.store.load;
  f.store.load = async (...args) => { const result = await load(...args); result.manifest.id = args[0]; return result; };
  assert.equal(row.familyKey, 'desert');
  assert.equal(f.ui.isInstalled(row), false);
  const controller = new AbortController();
  await f.ui.prepareMission(row, { signal: controller.signal });
  assert.equal(f.ui.isInstalled(row), true);
  const loaded = await f.ui.loadMission(row, { signal: controller.signal });
  assert.equal(loaded.record.sha256, row.pin.sha256);
  assert.deepEqual(loaded.configuration.catalogueTitle, row.title);
  assert.ok(f.calls.some(([kind, hash]) => kind === 'inspect' && hash === row.pin.sha256));
  assert.ok(f.calls.some(([kind, id, hash]) => kind === 'load' && id === row.id && hash === row.pin.sha256));
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(f.ui.prepareMission(f.ui.missions()[1], { signal: cancelled.signal }), { name: 'AbortError' });
  assert.equal(f.records().length, 1, 'Cancelled selection never installs another revision');
  f.ui.dispose();
});

test('A corrupt map selected in the common picker can repair only its exact offered revision', async () => {
  const f = await fixture({ records: [saved(desert[0], true), saved(desert[1])] });
  const row = f.ui.missions()[0];
  f.corrupt();
  await assert.rejects(f.ui.loadMission(row), { code: 'regional-cache-invalid' });
  assert.equal(f.ui.isInstalled(row), false);
  await f.ui.prepareMission(row, { signal: new AbortController().signal });
  assert.equal(f.ui.isInstalled(row), true);
  assert.deepEqual(f.calls.filter(([kind]) => kind === 'repair'), [['repair', row.id, row.pin.sha256]]);
  assert.equal(f.records().length, 2, 'Other saved versions survive repair');
  await f.ui.loadMission(row);
  f.ui.dispose();
});
