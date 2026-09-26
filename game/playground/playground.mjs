import {
  t,
  localizedMessage,
  localizedText,
  localizedAttribute,
  localizedOption,
} from '../i18n/index.mjs';
globalThis.RevealLineToolLaunch?.attached();
import { createOperationStatus } from '../ui/operation-status.mjs';
import { geometryForLevel } from '../core/geometry.mjs';
import { paintEditorMap, editorCellFromPointer } from './board-view.mjs';
import { renderMapDiagnostics } from './map-diagnostics.mjs';
import {
  validateScenario,
  downloadJSON,
  inspectImageDataUrl,
  VISUAL_ROLES,
  CLASSIC_VISUAL_ROLES,
} from '../content.mjs';
import { prepareScenario } from '../imports.mjs';
import { emptyPackLibrary, exportPackLibrary, PACK_LIMITS } from '../packs.mjs';
import {
  editorScenario,
  entryScenario,
  prepareDocument,
  interactionPreset,
  PRESET_HELP,
  paintLevel,
  expansionFromScenario,
  withScenarioMastery,
  withScenarioEncounter,
  withoutScenarioEncounter,
  editScenario,
  entryMastery,
  visualsForLevelReplacement,
} from './model.mjs';
import { generateLevel } from '../generator.mjs';
import { resolvePreviewSize } from './viewport.mjs';
import { captureControlGeometry } from './control-geometry.mjs';
import { firstFlightPreviewURL } from '../ui/first-flight-preview.mjs';
import { verifyReplayAsync, MAX_REPLAY_BYTES } from '../replay.mjs';
const $ = (id) => document.getElementById(id),
  clone = (v) => structuredClone(v);
