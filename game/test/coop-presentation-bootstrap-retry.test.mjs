import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import { COOP_PICTURE_BINDINGS } from '../couch/coop-picture-bindings.mjs';

// Actual Team host, shared page loader, picture resolver, core and painter.
// The injected presentation transport and finite DOM/Canvas are modeled; this
// does not qualify native image decoding, layout, offline access or devices.
const state = (f) => f.$('coop-picture-status').dataset.state;
const settle = (f, expected) =>
  waitFor(
    () => state(f) === expected,
    () => f.$('coop-picture-status').textContent,
  );
const terminal = (f) =>
  waitFor(
    () => ['ready', 'error'].includes(state(f)),
    () => f.$('coop-picture-status').textContent,
  );

function assertLobby(f, arena) {
  assert.equal(f.$('coop-menu').hidden, false, 'Recovery must retain the lobby.');
  assert.equal(f.$('coop-play').hidden, true, 'Only explicit Start may begin a flight.');
  assert.equal(f.$('coop-level').value, arena, 'Recovery retains the selected arena.');
  assert.equal(f.drawImages.length, 0, 'No arena picture is painted before Start.');
  assert.deepEqual(f.visits, [], 'Recovery does not navigate or reload the page.');
}

function retry(f) {
  const button = f.$('coop-picture-retry');
  assert.equal(button.hidden, false);
  button.focus();
  f.tap('Enter');
  assert.equal(state(f), 'preparing', 'Retry acknowledges the new preparation immediately.');
  assert.equal(f.$('coop-start').disabled, true);
  assert.equal(f.$('coop-picture-cancel').hidden, false);
}

async function failedBootstrap(t, { arena = 'first-connection', load } = {}) {
  t.mock.method(console, 'error', () => {});
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    capturePaint: true,
    waitPicture: false,
    beforeImport({ $ }) {
      $('coop-level').value = arena;
      $('coop-level').emit('change');
    },
    presentation: { load },
  });
  await settle(f, 'error');
  assert.equal(f.artwork.calls.loads, 1);
  assert.equal(
    f.artwork.calls.reads.length,
    0,
    'Unavailable presentation cannot authorize a picture.',
  );
  assert.equal(f.artwork.calls.decodes.length, 0);
  assert.equal(f.$('coop-start').disabled, true);
  assert.equal(f.$('coop-picture-retry').hidden, false);
  assert.equal(f.$('coop-picture-cancel').hidden, true);
  assertLobby(f, arena);
  return f;
}

for (const arena of ['first-connection', 'relay-yard']) {
  test(`${arena}: explicit Retry recovers a failed release presentation without replacing selection or automatically starting`, async (t) => {
    let unavailable = true;
    const f = await failedBootstrap(t, {
      arena,
      load() {
        if (unavailable) throw new Error('Controlled initial presentation outage.');
      },
    });
    f.tick(60);
    assert.equal(f.artwork.calls.loads, 1, 'Background frames do not retry or loop.');
    unavailable = false;
    retry(f);
    await terminal(f);
    assert.equal(f.artwork.calls.loads, 2, 'Retry must perform a new presentation load.');
    assert.equal(state(f), 'ready');
    const row = COOP_PICTURE_BINDINGS.find((item) => item.levelId === arena);
    assert.deepEqual(
      f.artwork.calls.reads.map((item) => item.slot),
      [row.picture.slot],
    );
    assert.equal(f.artwork.calls.decodes.length, 1);
    assert.equal(f.artwork.calls.decodes[0].sha256, row.picture.sha256);
    assert.equal(f.$('coop-start').disabled, false);
    assert.equal(f.$('coop-picture-cancel').hidden, true);
    assert.equal(f.$('coop-picture-retry').hidden, true);
    f.tick(60);
    assertLobby(f, arena);

    f.$('coop-start').focus();
    f.tap('Enter');
    f.tick(3);
    assert.equal(f.$('coop-menu').hidden, true);
    assert.equal(f.$('coop-play').hidden, false);
    assert.equal(f.$('coop-overlay').hidden, true);
    assert.equal(f.arenaDrawImages.at(-1).sha256, row.picture.sha256);
    assert.equal(f.artwork.calls.loads, 2, 'Start borrows the recovered presentation.');
    assert.equal(f.artwork.calls.reads.length, 1);
  });
}

