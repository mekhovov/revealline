import { localizedText } from '../../game/i18n/index.mjs';
import { t, localizedOption } from '../../game/i18n/index.mjs';
globalThis.RevealLineToolLaunch?.attached();
import { createOperationStatus } from '../../game/ui/operation-status.mjs';
// Original review mockups only. This module never imports the game or writes player storage.
const $ = (selector) => document.querySelector(selector);

const drone = `<svg class="drone-svg" viewBox="0 0 220 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" shape-rendering="crispEdges">
  <path fill="#111a21" d="M31 18h36v9h14v32h-9v12H39V59H24V32h7zm122 0h36v14h7v27h-15v12h-32V59h-9V27h13zM31 89h36v12h14v32H67v9H31v-14h-7v-27h7zm122 0h36v12h7v27h-7v14h-36v-9h-13v-32h13z"/>
  <path fill="#536871" d="M39 25h27v7h7v23H62v8H39v-8H31V32h8zm115 0h27v7h8v23h-8v8h-23v-8h-11V32h7zM39 97h23v8h11v23h-7v7H39v-7h-8v-23h8zm119 0h23v8h8v23h-8v7h-27v-7h-7v-23h11z"/>
  <path fill="#23323b" d="M38 34h19v-8h9v19h-9v12h-9V45H38zm118 0h19v-8h9v19h-9v12h-9V45h-10zM38 107h19v-8h9v19h-9v12h-9v-12H38zm118 0h19v-8h9v19h-9v12h-9v-12h-10z"/>
  <path fill="#6d858c" d="m62 50 10-9 38 33 38-33 10 9-38 31 38 30-10 9-38-31-38 31-10-9 38-30z"/>
  <path fill="#22313a" d="M88 51h44v59H88z"/>
  <path fill="#9caeaa" d="M92 54h36v7H92zm0 49h36v5H92z"/>
  <path fill="#10191f" d="M98 62h24v38H98z"/>
  <path fill="#f4bf62" d="M99 72h22v14H99z"/>
  <path fill="#967849" d="M99 86h22v8H99z"/>
  <path fill="#78dce8" d="M103 43h14v9h-14z"/>
  <path fill="#070b12" d="M106 45h8v5h-8z"/>
  <path fill="#9caeaa" d="M108 110h4v21h-4z"/>
  <path fill="#78dce8" d="M104 128h12v5h-12z"/>
</svg>`;

document.querySelectorAll('[data-drone]').forEach((element) => {
  element.innerHTML = drone;
});

const commands = (back = 'title') =>
  `<div class="mock-command"><button type="button" data-screen="${back}">← Back</button><span class="desktop-hints"><kbd>↑↓</kbd> Move <kbd>Enter</kbd> Choose</span><span>LAYOUT STUDY</span></div>`;
const top = (title, detail = t('tools:fpvFirstLight')) =>
  `<div class="mock-topline"><strong>${title}</strong><span>${detail}</span></div>`;
const action = (label, screen, primary = false) =>
  `<button type="button" class="action${primary ? ' primary' : ''}" data-screen="${screen}">${label}</button>`;

const missionNames = [
  t('tools:firstLight'),
  t('tools:riverCrossing'),
  t('tools:openField'),
  t('tools:quietWoodland'),
  t('tools:relayDistrict'),
  t('tools:homeward'),
];
function missionCards(count = 6, unknown = false) {
  return `<div class="mission-grid">${missionNames
    .slice(0, count)
    .map((name, i) => {
      const mystery = unknown && i > 0;
      return `<article class="mission-card${i === 0 ? ' selected' : ''}"><div class="mission-art terrain-${i}${mystery ? ' unknown' : ''}"><span class="mission-number">0${i + 1}</span>${mystery ? '<span class="unknown-mark">?</span>' : ''}<span class="medals" aria-label="${i === 0 ? t('tools:three') : t('tools:one')} of three illustrative medals">${mystery ? '☆☆☆' : i === 0 ? '★★★' : '★☆☆'}</span></div><div class="mission-label"><span>${name}</span><span>${mystery ? t('tools:unrevealed') : i === 0 ? '11,450' : '2,380'}</span></div></article>`;
    })
    .join('')}</div>`;
}

