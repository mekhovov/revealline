import { claimProfileWriter } from '../profile-writer.mjs';
import {
  createEnemyStats,
  validateEnemyStatsSession,
  forkEnemyStatsSession,
} from '../enemy-stats.mjs';
import { mountEnemyStats } from '../ui/enemy-stats.mjs';
import { createClassicRecentReplay } from './classic-recent-replay.mjs';
import {
  createContinuousPlayController,
  continuousPlayPreferences,
  continuousPlayBindings,
  mountContinuousPlayControls,
} from '../ui/continuous-play.mjs';
import {
  createCelebration,
  advanceCelebration,
  celebrationFrame,
  drawCelebration,
} from '../ui/celebration.mjs';
import { createSignalReception } from '../ui/signal-reception.mjs';
import { mountGlobalSettingsTools } from '../ui/global-settings-tools.mjs';
import { attachMenuAudioSettings } from '../ui/menu-audio.mjs';
import { mountGlobalSettings } from '../ui/global-settings-view.mjs';
import { attachThemeFamilyControls } from '../ui/theme-family-controls.mjs';
import {
  getMenuAnimation,
  setMenuAnimation,
  subscribeMenuAnimation,
} from '../ui/menu-animation-preferences.mjs';
import { mountModeSettings } from '../ui/mode-settings-view.mjs';
import {
  attachSettingsPanels,
  settingsPanelBack,
  settingsTabOwnsKey,
} from '../ui/settings-panels.mjs';
import { mountModePlayShell } from '../ui/mode-play-shell.mjs';
import { attachModalNavigation } from '../ui/modal-navigation.mjs';
import { attachFullscreen } from '../ui/fullscreen.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { attachMenuScene } from '../ui/menu-scenes.mjs';
import { setMenuIcon } from '../ui/native-menu-icons.mjs';
import { snakeStudioReturnHref } from '../ui/content-studio-navigation.mjs';
import { contextualAppearance, mountModeChoices } from '../ui/mode-choice.mjs';
import { appearanceLaunchURL } from '../fpv-entry.mjs';
import { boardPlacement } from '../ui/feedback-cues.mjs';
import { createClassicAudio } from './classic-audio.mjs';
import { getLocale, setLocale, onLocaleChange } from '../i18n/index.mjs';
import { boundedJSON, exactKeys, required } from '../data-json.mjs';
import { createDestructionPreferences, sharedActorAppearance } from '../hunt/preferences.mjs';
import { ACTOR_CASTS } from '../hunt/actor-catalog.mjs';
import {
  classicMechanicGuide as actorFieldGuide,
  renderClassicEnemyFieldGuide as renderEnemyFieldGuide,
} from './classic-mechanic-guide.mjs';
import { attachContextualReactions } from '../ui/contextual-reactions.mjs';
import { createEncounterDisplayPreferences } from '../encounter-display-preferences.mjs';
import { createDisplayPreferences } from '../display-preferences.mjs';
import { createTouchPreferences } from '../touch-preferences.mjs';
import { createHuntDestruction } from '../hunt/destruction.mjs';
import { createBoardFootprints } from '../couch/board-footprint.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { createAudioPreferences } from '../audio-preferences.mjs';
import { Soundscape } from '../ui/audio.mjs';
import {
  CLASSIC_SNAKE_CHAPTERS as OFFICIAL_CHAPTERS,
  CLASSIC_SNAKE_LEVELS as OFFICIAL_LEVELS,
  CLASSIC_SNAKE_FEATURED as OFFICIAL_FEATURED,
  CLASSIC_SNAKE_CAMPAIGNS as OFFICIAL_CAMPAIGNS,
} from './classic-catalogue.mjs';
import { createClassicSnakeCommunityLibrary } from './classic-community.mjs';
import { CLASSIC_COPY } from './classic-copy.mjs';
import { classicSnakeSummary } from './classic-core.mjs';
import {
  createClassicSnakeMatch,
  queueClassicSnakeMatchTurn,
  advanceClassicSnakeMatchTo,
  exportClassicSnakeMatch,
  restoreClassicSnakeMatch,
  restoreClassicSnakeLegacyMatch,
} from './classic-match.mjs';
import {
  prepareClassicSnakeLevel,
  CLASSIC_PACES,
  classicSnakeSurvivalEntry,
} from './classic-setup.mjs';
import { createClassicSnakeRatings, classicSnakeRatingForRecord } from './classic-ratings.mjs';
import { createClassicSnakeRecords } from './classic-records.mjs';
import { createClassicPresentation } from './classic-presentation.mjs';
import { classicCatchMarks, drawClassicBoard, drawClassicTarget } from './classic-view.mjs';
import { advanceClassicFlight } from './classic-flight-art.mjs';

const doc = globalThis.document,
  $ = (id) => doc.getElementById(id);
const params = new URL(globalThis.location.href).searchParams;
if (['en', 'uk'].includes(params.get('lang'))) setLocale(params.get('lang'), { persist: false });
const communityIdentity = params.get('community');
const contentLibrary = communityIdentity ? createClassicSnakeCommunityLibrary() : null;
let installedContent = null;
if (contentLibrary) {
  try {
    installedContent = await contentLibrary.load(communityIdentity);
  } catch (error) {
    $('boot-status').textContent =
      `${getLocale() === 'uk' ? 'Не вдалося відкрити пакет Snake.' : 'This Snake package could not be opened.'} ${error.message}`;
    const link = doc.createElement('a');
    link.href = '../studio/snake.html';
    link.textContent = getLocale() === 'uk' ? ' Відкрити Snake Studio' : ' Open Snake Studio';
    $('boot-status').append(link);
    throw error;
  }
}
const CLASSIC_SNAKE_LEVELS = installedContent?.entries ?? OFFICIAL_LEVELS;
const CLASSIC_SNAKE_CHAPTERS = installedContent
  ? [{ id: installedContent.entries[0].chapterId, title: installedContent.pack.title }]
  : OFFICIAL_CHAPTERS;
const CLASSIC_SNAKE_CAMPAIGNS = installedContent
  ? [
      {
        id: `community-${communityIdentity}`,
        title: installedContent.pack.title,
        chapterIds: [CLASSIC_SNAKE_CHAPTERS[0].id],
      },
    ]
  : OFFICIAL_CAMPAIGNS;
const CLASSIC_SNAKE_FEATURED = installedContent ? [] : OFFICIAL_FEATURED;
const survivalEntry = classicSnakeSurvivalEntry(CLASSIC_SNAKE_LEVELS);
const MODES = ['solo', 'versus', 'team'],
  PRESETS = ['classic', 'pursuit', 'tactical', 'arcade'];
const SAVE_KEY = `revealline.classic-snake.round.v2${communityIdentity ? `.${communityIdentity}` : ''}`,
  OLD_SAVE_KEY = communityIdentity ? SAVE_KEY : 'revealline.classic-snake.round.v1';
const PREF_KEY = 'revealline.classic-snake.presentation.v1',
  SETUP_KEY = 'revealline.classic-snake.setup.v2';
const SESSION_FORMAT = 'revealline-classic-snake-session.v3';
let sessionWriter = await claimProfileWriter(globalThis.navigator.locks, `${SAVE_KEY}:writer`);
let writerRelease = Promise.resolve(),
  writerEpoch = 0;
const pageActive = () => !doc.hidden && (typeof doc.hasFocus !== 'function' || doc.hasFocus());
const enemyStats = createEnemyStats({ canWrite: () => sessionWriter.writable });
let statsAttempt = null,
  liveProvenance = 'live';
const statsViews = [];
void enemyStats.read();
const readLocal = (key) => {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const readObject = (key) => {
  try {
    return boundedJSON(readLocal(key) ?? '{}', { maxBytes: 2048, maxNodes: 40, maxDepth: 3 });
  } catch {
    return {};
  }
};
const selected = readObject(SETUP_KEY),
  cosmetic = readObject(PREF_KEY);
const choice = (values, value, fallback) => (values.includes(value) ? value : fallback);
let locale = getLocale() === 'uk' ? 'uk' : 'en';
let mode = choice(MODES, params.get('mode') ?? selected.mode, 'solo');
let pace = choice(Object.keys(CLASSIC_PACES), params.get('pace') ?? selected.pace, 'normal');
let format = choice(['campaign', 'endless'], params.get('activity') ?? selected.format, 'campaign');
let targetRules = choice(
  ['authored', 'moving', 'varied'],
  params.get('targets') ?? selected.targetRules,
  'authored',
);
let preset = choice(PRESETS, params.get('preset') ?? selected.preset, 'classic');
let duel = choice(['score', 'survival'], params.get('duel') ?? selected.duel, 'score');
let style = choice(['cable', 'signal'], cosmetic.style, 'cable');
let boardStyle = choice(['theme', 'retro'], params.get('board') ?? cosmetic.boardStyle, 'theme');
const actorAppearance = sharedActorAppearance();
const currentCast = () => {
  const value = actorAppearance.snapshot().cast;
  return value === 'authored' ? (entry.cast ?? 'rivals') : value;
};
let steering = choice(['turns', 'dpad'], cosmetic.steering, 'dpad');
let accent = typeof cosmetic.accent === 'string' ? cosmetic.accent : 'default';
let seed = Number(params.get('seed') ?? selected.seed ?? 17);
if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) seed = 17;
const requested = params.get('level') ?? selected.levelId;
let entry =
  CLASSIC_SNAKE_LEVELS.find(
    (item) => item.id === requested || item.id === `classic-${requested}`,
  ) ??
  CLASSIC_SNAKE_LEVELS.find((item) => item.id === 'classic-snake-open-loop') ??
  CLASSIC_SNAKE_LEVELS[0];
let playShell = null,
  snakeSettingsView = null,
  snakeGlobalSettings = null,
  touchPresentationControls = null,
  menuController = null,
  boardLayoutObserver = null;
let match,
  runs = [],
  boards = [],
  footprint,
  ready = true,
  paused = true,
  previousFrame = null,
  importEpoch = 0;
let offerSavedContinue = !params.has('level');
let savedRound = readLocal(SAVE_KEY) ?? readLocal(OLD_SAVE_KEY),
  saveNotice = '',
  earlyFailures = 0;
let recordedMatch = null,
  verifiedOutcome = null,
  flightFrames = [];
let celebration = null,
  transitionControls = null,
  resultPreview = null,
  resultPlayback = null,
  transitionJustStarted = false;
