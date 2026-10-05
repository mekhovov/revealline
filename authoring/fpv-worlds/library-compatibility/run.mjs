const $ = (id) => document.getElementById(id),
  frame = $('sim');
const receipt = {
  format: 'FPVLibraryCompatibilityBrowser.v1',
  checks: [],
  observations: [],
  hosts: [],
  limitations: [
    'Actual old admitted player and explicit candidate source overlays; native IndexedDB, Worker, clocks and public DOM controls.',
    'Named diagnostic Worker fetch serves pinned catalogue/pack bytes. Neither catalogue contains a real production row yet. No real remote download or launcher update journey claim.',
    'Genuine short practice creates a recording and recovery. No proof or flight-state injection; no performance or final Reservoir presentation claim.',
  ],
};
let w, d, p, fixture;
const q = (selector) => d.querySelector(selector),
  same = (a, b) => JSON.stringify(a) === JSON.stringify(b),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
  const rows = [];
  for (let a = n.parentElement; a; a = a.parentElement)
    if (a.tagName === 'DETAILS' && !a.open) rows.unshift(a);
  for (const a of rows) click(a.querySelector(':scope > summary'));
}
function set(id, value) {
  const n = q('#' + id);
  reveal(n);
  check(visible(n) && !n.disabled, 'visible setting ' + id);
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
async function missions() {
  await menu();
  click(q('#worlds-shell-action-missions'));
  await until(() => q('#worlds-shell-missions-dialog').open, 'Missions');
}
async function library() {
  await missions();
  click(q('[data-tab="packs"]'));
  await frames();
}
async function settings() {
  await menu();
  click(q('#worlds-shell-action-settings'));
  await until(() => q('#sim-settings').open, 'Settings');
  await frames();
}
async function locale(value) {
  await settings();
  set('world-language', value);
  await frames();
  await library();
}
async function capture(name) {
  const row = { name, ...(await p.inspect()) };
  receipt.observations.push(row);
  return row;
}
function retained(before, after, name, { store = true } = {}) {
  for (const key of [
    'records',
    'recovery',
    'draft',
    'course',
    'state',
    ...(store ? ['generation', 'revisions'] : []),
  ])
    check(same(before[key], after[key]), name + ' retains ' + key);
}
async function mount(variant, prefix) {
  const storage = prefix ?? 'world-compatibility-' + crypto.randomUUID() + ':',
    load = crypto.randomUUID();
  frame.src =
    variant +
    '/optional-practice/fpv-worlds/compatibility-host.html?variant=' +
    variant +
    '&storage=' +
    encodeURIComponent(storage) +
    '&load=' +
    load;
  await until(
    () =>
      frame.contentWindow?.fpvCompatibility &&
      !frame.contentWindow.fpvCompatibility.disposed &&
      frame.contentWindow.fpvCompatibility.prefix === storage &&
      new URL(frame.contentWindow.location.href).searchParams.get('load') === load,
    'fresh ' + variant + ' native host',
  );
  w = frame.contentWindow;
  d = frame.contentDocument;
  p = w.fpvCompatibility;
  w.focus();
  await frames();
  return storage;
}
async function finish(name) {
  if (!p || p.disposed) return;
  await p.finish();
  receipt.hosts.push({ name, ...p.data });
  check(!p.data.errors.length && !p.data.warnings.length, name + ' no unexpected errors/warnings');
  check(
    p.data.workers.every((r) => r.terminated === 1),
    name + ' each native worker terminated once',
  );
  check(
    !p.data.resources || Object.values(p.data.resources.registered).every((n) => n === 0),
    name + ' renderer resources released',
  );
}
async function upload(name) {
  await library();
  const input = q('#import-pack');
  reveal(input);
  check(visible(input.closest('label')), 'visible file import');
  const transfer = new w.DataTransfer();
  transfer.items.add(
    new w.File([await (await fetch(name)).arrayBuffer()], name, {
      type: 'application/octet-stream',
    }),
  );
  input.files = transfer.files;
  input.dispatchEvent(new w.Event('change', { bubbles: true }));
  await until(() => input.value === '', 'native import settled');
  await frames();
}
async function fly() {
  await missions();
  click(q('[data-world="' + fixture.diagnostic.id + '"]'));
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
}
async function arm() {
  await menu();
  check(q('#worlds-shell-action-primary').textContent === 'Continue', 'settled Continue');
  click(q('#worlds-shell-action-primary'));
  await until(
    () => q('#flight-dialog').dataset.flightState === 'active',
    'ordinary deliberate Arm',
  );
}
async function prepareRetainedData() {
  await locale('en');
  await upload('diagnostic.rlpack');
  check(
    (await p.inspect()).revisions.some((r) => r.sha256 === fixture.diagnostic.sha256),
    'diagnostic exact revision installed',
  );
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
    'genuine practice completed and verified',
  );
  const complete = await capture('genuine completed practice');
  check(
    complete.records.some(
      (r) =>
        r.status === 'verified' &&
        r.proof.frames.length === 60 &&
        r.packIdentity === 'fpv-pack:' + fixture.diagnostic.sha256,
    ),
    'genuine exact-pack 60-tick recording',
  );
  await fly();
  await arm();
  await until(() => p.app.snapshot().state.ticks >= 5, 'short ordinary flight');
  await settings();
  await frames();
  await until(
    async () => !!(await p.inspect()).recovery?.proof.frames.length,
    'native recovery saved',
  );
  const paused = await capture('genuine interrupted practice');
  check(
    paused.state.status === 'paused' && paused.state.ticks > 0 && paused.state.ticks < 60,
    'real paused prefix',
  );
  check(
    paused.recovery.packIdentity === 'fpv-pack:' + fixture.diagnostic.sha256,
    'recovery retains original pack',
  );
  await library();
  const row = q('[data-pack-id="' + fixture.diagnostic.id + '"]');
  click([...row.querySelectorAll('button')].find((n) => n.textContent === 'Edit'));
  await until(
    () => visible(q('#creator-json')) || visible(q('#editor-project-course')),
    'native project editor',
  );
  const field = q('#creator-json');
  reveal(field);
  const draft = JSON.parse(field.value);
  draft.locales.en.brief = 'Compatibility retained applied draft';
  field.value = JSON.stringify(draft, null, 2);
  field.dispatchEvent(new w.Event('input', { bubbles: true }));
  click(q('#apply-json'));
  await frames();
  check(
    JSON.parse(field.value).locales.en.brief === draft.locales.en.brief,
    'genuine applied editable draft',
  );
  await library();
}
function libraryText() {
  return q('#optional-world-library [role="status"]').textContent;
}
async function browse(index) {
  p.network.index = w.JSON.parse(JSON.stringify(index));
  const button = q('#optional-world-library > button');
  click(button);
  await until(() => !button.disabled, 'catalogue load');
  await frames();
}
async function download(row, bytes) {
  const url =
    'https://raw.githubusercontent.com/mekhovov/revealline/' + row.commit + '/' + row.path;
  p.network.packs[url] = new w.Uint8Array(bytes);
  const button = q('#optional-world-library [data-world="' + row.id + '"] button');
  click(button);
  await until(() => !q('#optional-world-library > button').disabled, 'download/save settled');
  await frames();
}
async function run() {
  $('run').disabled = true;
  receipt.startedAt = new Date().toISOString();
  try {
    fixture = await (await fetch('fixture.json')).json();
    receipt.fixture = fixture;
    for (const row of fixture.files) {
      const bytes = await (await fetch(row.path)).arrayBuffer(),
        sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
          .map((n) => n.toString(16).padStart(2, '0'))
          .join('');
      check(bytes.byteLength === row.bytes && sha === row.sha256, 'frozen ' + row.path);
    }
    $('status').textContent = 'Old admitted player: actual required-coating refusal';
    await mount('old');
    await prepareRetainedData();
    await browse({ format: 'FPVWorldLibrary.v1', worlds: [] });
    check(libraryText() === 'No published worlds yet.', 'old v1 catalogue still valid');
    check(
      p.data.requests.at(-1).url.endsWith('/published/index.json'),
      'old player requests original index',
    );
    const before = await capture('old before required-coating import');
    await upload('coating.rlpack');
    const after = await capture('old after required-coating refusal');
    check(
      after.studio.includes('Unsupported required extension: REVEALLINE_surface_coating'),
      'actual unchanged old-player refusal',
    );
    retained(before, after, 'old required-feature refusal');
    await finish('old admitted');
    $('status').textContent = 'Capable candidate: native refusal guidance and supported exact save';
    const prefix = await mount('candidate');
    await prepareRetainedData();
    await browse({ format: 'FPVWorldLibrary.v1', worlds: [] });
    check(libraryText() === 'No published worlds yet.', 'empty capability catalogue valid');
    check(
      p.data.requests.at(-1).url.endsWith('/published/surface-coating-v1/index.json'),
      'capable player uses capability endpoint',
    );
    for (const language of ['en', 'uk']) {
      await locale(language);
      const prior = await capture(language + ' before direct refusal');
      await upload('future.rlpack');
      const refused = await capture(language + ' direct unsupported refusal');
      check(
        refused.studio.includes(language === 'en' ? 'compatible pack' : 'сумісний пакунок'),
        language + ' direct explicit compatible-pack fallback',
      );
      check(
        refused.studio.includes(
          language === 'en' ? 'Prepare offline saves' : 'Підготовка офлайн зберігає',
        ),
        language + ' distinguishes update and offline preparation',
      );
      retained(prior, refused, language + ' direct refusal');
      await browse({ format: 'FPVWorldLibrary.v1', worlds: [fixture.future] });
      await download(fixture.future, await (await fetch('future.rlpack')).arrayBuffer());
      check(libraryText() === refused.studio, language + ' Library shares exact update guidance');
      retained(
        prior,
        await capture(language + ' Library unsupported refusal'),
        language + ' Library refusal',
      );
    }
    await locale('en');
    const malformedBefore = await capture('before malformed declaration');
    await upload('malformed.rlpack');
    const malformed = await capture('malformed required names');
    check(
      malformed.studio === 'Invalid required extension names.',
      'malformed declaration is not an update request',
    );
    retained(malformedBefore, malformed, 'malformed refusal');
    const supportedBefore = await capture('before supported exact save');
    await browse({ format: 'FPVWorldLibrary.v1', worlds: [fixture.coating] });
    await download(fixture.coating, await (await fetch('coating.rlpack')).arrayBuffer());
    const installed = await capture('supported exact save');
    check(libraryText().startsWith('Pack saved.'), 'supported required capability saved');
    check(
      installed.generation === supportedBefore.generation + 1,
      'one native committed generation',
    );
    check(
      installed.revisions.some(
        (r) => r.id === fixture.coating.id && r.sha256 === fixture.coating.sha256 && r.active,
      ),
      'exact genuine coating pack retained',
    );
    retained(supportedBefore, installed, 'supported save', { store: false });
    check(
      p.data.requests.every((r) => r.credentials === 'omit' && r.redirect === 'error'),
      'all native-worker requests retain transport restrictions',
    );
    await finish('capable candidate');
    await mount('candidate', prefix);
    const reopened = await capture('native reopened stored packs');
    for (const key of ['generation', 'revisions', 'records'])
      check(same(installed[key], reopened[key]), 'native reopen retains ' + key);
    check(
      reopened.recovery.packIdentity === installed.recovery.packIdentity &&
        same(reopened.recovery.proof.frames, installed.recovery.proof.frames),
      'native reopen retains recovery identity/input prefix',
    );
    await finish('reopened candidate');
    receipt.completed = true;
    $('status').textContent = 'PASS · ' + receipt.checks.length + ' checks';
  } catch (error) {
    receipt.error = { message: error.message, stack: error.stack };
    if (p && !p.disposed) {
      try {
        receipt.failure = await p.inspect();
      } catch (e) {
        receipt.captureError = String(e);
      }
    }
    $('status').textContent = 'STOPPED · ' + error.message;
  } finally {
    try {
      await finish('final cleanup');
    } catch (error) {
      receipt.cleanupError = String(error);
      receipt.completed = false;
    }
    receipt.endedAt = new Date().toISOString();
    $('receipt').value = JSON.stringify(receipt, null, 2);
    $('summary').textContent = JSON.stringify(
      {
        completed: !!receipt.completed,
        checks: receipt.checks.length,
        failed: receipt.checks.filter((r) => !r.passed),
        error: receipt.error ?? null,
        cleanupError: receipt.cleanupError ?? null,
      },
      null,
      2,
    );
  }
}
$('run').onclick = run;
