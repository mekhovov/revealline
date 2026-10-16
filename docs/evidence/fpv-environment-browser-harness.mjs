const $ = (id) => document.getElementById(id);
const ROOT = '/optional-practice/civilian-fpv/';
// Repository copy opens the default prepared fixture; generated copies are self-contained.
const fixture = new URL(import.meta.url).pathname.includes('/docs/evidence/')
  ? new URL('../../dist/fpv-environment-verification/', import.meta.url)
  : new URL('./', import.meta.url);
const FROZEN = new URL('./before/', fixture).pathname;
const qualities = ['low', 'balanced', 'high'];
const views = ['fpv', 'chase', 'overview'];
const selected = {
  gym: 'flight-01',
  field: 'flight-05',
  woodland: 'woodland-06',
  courtyard: 'courtyard-06',
  warehouse: 'warehouse-02',
  stadium: 'stadium-07',
  'container-yard': 'container-yard-07',
  garage: 'garage-08',
};
const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};
const copy = (value) => structuredClone(value);
const frame = () => new Promise(requestAnimationFrame);
const sha = async (buffer) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
const fetchJSON = async (url) => {
  const response = await fetch(url, { cache: 'no-store' });
  assert(response.ok, `Missing ${url}`);
  return response.json();
};
async function timeout(promise, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), 45000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const counts = (r) => ({
  ...r.registered,
  gpuGeometries: r.renderer.geometries,
  gpuTextures: r.renderer.textures,
  programs: r.renderer.programs,
});
const stats = (samples) => {
  const sort = [...samples].sort((a, b) => a - b);
  return {
    samples: samples.length,
    min: sort[0],
    median: sort[Math.floor(sort.length / 2)],
    p95: sort[Math.min(sort.length - 1, Math.floor(sort.length * 0.95))],
    max: sort.at(-1),
  };
};
let receipt,
  modules,
  loadedHashes,
  busy = false,
  owners = [];
const baseline = await fetchJSON(new URL('./baseline.json', fixture));
$('baseline').textContent =
  `Frozen baseline ${baseline.head}; 640 × 360 CSS pixels per canvas. Keep this page visible. Reload after editing production files.`;
