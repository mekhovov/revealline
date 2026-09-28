import { loadBenchmarkCatalog } from './catalog.mjs';
import { createBenchmarkSelection } from './session.mjs';
import { prepareBenchmarkScene } from './scene.mjs';
import {
  createReadyCue,
  createResultFocusCue,
  attachDeliberateButton,
} from './result-controls.mjs';
import { boardPaintSizeForRun } from '../../game/ui/render.mjs';
import { attachBenchmarkInput } from './controls.mjs';
import { createPreviewLifecycle } from '../game-feel-lab/lifecycle.mjs';

const $ = (id) => document.getElementById(id);
const canvases = [$('reference'), $('comparison')];
const contexts = canvases.map((canvas) => canvas.getContext('2d'));
function showComparison() {
  const show = $('show-comparison').checked;
  $('comparison-pane').hidden = !show;
  $('panes').classList.toggle('primary-only', !show);
  $('play-viewport').classList.toggle('primary-only', !show);
}
$('show-comparison').checked = !matchMedia('(max-width: 720px), (max-height: 600px)').matches;
showComparison();
$('reference-reduced').checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
$('reference-label').textContent = $('reference-reduced').checked
  ? 'Reference · reduced effects'
  : 'Reference · standard effects';
let catalog = null;
let presets = null;
let lastTime = null;
let disposed = false;
let startup = null;
let lastSummary = '';
let lastEvents = '';
let loadingFocus = null;

