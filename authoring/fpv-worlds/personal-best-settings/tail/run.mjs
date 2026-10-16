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
  // Native Back closes child surfaces before Home controls become reachable.
  // This matters when the observed Start action opens a briefing.
  for (const name of ['briefing', 'missions']) {
    const dialog = q('#worlds-shell-' + name + '-dialog');
    if (dialog?.open) {
      click(q('#worlds-shell-action-' + name + '-back'));
      await until(() => !dialog.open, 'native Back from ' + name);
    }
  }
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
  receipt.format = 'FPVPublicGhostReplayTail.v2';
  receipt.limitations = [
    'Narrow continuation of unchanged-runtime8945. Its173 passing pointer/keyboard/layout/locale/owner checks remain historical; this run does not repeat trusted actions.',
    'Native UI phase/dialog/label observations diagnose the language→primary transition; no production clocks, focus/arming guards, flight state, proof bytes or handler are changed.',
    'Native Watch can auto-start. Public Settings deliberately pauses it before disabled ghost eligibility is checked; tick zero is not required or claimed.',
    'Fresh public same-course selection establishes the intended arm action for the missing replay tail; it does not repair or qualify away any preceding language/navigation observation.',
  ];
  receipt.transitions = [];
  const dom = (name) => {
    const s = p.app.snapshot();
    const row = {
      name,
      at: performance.now(),
      state: s.state,
      course: s.course,
      replay: s.replay,
      phase: q('[data-mode-play-shell]')?.dataset.phase,
      primary: q('#worlds-shell-action-primary')?.textContent,
      status: q('#flight-status')?.textContent,
      armDisabled: q('#world-arm')?.disabled,
      focused: d.hasFocus(),
      visibility: d.visibilityState,
      dialogs: [...d.querySelectorAll('dialog')].map((n) => ({
        id: n.id,
        open: n.open,
      })),
      activeElement: d.activeElement?.id,
    };
    receipt.transitions.push(row);
    return row;
  };
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
    phase('Narrow tail: create a genuine native reference');
    await importPack();
    await fly();
    await settings();
    set('flight-source', 'keyboard');
    set('flight-camera', 'chase');
    await closeSettings();
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
      'native verified reference',
    );
    const record = p.app
      .snapshot()
      .records.find((r) => r.course.id === 'warm-frame-diagnostic-route');
    receipt.practiceRecord = record;
    await fly();
    await settings();
    await until(() => !q('#show-ghost').disabled, 'available reference');
    phase('Observe exact language and primary-action sequence');
    dom('before Ukrainian');
    set('world-language', 'uk');
    await frames();
    dom('after Ukrainian native frames');
    click(q('#show-ghost'));
    await until(
      () => p.app.snapshot().ghost.enabled && !p.app.snapshot().ghost.loading,
      'Ukrainian public Show',
    );
    click(q('#show-ghost'));
    await until(() => !p.app.snapshot().ghost.enabled, 'Ukrainian public Hide');
    set('world-language', 'en');
    dom('immediately after English repaint');
    for (let i = 0; i < 2; i++) {
      await closeSettings();
      await settings();
      dom('immediate Settings cycle ' + i);
    }
    await closeSettings();
    await menu();
    dom('before exact prior primary click');
    click(q('#worlds-shell-action-primary'));
    dom('immediately after exact prior primary click');
    await frames();
    dom('after primary native frames');
    receipt.originalTailObservation =
      'This observed transition is retained regardless of whether primary meant Start/briefing or Continue/Arm. No active predicate is weakened.';
    phase('Fresh visible same-course launch for missing replay tail');
    await fly();
    await settings();
    set('flight-source', 'keyboard');
    await closeSettings();
    await frames();
    dom('fresh selected course before deliberate Arm');
    await arm();
    await until(
      () =>
        p.app.snapshot().state.status === 'complete' &&
        [...d.querySelectorAll('#result-panel button')].some(
          (n) => n.textContent === 'Watch verified flight',
        ),
      'native complete with Watch',
    );
    await menu();
    await until(() => visible(q('#worlds-shell-action-home-results')), 'native Results action');
    click(q('#worlds-shell-action-home-results'));
    const watch = [...d.querySelectorAll('#result-panel button')].find(
      (n) => n.textContent === 'Watch verified flight',
    );
    dom('before public Watch');
    click(watch);
    await until(
      () => p.app.snapshot().replay && !q('#world-arm').disabled,
      'public Watch preparation',
    );
    dom('native Watch before explicit Settings pause');
    await settings();
    await frames();
    const replay = snapshot('public Settings pauses verified playback');
    check(
      replay.app.replay?.frames === record.proof.frames.length &&
        replay.app.replay?.mode === record.proof.mode,
      'public replay retains verified mode and frame count',
    );
    check(
      replay.button.visible && replay.button.disabled,
      'public Settings ghost is visibly disabled during replay',
    );
    check(
      !replay.app.ghost.enabled && !replay.app.ghost.loading,
      'replay has no enabled or pending ghost',
    );
    check(replay.app.state.status !== 'active', 'public Settings pauses native playback');
    const saved = replay.app.state;
    await frames(4);
    pausedSame(saved, p.app.snapshot().state, 'replay Settings');
    dom('final replay paused');
    await p.finish();
    receipt.host = p.data;
    check(
      Object.values(p.data.disposed.resources.registered).every((n) => n === 0),
      'ordinary tail disposal releases registered resources',
    );
    check(!p.data.errors.length && !p.data.warnings.length, 'no observed errors or warnings');
    check(!Object.keys(p.data.dropped).length, 'bounded observations complete');
    receipt.passed = true;
    phase('PASS: narrow replay tail complete; inspect original transition observation');
  } catch (error) {
    receipt.error = { message: String(error), stack: error.stack };
    try {
      if (p) {
        dom('failure before cleanup');
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
        transitions: receipt.transitions.map((t) => ({
          name: t.name,
          phase: t.phase,
          primary: t.primary,
          status: t.status,
          state: t.state?.status,
          ticks: t.state?.ticks,
          open: t.dialogs.filter((d) => d.open).map((d) => d.id),
        })),
        receiptCharacters: $('receipt').value.length,
      },
      null,
      2,
    );
  }
}
$('run').onclick = run;
