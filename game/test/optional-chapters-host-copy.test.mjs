import test from 'node:test';
import assert from 'node:assert/strict';
import { attachOptionalChaptersPanel } from '../ui/optional-chapters-panel.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';

// Actual shared panel and navigation; only native DOM and host installation are
// modeled. This does not certify native layout, physical input or race adoption.
function fixture(t, { panel: options = {}, play = async () => {}, installed = true } = {}) {
  const doc = new Document();
  doc.defaultView = Object.assign(new Events(), doc.defaultView);
  doc.createElement = (tag) => {
    const element = new Element(doc, tag);
    if (tag === 'dialog') {
      element.showModal = () => {
        element.open = true;
        element.setAttribute('open', '');
      };
      element.close = () => {
        element.open = false;
        element.removeAttribute('open');
        element.emit('close');
      };
    }
    return element;
  };
  let reading,
    managed = 0,
    closed = 0;
  const source = {
    id: 'copy-fixture',
    controlId: 'source',
    name: 'Reviewed chapter',
    themeId: 'fpv',
    mode: 'Arcade',
    levels: 1,
    bytes: 1024,
    inspect: async () => ({ status: installed ? 'installed' : 'absent' }),
    download: async () => {
      installed = true;
    },
    play,
  };
  const panel = attachOptionalChaptersPanel({
    document: doc,
    matchMedia: () => null,
    getLibrary: () => ({ packs: [] }),
    loadCatalog: async () => ({ format: 'revealline-optional-chapters.v1', packs: [] }),
    sourceChapters: [source],
    onRead: (value) => {
      reading = value;
    },
    onManage: () => {
      managed++;
    },
    onClose: () => {
      closed++;
    },
    ...options,
  });
  t.after(() => panel.dispose());
  return {
    panel,
    doc,
    $: (id) => doc.getElementById(`optional-worlds-${id}`),
    get reading() {
      return reading;
    },
    get managed() {
      return managed;
    },
    get closed() {
      return closed;
    },
  };
}

test('Solo defaults retain heading, reading, Back, management and flight copy', async (t) => {
  const h = fixture(t);
  await h.panel.open();
  assert.equal(h.$('title').textContent, 'More worlds');
  assert.equal(h.$('summary').getAttribute('aria-label'), 'About optional worlds');
  assert.equal(h.$('read').textContent, 'Read about worlds');
  assert.equal(h.$('back').textContent, 'Back to main menu');
  assert.equal(h.$('top-back').textContent, 'Back');
  assert.equal(h.$('top-back').getAttribute('aria-label'), 'Back to main menu');
  assert.equal(
    h.$('status').textContent,
    'Play prepares your selected chapter. You can cancel and keep your current flight.',
  );
  h.$('read').click();
  assert.equal(h.reading.label, 'More worlds');
  assert.equal(h.reading.region, h.$('summary'));
  assert.equal(h.reading.origin, h.$('read'));
  assert.equal(h.$('manage').textContent, 'Manage packs & backups');
  h.$('manage').click();
  assert.equal(h.managed, 1);
  assert.equal(h.closed, 0, 'Manage owns its explicit destination.');
  assert.equal(h.$('dialog').open, false);
});

const couch = {
  heading: 'Couch campaigns',
  backLabel: 'Back to race setup',
  attemptLabel: 'race',
  showManage: false,
};

