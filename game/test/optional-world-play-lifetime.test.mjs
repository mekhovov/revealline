import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { attachOptionalChaptersPanel } from '../ui/optional-chapters-panel.mjs';
import { preparePack } from '../packs.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { SoloElement } from './helpers/solo-dom.mjs';

// Real panel/verification with finite DOM focus and injected install/launch
// boundaries. Actual flight adoption and native input are qualified separately.
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture(t, options = {}) {
  const doc = new Document(),
    win = new Events();
  doc.defaultView = win;
  doc.createElement = (tag) => {
    const element = new SoloElement(doc, tag);
    let disabled = element.disabled;
    Object.defineProperty(element, 'disabled', {
      get: () => disabled,
      set(value) {
        disabled = !!value;
        if (disabled && doc.activeElement === element) doc.activeElement = doc.body;
      },
    });
    return element;
  };
  let installed = !!options.installed,
    downloads = 0,
    activations = 0,
    chosen = 0;
  const source = {
    id: 'play-fixture',
    controlId: 'source',
    name: 'Exact fixture',
    themeId: 'fpv',
    mode: 'Arcade',
    levels: 1,
    bytes: 1024,
    inspect: async () => ({ status: installed ? 'installed' : 'absent' }),
    download: async (operation) => {
      downloads++;
      await options.download?.(operation);
      installed = true;
    },
    install: async () => {
      installed = true;
    },
    play: (operation) => options.play?.(operation),
    ...options.source,
  };
  const panel = attachOptionalChaptersPanel({
    document: doc,
    matchMedia: () => null,
    getLibrary: () => ({ packs: [] }),
    loadCatalog: async () => ({ format: 'revealline-optional-chapters.v1', packs: [] }),
    sourceChapters: [
      source,
      ...Array.from({ length: options.siblings ?? 0 }, (_, index) => ({
        ...source,
        id: `sibling-${index}`,
        controlId: `sibling-${index}`,
      })),
    ],
    onPlayActivation: (operation) => {
      activations++;
      options.activate?.(operation);
    },
    onChosen: () => {
      chosen++;
    },
    ...options.panel,
  });
  t.after(() => panel.dispose());
  const $ = (id) => doc.getElementById(`optional-worlds-${id}`);
  return {
    panel,
    doc,
    win,
    $,
    source,
    primary: () => $('source-download'),
    get downloads() {
      return downloads;
    },
    get activations() {
      return activations;
    },
    get chosen() {
      return chosen;
    },
  };
}

test('one Download & play activation retains its lease and stable Play action until explicit start', async (t) => {
  let activation, launched;
  const order = [];
  const h = fixture(t, {
    activate: (operation) => {
      activation = operation;
      order.push('activate');
    },
    download: () => {
      order.push('download');
      assert.ok(activation.launch.isCurrent());
    },
    play: (operation) => {
      launched = operation;
      order.push('play');
      return true;
    },
  });
  await h.panel.open();
  const primary = h.primary();
  assert.match(primary.textContent, /Download & play/);
  primary.focus();
  await primary.onclick();
  assert.deepEqual(order, ['activate', 'download', 'play']);
  assert.equal(launched.launch, activation.launch);
  assert.equal(launched.signal, activation.signal);
  assert.equal(h.primary(), primary);
  assert.equal(primary.textContent, 'Play');
  assert.equal(primary.disabled, false);
  assert.equal(h.doc.activeElement, primary);
  assert.equal(h.$('dialog').open, true, 'Resolved callback does not prove gameplay started.');
  assert.equal(launched.launch.isCurrent(), true, 'Deferred replacement survives outer cleanup.');
  assert.equal(
    launched.launch.onSelected(),
    false,
    'Selection alone cannot complete a play intent.',
  );
  assert.equal(h.chosen, 0);
  assert.equal(launched.launch.onStarted(), true);
  assert.equal(h.$('dialog').open, false);
  assert.equal(h.chosen, 1);
  assert.equal(launched.launch.onStarted(), false);
  assert.equal(h.chosen, 1);
});

test('Play on an installed source skips download and failed preparation can retry', async (t) => {
  let attempts = 0,
    launch;
  const h = fixture(t, {
    installed: true,
    play: (operation) => {
      if (++attempts === 1) throw new Error('Original picture decode failed.');
      launch = operation.launch;
    },
  });
  await h.panel.open();
  h.primary().focus();
  await h.primary().onclick();
  assert.match(h.$('status').textContent, /decode failed/);
  assert.equal(h.primary().disabled, false);
  assert.equal(h.primary().textContent, 'Play');
  assert.equal(h.$('dialog').open, true);
  await h.primary().onclick();
  assert.equal(h.downloads, 0);
  assert.equal(h.activations, 2);
  assert.equal(launch.onStarted(), true);
});