function titleScreen(state) {
  const first = state === 'first-visit';
  return `<div class="mock-screen">${top('REVEALLINE', t('tools:soloFieldKit'))}
    <div class="mock-title-content"><div><p class="mock-logo">REVEAL<br /><span>LINE</span></p><p class="mock-subtitle">MAKE A PATH. REVEAL A WORLD.</p>
    <div class="mock-menu"><button type="button" class="menu-focus" data-screen="${first ? 'missions' : 'briefing'}">${first ? t('common:actions.deploy') : t('common:actions.continue')}</button><button type="button" data-screen="missions">Missions</button><button type="button" data-screen="collection">Collection</button><button type="button" data-screen="settings">Settings</button><button type="button" data-screen="workshop">Workshop</button></div>
    <p class="menu-destination">${first ? t('tools:yourFirstRouteIsWaiting') : t('tools:firstLightRiverCrossingScout')}</p></div><div class="title-art">${drone}</div></div>
    <div class="mock-command"><span>Original FPV world</span><span class="desktop-hints"><kbd>↑↓</kbd> Move <kbd>Enter</kbd> Choose</span><span>PROPOSED TITLE</span></div></div>`;
}

function missionsScreen(state) {
  const mystery = state === 'unrevealed';
  return `<div class="mock-screen">${top(t('tools:missions'), t('tools:collection08Stars'))}
    <div class="mock-gallery-head"><div><h3>First Light</h3><p>Six routes into a new day · 01–06 of 12</p></div><div class="pack-tabs" aria-label="Illustrative pack tabs"><span>First Light</span><span>More worlds</span></div></div>
    ${missionCards(6, mystery)}
    <div class="mission-choice"><div><strong>01 / First light</strong><p>Scout · Standard <span aria-hidden="true">/</span> ${mystery ? t('tools:artworkRevealsThroughPlay') : t('tools:threeMedalsEarned')}</p></div><div class="mock-actions">${action(t('tools:preview'), 'collection')}${action(t('common:actions.deployArrow'), 'briefing', true)}</div></div>${commands()}</div>`;
}

function briefingScreen(state) {
  const gentle = state === 'gentle';
  return `<div class="mock-screen">${top(t('tools:missionBrief01'), t('tools:firstLight2'))}<h3>Choose your route.</h3>
    <div class="brief-grid"><div class="mission-art terrain-0 brief-art"><span class="mission-number">FIRST LIGHT / ORIGINAL LAYOUT STUDY</span></div><dl class="brief-conditions"><div><dt>Craft</dt><dd>Scout / change</dd></div><div><dt>Difficulty</dt><dd>${gentle ? t('tools:gentle') : t('tools:standard')} / change</dd></div><div><dt>Coverage target</dt><dd>80%</dd></div><div><dt>Medal opportunity</dt><dd>Finish in 60 seconds</dd></div></dl></div>
    <p class="mock-description">Reconnect your unfinished line to claim the enclosed ground. Keep an eye on moving threats as the frontier changes.</p>
    <div class="mock-actions">${action(t('common:actions.deployArrow'), 'flight', true)}${action(t('tools:fieldGuide'), 'settings')}</div><p class="small-note">Proposed preparation screen. Retry reuses your setup without reopening this step.</p>${commands('missions')}</div>`;
}

function arenaMarkup(state) {
  const message =
    state === 'life-loss'
      ? '<div class="arena-message"><strong>LINK LOST</strong><p>Your unfinished line is gone.<br />Previously claimed ground remains.</p></div>'
      : state === 'warning'
        ? '<div class="arena-message"><strong>LINE EXPOSED</strong><p>Choose your next turn.</p></div>'
        : '';
  return `<div class="arena-mock" aria-label="Illustrative arena: amber player, cyan live route, patterned terrain and coral threats"><div class="revealed-land"></div><div class="frontier"></div><div class="live-route"></div><div class="terrain-wall"></div><div class="terrain-slow"></div><div class="terrain-danger"></div><span class="threat one"></span><span class="threat two"></span><span class="threat three"></span><div class="arena-craft">${drone}</div>${message}</div>`;
}

