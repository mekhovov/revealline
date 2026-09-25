import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { page } from './helpers/coop-host.mjs';
import { Element } from './helpers/couch-dom.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';

const files = new Map(
  await Promise.all(
    [
      'content/mission-library-index.json',
      'content-design/themes.json',
      'content/campaign.json',
      'content/classes.json',
    ].map(async (path) => [path, await readFile(new URL('../' + path, import.meta.url))]),
  ),
);
async function fixture(t, { read = async () => null, returnStorage } = {}) {
  const reads = [];
  let remoteCompletion = Promise.resolve(),
    finishRemote;
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    returnStorage,
    beforeImport({ install, doc }) {
      // The host deliberately starts remote refresh without returning it from
      // discovery.open(). Observe its real named status completion instead of
      // imposing a wall-clock deadline on synchronous catalogue compilation.
      // This never changes the text, focus, event dispatch or remote owner.
      const createElement = doc.createElement;
      const text = Object.getOwnPropertyDescriptor(Element.prototype, 'textContent');
      t.mock.method(doc, 'createElement', function (...args) {
        const element = createElement.apply(this, args);
        if (element.tagName === 'P')
          Object.defineProperty(element, 'textContent', {
            configurable: true,
            get: () => text.get.call(element),
            set(value) {
              text.set.call(element, value);
              if (element.id !== 'coop-library-remote-status') return;
              if (value === 'Loading Solo and Versus mission metadata…') {
                finishRemote?.();
                remoteCompletion = new Promise((resolve) => (finishRemote = resolve));
              } else {
                finishRemote?.();
                finishRemote = null;
              }
            },
          });
        return element;
      });
      install('crypto', { value: webcrypto });
      const actorFetch = globalThis.fetch;
      install('fetch', {
        value: async (url) => {
          const path = new URL(url).pathname.split('/game/')[1];
          if (!files.has(path)) return actorFetch(url);
          reads.push(path);
          return (await read(path)) ?? new Response(files.get(path));
        },
      });
    },
  });
  return Object.assign(f, { reads, remoteReady: () => remoteCompletion });
}
async function open(f, paused = false) {
  const opener = f.$(paused ? 'coop-discovery-paused' : 'coop-discovery-open'),
    original = opener.onclick;
  let pending;
  opener.onclick = (...args) => (pending = original.apply(opener, args));
  try {
    opener.focus();
    f.tap('Enter');
  } finally {
    opener.onclick = original;
  }
  assert(pending instanceof Promise, 'Real keyboard activation owns Team discovery.');
  await pending;
  assert.equal(f.$('journey-chooser').open, true);
}

const cards = (f) => [...f.$('journey-cards').querySelectorAll('.journey-card')];
function mode(f, value) {
  f.$('journey-mode').focus();
  f.$('journey-mode').value = value;
  f.$('journey-mode').emit('change');
}
const loaded = async (f) => {
  await f.remoteReady();
  const rows = cards(f);
  assert.equal(rows.length, 288, f.$('coop-library-remote-status').textContent);
  const identities = rows.map((row) => JSON.parse(row.dataset.missionId));
  assert.equal(identities.filter((identity) => identity[1] === 'whole-spatial-v12').length, 91);
  assert.equal(identities.filter((identity) => identity[1] === 'whole-spatial-v11').length, 3);
  assert.equal(identities.filter((identity) => identity[1] === 'whole-spatial-v10').length, 3);
  assert.equal(identities.filter((identity) => identity[1] === 'whole-spatial-v9').length, 3);
  assert.equal(identities.filter((identity) => identity[0].startsWith('["classic",')).length, 188);
};

test('Team loads all 288 Solo/Versus metadata rows only after selecting another mode and never decodes rewards', async (t) => {
  const f = await fixture(t);
  await open(f);
  assert.equal(cards(f).length, 14);
  const footer = f.$('journey-chooser').querySelector('.journey-footer');
  assert.equal(footer.contains(f.$('coop-library-remote-status')), false);
  assert.equal(footer.contains(f.$('coop-library-remote-retry')), false);
  assert.equal(f.$('coop-library-status').contains(f.$('journey-chooser-status')), true);
  assert.equal(f.$('coop-library-preview').hidden, false);
  assert.equal(f.reads.length, 0);
  const pictureReads = f.artwork.calls.reads.length;
  mode(f, 'solo');
  await loaded(f);
  assert.equal(f.reads.length, 4);
  assert.equal(f.$('coop-library-preview').hidden, true);
  assert.equal(f.doc.activeElement.id, 'journey-mode');
  assert(f.$('coop-library-remote-status').textContent.length < 80);
  assert.equal(f.artwork.calls.reads.length, pictureReads);
  assert.equal(cards(f).filter((row) => row.textContent.includes('Unavailable')).length, 176);
  mode(f, 'versus');
  assert.equal(cards(f).length, 288);
  assert.equal(f.reads.length, 4);
  mode(f, 'team');
  assert.equal(cards(f).length, 14);
  assert.equal(f.$('coop-library-remote-status').hidden, true);
  assert.equal(f.$('coop-library-remote-feedback').hidden, true);
  assert.equal(f.$('coop-library-preview').hidden, false);
});

