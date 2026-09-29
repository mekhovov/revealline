import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import { importedRoute, importedResult, winImported } from './helpers/coop-import-win.mjs';
import { teamImage } from './helpers/coop-win.mjs';
import { COOP_HISTORICAL_IMPORT_PICTURE_POLICY } from '../couch/coop-picture-bindings.mjs';

const options = { nativeFocus: true, nativeVisibility: true };
const pack = (name = 'example') => {
  const value = structuredClone(importedRoute.authoredPack);
  value.id = name;
  value.name = name;
  value.levels[0].revision = '2';
  return value;
};
const preview = (f) => f.previewDrawImages.at(-1);
const status = (f) => f.$('coop-pack-status').textContent;
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('historical multi-core imports prepare real approved image bytes and retain their string revision', async (t) => {
  const f = await page(t, options);
  const original = JSON.stringify(pack());
  const oldImage = preview(f),
    oldURL = oldImage.src;
  f.$('coop-pack-file').focus();
  await f.selectFile(original);
  assert.equal(f.$('coop-level').value, 'boundary-multi-core-stronghold');
  assert.equal(f.$('coop-pack-status').dataset.state, 'ready');
  assert.equal(f.doc.activeElement.id, 'coop-start');
  assert.notEqual(preview(f), oldImage);
  assert.equal(preview(f).sha256, COOP_HISTORICAL_IMPORT_PICTURE_POLICY.picture.sha256);
  assert.equal(f.artwork.calls.reads.at(-1).slot, 'scene.reveal.wide');
  assert.deepEqual(f.artwork.calls.releases, [oldURL]);
  assert.equal(JSON.stringify(pack()), original);
  f.tap('Enter');
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(teamImage(f), preview(f));
  assert.match(f.$('coop-objective').textContent, /Relays 0 \/ 2 · Relay 2 · Anchors 0 \/ 2/);
});

for (const ending of ['success', 'failure']) {
  test(`cancel during imported decode ignores late ${ending} and Retry pack adopts only on purpose`, async (t) => {
    const gate = deferred();
    t.after(() => gate.resolve());
    const f = await page(t, {
      ...options,
      presentation: {
        decode: ({ calls }) => (calls.decodes.length === 2 ? gate.promise : undefined),
      },
    });
    const oldImage = preview(f);
    const pending = f.selectFile(JSON.stringify(pack()));
    await waitFor(() => f.artwork.calls.decodes.length === 2);
    assert.equal(f.$('coop-start').disabled, true);
    assert.equal(f.$('coop-level').value, 'first-connection');
    assert.equal(preview(f), oldImage);
    f.$('coop-pack-cancel').click();
    assert.equal(f.$('coop-start').disabled, false);
    assert.equal(f.$('coop-pack-retry').hidden, false);
    const cancelled = status(f);
    if (ending === 'success') gate.resolve();
    else gate.reject(new Error('late decoder failure'));
    await pending;
    assert.equal(status(f), cancelled);
    assert.equal(preview(f), oldImage);
    assert.equal(f.$('coop-menu').hidden, false);
    assert.equal(f.$('coop-level').value, 'first-connection');
    assert.equal(f.artwork.calls.releases.length, 1);
    f.$('coop-pack-retry').focus();
    await f.$('coop-pack-retry').onclick();
    assert.equal(f.$('coop-level').value, 'boundary-multi-core-stronghold');
    assert.equal(f.$('coop-start').disabled, false);
    assert.equal(f.doc.activeElement.id, 'coop-start');
    assert.equal(f.$('coop-menu').hidden, false);
    assert.equal(f.artwork.calls.reads.length, 3);
    assert.equal(f.artwork.calls.releases.length, 2);
  });
}

