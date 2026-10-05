import { createMissionLibrary } from '../mission-library/library.mjs';
import { attachMissionLibraryChooser } from '../ui/mission-library-chooser.mjs';
import { createMissionLibrarySessionState } from '../mission-library/handoff.mjs';
import { overflightMissionSource, paintOverflightMission } from './mission-library.mjs';
import { createOverflightOperationCards, paintOverflightRole } from './operation-view.mjs';
import { DESTRUCTION_CUES, HUMAN_REACTION_CUES } from '../ui/destruction-audio.mjs';
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
import { attachEncounterDisplayControls } from '../ui/encounter-display-controls.mjs';
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
import { createOverflightUpgradeCard } from './upgrade-card.mjs';
import {
  pilot,
  selectCard,
  QUALIFICATION_BUILDS,
  NO_PULSE_QUALIFICATION_BUILDS,
} from './review-pilot.mjs';
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
import { createOverflightCommentator } from './commentator.mjs';
import { attachOverflightStudioLinks } from './studio-links.mjs';
import { overflightText, localizedOverflight } from './copy.mjs';
import { createOverflightController, loadOverflightControllerPreferences } from './controller.mjs';
import {
  DEFAULT_OVERFLIGHT_CHARACTER,
  normalizeOverflightCharacterId,
  overflightCharacterName,
  prepareOverflightCharacters,
  resolveOverflightCharacter,
  paintOverflightCharacterPreview,
} from './characters.mjs';

const doc = globalThis.document;
const win = globalThis.window;
const $ = (id) => doc.getElementById(id);
const params = new URL(win.location.href).searchParams;
// One native host owns both modes: lifecycle, input, rendering, settings and audio.
const mode =
  doc.documentElement.dataset.gameMode === 'overflight-hunt'
    ? (await import('./raid-mode.mjs')).OVERFLIGHT_HUNT_MODE
    : {
        id: 'overflight',
        name: { en: 'Overflight', uk: 'Проліт' },
        defaultProject: DEFAULT_OVERFLIGHT_PROJECT,
        compileProject: compileOverflightProject,
        createProject: createOverflightProject,
        createLibrary: createOverflightLibrary,
        createPackage: createOverflightPackage,
        exportPackage: exportOverflightPackage,
        text: overflightText,
        createRun: createOverflightRun,
        start: startOverflight,
        step: stepOverflight,
        pause: pauseOverflight,
        resume: resumeOverflight,
        choose: chooseOverflightUpgrade,
        reroll: rerollOverflightUpgrades,
        summary: overflightSummary,
        buildItems: overflightBuildItems,
        createCard: createOverflightUpgradeCard,
        encounterSets: ['front', 'crossing', 'mixed'],
        studioPath: '../studio/overflight.html',
        reviewBuilds: { ...QUALIFICATION_BUILDS, ...NO_PULSE_QUALIFICATION_BUILDS },
        pilot: (run) => pilot(run, 'tight'),
        selectCard,
        previewRequest: overflightPreviewRequest,
      };
const records = mode.createRecords?.();
if (['en', 'uk'].includes(params.get('lang'))) setLocale(params.get('lang'), { persist: false });
const text = (key) => mode.text(getLocale(), key);
const local = (value) => localizedOverflight(value, getLocale());
const fixture = (mode.fixtures ?? ['reference', 'stress']).includes(params.get('fixture'))
  ? params.get('fixture')
  : null;
const reviewBuild =
  !fixture && Object.hasOwn(mode.reviewBuilds, params.get('reviewBuild'))
    ? params.get('reviewBuild')
    : null;
const diagnostics =
  params.get('diagnostics') === '1' ||
  params.get('benchmark') === '1' ||
  !!fixture ||
  !!reviewBuild;
const benchmarkTrial =
  (fixture || (mode.id === 'overflight-hunt' && params.get('benchmark') === '1')) &&
  ['1', '2', '3', 'soak'].includes(params.get('trial'))
    ? params.get('trial')
    : null;
const benchmarkProtocol = benchmarkTrial
  ? {
      warmupSeconds: 30,
      measurementSeconds: benchmarkTrial === 'soak' ? 900 : 120,
      repetitions: 1,
      stopAtEnd: true,
    }
  : {};
const review = createOverflightReviewPlayback({
  build: reviewBuild,
  pilot: (run) => mode.pilot(run, reviewBuild),
  selectCard: mode.selectCard,
});
const studio = params.get('studio') === mode.id && win.parent !== win;
const OPTION_KEY = `revealline.${mode.id}.options.v1`;
let options = {
  difficulty: 'standard',
  airframes: 3,
  slowResume: true,
  characterId: DEFAULT_OVERFLIGHT_CHARACTER,
};
try {
  const saved = JSON.parse(win.localStorage.getItem(OPTION_KEY) ?? 'null');
  if (saved && [1, 3].includes(saved.airframes) && typeof saved.slowResume === 'boolean')
    options = {
      difficulty: saved.difficulty === 'veteran' ? 'veteran' : 'standard',
      airframes: saved.airframes,
      slowResume: saved.slowResume,
      characterId: normalizeOverflightCharacterId(saved.characterId),
    };
} catch {
  /* Storage is optional; local choices remain usable. */
}
const persistOptions = () => {
  options = {
    ...options,
    difficulty: $('difficulty').value,
    airframes: Number($('airframes').value),
    slowResume: $('slow-resume').checked,
  };
  try {
    win.localStorage.setItem(OPTION_KEY, JSON.stringify(options));
  } catch {
    /* Session-only preference. */
  }
};
let project = mode.createProject({ difficulty: options.difficulty });
let compiled = mode.compileProject(project);
let seed = Number(params.get('seed'));
if (!Number.isSafeInteger(seed) || seed < 1 || seed > 0xffffffff) seed = compiled.seed;
let run = null,
  renderer = null,
  shell = null,
  navigator = null,
  controller = null,
  controllerStatus = null,
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
  hudBuildKey = null,
  hudPulseCharge = null,
  library = null,
  music = null,
  studioNavigation = null,
  operationCards = null,
  missionChooser = null,
  missionRegistry = null,
  selectedInstalled = false,
  cacheHintKey = '',
  progressEpoch = 0,
  missionProgress = new Map(),
  commentator = null,
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
let completedMeasurement = null,
  resourceSamples = [],
  nextResourceSample = 0;