test('Team exact nonfirst Versus handoff keeps its attempt on Stay and only departs after Replace', async (t) => {
  const f = await fixture(t);
  f.$('coop-start').click();
  f.$('coop-pause').click();
  await open(f, true);
  mode(f, 'versus');
  await loaded(f);
  const button = cards(f)[8];
  const name = button.querySelector('strong').textContent;
  const exactId = button.dataset.missionId;
  button.focus();
  f.tap('Enter');
  await waitFor(() => f.$('coop-discard-dialog').open);
  assert.match(f.$('coop-discard-copy').textContent, new RegExp(name));
  assert.equal(f.visits.length, 0);
  f.$('coop-discard-stay').click();
  await waitFor(() => f.$('journey-chooser').open);
  assert.equal(f.$('journey-mode').value, 'versus');
  assert.equal(f.$('coop-stage').textContent, 'FIRST CONNECTION');
  const current = cards(f).find((row) => row.querySelector('strong').textContent === name);
  current.focus();
  f.tap('Enter');
  await waitFor(() => f.$('coop-discard-dialog').open);
  f.$('coop-discard-confirm').click();
  await waitFor(() => f.visits.length === 1);
  const destination = new URL(f.visits[0]);
  assert.equal(destination.pathname, '/game/couch/');
  assert.equal(destination.searchParams.get('journey'), 'whole-spatial-v12');
  assert.equal(destination.searchParams.get('library-mission'), exactId);
  assert.equal(destination.searchParams.get('return'), 'team');
  assert.equal(destination.searchParams.get('journey-return'), 'legacy');
  assert.equal(destination.searchParams.size, 4);
});

test('late other-mode metadata cannot replace Team filter or newer focus; later deliberate selection uses it', async (t) => {
  const gate = deferred();
  const f = await fixture(t, {
    read: async (path) => {
      if (path.includes('index')) await gate.promise;
    },
  });
  await open(f);
  mode(f, 'solo');
  await waitFor(() => f.reads.length === 4);
  mode(f, 'team');
  f.$('journey-search').focus();
  gate.resolve();
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(cards(f).length, 14);
  assert.equal(f.$('journey-mode').value, 'team');
  assert.equal(f.doc.activeElement.id, 'journey-search');
  mode(f, 'versus');
  await loaded(f);
  assert.equal(f.reads.length, 4);
});

test('typing and filtering in the open Team chooser filters arriving remote rows without retiring the read', async (t) => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await fixture(t, {
    read: async (path) => {
      if (path.includes('index')) await gate.promise;
    },
  });
  await open(f);
  mode(f, 'solo');
  await waitFor(() => f.reads.length === 4);
  f.$('journey-collection').focus();
  f.$('journey-collection').value = 'Classic';
  f.$('journey-collection').emit('change');
  f.$('journey-campaign').focus();
  f.$('journey-campaign').value = '';
  f.$('journey-campaign').emit('change');
  const search = f.$('journey-search');
  // The finite focus() helper emits focusin, but native select -> search also
  // dispatches a non-bubbling blur through Window's capture listeners first.
  const FocusEventType =
    f.doc.defaultView.FocusEvent ??
    class FocusEvent extends Event {
      constructor(type, options) {
        super(type, options);
        this.relatedTarget = options.relatedTarget;
      }
    };
  let descendantBlurCaptured = 0;
  const observedBlur = (event) => {
    if (event.target === f.$('journey-campaign')) descendantBlurCaptured++;
  };
  f.win.addEventListener('blur', observedBlur, true);
  f.$('journey-campaign').dispatchEvent(
    new FocusEventType('blur', { bubbles: false, relatedTarget: search }),
  );
  f.win.removeEventListener('blur', observedBlur, true);
  assert.equal(descendantBlurCaptured, 1, 'The descendant blur reaches native Window capture.');
  search.focus();
  for (const key of 'Voltage Garden') {
    search.emit('keydown', { key });
    search.value += key;
    search.emit('input');
  }
  assert.match(f.$('coop-library-remote-status').textContent, /Loading/);
  assert.equal(f.$('coop-library-remote-retry').hidden, true);
  gate.resolve();
  await f.remoteReady();
  assert.equal(cards(f).length, 1);
  assert.match(cards(f)[0].textContent, /Voltage Garden/);
  assert.equal(search.value, 'Voltage Garden');
  assert.equal(f.$('journey-collection').value, 'Classic');
  assert.equal(f.doc.activeElement, search);
  assert.equal(f.visits.length, 0);
  // This fixture deliberately denies storage: its independent inventory warning
  // remains truthful, but ordinary search must not cause an interrupted load.
  assert.doesNotMatch(f.$('coop-library-remote-status').textContent, /interrupted/i);
  assert.match(f.$('coop-library-remote-status').textContent, /Installed content unavailable/);
  const completedStatus = f.$('coop-library-remote-status').textContent;
  f.doc.body.focus();
  assert.equal(
    f.$('coop-library-remote-status').textContent,
    completedStatus,
    'A completed read removes its outside-focus listener.',
  );
});

