import {
  t,
  localizedText,
  localizedAttribute,
  localizedOption,
  localizedMessage,
  translateDOM,
  render,
  formatNumber,
} from '../../game/i18n/index.mjs';
globalThis.RevealLineToolLaunch?.attached();
import { createOperationStatus } from '../../game/ui/operation-status.mjs';
// Original review mockups only. This module never imports the game or writes player storage.
const $ = (selector) => document.querySelector(selector);

// Templates describe structure only. Translated values are assigned to owned
// text nodes after mounting, so locale changes preserve preview controls and focus.
const copies = new Map();
let copyId = 0;
function copy(value) {
  const id = String(++copyId);
  copies.set(id, value);
  return `<span data-atlas-copy="${id}"></span>`;
}
function bindCopies(root) {
  for (const element of root.querySelectorAll('[data-atlas-copy]')) {
    const id = element.dataset.atlasCopy;
    if (!copies.has(id)) continue;
    localizedText(element, copies.get(id));
    copies.delete(id);
  }
  for (const element of root.querySelectorAll('[data-atlas-medals]'))
    localizedAttribute(element, 'aria-label', () =>
      t('tools:atlas.medalsLabel', { count: Number(element.dataset.atlasMedals) }),
    );
  for (const element of root.querySelectorAll('[data-atlas-number]'))
    localizedText(element, () => formatNumber(Number(element.dataset.atlasNumber)));
  translateDOM(root);
}

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
  `<div class="mock-command"><button type="button" data-screen="${back}"><span data-i18n="tools:atlas.back"></span></button><span class="desktop-hints"><kbd>↑↓</kbd> <span data-i18n="tools:atlas.move"></span> <kbd>Enter</kbd> <span data-i18n="tools:atlas.choose"></span></span><span><span data-i18n="tools:atlas.layoutStudy"></span></span></div>`;
const top = (title, detail = copy(localizedMessage('tools:fpvFirstLight'))) =>
  `<div class="mock-topline"><strong>${title}</strong><span>${detail}</span></div>`;
const action = (label, screen, primary = false, intent = '') =>
  `<button type="button" class="action${primary ? ' primary' : ''}" data-screen="${screen}" data-intent="${intent}">${label}</button>`;

const missionNames = [
  localizedMessage('tools:firstLight'),
  localizedMessage('tools:riverCrossing'),
  localizedMessage('tools:openField'),
  localizedMessage('tools:quietWoodland'),
  localizedMessage('tools:relayDistrict'),
  localizedMessage('tools:homeward'),
];
function missionCards(count = 6, unknown = false) {
  return `<div class="mission-grid">${missionNames
    .slice(0, count)
    .map((name, i) => {
      const mystery = unknown && i > 0;
      return `<article class="mission-card${i === 0 ? ' selected' : ''}"><div class="mission-art terrain-${i}${mystery ? ' unknown' : ''}"><span class="mission-number">0${i + 1}</span>${mystery ? '<span class="unknown-mark">?</span>' : ''}<span class="medals" data-atlas-medals="${mystery ? 0 : i === 0 ? 3 : 1}">${mystery ? '☆☆☆' : i === 0 ? '★★★' : '★☆☆'}</span></div><div class="mission-label"><span>${copy(name)}</span><span>${mystery ? copy(localizedMessage('tools:unrevealed')) : copy(() => formatNumber(i === 0 ? 11450 : 2380))}</span></div></article>`;
    })
    .join('')}</div>`;
}

function titleScreen(state) {
  const first = state === 'first-visit';
  return `<div class="mock-screen">${top('REVEALLINE', copy(localizedMessage('tools:soloFieldKit')))}
    <div class="mock-title-content"><div><p class="mock-logo">REVEAL<br /><span>LINE</span></p><p class="mock-subtitle"><span data-i18n="tools:atlas.subtitle"></span></p>
    <div class="mock-menu"><button type="button" class="menu-focus" data-screen="${first ? 'missions' : 'briefing'}">${first ? copy(localizedMessage('common:actions.deploy')) : copy(localizedMessage('common:actions.continue'))}</button><button type="button" data-screen="missions"><span data-i18n="interface:missions"></span></button><button type="button" data-screen="collection"><span data-i18n="interface:collection"></span></button><button type="button" data-screen="settings"><span data-i18n="common:navigation.settings"></span></button><button type="button" data-screen="workshop"><span data-i18n="tools:atlas.workshop"></span></button></div>
    <p class="menu-destination">${first ? copy(localizedMessage('tools:yourFirstRouteIsWaiting')) : copy(localizedMessage('tools:firstLightRiverCrossingScout'))}</p></div><div class="title-art">${drone}</div></div>
    <div class="mock-command"><span><span data-i18n="tools:atlas.originalWorld"></span></span><span class="desktop-hints"><kbd>↑↓</kbd> <span data-i18n="tools:atlas.move"></span> <kbd>Enter</kbd> <span data-i18n="tools:atlas.choose"></span></span><span><span data-i18n="tools:atlas.proposedTitle"></span></span></div></div>`;
}

