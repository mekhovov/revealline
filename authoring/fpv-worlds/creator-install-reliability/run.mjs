const $ = (id) => document.getElementById(id),
  frame = $('sim');
const receipt = {
  format: 'FPVCreatorInstallReliability.v2',
  checks: [],
  observations: [],
  hosts: [],
  exports: [],
  limitations: [
    'Named native transaction aborts, not real quota exhaustion.',
    'Real ordinary grounded practice and interrupted recovery; no flight state, proof or clock injection.',
    'Scripted public DOM controls; only the outer Run is a trusted user action.',
    'The pinned fixture manifest declares source overlays or exact admission. No offline or hardware-performance claim.',
    'A committed install followed by a failed read is recorded separately from transaction rollback. Retry outcomes are observed, not presumed successful.',
  ],
};
let w,
  d,
  p,
  fixture,
  expected,
  storage,
  finished = false;
const q = (s) => d.querySelector(s),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const canonical = (v) =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, x[k]]),
        )
      : x,
  );
function check(ok, name, detail) {
  receipt.checks.push({ name, passed: !!ok, ...(detail === undefined ? {} : { detail }) });
  if (!ok) throw Error(name);
}
async function until(fn, name, ms = 30000) {
  const end = performance.now() + ms;
  while (!(await fn())) {
    if (performance.now() > end) throw Error('Timeout: ' + name);
    await sleep(35);
  }
}
const visible = (n) =>
  !!(n?.checkVisibility({ checkVisibilityCSS: true }) && !n.closest('[hidden],dialog:not([open])'));
