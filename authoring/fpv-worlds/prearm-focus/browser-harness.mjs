/* global document, window, crypto, fetch, navigator */
const $ = (id) => document.getElementById(id),
  frame = $('sim');
const receipt = {
  format: 'FPVPrearmFocusBrowser.v1',
  checks: [],
  snapshots: [],
  startedAt: new Date().toISOString(),
  userAgent: navigator.userAgent,
};
let w, d, app, next, manualStart;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const q = (selector) => d.querySelector(selector);
const visible = (node) =>
  Boolean(
    node?.checkVisibility({ checkVisibilityCSS: true }) &&
      !node.closest('[hidden]') &&
      !node.closest('dialog:not([open])'),
  );
function check(value, name, detail) {
  receipt.checks.push({
    name,
    passed: Boolean(value),
    ...(detail === undefined ? {} : { detail }),
  });
  if (!value) throw Error(name);
}
function click(node) {
  check(
    visible(node) && !node.disabled,
    'public control is available: ' + (node?.id || node?.textContent),
  );
  node.click();
}
async function until(predicate, name) {
  const deadline = performance.now() + 25000;
  while (!predicate()) {
    if (performance.now() > deadline) throw Error('Timeout: ' + name);
    await sleep(20);
  }
}
async function frames(count = 3) {
  for (let i = 0; i < count; i++) await new Promise(w.requestAnimationFrame.bind(w));
}
function snap(name) {
  const value = app.snapshot();
  const item = {
    name,
    course: value.course,
    state: value.state,
    appearance: value.appearance,
    active: d.activeElement?.id,
    settings: q('#sim-settings')?.open ?? null,
    home: q('#worlds-shell-home-dialog')?.open ?? null,
    controlsParent: q('#sim-flight-controls')?.parentElement?.id ?? null,
    status: q('#flight-status')?.textContent ?? null,
    visible: d.visibilityState,
    focused: d.hasFocus(),
  };
  receipt.snapshots.push(item);
  return item;
}
async function ready() {
  await until(() => /^(Ready\.|Готово\.)/.test(q('#flight-status').textContent), 'native Ready');
  await frames();
}
function openSettings() {
  click(q('#worlds-shell-action-menu'));
  click(q('#worlds-shell-action-settings'));
  check(
    q('#sim-settings').open && q('#worlds-shell-home-dialog').open,
    'Settings keeps its parent Home',
  );
}
async function appearance(value, scope) {
  const node = q('#sim-appearance-world');
  check(visible(node), scope + ': appearance control is visible');
  node.scrollIntoView({ block: 'center' });
  node.focus();
  node.value = value;
  node.dispatchEvent(new w.Event('change', { bubbles: true }));
  await ready();
  const state = snap(scope + ': ' + value);
  check(d.activeElement === node, scope + ': focus remains on the same select');
  check(
    state.appearance.accepted.collectionId === value,
    scope + ': selected appearance is accepted',
  );
  check(
    state.state.status === 'disarmed' && state.state.ticks === 0,
    scope + ': refresh remains disarmed at tick0',
  );
  check(state.course === 'container-yard-08', scope + ': course is retained');
}
async function run() {
  $('run').disabled = true;
  document.body.dataset.running = 'true';
  try {
    const manifest = await (await fetch('fixture.json', { cache: 'no-store' })).json();
    receipt.fixture = manifest;
    for (const row of manifest.files) {
      const response = await fetch(row.path, { cache: 'no-store' });
      const bytes = await response.arrayBuffer();
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('');
      check(
        response.ok && bytes.byteLength === row.bytes && digest === row.sha256,
        'frozen file: ' + row.path,
      );
    }
    check(
      manifest.files.filter((r) => r.provenance !== 'fixture only').length === 102,
      'all102 admitted members or explicit source overlay are present',
    );
    frame.src = 'player/optional-practice/fpv-worlds/focus-host.html';
    await until(() => frame.contentWindow.fpvWorldStudio, 'native host mounts');
    w = frame.contentWindow;
    d = frame.contentDocument;
    app = w.fpvWorldStudio;
    await app.ready;
    w.focus();
    click(q('#worlds-shell-action-missions'));
    click(q('[data-world="container-yard"]'));
    click(
      [...d.querySelectorAll('button[aria-label]')].find(
        (node) => node.getAttribute('aria-label') === 'Fly: Yard extraction',
      ),
    );
    await ready();
    check(d.activeElement === q('#world-viewport'), 'ordinary Fly focuses the viewport');
    check(app.snapshot().state.status === 'disarmed', 'ordinary Fly does not arm');
    const options = q('#flight-options');
    receipt.flightOptionsVisible = visible(options);
    if (receipt.flightOptionsVisible) {
      click(options);
      await appearance('industrial-workshop', 'Flight options');
      check(q('#flight-dialog').dataset.optionsOpen === 'true', 'Flight options remains open');
      click(options);
    }
    openSettings();
    // Always choose a different value so both Settings refreshes actually run.
    const first =
      q('#sim-appearance-world').value === 'authored' ? 'industrial-workshop' : 'authored';
    await appearance(first, 'Settings first refresh');
    check(
      q('#sim-settings').open && q('#worlds-shell-home-dialog').open,
      'First refresh retains Settings and Home',
    );
    const second = first === 'authored' ? 'industrial-workshop' : 'authored';
    await appearance(second, 'Settings second refresh');
    check(
      q('#sim-settings').open && q('#worlds-shell-home-dialog').open,
      'Second refresh retains Settings and Home',
    );
    manualStart = w.fpvFocusObserved.keys.length;
    $('continue').hidden = false;
    $('status').textContent =
      'Native keyboard check: focus is on World appearance. Press Tab, then Shift+Tab, then Finish focus checks.';
    await new Promise((resolve) => {
      next = resolve;
    });
    const keys = w.fpvFocusObserved.keys.slice(manualStart);
    check(
      keys.some(
        (e) =>
          e.type === 'keydown' &&
          e.key === 'Tab' &&
          !e.shift &&
          e.trusted &&
          e.target === 'sim-appearance-world',
      ),
      'trusted Tab leaves the retained appearance control',
    );
    check(
      keys.some(
        (e) =>
          e.type === 'keyup' &&
          e.key === 'Tab' &&
          e.shift &&
          e.trusted &&
          e.active === 'sim-appearance-world',
      ),
      'trusted Shift+Tab returns to the same appearance control',
    );
    w.focus();
    click(q('#close-sim-settings'));
    check(
      q('#worlds-shell-home-dialog').open && !q('#sim-settings').open,
      'Close Settings returns to the retained Home',
    );
    click(q('#worlds-shell-action-primary'));
    await until(() => app.snapshot().state.ticks >= 2, 'deliberately armed native flight advances');
    click(q('#worlds-shell-action-menu'));
    const paused = snap('paused after deliberate arm');
    check(paused.state.status === 'paused', 'Menu pauses the active flight');
    click(q('#worlds-shell-action-settings'));
    const node = q('#sim-appearance-world');
    node.focus();
    node.value = second === 'authored' ? 'industrial-workshop' : 'authored';
    node.dispatchEvent(new w.Event('change', { bubbles: true }));
    await frames();
    const pending = snap('post-arm appearance queued');
    check(
      pending.appearance.pending && pending.appearance.accepted.collectionId === second,
      'post-arm appearance remains pending for the next attempt',
    );
    check(
      JSON.stringify(pending.state) === JSON.stringify(paused.state),
      'post-arm change preserves the complete paused flight state',
    );
    check(
      d.activeElement === node && q('#sim-settings').open && q('#worlds-shell-home-dialog').open,
      'post-arm change retains focus and both menu surfaces',
    );
    click(q('#close-sim-settings'));
    click(q('#worlds-shell-action-home-retry'));
    await ready();
    const retry = snap('ordinary Retry');
    check(
      retry.active === 'world-viewport' && !retry.home && !retry.settings,
      'ordinary Retry closes menus and focuses the viewport',
    );
    check(
      retry.state.status === 'disarmed' && retry.state.ticks === 0 && !retry.appearance.pending,
      'ordinary Retry starts a new disarmed attempt',
    );
    check(
      retry.appearance.accepted.collectionId === node.value,
      'ordinary Retry adopts the queued appearance',
    );
    await app.dispose();
    receipt.observed = w.fpvFocusObserved;
    check(receipt.observed.errors.length === 0, 'no unexpected errors');
    check(receipt.observed.warnings.length === 0, 'no unexpected warnings');
    receipt.completed = true;
    $('status').textContent = 'PASS ' + receipt.checks.length + '/' + receipt.checks.length;
  } catch (error) {
    receipt.error = String(error.stack ?? error);
    try {
      if (app) receipt.failureState = snap('failure');
    } catch (captureError) {
      receipt.failureCaptureError = String(captureError);
    }
    receipt.observed = w?.fpvFocusObserved;
    $('status').textContent = 'STOPPED: ' + error.message;
  } finally {
    receipt.finishedAt = new Date().toISOString();
    $('receipt').value = JSON.stringify(receipt, null, 2);
    document.body.dataset.running = 'false';
  }
}
$('run').onclick = run;
$('continue').onclick = () => {
  $('continue').hidden = true;
  next?.();
};
window.fpvFocusReceipt = receipt;