function flightScreen(state, paused = false) {
  if (paused)
    return `<div class="mock-screen"><div class="pause-overlay"><p class="eyebrow">FIRST LIGHT / SCOUT</p><h3>Flight paused</h3><div class="mock-menu"><button type="button" class="menu-focus" data-screen="flight">Resume</button><button type="button" data-screen="flight">Retry mission</button><button type="button" data-screen="settings">Settings</button><button type="button" data-screen="missions">Missions</button></div><p class="small-note">Opaque cover. Resume is the primary action.</p></div></div>`;
  return `<div class="mock-screen mock-flight"><div class="flight-hud"><div class="hud-item"><span>SCOUT / LIVES</span><strong>${state === 'life-loss' ? '02' : '03'}</strong></div><div class="hud-item hud-coverage"><span>COVERAGE / TARGET</span><strong>56 / 80</strong><div class="coverage-track"><span></span></div></div><div class="hud-item"><span>SCORE</span><strong>2,380</strong></div><div class="hud-item"><span>MEDAL TIME</span><strong>00:42</strong></div></div>
    ${arenaMarkup(state)}<div class="flight-bottom"><span class="flight-state">${state === 'life-loss' ? t('tools:returningToFrontier') : t('tools:liveLineFindATurn')}</span><span class="flight-ability">PULSE / READY</span></div>
    <div class="touch-controls" aria-label="Illustrative touch layout; controls are not connected"><div class="touch-dpad" aria-hidden="true"><span>↑</span><span>←</span><span>↓</span><span>→</span></div><span class="touch-action">PULSE</span></div>
    <div class="mock-command"><button type="button" data-screen="pause">Ⅱ Pause</button><span class="desktop-hints">Critical paths stay above artwork</span><span>NO LIVE SIMULATION</span></div>
    ${paused ? `<div class="pause-overlay"><p class="eyebrow">FIRST LIGHT / SCOUT</p><h3>Flight paused</h3><div class="mock-menu"><button type="button" class="menu-focus" data-screen="flight">Resume</button><button type="button" data-screen="flight">Retry mission</button><button type="button" data-screen="settings">Settings</button><button type="button" data-screen="missions">Missions</button></div><p class="small-note">Focus returns to Resume.</p></div>` : ''}</div>`;
}

function resultsScreen(state) {
  const failed = state === 'defeat';
  return `<div class="mock-screen">${top(t('tools:mission01'), t('tools:firstLight2'))}
    <div class="results-content"><p class="eyebrow">${failed ? t('tools:retryTheRoute') : t('tools:worldRevealed')}</p><h3>${failed ? t('tools:signalLost') : t('tools:firstLightFound')}</h3>
    <div class="result-emblem${failed ? ' failure' : ''}" aria-hidden="true">${failed ? '×' : '★ ★ ★'}</div>
    ${failed ? '<p class="mock-description">A threat reached your unfinished line.<br />Try a shorter cut on your next flight.</p>' : '<div class="result-goals"><span><b>★</b>Mission complete</span><span><b>★</b>All lives saved</span><span><b>★</b>Within medal time</span></div><p class="result-score">11,450</p><p class="result-highscore">NEW HIGH SCORE</p>'}
    <div class="mock-actions">${action(failed ? t('tools:retry2') : t('tools:nextMission'), 'flight', true)}${action(failed ? t('tools:missions2') : t('common:actions.viewPicture'), failed ? 'missions' : 'collection')}${failed ? '' : action(t('common:actions.retry'), 'flight')}</div></div>${commands('missions')}</div>`;
}

function settingsScreen(state) {
  const large = state === 'large-text';
  return `<div class="mock-screen">${top(t('tools:settings'))}<h3>Make it yours.</h3><div class="settings-layout"><div class="settings-tabs" aria-label="Illustrative settings categories"><span class="selected">Display</span><span>Audio</span><span>Controls</span><span>Language</span><span>Saves</span></div><div class="settings-list"><div class="setting-row"><span>Text size<small>Comfortable at a glance</small></span><span class="setting-value">${large ? t('tools:large2') : t('tools:standard2')}</span></div><div class="setting-row"><span>Reduced effects</span><span class="setting-value">ON</span></div><div class="setting-row"><span>Background brightness</span><span class="mini-range" aria-hidden="true"></span></div><div class="setting-row"><span>High contrast paths</span><span class="setting-value">ON</span></div><div class="settings-preview"><strong style="font-size:${large ? '25' : '20'}px">56 / 80 · 00:42</strong>Live preview uses the same HUD type and colors. Full input behavior belongs to the game implementation.</div></div></div>${commands()}</div>`;
}

function collectionScreen(state) {
  const picture = state === 'picture';
  return `<div class="mock-screen">${top(t('tools:collection'), t('tools:firstLight03Of12'))}<h3>${picture ? t('tools:aWorldWorthFinding') : t('tools:yourRevealedWorlds')}</h3>${picture ? '<div class="mission-art terrain-0 brief-art" style="min-height:300px;margin-bottom:20px" aria-label="Original abstract field illustration"><span class="mission-number">ILLUSTRATIVE ART / NOT A PRODUCTION BACKGROUND</span></div>' : missionCards(6, true)}<p class="mock-description">${picture ? t('tools:aQuietPictureViewSeparateFromAchievedCoverageReturnTo') : t('tools:collectedArtworkEarnedMedalsAndMemorableRoutesUnrevealedImagesRemain')}</p><div class="mock-actions">${action(picture ? t('tools:returnToCollection') : t('common:actions.viewPicture'), 'collection', true)}${action(t('tools:replayMission'), 'briefing')}</div>${commands()}</div>`;
}

