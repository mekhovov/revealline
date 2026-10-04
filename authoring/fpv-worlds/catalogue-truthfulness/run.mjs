// Manual native-host functional checks; no flight clocks or private state writes.
const $ = (id) => document.getElementById(id),
  frame = $('sim'),
  receipt = {
    format: 'FPVImportedCatalogueNative.v1',
    checks: [],
    actions: [],
    samples: [],
    hosts: [],
    limitations: [
      'Committed host overlay on exact102 admitted members; not zero-overlay admission or offline proof.',
      'File input imports pack and separate proofs through native handlers; not published Browse.',
      'Scripted public controls and a bounded native Watch start/pause; no complete replay, hardware or performance claim.',
    ],
  },
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  prefix = 'catalogue-' + crypto.randomUUID() + ':';
let fixture, w, d, p;
const q = (s) => d.querySelector(s),
  sha = async (bytes) =>
    [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
  same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(ok, name, detail) {
  receipt.checks.push({ name, passed: !!ok, ...(detail === undefined ? {} : { detail }) });
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
    id: n.id,
    label: n.getAttribute('aria-label') || n.textContent,
    at: new Date().toISOString(),
  });
  n.click();
}
function reveal(n) {
  const ancestors = [];
  for (let a = n?.parentElement; a; a = a.parentElement)
    if (a.tagName === 'DETAILS' && !a.open) ancestors.unshift(a);
  for (const a of ancestors) click(a.querySelector(':scope > summary'));
}
function set(id, value) {
  const n = q('#' + id);
  reveal(n);
  check(visible(n) && !n.disabled, 'Visible setting ' + id);
  n.value = value;
  n.dispatchEvent(new w.Event('change', { bubbles: true }));
}
async function home() {
  if (q('#sim-settings')?.open) click(q('#close-sim-settings'));
  if (q('#worlds-shell-missions-dialog')?.open) click(q('#worlds-shell-action-missions-back'));
  if (!q('#worlds-shell-home-dialog').open) click(q('#worlds-shell-action-menu'));
  await until(() => q('#worlds-shell-home-dialog').open, 'Home');
}
async function missions(tab = 'explore') {
  await home();
  click(q('#worlds-shell-action-missions'));
  await until(() => q('#worlds-shell-missions-dialog').open, 'Missions');
  click(q('[data-tab="' + tab + '"]'));
}
async function preferences(locale, mode) {
  await home();
  click(q('#worlds-shell-action-settings'));
  await until(() => q('#sim-settings').open, 'Settings');
  if (q('#world-language').value !== locale) set('world-language', locale);
  if (q('#flight-mode').value !== mode) set('flight-mode', mode);
  click(q('#close-sim-settings'));
  await missions();
}
async function upload(id, path, name) {
  const node = q('#' + id),
    data = new w.DataTransfer(),
    bytes = await (await fetch(path)).arrayBuffer();
  reveal(node);
  check(visible(node.closest('label')), 'Visible native file input ' + id);
  data.items.add(
    new w.File([bytes], name, {
      type: name.endsWith('.json') ? 'application/json' : 'application/octet-stream',
    }),
  );
  node.files = data.files;
  node.dispatchEvent(new w.Event('change', { bubbles: true }));
  await until(() => node.value === '', 'Native import finished ' + name, 90000);
}
const rows = () =>
  [...d.querySelectorAll('#world-grid .challenge-row')].map((row) => ({
    title: row.querySelector('strong').textContent,
    metadata: row.querySelector('small').textContent,
    watch: !!row.querySelector('.watch-example'),
  }));
