const $ = (id) => document.getElementById(id),
  frame = $('sim');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const stable = (v) =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );
const clone = (v) => JSON.parse(JSON.stringify(v));
const sha = async (b) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
let receipt,
  fixture,
  ctx = {};
const q = (s) => ctx.d.querySelector(s),
  panel = () => q('#optional-world-library');
const browse = () => panel().querySelector('button'),
  cancel = () => panel().querySelectorAll('button')[1];
const message = () => panel().querySelector('[role=status]').textContent;
const packButton = () => panel().querySelector('[data-world] button');
function render(text) {
  $('status').textContent = text;
  $('summary').textContent = JSON.stringify(
    {
      status: receipt.status,
      checks: receipt.checks.length,
      failed: receipt.checks.filter((x) => !x.passed),
      error: receipt.error,
    },
    null,
    2,
  );
  $('receipt').value = JSON.stringify(receipt, null, 2);
}
function must(ok, name, details = {}) {
  receipt.checks.push({ name, passed: !!ok, ...details });
  if (!ok) throw Error(name);
}
const eq = (a, b, name) => must(stable(a) === stable(b), name);
async function until(fn, label) {
  const start = performance.now();
  while (!(await fn())) {
    if (performance.now() - start > 30000) throw Error('Timeout: ' + label);
    await delay(20);
  }
}
async function bounded(p, label) {
  let timer;
  try {
    return await Promise.race([
      p,
      new Promise(
        (_, reject) => (timer = setTimeout(() => reject(Error('Timeout: ' + label)), 30000)),
      ),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
function click(n) {
  if (!n || n.disabled) throw Error('Missing/disabled public action');
  n.click();
}
function change(n, v) {
  n.value = v;
  n.dispatchEvent(new ctx.w.Event('change', { bubbles: true }));
}
async function bytes(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw Error('HTTP ' + r.status + ' ' + url);
  return r.arrayBuffer();
}
function preserve() {
  const s = ctx.app.snapshot();
  return {
    course: s.course ?? null,
    state: s.state ?? null,
    records: s.records,
    appearance: s.appearance,
    editor: q('#creator-json').value,
    mode: q('#editor-route-mode')?.value,
    flightMode: q('#flight-mode').value,
    flightOpen: q('#flight-dialog').open,
    offline: q('#prepare-runtime').textContent,
  };
}
async function records() {
  return ctx.store.list({ includeRevisions: true });
}
async function idle() {
  await until(() => !browse().disabled, 'Library operation complete');
}
async function index(rows, mode = 'normal') {
  ctx.n.index = Array.isArray(rows) ? { format: 'FPVWorldLibrary.v1', worlds: rows } : rows;
  ctx.n.mode = mode;
  click(browse());
  await idle();
}
async function download(mode = 'normal') {
  ctx.n.mode = mode;
  click(packButton());
  await idle();
}
async function openHost() {
  if (ctx.app) {
    receipt.network.push(...clone(ctx.n.requests));
    receipt.aborts.push(...clone(ctx.n.aborts));
    ctx.store.close();
    await bounded(ctx.app.dispose(), 'old host disposal');
    eq(ctx.w.fixtureErrors, [], 'Old host has no uncaught errors');
  }
  const token = crypto.randomUUID();
  frame.src = './player/optional-practice/fpv-worlds/fixture-host.html?token=' + token + '#packs';
  await until(
    () => frame.contentWindow?.fixtureToken === token && frame.contentWindow.fpvWorldStudio,
    'automatic native host',
  );
  ctx.w = frame.contentWindow;
  ctx.d = frame.contentDocument;
  ctx.app = ctx.w.fpvWorldStudio;
  await bounded(ctx.app.ready, 'native hydration');
  await until(() => q('#creator-json')?.value, 'initial editor');
  [ctx.content, ctx.storage] = await ctx.w.fixtureModules;
  ctx.store = await ctx.storage.openWorldStore();
  ctx.n = ctx.w.fixtureNetwork;
  ctx.n.pack = new ctx.w.Uint8Array(await bytes('./pack.rlpack'));
  ctx.prepared = await ctx.content.inspectPack(ctx.n.pack);
  click(q('#worlds-shell-action-missions'));
  click(q('[data-tab=packs]'));
}
async function remove() {
  click(q('[data-remove-pack="' + fixture.asset.id + '"]'));
  await until(
    () =>
      [...ctx.d.querySelectorAll('dialog[open] button')].some(
        (x) => x.textContent === 'Remove pack and retained revisions' && !x.disabled,
      ),
    'native removal review',
  );
  click(
    [...ctx.d.querySelectorAll('dialog[open] button')].find(
      (x) => x.textContent === 'Remove pack and retained revisions',
    ),
  );
  await until(
    async () => !(await records()).length && !q('[data-remove-pack="' + fixture.asset.id + '"]'),
    'native removal committed',
  );
  await until(() => packButton() && !packButton().disabled, 'saved status refreshed after removal');
}
async function execute() {
  $('run').disabled = true;
  receipt = {
    format: 'FPVWorldLibraryBrowser.v1',
    status: 'running',
    startedAt: new Date().toISOString(),
    checks: [],
    network: [],
    aborts: [],
  };
  render('Verifying immutable files…');
  fixture = JSON.parse(new TextDecoder().decode(await bytes('./fixture.json')));
  receipt.fixture = fixture;
  for (const f of fixture.files) {
    const e = fixture.overlays.find((x) => x.path === f.path) ?? f,
      b = await bytes('./player/' + f.path);
    must(b.byteLength === e.bytes && (await sha(b)) === e.sha256, 'Member ' + f.path);
  }
  for (const f of fixture.browserSources) {
    const b = await bytes('./' + f.path);
    must(b.byteLength === f.bytes && (await sha(b)) === f.sha256, 'Fixture ' + f.path);
  }
  const memory = new Map([
    [
      'revealline.fpv.world-settings.v1',
      JSON.stringify({
        'world-language': 'en',
        'flight-source': 'keyboard',
        'flight-mode': 'self-level',
        'flight-quality': 'low',
        'sim-motion': 'reduced',
      }),
    ],
  ]);
  window.fixtureStorage = {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
  };
  window.fixturePrefix = 'fpv-world-library-' + crypto.randomUUID() + ':';
  window.fixtureDatabases = new Set();
  await openHost();
  eq(ctx.n.requests, [], 'Opening Library performs no remote download');
  eq(await records(), [], 'Isolated native library starts empty');
  await index([]);
  must(message() === 'No published worlds yet.', 'Empty production catalogue is honest');
  change(q('#world-language'), 'uk');
  must(
    browse().textContent === 'Оглянути додаткові світи' &&
      message() === 'Опублікованих світів ще немає.',
    'In-place Ukrainian button and status',
  );
  change(q('#world-language'), 'en');
  click(q('[data-tab=explore]'));
  click(q('[data-world=woodland]'));
  click(q('[aria-label="Fly: Clearing check-in"]'));
  await until(
    () => q('#flight-status').textContent.startsWith('Ready. Choose'),
    'ordinary selected course ready',
  );
  click(q('#world-flight-menu'));
  click(q('#worlds-shell-action-missions'));
  click(q('[data-tab=packs]'));
  must(
    ctx.app.snapshot().course === 'woodland-01' && ctx.app.snapshot().state.status !== 'active',
    'Native Library retains a ready, unarmed flight owner',
  );
  const dirty = q('#creator-json').value + '\n ';
  q('#creator-json').value = dirty;
  q('#creator-json').dispatchEvent(new ctx.w.Event('input', { bubbles: true }));
  const original = preserve();
  const invalid = [
    ['format', { format: 'Other', worlds: [] }],
    [
      'extra-index-field',
      { format: 'FPVWorldLibrary.v1', worlds: [], url: 'https://example.invalid' },
    ],
    ['duplicate', [fixture.asset, fixture.asset]],
    ['path-traversal', [{ ...fixture.asset, path: 'authoring/fpv-worlds/../outside.rlpack' }]],
    ['arbitrary-url', [{ ...fixture.asset, path: 'https://example.invalid/a.rlpack' }]],
    ['mutable-ref', [{ ...fixture.asset, commit: 'main' }]],
    ['five-rows', Array.from({ length: 5 }, (_, i) => ({ ...fixture.asset, id: 'world-' + i }))],
    ['oversized-index', ' '.repeat(8193)],
  ];
  for (const [name, value] of invalid) {
    await index(value);
    must(message().includes('failed'), 'Reject ' + name);
    eq(await records(), [], 'No install after ' + name);
  }
  for (const mode of ['http', 'reject']) {
    await index([], mode);
    must(message().includes('failed'), 'Retryable index ' + mode);
    if (mode === 'http')
      must(ctx.n.requests.at(-1).bodyCancelled, 'Rejected HTTP index body is cancelled');
  }
  await index([fixture.asset]);
  must(
    panel().textContent.includes(fixture.asset.title[0]) &&
      panel().textContent.includes('r1') &&
      panel().textContent.includes('17072 B'),
    'Pinned catalogue title, revision and exact bytes visible',
  );
  eq(
    preserve(),
    original,
    'Browse leaves dirty editor, settings, flight and offline control unchanged',
  );
  const packFaults = ['oversize-header', 'short', 'long', 'corrupt', 'http', 'reject'];
  for (const mode of packFaults) {
    await download(mode);
    must(message().includes('failed'), 'Pack ' + mode + ' rejected');
    if (['http', 'oversize-header'].includes(mode))
      must(ctx.n.requests.at(-1).bodyCancelled, 'Rejected pack body is cancelled: ' + mode);
    eq(await records(), [], 'No partial native install ' + mode);
    eq(preserve(), original, 'No activation or draft change ' + mode);
  }
  for (const [name, row] of [
    ['project-id', { ...fixture.asset, id: 'wrong-project' }],
    ['course-count', { ...fixture.asset, courses: 2 }],
  ]) {
    await index([row]);
    await download();
    must(message().includes('failed'), 'Native ' + name + ' binding rejects');
    eq(await records(), [], 'No saved revision for ' + name);
  }
  ctx.n.invalid = new ctx.w.Uint8Array([1, 2, 3, 4]);
  await index([{ ...fixture.asset, bytes: 4, sha256: await sha(ctx.n.invalid) }]);
  await download('invalid-pack');
  must(message().includes('failed'), 'Exact digest cannot bypass native pack validation');
  await index([fixture.asset]);
  let before = ctx.n.requests.length;
  ctx.n.mode = 'hold';
  click(packButton());
  await until(() => ctx.n.held, 'held pack stream');
  must(
    browse().disabled && packButton().disabled && !cancel().hidden,
    'Single operation owns Browse and Download',
  );
  packButton().click();
  browse().click();
  must(ctx.n.requests.length === before + 1, 'Disabled duplicate actions do not fetch twice');
  must(message() === '64 / 17072 B', 'Stream reports exact byte progress');
  click(cancel());
  await idle();
  must(
    message().includes('Cancelled') && ctx.n.requests.at(-1).aborted,
    'User cancel reaches stream AbortSignal',
  );
  eq(await records(), [], 'Cancellation keeps native library unchanged');
  ctx.n.mode = 'hold';
  click(packButton());
  await until(() => ctx.n.held, 'timeout held stream');
  ctx.n.timeout();
  await idle();
  must(
    message().includes('timed out') && ctx.n.requests.at(-1).aborted,
    'Injected timeout callback aborts pending stream',
  );
  ctx.n.mode = 'hold';
  click(packButton());
  await until(() => ctx.n.held, 'concurrent-write held stream');
  await ctx.store.install({ ...ctx.prepared, expectedGeneration: await ctx.store.generation() });
  const concurrent = await records();
  ctx.n.held.release();
  await idle();
  must(message().includes('failed'), 'Stale pre-download generation refuses overwrite');
  eq(await records(), concurrent, 'Concurrent native revision survives conflict');
  eq(preserve(), original, 'All refused downloads preserve editor and inactive flight');
  await openHost();
  await index([fixture.asset]);
  must(
    packButton().disabled && packButton().textContent === 'Saved pack',
    'Native reopen recognizes exact saved hash',
  );
  before = ctx.n.requests.length;
  packButton().click();
  eq(ctx.n.requests.length, before, 'Saved exact revision cannot download again');
  await remove();
  eq(await records(), [], 'Public removal clears saved revision');
  const beforeSuccess = preserve();
  await download();
  must(
    message().includes('Pack saved. Prepare simulator offline separately'),
    'Successful native save distinguishes runtime offline readiness',
  );
  const saved = await ctx.store.get(fixture.asset.id, { sha256: fixture.asset.sha256 });
  must(saved?.sha256 === fixture.asset.sha256, 'Actual first-party download installs exact digest');
  eq(saved.project, ctx.prepared.project, 'Actual first-party download preserves complete project');
  must(
    ctx.n.requests.at(-1).native &&
      ctx.n.requests.at(-1).status === 200 &&
      ctx.n.requests.at(-1).responseURL.includes('/' + fixture.asset.commit + '/'),
    'Valid pack used real immutable HTTPS response',
  );
  eq(
    preserve(),
    beforeSuccess,
    'Actual successful download leaves editor, flight, mode and runtime offline action unchanged',
  );
  must(packButton().disabled, 'Native save prevents immediate duplicate download');
  const retained = await records();
  const replacementProject = ctx.w.JSON.parse(JSON.stringify(ctx.prepared.project));
  replacementProject.title += ' · replacement diagnostic';
  const replacementBlob = await ctx.content.preparePack(replacementProject, {
    assets: ctx.prepared.assets,
  });
  const replacementBytes = new ctx.w.Uint8Array(await replacementBlob.arrayBuffer());
  const replacement = {
    ...fixture.asset,
    revision: 'r2',
    bytes: replacementBytes.length,
    sha256: await sha(replacementBytes),
  };
  receipt.replacementDiagnostic = {
    row: replacement,
    transport: 'Fixture-only prepared data; not an actual published replacement URL',
  };
  await index([replacement]);
  ctx.n.pack = replacementBytes;
  ctx.n.mode = 'hold';
  click(packButton());
  await until(() => ctx.n.held, 'held replacement stream');
  click(cancel());
  await idle();
  eq(await records(), retained, 'Cancelled replacement preserves prior exact revision');
  ctx.n.abortWrite = true;
  await download('prepared-pack');
  must(message().includes('failed'), 'Actual aborted native write reports failure');
  eq(await records(), retained, 'Aborted native replacement preserves prior exact revision');
  must(
    ctx.n.aborts.at(-1)?.phase === 'before-write',
    'Write fault really aborted a native transaction',
  );
  ctx.n.failRefresh = true;
  await download('prepared-pack');
  must(
    message() === 'Pack saved. Reload to refresh Library.',
    'Committed pack is not misreported as failed after readonly refresh abort',
  );
  must(
    packButton().disabled && (await records()).some((x) => x.sha256 === replacement.sha256),
    'Committed exact revision remains saved after refresh failure',
  );
  must(
    ctx.n.aborts.at(-1)?.phase === 'post-commit-refresh',
    'Refresh fault really aborted a native readonly transaction',
  );
  must((await records()).length === 2, 'Replacement retains original and new exact revisions');
  await openHost();
  await index([replacement]);
  must(
    packButton().disabled && packButton().textContent === 'Saved pack',
    'Reload recovers canonical saved status after refresh failure',
  );
  eq(
    (await ctx.store.get(fixture.asset.id, { sha256: fixture.asset.sha256 })).project,
    ctx.prepared.project,
    'Native reload retains exact project',
  );
  eq(
    (await ctx.store.get(fixture.asset.id, { sha256: replacement.sha256 })).project,
    replacementProject,
    'Native reload retains exact replacement project',
  );
  await remove();
  await index([fixture.asset]);
  ctx.n.mode = 'hold';
  click(packButton());
  await until(() => ctx.n.held, 'disposal held stream');
  const oldPanel = panel(),
    oldCancel = cancel();
  await bounded(ctx.app.dispose(), 'pending-download owner disposal');
  must(
    !oldPanel.isConnected && ctx.n.requests.at(-1).aborted,
    'Owner disposal removes UI and aborts fetch',
  );
  oldCancel.click();
  eq(await records(), [], 'Late removed control cannot install a pack');
  eq(ctx.w.fixtureErrors, [], 'No uncaught application errors');
  receipt.network.push(...clone(ctx.n.requests));
  receipt.aborts.push(...clone(ctx.n.aborts));
  must(
    receipt.network.every(
      (x) => x.cache === 'no-store' && x.credentials === 'omit' && x.redirect === 'error',
    ),
    'Every catalogue/pack request uses bounded first-party transport policy',
  );
  ctx.store.close();
  ctx.app = null;
  receipt.status = 'passed';
  receipt.completedAt = new Date().toISOString();
  receipt.limits = fixture.limits;
  render('Passed. Full receipt is retained below.');
}
$('run').onclick = () =>
  execute().catch((error) => {
    receipt ??= { checks: [] };
    receipt.status = 'failed';
    receipt.error = { message: error.message, stack: error.stack };
    if (ctx.n) {
      receipt.network.push(...clone(ctx.n.requests));
      receipt.lastMessage = panel()?.querySelector('[role=status]')?.textContent;
      receipt.errors = clone(ctx.w.fixtureErrors);
    }
    render('Failed: ' + error.message);
  });