function workshopScreen(state) {
  const error = state === 'validation';
  return `<div class="mock-screen">${top(t('tools:workshopAssetStudio'), t('tools:localDraft'))}<h3>Every detail, in your hands.</h3><div class="workshop-layout"><div class="slot-nav"><span class="selected">Player</span><span>Threats</span><span>Terrain</span><span>Interface</span><span>Pictures</span><span>Audio</span></div><div class="slot-art">${drone}</div><div class="slot-meta"><span class="badge ${error ? 'proposed' : 'implemented'}">${error ? t('tools:draftNeedsReview') : t('tools:illustrativePreview')}</span><h4>FPV / scout body</h4><p>${error ? t('tools:thisDraftDoesNotMatchTheSelectedSlotResolveDimensions') : t('tools:inspectAtNativeSizeReplaceAnImageOrEditA')}</p><dl class="slot-contract"><dt>Role</dt><dd>Player body</dd><dt>Theme</dt><dd>FPV Field Kit</dd><dt>Bounds</dt><dd>From registry</dd><dt>Source</dt><dd>Original artwork</dd></dl><div class="mock-actions">${action(t('tools:previewInField'), 'flight')}${action(t('tools:assetBrief'), 'workshop', true)}</div></div></div><p class="mock-description">Single assets and coordinated collections share the same review flow. Applying a collection succeeds only when every required member is valid.</p>${commands()}</div>`;
}

const screens = {
  title: {
    label: t('tools:titleLanding'),
    states: [
      ['returning', t('tools:returningPlayer')],
      ['first-visit', t('tools:firstVisit')],
    ],
    render: titleScreen,
    purpose: t('tools:oneObviousFirstAction'),
    rule: t('tools:continueNamesTheSavedDestinationSupportingLinksStayInThe'),
  },
  missions: {
    label: t('tools:missionGallery'),
    states: [
      ['progress', t('tools:withProgress')],
      ['unrevealed', t('tools:unrevealedArtwork')],
    ],
    render: missionsScreen,
    purpose: t('tools:artworkMakesTheCampaignTangible'),
    rule: t('tools:threeColumnsOnDesktopTwoOnTabletOneOnPhone'),
  },
  briefing: {
    label: t('tools:missionPreparation'),
    states: [
      ['standard', t('tools:standard')],
      ['gentle', t('tools:gentle')],
    ],
    render: briefingScreen,
    purpose: t('tools:knowTheMissionBeforeCommitting'),
    rule: t('tools:showClassDifficultyAndActualObjectivesRetryPreservesTheSetup'),
  },
  flight: {
    label: t('tools:liveArena'),
    states: [
      ['running', t('tools:running')],
      ['warning', t('tools:exposedLineMessage')],
      ['life-loss', t('tools:lifeLost')],
    ],
    render: flightScreen,
    purpose: t('tools:thePlayerAndLiveRouteLead'),
    rule: t('tools:theGridAndSimulationStayFixedAcrossViewportChangesThis'),
  },
  pause: {
    label: t('tools:contextualPause'),
    states: [['paused', t('tools:paused')]],
    render: (state) => flightScreen(state, true),
    purpose: t('tools:keepThePlayerSPlace'),
    rule: t('tools:concealTheArenaArtworkAndActorsWithAnOpaquePause'),
  },
  results: {
    label: t('tools:resultsRetry'),
    states: [
      ['victory', t('tools:victory')],
      ['defeat', t('tools:defeat')],
    ],
    render: resultsScreen,
    purpose: t('tools:celebrateClearlyRecoverQuickly'),
    rule: t('tools:separateArtworkMedalsAndScoreMakeNextAndRetryDirectly'),
  },
  settings: {
    label: t('common:navigation.settings'),
    states: [
      ['standard', t('tools:standardText')],
      ['large-text', t('tools:largeTextSpecimen')],
    ],
    render: settingsScreen,
    purpose: t('tools:comfortBelongsInsideTheGame'),
    rule: t('tools:useTheSameFocusTextAndControlsPreviewRelevantChanges'),
  },
  collection: {
    label: t('tools:collectionPicture'),
    states: [
      ['gallery', t('tools:gallery')],
      ['picture', t('tools:pictureView')],
    ],
    render: collectionScreen,
    purpose: t('tools:letTheRevealedArtworkBreathe'),
    rule: t('tools:offerAQuietFullPictureViewAndAnExplicitReturn'),
  },
  workshop: {
    label: t('tools:assetStudioConcept'),
    states: [
      ['draft', t('tools:inspectASlot')],
      ['validation', t('tools:invalidReplacement')],
    ],
    render: workshopScreen,
    purpose: t('tools:aCompleteReplacementWorkflow'),
    rule: t('tools:thisIsAProposedLayoutOnlyTheFrameworkMustProvide'),
  },
};