test('Couch labels describe the host and omitted Manage never becomes a controller focus target', async (t) => {
  const h = fixture(t, { panel: couch });
  await h.panel.open();
  assert.equal(h.$('title').textContent, 'Couch campaigns');
  assert.equal(h.$('summary').getAttribute('aria-label'), 'About Couch campaigns');
  assert.equal(h.$('read').textContent, 'Read about Couch campaigns');
  assert.equal(h.$('back').textContent, 'Back to race setup');
  assert.equal(h.$('top-back').getAttribute('aria-label'), 'Back to race setup');
  assert.equal(
    h.$('status').textContent,
    'Play prepares your selected chapter. You can cancel and keep your current race.',
  );
  assert.match(h.$('source-recovery-note').textContent, /Installation keeps your current race;/);
  assert.equal(h.$('manage'), null);
  h.$('read').click();
  assert.equal(h.reading.label, 'Couch campaigns');
  const navigation = attachControllerNavigation({
    document: h.doc,
    getScope: () => 'ui',
    getRoot: () => h.$('dialog'),
  });
  t.after(() => navigation.destroy());
  h.$('top-back').focus();
  const visited = new Set();
  for (let i = 0; i < 40; i++) {
    visited.add(h.doc.activeElement.id);
    navigation.handle({ direction: 'down' });
  }
  assert.ok(visited.has('optional-worlds-read'));
  assert.ok(visited.has('optional-worlds-back'));
  assert.equal(visited.has('optional-worlds-manage'), false);
  assert.equal(h.managed, 0);
  h.$('back').click();
  assert.equal(h.closed, 1);
  assert.equal(h.$('dialog').open, false);
});

for (const [name, options, attempt] of [
  ['Solo', {}, 'flight'],
  ['Couch', couch, 'race'],
]) {
  test(`${name} Stay uses host attempt wording and keeps existing cancellation/focus authority`, async (t) => {
    const operations = [],
      finishes = [];
    const h = fixture(t, {
      panel: options,
      play: async (value) => {
        operations.push(value);
        await new Promise((resolve) => finishes.push(resolve));
      },
    });
    t.after(() => finishes.forEach((finish) => finish()));
    await h.panel.open();
    const primary = h.$('source-download');
    primary.focus();
    const pending = primary.onclick();
    await waitFor(() => operations.length === 1);
    const operation = operations[0],
      decision = h.doc.createElement('dialog');
    h.doc.body.append(decision);
    decision.showModal();
    decision.focus();
    decision.close();
    // Native nested-dialog closure returns to the busy Cancel opener.
    h.$('cancel').focus();
    assert.equal(operation.launch.onCancelled({ dialog: decision }), true);
    assert.equal(
      h.$('status').textContent,
      `Your ${attempt} is kept paused. Choose Play when ready to change chapters.`,
    );
    assert.equal(h.$('status').dataset.state, 'ready');
    assert.equal(h.doc.activeElement, primary);
    assert.equal(h.$('dialog').open, true);
    assert.equal(operation.launch.isCurrent(), false);
    assert.equal(operation.launch.onStarted(), false);
    h.panel.close();
    await h.panel.open();
    primary.focus();
    const newer = primary.onclick();
    await waitFor(() => operations.length === 2);
    const current = h.$('status').textContent;
    assert.equal(h.doc.activeElement, h.$('cancel'));
    assert.equal(primary.disabled, true);
    assert.equal(operation.launch.onCancelled({ dialog: decision }), false);
    assert.equal(
      h.$('status').textContent,
      current,
      'An old Stay cannot overwrite a new operation.',
    );
    assert.equal(h.doc.activeElement, h.$('cancel'), 'The new operation keeps its Cancel focus.');
    assert.equal(primary.disabled, true, 'A stale Stay cannot release the new operation.');
    assert.equal(operations[1].launch.isCurrent(), true);
    finishes[0]();
    await pending;
    assert.equal(
      h.doc.activeElement,
      h.$('cancel'),
      'Old completion cannot reclaim the new focus.',
    );
    assert.equal(primary.disabled, true);
    h.$('cancel').click();
    finishes[1]();
    await newer;
  });
}