const recentReplay = createClassicRecentReplay();
const continuousPreferences = continuousPlayPreferences();
const signalReception = [createSignalReception(), createSignalReception()];
const transition = createContinuousPlayController({
  preferences: continuousPreferences,
  isCurrent: (identity) => identity === match,
  isActive: pageActive,
  onNext: () => launchNext(),
  onRetry: () => prepare({ launch: true }),
});
const gamepadState = new Map(),
  gamepadSeats = new Map();
const effects = [createHuntDestruction(), createHuntDestruction()];
const destruction = createDestructionPreferences(),
  remains = createEncounterDisplayPreferences();
const display = createDisplayPreferences();
const presentation = createClassicPresentation({ displayPreferences: display });
const audioMaster = createAudioMaster(),
  audioPreferences = createAudioPreferences({ audioMaster });
const sound = new Soundscape({ audioMaster });
const classicAudio = createClassicAudio(sound, { getDestruction: () => destruction.snapshot() });
sound.configure({
  master: 1,
  music: 0,
  sfx: Number.isFinite(cosmetic.sfx) ? Math.max(0, Math.min(1, cosmetic.sfx)) : 0.7,
});
const isReduced = () => display.snapshot().effectiveReducedEffects;
const reactions = attachContextualReactions({
  sound,
  container: $('snake-reaction-caption'),
  settingsContainer: $('snake-reaction-settings'),
  getReduced: isReduced,
});
let reactionAttempt = 0;
const text = (key, values = {}) =>
  Object.entries(values).reduce(
    (value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)),
    CLASSIC_COPY[locale][key] ?? key,
  );
const el = (tag, value, className) => {
  const item = doc.createElement(tag);
  if (value) item.textContent = value;
  if (className) item.className = className;
  return item;
};
const options = (select, rows, value) => {
  select.replaceChildren(
    ...rows.map(([id, title]) => {
      const option = el('option', title);
      option.value = id;
      return option;
    }),
  );
  select.value = value;
};
const settings = () => ({ pace, format, targetRules, preset });
const acceptedLevel = () => prepareClassicSnakeLevel(entry, settings());
const result = () => match?.result ?? null;
let ratings = null;
const records = createClassicSnakeRecords({
  ...(installedContent ? { contentPack: installedContent.pack } : {}),
  onChange: () => {
    if (match) {
      renderProgress();
      refresh();
      void ratings?.refresh();
    }
  },
  onWarning: (error) => {
    globalThis.console?.warn('Snake record storage:', error?.message ?? 'Unavailable');
    saveNotice = 'storage';
    $('save-status').textContent = text('storage');
  },
});
ratings = createClassicSnakeRatings({
  records,
  canWrite: () => sessionWriter.writable,
  onWarning: () => {},
});
const touch = createTouchPreferences({ onChange: () => applyTouch() });
function applyTouch() {
  const prefs = touch.snapshot();
  $('pads').style.setProperty('--snake-pad-size', prefs.size === 'large' ? '64px' : '56px');
  $('pads').style.setProperty('--snake-pad-opacity', String(Math.max(0.75, prefs.opacity)));
  $('pads').dataset.side = prefs.side;
  touchPresentationControls?.refresh();
}
const campaignFor = (item) =>
  CLASSIC_SNAKE_CAMPAIGNS.find((campaign) =>
    (campaign.chapterIds ?? campaign.chapters ?? []).includes(item.chapterId),
  ) ?? CLASSIC_SNAKE_CAMPAIGNS[0];
const campaignChapters = (campaign) =>
  CLASSIC_SNAKE_CHAPTERS.filter((chapter) =>
    (campaign.chapterIds ?? campaign.chapters ?? []).includes(chapter.id),
  );