test('cancelling a held presentation Retry fences late readiness; a fresh Retry prepares the same arena without automatic Start', async (t) => {
  const held = deferred();
  t.after(() => held.resolve());
  const f = await failedBootstrap(t, {
    arena: 'relay-yard',
    load({ calls }) {
      if (calls.loads === 1) throw new Error('Controlled initial presentation outage.');
      if (calls.loads === 2) return held.promise;
    },
  });
  retry(f);
  // Error is included so the unchanged implementation fails at the meaningful
  // load-count assertion, rather than timing out while waiting for new behavior.
  await waitFor(() => f.artwork.calls.loads === 2 || state(f) === 'error');
  assert.equal(f.artwork.calls.loads, 2, 'The held retry needs an actual new presentation load.');
  assert.equal(state(f), 'preparing');
  assert.equal(f.artwork.calls.reads.length, 0);
  f.$('coop-picture-cancel').focus();
  f.tap('Enter');
  assert.equal(state(f), 'cancelled');
  assert.equal(f.$('coop-start').disabled, true);
  assert.equal(f.doc.activeElement.id, 'coop-picture-retry');
  f.$('coop-versus').focus();
  held.resolve();
  await waitFor(() => f.artwork.lease.current() !== null);
  await new Promise((resolve) => setImmediate(resolve));
  f.tick(60);
  assert.equal(
    state(f),
    'cancelled',
    'Shared asset readiness does not revive a cancelled picture action.',
  );
  assert.equal(f.$('coop-start').disabled, true);
  assert.equal(f.artwork.calls.reads.length, 0);
  assert.equal(
    f.doc.activeElement.id,
    'coop-versus',
    'Late readiness cannot steal a newer focus choice.',
  );
  assertLobby(f, 'relay-yard');

  retry(f);
  await terminal(f);
  assert.equal(state(f), 'ready');
  assert.equal(f.artwork.calls.loads, 2, 'The successful shared presentation is retained.');
  assert.deepEqual(
    f.artwork.calls.reads.map((item) => item.slot),
    [COOP_PICTURE_BINDINGS[1].picture.slot],
  );
  assertLobby(f, 'relay-yard');
});

test('another failed bootstrap Retry remains actionable and a later explicit Retry recovers without a background retry loop', async (t) => {
  let unavailable = true;
  const f = await failedBootstrap(t, {
    load() {
      if (unavailable) throw new Error('Controlled presentation resource unavailable.');
    },
  });
  retry(f);
  await terminal(f);
  assert.equal(
    f.artwork.calls.loads,
    2,
    'A failed explicit Retry still performs fresh acquisition.',
  );
  assert.equal(state(f), 'error');
  assert.equal(f.$('coop-start').disabled, true);
  assert.equal(f.$('coop-picture-retry').hidden, false);
  assert.equal(f.artwork.calls.reads.length, 0);
  f.tick(120);
  assert.equal(f.artwork.calls.loads, 2, 'Only another explicit Retry may try again.');
  assertLobby(f, 'first-connection');
  unavailable = false;
  retry(f);
  await terminal(f);
  assert.equal(f.artwork.calls.loads, 3);
  assert.equal(state(f), 'ready');
  assert.equal(f.artwork.calls.reads.length, 1);
  assertLobby(f, 'first-connection');
});

test('recovered presentation updates automatic menu appearance while unsupported Team artwork stays blocked', async (t) => {
  const f = await failedBootstrap(t, {
    load({ snapshot, calls }) {
      if (calls.loads === 1) throw new Error('Controlled initial presentation outage.');
      // Model an accepted page theme identity only. This does not create an
      // approved Retro Team collection or relax the exact FPV picture binding.
      snapshot.resolved.theme.id = 'retro';
    },
  });
  assert.equal(f.$('coop-menu-palette').value, 'auto');
  assert.equal(f.doc.body.dataset.menuPalette, 'ukrainian');
  retry(f);
  await terminal(f);
  assert.equal(f.artwork.calls.loads, 2);
  assert.equal(f.artwork.lease.current().resolved.theme.id, 'retro');
  assert.equal(state(f), 'error', 'Unsupported Team artwork must still fail closed.');
  assert.equal(f.$('coop-start').disabled, true);
  assert.equal(f.$('coop-picture-retry').hidden, false);
  assert.equal(f.artwork.calls.reads.length, 0);
  assert.equal(f.artwork.calls.decodes.length, 0);
  f.tick(60);
  assertLobby(f, 'first-connection');
  assert.equal(
    f.$('coop-menu-palette').value,
    'auto',
    'Recovery does not change the saved choice.',
  );
  assert.equal(
    f.doc.body.dataset.menuPalette,
    'authored',
    'Automatic menu appearance follows the successfully recovered page presentation.',
  );
});
