/* Observation only. Public controls; original clocks, input, renderer and focus guards. */
const $ = (id) => document.getElementById(id),
  frame = $('sim');
const receipt = {
  format: 'FPVStickGeometryTiming.v1',
  checks: [],
  actions: [],
  hosts: [],
  boundaries: [],
  resourceTrends: [],
  matrix: [
    ['baseline', 'yard'],
    ['candidate', 'yard'],
    ['candidate', 'reservoir'],
    ['baseline', 'reservoir'],
  ],
  windowMs: 5000,
  phases: ['fixed-pose-ready', 'verified-native-playback'],
  limitations: [
    'Exact admitted baseline and one committed Worlds host overlay, Mixed-scene A-yard/B-yard/B-Reservoir/A-Reservoir order, one pair per scene, not repeated same-scene ABBA. This is bounded observation, not a hardware or FPS claim.',
    'Eight predeclared 5-second native-clock windows. Timer delay can extend windows; actual duration and visibility/focus coverage are retained.',
    'Only aggregates inside measured windows. Full state/resources and identity snapshots occur outside windows. Native method results and Promise/RAF contracts are retained.',
    'Renderer duration is CPU command submission, not GPU elapsed; nested durations cannot be added as independent costs.',
    'Observer wrappers and clock/classification work add overhead. observerCPUms is a lower bound, including callback timing for native ResizeObserver; callback duration and native getter duration are nested.',
    'LoAF/longtask support is feature detected. Entries starting inside the window are counted; earlier-starting overlap is excluded. No entries means no qualifying entry observed, not no jank.',
    'Physical device and browser-wide contention are unverified. Browser-reported identity, DPR, viewport and focus are retained; other tabs/processes may exist.',
    'Registered resources are application-owned counts; renderer.info includes internal Three caches that may remain. Same-course growth observations do not claim all browser memory is freed. ImageBitmap.close calls are not observed by this scaffold.',
    'Pack and proofs are explicitly separate public file imports. No Browse, editor/fault, proof-completion or offline qualification is duplicated here.',
    'An unexpected native pause, hidden window or stall is retained and stops this run. No forced clock, automatic resumption or hidden flight-state write.',
  ],
};
const prefix = 'steady-' + crypto.randomUUID() + ':',
  sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stable = (value) =>
  JSON.stringify(value, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, x[k]]),
        )
      : x,
  );
const same = (a, b) => stable(a) === stable(b);
let w, d, p, fixture, variant;
const q = (selector) => d.querySelector(selector);
function check(ok, name, detail) {
  receipt.checks.push({
    name,
    passed: !!ok,
    ...(detail === undefined ? {} : { detail }),
  });
  if (!ok) throw Error(name);
}
async function until(fn, name, ms = 30000) {
  const end = performance.now() + ms;
  while (!(await fn())) {
    if (performance.now() > end) throw Error('Timeout: ' + name);
    await sleep(40);
  }
}
const visible = (n) =>
  !!(n?.checkVisibility({ checkVisibilityCSS: true }) && !n.closest('[hidden],dialog:not([open])'));