function storePresentation() {
  try {
    globalThis.localStorage.setItem(
      PREF_KEY,
      JSON.stringify({ style, boardStyle, steering, accent, sfx: sound.settings.sfx }),
    );
  } catch {
    saveNotice = 'storage';
  }
}
function updateURL() {
  const url = new URL(globalThis.location.href);
  for (const [key, value] of Object.entries({
    mode,
    level: entry.id,
    lang: locale,
    pace,
    activity: format,
    targets: targetRules,
    preset,
    duel,
    seed,
    board: boardStyle,
  }))
    url.searchParams.set(key, value);
  globalThis.history.replaceState(null, '', url);
  try {
    globalThis.localStorage.setItem(
      SETUP_KEY,
      JSON.stringify({ mode, levelId: entry.id, pace, format, targetRules, preset, duel, seed }),
    );
  } catch {
    /* Choices remain available through the link. */
  }
}
function session() {
  return {
    format: SESSION_FORMAT,
    activity: format,
    levelId: entry.id,
    mode,
    pace,
    targetRules,
    preset,
    duel,
    seed,
    style,
    match: exportClassicSnakeMatch(match),
    statistics: enemyStats.session(statsAttempt),
    provenance: liveProvenance,
  };
}
function save() {
  if (ready) return;
  try {
    const raw = JSON.stringify(session());
    if (sessionWriter.writable) globalThis.localStorage.setItem(SAVE_KEY, raw);
    else saveNotice = 'storage';
    savedRound = raw;
    offerSavedContinue = true;
    saveNotice = sessionWriter.writable ? 'saved' : 'storage';
  } catch {
    saveNotice = 'storage';
  }
  $('save-status').textContent = text(saveNotice);
  $('continue').hidden = !savedRound;
}
function remember() {
  if (!match || recordedMatch === match || liveProvenance === 'import') return;
  if (result()) recordedMatch = match;
  try {
    const owner = match,
      accepted = exportClassicSnakeMatch(match);
    for (const run of match.runs)
      void records
        .remember(run, {
          mode,
          chapterId: entry.chapterId,
          level: acceptedLevel(),
          allowClear: format === 'campaign',
          policy: accepted.options.policy,
          match: accepted,
        })
        .then(() => {
          if (match === owner && result() === 'won') {
            verifiedOutcome = owner;
            refresh();
          }
        })
        .catch(() => {
          saveNotice = 'storage';
        });
  } catch {
    saveNotice = 'invalid';
  }
}
function pause({ showMenu = true } = {}) {
  transition.cancel('pause');
  if (result()) {
    if (showMenu && !playShell?.topDialog()) showResults();
    refreshReplayControl();
    return;
  }
  if (ready || paused) return;
  paused = true;
  sound.gameplayPaused = true;
  sound.pause();
  classicAudio.reset();
  reactions.suspend();
  save();
  remember();
  refresh();
  if (showMenu && !playShell?.topDialog()) playShell?.open('pause');
}
function start() {
  if (result() || !pageActive()) return;
  $('game').querySelector('.arena').append($('snake-reaction-caption'));
  playShell?.enterPlay();
  if (ready) void records.visit(entry.id);
  importEpoch++;
  ready = false;
  paused = false;
  previousFrame = null;
  sound.gameplayPaused = false;
  reactions.resume();
  void sound
    .enable()
    .then(() =>
      reactions.prepare(
        runs.flatMap(
          (run) =>
            run.level.targets?.required?.map((target) => target.kind) ?? [
              run.level.targetMovement === 'flee' ? 'runner' : 'lookout',
            ],
        ),
      ),
    );
  refresh();
  boards[0]?.canvas.focus({ preventScroll: true });
}
function finish() {
  sound.event?.({
    type: 'run.completed',
    levelId: entry.id,
    tick: Math.max(...runs.map((run) => run.tick)),
    won: result() !== 'lost',
    status: result() === 'lost' ? 'lost' : 'won',
  });
  paused = true;
  sound.gameplayPaused = true;
  for (const voice of [...sound.voices]) if (voice.feedback && voice.source.loop) voice.stop();
  earlyFailures = runs.every((run) => run.catches < 3) ? earlyFailures + 1 : 0;
  remember();
  save();
  refresh();
  runs.forEach((run, board) => recentReplay.capture(run, board));
  const competitive = mode === 'versus';
  const won = competitive || result() === 'won';
  celebration = won
    ? createCelebration({ levelId: entry.id, seed, theme: { family: 'fpv' }, reduced: isReduced() })
    : null;
  transitionJustStarted = true;
  transition.begin({
    identity: match,
    outcome: won ? 'won' : 'lost',
    canAdvance: !competitive && result() === 'won' && !!nextMission(),
    canRetry: !competitive,
    replayMs: recentReplay.durationMs(),
    readyMs: 400,
  });
  reactions.result({
    owned: true,
    mode,
    outcome: competitive
      ? result() === 'draw'
        ? 'draw'
        : 'won'
      : result() === 'won'
        ? 'won'
        : 'lost',
    missionId: entry.id,
    stars: 1,
  });
  refresh();
}
function nextMission() {
  if (format !== 'campaign' || mode === 'versus') return null;
  const chapters = campaignFor(entry)?.chapterIds ?? campaignFor(entry)?.chapters ?? [];
  const ordered = chapters.flatMap((id) =>
    CLASSIC_SNAKE_LEVELS.filter((item) => item.chapterId === id),
  );
  const index = ordered.findIndex((item) => item.id === entry.id);
  return index < 0 ? null : (ordered[index + 1] ?? null);
}
function launchMission(destination) {
  if (!destination) return false;
  // Validate before retiring the visible result. A rejected destination leaves
  // its current board and actions usable.
  try {
    createClassicSnakeMatch(prepareClassicSnakeLevel(destination, settings()), {
      mode,
      seed,
      policy: format === 'campaign' ? 'mission' : mode === 'versus' ? duel : 'endless',
    });
  } catch {
    saveNotice = 'invalid';
    refresh();
    return false;
  }
  save();
  entry = destination;
  prepare({ launch: true });
  return true;
}
function launchNext() {
  return launchMission(nextMission());
}
function launchRandom() {
  const chapters = campaignFor(entry)?.chapterIds ?? campaignFor(entry)?.chapters ?? [];
  const choices = CLASSIC_SNAKE_LEVELS.filter(
    (item) => item.id !== entry.id && chapters.includes(item.chapterId),
  );
  return launchMission(choices[Math.floor(Math.random() * choices.length)]);
}
function showResults() {
  playShell?.open('results');
  $('snake-results').append($('snake-reaction-caption'));
  const retry = playShell?.elements.buttons.retry;
  if (mode === 'versus' && retry) retry.textContent = locale === 'uk' ? 'Реванш' : 'Rematch';
  const focus = !$('next').hidden ? $('next') : retry;
  focus?.focus({ preventScroll: true });
}
function beginResultPlayback() {
  resultPlayback = {
    owner: match,
    frames: recentReplay.frames(),
    time: 0,
    duration: recentReplay.durationMs(),
    playing: true,
  };
  refreshReplayControl();
}
function refreshReplayControl() {
  const button = $('review');
  if (!button) return;
  const playing = !!resultPlayback?.playing;
  button.textContent = playing
    ? locale === 'uk'
      ? 'Зупинити повтор'
      : 'Pause replay'
    : locale === 'uk'
      ? 'Повторити останні 8 ходів'
      : 'Replay last 8 moves';
  button.setAttribute('aria-pressed', String(playing));
}
function observeStep(event) {
  recentReplay.observe(event);
  classicAudio.events?.(event.run, {
    board: `snake-${event.board}`,
    placement: boardPlacement(boards[event.board]?.canvas),
  });
  const defeats = event.run.events
    .filter((item) => item.type === 'target.caught')
    .map((item) => ({
      family:
        item.target.kind ?? (event.run.level.targetMovement === 'flee' ? 'runner' : 'lookout'),
      playerId: item.playerId,
    }));
  if (defeats.length && statsAttempt)
    void enemyStats.observe(statsAttempt, {
      board: String(event.board),
      sequence: event.run.tick,
      defeats,
    });
}
function installTransitionControls() {
  const stage = el('section', null, 'snake-continuation');
  stage.setAttribute('aria-label', locale === 'uk' ? 'Продовжити гру' : 'Continue playing');
  const next = el('button', null, 'primary'),
    retry = el('button'),
    home = el('button');
  next.addEventListener('click', launchNext);
  retry.addEventListener('click', () => prepare({ launch: true }));
  home.addEventListener('click', () => playShell.open('home'));
  stage.append(next, retry, home);
  $('game').querySelector('.arena').append(stage);
  mountContinuousPlayControls({
    document: doc,
    parent: stage,
    controller: transition,
    locale: () => locale,
    preferences: continuousPreferences,
  });
  const footer = playShell.elements.dialogs.results.querySelector('footer');
  footer.classList.add('snake-result-actions', 'continuous-result-actions');
  playShell.elements.buttons['results-back'].hidden = true;
  const primary = el('div', null, 'snake-result-primary');
  primary.append($('next'), playShell.elements.buttons.retry);
  const resultHome = el('button');
  resultHome.addEventListener('click', () => playShell.open('home'));
  primary.append(resultHome);
  footer.append(primary);
  mountContinuousPlayControls({
    document: doc,
    parent: footer,
    controller: transition,
    locale: () => locale,
    preferences: continuousPreferences,
  });
  const more = el('details', null, 'snake-result-more');
  const moreLabel = el('summary');
  more.append(moreLabel);
  const resultActions = el('div', null, 'run-controls');
  for (const [en, uk, action] of [
    ['Random level', 'Випадковий рівень', launchRandom],
    ['Choose mission', 'Обрати місію', () => playShell.open('missions')],
    [
      'Collections',
      'Колекції',
      () => {
        globalThis.location.href = new URL('../?panel=collection', globalThis.location.href).href;
      },
    ],
  ]) {
    const button = el('button', locale === 'uk' ? uk : en);
    button.addEventListener('click', () => {
      transition.cancel('result-action');
      action();
    });
    resultActions.append(button);
    button.dataset.en = en;
    button.dataset.uk = uk;
  }
  more.append(resultActions, $('slow-offer'));
  $('snake-results').append(more);
  const media = el('figure', null, 'snake-result-media');
  resultPreview = el('canvas', null, 'snake-result-board');
  resultPreview.setAttribute(
    'aria-label',
    locale === 'uk' ? 'Повтор останніх 8 ходів Snake' : 'Snake final 8 moves replay',
  );
  const replayControls = el('figcaption', null, 'snake-replay-controls');
  replayControls.append($('review'));
  media.append(resultPreview, replayControls);
  const overview = el('div', null, 'snake-result-overview');
  const summary = el('div', null, 'snake-result-summary');
  summary.append($('result-detail'), $('snake-stars'), $('result-record'));
  overview.append(media, summary);
  $('snake-results').prepend(overview);
  for (const [container, variant] of [
    [$('game').querySelector('.level-strip'), 'hud'],
    [playShell.elements.content.pause, 'panel'],
    [$('snake-results'), 'panel'],
  ]) {
    if (container)
      statsViews.push(
        mountEnemyStats({
          document: doc,
          container,
          stats: enemyStats,
          gameType: 'snake',
          getAttempt: () => statsAttempt,
          locale: () => locale,
          variant,
        }),
      );
  }
  $('game').querySelector('.level-strip').append($('snake-onboarding'));
  transitionControls = {
    refresh() {
      stage.hidden = !result() || !!playShell.topDialog();
      next.hidden = !nextMission() || result() !== 'won';
      next.textContent = nextMission()
        ? `${locale === 'uk' ? 'Далі' : 'Next'}: ${nextMission().title[locale]}`
        : text('next');
      retry.textContent =
        mode === 'versus'
          ? locale === 'uk'
            ? 'Реванш'
            : 'Rematch'
          : locale === 'uk'
            ? 'Спробувати ще'
            : 'Try again';
      home.textContent = locale === 'uk' ? 'Головна' : 'Home';
      resultHome.textContent = home.textContent;
      moreLabel.textContent = locale === 'uk' ? 'Інші дії' : 'More options';
      playShell.elements.buttons.retry.classList.toggle('primary', $('next').hidden);
      refreshReplayControl();
      for (const button of resultActions.children) button.textContent = button.dataset[locale];
    },
  };
}
function turn(player, direction) {
  if (result() || playShell?.topDialog()) return;
  if (ready) start();
  if (paused) return;
  queueClassicSnakeMatchTurn(match, player, direction);
  if (result()) finish();
  else refresh();
}
function relative(player, offset) {
  const run = runs[mode === 'versus' ? player : 0],
    snake = run?.snakes[mode === 'team' ? player : 0];
  if (!snake) return;
  const directions = ['up', 'right', 'down', 'left'],
    heading = snake.turns.at(-1) ?? snake.direction;
  turn(player, directions[(directions.indexOf(heading) + offset + 4) % 4]);
}
function prepare({ launch = false } = {}) {
  transition.cancel('new-attempt');
  if (statsAttempt) enemyStats.finishAttempt(statsAttempt);
  liveProvenance = 'live';
  statsAttempt = enemyStats.beginAttempt({ gameType: 'snake' });
  celebration = null;
  signalReception.forEach((signal) => signal.reset());
  $('game').querySelector('.arena').append($('snake-reaction-caption'));
  // An explicit selection owns the next Start; an older save remains available
  // only through Workshop, never as a silent replacement for the selected level.
  if (match) offerSavedContinue = false;
  classicAudio.reset();
  importEpoch++;
  reactions.reset(`classic:${++reactionAttempt}`);
  resultPlayback = null;
  recordedMatch = null;
  verifiedOutcome = null;
  if (format === 'endless' && mode === 'versus' && duel === 'survival') {
    if (survivalEntry) {
      entry = survivalEntry;
      preset = 'classic';
      targetRules = 'authored';
    } else duel = 'score';
  }
  for (const fx of effects) fx.reset();
  match = createClassicSnakeMatch(acceptedLevel(), {
    mode,
    seed,
    policy: format === 'campaign' ? 'mission' : mode === 'versus' ? duel : 'endless',
    durationMs: 180000,
    catchDeadlineMs: 30000,
  });
  runs = match.runs;
  recentReplay.reset(runs);
  flightFrames = [];
  ready = true;
  paused = true;
  previousFrame = null;
  buildBoards();
  updateURL();
  renderCopy();
  refresh();
  statsViews.forEach((view) => view.refresh());
  if (launch) start();
}
function buildBoards() {
  boardLayoutObserver?.disconnect();
  footprint?.dispose();
  $('boards').replaceChildren();
  boards = [];
  for (const [index, run] of runs.entries()) {
    const card = el('article', null, 'board-card'),
      stats = el('div', null, 'board-stats'),
      fields = {};
    for (const key of ['caught', 'length', 'clock', 'score', 'best', 'queued']) {
      const column = el('div'),
        label = el('span'),
        value = el('b');
      column.dataset.stat = key;
      column.append(label, value);
      stats.append(column);
      fields[key] = { label, value };
    }
    const wrap = el('div', null, 'board-wrap'),
      canvas = el('canvas');
    canvas.width = run.level.width * 28;
    canvas.height = run.level.height * 28;
    canvas.tabIndex = 0;
    const message = el('div', null, 'board-message'),
      title = el('strong'),
      detail = el('small');
    message.append(title, detail);
    wrap.append(canvas, message);
    card.append(stats, wrap);
    if (mode === 'versus') card.prepend(el('p', text(index ? 'p2' : 'p1'), 'player-label'));
    $('boards').append(card);
    boards.push({ canvas, fields, message, title, detail });
    let pointer = null;
    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || pointer) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointerup', (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x,
        dy = event.clientY - pointer.y;
      pointer = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 12 || mode === 'team') return;
      turn(
        mode === 'versus' ? index : 0,
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up',
      );
    });
    for (const name of ['pointercancel', 'lostpointercapture'])
      canvas.addEventListener(name, () => {
        pointer = null;
      });
  }
  buildPads();
  footprint = createBoardFootprints(boards.map((board) => board.canvas));
  const arrange = () => {
    const area = $('boards');
    if (mode !== 'versus') {
      delete area.dataset.arrangement;
      return;
    }
    const width = area.clientWidth,
      height = area.clientHeight;
    const stats =
      Math.max(
        ...boards.map(
          (board) =>
            board.canvas.parentElement.previousElementSibling?.getBoundingClientRect().height ?? 0,
        ),
      ) + 28;
    const level = runs[0].level;
    const paired = Math.min((width - 12) / 2 / level.width, (height - stats) / level.height);
    const stacked = Math.min(width / level.width, ((height - 12) / 2 - stats) / level.height);
    const arrangement = stacked > paired ? 'stacked' : 'paired';
    if (area.dataset.arrangement !== arrangement) area.dataset.arrangement = arrangement;
  };
  if (typeof globalThis.ResizeObserver === 'function') {
    boardLayoutObserver = new globalThis.ResizeObserver(arrange);
    boardLayoutObserver.observe($('boards'));
  }
  arrange();
  primeEffects();
}
function buildPads() {
  $('pads').replaceChildren();
  for (let player = 0; player < (mode === 'solo' ? 1 : 2); player++) {
    const group = el('div'),
      label = el('p', text(player ? 'p2' : 'p1'), 'pad-label'),
      pad = el('div', null, steering === 'turns' ? 'pad turn-pad' : 'pad');
    pad.setAttribute('role', 'group');
    pad.setAttribute('aria-label', label.textContent);
    const controls =
      steering === 'turns'
        ? [
            ['turnLeft', '↶'],
            ['turnRight', '↷'],
          ]
        : [
            ['up', '↑'],
            ['left', '←'],
            ['down', '↓'],
            ['right', '→'],
          ];
    for (const [direction, symbol] of controls) {
      const button = el('button', symbol);
      button.dataset.direction = direction;
      button.setAttribute('aria-label', `${label.textContent}: ${text(direction)}`);
      button.addEventListener('click', () =>
        steering === 'turns'
          ? relative(player, direction === 'turnLeft' ? -1 : 1)
          : turn(player, direction),
      );
      pad.append(button);
    }
    if (mode !== 'solo') group.append(label);
    group.append(pad);
    $('pads').append(group);
  }
  applyTouch();
  footprint?.refresh();
}
function renderProgress() {
  const chapterEntries = CLASSIC_SNAKE_LEVELS.filter((item) => item.chapterId === entry.chapterId);
  for (const [index, item] of chapterEntries.entries()) {
    const option = $('mission').children[index];
    if (option?.value === item.id)
      option.textContent = `${records.cleared(item.id) ? '✓ ' : ''}${index + 1}. ${item.title[locale]}`;
  }
  const cards = $('mission-cards');
  cards.setAttribute('aria-label', text('mission'));
  cards.replaceChildren(
    ...chapterEntries.map((item, index) => {
      const card = el(
        'button',
        `${records.cleared(item.id) ? '✓ ' : ''}${String(index + 1).padStart(2, '0')} · ${item.title[locale]}`,
      );
      card.type = 'button';
      card.setAttribute('aria-pressed', String(item.id === entry.id));
      card.addEventListener('click', () => {
        save();
        entry = item;
        prepare({ launch: true });
      });
      return card;
    }),
  );
  $('progress-summary').textContent = text('progress', {
    done: records.chapter(chapterEntries),
    chapterTotal: chapterEntries.length,
    all: CLASSIC_SNAKE_LEVELS.filter((item) => records.cleared(item.id)).length,
    total: CLASSIC_SNAKE_LEVELS.length,
  });
  const recent = CLASSIC_SNAKE_LEVELS.find((item) => item.id === records.recent()?.levelId);
  $('recent-level').hidden = !recent;
  $('recent-level').textContent = recent ? text('lastPlayed', { name: recent.title[locale] }) : '';
  const upcoming = nextUncleared();
  $('uncleared-level').hidden = !upcoming;
  $('uncleared-level').textContent = upcoming
    ? text('nextUncleared', { name: upcoming.title[locale] })
    : '';
  const unlocked = installedContent
    ? []
    : CLASSIC_SNAKE_CHAPTERS.filter(
        (chapter) =>
          records.chapter(CLASSIC_SNAKE_LEVELS.filter((item) => item.chapterId === chapter.id)) ===
          CLASSIC_SNAKE_LEVELS.filter((item) => item.chapterId === chapter.id).length,
      );
  if (accent !== 'default' && !unlocked.some((chapter) => chapter.id === accent))
    accent = 'default';
  options(
    $('accent'),
    [
      ['default', text('defaultAccent')],
      ...unlocked.map((chapter) => [chapter.id, chapter.title[locale]]),
    ],
    accent,
  );
  const record = runs[0] && records.get(runs[0], mode, match.options.policy);
  $('record-summary').textContent = record
    ? text('recordDetail', {
        score: record.score,
        time: record.fastest
          ? text('seconds', { value: (record.fastest.value / 1000).toFixed(1) })
          : '—',
        moves: record.fewest?.value ?? '—',
      }) +
      (record.teamwork ? ` · ${text('teamwork')}` : '') +
      (record.noSupplies ? ` · ${text('noSupplies')}` : '')
    : text(format === 'endless' ? 'noEndlessRecord' : 'noRecord');
}
function nextUncleared() {
  return (
    CLASSIC_SNAKE_LEVELS.find(
      (item) => item.chapterId === entry.chapterId && !records.cleared(item.id),
    ) ?? CLASSIC_SNAKE_LEVELS.find((item) => !records.cleared(item.id))
  );
}
let snakeModeChoices = null;
function renderModeLinks() {
  const links = $('snake-mode-links');
  if (!links) return;
  snakeModeChoices?.dispose();
  const actions = {};
  for (const [key, path] of [
    ['solo', '../'],
    ['team', '../couch/relay-rescue.html'],
    ['versus', '../couch/'],
  ]) {
    const node = el('a');
    const target = new URL(path, globalThis.location.href);
    const refreshDestination = (transfer = false) => {
      target.searchParams.set('lang', locale);
      node.href = appearanceLaunchURL(target.href, contextualAppearance(doc), { transfer });
    };
    refreshDestination();
    node.addEventListener('click', () => {
      refreshDestination(true);
      pause();
    });
    actions[key] = node;
  }
  snakeModeChoices = mountModeChoices({
    root: links,
    current: 'snake',
    actions,
    pause,
    guidesContainer: snakeSettingsView?.panels.extras ?? $('snake-workshop'),
  });
}
function renderCopy() {
  doc.documentElement.lang = locale;
  doc.title = `${text('title')} · FPV / LINE`;
  doc.body.dataset.mode = mode;
  doc.body.dataset.boardStyle = boardStyle;
  for (const [selector, label] of [
    ['#mode-tabs', 'mode'],
    ['.setup:not(.variants):not(.progress-links)', 'setupLabel'],
    ['.variants', 'rulesLabel'],
    ['.progress-links', 'progressLabel'],
    ['.arena', 'arenaLabel'],
  ])
    doc.querySelector(selector)?.setAttribute('aria-label', text(label));
  for (const node of doc.querySelectorAll('[data-word]'))
    node.textContent = text(node.dataset.word);
  $('language').value = locale;
  for (const button of doc.querySelectorAll('#mode-tabs [data-mode]')) {
    button.textContent = text(button.dataset.mode);
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  }
  const campaign = campaignFor(entry);
  options(
    $('campaign'),
    CLASSIC_SNAKE_CAMPAIGNS.map((item) => [item.id, item.title[locale]]),
    campaign.id,
  );
  options(
    $('chapter'),
    campaignChapters(campaign).map((chapter) => [chapter.id, chapter.title[locale]]),
    entry.chapterId,
  );
  options(
    $('mission'),
    CLASSIC_SNAKE_LEVELS.filter((item) => item.chapterId === entry.chapterId).map((item, i) => [
      item.id,
      `${records.cleared(item.id) ? '✓ ' : ''}${i + 1}. ${item.title[locale]}`,
    ]),
    entry.id,
  );
  for (const [id, value] of Object.entries({
    format,
    pace,
    'target-rules': targetRules,
    preset,
    duel,
    style,
    'board-style': boardStyle,
    'actor-cast': actorAppearance.snapshot().cast,
    steering,
  })) {
    for (const option of $(id).options)
      option.textContent =
        (id === 'actor-cast'
          ? ACTOR_CASTS.find((cast) => cast.id === option.value)?.name[locale]
          : null) ??
        text(
          id === 'duel' && option.value === 'score'
            ? 'scoreDuel'
            : id === 'actor-cast' && option.value === 'authored'
              ? 'campaignCast'
              : option.value,
        );
    $(id).value = value;
  }
  $('preset-field').hidden = format !== 'endless';
  $('duel-field').hidden = format !== 'endless' || mode !== 'versus';
  for (const option of $('duel').options)
    if (option.value === 'survival') option.disabled = !survivalEntry;
  const survival = format === 'endless' && mode === 'versus' && duel === 'survival';
  for (const id of ['mission', 'chapter', 'campaign', 'target-rules', 'preset'])
    $(id).disabled = survival;
  $('featured').hidden =
    format !== 'campaign' ||
    !CLASSIC_SNAKE_FEATURED.some((item) => item.chapterId === entry.chapterId);
  $('level-title').textContent = entry.title[locale];
  $('boundary').textContent = text(entry.level.wrap ? 'wrap' : 'walls');
  $('level-description').textContent =
    targetRules === 'authored' ? entry.description[locale] : text('remixDescription');
  $('target-style').textContent = text(
    targetRules === 'varied'
      ? 'varied'
      : targetRules === 'moving'
        ? 'fleeing'
        : !runs[0].level.version.endsWith('v1')
          ? 'modernTargets'
          : entry.level.targetMovement === 'flee'
            ? 'fleeing'
            : 'stationary',
  );
  $('mode-help').textContent =
    format === 'endless'
      ? text(
          mode === 'versus' ? (duel === 'survival' ? 'survivalHelp' : 'scoreHelp') : 'endlessHelp',
        )
      : mode === 'team'
        ? text('teamHelp')
        : mode === 'versus'
          ? text('vsHelp')
          : '';
  $('controls-help').textContent = text(mode === 'solo' ? 'controls' : 'twoControls');
  for (const id of ['next']) $(id).textContent = text(id);
  $('home-link').textContent = text('home');
  $('home-link').href = `../?lang=${locale}`;
  $('studio-link').href =
    snakeStudioReturnHref(globalThis.location.href) ?? `../studio/snake.html?lang=${locale}`;
  playShell?.setLocale(locale);
  snakeSettingsView?.refresh(locale);
  snakeGlobalSettings?.refresh(locale);
  touchPresentationControls?.refresh();
  renderModeLinks();
  $('campaign-link').textContent = text('campaigns');
  $('campaign-link').href = `./?lang=${locale}`;
  $('remix-link').href =
    `${mode === 'solo' ? '../' : mode === 'versus' ? '../couch/' : '../couch/relay-rescue.html'}?journey=snake-hunt-v1&snake-style=capture&lang=${locale}`;
  $('seed-label').textContent = text('seed', { seed });
  $('save-status').textContent = saveNotice ? text(saveNotice) : '';
  $('continue').hidden = !savedRound;
  const icon = $('target-icon').getContext('2d');
  icon.clearRect(0, 0, 64, 64);
  drawClassicTarget(icon, 0, 0, 64, 0, {
    ...(runs[0].targets?.[0] ?? runs[0].target ?? {}),
    cast: currentCast(),
    reducedEffects: true,
  });
  renderEncounterGuide();
  boards.forEach(({ canvas, fields }, i) => {
    canvas.setAttribute(
      'aria-label',
      `${text('title')}: ${entry.title[locale]}. ${mode === 'versus' ? text(i ? 'p2' : 'p1') : ''} ${readyInstruction()}`,
    );
    for (const key of Object.keys(fields)) fields[key].label.textContent = text(key);
  });
  renderProgress();
}
function failureText(run, boardResult) {
  const cause = boardResult?.cause ?? run.failure?.cause;
  const key = {
    wall: 'wallCrash',
    body: 'bodyCrash',
    'partner-body': 'partnerCrash',
    'head-on': 'headCrash',
    'head-swap': 'headCrash',
    'catch-deadline': 'catchDeadline',
    'step-limit': 'limit',
    'input-limit': 'limit',
    shield: 'shieldCrash',
    armor: 'armorCrash',
    specialist: 'specialistCrash',
    'shield-front': 'shieldCrash',
    brace: 'armorCrash',
  }[cause];
  const hazard = {
    lane:
      locale === 'uk'
        ? 'Голова потрапила під атаку смуги. Дочекайтеся відновлення або облетіть збоку.'
        : 'The head entered an active lane. Wait for recovery or use the permanent bypass.',
    projectile:
      locale === 'uk'
        ? 'Постріл влучив у голову. Стежте за прицілом і позначкою наступної клітини.'
        : 'A shot hit the head. Watch the aim line and marked next cell.',
    relay:
      locale === 'uk'
        ? 'Щит ще закритий. Торкніться обох зв’язаних перемикачів.'
        : 'The shield is still closed. Touch both linked switches first.',
  }[cause];
  if (!key && !hazard) return '';
  const detail = hazard ?? text(key);
  if (mode !== 'team' || !run.failure?.players?.length) return detail;
  return run.failure.players
    .map(
      ({ playerId, cause: playerCause }) =>
        `${text(playerId ? 'p2' : 'p1')}: ${failureText({ failure: { cause: playerCause } }, null)}`,
    )
    .join(' ');
}
function readyInstruction() {
  if (runs[0]?.level.version === 'classic-snake-level.v4') return entry.description[locale];
  return text(
    runs[0]?.level.targets?.required.some((policy) => ['shield', 'brace'].includes(policy.kind))
      ? 'specialistHelp'
      : 'readyHelp',
  );
}
function renderEncounterGuide() {
  if (!runs[0]) return;
  const level = runs[0].level;
  const kinds = level.targets
    ? [
        ...level.targets.required.map((policy) => policy.kind),
        ...(level.targets.bonus ? ['courier'] : []),
      ]
    : [level.targetMovement === 'flee' ? 'runner' : 'still'];
  const entries = [...new Set(kinds)].map((kind) => actorFieldGuide(kind, locale)).filter(Boolean);
  for (const node of doc.querySelectorAll('[data-word="readyHelp"]'))
    node.textContent = readyInstruction();
  const specialist = entries.some((actor) => actor.specialist);
  $('encounter-summary').textContent =
    text('encounterSummary', {
      actors: entries.map((actor) => actor.name).join(' · '),
      count: level.targets?.maxActive ?? 1,
      objective: format === 'endless' ? text('endless') : text('catchQuota', { goal: level.goal }),
    }) + (specialist ? ` ◇ ${text('specialistNotice')}` : '');
  $('encounter-summary').dataset.specialist = String(specialist);
  renderEnemyFieldGuide($('field-guide-cards'), kinds, { locale, cast: currentCast() });
}
function refresh() {
  if (!match) return;
  const nextTarget =
    runs[0].targets?.find((actor) => !actor.bonus) ?? runs[0].targets?.[0] ?? runs[0].target;
  if (nextTarget) {
    const guide = actorFieldGuide(
      nextTarget.kind ?? (runs[0].level.targetMovement === 'flee' ? 'runner' : 'still'),
      locale,
    );
    if (guide) $('target-style').textContent = guide.name;
    const icon = $('target-icon').getContext('2d');
    icon.clearRect(0, 0, 64, 64);
    drawClassicTarget(icon, 0, 0, 64, 0, {
      ...nextTarget,
      cast: currentCast(),
      reducedEffects: true,
    });
  }
  const outcome = result();
  doc.body.dataset.playing = String(!ready && !paused);
  playShell?.update({
    phase: outcome ? 'results' : ready ? 'ready' : paused ? 'paused' : 'playing',
    transitionActive: !['idle', 'cancelled'].includes(transition.snapshot().phase),
    missionName: entry.title[locale],
    summary: readyInstruction(),
    canResume: !outcome && (!ready || (offerSavedContinue && !!savedRound)),
    muted: audioMaster.snapshot().muted,
  });
  $('next').hidden = !nextMission() || outcome !== 'won';
  $('next').classList.add('primary');
  $('next').textContent = nextMission()
    ? `${locale === 'uk' ? 'Далі' : 'Next'}: ${nextMission().title[locale]}`
    : text('next');
  transitionControls?.refresh();
  $('review').hidden = !outcome || !runs.some((run) => run.tick > 0);
  $('slow-offer').hidden = !outcome || earlyFailures < 3 || pace === 'slow';
  $('speed-note').textContent = text('step', {
    ms: runs.map((run) => classicSnakeSummary(run).stepMs).join(' / '),
  });
  const title =
    outcome === 'p1' || outcome === 'p2'
      ? text('winner', { player: outcome === 'p1' ? 1 : 2 })
      : text(outcome ?? (ready ? 'ready' : 'paused'));
  $('announcement').textContent =
    outcome === 'lost'
      ? failureText(runs[0], match.boardResults[0]) || title
      : outcome
        ? title
        : ready
          ? readyInstruction()
          : paused
            ? text('paused')
            : '';
  $('result-detail').textContent =
    $('announcement').textContent +
    (!nextMission() && outcome === 'won' && mode !== 'versus'
      ? locale === 'uk'
        ? ' Кампанію завершено!'
        : ' Campaign complete!'
      : '');
  const resultRetry = playShell?.elements.buttons.retry;
  if (mode === 'versus' && resultRetry)
    resultRetry.textContent = locale === 'uk' ? 'Реванш' : 'Rematch';
  $('result-record').textContent = $('record-summary').textContent;
  renderRatings();
  const onboarding = $('snake-onboarding');
  if (onboarding) {
    const fieldMission = runs[0].level.version === 'classic-snake-level.v4';
    const relayPending = runs.some((run) => run.relays?.some((relay) => !relay.collected));
    onboarding.hidden =
      (!fieldMission &&
        !['classic-snake-open-loop', 'classic-snake-two-landings'].includes(entry.id)) ||
      result() ||
      (runs[0].tick > (fieldMission ? 40 : 36) && !(fieldMission && relayPending));
    onboarding.textContent = fieldMission
      ? entry.description[locale]
      : entry.id === 'classic-snake-two-landings'
        ? locale === 'uk'
          ? 'Облітайте острови. Залишайте місце для хвоста.'
          : 'Turn around the islands. Leave room for your tail.'
        : runs[0].catches > 0
          ? locale === 'uk'
            ? 'Кожен ворог подовжує хвіст. Плануйте наступний поворот.'
            : 'Every catch grows your tail. Plan your next turn.'
          : locale === 'uk'
            ? 'Стрілки / WASD: повертайте до краю поля. Ловіть ворогів.'
            : 'Arrows / WASD: turn before the edge. Catch the enemies.';
  }
  boards.forEach((board, i) => {
    const run = runs[i],
      summary = classicSnakeSummary(run),
      boardResult = match.boardResults[i];
    board.fields.caught.value.textContent =
      format === 'endless' ? String(summary.catches) : `${summary.catches} / ${summary.goal}`;
    board.fields.length.value.textContent = summary.lengths.join(' + ');
    board.fields.score.value.textContent = String(summary.score);
    board.fields.best.value.textContent = String(
      records.get(run, mode, match.options.policy)?.score ?? 0,
    );
    const clock =
      format === 'endless' && mode === 'versus'
        ? Math.max(
            0,
            duel === 'survival' && !boardResult
              ? match.lastCatchAt[i] + 30000 - match.elapsedMs
              : 180000 - match.elapsedMs,
          )
        : match.elapsedMs;
    board.fields.clock.value.textContent = `${Math.floor(clock / 60000)}:${String(Math.floor(clock / 1000) % 60).padStart(2, '0')}`;
    board.fields.queued.value.textContent = run.snakes
      .map(
        (snake) =>
          snake.turns
            .map((direction) => ({ up: '↑', down: '↓', left: '←', right: '→' })[direction])
            .join('') || '·',
      )
      .join(' / ');
    board.message.hidden =
      ['loss-effect', 'replay', 'ready', 'celebration'].includes(transition.snapshot().phase) ||
      (!ready && !paused && !outcome && !boardResult);
    board.title.textContent = boardResult?.status === 'lost' && !outcome ? text('lost') : title;
    const reason = failureText(run, boardResult);
    board.detail.textContent = reason
      ? `${reason}${!outcome && boardResult ? ` ${text('otherPilotFlying')}` : ''}`
      : outcome
        ? run.status === 'won'
          ? text('winHelp')
          : text('restart')
        : ready
          ? text('start')
          : text('resume');
  });
}
function renderRatings() {
  if (!$('snake-stars')) return;
  const eligible = format === 'campaign' && mode !== 'versus';
  const criteria = classicSnakeRatingForRecord({
    clear: eligible,
    policy: match.options.policy,
    mode,
    seed,
    levelIdentity: runs[0].levelIdentity,
  });
  const grade =
    eligible && verifiedOutcome === match
      ? classicSnakeRatingForRecord({
          clear: true,
          policy: match.options.policy,
          mode,
          seed,
          levelIdentity: runs[0].levelIdentity,
          fewestMoves: runs[0].tick,
        })
      : null;
  $('snake-stars').hidden = !eligible || result() !== 'won';
  $('snake-stars').textContent =
    liveProvenance === 'import'
      ? locale === 'uk'
        ? 'Запис · без нових нагород'
        : 'Recording · no new awards'
      : grade?.stars
        ? '★'.repeat(grade.stars) + '☆'.repeat(3 - grade.stars)
        : locale === 'uk'
          ? 'Перевірка результату…'
          : 'Verifying completion…';
  $('snake-stars').setAttribute(
    'aria-label',
    grade?.stars ? `${grade.stars} / 3` : $('snake-stars').textContent,
  );
  $('snake-rating-criteria').textContent = !eligible
    ? locale === 'uk'
      ? 'Рекорди цієї гри зберігаються без оцінки зірками.'
      : 'This game keeps personal records without mission stars.'
    : criteria.calibrated
      ? locale === 'uk'
        ? `★ Завершити · ★★ ≤ ${criteria.silverMoves} ходів · ★★★ ≤ ${criteria.goldMoves} ходів`
        : `★ Complete · ★★ ≤ ${criteria.silverMoves} moves · ★★★ ≤ ${criteria.goldMoves} moves`
      : locale === 'uk'
        ? '★ За перевірене завершення. Вищі оцінки потребують калібрування цього набору.'
        : '★ For a verified clear. Higher grades await calibration for this setup.';
}
function restore(raw, { provenance = 'import' } = {}) {
  transition.cancel('restore');
  importEpoch++;
  const restoredReplay = createClassicRecentReplay();
  const observation = {
    onStart: (value) => restoredReplay.reset(value.runs),
    onStep: (event) => restoredReplay.observe(event),
  };
  try {
    const source = boundedJSON(raw, {
      maxBytes: 8 * 1024 * 1024,
      maxNodes: 360000,
      maxArray: 32768,
      maxDepth: 14,
    });
    const item = CLASSIC_SNAKE_LEVELS.find((candidate) => candidate.id === source.levelId);
    required(
      item && MODES.includes(source.mode) && Object.hasOwn(CLASSIC_PACES, source.pace),
      'Unsupported round.',
    );
    let restored, next;
    if (source.format === 'revealline-classic-snake-session.v1') {
      exactKeys(
        source,
        ['format', 'levelId', 'mode', 'pace', 'elapsedMs', 'replays'],
        'Classic Snake legacy session',
      );
      next = {
        pace: source.pace,
        format: 'campaign',
        targetRules: 'authored',
        preset: 'classic',
        duel: 'score',
        seed: 17,
        style,
      };
      restored = restoreClassicSnakeLegacyMatch(
        { replays: source.replays, elapsedMs: source.elapsedMs, mode: source.mode },
        { level: prepareClassicSnakeLevel(item, next), ...observation },
      );
      next.seed = restored.options.seed;
    } else {
      exactKeys(
        source,
        [
          'format',
          'activity',
          'levelId',
          'mode',
          'pace',
          'targetRules',
          'preset',
          'duel',
          'seed',
          'style',
          'match',
          ...(source.format === SESSION_FORMAT ? ['statistics', 'provenance'] : []),
        ],
        'Classic Snake session',
      );
      required(
        [SESSION_FORMAT, 'revealline-classic-snake-session.v2'].includes(source.format) &&
          ['campaign', 'endless'].includes(source.activity),
        'Unsupported session.',
      );
      next = {
        pace: source.pace,
        format: source.activity,
        targetRules: source.targetRules,
        preset: source.preset,
        duel: source.duel,
        seed: source.seed,
        style: source.style,
      };
      required(
        ['authored', 'moving', 'varied'].includes(next.targetRules) &&
          PRESETS.includes(next.preset) &&
          ['score', 'survival'].includes(next.duel) &&
          ['cable', 'signal'].includes(next.style) &&
          Number.isSafeInteger(next.seed) &&
          next.seed >= 0 &&
          next.seed <= 0xffffffff,
        'Invalid setup.',
      );
      restored = restoreClassicSnakeMatch(source.match, {
        level: prepareClassicSnakeLevel(item, next),
        ...observation,
      });
      const policy =
        next.format === 'campaign' ? 'mission' : source.mode === 'versus' ? next.duel : 'endless';
      required(
        restored.options.mode === source.mode &&
          restored.options.seed === next.seed &&
          restored.options.policy === policy,
        'Round ownership mismatch.',
      );
    }
    const statistics =
      source.format === SESSION_FORMAT ? validateEnemyStatsSession(source.statistics) : null;
    if (source.format === SESSION_FORMAT) {
      required(
        ['live', 'continue', 'import'].includes(source.provenance),
        'Invalid session provenance.',
      );
      required(
        statistics.gameType === 'snake' &&
          Object.entries(statistics.sequences).every(
            ([board, tick]) =>
              /^(0|1)$/.test(board) &&
              restored.runs[Number(board)] &&
              tick <= restored.runs[Number(board)].tick,
          ),
        'Statistics cursor differs from the accepted attempt.',
      );
    }
    const nextProvenance =
      provenance === 'continue' && source.provenance !== 'import' ? 'continue' : 'import';
    const nextAttempt = enemyStats.beginAttempt({
      gameType: 'snake',
      provenance: nextProvenance,
      saved:
        statistics && nextProvenance === 'continue' && !sessionWriter.writable
          ? forkEnemyStatsSession(statistics)
          : statistics,
    });
    if (statsAttempt) enemyStats.finishAttempt(statsAttempt);
    liveProvenance = nextProvenance;
    statsAttempt = nextAttempt;
    entry = item;
    mode = source.mode;
    ({ pace, format, targetRules, preset, duel, seed, style } = next);
    classicAudio.reset();
    match = restored;
    runs = match.runs;
    recentReplay.reset();
    restoredReplay
      .frames()
      .forEach((frames, board) => frames.forEach((frame) => recentReplay.capture(frame, board)));
    flightFrames = [];
    ready = false;
    paused = true;
    previousFrame = null;
    recordedMatch = null;
    verifiedOutcome = null;
    sound.gameplayPaused = true;
    reactions.reset(`classic:${++reactionAttempt}`);
    reactions.suspend();
    for (const fx of effects) fx.reset();
    buildBoards();
    updateURL();
    renderCopy();
    refresh();
    statsViews.forEach((view) => view.refresh());
    saveNotice = result() ? 'loadedComplete' : 'loaded';
    $('save-status').textContent = text(saveNotice);
    if (result()) {
      if (liveProvenance !== 'import' && result() === 'won') verifiedOutcome = match;
      refresh();
      showResults();
    } else start();
    return true;
  } catch {
    saveNotice = 'invalid';
    $('save-status').textContent = text('invalid');
    return false;
  }
}
function primeEffects() {
  const choice = destruction.snapshot();
  $('brutal').checked = choice.brutal;
  $('blood').checked = choice.blood;
  $('blood').disabled = !choice.brutal;
  $('remains').checked = remains.snapshot().showRemains;
  $('reduced').checked = display.snapshot().reducedEffects;
  effects.forEach((fx, i) => {
    fx.reset();
    if (runs[i])
      fx.advance({ valid: true, eliminations: classicCatchMarks(runs[i]) }, 0, {
        key: runs[i],
        ...choice,
        paused: true,
        reduced: isReduced(),
      });
  });
}
function watchReview() {
  transition.cancel('replay-viewing');
  if (!resultPlayback || resultPlayback.owner !== match) beginResultPlayback();
  else {
    resultPlayback.playing = !resultPlayback.playing;
    if (resultPlayback.playing) resultPlayback.time = 0;
  }
  refresh();
}