function missionsScreen(state) {
  const mystery = state === 'unrevealed';
  return `<div class="mock-screen">${top(copy(localizedMessage('tools:missions')), copy(localizedMessage('tools:collection08Stars')))}
    <div class="mock-gallery-head"><div><h3><span data-i18n="tools:atlas.firstLightTitle"></span></h3><p><span data-i18n="tools:atlas.sixRoutes"></span></p></div><div class="pack-tabs" data-i18n-aria-label="tools:atlas.packTabsLabel"><span><span data-i18n="tools:atlas.firstLightTitle"></span></span><span><span data-i18n="interface:moreWorlds"></span></span></div></div>
    ${missionCards(6, mystery)}
    <div class="mission-choice"><div><strong><span data-i18n="tools:atlas.firstMission"></span></strong><p><span data-i18n="tools:atlas.scoutStandard"></span> <span aria-hidden="true">/</span> ${mystery ? copy(localizedMessage('tools:artworkRevealsThroughPlay')) : copy(localizedMessage('tools:threeMedalsEarned'))}</p></div><div class="mock-actions">${action(copy(localizedMessage('tools:preview')), 'collection', false, 'picture')}${action(copy(localizedMessage('common:actions.deployArrow')), 'briefing', true)}</div></div>${commands()}</div>`;
}

function briefingScreen(state) {
  const gentle = state === 'gentle';
  return `<div class="mock-screen">${top(copy(localizedMessage('tools:missionBrief01')), copy(localizedMessage('tools:firstLight2')))}<h3><span data-i18n="tools:atlas.chooseRoute"></span></h3>
    <div class="brief-grid"><div class="mission-art terrain-0 brief-art"><span class="mission-number"><span data-i18n="tools:atlas.briefArt"></span></span></div><dl class="brief-conditions"><div><dt><span data-i18n="interface:craft"></span></dt><dd><span data-i18n="tools:atlas.scoutChange"></span></dd></div><div><dt><span data-i18n="interface:difficulty"></span></dt><dd>${copy(() => t('tools:atlas.changeDifficulty', { difficulty: t(gentle ? 'tools:gentle' : 'tools:standard') }))}</dd></div><div><dt><span data-i18n="tools:atlas.coverageTarget"></span></dt><dd>80%</dd></div><div><dt><span data-i18n="tools:atlas.medalOpportunity"></span></dt><dd><span data-i18n="tools:atlas.medalDeadline"></span></dd></div></dl></div>
    <p class="mock-description"><span data-i18n="tools:atlas.briefDescription"></span></p>
    <div class="mock-actions">${action(copy(localizedMessage('common:actions.deployArrow')), 'flight', true)}${action(copy(localizedMessage('tools:fieldGuide')), 'settings')}</div><p class="small-note"><span data-i18n="tools:atlas.briefNote"></span></p>${commands('missions')}</div>`;
}

function arenaMarkup(state) {
  const message =
    state === 'life-loss'
      ? '<div class="arena-message"><strong><span data-i18n="interface:linkLost"></span></strong><p><span data-i18n="tools:atlas.lineGone"></span><br /><span data-i18n="tools:atlas.groundKept"></span></p></div>'
      : state === 'warning'
        ? '<div class="arena-message"><strong><span data-i18n="tools:atlas.lineExposed"></span></strong><p><span data-i18n="tools:atlas.chooseTurn"></span></p></div>'
        : '';
  return `<div class="arena-mock" data-i18n-aria-label="tools:atlas.arenaLabel"><div class="revealed-land"></div><div class="frontier"></div><div class="live-route"></div><div class="terrain-wall"></div><div class="terrain-slow"></div><div class="terrain-danger"></div><span class="threat one"></span><span class="threat two"></span><span class="threat three"></span><div class="arena-craft">${drone}</div>${message}</div>`;
}

