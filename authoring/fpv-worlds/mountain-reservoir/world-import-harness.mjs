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
function row(mode, course = project.courses[0]) {
  click(d.querySelector('[data-tab="explore"]'));
  set('flight-mode', mode);
  const field = d.getElementById('search');
  field.value = course.locales.en.title;
  field.dispatchEvent(new w.Event('input', { bubbles: true }));
  return [...d.querySelectorAll('.challenge-row')].find(
    (n) => n.querySelector('strong')?.textContent.replace(/^✓ /, '') === field.value,
  );
}
async function closeFlight() {
  const menu = d.getElementById('worlds-shell-home-dialog');
  if (menu?.open) menu.dispatchEvent(new w.Event('cancel', { cancelable: true }));
  if (d.getElementById('flight-dialog').open) {
    click(d.getElementById('leave-flight'));
    await until(() => !d.getElementById('flight-dialog').open, 'leave flight');
  }
  await pulse();
}
const button = (parent, label) =>
  [...parent.querySelectorAll('button')].find((node) => node.textContent === label);
const editorCourse = () => JSON.parse(d.getElementById('creator-json').value);
async function exportProject() {
  const before = w.fixtureDownloads.length;
  click(d.getElementById('export-project'));
  await until(() => w.fixtureDownloads.length > before, 'full editable ZIP export');
  const download = w.fixtureDownloads.at(-1);
  const value = await w.fixtureZIP.importEditableZip(download.blob);
  const asset = value.assets.get(value.project.world.modelAsset);
  check(
    'Editable ZIP retains exact imported GLB',
    value.assets.size === 1 &&
      (await hash(await asset.arrayBuffer())) ===
        manifest.content.find((f) => f.path === 'content/scene.glb').sha256,
  );
  return value.project;
}
async function editWorld() {
  click(d.querySelector('[data-tab="packs"]'));
  click(button(d.querySelector('[data-pack-id="' + project.id + '"]'), 'Edit'));
  await until(
    () =>
      !d.getElementById('creator').hidden &&
      d.getElementById('editor-project-course')?.options.length === 8,
    'native eight-course editor',
  );
  equal(
    'Editor contains all eight exact ordered course IDs',
    [...d.getElementById('editor-project-course').options].map((o) => o.value),
    project.courses.map((c) => c.id),
  );
  for (const course of project.courses) {
    set('editor-project-course', course.id);
    equal(course.id + ' exact editor course', editorCourse(), course);
    for (const mode of ['self-level', 'acro']) {
      set('editor-route-mode', mode);
      check(
        course.id + '/' + mode + ' explicit editor mode selected',
        d.getElementById('editor-route-mode').value === mode,
      );
      equal(
        course.id + '/' + mode + ' selection preserves both arrays',
        editorCourse().steps,
        course.steps,
      );
    }
  }
  equal('Course and mode selection preserves full project', await exportProject(), project);
  const chosen = project.courses[5];
  set('editor-project-course', chosen.id);
  set('editor-route-mode', 'acro');
  const before = editorCourse(),
    expected = JSON.parse(JSON.stringify(before));
  expected.steps.acro[0].min.x += 250;
  expected.steps.acro[0].max.x += 250;
  const field = d.getElementById('criterion-x');
  field.value = String(Number(field.value) + 0.25);
  field.dispatchEvent(new w.Event('input', { bubbles: true }));
  click(d.getElementById('move-criterion'));
  equal('Selected Acro-only edit changes exactly one local criterion', editorCourse(), expected);
  const edited = await exportProject();
  equal(
    'Acro edit preserves all other courses',
    edited.courses.filter((c) => c.id !== chosen.id),
    project.courses.filter((c) => c.id !== chosen.id),
  );
  equal('Acro edit preserves shared source overrides', edited.overrides, project.overrides);
  equal('Acro edit preserves every route binding', edited.routeBindings, project.routeBindings);
  click(d.getElementById('undo-edit'));
  equal('Undo restores exact original selected course', editorCourse(), before);
  click(d.getElementById('redo-edit'));
  equal('Redo restores exact Acro-only edit', editorCourse(), expected);
  click(d.getElementById('undo-edit'));
  equal('Restored full project is exact before source reimport', await exportProject(), project);
  click(d.getElementById('preview-challenge'));
  await until(
    () =>
      d.getElementById('flight-dialog').open &&
      d.getElementById('flight-status').textContent.includes('Ready. Choose your controls'),
    'selected route preview',
  );
  const preview = app.snapshot();
  check(
    'Actual selected non-first Acro preview is disarmed at zero ticks',
    preview.course === chosen.id &&
      preview.state.status === 'disarmed' &&
      preview.state.ticks === 0 &&
      d.getElementById('flight-mode').value === 'acro',
  );
  equal('Selected preview retains exact spawn', preview.state.position, chosen.spawn);
  await closeFlight();
  click(d.querySelector('[data-tab="creator"]'));
  const file = d.getElementById('import-world'),
    transfer = new w.DataTransfer();
  transfer.items.add(new w.File([await bytes('./content/scene.glb')], 'mountain-reservoir.glb'));
  file.files = transfer.files;
  file.dispatchEvent(new w.Event('change', { bubbles: true }));
  await until(() => d.getElementById('reimport-review')?.open, 'actual exact GLB reimport review');
  click(button(d.getElementById('reimport-review'), 'Apply reviewed update'));
  await until(
    () => file.value === '' && !d.getElementById('reimport-review'),
    'exact source reimport settled',
  );
  const reimported = await exportProject();
  equal(
    'Source reimport preserves all eight courses including actual solid geometry',
    reimported.courses,
    project.courses,
  );
  for (const key of ['routeBindings', 'spawnBindings', 'overrides', 'world', 'source'])
    equal('Source reimport preserves ' + key, reimported[key], project[key]);
  check(
    'Source reimport preserves selected course and Acro mode',
    editorCourse().id === chosen.id && d.getElementById('editor-route-mode').value === 'acro',
  );
  // Reimport may refresh provenance metadata. It must not install a new pack or
  // change the dependency to which the ordinary-flight demonstrations belong.
  const installed = await w.fixtureWorldStore.get(project.id);
  equal('Draft edits/reimport leave the installed project exact', installed.project, project);
  check(
    'Draft edits/reimport retain exact installed pack dependency',
    'fpv-pack:' + installed.sha256 === manifest.packIdentity,
  );
  receipt.editor = {
    courses: 8,
    modes: 16,
    localAcroEditUndone: true,
    sourceHash: reimported.source.hash,
  };
  await mount();
  const reopened = await w.fixtureWorldStore.get(project.id);
  equal('Fresh native-IDB reopen retains exact full world', reopened.project, project);
  check(
    'Fresh native-IDB reopen retains all sixteen verified recordings',
    (await w.fixtureRecords.list()).filter(
      (r) => r.packIdentity === manifest.packIdentity && r.status === 'verified',
    ).length === 16,
  );
}
async function play(record) {
  click(row(record.proof.mode, record.course)?.querySelector('.watch-example'));
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
    record.course.id + '/' + record.proof.mode + ' exact replay prepared at zero',
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
      record.course.id + '/' + record.proof.mode + ' paused warmup keeps zero ticks',
      w.fixtureDrawState.ticks === 0 &&
        /^Playback paused/.test(d.getElementById('flight-status').textContent),
    );
    steady = elapsed <= 250 ? steady + 1 : 0;
  }
  check(record.course.id + '/' + record.proof.mode + ' two bounded warm frames', steady === 2);
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
      update(
        'Watch ' +
          record.course.id +
          '/' +
          record.proof.mode +
          ': ' +
          ticks +
          '/' +
          record.proof.frames.length,
      );
  }
  const final = app.snapshot(),
    identity = w.fixtureModel.worldStateIdentity;
  check(
    record.course.id + '/' + record.proof.mode + ' actual rendered completion is exact',
    final.replay?.finished &&
      final.state.status === 'complete' &&
      final.state.ticks === record.proof.frames.length &&
      identity(final.state) === record.proof.finalStateIdentity &&
      identity(w.fixtureDrawState) === record.proof.finalStateIdentity,
  );
  check(
    record.course.id +
      '/' +
      record.proof.mode +
      ' exact pad, full health, no contacts and authored landing speed',
    final.state.support?.id === record.course.steps[record.proof.mode].at(-1).surface &&
      final.state.health === final.state.maxHealth &&
      final.state.contacts === 0 &&
      final.state.landingSpeed <= 700,
  );
  receipt.playback.push({
    course: record.course.id,
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
    format: 'FPVReservoirImportedWorldReceipt.v1',
    status: 'running',
    checks: [],
    playback: [],
    errors: [],
    limitations: [
      'Eight courses/sixteen proofs on the identified admitted host; no default catalogue addition.',
      'Complete current-baseline admitted runtime; no source overlay, no hardware/offline/FPS claim.',
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
      'Eight independent courses and sixteen exact mode pairs',
      project.courses.length === 8 &&
        project.courses[0].id === 'mountain-reservoir-01' &&
        archive.records.length === 16 &&
        new Set(archive.records.map((r) => r.course.id + '/' + r.proof.mode)).size === 16 &&
        archive.records.every((r) => r.packIdentity === manifest.packIdentity),
    );
    await mount();
    await input('import-pack', 'reservoir-world.rlpack', await bytes('./content/world.rlpack'));
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
      'All sixteen imported proofs verified against exact dependency',
      imported.length === 16 &&
        imported.every((r) => r.status === 'verified' && r.packIdentity === manifest.packIdentity),
    );
    for (const record of archive.records) {
      check(
        record.course.id + '/' + record.proof.mode + ' actual catalogue Watch available',
        !!row(record.proof.mode, record.course)?.querySelector('.watch-example'),
      );
      await play(record);
    }
    equal('Watch preserves imported records exactly', await w.fixtureRecords.list(), imported);
    await editWorld();
    receipt.errors.push(...w.fixtureErrors);
    check('No runtime errors', receipt.errors.length === 0);
    receipt.status = 'passed';
    $('native').disabled = false;
    update(
      'PASS · sixteen exact Watch replays and eight-course editor/source reimport. Native-clock launch ready.',
    );
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
