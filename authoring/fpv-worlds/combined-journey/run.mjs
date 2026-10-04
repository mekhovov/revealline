const $ = (id) => document.getElementById(id);
const frame = $('sim');
const receipt = {
  format: 'FPVCombinedJourney.v1',
  checks: [],
  phases: [],
  hosts: [],
  exports: [],
  limitations: [
    'Native file import is not published Browse/download acceptance.',
    'Proof archive is explicitly uploaded separately from the world pack.',
    'Scripted public inner controls; only outer Run is a trusted action.',
    'Named native transaction faults are not real quota pressure.',
    'Offline, endurance and performance are separate coordinator phases, not this online result.',
  ],
};
let fixture,
  expected,
  w,
  d,
  p,
  token,
  closed = true;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const canonical = (value) =>
  JSON.stringify(value, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((key) => [key, x[key]]),
        )
      : x,
  );
const same = (a, b) => canonical(a) === canonical(b);
const sha = async (bytes) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
function check(ok, name, detail) {
  receipt.checks.push({ name, passed: !!ok, ...(detail === undefined ? {} : { detail }) });
  if (!ok) throw Error(name);
}
async function until(fn, name, milliseconds = 30000) {
  const end = performance.now() + milliseconds;
  while (!(await fn())) {
    if (performance.now() >= end) throw Error('Timeout: ' + name);
    await sleep(40);
  }
}
const q = (selector) => d.querySelector(selector);
const visible = (node) =>
  !!(
    node?.checkVisibility({ checkVisibilityCSS: true }) &&
    !node.closest('[hidden],dialog:not([open])')
  );