destruction.subscribe(primeEffects);
remains.subscribe(primeEffects);
display.subscribe(primeEffects);
$('brutal').addEventListener('change', () => destruction.set({ brutal: $('brutal').checked }));
$('blood').addEventListener('change', () => destruction.set({ blood: $('blood').checked }));
$('remains').addEventListener('change', () => remains.set($('remains').checked));
$('reduced').addEventListener('change', () =>
  display.set({ reducedEffects: $('reduced').checked }),
);
audioMaster.subscribe((state) => {
  $('muted').checked = state.muted;
  $('volume').value = state.volume;
});
$('effects-volume').value = sound.settings.sfx;
$('muted').addEventListener('change', () => {
  audioPreferences.setMuted($('muted').checked);
  if (!$('muted').checked) void sound.enable();
});
$('volume').addEventListener('input', () => audioPreferences.setVolume(Number($('volume').value)));
$('effects-volume').addEventListener('input', () => {
  sound.configure({ sfx: Number($('effects-volume').value) });
  storePresentation();
});
$('style').addEventListener('change', () => {
  style = $('style').value;
  storePresentation();
});
$('board-style').addEventListener('change', () => {
  boardStyle = $('board-style').value;
  doc.body.dataset.boardStyle = boardStyle;
  storePresentation();
  updateURL();
});
$('actor-cast').addEventListener('change', () => {
  actorAppearance.set({ cast: $('actor-cast').value });
});
actorAppearance.subscribe(() => {
  if (runs.length) renderCopy();
});
$('field-guide').addEventListener('toggle', () => {
  if ($('field-guide').open) pause();
});
$('steering').addEventListener('change', () => {
  pause();
  steering = $('steering').value;
  storePresentation();
  buildPads();
});
$('accent').addEventListener('change', () => {
  accent = $('accent').value;
  storePresentation();
});
$('language').addEventListener('change', () => {
  pause();
  setLocale($('language').value);
});
onLocaleChange(() => {
  locale = getLocale() === 'uk' ? 'uk' : 'en';
  buildBoards();
  updateURL();
  renderCopy();
  refresh();
});
for (const button of doc.querySelectorAll('#mode-tabs [data-mode]'))
  button.addEventListener('click', () => {
    save();
    mode = button.dataset.mode;
    prepare();
  });
