import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';

function fullscreenBrowser(doc, { denied = false, window: win = null } = {}) {
  if (win && win !== doc.defaultView) {
    Object.assign(win, doc.defaultView);
    doc.defaultView = win;
  }
  let requests = 0;
  doc.fullscreenEnabled = true;
  doc.fullscreenElement = null;
  doc.documentElement.requestFullscreen = async () => {
    requests++;
    if (denied) throw new TypeError('A direct browser gesture is required');
    doc.fullscreenElement = doc.documentElement;
    doc.emit('fullscreenchange');
  };
  doc.exitFullscreen = async () => {
    doc.fullscreenElement = null;
    doc.emit('fullscreenchange');
  };
  return { requests: () => requests };
}

function keyboardTo(doc, target) {
  for (let step = 0; step < 80 && doc.activeElement !== target; step++) {
    const active = doc.activeElement;
    const event = active.emit('keydown', { key: 'Tab', code: 'Tab', repeat: false });
    const dialog = active.closest('dialog[open]');
    // Native dialogs retain interior Tab defaults; only their boundary is
    // intercepted by the shared navigator. Model that browser-owned traversal.
    if (!event.defaultPrevented && dialog) {
      const choices = [...dialog.querySelectorAll('button,a[href],input,select,textarea,summary')]
        .filter(
          (node) =>
            !node.disabled &&
            node.tabIndex >= 0 &&
            !node.closest('[hidden],[inert],[aria-hidden="true"]') &&
            node.getClientRects().length,
        )
        .filter((node) => {
          for (
            let parent = node.parentElement;
            parent && parent !== dialog;
            parent = parent.parentElement
          )
            if (
              parent.tagName === 'DETAILS' &&
              !parent.open &&
              parent.querySelector('summary') !== node
            )
              return false;
          return true;
        });
      choices[(choices.indexOf(active) + 1) % choices.length]?.focus();
    }
  }
  assert.ok(
    doc.activeElement === target,
    `the landing utility belongs to the keyboard menu; actual ${doc.activeElement?.id}`,
  );
}
async function enter(doc) {
  const target = doc.activeElement;
  const event = target.emit('keydown', { key: 'Enter', code: 'Enter', repeat: false });
  // Model native Enter activation after production key handlers have their turn.
  if (!event.defaultPrevented) target.click();
  target.emit('keyup', { key: 'Enter', code: 'Enter' });
  await Promise.resolve();
}

const hosts = [
  {
    mode: 'solo',
    landing: 'shell-fullscreen',
    settings: null,
    open: 'shell-options',
    display: 'settings-tab-display',
    create: (t, setup) => soloPage(t, { titleScreen: true, browserSetup: setup }),
  },
  {
    mode: 'versus',
    settings: 'race-settings-fullscreen',
    open: 'race-options',
    display: 'race-settings-tab-display',
    create: (t, setup) => couchPage(t, { beforeImport: setup }),
  },
  {
    mode: 'team',
    settings: 'coop-settings-fullscreen',
    open: 'coop-settings-open',
    display: 'coop-settings-tab-display',
    create: (t, setup) =>
      teamPage(t, { beforeImport: ({ doc, win }) => setup({ document: doc, window: win }) }),
  },
];