let currentScreen = 'title';
let currentState = 'returning';

function renderScreen() {
  const screen = screens[currentScreen];
  $('#screen-preview').innerHTML = screen.render(currentState);
  $('#study-purpose').innerHTML =
    `<strong>${screen.purpose}</strong>${screen.label} / ${screen.states.find(([id]) => id === currentState)[1]}`;
  localizedText($('#study-rule'), () => screen.rule);
  localizedText($('#review-status'), () =>
    t('tools:studyShown', {
      value1: screen.label,
      value2: screen.states.find(([id]) => id === currentState)[1],
    }),
  );
}

function chooseScreen(name, state) {
  if (!Object.hasOwn(screens, name)) return;
  currentScreen = name;
  currentState = screens[name].states.some(([id]) => id === state)
    ? state
    : screens[name].states[0][0];
  $('#screen-select').value = name;
  $('#state-select').replaceChildren(
    ...screens[name].states.map(([value, label]) => localizedOption(() => label, value)),
  );
  $('#state-select').value = currentState;
  renderScreen();
}

$('#screen-select').replaceChildren(
  ...Object.entries(screens).map(([value, { label }]) => localizedOption(() => label, value)),
);
$('#screen-select').addEventListener('change', (event) => chooseScreen(event.target.value));
$('#state-select').addEventListener('change', (event) => {
  currentState = event.target.value;
  renderScreen();
});
$('#screen-preview').addEventListener('click', (event) => {
  const button = event.target.closest('[data-screen]');
  if (!button) return;
  if (button.textContent === 'Asset brief ↓') {
    $('.prompt-example').open = true;
    $('.prompt-example').scrollIntoView({ block: 'center' });
    $('#copy-prompt').focus({ preventScroll: true });
    return;
  }
  const picture = button.textContent.includes('picture') || button.textContent === 'Preview';
  chooseScreen(button.dataset.screen, picture ? 'picture' : undefined);
  $('#screen-select').focus({ preventScroll: true });
});

document.querySelectorAll('[data-viewport]').forEach((button) => {
  if (button.tagName !== 'BUTTON') return;
  button.addEventListener('click', () => {
    const view = button.dataset.viewport;
    $('#screen-stage').dataset.viewport = view;
    document
      .querySelectorAll('button[data-viewport]')
      .forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
    localizedText(
      $('#viewport-label'),
      () =>
        ({
          desktop: 'Fluid desktop / up to 1120 px',
          tablet: 'Tablet / up to 768 px',
          phone: 'Phone / up to 390 px',
          landscape: 'Short landscape / up to 740 × 370 px',
        })[view],
    );
    localizedText($('#review-status'), () =>
      t('tools:previewSelectedWidthIsLimitedByTheAvailableWindow', { value1: view }),
    );
  });
});

document.querySelectorAll('[data-language]').forEach((button) => {
  button.addEventListener('click', () => {
    const ukrainian = button.dataset.language === 'uk';
    document
      .querySelectorAll('[data-language]')
      .forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
    localizedText($('#display-specimen'), () =>
      ukrainian ? 'Обери свій маршрут.' : 'Find your next route.',
    );
    localizedText($('#ui-specimen'), () =>
      ukrainian
        ? 'Обери місію. Замкни лінію. Відкрий світ.'
        : 'Choose a mission. Close the line. Reveal the world.',
    );
    $('#display-specimen').lang = ukrainian ? 'uk' : 'en';
    $('#ui-specimen').lang = ukrainian ? 'uk' : 'en';
  });
});

const palette = [
  [t('tools:stage'), '#070B12'],
  [t('tools:panel'), '#101923'],
  [t('tools:text'), '#F3F0DB'],
  [t('tools:navigation'), '#78DCE8'],
  [t('tools:playerReward'), '#F4BF62'],
  [t('tools:threat'), '#F07879'],
  [t('tools:success'), '#9DBB7A'],
  [t('tools:secondary'), '#A5B2BB'],
];
$('#palette').innerHTML = palette
  .map(
    ([role, hex]) =>
      `<div class="swatch"><div class="swatch-color" style="background:${hex}"></div><strong>${role}</strong><code>${hex}</code></div>`,
  )
  .join('');