function status(kind, message) {
  if (disposed) return;
  $('loading').dataset.state = kind;
  $('loading').textContent = message;
  controls();
}
function controls() {
  const current = selection.current;
  const pending = selection.pending || current?.comparison.pending;
  $('start').disabled =
    !current ||
    pending ||
    readyCue.active ||
    current.session.playing ||
    ['won', 'lost'].includes(current.session.run.status);
  $('start').textContent = current?.session.run.tick ? 'Resume' : 'Start';
  $('pause').disabled = !current?.session.playing && !readyCue.active;
  $('retry').disabled = !current || pending || readyCue.active;
  $('cancel').hidden = !pending;
  $('mission').disabled = !catalog;
  $('load').disabled = !catalog || pending;
  $('comparison-body').disabled = !current || selection.pending;
  for (const id of ['comparison-reduced', 'capture-pulse', 'event-flashes'])
    $(id).disabled = !current || pending;
}
function comparisonDetails() {
  const current = selection.current;
  if (!current || disposed) return;
  const comparison = current.comparison;
  $('comparison-body').value = comparison.body;
  $('comparison-reduced').checked = comparison.reduced;
  $('capture-pulse').checked = comparison.feedback.captureAccent;
  $('event-flashes').checked = comparison.feedback.eventAccents;
  const body = {
    approved: 'Approved FPV',
    'v3-auto': 'V3 Scout · automatic native size',
    'v3-compact': 'V3 Scout · native 32 px',
    'v3-detailed': 'V3 Scout · native 64 px',
  }[comparison.body];
  $('comparison-label').textContent =
    `${body} · ${comparison.reduced ? 'reduced' : 'standard'} effects`;
  $('comparison-identity').textContent = comparison.provenance
    ? JSON.stringify(comparison.provenance, null, 2)
    : 'Approved FPV actor lease. No source-candidate images are loaded in this view.';
}
function refresh() {
  if (disposed) return;
  controls();
  const current = selection.current;
  if (!current) return;
  const { session } = current;
  const summary = session.summary;
  const state = ['won', 'lost'].includes(summary.status)
    ? summary.status === 'won'
      ? 'Won'
      : `Lost · ${summary.failureCause}`
    : session.playing
      ? summary.status === 'respawning'
        ? 'Recovering'
        : 'Playing'
      : summary.tick
        ? 'Paused'
        : 'Ready';
  const text = `${state} · ${(summary.coverage * 100).toFixed(1)}% / ${(session.run.level.goal.coverage * 100).toFixed(0)}% target · ${summary.lives} lives · ${summary.score} points · ${summary.time.toFixed(2)} s · tick ${summary.tick}`;
  if (text !== lastSummary) {
    $('summary').textContent = text;
    lastSummary = text;
  }
  const eventText = JSON.stringify(session.events);
  if (eventText !== lastEvents) {
    $('events').replaceChildren(
      ...session.events.map((event) => {
        const line = document.createElement('li');
        line.textContent = `Tick ${event.tick}: ${event.type}${event.cells === undefined ? '' : ` · ${event.cells} cells`}${event.cause ? ` · ${event.cause}` : ''}${event.reason ? ` · ${event.reason}` : ''}${event.actorId ? ` · source ${event.actorId}` : ''}`;
        return line;
      }),
    );
    lastEvents = eventText;
  }
}
function paint(dt = 0) {
  const current = selection.current;
  if (!current || disposed) return;
  current.painters.forEach((painter, index) =>
    painter.draw(contexts[index], current.session.run, dt, {
      paused: !current.session.playing,
      reduced: index === 1 ? current.comparison.reduced : $('reference-reduced').checked,
      displayCSSWidth: canvases[index].clientWidth,
      fullReveal: current.session.run.status === 'won',
      celebrationPaused: document.hidden,
      defeatEffectsRunning: current.session.run.status === 'lost' && !document.hidden,
      backdrop: current.picture,
      actorAppearance: {
        style: 'fpv',
        snapshot: index === 1 ? current.comparison.snapshot : current.actors.snapshot,
      },
      ...(index === 1 ? { feedbackComparison: current.comparison.feedback } : {}),
    }),
  );
}
function hold(message) {
  readyCue.cancel();
  resultFocus.cancel();
  selection.current?.session.pause();
  input.clear();
  lastTime = null;
  if (!disposed) {
    refresh();
    if (message) status('ready', message);
  }
}
const selection = createBenchmarkSelection({
  prepare: (entry, { signal }) =>
    prepareBenchmarkScene(entry, {
      catalog,
      presets,
      signal,
      onComparisonStatus: status,
      onStep(events, run) {
        if (events.some((event) => ['player.failed', 'player.respawned'].includes(event.type)))
          input.clear();
        if (events.some((event) => event.type === 'run.completed')) {
          input.clear();
          status('complete', run.status === 'won' ? 'Mission complete.' : 'Attempt ended.');
          $('outcome').textContent =
            run.status === 'won'
              ? 'Mission won. Choose Retry for the same setup.'
              : `Attempt lost: ${run.failureCause}. Choose Retry for the same setup.`;
          resultFocus.begin(selection.current);
        } else if (events.some((event) => event.type === 'player.failed')) {
          $('outcome').textContent =
            `Life lost: ${run.failureCause}. ${run.lives} lives remain; recovery continues in this attempt.`;
        }
      },
    }),
  onStatus: status,
  onAdopt(current) {
    input.clear();
    lastTime = null;
    const { width, height } = boardPaintSizeForRun(current.session.run);
    for (const canvas of canvases) {
      canvas.width = width;
      canvas.height = height;
    }
    $('mission').value = current.entry.id;
    $('purpose').textContent = `${current.entry.purpose}. ${current.entry.cue}`;
    $('identity').textContent = JSON.stringify(
      {
        route: catalog.routeId,
        sourceProject: {
          id: catalog.projectId,
          revision: catalog.projectRevision,
          sha256: catalog.sourceSha256,
        },
        pack: current.entry.packId,
        campaign: current.entry.campaignId,
        mission: {
          id: current.entry.id,
          revision: current.session.run.revision,
          simulationIdentity: current.entry.manifest.simulationIdentity,
        },
        setup: { difficulty: 'standard', classId: 'scout', turnPolicy: 'immediate', seed: 1 },
        presentation: current.entry.manifest.presentation,
        artwork: current.entry.manifest.background,
        actorAppearance: current.actors.pin(),
        progressEligible: false,
      },
      null,
      2,
    );
    lastSummary = '';
    lastEvents = '';
    $('outcome').textContent = '';
    comparisonDetails();
    refresh();
    paint();
  },
});
const input = attachBenchmarkInput({
  arena: $('reference'),
  touchMode: () => $('touch-mode').value,
  active: () =>
    !disposed &&
    !selection.pending &&
    !selection.current?.comparison.pending &&
    selection.current?.session.playing &&
    selection.current.session.run.status === 'running',
  onPause: () => hold('Paused. Resume requires a fresh steering press.'),
  onGamepad: (message) => {
    if (!disposed) $('input-status').textContent = message;
  },
});

