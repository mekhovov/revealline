/* Bounded access qualification. Flight is created only through public native controls. */
const $ = (id) => document.getElementById(id),
  frame = $('sim');
const receipt = {
  format: 'FPVPublicGhostSettings.v1',
  checks: [],
  snapshots: [],
  limitations: [
    'Source fixture: 102 retained admitted files and one declared committed host overlay; not a fresh package/offline or hardware qualification.',
    'Native iframe IndexedDB uses isolated names. Fixture upload supplies its diagnostic pack through the real public input; no proof or flight state is injected.',
    'The diagnostic ground hold/land course produces a native verified practice record and does not qualify flight skill.',
    'Trusted pointer and keyboard ghost actions require the coordinator; other public controls are exercised by the fixture and explicitly recorded as scripted DOM actions.',
  ],
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let w, d, p, fixture, continuation;
const q = (s) => d.querySelector(s);
function check(value, name, detail) {
  receipt.checks.push({
    name,
    passed: Boolean(value),
    ...(detail === undefined ? {} : { detail }),
  });
  if (!value) throw Error(name);
}
async function until(fn, name, ms = 30000) {
  const end = performance.now() + ms;
  while (!fn()) {
    if (performance.now() > end) throw Error('Timeout: ' + name);
    await sleep(35);
  }
}
const visible = (n) =>
  Boolean(
    n?.checkVisibility({ checkVisibilityCSS: true }) && !n.closest('[hidden],dialog:not([open])'),
  );
function click(n) {
  check(visible(n) && !n.disabled, 'public control ' + (n?.id || n?.textContent));
  n.click();
}
function set(id, value) {
  const n = q('#' + id);
  check(visible(n) && !n.disabled, 'public setting ' + id);
  n.value = value;
  n.dispatchEvent(new w.Event('change', { bubbles: true }));
}
async function frames(n = 3) {
  for (let i = 0; i < n; i++) await new Promise(w.requestAnimationFrame.bind(w));
}
function snapshot(name) {
  const row = {
    name,
    app: p.app.snapshot(),
    presentation: p.capture(),
    button: ghostDOM(),
  };
  receipt.snapshots.push(row);
  return row;
}
function ghostDOM() {
  const n = q('#show-ghost');
  return n
    ? {
        visible: visible(n),
        hidden: n.hidden,
        disabled: n.disabled,
        text: n.textContent,
        pressed: n.getAttribute('aria-pressed'),
        describedBy: n.getAttribute('aria-describedby'),
        parent: n.parentElement?.id,
        rect: n.getBoundingClientRect().toJSON(),
      }
    : null;
}
function phase(text) {
  $('status').textContent = text;
}
async function menu() {
  if (q('#sim-settings').open) click(q('#close-sim-settings'));
  if (!q('#worlds-shell-home-dialog').open) click(q('#worlds-shell-action-menu'));
  await until(() => q('#worlds-shell-home-dialog').open, 'native menu');
}
async function settings() {
  await menu();
  click(q('#worlds-shell-action-settings'));
  await until(() => q('#sim-settings').open, 'native Settings');
}
async function closeSettings() {
  click(q('#close-sim-settings'));
  await until(() => !q('#sim-settings').open, 'Settings closed');
}
async function missions() {
  await menu();
  click(q('#worlds-shell-action-missions'));
}
async function fly() {
  await missions();
  click(q('[data-world="warm-frame-diagnostic"]'));
  click(
    [...d.querySelectorAll('button[aria-label]')].find(
      (n) => n.getAttribute('aria-label') === 'Fly: Diagnostic grounded recording',
    ),
  );
  await until(
    () => q('#flight-status').textContent.startsWith('Ready. Choose') && !q('#world-arm').disabled,
    'diagnostic course Ready',
  );
  await frames();
  check(
    p.app.snapshot().course === 'warm-frame-diagnostic-route',
    'selected exact diagnostic course',
  );
}
function reveal(n) {
  for (let a = n.parentElement; a; a = a.parentElement)
    if (a.tagName === 'DETAILS' && !a.open) click(a.querySelector(':scope > summary'));
}
async function importPack() {
  await missions();
  click(q('[data-tab="packs"]'));
  const n = q('#import-pack');
  reveal(n);
  check(visible(n.closest('label')), 'visible native pack input');
  const bytes = await (await fetch('diagnostic.rlpack')).arrayBuffer(),
    transfer = new w.DataTransfer();
  transfer.items.add(
    new w.File([bytes], 'diagnostic.rlpack', {
      type: 'application/octet-stream',
    }),
  );
  n.files = transfer.files;
  n.dispatchEvent(new w.Event('change', { bubbles: true }));
  await until(
    () => n.value === '' && q('[data-remove-pack="warm-frame-diagnostic"]'),
    'native pack install',
  );
}
async function arm() {
  await menu();
  click(q('#worlds-shell-action-primary'));
  await until(() => p.app.snapshot().state.status === 'active', 'ordinary deliberate Arm');
}
async function manual(message) {
  phase(message);
  $('continue').hidden = false;
  await new Promise((resolve) => (continuation = resolve));
  $('continue').hidden = true;
  continuation = null;
}
$('continue').onclick = () => continuation?.();
function pausedSame(before, after, name) {
  for (const key of ['ticks', 'position', 'orientation', 'velocity', 'lastInput'])
    check(equal(before[key], after[key]), name + ' preserves ' + key);
  check(after.status !== 'active', name + ' never arms');
}
async function run() {
  $('run').disabled = true;
  try {
    fixture = await (await fetch('fixture.json')).json();
    receipt.fixture = fixture;
    receipt.startedAt = new Date().toISOString();
    for (const row of fixture.files) {
      const bytes = await (await fetch(row.path)).arrayBuffer(),
        sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
          .map((n) => n.toString(16).padStart(2, '0'))
          .join('');
      check(bytes.byteLength === row.bytes && sha === row.sha256, 'frozen file ' + row.path);
    }
    frame.src =
      'player/optional-practice/fpv-worlds/ghost-host.html?storage=' +
      encodeURIComponent('ghost-' + crypto.randomUUID() + ':');
    await until(() => frame.contentWindow?.fpvGhost, 'native host ready');
    w = frame.contentWindow;
    d = frame.contentDocument;
    p = w.fpvGhost;
    w.focus();
    phase('Import and first no-record access');
    await importPack();
    await fly();
    await settings();
    const empty = snapshot('no personal best');
    check(
      empty.button.visible && empty.button.disabled,
      'Settings exposes unavailable personal best as disabled',
    );
    check(empty.button.text === 'Show personal best', 'English unchanged unavailable label');
    check(empty.app.state.ticks === 0, 'no-record access retains zero ticks');
    check(
      empty.button.describedBy === 'sector-reference ghost-status',
      'existing accessible description references retained',
    );
    check(!empty.app.replay, 'ordinary practice not replay');
    set('flight-source', 'keyboard');
    set('flight-camera', 'chase');
    await closeSettings();
    phase('Genuine native 60-tick grounded practice');
    await arm();
    await until(
      () =>
        p.app
          .snapshot()
          .records.some(
            (r) =>
              r.course.id === 'warm-frame-diagnostic-route' &&
              r.proof.session === 'practice' &&
              r.status === 'verified' &&
              r.diagnostic === 'complete',
          ),
      'verified native practice',
    );
    const record = p.app
      .snapshot()
      .records.find((r) => r.course.id === 'warm-frame-diagnostic-route');
    receipt.practiceRecord = record;
    check(record.proof.frames.length >= 60, 'native record includes both authored objectives');
    await fly();
    await until(() => !q('#show-ghost').disabled, 'exact personal best selected');
    await settings();
    await frames();
    const before = snapshot('personal best before public toggle');
    check(
      before.app.sectorTiming.status === 'ready' &&
        before.app.sectorTiming.referenceId === record.id,
      'personal best uses exact verified record',
    );
    check(
      before.button.visible && !before.button.disabled,
      'available ghost control is visible in public Settings',
    );
    frame.style.width = '320px';
    await frames();
    q('#show-ghost').scrollIntoView({ block: 'center' });
    await frames();
    const narrow = snapshot('native 320px Settings');
    check(
      d.documentElement.clientWidth === 320 && d.documentElement.scrollWidth <= 320,
      'native 320px document has no horizontal overflow',
    );
    check(
      narrow.button.rect.left >= 0 &&
        narrow.button.rect.right <= 320 &&
        narrow.button.rect.width > 0,
      'ghost control fits native 320px Settings',
    );
    const pointerStart = p.data.events.length;
    await manual(
      'POINTER: click “Show personal best” in Settings, wait for “Hide personal best”, then click Continue checks above.',
    );
    await until(
      () => p.app.snapshot().ghost.enabled && !p.app.snapshot().ghost.loading,
      'public pointer ghost loaded',
    );
    await frames();
    const shown = snapshot('trusted pointer shows personal best');
    check(
      p.data.events
        .slice(pointerStart)
        .some((e) => e.type === 'click' && e.trusted && e.detail > 0),
      'trusted pointer activated existing ghost button',
    );
    check(
      shown.button.pressed === 'true' && shown.button.text === 'Hide personal best',
      'unchanged shown label and aria-pressed',
    );
    check(
      shown.app.ghost.referenceId === record.id && shown.app.ghost.presentation.samples > 1,
      'ghost retains exact record and native replay samples',
    );
    pausedSame(before.app.state, shown.app.state, 'pointer Show');
    frame.style.width = '100%';
    await closeSettings();
    await frames();
    const chase = snapshot('Chase presentation after Settings close');
    check(
      chase.app.ghost.presentation.visible &&
        equal(chase.app.ghost.presentation.pose.position, chase.app.state.position),
      'Chase renders matching personal best at paused spawn',
    );
    await settings();
    q('#show-ghost').scrollIntoView({ block: 'center' });
    const keyboardStart = p.data.events.length;
    await manual(
      'KEYBOARD: use Tab/Shift+Tab to focus “Hide personal best”, then Enter or Space to hide it. Click Continue checks above afterward.',
    );
    await until(() => !p.app.snapshot().ghost.enabled, 'public keyboard ghost hidden');
    await frames();
    const hidden = snapshot('trusted keyboard hides personal best');
    const ke = p.data.events.slice(keyboardStart);
    check(
      ke.some(
        (e) => e.type === 'keydown' && e.trusted && ['Enter', ' ', 'Spacebar'].includes(e.key),
      ) && ke.some((e) => e.type === 'click' && e.trusted && e.detail === 0),
      'trusted keyboard activated the existing button',
    );
    check(
      hidden.button.pressed === 'false' && hidden.button.text === 'Show personal best',
      'hidden label and aria-pressed preserved',
    );
    pausedSame(shown.app.state, hidden.app.state, 'keyboard Hide');
    check(hidden.app.ghost.presentation.samples === 0, 'Hide clears ghost presentation samples');
    set('world-language', 'uk');
    await frames();
    check(
      ghostDOM().text === 'Показати особистий рекорд',
      'Ukrainian label uses unchanged native localization',
    );
    click(q('#show-ghost'));
    await until(
      () => p.app.snapshot().ghost.enabled && !p.app.snapshot().ghost.loading,
      'Ukrainian public Show',
    );
    check(ghostDOM().text === 'Сховати особистий рекорд', 'Ukrainian shown label');
    click(q('#show-ghost'));
    await until(() => !p.app.snapshot().ghost.enabled, 'Ukrainian public Hide');
    set('world-language', 'en');
    for (let i = 0; i < 2; i++) {
      await closeSettings();
      await settings();
      check(
        visible(q('#show-ghost')) && !q('#show-ghost').disabled,
        'repeated Settings retains same available button ' + i,
      );
    }
    check(
      q('#show-ghost') === d.getElementById('show-ghost') &&
        d.querySelectorAll('#show-ghost').length === 1,
      'single existing control owner',
    );
    snapshot('final public Settings paused');
    await closeSettings();
    phase('Existing replay eligibility remains disabled');
    await arm();
    await until(
      () =>
        p.app.snapshot().state.status === 'complete' &&
        [...d.querySelectorAll('#result-panel button')].some(
          (n) => n.textContent === 'Watch verified flight',
        ),
      'second native completion with public Watch',
    );
    await menu();
    click(q('#worlds-shell-action-home-results'));
    const watch = [...d.querySelectorAll('#result-panel button')].find(
      (n) => n.textContent === 'Watch verified flight',
    );
    click(watch);
    await until(
      () =>
        q('#flight-status').textContent.startsWith('Playback paused.') && !q('#world-arm').disabled,
      'native replay prepared',
    );
    await settings();
    const replay = snapshot('public Settings during verified replay');
    check(
      replay.app.replay?.frames === record.proof.frames.length &&
        replay.app.replay?.mode === record.proof.mode,
      'public Watch uses exact completed replay mode and frame count',
    );
    check(
      replay.button.visible && replay.button.disabled,
      'ghost remains visibly disabled during replay',
    );
    check(
      replay.app.state.status !== 'active' && replay.app.state.ticks === 0,
      'replay Settings never starts playback',
    );
    await p.finish();
    receipt.host = p.data;
    check(
      Object.values(p.data.disposed.resources.registered).every((n) => n === 0),
      'ordinary disposal releases registered resources',
    );
    check(!p.data.errors.length && !p.data.warnings.length, 'no observed errors or warnings');
    check(!Object.keys(p.data.dropped).length, 'bounded observations complete');
    receipt.passed = true;
    phase('PASS: public personal-best access checks complete');
  } catch (error) {
    receipt.error = { message: String(error), stack: error.stack };
    try {
      if (p) {
        snapshot('failure before cleanup');
        await p.finish();
        receipt.host = p.data;
      }
    } catch (cleanup) {
      receipt.cleanupError = String(cleanup);
    }
    receipt.passed = false;
    phase('FAIL: ' + String(error));
  } finally {
    receipt.endedAt = new Date().toISOString();
    $('receipt').value = JSON.stringify(receipt, null, 2);
    $('summary').textContent = JSON.stringify(
      {
        passed: receipt.passed,
        checks: receipt.checks.length,
        failed: receipt.checks.filter((c) => !c.passed),
        error: receipt.error,
        receiptCharacters: $('receipt').value.length,
      },
      null,
      2,
    );
  }
}
$('run').onclick = run;
