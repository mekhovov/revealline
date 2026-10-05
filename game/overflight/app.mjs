import { mountModePlayShell } from '../ui/mode-play-shell.mjs';
import { attachModalNavigation } from '../ui/modal-navigation.mjs';
import { attachFullscreen } from '../ui/fullscreen.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { setMenuIcon } from '../ui/native-menu-icons.mjs';
import { contextualAppearance } from '../ui/mode-choice.mjs';
import { appearanceLaunchURL, nativeArtReviewURL } from '../fpv-entry.mjs';
import { installThemeHost } from '../presentation/theme-host.mjs';
import { createPresentationHost } from '../presentation/host.mjs';
import {
  createArcadeAdapter,
  selectedArcadeCollection,
} from '../presentation/industrial-arcade.mjs';
import { attachThemeFamilyControls } from '../ui/theme-family-controls.mjs';
import { createDisplayPreferences } from '../display-preferences.mjs';
import { sharedActorAppearance } from '../hunt/preferences.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { createAudioPreferences } from '../audio-preferences.mjs';
import { Soundscape } from '../ui/audio.mjs';
import { attachCouchMusicHost } from '../couch/couch-music-host.mjs';
import { getLocale, setLocale, onLocaleChange } from '../i18n/index.mjs';
import {
  DEFAULT_OVERFLIGHT_PROJECT,
  createOverflightProject,
  compileOverflightProject,
} from './project.mjs';
import {
  createOverflightLibrary,
  createOverflightPackage,
  exportOverflightPackage,
} from './community.mjs';
import { overflightBuildItems } from './upgrades.mjs';
import { pilot, selectCard, QUALIFICATION_BUILDS } from './review-pilot.mjs';
import { createOverflightReviewRecorder } from './review-recorder.mjs';
import { overflightFieldKitArt } from '../presentation/overflight-field-kit-art.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  chooseOverflightUpgrade,
  rerollOverflightUpgrades,
  pauseOverflight,
  resumeOverflight,
  overflightSummary,
} from './core.mjs';
import { createOverflightRenderer } from './renderer.mjs';
import {
  createOverflightClock,
  createOverflightInputGate,
  createOverflightRendererOwner,
  createOverflightContextGuard,
  overflightPreviewRequest,
  createOverflightReviewPlayback,
  createOverflightKeyboardState,
  createOverflightJSONPages,
} from './host-loop.mjs';
import { createOverflightAudio, overflightMusicContext } from './audio.mjs';
import { overflightText, localizedOverflight } from './copy.mjs';

const doc = globalThis.document;
const win = globalThis.window;
const $ = (id) => doc.getElementById(id);
const params = new URL(win.location.href).searchParams;
if (['en', 'uk'].includes(params.get('lang'))) setLocale(params.get('lang'), { persist: false });
const text = (key) => overflightText(getLocale(), key);
const local = (value) => localizedOverflight(value, getLocale());
const fixture = ['reference', 'stress'].includes(params.get('fixture'))
  ? params.get('fixture')
  : null;
const reviewBuild =
  !fixture && Object.hasOwn(QUALIFICATION_BUILDS, params.get('reviewBuild'))
    ? params.get('reviewBuild')
    : null;
const diagnostics = params.get('diagnostics') === '1' || !!fixture || !!reviewBuild;
const review = createOverflightReviewPlayback({ build: reviewBuild, pilot, selectCard });
const studio = params.get('studio') === 'overflight' && win.parent !== win;
const OPTION_KEY = 'revealline.overflight.options.v1';
let options = { airframes: 3, slowResume: true };
try {
  const saved = JSON.parse(win.localStorage.getItem(OPTION_KEY) ?? 'null');
  if (saved && [1, 3].includes(saved.airframes) && typeof saved.slowResume === 'boolean')
    options = { airframes: saved.airframes, slowResume: saved.slowResume };
} catch {
  /* Storage is optional; local choices remain usable. */
}
const persistOptions = () => {
  options = { airframes: Number($('airframes').value), slowResume: $('slow-resume').checked };
  try {
    win.localStorage.setItem(OPTION_KEY, JSON.stringify(options));
  } catch {
    /* Session-only preference. */
  }
};
let project = DEFAULT_OVERFLIGHT_PROJECT;
let compiled = compileOverflightProject(project);
let seed = Number(params.get('seed'));
if (!Number.isSafeInteger(seed) || seed < 1 || seed > 0xffffffff) seed = compiled.seed;
let run = null,
  renderer = null,
  shell = null,
  navigator = null,
  appearance = null;
let preparing = false,
  retired = false,
  runtimeFailed = false,
  epoch = 0,
  lastPhase = null;
let lastHUD = 0,
  lastMeasure = 0,
  lastFrame = null,
  offerKey = '',
  hudBuildKey = '',
  library = null,
  music = null,
  musicFrame = 0,
  recoveryPending = false,
  recoveryUnsupported = false,
  installed = [];
let frames = [],
  simulation = [],
  longFrames = 0,
  rawOverflow = 0,
  clipCaptureUsed = false,
  rawPages = null,
  preparationIdentity = null;
const clipRecorder = reviewBuild
  ? createOverflightReviewRecorder({ window: win, onState: updateClip })
  : null;