test('focus leaving the Team chooser still retires held remote metadata', async (t) => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await fixture(t, {
    read: async (path) => {
      if (path.includes('index')) await gate.promise;
    },
  });
  await open(f);
  mode(f, 'solo');
  await waitFor(() => f.reads.length === 4);
  f.doc.body.focus();
  assert.match(f.$('coop-library-remote-status').textContent, /interrupted/i);
  gate.resolve();
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(cards(f).length, 0);
  assert.equal(f.doc.activeElement, f.doc.body);
  assert.equal(f.visits.length, 0);
  assert.equal(f.$('coop-library-remote-retry').hidden, false);
});

test('failed remote metadata has an explicit Retry that retains focus and never starts a mission', async (t) => {
  let fail = true;
  const f = await fixture(t, {
    read: async (path) =>
      fail && path.includes('index') ? new Response('', { status: 503 }) : null,
  });
  await open(f);
  mode(f, 'solo');
  await waitFor(() => !f.$('coop-library-remote-retry').hidden);
  assert.match(f.$('coop-library-remote-status').textContent, /503/);
  const failedStatus = f.$('coop-library-remote-status').textContent;
  f.doc.body.focus();
  assert.equal(
    f.$('coop-library-remote-status').textContent,
    failedStatus,
    'A failed read removes its outside-focus listener.',
  );
  fail = false;
  f.$('coop-library-remote-retry').focus();
  f.tap('Enter');
  await loaded(f);
  assert.equal(f.doc.activeElement.id, 'coop-library-remote-retry');
  assert.equal(f.visits.length, 0);
  assert.equal(f.$('coop-menu').hidden, false);
});

for (const interrupt of ['blur', 'Escape'])
  test(`interrupted Team remote loading offers Retry and completes on deliberate reopen after ${interrupt}`, async (t) => {
    const gate = deferred();
    const f = await fixture(t, {
      read: async (path) => {
        if (path.includes('index')) await gate.promise;
      },
    });
    await open(f);
    mode(f, 'solo');
    await waitFor(() => f.reads.length === 4);
    if (interrupt === 'blur') {
      f.win.emit('blur');
      assert.match(f.$('coop-library-remote-status').textContent, /interrupted/i);
      assert.equal(f.$('coop-library-remote-retry').hidden, false);
      f.win.emit('focus');
      // Blur deliberately rearms the controller-confirm lifecycle. Let one
      // neutral poll clear its Steam Input echo guard before modeling a fresh
      // native Back activation.
      f.tick();
      f.$('journey-back').click();
    } else f.tap('Escape');
    assert.equal(f.$('journey-chooser').open, false);
    assert.equal(f.visits.length, 0);
    gate.resolve();
    await open(f);
    assert.equal(f.$('journey-mode').value, 'solo');
    await loaded(f);
    assert.equal(f.reads.length, 4, 'Reopening reuses checked metadata, not a second fetch.');
    assert.equal(f.$('coop-library-remote-retry').hidden, false);
    assert.match(f.$('coop-library-remote-status').textContent, /Installed content unavailable/);
    assert.match(
      f.$('coop-library-remote-status').getAttribute('aria-description'),
      /storage access/,
    );
    assert.equal(f.doc.activeElement.id, 'journey-search');
    assert.equal(f.visits.length, 0);
  });

