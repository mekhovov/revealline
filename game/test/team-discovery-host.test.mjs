import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { COOP_PICTURE_BINDINGS } from '../couch/coop-picture-bindings.mjs';
import { TEAM_ARENA_PREFERENCE_KEY } from '../couch/team-arena-preference.mjs';

// Actual Team markup, host, prepared originals and simulation. Finite DOM/Image
// boundaries do not establish native layout, physical devices or public play.
const options = { nativeFocus: true, nativeVisibility: true, capturePaint: true };
const dialog = (f) => f.$('coop-discovery-dialog');
const status = (f) => f.$('coop-discovery-status');
const cards = (f) => [...f.$('coop-discovery-list').querySelectorAll('.team-discovery-play')];
const card = (f, title) => {
  const button = cards(f).find((entry) => entry.textContent === `Play ${title}`);
  assert.ok(button, `A playable card exists for ${title}.`);
  return button;
};
function enter(f, button) {
  button.focus();
  f.tap('Enter');
}
function open(f, paused = false) {
  enter(f, f.$(paused ? 'coop-discovery-paused' : 'coop-discovery-open'));
  assert.equal(dialog(f).open, true);
}
const settled = (f, state = 'ready') =>
  waitFor(
    () => status(f).dataset.state === state,
    () => status(f).textContent,
  );
const started = (f, title) =>
  waitFor(
    () => !dialog(f).open && f.$('coop-stage').textContent === title.toUpperCase(),
    () => status(f).textContent,
  );
function pause(f) {
  enter(f, f.$('coop-start'));
  f.tap('Escape');
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.match(f.$('coop-overlay-title').textContent, /paused/i);
}
const currentImage = (f) => f.drawImages.at(-1);

test('Team discovery opens through keyboard and Back restores the exact lobby opener', async (t) => {
  const f = await page(t, {
    ...options,
    beforeImport({ $ }) {
      assert.equal($('coop-discovery-open').disabled, true, 'No unbound action during loading');
    },
  });
  assert.equal(f.$('coop-discovery-open').disabled, false);
  const before = f.previewDrawImages.at(-1);
  open(f);
  assert.deepEqual(
    cards(f).map((button) => button.textContent),
    ['Play First Connection', 'Play Relay Yard'],
  );
  assert.equal(f.doc.activeElement === cards(f)[0], true);
  assert.equal(f.$('coop-menu').hidden, false);
  enter(f, f.$('coop-discovery-back'));
  assert.equal(dialog(f).open, false);
  assert.equal(f.doc.activeElement.id, 'coop-discovery-open');
  assert.equal(f.previewDrawImages.at(-1), before);
  assert.equal(f.$('coop-level').value, 'first-connection');
});

test('one deliberate Play prepares Relay Yard and starts it without another Start screen', async (t) => {
  const f = await page(t, options);
  open(f);
  enter(f, card(f, 'Relay Yard'));
  await started(f, 'Relay Yard');
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(currentImage(f).sha256, COOP_PICTURE_BINDINGS[1].picture.sha256);
  assert.equal(f.$('coop-level').value, 'relay-yard');
  assert.equal(f.$('coop-clock').textContent, '0:00');
});

test('a newer Back focus during Play admission prevents preparation and keeps the current setup', async (t) => {
  const f = await page(t, options);
  open(f);
  await waitFor(() =>
    [...f.$('coop-discovery-list').querySelectorAll('figcaption')].every(
      (caption) => !caption.textContent.startsWith('Preparing'),
    ),
  );
  const reads = f.artwork.calls.reads.length;
  let redirect = true;
  f.$('coop-discovery-cancel').addEventListener('focusin', () => {
    if (!redirect) return;
    redirect = false;
    f.$('coop-discovery-back').focus();
  });
  enter(f, card(f, 'Relay Yard'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.artwork.calls.reads.length, reads);
  assert.equal(f.doc.activeElement.id, 'coop-discovery-back');
  assert.equal(dialog(f).open, true);
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('coop-level').value, 'first-connection');
});

test('successful built-in discovery updates only the existing Team arena bookmark', async (t) => {
  const values = new Map();
  const writes = [];
  const f = await page(t, {
    ...options,
    beforeImport: ({ install }) =>
      install('localStorage', {
        value: {
          getItem: (key) => values.get(key) ?? null,
          setItem(key, value) {
            writes.push(key);
            values.set(key, value);
          },
        },
      }),
  });
  open(f);
  enter(f, card(f, 'Relay Yard'));
  await started(f, 'Relay Yard');
  assert.deepEqual(writes, [TEAM_ARENA_PREFERENCE_KEY]);
  const bookmark = JSON.parse(values.get(TEAM_ARENA_PREFERENCE_KEY));
  assert.equal(bookmark.levelId, 'relay-yard');
  assert.equal(bookmark.packId, COOP_STARTER_PACK.id);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
});