const rendererOwner = createOverflightRendererOwner();
const contextGuard = createOverflightContextGuard({ pause, release: releaseInput });
const cleanup = [];
const clock = createOverflightClock();
const inputGate = createOverflightInputGate();
const held = createOverflightKeyboardState();
const padHistory = new Map();
let input = { x: 0, y: 0, boost: false };
const listen = (target, type, fn, settings) => {
  target.addEventListener(type, fn, settings);
  cleanup.push(() => target.removeEventListener(type, fn, settings));
};
const el = (tag, value = '', className = '') => {
  const node = doc.createElement(tag);
  node.textContent = value;
  node.className = className;
  return node;
};
const display = createDisplayPreferences({
  window: win,
  onWarning: (message) => showStatus(message),
});
const context = contextualAppearance(doc);
const theme = installThemeHost({
  document: doc,
  window: win,
  displayPreferences: display,
  appearanceDefault: context,
  appearanceThemes: context?.appearanceThemes,
  onWarning: (message) => showStatus(message),
});
const artwork = createPresentationHost({ profile: 'board', document: doc });
const artAbort = new AbortController();
const artReady = artwork.load({ signal: artAbort.signal });
const arcade = createArcadeAdapter({ reviewRevision: compiled.resources.actorArtRevision });
const castPreferences = sharedActorAppearance();
const audioMaster = createAudioMaster();
const audioPreferences = createAudioPreferences({ audioMaster, window: win });
const sound = new Soundscape({ audioMaster, persistentMusic: true });
sound.configure({ master: 1, sfx: 0.7 });
const audio = createOverflightAudio(sound, {
  presentation: {
    async readAudio(slot, settings) {
      await artReady;
      return slot === 'audio.pickup' ? artwork.readAudio(slot, settings) : null;
    },
  },
});