test('saved other-mode browsing restores Team’s own filter and lazily loads matching missions', async (t) => {
  const values = new Map([
    [
      'revealline.mission-library.selector.v1.team',
      JSON.stringify({
        search: 'Two keepers',
        collection: '',
        campaign: '',
        mode: 'solo',
        selectedId: '',
        scroll: 0,
      }),
    ],
  ]);
  const f = await fixture(t, {
    returnStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  });
  await open(f);
  assert.equal(f.$('journey-mode').value, 'solo');
  assert.equal(f.$('journey-search').value, 'Two keepers');
  await f.remoteReady();
  assert.equal(cards(f).length, 2);
  assert(cards(f).some((card) => card.querySelector('strong').textContent === 'Two keepers'));
  assert.equal(f.$('coop-library-preview').hidden, true);
  assert.equal(f.reads.length, 4);
  assert.equal(f.visits.length, 0);
  assert.equal(f.$('coop-stage').textContent, 'FIRST CONNECTION');
  assert.equal(f.doc.activeElement.id, 'journey-search');
});

test('a Team page return restores the actual departing Solo search and campaign without another selection', async (t) => {
  const values = new Map();
  const returnStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  let campaign, missionId;
  await t.test('depart from Team’s Solo-filtered chooser', async (t) => {
    const f = await fixture(t, { returnStorage });
    await open(f);
    mode(f, 'solo');
    await loaded(f);
    f.$('journey-search').value = 'Two keepers';
    f.$('journey-search').emit('input');
    assert.equal(cards(f).length, 2);
    const button = cards(f).find(
      (card) => card.querySelector('strong').textContent === 'Two keepers',
    );
    missionId = button.dataset.missionId;
    campaign = JSON.stringify(JSON.parse(missionId).slice(0, 3));
    assert(f.$('journey-campaign').children.some((option) => option.value === campaign));
    f.$('journey-campaign').value = campaign;
    f.$('journey-campaign').emit('change');
    button.focus();
    f.$('journey-cards').scrollTop = 37;
    f.tap('Enter');
    await waitFor(() => f.visits.length === 1);
    assert.equal(new URL(f.visits[0]).searchParams.get('library-mission'), missionId);
    const saved = JSON.parse(values.get('revealline.mission-library.selector.v1.team'));
    assert.equal(saved.mode, 'solo');
    assert.equal(saved.search, 'Two keepers');
    assert.equal(saved.campaign, campaign);
    assert.equal(saved.selectedId, missionId);
    assert.equal(saved.scroll, 37);
  });
  await t.test('return to Team and deliberately reopen the same chooser', async (t) => {
    const f = await fixture(t, { returnStorage });
    const pictures = f.artwork.calls.reads.length;
    await open(f);
    assert.equal(f.$('journey-mode').value, 'solo');
    assert.equal(f.$('journey-search').value, 'Two keepers');
    await f.remoteReady();
    assert.equal(cards(f).length, 1);
    assert.equal(f.$('journey-campaign').value, campaign);
    assert.equal(cards(f)[0].dataset.missionId, missionId);
    assert.equal(f.reads.length, 4);
    assert.equal(f.artwork.calls.reads.length, pictures);
    assert.equal(f.visits.length, 0);
    assert.equal(f.doc.activeElement, cards(f)[0]);
    assert.equal(f.$('journey-cards').scrollTop, 37);
    assert.equal(f.$('coop-library-preview').hidden, true);
  });
});

test('Team remote feedback retains a bounded status row and 44px Retry target in short landscape', async () => {
  const css = await readFile(new URL('../ui/journey.css', import.meta.url), 'utf8');
  assert.match(
    css,
    /#journey-chooser #coop-library-status p(?:,\s*#journey-chooser #race-library-status p)? \{[^}]*margin: 0;/s,
  );
  assert.match(css, /#journey-chooser #coop-library-remote-feedback\[hidden\] \{\s*display: none;/);
  assert.match(css, /#journey-chooser #coop-library-remote-retry \{[^}]*min-block-size: 44px;/s);
  assert.match(
    css,
    /@media \(max-height: 480px\) \{\s*#journey-chooser #coop-library-status(?:,\s*#journey-chooser #race-library-status)? \{[^}]*max-height: 5rem;[^}]*overflow: auto;/s,
  );
});