test('Couch cancellation reports race preservation and late host completion cannot restore old status', async (t) => {
  let operation, finish;
  const held = new Promise((resolve) => {
    finish = resolve;
  });
  const h = fixture(t, {
    panel: couch,
    play: async (value) => {
      operation = value;
      await held;
    },
  });
  await h.panel.open();
  const primary = h.$('source-download');
  primary.focus();
  const pending = primary.onclick();
  for (let i = 0; i < 10 && !operation; i++) await Promise.resolve();
  assert.ok(operation);
  h.$('cancel').focus();
  h.$('cancel').click();
  assert.equal(operation.signal.aborted, true);
  assert.equal(
    h.$('status').textContent,
    'Cancellation requested. Completed installs remain available; your race is kept.',
  );
  assert.equal(h.$('status').dataset.state, 'cancelled');
  assert.equal(h.doc.activeElement, primary);
  await h.$('reload').onclick();
  const current = h.$('status').textContent;
  finish();
  await pending;
  assert.equal(h.$('status').textContent, current);
  assert.equal(operation.launch.onStarted(), false);
  assert.equal(h.$('dialog').open, true);
});

test('Couch aborted preparation uses race copy and leaves Play available', async (t) => {
  const h = fixture(t, {
    panel: couch,
    play: async () => {
      throw new DOMException('Stopped', 'AbortError');
    },
  });
  await h.panel.open();
  const primary = h.$('source-download');
  primary.focus();
  await primary.onclick();
  assert.equal(
    h.$('status').textContent,
    'Operation cancelled. Completed installs remain available; your race is kept.',
  );
  assert.equal(h.$('status').dataset.state, 'cancelled');
  assert.equal(primary.disabled, false);
  assert.equal(primary.textContent, 'Play');
  assert.equal(h.doc.activeElement, primary);
});

for (const cached of [false, true]) {
  test(`${cached ? 'cached' : 'initial'} library refresh acknowledges immediately; cancelled old work cannot render over a newer open`, async (t) => {
    const operations = [],
      library = { packs: [] };
    let release,
      reads = 0,
      catalogs = 0;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    const holdAt = cached ? 2 : 1;
    const h = fixture(t, {
      panel: {
        ...couch,
        getLibrary: () => {
          reads++;
          return library;
        },
        loadCatalog: async () => {
          catalogs++;
          return { format: 'revealline-optional-chapters.v1', packs: [] };
        },
        refreshLibrary: async (operation) => {
          operations.push(operation);
          if (operations.length === holdAt) {
            await held;
            operation.onStatus('Obsolete inventory ready');
          }
        },
      },
    });
    if (cached) {
      await h.panel.open();
      h.panel.close();
    }
    const opening = h.panel.open();
    assert.equal(h.$('dialog').open, true, 'Loading is visible before the refresh settles.');
    assert.equal(h.$('dialog').getAttribute('aria-busy'), 'true');
    assert.equal(h.$('cancel').hidden, false);
    assert.match(h.$('status').textContent, /Checking installed chapters/);
    const old = operations.at(-1);
    assert.ok(old);
    h.$('cancel').click();
    assert.equal(old.signal.aborted, true);
    assert.equal(h.$('dialog').getAttribute('aria-busy'), 'false');
    assert.equal(h.$('status').dataset.state, 'cancelled');
    h.panel.close();
    await h.panel.open();
    const status = h.$('status').textContent,
      currentReads = reads,
      currentCatalogs = catalogs;
    const cards = [...h.$('cards').children];
    release();
    await opening;
    assert.equal(h.$('status').textContent, status);
    assert.equal(reads, currentReads, 'The retired callback cannot inspect or render the library.');
    assert.equal(catalogs, currentCatalogs);
    assert.deepEqual([...h.$('cards').children], cards);
    assert.equal(h.$('dialog').open, true);
    assert.equal(h.$('dialog').getAttribute('aria-busy'), 'false');
    assert.equal(operations.length, cached ? 3 : 2);
  });
}