for (const event of ['blur', 'hidden', 'pagehide', 'filter', 'next page'])
  test(`${event} during download retires its play intent permanently without undoing installation`, async (t) => {
    const download = deferred();
    let launch,
      played = 0;
    const h = fixture(t, {
      siblings: event === 'next page' ? 5 : 0,
      activate: (operation) => {
        launch = operation.launch;
      },
      download: () => download.promise,
      play: () => {
        played++;
      },
    });
    await h.panel.open();
    h.primary().focus();
    const pending = h.primary().onclick();
    let focusCalls = 0;
    const focus = h.primary().focus.bind(h.primary());
    h.primary().focus = (...args) => {
      focusCalls++;
      focus(...args);
    };
    if (event === 'blur') {
      h.doc.focused = false;
      h.win.emit('blur');
      h.doc.focused = true;
    } else if (event === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
      h.doc.hidden = false;
    } else if (event === 'pagehide') h.win.emit('pagehide');
    else if (event === 'filter') {
      h.$('theme').focus();
      h.$('theme').value = 'fpv';
      h.$('theme').onchange();
    } else {
      h.$('next').focus();
      h.$('next').onclick();
    }
    assert.equal(launch.isCurrent(), false);
    download.resolve();
    await pending;
    assert.equal(played, 0);
    assert.equal(h.primary().textContent, 'Play');
    assert.equal(h.primary().disabled, false);
    assert.equal(focusCalls, 0);
    assert.equal(launch.onStarted(), false);
    assert.equal(h.$('dialog').open, true);
  });

test('Cancel after a committed but unsettled download retains the install for a fresh Play', async (t) => {
  const download = deferred();
  let old, current;
  const h = fixture(t, {
    activate: (operation) => {
      old ??= operation;
    },
    download: () => download.promise,
    play: (operation) => {
      current = operation;
    },
  });
  await h.panel.open();
  h.primary().focus();
  const pending = h.primary().onclick();
  h.$('cancel').focus();
  h.$('cancel').onclick();
  assert.equal(old.signal.aborted, true);
  download.resolve();
  await pending;
  assert.equal(current, undefined);
  assert.equal(old.launch.onStarted(), false);
  h.panel.close(false);
  await h.panel.open();
  assert.equal(h.primary().textContent, 'Play');
  h.primary().focus();
  await h.primary().onclick();
  assert.equal(h.downloads, 1);
  assert.notEqual(current.launch, old.launch);
  assert.equal(current.launch.onStarted(), true);
});

for (const departure of ['close-reopen', 'dispose'])
  test(`${departure} prevents a pending host completion from selecting or restoring focus`, async (t) => {
    const host = deferred();
    let launch;
    const h = fixture(t, {
      installed: true,
      play: (operation) => {
        launch = operation.launch;
        return host.promise;
      },
    });
    await h.panel.open();
    h.primary().focus();
    const pending = h.primary().onclick();
    await new Promise((resolve) => setImmediate(resolve));
    if (departure === 'close-reopen') {
      h.panel.close(false);
      await h.panel.open();
    } else h.panel.dispose();
    const active = h.doc.activeElement;
    host.resolve(true);
    await pending;
    assert.equal(launch.onStarted(), false);
    assert.equal(h.chosen, 0);
    assert.equal(h.doc.activeElement, active);
  });

test('deferred Stay keeps its own focus and restores the exact ready Play action once', async (t) => {
  let launch, decision, stay;
  const h = fixture(t, {
    play: (operation) => {
      launch = operation.launch;
      operation.onStatus('Review Replace & play to switch to Exact fixture.', 'checking');
      decision = h.doc.createElement('dialog');
      stay = h.doc.createElement('button');
      decision.append(stay);
      h.doc.body.append(decision);
      decision.showModal();
      stay.focus();
      return false;
    },
  });
  await h.panel.open();
  const primary = h.primary();
  primary.focus();
  await primary.onclick();
  assert.equal(h.doc.activeElement, stay);
  assert.equal(launch.isCurrent(), true);
  assert.match(h.$('status').textContent, /Review Replace & play/);
  decision.close();
  assert.equal(launch.onCancelled({ dialog: decision }), true);
  assert.equal(h.doc.activeElement, primary);
  assert.equal(primary.textContent, 'Play');
  assert.equal(primary.disabled, false);
  assert.equal(h.$('status').dataset.state, 'ready');
  assert.match(h.$('status').textContent, /kept.*paused/i);
  assert.match(h.$('status').textContent, /Play/);
  assert.doesNotMatch(h.$('status').textContent, /Review Replace|Cancellation requested/);
  assert.equal(launch.onStarted(), false);
  assert.equal(h.chosen, 0);
});

