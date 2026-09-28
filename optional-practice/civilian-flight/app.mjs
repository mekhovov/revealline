import { getLocale, setLocale, onLocaleChange } from '../../game/i18n/index.mjs';
import { CIVILIAN_PRACTICE_CATALOGUE } from './catalogue.mjs';
import {
  createPractice,
  validatePracticeCatalogue,
  exportPracticeCatalogue,
  replayPractice,
  validatePracticeInput,
  PRACTICE_HZ,
} from './model.mjs';
import { attachPracticeInput } from './input.mjs';
import { PRACTICE_COPY } from './copy.mjs';
import { preparePracticeOffline, removePracticeOffline } from './offline.mjs';

export function mountCivilianPractice({ document: doc, window: win }) {
  const $ = (id) => doc.getElementById(id);
  const tr = (key) => (PRACTICE_COPY[getLocale()] ?? PRACTICE_COPY.en)[key];
  let catalogue = validatePracticeCatalogue(CIVILIAN_PRACTICE_CATALOGUE),
    model = createPractice(catalogue, catalogue.drills[0].id),
    commands = [],
    recordingTicks = 0,
    recordingFull = false,
    previous = null,
    accumulator = 0,
    frame = null,
    disposed = false;
  const completed = new Set();
  const canvas = $('board');
  let context;
  try {
    context = canvas.getContext('2d');
  } catch {
    /* readable capability fallback */
  }
  $('fallback').hidden = !!context;
  const pause = () => {
    model.pause();
    input?.clear();
    accumulator = 0;
    render();
  };
  const input = attachPracticeInput({
    document: doc,
    window: win,
    arena: $('arena'),
    buttons: [...doc.querySelectorAll('[data-axis]')],
    active: () => model.snapshot().status === 'active' && !$('help-dialog').open,
    onPause: pause,
    onStatus: (key) => {
      $('pad-status').textContent = tr(key === 'ready' ? 'connected' : key);
    },
  });
  const authored = () => model.drill().locales[getLocale()] ?? model.drill().locales.en;
  function options() {
    $('drill').replaceChildren(
      ...catalogue.drills.map((drill) => {
        const option = doc.createElement('option');
        option.value = drill.id;
        option.textContent = `${completed.has(`${model.identity}:${drill.id}`) ? '✓ ' : ''}${(drill.locales[getLocale()] ?? drill.locales.en).title}`;
        return option;
      }),
    );
    $('drill').value = model.drill().id;
  }
  function render() {
    if (disposed) return;
    const state = model.snapshot(),
      target = state.target,
      copy = authored();
    $('status').textContent = recordingFull
      ? tr('sessionFull')
      : `${tr(state.status === 'complete' ? 'complete' : state.status)} · ${tr('progress')} ${state.checkpoint}/${state.total}`;
    $('brief').textContent = copy.brief;
    $('readout').textContent =
      `${tr('position')} ${(state.x / 100).toFixed(1)}, ${(state.z / 100).toFixed(1)} m · ${tr('height')} ${(state.altitude / 100).toFixed(2)} m · ${tr('heading')} ${state.heading}°`;
    $('target').textContent = target
      ? `${tr('target')} ${state.checkpoint + 1}: ${(target.x / 100).toFixed(1)}, ${(target.z / 100).toFixed(1)} m · ${tr('height')} ${(target.altitude / 100).toFixed(2)} ± ${(target.verticalTolerance / 100).toFixed(2)} m${target.heading === null ? '' : ` · ${tr('heading')} ${target.heading}° ± ${target.headingTolerance}°`} · ${tr(target.landed ? 'land' : 'hold')}: ${state.holdTicks}/${target.holdTicks}`
      : tr('complete');
    $('discovery').textContent = state.status === 'complete' ? copy.discovery : '';
    $('start').disabled = recordingFull || state.status === 'active' || state.status === 'complete';
    $('pause').disabled = state.status !== 'active';
    draw(state);
  }
  function draw(state) {
    if (!context) return;
    const ctx = context,
      width = canvas.width,
      height = canvas.height,
      sx = width / catalogue.world.width,
      sy = height / catalogue.world.depth;
    ctx.fillStyle = '#091814';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#355c4b';
    ctx.lineWidth = 1;
    for (let number = 0; number <= 10; number++) {
      ctx.beginPath();
      ctx.moveTo((number * width) / 10, 0);
      ctx.lineTo((number * width) / 10, height);
      ctx.moveTo(0, (number * height) / 10);
      ctx.lineTo(width, (number * height) / 10);
      ctx.stroke();
    }
    const points = model.drill().checkpoints;
    ctx.strokeStyle = '#567363';
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x * sx, point.z * sy);
      else ctx.lineTo(point.x * sx, point.z * sy);
    });
    ctx.stroke();
    points.forEach((point, index) => {
      if (index < state.checkpoint) return;
      const active = index === state.checkpoint;
      ctx.strokeStyle = active ? '#f6c66f' : '#799d8a';
      ctx.lineWidth = active ? 4 : 1;
      ctx.beginPath();
      ctx.arc(point.x * sx, point.z * sy, point.radius * sx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = '18px system-ui';
      ctx.fillText(String(index + 1), point.x * sx + point.radius * sx + 3, point.z * sy);
    });
    ctx.save();
    ctx.translate(state.x * sx, state.z * sy);
    ctx.rotate((state.heading * Math.PI) / 180);
    ctx.fillStyle = '#dcf59e';
    ctx.strokeStyle = '#07100b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(14, 13);
    ctx.lineTo(0, 6);
    ctx.lineTo(-14, 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const meterY = height - 20 - (state.altitude / catalogue.world.ceiling) * (height - 40);
    ctx.fillStyle = '#eef5e8';
    ctx.fillRect(width - 12, meterY, 8, 8);
  }
  function localized() {
    doc.documentElement.lang = getLocale();
    for (const node of doc.querySelectorAll('[data-copy]'))
      node.textContent = tr(node.dataset.copy);
    $('language').value = getLocale();
    $('arena').setAttribute('aria-label', tr('arena'));
    doc.querySelector('.touch-controls').setAttribute('aria-label', tr('touch'));
    $('catalogue').setAttribute('aria-label', tr('json'));
    options();
    render();
  }
  function reset(drillId = model.drill().id) {
    input.clear();
    model = createPractice(catalogue, drillId);
    commands = [];
    recordingTicks = 0;
    recordingFull = false;
    accumulator = 0;
    options();
    render();
  }
  const trace = () => ({
    format: 'revealline-practice-transcript.v1',
    catalogueIdentity: model.identity,
    drillId: model.drill().id,
    commands: structuredClone(commands),
  });
  function advance() {
    const command = validatePracticeInput(input.sample());
    if (model.snapshot().status !== 'active') return;
    if (recordingTicks >= 72000 || commands.length >= 12000) {
      recordingFull = true;
      pause();
      return;
    }
    const last = commands.at(-1);
    if (last && last.ticks < 200 && JSON.stringify(last.input) === JSON.stringify(command))
      last.ticks++;
    else commands.push({ ticks: 1, input: command });
    recordingTicks++;
    const state = model.step(command);
    if (state.status === 'complete') {
      input.clear();
      if (replayPractice(catalogue, trace()).status === 'complete')
        completed.add(`${model.identity}:${model.drill().id}`);
      options();
    }
  }
  function tick(now) {
    if (disposed) return;
    if (previous !== null && now - previous > 1000) pause();
    if (model.snapshot().status === 'active') {
      accumulator += previous === null ? 0 : Math.max(0, Math.min(250, now - previous));
      while (accumulator >= 1000 / PRACTICE_HZ && model.snapshot().status === 'active') {
        accumulator -= 1000 / PRACTICE_HZ;
        advance();
      }
      render();
    }
    previous = now;
    frame = win.requestAnimationFrame(tick);
  }
  $('start').onclick = () => {
    input.clear();
    model.start();
    previous = null;
    accumulator = 0;
    $('arena').focus();
    render();
  };
  $('pause').onclick = pause;
  $('reset').onclick = () => reset();
  $('drill').onchange = () => reset($('drill').value);
  $('language').onchange = () => setLocale($('language').value);
  $('connect').onclick = () => {
    pause();
    input.connect();
  };
  $('help').onclick = () => {
    pause();
    $('help-dialog').showModal();
  };
  $('close-help').onclick = () => $('help-dialog').close();
  $('help-dialog').addEventListener('close', () => {
    input.clear();
    $('help').focus();
  });
  $('export').onclick = () => {
    $('catalogue').value = exportPracticeCatalogue(catalogue);
    $('catalogue').focus();
  };
  $('export-trace').onclick = () => {
    $('catalogue').value = JSON.stringify(trace());
    $('author-status').textContent = tr('traceReady');
  };
  $('import').onclick = () => {
    try {
      const checked = validatePracticeCatalogue($('catalogue').value);
      catalogue = checked;
      reset(checked.drills[0].id);
      $('author-status').textContent = tr('imported');
    } catch {
      $('author-status').textContent = tr('invalid');
    }
  };
  $('offline').onclick = async () => {
    try {
      await preparePracticeOffline({ navigator: win.navigator, location: win.location });
      $('package-status').textContent = tr('installed');
    } catch {
      $('package-status').textContent = tr('installFailed');
    }
  };
  $('remove-offline').onclick = async () => {
    try {
      await removePracticeOffline({
        navigator: win.navigator,
        caches: win.caches,
        location: win.location,
      });
      $('package-status').textContent = tr('removed');
    } catch {
      $('package-status').textContent = tr('installFailed');
    }
  };
  const stopLocale = onLocaleChange(localized);
  localized();
  frame = win.requestAnimationFrame(tick);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    input.dispose();
    stopLocale();
    win.cancelAnimationFrame(frame);
    win.removeEventListener('pagehide', pagehide);
  };
  const pagehide = (event) => {
    pause();
    if (!event.persisted) dispose();
  };
  win.addEventListener('pagehide', pagehide);
  return {
    dispose,
    snapshot: () => model.snapshot(),
    trace,
    catalogue: () => validatePracticeCatalogue(catalogue),
  };
}
if (typeof document !== 'undefined' && document.getElementById('arena'))
  mountCivilianPractice({ document, window });
