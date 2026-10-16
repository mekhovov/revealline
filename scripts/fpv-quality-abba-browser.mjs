/* global document, addEventListener */
const $ = (id) => document.getElementById(id),
  frame = $('sim');
const receipt = { format: 'FPVWarmQualityABBA.v1', checks: [], samples: [], stages: [] };
let context,
  readyCount = 0,
  busy = false;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const q = (s) => context.d.querySelector(s);
function check(value, name) {
  receipt.checks.push({ name, passed: Boolean(value) });
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
async function frames(n = 6) {
  for (let i = 0; i < n; i++) await new Promise(context.w.requestAnimationFrame.bind(context.w));
}
addEventListener('message', (event) => {
  if (event.source === frame.contentWindow && event.data?.type === 'fpv-profile-ready')
    readyCount++;
});
async function mount(variant, block) {
  const previous = readyCount;
  frame.src = variant + '/host.html?abba=' + block;
  await until(() => readyCount > previous, 'native host ready');
  context = {
    w: frame.contentWindow,
    d: frame.contentDocument,
    p: frame.contentWindow.fpvPerformance,
  };
  context.w.focus();
  context.p.startMeasurement();
  context.p.data.context = { variant, block, phase: 'course-warmup' };
}
async function choose(id) {
  if (q('#flight-dialog').open) {
    click(q('#leave-flight'));
    await until(() => !q('#flight-dialog').open, 'close prior course');
  }
  const entry = context.p.entries.find((e) => e.id === id);
  check(entry, 'target exists: ' + id);
  click(q('[data-tab="explore"]'));
  click(q('[data-world="' + entry.world + '"]'));
  const title = entry.course.locales.en.title;
  click(
    [...context.d.querySelectorAll('button[aria-label]')].find(
      (n) => n.getAttribute('aria-label') === 'Fly: ' + title,
    ),
  );
  await until(
    () =>
      q('#flight-status').textContent.startsWith('Ready. Choose') &&
      context.p.state()?.courseId === id,
    'correct ready course ' + id,
  );
  context.p.data.context = { ...context.p.data.context, courseId: id };
  await frames();
}
async function quality(value, cycle) {
  const p = context.p;
  p.data.context = {
    ...p.data.context,
    quality: value,
    cycle,
    phase: cycle ? 'measured-quality' : 'warm-quality',
  };
  const span = p.begin('abba.quality-to-ready'),
    drawStart = p.data.draws.length;
  await new Promise((resolve, reject) => {
    let timer;
    const observer = new context.w.MutationObserver(() => {
      if (!q('#flight-status').textContent.startsWith('Graphics ready.')) return;
      p.end(span);
      observer.disconnect();
      clearTimeout(timer);
      resolve();
    });
    observer.observe(q('#flight-status'), { childList: true, subtree: true, characterData: true });
    timer = setTimeout(() => {
      observer.disconnect();
      reject(Error('Quality readiness timeout'));
    }, 25000);
    try {
      set('flight-quality', value);
    } catch (e) {
      observer.disconnect();
      clearTimeout(timer);
      reject(e);
    }
  });
  await frames();
  const draws = p.data.draws.slice(drawStart),
    preparation = p.data.spans
      .filter((s) => s.name === 'renderer.prepare' && s.start >= span.start && s.end <= span.end)
      .at(-1);
  const first =
    preparation &&
    draws.find(
      (d) => d.at - d.cpuSubmissionMs >= preparation.end && d.courseId === p.data.context.courseId,
    );
  check(first, 'selected course draws after completed preparation');
  check(context.d.visibilityState === 'visible' && context.d.hasFocus(), 'visible focused sample');
  check(
    p.state().status !== 'active' && p.state().ticks === 0,
    'quality sample remains disarmed at zero ticks',
  );
  if (cycle)
    receipt.samples.push({
      ...p.data.context,
      readyMs: span.wallMs,
      dispatchToFirstPostPrepareDrawEndMs: first.at - span.start,
      firstDrawCPUSubmissionMs: first.cpuSubmissionMs,
      firstPostPrepareDrawDelayMs: first.at - preparation.end,
      preparationMs: preparation.wallMs,
      state: p.state(),
      resources: p.resources(),
      visible: context.d.visibilityState,
      focused: context.d.hasFocus(),
    });
}
async function finish() {
  if (!context || context.p.data.finishedAt) return;
  await context.p.finish();
  receipt.stages.push(context.p.data);
  check(
    context.p.data.errors.length === 0 && context.p.data.warnings.length === 0,
    'no errors or warnings in block',
  );
  check(
    Object.values(context.p.data.disposedResources.registered).every((n) => n === 0),
    'block releases owned graphics',
  );
}
$('run').onclick = async () => {
  if (busy) return;
  busy = true;
  $('run').disabled = true;
  document.body.dataset.running = 'true';
  try {
    const fixture = (receipt.fixture = await (
      await fetch('./fixture.json', { cache: 'no-store' })
    ).json());
    for (const [index, variant] of fixture.order.entries()) {
      await mount(variant, index + 1);
      for (const target of fixture.targets) {
        $('status').textContent = `Block ${index + 1}/4 (${variant}) · ${target}`;
        await choose(target);
        for (const value of fixture.qualities) await quality(value, 0);
        for (let cycle = 1; cycle <= fixture.cycles; cycle++)
          for (const value of fixture.qualities) await quality(value, cycle);
      }
      await finish();
    }
    check(receipt.samples.length === 96, 'all96predeclared samples retained');
    receipt.completed = true;
  } catch (error) {
    receipt.failure = String(error?.stack ?? error);
  } finally {
    try {
      await finish();
    } catch (error) {
      receipt.disposeFailure = String(error?.stack ?? error);
    }
    try {
      const digest = async (b) =>
        [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))]
          .map((v) => v.toString(16).padStart(2, '0'))
          .join('');
      for (const [variant, descriptor] of Object.entries(receipt.fixture.variants))
        for (const row of descriptor.files) {
          const response = await fetch(variant + '/' + (row.fixture ? '' : 'player/') + row.path, {
              cache: 'no-store',
            }),
            bytes = await response.arrayBuffer();
          check(
            response.ok && bytes.byteLength === row.bytes && (await digest(bytes)) === row.sha256,
            'frozen ' + variant + ': ' + row.path,
          );
        }
      for (const row of receipt.fixture.harness) {
        const response = await fetch(row.path, { cache: 'no-store' }),
          bytes = await response.arrayBuffer();
        check(
          response.ok && bytes.byteLength === row.bytes && (await digest(bytes)) === row.sha256,
          'frozen harness: ' + row.path,
        );
      }
    } catch (error) {
      receipt.integrityFailure = String(error?.stack ?? error);
    }
    $('receipt').value = JSON.stringify(receipt);
    document.body.dataset.running = 'false';
    $('status').textContent =
      receipt.completed && !receipt.disposeFailure && !receipt.integrityFailure
        ? 'ABBA complete; inspect mixed timings, no FPS claim.'
        : 'Stopped; all partial evidence retained.';
  }
};