for (const id of ['format', 'pace', 'target-rules', 'preset', 'duel'])
  $(id).addEventListener('change', () => {
    save();
    format = $('format').value;
    pace = $('pace').value;
    targetRules = $('target-rules').value;
    preset = $('preset').value;
    duel = $('duel').value;
    prepare();
  });
$('campaign').addEventListener('change', () => {
  save();
  const campaign = CLASSIC_SNAKE_CAMPAIGNS.find((item) => item.id === $('campaign').value);
  entry = CLASSIC_SNAKE_LEVELS.find((item) =>
    (campaign.chapterIds ?? campaign.chapters).includes(item.chapterId),
  );
  prepare();
});
$('chapter').addEventListener('change', () => {
  save();
  entry = CLASSIC_SNAKE_LEVELS.find((item) => item.chapterId === $('chapter').value);
  prepare();
});
$('mission').addEventListener('change', () => {
  save();
  entry = CLASSIC_SNAKE_LEVELS.find((item) => item.id === $('mission').value);
  prepare();
});
for (const id of ['recent-level', 'uncleared-level'])
  $(id).addEventListener('click', () => {
    const destination =
      id === 'uncleared-level'
        ? nextUncleared()
        : CLASSIC_SNAKE_LEVELS.find((item) => item.id === records.recent()?.levelId);
    if (!destination) return;
    save();
    entry = destination;
    format = 'campaign';
    prepare({ launch: true });
  });