function click(node) {
  check(
    visible(node) && !node.disabled,
    'visible public control ' + (node?.id || node?.textContent),
  );
  node.click();
}
function reveal(node) {
  const parents = [];
  for (let a = node.parentElement; a; a = a.parentElement)
    if (a.tagName === 'DETAILS' && !a.open) parents.unshift(a);
  for (const a of parents) click(a.querySelector(':scope > summary'));
}
function set(id, value) {
  const node = q('#' + id);
  reveal(node);
  check(visible(node) && !node.disabled, 'visible setting ' + id);
  node.value = value;
  node.dispatchEvent(new w.Event('change', { bubbles: true }));
}
async function frames(count = 3) {
  for (let i = 0; i < count; i++) await new Promise(w.requestAnimationFrame.bind(w));
}
async function home() {
  if (q('#sim-settings').open) click(q('#close-sim-settings'));
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
async function missions() {
  await home();
  click(q('#worlds-shell-action-missions'));
  await until(() => q('#worlds-shell-missions-dialog').open, 'Missions');
}
async function library() {
  await missions();
  click(q('[data-tab="packs"]'));
}
async function settle() {
  await until(() => p.data.activeTransactions === 0, 'native transactions settled');
  await frames();
  await until(() => p.data.activeTransactions === 0, 'native transactions remain settled');
}
async function mount(fresh) {
  const load = crypto.randomUUID();
  frame.src =
    'player/optional-practice/fpv-worlds/journey-host.html?token=' +
    token +
    '&fresh=' +
    fresh +
    '&load=' +
    load;
  await until(
    () =>
      frame.contentWindow?.fpvJourney &&
      !frame.contentWindow.fpvJourney.disposed &&
      frame.contentWindow.fpvJourney.token === token &&
      new URL(frame.contentWindow.location.href).searchParams.get('load') === load,
    'new owned host',
  );
  w = frame.contentWindow;
  d = frame.contentDocument;
  p = w.fpvJourney;
  closed = false;
  // Ordinary focus transfer once after the deliberate outer Run; no focus emulation.
  w.focus();
  await frames();
  check(
    document.visibilityState === 'visible' && d.visibilityState === 'visible',
    'visible journey',
  );
}
async function capture(name) {
  const row = { name, at: performance.now(), ...(await p.inspect()) };
  receipt.phases.push(row);
  return row;
}
async function finish(name) {
  if (closed) return;
  await p.finish();
  closed = true;
  receipt.hosts.push({
    name,
    ...p.data,
    downloads: p.data.downloads.map(({ blob, ...row }) => ({ ...row, bytes: blob.size })),
  });
  check(!p.data.errors.length && !p.data.warnings.length, name + ' no errors/warnings');
  check(!Object.keys(p.data.dropped).length, name + ' bounded observations without drops');
  check(
    p.data.resources?.registered &&
      Object.values(p.data.resources.registered).every((x) => x === 0),
    name + ' owned registered resources released',
  );
}
async function upload(id, bytes, name) {
  const input = q('#' + id);
  reveal(input);
  check(visible(input.closest('label')), 'visible native upload ' + id);
  const transfer = new w.DataTransfer();
  transfer.items.add(
    new w.File([bytes], name, {
      type: name.endsWith('.json') ? 'application/json' : 'application/octet-stream',
    }),
  );
  input.files = transfer.files;
  input.dispatchEvent(new w.Event('change', { bubbles: true }));
}
async function packUpload(bytes, name) {
  await library();
  await upload('import-pack', bytes, name);
  await until(
    () => q('#import-pack').value === '' && q('[data-pack-id="' + fixture.pack.id + '"]'),
    'native pack import',
  );
  await settle();
}
const course = (id) => expected.courses.find((c) => c.id === id);
async function select(id, watch = false) {
  await missions();
  click(q('[data-world="' + fixture.pack.id + '"]'));
  const label = (watch ? 'Watch demonstration: ' : 'Fly: ') + course(id).locales.en.title;
  click(
    [...d.querySelectorAll('button[aria-label]')].find(
      (n) => n.getAttribute('aria-label') === label,
    ),
  );
  await until(
    () =>
      p.data.lastDraw &&
      !q('#world-arm').disabled &&
      (watch || q('#flight-status').textContent.startsWith('Ready. Choose')),
    'selected course Ready',
  );
  await frames();
  check(p.app.snapshot().course === id, 'selected exact course ' + id);
}
async function armAndPause() {
  await home();
  check(q('#worlds-shell-action-primary').textContent === 'Continue', 'current-owner Continue');
  click(q('#worlds-shell-action-primary'));
  await until(() => q('#flight-dialog').dataset.flightState === 'active', 'deliberate native Arm');
  const start = p.data.lastDraw.ticks;
  await until(() => {
    if (q('#flight-dialog').dataset.flightState !== 'active')
      throw Error('Flight paused before native progress');
    return p.data.lastDraw.ticks >= start + 15;
  }, 'native neutral progress');
  await settings();
  await settle();
  check(q('#flight-dialog').dataset.flightState === 'paused', 'Settings pauses active flight');
}
async function exportDraft(name) {
  const count = p.data.downloads.length;
  reveal(q('#export-pack'));
  click(q('#export-pack'));
  await until(() => p.data.downloads.length === count + 1, 'production export ' + name);
  const row = p.data.downloads.at(-1);
  const inspected = await p.content.inspectPack(row.blob);
  check(
    inspected.project.id === fixture.pack.id && inspected.project.courses.length === 8,
    'exported full eight-course project',
  );
  const assets = [];
  for (const [name, bytes] of inspected.assets)
    assets.push({ path: name, bytes: bytes.byteLength, sha256: await sha(bytes) });
  assets.sort((a, b) => a.path.localeCompare(b.path));
  check(same(assets, fixture.pack.assets), 'export preserves all exact model/texture bytes');
  receipt.exports.push({
    name,
    sha256: inspected.sha256,
    bytes: row.blob.size,
    project: inspected.project,
    assets,
  });
  return { ...inspected, blob: row.blob };
}
async function install(fault, name) {
  const start = p.data.transactions.length;
  const faults = p.data.faults.length;
  p.data.fault = fault;
  reveal(q('#install-project'));
  click(q('#install-project'));
  await until(
    () =>
      p.data.transactions
        .slice(start)
        .some((r) => r.mode === 'readwrite' && r.stores.includes('revisions') && r.outcome),
    'install terminal ' + name,
  );
  if (fault) await until(() => p.data.faults.length > faults, 'named native fault ' + name);
  await settle();
  return capture(name);
}
function retained(before, after, name) {
  for (const key of ['records', 'recovery', 'state', 'course', 'draft', 'selectedCourse', 'mode'])
    check(same(before[key], after[key]), name + ' retains ' + key);
}
async function execute() {
  $('run').disabled = true;
  receipt.startedAt = new Date().toISOString();
  try {
    fixture = await (await fetch('fixture.json')).json();
    receipt.fixture = fixture;
    expected = await (await fetch('expected-project.json')).json();
    check(fixture.inputs.length === 95, 'exact 95-input fixture');
    for (const file of fixture.files) {
      check(
        /^[\w./-]+$/.test(file.path) && !file.path.split('/').includes('..'),
        'bounded manifest path ' + file.path,
      );
      const response = await fetch(file.path, { cache: 'no-store' });
      check(response.ok, 'read pinned fixture member ' + file.path);
      const bytes = await response.arrayBuffer();
      check(
        bytes.byteLength === file.bytes && (await sha(bytes)) === file.sha256,
        'browser verifies frozen member ' + file.path,
      );
    }
    $('native').hidden = !fixture.offlineEligible;
    const bytes = await (await fetch('content/world.rlpack')).arrayBuffer();
    const proofs = await (await fetch('content/proofs.json')).arrayBuffer();
    check((await sha(bytes)) === fixture.pack.sha256, 'exact Reservoir50ff bytes');
    check((await sha(proofs)) === fixture.proofs.sha256, 'separate exact073ee proof archive');
    token = 'journey-' + crypto.randomUUID();
    await mount(true);
    check(
      !p.data.initialDatabases.length && !p.data.initialCaches.length,
      'dedicated empty origin',
    );
    const initial = await capture('empty native host');
    await packUpload(bytes, 'mountain-reservoir.r16.rlpack');
    const saved = await capture('pack installed; proofs not yet imported');
    check(saved.records.length === 0, 'pack import alone supplies no proof archive');
    check(same(initial.state, saved.state), 'installation does not activate flight');
    const full = await p.store.get(fixture.pack.id);
    check(
      full.sha256 === fixture.pack.sha256 && same(full.project, expected),
      'complete exact installed project',
    );
    await upload('import-proofs', proofs, 'mountain-reservoir.r16.proofs.json');
    await until(
      async () =>
        (await p.records.list()).length === 16 &&
        q('#studio-status').textContent.includes('Imported 16/16'),
      'explicit proof import and verification',
      60000,
    );
    await settle();
    const retainedProofs = await p.records.list();
    check(
      retainedProofs.every(
        (r) => r.status === 'verified' && r.packIdentity === 'fpv-pack:' + fixture.pack.sha256,
      ),
      'sixteen proofs verified against exact required pack',
    );

    $('status').textContent = 'Native selection, language ownership, Arm and Retry';
    await select(fixture.entry.course);
    await settings();
    set('flight-mode', fixture.entry.mode);
    await frames();
    await until(
      () =>
        !q('#world-arm').disabled && q('#flight-status').textContent.startsWith('Ready. Choose'),
      'selected mode prepared',
    );
    for (const locale of ['uk', 'en']) {
      const before = p.app.snapshot();
      set('world-language', locale);
      check(
        p.app.snapshot().course === before.course,
        'language retains selected course ' + locale,
      );
      check(
        q('#flight-dialog').dataset.flightState !== 'active',
        'language does not arm ' + locale,
      );
      await frames();
    }
    await armAndPause();
    await home();
    click(q('#worlds-shell-action-retry'));
    await until(
      () =>
        q('#flight-status').textContent.startsWith('Ready. Choose') && !q('#world-arm').disabled,
      'ordinary visible Retry readiness',
    );
    check(p.app.snapshot().state.ticks === 0, 'Retry returns to zero ticks');

    $('status').textContent = 'One exact demonstration on native clock; keep this page visible';
    await select(fixture.proofs.watch.course, true);
    const replay = p.app.snapshot();
    receipt.watch = { course: replay.course, replay: replay.replay };
    const record = retainedProofs.find((r) => r.id === fixture.proofs.watch.id);
    check(
      record &&
        record.proof.courseIdentity === fixture.proofs.watch.courseIdentity &&
        record.proof.responseIdentity === fixture.proofs.watch.responseIdentity &&
        record.proof.rulesIdentity === fixture.proofs.watch.rulesIdentity,
      'exact selected proof identities',
    );
    check(
      replay.replay?.kind === 'demonstration' &&
        replay.replay.mode === fixture.proofs.watch.mode &&
        replay.replay.frames === fixture.proofs.watch.frames,
      'actual Watch mode/frame count',
    );
    await until(
      () => {
        const state = q('#flight-dialog').dataset.flightState;
        if (state === 'paused')
          throw Error('Watch paused; preserve status and retry manually in a new run');
        return state === 'complete';
      },
      'one native-clock completed Watch',
      60000,
    );
    receipt.watch.finalState = p.app.snapshot().state;
    check(
      p.model.worldStateIdentity(receipt.watch.finalState) ===
        fixture.proofs.watch.finalStateIdentity,
      'native Watch final state matches the exact verified proof',
    );
    await select(fixture.entry.course);
    await armAndPause();

    $('status').textContent = 'Single non-first course edit and native transaction boundary';
    await library();
    const row = q('[data-pack-id="' + fixture.pack.id + '"]');
    click([...row.querySelectorAll('button')].find((n) => n.textContent === 'Edit'));
    await until(() => visible(q('#editor-project-course')), 'native Creator');
    set('editor-project-course', fixture.edit.course);
    set('editor-route-mode', fixture.edit.mode);
    const input = q('#creator-json');
    reveal(input);
    const original = JSON.parse(input.value);
    const edited = JSON.parse(input.value);
    const step = edited.steps[fixture.edit.mode][fixture.edit.step];
    check(step.type === 'hold', 'bounded authored hold-volume edit');
    step.min.x += fixture.edit.xDeltaMillimetres;
    step.max.x += fixture.edit.xDeltaMillimetres;
    input.value = JSON.stringify(edited, null, 2);
    input.dispatchEvent(new w.Event('input', { bubbles: true }));
    click(q('#apply-json'));
    await frames();
    click(q('#undo-edit'));
    check(same(JSON.parse(input.value), original), 'Undo belongs to selected course');
    click(q('#redo-edit'));
    check(same(JSON.parse(input.value), edited), 'Redo restores bounded edit');
    set('editor-project-course', fixture.entry.course);
    set('editor-project-course', fixture.edit.course);
    check(same(JSON.parse(input.value), edited), 'course switch retains dirty selected course');
    check(
      q('#editor-route-mode').value === fixture.edit.mode,
      'course switch retains selected mode',
    );
    const exported = await exportDraft('edited mode before install');
    for (const c of exported.project.courses) {
      const prior = course(c.id);
      if (c.id !== fixture.edit.course) check(same(c, prior), 'untouched course ' + c.id);
      else {
        check(same(c.steps['self-level'], prior.steps['self-level']), 'other mode exact');
        check(same(c.steps.acro, edited.steps.acro), 'selected ordered mode route exact');
      }
    }
    const before = await capture('dirty draft and genuine interrupted recovery');
    check(
      before.recovery && before.recovery.packIdentity === 'fpv-pack:' + fixture.pack.sha256,
      'genuine recovery binds original exact pack',
    );
    const aborted = await install('abort-install', 'native precommit abort');
    retained(before, aborted, 'precommit abort');
    check(
      before.generation === aborted.generation && same(before.revisions, aborted.revisions),
      'abort leaves durable revisions and generation exact',
    );
    const committed = await install('commit-then-refresh', 'retry commits then refresh aborts');
    retained(before, committed, 'committed retry refresh failure');
    check(
      committed.studio === 'World pack saved. Reload the page to refresh the Library.',
      'truthful committed-save guidance',
    );
    check(
      committed.revisions.some((r) => r.active && r.sha256 === exported.sha256),
      'retry commits exact exported revision',
    );
    check(
      committed.revisions.some((r) => !r.active && r.sha256 === fixture.pack.sha256),
      'original required revision retained',
    );
    const reexported = await exportDraft('after aborted refresh');
    check(reexported.sha256 === exported.sha256, 'export remains exact after both faults');
    await packUpload(await exported.blob.arrayBuffer(), 'edited-reservoir.rlpack');
    const imported = await p.store.get(fixture.pack.id);
    check(
      imported.sha256 === exported.sha256 && same(imported.project, exported.project),
      'native reimport preserves complete edited project',
    );
    const beforeReopen = await capture('saved state before native reopen');
    await finish('online original owner');
    await mount(false);
    const reopened = await capture('native same-origin reopen');
    check(same(beforeReopen.records, reopened.records), 'reopen preserves all proof rows');
    check(same(beforeReopen.recovery, reopened.recovery), 'reopen preserves interrupted recovery');
    const current = await p.store.get(fixture.pack.id);
    check(
      current.sha256 === exported.sha256 && same(current.project, exported.project),
      'reopen exact edited project',
    );
    check(
      reopened.revisions.some((r) => r.sha256 === fixture.pack.sha256 && !r.active),
      'reopen retains original proof dependency',
    );
    await finish('online reopened owner');
    frame.src = 'about:blank';
    receipt.passed = true;
    $('status').textContent =
      'Online path passed. Published Browse and offline are separate, unclaimed phases.';
  } catch (error) {
    receipt.passed = false;
    receipt.error = { message: error.message, stack: error.stack };
    try {
      if (p && !closed) receipt.failure = await p.inspect();
    } catch (e) {
      receipt.captureError = String(e);
    }
    $('status').textContent = 'FAILED: ' + error.message;
    try {
      if (p && !closed) await finish('failed owner cleanup');
    } catch (e) {
      receipt.cleanupError = String(e);
    }
  } finally {
    receipt.endedAt = new Date().toISOString();
    $('summary').textContent = JSON.stringify(
      {
        passed: receipt.passed,
        checks: receipt.checks.length,
        failed: receipt.checks.filter((c) => !c.passed),
        error: receipt.error,
        source: fixture?.revision,
        overlays: fixture?.overlays,
        offlineEligible: fixture?.offlineEligible,
      },
      null,
      2,
    );
    $('receipt').value = JSON.stringify(receipt);
  }
}
$('run').addEventListener('click', execute, { once: true });