function flightScreen(state, paused = false) {
  if (paused)
    return `<div class="mock-screen"><div class="pause-overlay"><p class="eyebrow"><span data-i18n="tools:atlas.firstLightScout"></span></p><h3><span data-i18n="tools:atlas.paused"></span></h3><div class="mock-menu"><button type="button" class="menu-focus" data-screen="flight"><span data-i18n="tools:atlas.resume"></span></button><button type="button" data-screen="flight"><span data-i18n="tools:atlas.retryMission"></span></button><button type="button" data-screen="settings"><span data-i18n="common:navigation.settings"></span></button><button type="button" data-screen="missions"><span data-i18n="interface:missions"></span></button></div><p class="small-note"><span data-i18n="tools:atlas.pauseNote"></span></p></div></div>`;
  return `<div class="mock-screen mock-flight"><div class="flight-hud"><div class="hud-item"><span><span data-i18n="tools:atlas.scoutLives"></span></span><strong>${state === 'life-loss' ? '02' : '03'}</strong></div><div class="hud-item hud-coverage"><span><span data-i18n="tools:atlas.coverageHud"></span></span><strong>56 / 80</strong><div class="coverage-track"><span></span></div></div><div class="hud-item"><span><span data-i18n="interface:score"></span></span><strong data-atlas-number="2380"></strong></div><div class="hud-item"><span><span data-i18n="tools:atlas.medalTime"></span></span><strong>00:42</strong></div></div>
    ${arenaMarkup(state)}<div class="flight-bottom"><span class="flight-state">${state === 'life-loss' ? copy(localizedMessage('tools:returningToFrontier')) : copy(localizedMessage('tools:liveLineFindATurn'))}</span><span class="flight-ability"><span data-i18n="tools:atlas.pulseReady"></span></span></div>
    <div class="touch-controls" data-i18n-aria-label="tools:atlas.touchLabel"><div class="touch-dpad" aria-hidden="true"><span>↑</span><span>←</span><span>↓</span><span>→</span></div><span class="touch-action"><span data-i18n="tools:atlas.pulse"></span></span></div>
    <div class="mock-command"><button type="button" data-screen="pause"><span data-i18n="tools:atlas.pauseButton"></span></button><span class="desktop-hints"><span data-i18n="tools:atlas.pathsAboveArt"></span></span><span><span data-i18n="tools:atlas.noSimulation"></span></span></div>
    ${paused ? `<div class="pause-overlay"><p class="eyebrow"><span data-i18n="tools:atlas.firstLightScout"></span></p><h3><span data-i18n="tools:atlas.paused"></span></h3><div class="mock-menu"><button type="button" class="menu-focus" data-screen="flight"><span data-i18n="tools:atlas.resume"></span></button><button type="button" data-screen="flight"><span data-i18n="tools:atlas.retryMission"></span></button><button type="button" data-screen="settings"><span data-i18n="common:navigation.settings"></span></button><button type="button" data-screen="missions"><span data-i18n="interface:missions"></span></button></div><p class="small-note"><span data-i18n="tools:atlas.resumeFocus"></span></p></div>` : ''}</div>`;
}

function resultsScreen(state) {
  const failed = state === 'defeat';
  return `<div class="mock-screen">${top(copy(localizedMessage('tools:mission01')), copy(localizedMessage('tools:firstLight2')))}
    <div class="results-content"><p class="eyebrow">${failed ? copy(localizedMessage('tools:retryTheRoute')) : copy(localizedMessage('tools:worldRevealed'))}</p><h3>${failed ? copy(localizedMessage('tools:signalLost')) : copy(localizedMessage('tools:firstLightFound'))}</h3>
    <div class="result-emblem${failed ? ' failure' : ''}" aria-hidden="true">${failed ? '×' : '★ ★ ★'}</div>
    ${failed ? '<p class="mock-description"><span data-i18n="tools:atlas.lineHit"></span><br /><span data-i18n="tools:atlas.shorterCut"></span></p>' : '<div class="result-goals"><span><b>★</b><span data-i18n="interface:missionComplete"></span></span><span><b>★</b><span data-i18n="tools:atlas.allLives"></span></span><span><b>★</b><span data-i18n="tools:atlas.withinMedalTime"></span></span></div><p class="result-score" data-atlas-number="11450"></p><p class="result-highscore"><span data-i18n="tools:atlas.highScore"></span></p>'}
    <div class="mock-actions">${action(failed ? copy(localizedMessage('tools:retry2')) : copy(localizedMessage('tools:nextMission')), 'flight', true)}${action(failed ? copy(localizedMessage('tools:missions2')) : copy(localizedMessage('common:actions.viewPicture')), failed ? 'missions' : 'collection', false, failed ? '' : 'picture')}${failed ? '' : action(copy(localizedMessage('common:actions.retry')), 'flight')}</div></div>${commands('missions')}</div>`;
}

