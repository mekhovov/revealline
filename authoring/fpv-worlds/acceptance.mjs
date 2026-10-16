import {
  createFlightRenderer,
  builtinWorldScene,
} from '../../optional-practice/civilian-fpv/world-assets.mjs';
import { SIM_VISUAL_COLLECTIONS } from '../../optional-practice/civilian-fpv/world-visuals.mjs';
import {
  ACCEPTANCE_PROTOCOL,
  ACCEPTANCE_CASES,
  acceptanceRoute,
  acceptanceFrame,
  frameStatistics,
  compareAcceptanceRuns,
} from './acceptance-protocol.mjs';

const $ = (id) => document.getElementById(id);
const fixtureRoot = new URL('../../', import.meta.url);
const digest = async (bytes) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('');
const jsonHash = (value) => digest(new TextEncoder().encode(JSON.stringify(value)));
const nextFrame = () => new Promise(requestAnimationFrame);
const canvas = $('flight');
const renderer = createFlightRenderer({ canvas });
let manifest,
  sourceSha256,
  active,
  route,
  shown = 'authored',
  generation = 0,
  ready = false,
  sceneReady = false,
  inspection = null,
  measuring = false,
  cancelled = false,
  disposed = false;
const comparisons = [],
  reviews = [];
const graphics = (() => {
  if (!renderer.available) return null;
  const gl = canvas.getContext('webgl2'),
    extension = gl.getExtension('WEBGL_debug_renderer_info');
  const reportedRenderer = extension
    ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER);
  return {
    version: gl.getParameter(gl.VERSION),
    renderer: reportedRenderer,
    vendor: extension
      ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL)
      : gl.getParameter(gl.VENDOR),
    softwareRendererDetected: /swiftshader|llvmpipe|softpipe|software/i.test(reportedRenderer),
    physicalDeviceVerified: false,
  };
})();
const device = () => ({
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  devicePixelRatio,
  viewport: [innerWidth, innerHeight],
  canvas: [canvas.clientWidth, canvas.clientHeight],
  backingPixels: [canvas.width, canvas.height],
  graphics,
});
function controls(busy) {
  for (const id of [
    'environment',
    'collection',
    'quality',
    'view',
    'show-authored',
    'show-theme',
    'capture',
    'record-review',
    'measure',
  ])
    $(id).disabled = busy || !ready || disposed;
  for (const id of ['capture', 'record-review', 'measure']) $(id).disabled ||= !sceneReady;
  $('cancel').disabled = !measuring || !busy || disposed;
}
controls(true);
for (const item of ACCEPTANCE_CASES)
  $('environment').add(new Option(`${item.title} · ${item.renderer}`, item.id));
for (const id of Object.keys(SIM_VISUAL_COLLECTIONS))
  $('collection').add(
    new Option(
      id
        .split('-')
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(' '),
      id,
    ),
  );
