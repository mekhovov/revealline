const $ = (id) => document.getElementById(id),
  frame = $('sim'),
  pause = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));
const stable = (v) =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );
const digest = async (b) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
let receipt,
  ctx = {};
const q = (s) => ctx.d.querySelector(s),
  course = () => JSON.parse(q('#creator-json').value);
function render(message) {
  $('status').textContent = message;
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
function must(ok, name, detail = {}) {
  receipt.checks.push({ name, passed: !!ok, ...detail });
  if (!ok) throw Error(name);
}
const eq = (a, b, name) => must(stable(a) === stable(b), name);
async function until(fn, name) {
  const start = performance.now();
  while (!(await fn())) {
    if (performance.now() - start > 30000) throw Error('Timeout: ' + name);
    await pause(20);
  }
}
async function bounded(p, name) {
  let timer;
  try {
    return await Promise.race([
      p,
      new Promise(
        (_, reject) => (timer = setTimeout(() => reject(Error('Timeout: ' + name)), 30000)),
      ),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function fetchBytes(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw Error('HTTP ' + r.status + ': ' + url);
  return r.arrayBuffer();
}
function click(n) {
  if (!n || n.disabled) throw Error('Missing/disabled public button');
  n.click();
}
function set(n, v) {
  n.value = String(v);
  n.dispatchEvent(new ctx.w.Event('change', { bubbles: true }));
}
function input(n, v) {
  n.value = String(v);
  n.dispatchEvent(new ctx.w.Event('input', { bubbles: true }));
}
const button = (parent, text) =>
  [...parent.querySelectorAll('button')].find((x) => x.textContent === text);
async function openHost() {
  if (ctx.app) {
    const row = q('#editor-project-course-row');
    ctx.store?.close();
    await bounded(ctx.app.dispose(), 'old host disposal');
    must(!row.isConnected, 'Owned picker removed before reopen');
    eq(ctx.w.fixtureErrors, [], 'Old host has no uncaught errors');
  }
  const token = crypto.randomUUID();
  frame.src = './host.html?token=' + token + '#packs';
  await until(
    () => frame.contentWindow?.fixtureToken === token && frame.contentWindow.fpvWorldStudio,
    'actual automatic host',
  );
  ctx.w = frame.contentWindow;
  ctx.d = frame.contentDocument;
  ctx.app = ctx.w.fpvWorldStudio;
  await bounded(ctx.app.ready, 'native hydration');
  await until(() => q('#creator-json')?.value, 'initial creator');
  ctx.store = await ctx.storage.openWorldStore({ indexedDB: window.fixtureDB });
}
async function upload(blob, name) {
  click(q('[data-tab="packs"]'));
  const n = q('#import-pack'),
    t = new ctx.w.DataTransfer();
  t.items.add(new ctx.w.File([blob], name));
  n.files = t.files;
  n.dispatchEvent(new ctx.w.Event('change', { bubbles: true }));
  await until(() => n.value === '', 'editable import/install');
  click(q('[data-tab="creator"]'));
}
async function exported(id) {
  const n = ctx.w.fixtureDownloads.length;
  click(q('#' + id));
  await until(() => ctx.w.fixtureDownloads.length > n, id);
  const x = ctx.w.fixtureDownloads.at(-1);
  return { name: x.name, blob: new Blob([await x.blob.arrayBuffer()]) };
}
async function project() {
  const x = await exported('export-project');
  const value = { ...x, ...(await ctx.zip.importEditableZip(x.blob)) };
  await assetsExact(value, 'Editable export');
  return value;
}
async function assetsExact(value, name) {
  const actual = value.assets.get(value.project.world.modelAsset),
    expected = ctx.inputs.get(ctx.assetExpected);
  eq([...value.assets.keys()], [value.project.world.modelAsset], name + ' exact asset closure');
  must(
    actual.size === expected.size &&
      (await digest(await actual.arrayBuffer())) === (await digest(await expected.arrayBuffer())),
    name + ' exact expected model bytes',
  );
}
function select(id) {
  set(q('#editor-project-course'), id);
  must(course().id === id, 'Selected course ' + id);
}
function mode(value) {
  set(q('#editor-route-mode'), value);
}
function numeric(dx = 0.25) {
  input(q('#criterion-x'), Number(q('#criterion-x').value) + dx);
  click(q('#move-criterion'));
}
function translate(c, dx, modes) {
  const out = clone(c);
  for (const m of modes) {
    const x = out.steps[m][0];
    if (x.axis === 'x') x.at += dx;
    else {
      x.minSide += dx;
      x.maxSide += dx;
    }
  }
  return out;
}
async function preview(id, expected) {
  set(q('#flight-mode'), 'self-level');
  click(q('#' + id));
  await until(
    () =>
      q('#flight-dialog').open &&
      q('#flight-status').textContent.includes('Ready. Choose your controls'),
    'selected preview ready',
  );
  const s = ctx.app.snapshot();
  must(s.course === expected.id, id + ' uses selected non-first course');
  must(q('#flight-mode').value === 'acro', id + ' uses explicit Acro');
  eq(s.state.position, expected.spawn, id + ' exact selected spawn');
  must(s.state.ticks === 0 && s.state.status === 'disarmed', id + ' starts disarmed');
  click(q('#world-flight-menu'));
  const menu = q('#worlds-shell-home-dialog');
  must(menu.open, id + ' opens native pause menu');
  menu.dispatchEvent(new ctx.w.Event('cancel', { cancelable: true }));
  click(q('#leave-flight'));
  await until(() => !q('#flight-dialog').open, id + ' closes normally');
  click(q('[data-tab="creator"]'));
  must(
    course().id === expected.id && q('#editor-route-mode').value === 'acro',
    id + ' retains editor selection/mode',
  );
}
async function reimport(apply) {
  const n = q('#import-world'),
    t = new ctx.w.DataTransfer();
  t.items.add(new ctx.w.File([ctx.inputs.get('source-updated.glb')], 'source-updated.glb'));
  n.files = t.files;
  n.dispatchEvent(new ctx.w.Event('change', { bubbles: true }));
  await until(() => q('#reimport-review')?.open, 'native reimport review');
  click(button(q('#reimport-review'), apply ? 'Apply reviewed update' : 'Keep current draft'));
  await until(() => n.value === '' && !q('#reimport-review'), 'reimport settled');
}
async function execute() {
  $('run').disabled = true;
  receipt = {
    format: 'FPVProjectCourseEditorBrowser.v1',
    status: 'running',
    checks: [],
    startedAt: new Date().toISOString(),
    limits: [
      'Public form/file inputs, actual renderer and native isolated IndexedDB.',
      'No ordinary-control completion of edited routes, offline, physical-device or FPS qualification.',
    ],
  };
  render('Verifying frozen closure…');
  const manifest = JSON.parse(new TextDecoder().decode(await fetchBytes('./fixture.json')));
  receipt.fixture = manifest;
  for (const file of manifest.files) {
    const expected = manifest.overlays.find((x) => x.path === file.path) ?? file,
      b = await fetchBytes('./player/' + file.path);
    must(
      b.byteLength === expected.bytes && (await digest(b)) === expected.sha256,
      'Member ' + file.path,
    );
  }
  for (const file of manifest.browserSources)
    must(
      (await digest(await fetchBytes('./' + file.path))) === file.sha256,
      'Harness ' + file.path,
    );
  const inputs = new Map();
  for (const file of manifest.inputs) {
    const b = await fetchBytes('./' + file.path);
    must(b.byteLength === file.bytes && (await digest(b)) === file.sha256, 'Input ' + file.path);
    inputs.set(file.path.split('/').at(-1), new Blob([b]));
  }
  const [zip, content, storage] = await Promise.all(
    ['world-zip.mjs', 'world-content.mjs', 'world-store.mjs'].map(
      (x) => import('./player/optional-practice/civilian-fpv/' + x),
    ),
  );
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
  window.fixturePrefix = 'fpv-course-picker-' + crypto.randomUUID() + ':';
  window.fixtureDatabases = new Set();
  window.fixtureDB = {
    open(name, version) {
      const full = fixturePrefix + name;
      fixtureDatabases.add(full);
      return version === undefined ? indexedDB.open(full) : indexedDB.open(full, version);
    },
    deleteDatabase: (name) => indexedDB.deleteDatabase(fixturePrefix + name),
    cmp: indexedDB.cmp.bind(indexedDB),
  };
  ctx = { zip, content, storage, inputs, assetExpected: 'expected-original-model.glb' };
  await openHost();
  const original = (await zip.importEditableZip(inputs.get('eight-courses.zip'))).project;
  await upload(inputs.get('eight-courses.zip'), 'eight-courses.zip');
  const baseline = await ctx.store.get(original.id);
  must(q('#editor-project-course').options.length === 8, 'All eight project courses available');
  must(original.id !== original.world.id, 'Fixture covers distinct project/world identities');
  for (const c of original.courses) {
    select(c.id);
    eq(course(), c, 'Exact initial course ' + c.id);
    must(
      q('#undo-edit').disabled && q('#redo-edit').disabled,
      'Selection starts empty history ' + c.id,
    );
  }
  eq(
    (await project()).project,
    original,
    'Selection alone preserves full project/title/order/definitions',
  );
  select('picker-1');
  const json = q('#creator-json'),
    raw = json.value + ' invalid';
  input(json, raw);
  set(q('#editor-project-course'), 'picker-2');
  must(
    q('#editor-project-course').value === 'picker-1' && json.value === raw,
    'Invalid pending JSON refuses switch without loss',
  );
  click(q('#editor-reset-fields'));
  eq(course(), original.courses[0], 'Reset unapplied JSON retains course');
  const x = q('#criterion-x');
  input(x, Number(x.value) + 0.25);
  const rawX = x.value;
  set(q('#editor-project-course'), 'picker-2');
  must(
    q('#editor-project-course').value === 'picker-1' && x.value === rawX,
    'Pending position refuses switch without loss',
  );
  click(q('#editor-reset-fields'));
  const role = q('[data-actor-role]'),
    nextRole = role.value === 'civilian' ? 'rival' : 'civilian';
  set(role, nextRole);
  set(q('#editor-project-course'), 'picker-2');
  must(
    q('#editor-project-course').value === 'picker-1' && role.value === nextRole,
    'Pending actor role refuses switch',
  );
  click(q('#editor-reset-fields'));
  const subject = q('[data-tracking-subject]');
  set(subject, subject.options[1].value);
  set(q('#editor-project-course'), 'picker-2');
  must(q('#editor-project-course').value === 'picker-1', 'Pending tracking subject refuses switch');
  click(q('#editor-reset-fields'));
  set(q('#world-actor-editor select[aria-label="New actor type"]'), 'patrol');
  set(q('#world-actor-editor select[aria-label="Objective modes"]'), 'acro');
  set(q('[data-tracking-modes]'), 'acro');
  const cast = q('select[aria-label="Shared character cast"]');
  must(!!cast, 'Contact actor shared cast control present');
  set(cast, cast.options[1].value);
  select('picker-2');
  must(
    q('#world-actor-editor select[aria-label="Selected actor"]').value === 'shared-b',
    'Target first actor chosen despite shared reordered IDs',
  );
  select('picker-1');
  mode('both');
  numeric();
  const a = course();
  eq(a, translate(original.courses[0], 250, ['self-level', 'acro']), 'Applied Both edit is exact');
  select('picker-2');
  mode('acro');
  numeric();
  const b = course();
  eq(b, translate(original.courses[1], 250, ['acro']), 'Applied B Acro edit is exact');
  select('picker-1');
  eq(course(), a, 'Applied A retained after B edit');
  must(q('#editor-route-mode').value === 'both', 'A remembers Both scope');
  select('picker-2');
  eq(course(), b, 'Applied B retained after A visit');
  must(q('#editor-route-mode').value === 'acro', 'B remembers Acro scope');
  numeric();
  click(q('#undo-edit'));
  eq(course(), b, 'New B Undo owns only current history');
  const edited = await project();
  must(edited.project.title === original.title, 'Project title retained');
  eq(
    edited.project.courses.map((c) => c.id),
    original.courses.map((c) => c.id),
    'Project order retained',
  );
  eq(
    edited.project.courses,
    [a, b, ...original.courses.slice(2)],
    'All eight edited/untouched courses exact',
  );
  eq(edited.project.routeBindings, original.routeBindings, 'Per-course route bindings retained');
  eq(edited.project.spawnBindings, original.spawnBindings, 'Per-course spawn bindings retained');
  eq(edited.project.playlists, original.playlists, 'Project playlist order retained');
  const overrides = { ['gate-1']: { position: { x: -10.25, y: 4, z: 0 } } };
  eq(edited.project.overrides, overrides, 'B local edit/Undo preserves A shared source override');
  for (const k of ['source', 'provenance', 'world', 'id'])
    eq(edited.project[k], original[k], 'Full project retains ' + k);
  await preview('preview-challenge', b);
  await preview('preview-world', b);
  const exportedPack = await exported('export-pack'),
    inspected = await content.inspectPack(exportedPack.blob);
  await assetsExact(inspected, 'Playable export');
  eq(
    inspected.project.courses,
    edited.project.courses,
    'Full pack retains all eight courses/sixteen mode arrays',
  );
  click(q('#install-project'));
  await until(
    () => q('#studio-status').textContent.includes('World pack is ready to fly.'),
    'edited install',
  );
  await until(
    async () => (await ctx.store.get(original.id)).sha256 === inspected.sha256,
    'exact edited installed revision',
  );
  const retained = await ctx.store.get(original.id, { sha256: baseline.sha256 });
  eq(retained.project.courses, original.courses, 'Original installed revision retained');
  await upload(edited.blob, edited.name);
  eq((await project()).project, edited.project, 'Full edited ZIP reimport exact');
  await openHost();
  click(q('[data-tab="packs"]'));
  click(button(q('[data-pack-id="' + original.id + '"]'), 'Edit'));
  await until(
    () => !q('#creator').hidden && q('#editor-project-course').options.length === 8,
    'native reopening',
  );
  eq((await project()).project, edited.project, 'Native reopening keeps whole edited project');
  select('picker-2');
  mode('acro');
  await reimport(false);
  eq((await project()).project, edited.project, 'Cancelled source reimport retains exact draft');
  await reimport(true);
  ctx.assetExpected = 'expected-updated-model.glb';
  must(
    course().id === 'picker-2' && q('#editor-route-mode').value === 'acro',
    'Accepted source reimport retains active course and mode',
  );
  const updated = await project();
  const expectedCourses = edited.project.courses.map((c, i) =>
    i === 0 ? c : translate(c, 500, i === 1 ? ['self-level'] : ['self-level', 'acro']),
  );
  eq(
    updated.project.courses,
    expectedCourses,
    'All eight reimported courses exact:16 arrays, IDs, order, spawn and world',
  );
  for (const key of ['id', 'title', 'playlists', 'spawnBindings'])
    eq(updated.project[key], edited.project[key], 'Reimport keeps project ' + key);
  const modelHash = await digest(await inputs.get('expected-updated-model.glb').arrayBuffer());
  must(
    updated.project.world.sourceHash === modelHash && updated.project.source.hash === modelHash,
    'Reimport source identities match exact updated model',
  );
  must(updated.project.courses.length === 8, 'Source reimport retains all courses');
  eq(updated.project.overrides, overrides, 'Source reimport retains shared override');
  eq(course().steps.acro, b.steps.acro, 'Source reimport retains locally edited Acro');
  eq(
    updated.project.routeBindings,
    original.routeBindings,
    'Source reimport retains every route binding',
  );
  must(
    q('#undo-edit').disabled && q('#redo-edit').disabled,
    'Source replacement resets stale history',
  );
  set(q('#world-language'), 'uk');
  must(
    q('#editor-project-course').previousElementSibling.textContent === 'Завдання проєкту',
    'Ukrainian picker label',
  );
  set(q('#world-language'), 'en');
  frame.style.width = '390px';
  await pause(100);
  must(
    q('#editor-project-course').getBoundingClientRect().width <= 390,
    'Picker fits narrow viewport',
  );
  frame.style.width = '1280px';
  eq(ctx.w.fixtureErrors, [], 'Host has no uncaught errors');
  receipt.exportedProject = updated.project;
  receipt.revisions = { original: baseline.sha256, edited: inspected.sha256 };
  select('picker-1');
  select('picker-2');
  mode('acro');
  set(q('#criterion-list'), 0);
  set(q('#editor-snap'), 0.25);
  const canvas = q('#world-editor-canvas'),
    pointerEvents = [];
  for (const type of ['pointerdown', 'pointermove', 'pointerup'])
    canvas.addEventListener(type, (event) => {
      if (event.isTrusted && pointerEvents.length < 128)
        pointerEvents.push({ type, x: event.clientX, y: event.clientY, buttons: event.buttons });
    });
  await until(() => ctx.app.snapshot().editorPresentation, 'Selected course actual spatial editor');
  ctx.manual = { before: course(), project: updated.project, pointerEvents };
  receipt.manualSelection = {
    course: course().id,
    mode: 'acro',
    index: 0,
    criterion: course().steps.acro[0],
  };
  receipt.status = 'awaiting-spatial';
  $('spatial').disabled = false;
  render(
    'Stage one passed. In the real canvas, drag one translation arrow of the selected Challenge 2 Acro gate a small distance (under 5m), then click Continue: check selected-course spatial edit. Leave course, mode and other controls unchanged.',
  );
  canvas.scrollIntoView({ block: 'center' });
}
async function spatial() {
  $('spatial').disabled = true;
  receipt.status = 'running';
  render('Checking trusted selected-course gizmo edit and whole-project ownership…');
  const { before, project: prior, pointerEvents } = ctx.manual,
    after = course();
  must(
    ['pointerdown', 'pointermove', 'pointerup'].every((type) =>
      pointerEvents.some((e) => e.type === type),
    ),
    'Trusted drag reached actual selected-course canvas',
  );
  const centre = (s) => ({
    x: s.axis === 'x' ? s.at : (s.minSide + s.maxSide) / 2,
    y: (s.minY + s.maxY) / 2,
    z: s.axis === 'z' ? s.at : (s.minSide + s.maxSide) / 2,
  });
  const a = centre(before.steps.acro[0]),
    b = centre(after.steps.acro[0]),
    delta = Object.fromEntries(['x', 'y', 'z'].map((k) => [k, b[k] - a[k]]));
  must(
    Object.values(delta).some((v) => v !== 0) &&
      Object.values(delta).every((v) => Number.isSafeInteger(v) && Math.abs(v) <= 5000),
    'Bounded nonzero integer spatial translation',
    { delta },
  );
  const expected = clone(before),
    step = expected.steps.acro[0];
  step.at += delta[step.axis];
  for (const key of ['minSide', 'maxSide']) step[key] += delta[step.axis === 'x' ? 'z' : 'x'];
  for (const key of ['minY', 'maxY']) step[key] += delta.y;
  eq(
    after,
    expected,
    'Spatial edit changes only selected Acro gate, preserving Self-level and course identity',
  );
  const final = await project(),
    expectedProject = clone(prior);
  expectedProject.courses[1] = after;
  eq(
    final.project.courses,
    expectedProject.courses,
    'Spatial edit leaves all other seven courses exactly unchanged',
  );
  for (const key of [
    'overrides',
    'routeBindings',
    'spawnBindings',
    'world',
    'source',
    'title',
    'playlists',
  ])
    eq(final.project[key], prior[key], 'Spatial edit preserves ' + key);
  click(q('#undo-edit'));
  eq(course(), before, 'Selected course spatial Undo exact');
  click(q('#redo-edit'));
  eq(course(), after, 'Selected course spatial Redo exact');
  select('picker-1');
  eq(course(), prior.courses[0], 'Other course still exact after spatial edit');
  select('picker-2');
  eq(course(), after, 'Spatial edit retained after course roundtrip');
  must(
    q('#editor-route-mode').value === 'acro' &&
      q('#undo-edit').disabled &&
      q('#redo-edit').disabled,
    'Roundtrip restores Acro with fresh owned history',
  );
  receipt.spatial = { delta, pointerEvents, finalCourse: after };
  receipt.exportedProject = final.project;
  const owned = q('#editor-project-course-row'),
    choice = q('#editor-project-course');
  ctx.store.close();
  await bounded(ctx.app.dispose(), 'owned picker disposal');
  ctx.app = null;
  must(
    !owned.isConnected && !choice.isConnected && !q('#editor-project-course'),
    'Owned picker disposed',
  );
  eq(ctx.w.fixtureErrors, [], 'Disposal has no uncaught errors');
  receipt.completedAt = new Date().toISOString();
  receipt.status = 'passed';
  render(
    'PASS ' +
      receipt.checks.length +
      '/' +
      receipt.checks.length +
      ' — selected courses, dirty fields, source/history ownership, exact models, full-project persistence, trusted gizmo and actual previews.',
  );
}
const fail = (error) => {
  receipt ??= { checks: [] };
  receipt.status = 'failed';
  receipt.error = error.stack ?? String(error);
  receipt.failure = ctx.d
    ? {
        courseJSON: q('#creator-json')?.value,
        status: q('#studio-status')?.textContent,
        importReport: q('#import-report')?.textContent,
        errors: ctx.w.fixtureErrors,
      }
    : null;
  render('FAIL: ' + error.message + '. Preserve full receipt.');
};
$('run').addEventListener('click', () => execute().catch(fail));
$('spatial').addEventListener('click', () => spatial().catch(fail));