function settingsScreen(state) {
  const large = state === 'large-text';
  return `<div class="mock-screen">${top(copy(localizedMessage('tools:settings')))}<h3><span data-i18n="tools:atlas.makeYours"></span></h3><div class="settings-layout"><div class="settings-tabs" data-i18n-aria-label="tools:atlas.settingsLabel"><span class="selected"><span data-i18n="tools:atlas.display"></span></span><span><span data-i18n="interface:audio"></span></span><span><span data-i18n="interface:controls"></span></span><span><span data-i18n="common:language.label"></span></span><span><span data-i18n="tools:atlas.saves"></span></span></div><div class="settings-list"><div class="setting-row"><span><span data-i18n="interface:textSize"></span><small><span data-i18n="tools:atlas.comfortableText"></span></small></span><span class="setting-value">${large ? copy(localizedMessage('tools:large2')) : copy(localizedMessage('tools:standard2'))}</span></div><div class="setting-row"><span><span data-i18n="interface:reducedEffects"></span></span><span class="setting-value"><span data-i18n="tools:atlas.on"></span></span></div><div class="setting-row"><span><span data-i18n="tools:atlas.backgroundBrightness"></span></span><span class="mini-range" aria-hidden="true"></span></div><div class="setting-row"><span><span data-i18n="tools:atlas.contrastPaths"></span></span><span class="setting-value"><span data-i18n="tools:atlas.on"></span></span></div><div class="settings-preview"><strong style="font-size:${large ? '25' : '20'}px">56 / 80 · 00:42</strong><span data-i18n="tools:atlas.previewNote"></span></div></div></div>${commands()}</div>`;
}

function collectionScreen(state) {
  const picture = state === 'picture';
  return `<div class="mock-screen">${top(copy(localizedMessage('tools:collection')), copy(localizedMessage('tools:firstLight03Of12')))}<h3>${picture ? copy(localizedMessage('tools:aWorldWorthFinding')) : copy(localizedMessage('tools:yourRevealedWorlds'))}</h3>${picture ? '<div class="mission-art terrain-0 brief-art" style="min-height:300px;margin-bottom:20px" data-i18n-aria-label="tools:atlas.illustrationLabel"><span class="mission-number"><span data-i18n="tools:atlas.illustrationNote"></span></span></div>' : missionCards(6, true)}<p class="mock-description">${picture ? copy(localizedMessage('tools:aQuietPictureViewSeparateFromAchievedCoverageReturnTo')) : copy(localizedMessage('tools:collectedArtworkEarnedMedalsAndMemorableRoutesUnrevealedImagesRemain'))}</p><div class="mock-actions">${action(picture ? copy(localizedMessage('tools:returnToCollection')) : copy(localizedMessage('common:actions.viewPicture')), 'collection', true, picture ? '' : 'picture')}${action(copy(localizedMessage('tools:replayMission')), 'briefing')}</div>${commands()}</div>`;
}

function workshopScreen(state) {
  const error = state === 'validation';
  return `<div class="mock-screen">${top(copy(localizedMessage('tools:workshopAssetStudio')), copy(localizedMessage('tools:localDraft')))}<h3><span data-i18n="tools:atlas.everyDetail"></span></h3><div class="workshop-layout"><div class="slot-nav"><span class="selected"><span data-i18n="tools:atlas.player"></span></span><span><span data-i18n="tools:atlas.threats"></span></span><span><span data-i18n="tools:atlas.terrain"></span></span><span><span data-i18n="common:interface.label"></span></span><span><span data-i18n="tools:atlas.pictures"></span></span><span><span data-i18n="interface:audio"></span></span></div><div class="slot-art">${drone}</div><div class="slot-meta"><span class="badge ${error ? 'proposed' : 'implemented'}">${error ? copy(localizedMessage('tools:draftNeedsReview')) : copy(localizedMessage('tools:illustrativePreview'))}</span><h4><span data-i18n="tools:atlas.scoutBody"></span></h4><p>${error ? copy(localizedMessage('tools:thisDraftDoesNotMatchTheSelectedSlotResolveDimensions')) : copy(localizedMessage('tools:inspectAtNativeSizeReplaceAnImageOrEditA'))}</p><dl class="slot-contract"><dt><span data-i18n="interface:role"></span></dt><dd><span data-i18n="tools:playerBody"></span></dd><dt><span data-i18n="interface:theme"></span></dt><dd><span data-i18n="interface:fpvFieldKit"></span></dd><dt><span data-i18n="tools:atlas.bounds"></span></dt><dd><span data-i18n="tools:atlas.fromRegistry"></span></dd><dt><span data-i18n="interface:source"></span></dt><dd><span data-i18n="interface:originalArtwork"></span></dd></dl><div class="mock-actions">${action(copy(localizedMessage('tools:previewInField')), 'flight')}${action(copy(localizedMessage('tools:assetBrief')), 'workshop', true, 'asset-brief')}</div></div></div><p class="mock-description"><span data-i18n="tools:atlas.collectionApply"></span></p>${commands()}</div>`;
}