test('failed required artwork preserves the ready pack and explicit Retry uses the same validated import', async (t) => {
  const f = await page(t, {
    ...options,
    presentation: {
      read: ({ calls }) => {
        if (calls.reads.length === 2) throw new Error('fixture offline');
      },
    },
  });
  const oldImage = preview(f);
  await f.selectFile(JSON.stringify(pack()));
  assert.equal(f.$('coop-level').value, 'first-connection');
  assert.equal(preview(f), oldImage);
  assert.equal(f.$('coop-start').disabled, false);
  assert.equal(f.$('coop-pack-status').dataset.state, 'error');
  assert.match(status(f), /Pack unchanged: fixture offline/);
  assert.equal(f.$('coop-pack-retry').hidden, false);
  await f.$('coop-pack-retry').onclick();
  assert.equal(f.$('coop-level').value, 'boundary-multi-core-stronghold');
  assert.equal(f.$('coop-pack-retry').hidden, true);
  assert.equal(f.$('coop-menu').hidden, false);
});

test('a newer import owns setup when the older decoder finishes later', async (t) => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await page(t, {
    ...options,
    presentation: {
      decode: ({ calls }) => (calls.decodes.length === 2 ? gate.promise : undefined),
    },
  });
  const first = f.selectFile(JSON.stringify(pack('older')));
  await waitFor(() => f.artwork.calls.decodes.length === 2);
  const newer = pack('newer');
  newer.levels.reverse();
  await f.selectFile(JSON.stringify(newer));
  const image = preview(f),
    message = status(f);
  assert.equal(f.$('coop-level').value, 'boundary-multi-core-coverage');
  gate.resolve();
  await first;
  assert.equal(f.$('coop-level').value, 'boundary-multi-core-coverage');
  assert.equal(preview(f), image);
  assert.equal(status(f), message);
  assert.equal(f.artwork.calls.releases.length, 2);
});

for (const action of ['hidden', 'arena']) {
  test(`${action} while an imported image loads retires its authority`, async (t) => {
    const gate = deferred();
    t.after(() => gate.resolve());
    const f = await page(t, {
      ...options,
      presentation: {
        decode: ({ calls }) => (calls.decodes.length === 2 ? gate.promise : undefined),
      },
    });
    const pending = f.selectFile(JSON.stringify(pack()));
    await waitFor(() => f.artwork.calls.decodes.length === 2);
    if (action === 'hidden') {
      f.doc.hidden = true;
      f.doc.emit('visibilitychange');
      f.doc.hidden = false;
      f.win.emit('pageshow', { persisted: true });
    } else await f.choose('coop-level', 'relay-yard');
    const image = preview(f);
    gate.resolve();
    await pending;
    assert.equal(preview(f), image);
    assert.equal(f.$('coop-level').value, action === 'hidden' ? 'first-connection' : 'relay-yard');
    assert.equal(f.$('coop-start').disabled, false);
    assert.equal(f.$('coop-menu').hidden, false);
    f.$('coop-start').click();
    assert.equal(f.$('coop-menu').hidden, true, 'the retained/chosen arena is playable');
  });
}

test('imported Next retains its earned image during cancelled picture preparation', async (t) => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await winImported(t, {
    presentation: {
      read: ({ calls }) => (calls.reads.length === 3 ? gate.promise : undefined),
    },
  });
  const result = importedResult(f),
    image = teamImage(f);
  assert.ok(image);
  f.tap('Enter');
  await waitFor(() => f.artwork.calls.reads.length === 3);
  assert.deepEqual(importedResult(f), result);
  assert.equal(teamImage(f), image);
  f.$('coop-next-cancel').click();
  gate.resolve();
  await flush();
  assert.deepEqual(importedResult(f), result);
  assert.equal(teamImage(f), image);
  assert.equal(f.$('coop-overlay').hidden, false);
  f.$('coop-next').focus();
  f.tap('Enter');
  await waitFor(() => f.$('coop-overlay').hidden);
  assert.equal(f.$('coop-level').value, 'boundary-multi-core-coverage');
  assert.equal(f.$('coop-reserves').textContent, '5 reserves');
  assert.notEqual(teamImage(f), image);
});