const inventory = [
  [
    'player',
    t('tools:launchLanding'),
    t('tools:firstVisitLoadingEnterResumeDestinationStartupError'),
    t('tools:oneTitleShellOnePrimaryActionRealLoadingFeedback'),
    t('tools:study'),
  ],
  [
    'player',
    t('tools:homeMenu'),
    t('tools:returningPlayerNoProgressKeyboardPointerAndControllerFocus'),
    t('tools:continueDeployMissionsCollectionSettingsWorkshopSecondary'),
    t('tools:study'),
  ],
  [
    'player',
    t('tools:missionsPackPicker'),
    t('tools:currentPackPaginationSelectedEarnedUnrevealedLockedEmpty'),
    t('tools:imageLedGalleryVisibleUnlockReasonRememberedSelection'),
    t('tools:study'),
  ],
  [
    'player',
    t('tools:missionBriefLoadout'),
    t('tools:classAbilityDifficultyObjectivesCompatibleNextMission'),
    t('tools:compactSetupSummaryOptionalDetailedPreparationDirectDeployment'),
    t('tools:study'),
  ],
  [
    'player',
    t('tools:firstFlightTutorial'),
    t('tools:beforeStartStepActiveSuccessRetrySkipAlreadyCompleted'),
    t('tools:teachOneActionInTheActualArenaOptionalHelpRemains'),
    t('tools:planned'),
  ],
  [
    'player',
    t('tools:arenaHud'),
    t('tools:readyCountdownSafeCuttingStationaryExposedLineWarning'),
    t('tools:stableCoverageLivesScoreTimerOrderClassSpecificAbilityState'),
    t('tools:study'),
  ],
  [
    'player',
    t('tools:arenaEvents'),
    t('tools:captureLifeLossRespawnSlowdownAbilityBossWarningOpen'),
    t('tools:semanticCuesVisibleFootprintPreservedGeometryReducedEffects'),
    t('tools:study'),
  ],
  [
    'player',
    t('tools:pauseRestartLeave'),
    t('tools:resumeSettingsReturnRetryConfirmationLeaveFocusRestore'),
    t('tools:opaqueCoverResumeFirstNoAccidentalDestructiveActivation'),
    t('tools:study'),
  ],
  [
    'player',
    t('tools:victoryDefeat'),
    t('tools:artworkRevealMedalsScoreNoMedalRecordRetryNextFinal'),
    t('tools:separatePresentationFromScoreStateSkipSafelyDirectRepeat'),
    t('tools:study'),
  ],
  [
    'player',
    t('tools:collectionFullPicture'),
    t('tools:earnedUnknownSelectionPreviewCloseArtworkFailure'),
    t('tools:calmImageViewerEarnedProgressAndMissionAccessRemainDistinct'),
    t('tools:study'),
  ],
  [
    'support',
    t('tools:hangarEquipment'),
    t('tools:classSelectionAbilityAppearanceRequirementsDisabledChoice'),
    t('tools:sharedSlotPreviewReadableStatsAndConfirmedEquippedState'),
    t('tools:planned'),
  ],
  [
    'support',
    t('tools:fieldGuideHelp'),
    t('tools:controlsTerrainThreatsAbilitiesReadingModeReturn'),
    t('tools:shortFirstLayerIllustratedRoleEntriesPreservePausedContext'),
    t('tools:planned'),
  ],
  [
    'support',
    t('tools:settingsAccessibility'),
    t('tools:audioDisplayTextSizeMotionInputRemappingLanguage'),
    t('tools:categoryNavigationRealPreviewStandardLargeNoFauxSystemUi'),
    t('tools:study'),
  ],
  [
    'support',
    t('tools:storyChapterDialogue'),
    t('tools:beforeMissionAfterResultNextSkipReplayLongCopy'),
    t('tools:readableDialogueFramePortraitsRemainSubordinateToText'),
    t('tools:planned'),
  ],
  [
    'support',
    t('tools:scoresAchievements'),
    t('tools:noneEarnedPersonalBestFiltersEarnedGoalsUnlockedCosmetics'),
    t('tools:sharedGalleryListVocabularyConditionsAndProgressStatedClearly'),
    t('tools:planned'),
  ],
  [
    'support',
    t('tools:savesImportExport'),
    t('tools:emptyLocalBackupImportPreviewConflictCorruptRestore'),
    t('tools:settingsSavesExplicitFileFeedbackAndReversibility'),
    t('tools:planned'),
  ],
  [
    'support',
    t('tools:optionalWorldsDownloads'),
    t('tools:installedAvailableFetchingReadyOfflineFailedRemoval'),
    t('tools:missionsMoreWorldsCompactArtCardsWithHonestAvailability'),
    t('tools:planned'),
  ],
  [
    'support',
    t('tools:challengesMastery'),
    t('tools:availableActiveProgressEarnedPracticeOnlyIncompatibility'),
    t('tools:reuseMissionCardsAndResultConditionsAvoidRewardAmbiguity'),
    t('tools:planned'),
  ],
  [
    'support',
    t('tools:replayTheaterAttemptExport'),
    t('tools:noRecordingLoadedPlayPauseSeekInvalidIncompatible'),
    t('tools:sameGameFrameAndTransportControlsKeepReadOnlyReview'),
    t('tools:planned'),
  ],
  [
    'support',
    t('tools:controllerPractice2'),
    t('tools:joinMappingReconnectConfirmCancelScrollingReading'),
    t('tools:settingsControlsRealActiveDevicePromptsAndFocusContinuity'),
    t('tools:planned'),
  ],
  [
    'support',
    t('tools:couchRace2'),
    t('tools:modeEntryJoinSetupTwoBoardsPauseResultsRematchLeave'),
    t('tools:missionsPlayModeMirroredHudsPlayerIdentityByShapeAnd'),
    t('tools:planned'),
  ],
  [
    'system',
    t('tools:bootOfflineUpdate'),
    t('tools:preparingUsableOfflineStaleNewReleaseVerifyRepairFailure'),
    t('tools:sameShellWithHonestProgressAndReadableRecoveryActions'),
    t('tools:planned'),
  ],
  [
    'system',
    t('tools:browserNativeEdges'),
    t('tools:portraitShortLandscapeSafeAreasResizeGamepadLossFocusLoss'),
    t('tools:fixedSimulationGridReflowControlsNoHiddenReachableActions'),
    t('tools:planned'),
  ],
  [
    'system',
    t('tools:genericUiStates'),
    t('tools:defaultHoverFocusPressedSelectedDisabledBusyEmptyError'),
    t('tools:sharedComponentContractWithShapeContrastRealLabelsAndStatus'),
    t('tools:planned'),
  ],
  [
    'system',
    t('tools:aboutCreditsPrivacyArchive'),
    t('tools:currentVersionNoticesSourceAttributionOlderReleases'),
    t('tools:settingsAboutGameFrameReadableDocumentSurfaces'),
    t('tools:planned'),
  ],
  [
    'authoring',
    t('tools:assetStudioRegistry'),
    t('tools:browseFilterInspectNativeContextPreviewSlotRequirements'),
    t('tools:workshopCompleteAssetCategoriesAndExactCopyableBriefs'),
    t('tools:study'),
  ],
  [
    'authoring',
    t('tools:assetReplacementCollection'),
    t('tools:uploadCropOriginalDraftValidationApplyRevertExport'),
    'Original preserved; <=128 single-layer sprite editing; atomic collections',
    t('tools:planned'),
  ],
  [
    'authoring',
    t('tools:spriteRigAnimation'),
    t('tools:idlePosesPivotRigPartFrameTimingPlaybackConstraints'),
    t('tools:metadataAndRigToolingSeparateFromGameplayFootprint'),
    t('tools:planned'),
  ],
  [
    'authoring',
    t('tools:levelPlaygroundEnemyCatalog'),
    t('tools:inspectGenerateEditInvalidTestExportRoleSpecificPractice'),
    t('tools:workshopLevelsAndThreatsActualArenaPreviewAndConsistentControls'),
    t('tools:planned'),
  ],
  [
    'authoring',
    t('tools:pictureVideoPosterTools'),
    t('tools:originalImportedCropPosterMediaValidationSourceMetadata'),
    t('tools:workshopArtworkFullPicturePreviewAndPreservedSource'),
    t('tools:planned'),
  ],
  [
    'authoring',
    t('tools:motionViewportLabs'),
    t('tools:presetPreviewTimelinePhoneLandscapeReducedEffects'),
    t('tools:workshopReviewRetainToolsShareFrameAndTypeRoles'),
    t('tools:planned'),
  ],
  [
    'authoring',
    t('tools:productionLibraryPromptTools'),
    t('tools:coverageMissingAcceptedPreviousPromptCopiedThemeReadiness'),
    t('tools:workshopProductionDistinguishEvidenceDraftAndShippedContent'),
    t('tools:planned'),
  ],
];