// A page rail needs viewport bounds, rather than the modal-only clearance helper.
// Only actual focus/reflow can clear an obscured control; ordinary scrolling is free.
function keepEditorFocusClear() {
  const rail = $('editor-feedback'),
    scroller = document.scrollingElement ?? document.documentElement,
    previousPadding = scroller.style.scrollPaddingBlockStart;
  let disposed = false,
    queued = false;
  const update = () => {
    queued = false;
    if (disposed || document.hidden || document.hasFocus?.() === false) return;
    const viewportTop = window.visualViewport?.offsetTop ?? 0,
      bounds = rail.getBoundingClientRect(),
      pinned =
        rail.getClientRects().length &&
        bounds.top <= viewportTop + 1 &&
        bounds.bottom > viewportTop,
      clearTop = pinned ? bounds.bottom + 8 : viewportTop;
    scroller.style.scrollPaddingBlockStart = `${Math.max(0, clearTop - viewportTop)}px`;
    const focused = document.activeElement;
    if (
      !pinned ||
      !focused ||
      rail.contains(focused) ||
      !['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A', 'SUMMARY'].includes(focused.tagName) ||
      focused.disabled ||
      focused.getClientRects().length === 0
    )
      return;
    const target = focused.getBoundingClientRect();
    // A deliberately scrolled-away control must not pull the page back on a resize.
    if (target.bottom > viewportTop && target.top < clearTop)
      scroller.scrollTop += target.top - clearTop;
  };
  const schedule = () => {
    if (disposed || queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  observer?.observe(rail);
  document.addEventListener('focusin', schedule);
  window.addEventListener('resize', schedule);
  return {
    refresh: schedule,
    destroy() {
      disposed = true;
      observer?.disconnect();
      document.removeEventListener('focusin', schedule);
      window.removeEventListener('resize', schedule);
      scroller.style.scrollPaddingBlockStart = previousPadding;
    },
  };
}
let editorClearance = keepEditorFocusClear(),
  feedbackOwner = 'editor';
// One bounded reading region serves both existing operation owners. A second
// pending owner's message and escape action remain available until it settles.
function showFeedback(owner = feedbackOwner) {
  const changedOwner = owner !== feedbackOwner,
    messages = $('editor-messages'),
    focused =
      changedOwner && messages.contains(document.activeElement) ? document.activeElement : null,
    previousTop = focused?.getBoundingClientRect().top;
  feedbackOwner = owner;
  for (const [name, id, cancel] of [
    ['editor', 'editor-status', 'cancel-import'],
    ['replay', 'replay-status', 'cancel-replay'],
    ['preview', 'preview-load-status', null],
  ]) {
    const message = $(id),
      pending = cancel ? !$(cancel).hidden : previewLease !== null;
    message.hidden = owner !== name && !pending && !message.contains(document.activeElement);
    message.style.order = owner === name ? '-1' : '0';
  }
  if (changedOwner) {
    // Expose a new owner's message without moving the page or disturbing a
    // message already being read. Progress updates retain the reader's scroll.
    if (focused) messages.scrollTop += focused.getBoundingClientRect().top - previousTop;
    else messages.scrollTop = 0;
  }
  editorClearance?.refresh();
}
let campaign,
  themes,
  current,
  baseEntry,
  catalog = [],
  activeKey = 'builtin',
  packLibrary = emptyPackLibrary(),
  editRevision = 0,
  brush = 'wall',
  history = [],
  revision = 0,
  width = 390,
  height = 844,
  importEpoch = 0,
  pendingImport = null,
  pendingTicket = null,
  previousPreviewHref = null,
  replayEpoch = 0,
  replayController = null;
const beginImport = (message = t('tools:validatingAndDecodingTheSelectedContent')) => {
  if (pendingImport === null) previousPreviewHref = $('open-preview').getAttribute('href');
  const ticket = { epoch: ++importEpoch, editRevision, before: JSON.stringify(current) };
  pendingImport = ticket.epoch;
  pendingTicket = ticket;
  $('cancel-import').hidden = false;
  $('preview-button').disabled = true;
  $('preview-mode').disabled = true;
  $('open-preview').setAttribute('aria-disabled', 'true');
  $('open-preview').removeAttribute('href');
  status(message, false, true);
  return ticket;
};
const finishImport = (ticket) => {
  if (pendingImport !== ticket.epoch) return;
  pendingImport = null;
  pendingTicket = null;
  $('cancel-import').hidden = true;
  $('preview-button').disabled = false;
  $('preview-mode').disabled = false;
  $('open-preview').removeAttribute('aria-disabled');
  if (previousPreviewHref !== null) $('open-preview').setAttribute('href', previousPreviewHref);
  previousPreviewHref = null;
  showFeedback();
};
const importCurrent = (ticket) => ticket.epoch === importEpoch;
const assertImportCurrent = (ticket) => {
  if (
    !importCurrent(ticket) ||
    ticket.editRevision !== editRevision ||
    JSON.stringify(current) !== ticket.before
  )
    throw new Error(t('tools:thePackChangedWhileThisImportWasBeingReadRetry'));
};
const editorPresenter = createOperationStatus($('editor-status')),
  replayPresenter = createOperationStatus($('replay-status')),
  previewPresenter = createOperationStatus($('preview-load-status'));
const status = (message, error = false, busy = false) => {
  const lease = editorPresenter.begin({ message });
  if (!busy) lease.finish({ message, state: error ? 'error' : 'ready' });
  $('editor-status').classList.toggle('error', error);
  showFeedback('editor');
  return lease;
};
const cancelImport = () => {
  if (!pendingTicket) return;
  finishImport(pendingTicket);
  importEpoch++;
  status(t('tools:preparationCancelledTheWorkingMapAndPreviousPreviewAreUnchanged'));
};
$('cancel-import').onclick = cancelImport;
$('cancel-replay').onclick = () => {
  const wasPending = !$('cancel-replay').hidden;
  replayEpoch++;
  replayController?.abort();
  replayPresenter
    .begin({ message: '' })
    .finish({ message: t('tools:replayVerificationCancelled'), state: 'cancelled' });
  $('cancel-replay').hidden = true;
  showFeedback(wasPending ? 'replay' : feedbackOwner);
};
window.addEventListener('pagehide', () => {
  editorClearance?.destroy();
  editorClearance = null;
  cancelImport();
  $('cancel-replay').onclick();
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted && !editorClearance) {
    editorClearance = keepEditorFocusClear();
    editorClearance.refresh();
  }
});
let previewLease = null,
  previewDocumentLoaded = false;
function beginPreview() {
  previewDocumentLoaded = false;
  clearLiveMeasurements('tools:waitingForTheCurrentPreviewDocument');
  geometryStale(t('tools:aNewPreviewIsLoadingCaptureAgainAfterItIs'));
  previewLease = previewPresenter.begin({ message: t('tools:loadingTheChildGameForThisPreview') });
  showFeedback('preview');
}
function checkPreviewReady() {
  if (!previewDocumentLoaded || !previewLease) return;
  try {
    const child = $('preview-frame').contentDocument;
    const state =
      child?.documentElement?.dataset.bootState ?? child?.documentElement?.dataset.toolState;
    if (state === 'ready') {
      previewLease.finish({ message: t('tools:previewGameReadyPracticeProgressStaysSeparate') });
      previewLease = null;
      showFeedback();
    } else if (state === 'failed' || state === 'error' || state === 'file') {
      previewLease.finish({
        message: t('tools:theChildGameCouldNotStartUseItsRecoveryControls'),
        state: 'error',
      });
      previewLease = null;
      showFeedback();
    }
  } catch {
    /* The frame itself retains its direct navigation/recovery controls. */
  }
}
status(t('tools:loadingCampaignsThemesAndClassRecipes'), false, true);
const remember = () => {
  editRevision++;
  history.push({ current: clone(current), catalog, activeKey, packLibrary });
  while (
    history.length > 1 &&
    (history.length > 20 ||
      history.reduce(
        (n, item) =>
          n + JSON.stringify(item.current).length + exportPackLibrary(item.packLibrary).length,
        0,
      ) >
        32 * 1024 * 1024)
  )
    history.shift();
  $('undo-button').disabled = false;
};
const selectedEntry = () => catalog.find((entry) => entry.key === activeKey) ?? baseEntry;
const currentTrack = () => current.music;

function useEntry(key, levelId) {
  const entry = catalog.find((item) => item.key === key);
  if (!entry) throw new Error(t('tools:thisCampaignSourceIsUnavailable'));
  current = entryScenario(entry, levelId, current?.settings, current?.presentation);
  activeKey = key;
  campaign = entry.campaign;
  themes = { themes: entry.themes };
}
async function adoptDocument(candidate, message, ticket = beginImport()) {
  try {
    assertImportCurrent(ticket);
    status(t('tools:validatingContentAndDecodingItsOriginalImages'), false, true);
    const prepared = await prepareDocument(candidate, { current, packLibrary });
    assertImportCurrent(ticket);
    remember();
    if (prepared.kind === 'expansion') {
      packLibrary = prepared.packLibrary;
      catalog = [baseEntry, ...prepared.entries];
      activeKey = prepared.activeKey;
      campaign = selectedEntry().campaign;
      themes = { themes: selectedEntry().themes };
    }
    current = editorScenario(prepared.scenario);
    sync();
    status([message, ...prepared.warnings].join(' '));
    return prepared;
  } finally {
    finishImport(ticket);
  }
}
function sync() {
  $('campaign-select').replaceChildren(
    ...catalog.map((entry) => localizedOption(() => entry.label, entry.key)),
  );
  $('campaign-select').value = activeKey;
  localizedText($('source-readout'), () =>
    t('tools:mapsEditingAWorkingCopyUndoReturnsToThePrevious', {
      value1: selectedEntry().label,
      value2: campaign.levels.length,
    }),
  );
  $('export-catalog').disabled = !packLibrary.packs.length;
  const definition = current.masteryDefinition;
  const noMasteries = [
    'xonix-playground.v3',
    'xonix-playground.v4',
    'xonix-playground.v5',
    'xonix-playground.v6',
    'xonix-playground.v7',
    'xonix-playground.v8',
    'xonix-playground.v9',
  ].includes(current.format);
  $('mastery-json').value = definition ? JSON.stringify(definition, null, 2) : '';
  localizedText($('mastery-readout'), () =>
    current.format === 'xonix-playground.v9'
      ? t('tools:sentinelEditionCaptureEveryShieldRelayBeforeTheCoreOpening')
      : current.format === 'xonix-playground.v8'
        ? t('tools:directionalEditionMarkedUnclaimedFieldsChangeCraftSpeedWithOr')
        : current.format === 'xonix-playground.v7'
          ? t('tools:relayEditionCaptureEachLinkedObjectiveToOpenPermanentReclaimed')
          : current.format === 'xonix-playground.v6'
            ? t('tools:foundationEditionReclaimedIslandsAndLanesArePermanentReturnGround')
            : current.format === 'xonix-playground.v5'
              ? t('tools:classicEditionTerrainContactPickupsAndEnemyRolesStayIn')
              : current.format === 'xonix-playground.v4'
                ? t('tools:wideEditionOptionalEquipmentGoalsAreUnavailableTheMapRetains')
                : current.format === 'xonix-playground.v3'
                  ? t('tools:stagedEncounterThisRulesetHasNoOptionalEquipmentGoalsIts')
                  : current.format === 'xonix-playground.v2'
                    ? definition
                      ? t('tools:referencesValidateAgainstThisMapAndRosterPlayTheRoute', {
                          value1: definition.name,
                          value2: definition.description,
                        })
                      : t('tools:noOptionalGoalThisExplicitChoiceIsRetainedInPractice')
                    : t('tools:legacyScenarioOnlyExactShippedContentCanUseItsBuilt'),
  );
  $('use-campaign-goal').disabled = noMasteries || !entryMastery(selectedEntry(), current.level.id);
  $('apply-mastery').disabled = noMasteries;
  $('clear-goal').disabled = noMasteries;
  const encounter = current.level.encounter;
  $('encounter-fields').disabled = !encounter || encounter.version === 'xonix-encounter.v2';
  localizedText($('encounter-readout'), () =>
    encounter?.version === 'xonix-encounter.v2'
      ? t('tools:playground.sentinelEncounter', {
          count: encounter.shieldObjectiveIds.length,
        })
      : encounter
        ? t('tools:twoStageRelayCloseNewTrailCellsDuringAnOpening', {
            value1: encounter.minReleaseCutCells,
            value2: encounter.minReleaseCutCells,
          })
        : t('tools:loadSentinelRelayFromTheExpansionExamplesToEditIts2'),
  );
  if (encounter?.version === 'xonix-encounter.v1')
    for (const [id, value] of [
      ['enemy', encounter.enemyId],
      ['shield', encounter.shieldObjectiveId],
      ['core', encounter.coreObjectiveId],
      ['cut', encounter.minReleaseCutCells],
      ['width', encounter.laneWidth],
      ['delay', encounter.initialDelayTicks],
      ['transition', encounter.transitionTicks],
      ['shield-warning', encounter.shielded.warningTicks],
      ['shield-active', encounter.shielded.activeTicks],
      ['shield-rest', encounter.shielded.restTicks],
      ['core-warning', encounter.exposed.warningTicks],
      ['core-active', encounter.exposed.activeTicks],
      ['core-open', encounter.exposed.openTicks],
    ])
      $(`encounter-${id}`).value = value;
  const track = currentTrack();
  localizedText($('music-readout'), () =>
    track
      ? t('tools:packMusicBpmThisExactDescriptorIsUsedInPractice', {
          value1: track.name,
          value2: track.genre,
          value3: track.tempo,
        })
      : t('tools:originalSynthesizedMusicIsConfiguredInTheGameAudioControls'),
  );
  for (const [id, key, fallback] of [
    ['mission-limit', 'timeLimitSeconds', 0],
    ['cut-limit', 'cutTimeLimitSeconds', 0],
    ['trail-limit', 'maxTrailCells', 0],
    ['switch-limit', 'switchCooldownSeconds', 2],
  ])
    $(id).value = current.level.rules?.[key] ?? fallback;
  const index = campaign.levels.findIndex((level) => level.id === current.level.id);
  $('level-select').replaceChildren(
    ...campaign.levels.map((level, i) =>
      localizedOption(
        () =>
          `${String(i + 1).padStart(2, '0')} / ${i === index ? current.level.name : level.name}`,
        String(i),
      ),
    ),
  );
  if (index < 0) $('level-select').append(localizedOption(() => current.level.name, 'custom'));
  $('level-select').value = index < 0 ? 'custom' : String(index);
  $('theme-select').replaceChildren(
    ...themes.themes.map((theme) =>
      localizedOption(
        () => (theme.id === current.theme.id ? current.theme.name : theme.name),
        theme.id,
      ),
    ),
  );
  if (!themes.themes.some((theme) => theme.id === current.theme.id))
    $('theme-select').append(localizedOption(() => current.theme.name, current.theme.id));
  $('theme-select').value = current.theme.id;
  $('terrain-style').value = current.presentation?.style || 'hybrid';
  $('show-grid').checked = current.presentation?.showGrid || false;
  $('goal-input').value = Math.round(current.level.goal.coverage * 100);
  $('speed-input').value = current.level.rules?.moveSpeed ?? 8;
  $('lives-input').value = current.level.rules?.lives ?? 3;
  $('class-select').replaceChildren();
  for (const c of current.classRecipes)
    $('class-select').append(localizedOption(() => c.label, c.id));
  $('class-select').value = current.settings.classId;
  $('turn-select').value = current.settings.turnPolicy;
  $('level-json').value = JSON.stringify(current.level, null, 2);
  $('theme-json').value = JSON.stringify(current.theme, null, 2);
  $('classes-json').value = JSON.stringify(current.classRecipes, null, 2);
  $('music-json').value = current.music ? JSON.stringify(current.music, null, 2) : '';
  drawMap();
  drawAssets();
}
function drawMap() {
  const { hangarCount } = paintEditorMap($('map-editor'), current);
  renderMapDiagnostics($('map-diagnostic-list'), current.level);
  const { width: columns, height: rows } = geometryForLevel(current.level);
  $('paint-x').max = String(columns - 1);
  $('paint-y').max = String(rows - 1);
  $('trail-limit').max = String((columns - 2) * (rows - 2));
  localizedText($('map-readout'), () =>
    t('tools:cellsWallRectanglesEnemiesObjectivesSignalZonesHangarsStart', {
      value1: columns,
      value2: rows,
      value3: current.level.walls.length,
      value4: current.level.enemies.length,
      value5: current.level.objectives.length,
      value6: current.level.signalZones?.length ?? 0,
      value7: hangarCount,
      value8: current.level.spawn.x,
      value9: current.level.spawn.y,
    }),
  );
}
const visualRoleLabels = {
  get background() {
    return t('tools:revealBackground');
  },
  get player() {
    return t('tools:playerBody');
  },
  get enemy() {
    return t('tools:fieldEnemy');
  },
  get patrol() {
    return t('tools:borderPatrol');
  },
  get boss() {
    return t('tools:boss');
  },
  get objective() {
    return t('tools:objectiveSupport');
  },
  get supply() {
    return t('tools:supplyPad');
  },
  get wall() {
    return t('tools:wallTile');
  },
  get contour() {
    return t('tools:contourPatrol');
  },
  get rover() {
    return t('tools:claimedRover');
  },
  get eroder() {
    return t('tools:eroder');
  },
  get slowTerrain() {
    return t('tools:slowTerrain');
  },
  get lethalTerrain() {
    return t('tools:lethalTerrain');
  },
  get lifePickup() {
    return t('tools:extraLifePickup');
  },
  get speedPickup() {
    return t('tools:playerSpeedPickup');
  },
  get slowPickup() {
    return t('tools:enemySlowPickup');
  },
  get freezePickup() {
    return t('tools:enemyFreezePickup');
  },
};
function drawAssets() {
  const select = $('asset-role'),
    prior = select.value;
  const roles = [
    'xonix-playground.v5',
    'xonix-playground.v6',
    'xonix-playground.v7',
    'xonix-playground.v8',
    'xonix-playground.v9',
  ].includes(current.format)
    ? [...VISUAL_ROLES, ...CLASSIC_VISUAL_ROLES]
    : VISUAL_ROLES;
  select.replaceChildren(...roles.map((role) => new Option(visualRoleLabels[role], role)));
  select.value = roles.includes(prior) ? prior : 'background';
  $('asset-list').replaceChildren();
  for (const [role, item] of Object.entries(current.visualOverrides)) {
    const card = document.createElement('div');
    card.className = 'asset-card';
    const img = document.createElement('img');
    img.src = item.dataUrl;
    localizedAttribute(img, 'alt', () => t('tools:replacementFor', { value1: role }));
    const name = document.createElement('span');
    localizedText(name, () => `${role} / ${item.name || t('tools:image')}`);
    card.append(img, name);
    $('asset-list').append(card);
  }
}
async function adopt(candidate, message, ticket = beginImport()) {
  try {
    assertImportCurrent(ticket);
    status(t('tools:validatingTheScenarioAndDecodingItsArtwork'), false, true);
    const prepared = await prepareScenario(candidate);
    assertImportCurrent(ticket);
    remember();
    current = editorScenario(prepared.scenario);
    sync();
    status([message, ...prepared.warnings].join(' '));
    return prepared;
  } finally {
    finishImport(ticket);
  }
}
function checked() {
  const result = validateScenario(current);
  if (!result.valid) {
    status(result.errors.join('\n'), true);
    return false;
  }
  return true;
}
function preview() {
  if (pendingImport !== null) {
    status(t('tools:theSelectedContentIsStillBeingPreparedWaitForValidation'));
    return false;
  }
  if ($('preview-mode').value === 'course') {
    try {
      const href = firstFlightPreviewURL({ turnPolicy: $('turn-select').value });
      beginPreview();
      $('preview-frame').src = href;
      $('open-preview').href = href;
      status(t('tools:firstFlightCourseUsesThreeFixedPracticeLessonsYourEditor'));
      showFeedback('preview');
      return true;
    } catch (error) {
      status(t('tools:coursePreviewWasNotReplaced', { value1: error.message }), true);
      return false;
    }
  }
  if ($('preview-mode').value === 'couch') {
    beginPreview();
    $('preview-frame').src = '../couch/?journey=legacy&focus=1';
    $('open-preview').href = '../couch/?journey=legacy&focus=1';
    status(t('tools:couchPreviewUsesInstalledMapsAndPacksSoloConfigurationStays'));
    showFeedback('preview');
    return true;
  }
  if (!checked()) return false;
  try {
    sessionStorage.setItem('revealline.playground.current', JSON.stringify(current));
    beginPreview();
    $('preview-frame').src = `../?practice=1&revision=${++revision}`;
    $('open-preview').href = `../?practice=1&revision=${revision}`;
    status(() =>
      [
        t('tools:playground.validConfigurationPrepared'),
        ...validateScenario(current).warnings,
      ].join(' '),
    );
    showFeedback('preview');
    return true;
  } catch (error) {
    status(
      t('tools:previewCouldNotSaveThisLocalPackTrySmallerImages', { value1: error.message }),
      true,
    );
    return false;
  }
}
function fit() {
  geometryStale(t('tools:previewSizeOrDisplayScaleChangedCaptureAgainForCurrent'));
  const available = $('preview-stage').parentElement.clientWidth,
    scale = Math.min(1, available / width),
    frame = $('preview-frame');
  frame.width = width;
  frame.height = height;
  frame.style.transform = `scale(${scale})`;
  $('preview-stage').style.width = `${width * scale}px`;
  $('preview-stage').style.height = `${height * scale}px`;
  localizedText($('viewport-readout'), () =>
    t('tools:cssPixelsShownAt', { value1: width, value2: height, value3: Math.round(scale * 100) }),
  );
  measure();
}
function resizePreview(nextWidth, nextHeight) {
  // Validate both before adopting either dimension. The iframe URL and run stay intact.
  const next = resolvePreviewSize(nextWidth, nextHeight);
  width = next.width;
  height = next.height;
  $('preview-width').value = String(width);
  $('preview-height').value = String(height);
  document.querySelectorAll('[data-size]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.size === `${width},${height}`));
  });
  $('preview-size-status').classList.remove('error');
  localizedText($('preview-size-status'), () =>
    t('tools:previewSetToCssPixels', { value1: width, value2: height }),
  );
  fit();
}
function clearLiveMeasurements(reasonKey) {
  localizedText($('viewport-readout'), () =>
    t('tools:playground.viewportMeasurementUnavailable', {
      width,
      height,
      reason: t(reasonKey),
    }),
  );
  localizedText($('layout-readout'), () =>
    t('tools:playground.arenaMeasurementUnavailable', { reason: t(reasonKey) }),
  );
  localizedText($('control-readout'), () =>
    t('tools:playground.controlMeasurementsUnavailable', { reason: t(reasonKey) }),
  );
  localizedText($('launch-readout'), () =>
    t('tools:playground.launchMeasurementsUnavailable', { reason: t(reasonKey) }),
  );
}
function measure() {
  checkPreviewReady();
  if (!previewDocumentLoaded) {
    clearLiveMeasurements('tools:waitingForTheCurrentPreviewDocument');
    return;
  }
  try {
    const frame = $('preview-frame'),
      doc = frame.contentDocument,
      view = frame.contentWindow,
      arena = doc?.querySelector('#arena-shell,#race-boards');
    const measurable = (rect) =>
      ['left', 'top', 'right', 'bottom', 'width', 'height'].every((key) =>
        Number.isFinite(rect[key]),
      ) &&
      rect.width > 0 &&
      rect.height > 0;
    if (
      !arena ||
      !view ||
      ![view.innerWidth, view.innerHeight].every((size) => Number.isFinite(size) && size > 0)
    ) {
      clearLiveMeasurements('tools:theCurrentFrameAndArenaAreNotAvailable');
      return;
    }
    const r = arena.getBoundingClientRect();
    if (!measurable(r)) {
      clearLiveMeasurements('tools:theCurrentArenaHasNoMeasurableBounds');
      return;
    }
    localizedText($('viewport-readout'), () =>
      t('tools:cssPixelsRequestedFrameReportsShownAt', {
        value1: width,
        value2: height,
        value3: view.innerWidth,
        value4: view.innerHeight,
        value5: Math.round(Math.min(1, $('preview-stage').parentElement.clientWidth / width) * 100),
      }),
    );
    const visible =
      r.left >= 0 &&
      r.top >= 0 &&
      r.right <= view.innerWidth + 1 &&
      r.bottom <= view.innerHeight + 1;
    localizedText($('layout-readout'), () =>
      t('tools:arenaTopBottom', {
        value1: r.width.toFixed(1),
        value2: r.height.toFixed(1),
        value3: r.top.toFixed(0),
        value4: r.bottom.toFixed(0),
        value5: t(
          visible
            ? 'tools:playground.wholeArenaVisible'
            : 'tools:playground.scrollNeededForWholeArena',
        ),
        value6: t(
          doc.documentElement.scrollWidth > view.innerWidth
            ? 'tools:playground.horizontalOverflow'
            : 'tools:playground.noHorizontalOverflow',
        ),
      }),
    );
    const controls = [
      ...doc.querySelectorAll(
        '[data-move],#stop-button,#action-button,#pickup-button,#boost-button,#pause-button,#restart-button,#sound-button,.race-pad button,#race-start,#race-pause,#race-focus',
      ),
    ]
      .map((button) => button.getBoundingClientRect())
      .filter(measurable);
    const reachable = controls.every(
      (r) =>
        r.left >= 0 &&
        r.top >= 0 &&
        r.right <= view.innerWidth + 1 &&
        r.bottom <= view.innerHeight + 1,
    );
    localizedText($('control-readout'), () =>
      controls.length
        ? t('tools:playground.measuredControlBoxes', {
            count: controls.length,
            width: Math.min(...controls.map((r) => r.width)).toFixed(0),
            height: Math.min(...controls.map((r) => r.height)).toFixed(0),
            reachability: t(
              reachable
                ? 'tools:playground.allMeasuredBoxesInsideViewport'
                : 'tools:playground.someMeasuredBoxesOutsideViewport',
            ),
          })
        : t('tools:controlsNoMeasurableActionBoxesInThisPreview'),
    );
    const launchVisible = (button, b) => {
      if (
        b.left < 0 ||
        b.top < 0 ||
        b.right > view.innerWidth + 1 ||
        b.bottom > view.innerHeight + 1
      )
        return false;
      const hit = doc.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return hit === button || button.contains(hit);
    };
    const launch = [...doc.querySelectorAll('#game-overlay button:not([hidden])')]
      .map((button) => ({
        button,
        label: button.textContent.trim(),
        rect: button.getBoundingClientRect(),
      }))
      .filter(({ rect }) => measurable(rect));
    localizedText($('launch-readout'), () =>
      launch.length
        ? t('tools:launchActions', {
            value1: launch
              .map(({ button, label, rect: b }) =>
                t('tools:playground.launchActionMeasurement', {
                  label,
                  width: b.width.toFixed(0),
                  height: b.height.toFixed(0),
                  visibility: t(
                    launchVisible(button, b)
                      ? 'tools:playground.visibleInViewport'
                      : 'tools:playground.scrollNeededOrCovered',
                  ),
                }),
              )
              .join('; '),
          })
        : t('tools:noMeasurableLaunchActionsInThisPreview'),
    );
  } catch {
    clearLiveMeasurements('tools:theCurrentPreviewCannotBeMeasuredFromThePlayground');
  }
}
let geometryCaptured = false;
let geometryDocument = null;
let geometryView = null;
function geometryStale(message = t('tools:previewActivityMayHaveChangedThisSnapshotCaptureAgain')) {
  if (geometryCaptured)
    localizedText($('geometry-status'), () =>
      t('tools:previousCaptureRetained', { value1: message }),
    );
}
function geometryActivity() {
  geometryStale();
}
function observeGeometryPreview() {
  geometryDocument?.removeEventListener('click', geometryActivity);
  geometryDocument?.removeEventListener('keydown', geometryActivity);
  geometryView?.removeEventListener('scroll', geometryActivity);
  geometryView?.removeEventListener('resize', geometryActivity);
  geometryDocument = null;
  geometryView = null;
  geometryStale(t('tools:previewDocumentReloadedCaptureAgain'));
  try {
    geometryDocument = $('preview-frame').contentDocument;
    geometryView = $('preview-frame').contentWindow;
    geometryDocument?.addEventListener('click', geometryActivity);
    geometryDocument?.addEventListener('keydown', geometryActivity);
    geometryView?.addEventListener('scroll', geometryActivity, { passive: true });
    geometryView?.addEventListener('resize', geometryActivity);
  } catch {
    geometryStale(t('tools:thisPreviewCannotBeMeasuredFromThePlayground'));
  }
}
function captureGeometry() {
  try {
    const frame = $('preview-frame');
    const report = captureControlGeometry({
      document: frame.contentDocument,
      view: frame.contentWindow,
      requested: { width, height },
      displayScale: Math.min(1, $('preview-stage').parentElement.clientWidth / width),
    });
    localizedText($('geometry-readout'), () => JSON.stringify(report, null, 2));
    geometryCaptured = true;
    localizedText($('geometry-status'), () =>
      t('tools:capturedSnapshotOnlyConfigurationAndRunAreNotEdited', {
        value1: report.capturedAt,
        value2: $('preview-mode').value === 'course' ? ` · ${t('tools:firstFlightCourse')}` : '',
      }),
    );
  } catch (error) {
    geometryCaptured = false;
    localizedText($('geometry-readout'), () => '');
    localizedText($('geometry-status'), () =>
      t('tools:captureUnavailable', { value1: error.message }),
    );
  }
}
try {
  [campaign, themes] = await Promise.all([
    fetch('../content/campaign.json').then((r) => r.json()),
    fetch('../content/themes.json').then((r) => r.json()),
  ]);
  const recipes = await fetch('../content/classes.json').then((r) => r.json());
  current = {
    format:
      campaign.levels[0].version === 'xonix-level.v8'
        ? 'xonix-playground.v9'
        : campaign.levels[0].version === 'xonix-level.v7'
          ? 'xonix-playground.v8'
          : campaign.levels[0].version === 'xonix-level.v6'
            ? 'xonix-playground.v7'
            : campaign.levels[0].version === 'xonix-level.v5'
              ? 'xonix-playground.v6'
              : campaign.levels[0].version === 'xonix-level.v4'
                ? 'xonix-playground.v5'
                : campaign.levels[0].version === 'xonix-level.v3'
                  ? 'xonix-playground.v4'
                  : 'xonix-playground.v1',
    ...([
      'xonix-level.v3',
      'xonix-level.v4',
      'xonix-level.v5',
      'xonix-level.v6',
      'xonix-level.v7',
      'xonix-level.v8',
    ].includes(campaign.levels[0].version)
      ? { masteryDefinition: null }
      : {}),
    level: clone(campaign.levels[0]),
    theme: clone(themes.themes[0]),
    settings: { classId: 'scout', turnPolicy: 'immediate', seed: 1 },
    classRecipes: recipes,
    presentation: { style: 'hybrid', showGrid: false },
    visualOverrides: {},
  };
  current = editorScenario(current);
  baseEntry = {
    key: 'builtin',
    get label() {
      return t('tools:builtInCampaign');
    },
    campaign,
    themes: themes.themes,
    classRecipes: recipes,
    visualOverrides: {},
    levelVisuals: [],
    music: [],
  };
  catalog = [baseEntry];
  $('campaign-select').onchange = () => {
    try {
      remember();
      useEntry($('campaign-select').value);
      sync();
      status(t('tools:campaignSourceSelectedPlayConfigurationToTestThisMap'));
    } catch (error) {
      status(error.message, true);
    }
  };
  document.querySelectorAll('[data-preset]').forEach(
    (button) =>
      (button.onclick = async () => {
        const ticket = beginImport();
        try {
          const preset = interactionPreset(button.dataset.preset, current, recipes);
          await adopt(
            preset,
            t('tools:interactionPresetReadyWithoutAnOptionalGoalPlayConfigurationTo'),
            ticket,
          );
          localizedText($('preset-readout'), () =>
            t('tools:new4836StandardPracticeMap', { value1: PRESET_HELP[button.dataset.preset] }),
          );
          preview();
        } catch (error) {
          if (importCurrent(ticket)) status(error.message, true);
        } finally {
          finishImport(ticket);
        }
      }),
  );
  for (const [id, name] of [
    ['tactical-read-clearing', t('tools:readTheClearingScout')],
    ['tactical-borrowed-seconds', t('tools:borrowedSecondsLightCarrier')],
    ['tactical-quiet-crossing', t('tools:quietCrossingFiberRelay')],
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button secondary';
    button.dataset.teachingScenario = id;
    localizedText(button, () => t('tools:load', { value1: name }));
    button.onclick = async () => {
      const ticket = beginImport();
      try {
        const response = await fetch(
          `../../authoring/library/tactical-teaching/scenarios/${id}.json`,
        );
        if (!response.ok)
          throw new Error(t('tools:teachingScenarioIsUnavailableReloadThisEdition'));
        await adoptDocument(
          await response.json(),
          t('tools:teachingScenarioReadyReadItsInstructionsThenPlayConfigurationPractice'),
          ticket,
        );
      } catch (error) {
        if (importCurrent(ticket)) status(error.message, true);
      } finally {
        finishImport(ticket);
      }
    };
    $('teaching-examples').append(button);
  }
  const exampleStatus = document.createElement('p');
  $('example-packs').append(exampleStatus);
  const examples = createOperationStatus(exampleStatus).begin({
    message: t('tools:loadingExamplePackChoices'),
  });
  fetch('../content/packs/index.json')
    .then((r) => {
      if (!r.ok) throw new Error(t('tools:exampleListUnavailable'));
      return r.json();
    })
    .then((index) => {
      examples.finish({ message: '' });
      // The role lab is an explicit authoring example, separate from campaign progression.
      for (const entry of [...index.packs, { id: 'classic-lab', path: 'classic-lab.json' }]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'button secondary';
        localizedText(button, () => t('tools:load', { value1: entry.id.replaceAll('-', ' ') }));
        button.onclick = async () => {
          const ticket = beginImport();
          try {
            const response = await fetch(`../content/packs/${entry.path}`);
            if (!response.ok) throw new Error(t('tools:exampleExpansionIsUnavailable'));
            await adoptDocument(
              await response.json(),
              t('tools:expansionDecodedSelectACampaignMapThemeAndClassAbove'),
              ticket,
            );
          } catch (error) {
            if (importCurrent(ticket)) status(error.message, true);
          } finally {
            finishImport(ticket);
          }
        };
        $('example-packs').append(button);
      }
    })
    .catch((error) =>
      examples.finish({
        message: localizedMessage('tools:playground.examplesLoadFailed', {
          message: error.message,
        }),
        state: 'error',
      }),
    );
  campaign.levels.forEach((l, i) =>
    $('level-select').append(
      localizedOption(() => `${String(i + 1).padStart(2, '0')} / ${l.name}`, String(i)),
    ),
  );
  for (const t of themes.themes) $('theme-select').append(localizedOption(() => t.name, t.id));
  $('level-select').onchange = () => {
    remember();
    const level = campaign.levels[Number($('level-select').value)];
    if (level) useEntry(activeKey, level.id);
    sync();
    status(t('tools:levelSelectedPlayConfigurationToTestIt'));
  };
  $('theme-select').onchange = () => {
    remember();
    current.theme = clone(
      themes.themes.find((t) => t.id === $('theme-select').value) || current.theme,
    );
    sync();
  };
  $('terrain-style').onchange = () => {
    remember();
    current.presentation = { ...current.presentation, style: $('terrain-style').value };
  };
  $('show-grid').onchange = () => {
    remember();
    current.presentation = { ...current.presentation, showGrid: $('show-grid').checked };
  };
  $('class-select').onchange = () => {
    remember();
    current.settings.classId = $('class-select').value;
  };
  $('apply-mastery').onclick = async () => {
    const ticket = beginImport();
    try {
      const definition = JSON.parse($('mastery-json').value);
      await adopt(
        withScenarioMastery(current, definition),
        t('tools:optionalGoalValidatedAndAppliedPlayConfigurationToTestIts'),
        ticket,
      );
    } catch (error) {
      if (importCurrent(ticket)) status(t('tools:goalRejected', { value1: error.message }), true);
    } finally {
      finishImport(ticket);
    }
  };
  $('clear-goal').onclick = () => {
    const next = withScenarioMastery(current, null);
    remember();
    current = next;
    sync();
    status(t('tools:optionalGoalDisabledExplicitlyUndoRestoresThePreviousDefinition'));
  };
  $('use-campaign-goal').onclick = () => {
    try {
      const definition = entryMastery(selectedEntry(), current.level.id);
      if (!definition) throw new Error(t('tools:thisSourceMapHasNoRegisteredGoal'));
      const next = withScenarioMastery(current, definition);
      remember();
      current = next;
      sync();
      status(t('tools:campaignGoalCopiedIntoThisEditableScenarioChangesApplyTo'));
    } catch (error) {
      status(t('tools:goalRejected', { value1: error.message }), true);
    }
  };
  $('apply-encounter').onclick = () => {
    try {
      if (!current.level.encounter) throw new Error(t('tools:loadAStagedEncounterFirst'));
      if (current.level.encounter.version !== 'xonix-encounter.v1')
        throw new Error(t('tools:useContentStudioToEditTheVersionedMultiRelayEncounter'));
      const number = (id) => Number($(`encounter-${id}`).value);
      const next = withScenarioEncounter(current, {
        ...current.level.encounter,
        enemyId: $('encounter-enemy').value,
        shieldObjectiveId: $('encounter-shield').value,
        coreObjectiveId: $('encounter-core').value,
        minReleaseCutCells: number('cut'),
        laneWidth: number('width'),
        initialDelayTicks: number('delay'),
        transitionTicks: number('transition'),
        shielded: {
          warningTicks: number('shield-warning'),
          activeTicks: number('shield-active'),
          restTicks: number('shield-rest'),
        },
        exposed: {
          warningTicks: number('core-warning'),
          activeTicks: number('core-active'),
          openTicks: number('core-open'),
        },
      });
      remember();
      current = next;
      sync();
      status(t('tools:encounterValidatedAndAppliedPlayConfigurationToTestTheTiming'));
    } catch (error) {
      status(t('tools:encounterRejected', { value1: error.message }), true);
    }
  };
  $('remove-encounter').onclick = () => {
    try {
      const next = withoutScenarioEncounter(current);
      remember();
      current = next;
      sync();
      status(t('tools:convertedToAnOrdinaryMapTheSentinelWasRemovedBoth'));
    } catch (error) {
      status(t('tools:conversionRejected', { value1: error.message }), true);
    }
  };
  $('turn-select').onchange = () => {
    remember();
    current.settings.turnPolicy = $('turn-select').value;
  };
  for (const [id, key] of [
    ['speed-input', 'moveSpeed'],
    ['lives-input', 'lives'],
    ['mission-limit', 'timeLimitSeconds'],
    ['cut-limit', 'cutTimeLimitSeconds'],
    ['trail-limit', 'maxTrailCells'],
    ['switch-limit', 'switchCooldownSeconds'],
  ])
    $(id).onchange = () => {
      try {
        const next = editScenario(current, {
          level: {
            ...current.level,
            rules: { ...current.level.rules, [key]: Number($(id).value) },
          },
        });
        remember();
        current = next;
        sync();
      } catch (error) {
        sync();
        status(t('tools:editRejected', { value1: error.message }), true);
      }
    };
  $('goal-input').onchange = () => {
    try {
      const next = editScenario(current, {
        level: {
          ...current.level,
          goal: { ...current.level.goal, coverage: Number($('goal-input').value) / 100 },
        },
      });
      remember();
      current = next;
      sync();
    } catch (error) {
      sync();
      status(t('tools:editRejected', { value1: error.message }), true);
    }
  };
  $('generate-button').onclick = async () => {
    const ticket = beginImport(t('tools:generatingAndValidatingTheNewMap'));
    try {
      const level = await generateLevel($('seed-input').value);
      assertImportCurrent(ticket);
      const next = editScenario(current, {
        ...([
          'xonix-playground.v3',
          'xonix-playground.v4',
          'xonix-playground.v5',
          'xonix-playground.v6',
          'xonix-playground.v7',
          'xonix-playground.v8',
          'xonix-playground.v9',
        ].includes(current.format)
          ? {
              format: 'xonix-playground.v2',
              masteryDefinition: null,
              visualOverrides: visualsForLevelReplacement(current, 'xonix-playground.v2'),
            }
          : {}),
        level,
        settings: { ...current.settings, seed: parseInt(level.id.slice(10, 18), 16) >>> 0 },
      });
      remember();
      current = next;
      sync();
      status(t('tools:new4836StandardMapGeneratedAndValidatedThisReplaces'));
    } catch (error) {
      if (importCurrent(ticket))
        status(
          t('tools:ifTheCurrentGoalNamesObjectsOnThePreviousMap', { value1: error.message }),
          true,
        );
    } finally {
      finishImport(ticket);
    }
  };
  document.querySelectorAll('[data-brush]').forEach(
    (b) =>
      (b.onclick = () => {
        brush = b.dataset.brush;
        document
          .querySelectorAll('[data-brush]')
          .forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      }),
  );
  function paintAt(x, y) {
    try {
      const level = paintLevel(current.level, brush, x, y, {
        signalWidth: Number($('signal-width').value),
        signalHeight: Number($('signal-height').value),
        speedFactor: Number($('signal-speed').value) / 100,
      });
      const next = editScenario(current, { level });
      remember();
      current = next;
      $('paint-x').value = x;
      $('paint-y').value = y;
      sync();
      checked();
      status(t('tools:mapEditedPlayConfigurationToTestTheActualBehavior'));
    } catch (error) {
      status(t('tools:paintRejected', { value1: error.message }), true);
    }
  }
  $('map-editor').addEventListener('pointerdown', (event) => {
    const cell = editorCellFromPointer(
      current.level,
      event.currentTarget,
      event.clientX,
      event.clientY,
    );
    if (cell) paintAt(cell.x, cell.y);
  });
  $('paint-cell').onclick = () => paintAt(Number($('paint-x').value), Number($('paint-y').value));
  $('undo-button').onclick = () => {
    const undo = $('undo-button'),
      ownedFocus = document.activeElement === undo,
      previous = history.pop();
    if (previous) {
      current = previous.current;
      catalog = previous.catalog;
      activeKey = previous.activeKey;
      packLibrary = previous.packLibrary;
      campaign = selectedEntry().campaign;
      themes = { themes: selectedEntry().themes };
      editRevision++;
    }
    undo.disabled = !history.length;
    sync();
    if (checked())
      status(t('tools:previousConfigurationAndSourceRestoredPlayConfigurationToRefreshThe'));
    // Retire only the focus this Undo disabled. A surviving Undo, another
    // reader, or a background page keeps its existing focus ownership.
    if (
      ownedFocus &&
      undo.disabled &&
      !document.hidden &&
      document.hasFocus?.() !== false &&
      [undo, document.body].includes(document.activeElement)
    ) {
      const next = [
        document.querySelector('[data-brush][aria-pressed="true"]'),
        $('paint-cell'),
        $('preview-button'),
      ].find(
        (control) =>
          control?.isConnected &&
          !control.disabled &&
          !control.closest('[hidden], [inert]') &&
          control.getClientRects().length > 0,
      );
      next?.focus();
    }
  };
  $('preview-button').onclick = preview;
  $('open-preview').onclick = (event) => {
    if (!preview()) event.preventDefault();
  };
  $('export-button').onclick = async () => {
    let lease;
    try {
      if (checked()) {
        $('pack-json').value = JSON.stringify(current, null, 2);
        $('pack-json').closest('details').open = true;
        lease = status(t('tools:preparingTheConfigurationDownload'), false, true);
        lease.finish({
          message: (await downloadJSON(current, `${current.level.id}.xonix.json`)).message,
        });
      }
    } catch (error) {
      if (lease) lease.finish({ message: error.message, state: 'error' });
      else status(error.message, true);
    }
  };
  $('import-file').onchange = async () => {
    const file = $('import-file').files[0];
    $('import-file').value = '';
    if (!file) return;
    const ticket = beginImport(t('tools:readingTheSelectedContentFile'));
    try {
      if (file.size > PACK_LIMITS.libraryBytes)
        throw new Error(t('tools:contentIsLargerThan48Mib'));
      const candidate = JSON.parse(await file.text());
      await adoptDocument(
        candidate,
        t('tools:importedAndDecodedThePreviousPackRemainsAvailableThroughUndo'),
        ticket,
      );
    } catch (error) {
      if (importCurrent(ticket)) status(t('tools:importRejected', { value1: error.message }), true);
    } finally {
      finishImport(ticket);
    }
  };
  $('apply-json').onclick = async () => {
    const ticket = beginImport();
    try {
      const candidate = {
        ...current,
        level: JSON.parse($('level-json').value),
        theme: JSON.parse($('theme-json').value),
        classRecipes: JSON.parse($('classes-json').value),
      };
      const trackText = $('music-json').value.trim();
      if (trackText) candidate.music = JSON.parse(trackText);
      else delete candidate.music;
      if (!candidate.classRecipes.some((c) => c.id === candidate.settings.classId))
        candidate.settings = { ...candidate.settings, classId: candidate.classRecipes[0]?.id };
      await adopt(
        candidate,
        t('tools:jsonValidatedAndAppliedPlayConfigurationToCompareIt'),
        ticket,
      );
    } catch (error) {
      if (importCurrent(ticket)) status(error.message, true);
    } finally {
      finishImport(ticket);
    }
  };
  $('asset-file').onchange = async () => {
    const file = $('asset-file').files[0],
      role = $('asset-role').value,
      fit = $('asset-fit').value;
    $('asset-file').value = '';
    if (!file) return;
    const ticket = beginImport(t('tools:readingTheSelectedArtworkFile'));
    try {
      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        file.size > 4 * 1024 * 1024
      )
        throw new Error(t('tools:chooseAPngJpegOrWebpUpTo4Mib'));
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(t('tools:imageFileCouldNotBeRead')));
        reader.readAsDataURL(file);
      });
      const inspected = inspectImageDataUrl(dataUrl);
      if (!inspected.valid) throw new Error(inspected.errors.join(' '));
      const candidate = {
        ...current,
        visualOverrides: { ...current.visualOverrides, [role]: { dataUrl, name: file.name, fit } },
      };
      await adopt(
        candidate,
        t('tools:artworkValidatedAndDecodedPlayConfigurationToSeeItIn'),
        ticket,
      );
      localizedText($('asset-status'), () =>
        t('tools:boundToOriginalBytesUnchanged', {
          value1: file.name,
          value2: inspected.width,
          value3: inspected.height,
          value4: role,
        }),
      );
    } catch (error) {
      if (importCurrent(ticket)) status(error.message, true);
    } finally {
      finishImport(ticket);
    }
  };
  $('clear-asset').onclick = () => {
    remember();
    delete current.visualOverrides[$('asset-role').value];
    drawAssets();
    localizedText($('asset-status'), () => t('tools:roleRestoredToItsAuthoredDefault'));
  };
  $('asset-fit').onchange = () => {
    remember();
    if (current.visualOverrides.background)
      current.visualOverrides.background.fit = $('asset-fit').value;
  };
  $('show-pack').onclick = () => {
    $('pack-json').value = JSON.stringify(current, null, 2);
  };
  $('apply-pack').onclick = async () => {
    const ticket = beginImport();
    try {
      const text = $('pack-json').value;
      if (text.length > PACK_LIMITS.libraryBytes)
        throw new Error(t('tools:contentIsLargerThan48Mib'));
      await adoptDocument(
        text,
        t('tools:contentValidatedDecodedAndAppliedUndoPreservesThePreviousSource'),
        ticket,
      );
    } catch (error) {
      if (importCurrent(ticket)) status(t('tools:importRejected', { value1: error.message }), true);
    } finally {
      finishImport(ticket);
    }
  };
  $('export-expansion').onclick = async () => {
    let lease;
    try {
      if (!checked()) return;
      const track = currentTrack();
      const pack = expansionFromScenario(current, { music: track ? [track] : [] });
      $('pack-json').value = JSON.stringify(pack, null, 2);
      $('pack-json').closest('details').open = true;
      const goal = current.masteryDefinition
        ? localizedMessage('tools:itsGoalNowBelongsToTheNewCampaignTheNew', {
            value1: current.level.id,
          })
        : '';
      lease = status(t('tools:preparingTheExpansionDownload'), false, true);
      const exported = await downloadJSON(pack, `${pack.id}.expansion.json`);
      lease.finish({
        message: localizedMessage('tools:editedMapPreparedAsACompletePlayableExpansionImportIt', {
          value1: goal,
          value2: exported.message,
        }),
      });
    } catch (error) {
      if (lease) lease.finish({ message: error.message, state: 'error' });
      else status(error.message, true);
    }
  };
  $('export-catalog').onclick = async () => {
    let lease;
    try {
      $('pack-json').value = exportPackLibrary(packLibrary);
      $('pack-json').closest('details').open = true;
      lease = status(t('tools:preparingTheExpansionLibraryDownload'), false, true);
      const exported = await downloadJSON(
        JSON.parse($('pack-json').value),
        'workshop-expansions.json',
      );
      lease.finish({
        message: localizedMessage(
          'tools:originalLoadedExpansionLibraryPreparedCurrentMapEditsAreExported',
          { value1: exported.message },
        ),
      });
    } catch (error) {
      if (lease) lease.finish({ message: error.message, state: 'error' });
      else status(error.message, true);
    }
  };
  async function verifyText(readText) {
    const epoch = ++replayEpoch;
    replayController?.abort();
    replayController = new AbortController();
    const signal = replayController.signal;
    const lease = replayPresenter.begin({
      message: t('tools:readingTheSelectedReplay'),
      isCurrent: () => epoch === replayEpoch,
    });
    $('cancel-replay').hidden = false;
    showFeedback('replay');
    try {
      const text = await readText();
      if (text.length > MAX_REPLAY_BYTES) throw new Error(t('tools:replayExceedsTheImportBudget'));
      if (epoch !== replayEpoch) return;
      lease.update({ message: t('tools:verifyingRecordedSimulation') });
      const result = await verifyReplayAsync(text, {
        signal,
        onProgress: (p) => {
          if (epoch === replayEpoch)
            lease.update({
              progress: p.total > 0 ? { completed: p.ticks, total: p.total, unit: 'ticks' } : null,
            });
        },
      });
      if (epoch !== replayEpoch) return;
      localizedText($('replay-result'), () =>
        JSON.stringify(
          { match: result.match, diagnostics: result.diagnostics, actual: result.actual.summary },
          null,
          2,
        ),
      );
      lease.finish({
        message: result.match
          ? t('tools:replayMatchesItsFullRecordedSimulationState')
          : t('tools:replayDiffersCheckTheReportedStateSections'),
        state: result.match ? 'ready' : 'error',
      });
    } catch (error) {
      lease.finish({
        message: localizedMessage('tools:replayRejected', { value1: error.message }),
        state: 'error',
      });
    } finally {
      if (epoch === replayEpoch) {
        $('cancel-replay').hidden = true;
        showFeedback();
      }
    }
  }
  $('replay-file').onchange = () => {
    const file = $('replay-file').files[0];
    $('replay-file').value = '';
    if (file)
      verifyText(() => {
        if (file.size > MAX_REPLAY_BYTES) throw new Error(t('tools:replayExceedsTheImportBudget'));
        return file.text();
      });
  };
  $('verify-replay-json').onclick = () => verifyText(() => $('replay-paste').value);
  document.querySelectorAll('[data-size]').forEach(
    (b) =>
      (b.onclick = () => {
        resizePreview(...b.dataset.size.split(','));
      }),
  );
  $('preview-size-form').onsubmit = (event) => {
    event.preventDefault();
    try {
      resizePreview($('preview-width').value, $('preview-height').value);
    } catch (error) {
      $('preview-size-status').classList.add('error');
      localizedText($('preview-size-status'), () =>
        t('tools:thePreviousPreviewSizeIsKept', { value1: error.message }),
      );
    }
  };
  window.addEventListener('resize', fit);
  $('capture-geometry').addEventListener('click', () => requestAnimationFrame(captureGeometry));
  $('preview-mode').onchange = preview;
  $('preview-frame').addEventListener('load', () => {
    previewDocumentLoaded = true;
    previewLease?.update({ message: t('tools:childDocumentLoadedWaitingForGameReadiness') });
    observeGeometryPreview();
    measure();
    $('preview-frame').contentDocument?.addEventListener('click', () =>
      requestAnimationFrame(measure),
    );
  });
  setInterval(measure, 500);
  sync();
  fit();
  preview();
} catch (error) {
  status(localizedMessage('tools:playgroundCouldNotLoad', { value1: error.message }), true);
} finally {
  document.querySelectorAll('[data-boot-inert]').forEach((element) => {
    element.inert = false;
    element.removeAttribute('aria-busy');
  });
  $('boot-status').hidden = true;
}