for (const interruption of ['cancel', 'render-error']) {
  test(`import adoption ${interruption} restores the previous playable picture and shows recovery`, async (t) => {
    const f = await page(t, options);
    const image = preview(f),
      url = image.src;
    const select = f.$('coop-level'),
      original = select.replaceChildren.bind(select);
    let once = true;
    t.mock.method(select, 'replaceChildren', (...args) => {
      original(...args);
      if (!once) return;
      once = false;
      if (interruption === 'cancel') f.$('coop-pack-cancel').click();
      else throw new Error('injected setup rendering failure');
    });
    await f.selectFile(JSON.stringify(pack()));
    assert.equal(f.$('coop-level').value, 'first-connection');
    assert.equal(preview(f), image);
    assert.equal(image.src, url);
    assert.equal(f.$('coop-start').disabled, false);
    assert.equal(f.$('coop-pack-retry').hidden, false);
    if (interruption === 'render-error') {
      assert.equal(f.$('coop-pack-status').dataset.state, 'error');
      assert.match(status(f), /injected setup rendering failure/);
    }
    f.$('coop-start').click();
    assert.equal(f.$('coop-menu').hidden, true);
    assert.equal(teamImage(f), image);
    assert.equal(
      f.artwork.calls.releases.length,
      1,
      'discarded draft releases only its own prepared image',
    );
  });
}

test('terminal page disposal while an import decodes releases both images exactly once', async (t) => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await page(t, {
    ...options,
    presentation: {
      decode: ({ calls }) => (calls.decodes.length === 2 ? gate.promise : undefined),
    },
  });
  const pending = f.selectFile(JSON.stringify(pack()));
  await waitFor(() => f.artwork.calls.decodes.length === 2);
  f.win.emit('pagehide', { persisted: false });
  gate.resolve();
  await pending;
  assert.equal(f.artwork.calls.releases.length, 2);
  assert.equal(new Set(f.artwork.calls.releases).size, 2);
  assert.equal(f.$('coop-menu').hidden, false);
});

for (const action of ['reset', 'replace', 'dispose']) {
  test(`${action} during setup adoption releases old and tentative images without replacing its successor`, async (t) => {
    const f = await page(t, options);
    const oldURL = preview(f).src;
    const select = f.$('coop-level'),
      original = select.replaceChildren.bind(select);
    let once = true,
      replacement;
    t.mock.method(select, 'replaceChildren', (...args) => {
      original(...args);
      if (!once) return;
      once = false;
      if (action === 'replace') {
        const next = pack('replacement');
        next.levels.reverse();
        replacement = f.selectFile(JSON.stringify(next));
      } else if (action === 'reset') f.$('coop-pack-reset').onclick();
      else f.win.emit('pagehide', { persisted: false });
    });
    await f.selectFile(JSON.stringify(pack()));
    if (action === 'replace') {
      await replacement;
      assert.equal(f.$('coop-level').value, 'boundary-multi-core-coverage');
      assert.equal(f.$('coop-start').disabled, false);
      assert.match(status(f), /^replacement/);
      assert.equal(f.artwork.calls.decodes.length, 3);
    }
    if (action === 'reset') {
      await waitFor(() => f.$('coop-picture-status').dataset.state === 'ready');
      assert.equal(f.$('coop-level').value, 'first-connection');
      assert.equal(f.$('coop-start').disabled, false);
      assert.notEqual(preview(f).src, oldURL);
      assert.equal(f.artwork.calls.decodes.length, 3);
    }
    assert.equal(f.artwork.calls.releases.length, 2);
    assert.equal(new Set(f.artwork.calls.releases).size, 2);
    assert.ok(f.artwork.calls.releases.includes(oldURL));
    assert.equal(f.$('coop-menu').hidden, false);
  });
}