function renderInventory() {
  const filter = $('#inventory-filter').value;
  const rows = inventory.filter(([group]) => filter === 'all' || group === filter);
  $('#screen-matrix-body').innerHTML = rows
    .map(
      ([group, name, states, treatment, status]) =>
        `<tr><td>${name}<small>${group === 'system' ? t('tools:systemState') : group === 'authoring' ? t('tools:authoring') : group === 'support' ? t('tools:supportingFlow') : t('tools:playerJourney')}</small></td><td>${states}</td><td>${treatment}</td><td><span class="badge proposed">${status}</span></td></tr>`,
    )
    .join('');
  localizedText($('#inventory-count'), () =>
    t('tools:surfaces', { value1: rows.length, value2: inventory.length }),
  );
}
$('#inventory-filter').addEventListener('change', renderInventory);

const copyPresenter = createOperationStatus($('#copy-status')),
  fontPresenter = createOperationStatus($('#font-status')),
  referencePresenter = createOperationStatus($('#reference-status'));
let copyGeneration = 0;
$('#copy-prompt').addEventListener('click', async () => {
  const generation = ++copyGeneration,
    lease = copyPresenter.begin({
      message: t('tools:copyingTheExampleBrief'),
      isCurrent: () => generation === copyGeneration,
    });
  try {
    await navigator.clipboard.writeText($('#prompt-example-text').textContent);
    lease.finish({ message: t('tools:exampleBriefCopied') });
  } catch {
    if (generation !== copyGeneration) return;
    if (
      !document.hidden &&
      document.hasFocus?.() !== false &&
      document.activeElement === $('#copy-prompt')
    ) {
      const selection = window.getSelection(),
        range = document.createRange();
      range.selectNodeContents($('#prompt-example-text'));
      selection.removeAllRanges();
      selection.addRange(range);
      lease.finish({ message: t('tools:briefSelectedUseYourDeviceSCopyAction'), state: 'error' });
    } else
      lease.finish({
        message: t('tools:copyWasUnavailableSelectTheExampleBriefAndUseYour'),
        state: 'error',
      });
  }
});