const status = (text) => {
  $('status').textContent = text;
};
const publish = () => {
  window.fpvEnvironmentReceipt = receipt;
  $('receipt').textContent = JSON.stringify(receipt, null, 2);
  $('download').disabled = !receipt;
};
function record(name, passed, details = {}) {
  receipt.checks.push({ name, passed, ...details });
  publish();
  assert(passed, name);
}
async function hashes(prefix, expected = null) {
  const out = {};
  await Promise.all(
    Object.keys(baseline.files).map(async (path) => {
      const response = await fetch(prefix + path, { cache: 'no-store' });
      assert(response.ok, `Missing ${prefix + path}`);
      const hash = await sha(await response.arrayBuffer());
      out[path] = hash;
      if (expected) assert(hash === expected[path], `Changed source: ${prefix + path}`);
    }),
  );
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}
async function loadModules() {
  if (modules) return;
  const [oldAssets, newAssets, catalogue, currentCatalogue, model, worldModel] = await Promise.all([
    import(FROZEN + ROOT.slice(1) + 'world-assets.mjs'),
    import(ROOT + 'world-assets.mjs'),
    import(FROZEN + ROOT.slice(1) + 'world-catalogue.mjs'),
    import(ROOT + 'world-catalogue.mjs'),
    import(FROZEN + ROOT.slice(1) + 'model.mjs'),
    import(FROZEN + ROOT.slice(1) + 'world-model.mjs'),
  ]);
  await worldModel.initWorldRuntime();
  modules = { oldAssets, newAssets, catalogue, currentCatalogue, model, worldModel };
  const options = catalogue.FLIGHT_WORLDS.map((w) => {
    const o = document.createElement('option');
    o.value = w.id;
    o.textContent = w.title.en;
    return o;
  });
  const chosenWorld = $('world').value;
  $('world').replaceChildren(...options);
  if (catalogue.FLIGHT_WORLDS.some((w) => w.id === chosenWorld)) $('world').value = chosenWorld;
}
function entries() {
  return modules.catalogue.FLIGHT_WORLDS.map((world) => {
    const before = modules.catalogue.WORLD_CATALOGUE.find((e) => e.id === selected[world.id]);
    const after = modules.currentCatalogue.WORLD_CATALOGUE.find((e) => e.id === selected[world.id]);
    assert(before && after, `Missing representative course ${world.id}`);
    assert(
      JSON.stringify(before.course) === JSON.stringify(after.course),
      `Gameplay course changed: ${before.id}; comparison must use identical courses`,
    );
    return { world, entry: before };
  });
}
function createOwners() {
  owners = ['before', 'after'].map((label, index) => {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', `${label} actual simulator renderer`);
    $(label).replaceChildren(canvas);
    const runtime = (index === 0 ? modules.oldAssets : modules.newAssets).createFlightRenderer({
      canvas,
      window,
      onContextLost: () => {
        if (receipt) receipt.contextLosses.push({ label, status: $('status').textContent });
      },
    });
    assert(runtime.available, `${label} WebGL unavailable`);
    const gl = canvas.getContext('webgl2');
    return {
      label,
      canvas,
      runtime,
      gl,
      assets: index === 0 ? modules.oldAssets : modules.newAssets,
    };
  });
}
function disposeOwners() {
  const disposed = [];
  for (const owner of owners) {
    owner.runtime.dispose();
    disposed.push({ label: owner.label, resources: copy(owner.runtime.resources()) });
  }
  owners = [];
  return disposed;
}
function glErrors(gl) {
  const errors = [];
  for (let i = 0; i < 16; i++) {
    const e = gl.getError();
    if (e === gl.NO_ERROR) break;
    errors.push(e);
  }
  return errors;
}
function snapshots(entry) {
  const flight = (entry.legacy ? modules.model.createFlight : modules.worldModel.createWorldFlight)(
    { course: entry.course, mode: 'acro' },
  );
  const frames = [];
  try {
    flight.arm();
    for (let tick = 0; tick < 160; tick++) {
      const command = {
        roll: tick > 70 && tick < 90 ? 0.025 : 0,
        pitch: tick > 90 && tick < 110 ? 0.03 : 0,
        yaw: tick > 120 ? 0.04 : 0,
        throttle: tick < 45 ? 0.63 : 0.49,
      };
      if (!entry.legacy) command.actions = 0;
      const state = flight.step(command);
      if (tick >= 32) frames.push(state);
    }
    return {
      frames,
      identity: copy(flight.identity),
      actorTypes: [...new Set((entry.course.actors ?? []).map((a) => a.type))],
    };
  } finally {
    flight.dispose?.();
  }
}
async function loadCourse(owner, entry, imported = true) {
  owner.runtime.setCourse(entry.course, 'acro');
  const start = performance.now();
  const blob = imported ? owner.assets.builtinWorldScene(entry.course) : null;
  let data = null;
  if (blob) {
    const bytes = await blob.arrayBuffer();
    const view = new DataView(bytes);
    assert(
      view.getUint32(0, true) === 0x46546c67 && view.getUint32(4, true) === 2,
      `${owner.label} ${entry.id}: expected actual GLB2`,
    );
    const json = JSON.parse(
      new TextDecoder().decode(new Uint8Array(bytes, 20, view.getUint32(12, true))),
    );
    data = {
      byteLength: bytes.byteLength,
      sha256: await sha(bytes),
      nodes: json.nodes?.length ?? 0,
      meshes: json.meshes?.length ?? 0,
      images: json.images?.length ?? 0,
      placements: json.asset.extras?.placements?.length ?? 0,
      extensionsUsed: json.extensionsUsed ?? [],
      instancedNodes: (json.nodes ?? []).filter((n) => n.extensions?.EXT_mesh_gpu_instancing)
        .length,
      instancedPlacements: (json.nodes ?? []).reduce((sum, n) => {
        const index = n.extensions?.EXT_mesh_gpu_instancing?.attributes?.TRANSLATION;
        return sum + (index === undefined ? 0 : (json.accessors?.[index]?.count ?? 0));
      }, 0),
    };
    await timeout(owner.runtime.loadScene(blob), 'GLB scene load');
  }
  assert(
    await timeout(owner.runtime.prepare(), 'Course shader preparation'),
    `${owner.label} course prepare failed`,
  );
  return { imported: !!blob, asset: data, loadAndPrepareMs: performance.now() - start };
}
async function preparePair(entry, quality, drone) {
  const times = {};
  for (const owner of owners) {
    owner.runtime.setQuality(quality);
    owner.runtime.setDrone(drone);
    const start = performance.now();
    assert(
      await timeout(owner.runtime.prepare(), 'Quality shader preparation'),
      `${owner.label} quality prepare failed`,
    );
    times[owner.label] = performance.now() - start;
  }
  return times;
}
async function samplePair(frames, cameraMode, round, measure = 6) {
  const data = Object.fromEntries(
    owners.map((o) => [
      o.label,
      { submit: [], cadence: [], calls: [], triangles: [], resources: null },
    ]),
  );
  const immutable = JSON.stringify(frames);
  const order = round % 2 ? [...owners] : [...owners].reverse();
  for (const owner of order) {
    for (let i = 0; i < 3; i++) {
      await frame();
      owner.runtime.draw(frames[i], { cameraMode });
    }
    let previous = null;
    for (let i = 0; i < measure; i++) {
      const timestamp = await frame();
      if (document.visibilityState !== 'visible')
        throw new Error('Page became hidden: timings invalid. Keep the verification tab visible.');
      if (previous !== null) data[owner.label].cadence.push(timestamp - previous);
      previous = timestamp;
      const start = performance.now();
      owner.runtime.draw(frames[20 + i], { cameraMode });
      data[owner.label].submit.push(performance.now() - start);
      const resource = owner.runtime.resources();
      data[owner.label].calls.push(resource.renderer.calls);
      data[owner.label].triangles.push(resource.renderer.triangles);
      data[owner.label].resources = copy(resource);
    }
    const errors = glErrors(owner.gl);
    assert(!errors.length, `${owner.label} ${cameraMode} GL errors ${errors}`);
  }
  assert(
    JSON.stringify(frames) === immutable,
    'Renderer mutated supplied fixed-step physics snapshots',
  );
  return Object.fromEntries(
    Object.entries(data).map(([label, d]) => [
      label,
      {
        view: cameraMode,
        submitMs: stats(d.submit),
        rafCadenceMs: stats(d.cadence),
        calls: stats(d.calls),
        triangles: stats(d.triangles),
        resources: d.resources,
        glErrors: [],
      },
    ]),
  );
}
async function run() {
  if (busy) return;
  busy = true;
  $('run').disabled = true;
  $('preview').disabled = true;
  disposeOwners();
  receipt = {
    format: 'fpv-environment-browser-comparison.v1',
    baselineHead: baseline.head,
    startedAt: new Date().toISOString(),
    scope:
      'Actual browser WebGL functional comparison. Submission timing is synchronous renderer.draw CPU/driver work; rAF cadence includes browser scheduling. Neither is GPU time, sustained fps, VRAM, end-to-end input latency, physical-device qualification, or visual/player acceptance.',
    browser: {
      userAgent: navigator.userAgent,
      dpr: devicePixelRatio,
      viewport: [innerWidth, innerHeight],
      canvasCss: [640, 360],
    },
    rounds: 3,
    measuredDrawsPerView: 6,
    checks: [],
    samples: [],
    fallback: [],
    contextLosses: [],
    consoleErrors: [],
    completed: false,
    passed: false,
  };
  const error = console.error;
  console.error = (...a) => {
    receipt.consoleErrors.push(a.map(String).join(' '));
    error(...a);
  };
  try {
    status('Binding baseline and current source hashes…');
    receipt.beforeSources = await hashes(FROZEN, baseline.files);
    receipt.afterSources = await hashes('/');
    if (loadedHashes)
      assert(
        JSON.stringify(loadedHashes) === JSON.stringify(receipt.afterSources),
        'Production source changed after modules loaded. Reload this page before running.',
      );
    loadedHashes = receipt.afterSources;
    await loadModules();
    const rows = entries();
    assert(rows.length === 8, 'Expected eight worlds');
    const traces = new Map(rows.map((row) => [row.world.id, snapshots(row.entry)]));
    receipt.actorTypes = [...new Set([...traces.values()].flatMap((t) => t.actorTypes))].sort();
    record(
      'Actual authored courses cover all five actor types',
      JSON.stringify(receipt.actorTypes) ===
        JSON.stringify(['drone', 'hazard', 'patrol', 'sentry', 'vehicle']),
    );
    createOwners();
    receipt.webgl = owners.map((o) => ({
      label: o.label,
      version: o.gl.getParameter(o.gl.VERSION),
      renderer: o.gl.getParameter(o.gl.RENDERER),
      vendor: o.gl.getParameter(o.gl.VENDOR),
      maxTextureSize: o.gl.getParameter(o.gl.MAX_TEXTURE_SIZE),
    }));
    for (let round = 1; round <= 3; round++)
      for (const { world, entry } of rows) {
        status(`Round ${round}/3 · ${world.title.en} · loading both actual scenes…`);
        const assets = {};
        for (const owner of owners) assets[owner.label] = await loadCourse(owner, entry);
        const drone =
          world.theme === 'pixel' ? 'pixel' : world.theme === 'operations' ? 'utility' : 'racer';
        const trace = traces.get(world.id);
        for (const quality of qualities) {
          status(`Round ${round}/3 · ${world.title.en} · ${quality} · paired views`);
          const prepareMs = await preparePair(entry, quality, drone);
          for (const view of views) {
            const pair = await samplePair(trace.frames, view, round);
            receipt.samples.push({
              round,
              world: world.id,
              course: entry.id,
              quality,
              drone,
              view,
              assets,
              actorTypes: trace.actorTypes,
              identity: trace.identity,
              prepareMs,
              ...pair,
            });
          }
          publish();
        }
      }
    record(
      'Eight worlds × three presets × three views × three rounds × two renderers',
      receipt.samples.length === 216,
      { pairedConfigurations: 216, rendererConfigurations: 432, measuredDraws: 216 * 2 * 6 },
    );
    record(
      'Six worlds load actual builtin GLB scenery in both renderers',
      new Set(
        receipt.samples
          .filter((s) => s.assets.before.imported && s.assets.after.imported)
          .map((s) => s.world),
      ).size === 6,
    );
    const plateau = [];
    for (const { world } of rows)
      for (const quality of qualities)
        for (const label of ['before', 'after']) {
          const samples = receipt.samples.filter(
            (s) => s.world === world.id && s.quality === quality && s.view === 'overview',
          );
          const a = counts(samples[1][label].resources),
            b = counts(samples[2][label].resources);
          plateau.push({
            world: world.id,
            quality,
            label,
            round2: a,
            round3: b,
            stable: JSON.stringify(a) === JSON.stringify(b),
          });
        }
    record(
      'Owned resource counts plateau between rounds two and three',
      plateau.every((p) => p.stable),
      { comparison: plateau },
    );
    for (const { world, entry } of rows) {
      status(`Fallback scenery · ${world.title.en}`);
      for (const owner of owners) await loadCourse(owner, entry, false);
      await preparePair(entry, 'balanced', 'racer');
      receipt.fallback.push({
        world: world.id,
        ...(await samplePair(traces.get(world.id).frames, 'overview', 1, 2)),
      });
    }
    record(
      'All eight procedural fallback worlds render without imported scenery',
      receipt.fallback.length === 8,
    );
    const paused = [];
    for (const owner of owners) {
      const state = traces.get('garage').frames[30];
      owner.runtime.draw(state, { cameraMode: 'overview' });
      const a = copy(owner.runtime.resources());
      await frame();
      owner.runtime.draw(state, { cameraMode: 'overview' });
      const b = copy(owner.runtime.resources());
      paused.push({
        label: owner.label,
        unchangedCounts:
          a.renderer.calls === b.renderer.calls && a.renderer.triangles === b.renderer.triangles,
      });
    }
    record(
      'Paused snapshot redraw remains observer-only with stable counters',
      paused.every((p) => p.unchangedCounts),
      { samples: paused },
    );
    receipt.disposed = disposeOwners();
    record(
      'Both renderers dispose all registered scene resources',
      receipt.disposed.every(
        (o) => Object.values(o.resources.registered).every((v) => v === 0) && o.resources.disposed,
      ),
      { resources: receipt.disposed },
    );
    receipt.beforeSourcesAfter = await hashes(FROZEN, baseline.files);
    receipt.afterSourcesAfter = await hashes('/', receipt.afterSources);
    record('Source bytes remain unchanged throughout measurement', true);
    record('No unexpected context loss', receipt.contextLosses.length === 0, {
      events: receipt.contextLosses,
    });
    record('No graphics console errors', receipt.consoleErrors.length === 0, {
      errors: receipt.consoleErrors,
    });
    receipt.summary = rows.flatMap(({ world }) =>
      qualities.map((quality) => {
        const samples = receipt.samples.filter(
          (s) => s.world === world.id && s.quality === quality && s.round > 1,
        );
        const median = (label, property) =>
          stats(samples.map((s) => s[label][property].median)).median;
        return {
          world: world.id,
          quality,
          before: {
            calls: median('before', 'calls'),
            triangles: median('before', 'triangles'),
            submitMs: median('before', 'submitMs'),
          },
          after: {
            calls: median('after', 'calls'),
            triangles: median('after', 'triangles'),
            submitMs: median('after', 'submitMs'),
          },
        };
      }),
    );
    receipt.completed = true;
    receipt.passed = receipt.checks.every((c) => c.passed);
    status(
      'Checks passed. Download the source-bound receipt. Timings are browser harness measurements, not hardware qualification.',
    );
  } catch (e) {
    receipt.failure = { name: e.name, message: e.message, stack: e.stack };
    status(`Stopped: ${e.message}`);
    try {
      receipt.disposedAfterFailure = disposeOwners();
    } catch (d) {
      receipt.disposalError = String(d);
    }
  } finally {
    receipt.finishedAt = new Date().toISOString();
    console.error = error;
    publish();
    busy = false;
    $('run').disabled = false;
    $('preview').disabled = false;
  }
}
$('run').addEventListener('click', run);
$('preview').addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  $('run').disabled = true;
  $('preview').disabled = true;
  try {
    const current = await hashes('/');
    if (loadedHashes)
      assert(
        JSON.stringify(current) === JSON.stringify(loadedHashes),
        'Source changed: reload first',
      );
    loadedHashes = current;
    await loadModules();
    disposeOwners();
    createOwners();
    const row = entries().find((r) => r.world.id === $('world').value) ?? entries()[0];
    for (const owner of owners) await loadCourse(owner, row.entry, !$('fallback').checked);
    await preparePair(row.entry, $('quality').value, $('drone').value);
    const trace = snapshots(row.entry);
    await samplePair(trace.frames, $('view').value, 1, 3);
    status(
      `Preview: ${row.world.title.en}, ${$('quality').value}, ${$('view').value}. Both use identical actual physics snapshots.`,
    );
  } catch (e) {
    status(`Preview failed: ${e.message}`);
  } finally {
    busy = false;
    $('run').disabled = false;
    $('preview').disabled = false;
  }
});
$('download').addEventListener('click', () => {
  if (!receipt) return;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(receipt, null, 2) + '\n'], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fpv-environment-browser-comparison-20261002.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('reload').addEventListener('click', () => location.reload());
for (const [id, label] of Object.entries(selected)) {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = id;
  $('world').append(option);
}
status(
  'Ready. Click Run comparison; keep this page visible. Approximately 1–3 minutes depending on rendering cost.',
);