function click(n) {
  check(visible(n) && !n.disabled, 'Visible public control ' + (n?.id || n?.textContent));
  receipt.actions.push({
    at: new Date().toISOString(),
    id: n.id,
    label: n.getAttribute('aria-label') || n.textContent,
  });
  n.click();
}
function reveal(n) {
  const parents = [];
  for (let a = n.parentElement; a; a = a.parentElement)
    if (a.tagName === 'DETAILS' && !a.open) parents.unshift(a);
  for (const a of parents) click(a.querySelector(':scope > summary'));
}
function set(id, value) {
  const n = q('#' + id);
  reveal(n);
  check(visible(n) && !n.disabled, 'Visible setting ' + id);
  n.value = value;
  n.dispatchEvent(new w.Event('change', { bubbles: true }));
}
async function frames(n = 3) {
  for (let i = 0; i < n; i++) await new Promise(w.requestAnimationFrame.bind(w));
}
async function home() {
  if (q('#sim-settings')?.open) click(q('#close-sim-settings'));
  for (const name of ['briefing', 'missions'])
    if (q('#worlds-shell-' + name + '-dialog')?.open) {
      click(q('#worlds-shell-action-' + name + '-back'));
      await until(() => !q('#worlds-shell-' + name + '-dialog').open, 'Back ' + name);
    }
  if (!q('#worlds-shell-home-dialog').open) click(q('#worlds-shell-action-menu'));
  await until(() => q('#worlds-shell-home-dialog').open, 'Home');
  await frames();
}
async function settings() {
  await home();
  click(q('#worlds-shell-action-settings'));
  await until(() => q('#sim-settings').open, 'Settings');
  await frames();
}
async function library() {
  await home();
  click(q('#worlds-shell-action-missions'));
  await until(() => q('#worlds-shell-missions-dialog').open, 'Missions');
  click(q('[data-tab="packs"]'));
}
async function upload(id, bytes, name) {
  const n = q('#' + id);
  reveal(n);
  check(visible(n.closest('label')), 'Visible upload ' + id);
  const data = new w.DataTransfer();
  data.items.add(
    new w.File([bytes], name, {
      type: name.endsWith('.json') ? 'application/json' : 'application/octet-stream',
    }),
  );
  n.files = data.files;
  n.dispatchEvent(new w.Event('change', { bubbles: true }));
  await until(() => n.value === '', 'Upload handler completed ' + id, 90000);
}
async function installOnce() {
  await library();
  await upload(
    'import-pack',
    await (await fetch('content/world.rlpack')).arrayBuffer(),
    'mountain-reservoir.r16.rlpack',
  );
  check(!!q('[data-pack-id="mountain-reservoir"]'), 'Native installed Reservoir row');
  await upload(
    'import-proofs',
    await (await fetch('content/proofs.json')).arrayBuffer(),
    'mountain-reservoir.r16.proofs.json',
  );
  await until(
    () => q('#studio-status').textContent.includes('Imported 16/16'),
    'Separate16 verified proofs',
    90000,
  );
  const records = p.app.snapshot().records;
  check(
    records.filter(
      (r) => r.packIdentity === 'fpv-pack:' + fixture.pack.sha256 && r.status === 'verified',
    ).length === 16,
    'Exact Reservoir proof dependency retained',
  );
}
async function presets() {
  await settings();
  for (const [id, value] of [
    ['world-language', 'en'],
    ['flight-mode', 'self-level'],
    ['flight-quality', 'balanced'],
    ['flight-camera', 'fpv'],
    ['flight-source', 'keyboard'],
    ['sim-appearance-world', 'authored'],
  ])
    if (q('#' + id).value !== value) set(id, value);
  await frames();
}
async function launch(key, replay = false) {
  const target = fixture.scenes[key];
  await home();
  click(q('#worlds-shell-action-missions'));
  await until(() => q('#worlds-shell-missions-dialog').open, 'Missions');
  click(q('[data-world="' + target.world + '"]'));
  const label = (replay ? 'Watch demonstration: ' : 'Fly: ') + target.title;
  const began = performance.now();
  click(
    [...d.querySelectorAll('button[aria-label]')].find(
      (n) => n.getAttribute('aria-label') === label,
    ),
  );
  await until(
    () =>
      p.peek().course === target.id &&
      !q('#world-arm').disabled &&
      (replay
        ? p.peek().status === 'active'
        : q('#flight-status').textContent.startsWith('Ready. Choose')),
    'Native launch ' + label,
    45000,
  );
  await frames();
  const identity = p.identity(),
    capture = p.capture();
  receipt.actions.push({
    at: new Date().toISOString(),
    kind: 'launch-ready',
    key,
    replay,
    elapsedMs: performance.now() - began,
    identity,
  });
  check(
    identity.course === target.id && !!identity.replay === replay,
    'Exact current course/playback identity ' + key,
  );
  check(
    capture.resources.presentation.profileId === target.profileId,
    'Actual authored renderer profile ' + key,
    capture.resources.presentation.profileId,
  );
  check(
    capture.appearance === 'authored' &&
      capture.camera === 'fpv' &&
      capture.quality === 'balanced' &&
      capture.mode === 'self-level',
    'Pinned public appearance/camera/quality/mode ' + key,
    capture,
  );
  check(!capture.resources.renderer.contextLost, 'Live native context ' + key);
  if (replay)
    check(
      identity.replay.kind === 'demonstration' &&
        identity.replay.rate === 1 &&
        identity.replay.frames === target.proof.frames &&
        identity.replay.mode === 'self-level',
      'Exact verified native1x replay ' + key,
      identity.replay,
    );
  else
    check(
      capture.state.status === 'disarmed' && capture.state.ticks === 0,
      'Ready remains unarmed at native zero tick ' + key,
    );
  return capture;
}
function fixed(c) {
  return {
    course: c.course,
    state: c.state,
    canvas: c.canvas,
    viewport: c.viewport,
    mode: c.mode,
    camera: c.camera,
    quality: c.quality,
    appearance: c.appearance,
    preset: c.preset,
    inputSource: c.inputSource,
    profileId: c.resources.presentation.profileId,
    actors: c.resources.presentation.actors,
  };
}
function boundary(key, phase, c = p.capture()) {
  const row = {
    owner: receipt.hosts.length,
    key,
    phase,
    at: new Date().toISOString(),
    ...c,
  };
  receipt.boundaries.push(row);
  return row;
}
async function measure(key, name, status) {
  $('status').textContent = key + ' · ' + name + ' ·5seconds';
  const row = p.begin(name, { course: fixture.scenes[key].id, status }, receipt.windowMs);
  await sleep(receipt.windowMs);
  p.end();
  row.key = key;
  row.variant = variant;
  row.metadata = p.identity();
  row.coverage = {
    expectedStatusAtStart: row.before.state?.status === status,
    expectedStatusAtEnd: row.after.state?.status === status,
    nativeTickDelta: row.after.state.ticks - row.before.state.ticks,
    observedStatuses: Object.keys(row.states),
    remainedFocused: !row.focus.false,
    remainedVisible: !row.visibility.hidden,
    timerWithin5500ms: row.elapsedMs <= 5500,
  };
  check(
    row.before.course === row.after.course && row.before.generation === row.after.generation,
    'Measurement course owner unchanged ' + key + '/' + name,
  );
  check(
    row.drawCPU.count > 0 && row.rafCPU['world-host']?.count > 0,
    'Actual native draw and host samples ' + key + '/' + name,
  );
  check(
    !row.droppedDOM && !row.droppedScripts,
    'All aggregate fields retained ' + key + '/' + name,
  );
  check(
    row.coverage.expectedStatusAtStart &&
      row.coverage.expectedStatusAtEnd &&
      row.coverage.observedStatuses.every((s) => s === status),
    'No unexpected native transition ' + key + '/' + name,
    row.coverage,
  );
  check(
    row.coverage.remainedFocused && row.coverage.remainedVisible,
    'Measured page stayed focused/visible ' + key + '/' + name,
    row.coverage,
  );
  const presentation = (c) => ({
    canvas: c.canvas,
    mode: c.mode,
    camera: c.camera,
    quality: c.quality,
    appearance: c.appearance,
    preset: c.preset,
    inputSource: c.inputSource,
    profileId: c.resources.presentation.profileId,
  });
  check(
    same(presentation(row.before), presentation(row.after)),
    'Measurement keeps exact canvas and presets ' + key + '/' + name,
    {
      before: presentation(row.before),
      after: presentation(row.after),
      beforeCanvasRect: row.before.canvasRect,
      afterCanvasRect: row.after.canvasRect,
    },
  );
  if (status === 'active')
    check(
      row.coverage.nativeTickDelta > 0,
      'Native playback advances without clock override ' + key,
    );
  else
    check(
      same(fixed(row.before), fixed(row.after)),
      'Fixed-pose state/presets exact through ready window ' + key,
    );
}
async function finish(name) {
  if (!p || p.data.finishedAt) return;
  await p.finish();
  receipt.hosts.push({ name, variant, ...p.data });
  check(
    Object.values(p.data.disposed.registered).every((n) => n === 0),
    name + ' releases all owned registered resources',
    p.data.disposed,
  );
  check(
    !p.data.errors.length && !p.data.warnings.length,
    name + ' no unexpected native errors/warnings',
  );
  check(!Object.keys(p.data.dropped).length, name + ' no observation overflow');
  // Observer RAF wrapper is restored; this is renderer ownership evidence, not a browser-wide RAF inventory.
}
async function openHost(name) {
  variant = name;
  await finish('previous owner');
  const previous = p;
  p = null;
  const id = crypto.randomUUID();
  frame.src =
    variant +
    '/player/optional-practice/fpv-worlds/steady-host.html?storage=' +
    encodeURIComponent(prefix) +
    '&host=' +
    id;
  await until(
    () =>
      frame.contentWindow?.fpvSteady &&
      frame.contentWindow.fpvSteady !== previous &&
      new URL(frame.contentWindow.location.href).searchParams.get('host') === id,
    'Fresh native owner',
    45000,
  );
  w = frame.contentWindow;
  d = frame.contentDocument;
  p = w.fpvSteady;
  w.focus();
  await frames();
}
const sha = async (b) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
function output() {
  $('receipt').value = JSON.stringify(receipt);
  $('summary').value = JSON.stringify(
    {
      completed: receipt.completed,
      error: receipt.error ?? null,
      checks: receipt.checks.length,
      failed: receipt.checks.filter((r) => !r.passed),
      source: fixture?.sourceRevision,
      environment: receipt.hosts.map((h) => h.environment),
      resources: receipt.resourceTrends,
      windows: receipt.hosts.flatMap((h) =>
        h.windows.map((r) => ({
          key: r.key,
          variant: r.variant,
          resizeCPU: r.resizeCPU,
          totalHostAndResizeCPUms:
            (r.rafCPU['world-host']?.sumMs ?? 0) +
            Object.values(r.resizeCPU).reduce((n, s) => n + s.sumMs, 0),
          name: r.name,
          elapsedMs: r.elapsedMs,
          coverage: r.coverage,
          hostCPU: r.rafCPU['world-host'],
          drawCPU: r.drawCPU,
          rafGaps: r.rafGaps,
          layoutReads: r.layoutReads,
          clone: r.clone,
          performanceEntries: r.performanceEntries,
          scripts: r.scripts,
          observerCPUms: r.observerCPUms,
        })),
      ),
    },
    null,
    2,
  );
}
$('run').onclick = async () => {
  $('run').disabled = true;
  document.body.dataset.running = 'true';
  receipt.startedAt = new Date().toISOString();
  try {
    const raw = await (await fetch('fixture.json')).arrayBuffer();
    fixture = JSON.parse(new TextDecoder().decode(raw));
    receipt.fixture = fixture;
    receipt.fixtureSHA256 = await sha(raw);
    check(
      fixture.variants.length === 2 &&
        fixture.variants[0].overlays.length === 0 &&
        fixture.variants[1].overlays.length === 1,
      'Exact baseline with one declared candidate overlay',
    );
    for (const f of fixture.files) {
      const b = await (await fetch(f.path)).arrayBuffer();
      check(
        b.byteLength === f.bytes && (await sha(b)) === f.sha256,
        'Frozen admitted/observer/data bytes ' + f.path,
      );
    }
    for (const [name, key] of receipt.matrix) {
      await openHost(name);
      if (!receipt.hosts.length) await installOnce();
      await presets();
      boundary(key, 'ready', await launch(key));
      await measure(key, 'fixed-pose-ready', 'disarmed');
      await launch(key, true);
      await measure(key, 'verified-native-playback', 'active');
      await home();
      boundary(key, 'paused-playback');
      await finish(name + '/' + key);
    }
    check(
      receipt.hosts.length === 4 && receipt.hosts.every((h) => h.windows.length === 2),
      'All eight predeclared ABBA windows retained once',
    );
    receipt.completed = true;
    $('status').textContent = 'COMPLETE · bounded native session attribution';
    frame.src = 'about:blank';
  } catch (error) {
    receipt.completed = false;
    receipt.error = String(error.stack ?? error);
    if (!p) {
      receipt.bootFailure = frame.contentWindow?.fpvSteadyData ?? null;
      try {
        await frame.contentWindow?.fpvSteadyBootDispose?.();
      } catch (e) {
        receipt.bootCleanupError = String(e);
      }
    }
    try {
      if (p) {
        receipt.failure = p.capture();
        await finish('failed owner');
      }
    } catch (e) {
      receipt.cleanupError = String(e);
      if (p && !receipt.hosts.some((h) => h.name === 'failed owner'))
        receipt.hosts.push({ name: 'failed owner', ...p.data });
    }
    $('status').textContent = 'STOPPED · ' + error.message;
  } finally {
    receipt.finishedAt = new Date().toISOString();
    document.body.dataset.running = 'false';
    output();
  }
};