$('next').addEventListener('click', launchNext);
$('featured').addEventListener('click', () => {
  save();
  const sortie = CLASSIC_SNAKE_FEATURED.find((item) => item.chapterId === entry.chapterId);
  if (!sortie) return;
  entry = CLASSIC_SNAKE_LEVELS.find((item) => item.id === sortie.levelId);
  seed = sortie.seed;
  targetRules = 'authored';
  prepare();
});
$('new-route').addEventListener('click', () => {
  save();
  seed = globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  prepare();
});
$('slow-offer').addEventListener('click', () => {
  pace = 'slow';
  prepare({ launch: true });
});
$('review').addEventListener('click', watchReview);
$('continue').addEventListener('click', () => {
  if (savedRound) restore(savedRound, { provenance: 'continue' });
});
$('export').addEventListener('click', () => {
  pause();
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(session(), null, 2)], { type: 'application/json' }),
  );
  const link = el('a');
  link.href = url;
  link.download = `${entry.id}-${mode}.json`;
  doc.body.append(link);
  link.click();
  link.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('import').addEventListener('change', async () => {
  pause();
  const file = $('import').files[0],
    ticket = ++importEpoch;
  try {
    if (!file || file.size > 8 * 1024 * 1024) throw new Error('Size');
    const raw = await file.text();
    if (ticket === importEpoch) restore(raw);
  } catch {
    if (ticket === importEpoch) $('save-status').textContent = text('invalid');
  }
  $('import').value = '';
});
doc.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || playShell?.topDialog()) return;
  if (event.key === 'Escape' && !event.repeat) {
    event.preventDefault();
    pause();
    return;
  }
  if (
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.isComposing ||
    event.target.closest?.('input,select,textarea,summary,a')
  )
    return;
  const key =
    { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyP: 'p', KeyR: 'r' }[event.code] ??
    event.key.toLowerCase();
  if (result() && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(key))
    transition.cancel('navigation');
  if ([' ', 'p', 'r', 'enter'].includes(key)) {
    if ([' ', 'enter'].includes(key) && event.target.tagName === 'BUTTON') return;
    event.preventDefault();
    if (event.repeat) return;
    if (result()) {
      if (key === 'p') pause();
      else if (key !== 'r' && result() === 'won' && nextMission()) launchNext();
      else prepare({ launch: true });
    } else if (key !== 'r') {
      if (ready || paused) start();
      else pause();
    }
    return;
  }
  const direction = {
    arrowup: 'up',
    arrowright: 'right',
    arrowdown: 'down',
    arrowleft: 'left',
    w: 'up',
    d: 'right',
    s: 'down',
    a: 'left',
  }[key];
  if (!direction) return;
  event.preventDefault();
  if (!event.repeat) turn(mode !== 'solo' && key.startsWith('arrow') ? 1 : 0, direction);
});
function pollGamepads() {
  const pads = Array.from(globalThis.navigator.getGamepads?.() ?? []).filter(Boolean),
    present = new Set();
  for (const pad of pads) {
    present.add(pad.index);
    if (!gamepadSeats.has(pad.index)) {
      const free = [0, ...(mode === 'solo' ? [] : [1])].find(
        (seat) => ![...gamepadSeats.values()].includes(seat),
      );
      if (free === undefined) continue;
      gamepadSeats.set(pad.index, free);
    }
    const seat = gamepadSeats.get(pad.index);
    if (mode === 'solo' && seat !== 0) continue;
    const buttons = [
      pad.buttons[12]?.pressed || pad.axes[1] < -0.55,
      pad.buttons[15]?.pressed || pad.axes[0] > 0.55,
      pad.buttons[13]?.pressed || pad.axes[1] > 0.55,
      pad.buttons[14]?.pressed || pad.axes[0] < -0.55,
      pad.buttons[9]?.pressed,
      pad.buttons[0]?.pressed,
      pad.buttons[1]?.pressed,
    ];
    const previous = gamepadState.get(pad.index);
    gamepadState.set(pad.index, buttons);
    if (!previous) continue;
    if (playShell?.topDialog()) {
      const directionIndex = buttons.slice(0, 4).findIndex((pressed, i) => pressed && !previous[i]);
      const command = {
        direction: directionIndex < 0 ? null : ['up', 'right', 'down', 'left'][directionIndex],
        confirm: !!buttons[5] && !previous[5],
        back: !!buttons[6] && !previous[6],
        menu: !!buttons[4] && !previous[4],
      };
      if (command.direction || command.back || command.menu)
        transition.cancel('controller-navigation');
      if (!snakeGlobalTools.handleFrameCommand(command)) menuController?.handle(command);
      continue;
    }
    if (buttons[4] && !previous[4]) {
      if (ready || paused) start();
      else pause();
    }
    if (result() && buttons[5] && !previous[5]) {
      if (result() === 'won' && nextMission()) launchNext();
      else prepare({ launch: true });
    }
    for (let i = 0; i < 4; i++)
      if (buttons[i] && !previous[i]) {
        turn(seat, ['up', 'right', 'down', 'left'][i]);
        break;
      }
  }
  for (const id of gamepadState.keys())
    if (!present.has(id)) {
      gamepadState.delete(id);
      gamepadSeats.delete(id);
      pause();
    }
}
doc
  .querySelectorAll('#snake-settings details, #snake-help details, #snake-workshop details')
  .forEach((details) =>
    details.addEventListener('toggle', () => {
      if (details.open) pause();
    }),
  );
