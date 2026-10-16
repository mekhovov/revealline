const $ = (id) => document.getElementById(id),
  frame = $('sim');
const receipt = {
  format: 'FPVStickGeometryFunctional.v1',
  checks: [],
  cases: [],
  hosts: [],
  limitations: [
    "Exact admitted0b54 baseline and one committed Worlds host overlay; absent-ResizeObserver is an explicit capability diagnostic. Academy's separate display implementation is unchanged.",
    'Public UI and native CSS geometry. Radio/controller physical devices are not invented; Modes1–4 nonzero mappings are compared separately in exact source-function manual cases.',
    'Numeric native transform/rectangle equality is not a screenshot-diff, latency or physical mobile-device claim. Native recorded controls prove nonzero positions.',
    'Current supported CSS is fixed border-box with1px border/no padding. Named synthetic border-box/fractional/nonsquare geometry probes exercise native integer clientWidth; arbitrary content-box padding-only mutation is not claimed.',
    'Source/display sizing transitions are checked synchronously; viewport/element changes settle through native ResizeObserver before following presentation frames. Observer errors remain failures.',
  ],
};
let w,
  d,
  p,
  variant,
  fixture,
  finished = false;
const q = (s) => d.querySelector(s),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(ok, name, detail) {
  receipt.checks.push({
    name,
    passed: Boolean(ok),
    ...(detail === undefined ? {} : { detail }),
  });
  if (!ok) throw Error(name);
}
async function until(fn, name) {
  const end = performance.now() + 30000;
  while (!fn()) {
    if (performance.now() > end) throw Error('Timeout: ' + name);
    await sleep(25);
  }
}
function visible(n) {
  return Boolean(
    n?.checkVisibility({ checkVisibilityCSS: true }) && !n.closest('[hidden],dialog:not([open])'),
  );
}
function click(n) {
  check(
    visible(n) && !n.disabled,
    'public ' + (n?.id || n?.getAttribute('aria-label') || n?.textContent?.slice(0, 35)),
  );
  n.click();
}
function set(id, value) {
  const n = q('#' + id);
  const parents = [];
  for (let a = n.parentElement; a; a = a.parentElement)
    if (a.tagName === 'DETAILS' && !a.open) parents.unshift(a);
  for (const a of parents) click(a.querySelector(':scope > summary'));
  check(visible(n) && !n.disabled, 'public setting ' + id);
  const previous = n.value;
  n.value = value;
  n.dispatchEvent(new w.Event('change', { bubbles: true }));
  if (previous !== value && (id === 'flight-stick-display' || id === 'flight-source')) {
    const snap = geometry();
    if (
      !p.identity().replay &&
      snap.state?.ticks === 0 &&
      ['keyboard', 'touch'].includes(snap.source)
    ) {
      const left = snap.sticks[0];
      check(
        Math.abs(left.translation[0]) < 0.0001 &&
          Math.abs(left.translation[1] - left.clientWidth * 0.34) < 0.0001,
        'synchronous native size transition ' + variant + '/' + id + '/' + value,
        left,
      );
    }
  }
}
async function frames(n = 3) {
  for (let i = 0; i < n; i++) await new Promise(w.requestAnimationFrame.bind(w));
}
async function menu() {
  if (q('#sim-settings').open) click(q('#close-sim-settings'));
  for (const type of ['briefing', 'missions'])
    if (q('#worlds-shell-' + type + '-dialog')?.open)
      click(q('#worlds-shell-action-' + type + '-back'));
  if (!q('#worlds-shell-home-dialog').open) click(q('#worlds-shell-action-menu'));
  await until(() => q('#worlds-shell-home-dialog').open, 'Home');
}
async function settings() {
  await menu();
  click(q('#worlds-shell-action-settings'));
  await until(() => q('#sim-settings').open, 'Settings');
}
async function launch(id, replay = false) {
  await menu();
  click(q('#worlds-shell-action-missions'));
  const e = p.entries.find((e) => e.id === id);
  check(e, 'course ' + id);
  click(q('[data-world="' + e.world + '"]'));
  const label = (replay ? 'Watch demonstration: ' : 'Fly: ') + e.course.locales.en.title;
  click(
    [...d.querySelectorAll('button[aria-label]')].find(
      (n) => n.getAttribute('aria-label') === label,
    ),
  );
  await until(
    () =>
      p.peek().course === id &&
      (!q('#world-arm').disabled || id === 'beginner-40') &&
      (replay
        ? p.peek().status === 'active'
        : q('#flight-status').textContent.startsWith('Ready. Choose')),
    'ready ' + id,
  );
  await frames();
}
const ids = [
  'world-flight-identity',
  'flight-instruments',
  'flight-objective',
  'world-arm',
  'world-retry',
  'world-flight-resume',
  'world-left-label',
  'world-right-label',
  'world-touch-throttle',
  'world-keys-hint',
  'world-input-status',
];
function geometry() {
  const capture = p.capture(),
    result = {
      course: capture.course,
      mode: capture.mode,
      source: q('#flight-source').value,
      display: q('#flight-stick-display').value,
      locale: q('#world-language').value,
      viewport: [w.innerWidth, w.innerHeight],
      state: capture.state,
      texts: Object.fromEntries(ids.map((id) => [id, q('#' + id).textContent])),
      sticks: [],
      inputUnavailable: q('#world-touch').classList.contains('input-unavailable'),
      monitorHidden: q('#world-touch').hidden,
    };
  for (const side of ['left', 'right']) {
    const n = q('#world-' + side + '-stick'),
      dot = n.querySelector('i'),
      r = n.getBoundingClientRect(),
      b = dot.getBoundingClientRect(),
      style = w.getComputedStyle(n),
      transform = w.getComputedStyle(dot).transform,
      m = transform === 'none' ? new w.DOMMatrix() : new w.DOMMatrix(transform);
    result.sticks.push({
      side,
      clientWidth: n.clientWidth,
      box: [r.width, r.height],
      dot: [b.width, b.height],
      relativeCenter: [
        b.x + b.width / 2 - r.x - r.width / 2,
        b.y + b.height / 2 - r.y - r.height / 2,
      ],
      translation: [m.m41, m.m42],
      inline: dot.style.transform,
      padding: [style.paddingLeft, style.paddingTop, style.paddingRight, style.paddingBottom],
      boxSizing: style.boxSizing,
      border: [
        style.borderLeftWidth,
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
      ],
      aria: n.getAttribute('aria-label'),
      visible: visible(n),
    });
  }
  return result;
}
async function sample(name, { recorded = false, compare = true } = {}) {
  await frames();
  const value = geometry(),
    nodes = Object.fromEntries(ids.map((id) => [id, q('#' + id).firstChild]));
  await frames();
  const after = geometry();
  check(equal(value.state, after.state), 'paused native state unchanged ' + name);
  check(equal(value.texts, after.texts), 'visible strings stable ' + name);
  if (variant === 'candidate')
    check(
      ids.every((id) => q('#' + id).firstChild === nodes[id]),
      'unchanged HUD text nodes retained ' + name,
    );
  if (recorded) {
    const input = value.state.lastInput;
    check(
      value.state.status === 'paused' && value.state.ticks >= 40,
      'real recorded state is paused after progress ' + name,
    );
    check(
      Object.values(input).some((n) => n !== 0) &&
        value.sticks.some(
          (r) => r.visible && r.clientWidth > 0 && r.translation.some((v) => Math.abs(v) > 0.01),
        ),
      'visible positive-width nonzero recorded control sample ' + name,
    );
    for (const row of value.sticks) {
      const x = (row.side === 'left' ? input.yaw : input.roll) / 1000,
        y = row.side === 'left' ? (input.throttle / 1000) * 2 - 1 : input.pitch / 1000;
      const expected = [x * row.clientWidth * 0.34, -y * row.clientWidth * 0.34];
      check(
        row.translation.every((v, i) => Math.abs(v - expected[i]) < 0.0001),
        'native recorded ' + row.side + ' exact width/radius transform ' + name,
        { expected, actual: row.translation },
      );
    }
  }
  for (const row of value.sticks)
    if (row.visible)
      check(
        row.relativeCenter.every((v, i) => Math.abs(v - row.translation[i]) < 0.03),
        'native dot pixels match transform ' + name + ' ' + row.side,
        row,
      );
  const row = { variant, name, value };
  receipt.cases.push(row);
  if (variant === 'candidate' && compare) {
    const base = receipt.cases.find((r) => r.variant === 'baseline' && r.name === name)?.value;
    const normalize = (v) => {
      const { state, ...rest } = v;
      return rest;
    };
    check(
      base && equal(normalize(base), normalize(value)),
      'baseline/candidate exact native HUD geometry ' + name,
    );
  }
  return value;
}
async function finish() {
  if (!p || finished) return;
  const stick = p.data.resizeObservers.find((r) => r.name === 'resizeSticks');
  await p.finish();
  const count = stick?.calls;
  frame.style.width = '801px';
  await frames();
  if (variant === 'candidate')
    check(
      stick && stick.disconnects === 1 && stick.targets.length === 0 && stick.calls === count,
      'owned stick observer disconnects and stays inactive after disposal',
      stick,
    );
  else check(!stick, 'baseline/fallback has no stick observer');
  finished = true;
  receipt.hosts.push({ variant, ...p.data });
  check(!p.data.errors.length && !p.data.warnings.length, 'no native warnings/errors ' + variant);
  check(
    Object.values(p.data.disposed.registered).every((n) => n === 0),
    'native resource cleanup ' + variant,
  );
}
async function mount(name) {
  await finish();
  variant = name;
  finished = false;
  p = null;
  frame.style.width = '1024px';
  frame.style.height = '720px';
  const storagePrefix = 'steady-' + crypto.randomUUID() + ':',
    url = new URL(
      (name === 'fallback' ? 'candidate' : name) +
        '/player/optional-practice/fpv-worlds/steady-host.html?storage=' +
        encodeURIComponent(storagePrefix) +
        (name === 'fallback' ? '&noResizeObserver=1' : ''),
      location.href,
    );
  frame.src = url.href;
  await until(
    () =>
      frame.contentWindow?.location.href === url.href &&
      frame.contentWindow.fpvSteady?.data.storagePrefix === storagePrefix &&
      !frame.contentWindow.fpvSteady.data.disposed,
    'new ' + name + ' host',
  );
  w = frame.contentWindow;
  d = frame.contentDocument;
  p = w.fpvSteady;
  check(
    Boolean(q('#worlds-shell-home-dialog')) &&
      !receipt.hosts.some((host) => host.storagePrefix === storagePrefix),
    'fresh native host ownership ' + name,
    { href: w.location.href, storagePrefix, timeOrigin: p.data.timeOrigin },
  );
  w.focus();
}
async function matrix() {
  await launch('container-yard-08');
  await settings();
  for (const width of [1024, 391, 320, 844]) {
    frame.style.width = width + 'px';
    frame.style.height = (width === 844 ? 390 : 720) + 'px';
    await frames();
    for (const source of ['keyboard', 'touch']) {
      set('flight-source', source);
      for (const display of ['compact', 'expanded', 'setup']) {
        set('flight-stick-display', display);
        await sample('size' + width + '/' + source + '/' + display);
      }
    }
  }
  frame.style.width = '1024px';
  frame.style.height = '720px';
  await frames();
  set('flight-stick-display', 'expanded');
  for (const source of ['controller', 'radio', 'keyboard']) {
    set('flight-source', source);
    await sample('source-' + source);
  }
  for (const locale of ['uk', 'en']) {
    set('world-language', locale);
    await sample('yard-' + locale);
  }
  await launch('beginner-40');
  await sample('learning-guide-hidden');
  click(q('[data-coach-action="start"]'));
  await settings();
  for (const [width, height] of [
    [391, 844],
    [844, 391],
  ]) {
    p.beginLayout('learning-' + width + 'x' + height);
    frame.style.width = width + 'px';
    frame.style.height = height + 'px';
    const previousSource = q('#flight-source').value;
    set('flight-source', 'touch');
    p.markLayout(
      'immediate-after-source-' + (previousSource === 'touch' ? 'unchanged' : 'changed'),
    );
    await frames(1);
    p.markLayout('next-native-RAF-point');
    await frames(1);
    p.markLayout('following-native-RAF-point');
    const order = p.endLayout();
    (receipt.resizeOrdering ??= []).push({ variant, ...order });
    check(order.dropped === 0, 'all native resize-order events retained');
    const corrected = (e) =>
      e.sticks?.every((row) => {
        const m = new w.DOMMatrix(row.transform);
        return (
          Math.abs(m.m41) < 0.0001 &&
          Math.abs(m.m42 - (row.side === 'left' ? row.width * 0.34 : 0)) < 0.0001
        );
      });
    if (variant === 'candidate') {
      const native = order.events.find((e) => e.type === 'native-RO-return');
      check(
        native && corrected(native),
        'native RO returns with exact resized neutral transform',
        order,
      );
      check(
        order.events.indexOf(native) <
          order.events.findIndex((e) => e.type === 'following-native-RAF-point'),
        'native RO correction precedes following presentation frame',
        order,
      );
    }
    check(
      corrected(order.events.find((e) => e.type === 'following-native-RAF-point')),
      'exact transform in following native frame',
      order,
    );
    await sample('learning-touch-' + width + 'x' + height, { compare: false });
  }
  set('flight-source', 'keyboard');
  frame.style.width = '1024px';
  frame.style.height = '720px';
  if (variant === 'candidate') {
    await menu();
    const events = [];
    const captureFullscreen = () => {
      setTimeout(async () => {
        await frames();
        events.push({
          native: Boolean(d.fullscreenElement),
          immersive: d.documentElement.dataset.fpvImmersive ?? null,
          geometry: geometry(),
        });
      }, 0);
    };
    d.addEventListener('fullscreenchange', captureFullscreen);
    $('status').textContent =
      'MANUAL: use the native Home Full screen button to enter, inspect, use the same public toggle to exit, then Continue. Escape may only close Home.';
    $('continue').hidden = false;
    await new Promise((resolve) => {
      $('continue').onclick = resolve;
    });
    $('continue').hidden = true;
    w.focus();
    await frames();
    d.removeEventListener('fullscreenchange', captureFullscreen);
    receipt.fullscreen = events;
    check(
      events.some((e) => e.native) && events.some((e) => !e.native),
      'trusted native fullscreen enter and exit observed',
    );
    for (const e of events) {
      check(e.geometry.source === 'keyboard', 'fullscreen uses keyboard Mode2 display');
      const input = e.geometry.state.lastInput;
      for (const row of e.geometry.sticks) {
        const x = (row.side === 'left' ? input.yaw : input.roll) / 1000,
          y = row.side === 'left' ? (input.throttle / 1000) * 2 - 1 : input.pitch / 1000,
          expected = [x * row.clientWidth * 0.34, -y * row.clientWidth * 0.34];
        if (row.visible)
          check(
            row.translation.every((v, i) => Math.abs(v - expected[i]) < 0.0001),
            'fullscreen exact mapped native radius ' + row.side,
            { input, expected, actual: row },
          );
      }
    }
  }
  await launch('woodland-01', true);
  await until(() => p.peek().ticks >= 40, 'genuine recorded nonzero controls');
  await settings();
  await frames();
  const identity = p.identity();
  (receipt.recordedOwners ??= []).push({
    variant,
    identity,
    pausedState: p.peek(),
  });
  check(identity.replay?.kind === 'demonstration', 'native verified demonstration owner');
  for (const width of [1024, 391, 320, 844]) {
    frame.style.width = width + 'px';
    await frames();
    for (const display of ['compact', 'expanded']) {
      set('flight-stick-display', display);
      await sample('recorded/' + width + '/' + display, {
        recorded: true,
        compare: false,
      });
    }
  }
  for (const [name, css] of [
    ['fractional-nonsquare', 'width:91.25px!important;height:107px!important'],
    [
      'border-padding',
      'width:91.25px!important;height:107px!important;padding:3.25px 7.5px!important;border-width:2px 3px!important',
    ],
    [
      'padding-only-borderbox',
      'width:91.25px!important;height:107px!important;padding:5.5px 10.25px!important;border-width:2px 3px!important',
    ],
    [
      'border-only-borderbox',
      'width:91.25px!important;height:107px!important;padding:5.5px 10.25px!important;border-width:4px 5px!important',
    ],
  ]) {
    for (const side of ['left', 'right']) q('#world-' + side + '-stick').style.cssText = css;
    await sample('diagnostic-' + name, { recorded: true, compare: false });
  }
  for (const side of ['left', 'right']) q('#world-' + side + '-stick').style.cssText = '';
  await sample('diagnostic-original-css-restored', {
    recorded: true,
    compare: false,
  });
  set('world-language', 'uk');
  await sample('recorded-uk', { recorded: true, compare: false });
  set('world-language', 'en');
  await finish();
}
const sha = async (b) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
$('run').onclick = async () => {
  $('run').disabled = true;
  receipt.startedAt = new Date().toISOString();
  try {
    const b = await (await fetch('fixture.json')).arrayBuffer();
    fixture = JSON.parse(new TextDecoder().decode(b));
    receipt.fixture = fixture;
    receipt.fixtureSha256 = await sha(b);
    for (const f of fixture.files) {
      const bytes = await (await fetch(f.path)).arrayBuffer();
      check(bytes.byteLength === f.bytes && (await sha(bytes)) === f.sha256, 'frozen ' + f.path);
    }
    for (const name of ['baseline', 'candidate', 'fallback']) {
      $('status').textContent = name + ' · native HUD/inputs/resizes';
      await mount(name);
      await matrix();
    }
    receipt.completed = true;
    frame.src = 'about:blank';
    $('status').textContent = 'PASS · native layout and text parity';
  } catch (error) {
    receipt.completed = false;
    receipt.error = String(error.stack ?? error);
    try {
      receipt.failure = p?.capture() ?? frame.contentWindow?.fpvSteadyData;
      await finish();
    } catch (cleanup) {
      receipt.cleanupError = String(cleanup);
      if (p && !receipt.hosts.some((h) => h.storagePrefix === p.data.storagePrefix))
        receipt.hosts.push(p.data);
    }
    $('status').textContent = 'STOPPED · ' + error.message;
  } finally {
    receipt.finishedAt = new Date().toISOString();
    $('receipt').value = JSON.stringify(receipt);
    $('summary').value = JSON.stringify(
      {
        completed: receipt.completed,
        error: receipt.error ?? null,
        checks: receipt.checks.length,
        failed: receipt.checks.filter((c) => !c.passed),
        cases: receipt.cases.map((r) => ({ variant: r.variant, name: r.name })),
      },
      null,
      2,
    );
  }
};