$('environment').value = 'gym';
$('collection').value = 'industrial-workshop';
function frame(tick, viewId = null) {
  const sample = acceptanceFrame(active.course, route, tick, viewId),
    start = performance.now();
  renderer.draw(sample.state, sample.options);
  return performance.now() - start;
}
async function install(collectionId, quality = $('quality').value) {
  if (disposed) throw new Error('Acceptance page was closed.');
  const token = ++generation;
  sceneReady = false;
  inspection = null;
  renderer.setPresentation({ collectionId, revision: 'r1' });
  renderer.setQuality(quality);
  renderer.setCourse(active.course, 'self-level');
  renderer.setDrone('utility');
  const scene = active.renderer === 'world' ? builtinWorldScene(active.course) : null;
  if (scene) await renderer.loadScene(scene);
  if (disposed || token !== generation) throw new Error('Scene preparation superseded.');
  // Establish the exact fixed lens and canvas size before preparing its shaders.
  frame(0, $('view').value);
  if ((await renderer.prepare()) === false) throw new Error('Scene preparation did not complete.');
  if (disposed || token !== generation) throw new Error('Scene preparation superseded.');
  shown = collectionId;
  sceneReady = true;
}
function drawSelected() {
  if (!sceneReady || disposed) throw new Error('Prepare a scene before reviewing it.');
  frame(0, $('view').value);
  inspection = {
    environment: active.id,
    courseId: active.course.id,
    collectionId: shown,
    quality: $('quality').value,
    view: $('view').value,
    sourceSha256,
  };
  $('view-description').textContent =
    `${active.course.id} · ${shown} · ${$('quality').value} · ${route.views.find((v) => v.id === $('view').value).title}. ${route.gate ? 'Includes an actual gate.' : 'This course has an objective volume; gate opening coverage is not claimed.'}`;
}
async function selectEnvironment() {
  active = ACCEPTANCE_CASES.find((item) => item.id === $('environment').value);
  route = acceptanceRoute(active.course);
  $('view').replaceChildren(...route.views.map((item) => new Option(item.title, item.id)));
  await install($('collection').value);
  drawSelected();
}
async function act(run) {
  if (!ready || measuring || disposed) return;
  controls(true);
  try {
    await run();
    $('status').textContent = '';
  } catch (error) {
    sceneReady = false;
    inspection = null;
    $('status').textContent = error.message;
  } finally {
    controls(false);
  }
}
function download(bytes, name, type) {
  const href = URL.createObjectURL(new Blob([bytes], { type })),
    link = document.createElement('a');
  link.href = href;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
function conditions(expected) {
  if (cancelled || disposed)
    throw new Error('Comparison cancelled; incomplete runs are not acceptance evidence.');
  if (document.visibilityState !== 'visible' || !document.hasFocus())
    throw new Error('Keep the acceptance tab visible and focused; repeat the comparison.');
  if (JSON.stringify(device()) !== expected)
    throw new Error('Viewport or device scale changed; repeat the comparison.');
  if (canvas.getContext('webgl2').isContextLost())
    throw new Error('WebGL context lost; repeat after recovery.');
}
async function measure() {
  if (!ready || !sceneReady || measuring || disposed) return;
  measuring = true;
  cancelled = false;
  controls(true);
  const requested = $('collection').value,
    quality = $('quality').value;
  try {
    const courseBefore = JSON.stringify(active.course),
      routeSha256 = await jsonHash(route),
      viewport = device(),
      expected = JSON.stringify(viewport),
      runs = [];
    for (const collectionId of ['authored', requested, requested, 'authored']) {
      conditions(expected);
      $('status').textContent =
        `Run ${runs.length + 1}/4: ${collectionId} · ${quality}. Keep this tab focused.`;
      await install(collectionId, quality);
      for (let tick = 0; tick < 60; tick++) {
        conditions(expected);
        frame(tick);
        await nextFrame();
      }
      const cpu = [],
        intervals = [],
        resourcesBefore = renderer.resources();
      let previous = await nextFrame();
      for (let tick = 0; tick < 240; tick++) {
        conditions(expected);
        cpu.push(frame(tick));
        const now = await nextFrame();
        intervals.push(now - previous);
        previous = now;
      }
      conditions(expected);
      runs.push({
        collectionId,
        quality,
        courseId: active.course.id,
        environment: active.id,
        viewport,
        routeSha256,
        sourceSha256,
        warmup: 60,
        samples: 240,
        cpu: frameStatistics(cpu),
        frame: frameStatistics(intervals),
        resourcesBefore,
        resourcesAfter: renderer.resources(),
        frameIntervalsMs: intervals,
        cpuDrawMs: cpu,
      });
    }
    if (JSON.stringify(active.course) !== courseBefore)
      throw new Error('Course data changed during visual comparison.');
    const result = {
      date: new Date().toISOString(),
      ...compareAcceptanceRuns(runs, requested),
      route,
      runs,
    };
    comparisons.push(result);
    $('results').textContent = JSON.stringify(result, null, 2);
    $('status').textContent =
      `Browser frame gate: ${result.browserFrameGate}. Physical-device qualification remains open.`;
    $('export').disabled = false;
  } catch (error) {
    $('status').textContent = error.message;
  } finally {
    if (!disposed) {
      try {
        await install(requested, quality);
        drawSelected();
      } catch (error) {
        $('status').textContent += ` Restore failed: ${error.message}`;
      }
    }
    measuring = false;
    controls(false);
  }
}
export function acceptanceReport() {
  return structuredClone({
    format: ACCEPTANCE_PROTOCOL,
    sourceSha256,
    source: manifest,
    device: device(),
    comparisons,
    reviews,
    coverage: {
      availableEnvironments: ACCEPTANCE_CASES.length,
      requiredQualities: ['low', 'balanced', 'high'],
      completedComparisons: comparisons.map((item) => ({
        environment: item.runs[0].environment,
        quality: item.runs[0].quality,
        collectionId: item.runs[1].collectionId,
      })),
      physicalDeviceQualified: false,
      simulationProofQualification: false,
      note: 'Readability judgments are explicit human decisions for listed views only. Synthetic rendering does not validate flight proofs. Front-facing drone, other actor states, touch layouts and physical GPUs need separate review.',
    },
  });
}
$('environment').addEventListener('change', () => act(selectEnvironment));
for (const id of ['collection', 'quality'])
  $(id).addEventListener('change', () =>
    act(async () => {
      await install($('collection').value);
      drawSelected();
    }),
  );
$('view').addEventListener('change', () => act(drawSelected));
$('show-authored').addEventListener('click', () =>
  act(async () => {
    await install('authored');
    drawSelected();
  }),
);
$('show-theme').addEventListener('click', () =>
  act(async () => {
    await install($('collection').value);
    drawSelected();
  }),
);
$('measure').addEventListener('click', measure);
$('cancel').addEventListener('click', () => {
  cancelled = true;
});
$('record-review').addEventListener('click', () => {
  if (!ready || !sceneReady || !inspection || measuring || disposed) return;
  if ($('verdict').value === 'unreviewed') {
    $('status').textContent = 'Choose an explicit readability decision first.';
    return;
  }
  reviews.push({
    ...inspection,
    device: device(),
    verdict: $('verdict').value,
    notes: $('notes').value,
    date: new Date().toISOString(),
  });
  $('export').disabled = false;
  $('status').textContent = 'Readability judgment recorded for this view.';
});
$('capture').addEventListener('click', () => {
  if (!ready || !sceneReady || !inspection || measuring || disposed) return;
  drawSelected();
  const captured = inspection;
  canvas.toBlob((blob) => {
    if (blob && !disposed)
      download(
        blob,
        `${captured.environment}-${captured.collectionId}-${captured.quality}-${captured.view}.png`,
        'image/png',
      );
  });
});
$('export').addEventListener('click', () =>
  download(
    JSON.stringify(acceptanceReport(), null, 2) + '\n',
    `sim-appearance-${active.id}-${$('quality').value}.json`,
    'application/json',
  ),
);
window.addEventListener(
  'pagehide',
  () => {
    disposed = true;
    ready = false;
    sceneReady = false;
    cancelled = true;
    generation++;
    renderer.dispose();
    controls(true);
  },
  { once: true },
);
try {
  if (!renderer.available) throw new Error('WebGL 2 is required.');
  const response = await fetch(new URL('source-manifest.json', fixtureRoot), { cache: 'no-store' });
  if (!response.ok)
    throw new Error('Prepare a snapshot with scripts/prepare-sim-appearance-acceptance.mjs first.');
  const bytes = await response.arrayBuffer();
  sourceSha256 = await digest(bytes);
  manifest = JSON.parse(new TextDecoder().decode(bytes));
  if (
    manifest.format !== 'SIMAppearanceSource.v1' ||
    !Array.isArray(manifest.files) ||
    manifest.files.length > 128
  )
    throw new Error('Invalid acceptance source manifest.');
  for (const entry of manifest.files) {
    if (
      !/^(?:authoring|optional-practice|game)\/[A-Za-z0-9_./-]+$/.test(entry.path) ||
      entry.path.split('/').includes('..')
    )
      throw new Error('Invalid source path.');
    const result = await fetch(new URL(entry.path, fixtureRoot), { cache: 'no-store' });
    if (!result.ok) throw new Error(`Missing source: ${entry.path}`);
    const content = await result.arrayBuffer();
    if (content.byteLength !== entry.bytes || (await digest(content)) !== entry.sha256)
      throw new Error(`Source identity mismatch: ${entry.path}`);
  }
  if (disposed) throw new Error('Acceptance page was closed.');
  $('identity').textContent =
    `${manifest.files.length} exact source files verified · ${manifest.revision} · ${sourceSha256}`;
  await selectEnvironment();
  if (disposed) throw new Error('Acceptance page was closed.');
  ready = true;
  controls(false);
} catch (error) {
  ready = false;
  sceneReady = false;
  controls(true);
  $('cancel').disabled = true;
  $('identity').textContent = error.message;
}