test('early Stay keeps its ready return message when the pending host reports and settles late', async (t) => {
  const host = deferred();
  let operation, decision, stay;
  const h = fixture(t, {
    installed: true,
    play: (active) => {
      operation = active;
      active.onStatus('Review Replace & play to switch to Exact fixture.', 'checking');
      decision = h.doc.createElement('dialog');
      stay = h.doc.createElement('button');
      decision.append(stay);
      h.doc.body.append(decision);
      decision.showModal();
      stay.focus();
      return host.promise;
    },
  });
  await h.panel.open();
  const primary = h.primary();
  primary.focus();
  const pending = primary.onclick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.$('dialog').getAttribute('aria-busy'), 'true');
  assert.match(h.$('status').textContent, /Review Replace & play/);
  assert.equal(h.doc.activeElement, stay);
  decision.close();
  assert.equal(operation.launch.onCancelled({ dialog: decision }), true);
  assert.equal(operation.signal.aborted, true);
  assert.equal(primary.disabled, false);
  assert.equal(h.$('dialog').getAttribute('aria-busy'), 'false');
  assert.equal(h.doc.activeElement, primary);
  const kept = h.$('status').textContent;
  assert.equal(h.$('status').dataset.state, 'ready');
  assert.match(kept, /kept.*paused/i);
  assert.match(kept, /Play/);
  assert.doesNotMatch(kept, /Review Replace|Cancellation requested/);
  operation.onStatus('Review Replace & play after a stale save callback.', 'checking');
  host.resolve(false);
  await pending;
  assert.equal(h.$('status').textContent, kept);
  assert.equal(h.$('status').dataset.state, 'ready');
  assert.equal(h.doc.activeElement, primary);
  assert.equal(operation.launch.onStarted(), false);
  assert.equal(h.chosen, 0);
});

test('late old Stay cannot overwrite a newer Play status or take its focus', async (t) => {
  const host = deferred();
  let previous, current, decision;
  const h = fixture(t, {
    installed: true,
    play: (operation) => {
      if (!previous) {
        previous = operation;
        operation.onStatus('Review Replace & play to switch to Exact fixture.', 'checking');
        decision = h.doc.createElement('dialog');
        const stay = h.doc.createElement('button');
        decision.append(stay);
        h.doc.body.append(decision);
        decision.showModal();
        stay.focus();
        return false;
      }
      current = operation;
      operation.onStatus('Preparing the newer chapter artwork.', 'preparing');
      return host.promise;
    },
  });
  await h.panel.open();
  const primary = h.primary();
  primary.focus();
  await primary.onclick();
  decision.close();
  primary.focus();
  const pending = primary.onclick();
  await new Promise((resolve) => setImmediate(resolve));
  const active = h.doc.activeElement,
    message = h.$('status').textContent;
  assert.match(message, /newer chapter artwork/);
  assert.equal(h.$('status').dataset.state, 'busy');
  assert.equal(previous.launch.onCancelled({ dialog: decision }), false);
  assert.equal(h.$('status').textContent, message);
  assert.equal(h.$('status').dataset.state, 'busy');
  assert.equal(h.doc.activeElement, active);
  assert.equal(primary.disabled, true);
  assert.equal(current.launch.isCurrent(), true);
  host.resolve(false);
  await pending;
  assert.equal(h.$('status').textContent, message);
  assert.equal(h.$('status').dataset.state, 'ready');
  assert.equal(previous.launch.onCancelled({ dialog: decision }), false);
  assert.equal(h.$('status').textContent, message);
  assert.equal(current.launch.onStarted(), true);
});

test('late old host settlement cannot clear a newer Play operation or its nested decision', async (t) => {
  const first = deferred(),
    second = deferred();
  const leases = [];
  const h = fixture(t, {
    installed: true,
    play: ({ launch }) => {
      leases.push(launch);
      return leases.length === 1 ? first.promise : second.promise;
    },
  });
  await h.panel.open();
  const primary = h.primary();
  primary.focus();
  const old = primary.onclick();
  await new Promise((resolve) => setImmediate(resolve));
  h.$('cancel').onclick();
  primary.focus();
  const fresh = primary.onclick();
  await new Promise((resolve) => setImmediate(resolve));
  const status = h.$('status').textContent;
  const active = h.doc.activeElement;
  first.resolve(true);
  await old;
  assert.equal(primary.disabled, true);
  assert.equal(h.$('dialog').getAttribute('aria-busy'), 'true');
  assert.equal(h.$('status').textContent, status);
  assert.equal(h.doc.activeElement, active);
  assert.equal(leases[0].onStarted(), false);
  assert.equal(leases[1].isCurrent(), true);
  second.resolve();
  await fresh;
  assert.equal(leases[1].onStarted(), true);
});