let characterEntries = [],
  rewardTimer = null,
  resultRun = null;
const clipRecorder = reviewBuild
  ? createOverflightReviewRecorder({ window: win, onState: updateClip })
  : null;
const rendererOwner = createOverflightRendererOwner();
const contextGuard = createOverflightContextGuard({ pause, release: releaseInput });
const cleanup = [];
const clock = createOverflightClock();
const inputGate = createOverflightInputGate();
const held = createOverflightKeyboardState();
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
  getDestruction: () => encounterDisplay.snapshot(),
  presentation: {
    async readAudio(slot, settings) {
      await artReady;
      return [
        'audio.pickup',
        'audio.confirm',
        'audio.victory',
        'audio.failure',
        ...DESTRUCTION_CUES.map((cue) => `audio.${cue}`),
        ...HUMAN_REACTION_CUES.map((cue) => `audio.${cue}`),
      ].includes(slot)
        ? artwork.readAudio(slot, settings)
        : null;
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
  controller?.clear();
  clock.reset();
  navigator?.cancelConfirm();
}
function activeModal() {
  return (
    music?.root() ??
    (missionChooser?.elements.dialog.open ? missionChooser.elements.dialog : null) ??
    ($('upgrade-dialog').open ? $('upgrade-dialog') : shell?.topDialog())
  );
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
    if (runtimeFailed) shell.elements.buttons.primary.disabled = false;
  }
}
function pause({ menu = true } = {}) {
  if (!run || retired) return;
  mode.pause(run);
  releaseInput();
  audio.flight?.(run, { active: false });
  sound.gameplayPaused = true;
  sound.pause();
  commentator?.suspend();
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
  if (run.phase === 'ready' && preparationIdentity?.characterId !== options.characterId) {
    void prepare({ launch: true }).catch(() => {});
    return;
  }
  if (run.phase === 'upgrade') return syncUpgrade();
  const freshLaunch = run.phase === 'ready';
  if (run.phase === 'ready') {
    if (run.airframes !== options.airframes || run.slowResume !== options.slowResume) {
      run = mode.createRun(compiled, { seed, ...options, fixture });
      run.appearance = preparationIdentity;
      run.review = !!reviewBuild;
    }
    mode.start(run);
  } else if (run.phase === 'paused') mode.resume(run);
  else return;
  releaseInput();
  showStatus();
  updateShell();
  if (run.phase === 'upgrade') return syncUpgrade();
  void music?.start();
  const owner = run;
  sound.gameplayPaused = false;
  commentator?.resume();
  void sound.enable().then(() => {
    if (owner !== run || run.phase !== 'playing' || retired) sound.pause();
    else {
      void audio.prepare();
      if (freshLaunch) audio.start?.(run, { bodyId: preparationIdentity?.characterId });
      commentator?.prepare();
      audio.update(run);
    }
  });
}
function formatTime(seconds) {
  const value = Math.floor(Math.max(0, seconds ?? 0));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
function moduleIcon(id) {
  const slot = `pickup.module-${mode.moduleIcons?.[id] ?? (id === 'plating' ? 'shield' : id)}`;
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
    ? mode
        .buildItems(run.build)
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
    `${text('hull')} ${Math.ceil(run.player.hull)} / ${run.player.maxHull}`;
  const health = Math.max(0, Math.min(100, (run.player.hull / run.player.maxHull) * 100));
  $('hud-health-fill').style.width = `${health}%`;
  $('hud-health').dataset.critical = String(health <= 25);
  $('hud-health').setAttribute('aria-label', text('hull'));
  $('hud-health').setAttribute('aria-valuemin', '0');
  $('hud-health').setAttribute('aria-valuemax', String(run.player.maxHull));
  $('hud-health').setAttribute('aria-valuenow', String(Math.ceil(run.player.hull)));
  $('hud-airframes').textContent =
    `${text('spareAirframes')} ${Math.max(0, run.airframesRemaining - 1)}`;
  $('hud-kills').textContent =
    `${Number(run.stats.kills).toLocaleString(getLocale())} ${text('kills')}`;
  $('hud-protection').textContent = [
    run.player.armorReduction > 0
      ? `${text('armorProtection')} −${Math.round(run.player.armorReduction * 100)}%`
      : '',
    run.player.shield > 0 ? `${text('shieldHits')} ${run.player.shield}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const openCaches = (run.caches ?? [])
    .filter((cache) => cache.state === 'open')
    .map((cache) => cache.id)
    .join('|');
  if (cacheHintKey !== openCaches) {
    cacheHintKey = openCaches;
    $('hud-cache').hidden = !openCaches;
    $('hud-cache').textContent = openCaches ? text('cacheReady') : '';
    $('hud-cache').title = text('cacheHint').replace(
      '30',
      String(compiled.combat?.supplies.repairHull ?? 30),
    );
  }
  $('hud-level').textContent = `${text('level')} ${run.progression.choices + 1}`;
  const cooldown = Math.max(0, run.player.boostCooldown ?? 0);
  $('hud-boost').textContent =
    `${text('boost')} ${cooldown > 0 ? `${cooldown.toFixed(1)}s` : text('ready')}`;
  const label = buildLabel();
  if (label !== hudBuildKey) {
    hudBuildKey = label;
    hudPulseCharge = null;
    $('hud-build').replaceChildren();
    for (const item of mode.buildItems(run.build)) {
      const badge = el('span', '', 'overflight-build-item');
      badge.append(moduleIcon(item.id), el('span', `${local(item.title)} ${item.rank}`));
      if (item.id === 'proximity-pulse') {
        hudPulseCharge = el('span', '', 'overflight-pulse-charge');
        hudPulseCharge.setAttribute('role', 'progressbar');
        hudPulseCharge.setAttribute('aria-label', text('pulseCharge'));
        hudPulseCharge.setAttribute('aria-valuemin', '0');
        hudPulseCharge.setAttribute('aria-valuemax', '100');
        hudPulseCharge.append(el('span', '', 'overflight-pulse-fill'));
        badge.append(hudPulseCharge);
      }
      $('hud-build').append(badge);
    }
  }
  if (hudPulseCharge) {
    const charge = Math.round(Math.max(0, Math.min(1, run.player.pulseCharge ?? 0)) * 100);
    hudPulseCharge.firstElementChild.style.width = `${charge}%`;
    hudPulseCharge.setAttribute('aria-valuenow', String(charge));
    hudPulseCharge.setAttribute('aria-valuetext', `${charge}% · ${text('flyToCharge')}`);
    hudPulseCharge.dataset.ready = String(charge === 100);
  }
  const index = run.progression.choices;
  if (mode.updateHUD) {
    mode.updateHUD({ run, compiled, document: doc, text, local });
    return;
  }
  const thresholds = compiled.upgrades.thresholds;
  const previous = thresholds[index - 1] ?? 0;
  const next = thresholds[index] ?? previous;
  const xp = run.progression.xp;
  const percent =
    next > previous ? Math.max(0, Math.min(1, (xp - previous) / (next - previous))) : 1;
  $('xp-fill').style.width = `${percent * 100}%`;
}
function refreshCharacters() {
  const select = $('character-select');
  select.replaceChildren();
  for (const character of characterEntries) {
    const option = el('option', overflightCharacterName(character.id));
    option.value = character.id;
    select.append(option);
  }
  const canSelect = !run || run.phase === 'ready';
  const characterId = canSelect ? options.characterId : preparationIdentity?.characterId;
  select.value = characterId ?? options.characterId;
  select.disabled = preparing || !characterEntries.length || !canSelect;
  $('character-hint').textContent = text(canSelect ? 'characterHint' : 'characterLocked');
  const character = characterEntries.find((entry) => entry.id === select.value);
  $('character-preview').replaceChildren();
  if (character) {
    const canvas = doc.createElement('canvas');
    paintOverflightCharacterPreview(canvas, character, { size: 96 });
    $('character-preview').append(canvas);
  }
}
function rewardToast(offer) {
  win.clearTimeout(rewardTimer);
  const toast = $('hud-reward');
  toast.replaceChildren(
    moduleIcon(offer.system),
    el('span', text(offer.kind === 'evolution' ? 'evolutionInstalled' : 'upgradeInstalled')),
    el('strong', local(offer.title)),
  );
  toast.dataset.evolution = String(offer.kind === 'evolution');
  toast.hidden = false;
  rewardTimer = win.setTimeout(() => {
    toast.hidden = true;
    rewardTimer = null;
  }, 2200);
}
function result() {
  if (mode.renderResults) {
    mode.renderResults({ run, document: doc, text, local, formatTime, moduleIcon, records });
    updateShell();
    shell.open('results');
    return;
  }
  const summary = mode.summary(run);
  const won = run.phase === 'won';
  $('overflight-results').dataset.outcome = won ? 'won' : 'lost';
  $('result-title').textContent = text(won ? 'won' : 'lost');
  $('result-kicker').textContent = text(won ? 'victoryKicker' : 'lossKicker');
  $('result-message').textContent = text(won ? 'victoryMessage' : 'lossMessage');
  $('result-stats').replaceChildren();
  for (const [key, value] of [
    ['kills', summary.stats.kills],
    ['elapsed', formatTime(run.time)],
    ['salvage', summary.stats.xpCollected],
    ['upgradesEarned', summary.stats.upgradesChosen],
  ]) {
    const stat = el('div', '', 'overflight-result-stat');
    stat.append(
      el('dt', text(key)),
      el('dd', typeof value === 'number' ? value.toLocaleString(getLocale()) : value),
    );
    $('result-stats').append(stat);
  }
  $('result-milestones').replaceChildren();
  for (const [achieved, label] of [
    [summary.goals.eliteDefeated, 'eliteCleared'],
    [summary.goals.finalDefeated, 'finalCleared'],
    [summary.build.primary.rank >= 4, 'evolvedBuild'],
    [won && summary.stats.airframesLost === 0, 'intactSortie'],
  ])
    if (achieved) $('result-milestones').append(el('span', `✓ ${text(label)}`));
  $('result-build').replaceChildren();
  for (const item of mode.buildItems(run.build)) {
    const badge = el('div', '', 'overflight-result-module');
    badge.append(
      moduleIcon(item.id),
      el('strong', local(item.title)),
      el('span', `${text('level')} ${item.rank}`),
    );
    $('result-build').append(badge);
  }
  // Locale changes may refresh labels; only a newly completed run earns the reveal.
  if (resultRun !== run) {
    resultRun = run;
    $('overflight-results').classList.remove('result-reveal');
    win.requestAnimationFrame(() => {
      if (!retired && resultRun === run) $('overflight-results').classList.add('result-reveal');
    });
  }
  updateShell();
  shell.open('results');
}
function choose(id) {
  if (!run || run.phase !== 'upgrade') return;
  const offer = run.offers.find((entry) => entry.id === id);
  if (mode.choose(run, id) === false) return;
  releaseInput();
  offerKey = '';
  if (run.phase === 'upgrade') return syncUpgrade();
  $('upgrade-dialog').close();
  if (run.slowResume) clock.slowResume(performance.now());
  sound.gameplayPaused = false;
  void sound.resume();
  commentator?.resume();
  audio.update(run);
  commentator?.update(run);
  if (offer) rewardToast(offer);
  $('render-host').focus({ preventScroll: true });
  updateShell();
  updateHUD();
}
function syncUpgrade(force = false) {
  if (run?.phase !== 'upgrade') return;
  const key = `${getLocale()}:${(run.offers ?? []).map((offer) => offer.id).join('|')}`;
  if (force || key !== offerKey) {
    $('upgrade-level').textContent = `${text('levelReached')} ${run.progression.choices + 2}`;
    $('upgrade-dialog').dataset.evolution = String(
      run.offers.some((offer) => offer.kind === 'evolution'),
    );
    const focusedId = doc.activeElement?.dataset?.upgradeId;
    offerKey = key;
    $('upgrade-cards').replaceChildren();
    for (const offer of run.offers ?? [])
      $('upgrade-cards').append(
        mode.createCard({
          document: doc,
          offer,
          build: run.build,
          player: run.player,
          locale: getLocale(),
          reducedEffects: display.snapshot().effectiveReducedEffects,
          disabled: !!reviewBuild,
          moduleIcon,
          paintSprite: renderer?.paintPreviewSprite,
          onChoose: choose,
        }),
      );
    if (focusedId) {
      const cards = [...$('upgrade-cards').children].filter((card) => !card.disabled);
      (cards.find((card) => card.dataset.upgradeId === focusedId) ?? cards[0])?.focus({
        preventScroll: true,
      });
    }
    $('reroll-upgrades').textContent = text('reroll');
    const remaining = run.progression.rerolls;
    $('rerolls-left').textContent = `${remaining} ${text('rerolls')}`;
    $('reroll-upgrades').disabled = !!reviewBuild || remaining <= 0;
  }
  if (!$('upgrade-dialog').open) {
    releaseInput();
    sound.pause();
    commentator?.suspend();
    updateShell();
    $('upgrade-dialog').showModal();
    $('upgrade-cards').querySelector('button')?.focus({ preventScroll: true });
  }
}
function transition() {
  if (!run || run.phase === lastPhase) return;
  lastPhase = run.phase;
  refreshCharacters();
  updateShell();
  if (run.phase === 'upgrade') syncUpgrade();
  if (['won', 'lost'].includes(run.phase)) {
    releaseInput();
    result();
  }
}
function projectForSortie() {
  if (
    selectedInstalled ||
    studio ||
    project.format.endsWith('V1') ||
    project.difficulty === options.difficulty
  )
    return project;
  const encounterSet = mode.encounterSets.find(
    (set) => mode.createProject({ encounterSet: set }).id === project.id,
  );
  return encounterSet
    ? mode.createProject({ encounterSet, difficulty: options.difficulty })
    : project;
}
async function prepare({ nextProject = projectForSortie(), nextSeed = seed, launch = false } = {}) {
  const nextCompiled = mode.compileProject(nextProject);
  if (!Number.isSafeInteger(nextSeed) || nextSeed < 1 || nextSeed > 0xffffffff)
    throw new TypeError('Invalid preview seed.');
  const ticket = ++epoch;
  mode.resetPresentation?.();
  clipRecorder?.cancel();
  if (runtimeFailed) rendererOwner.invalidate();
  preparing = true;
  $('character-select').disabled = true;
  win.clearTimeout(rewardTimer);
  $('hud-reward').hidden = true;
  if (run) mode.pause(run);
  updateRecoveryControl();
  updateShell();
  releaseInput();
  sound.pause();
  commentator?.suspend();
  if ($('upgrade-dialog').open) $('upgrade-dialog').close();
  showStatus(text('preparing'));
  try {
    await Promise.all([artReady, theme.ready]);
    if (retired || ticket !== epoch) return false;
    const base = artwork.current();
    const resolvedTheme = theme.snapshot();
    const collection = selectedArcadeCollection(theme.effectivePreferences());
    const cast = castPreferences.snapshot().cast;
    const selectedCharacter = resolveOverflightCharacter(base, options.characterId);
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
      characterId: selectedCharacter.id,
      playerSlot: selectedCharacter.playerSlot,
      cast,
    };
    const nextRenderer = await rendererOwner.acquire(JSON.stringify(frozenIdentity), async () => {
      renderer = null;
      contextGuard.restore();
      recoveryPending = false;
      recoveryUnsupported = false;
      arcade.clear();
      characterEntries = [];
      arcade.setReviewRevision(nextCompiled.resources.actorArtRevision);
      const snapshot = arcade.resolve(base, collection);
      characterEntries = prepareOverflightCharacters(snapshot);
      appearance = {
        snapshot,
        playerSlot: frozenIdentity.playerSlot,
        characterId: frozenIdentity.characterId,
        theme: resolvedTheme,
        artRevision: frozenIdentity.actorArtRevision,
        cast: frozenIdentity.cast,
        reducedEffects: display.snapshot().effectiveReducedEffects,
        destruction: encounterDisplay.snapshot(),
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
    run = mode.createRun(compiled, { seed, ...options, fixture });
    run.appearance = preparationIdentity;
    run.review = !!reviewBuild;
    review.reset();
    audio.reset();
    commentator?.reset(run);
    clock.reset();
    clock.clearMeasurements();
    renderer.resetMeasurements?.(benchmarkProtocol);
    completedMeasurement = null;
    resourceSamples = [];
    nextResourceSample = 0;
    lastPhase = null;
    offerKey = '';
    hudBuildKey = null;
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
    refreshCharacters();
    runtimeFailed = false;
    showStatus();
    updateHUD();
    updateShell();
    renderer.present(run);
    refreshOperationView();
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
    refreshCharacters();
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
  const modal = activeModal();
  const axes = controller?.sample({
    scope:
      !modal && run?.phase === 'playing' ? 'flight' : `menu:${modal?.id || run?.phase || 'start'}`,
    timeMs: win.performance.now(),
  }) ?? { x: 0, y: 0, boost: false, neutral: true };
  if (axes.status?.code !== controllerStatus) {
    controllerStatus = axes.status?.code;
    if (['unsupported', 'unavailable'].includes(controllerStatus)) showStatus(axes.status.message);
  }
  if (axes.disconnected || axes.pause) pause();
  else if (modal) navigator?.handle(axes.ui);
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
    neutral: !held.size && axes.neutral,
  });
}
function reviewIdentity() {
  return reviewBuild
    ? {
        automated: true,
        build: reviewBuild,
        route:
          mode.id === 'overflight-hunt'
            ? reviewBuild === 'objectives'
              ? 'objectives'
              : 'packs'
            : 'tight',
        inputHz: 10,
        upgradeDelayMs: 1500,
      }
    : null;
}
function sortieSummary() {
  return run
    ? { ...mode.summary(run), appearance: preparationIdentity, review: reviewIdentity() }
    : null;
}
function measurement({ raw = false } = {}) {
  const rendererStats = renderer?.stats({ raw }) ?? null;
  return {
    format:
      mode.id === 'overflight-hunt' ? 'OverflightHuntMeasurementsV1' : 'OverflightMeasurementsV1',
    capturedAt: new Date().toISOString(),
    fixture,
    benchmarkTrial,
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
    feedback: {
      audioEnabled: sound.enabled,
      contextState: sound.context?.state ?? 'unprepared',
      masterMuted: audioMaster.snapshot().muted,
      commentator: commentator?.diagnostics(),
    },
    renderer: rendererStats,
    resourceSamples,
    trialValid:
      !clipCaptureUsed &&
      !runtimeFailed &&
      clock.stats().droppedSeconds === 0 &&
      rawOverflow === 0 &&
      rendererStats?.valid !== false,
    rawOverflow,
    invalidReasons: [
      ...(clipCaptureUsed ? ['review-clip-recording-overhead'] : []),
      ...(runtimeFailed ? ['runtime-failure'] : []),
      ...(clock.stats().droppedSeconds > 0 ? ['dropped-catch-up-time'] : []),
      ...(rawOverflow > 0 ? ['raw-sample-capacity-exceeded'] : []),
      ...(rendererStats?.invalidReasons ?? []),
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
    if (benchmarkTrial && !completedMeasurement && renderer.measurementComplete()) {
      completedMeasurement = measurement({ raw: true });
      pause({ menu: false });
      $('overflight-diagnostics').open = true;
      showStatus(text('trialComplete'));
      exposeMeasurements(completedMeasurement);
    }
    input = readInput();
    const active =
      run.phase === 'playing' && !activeModal() && !contextGuard.blocked() && !doc.hidden;
    let stepCPU = 0,
      steps = 0;
    clock.advance(now, active, (dt) => {
      const started = performance.now();
      mode.step(
        run,
        fixture && mode.fixtureInput ? mode.fixtureInput(run) : review.input(run, input),
        dt,
      );
      stepCPU += performance.now() - started;
      steps++;
      // Accept the final strike before pausing. Only its bounded destruction
      // tail survives the result transition; retry and explicit pause still stop it.
      audio.update(run);
      if (run.phase === 'won' || run.phase === 'lost') sound.pause({ preserveDestruction: true });
      commentator?.update(run);
      transition();
      return run.phase === 'playing';
    });
    if (appearance) appearance.destruction = encounterDisplay.snapshot();
    renderer.present(run);
    audio.flight?.(run, {
      active: active && run.phase === 'playing',
      bodyId: preparationIdentity?.characterId,
    });
    if ($('upgrade-dialog').open)
      for (const card of $('upgrade-cards').children) card.paintPreview?.(now / 1000);
    if (benchmarkTrial && active && run.time >= nextResourceSample && !completedMeasurement) {
      resourceSamples.push({
        time: run.time,
        ...renderer.resourceStats(),
        heapUsedBytes: performance.memory?.usedJSHeapSize ?? null,
        heapTotalBytes: performance.memory?.totalJSHeapSize ?? null,
        canvasCount: $('render-host').querySelectorAll('canvas').length,
        pools: {
          enemies: run.enemies.length,
          pickups: run.pickups.length,
          effects: run.effects.length,
        },
      });
      nextResourceSample = run.time + 15;
    }
    transition();
    const reviewChoice = review.upgrade(
      run,
      now,
      !doc.hidden && !contextGuard.blocked() && activeModal() === $('upgrade-dialog'),
    );
    if (reviewChoice) {
      syncUpgrade();
      if (reviewChoice.blocked) {
        $('upgrade-dialog').querySelector('[data-copy="upgradeHint"]').textContent =
          text('reviewDraftBlocked');
      }
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
  $('studio-link').href = destination(mode.studioPath);
  studioNavigation?.refresh();
  $('raw-metrics').setAttribute('aria-label', text('rawMeasurements'));
  shell?.setLocale(getLocale());
  $('fixture-description').textContent = fixture
    ? `${text('fixture')}: ${fixture}. ${text('fixtureHelp')}${benchmarkTrial ? ` ${text('trialHelp')} (${benchmarkTrial})` : ''}`
    : '';
  $('fixture-description').hidden = !fixture;
  for (const id of ['review-description', 'hud-review', 'result-review']) {
    const fixtureLabel = id === 'hud-review' && fixture ? `${text('fixture')}: ${fixture}` : '';
    $(id).textContent = fixtureLabel || reviewLabel();
    $(id).hidden = !reviewBuild && !fixtureLabel;
  }
  $('review-help').hidden = !reviewBuild;
  updateClip();
  updateShell();
  updateHUD();
  refreshCharacters();
  renderMissions();
  refreshOperationView();
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
  modeName: mode.name,
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
    open: (surface) => {
      if (surface === 'missions') {
        void openMissionLibrary();
        return false;
      }
    },
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
// Overflight exposes its operation settings directly; it has no separate expert screen.
shell.elements.buttons.expert.hidden = true;
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
studioNavigation = attachOverflightStudioLinks({
  document: doc,
  root: $('overflight-studios'),
  getLocale,
  getCreator: () => ({
    path: mode.studioPath,
    title: text('workshop'),
    description: text('workshopHelp'),
  }),
  destination,
  onOpen: () => pause({ menu: false }),
  onMusic: () => music.open(),
});
cleanup.push(() => studioNavigation.dispose());
commentator = createOverflightCommentator({
  sound,
  container: $('overflight-commentator'),
  resultContainer: $('overflight-result-commentator'),
  settingsContainer: $('overflight-commentator-settings'),
  document: doc,
  window: win,
  getReduced: () => display.snapshot().effectiveReducedEffects,
  acquireGain: (settings) => music?.player.acquireGain(settings),
});
if (mode.installActions) mode.installActions({ document: doc, prepare, getSeed: () => seed });
if ($('survivor-same-seed')) {
  listen($('survivor-same-seed'), 'click', () => {
    void prepare({ launch: true }).catch(() => {});
  });
  listen($('survivor-new-sortie'), 'click', () => {
    const bytes = new Uint32Array(1);
    win.crypto.getRandomValues(bytes);
    void prepare({ nextSeed: bytes[0] || 1, launch: true }).catch(() => {});
  });
}
operationCards = createOverflightOperationCards({
  document: doc,
  current: mode.id,
  text,
  destination,
  onSelect: () => {
    void openMissionLibrary();
  },
  onLeave: () => pause({ menu: false }),
});
shell.elements.dialogs.home.querySelector('.mode-play-main-menu').before(operationCards.root);
function refreshOperationView() {
  const paint = renderer?.paintPreviewSprite;
  operationCards?.refresh(paint);
  for (const previews of doc.querySelectorAll('[data-role-previews]')) {
    previews.replaceChildren();
    for (const [role, key] of [
      ['exposed', 'Exposed'],
      ['shield', 'Shield'],
      ['armor', 'Armor'],
    ]) {
      const card = el('div', '', 'overflight-role-card');
      const canvas = doc.createElement('canvas');
      canvas.width = 240;
      canvas.height = 100;
      canvas.setAttribute('aria-hidden', 'true');
      const context = canvas.getContext('2d');
      if (context) paintOverflightRole(context, role, paint);
      card.append(canvas, el('strong', text(`role${key}`)), el('p', text(`role${key}Help`)));
      previews.append(card);
    }
  }
  for (const hint of doc.querySelectorAll('[data-copy="cacheHint"]')) {
    hint.hidden = compiled.rulesVersion !== 2 || !compiled.combat?.supplies.enabled;
    hint.textContent = text('cacheHint').replace(
      '30',
      String(compiled.combat?.supplies.repairHull ?? 30),
    );
  }
  $('difficulty').disabled = selectedInstalled || studio || preparing;
  $('difficulty-help').textContent = text(
    selectedInstalled || studio ? 'authoredDifficulty' : 'difficultyHelp',
  );
}
function refreshMissionSources() {
  if (!missionRegistry) return;
  for (const [id, entries, custom] of [
    [
      'official',
      mode.encounterSets.map((encounterSet) => ({
        project: mode.createProject({ encounterSet, difficulty: options.difficulty }),
      })),
      false,
    ],
    ['installed', installed, true],
  ])
    missionRegistry.register(
      overflightMissionSource({
        id: `${mode.id}:${id}`,
        entries,
        mode,
        locale: getLocale,
        installed: custom,
        progress: (entry) =>
          missionProgress.get(mode.compileProject(entry.project).projectIdentity),
        launch: async (entry, context) => {
          if (retired || context.isCurrent?.() === false) return false;
          const accepted = await prepare({
            nextProject: entry.project,
            nextSeed: entry.project.seed,
            launch: true,
          });
          if (accepted) {
            selectedInstalled = custom;
            refreshOperationView();
          }
          return accepted;
        },
      }),
    );
}
async function openMissionLibrary() {
  pause({ menu: false });
  if (!missionRegistry) {
    missionRegistry = createMissionLibrary();
    refreshMissionSources();
    const session = createMissionLibrarySessionState({
      mode: 'solo',
      storage: {
        getItem: (key) => win.sessionStorage?.getItem(`${mode.id}:${key}`),
        setItem: (key, value) => win.sessionStorage?.setItem(`${mode.id}:${key}`, value),
      },
    });
    missionChooser = attachMissionLibraryChooser({
      document: doc,
      library: missionRegistry,
      mode: 'solo',
      supportedModes: ['solo'],
      availableCollectionsOnly: true,
      description: () => text('encounterBrowserHelp'),
      readState: session.read,
      writeState: session.write,
      getCurrentId: () => missionRegistry.missions.find((row) => row.runtimeId === project.id)?.id,
      onPause: () => pause({ menu: false }),
      onReturn: (opener) => {
        if (opener?.isConnected) opener.focus();
      },
      launchContext: () => {
        const owner = run;
        return { isCurrent: () => !retired && run === owner };
      },
      goalPreferenceOptions: { editionId: mode.id, getStorage: () => win.localStorage },
      renderPreview: ({ container, diagram, document }) => {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 132;
        canvas.className = 'journey-card-map';
        canvas.setAttribute('aria-hidden', 'true');
        container.append(canvas);
        const context = canvas.getContext('2d');
        if (context) paintOverflightMission(context, diagram, renderer?.paintPreviewSprite);
      },
    });
    const tools = el('details', '', 'overflight-installed-tools');
    const summary = el('summary', text('manageInstalled'));
    summary.dataset.copy = 'manageInstalled';
    tools.append(summary, $('overflight-installed-list'), $('installed-status'));
    missionChooser.elements.footer.append(tools);
  }
  missionChooser.open(doc.activeElement);
  await refreshMissions();
  if (records) {
    const ticket = ++progressEpoch;
    const candidates = [
      ...mode.encounterSets.map((encounterSet) =>
        mode.createProject({ encounterSet, difficulty: options.difficulty }),
      ),
      ...installed.map((entry) => entry.project),
    ];
    const results = await Promise.all(
      candidates.map(async (candidate) => {
        const definition = mode.compileProject(candidate);
        const saved = await records.read({
          compiled: definition,
          seed: definition.seed,
          ...options,
          difficulty: candidate.difficulty ?? 'standard',
        });
        return [
          definition.projectIdentity,
          saved.fastestClear
            ? { state: 'completed', bestStars: null }
            : { state: 'new', bestStars: null },
        ];
      }),
    );
    if (!retired && ticket === progressEpoch) {
      missionProgress = new Map(results);
      missionChooser.refresh();
    }
  }
}

function renderMissions() {
  const root = $('overflight-mission-list');
  if (!root) return;
  root.replaceChildren();
  refreshMissionSources();
  const community = $('overflight-installed-list');
  community.replaceChildren();
  if (!installed.length) community.append(el('p', text('noInstalled')));
  for (const entry of installed) {
    const button = el('button', local(entry.title));
    button.type = 'button';
    button.addEventListener('click', () => {
      void prepare({ nextProject: entry.project, nextSeed: entry.project.seed })
        .then((accepted) => {
          if (accepted) {
            selectedInstalled = true;
            refreshOperationView();
            missionChooser?.close();
            shell.open('briefing');
          }
        })
        .catch(() => {});
    });
    const row = el('div', '', 'overflight-installed-entry');
    const exportButton = el('button', text('exportEncounter'));
    exportButton.type = 'button';
    exportButton.setAttribute('aria-label', `${text('exportEncounter')} · ${local(entry.title)}`);
    exportButton.addEventListener('click', () => {
      downloadBlob(
        mode.exportPackage(mode.createPackage(entry.project)),
        `${entry.project.id}.${mode.id}.json`,
      );
    });
    const removeButton = el('button', text('removeLocalEncounter'));
    removeButton.hidden = !entry.localOwned;
    removeButton.type = 'button';
    removeButton.setAttribute(
      'aria-label',
      `${text('removeLocalEncounter')} · ${local(entry.title)}`,
    );
    removeButton.addEventListener('click', async () => {
      removeButton.disabled = true;
      try {
        await library.remove(entry.identity);
        await refreshMissions();
        $('installed-status').textContent =
          `${local(entry.title)} · ${text(entry.communityOwned ? 'localEncounterRemoved' : 'encounterRemoved')}`;
      } catch (error) {
        $('installed-status').textContent = `${text('libraryFailed')} ${error.message}`;
        removeButton.disabled = false;
      }
    });
    row.append(button, exportButton, removeButton);
    if (entry.communityOwned) {
      const owner = el('a', text('communityEncounterOwner'));
      owner.href = `../community/store.html?lang=${getLocale()}`;
      owner.title = text('communityEncounterRecovery');
      row.append(owner);
    }
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
  getControlLabels: () => controller?.labels() ?? { confirm: '', back: '', directions: '' },
  onBack: () => {
    if (music?.root()) music.back();
    else if (missionChooser?.elements.dialog.open) missionChooser.close();
    else if (!$('upgrade-dialog').open) shell.back();
  },
  onMenu: () => {
    if (music?.root()) music.back();
    else if (missionChooser?.elements.dialog.open) missionChooser.close();
    else if (!$('upgrade-dialog').open) shell.back();
  },
});
const themeControls = attachThemeFamilyControls({
  document: doc,
  root: $('overflight-appearance'),
  host: theme,
  prefix: 'overflight-',
});
const encounterDisplay = attachEncounterDisplayControls({
  document: doc,
  window: win,
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
    doc.body.dataset.effects = value.effectiveReducedEffects ? 'reduced' : 'full';
    if (appearance) appearance.reducedEffects = value.effectiveReducedEffects;
    if (run?.phase === 'upgrade') syncUpgrade(true);
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
  ['open-flight-deck', 'click', () => shell.open('briefing')],
  ['language', 'change', () => setLocale($('language').value)],
  ['airframes', 'change', persistOptions],
  [
    'difficulty',
    'change',
    () => {
      persistOptions();
      renderMissions();
      if (run?.phase === 'ready' && !selectedInstalled && !studio) {
        const encounterSet =
          mode.encounterSets.find(
            (set) => mode.createProject({ encounterSet: set }).id === project.id,
          ) ?? mode.encounterSets[0];
        void prepare({
          nextProject: mode.createProject({ encounterSet, difficulty: options.difficulty }),
        }).catch(() => {});
      }
    },
  ],
  ['slow-resume', 'change', persistOptions],
  [
    'character-select',
    'change',
    () => {
      if (preparing || (run && run.phase !== 'ready')) return;
      options.characterId = normalizeOverflightCharacterId($('character-select').value);
      persistOptions();
      refreshCharacters();
      if (run?.phase === 'ready') void prepare().catch(() => {});
    },
  ],
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
      if (run?.phase === 'upgrade' && mode.reroll(run)) {
        audio.update(run);
        offerKey = '';
        syncUpgrade();
        $('upgrade-cards').querySelector('button')?.focus();
      }
    },
  ],
])
  listen($(id), event, fn);
$('difficulty').value = options.difficulty;
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
  $('studio-link').href = destination(mode.studioPath);
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
function exposeMeasurements(snapshot) {
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
}
listen($('inspect-raw-metrics'), 'click', () => {
  if (!diagnostics) return;
  const snapshot = completedMeasurement ?? measurement({ raw: true });
  pause({ menu: false });
  exposeMeasurements(snapshot);
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
    new Blob(
      [rawPages?.json ?? JSON.stringify(completedMeasurement ?? measurement({ raw: true }))],
      {
        type: 'application/json',
      },
    ),
    `overflight-${fixture ?? 'sortie'}-${seed}.json`,
  );
});
function acknowledge(type, values = {}) {
  if (studio)
    win.parent.postMessage(
      { type: `${mode.id}:${type}`, version: 1, ...values },
      win.location.origin,
    );
}
listen(win, 'message', async (event) => {
  const request =
    studio &&
    mode.previewRequest(event, {
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
  mode.resetPresentation?.();
  epoch++;
  clipRecorder?.dispose();
  win.clearTimeout(rewardTimer);
  releaseInput();
  renderer = null;
  if ($('upgrade-dialog').open) $('upgrade-dialog').close();
  navigator.destroy();
  controller?.destroy();
  missionChooser?.destroy();
  missionRegistry?.dispose();
  shell.dispose();
  themeControls.dispose();
  encounterDisplay.dispose();
  cleanup
    .splice(0)
    .reverse()
    .forEach((fn) => fn());
  music?.dispose();
  commentator?.dispose();
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
  records?.dispose?.();
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
  const controllerPreferences = await loadOverflightControllerPreferences({ window: win });
  controller = createOverflightController({ window: win, ...controllerPreferences });
  if (controllerPreferences.warning) showStatus(controllerPreferences.warning);
  listen(win, 'storage', async (event) => {
    if (event.key !== null && event.key !== controllerPreferences.profileKey) return;
    const next = await loadOverflightControllerPreferences({
      window: win,
      version: controllerPreferences.version,
    });
    if (retired) return;
    controller.setPreferences(next);
    releaseInput();
    if (next.warning) showStatus(next.warning);
  });
  library = mode.createLibrary();
  await refreshMissions();
  if (params.has('community')) {
    const loaded = await library.load(params.get('community'));
    project = loaded.project ?? loaded;
    selectedInstalled = true;
    compiled = mode.compileProject(project);
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