test('failed library refresh leaves a visible retry and a successful retry inspects fresh inventory', async (t) => {
  let refreshes = 0,
    inspections = 0;
  const h = fixture(t, {
    panel: {
      ...couch,
      refreshLibrary: async ({ signal, onStatus }) => {
        assert.equal(signal.aborted, false);
        onStatus('Reading installed race chapters…', 'reading');
        if (++refreshes === 1) throw new Error('Installed index unavailable.');
      },
      sourceChapters: [
        {
          id: 'fresh-copy',
          name: 'Fresh chapter',
          themeId: 'fpv',
          mode: 'Arcade',
          inspect: async () => {
            assert.ok(refreshes >= 2, 'Inspection follows successful refresh.');
            inspections++;
            return { status: 'installed' };
          },
          play: async () => {},
        },
      ],
    },
  });
  await h.panel.open();
  assert.equal(h.$('dialog').open, true);
  assert.equal(h.$('status').dataset.state, 'error');
  assert.match(
    h.$('status').textContent,
    /Installed index unavailable.*Use Play or Refresh to retry/,
  );
  assert.equal(inspections, 0);
  assert.equal(h.$('reload').disabled, false);
  await h.$('reload').onclick();
  assert.equal(refreshes, 2);
  assert.equal(inspections, 1);
  assert.equal(h.$('status').dataset.state, 'ready');
  assert.equal(h.$('source-fresh-copy-choose').disabled, false);
  assert.equal(h.$('dialog').open, true);
});

test('host cancel releases pending UI before preparation settles, retaining selection and foreground focus', async (t) => {
  let operation,
    finish,
    settled = false;
  const held = new Promise((resolve) => {
    finish = resolve;
  });
  const h = fixture(t, {
    panel: couch,
    play: async (value) => {
      operation = value;
      await held;
    },
  });
  t.after(() => finish());
  await h.panel.open();
  h.$('theme').value = 'fpv';
  h.$('theme').onchange();
  h.$('mode').value = 'Arcade';
  h.$('mode').onchange();
  const primary = h.$('source-download');
  primary.focus();
  const pending = primary.onclick().then(() => {
    settled = true;
  });
  for (let i = 0; i < 10 && !operation; i++) await Promise.resolve();
  assert.ok(operation);
  assert.equal(primary.disabled, true);
  assert.equal(h.$('dialog').getAttribute('aria-busy'), 'true');
  const elsewhere = h.doc.createElement('button');
  h.doc.body.append(elsewhere);
  elsewhere.focus();
  h.doc.focused = false;
  h.doc.defaultView.emit('blur');
  h.panel.cancel();
  assert.equal(operation.signal.aborted, true);
  assert.equal(settled, false, 'The preparation boundary remains unresolved.');
  assert.equal(h.$('dialog').open, true);
  assert.equal(h.closed, 0);
  assert.equal(h.$('dialog').getAttribute('aria-busy'), 'false');
  assert.equal(h.$('cancel').hidden, true);
  assert.equal(primary.disabled, false);
  assert.equal(h.$('source-download'), primary);
  assert.equal(h.$('theme').value, 'fpv');
  assert.equal(h.$('mode').value, 'Arcade');
  assert.equal(h.$('status').dataset.state, 'cancelled');
  assert.equal(
    h.$('status').textContent,
    'Cancellation requested. Completed installs remain available; your race is kept.',
  );
  assert.equal(
    h.doc.activeElement,
    elsewhere,
    'Host cancellation cannot reclaim foreground focus.',
  );
  h.doc.focused = true;
  await h.$('reload').onclick();
  const currentStatus = h.$('status').textContent;
  operation.onStatus('Obsolete preparation finished');
  finish();
  await pending;
  assert.equal(h.$('status').textContent, currentStatus);
  assert.equal(h.doc.activeElement, elsewhere);
  assert.equal(operation.launch.onStarted(), false);
  assert.equal(h.$('dialog').open, true);
});

test('host cancel while idle does not revoke an accepted deferred launch or change status', async (t) => {
  let operation;
  const h = fixture(t, {
    panel: couch,
    play: async (value) => {
      operation = value;
    },
  });
  await h.panel.open();
  const primary = h.$('source-download');
  primary.focus();
  await primary.onclick();
  const status = h.$('status').textContent;
  assert.equal(h.$('dialog').getAttribute('aria-busy'), 'false');
  assert.equal(operation.launch.isCurrent(), true);
  h.panel.cancel();
  assert.equal(h.$('status').textContent, status);
  assert.equal(h.doc.activeElement, primary);
  assert.equal(h.$('dialog').open, true);
  assert.equal(operation.signal.aborted, false);
  assert.equal(
    operation.launch.onStarted(),
    true,
    'An idle cancel is a no-op, not a new generation.',
  );
});

