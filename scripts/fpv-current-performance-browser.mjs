/* global document, addEventListener */
const $ = (id) => document.getElementById(id),
  frame = $('sim');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let context,
  busy = false;
addEventListener('message', (event) => {
  if (event.source !== frame.contentWindow || event.data?.type !== 'fpv-profile-ready') return;
  $('run').disabled = false;
  $('status').textContent = 'Ready. Native clock; one visible player; no FPS claim.';
});
async function until(predicate, label, ms = 25000) {
  const start = performance.now();
  while (!predicate()) {
    if (performance.now() - start > ms) throw Error('Timeout: ' + label);
    await wait(20);
  }
}
function click(node) {
  if (!node || node.disabled) throw Error('Unavailable public control');
  node.click();
}
const q = (selector) => context.d.querySelector(selector);
const check = (value, name) => {
  context.p.data.checks.push({ name, passed: Boolean(value) });
  if (!value) throw Error(name);
};
function set(id, value) {
  const node = q('#' + id);
  node.value = value;
  node.dispatchEvent(new context.w.Event('change', { bubbles: true }));
}
async function frames(count = 18) {
  for (let i = 0; i < count; i++)
    await new Promise(context.w.requestAnimationFrame.bind(context.w));
}
function revealScene() {
  if (q('#beginner-coach')?.dataset.stage !== 'guide') return;
  const span = context.p.begin('ui.guide-start-then-pause');
  click(q('#beginner-coach [data-coach-action="start"]'));
  click(q('#world-pause'));
  context.p.end(span);
  check(
    q('#beginner-coach').dataset.stage === 'live',
    'opaque guide dismissed through public start/pause controls',
  );
}
async function choose(id, cycle) {
  const p = context.p,
    entry = p.entries.find((e) => e.id === id);
  check(entry, 'target exists: ' + id);
  if (q('#flight-dialog').open) {
    click(q('#leave-flight'));
    await until(() => !q('#flight-dialog').open, 'close flight');
  }
  click(q('[data-tab="explore"]'));
  click(q('[data-world="' + entry.world + '"]'));
  const title = entry.course.locales.en.title;
  const fly = [...context.d.querySelectorAll('button[aria-label]')].find(
    (b) => b.getAttribute('aria-label') === 'Fly: ' + title,
  );
  p.data.context = { cycle, courseId: id, phase: 'public-flight-load' };
  const span = p.begin('ui.fly-to-ready', { courseId: id, cycle });
  click(fly);
  await until(
    () =>
      q('#flight-dialog').open &&
      q('#flight-title').textContent === title &&
      q('#flight-status').textContent.startsWith('Ready. Choose'),
    'flight ready ' + id,
  );
  p.end(span);
  check(q('#flight-dialog').dataset.flightState !== 'active', 'loaded paused: ' + id);
  revealScene();
}
async function quality(value) {
  const p = context.p;
  p.data.context = { ...p.data.context, phase: 'public-quality-change', quality: value };
  const span = p.begin('ui.quality-to-ready', { quality: value });
  set('flight-quality', value);
  await until(
    () => q('#flight-status').textContent.startsWith('Graphics ready.'),
    'quality ' + value,
  );
  p.end(span);
  p.data.context = { ...p.data.context, phase: 'paused-draw-window' };
  const drawStart = p.data.draws.length;
  await frames();
  const draws = p.data.draws.slice(drawStart);
  p.data.samples.push({
    ...p.data.context,
    drawCount: draws.length,
    drawnCourseIds: [...new Set(draws.map((d) => d.courseId))],
    state: p.state(),
    resources: p.resources(),
    coachStage: q('#beginner-coach')?.dataset.stage,
    visible: context.d.visibilityState,
    focused: context.d.hasFocus(),
    canvas: (() => {
      const c = q('#world-canvas'),
        r = c.getBoundingClientRect();
      return { css: [r.width, r.height], pixels: [c.width, c.height] };
    })(),
  });
  check(
    draws.length > 0 && draws.every((d) => d.courseId === p.data.context.courseId),
    'paused draws belong to selected course',
  );
}
async function verify(fixture) {
  const digest = async (bytes) =>
    [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('');
  for (const row of fixture.files) {
    const response = await fetch((row.fixture ? './' : './player/') + row.path, {
      cache: 'no-store',
    });
    const bytes = await response.arrayBuffer();
    check(
      response.ok && bytes.byteLength === row.bytes && (await digest(bytes)) === row.sha256,
      'frozen bytes: ' + row.path,
    );
  }
}
$('run').onclick = async () => {
  if (busy) return;
  busy = true;
  $('run').disabled = true;
  document.body.dataset.running = 'true';
  context = {
    w: frame.contentWindow,
    d: frame.contentDocument,
    p: frame.contentWindow.fpvPerformance,
  };
  const p = context.p;
  p.startMeasurement();
  try {
    const fixture = await (await fetch('./fixture.json', { cache: 'no-store' })).json();
    p.data.fixture = fixture;
    p.data.design = {
      cycles: 2,
      targets: ['container-yard-08', 'beginner-40', 'woodland-08'],
      qualities: ['low', 'balanced', 'high'],
      pausedDrawFrames: 18,
      measurement:
        'public UI event dispatch to real host readiness; native RAF/clock; one production flight renderer',
      exclusions:
        'No cold OS/GPU flush, synthetic RAF timestamps, proof completions, sustained hardware FPS or GPU elapsed timing. Document module startup precedes operator start and is reported separately. Opaque lesson guide closes with public Start then immediate Pause before each draw window.',
    };
    frame.contentWindow.focus();
    check(context.d.visibilityState === 'visible', 'host visible at start');
    for (let cycle = 1; cycle <= 2; cycle++) {
      for (const id of p.data.design.targets) {
        $('status').textContent = `Profile cycle ${cycle}/2 · ${id}`;
        await choose(id, cycle);
        for (const value of p.data.design.qualities) await quality(value);
        p.data.context = { cycle, courseId: id, phase: 'same-course-retry' };
        const courseLoads = p.data.spans.filter((s) => s.name === 'renderer.setCourse').length;
        const span = p.begin('ui.retry-to-ready');
        click(q('#world-retry'));
        await until(
          () =>
            p.data.spans.filter((s) => s.name === 'renderer.setCourse').length > courseLoads &&
            q('#flight-status').textContent.startsWith('Ready. Choose'),
          'retry ready',
        );
        p.end(span);
        revealScene();
        await frames(3);
      }
    }
    p.data.context = { phase: 'bounded-active-idle', courseId: 'woodland-08' };
    set('flight-source', 'keyboard');
    q('#world-viewport').focus();
    click(q('#world-arm'));
    await until(() => p.state()?.status === 'active', 'native arm');
    const initial = p.state();
    await wait(2200);
    check(
      p.state()?.status === 'active' && p.state().ticks > initial.ticks,
      'native flight clock advances without input',
    );
    click(q('#world-pause') ?? q('#world-flight-menu'));
    await frames(3);
    check(p.state()?.status !== 'active', 'explicit pause');
    p.data.completed = true;
  } catch (error) {
    p.data.failure = String(error?.stack ?? error);
  } finally {
    try {
      await p.finish();
    } catch (error) {
      p.data.disposeFailure = String(error?.stack ?? error);
    }
    try {
      if (p.data.fixture) await verify(p.data.fixture);
    } catch (error) {
      p.data.integrityFailure = String(error?.stack ?? error);
    }
    $('receipt').value = JSON.stringify(p.data);
    $('status').textContent =
      p.data.completed && !p.data.integrityFailure && !p.data.disposeFailure
        ? 'Profile complete — inspect timings; no performance acceptance claim.'
        : 'Stopped — partial evidence retained.';
    document.body.dataset.running = 'false';
  }
};
