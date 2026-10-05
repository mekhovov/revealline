/* global document, addEventListener */
// Native public-UI lifecycle checks, separately qualified from performance measurements.
const $ = (id) => document.getElementById(id),
  frame = $('sim'),
  hostPath = frame.getAttribute('src').split('?')[0];
const receipt = {
  format: 'FPVSceneReadinessFunctional.v1',
  checks: [],
  phases: [],
  snapshots: [],
  stages: [],
  limits: [
    'A fixture requests one native WEBGL_lose_context loss during first renderer creation. No runtime guards, clock, state or storage are replaced.',
    'The checks cover one local browser; they are not offline, physical-device or sustained-performance acceptance.',
  ],
};
let context,
  readyCount = 0,
  busy = false,
  continueRun;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const q = (s) => context.d.querySelector(s);
function check(value, name, detail) {
  receipt.checks.push({ name, passed: Boolean(value), ...(detail ? { detail } : {}) });
  if (!value) throw Error(name);
}
async function until(predicate, name, ms = 25000) {
  const start = performance.now();
  while (!predicate()) {
    if (performance.now() - start > ms) throw Error('Timeout: ' + name);
    await wait(20);
  }
}
function click(node) {
  if (!node || node.disabled) throw Error('Unavailable public control');
  node.click();
}
function set(id, value) {
  const node = q('#' + id);
  node.value = value;
  node.dispatchEvent(new context.w.Event('change', { bubbles: true }));
}
async function frames(n = 4) {
  for (let i = 0; i < n; i++) await new Promise(context.w.requestAnimationFrame.bind(context.w));
}
function adopt() {
  context = {
    w: frame.contentWindow,
    d: frame.contentDocument,
    p: frame.contentWindow.fpvPerformance,
    app: frame.contentWindow.fpvWorldStudio,
  };
  context.p.startMeasurement();
  context.w.focus();
}
function phase(name) {
  receipt.phases.push({ name, at: new Date().toISOString() });
  context.p.data.context = { phase: name };
  $('status').textContent = name;
}
function snapshot(name) {
  const app = context.app.snapshot(),
    canvas = q('#world-canvas'),
    rect = canvas.getBoundingClientRect();
  const item = {
    name,
    course: app.course,
    state: app.state,
    appearance: app.appearance,
    status: q('#flight-status').textContent,
    armDisabled: q('#world-arm').disabled,
    resources: context.p.resources(),
    visible: context.d.visibilityState,
    focused: context.d.hasFocus(),
    canvas: { css: [rect.width, rect.height], pixels: [canvas.width, canvas.height] },
  };
  receipt.snapshots.push(item);
  return item;
}
async function fly(id, expectReady = true) {
  if (q('#flight-dialog').open) {
    click(q('#leave-flight'));
    await until(() => !q('#flight-dialog').open, 'flight closes');
  }
  click(q('[data-tab="explore"]'));
  const entry = context.p.entries.find((e) => e.id === id);
  check(entry, 'catalogue target exists: ' + id);
  click(q('[data-world="' + entry.world + '"]'));
  const title = entry.course.locales.en.title;
  const control = [...context.d.querySelectorAll('button[aria-label]')].find(
    (n) => n.getAttribute('aria-label') === 'Fly: ' + title,
  );
  click(control);
  if (expectReady) await ready(id, title);
  return entry;
}
async function ready(id, title) {
  await until(
    () =>
      q('#flight-dialog').open &&
      (!title || q('#flight-title').textContent === title) &&
      q('#flight-status').textContent.startsWith('Ready. Choose'),
    'ready ' + id,
  );
  await until(() => context.p.state()?.courseId === id, 'first correct-course draw ' + id);
  await frames();
  const value = snapshot('ready ' + id);
  check(
    value.state.status !== 'active' && !value.armDisabled,
    'ready stays deliberately disarmed: ' + id,
  );
  check(
    value.resources.renderer.calls > 0 && value.resources.renderer.triangles > 0,
    'ready scene submits visible geometry: ' + id,
  );
  check(
    value.canvas.css.every((n) => n > 0) && value.canvas.pixels.every((n) => n > 0),
    'ready canvas has positive dimensions: ' + id,
  );
  return value;
}
async function quality(value) {
  set('flight-quality', value);
  await until(
    () => q('#flight-status').textContent.startsWith('Graphics ready.'),
    'quality ready ' + value,
  );
  await frames();
  const s = snapshot('quality ' + value);
  check(
    s.state.status !== 'active' && s.resources.quality === value && !s.armDisabled,
    'quality changes retain paused ready scene: ' + value,
  );
}
async function finishHost() {
  await context.p.finish();
  check(
    Object.values(context.p.data.disposedResources.registered).every((n) => n === 0),
    'disposed host releases owned graphics',
  );
  receipt.stages.push(context.p.data);
  check(context.p.data.errors.length === 0, 'no unexpected uncaught or console errors');
  check(context.p.data.warnings.length === 0, 'no unexpected script warnings');
}
addEventListener('message', (event) => {
  if (event.source !== frame.contentWindow || event.data?.type !== 'fpv-profile-ready') return;
  readyCount++;
  if (!busy) {
    $('run').disabled = false;
    $('status').textContent = 'Ready. Includes one deliberate native graphics-context loss.';
  }
});
$('continue').onclick = () => {
  $('continue').hidden = true;
  continueRun?.();
};
$('run').onclick = async () => {
  if (busy) return;
  busy = true;
  $('run').disabled = true;
  document.body.dataset.running = 'true';
  adopt();
  try {
    receipt.fixture = await (await fetch('./fixture.json', { cache: 'no-store' })).json();
    phase('Native first-scene graphics failure');
    await fly('container-yard-08', false);
    await until(
      () => context.w.fpvInitialGraphicsFault?.lost && context.p.data.spans.some((s) => s.error),
      'initial native loss and rejected preparation',
    );
    const fault = context.w.fpvInitialGraphicsFault;
    check(fault.supported, 'native WEBGL_lose_context supported');
    await frames();
    const lost = snapshot('initial native context loss');
    check(
      lost.armDisabled && lost.state.status !== 'active',
      'initial graphics failure keeps arm disabled',
    );
    check(
      context.p.data.draws.length === 0,
      'no intermediate first scene submitted before graphics failure',
    );
    const count = context.p.data.draws.length;
    q('#world-arm').click();
    await frames();
    check(
      context.app.snapshot().state.status !== 'active' && context.p.data.draws.length === count,
      'disabled arm cannot advance or draw failed scene',
    );
    phase('Restore native context and public Retry');
    fault.restore();
    await until(() => fault.restored, 'native context restoration');
    click(q('#world-retry'));
    await ready('container-yard-08');
    check(
      context.p.resources().presentation.actors.length === 2,
      'Yard actors are prepared on the first ready draw',
    );
    phase('Inspect ready Yard scene, then Continue readiness checks');
    $('continue').hidden = false;
    $('receipt').value = JSON.stringify(receipt);
    await new Promise((resolve) => {
      continueRun = resolve;
    });
    context.w.focus();
    phase('Quality, camera and native layout resize');
    for (const value of ['low', 'high', 'balanced']) await quality(value);
    set('flight-camera', 'chase');
    set('world-fov', '90');
    await frames();
    check(snapshot('chase camera').state.status !== 'active', 'camera change remains paused');
    await quality('low');
    frame.style.width = '900px';
    frame.style.height = '520px';
    await frames(8);
    const resized = snapshot('resized ready canvas');
    check(
      Math.abs(resized.canvas.pixels[0] - resized.canvas.css[0]) <= 1 &&
        Math.abs(resized.canvas.pixels[1] - resized.canvas.css[1]) <= 1,
      'Performance canvas follows native layout dimensions',
    );
    frame.style.width = '';
    frame.style.height = '';
    await frames(4);
    phase('Fallback scene and ordinary recovery recording');
    const imports = context.p.data.spans.filter((s) => s.name === 'renderer.loadScene').length;
    await fly('adventure-coast-01');
    check(
      context.p.data.spans.filter((s) => s.name === 'renderer.loadScene').length === imports,
      'Coast uses the real fallback renderer path',
    );
    set('flight-source', 'keyboard');
    q('#world-viewport').focus();
    click(q('#world-arm'));
    await until(
      () => context.p.state()?.status === 'active' && context.p.state().ticks >= 15,
      'ordinary clock advances',
    );
    click(q('#world-pause'));
    await frames();
    const saved = snapshot('paused before native recovery');
    check(
      saved.state.status === 'paused' && saved.state.ticks >= 15,
      'explicit pause retains actual recorded ticks',
    );
    click(q('#leave-flight'));
    await until(() => !q('#flight-dialog').open, 'close saves recovery');
    await finishHost();
    const previousReady = readyCount;
    frame.src = hostPath + '?reopen=1';
    await until(() => readyCount > previousReady, 'fresh host native storage hydration');
    adopt();
    phase('Public recovery after native IDB reopen');
    click(q('[data-tab="packs"]'));
    await until(
      () => q('#resume-flight') && !q('#resume-flight').disabled,
      'public Resume interrupted flight',
    );
    click(q('#resume-flight'));
    await ready('adventure-coast-01');
    const reopened = snapshot('recovered native recording');
    for (const key of ['ticks', 'position', 'orientation', 'velocity'])
      check(
        JSON.stringify(reopened.state[key]) === JSON.stringify(saved.state[key]),
        'native recovery retains ' + key,
      );
    check(
      reopened.course === saved.course && reopened.state.status === 'paused',
      'native recovery retains exact course and deliberate pause',
    );
    receipt.completed = true;
  } catch (error) {
    receipt.failure = String(error?.stack ?? error);
  } finally {
    try {
      if (!context.p.data.finishedAt) await finishHost();
    } catch (error) {
      receipt.disposeFailure = String(error?.stack ?? error);
    }
    try {
      const digest = async (b) =>
        [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))]
          .map((v) => v.toString(16).padStart(2, '0'))
          .join('');
      for (const row of receipt.fixture.files) {
        const response = await fetch((row.fixture ? './' : './player/') + row.path, {
            cache: 'no-store',
          }),
          bytes = await response.arrayBuffer();
        check(
          response.ok && bytes.byteLength === row.bytes && (await digest(bytes)) === row.sha256,
          'frozen bytes: ' + row.path,
        );
      }
    } catch (error) {
      receipt.integrityFailure = String(error?.stack ?? error);
    }
    $('receipt').value = JSON.stringify(receipt);
    document.body.dataset.running = 'false';
    $('status').textContent =
      receipt.completed && !receipt.disposeFailure && !receipt.integrityFailure
        ? 'Readiness checks complete; receipt retained.'
        : 'Stopped; partial readiness receipt retained.';
  }
};