async function checkFonts() {
  const lease = fontPresenter.begin({ message: t('tools:loadingTheThreeLocalFontRoles') });
  const required = [
    ['Field Kit Display', 600],
    ['Field Kit UI', 400],
    ['Field Kit Mono', 500],
  ];
  const results = await Promise.allSettled(
    required.map(([family, weight]) =>
      Promise.resolve().then(() =>
        document.fonts.load(`${weight} 20px "${family}"`, 'Ґґ Єє Іі Її RevealLine'),
      ),
    ),
  );
  const ready = results.every((result) => result.status === 'fulfilled' && result.value.length > 0);
  lease.finish({
    state: ready ? 'ready' : 'error',
    message: ready
      ? t('tools:allThreeLocalFontRolesLoadedGlyphCoverageIsIndependently')
      : t('tools:oneOrMoreLocalFontFilesAreUnavailableHereFallback'),
  });
}

async function revealLocalReferences() {
  // Published review pages do not request source screenshots.
  if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
    referencePresenter.begin({ message: '' }).finish({
      message: t('tools:sourceScreenshotsAreAvailableOnlyInTheLocalResearchFolder'),
    });
    return;
  }
  const lease = referencePresenter.begin({
    message: t('tools:checkingAvailableLocalReferenceFiles'),
  });
  const links = [...document.querySelectorAll('[data-local-reference]')];
  const results = await Promise.allSettled(
    links.map(async (link) => {
      const source = link.dataset.localReference;
      const response = await fetch(new URL(source, location.href), { method: 'HEAD' });
      if (!response.ok) return false;
      const isImage = /\.(png|jpg)$/.test(source);
      if (isImage && !response.headers.get('content-type')?.startsWith('image/')) return false;
      link.href = source;
      link.hidden = false;
      const image = link.querySelector('[data-local-image]');
      if (image) {
        image.src = image.dataset.localImage;
        await image.decode();
      }
      return isImage;
    }),
  );
  const count = results.filter((result) => result.status === 'fulfilled' && result.value).length;
  lease.finish({
    message: count
      ? `${count} local screenshot previews available from the source research folder. These images are reference evidence, not production assets.`
      : t('tools:sourceScreenshotsAreNotPresentInThisLocalBuildReview'),
  });
}

chooseScreen('title');
renderInventory();
checkFonts();
revealLocalReferences();