const readyCue = createReadyCue((current) => {
  if (disposed || !lifecycle.active || selection.pending || selection.current !== current) return;
  input.clear();
  current.session.start();
  $('arena').focus({ preventScroll: true });
  $('outcome').textContent = 'New attempt started. Choose a fresh direction.';
  status('ready', 'Playing the same setup.');
});
const resultFocus = createResultFocusCue({
  document,
  isPlayFocus: (element) =>
    element === $('arena') ||
    $('arena').contains(element) ||
    $('direction-pad').contains(element) ||
    element === $('boost-button'),
  onReady(current) {
    if (disposed || !lifecycle.active || selection.current !== current || selection.pending) return;
    if (!['won', 'lost'].includes(current.session.run.status)) return;
    retryGuard.clear();
    $('retry').focus({ preventScroll: true });
  },
});

async function select(id, opener = null) {
  const entry = catalog?.entries.find((item) => item.id === id);
  if (!entry || disposed) return;
  hold();
  selection.current?.comparison.cancel();
  const owner = { opener };
  loadingFocus = owner;
  const accepted = await selection.select(entry);
  if (loadingFocus === owner) loadingFocus = null;
  if (disposed) return;
  if (!accepted && !selection.pending) {
    if (selection.current) $('mission').value = selection.current.entry.id;
    controls();
  }
}
$('mission').onchange = () => void select($('mission').value, $('mission'));
$('start').onclick = () => {
  if (
    selection.pending ||
    selection.current?.comparison.pending ||
    readyCue.active ||
    !lifecycle.active
  )
    return;
  input.clear();
  if (selection.current?.session.start()) {
    lastTime = null;
    $('arena').focus({ preventScroll: true });
    status('ready', 'Playing. Steer with a fresh direction press.');
    refresh();
  }
};
$('pause').onclick = () => hold('Paused. Resume requires a fresh steering press.');
function retry() {
  if (selection.pending || selection.current?.comparison.pending || !selection.current) return;
  hold();
  const current = selection.current;
  current.session.retry();
  current.resetPresentation();
  readyCue.begin(current);
  $('outcome').textContent = 'Ready. The same setup starts in 0.6 seconds. Release held controls.';
  status('ready', 'Preparing the next attempt with the same setup…');
  refresh();
  paint();
}
const retryGuard = attachDeliberateButton($('retry'), {
  window,
  enabled: () =>
    !disposed &&
    lifecycle.active &&
    !selection.pending &&
    !selection.current?.comparison.pending &&
    !readyCue.active &&
    !!selection.current,
  activate: retry,
});
function visibleFocusTarget(element) {
  if (
    !element?.isConnected ||
    element.disabled ||
    element.closest('[hidden],[inert]') ||
    !element.getClientRects().length
  )
    return false;
  // A closed details keeps its native summary available, never its fields.
  for (let parent = element.parentElement; parent; parent = parent.parentElement)
    if (
      parent.tagName === 'DETAILS' &&
      !parent.open &&
      !parent.querySelector('summary')?.contains(element)
    )
      return false;
  return true;
}
$('cancel').onclick = () => {
  if (disposed || (!selection.pending && !selection.current?.comparison.pending)) return;
  const opener = loadingFocus?.opener;
  const returnFocus = [document.body, $('cancel'), opener].includes(document.activeElement);
  loadingFocus = null;
  selection.cancel();
  selection.current?.comparison.cancel();
  $('mission').value = selection.current?.entry.id ?? catalog.entries[0].id;
  status(
    'ready',
    selection.current
      ? 'Loading cancelled. The previous run remains paused.'
      : 'Loading cancelled. Choose a mission when ready.',
  );
  comparisonDetails();
  if (returnFocus && !document.hidden && document.hasFocus()) {
    const summary = $('mission').closest('details')?.querySelector('summary');
    [opener, summary, $('start')].find(visibleFocusTarget)?.focus();
  }
};
async function selectComparison(body) {
  const current = selection.current;
  if (!current || selection.pending || disposed) return;
  hold();
  $('show-comparison').checked = true;
  showComparison();
  const owner = { opener: $('comparison-body') };
  loadingFocus = owner;
  await current.comparison.select(body);
  if (loadingFocus === owner) loadingFocus = null;
  if (disposed || selection.current !== current) return;
  comparisonDetails();
  controls();
  paint();
}
$('comparison-body').onchange = () => void selectComparison($('comparison-body').value);
$('comparison-reduced').onchange = () => {
  hold('Comparison effects changed. Resume when ready.');
  selection.current?.comparison.setReduced($('comparison-reduced').checked);
  comparisonDetails();
  paint();
};
for (const id of ['capture-pulse', 'event-flashes'])
  $(id).onchange = () => {
    hold('Comparison accents changed. Resume when ready.');
    selection.current?.comparison.setFeedback({
      captureAccent: $('capture-pulse').checked,
      eventAccents: $('event-flashes').checked,
    });
    paint();
  };