function click(n) {
  check(visible(n) && !n.disabled, 'visible public control ' + (n?.id || n?.textContent));
  n.click();
}
function reveal(n) {
  const details = [];
  for (let a = n.parentElement; a; a = a.parentElement)
    if (a.tagName === 'DETAILS' && !a.open) details.unshift(a);
  for (const a of details) click(a.querySelector(':scope > summary'));
}
function set(id, value) {
  const n = q('#' + id);
  reveal(n);
  check(visible(n) && !n.disabled, 'visible public setting ' + id);
  n.value = value;
  n.dispatchEvent(new w.Event('change', { bubbles: true }));
}
async function frames(n = 3) {
  for (let i = 0; i < n; i++) await new Promise(w.requestAnimationFrame.bind(w));
}
async function menu() {
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
  await menu();
  click(q('#worlds-shell-action-settings'));
  await until(() => q('#sim-settings').open, 'Settings');
  await frames();
}
async function missions() {
  await menu();
  click(q('#worlds-shell-action-missions'));
  await until(() => q('#worlds-shell-missions-dialog').open, 'Missions');
}
async function library() {
  await missions();
  click(q('[data-tab="packs"]'));
}
async function mount(prefix) {
  storage = prefix ?? 'creator-install-' + crypto.randomUUID() + ':';
  finished = false;
  const load = crypto.randomUUID();
  frame.src =
    'player/optional-practice/fpv-worlds/install-host.html?storage=' +
    encodeURIComponent(storage) +
    '&load=' +
    load;
  await until(
    () =>
      frame.contentWindow?.fpvInstall &&
      !frame.contentWindow.fpvInstall.disposed &&
      frame.contentWindow.fpvInstall.prefix === storage &&
      new URL(frame.contentWindow.location.href).searchParams.get('load') === load,
    'new native host',
  );
  w = frame.contentWindow;
  d = frame.contentDocument;
  p = w.fpvInstall;
  w.focus();
  await frames();
}
async function capture(name) {
  const row = { name, at: performance.now(), ...(await p.inspect()) };
  receipt.observations.push(row);
  return row;
}
async function settled() {
  await until(() => p.data.activeTransactions === 0, 'native app transactions settle');
  await frames();
  await until(() => p.data.activeTransactions === 0, 'native app transactions remain settled');
}
async function dispose(name) {
  if (finished) return;
  await p.finish();
  finished = true;
  receipt.hosts.push({
    name,
    ...p.data,
    downloads: p.data.downloads.map(({ blob, ...r }) => ({ ...r, bytes: blob.size })),
  });
  check(!p.data.errors.length && !p.data.warnings.length, name + ' no observed errors/warnings');
  check(!Object.keys(p.data.dropped).length, name + ' observations bounded without drops');
  check(
    !p.data.resources || Object.values(p.data.resources.registered).every((n) => n === 0),
    name + ' registered resources released',
  );
}
async function importPack() {
  await library();
  const input = q('#import-pack');
  reveal(input);
  check(visible(input.closest('label')), 'visible native pack upload');
  const transfer = new w.DataTransfer();
  transfer.items.add(
    new w.File([await (await fetch('diagnostic.rlpack')).arrayBuffer()], 'diagnostic.rlpack', {
      type: 'application/octet-stream',
    }),
  );
  input.files = transfer.files;
  input.dispatchEvent(new w.Event('change', { bubbles: true }));
  await until(
    () => input.value === '' && q('[data-remove-pack="' + fixture.pack.id + '"]'),
    'native pack install',
  );
  await settled();
}
async function fly() {
  await missions();
  click(q('[data-world="' + fixture.pack.id + '"]'));
  click(
    [...d.querySelectorAll('button[aria-label]')].find(
      (n) => n.getAttribute('aria-label') === 'Fly: Install diagnostic first',
    ),
  );
  await until(
    () => q('#flight-status').textContent.startsWith('Ready. Choose') && !q('#world-arm').disabled,
    'diagnostic Ready',
  );
  await frames();
  check(p.app.snapshot().course === 'creator-install-first', 'exact first course selected');
}
async function arm() {
  await menu();
  check(
    q('#worlds-shell-action-primary').textContent === 'Continue',
    'settled selected flight primary is Continue',
  );
  click(q('#worlds-shell-action-primary'));
  await until(
    () => q('#flight-dialog').dataset.flightState === 'active',
    'ordinary deliberate arm',
  );
}
async function openEditor() {
  await library();
  const row = q('[data-pack-id="' + fixture.pack.id + '"]');
  click([...row.querySelectorAll('button')].find((n) => n.textContent === 'Edit'));
  await until(
    () =>
      q('#editor-project-course')?.value === 'creator-install-first' &&
      visible(q('#editor-project-course')),
    'native project editor',
  );
  set('editor-project-course', 'creator-install-second');
  await frames();
  set('editor-route-mode', 'acro');
  check(
    q('#editor-project-course').value === 'creator-install-second',
    'non-first course remains selected',
  );
}
async function creatorLocale(locale) {
  await settings();
  set('world-language', locale);
  await missions();
  click(q('[data-tab="creator"]'));
  await frames();
}
async function edit(suffix) {
  const input = q('#creator-json');
  reveal(input);
  const course = JSON.parse(input.value);
  course.locales.en.brief = 'Native install diagnostic edit ' + suffix;
  input.value = JSON.stringify(course, null, 2);
  input.dispatchEvent(new w.Event('input', { bubbles: true }));
  click(q('#apply-json'));
  await frames();
  check(
    JSON.parse(input.value).locales.en.brief === course.locales.en.brief,
    'valid JSON edit applied ' + suffix,
  );
  return await exportPack(suffix);
}
async function exportPack(name) {
  const n = p.data.downloads.length;
  reveal(q('#export-pack'));
  click(q('#export-pack'));
  await until(() => p.data.downloads.length === n + 1, 'production pack export ' + name);
  const row = p.data.downloads.at(-1),
    pack = await p.content.inspectPack(row.blob);
  check(pack.project.id === fixture.pack.id, name + ' exported project identity');
  check(pack.project.courses.length === 2, name + ' full two-course project exported');
  check(
    canonical(pack.project.courses[0]) === canonical(expected.courses[0]),
    name + ' first course unchanged',
  );
  check(pack.assets.size === 0, name + ' original empty asset set retained');
  receipt.exports.push({
    name,
    filename: row.name,
    bytes: row.blob.size,
    sha256: pack.sha256,
    project: pack.project,
  });
  return pack;
}
async function install(fault, name, faultExpected = true) {
  const start = p.data.transactions.length,
    beforeFaults = p.data.faults.length;
  p.data.fault = fault;
  reveal(q('#install-project'));
  click(q('#install-project'));
  await until(
    () =>
      p.data.transactions
        .slice(start)
        .some((r) => r.mode === 'readwrite' && r.stores.includes('revisions') && r.outcome),
    'native install terminal ' + name,
  );
  if (fault && faultExpected)
    await until(() => p.data.faults.length > beforeFaults, 'named native fault ' + name);
  await settled();
  const row = await capture(name);
  row.operation = p.data.transactions.slice(start).map((r) => ({ ...r }));
  return row;
}
function retained(before, after, name) {
  check(equal(before.records, after.records), name + ' exact retained recording rows');
  check(equal(before.recovery, after.recovery), name + ' exact retained recovery');
  check(equal(before.state, after.state), name + ' paused current flight unchanged');
  check(before.course === after.course, name + ' current course unchanged');
  check(
    before.selectedCourse === after.selectedCourse && before.mode === after.mode,
    name + ' selected edit course/mode unchanged',
  );
  check(before.draft === after.draft, name + ' editable JSON retained');
}
function active(row) {
  return row.revisions.find((r) => r.id === fixture.pack.id && r.active);
}
async function run() {
  $('run').disabled = true;
  receipt.startedAt = new Date().toISOString();
  try {
    fixture = await (await fetch('fixture.json')).json();
    expected = await (await fetch('expected-project.json')).json();
    receipt.fixture = fixture;
    for (const row of fixture.files) {
      const bytes = await (await fetch(row.path)).arrayBuffer(),
        sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
          .map((n) => n.toString(16).padStart(2, '0'))
          .join('');
      check(bytes.byteLength === row.bytes && sha === row.sha256, 'frozen file ' + row.path);
    }
    $('status').textContent = 'Real practice and retained interrupted flight';
    await mount();
    await importPack();
    await fly();
    await settings();
    set('flight-source', 'keyboard');
    set('flight-camera', 'chase');
    await arm();
    await until(
      () =>
        q('#flight-dialog').dataset.flightState === 'complete' &&
        [...d.querySelectorAll('#result-panel button')].some(
          (n) => n.textContent === 'Watch verified flight',
        ),
      'completed native practice and verified Watch',
    );
    await settled();
    const records = await p.records.list(),
      proof = records.find((r) => r.course.id === 'creator-install-first');
    check(
      proof?.status === 'verified' && proof.proof.frames.length === 60,
      'genuine verified 60-tick record',
    );
    check(
      proof.packIdentity === 'fpv-pack:' + fixture.pack.sha256,
      'record bound to original exact pack',
    );
    receipt.originalRecord = proof;
    await fly();
    await arm();
    await until(() => {
      const s = p.app.snapshot().state;
      return s.status === 'active' && s.ticks >= 5;
    }, 'short nonterminal practice');
    await settings();
    await settled();
    const saved = await capture('real interrupted flight');
    check(
      saved.state.status === 'paused' && saved.state.ticks > 0 && saved.state.ticks < 60,
      'real bounded interrupted practice',
    );
    check(
      saved.recovery?.packIdentity === proof.packIdentity,
      'recovery bound to original exact pack',
    );
    check(
      saved.recovery.proof.frames.length > 0 && saved.recovery.proof.frames.length < 60,
      'recovery contains actual input prefix',
    );
    await openEditor();
    const editedA = await edit('A'),
      beforeA = await capture('before aborted install');
    $('status').textContent = 'Abort real install transaction, then retry';
    const aborted = await install('abort-install', 'aborted install');
    retained(beforeA, aborted, 'aborted install');
    check(
      equal(beforeA.revisions, aborted.revisions),
      'aborted install leaves all revisions exact',
    );
    check(beforeA.generation === aborted.generation, 'aborted install leaves generation exact');
    const retryA = await install(null, 'ordinary retry after abort');
    retained(beforeA, retryA, 'retry after abort');
    check(active(retryA).sha256 === editedA.sha256, 'retry commits exact exported draft');
    check(retryA.generation === beforeA.generation + 1, 'retry increments generation once');
    check(
      retryA.revisions.some((r) => r.sha256 === fixture.pack.sha256 && !r.active),
      'original revision retained after retry',
    );
    $('status').textContent = 'Commit world revision, then abort independent UI refresh';
    const editedB = await edit('B'),
      beforeB = await capture('before post-commit refresh');
    const refresh = await install('commit-then-refresh', 'committed install with aborted refresh');
    retained(beforeB, refresh, 'post-commit refresh failure');
    check(
      active(refresh).sha256 === editedB.sha256,
      'refresh failure preserves committed exact draft',
    );
    check(refresh.generation === beforeB.generation + 1, 'refresh failure commits one generation');
    check(
      refresh.revisions.length === beforeB.revisions.length + 1,
      'refresh failure retains earlier revisions',
    );
    receipt.refreshDiagnostic = { status: refresh.studio, committed: true };
    check(
      refresh.studio === 'World pack saved. Reload the page to refresh the Library.',
      'committed refresh failure truthfully reports saved pack and reload action',
    );
    const retryB = await install(null, 'ordinary retry after refresh failure');
    retained(beforeB, retryB, 'refresh failure retry');
    check(active(retryB).sha256 === editedB.sha256, 'refresh retry retains same exact pack');
    check(
      retryB.revisions.length === refresh.revisions.length,
      'refresh retry adds no duplicate revision',
    );
    await creatorLocale('uk');
    const beforeUK = await capture('before Ukrainian committed refresh failure');
    const refreshUK = await install('commit-then-refresh', 'Ukrainian committed refresh failure');
    retained(beforeUK, refreshUK, 'Ukrainian refresh failure');
    check(
      refreshUK.studio ===
        'Пакунок світу збережено. Перезавантажте сторінку, щоб оновити бібліотеку.',
      'Ukrainian committed-save guidance is visible',
    );
    check(
      active(refreshUK).sha256 === editedB.sha256,
      'Ukrainian refresh failure retains exact committed pack',
    );
    await creatorLocale('en');
    $('status').textContent = 'Commit revision, abort generation read, observe retry ownership';
    const editedC = await edit('C'),
      beforeC = await capture('before post-commit generation read');
    const generation = await install(
      'commit-then-generation',
      'committed install with generation-read abort probe armed',
      false,
    );
    retained(beforeC, generation, 'post-commit generation read failure');
    check(
      active(generation).sha256 === editedC.sha256,
      'generation read failure still committed exact draft',
    );
    check(
      generation.generation === beforeC.generation + 1,
      'generation read failure follows actual commit',
    );
    check(
      p.data.pendingGeneration &&
        !generation.operation.some(
          (r) => r.mode === 'readonly' && r.stores.length === 1 && r.stores[0] === 'meta',
        ),
      'committed result avoids redundant generation read while abort probe remains armed',
    );
    check(
      generation.studio === 'World pack is ready to fly.',
      'no false failure after committed result',
    );
    const retryC = await install(null, 'ordinary retry using committed generation');
    retained(beforeC, retryC, 'generation read retry');
    check(active(retryC).sha256 === editedC.sha256, 'generation retry retains committed bytes');
    receipt.generationDiagnostic = {
      statusAfterFailure: generation.studio,
      statusAfterRetry: retryC.studio,
      committedGeneration: generation.generation,
      retryGeneration: retryC.generation,
      retryTransactions: retryC.operation,
    };
    check(
      retryC.generation === generation.generation + 1,
      'retry commits with exact previous committed generation',
    );
    check(retryC.studio === 'World pack is ready to fly.', 'retry reports actual completion');
    check(
      retryC.revisions.length === generation.revisions.length,
      'retry retains one copy of each exact revision',
    );
    p.data.pendingGeneration = false;
    const externalProject = w.JSON.parse(JSON.stringify(editedC.project));
    externalProject.courses[1].locales.en.brief = 'Real separate-connection revision';
    const externalPack = await p.content.inspectPack(await p.content.preparePack(externalProject));
    const externalResult = await p.store.install({
      ...externalPack,
      expectedGeneration: retryC.generation,
    });
    receipt.externalWriter = {
      scope: 'Explicit diagnostic second native connection; no runtime state substitution',
      sha256: externalPack.sha256,
      generation: externalResult.generation,
    };
    const beforeExternalRetry = await capture(
      'separate native connection committed newer revision',
    );
    const staleRetry = await install(null, 'stale Creator retry after separate native writer');
    retained(beforeExternalRetry, staleRetry, 'external-generation conflict');
    check(
      equal(beforeExternalRetry.revisions, staleRetry.revisions),
      'stale retry cannot overwrite newer external revision',
    );
    check(
      staleRetry.generation === externalResult.generation,
      'stale retry leaves external generation exact',
    );
    check(
      staleRetry.studio === 'World library changed. Reload before saving.',
      'strict generation-conflict advice remains intact',
    );
    const latestExport = await exportPack('after all faults');
    check(
      latestExport.sha256 === editedC.sha256,
      'draft export remains exact after failures/retries',
    );
    const prefix = storage;
    await dispose('original host');
    await mount(prefix);
    const reopened = await capture('native same-origin reopen');
    check(
      equal(saved.records, reopened.records),
      'native reopen exact retained original recording',
    );
    check(equal(saved.recovery, reopened.recovery), 'native reopen exact interrupted recovery');
    check(
      active(reopened).sha256 === externalPack.sha256,
      'native reopen latest external installed revision',
    );
    check(
      reopened.revisions.some((r) => r.sha256 === editedC.sha256 && !r.active),
      'native reopen retains previously saved Creator revision',
    );
    check(
      reopened.revisions.some((r) => r.sha256 === fixture.pack.sha256 && !r.active),
      'native reopen retains original required pack',
    );
    $('status').textContent = 'Ordinary recovery of retained old revision and verified Watch';
    await menu();
    check(
      q('#worlds-shell-action-primary').textContent === 'Continue',
      'reopen offers saved recovery',
    );
    click(q('#worlds-shell-action-primary'));
    await until(
      () => p.app.snapshot().course === 'creator-install-first' && !q('#world-arm').disabled,
      'saved recovery scene ready',
    );
    await frames();
    const restored = await capture('old exact revision recovered');
    for (const key of ['ticks', 'position', 'orientation', 'velocity'])
      check(equal(saved.state[key], restored.state[key]), 'recovered exact ' + key);
    await arm();
    await until(
      () =>
        q('#flight-dialog').dataset.flightState === 'complete' &&
        [...d.querySelectorAll('#result-panel button')].some(
          (n) => n.textContent === 'Watch verified flight',
        ),
      'resumed practice completes',
    );
    const finalProof = (await p.records.list()).find((r) => r.id === proof.id);
    check(
      finalProof?.status === 'verified' && finalProof.packIdentity === proof.packIdentity,
      'completed recovery retains original proof/pack identity',
    );
    click(
      [...d.querySelectorAll('#result-panel button')].find(
        (n) => n.textContent === 'Watch verified flight',
      ),
    );
    await until(
      () => p.app.snapshot().replay && !q('#world-arm').disabled,
      'actual retained verified Watch',
    );
    await settings();
    await frames();
    const replay = p.app.snapshot();
    receipt.replay = { course: replay.course, state: replay.state, replay: replay.replay };
    check(
      replay.course === 'creator-install-first' && replay.replay,
      'native Watch uses retained first-course recording',
    );
    check(
      replay.replay.kind === 'recording' &&
        replay.replay.mode === finalProof.proof.mode &&
        replay.replay.frames === finalProof.proof.frames.length,
      'native Watch kind/mode/frame count matches retained verified proof',
    );
    check(
      ['paused', 'complete'].includes(replay.state.status),
      'Watch stopped through public Settings or completed',
    );
    await dispose('reopened host');
    receipt.passed = true;
    $('status').textContent =
      'PASS: native transaction/retention checks complete; diagnostic post-commit outcomes retained';
  } catch (error) {
    receipt.passed = false;
    receipt.error = { message: String(error), stack: error.stack };
    try {
      if (p && !finished) {
        await capture('failure before cleanup');
        await dispose('failure cleanup');
      }
    } catch (cleanup) {
      receipt.cleanupError = String(cleanup);
    }
    $('status').textContent = 'FAIL: ' + error;
  } finally {
    receipt.endedAt = new Date().toISOString();
    $('receipt').value = JSON.stringify(receipt, null, 2);
    $('summary').textContent = JSON.stringify(
      {
        passed: receipt.passed,
        checks: receipt.checks.length,
        failed: receipt.checks.filter((c) => !c.passed),
        error: receipt.error,
        refreshDiagnostic: receipt.refreshDiagnostic,
        generationDiagnostic: receipt.generationDiagnostic,
        hosts: receipt.hosts.map((h) => ({
          name: h.name,
          errors: h.errors,
          warnings: h.warnings,
          faults: h.faults,
          dropped: h.dropped,
        })),
        receiptCharacters: $('receipt').value.length,
      },
      null,
      2,
    );
  }
}
$('run').onclick = run;