const screens = {
  title: {
    label: localizedMessage('tools:titleLanding'),
    states: [
      ['returning', localizedMessage('tools:returningPlayer')],
      ['first-visit', localizedMessage('tools:firstVisit')],
    ],
    render: titleScreen,
    purpose: localizedMessage('tools:oneObviousFirstAction'),
    rule: localizedMessage('tools:continueNamesTheSavedDestinationSupportingLinksStayInThe'),
  },
  missions: {
    label: localizedMessage('tools:missionGallery'),
    states: [
      ['progress', localizedMessage('tools:withProgress')],
      ['unrevealed', localizedMessage('tools:unrevealedArtwork')],
    ],
    render: missionsScreen,
    purpose: localizedMessage('tools:artworkMakesTheCampaignTangible'),
    rule: localizedMessage('tools:threeColumnsOnDesktopTwoOnTabletOneOnPhone'),
  },
  briefing: {
    label: localizedMessage('tools:missionPreparation'),
    states: [
      ['standard', localizedMessage('tools:standard')],
      ['gentle', localizedMessage('tools:gentle')],
    ],
    render: briefingScreen,
    purpose: localizedMessage('tools:knowTheMissionBeforeCommitting'),
    rule: localizedMessage('tools:showClassDifficultyAndActualObjectivesRetryPreservesTheSetup'),
  },
  flight: {
    label: localizedMessage('tools:liveArena'),
    states: [
      ['running', localizedMessage('tools:running')],
      ['warning', localizedMessage('tools:exposedLineMessage')],
      ['life-loss', localizedMessage('tools:lifeLost')],
    ],
    render: flightScreen,
    purpose: localizedMessage('tools:thePlayerAndLiveRouteLead'),
    rule: localizedMessage('tools:theGridAndSimulationStayFixedAcrossViewportChangesThis'),
  },
  pause: {
    label: localizedMessage('tools:contextualPause'),
    states: [['paused', localizedMessage('tools:paused')]],
    render: (state) => flightScreen(state, true),
    purpose: localizedMessage('tools:keepThePlayerSPlace'),
    rule: localizedMessage('tools:concealTheArenaArtworkAndActorsWithAnOpaquePause'),
  },
  results: {
    label: localizedMessage('tools:resultsRetry'),
    states: [
      ['victory', localizedMessage('tools:victory')],
      ['defeat', localizedMessage('tools:defeat')],
    ],
    render: resultsScreen,
    purpose: localizedMessage('tools:celebrateClearlyRecoverQuickly'),
    rule: localizedMessage('tools:separateArtworkMedalsAndScoreMakeNextAndRetryDirectly'),
  },
  settings: {
    label: localizedMessage('common:navigation.settings'),
    states: [
      ['standard', localizedMessage('tools:standardText')],
      ['large-text', localizedMessage('tools:largeTextSpecimen')],
    ],
    render: settingsScreen,
    purpose: localizedMessage('tools:comfortBelongsInsideTheGame'),
    rule: localizedMessage('tools:useTheSameFocusTextAndControlsPreviewRelevantChanges'),
  },
  collection: {
    label: localizedMessage('tools:collectionPicture'),
    states: [
      ['gallery', localizedMessage('tools:gallery')],
      ['picture', localizedMessage('tools:pictureView')],
    ],
    render: collectionScreen,
    purpose: localizedMessage('tools:letTheRevealedArtworkBreathe'),
    rule: localizedMessage('tools:offerAQuietFullPictureViewAndAnExplicitReturn'),
  },
  workshop: {
    label: localizedMessage('tools:assetStudioConcept'),
    states: [
      ['draft', localizedMessage('tools:inspectASlot')],
      ['validation', localizedMessage('tools:invalidReplacement')],
    ],
    render: workshopScreen,
    purpose: localizedMessage('tools:aCompleteReplacementWorkflow'),
    rule: localizedMessage('tools:thisIsAProposedLayoutOnlyTheFrameworkMustProvide'),
  },
};

let currentScreen = 'title';
let currentState = 'returning';

