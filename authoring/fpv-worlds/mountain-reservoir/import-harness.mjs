const $ = (id) => document.getElementById(id),
  frame = $('sim');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stable = (v) =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );
const hash = async (b) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
const prefix = 'fpv-reservoir-' + crypto.randomUUID() + ':';
const memory = new Map([
  [
    'revealline.fpv.world-settings.v1',
    JSON.stringify({
      'world-language': 'en',
      'flight-mode': 'self-level',
      'flight-source': 'keyboard',
      'flight-quality': 'balanced',
      'flight-camera': 'fpv',
      'sim-motion': 'reduced',
    }),
  ],
]);
window.fixtureStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
};
let w, d, app, manifest, archive, project, receipt;
function update(message) {
  $('status').textContent = message;
  $('receipt').value = JSON.stringify(receipt, null, 2);
}
function check(name, passed, detail) {
  receipt.checks.push({ name, passed: !!passed, ...(detail ? { detail } : {}) });
  if (!passed) throw Error(name);
}
const equal = (name, a, b) => check(name, stable(a) === stable(b));
const click = (node) => {
  if (!node || node.disabled) throw Error('Missing/disabled public control');
  node.click();
};
function set(id, value) {
  const n = d.getElementById(id);
  if (!n) throw Error('Missing public field ' + id);
  n.value = value;
  n.dispatchEvent(new w.Event('change', { bubbles: true }));
}
async function pulse(delta = 0) {
  w?.fixtureRAF?.deliver(delta);
  await wait(0);
}
async function until(predicate, label) {
  const start = performance.now();
  while (!predicate()) {
    if (performance.now() - start > 30000)
      throw Error(
        'Timeout ' +
          label +
          '; ' +
          d?.getElementById('studio-status')?.textContent +
          '; ' +
          d?.getElementById('flight-status')?.textContent,
      );
    await wait(15);
    w?.fixtureRAF?.deliver(0);
  }
}
async function bytes(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw Error('HTTP ' + r.status + ' ' + url);
  return r.arrayBuffer();
}
async function mount(clock = 'controlled') {
  if (app) {
    await app.dispose();
    w.fixtureRecords.close();
    w.fixtureWorldStore.close();
    app = null;
  }
  w = d = null;
  const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
  frame.src =
    './host.html?database=' +
    encodeURIComponent(prefix) +
    '&clock=' +
    clock +
    '&run=' +
    crypto.randomUUID();
  await loaded;
  await until(() => frame.contentWindow?.fixtureApp, 'actual admitted host mount');
  w = frame.contentWindow;
  d = w.document;
  app = w.fixtureApp;
  await app.ready;
  w.focus();
  await pulse();
  set('sim-appearance-world', 'authored');
  click(d.querySelector('[data-tab="explore"]'));
}
async function input(id, filename, buffer) {
  click(d.querySelector('[data-tab="packs"]'));
  const field = d.getElementById(id),
    transfer = new w.DataTransfer();
  transfer.items.add(
    new w.File([buffer], filename, {
      type: filename.endsWith('.json') ? 'application/json' : 'application/octet-stream',
    }),
  );
  field.files = transfer.files;
  d.getElementById('studio-status').textContent = '';
  field.dispatchEvent(new w.Event('change', { bubbles: true }));
  await until(
    () =>
      id === 'import-proofs'
        ? /^Imported /.test(d.getElementById('studio-status').textContent)
        : /^Exact pack installed\./.test(d.getElementById('studio-status').textContent),
    filename,
  );
  check(filename + ' public File input completed', field.value === '');
}
function row(mode) {
  click(d.querySelector('[data-tab="explore"]'));
  set('flight-mode', mode);
  const field = d.getElementById('search');
  field.value = project.courses[0].locales.en.title;
  field.dispatchEvent(new w.Event('input', { bubbles: true }));
  return [...d.querySelectorAll('.challenge-row')].find(
    (n) => n.querySelector('strong')?.textContent.replace(/^✓ /, '') === field.value,
  );
}
async function closeFlight() {
  if (d.getElementById('flight-dialog').open) {
    click(d.getElementById('leave-flight'));
    await until(() => !d.getElementById('flight-dialog').open, 'leave flight');
  }
  await pulse();
}
async function play(record) {
  click(row(record.proof.mode)?.querySelector('.watch-example'));
  await until(
    () =>
      w.fixtureRenderedCourse === record.course.id &&
      w.fixtureDrawState &&
      !d.getElementById('world-arm').disabled,
    'prepared actual Watch',
  );
  click(d.getElementById('world-pause'));
  await pulse();
  const initial = app.snapshot();
  check(
    record.proof.mode + ' exact replay prepared at zero',
    initial.course === record.course.id &&
      initial.replay?.kind === 'demonstration' &&
      initial.replay.mode === record.proof.mode &&
      initial.state.ticks === 0,
  );
  set('world-replay-rate', '1');
  d.getElementById('world-viewport').focus();
  let steady = 0;
  const warmup = [];
  for (let i = 0; i < 10 && steady < 2; i++) {
    const start = performance.now();
    await pulse();
    const elapsed = performance.now() - start;
    warmup.push(elapsed);
    check(
      record.proof.mode + ' paused warmup keeps zero ticks',
      w.fixtureDrawState.ticks === 0 &&
        /^Playback paused/.test(d.getElementById('flight-status').textContent),
    );
    steady = elapsed <= 250 ? steady + 1 : 0;
  }
  check(record.proof.mode + ' two bounded warm frames', steady === 2);
  click(d.getElementById('world-arm'));
  let pulses = 0,
    previous = -1,
    stalled = 0,
    maxGap = 0,
    last = performance.now();
  const start = last,
    max = Math.ceil(record.proof.frames.length / 10) + 30;
  while (d.getElementById('result-panel').hidden && pulses < max) {
    if (d.visibilityState !== 'visible' || !d.hasFocus())
      throw Error('Lost real visibility/focus; no automatic resume');
    if (!/^Playback active/.test(d.getElementById('flight-status').textContent))
      throw Error('Production pause: ' + d.getElementById('flight-status').textContent);
    if (performance.now() - start > 120000) throw Error('Bounded playback wall time exceeded');
    await pulse(200);
    pulses++;
    const now = performance.now(),
      ticks = w.fixtureDrawState.ticks;
    maxGap = Math.max(maxGap, now - last);
    last = now;
    stalled = ticks === previous ? stalled + 1 : 0;
    previous = ticks;
    if (stalled >= 5) throw Error('Five pulses without progression');
    if (pulses % 25 === 0)
      update('Watch ' + record.proof.mode + ': ' + ticks + '/' + record.proof.frames.length);
  }
  const final = app.snapshot(),
    identity = w.fixtureModel.worldStateIdentity;
  check(
    record.proof.mode + ' actual rendered completion is exact',
    final.replay?.finished &&
      final.state.status === 'complete' &&
      final.state.ticks === record.proof.frames.length &&
      identity(final.state) === record.proof.finalStateIdentity &&
      identity(w.fixtureDrawState) === record.proof.finalStateIdentity,
  );
  check(
    record.proof.mode + ' exact pad, full health, no contacts and authored landing speed',
    final.state.support?.id === 'platform-shore-pad' &&
      final.state.health === final.state.maxHealth &&
      final.state.contacts === 0 &&
      final.state.landingSpeed <= 700,
  );
  receipt.playback.push({
    mode: record.proof.mode,
    ticks: final.state.ticks,
    finalStateIdentity: identity(final.state),
    landingSpeed: final.state.landingSpeed,
    contacts: final.state.contacts,
    pulses,
    maxGapMs: maxGap,
    warmup,
    resources: w.fixtureRenderer.resources(),
  });
  await closeFlight();
}
$('run').onclick = async () => {
  $('run').disabled = true;
  receipt = {
    format: 'FPVReservoirImportedCheckpointReceipt.v1',
    status: 'running',
    checks: [],
    playback: [],
    errors: [],
    limitations: [
      'One course checkpoint, not final eight-course world or sixteen final proofs.',
      'Accepted historical #1060 admitted runtime; no source overlay, no hardware/offline/FPS claim.',
      'Controlled RAF replay retains real performance clock, visibility and pause guards. Native-clock launch is a separate manual step.',
    ],
  };
  try {
    manifest = await (await fetch('./manifest.json')).json();
    receipt.manifest = manifest;
    check(
      'Visible focused prerequisite',
      document.visibilityState === 'visible' && document.hasFocus(),
    );
    update('Authenticating complete admitted player and external content');
    for (const file of manifest.files) {
      const b = await bytes('./player/' + file.path);
      check(
        'Admitted member ' + file.path,
        b.byteLength === file.bytes && (await hash(b)) === file.sha256,
      );
    }
    for (const file of [...manifest.content, ...manifest.harness]) {
      const b = await bytes('./' + file.path);
      check(
        'Fixture member ' + file.path,
        b.byteLength === file.bytes && (await hash(b)) === file.sha256,
      );
    }
    project = JSON.parse(new TextDecoder().decode(await bytes('./content/project.json')));
    archive = JSON.parse(new TextDecoder().decode(await bytes('./content/proofs.json')));
    check(
      'Only first checkpoint and two exact modes',
      project.courses.length === 1 &&
        project.courses[0].id === 'mountain-reservoir-01' &&
        archive.records.length === 2 &&
        new Set(archive.records.map((r) => r.proof.mode)).size === 2 &&
        archive.records.every((r) => r.packIdentity === manifest.packIdentity),
    );
    await mount();
    await input(
      'import-pack',
      'reservoir-checkpoint.rlpack',
      await bytes('./content/checkpoint.rlpack'),
    );
    const installed = await w.fixtureWorldStore.get(project.id);
    equal(
      'Native installed project, courses, ThemeProfile and source bindings exact',
      installed.project,
      project,
    );
    check(
      'Native exact pack hash retained',
      'fpv-pack:' + installed.sha256 === manifest.packIdentity,
    );
    const asset = installed.assets.get(project.world.modelAsset);
    check(
      'Native imported GLB bytes exact',
      asset &&
        (await hash(await asset.arrayBuffer())) ===
          manifest.content.find((f) => f.path === 'content/scene.glb').sha256,
    );
    await w.fixtureModel.initWorldRuntime();
    const course = installed.project.courses[0],
      collision = w.fixtureCollision.createWorldCollision(course);
    try {
      check(
        'Browser named pad supports spawn',
        collision.support(course.spawn, course.rules.droneRadius, 5)?.id === 'platform-shore-pad',
      );
      check(
        'Browser solid dam rejects interior spawn',
        !collision.clearSpawn({ x: 0, y: 5000, z: -28000 }, course.rules.droneRadius),
      );
      check(
        'Browser closed hut rejects interior spawn',
        !collision.clearSpawn({ x: -22000, y: 1000, z: -15000 }, course.rules.droneRadius),
      );
      const moved = collision.moveSphere(
        { x: -10000, y: 6500, z: -12000 },
        { x: -20000, y: 0, z: 38000 },
        course.rules.droneRadius + 500,
      );
      check(
        'Browser return lane swept extra0.5m margin',
        moved.contacts.length === 0 &&
          Math.abs(moved.position.x + 30000) <= 3 &&
          Math.abs(moved.position.z - 26000) <= 3,
      );
      check(
        'Water remains outside checkpoint east bound',
        course.bounds.max.x === 6000 && installed.project.authoring.water.includes('outside'),
      );
    } finally {
      collision.dispose();
    }
    await input('import-proofs', 'reservoir-proofs.json', await bytes('./content/proofs.json'));
    const imported = await w.fixtureRecords.list();
    check(
      'Both imported proofs verified against exact dependency',
      imported.length === 2 &&
        imported.every((r) => r.status === 'verified' && r.packIdentity === manifest.packIdentity),
    );
    for (const record of archive.records) {
      check(
        record.proof.mode + ' actual catalogue Watch available',
        !!row(record.proof.mode)?.querySelector('.watch-example'),
      );
      await play(record);
    }
    equal('Watch preserves imported records exactly', await w.fixtureRecords.list(), imported);
    receipt.errors.push(...w.fixtureErrors);
    check('No runtime errors', receipt.errors.length === 0);
    receipt.status = 'passed';
    $('native').disabled = false;
    update('PASS · both exact Watch replays. Native-clock launch ready.');
  } catch (error) {
    receipt.status = 'failed';
    receipt.failure = {
      message: error.message,
      stack: error.stack,
      status: d?.getElementById('studio-status')?.textContent,
      flight: d?.getElementById('flight-status')?.textContent,
    };
    receipt.errors.push(...(w?.fixtureErrors ?? []));
    update('FAIL · ' + error.message);
  }
};
$('native').onclick = async () => {
  $('native').disabled = true;
  try {
    await mount('native');
    const launch = row('self-level')?.querySelector('button[aria-label^="Fly:"]');
    click(launch);
    await until(
      () =>
        w.fixtureRenderedCourse === project.courses[0].id &&
        w.fixtureDrawState &&
        !d.getElementById('world-arm').disabled,
      'native-clock prepared course',
    );
    receipt.nativeLaunch = {
      prepared: true,
      course: app.snapshot().course,
      status: d.getElementById('flight-status').textContent,
      clock: 'unmodified native RAF',
      manualArmPausePending: true,
    };
    update('Native-clock course ready. Manually Arm, inspect, then Pause in the actual player.');
  } catch (error) {
    receipt.nativeLaunch = { error: error.message };
    update('Native launch failed: ' + error.message);
  }
};