for (const host of hosts) {
  test(`${host.mode} ${host.settings ? 'landing and Display share' : 'landing retains'} fullscreen state and native keyboard access`, async (t) => {
    let browser;
    const page = await host.create(t, ({ document, window }) => {
      browser = fullscreenBrowser(document, { window });
    });
    const { doc, $ } = page;
    const landing = $(host.landing ?? `${host.mode}-landing-fullscreen`),
      settings = host.settings ? $(host.settings) : null;
    assert(landing);
    if (host.settings) assert(settings);
    assert.equal(landing.hidden, false);
    assert.equal(landing.dataset.menuIcon, 'fullscreen');
    assert.equal(landing.getAttribute('aria-label'), 'Enter fullscreen');
    if (settings) assert.equal(settings.textContent, 'Enter fullscreen');
    keyboardTo(doc, landing);
    await enter(doc);
    assert.equal(browser.requests(), 1);
    assert.ok(doc.fullscreenElement === doc.documentElement);
    assert.equal(landing.getAttribute('aria-label'), 'Exit fullscreen');
    if (settings) assert.equal(settings.getAttribute('aria-pressed'), 'true');
    const landingRoot = landing.closest('.native-landing'),
      initialFlightState = doc.body.dataset.flightState;
    const escape = landing.emit('keydown', { key: 'Escape', code: 'Escape', repeat: false });
    assert.equal(escape.defaultPrevented, true, 'embedded-browser Escape exits before menu Back');
    await Promise.resolve();
    const held = landing.emit('keydown', { key: 'Escape', code: 'Escape', repeat: true });
    assert.equal(held.defaultPrevented, true, 'the same held Escape cannot close the landing');
    landing.emit('keyup', { key: 'Escape', code: 'Escape' });
    assert.equal(doc.fullscreenElement, null);
    assert.equal(doc.documentElement.dataset.gameFullscreen, undefined);
    assert.equal(landingRoot.hidden, false);
    if (landingRoot.tagName === 'DIALOG') assert.equal(landingRoot.open, true);
    assert.equal(doc.body.dataset.flightState, initialFlightState);
    assert.ok(doc.activeElement === landing, doc.activeElement?.id);
    assert.equal(landing.getAttribute('aria-label'), 'Enter fullscreen');
    if (settings) assert.equal(settings.getAttribute('aria-pressed'), 'false');
    await enter(doc);
    if (settings) {
      $(host.open).click();
      $(host.display).click();
      keyboardTo(doc, settings);
    } else {
      // Solo retains the existing landing fullscreen control. Display does not
      // manufacture a second action inside its Settings panel.
      assert.equal($('settings-panel-display').contains(landing), false);
      assert.ok(landingRoot.contains(landing));
    }
    await enter(doc);
    assert.equal(doc.fullscreenElement, null);
    assert.equal(landing.getAttribute('aria-pressed'), 'false');
    if (settings) assert.equal(settings.textContent, 'Enter fullscreen');
    assert.equal(browser.requests(), 2, 'Exit calls only the native exit API');
  });
}

test('the Versus controller can reach the landing utility and a denied request remains visible and truthful', async (t) => {
  const pad = {
    index: 0,
    id: 'Fullscreen fixture',
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  let browser;
  const page = await couchPage(t, {
    pads: [pad],
    beforeImport: ({ document, window }) => {
      browser = fullscreenBrowser(document, { denied: true, window });
    },
  });
  page.join(0);
  const landing = page.$('versus-landing-fullscreen');
  for (let step = 0; step < 16 && page.doc.activeElement !== landing; step++) {
    // Sound and fullscreen share a horizontal utility row. Down enters that
    // row; Right reaches its second action without leaving the menu.
    page.pulse(0, landing.parentNode.contains(page.doc.activeElement) ? 15 : 13);
  }
  assert.ok(page.doc.activeElement === landing, 'D-pad navigation reaches the landing utility');
  page.pulse(0, 0);
  await Promise.resolve();
  assert.equal(
    browser.requests(),
    1,
    'the real controller router activates the same fullscreen owner',
  );
  assert.equal(page.doc.fullscreenElement, null);
  assert.equal(landing.getAttribute('aria-pressed'), 'false');
  assert.equal(page.$('race-settings-fullscreen').getAttribute('aria-pressed'), 'false');
  const feedback = page.$('versus-landing-fullscreen-status');
  assert.equal(feedback.hidden, false);
  assert.match(feedback.textContent, /Fullscreen is unavailable/);
  assert.equal(landing.getAttribute('aria-describedby'), feedback.id);
  page.$('race-start').click();
  page.frame();
  page.$('race-pause').click();
  page.frame();
  assert.equal(page.doc.body.dataset.couchStatus, 'paused');
  assert.equal(landing.closest('.shared-pause-menu')?.contains(feedback), true);
  assert.equal(feedback.hidden, false, 'Denied fullscreen feedback stays visible with Pause.');
});