function renderScreen() {
  const screen = screens[currentScreen];
  $('#screen-preview').innerHTML = screen.render(currentState);
  bindCopies($('#screen-preview'));
  const purpose = document.createElement('strong');
  const detail = document.createElement('span');
  localizedText(purpose, screen.purpose);
  localizedText(
    detail,
    () =>
      `${render(screen.label)} / ${render(screen.states.find(([id]) => id === currentState)[1])}`,
  );
  $('#study-purpose').replaceChildren(purpose, detail);
  localizedText($('#study-rule'), () => screen.rule);
  localizedText($('#review-status'), () =>
    t('tools:studyShown', {
      value1: render(screen.label),
      value2: render(screen.states.find(([id]) => id === currentState)[1]),
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
  if (button.dataset.intent === 'asset-brief') {
    $('.prompt-example').open = true;
    $('.prompt-example').scrollIntoView({ block: 'center' });
    $('#copy-prompt').focus({ preventScroll: true });
    return;
  }
  const picture = button.dataset.intent === 'picture';
  chooseScreen(button.dataset.screen, picture ? 'picture' : undefined);
  $('#screen-select').focus({ preventScroll: true });
});

const viewportLabel = (view) =>
  t(
    {
      desktop: 'tools:fluidDesktopUpTo1120Px',
      tablet: 'tools:atlas.viewport.tablet',
      phone: 'tools:atlas.viewport.phone',
      landscape: 'tools:atlas.viewport.landscape',
    }[view],
  );
document.querySelectorAll('[data-viewport]').forEach((button) => {
  if (button.tagName !== 'BUTTON') return;
  button.addEventListener('click', () => {
    const view = button.dataset.viewport;
    $('#screen-stage').dataset.viewport = view;
    document
      .querySelectorAll('button[data-viewport]')
      .forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
    localizedText($('#viewport-label'), () => viewportLabel(view));
    localizedText($('#review-status'), () =>
      t('tools:previewSelectedWidthIsLimitedByTheAvailableWindow', {
        value1: viewportLabel(view),
      }),
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
  [localizedMessage('tools:stage'), '#070B12'],
  [localizedMessage('tools:panel'), '#101923'],
  [localizedMessage('tools:text'), '#F3F0DB'],
  [localizedMessage('tools:navigation'), '#78DCE8'],
  [localizedMessage('tools:playerReward'), '#F4BF62'],
  [localizedMessage('tools:threat'), '#F07879'],
  [localizedMessage('tools:success'), '#9DBB7A'],
  [localizedMessage('tools:secondary'), '#A5B2BB'],
];
$('#palette').innerHTML = palette
  .map(
    ([role, hex]) =>
      `<div class="swatch"><div class="swatch-color" style="background:${hex}"></div><strong>${copy(role)}</strong><code>${hex}</code></div>`,
  )
  .join('');
bindCopies($('#palette'));

const inventory = [
  [
    'player',
    localizedMessage('tools:launchLanding'),
    localizedMessage('tools:firstVisitLoadingEnterResumeDestinationStartupError'),
    localizedMessage('tools:oneTitleShellOnePrimaryActionRealLoadingFeedback'),
    localizedMessage('tools:study'),
  ],
  [
    'player',
    localizedMessage('tools:homeMenu'),
    localizedMessage('tools:returningPlayerNoProgressKeyboardPointerAndControllerFocus'),
    localizedMessage('tools:continueDeployMissionsCollectionSettingsWorkshopSecondary'),
    localizedMessage('tools:study'),
  ],
  [
    'player',
    localizedMessage('tools:missionsPackPicker'),
    localizedMessage('tools:currentPackPaginationSelectedEarnedUnrevealedLockedEmpty'),
    localizedMessage('tools:imageLedGalleryVisibleUnlockReasonRememberedSelection'),
    localizedMessage('tools:study'),
  ],
  [
    'player',
    localizedMessage('tools:missionBriefLoadout'),
    localizedMessage('tools:classAbilityDifficultyObjectivesCompatibleNextMission'),
    localizedMessage('tools:compactSetupSummaryOptionalDetailedPreparationDirectDeployment'),
    localizedMessage('tools:study'),
  ],
  [
    'player',
    localizedMessage('tools:firstFlightTutorial'),
    localizedMessage('tools:beforeStartStepActiveSuccessRetrySkipAlreadyCompleted'),
    localizedMessage('tools:teachOneActionInTheActualArenaOptionalHelpRemains'),
    localizedMessage('tools:planned'),
  ],
  [
    'player',
    localizedMessage('tools:arenaHud'),
    localizedMessage('tools:readyCountdownSafeCuttingStationaryExposedLineWarning'),
    localizedMessage('tools:stableCoverageLivesScoreTimerOrderClassSpecificAbilityState'),
    localizedMessage('tools:study'),
  ],
  [
    'player',
    localizedMessage('tools:arenaEvents'),
    localizedMessage('tools:captureLifeLossRespawnSlowdownAbilityBossWarningOpen'),
    localizedMessage('tools:semanticCuesVisibleFootprintPreservedGeometryReducedEffects'),
    localizedMessage('tools:study'),
  ],
  [
    'player',
    localizedMessage('tools:pauseRestartLeave'),
    localizedMessage('tools:resumeSettingsReturnRetryConfirmationLeaveFocusRestore'),
    localizedMessage('tools:opaqueCoverResumeFirstNoAccidentalDestructiveActivation'),
    localizedMessage('tools:study'),
  ],
  [
    'player',
    localizedMessage('tools:victoryDefeat'),
    localizedMessage('tools:artworkRevealMedalsScoreNoMedalRecordRetryNextFinal'),
    localizedMessage('tools:separatePresentationFromScoreStateSkipSafelyDirectRepeat'),
    localizedMessage('tools:study'),
  ],
  [
    'player',
    localizedMessage('tools:collectionFullPicture'),
    localizedMessage('tools:earnedUnknownSelectionPreviewCloseArtworkFailure'),
    localizedMessage('tools:calmImageViewerEarnedProgressAndMissionAccessRemainDistinct'),
    localizedMessage('tools:study'),
  ],
  [
    'support',
    localizedMessage('tools:hangarEquipment'),
    localizedMessage('tools:classSelectionAbilityAppearanceRequirementsDisabledChoice'),
    localizedMessage('tools:sharedSlotPreviewReadableStatsAndConfirmedEquippedState'),
    localizedMessage('tools:planned'),
  ],
  [
    'support',
    localizedMessage('tools:fieldGuideHelp'),
    localizedMessage('tools:controlsTerrainThreatsAbilitiesReadingModeReturn'),
    localizedMessage('tools:shortFirstLayerIllustratedRoleEntriesPreservePausedContext'),
    localizedMessage('tools:planned'),
  ],
  [
    'support',
    localizedMessage('tools:settingsAccessibility'),
    localizedMessage('tools:audioDisplayTextSizeMotionInputRemappingLanguage'),
    localizedMessage('tools:categoryNavigationRealPreviewStandardLargeNoFauxSystemUi'),
    localizedMessage('tools:study'),
  ],
  [
    'support',
    localizedMessage('tools:storyChapterDialogue'),
    localizedMessage('tools:beforeMissionAfterResultNextSkipReplayLongCopy'),
    localizedMessage('tools:readableDialogueFramePortraitsRemainSubordinateToText'),
    localizedMessage('tools:planned'),
  ],
  [
    'support',
    localizedMessage('tools:scoresAchievements'),
    localizedMessage('tools:noneEarnedPersonalBestFiltersEarnedGoalsUnlockedCosmetics'),
    localizedMessage('tools:sharedGalleryListVocabularyConditionsAndProgressStatedClearly'),
    localizedMessage('tools:planned'),
  ],
  [
    'support',
    localizedMessage('tools:savesImportExport'),
    localizedMessage('tools:emptyLocalBackupImportPreviewConflictCorruptRestore'),
    localizedMessage('tools:settingsSavesExplicitFileFeedbackAndReversibility'),
    localizedMessage('tools:planned'),
  ],
  [
    'support',
    localizedMessage('tools:optionalWorldsDownloads'),
    localizedMessage('tools:installedAvailableFetchingReadyOfflineFailedRemoval'),
    localizedMessage('tools:missionsMoreWorldsCompactArtCardsWithHonestAvailability'),
    localizedMessage('tools:planned'),
  ],
  [
    'support',
    localizedMessage('tools:challengesMastery'),
    localizedMessage('tools:availableActiveProgressEarnedPracticeOnlyIncompatibility'),
    localizedMessage('tools:reuseMissionCardsAndResultConditionsAvoidRewardAmbiguity'),
    localizedMessage('tools:planned'),
  ],
  [
    'support',
    localizedMessage('tools:replayTheaterAttemptExport'),
    localizedMessage('tools:noRecordingLoadedPlayPauseSeekInvalidIncompatible'),
    localizedMessage('tools:sameGameFrameAndTransportControlsKeepReadOnlyReview'),
    localizedMessage('tools:planned'),
  ],
  [
    'support',
    localizedMessage('tools:controllerPractice2'),
    localizedMessage('tools:joinMappingReconnectConfirmCancelScrollingReading'),
    localizedMessage('tools:settingsControlsRealActiveDevicePromptsAndFocusContinuity'),
    localizedMessage('tools:planned'),
  ],
  [
    'support',
    localizedMessage('tools:couchRace2'),
    localizedMessage('tools:modeEntryJoinSetupTwoBoardsPauseResultsRematchLeave'),
    localizedMessage('tools:missionsPlayModeMirroredHudsPlayerIdentityByShapeAnd'),
    localizedMessage('tools:planned'),
  ],
  [
    'system',
    localizedMessage('tools:bootOfflineUpdate'),
    localizedMessage('tools:preparingUsableOfflineStaleNewReleaseVerifyRepairFailure'),
    localizedMessage('tools:sameShellWithHonestProgressAndReadableRecoveryActions'),
    localizedMessage('tools:planned'),
  ],
  [
    'system',
    localizedMessage('tools:browserNativeEdges'),
    localizedMessage('tools:portraitShortLandscapeSafeAreasResizeGamepadLossFocusLoss'),
    localizedMessage('tools:fixedSimulationGridReflowControlsNoHiddenReachableActions'),
    localizedMessage('tools:planned'),
  ],
  [
    'system',
    localizedMessage('tools:genericUiStates'),
    localizedMessage('tools:defaultHoverFocusPressedSelectedDisabledBusyEmptyError'),
    localizedMessage('tools:sharedComponentContractWithShapeContrastRealLabelsAndStatus'),
    localizedMessage('tools:planned'),
  ],
  [
    'system',
    localizedMessage('tools:aboutCreditsPrivacyArchive'),
    localizedMessage('tools:currentVersionNoticesSourceAttributionOlderReleases'),
    localizedMessage('tools:settingsAboutGameFrameReadableDocumentSurfaces'),
    localizedMessage('tools:planned'),
  ],
  [
    'authoring',
    localizedMessage('tools:assetStudioRegistry'),
    localizedMessage('tools:browseFilterInspectNativeContextPreviewSlotRequirements'),
    localizedMessage('tools:workshopCompleteAssetCategoriesAndExactCopyableBriefs'),
    localizedMessage('tools:study'),
  ],
  [
    'authoring',
    localizedMessage('tools:assetReplacementCollection'),
    localizedMessage('tools:uploadCropOriginalDraftValidationApplyRevertExport'),
    localizedMessage('tools:atlas.assetEditingPolicy'),
    localizedMessage('tools:planned'),
  ],
  [
    'authoring',
    localizedMessage('tools:spriteRigAnimation'),
    localizedMessage('tools:idlePosesPivotRigPartFrameTimingPlaybackConstraints'),
    localizedMessage('tools:metadataAndRigToolingSeparateFromGameplayFootprint'),
    localizedMessage('tools:planned'),
  ],
  [
    'authoring',
    localizedMessage('tools:levelPlaygroundEnemyCatalog'),
    localizedMessage('tools:inspectGenerateEditInvalidTestExportRoleSpecificPractice'),
    localizedMessage('tools:workshopLevelsAndThreatsActualArenaPreviewAndConsistentControls'),
    localizedMessage('tools:planned'),
  ],
  [
    'authoring',
    localizedMessage('tools:pictureVideoPosterTools'),
    localizedMessage('tools:originalImportedCropPosterMediaValidationSourceMetadata'),
    localizedMessage('tools:workshopArtworkFullPicturePreviewAndPreservedSource'),
    localizedMessage('tools:planned'),
  ],
  [
    'authoring',
    localizedMessage('tools:motionViewportLabs'),
    localizedMessage('tools:presetPreviewTimelinePhoneLandscapeReducedEffects'),
    localizedMessage('tools:workshopReviewRetainToolsShareFrameAndTypeRoles'),
    localizedMessage('tools:planned'),
  ],
  [
    'authoring',
    localizedMessage('tools:productionLibraryPromptTools'),
    localizedMessage('tools:coverageMissingAcceptedPreviousPromptCopiedThemeReadiness'),
    localizedMessage('tools:workshopProductionDistinguishEvidenceDraftAndShippedContent'),
    localizedMessage('tools:planned'),
  ],
];

function renderInventory() {
  const filter = $('#inventory-filter').value;
  const rows = inventory.filter(([group]) => filter === 'all' || group === filter);
  $('#screen-matrix-body').innerHTML = rows
    .map(
      ([group, name, states, treatment, status]) =>
        `<tr><td>${copy(name)}<small>${copy(localizedMessage(group === 'system' ? 'tools:systemState' : group === 'authoring' ? 'tools:authoring' : group === 'support' ? 'tools:supportingFlow' : 'tools:playerJourney'))}</small></td><td>${copy(states)}</td><td>${copy(treatment)}</td><td><span class="badge proposed">${copy(status)}</span></td></tr>`,
    )
    .join('');
  bindCopies($('#screen-matrix-body'));
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
      message: localizedMessage('tools:copyingTheExampleBrief'),
      isCurrent: () => generation === copyGeneration,
    });
  try {
    await navigator.clipboard.writeText($('#prompt-example-text').textContent);
    lease.finish({ message: localizedMessage('tools:exampleBriefCopied') });
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
      lease.finish({
        message: localizedMessage('tools:briefSelectedUseYourDeviceSCopyAction'),
        state: 'error',
      });
    } else
      lease.finish({
        message: localizedMessage('tools:copyWasUnavailableSelectTheExampleBriefAndUseYour'),
        state: 'error',
      });
  }
});

async function checkFonts() {
  const lease = fontPresenter.begin({
    message: localizedMessage('tools:loadingTheThreeLocalFontRoles'),
  });
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
      ? localizedMessage('tools:allThreeLocalFontRolesLoadedGlyphCoverageIsIndependently')
      : localizedMessage('tools:oneOrMoreLocalFontFilesAreUnavailableHereFallback'),
  });
}

async function revealLocalReferences() {
  // Published review pages do not request source screenshots.
  if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
    referencePresenter.begin({ message: '' }).finish({
      message: localizedMessage('tools:sourceScreenshotsAreAvailableOnlyInTheLocalResearchFolder'),
    });
    return;
  }
  const lease = referencePresenter.begin({
    message: localizedMessage('tools:checkingAvailableLocalReferenceFiles'),
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
      ? localizedMessage('tools:atlas.localReferences', { count })
      : localizedMessage('tools:sourceScreenshotsAreNotPresentInThisLocalBuildReview'),
  });
}

chooseScreen('title');
renderInventory();
checkFonts();
revealLocalReferences();
