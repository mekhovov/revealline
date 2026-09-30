import { loadRosterReview, ROSTER_ROLES } from './roster-loader.mjs';
import { createRosterRenderer, ROSTER_SIZES } from './roster-render.mjs';
import { retainControlFocus } from '../../../authoring/game-feel-lab/lifecycle.mjs';

const $ = (id) => document.getElementById(id),
  names = [
    'Scout',
    'Light carrier',
    'Heavy carrier',
    'Interceptor',
    'Fiber relay',
    'Impact craft',
    'Trapper',
  ];
let cohort = null,
  renderer = null,
  owner = null,
  checking = false,
  generation = 0,
  disposed = false;
function controls() {
  $('load').disabled = Boolean(owner);
  $('cancel').hidden = !owner;
  $('check').disabled = !renderer || Boolean(owner);
  for (const id of ['mode', 'treatment', 'light', 'reduced', 'frame'])
    $(id).disabled = !renderer || Boolean(owner);
}
function stop(message) {
  generation++;
  owner?.abort();
  owner = null;
  checking = false;
  controls();
  if (message && !disposed) $('status').textContent = message;
}
function selection() {
  return {
    mode: $('mode').value,
    treatment: $('treatment').value,
    light: $('light').checked,
    reduced: $('reduced').checked,
    frameIndex: Number($('frame').value),
  };
}
function paint() {
  if (!renderer || disposed) return;
  const fragment = document.createDocumentFragment();
  for (const [index, role] of ROSTER_ROLES.entries()) {
    const figure = document.createElement('figure'),
      caption = document.createElement('figcaption'),
      canvas = document.createElement('canvas');
    caption.textContent = names[index];
    canvas.width = 256;
    canvas.height = 192;
    canvas.setAttribute(
      'aria-label',
      `${names[index]}: 20, 24 and 32 pixel rows, facing north, east, south and west.`,
    );
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (let sizeIndex = 0; sizeIndex < 3; sizeIndex++)
      for (let heading = 0; heading < 4; heading++) {
        const result = renderer.render({ ...selection(), role, sizeIndex, heading });
        ctx.drawImage(result.canvas, heading * 64, sizeIndex * 64);
        result.canvas.width = 0;
      }
    figure.append(caption, canvas);
    fragment.append(figure);
  }
  $('grid').replaceChildren(fragment);
}
async function load() {
  stop();
  const controller = new AbortController(),
    ticket = generation;
  owner = controller;
  controls();
  const current = () => !disposed && generation === ticket && !controller.signal.aborted;
  let next = null,
    engine = null;
  $('status').textContent =
    'Checking exact v6 manifest, five construction sources and fourteen native PNGs…';
  const json = async (path) => {
    const r = await fetch(new URL(`../../../${path}`, import.meta.url), {
      signal: controller.signal,
    });
    if (!r.ok) throw new Error(`${path} is unavailable.`);
    return r.json();
  };
  try {
    const [presets, pack] = await Promise.all([
      json('authoring/motion-lab/presets.json'),
      json('game/content/packs/fpv-arcade-r4.json'),
    ]);
    next = await loadRosterReview({ signal: controller.signal });
    if (!current()) return;
    engine = createRosterRenderer({
      presets,
      theme: pack.themes.find((t) => t.id === 'fpv'),
      frames: next.frames,
    });
    const previous = cohort,
      old = renderer;
    cohort = next;
    renderer = engine;
    next = null;
    engine = null;
    old?.dispose();
    previous?.release();
    paint();
    $('status').textContent =
      'Fourteen exact v6 images ready. Source candidates only; checks have not run.';
    $('report').textContent = '';
  } catch (error) {
    if (current())
      $('status').textContent = `Could not prepare roster: ${error.message} Reload to retry.`;
  } finally {
    next?.release();
    engine?.dispose();
    if (current()) {
      owner = null;
      controls();
    }
  }
}
async function check() {
  if (!renderer || owner || disposed) return;
  const controller = new AbortController(),
    ticket = generation,
    restore = retainControlFocus($('check'), document);
  owner = controller;
  checking = true;
  controls();
  $('status').textContent = 'Checking every class, size, heading and field through both painters…';
  const current = () => !disposed && generation === ticket && !controller.signal.aborted;
  let changed = 0,
    held = 0;
  const failures = [],
    pixels = (config) => {
      const result = renderer.render(config),
        bytes = result.canvas.getContext('2d').getImageData(0, 0, 64, 64).data;
      result.canvas.width = 0;
      return bytes;
    },
    same = (a, b) => a.every((value, index) => value === b[index]);
  try {
    for (const role of ROSTER_ROLES) {
      for (const treatment of ['compact', 'detailed'])
        for (const mode of ['solo', 'team'])
          for (let sizeIndex = 0; sizeIndex < 3; sizeIndex++)
            for (let heading = 0; heading < 4; heading++)
              for (const light of [false, true]) {
                if (!current()) return;
                const config = { role, treatment, mode, sizeIndex, heading, light },
                  a = pixels({ ...config, frameIndex: 1 }),
                  b = pixels({ ...config, frameIndex: 2 });
                const label = `${role}/${treatment}/${mode}/${ROSTER_SIZES[sizeIndex]}px/${heading}/${light ? 'light' : 'dark'}`;
                if (!same(a, b)) changed++;
                else failures.push(`${label}: rotor raster did not change`);
                if (same(a, pixels({ ...config, frameIndex: 1 }))) held++;
                else failures.push(`${label}: retained pose differs`);
                if (
                  same(
                    pixels({ ...config, frameIndex: 1, reduced: true }),
                    pixels({ ...config, frameIndex: 2, reduced: true }),
                  )
                )
                  held++;
                else failures.push(`${label}: reduced pose changed`);
                await new Promise((resolve) => setTimeout(resolve, 0));
              }
      $('status').textContent = `Checked ${role} through both complete painters…`;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (current()) {
      $('report').textContent = JSON.stringify(
        {
          changed,
          held,
          failures,
          manifest: cohort.manifest.construction,
          evidence:
            'Native renderer crops; candidate-only Team pilot-body adapter. No new Team class mechanics, gameplay balance, full-board, release or physical-device acceptance.',
        },
        null,
        2,
      );
      $('status').textContent = failures.length
        ? `${failures.length} raster checks failed; inspect the report.`
        : `PASS: ${changed} changed rotor frames; ${held} retained/reduced poses.`;
    }
  } catch (error) {
    if (current()) $('status').textContent = `Render check failed: ${error.message}`;
  } finally {
    if (current()) {
      owner = null;
      checking = false;
      controls();
      restore(true);
      paint();
    } else restore(false);
  }
}
$('load').onclick = load;
$('cancel').onclick = () => {
  stop(
    checking
      ? 'Check cancelled. The loaded roster remains.'
      : 'Loading cancelled. Reload when ready.',
  );
  $('load').focus();
};
$('check').onclick = check;
for (const id of ['mode', 'treatment', 'light', 'reduced', 'frame']) $(id).onchange = paint;
$('reduced').checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.addEventListener('visibilitychange', () => {
  if (document.hidden && owner)
    stop('Preparation/check stopped while hidden. Reload or check when ready.');
});
window.addEventListener('pagehide', (event) => {
  stop();
  if (!event.persisted) {
    disposed = true;
    renderer?.dispose();
    cohort?.release();
    renderer = null;
    cohort = null;
  }
});
controls();
load();