function selectWorld(world) {
  click(q('[data-world="' + world + '"]'));
}
function filters(activity = 'all', difficulty = 'all') {
  set('activity-filter', activity);
  set('difficulty-filter', difficulty);
}
function assertPack(key, locale, mode) {
  selectWorld(fixture.packs[key].world);
  const actual = rows(),
    expected = fixture.packs[key].courses;
  check(actual.length === expected.length, key + ' course count ' + locale + '/' + mode);
  for (const course of expected) {
    const row = actual.find((r) => r.title === course.locales[locale].title),
      kind =
        course.id === 'festival-grounds-06' ||
        (course.id === 'catalogue-mode-split' && mode === 'self-level')
          ? 'follow'
          : course.id === 'festival-grounds-07' || course.id === 'catalogue-mode-split'
            ? 'observe'
            : null,
      label =
        kind === 'follow'
          ? locale === 'uk'
            ? 'Супровід об’єкта'
            : 'Follow a subject'
          : kind === 'observe'
            ? locale === 'uk'
              ? 'Спостереження за об’єктом'
              : 'Observe a subject'
            : locale === 'uk'
              ? 'Авторське завдання'
              : 'Authored challenge';
    check(
      row?.metadata === label,
      key + ' truthful native label ' + course.id + '/' + locale + '/' + mode,
      row,
    );
  }
  receipt.samples.push({ key, locale, mode, rows: actual });
}
async function finish(name) {
  if (!p || p.disposed) return;
  await p.finish();
  receipt.hosts.push({ name, ...p.data });
  check(!p.data.errors.length && !p.data.warnings.length, name + ' no errors/warnings', p.data);
  check(
    p.data.rendererCount === 0
      ? p.data.resources === null
      : !!p.data.resources && Object.values(p.data.resources.registered).every((n) => n === 0),
    name + ' actual owner resources released',
  );
}
async function mount() {
  const token = crypto.randomUUID();
  frame.src =
    'player/optional-practice/fpv-worlds/catalogue-host.html?storage=' +
    encodeURIComponent(prefix) +
    '&host=' +
    token;
  await until(
    () =>
      frame.contentWindow?.fpvCatalogue &&
      !frame.contentWindow.fpvCatalogue.disposed &&
      new URL(frame.contentWindow.location.href).searchParams.get('host') === token,
    'Fresh native host',
  );
  w = frame.contentWindow;
  d = frame.contentDocument;
  p = w.fpvCatalogue;
  w.focus();
}
function output() {
  $('receipt').value = JSON.stringify(receipt);
  $('summary').textContent = JSON.stringify(
    {
      completed: receipt.completed ?? false,
      error: receipt.error ?? null,
      checks: receipt.checks.length,
      failed: receipt.checks.filter((r) => !r.passed),
      samples: receipt.samples.length,
      source: fixture?.revision,
      hosts: receipt.hosts.map((h) => ({
        name: h.name,
        errors: h.errors,
        warnings: h.warnings,
        rendererCount: h.rendererCount,
      })),
    },
    null,
    2,
  );
}
async function execute() {
  try {
    fixture = await (await fetch('fixture.json')).json();
    receipt.fixture = fixture;
    for (const row of fixture.files) {
      const response = await fetch(row.path),
        bytes = await response.arrayBuffer();
      check(
        response.ok && bytes.byteLength === row.bytes && (await sha(bytes)) === row.sha256,
        'Frozen served bytes ' + row.path,
      );
    }
    await mount();
    await preferences('en', 'self-level');
    const builtinWorld = q('[data-world][aria-pressed="true"]').dataset.world,
      builtinBefore = rows();
    check(builtinBefore.length > 0, 'Initial built-in card metadata captured');
    await missions('packs');
    for (const key of ['reservoir', 'festival', 'diagnostic']) {
      await upload('import-pack', 'content/' + key + '.rlpack', key + '.rlpack');
      check(!!q('[data-pack-id="' + fixture.packs[key].id + '"]'), 'Native pack installed ' + key);
    }
    const beforeProofs = await p.inspect();
    check(
      beforeProofs.records.length === 0,
      'Pack installation alone supplies no demonstration records',
    );
    await upload('import-proofs', 'content/proofs.json', 'mountain-reservoir.r16.proofs.json');
    await until(
      () => p.inspect().then((s) => s.records.length === 16),
      'Separate16 native verified proofs',
    );
    const installed = await p.inspect();
    check(
      installed.records.every(
        (r) =>
          r.status === 'verified' &&
          r.packIdentity === 'fpv-pack:' + fixture.packs.reservoir.sha256,
      ),
      'Separate proof records retain exact pack dependency',
    );
    for (const locale of ['en', 'uk'])
      for (const mode of ['self-level', 'acro']) {
        $('status').textContent = locale + ' / ' + mode + ' public catalogue';
        await preferences(locale, mode);
        filters();
        for (const key of ['reservoir', 'festival', 'diagnostic']) assertPack(key, locale, mode);
        filters('follow');
        selectWorld(fixture.packs.festival.world);
        check(
          rows().length === 1 &&
            rows()[0].title === fixture.packs.festival.courses[5].locales[locale].title,
          'Follow filter exact Festival route ' + locale + '/' + mode,
        );
        if (mode === 'self-level') {
          selectWorld(fixture.packs.diagnostic.world);
          check(
            rows().length === 1 && rows()[0].title === 'catalogue-mode-split',
            'Selected self-level Follow includes divergent course',
          );
        } else
          check(
            !q('[data-world="' + fixture.packs.diagnostic.world + '"]'),
            'Selected Acro Follow excludes divergent course',
          );
        filters('observe');
        selectWorld(fixture.packs.festival.world);
        check(
          rows().length === 1 &&
            rows()[0].title === fixture.packs.festival.courses[6].locales[locale].title,
          'Observe filter exact Festival route ' + locale + '/' + mode,
        );
        if (mode === 'acro') {
          selectWorld(fixture.packs.diagnostic.world);
          check(
            rows().length === 1 && rows()[0].title === 'catalogue-mode-split',
            'Selected Acro Observe includes divergent course',
          );
        } else
          check(
            !q('[data-world="' + fixture.packs.diagnostic.world + '"]'),
            'Selected self-level Observe excludes divergent course',
          );
        for (const difficulty of ['beginner', 'intermediate', 'advanced']) {
          filters('all', difficulty);
          check(
            Object.values(fixture.packs).every((pack) => !q('[data-world="' + pack.world + '"]')),
            'Unrated imports excluded from invented ' +
              difficulty +
              ' rating ' +
              locale +
              '/' +
              mode,
          );
        }
        filters();
      }
    await preferences('en', 'self-level');
    filters();
    selectWorld(builtinWorld);
    check(
      same(rows(), builtinBefore),
      'Built-in native card text and examples unchanged by imports/mode/locale',
    );
    selectWorld(fixture.packs.reservoir.world);
    check(
      rows().every((r) => r.watch),
      'Exact retained Reservoir proofs still expose Watch after catalogue refreshes',
    );
    const course = fixture.packs.reservoir.courses.find((c) => c.id === 'mountain-reservoir-08'),
      watch = [...d.querySelectorAll('.watch-example')].find(
        (n) => n.getAttribute('aria-label') === 'Watch demonstration: ' + course.locales.en.title,
      );
    click(watch);
    await until(
      () => /^(Flight active|Playback active)/.test(q('#flight-status').textContent),
      'Native exact Watch starts',
      45000,
    );
    receipt.watchStartStatus = q('#flight-status').textContent;
    await home();
    click(q('#worlds-shell-action-settings'));
    await until(() => q('#sim-settings').open, 'Public Settings pauses native Watch');
    const active = p.app.snapshot();
    check(
      active.course === course.id &&
        active.replay?.kind === 'demonstration' &&
        active.replay.mode === 'self-level' &&
        active.replay.frames === 1616,
      'Watch keeps exact selected course/mode/record frame count',
      { course: active.course, replay: active.replay },
    );
    const paused = active;
    check(paused.state.status === 'paused', 'Watch paused through public settings');
    set('world-language', 'uk');
    set('world-language', 'en');
    check(
      same(p.app.snapshot().state, paused.state),
      'Catalogue language refresh preserves paused replay state',
    );
    const beforeReopen = await p.inspect();
    check(
      same(beforeReopen, installed),
      'Labels and filters preserve every stored project/revision and proof summary',
    );
    receipt.storage = beforeReopen;
    await finish('initial owner');
    await mount();
    check(
      same(await p.inspect(), beforeReopen),
      'Native reopen retains exact installed projects and records',
    );
    await preferences('en', 'self-level');
    filters();
    assertPack('festival', 'en', 'self-level');
    assertPack('reservoir', 'en', 'self-level');
    check(
      rows().every((r) => r.watch),
      'Native reopen retains exact dependency Watch availability',
    );
    await finish('reopened owner');
    receipt.completed = true;
    $('status').textContent = 'PASS';
  } catch (error) {
    receipt.error = { message: error.message, stack: error.stack };
    try {
      receipt.failure = {
        status: q('#flight-status')?.textContent,
        studio: q('#studio-status')?.textContent,
        rows: rows(),
        visible: d.visibilityState,
        focus: d.hasFocus(),
        snapshot: p?.app.snapshot(),
      };
    } catch (capture) {
      receipt.captureError = String(capture);
    }
    try {
      await finish('failed owner');
    } catch (cleanup) {
      receipt.cleanupError = String(cleanup);
    }
    $('status').textContent = 'FAILED';
  } finally {
    output();
  }
}
$('run').addEventListener(
  'click',
  () => {
    $('run').disabled = true;
    void execute();
  },
  { once: true },
);