test('manual exact-pair recovery installs without creating a play activation', async (t) => {
  const h = fixture(t, { play: () => assert.fail('Recovery must not play.') });
  await h.panel.open();
  h.$('source-pack').files = [new Blob(['pack'])];
  h.$('source-media').files = [new Blob(['media'])];
  await h.$('source-install').onclick();
  assert.equal(h.activations, 0);
  assert.equal(h.downloads, 0);
  assert.equal(h.primary().textContent, 'Play');
  assert.equal(h.$('dialog').open, true);
});

test('activation refusal or synchronous departure prevents download and preparation', async (t) => {
  for (const refusal of ['throw', 'close']) {
    const h = fixture(t, {
      activate: () => {
        if (refusal === 'throw') throw new Error('Current flight cannot be replaced.');
        h.panel.close(false);
      },
      play: () => assert.fail('Retired activation must not play.'),
    });
    await h.panel.open();
    await h.primary().onclick();
    assert.equal(h.activations, 1);
    assert.equal(h.downloads, 0);
    assert.equal(h.chosen, 0);
  }
});

test('installed-only Play captures the exact pack object without calling fallback Choose', async (t) => {
  const pack = {
    id: 'owned-pack',
    name: 'Owned pack',
    themes: [{ id: 'fpv' }],
    campaigns: [{ levels: [{ classic: {} }] }],
  };
  let seen, activation;
  const h = fixture(t, {
    panel: {
      sourceChapters: [],
      getLibrary: () => ({ packs: [pack] }),
      onPlayActivation: (operation) => {
        activation = operation;
      },
      chooseInstalled: () => assert.fail('Play must not fall back to selection.'),
      playInstalled: (target, operation) => {
        seen = { target, ...operation };
      },
    },
  });
  await h.panel.open();
  const primary = h.$('installed-choose-owned-pack');
  primary.focus();
  await primary.onclick();
  assert.equal(seen.target, pack);
  assert.equal(seen.launch, activation.launch);
  assert.equal(seen.signal, activation.signal);
  assert.equal(h.$('dialog').open, true);
  assert.equal(seen.launch.onStarted(), true);
});

test('published Play retains the captured verified descriptor and avoids a second install', async (t) => {
  const catalog = JSON.parse(
    await readFile(new URL('../content/optional-worlds.json', import.meta.url)),
  );
  const item = catalog.packs[0];
  const source = JSON.parse(await readFile(new URL(`../../${item.path}`, import.meta.url)));
  const pack = (
    await preparePack(source, {
      decodeImage: async (url) => {
        const bytes = Buffer.from(url.split(',')[1], 'base64');
        return { naturalWidth: bytes.readUInt32BE(16), naturalHeight: bytes.readUInt32BE(20) };
      },
    })
  ).pack;
  let library = { packs: [] },
    installs = 0,
    installedItem;
  const plays = [];
  const h = fixture(t, {
    panel: {
      sourceChapters: [],
      getLibrary: () => library,
      loadCatalog: async () => ({ ...catalog, packs: [item] }),
      install: async (entry) => {
        installedItem = entry;
        installs++;
        library = { packs: [pack] };
      },
      play: (entry, operation) => {
        plays.push({ entry, ...operation });
      },
      choose: () => assert.fail('Play must not fall back to selection.'),
    },
  });
  await h.panel.open();
  const primary = h.$(`install-${item.id}`);
  primary.focus();
  await primary.onclick();
  assert.equal(plays.length, 1);
  assert.equal(plays[0].entry, installedItem);
  assert.equal(Object.isFrozen(installedItem), true);
  assert.equal(plays[0].entry.normalizedSha256, item.normalizedSha256);
  assert.equal(primary.textContent, 'Play');
  assert.equal(h.$(`choose-${item.id}`), null);
  await primary.onclick();
  assert.equal(installs, 1);
  assert.equal(plays.length, 2);
  assert.equal(plays[0].launch.onStarted(), false, 'A newer Play owns the accepted intent.');
  assert.equal(plays[1].launch.onStarted(), true);
});
