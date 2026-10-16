import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document } from './helpers/couch-dom.mjs';
import { mountCouch } from './helpers/mount-html.mjs';
import { createCandidateLibrary } from '../studio/candidate-library.mjs';
import {
  STUDIO_SPATIAL_REVIEW_IDS,
  isStudioSpatialReview,
  inspectStudioSpatialReview,
  loadStudioSpatialReview,
  mountStudioSpatialReviews,
} from '../studio/spatial-editions.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { createInspectionRequests } from '../content-design/recovery.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
function fixture() {
  const document = new Document();
  mountCouch(document, html);
  const $ = (id) => document.getElementById(id);
  // This bounded parser does not implement HTML's selected-option behavior.
  const initial = [...$('whole-variety-edition').options].find((option) =>
    option.hasAttribute('selected'),
  );
  $('whole-variety-edition').value = initial.value;
  const stop = mountStudioSpatialReviews({ document });
  createCandidateLibrary({ document });
  return { document, $, stop };
}

test('recent registered editions are searchable without changing the selected draft or default', () => {
  const f = fixture();
  try {
    assert.deepEqual(
      STUDIO_SPATIAL_REVIEW_IDS,
      Array.from({ length: 13 }, (_, n) => `whole-spatial-v${n + 26}`),
    );
    assert.equal(f.$('whole-variety-edition').value, 'apex-cultural-routes-1');
    f.$('source').value = '{"unapplied":"draft"}';
    for (const id of STUDIO_SPATIAL_REVIEW_IDS) {
      assert.equal(
        [...f.$('whole-variety-edition').options].filter((option) => option.value === id).length,
        1,
      );
      f.$('candidate-search').value = id;
      f.$('candidate-search').emit('input');
      const entries = [...f.$('candidate-library').querySelectorAll('[data-library-entry]')].filter(
        (entry) => !entry.hidden,
      );
      assert.equal(entries.length, 1);
      assert(entries[0].querySelector('#whole-variety'));
    }
    assert.equal(f.$('source').value, '{"unapplied":"draft"}');
    assert.equal(f.$('whole-variety-edition').value, 'apex-cultural-routes-1');
    assert.equal(f.$('spatial-review-links').hidden, true);
  } finally {
    f.stop();
  }
});

test('review links track exact selected edition and locale without rebuilding controls', () => {
  const oldLocale = getLocale();
  const f = fixture();
  try {
    const selector = f.$('whole-variety-edition');
    const options = [...selector.options];
    selector.value = 'whole-spatial-v38';
    selector.emit('change');
    selector.focus();
    for (const locale of ['uk', 'en']) {
      setLocale(locale, { persist: false });
      assert.equal(f.$('spatial-review-links').hidden, false);
      assert.equal(f.$('spatial-review-solo').href, '../?journey=whole-spatial-v38');
      assert.equal(f.$('spatial-review-versus').href, '../couch/?journey=whole-spatial-v38');
      assert.match(f.$('spatial-review-solo').getAttribute('aria-label'), /whole-spatial-v38/);
      assert.deepEqual([...selector.options], options);
      assert.equal(f.document.activeElement, selector);
      assert.equal(selector.value, 'whole-spatial-v38');
    }
    selector.value = 'apex-cultural-routes-1';
    selector.emit('change');
    assert.equal(f.$('spatial-review-links').hidden, true);
  } finally {
    f.stop();
    setLocale(oldLocale, { persist: false });
  }
});

test('Studio loads exact detached sources and never aliases missing editions to v4', async () => {
  let options;
  await loadStudioSpatialReview('whole-spatial-v37', {
    loadRoute: async (id, requested) => {
      options = requested;
      return createAuthoredJourneyRoute(id);
    },
  });
  assert.deepEqual(options, { fullSource: true });
  for (const id of STUDIO_SPATIAL_REVIEW_IDS) {
    const source = await loadStudioSpatialReview(id);
    const registered = createAuthoredJourneyRoute(id).source;
    assert.deepEqual(source, registered);
    assert.notEqual(source, registered);
    source.name = 'Edited locally';
    assert.notEqual(registered.name, source.name);
  }
  for (const id of ['whole-spatial-v99', 'whole-spatial-v037', 'opening', '', 'latest']) {
    assert.equal(isStudioSpatialReview(id), false);
    await assert.rejects(loadStudioSpatialReview(id));
  }
  await assert.rejects(
    loadStudioSpatialReview('whole-spatial-v37', {
      loadRoute: async () => ({ id: 'whole-spatial-v36', source: {} }),
    }),
  );
});

for (const change of ['source', 'edition', 'inspection', 'none'])
  test(`review inspection preserves the current owner after ${change} change`, async () => {
    let draft = 'original',
      edition = 'whole-spatial-v37',
      inspected = null;
    const inspections = createInspectionRequests(() => draft);
    let release;
    const pending = inspectStudioSpatialReview({
      id: edition,
      inspections,
      getEdition: () => edition,
      inspect: (source) => {
        inspected = source;
        draft = 'inspected';
      },
      load: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    });
    if (change === 'source') draft = 'new user edit';
    if (change === 'edition') edition = 'whole-spatial-v36';
    if (change === 'inspection') inspections.begin();
    const source = { id: 'review', missions: [] };
    release(source);
    assert.equal(await pending, change === 'none');
    assert.equal(inspected, change === 'none' ? source : null);
    assert.equal(
      draft,
      change === 'source' ? 'new user edit' : change === 'none' ? 'inspected' : 'original',
    );
  });

test('only a current inspection failure is reported', async () => {
  for (const stale of [false, true]) {
    const inspections = createInspectionRequests(() => 'draft');
    let reject;
    const pending = inspectStudioSpatialReview({
      id: 'whole-spatial-v37',
      inspections,
      getEdition: () => 'whole-spatial-v37',
      inspect: () => assert.fail('failed read cannot inspect or apply'),
      load: () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    });
    if (stale) inspections.invalidate();
    reject(new Error('missing source'));
    if (stale) assert.equal(await pending, false);
    else await assert.rejects(pending, /missing source/);
  }
});
