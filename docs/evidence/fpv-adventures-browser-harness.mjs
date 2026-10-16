const $ = (id) => document.getElementById(id);
const ROOT = '/optional-practice/civilian-fpv/';
const fixture = new URL(import.meta.url).pathname.includes('/docs/evidence/')
  ? new URL('../../dist/fpv-adventures-verification/', import.meta.url)
  : new URL('./', import.meta.url);
const qualities = ['low', 'balanced', 'high'],
  views = ['fpv', 'chase', 'overview'];
const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};
const copy = structuredClone,
  frame = () => new Promise(requestAnimationFrame);
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const sha = async (buffer) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
async function deadline(promise, name) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${name} exceeded 45 seconds`)), 45000);
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
let modules,
  manifest,
  owner,
  receipt,
  busy = false;
const status = (message) => {
  $('status').textContent = message;
};
function publish() {
  $('receipt').textContent = JSON.stringify(receipt, null, 2);
  $('download').disabled = !receipt;
}
function record(name, passed, details = {}) {
  receipt.checks.push({ name, passed, ...details });
  publish();
}
async function sourceHashes() {
  const result = {};
  for (const [relative, expected] of Object.entries(manifest.files)) {
    const response = await fetch('/' + relative, { cache: 'no-store' });
    assert(response.ok, `Missing bound source: ${relative}`);
    const bytes = await response.arrayBuffer(),
      actual = await sha(bytes);
    assert(
      actual === expected.sha256 && bytes.byteLength === expected.bytes,
      `Source changed: ${relative}. Prepare a fresh fixture and reload it.`,
    );
    result[relative] = actual;
  }
  return result;
}
async function load() {
  if (modules) return;
  const [assets, catalogue, model, response] = await Promise.all([
    import(ROOT + 'world-assets.mjs'),
    import(ROOT + 'world-catalogue.mjs'),
    import(ROOT + 'world-model.mjs'),
    import(ROOT + 'radio-profile.mjs'),
  ]);
  await model.initWorldRuntime();
  assert(catalogue.ADVENTURE_COURSES?.length === 30, 'Expected exactly 30 authored adventures');
  assert(
    new Set(catalogue.ADVENTURE_COURSES.map((c) => c.environment)).size === 6,
    'Expected six adventure worlds',
  );
  modules = { assets, catalogue, model, response };
  for (const course of catalogue.ADVENTURE_COURSES) {
    const option = document.createElement('option');
    option.value = course.id;
    option.textContent = course.locales.en.title;
    $('course').append(option);
  }
}
function makeOwner(reducedMotion = false) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Actual simulator rendering');
  $('viewport').replaceChildren(canvas);
  const runtime = modules.assets.createFlightRenderer({
    canvas,
    window,
    reducedMotion,
    onContextLost: () => {
      if (receipt) receipt.contextLosses.push({ stage: $('status').textContent });
    },
  });
  assert(runtime.available, 'WebGL renderer is unavailable');
  return { canvas, runtime, gl: canvas.getContext('webgl2') };
}
function disposeOwner() {
  if (!owner) return null;
  owner.runtime.dispose();
  const after = owner.runtime.resources();
  owner = null;
  assert(
    after.registered.geometries === 0 &&
      after.registered.materials === 0 &&
      after.registered.textures === 0,
    'Disposed renderer retained registered scene resources',
  );
  return copy(after);
}
async function loadCourse(course) {
  owner.runtime.setCourse(course, 'self-level');
  const blob = modules.assets.builtinWorldScene(course);
  if (blob) await deadline(owner.runtime.loadScene(blob), `Load ${course.id}`);
  assert(
    await deadline(owner.runtime.prepare(), `Prepare ${course.id}`),
    `Shader preparation rejected ${course.id}`,
  );
  return { importedBytes: blob?.size ?? 0 };
}
function glErrors() {
  const errors = [];
  for (let i = 0; i < 16; i++) {
    const error = owner.gl.getError();
    if (error === owner.gl.NO_ERROR) break;
    errors.push(error);
  }
  return errors;
}
function checkActors(state, r) {
  assert(
    r.presentation.actors.length === state.actors.length,
    'Actor count differs from authoritative snapshot',
  );
  for (const actor of state.actors) {
    const row = r.presentation.actors.find((a) => a.id === actor.id);
    assert(
      row &&
        ['x', 'y', 'z'].every(
          (axis, i) => Math.abs(row.position[i] - actor.position[axis] / 1000) < 1e-8,
        ),
      `Actor position drift: ${actor.id}`,
    );
    assert(Number.isFinite(row.heading), `Invalid actor heading: ${actor.id}`);
    assert(
      [...row.rotors, ...row.wheels, ...row.limbs].every(Number.isFinite),
      `Invalid actor animation pose: ${actor.id}`,
    );
  }
}
async function draw(state, view, { wait = true } = {}) {
  if (wait) await frame();
  assert(
    document.visibilityState === 'visible',
    'Verification page became hidden; keep it visible and rerun',
  );
  const before = JSON.stringify(state);
  owner.runtime.draw(state, { cameraMode: view });
  assert(JSON.stringify(state) === before, 'Renderer mutated an authoritative snapshot');
  const r = copy(owner.runtime.resources());
  assert(!r.renderer.contextLost, 'Graphics context lost');
  assert(r.renderer.calls > 0 && r.renderer.triangles > 0, 'Renderer submitted an empty view');
  assert(glErrors().length === 0, 'WebGL reported an error');
  checkActors(state, r);
  return r;
}
function initialSnapshots(course) {
  const flight = modules.model.createWorldFlight({ course, mode: 'self-level' }),
    frames = [];
  try {
    flight.arm();
    frames.push(flight.snapshot());
    for (let tick = 0; tick < 120; tick++) {
      const s = flight.step({
        roll: 0,
        pitch: 0,
        yaw: 0,
        throttle: tick < 40 ? 0.63 : 0.5,
        actions: 0,
      });
      if ([39, 79, 119].includes(tick)) frames.push(s);
    }
    return frames;
  } finally {
    flight.dispose();
  }
}
function rateInput(rate) {
  const { DEFAULT_RESPONSE: response, responseCurve } = modules.response;
  const wanted = clamp(rate / (response.maxRate * 100), -1, 1) * 1000;
  let lo = -1000,
    hi = 1000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (responseCurve(mid, response.expo) < wanted) lo = mid + 1;
    else hi = mid;
  }
  return lo / 1000;
}
function pilot(state) {
  const target = state.target,
    response = modules.response.DEFAULT_RESPONSE;
  let point,
    heading = target.heading ?? 0;
  if (target.type === 'actor-track-v1') {
    const actor = state.actors.find((a) => a.id === target.actorId);
    point = { x: actor.position.x, y: actor.position.y + 3000, z: actor.position.z + 6000 };
    heading =
      (Math.atan2(actor.position.x - state.position.x, state.position.z - actor.position.z) *
        18000) /
      Math.PI;
  } else {
    assert(
      target.min && target.max,
      `Tracking fixture pilot needs an initial hold, received ${target.type}`,
    );
    point = Object.fromEntries(
      ['x', 'y', 'z'].map((axis) => [axis, (target.min[axis] + target.max[axis]) / 2]),
    );
  }
  const yaw = (state.attitude.yaw * Math.PI) / 18000,
    ax = clamp((point.x - state.position.x) * 0.8 - state.velocity.x * 1.9, -2600, 2600),
    az = clamp((point.z - state.position.z) * 0.8 - state.velocity.z * 1.9, -2600, 2600),
    roll = (Math.atan2(ax * Math.cos(yaw) + az * Math.sin(yaw), 9810) * 18000) / Math.PI,
    pitch = (Math.atan2(ax * Math.sin(yaw) - az * Math.cos(yaw), 9810) * 18000) / Math.PI;
  return {
    roll: rateInput((roll / (response.maxTilt * 100)) * response.maxRate * 100),
    pitch: rateInput((pitch / (response.maxTilt * 100)) * response.maxRate * 100),
    yaw: rateInput(
      (((heading - state.attitude.yaw + 54000) % 36000) - 18000) * 2.8 - state.angular.yaw * 0.65,
    ),
    throttle: clamp(
      (9810 + clamp((point.y - state.position.y) * 1.7 - state.velocity.y * 2.7, -4500, 4500)) /
        (19620 * Math.max(0.3, state.attitude.up.y / 1000000)),
      0,
      0.9,
    ),
    actions: 0,
  };
}
async function trackingSnapshots(course) {
  const flight = modules.model.createWorldFlight({ course, mode: 'self-level' }),
    initial = flight.snapshot();
  try {
    flight.arm();
    let state = flight.snapshot();
    while (
      state.target?.type !== 'actor-track-v1' &&
      state.ticks < 1800 &&
      state.status === 'active'
    ) {
      state = flight.step(pilot(state));
      if (state.ticks % 150 === 0) await frame();
    }
    assert(
      state.target?.type === 'actor-track-v1',
      `${course.id}: real control pilot did not reach tracking; tick${state.ticks},step${state.step},status${state.status},contacts${state.contacts}`,
    );
    const snapshots = [state],
      targetIndex = state.step;
    for (let i = 0; i < 60 && state.step === targetIndex && state.status === 'active'; i++) {
      state = flight.step(pilot(state));
      if (state.step === targetIndex && i % 10 === 9) snapshots.push(state);
    }
    assert(snapshots.length >= 2, 'Tracking samples ended before actor movement was available');
    flight.pause();
    const paused = flight.snapshot();
    flight.step({ roll: 1, pitch: 1, yaw: 1, throttle: 1, actions: 1 });
    assert(
      JSON.stringify(flight.snapshot()) === JSON.stringify(paused),
      'Paused flight consumed a command',
    );
    return { initial, snapshots, paused, targetIndex };
  } finally {
    flight.dispose();
  }
}
function validateGoals(course, state, resource) {
  assert(
    Array.isArray(resource.presentation.actorGoals),
    'Renderer must expose actorGoals diagnostics',
  );
  for (const goal of resource.presentation.actorGoals) {
    const subject = state.actors.find((a) => a.id === goal.actorId),
      active = goal.index === state.step && !!subject && subject.health > 0;
    assert(goal.visible === active, `Wrong tracking marker visibility: ${course.id}/${goal.index}`);
    if (!active) continue;
    const definition = course.actors.find((a) => a.id === goal.actorId),
      expected = [
        subject.position.x / 1000,
        (subject.position.y + (definition.height ?? 1000)) / 1000 + 0.25,
        subject.position.z / 1000,
      ];
    assert(
      expected.every((value, i) => Math.abs(value - goal.position[i]) < 1e-8),
      `Tracking cue drift: ${goal.actorId}`,
    );
    assert(
      goal.facingCamera === true,
      `Tracking marker does not face the ${$('view').value} camera`,
    );
  }
}
async function matrix() {
  const cases = [];
  for (const course of modules.catalogue.ADVENTURE_COURSES) {
    status(`Render ${course.id} · all graphics presets and views`);
    const original = JSON.stringify(course),
      frames = initialSnapshots(course),
      asset = await loadCourse(course);
    for (const quality of qualities) {
      owner.runtime.setQuality(quality);
      assert(
        await deadline(owner.runtime.prepare(), 'Tier shader preparation'),
        'Tier preparation failed',
      );
      for (const view of views) {
        let resource;
        for (const state of frames.slice(1)) resource = await draw(state, view);
        assert(
          resource.presentation.actors.every((a) => a.quality === quality),
          'Actor graphics tier was not rebuilt',
        );
        validateGoals(course, frames.at(-1), resource);
        cases.push({
          course: course.id,
          world: course.environment,
          quality,
          view,
          tick: frames.at(-1).ticks,
          ...asset,
          calls: resource.renderer.calls,
          triangles: resource.renderer.triangles,
          resources: counts(resource),
          actorTypes: [...new Set(course.actors.map((a) => a.type))],
        });
      }
    }
    assert(JSON.stringify(course) === original, `Authored course mutated: ${course.id}`);
  }
  receipt.configurations = cases;
  record(
    'All30 authored courses ×3 presets ×3 camera views render immutable real snapshots',
    cases.length === 270,
    { configurations: cases.length },
  );
}
async function trackSubjects() {
  const courses = modules.catalogue.ADVENTURE_COURSES.filter((c) =>
    c.steps['self-level'].some((s) => s.type === 'actor-track-v1'),
  );
  for (const course of courses) {
    status(`Tracking cue and actor animation · ${course.id}`);
    const sampled = await trackingSnapshots(course);
    await loadCourse(course);
    let animated = false,
      moved = false;
    for (const quality of qualities) {
      owner.runtime.setQuality(quality);
      await deadline(owner.runtime.prepare(), 'Actor tier preparation');
      validateGoals(course, sampled.initial, await draw(sampled.initial, 'overview'));
      for (const view of views) {
        let previous;
        for (const state of sampled.snapshots) {
          const r = await draw(state, view);
          validateGoals(course, state, r);
          if (previous)
            for (const row of r.presentation.actors) {
              const old = previous.presentation.actors.find((a) => a.id === row.id);
              moved ||= JSON.stringify(row.position) !== JSON.stringify(old.position);
              animated ||=
                JSON.stringify([row.rotors, row.wheels, row.limbs]) !==
                JSON.stringify([old.rotors, old.wheels, old.limbs]);
            }
          previous = r;
        }
        const frozen = await draw(sampled.paused, view),
          repeated = await draw(sampled.paused, view);
        assert(
          JSON.stringify(frozen.presentation) === JSON.stringify(repeated.presentation),
          `Paused actor/cue pose changed: ${course.id}`,
        );
      }
    }
    assert(moved && animated, `No actual moving/animated subject was observed: ${course.id}`);
    record(`Moving subject cue and paused pose · ${course.id}`, true, {
      actualStartTick: sampled.snapshots[0].ticks,
      actualEndTick: sampled.snapshots.at(-1).ticks,
      targetIndex: sampled.targetIndex,
      moved,
      animated,
    });
  }
}
async function resourceCycles() {
  const selected = [...new Set(modules.catalogue.ADVENTURE_COURSES.map((c) => c.environment))].map(
    (world) =>
      modules.catalogue.ADVENTURE_COURSES.find(
        (c) =>
          c.environment === world && c.steps['self-level'].some((s) => s.type === 'actor-track-v1'),
      ),
  );
  const rounds = [];
  for (let round = 0; round < 3; round++) {
    const samples = [];
    for (const course of selected) {
      status(`Resource reload ${round + 1}/3 · ${course.id}`);
      await loadCourse(course);
      owner.runtime.setQuality('high');
      await deadline(owner.runtime.prepare(), 'Reload shader preparation');
      const state = initialSnapshots(course).at(-1);
      let r;
      for (const view of views) r = await draw(state, view);
      samples.push({ course: course.id, ...counts(r) });
    }
    rounds.push(samples);
  }
  receipt.resourceCycles = rounds;
  for (let i = 0; i < selected.length; i++)
    for (const key of Object.keys(rounds[1][i]).filter((k) => k !== 'course'))
      assert(
        rounds[2][i][key] <= rounds[1][i][key],
        `Repeated reload growth: ${selected[i].id}/${key} ${rounds[1][i][key]}→${rounds[2][i][key]}`,
      );
  record('Six worlds reload repeatedly without resource growth after warmup', true, { rounds: 3 });
  receipt.disposal = disposeOwner();
  record('Disposal releases all registered scene resources', true);
  owner = makeOwner(true);
  const course = selected[0],
    samples = await trackingSnapshots(course);
  await loadCourse(course);
  const r = await draw(samples.snapshots.at(-1), 'overview');
  assert(
    r.presentation.actors.every((a) =>
      [...a.rotors, ...a.wheels, ...a.limbs].every((n) => n === 0),
    ),
    'Reduced-motion actor animation continues',
  );
  record(
    'A fresh reduced-motion renderer retains real subject position with still cosmetic parts',
    true,
  );
  receipt.reducedMotionDisposal = disposeOwner();
}
$('run').onclick = async () => {
  if (busy) return;
  busy = true;
  $('run').disabled = $('preview').disabled = true;
  receipt = {
    format: 'fpv-adventures-browser.v1',
    startedAt: new Date().toISOString(),
    source: manifest,
    qualification:
      'Actual WebGL, authored runtime courses and real control snapshots. Object counts are not GPU memory bytes, FPS qualification, hardware acceptance or public deployment.',
    checks: [],
    contextLosses: [],
    configurations: [],
    complete: false,
  };
  publish();
  try {
    await sourceHashes();
    await load();
    disposeOwner();
    owner = makeOwner();
    await matrix();
    await trackSubjects();
    await resourceCycles();
    await sourceHashes();
    record('Source dependency closure remains exactly bound through the run', true);
    assert(receipt.contextLosses.length === 0, 'Unexpected graphics context loss');
  } catch (error) {
    record('Qualification run', false, { error: error.message, stack: error.stack });
    try {
      receipt.disposalAfterFailure = disposeOwner();
    } catch (disposeError) {
      record('Disposal after failure', false, { error: disposeError.message });
    }
  } finally {
    receipt.complete = true;
    receipt.completedAt = new Date().toISOString();
    receipt.passed = receipt.checks.filter((c) => c.passed).length;
    receipt.total = receipt.checks.length;
    publish();
    status(
      `${receipt.passed}/${receipt.total} checks passed · ${receipt.configurations.length} rendering configurations`,
    );
    busy = false;
    $('run').disabled = $('preview').disabled = false;
  }
};
$('preview').onclick = async () => {
  if (busy) return;
  busy = true;
  try {
    await sourceHashes();
    await load();
    disposeOwner();
    owner = makeOwner();
    const c = modules.catalogue.ADVENTURE_COURSES.find((c) => c.id === $('course').value);
    await loadCourse(c);
    owner.runtime.setQuality($('quality').value);
    await owner.runtime.prepare();
    await draw(initialSnapshots(c).at(-1), $('view').value);
    status(`${c.locales.en.title} · ${$('quality').value} · ${$('view').value}`);
  } catch (error) {
    status(error.message);
  } finally {
    busy = false;
  }
};
$('download').onclick = () => {
  if (!receipt) return;
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(receipt, null, 2) + '\n'], { type: 'application/json' }),
    ),
    link = document.createElement('a');
  link.href = url;
  link.download = 'fpv-adventures-browser.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
try {
  const response = await fetch(new URL('source.json', fixture), { cache: 'no-store' });
  assert(response.ok, 'Prepare this fixture before opening it');
  manifest = await response.json();
  assert(manifest.format === 'fpv-adventures-source.v1', 'Unsupported source binding');
  await sourceHashes();
  await load();
  $('binding').textContent =
    `Source HEAD ${manifest.sourceHead}; ${Object.keys(manifest.files).length} explicitly hashed files; 640×360 CSS viewport.`;
  $('run').disabled = $('preview').disabled = false;
  status('Ready. Keep this tab visible while checks run.');
} catch (error) {
  status(error.message);
}