$('reference-reduced').onchange = () => {
  hold('Effects changed. Resume when ready.');
  $('reference-label').textContent = $('reference-reduced').checked
    ? 'Reference · reduced effects'
    : 'Reference · standard effects';
  paint();
};
$('show-comparison').onchange = () => {
  showComparison();
  paint();
};
$('touch-mode').onchange = () => {
  hold('Touch control changed. Resume when ready.');
  $('direction-pad').hidden = $('touch-mode').value !== 'dpad';
};
$('load').onclick = () => void select($('mission').value, $('load'));
function loop(now) {
  const dt = lastTime === null ? 0 : (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.25) {
    hold('Paused after a long frame. Resume when ready.');
    paint();
    return;
  }
  const current = selection.current;
  if (current && !selection.pending) {
    const cueWasActive = readyCue.active;
    readyCue.advance(dt, current);
    resultFocus.advance(dt, current);
    if (!cueWasActive) current.session.advance(input.poll(), dt);
    paint(dt);
    refresh();
  }
}
const lifecycle = createPreviewLifecycle({
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (id) => cancelAnimationFrame(id),
  initialActive: !document.hidden,
  onFrame: loop,
  onSuspend() {
    loadingFocus = null;
    selection.cancel();
    selection.current?.comparison.cancel();
    startup?.abort();
    hold();
  },
  onResume() {
    hold('Paused after leaving the page. Resume or choose a mission when ready.');
    if (!catalog) void boot();
  },
});
function visibility() {
  document.hidden ? lifecycle.suspend() : lifecycle.resume();
}
function blur() {
  hold();
}
function pagehide(event) {
  if (event.persisted) lifecycle.suspend();
  else {
    disposed = true;
    lifecycle.dispose();
    input.destroy();
    retryGuard.destroy();
    resultFocus.destroy();
    selection.dispose();
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('blur', blur);
    window.removeEventListener('pagehide', pagehide);
    window.removeEventListener('pageshow', pageshow);
  }
}
function pageshow(event) {
  if (event.persisted && !document.hidden) lifecycle.resume();
}
document.addEventListener('visibilitychange', visibility);
window.addEventListener('blur', blur);
window.addEventListener('pagehide', pagehide);
window.addEventListener('pageshow', pageshow);
async function boot() {
  const controller = new AbortController();
  startup = controller;
  try {
    const [loadedCatalog, response] = await Promise.all([
      loadBenchmarkCatalog(),
      fetch(new URL('../motion-lab/presets.json', import.meta.url), { signal: controller.signal }),
    ]);
    controller.signal.throwIfAborted();
    if (!response.ok) throw new Error('Existing character presets could not be loaded.');
    const loadedPresets = await response.json();
    controller.signal.throwIfAborted();
    if (disposed) return;
    catalog = loadedCatalog;
    presets = loadedPresets;
    $('mission').replaceChildren(
      ...catalog.entries.map((entry) => {
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = `${entry.manifest.level.name} · ${entry.purpose}`;
        return option;
      }),
    );
    controls();
    if (document.hidden)
      status('ready', 'Source ready. Choose a mission when this page is visible.');
    else await select(catalog.entries[0].id);
  } catch (error) {
    if (!disposed && !controller.signal.aborted)
      status('error', `Benchmark unavailable: ${error.message} Reload to retry source loading.`);
  } finally {
    if (startup === controller) startup = null;
  }
}
void boot();
