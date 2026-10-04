const $ = (id) => document.getElementById(id);
const frame = $('sim');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = (value) => JSON.parse(JSON.stringify(value));
const stable = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
const digest = async (bytes) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
let receipt = null,
  context = null;
function render(status, message) {
  receipt.status = status;
  receipt.message = message;
  $('status').textContent = message;
  $('receipt').value = JSON.stringify(receipt, null, 2);
  $('download').disabled = false;
}
function must(ok, name, detail = {}) {
  receipt.checks.push({ name, passed: Boolean(ok), ...detail });
  if (!ok) throw new Error(name);
}
const eq = (a, b, name) => must(stable(a) === stable(b), name);
async function bounded(promise, label, ms = 30000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Timeout: ' + label)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function until(predicate, label) {
  const started = performance.now();
  while (!(await predicate())) {
    if (performance.now() - started > 30000) throw new Error('Timeout: ' + label);
    await wait(20);
  }
}
async function fetchBytes(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.arrayBuffer();
}
function centre(gate) {
  return {
    [gate.axis]: gate.at,
    [gate.axis === 'x' ? 'z' : 'x']: (gate.minSide + gate.maxSide) / 2,
    y: (gate.minY + gate.maxY) / 2,
  };
}
function translated(course, index, delta) {
  const result = clone(course),
    gate = result.steps['self-level'][index];
  const side = gate.axis === 'x' ? 'z' : 'x';
  gate.at += delta[gate.axis];
  gate.minSide += delta[side];
  gate.maxSide += delta[side];
  gate.minY += delta.y;
  gate.maxY += delta.y;
  return result;
}
function click(node) {
  if (!node || node.disabled) throw new Error('Missing or disabled public button');
  node.click();
}
function set(node, value) {
  if (!node) throw new Error('Missing public field');
  node.value = String(value);
  node.dispatchEvent(new context.w.Event('change', { bubbles: true }));
}
const q = (selector) => context.d.querySelector(selector);
const course = () => JSON.parse(q('#creator-json').value);
function hostDOMSnapshot(full = false) {
  if (!context?.d) return null;
  const text = q('#creator-json')?.value;
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    value = null;
  }
  return {
    url: context.w.location.href,
    creatorHidden: q('#creator')?.hidden,
    packsHidden: q('#packs')?.hidden,
    studioStatus: q('#studio-status')?.textContent,
    storageStatus: q('#storage-status')?.textContent,
    importReport: q('#import-report')?.textContent,
    creatorJSON: full ? text : undefined,
    creatorIdentity: value
      ? {
          id: value.id,
          revision: value.revision,
          world: value.world?.id,
          selfLevelSteps: value.steps?.['self-level']?.length,
          acroSteps: value.steps?.acro?.length,
        }
      : null,
    uncaughtErrors: [...(context.w.fixtureErrors ?? [])],
    rows: [...context.d.querySelectorAll('[data-pack-id]')].map((row) => ({
      id: row.dataset.packId,
      connected: row.isConnected,
      text: row.textContent,
    })),
  };
}
async function hostNativeRecord(id) {
  const open = context.w.indexedDB.open('revealline-fpv-worlds-v1', 2);
  const db = await bounded(
    new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    }),
    'host realm native IDB probe',
  );
  try {
    const request = db.transaction('projects', 'readonly').objectStore('projects').get(id);
    return await bounded(
      new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
      'host realm native project read',
    );
  } finally {
    db.close();
  }
}
async function upload(blob, name) {
  click(q('[data-tab="packs"]'));
  const input = q('#import-pack'),
    w = context.w,
    transfer = new w.DataTransfer();
  transfer.items.add(new w.File([blob], name, { type: blob.type }));
  input.files = transfer.files;
  input.dispatchEvent(new w.Event('change', { bubbles: true }));
  await until(() => input.value === '', 'public ZIP import and installation');
  click(q('[data-tab="creator"]'));
}
async function exported(id) {
  const count = context.w.fixtureDownloads.length;
  click(q('#' + id));
  await until(() => context.w.fixtureDownloads.length > count, id);
  const file = context.w.fixtureDownloads.at(-1);
  return {
    name: file.name,
    blob: new Blob([await file.blob.arrayBuffer()], { type: file.blob.type }),
  };
}
async function history(id, expected, label) {
  click(q('#' + id));
  await until(() => stable(course()) === stable(expected), label);
  must(true, label);
}
async function zipCheck(expected, sourceProject, label) {
  const file = await exported('export-project');
  const loaded = await context.zip.importEditableZip(file.blob);
  must(loaded.project.courses.length === 1, label + ': one editable course');
  eq(loaded.project.courses[0], expected, label + ': both mode arrays and exact course identity');
  for (const field of ['id', 'revision', 'authoring', 'source', 'provenance'])
    eq(loaded.project[field], sourceProject[field], label + ': ' + field + ' retained');
  const compiled = context.definitions.compileContentProject(loaded.project.definitions);
  eq(
    compiled.map((entry) => entry.course),
    loaded.project.courses,
    label + ': edited definitions compile exactly',
  );
  receipt.exports.push({
    label,
    filename: file.name,
    bytes: file.blob.size,
    sha256: await digest(await file.blob.arrayBuffer()),
  });
  return file;
}
async function packCheck(expected, baseline, label) {
  const file = await exported('export-pack'),
    inspected = await context.content.inspectPack(file.blob);
  eq(inspected.project.courses[0], expected, label + ': pack export exact course');
  q('#studio-status').textContent = '';
  click(q('#install-project'));
  await until(
    async () => (await context.store.get(inspected.project.id))?.sha256 === inspected.sha256,
    label + ': install active hash',
  );
  // Wait for the public install handler to complete its catalogue refresh, not just the transaction.
  await until(
    () => q('#studio-status').textContent.includes('World pack is ready to fly.'),
    label + ': install UI complete',
  );
  const all = (await context.store.list({ includeRevisions: true })).filter(
    (r) => r.id === inspected.project.id,
  );
  must(
    all.some((r) => r.sha256 === inspected.sha256 && r.active),
    label + ': edited revision active',
  );
  must(
    all.some((r) => r.sha256 === baseline.sha256 && !r.active),
    label + ': original revision retained',
  );
  const original = await context.store.get(inspected.project.id, { sha256: baseline.sha256 });
  eq(
    original.project.courses,
    baseline.project.courses,
    label + ': retained original course unchanged',
  );
  receipt.packRevisions.push({
    label,
    id: inspected.project.id,
    original: baseline.sha256,
    edited: inspected.sha256,
    retained: all.length,
  });
  return inspected;
}
async function openHost() {
  if (context.app) {
    context.store?.close();
    context.store = null;
    await bounded(context.app.dispose(), 'dispose before online reopening');
    eq(context.w.fixtureErrors, [], 'Previous host has no uncaught errors');
    context.app = null;
  }
  const token = crypto.randomUUID();
  frame.src = `./host.html?token=${token}#packs`;
  await until(
    () => frame.contentWindow?.fixtureToken === token && frame.contentWindow.fpvWorldStudio,
    'actual automatic host mount',
  );
  context.w = frame.contentWindow;
  context.d = frame.contentDocument;
  context.app = context.w.fpvWorldStudio;
  await bounded(context.app.ready, 'actual host storage hydration');
  await until(() => q('#creator-json').value.trim(), 'initial public draft hydration');
  context.store = await context.storage.openWorldStore({ indexedDB: window.fixtureDB });
  must(q('html').dataset.fpvWorlds === 'true', 'Unmodified automatic mount guard');
}
async function loadInstalled(id, expected) {
  const diagnostic = { id, startedAt: new Date().toISOString(), phases: [] };
  receipt.reopenDiagnostics ??= [];
  receipt.reopenDiagnostics.push(diagnostic);
  const note = (phase) =>
    diagnostic.phases.push({ phase, at: new Date().toISOString(), state: hostDOMSnapshot() });
  note('Before persisted read');
  const persisted = await bounded(context.store.get(id), 'parent native persisted project');
  must(Boolean(persisted?.active), 'Reopened project has an active native revision');
  eq(
    persisted.project.courses[0],
    expected,
    'Reopened native project retains exact edited course before UI action',
  );
  const native = await hostNativeRecord(id);
  diagnostic.nativeRealm = {
    hostObject: Object.getPrototypeOf(native.project.courses[0]) === context.w.Object.prototype,
    hostArray: Object.getPrototypeOf(native.project.courses) === context.w.Array.prototype,
    parentObject: Object.getPrototypeOf(persisted.project.courses[0]) === Object.prototype,
    parentArray: Object.getPrototypeOf(persisted.project.courses) === Array.prototype,
    sha256: native.sha256,
  };
  must(
    Object.entries(diagnostic.nativeRealm)
      .filter(([key]) => key !== 'sha256')
      .every(([, value]) => value),
    'Each native IDB reader returns records in its own window realm',
  );
  eq(native.project.courses[0], expected, 'Host native IDB read retains exact edited course');
  click(q('[data-tab="packs"]'));
  const row = q(`[data-pack-id="${id}"]`);
  must(Boolean(row?.isConnected), 'Reopened installed project has a connected Library row');
  const edit = [...row.querySelectorAll('button')].find((node) => node.textContent === 'Edit');
  diagnostic.target = {
    rowId: row.dataset.packId,
    rowText: row.textContent,
    connected: edit?.isConnected,
    html: edit?.outerHTML,
  };
  must(
    Boolean(edit?.isConnected) && !edit.disabled,
    'Reopened public Edit button is connected and enabled',
  );
  edit.addEventListener(
    'click',
    (event) => {
      diagnostic.click = {
        delivered: true,
        connected: edit.isConnected,
        targetHTML: event.target.outerHTML,
      };
    },
    { once: true, capture: true },
  );
  note('Before public Edit click');
  click(edit);
  must(diagnostic.click?.delivered, 'Public Edit click reached the selected installed row');
  note('Public Edit click delivered');
  try {
    await until(() => stable(course()) === stable(expected), 'public Edit loads exact course JSON');
    note('Exact edited course visible in Challenge JSON');
    await until(() => !q('#creator').hidden, 'public Edit shows Workshop panel');
    note('Workshop panel shown');
  } finally {
    diagnostic.originalRowStillConnected = row.isConnected;
    diagnostic.originalButtonStillConnected = edit.isConnected;
    note('Public Edit wait ended');
  }
  eq(course(), expected, 'Online reopening retains exact edited course');
}
async function stageOne() {
  $('run').disabled = true;
  receipt = {
    format: 'FPVCreatorStarterBrowserQualification.v1',
    startedAt: new Date().toISOString(),
    status: 'running',
    checks: [],
    exports: [],
    packRevisions: [],
    replays: [],
    limitations: [
      'Online native-IDB reopening; no installed-worker or offline claim.',
      'Actual pointer drag required for spatial acceptance.',
      'Explicit Acro spatial mode chooser remains follow-on; current divergent route UI edits Self-level.',
      'No physical-controller, novice or performance acceptance.',
    ],
  };
  render('running', 'Checking frozen admitted assets and all ten starter identities…');
  const manifestBytes = await fetchBytes('./fixture.json'),
    manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  receipt.fixtureSha256 = await digest(manifestBytes);
  receipt.admittedHost = {
    source: manifest.sourceRevision,
    sha256: manifest.hostSha256,
    packageRevision: manifest.packageRevision,
  };
  for (const file of manifest.admittedFiles) {
    const bytes = await fetchBytes('./player/' + file.path);
    must(
      bytes.byteLength === file.bytes && (await digest(bytes)) === file.sha256,
      'Admitted asset checksum: ' + file.path,
    );
  }
  const hostBytes = await fetchBytes('./host.html');
  must((await digest(hostBytes)) === manifest.hostHTMLSha256, 'Instrumented HTML checksum');
  for (const file of manifest.browserSources)
    must(
      (await digest(await fetchBytes('./' + file.path))) === file.sha256,
      'Harness checksum: ' + file.path,
    );
  const qualifierBytes = await fetchBytes('./qualification.json');
  must(
    (await digest(qualifierBytes)) === manifest.qualificationSha256,
    'Exact r5 source qualification',
  );
  const qualification = JSON.parse(new TextDecoder().decode(qualifierBytes));
  const base = './player/optional-practice/civilian-fpv/';
  const [zip, content, definitions, storage, model] = await Promise.all(
    [
      'world-zip.mjs',
      'world-content.mjs',
      'content-definitions.mjs',
      'world-store.mjs',
      'world-model.mjs',
    ].map((name) => import(base + name)),
  );
  const projects = new Map();
  for (const result of qualification.results) {
    const record = result.artifacts.zip,
      bytes = await fetchBytes('./starters/' + record.path);
    must(
      bytes.byteLength === record.bytes && (await digest(bytes)) === record.sha256,
      'Exact r5 editable ZIP: ' + result.id,
    );
    const blob = new Blob([bytes], { type: 'application/zip' });
    const loaded = await zip.importEditableZip(blob);
    must(
      loaded.project.id === result.id && loaded.project.courses.length === 1,
      'Standalone editable identity: ' + result.id,
    );
    const compiled = definitions
      .compileContentProject(loaded.project.definitions)
      .map((entry) => entry.course);
    eq(compiled, loaded.project.courses, 'Actual admitted compiler parity: ' + result.id);
    must(
      stable(compiled[0].steps.acro) !== stable(compiled[0].steps['self-level']),
      'Independent mode routes: ' + result.id,
    );
    projects.set(result.id, { result, project: loaded.project, blob });
  }
  const prefix = 'fpv-creator-editor-' + crypto.randomUUID() + ':',
    names = new Set();
  const memory = new Map([
    [
      'revealline.fpv.world-settings.v1',
      JSON.stringify({
        'world-language': 'en',
        'flight-source': 'keyboard',
        'flight-mode': 'acro',
        'flight-quality': 'low',
        'sim-motion': 'reduced',
      }),
    ],
  ]);
  window.fixtureStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
  };
  window.fixtureDBPrefix = prefix;
  window.fixtureDBNames = names;
  window.fixtureDB = {
    open(name, version) {
      const full = prefix + name;
      names.add(full);
      return version === undefined ? indexedDB.open(full) : indexedDB.open(full, version);
    },
    deleteDatabase: (name) => indexedDB.deleteDatabase(prefix + name),
    cmp: indexedDB.cmp.bind(indexedDB),
  };
  context = { zip, content, definitions, storage, model, projects, names, prefix };
  receipt.storagePrefix = prefix;
  await openHost();
  await model.initWorldRuntime();
  for (const id of ['creator-natural-sweeper', 'creator-industrial-split-level']) {
    render('running', 'Import, edit and retain revisions: ' + id);
    const source = projects.get(id),
      original = source.project.courses[0];
    await upload(source.blob, id + '.zip');
    eq(course(), original, id + ': actual public import keeps exact course');
    must(
      q('#criterion-mode-scope').textContent.includes('Self-level only'),
      id + ': divergent mode scope visible',
    );
    const baseline = await context.store.get(id);
    const index = original.steps['self-level'].findIndex((step) => step.type === 'gate');
    must(index >= 0, id + ': movable gate exists');
    set(q('#criterion-list'), index);
    const before = course(),
      next = translated(before, index, { x: 250, y: 0, z: 0 });
    set(q('#criterion-x'), Number(q('#criterion-x').value) + 0.25);
    click(q('#move-criterion'));
    eq(course(), next, id + ': numeric move changes only selected Self-level gate');
    await history('undo-edit', before, id + ': numeric Undo exact');
    await history('redo-edit', next, id + ': numeric Redo exact');
    const file = await zipCheck(next, source.project, id + ' numeric ZIP');
    const edited = await packCheck(next, baseline, id + ' numeric install');
    await upload(file.blob, file.name);
    eq(course(), next, id + ': public ZIP reimport retains numeric edit');
    must(
      (await context.store.get(id)).sha256 === edited.sha256,
      id + ': reimport preserves active pack hash',
    );
    for (const recorded of source.result.flights) {
      const bytes = await fetchBytes('./starters/' + recorded.proof.path);
      must(
        (await digest(bytes)) === recorded.proof.sha256,
        id + ': exact original ' + recorded.mode + ' proof',
      );
      const proof = JSON.parse(new TextDecoder().decode(bytes));
      const replay = await model.replayWorldFlight(original, proof);
      must(
        replay.state.status === 'complete' &&
          replay.state.contacts === 0 &&
          model.worldStateIdentity(replay.state) === recorded.stateIdentity,
        id + ': original ' + recorded.mode + ' proof completes on admitted engine',
      );
      receipt.replays.push({
        id,
        mode: recorded.mode,
        ticks: replay.state.ticks,
        stateIdentity: recorded.stateIdentity,
      });
      await wait(0);
    }
    source.originalPack = baseline;
    source.edited = next;
  }
  render('running', 'Reopening the actual host against the same isolated native IndexedDB…');
  await openHost();
  const source = projects.get('creator-industrial-split-level');
  await loadInstalled(source.project.id, source.edited);
  const index = source.edited.steps['self-level'].findLastIndex((step) => step.type === 'gate');
  set(q('#criterion-list'), index);
  set(q('#editor-snap'), 0.25);
  context.manual = { source, index, before: course(), pointerEvents: [] };
  const canvas = q('#world-editor-canvas');
  for (const type of ['pointerdown', 'pointermove', 'pointerup'])
    canvas.addEventListener(type, (event) => {
      if (event.isTrusted && context.manual.pointerEvents.length < 500)
        context.manual.pointerEvents.push({
          type,
          x: event.clientX,
          y: event.clientY,
          buttons: event.buttons,
        });
    });
  await until(() => context.app.snapshot().editorPresentation, 'real spatial editor renderer');
  eq(context.w.fixtureErrors, [], 'Actual host has no uncaught errors');
  receipt.nativeDatabases = [...names];
  receipt.manualSelection = {
    project: source.project.id,
    mode: 'self-level',
    index,
    criterion: course().steps['self-level'][index],
  };
  $('spatial').disabled = false;
  render(
    'awaiting-spatial',
    'Stage one passed. In the actual canvas below, drag a translation arrow on the selected upper gate a small distance; then click “Check spatial edit and Undo/Redo”.',
  );
  canvas.scrollIntoView({ block: 'center' });
}
async function stageTwo() {
  $('spatial').disabled = true;
  const { source, index, before, pointerEvents } = context.manual,
    after = course();
  render('running', 'Checking the manual spatial edit and its history…');
  must(
    pointerEvents.some((e) => e.type === 'pointerdown') &&
      pointerEvents.some((e) => e.type === 'pointermove') &&
      pointerEvents.some((e) => e.type === 'pointerup'),
    'Trusted pointer drag reached the real canvas',
  );
  must(stable(after) !== stable(before), 'Manual spatial drag committed a course edit');
  const old = centre(before.steps['self-level'][index]),
    next = centre(after.steps['self-level'][index]);
  const delta = Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis, next[axis] - old[axis]]));
  eq(
    after,
    translated(before, index, delta),
    'Spatial translation changes only selected Self-level gate; Acro and identities unchanged',
  );
  must(
    Object.values(delta).some((v) => v !== 0) &&
      Object.values(delta).every((v) => Number.isSafeInteger(v) && Math.abs(v) <= 5000),
    'Spatial delta is a bounded integer-millimetre edit',
    { delta },
  );
  await history('undo-edit', before, 'Spatial Undo exact');
  await history('redo-edit', after, 'Spatial Redo exact');
  const file = await zipCheck(after, source.project, 'Spatial ZIP');
  const installed = await packCheck(after, source.originalPack, 'Spatial install');
  await upload(file.blob, file.name);
  eq(course(), after, 'Public ZIP reimport retains spatial edit and both routes');
  must(
    (await context.store.get(source.project.id)).sha256 === installed.sha256,
    'Spatial reimport preserves installed exact hash',
  );
  await openHost();
  await loadInstalled(source.project.id, after);
  eq(context.w.fixtureErrors, [], 'Final actual host has no uncaught errors');
  receipt.spatial = { delta, trustedEvents: pointerEvents, finalCourse: after };
  receipt.completedAt = new Date().toISOString();
  context.store.close();
  context.store = null;
  render(
    'passed',
    `PASS ${receipt.checks.length}/${receipt.checks.length}. Two actual editor workflows, four admitted-engine replays, trusted spatial drag and online native-IDB reopening. Offline and explicit mode selection remain open.`,
  );
}
const fail = (error) => {
  receipt.error = error.stack ?? String(error);
  receipt.failureDOM = hostDOMSnapshot(true);
  render('failed', 'FAIL: ' + error.message + '. Preserve this receipt and fixture.');
};
$('run').addEventListener('click', () => stageOne().catch(fail));
$('spatial').addEventListener('click', () => stageTwo().catch(fail));
$('download').addEventListener('click', () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(receipt, null, 2) + '\n'], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'creator-starters-browser-receipt.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
});
