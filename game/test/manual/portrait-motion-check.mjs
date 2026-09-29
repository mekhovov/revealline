/* global document, window, performance, URL, Uint8Array */
import { attachMenuScene } from '../../ui/menu-scenes.mjs';
import { attachArtworkMotion } from '../../ui/menu-scene-motion.mjs';
import { MENU_SCENES } from '../../ui/menu-scene-catalog.mjs';

const ids = [
  'workshop-lights',
  'parts-in-motion',
  'makers-together',
  'signals-of-support',
  'shared-horizon',
].map((id) => `droneaid-nl-${id}-theme`);
const profileId = new URL(window.location.href).searchParams.get('profile');
const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const status = document.getElementById('status');
const output = document.getElementById('results');

function compare(a, b, rect, width, height) {
  const x1 = Math.max(0, Math.ceil(rect[0] * width));
  const x2 = Math.min(width, Math.floor(rect[2] * width));
  const y1 = Math.max(0, Math.ceil(rect[1] * height));
  const y2 = Math.min(height, Math.floor(rect[3] * height));
  let changed = 0,
    total = 0,
    max = 0,
    pixels = 0;
  for (let y = y1; y < y2; y++)
    for (let x = x1; x < x2; x++) {
      // WebGL readPixels is bottom-up; the artwork rectangles are top-down.
      const at = ((height - 1 - y) * width + x) * 4;
      let difference = 0;
      for (let c = 0; c < 3; c++) difference += Math.abs(a[at + c] - b[at + c]);
      pixels++;
      total += difference;
      max = Math.max(max, difference);
      if (difference > 0) changed++;
    }
  return { pixels, changed, meanRGB: pixels ? total / pixels / 3 : 0, maxRGB: max / 3 };
}

async function runPortrait(id) {
  const root = document.getElementById('landing');
  root.hidden = false;
  document.getElementById('controls').hidden = true;
  const context = { themeId: id, active: true, reduced: false };
  let draws = 0,
    first = null,
    second = null,
    started = 0;
  let complete;
  const sampled = new Promise((resolve) => {
    complete = resolve;
  });
  const owner = attachMenuScene({
    root,
    getContext: () => context,
    createMotion(options) {
      // Test-owned canvas instrumentation reads the real production shader's
      // buffer immediately after its draw. Camera CSS, shade and receiver noise
      // are not in this buffer and cannot create a false-positive difference.
      const canvas = options.canvas;
      const originalGet = canvas.getContext.bind(canvas);
      canvas.getContext = (kind, attributes) => {
        const gl = originalGet(kind, attributes);
        if (kind !== 'webgl' || !gl) return gl;
        canvas.getContext = originalGet;
        const draw = gl.drawArrays.bind(gl);
        gl.drawArrays = (...args) => {
          draw(...args);
          draws++;
          if (second || (first && performance.now() - started < 2100)) return;
          const pixels = new Uint8Array(canvas.width * canvas.height * 4);
          gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          if (!first) {
            first = pixels;
            started = performance.now();
          } else {
            second = pixels;
            complete({ canvas, intervalMs: performance.now() - started });
          }
        };
        return gl;
      };
      return attachArtworkMotion(options);
    },
  });
  window.addEventListener('pagehide', () => owner.dispose(), { once: true });
  const measurement = await Promise.race([sampled, delay(8000).then(() => null)]);
  if (!measurement)
    return {
      id,
      pass: false,
      error: 'No two rendered frames; check motion preference or WebGL availability.',
    };
  const { canvas, intervalMs } = measurement;
  const plane = root.querySelector('.menu-scene-art-plane');
  const pw = parseFloat(plane.style.width),
    ph = parseFloat(plane.style.height);
  const left = parseFloat(plane.style.left),
    top = parseFloat(plane.style.top);
  // Intersect source regions with the final (narrowest) CSS entrance crop.
  const edge = (pixel, offset, size) => 0.5 + (pixel - offset - size / 2) / (size * 1.035);
  const crop = [
    edge(0, left, pw),
    edge(0, top, ph),
    edge(window.innerWidth, left, pw),
    edge(window.innerHeight, top, ph),
  ];
  const regions = MENU_SCENES[id].portraitEnvironment.map((region) => {
    const project = (value) => (value / 100 - 0.5) * 1.025 + 0.5;
    const core = [
      project(region.x + region.width * 0.2),
      project(region.y + region.height * 0.2),
      project(region.x + region.width * 0.8),
      project(region.y + region.height * 0.8),
    ];
    const clipped = [
      Math.max(core[0], crop[0]),
      Math.max(core[1], crop[1]),
      Math.min(core[2], crop[2]),
      Math.min(core[3], crop[3]),
    ];
    return {
      kind: region.kind,
      source: [region.x, region.y, region.width, region.height],
      ...compare(first, second, clipped, canvas.width, canvas.height),
    };
  });
  context.active = false;
  owner.update();
  const pausedDraws = draws;
  await delay(160);
  const paused =
    draws === pausedDraws && root.querySelector('.menu-scene').dataset.running === 'false';
  context.active = true;
  context.reduced = true;
  owner.update();
  const reducedDraws = draws;
  await delay(160);
  const reduced =
    draws === reducedDraws &&
    window.getComputedStyle(canvas).display === 'none' &&
    root.querySelector('.menu-scene').dataset.motion === 'off';
  context.reduced = false;
  owner.update();
  return {
    id,
    pass:
      regions.some((region) => region.changed >= 20 && region.meanRGB > 0.05) && paused && reduced,
    viewport: [window.innerWidth, window.innerHeight],
    source: root.querySelector('.menu-scene-art').getAttribute('src').split('/').at(-1),
    canvas: [canvas.width, canvas.height],
    intervalMs,
    regions,
    paused,
    reduced,
  };
}

if (ids.includes(profileId)) {
  runPortrait(profileId)
    .catch((error) => ({ id: profileId, pass: false, error: error.message }))
    .then((result) =>
      window.parent.postMessage({ portraitMotion: result }, window.location.origin),
    );
} else {
  document.getElementById('run').addEventListener('click', async (event) => {
    event.target.disabled = true;
    const frame = document.createElement('iframe');
    frame.title = 'Portrait scene under test';
    document.body.append(frame);
    const results = [];
    for (const id of ids) {
      status.textContent = `Checking ${id}…`;
      const result = await new Promise((resolve) => {
        const receive = (message) => {
          if (
            message.origin !== window.location.origin ||
            message.source !== frame.contentWindow ||
            message.data?.portraitMotion?.id !== id
          )
            return;
          window.removeEventListener('message', receive);
          resolve(message.data.portraitMotion);
        };
        window.addEventListener('message', receive);
        frame.src = `./portrait-motion-check.html?profile=${encodeURIComponent(id)}`;
      });
      results.push(result);
      output.textContent = JSON.stringify(results, null, 2);
    }
    status.textContent = `${results.filter((row) => row.pass).length}/5 portrait checks passed`;
    status.dataset.complete = 'true';
  });
}