function showStatus(message = '') {
  if (retired) return;
  $('play-status').textContent = message;
  $('play-status').hidden = !message;
}
function releaseInput() {
  input = { x: 0, y: 0, boost: false };
  inputGate.release();
  clock.reset();
  navigator?.cancelConfirm();
}
function activeModal() {
  return music?.root() ?? ($('upgrade-dialog').open ? $('upgrade-dialog') : shell?.topDialog());
}
function phaseForShell() {
  return run?.phase === 'playing'
    ? 'playing'
    : ['won', 'lost'].includes(run?.phase)
      ? 'results'
      : ['paused', 'upgrade'].includes(run?.phase)
        ? 'paused'
        : 'ready';
}
function reviewLabel() {
  return reviewBuild ? `${text('automatedReview')} · ${text(`reviewBuild_${reviewBuild}`)}` : '';
}
function updateShell() {
  shell?.update({
    phase: phaseForShell(),
    missionName: project.title,
    summary: reviewBuild ? `${reviewLabel()}. ${text('briefing')}` : text('briefing'),
    muted: audioMaster.snapshot().muted,
    canResume:
      !!run &&
      !!renderer &&
      !preparing &&
      !runtimeFailed &&
      !contextGuard.blocked() &&
      ['playing', 'paused', 'upgrade'].includes(run.phase),
  });
  if (shell) {
    const unavailable = preparing || runtimeFailed || !renderer || contextGuard.blocked();
    for (const name of ['primary', 'start']) shell.elements.buttons[name].disabled = unavailable;
    if (unavailable) shell.elements.buttons.pause.disabled = true;
    if (runtimeFailed) shell.elements.buttons['home-retry'].hidden = false;
  }
}
function pause({ menu = true } = {}) {
  if (!run || retired) return;
  pauseOverflight(run);
  releaseInput();
  sound.gameplayPaused = true;
  sound.pause();
  updateShell();
  if (run.phase === 'paused' && $('upgrade-dialog').open) $('upgrade-dialog').close();
  if (run.phase === 'upgrade') {
    syncUpgrade();
    return;
  }
  if (menu) shell?.open('home');
  else if (run.phase === 'paused') showStatus(text('paused'));
}
function start() {
  if (!run || !renderer || preparing || runtimeFailed || contextGuard.blocked() || retired) return;
  if (run.phase === 'upgrade') return syncUpgrade();
  if (run.phase === 'ready') {
    if (run.airframes !== options.airframes || run.slowResume !== options.slowResume) {
      run = createOverflightRun(compiled, { seed, ...options, fixture });
      run.appearance = preparationIdentity;
    }
    startOverflight(run);
  } else if (run.phase === 'paused') resumeOverflight(run);
  else return;
  releaseInput();
  showStatus();
  updateShell();
  if (run.phase === 'upgrade') return syncUpgrade();
  void music?.start();
  const owner = run;
  sound.gameplayPaused = false;
  void sound.enable().then(() => {
    if (owner !== run || run.phase !== 'playing' || retired) sound.pause();
    else void audio.prepare();
  });
}
function formatTime(seconds) {
  const value = Math.floor(Math.max(0, seconds ?? 0));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
function moduleIcon(id) {
  const slot = `pickup.module-${id}`;
  const canvas = doc.createElement('canvas');
  canvas.width = canvas.height = 16;
  canvas.className = 'overflight-module-icon';
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('2d');
  const accepted = appearance?.snapshot.image(slot);
  if (accepted?.image) context.drawImage(accepted.image, 0, 0, 16, 16);
  else {
    const art = overflightFieldKitArt(slot) ?? overflightFieldKitArt('pickup.module-primary');
    const pixels = context.createImageData(16, 16);
    pixels.data.set(art.rgba);
    context.putImageData(pixels, 0, 0);
  }
  return canvas;
}
function buildLabel() {
  return run
    ? overflightBuildItems(run.build)
        .map((item) => `${local(item.title)} ${item.rank}`)
        .join(' · ')
    : '';
}
function updateRecoveryControl() {
  $('test-graphics-recovery').disabled =
    preparing ||
    runtimeFailed ||
    contextGuard.blocked() ||
    recoveryPending ||
    recoveryUnsupported ||
    !renderer;
  $('record-review-clip').disabled =
    !reviewBuild ||
    preparing ||
    runtimeFailed ||
    contextGuard.blocked() ||
    run?.phase !== 'playing' ||
    clipRecorder?.snapshot().phase === 'recording';
}
function updateClip(state = clipRecorder?.snapshot()) {
  if (!state || retired) return;
  $('review-clip-status').textContent = text(`clip_${state.phase}`);
  $('hud-review').textContent =
    state.phase === 'recording' ? `${reviewLabel()} · ${text('clip_recording')}` : reviewLabel();
  const ready = state.phase === 'ready';
  $('review-clip-video').hidden = !ready;
  $('download-review-clip').hidden = !ready;
  if (ready) {
    $('review-clip-video').src = state.url;
    $('download-review-clip').href = state.url;
    $('download-review-clip').download =
      `overflight-${reviewBuild}-${seed}-battlefield-only.${state.mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
  } else {
    $('review-clip-video').removeAttribute('src');
    $('download-review-clip').removeAttribute('href');
  }
  updateRecoveryControl();
}
function updateHUD() {
  updateRecoveryControl();
  if (!run) return;
  $('hud-time').textContent = formatTime(run.time);
  $('hud-hull').textContent =
    `${text('hull')} ${Math.ceil(run.player.hull)}/${run.player.maxHull} · ${text('airframes')} ${run.airframesRemaining}`;
  $('hud-level').textContent = `${text('level')} ${run.progression.choices + 1}`;
  const cooldown = Math.max(0, run.player.boostCooldown ?? 0);
  $('hud-boost').textContent =
    `${text('boost')} ${cooldown > 0 ? `${cooldown.toFixed(1)}s` : text('ready')}`;
  const label = buildLabel();
  if (label !== hudBuildKey) {
    hudBuildKey = label;
    $('hud-build').replaceChildren();
    for (const item of overflightBuildItems(run.build)) {
      const badge = el('span', '', 'overflight-build-item');
      badge.append(moduleIcon(item.id), el('span', `${local(item.title)} ${item.rank}`));
      $('hud-build').append(badge);
    }
  }
  const index = run.progression.choices;
  const thresholds = compiled.upgrades.thresholds;
  const previous = thresholds[index - 1] ?? 0;
  const next = thresholds[index] ?? previous;
  const xp = run.progression.xp;
  const percent =
    next > previous ? Math.max(0, Math.min(1, (xp - previous) / (next - previous))) : 1;
  $('xp-fill').style.width = `${percent * 100}%`;
}
function result() {
  const summary = overflightSummary(run);
  $('result-title').textContent = text(run.phase === 'won' ? 'won' : 'lost');
  $('result-stats').replaceChildren();
  for (const [key, value] of [
    ['elapsed', formatTime(run.time)],
    ['kills', summary.kills ?? run.stats?.kills ?? 0],
    ['salvage', summary.stats.xpCollected],
    ['build', buildLabel()],
  ])
    $('result-stats').append(el('dt', text(key)), el('dd', String(value)));
  updateShell();
  shell.open('results');
}
function choose(id) {
  if (!run || run.phase !== 'upgrade') return;
  if (chooseOverflightUpgrade(run, id) === false) return;
  releaseInput();
  offerKey = '';
  if (run.phase === 'upgrade') return syncUpgrade();
  $('upgrade-dialog').close();
  if (run.slowResume) clock.slowResume(performance.now());
  sound.gameplayPaused = false;
  void sound.resume();
  audio.update(run);
  $('render-host').focus({ preventScroll: true });
  updateShell();
  updateHUD();
}
function syncUpgrade(force = false) {
  if (run?.phase !== 'upgrade') return;
  const key = `${getLocale()}:${(run.offers ?? []).map((offer) => offer.id).join('|')}`;
  if (force || key !== offerKey) {
    offerKey = key;
    $('upgrade-cards').replaceChildren();
    for (const offer of run.offers ?? []) {
      const button = el('button', '', 'overflight-upgrade-card');
      button.type = 'button';
      button.dataset.upgradeId = offer.id;
      button.disabled = !!reviewBuild;
      button.append(
        moduleIcon(offer.system),
        el('strong', local(offer.title)),
        el('span', local(offer.description)),
      );
      for (const [name, value] of [
        ['current', offer.current],
        ['next', offer.next],
      ])
        if (value !== null && value !== undefined)
          button.append(el('span', `${text(name)}: ${local(value)}`));
      if (offer.evolution)
        button.append(
          el('span', `${text('evolution')}: ${local(offer.evolution)}`, 'upgrade-evolution'),
        );
      button.addEventListener('click', () => choose(offer.id));
      $('upgrade-cards').append(button);
    }
    $('reroll-upgrades').textContent = text('reroll');
    const remaining = run.progression.rerolls;
    $('rerolls-left').textContent = `${remaining} ${text('rerolls')}`;
    $('reroll-upgrades').disabled = !!reviewBuild || remaining <= 0;
  }
  if (!$('upgrade-dialog').open) {
    releaseInput();
    sound.pause();
    updateShell();
    $('upgrade-dialog').showModal();
    $('upgrade-cards').querySelector('button')?.focus({ preventScroll: true });
  }
}
function transition() {
  if (!run || run.phase === lastPhase) return;
  lastPhase = run.phase;
  updateShell();
  if (run.phase === 'upgrade') syncUpgrade();
  if (['won', 'lost'].includes(run.phase)) {
    releaseInput();
    sound.encounter(run.phase === 'won' ? 'objective' : 'failure');
    sound.pause();
    result();
  }
}
async function prepare({ nextProject = project, nextSeed = seed, launch = false } = {}) {
  const nextCompiled = compileOverflightProject(nextProject);
  if (!Number.isSafeInteger(nextSeed) || nextSeed < 1 || nextSeed > 0xffffffff)
    throw new TypeError('Invalid preview seed.');
  const ticket = ++epoch;
  clipRecorder?.cancel();
  if (runtimeFailed) rendererOwner.invalidate();
  preparing = true;
  if (run) pauseOverflight(run);
  updateRecoveryControl();
  updateShell();
  releaseInput();
  sound.pause();
  if ($('upgrade-dialog').open) $('upgrade-dialog').close();
  showStatus(text('preparing'));
  try {
    await Promise.all([artReady, theme.ready]);
    if (retired || ticket !== epoch) return false;
    const base = artwork.current();
    const resolvedTheme = theme.snapshot();
    const collection = selectedArcadeCollection(theme.effectivePreferences());
    const cast = castPreferences.snapshot().cast;
    const frozenIdentity = {
      manifestSha256: base.manifestSha256,
      presentation: base.source,
      themeIdentity: resolvedTheme.identity,
      familyId: resolvedTheme.familyId,
      familyRevision: resolvedTheme.familyRevision,
      interfaceId: resolvedTheme.interfaceId,
      interfaceRevision: resolvedTheme.revision,
      arcade: collection ? { id: collection.id, revision: collection.revision } : null,
      actorArtRevision: nextCompiled.resources.actorArtRevision,
      equipment: nextCompiled.resources.effects,
      materialStyle: resolvedTheme.materialStyle,
      materialVariant: resolvedTheme.materialVariant,
      playerSlot: base.image('player.scout.detailed')
        ? 'player.scout.detailed'
        : 'player.scout.compact',
      cast,
    };
    const nextRenderer = await rendererOwner.acquire(JSON.stringify(frozenIdentity), async () => {
      renderer = null;
      contextGuard.restore();
      recoveryPending = false;
      recoveryUnsupported = false;
      arcade.clear();
      arcade.setReviewRevision(nextCompiled.resources.actorArtRevision);
      appearance = {
        snapshot: arcade.resolve(base, collection),
        theme: resolvedTheme,
        artRevision: frozenIdentity.actorArtRevision,
        cast: frozenIdentity.cast,
        reducedEffects: display.snapshot().effectiveReducedEffects,
      };
      return createOverflightRenderer({
        parent: $('render-host'),
        appearance,
        onFrame,
        onContextLost() {
          contextGuard.lose();
          updateRecoveryControl();
          showStatus(text('renderingLost'));
        },
        onContextRestored() {
          contextGuard.restore();
          recoveryPending = false;
          updateRecoveryControl();
          updateShell();
          showStatus(text('renderingRestored'));
        },
        onError(error) {
          runtimeFailed = true;
          rendererOwner.invalidate();
          pause();
          showStatus(`${text('runtimeError')} ${error?.message ?? ''}`);
        },
      });
    });
    if (retired || ticket !== epoch) return false;
    renderer = nextRenderer;
    preparationIdentity = Object.freeze({
      projectIdentity: nextCompiled.projectIdentity,
      ...frozenIdentity,
    });
    music?.setContext(overflightMusicContext(nextCompiled, frozenIdentity));
    project = nextProject;
    compiled = nextCompiled;
    seed = nextSeed;
    run = createOverflightRun(compiled, { seed, ...options, fixture });
    run.appearance = preparationIdentity;
    review.reset();
    audio.reset();
    clock.reset();
    clock.clearMeasurements();
    renderer.resetMeasurements?.();
    lastPhase = null;
    offerKey = '';
    hudBuildKey = '';
    lastFrame = null;
    frames = [];
    simulation = [];
    longFrames = 0;
    rawOverflow = 0;
    clipCaptureUsed = false;
    rawPages = null;
    $('raw-metrics').value = '';
    $('raw-metrics').hidden = true;
    $('raw-metrics-navigation').hidden = true;
    preparing = false;
    runtimeFailed = false;
    showStatus();
    updateHUD();
    updateShell();
    renderer.present(run);
    if (launch) {
      shell.enterPlay();
      start();
    } else if (studio || params.has('community')) {
      shell.open('briefing');
      if (studio) showStatus(text('previewReady'));
    }
    return true;
  } catch (error) {
    if (ticket !== epoch || retired) return false;
    preparing = false;
    runtimeFailed = true;
    updateShell();
    showStatus(`${text('prepareFailed')} ${error.message}`);
    throw error;
  }
}
const gameplayKeys = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'Space',
]);
function readInput() {
  const pads = Array.from(win.navigator.getGamepads?.() ?? []).filter(
    (pad) => pad?.connected !== false && pad,
  );
  const present = new Set(pads.map((pad) => pad.index));
  for (const id of padHistory.keys())
    if (!present.has(id)) {
      padHistory.delete(id);
      pause();
    }
  let axes = { x: 0, y: 0, boost: false },
    allNeutral = true;
  for (const pad of pads.slice(0, 1)) {
    const x = Math.abs(pad.axes[0] ?? 0) > 0.2 ? pad.axes[0] : 0;
    const y = Math.abs(pad.axes[1] ?? 0) > 0.2 ? pad.axes[1] : 0;
    const pressed = pad.buttons.map((button) => button.pressed);
    const direction =
      pressed[12] || y < -0.55
        ? 'up'
        : pressed[13] || y > 0.55
          ? 'down'
          : pressed[14] || x < -0.55
            ? 'left'
            : pressed[15] || x > 0.55
              ? 'right'
              : null;
    const prior = padHistory.get(pad.index);
    padHistory.set(pad.index, { pressed, direction });
    allNeutral = x === 0 && y === 0 && !pressed.some(Boolean);
    if (!prior) {
      inputGate.release();
      continue;
    }
    if (activeModal()) {
      navigator?.handle({
        direction: direction !== prior.direction ? direction : null,
        confirmStart: !!pressed[0] && !prior.pressed[0],
        confirmCommit: !pressed[0] && !!prior.pressed[0],
        back: !!pressed[1] && !prior.pressed[1],
        menu: !!pressed[9] && !prior.pressed[9],
      });
    } else if (pressed[9] && !prior.pressed[9]) pause();
    axes = {
      x: x || Number(!!pressed[15]) - Number(!!pressed[14]),
      y: y || Number(!!pressed[13]) - Number(!!pressed[12]),
      boost: !!pressed[7],
    };
  }
  const editing = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(doc.activeElement?.tagName);
  const keyX = editing
    ? 0
    : Number(held.has('KeyD') || held.has('ArrowRight')) -
      Number(held.has('KeyA') || held.has('ArrowLeft'));
  const keyY = editing
    ? 0
    : Number(held.has('KeyS') || held.has('ArrowDown')) -
      Number(held.has('KeyW') || held.has('ArrowUp'));
  const boost = (!editing && held.has('Space')) || axes.boost;
  return inputGate.sample({
    x: keyX || axes.x,
    y: keyY || axes.y,
    boost,
    neutral: !held.size && allNeutral,
  });
}
function reviewIdentity() {
  return reviewBuild
    ? { automated: true, build: reviewBuild, route: 'tight', inputHz: 10, upgradeDelayMs: 1500 }
    : null;
}
function sortieSummary() {
  return run
    ? { ...overflightSummary(run), appearance: preparationIdentity, review: reviewIdentity() }
    : null;
}
function measurement({ raw = false } = {}) {
  return {
    format: 'OverflightMeasurementsV1',
    capturedAt: new Date().toISOString(),
    fixture,
    review: reviewIdentity(),
    clipCaptureUsed,
    viewport: {
      width: win.innerWidth,
      height: win.innerHeight,
      devicePixelRatio: win.devicePixelRatio,
    },
    browser: win.navigator.userAgent,
    appearance: preparationIdentity,
    projectIdentity: compiled.projectIdentity,
    seed,
    summary: sortieSummary(),
    renderer: renderer?.stats({ raw }) ?? null,
    trialValid:
      !clipCaptureUsed && !runtimeFailed && clock.stats().droppedSeconds === 0 && rawOverflow === 0,
    rawOverflow,
    invalidReasons: [
      ...(clipCaptureUsed ? ['review-clip-recording-overhead'] : []),
      ...(runtimeFailed ? ['runtime-failure'] : []),
      ...(clock.stats().droppedSeconds > 0 ? ['dropped-catch-up-time'] : []),
      ...(rawOverflow > 0 ? ['raw-sample-capacity-exceeded'] : []),
    ],
    simulationSamples: simulation.length,
    ...(raw ? { simulation: [...simulation] } : {}),
    clock: clock.stats(),
    longFrames,
    frameSamples: frames.length,
    ...(raw ? { frames: [...frames] } : {}),
  };
}
function onFrame(now) {
  if (retired || preparing || runtimeFailed || !run || !renderer) return;
  try {
    input = readInput();
    const active =
      run.phase === 'playing' && !activeModal() && !contextGuard.blocked() && !doc.hidden;
    let stepCPU = 0,
      steps = 0;
    clock.advance(now, active, (dt) => {
      const started = performance.now();
      stepOverflight(run, review.input(run, input), dt);
      stepCPU += performance.now() - started;
      steps++;
      audio.update(run);
      transition();
      return run.phase === 'playing';
    });
    renderer.present(run);
    transition();
    const reviewChoice = review.upgrade(
      run,
      now,
      !doc.hidden && !contextGuard.blocked() && activeModal() === $('upgrade-dialog'),
    );
    if (reviewChoice) {
      syncUpgrade();
      for (const card of $('upgrade-cards').children)
        card.dataset.reviewSelected = String(card.dataset.upgradeId === reviewChoice.selectedId);
      if (reviewChoice.choiceId) choose(reviewChoice.choiceId);
    }
    if (now - musicFrame >= 50) {
      music?.update(active && run.phase === 'playing', { family: 'fpv' }, { status: run.phase });
      musicFrame = now;
    }
    if (diagnostics && active && steps) {
      if (simulation.length < 120000)
        simulation.push({ tick: run.tick, milliseconds: stepCPU, steps });
      else rawOverflow++;
    }
    if (now - lastHUD > 100) {
      updateHUD();
      lastHUD = now;
    }
    if (diagnostics && active && lastFrame !== null) {
      const milliseconds = now - lastFrame;
      if (milliseconds > 50) longFrames++;
      if (frames.length < 120000) frames.push({ tick: run.tick, time: run.time, milliseconds });
      else rawOverflow++;
      if ($('overflight-diagnostics').open && now - lastMeasure > 2000) {
        $('diagnostic-values').textContent = JSON.stringify(
          {
            phase: run.phase,
            time: Number(run.time.toFixed(2)),
            ...renderer.stats(),
            clock: clock.stats(),
            longFrames,
            trialValid:
              !clipCaptureUsed &&
              !runtimeFailed &&
              clock.stats().droppedSeconds === 0 &&
              rawOverflow === 0,
          },
          null,
          2,
        );
        lastMeasure = now;
      }
    }
    lastFrame = active ? now : null;
  } catch (error) {
    runtimeFailed = true;
    rendererOwner.invalidate();
    pause();
    showStatus(`${text('runtimeError')} ${error.message}`);
  }
}
function refreshCopy() {
  doc.documentElement.lang = getLocale();
  doc.title = `${text('title')} · FPV / LINE`;
  for (const node of doc.querySelectorAll('[data-copy]'))
    node.textContent = text(node.dataset.copy);
  $('language').value = getLocale();
  $('raw-metrics').setAttribute('aria-label', text('rawMeasurements'));
  shell?.setLocale(getLocale());
  $('fixture-description').textContent = fixture
    ? `${text('fixture')}: ${fixture}. ${text('fixtureHelp')}`
    : '';
  $('fixture-description').hidden = !fixture;
  for (const id of ['review-description', 'hud-review', 'result-review']) {
    $(id).textContent = reviewLabel();
    $(id).hidden = !reviewBuild;
  }
  $('review-help').hidden = !reviewBuild;
  updateClip();
  updateShell();
  updateHUD();
  renderMissions();
  if (run?.phase === 'upgrade') syncUpgrade(true);
  if (['won', 'lost'].includes(run?.phase)) result();
}
function destination(path) {
  const target = new URL(path, import.meta.url);
  target.searchParams.set('lang', getLocale());
  return nativeArtReviewURL(
    appearanceLaunchURL(target.href, contextualAppearance(doc)),
    win.location.href,
  );
}
for (const [path, key] of [
  ['../index.html', 'mainGame'],
  ['../snake/play.html', 'snake'],
]) {
  const link = el('a', text(key));
  link.href = destination(path);
  listen(link, 'click', () => {
    link.href = destination(path);
    pause({ menu: false });
  });
  $('overflight-mode-links').append(link);
}
shell = mountModePlayShell({
  document: doc,
  mount: $('overflight-shell'),
  idPrefix: 'overflight',
  modeName: { en: 'Overflight', uk: 'Проліт' },
  locale: getLocale(),
  wordmarkURL: new URL('../ui/art/identity/fpv-line/wordmark.png', import.meta.url).href,
  slots: Object.fromEntries(
    ['missions', 'briefing', 'settings', 'help', 'workshop', 'results']
      .map((name) => [name, $(`overflight-${name}`)])
      .concat([
        ['play', $('overflight-game')],
        ['modes', $('overflight-mode-links')],
      ]),
  ),
  services: { attachModalNavigation, attachFullscreen, setMenuIcon },
  actions: {
    pause: () => pause({ menu: false }),
    start,
    resume: start,
    continue: start,
    retry: () => {
      void prepare({ launch: true }).catch(() => {});
    },
    canResume: () =>
      !!run &&
      !!renderer &&
      !runtimeFailed &&
      !contextGuard.blocked() &&
      ['paused', 'playing', 'upgrade'].includes(run.phase),
    toggleSound: () => {
      audioPreferences.setMuted(!audioMaster.snapshot().muted);
      if (!audioMaster.snapshot().muted) void sound.enable();
      updateShell();
    },
  },
  initial: studio || params.has('community') || reviewBuild ? 'briefing' : 'home',
  focusPlay: () => $('render-host').focus({ preventScroll: true }),
  onSurfaceChange: (name) => {
    if (name === 'missions') void refreshMissions();
  },
});
music = attachCouchMusicHost({
  document: doc,
  root: $('overflight-music'),
  prefix: 'overflight',
  audioMaster,
  audioPreferences,
  soundscape: sound,
  canControl: () => !retired && !doc.hidden,
  canOpen: () => !retired && !doc.hidden && shell.elements.dialogs.settings.open,
  getOwner: () => `${epoch}:${shell.elements.dialogs.settings.open}`,
  getScene: () => (!run || run.phase === 'ready' ? 'menu' : 'gameplay'),
  onOpen: () => pause({ menu: false }),
  onClose: releaseInput,
});
function renderMissions() {
  const root = $('overflight-mission-list');
  if (!root) return;
  root.replaceChildren();
  for (const encounterSet of ['front', 'crossing', 'mixed']) {
    const candidate = createOverflightProject({ encounterSet });
    const button = el('button', local(candidate.title));
    button.type = 'button';
    button.addEventListener('click', () => {
      void prepare({ nextProject: candidate, nextSeed: candidate.seed })
        .then((accepted) => {
          if (accepted) shell.open('briefing');
        })
        .catch(() => {});
    });
    root.append(button);
  }
  const community = $('overflight-installed-list');
  community.replaceChildren();
  if (!installed.length) community.append(el('p', text('noInstalled')));
  for (const entry of installed) {
    const button = el('button', local(entry.title));
    button.type = 'button';
    button.addEventListener('click', () => {
      void prepare({ nextProject: entry.project, nextSeed: entry.project.seed })
        .then((accepted) => {
          if (accepted) shell.open('briefing');
        })
        .catch(() => {});
    });
    const row = el('div', '', 'overflight-installed-entry');
    const exportButton = el('button', text('exportEncounter'));
    exportButton.type = 'button';
    exportButton.setAttribute('aria-label', `${text('exportEncounter')} · ${local(entry.title)}`);
    exportButton.addEventListener('click', () => {
      downloadBlob(
        exportOverflightPackage(createOverflightPackage(entry.project)),
        `${entry.project.id}.overflight.json`,
      );
    });
    const removeButton = el('button', text('removeEncounter'));
    removeButton.type = 'button';
    removeButton.setAttribute('aria-label', `${text('removeEncounter')} · ${local(entry.title)}`);
    removeButton.addEventListener('click', async () => {
      removeButton.disabled = true;
      try {
        await library.remove(entry.identity);
        await refreshMissions();
        $('installed-status').textContent = `${local(entry.title)} · ${text('encounterRemoved')}`;
      } catch (error) {
        $('installed-status').textContent = `${text('libraryFailed')} ${error.message}`;
        removeButton.disabled = false;
      }
    });
    row.append(button, exportButton, removeButton);
    community.append(row);
  }
}
async function refreshMissions() {
  if (!library) return;
  try {
    installed = await library.list();
  } catch (error) {
    showStatus(`${text('libraryFailed')} ${error.message}`);
  }
  renderMissions();
}
navigator = attachControllerNavigation({
  document: doc,
  keyboard: true,
  getScope: () => (activeModal() ? 'ui' : 'flight'),
  getRoot: () => activeModal() ?? $('overflight-shell'),
  getDefaultFocus: () => activeModal()?.querySelector('button:not(:disabled),a[href]'),
  onBack: () => {
    if (music?.root()) music.back();
    else if (!$('upgrade-dialog').open) shell.back();
  },
  onMenu: () => {
    if (music?.root()) music.back();
    else if (!$('upgrade-dialog').open) shell.back();
  },
});
const themeControls = attachThemeFamilyControls({
  document: doc,
  root: $('overflight-appearance'),
  host: theme,
  prefix: 'overflight-',
});
cleanup.push(onLocaleChange(refreshCopy));
cleanup.push(
  display.subscribe((value) => {
    $('text-face').value = value.textFace;
    $('text-size').value = value.textSize;
    $('reduced-effects').checked = value.reducedEffects;
    doc.body.dataset.textSize = value.textSize;
    doc.body.dataset.textFace = value.textFace;
    if (appearance) appearance.reducedEffects = value.effectiveReducedEffects;
  }),
);
cleanup.push(
  audioMaster.subscribe((value) => {
    $('muted').checked = value.muted;
    $('volume').value = String(value.volume);
    updateShell();
  }),
);
for (const [id, event, fn] of [
  ['language', 'change', () => setLocale($('language').value)],
  ['airframes', 'change', persistOptions],
  ['slow-resume', 'change', persistOptions],
  ['text-face', 'change', () => display.set({ textFace: $('text-face').value })],
  ['text-size', 'change', () => display.set({ textSize: $('text-size').value })],
  [
    'reduced-effects',
    'change',
    () => display.set({ reducedEffects: $('reduced-effects').checked }),
  ],
  [
    'muted',
    'change',
    () => {
      audioPreferences.setMuted($('muted').checked);
      if (!$('muted').checked) void sound.enable();
    },
  ],
  ['volume', 'input', () => audioPreferences.setVolume(Number($('volume').value))],
  [
    'reroll-upgrades',
    'click',
    () => {
      if (run?.phase === 'upgrade' && rerollOverflightUpgrades(run)) {
        offerKey = '';
        syncUpgrade();
        $('upgrade-cards').querySelector('button')?.focus();
      }
    },
  ],
])
  listen($(id), event, fn);
$('airframes').value = String(options.airframes);
$('slow-resume').checked = options.slowResume;
listen($('upgrade-dialog'), 'cancel', (event) => event.preventDefault());
listen(doc, 'keydown', (event) => {
  if (gameplayKeys.has(event.code)) held.press(event.code, event.repeat);
  if (
    activeModal() ||
    event.defaultPrevented ||
    ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(event.target?.tagName)
  )
    return;
  if (gameplayKeys.has(event.code)) event.preventDefault();
  if (event.code === 'Escape' && !event.repeat) {
    event.preventDefault();
    pause();
  }
});
listen(doc, 'keyup', (event) => held.release(event.code));
listen(win, 'blur', () => {
  held.clear();
  pause();
  music?.suspend();
});
listen(doc, 'visibilitychange', () => {
  if (doc.hidden) {
    held.clear();
    pause();
    music?.suspend();
  }
});
listen($('studio-link'), 'click', () => {
  $('studio-link').href = destination('../studio/overflight.html');
});
listen($('render-host'), 'pointerdown', () => $('render-host').focus({ preventScroll: true }));
listen($('test-graphics-recovery'), 'click', () => {
  if (
    !diagnostics ||
    preparing ||
    runtimeFailed ||
    contextGuard.blocked() ||
    !renderer ||
    recoveryPending ||
    recoveryUnsupported
  )
    return;
  recoveryPending = true;
  updateRecoveryControl();
  const requested = renderer.requestContextRecoveryTest?.() === true;
  if (!requested) {
    recoveryPending = false;
    recoveryUnsupported = true;
  }
  $('diagnostic-status').textContent = text(
    requested ? 'recoveryRequested' : 'recoveryUnsupported',
  );
  $('diagnostic-status').hidden = false;
  updateRecoveryControl();
});
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = el('a');
  link.href = url;
  link.download = filename;
  link.click();
  win.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
listen($('inspect-raw-metrics'), 'click', () => {
  if (!diagnostics) return;
  pause({ menu: false });
  const snapshot = measurement({ raw: true });
  // Keep the visible/accessibility tree compact. Only the selector's current
  // chunk enters the textarea; the complete immutable record remains downloadable.
  rawPages = createOverflightJSONPages(snapshot);
  const header = {
    ...snapshot,
    simulation: undefined,
    frames: undefined,
    renderer: snapshot.renderer && {
      ...snapshot.renderer,
      rawIntervals: undefined,
      rawSubmission: undefined,
      atlas: {
        ...snapshot.renderer.atlas,
        frames: undefined,
        frameCount: snapshot.renderer.atlas.frames.length,
      },
    },
    rawPages: rawPages.count,
  };
  $('diagnostic-values').textContent = JSON.stringify(header, null, 2);
  $('raw-metrics-page').replaceChildren();
  for (let index = 0; index < rawPages.count; index++) {
    const option = el('option', `${index + 1} / ${rawPages.count}`);
    option.value = String(index);
    $('raw-metrics-page').append(option);
  }
  $('raw-metrics').value = rawPages.page(0);
  $('raw-metrics').hidden = false;
  $('raw-metrics-navigation').hidden = false;
});
listen($('raw-metrics-page'), 'change', () => {
  if (rawPages) $('raw-metrics').value = rawPages.page(Number($('raw-metrics-page').value));
});
listen($('record-review-clip'), 'click', () => {
  if (
    !reviewBuild ||
    preparing ||
    runtimeFailed ||
    contextGuard.blocked() ||
    run?.phase !== 'playing'
  )
    return;
  if (clipRecorder.record($('render-host').querySelector('canvas'))) {
    clipCaptureUsed = true;
    $('overflight-diagnostics').open = false;
    $('render-host').focus({ preventScroll: true });
  }
});
listen($('download-metrics'), 'click', () => {
  pause({ menu: false });
  downloadBlob(
    new Blob([rawPages?.json ?? JSON.stringify(measurement({ raw: true }))], {
      type: 'application/json',
    }),
    `overflight-${fixture ?? 'sortie'}-${seed}.json`,
  );
});
function acknowledge(type, values = {}) {
  if (studio)
    win.parent.postMessage(
      { type: `overflight:${type}`, version: 1, ...values },
      win.location.origin,
    );
}
listen(win, 'message', async (event) => {
  const request =
    studio &&
    overflightPreviewRequest(event, {
      window: win,
      parent: win.parent,
      origin: win.location.origin,
    });
  if (!request) return;
  try {
    const accepted = await prepare({
      nextProject: request.project,
      nextSeed: request.seed ?? request.project?.seed,
    });
    if (accepted)
      acknowledge('accepted', {
        requestId: request.requestId,
        projectIdentity: compiled.projectIdentity,
      });
  } catch (error) {
    acknowledge('error', { requestId: request.requestId, message: error.message });
  }
});
async function dispose() {
  if (retired) return;
  retired = true;
  epoch++;
  clipRecorder?.dispose();
  releaseInput();
  renderer = null;
  if ($('upgrade-dialog').open) $('upgrade-dialog').close();
  navigator.destroy();
  shell.dispose();
  themeControls.dispose();
  cleanup
    .splice(0)
    .reverse()
    .forEach((fn) => fn());
  music?.dispose();
  audio.dispose();
  void sound.dispose();
  audioPreferences.dispose();
  audioMaster.dispose();
  await rendererOwner.dispose();
  arcade.clear();
  artAbort.abort();
  artwork.close();
  theme.dispose();
  display.dispose();
  library?.dispose?.();
  delete win.RevealLineOverflight;
}
listen(win, 'pagehide', (event) => {
  held.clear();
  clipRecorder?.cancel();
  pause({ menu: false });
  music?.suspend();
  sound.suspend();
  if (!event.persisted) dispose();
});
listen(win, 'pageshow', (event) => {
  if (event.persisted) {
    releaseInput();
    updateShell();
  }
});
$('overflight-diagnostics').hidden = !diagnostics;
$('review-clip-controls').hidden = !reviewBuild;
$('overflight-shell').hidden = false;
refreshCopy();
try {
  library = createOverflightLibrary();
  await refreshMissions();
  if (params.has('community')) {
    const loaded = await library.load(params.get('community'));
    project = loaded.project ?? loaded;
    compiled = compileOverflightProject(project);
    seed = compiled.seed;
  }
  await prepare();
  $('boot-status').hidden = true;
  Object.defineProperty(win, 'RevealLineOverflight', {
    configurable: true,
    value: Object.freeze({
      snapshot: () => ({
        phase: run?.phase,
        summary: sortieSummary(),
        appearance: preparationIdentity,
      }),
      measurements: (options = {}) => measurement({ raw: options?.raw === true }),
    }),
  });
  acknowledge('ready');
} catch (error) {
  $('boot-status').textContent = `${text('prepareFailed')} ${error.message}`;
  acknowledge('error', { message: error.message });
}