for (const [name, panel] of [
  ['Solo', {}],
  ['Couch', couch],
]) {
  test(`${name} a focused Play action transfers to Cancel while busy and cancellation restores its exact opener`, async (t) => {
    let finish;
    const held = new Promise((resolve) => {
      finish = resolve;
    });
    const h = fixture(t, { panel, play: async () => held });
    t.after(() => finish());
    await h.panel.open();
    const primary = h.$('source-download');
    primary.focus();
    const pending = primary.onclick();
    assert.equal(primary.disabled, true);
    assert.equal(h.$('cancel').hidden, false);
    assert.equal(h.doc.activeElement, h.$('cancel'));
    h.$('cancel').click();
    assert.equal(primary.disabled, false);
    assert.equal(h.doc.activeElement, primary);
    const cancelledStatus = h.$('status').textContent;
    finish();
    await pending;
    assert.equal(h.doc.activeElement, primary);
    assert.equal(h.$('status').textContent, cancelledStatus);
  });
}

for (const situation of ['moved', 'nested dialog', 'hidden document', 'unfocused document']) {
  test(`starting a chapter operation does not reclaim ${situation} focus`, async (t) => {
    let finish;
    const held = new Promise((resolve) => {
      finish = resolve;
    });
    const h = fixture(t, { play: async () => held });
    t.after(() => finish());
    await h.panel.open();
    const primary = h.$('source-download');
    const elsewhere = h.doc.createElement('button');
    let nested;
    if (situation === 'nested dialog') {
      nested = h.doc.createElement('dialog');
      nested.append(elsewhere);
      h.doc.body.append(nested);
    } else h.doc.body.append(elsewhere);
    let disabled = primary.disabled;
    Object.defineProperty(primary, 'disabled', {
      configurable: true,
      get: () => disabled,
      set(value) {
        disabled = value;
        if (!value) return;
        if (situation === 'hidden document') h.doc.hidden = true;
        else if (situation === 'unfocused document') h.doc.focused = false;
        else {
          nested?.showModal();
          elsewhere.focus();
        }
      },
    });
    primary.focus();
    const pending = primary.onclick();
    assert.notEqual(h.doc.activeElement, h.$('cancel'));
    if (situation === 'moved' || situation === 'nested dialog')
      assert.equal(h.doc.activeElement, elsewhere);
    finish();
    await pending;
    assert.notEqual(h.doc.activeElement, h.$('cancel'));
    if (situation === 'moved' || situation === 'nested dialog')
      assert.equal(h.doc.activeElement, elsewhere);
  });
}

test('an obsolete completion cannot reclaim the newer operation cancellation focus or later navigation', async (t) => {
  const completions = [];
  const h = fixture(t, {
    play: async () => new Promise((resolve) => completions.push(resolve)),
  });
  t.after(() => completions.forEach((resolve) => resolve()));
  await h.panel.open();
  const primary = h.$('source-download');
  primary.focus();
  const first = primary.onclick();
  assert.equal(h.doc.activeElement, h.$('cancel'));
  for (let i = 0; i < 10 && completions.length < 1; i++) await Promise.resolve();
  assert.equal(completions.length, 1);
  h.$('cancel').click();
  const second = primary.onclick();
  assert.equal(h.doc.activeElement, h.$('cancel'));
  for (let i = 0; i < 10 && completions.length < 2; i++) await Promise.resolve();
  assert.equal(completions.length, 2);
  completions[0]();
  await first;
  assert.equal(h.doc.activeElement, h.$('cancel'));
  assert.equal(primary.disabled, true);
  h.$('top-back').focus();
  completions[1]();
  await second;
  assert.equal(h.doc.activeElement, h.$('top-back'));
});