test('a bookmark callback with a newer focus choice is not overwritten after accepted Play', async (t) => {
  const f = await page(t, {
    ...options,
    beforeImport: ({ install, $ }) =>
      install('localStorage', {
        value: {
          getItem: () => null,
          setItem(key) {
            if (key === TEAM_ARENA_PREFERENCE_KEY) $('coop-pause').focus();
          },
        },
      }),
  });
  open(f);
  enter(f, card(f, 'Relay Yard'));
  await started(f, 'Relay Yard');
  assert.equal(f.doc.activeElement.id, 'coop-pause');
  assert.equal(f.$('coop-overlay').hidden, true);
});

test('cancelling held preparation keeps the paused attempt and exact picture available', async (t) => {
  const gate = deferred();
  let held = false;
  const f = await page(t, {
    ...options,
    presentation: {
      read: async ({ slot }) => {
        if (slot === COOP_PICTURE_BINDINGS[1].picture.slot) {
          held = true;
          await gate.promise;
        }
      },
    },
  });
  pause(f);
  const image = currentImage(f);
  const coverage = f.$('coop-coverage').textContent;
  open(f, true);
  enter(f, card(f, 'Relay Yard'));
  await waitFor(() => held);
  enter(f, f.$('coop-discovery-cancel'));
  await settled(f);
  assert.equal(currentImage(f), image);
  assert.equal(f.$('coop-coverage').textContent, coverage);
  assert.equal(f.$('coop-overlay').hidden, false);
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(dialog(f).open, true);
  assert.match(status(f).textContent, /cancelled/i);
  enter(f, f.$('coop-discovery-back'));
  assert.equal(f.doc.activeElement.id, 'coop-discovery-paused');
  assert.equal(f.$('coop-overlay').hidden, false);
  enter(f, f.$('coop-resume'));
  assert.equal(f.$('coop-overlay').hidden, true);
});

test('paused Stay preserves the old arena; a later Replace starts the prepared destination once', async (t) => {
  const f = await page(t, options);
  pause(f);
  const image = currentImage(f);
  open(f, true);
  enter(f, card(f, 'Relay Yard'));
  await waitFor(() => f.$('coop-discard-dialog').open);
  enter(f, f.$('coop-discard-stay'));
  await settled(f);
  assert.equal(currentImage(f), image);
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(dialog(f).open, true);
  enter(f, card(f, 'Relay Yard'));
  await waitFor(() => f.$('coop-discard-dialog').open);
  enter(f, f.$('coop-discard-confirm'));
  await started(f, 'Relay Yard');
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.$('coop-clock').textContent, '0:00');
  assert.equal(currentImage(f).sha256, COOP_PICTURE_BINDINGS[1].picture.sha256);
});

test('failed artwork preparation keeps the paused attempt and offers Play again', async (t) => {
  let fail = true;
  const f = await page(t, {
    ...options,
    presentation: {
      read: ({ slot }) => {
        if (fail && slot === COOP_PICTURE_BINDINGS[1].picture.slot)
          throw new Error('Modeled destination outage');
      },
    },
  });
  pause(f);
  const image = currentImage(f);
  open(f, true);
  enter(f, card(f, 'Relay Yard'));
  await settled(f, 'error');
  assert.equal(currentImage(f), image);
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(card(f, 'Relay Yard').disabled, false);
  fail = false;
  enter(f, card(f, 'Relay Yard'));
  await waitFor(() => f.$('coop-discard-dialog').open);
  enter(f, f.$('coop-discard-confirm'));
  await started(f, 'Relay Yard');
});

test('an opened local Team pack stays discoverable after playing a built-in arena', async (t) => {
  const f = await page(t, options);
  const pack = structuredClone(COOP_STARTER_PACK);
  pack.id = 'local-discovery';
  pack.name = 'Local routes';
  pack.levels.forEach((level, index) => {
    level.id = `local-route-${index}`;
    level.name = `Local route ${index + 1}`;
  });
  await f.selectFile(JSON.stringify(pack));
  open(f);
  assert.equal(cards(f).length, 4);
  enter(f, card(f, 'First Connection'));
  await started(f, 'First Connection');
  f.tap('Escape');
  open(f, true);
  assert.equal(cards(f).length, 4);
  enter(f, card(f, 'Local route 2'));
  await waitFor(() => f.$('coop-discard-dialog').open);
  enter(f, f.$('coop-discard-confirm'));
  await started(f, 'Local route 2');
  assert.match(f.$('coop-pack-status').textContent, /Local routes/);
  assert.equal(f.$('coop-level').value, 'local-route-1');
});

test('foreground loss cancels pending discovery immediately before decoder completion', async (t) => {
  const gate = deferred();
  let held = false;
  const f = await page(t, {
    ...options,
    presentation: {
      decode: async ({ image }) => {
        if (image.sha256 === COOP_PICTURE_BINDINGS[1].picture.sha256) {
          held = true;
          await gate.promise;
        }
      },
    },
  });
  open(f);
  enter(f, card(f, 'Relay Yard'));
  await waitFor(() => held);
  f.win.emit('blur');
  await settled(f);
  assert.equal(f.$('coop-discovery-cancel').hidden, true);
  assert.equal(f.$('coop-menu').hidden, false);
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('coop-level').value, 'first-connection');
});
