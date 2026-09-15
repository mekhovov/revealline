// Actual P03 Couch entry, initial preparation, input and menu code run here.
// Combined P08 required-picture cases also run in couch-static-picture-host.
// DOM layout/focus and native media are finite models, not device evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { couchPage } from './helpers/couch-host.mjs';
import { deferred } from './helpers/media-fixtures.mjs';

const omitFeatured = (path) =>
  path === '../content/packs/fpv-arcade-r5.json' ? { ok: false } : undefined;
const ready = (t, options = {}) =>
  couchPage(t, { initialLevel: null, fetchResponse: omitFeatured, ...options });

function observeStartFocus(document) {
  const start = document.getElementById('race-start');
  const focus = start.focus;
  const observations = [];
  start.focus = function (...args) {
    const boot = [...document.querySelectorAll('[data-boot-inert]')];
    observations.push({
      state: document.documentElement.dataset.toolState,
      inert: boot.some((element) => element.inert),
      busy: boot.some((element) => element.hasAttribute('aria-busy')),
    });
    if (boot.some((element) => element.inert)) return;
    return focus.apply(this, args);
  };
  return observations;
}

function clearedBeforeFocus(observations) {
  assert.deepEqual(observations, [{ state: 'ready', inert: false, busy: false }]);
}

function untouched(page) {
  assert.equal(page.state(), 'ready');
  assert.equal(page.tick(), 0);
  assert.equal(page.doc.querySelector('.controller-focus'), null);
  assert.equal(page.$('race-seat-0').textContent, 'W A S D');
  assert.equal(page.$('race-seat-1').textContent, 'Arrow keys');
}

test('untouched prepared lobby focuses enabled Start once without controller ownership or starting', async (t) => {
  let focusObservations;
  const page = await ready(t, {
    beforeImport({ document }) {
      focusObservations = observeStartFocus(document);
    },
    pads: [
      {
        index: 0,
        id: 'Neutral connected pad',
        connected: true,
        mapping: 'standard',
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
      },
    ],
  });
  assert.equal(page.doc.activeElement.id, 'race-start');
  assert.equal(page.$('race-start').disabled, false);
  clearedBeforeFocus(focusObservations);
  untouched(page);
  page.focus('race-coop');
  page.frames(8);
  assert.equal(page.doc.activeElement.id, 'race-coop');
  untouched(page);
});

async function heldBoot(t, beforeImport) {
  const entered = deferred(),
    gate = deferred();
  let dom, focusObservations;
  const opening = ready(t, {
    beforeImport(context) {
      dom = context;
      focusObservations = observeStartFocus(context.document);
      beforeImport?.(context);
    },
    async fetchResponse(path) {
      if (path === '../content/campaign.json') {
        entered.resolve();
        await gate.promise;
      }
      return omitFeatured(path);
    },
  });
  await entered.promise;
  return {
    ...dom,
    focusObservations,
    finish: async () => {
      gate.resolve();
      return opening;
    },
  };
}

test('delayed initial preparation leaves loading focus alone, then hands off to Ready Start', async (t) => {
  const pending = await heldBoot(t);
  assert.equal(pending.document.activeElement === pending.document.body, true);
  assert.equal(pending.document.documentElement.dataset.toolState, 'loading');
  const page = await pending.finish();
  assert.equal(page.doc.activeElement.id, 'race-start');
  clearedBeforeFocus(pending.focusObservations);
  untouched(page);
});

for (const choice of ['current', 'moved-away', 'pre-attached-recovery'])
  test(`a deliberate ${choice} focus is never replaced by the initial handoff`, async (t) => {
    let restoreLaunch;
    const pending = await heldBoot(t, ({ document }) => {
      if (choice !== 'pre-attached-recovery') return;
      const prior = Object.getOwnPropertyDescriptor(globalThis, 'RevealLineToolLaunch');
      restoreLaunch = () =>
        prior
          ? Object.defineProperty(globalThis, 'RevealLineToolLaunch', prior)
          : delete globalThis.RevealLineToolLaunch;
      document.getElementById('boot-return').focus();
      globalThis.RevealLineToolLaunch = {
        attached() {
          document.getElementById('boot-return').hidden = true;
          document.activeElement = document.body;
        },
      };
    });
    if (restoreLaunch) t.after(restoreLaunch);
    if (choice !== 'pre-attached-recovery') {
      pending.document.getElementById('boot-return').focus();
      if (choice === 'moved-away') pending.document.activeElement.blur();
    }
    const page = await pending.finish();
    assert.notEqual(page.doc.activeElement.id, 'race-start');
    untouched(page);
  });

for (const reason of ['initial-background', 'blur-return', 'hidden-return', 'pagehide-return'])
  test(`${reason} permanently relinquishes initial focus even when ready later`, async (t) => {
    const pending = await heldBoot(t, ({ document }) => {
      if (reason === 'initial-background') document.focused = false;
    });
    if (reason === 'hidden-return') {
      pending.document.hidden = true;
      pending.document.emit('visibilitychange');
      pending.document.hidden = false;
      pending.document.emit('visibilitychange');
    } else if (reason === 'pagehide-return') {
      pending.window.emit('pagehide', { persisted: true });
      pending.window.emit('pageshow', { persisted: true });
    } else if (reason === 'blur-return') {
      pending.document.focused = false;
      pending.window.emit('blur');
    }
    pending.document.focused = true;
    const page = await pending.finish();
    assert.equal(page.doc.activeElement === page.doc.body, true);
    untouched(page);
  });

for (const hidden of ['disabled', 'no-rect', 'css-hidden', 'aria-hidden'])
  test(`an initially ${hidden} Start is never chosen as focus`, async (t) => {
    const page = await ready(t, {
      beforeImport({ document }) {
        const start = document.getElementById('race-start');
        if (hidden === 'disabled') {
          // Native disabled state at the focus boundary; the host cannot enable it.
          Object.defineProperty(start, 'disabled', {
            configurable: true,
            get: () => true,
            set() {},
          });
        } else if (hidden === 'no-rect') start.getClientRects = () => [];
        else if (hidden === 'css-hidden') start.style.visibility = 'hidden';
        else start.setAttribute('aria-hidden', 'true');
      },
    });
    assert.notEqual(page.doc.activeElement.id, 'race-start');
    untouched(page);
  });

test('boot failure preserves recovery focus and cannot establish a Ready handoff', async (t) => {
  const page = await ready(t, {
    expectBootFailure: true,
    beforeImport({ document }) {
      document.getElementById('boot-return').focus();
    },
    fetchResponse(path) {
      return path === '../content/campaign.json' ? { ok: false } : omitFeatured(path);
    },
  });
  assert.equal(page.doc.documentElement.dataset.toolState, 'error');
  assert.equal(page.doc.activeElement.id, 'boot-return');
  assert.equal(page.$('boot-return').hidden, false);
  assert.equal(page.$('race-start').disabled, true);
});