doc.addEventListener('visibilitychange', () => {
  if (doc.hidden) pause();
});
globalThis.addEventListener('blur', pause);
globalThis.addEventListener('focus', () => {
  void records.read().then(() => ratings.refresh());
});
globalThis.screen.orientation?.addEventListener('change', () => {
  pause();
  footprint?.refresh();
});
// A resized window can change the touch layout without a device orientation event.
const landscapeControls = globalThis.matchMedia?.(
  '(max-height: 600px) and (orientation: landscape)',
);
landscapeControls?.addEventListener('change', () => {
  pause();
  footprint?.refresh();
});
globalThis.addEventListener('pagehide', () => {
  importEpoch++;
  writerEpoch++;
  snakeModeChoices?.closeSimulator();
  pause();
  sound.suspend();
  classicAudio.reset();
  save();
  const departingWriter = sessionWriter;
  writerRelease = enemyStats.flush().finally(() => departingWriter.release());
});
globalThis.addEventListener('pageshow', async (event) => {
  footprint?.refresh();
  if (!event.persisted) return;
  const ticket = ++writerEpoch;
  await writerRelease;
  const recovered = await claimProfileWriter(globalThis.navigator.locks, `${SAVE_KEY}:writer`);
  if (ticket !== writerEpoch) {
    recovered.release();
    return;
  }
  sessionWriter = recovered;
  // A different tab may have advanced the saved attempt while this document
  // was frozen. Retain this board's counts, but isolate its future live events.
  if (statsAttempt) {
    const saved = forkEnemyStatsSession(enemyStats.session(statsAttempt));
    enemyStats.finishAttempt(statsAttempt);
    statsAttempt = enemyStats.beginAttempt({
      gameType: 'snake',
      provenance: liveProvenance === 'import' ? 'import' : 'continue',
      saved,
    });
    save();
    refresh();
  }
  void enemyStats.flush();
  void ratings?.refresh();
});
function frame(now) {
  const elapsed = previousFrame === null ? 0 : Math.max(0, now - previousFrame);
  previousFrame = now;
  pollGamepads();
  if (!ready && !paused && !result()) {
    if (elapsed > 1000 || !pageActive()) pause();
    else {
      const before = runs.map((run) => run.catches + (run.bonusCatches ?? 0));
      // Seed the presentation projection before movement, so the first catch and
      // restored attempts have an exact observation boundary.
      runs.forEach((run, i) =>
        classicAudio.update(run, {
          active: true,
          mode,
          board: `snake-${i}`,
          placement: boardPlacement(boards[i]?.canvas),
        }),
      );
      advanceClassicSnakeMatchTo(match, match.elapsedMs + Math.min(250, elapsed), {
        onStep: observeStep,
      });
      runs.forEach((run, i) =>
        classicAudio.update(run, {
          active: true,
          mode,
          board: `snake-${i}`,
          placement: boardPlacement(boards[i]?.canvas),
        }),
      );
      runs.forEach((run, i) => {
        if (run.catches + (run.bonusCatches ?? 0) > before[i]) {
          const delta = run.catches + (run.bonusCatches ?? 0) - before[i];
          reactions.events(
            (run.recentCatches ?? []).slice(-delta).map((mark) => ({
              type: 'actor.caught',
              id: mark.id,
              actorFamily: mark.kind ?? 'lookout',
              tick: mark.tick,
              player: mark.playerId,
            })),
            { mode, board: i, danger: run.status === 'lost' },
          );
        }
      });
      if (result()) {
        finish();
      }
      refresh();
    }
  }
  const transitionElapsed = transitionJustStarted ? 0 : elapsed;
  transitionJustStarted = false;
  transition.advance(transitionElapsed);
  const flow = transition.snapshot();
  if (playShell && playShell.elements.root.dataset.transitionPhase !== flow.phase) {
    playShell.elements.root.dataset.transitionPhase = flow.phase;
    refresh();
  }
  if (result() && ['countdown', 'cancelled'].includes(flow.phase) && !playShell?.topDialog())
    showResults();
  if (celebration)
    celebration = advanceCelebration(celebration, Math.min(transitionElapsed, 250) / 1000, {
      reduced: isReduced(),
      paused: flow.phase !== 'celebration',
    });
  transitionControls?.refresh();
  runs.forEach((run, i) => {
    const choice = destruction.snapshot();
    flightFrames[i] = advanceClassicFlight(
      flightFrames[i],
      elapsed,
      !ready && !paused && !result() && !doc.hidden && run.status === 'running',
      isReduced(),
    );
    effects[i].advance(
      { valid: true, eliminations: classicCatchMarks(run) },
      Math.min(0.1, elapsed / 1000),
      {
        key: run,
        ...choice,
        paused: ready || (paused && !result()),
        reduced: isReduced(),
        sources: run.snakes.map((snake) => ({
          ...snake.body[0],
          id: snake.id,
          direction: snake.direction,
        })),
      },
    );
    const shown =
      flow.phase === 'replay'
        ? (recentReplay.frame(i, flow.replayMs - flow.remainingMs) ?? run)
        : run;
    drawClassicBoard(boards[i].canvas, shown, {
      locale,
      effects: flow.phase === 'replay' ? null : effects[i],
      ...choice,
      showRemains: remains.snapshot().showRemains,
      style,
      boardStyle,
      cast: currentCast(),
      presentation: presentation.snapshot(),
      accent,
      reduced: isReduced(),
      flight: flightFrames[i],
      cssWidth: footprint?.width(i),
      pixelRatio: globalThis.devicePixelRatio ?? 1,
    });
    const canvas = boards[i].canvas,
      ctx = canvas.getContext('2d');
    if (ctx?.save && ctx?.setTransform) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (flow.phase === 'loss-effect') {
        const signal = signalReception[i].advance(run, Math.min(elapsed, 250) / 1000, {
          mode: 'lost',
          reduced: isReduced(),
        });
        signalReception[i].draw(ctx, canvas.width, canvas.height, signal);
      }
      if (flow.phase === 'celebration' && celebration && result() !== 'lost')
        drawCelebration(
          ctx,
          celebrationFrame(celebration),
          { accent: '#edbd55', safe: '#a8cf8d', paper: '#f4f1dc', danger: '#e17874' },
          canvas.width,
          canvas.height,
        );
      ctx.restore();
    }
  });
  if (resultPreview && playShell?.topDialog()?.dataset.modeSurface === 'results') {
    const playback = resultPlayback?.owner === match ? resultPlayback : null;
    if (playback?.playing && pageActive())
      playback.time = (playback.time + Math.min(elapsed, 250)) % (playback.duration + 720);
    const frames = playback?.frames[0];
    const shown = frames?.[Math.min(frames.length - 1, Math.floor(playback.time / 240))] ?? runs[0];
    drawClassicBoard(resultPreview, shown, {
      locale,
      presentation: presentation.snapshot(),
      style,
      boardStyle,
      cast: currentCast(),
      reduced: true,
      cssWidth: 360,
      pixelRatio: globalThis.devicePixelRatio ?? 1,
    });
  }
  globalThis.requestAnimationFrame(frame);
}
prepare();
void records.read().then(() => ratings.refresh());
$('boot-status').hidden = true;
$('snake-shell').hidden = false;
playShell = mountModePlayShell({
  document: doc,
  mount: $('snake-shell'),
  idPrefix: 'snake',
  modeName: { en: CLASSIC_COPY.en.title, uk: CLASSIC_COPY.uk.title },
  locale,
  wordmarkURL: new URL('../ui/art/identity/fpv-line/wordmark.png', import.meta.url).href,
  slots: Object.fromEntries(
    ['missions', 'briefing', 'settings', 'expert', 'help', 'workshop', 'results']
      .map((key) => [key, $(`snake-${key}`)])
      .concat([
        ['play', $('game')],
        ['modes', $('snake-mode-links')],
      ]),
  ),
  services: {
    attachModalNavigation,
    attachFullscreen,
    setMenuIcon,
    attachMenuScene,
    settingsPanelBack,
  },
  actions: {
    resultFocus: () => (!$('next').hidden ? $('next') : playShell?.elements.buttons.retry),
    pause: () => pause({ showMenu: false }),
    start,
    resume: start,
    retry: () => prepare({ launch: true }),
    skip: () => $('next').click(),
    random: launchRandom,
    canResume: () => !result() && (!ready || (offerSavedContinue && !!savedRound)),
    continue: () => {
      if (!ready && !result()) start();
      else if (
        offerSavedContinue &&
        savedRound &&
        restore(savedRound, { provenance: 'continue' })
      ) {
        if (!result()) start();
      } else start();
    },
    toggleSound: () => {
      const muted = !audioMaster.snapshot().muted;
      audioPreferences.setMuted(muted);
      if (!muted) void sound.enable();
      refresh();
    },
  },
  initial: params.has('level') || communityIdentity ? 'play' : 'home',
  onSurfaceChange: (surface) => {
    if (surface === 'results' && result()) beginResultPlayback();
    if (!['play', 'results'].includes(surface)) {
      transition.cancel(surface);
      importEpoch++;
      if (resultPlayback) resultPlayback.playing = false;
    }
  },
  focusPlay: () => boards[0]?.canvas.focus({ preventScroll: true }),
});
const snakeSettingsSections = [...$('snake-settings').children].filter(
  (node) => node.tagName === 'DETAILS',
);
snakeSettingsView = mountModeSettings({
  root: playShell.elements.dialogs.settings,
  content: playShell.elements.content.settings,
  prefix: 'snake-menu-settings',
  locale,
  setMenuIcon,
  attachPanels: attachSettingsPanels,
  groups: {
    gameplay: [playShell.elements.buttons.expert, playShell.elements.buttons['home-retry']],
    controls: [$('steering').closest('label')],
    audio: [snakeSettingsSections[1]],
    display: [$('language').closest('label'), snakeSettingsSections[0]],
    accessibility: [snakeSettingsSections[2]],
    data: [$('snake-workshop').querySelector('details')],
    content: [playShell.elements.buttons.workshop],
    extras: [
      playShell.elements.buttons.help,
      $('snake-workshop').querySelector('.game-mode-destinations'),
    ],
  },
});
attachThemeFamilyControls({
  document: doc,
  root: snakeSettingsView.panels.display,
  host: presentation.theme,
  prefix: 'snake-',
});
const displayBinding = (key) => ({
  get: () => display.snapshot()[key],
  set: (value) => display.set({ [key]: value }),
  subscribe: (listener) => display.subscribe(listener),
});
snakeGlobalSettings = mountGlobalSettings({
  document: doc,
  root: playShell.elements.dialogs.settings,
  panels: snakeSettingsView.panels,
  prefix: 'snake-global',
  locale,
  controls: {
    language: $('language').closest('label'),
    appearance: snakeSettingsView.panels.display.querySelector('[data-theme-controls]'),
    reducedEffects: $('reduced').closest('label'),
    masterMuted: $('muted').closest('label'),
    masterVolume: $('volume').closest('label'),
  },
  bindings: {
    ...continuousPlayBindings(continuousPreferences),
    textFace: displayBinding('textFace'),
    textSize: displayBinding('textSize'),
    menuAnimation: {
      get: () => getMenuAnimation(globalThis),
      set: (value) => setMenuAnimation(value, globalThis),
      subscribe: (listener) => subscribeMenuAnimation(listener, globalThis),
    },
  },
});
const snakeTouchSettings = el('section');
const touchFields = [];
for (const [key, en, uk, choices] of [
  [
    'side',
    'Steering hand',
    'Рука керування',
    [
      ['right', 'Right', 'Права'],
      ['left', 'Left', 'Ліва'],
    ],
  ],
  [
    'size',
    'Touch control size',
    'Розмір сенсорного керування',
    [
      ['regular', 'Regular', 'Звичайний'],
      ['large', 'Large', 'Великий'],
    ],
  ],
  ['opacity', 'Touch control opacity', 'Прозорість сенсорного керування'],
]) {
  const row = el('label'),
    caption = el('span'),
    input = el(choices ? 'select' : 'input');
  input.id = `snake-global-touch-${key}`;
  row.append(caption, input);
  if (!choices) {
    input.type = 'range';
    input.min = '0.2';
    input.max = '1';
    input.step = '0.05';
  }
  input.addEventListener('change', () =>
    touch.set({ ...touch.snapshot(), [key]: choices ? input.value : Number(input.value) }),
  );
  snakeTouchSettings.append(row);
  touchFields.push({ key, en, uk, choices, caption, input });
}
touchPresentationControls = {
  refresh() {
    for (const field of touchFields) {
      field.caption.textContent = locale === 'uk' ? field.uk : field.en;
      if (field.choices)
        options(
          field.input,
          field.choices.map(([key, en, uk]) => [key, locale === 'uk' ? uk : en]),
          touch.snapshot()[field.key],
        );
      else field.input.value = String(touch.snapshot()[field.key]);
    }
  },
};
touchPresentationControls.refresh();
const snakeAudioCues = el('section');
attachMenuAudioSettings(sound, doc, {
  target: snakeAudioCues,
  window: globalThis,
  getStorage: () => globalThis.localStorage,
  idPrefix: 'snake-global',
});
const snakeGlobalTools = mountGlobalSettingsTools({
  document: doc,
  window: globalThis,
  settingsRoot: playShell.elements.dialogs.settings,
  panels: snakeSettingsView.panels,
  prefix: 'snake-global-tools',
  onOpen: pause,
  coreURL: new URL('../', globalThis.location.href),
});
snakeGlobalSettings.update({
  controls: {
    audioCues: snakeAudioCues,
    touchPresentation: snakeTouchSettings,
    ...snakeGlobalTools.controls,
  },
});
$('snake-settings').hidden = true;
menuController = attachControllerNavigation({
  document: doc,
  keyboard: true,
  ownsKeyboardEvent: (event) => settingsTabOwnsKey(event, playShell?.topDialog()),
  getScope: () => (snakeGlobalTools.root() || playShell?.topDialog() ? 'ui' : 'flight'),
  getRoot: () =>
    snakeGlobalTools.frameFocused()
      ? null
      : (snakeGlobalTools.root() ?? playShell?.topDialog() ?? $('snake-shell')),
  getDefaultFocus: () =>
    (snakeGlobalTools.root() ?? playShell?.topDialog())?.querySelector(
      'button:not(:disabled),a[href]',
    ),
  onBack: () =>
    snakeGlobalTools.back() ||
    (snakeModeChoices?.simulatorRoot() ? snakeModeChoices.closeSimulator() : playShell.back()),
  onMenu: () =>
    snakeGlobalTools.back() ||
    (snakeModeChoices?.simulatorRoot() ? snakeModeChoices.closeSimulator() : playShell.back()),
});
installTransitionControls();
refresh();
footprint.refresh();
if (params.has('level') || communityIdentity) start();
globalThis.RevealLineToolLaunch?.attached?.();
globalThis.requestAnimationFrame(frame);
