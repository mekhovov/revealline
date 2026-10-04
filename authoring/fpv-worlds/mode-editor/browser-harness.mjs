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
function translated(course, index, delta, modes = ['acro']) {
  const result = clone(course);
  for (const mode of modes) {
    const gate = result.steps[mode][index],
      side = gate.axis === 'x' ? 'z' : 'x';
    gate.at += delta[gate.axis];
    gate.minSide += delta[side];
    gate.maxSide += delta[side];
    gate.minY += delta.y;
    gate.maxY += delta.y;
  }
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
    routeMode: q('#editor-route-mode')?.value,
    selectedCriterion: q('#criterion-list')?.value,
    flightState: context.app?.snapshot().state,
    flightStatus: q('#flight-status')?.textContent,
    openDialogs: [...context.d.querySelectorAll('dialog[open]')].map((node) => ({
      id: node.id,
      text: node.textContent,
    })),
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
    const label = q('#editor-route-mode').parentNode;
    context.store?.close();
    context.store = null;
    await bounded(context.app.dispose(), 'dispose before online reopening');
    must(
      label.parentNode === null && !q('#editor-route-mode'),
      'Previous host disposal removes owned route-mode control',
    );
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
async function projectExport() {
  const file = await exported('export-project');
  return { ...file, ...(await context.zip.importEditableZip(file.blob)) };
}
function mode(value) {
  set(q('#editor-route-mode'), value);
}
function selection(index) {
  set(q('#criterion-list'), index);
}
function numeric(dx = 0.25) {
  set(q('#criterion-x'), Number(q('#criterion-x').value) + dx);
  click(q('#move-criterion'));
}
async function previewCheck(buttonId) {
  set(q('#flight-mode'), 'self-level');
  click(q('#' + buttonId));
  await until(
    () => q('#flight-dialog').open && context.app.snapshot().state,
    buttonId + ' opens flight',
  );
  await until(
    () => q('#flight-status').textContent.includes('Ready. Choose your controls'),
    buttonId + ' preview ready',
  );
  must(
    q('#flight-mode').value === 'acro',
    buttonId + ': explicit Acro overrides previous flight setting',
  );
  must(
    context.app.snapshot().state.status === 'disarmed' && context.app.snapshot().state.ticks === 0,
    buttonId + ': preview starts disarmed',
  );
  click(q('#world-flight-menu'));
  const home = q('#worlds-shell-home-dialog');
  must(home?.open, buttonId + ': actual shell Home menu opens');
  must(
    context.app.snapshot().state.status !== 'active' && context.app.snapshot().state.ticks === 0,
    buttonId + ': menu pauses without arming',
  );
  must(
    q('#flight-status').textContent.includes('Paused. Arm deliberately'),
    buttonId + ': public pause guidance is shown',
  );
  // Dispatch the normal native-dialog cancellation path; never activate Continue/Resume.
  home.dispatchEvent(new context.w.Event('cancel', { cancelable: true }));
  must(!home.open, buttonId + ': native Home cancel returns to preview');
  must(
    context.app.snapshot().state.status !== 'active' && context.app.snapshot().state.ticks === 0,
    buttonId + ': dismissing Home does not resume or arm',
  );
  click(q('#leave-flight'));
  await until(() => !q('#flight-dialog').open, buttonId + ' normal close');
  click(q('[data-tab="creator"]'));
  must(q('#editor-route-mode').value === 'acro', buttonId + ': selected editor mode retained');
}
async function stageOne() {
  $('run').disabled = true;
  receipt = {
    format: 'FPVEditorModesSourceOverlayQualification.v1',
    startedAt: new Date().toISOString(),
    status: 'running',
    checks: [],
    exports: [],
    packRevisions: [],
    limitations: [
      'Source overlay over the full admitted closure; not package admission.',
      'Trusted pointer drag required for spatial acceptance.',
      'Online native-IDB reopening only; no offline, controller, novice or performance acceptance.',
    ],
  };
  render(
    'running',
    'Checking frozen baseline assets, exact source overlay and authored public inputs…',
  );
  const manifestBytes = await fetchBytes('./fixture.json'),
    manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  receipt.fixtureSha256 = await digest(manifestBytes);
  receipt.baseline = {
    source: manifest.sourceRevision,
    host: manifest.hostSha256,
    packageRevision: manifest.packageRevision,
  };
  receipt.overlay = manifest.overlay;
  for (const file of manifest.admittedFiles) {
    const expected = file.path === manifest.overlay.path ? manifest.overlay : file,
      bytes = await fetchBytes('./player/' + file.path);
    must(
      bytes.byteLength === expected.bytes && (await digest(bytes)) === expected.sha256,
      (file.path === manifest.overlay.path
        ? 'Source overlay checksum: '
        : 'Baseline admitted checksum: ') + file.path,
    );
  }
  must(
    (await digest(await fetchBytes('./host.html'))) === manifest.hostHTMLSha256,
    'Instrumented HTML checksum',
  );
  for (const file of manifest.browserSources)
    must(
      (await digest(await fetchBytes('./' + file.path))) === file.sha256,
      'Harness checksum: ' + file.path,
    );
  const inputs = new Map();
  for (const file of manifest.inputs) {
    const bytes = await fetchBytes('./' + file.path);
    must(
      bytes.byteLength === file.bytes && (await digest(bytes)) === file.sha256,
      'Public input checksum: ' + file.path,
    );
    inputs.set(file.path.split('/').at(-1), new Blob([bytes]));
  }
  const base = './player/optional-practice/civilian-fpv/';
  const [zip, content, definitions, storage] = await Promise.all(
    ['world-zip.mjs', 'world-content.mjs', 'content-definitions.mjs', 'world-store.mjs'].map(
      (name) => import(base + name),
    ),
  );
  const prefix = 'fpv-editor-modes-' + crypto.randomUUID() + ':',
    names = new Set(),
    memory = new Map([
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
  context = { zip, content, definitions, storage, names, prefix, inputs };
  receipt.storagePrefix = prefix;
  await openHost();
  const source = await zip.importEditableZip(inputs.get('divergent.zip')),
    original = source.project.courses[0];
  await upload(inputs.get('divergent.zip'), 'divergent.zip');
  eq(course(), original, 'Divergent starter imported exactly');
  const baseline = await context.store.get(source.project.id);
  must(
    q('#editor-route-mode').value === 'self-level' && q('#editor-route-mode').options[0].disabled,
    'Divergent routes default to Self-level and disable Both',
  );
  // Public JSON supplies a deliberately different Acro order and length.
  const divergent = clone(original);
  divergent.steps.acro.splice(1, 1);
  [divergent.steps.acro[1], divergent.steps.acro[2]] = [
    divergent.steps.acro[2],
    divergent.steps.acro[1],
  ];
  q('#creator-json').value = JSON.stringify(divergent);
  click(q('#apply-json'));
  eq(course(), divergent, 'Public JSON accepted independently ordered, unequal-length routes');
  mode('acro');
  selection(1);
  must(
    q('#criterion-list').options.length === divergent.steps.acro.length,
    'Criterion list follows shorter Acro route',
  );
  const moved = translated(divergent, 1, { x: 250, y: 0, z: 0 }, ['acro']);
  numeric();
  eq(course(), moved, 'Numeric move changes only selected Acro criterion');
  mode('self-level');
  selection(0);
  await history('undo-edit', divergent, 'Undo restores exact pre-Acro-edit course');
  must(
    q('#editor-route-mode').value === 'acro' && q('#criterion-list').value === '1',
    'Undo restores captured Acro mode and selection',
  );
  await history('redo-edit', moved, 'Redo restores exact edited course');
  must(
    q('#editor-route-mode').value === 'self-level' && q('#criterion-list').value === '0',
    'Redo restores context captured by Undo',
  );
  mode('acro');
  selection(1);
  let before = course(),
    next = clone(before);
  [next.steps.acro[1], next.steps.acro[2]] = [next.steps.acro[2], next.steps.acro[1]];
  click(q('#criterion-down'));
  eq(course(), next, 'Reorder changes only Acro despite differing Self-level order');
  must(q('#criterion-list').value === '2', 'Reorder selects moved Acro objective');
  await history('undo-edit', before, 'Reorder Undo exact');
  await history('redo-edit', next, 'Reorder Redo exact');
  before = course();
  next = clone(before);
  next.steps.acro.splice(3, 0, clone(next.steps.acro[2]));
  click(q('#duplicate-criterion'));
  eq(course(), next, 'Duplicate adds exactly one selected Acro criterion');
  must(q('#criterion-list').value === '3', 'Duplicate selects new Acro criterion');
  await history('undo-edit', before, 'Duplicate Undo exact');
  await history('redo-edit', next, 'Duplicate Redo exact');
  before = course();
  next = clone(before);
  next.steps.acro.splice(3, 1);
  click(q('#remove-criterion'));
  eq(course(), next, 'Delete removes only selected Acro criterion');
  await history('undo-edit', before, 'Delete Undo exact');
  await history('redo-edit', next, 'Delete Redo exact');
  context.divergent = { source, baseline, edited: next };
  await zipCheck(next, source.project, 'Acro order/edit ZIP');
  await packCheck(next, baseline, 'Acro order/edit install');
  await previewCheck('preview-challenge');
  await previewCheck('preview-world');
  frame.style.width = '390px';
  await wait(80);
  set(q('#world-language'), 'uk');
  must(
    q('#editor-route-mode').previousElementSibling.textContent === 'Режим маршруту',
    'Ukrainian route-mode label',
  );
  eq(
    [...q('#editor-route-mode').options].map((o) => o.textContent),
    ['Обидва однакові режими', 'Самовирівнювання', 'Acro'],
    'Ukrainian mode choices',
  );
  must(
    q('#criterion-mode-scope').textContent.includes('лише Acro'),
    'Ukrainian Acro-only ownership guidance',
  );
  const rect = q('#editor-route-mode').getBoundingClientRect();
  must(
    rect.width > 0 && rect.left >= 0 && rect.right <= context.w.innerWidth,
    'Mode selector fits 390px viewport',
  );
  click(q('[data-tab="packs"]'));
  must(!q('#packs').hidden, 'Mobile Library menu works');
  click(q('[data-tab="creator"]'));
  must(
    !q('#creator').hidden && q('#editor-route-mode').value === 'acro',
    'Mobile Workshop return retains mode',
  );
  set(q('#world-language'), 'en');
  frame.style.width = '1280px';
  await wait(80);
  must(
    q('#editor-route-mode').previousElementSibling.textContent === 'Route mode',
    'English route-mode label restored',
  );
  for (const mismatch of [false, true]) {
    const id = mismatch ? 'mode-bindings-differ' : 'mode-bindings-shared';
    render('running', 'Public source-project ownership checks: ' + id);
    const input = inputs.get(id + '.zip'),
      loaded = await zip.importEditableZip(input);
    await upload(input, id + '.zip');
    const initial = course();
    must(
      q('#editor-route-mode').value === 'both' && !q('#editor-route-mode').options[0].disabled,
      id + ': matching routes expose Both',
    );
    selection(0);
    numeric();
    eq(
      course(),
      translated(initial, 0, { x: 250, y: 0, z: 0 }, ['self-level', 'acro']),
      id + ': Both translates each mode exactly once',
    );
    const changed = await projectExport();
    if (mismatch) {
      must(
        loaded.project.routeBindings[initial.id]['self-level'][0] !==
          loaded.project.routeBindings[initial.id].acro[0],
        'Equal source steps have different binding IDs',
      );
      eq(
        changed.project.overrides,
        loaded.project.overrides,
        'Different binding IDs preserve shared overrides',
      );
    } else {
      eq(
        changed.project.overrides,
        { gate: { position: { x: 0.25, y: 4, z: 0 } } },
        'Shared Both edit writes one anchor delta exactly once',
      );
      await history('undo-edit', initial, 'Shared Both Undo restores course');
      eq(
        (await projectExport()).project.overrides,
        {},
        'Shared Both Undo restores source override ownership',
      );
      mode('acro');
      selection(0);
      numeric();
      const local = course();
      eq(
        (await projectExport()).project.overrides,
        {},
        'Single-mode source edit leaves global anchor overrides unchanged',
      );
      const inputNode = q('#import-world'),
        transfer = new context.w.DataTransfer();
      transfer.items.add(
        new context.w.File([inputs.get('source-updated.glb')], 'source-updated.glb'),
      );
      inputNode.files = transfer.files;
      inputNode.dispatchEvent(new context.w.Event('change', { bubbles: true }));
      await until(() => q('#reimport-review')?.open, 'Public external-source reimport review');
      must(
        q('#reimport-review').textContent.includes('local'),
        'Reimport reports local ownership conflict',
      );
      click(
        [...q('#reimport-review').querySelectorAll('button')].find(
          (n) => n.textContent === 'Apply reviewed update',
        ),
      );
      await until(
        () => inputNode.value === '' && !q('#reimport-review'),
        'Reviewed source reimport completes',
      );
      const expected = translated(local, 0, { x: 500, y: 0, z: 0 }, ['self-level']);
      eq(
        course(),
        expected,
        'External reimport updates untouched Self-level and retains local Acro position',
      );
      must(
        q('#editor-route-mode').value === 'acro',
        'Reviewed source update retains explicit editor mode',
      );
      const merged = await projectExport();
      eq(merged.project.overrides, {}, 'Reimport preserves single-mode local ownership');
      must(
        merged.project.source.anchors.find((a) => a.id === 'gate').position.x === 0.5,
        'Reimport records changed source anchor',
      );
    }
  }
  await openHost();
  await loadInstalled(source.project.id, context.divergent.edited);
  mode('acro');
  const index = course().steps.acro.findIndex((step) => step.type === 'gate' && step.minY >= 6500);
  selection(index);
  set(q('#editor-snap'), 0.25);
  context.manual = { source, baseline, index, before: course(), pointerEvents: [] };
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
  await until(() => context.app.snapshot().editorPresentation, 'Real Acro spatial renderer');
  eq(context.w.fixtureErrors, [], 'Stage one host has no uncaught errors');
  receipt.nativeDatabases = [...names];
  receipt.manualSelection = {
    project: source.project.id,
    mode: 'acro',
    index,
    criterion: course().steps.acro[index],
  };
  $('spatial').disabled = false;
  render(
    'awaiting-spatial',
    'Stage one passed. Drag the selected Acro upper gate translation arrow a small distance in the real canvas, then click Check spatial edit and Undo/Redo.',
  );
  canvas.scrollIntoView({ block: 'center' });
}
async function stageTwo() {
  $('spatial').disabled = true;
  const { source, baseline, index, before, pointerEvents } = context.manual,
    after = course();
  render(
    'running',
    'Checking actual Acro gizmo edit, history, native reopening and owned cleanup…',
  );
  must(
    ['pointerdown', 'pointermove', 'pointerup'].every((type) =>
      pointerEvents.some((e) => e.type === type),
    ),
    'Trusted pointer drag reached real canvas',
  );
  must(stable(after) !== stable(before), 'Manual Acro drag committed an edit');
  const old = centre(before.steps.acro[index]),
    next = centre(after.steps.acro[index]),
    delta = Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis, next[axis] - old[axis]]));
  eq(
    after,
    translated(before, index, delta, ['acro']),
    'Spatial translation changes only selected Acro gate; Self-level and identities unchanged',
  );
  must(
    Object.values(delta).some((v) => v !== 0) &&
      Object.values(delta).every((v) => Number.isSafeInteger(v) && Math.abs(v) <= 5000),
    'Bounded integer-millimetre spatial delta',
    { delta },
  );
  await history('undo-edit', before, 'Spatial Undo exact');
  must(
    q('#editor-route-mode').value === 'acro' && q('#criterion-list').value === String(index),
    'Spatial Undo restores Acro and selection',
  );
  await history('redo-edit', after, 'Spatial Redo exact');
  const file = await zipCheck(after, source.project, 'Acro spatial ZIP'),
    installed = await packCheck(after, baseline, 'Acro spatial install');
  await upload(file.blob, file.name);
  eq(course(), after, 'Public ZIP reimport retains both independent routes');
  must(
    (await context.store.get(source.project.id)).sha256 === installed.sha256,
    'ZIP reimport preserves installed exact hash',
  );
  await openHost();
  await loadInstalled(source.project.id, after);
  mode('acro');
  selection(index);
  eq(course(), after, 'Explicit Acro selection after native reopening retains content');
  eq(context.w.fixtureErrors, [], 'Final host has no uncaught errors');
  receipt.spatial = { delta, trustedEvents: pointerEvents, finalCourse: after };
  const label = q('#editor-route-mode').parentNode,
    select = q('#editor-route-mode');
  context.store.close();
  context.store = null;
  await bounded(context.app.dispose(), 'Final owned route-mode disposal');
  context.app = null;
  must(
    label.parentNode === null && !select.isConnected && !q('#editor-route-mode'),
    'Disposal removes the captured owned route-mode label and select',
  );
  eq(context.w.fixtureErrors, [], 'Disposal has no uncaught errors');
  receipt.completedAt = new Date().toISOString();
  render(
    'passed',
    `PASS ${receipt.checks.length}/${receipt.checks.length}. Explicit mode edits, source ownership/reimport, EN/UK/mobile, unarmed previews, trusted gizmo, native reopen and owned cleanup. Source overlay only; package admission remains separate.`,
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
  anchor.download = 'editor-modes-browser-receipt.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
});
