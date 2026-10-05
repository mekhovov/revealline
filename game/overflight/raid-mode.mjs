import {
  DEFAULT_OVERFLIGHT_HUNT_PROJECT,
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from './raid-project.mjs';
import {
  createOverflightHuntLibrary,
  createOverflightHuntPackage,
  exportOverflightHuntPackage,
} from './raid-community.mjs';
import {
  createOverflightHuntRun,
  startOverflightHunt,
  stepOverflightHunt,
  pauseOverflightHunt,
  resumeOverflightHunt,
  chooseOverflightHuntUpgrade,
  rerollOverflightHuntUpgrades,
  overflightHuntSummary,
  overflightHuntFixtureInput,
} from './raid-core.mjs';
import { overflightHuntBuildItems } from './raid-upgrades.mjs';
import { createOverflightHuntUpgradeCard } from './raid-upgrade-card.mjs';
import { overflightHuntText } from './raid-copy.mjs';
import { createOverflightHuntRecords } from './raid-records.mjs';
import { createOverflightHuntReviewPilot } from './raid-review-pilot.mjs';

const recordOwners = new WeakMap();
const announcedHUD = new WeakMap();
let currentResultRun = null;
const reviewPilots = new WeakMap();
function reviewPilot(run, build = 'pursuer') {
  if (!reviewPilots.has(run))
    reviewPilots.set(
      run,
      createOverflightHuntReviewPilot({
        route: build === 'objectives' ? 'objectives' : 'packs',
        build: build === 'objectives' ? 'pursuer' : build,
      }),
    );
  return reviewPilots.get(run);
}

export function overflightHuntPreviewRequest(event, { window, parent, origin }) {
  if (
    window === parent ||
    event.source !== parent ||
    event.origin !== origin ||
    event.data?.type !== 'overflight-hunt:preview' ||
    event.data.version !== 1
  )
    return null;
  const { requestId } = event.data;
  if (requestId !== undefined && (!Number.isSafeInteger(requestId) || requestId < 1)) return null;
  return event.data;
}

export function updateOverflightHuntHUD({ run, compiled, document, text, local }) {
  const $ = (id) => document.getElementById(id);
  const hunt = run.hunt;
  const sector = compiled.encounters[hunt.sector];
  $('hud-objective').textContent =
    `${text('sector')} ${hunt.sector + 1} · ${local(sector?.title)} · ${text('objectives')} ${hunt.objectivesCompleted}/${hunt.objectives.length}`;
  $('hud-chain').textContent =
    `${text('chain')} ${hunt.chain} · ×${hunt.multiplier}${hunt.chain ? ` · ${hunt.chainRemaining.toFixed(1)}s` : ''}`;
  $('hud-chain').dataset.active = String(hunt.chain > 0);
  $('hud-score').textContent =
    `${text('score')} ${Math.floor(hunt.score).toLocaleString(document.documentElement.lang)}`;
  const active = hunt.rushRemaining > 0;
  const ready = hunt.rushCharge >= 20;
  $('hud-rush').textContent = active
    ? `${text('rushActive')} ${hunt.rushRemaining.toFixed(1)}s`
    : ready
      ? text('rushReady')
      : `${text('rush')} ${hunt.rushCharge}/20`;
  const meter = $('raid-rush-meter');
  meter.dataset.ready = String(ready || active);
  meter.setAttribute('aria-label', text('rush'));
  meter.setAttribute('aria-valuemin', '0');
  meter.setAttribute('aria-valuemax', active ? '5' : '20');
  meter.setAttribute(
    'aria-valuenow',
    String(active ? Number(hunt.rushRemaining.toFixed(2)) : hunt.rushCharge),
  );
  meter.setAttribute('aria-valuetext', $('hud-rush').textContent);
  $('raid-rush-fill').style.width =
    `${active ? (hunt.rushRemaining / 5) * 100 : hunt.rushCharge * 5}%`;
  $('xp-fill').style.width =
    `${(hunt.objectivesCompleted / Math.max(1, hunt.objectives.length)) * 100}%`;
  // Announce milestones only; the ten-Hz score/timer updates must never flood
  // assistive technology. The complete instruments remain available to inspect.
  const milestone = { sector: hunt.sector, objectives: hunt.objectivesCompleted, ready, active };
  const previous = announcedHUD.get(run),
    status = $('raid-event-status');
  if (previous && status && run.phase === 'playing') {
    const messages = [];
    if (previous.sector !== milestone.sector || previous.objectives !== milestone.objectives)
      messages.push($('hud-objective').textContent);
    if ((ready && !previous.ready) || (active && !previous.active))
      messages.push($('hud-rush').textContent);
    if (messages.length) status.textContent = messages.join('. ');
  }
  announcedHUD.set(run, milestone);
}

export function renderOverflightHuntResults({
  run,
  document,
  text,
  local,
  formatTime,
  moduleIcon,
  records,
}) {
  const $ = (id) => document.getElementById(id);
  const make = (tag, content = '', className = '') => {
    const element = document.createElement(tag);
    element.textContent = content;
    element.className = className;
    return element;
  };
  const hunt = run.hunt,
    won = run.phase === 'won';
  $('overflight-results').dataset.outcome = won ? 'won' : 'lost';
  $('result-title').textContent = text(won ? 'won' : 'lost');
  $('result-kicker').textContent = text(won ? 'victoryKicker' : 'lossKicker');
  $('result-message').textContent = text(won ? 'victoryMessage' : 'lossMessage');
  $('result-stats').replaceChildren();
  for (const [key, value] of [
    ['elapsed', formatTime(run.time)],
    ['score', hunt.score],
    ['kills', run.stats.kills],
    ['bestChain', hunt.bestChain],
    ['damageTaken', run.stats.damageTaken],
    ['couriersCaught', hunt.couriersCaught],
    ['couriersEscaped', hunt.couriersEscaped],
    ['armorHits', hunt.armorHits],
  ]) {
    const stat = make('div', '', 'overflight-result-stat');
    stat.append(
      make('dt', text(key)),
      make(
        'dd',
        typeof value === 'number' ? value.toLocaleString(document.documentElement.lang) : value,
      ),
    );
    $('result-stats').append(stat);
  }
  $('result-milestones').replaceChildren();
  for (const [accepted, label] of [
    [won, 'finalCleared'],
    [won && run.stats.damageTaken === 0, 'cleanRaid'],
    [won && !run.stats.airframesLost, 'intactSortie'],
  ])
    if (accepted) $('result-milestones').append(make('span', `✓ ${text(label)}`));
  $('result-build').replaceChildren();
  for (const item of overflightHuntBuildItems(run.build)) {
    const badge = make('div', '', 'overflight-result-module');
    badge.append(
      moduleIcon(item.id),
      make('strong', local(item.title)),
      make('span', `${text('level')} ${item.rank}`),
    );
    $('result-build').append(badge);
  }
  currentResultRun = run;
  if (run.review || run.fixture) {
    $('raid-records').textContent = text('automatedReview');
    return;
  }
  if (!recordOwners.has(run)) {
    $('overflight-results').classList.remove('result-reveal');
    document.defaultView?.requestAnimationFrame(() =>
      $('overflight-results').classList.add('result-reveal'),
    );
    recordOwners.set(run, records.record(run));
  }
  void recordOwners.get(run).then((record) => {
    if (currentResultRun !== run) return;
    $('raid-records').textContent = [
      text(record.durable ? 'savedRecords' : 'sessionRecords'),
      record.fastestClear
        ? `${text('fastestClear')} ${formatTime(record.fastestClear.time)}`
        : null,
      record.bestScore ? `${text('highestScore')} ${record.bestScore.score}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  });
}

export const OVERFLIGHT_HUNT_MODE = Object.freeze({
  id: 'overflight-hunt',
  fixtures: ['raid-reference'],
  fixtureInput: overflightHuntFixtureInput,
  name: { en: 'Overflight: Raid', uk: 'Проліт: Наліт' },
  defaultProject: DEFAULT_OVERFLIGHT_HUNT_PROJECT,
  compileProject: compileOverflightHuntProject,
  createProject: createOverflightHuntProject,
  createLibrary: createOverflightHuntLibrary,
  createPackage: createOverflightHuntPackage,
  exportPackage: exportOverflightHuntPackage,
  text: overflightHuntText,
  createRun: createOverflightHuntRun,
  start: startOverflightHunt,
  step: stepOverflightHunt,
  pause: pauseOverflightHunt,
  resume: resumeOverflightHunt,
  choose: chooseOverflightHuntUpgrade,
  reroll: rerollOverflightHuntUpgrades,
  summary: overflightHuntSummary,
  buildItems: overflightHuntBuildItems,
  createCard: createOverflightHuntUpgradeCard,
  createRecords: createOverflightHuntRecords,
  resetPresentation() {
    currentResultRun = null;
  },
  updateHUD: updateOverflightHuntHUD,
  renderResults: renderOverflightHuntResults,
  encounterSets: ['patrol', 'crossing', 'mixed'],
  studioPath: '../studio/raid.html',
  previewRequest: overflightHuntPreviewRequest,
  reviewBuilds: { sweeper: true, pursuer: true, breaker: true, objectives: true },
  pilot: (run, build) => reviewPilot(run, build).input(run),
  selectCard: (run, build) => reviewPilot(run, build).choose(run),
  moduleIcons: {
    'strike-width': 'side-burst',
    'slow-wake': 'slow-field',
    'rush-charge': 'proximity-pulse',
    'boost-cooldown': 'primary',
    'boost-duration': 'primary',
    'chain-window': 'scanner',
    'heavy-exposure': 'scanner',
    'guard-interrupt': 'side-burst',
    'recovery-shield': 'shield',
  },
  installActions({ document, prepare, getSeed }) {
    document.getElementById('raid-same-seed').addEventListener('click', () => {
      void prepare({ launch: true }).catch(() => {});
    });
    document.getElementById('raid-new-sortie').addEventListener('click', () => {
      const bytes = new Uint32Array(1);
      globalThis.crypto.getRandomValues(bytes);
      const nextSeed = bytes[0] && bytes[0] !== getSeed() ? bytes[0] : (getSeed() + 1) >>> 0 || 1;
      void prepare({ nextSeed, launch: true }).catch(() => {});
    });
  },
});
