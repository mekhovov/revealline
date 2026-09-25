import {
  t,
  localizedMessage,
  localizedText,
  localizedAttribute,
  onLocaleChange,
  formatNumber,
  getLocale,
} from '../../game/i18n/index.mjs';
import { getMotionDisplay } from './display.mjs';
import { freezeMotionPresets, motionText, motionCollectionReason } from './copy.mjs';
import { createPreviewLoop } from './preview-loop.mjs';
import { canvasTextFonts } from '../../game/text-face.mjs';
import { fieldKitCopy } from '../../game/ui/field-kit-copy.mjs';
import { createOperationStatus } from '../../game/ui/operation-status.mjs';
import { DIRECTIONS, clamp, createMotionState, validatePresets } from './motion.mjs';
import { createManualSteering } from './steering.mjs';
import { nextGridCenter } from './grid-motion.mjs';
import { createAnimationState, advanceAnimation, validateAnimationRecipes } from './animation.mjs';
import { paintCharacter } from './render-character.mjs';
import {
  validateCollection,
  createProfile,
  restoreProfile,
  serializeProfile,
  evaluateCollection,
  equipCharacter,
  resolveCharacter,
  applyFixture,
} from './collection.mjs';
import {
  validateAbilityPresets,
  createAbilityState,
  switchAbilityLoadout,
  requestAbility,
  advanceAbility,
  abilityReadout,
} from './ability.mjs';
import { paintAbilityStage } from './render-ability.mjs';
import { describeAbilityLabels } from './ability-labels.mjs';
import { derivePngStill, PNG_PREVIEW_MAX_BYTES } from './png-preview.mjs';

const number = (value, places) =>
  formatNumber(value, { minimumFractionDigits: places, maximumFractionDigits: places });
const compass = (direction) => {
  const keys = {
    north: 'tools:motionLab.compass.north',
    northEast: 'tools:motionLab.compass.northEast',
    east: 'tools:motionLab.compass.east',
    southEast: 'tools:motionLab.compass.southEast',
    south: 'tools:motionLab.compass.south',
    southWest: 'tools:motionLab.compass.southWest',
    west: 'tools:motionLab.compass.west',
    northWest: 'tools:motionLab.compass.northWest',
  };
  return t(keys[direction]);
};
const directionLabel = (direction) => {
  const keys = {
    up: 'interface:up',
    down: 'interface:down',
    left: 'interface:left',
    right: 'interface:right',
  };
  return t(keys[direction]);
};

function mountMotionLab() {
  const $ = (id) => document.getElementById(id);
  // The lightweight reading control already works while presets are pending.
  // Retire only the real launcher's temporary action, never a newer focus owner.
  const reload = $('motion-load-status')?.nextElementSibling;
  const retiringReload = reload?.tagName === 'A' && document.activeElement === reload;
  globalThis.RevealLineToolLaunch?.attached();
  const sizeControl = $('motion-text-size');
  if (
    retiringReload &&
    reload.hidden &&
    !document.hidden &&
    document.hasFocus() &&
    (document.activeElement === reload || document.activeElement === document.body) &&
    sizeControl &&
    !sizeControl.disabled
  )
    sizeControl.focus();
  const loadPresenter = createOperationStatus($('motion-load-status'));
  const backgroundPresenter = createOperationStatus($('background-status'));
  const assetPresenter = createOperationStatus($('asset-status'));
  let pendingBackground = null;
  const backgroundMessage = (message, state = 'ready') =>
    backgroundPresenter.begin({ message }).finish({ message, state });
  const canvas = $('arena');
  const study = $('motion-study');
  function setStudyReady(ready) {
    // Disabling the group preserves each child's domain-specific disabled state.
    study.disabled = !ready;
    canvas.setAttribute('tabindex', ready ? '0' : '-1');
    canvas.setAttribute('aria-disabled', String(!ready));
    if (ready) canvas.removeAttribute('inert');
    else canvas.setAttribute('inert', '');
  }
  const ctx = canvas.getContext('2d', { alpha: false });
  const inspectionCanvas = $('inspection'),
    inspectionCtx = inspectionCanvas.getContext('2d', { alpha: false });
  const presetURL = new URL('./presets.json', import.meta.url);
  const keyDirections = new Map([
    ['ArrowUp', 'up'],
    ['KeyW', 'up'],
    ['ArrowRight', 'right'],
    ['KeyD', 'right'],
    ['ArrowDown', 'down'],
    ['KeyS', 'down'],
    ['ArrowLeft', 'left'],
    ['KeyA', 'left'],
  ]);
  const steering = createManualSteering();
  const images = new Map();
  const display = getMotionDisplay();
  const listeners = [];
  const pointerCaptures = new Map();
  let disposed = false,
    resizeObserver = null;
  const startupAbort = new AbortController();
  function listen(node, type, handler) {
    node.addEventListener(type, handler);
    listeners.push(() => node.removeEventListener(type, handler));
  }
  const labelRows = new Map();
  let presets, selection, motion, state;
  let collection, profile, contextId, inspectedCharacter;
  let abilityConfig,
    abilityState,
    abilityEnabled = true,
    abilityEventId = 0;
  let liveAnimation = createAnimationState(),
    inspectionAnimation = createAnimationState();
  const recipeOverrides = new Map(),
    rotorOverrides = new Map();
  const storageKey = 'xonix.motion-lab.collection.v1';
  const profileOptions = { mode: 'lab', profileId: 'local-design' };
  let recoveryRaw = null,
    storageWarning = '';
  let background = null,
    backgroundToken = 0,
    backgroundOpacity = 0.28,
    backgroundFit = 'contain';
  let paused = false;
  let autoplay = true;
  let localReducedMotion = false;
  let sharedReducedMotion = display.snapshot().effectiveReducedEffects;
  let reducedMotion = sharedReducedMotion;
  let keyBoost = false,
    keySlow = false,
    pointerBoost = false,
    pointerSlow = false;
  let showGrid = true,
    showRotors = true,
    showParticles = true;
  let lastReadout = 0,
    lastEventMode = '';
  let cellPixels = 20,
    cssWidth = 960,
    cssHeight = 720;
  let particles = [],
    particleClock = 0,
    particleSequence = 0;

  function rgba(hex, alpha) {
    return `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${alpha})`;
  }

  function eventNote(text) {
    localizedText($('motion-event'), text);
  }

  function setOptions(id, entries, selected, owner = presets) {
    const select = $(id);
    select.replaceChildren();
    for (const [value, data] of Object.entries(entries)) {
      const option = document.createElement('option');
      option.value = value;
      localizedText(
        option,
        typeof data.label === 'function'
          ? data.label
          : () => motionText(owner, data, 'label') || value,
      );
      select.append(option);
    }
    select.value = selected;
  }

  function assetRecord(src) {
    if (!src) return { state: 'absent' };
    if (images.has(src)) return images.get(src);
    const record = { state: 'loading', image: null };
    images.set(src, record);
    let url;
    try {
      url = new URL(src, presetURL);
      if (url.origin !== location.origin || !['http:', 'https:'].includes(url.protocol))
        throw new Error('Assets must use same-origin local HTTP paths');
    } catch (error) {
      record.state = 'failed';
      record.error = error.message;
      return record;
    }
    const image = new Image();
    image.onload = () => {
      if (disposed) return;
      record.state = 'loaded';
      record.image = image;
      updateAssetStatus();
      if (state) {
        render();
        readouts();
      }
    };
    image.onerror = () => {
      if (disposed) return;
      record.state = 'failed';
      updateAssetStatus();
      if (state) {
        render();
        readouts();
      }
    };
    record.pendingImage = image;
    image.src = url.href;
    return record;
  }

  function updateAssetStatus() {
    if (!presets || !selection) return;
    const character = presets.characters[selection.character];
    const body = assetRecord(character.src);
    const bodyState = body.state;
    const width = body.image?.naturalWidth,
      height = body.image?.naturalHeight;
    const bodyText = () =>
      bodyState === 'loaded'
        ? t('tools:motionLab.bodyImageLoaded', {
            width,
            height,
            status:
              motionText(presets, character, 'sourceStatus') ||
              t('tools:motionLab.sourceStatusMissing'),
          })
        : t(
            bodyState === 'loading'
              ? 'tools:motionLab.bodyImageLoading'
              : bodyState === 'failed'
                ? 'tools:motionLab.bodyImageFailed'
                : 'tools:motionLab.bodyImageAbsent',
          );
    const roles = Object.values(presets.terrainLayers[selection.terrainLayer].roles);
    const declared = roles.flatMap((role) => [role.microSrc, role.propSrc]).filter(Boolean);
    const loaded = declared.filter((src) => assetRecord(src).state === 'loaded').length;
    const message = () =>
      t('tools:motionLab.assetStatus', {
        body: bodyText(),
        terrain: declared.length
          ? t('tools:motionLab.terrainLayers', { loaded, total: declared.length })
          : t('tools:motionLab.terrainVectors'),
      });
    const lease = assetPresenter.begin({ message });
    if (body.state !== 'loading' && !declared.some((src) => assetRecord(src).state === 'loading'))
      lease.finish({ message });
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    cssWidth = rect.width;
    cssHeight = rect.height;
    cellPixels = cssWidth / 48;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    // Presentation transform only. Position, speed, route and terrain never change on resize.
    ctx.setTransform(canvas.width / 48, 0, 0, canvas.height / 36, 0, 0);
  }

  function applyPalette() {
    const theme = presets.themes[selection.theme];
    for (const key of ['accent', 'arena', 'wall', 'slow', 'danger'])
      document.documentElement.style.setProperty(`--${key}`, theme.colors[key]);
    localizedText($('palette-name'), () => motionText(presets, theme, 'label'));
    if (abilityConfig && abilityState) refreshAbilityControls();
  }

  function abilityPlayer() {
    return { x: state.x, y: state.y, direction: state.direction, distance: state.travelDistance };
  }
  function resetAbilityState() {
    if (!abilityConfig) return;
    abilityState = abilityState
      ? switchAbilityLoadout(
          abilityState,
          abilityConfig,
          abilityState.classId,
          abilityState.equipmentId,
          abilityPlayer(),
        )
      : createAbilityState(abilityConfig, undefined, undefined, abilityPlayer());
  }
  function refreshAbilityControls() {
    const vocab = abilityConfig.vocabulary[selection.theme];
    setOptions(
      'ability-class',
      Object.fromEntries(
        abilityConfig.classes.map((item) => [
          item.id,
          { label: () => motionText(abilityConfig, vocab, `classLabels.${item.id}`) },
        ]),
      ),
      abilityState.classId,
    );
    const item = abilityConfig.classes.find((item) => item.id === abilityState.classId);
    setOptions(
      'ability-equipment',
      Object.fromEntries(
        abilityConfig.equipment
          .filter((link) => item.compatibleEquipment.includes(link.id))
          .map((link) => [
            link.id,
            { label: () => motionText(abilityConfig, vocab, `equipmentLabels.${link.id}`) },
          ]),
      ),
      abilityState.equipmentId,
    );
    localizedText($('ability-description'), () => motionText(abilityConfig, item, 'description'));
    localizedText($('ability-recommended-link'), () =>
      t('tools:motionLab.useRecommendedLink', {
        link: motionText(abilityConfig, vocab, `equipmentLabels.${item.recommendedEquipment}`),
      }),
    );
  }
  function abilityReadouts() {
    if (!abilityState) return;
    const info = abilityReadout(abilityState, abilityConfig, abilityPlayer()),
      vocab = abilityConfig.vocabulary[selection.theme];
    const notes = abilityState.targets.filter(
      (target) => target.kind === 'note' && target.revealedUntil > abilityState.time,
    ).length;
    const status = paused
      ? t('interface:paused')
      : info.ready
        ? t('common:status.ready')
        : info.cooldown > 0.01
          ? t('tools:motionLab.cooldown', { seconds: number(info.cooldown, 1) })
          : info.budget === 0
            ? t('tools:motionLab.linkEmpty')
            : t('tools:motionLab.pickUpCharges');
    $('ability-readout').textContent = abilityEnabled
      ? t('tools:motionLab.abilitySummary', {
          name: motionText(abilityConfig, vocab, `classLabels.${abilityState.classId}`),
          status,
          charges: info.capacity
            ? t('tools:motionLab.charges', { ammo: info.ammo, count: info.capacity })
            : t('tools:motionLab.unlimitedCharges'),
          markers: t('tools:motionLab.markersUpdated', { count: info.completed }),
          notes: t('tools:motionLab.notesVisible', { count: notes }),
        })
      : t('tools:motionLab.abilityHidden');
    const linkDetails = [
      t('tools:motionLab.linkSignal', {
        name: motionText(abilityConfig, vocab, `equipmentLabels.${abilityState.equipmentId}`),
        signal: Math.round(info.signal * 100),
      }),
    ];
    if (info.inHaze)
      linkDetails.push(
        t(
          info.equipment.ignoreHaze
            ? 'tools:motionLab.hazeIgnored'
            : 'tools:motionLab.hazeDisplayOnly',
        ),
      );
    if (info.budget !== null)
      linkDetails.push(
        t('tools:motionLab.linkBudget', {
          name: motionText(abilityConfig, vocab, 'budgetLabel'),
          remaining: number(info.budget, 1),
          capacity: info.budgetCapacity,
        }),
      );
    $('ability-link-status').textContent = t('tools:motionLab.linkSummary', {
      details: linkDetails.join(' · '),
      refill: t(info.pad ? 'tools:motionLab.padRefill' : 'tools:motionLab.returnForRefill'),
    });
    $('ability-action').disabled = !abilityEnabled;
    $('ability-pickup').disabled = !abilityEnabled;
  }
  function updateAbilityLegend() {
    const legend = $('ability-stage-legend');
    const list = $('ability-stage-labels');
    if (!abilityEnabled || !abilityState) {
      legend.hidden = true;
      if (labelRows.size) {
        list.replaceChildren();
        labelRows.clear();
      }
      return;
    }
    legend.hidden = false;
    const language = document.documentElement.lang;
    const labels = describeAbilityLabels(abilityState, abilityConfig, selection.theme);
    const current = new Set(labels.map((label) => label.key));
    for (const [key, row] of labelRows) {
      if (!current.has(key)) {
        row.item.remove();
        labelRows.delete(key);
      }
    }
    for (const label of labels) {
      let row = labelRows.get(label.key);
      if (!row) {
        const item = document.createElement('li');
        item.setAttribute('data-ability-label', label.key);
        const role = document.createElement('strong');
        const text = document.createElement('span');
        const status = document.createElement('span');
        role.className = 'ability-stage-role';
        text.className = 'ability-stage-text';
        status.className = 'ability-stage-state';
        item.append(role, text, status);
        list.append(item);
        row = { item, role, text, status };
        labelRows.set(label.key, row);
      }
      const role = fieldKitCopy(`motion.stageKind.${label.kind}`, language);
      const text = label.concealed ? fieldKitCopy('motion.concealedNote', language) : label.text;
      const status =
        label.kind === 'note'
          ? label.concealed
            ? ''
            : fieldKitCopy('motion.noteVisible', language)
          : label.status === null
            ? ''
            : fieldKitCopy(
                label.status === 'ready' ? 'motion.markerReady' : 'motion.markerUpdated',
                language,
              );
      // Preserve DOM identity/focus and text selection on unchanged frames.
      // In particular, remove expired note text on this render, not the slower
      // general readout timer; neither attributes nor hidden nodes retain it.
      if (row.role.textContent !== role) row.role.textContent = role;
      if (row.text.textContent !== text) row.text.textContent = text;
      if (row.status.textContent !== status) row.status.textContent = status;
    }
  }

  function abilityCommand(type) {
    if (!abilityEnabled) return;
    const result = requestAbility(
      abilityState,
      { id: ++abilityEventId, type },
      {
        player: abilityPlayer(),
        stageStart: createMotionState(presets.route, motion),
        turnPolicy: motion.turnPolicy || 'immediate',
        paused,
      },
      abilityConfig,
    );
    abilityState = result.state;
    if (result.relocation) {
      autoplay = false;
      clearHeld();
      state = result.relocation.reset
        ? createMotionState(presets.route, motion)
        : {
            ...state,
            x: result.relocation.x,
            y: result.relocation.y,
            speed: 0,
            queuedDirection: null,
          };
      loop.resetClock();
    }
    const messages = {
      paused: localizedMessage('tools:motionLab.abilityPaused'),
      'near-pad-required': localizedMessage('tools:motionLab.nearPadRequired'),
      cooldown: localizedMessage('tools:motionLab.coolingDown'),
      'link-empty': localizedMessage('tools:motionLab.linkEmptyNotice'),
      'charges-empty': localizedMessage('tools:motionLab.chargesEmpty'),
      refilled: localizedMessage('tools:motionLab.refilled'),
      'tagged-returned': localizedMessage('tools:motionLab.taggedReturned'),
      'marker-updated': localizedMessage('tools:motionLab.markerUpdated'),
      'action-used': localizedMessage('tools:motionLab.actionUsed'),
      'duplicate-event': localizedMessage('tools:motionLab.duplicateEvent'),
      'no-reachable-center': localizedMessage('tools:motionLab.noReachableCenter'),
      'effect-limit': localizedMessage('tools:motionLab.effectLimit'),
    };
    localizedText(
      $('ability-message'),
      messages[result.reason] ||
        localizedMessage('tools:motionLab.abilityResult', { reason: result.reason }),
    );
    readouts();
    render();
  }
  function setupAbilities() {
    resetAbilityState();
    refreshAbilityControls();
    const changeLoadout = (classId, equipmentId) => {
      abilityState = switchAbilityLoadout(
        abilityState,
        abilityConfig,
        classId,
        equipmentId,
        abilityPlayer(),
      );
      refreshAbilityControls();
      localizedText($('ability-message'), localizedMessage('tools:motionLab.loadoutReset'));
      readouts();
      render();
    };
    listen($('ability-class'), 'change', (event) => {
      const item = abilityConfig.classes.find((item) => item.id === event.target.value);
      changeLoadout(
        item.id,
        item.compatibleEquipment.includes(abilityState.equipmentId)
          ? abilityState.equipmentId
          : item.recommendedEquipment,
      );
    });
    listen($('ability-equipment'), 'change', (event) =>
      changeLoadout(abilityState.classId, event.target.value),
    );
    listen($('ability-recommended-link'), 'click', () =>
      changeLoadout(
        abilityState.classId,
        abilityConfig.classes.find((item) => item.id === abilityState.classId).recommendedEquipment,
      ),
    );
    listen($('ability-enabled'), 'change', (event) => {
      abilityEnabled = event.target.checked;
      abilityState.lastPlayer = { x: state.x, y: state.y };
      abilityState.lastTravelDistance = state.travelDistance;
      readouts();
      render();
    });
    for (const [id, type] of [
      ['ability-action', 'act'],
      ['ability-pickup', 'pickup'],
    ]) {
      listen($(id), 'click', () => abilityCommand(type));
      listen($(id), 'keydown', (event) => {
        if (['Enter', 'Space'].includes(event.code)) {
          event.preventDefault();
          if (!event.repeat) abilityCommand(type);
        }
      });
    }
    listen($('ability-reset'), 'click', () => {
      autoplay = false;
      reset();
      pause(localizedMessage('tools:motionLab.abilityResetPause'));
      localizedText($('ability-message'), localizedMessage('tools:motionLab.abilityReset'));
    });
    listen($('apply-class-appearance'), 'click', () => {
      const item = abilityConfig.classes.find((item) => item.id === abilityState.classId),
        bodyId = item.preferredBodies[currentContext().themeId];
      const result = equipCharacter(
        collection,
        profile,
        bodyId,
        currentContext(),
        currentContext(),
      );
      if (result.accepted) {
        profile = result.profile;
        inspectedCharacter = bodyId;
        refreshCollection();
        const saved = saveProfile();
        localizedText($('ability-message'), () =>
          t('tools:motionLab.appearanceApplied', { storage: String(saved) }),
        );
      } else
        localizedText($('ability-message'), () =>
          t('tools:motionLab.appearanceUnavailable', {
            reason: motionCollectionReason(result.reason),
          }),
        );
      readouts();
      render();
    });
  }

  function currentContext() {
    return collection.contexts.find((item) => item.id === contextId).scope;
  }

  function recipeFor(characterId) {
    const id = recipeOverrides.get(characterId) || presets.characters[characterId].animationRecipe;
    const recipe = presets.animationRecipes[id];
    const overrides = rotorOverrides.get(characterId) || {};
    return {
      ...recipe,
      components: recipe.components.map((component) =>
        component.type === 'rotors' ? { ...component, ...overrides } : component,
      ),
    };
  }

  function saveProfile() {
    try {
      // A corrupt/incompatible save is retained before the first explicit user mutation writes fresh data.
      if (recoveryRaw !== null) {
        localStorage.setItem(`${storageKey}.recovery.${Date.now()}`, recoveryRaw);
        recoveryRaw = null;
      }
      localStorage.setItem(storageKey, serializeProfile(profile));
      storageWarning = '';
      return localizedMessage('tools:motionLab.collectionSaved');
    } catch {
      storageWarning = localizedMessage('tools:motionLab.collectionSaveUnavailable');
      return storageWarning;
    }
  }

  function selectBoardCharacter() {
    const resolved = resolveCharacter(collection, profile, currentContext());
    if (selection.character !== resolved.characterId) liveAnimation = createAnimationState();
    selection.character = resolved.characterId;
    const character = presets.characters[selection.character];
    const sourceKeys = {
      equipped: 'tools:motionLab.equippedSource',
      default: 'tools:motionLab.defaultSource',
      fallback: 'tools:motionLab.fallbackSource',
    };
    localizedText($('equipped-readout'), () =>
      t('tools:motionLab.equippedReadout', {
        name: motionText(presets, character, 'label'),
        source: t(sourceKeys[resolved.source]),
      }),
    );
    updateAssetStatus();
  }

  function setRangeReadout(id, output, visible, valueText) {
    localizedText($(output), visible);
    localizedAttribute($(id), 'aria-valuetext', valueText);
  }

  function updateAnimationControls() {
    const body = presets.characters[inspectedCharacter];
    $('animation-recipe').value = recipeOverrides.get(inspectedCharacter) || body.animationRecipe;
    const recipe = recipeFor(inspectedCharacter),
      rotor = recipe.components.find((component) => component.type === 'rotors');
    $('rotor-controls').hidden = !rotor;
    if (rotor) {
      $('blade-count').value = rotor.bladeCount;
      $('blade-shape').value = rotor.bladeShape;
      $('rotor-radius').value = rotor.radius;
      const percent = Math.round(rotor.radius * 100);
      setRangeReadout(
        'rotor-radius',
        'rotor-radius-output',
        localizedMessage('tools:motionLab.bodyPercent', { percent }),
        localizedMessage('tools:motionLab.bodyPercentAccessible', { percent }),
      );
    }
    localizedText($('inspection-blade-label'), () =>
      rotor
        ? t('tools:motionLab.bladesPerRotor', { count: rotor.bladeCount })
        : recipe.components.length
          ? recipe.components.map((component) => componentName(component.type)).join(' + ')
          : t('tools:motionLab.staticMarker'),
    );
    const unavailableRig = rotor && !body.rotors.length;
    localizedText(
      $('animation-status'),
      localizedMessage(
        unavailableRig
          ? 'tools:motionLab.rigUnavailable'
          : rotor
            ? 'tools:motionLab.rotorExplanation'
            : 'tools:motionLab.cosmeticRecipe',
      ),
    );
  }

  function componentName(type) {
    const keys = {
      rotors: 'tools:rotors',
      wings: 'tools:motionLab.wings',
      thruster: 'tools:motionLab.thruster',
      pulse: 'tools:motionLab.pulse',
      blink: 'tools:motionLab.blink',
    };
    return keys[type] ? t(keys[type]) : type;
  }
  function collectionDefinition(row) {
    return collection.characters.find((item) => item.id === row.id);
  }
  function collectionStatus(row) {
    const keys = {
      unavailable: 'tools:motionLab.statusUnavailable',
      unlocked: 'tools:motionLab.statusUnlocked',
      locked: 'common:status.locked',
    };
    return t(keys[row.status]);
  }
  function criterionLabel(row, condition) {
    const source = collectionDefinition(row)
      ?.unlock.anyOf?.flatMap((group) => group.allOf)
      .find((item) => item.id === condition.id);
    return source ? motionText(collection, source, 'label') : condition.label;
  }

  function refreshCollection({ followEquipped = false } = {}) {
    selectBoardCharacter();
    if (followEquipped) inspectedCharacter = selection.character;
    const rows = evaluateCollection(collection, profile, currentContext());
    setOptions(
      'character',
      Object.fromEntries(
        rows.map((row) => [
          row.id,
          {
            label: () =>
              t('tools:motionLab.collectionOption', {
                name: motionText(collection, collectionDefinition(row), 'label'),
                status: collectionStatus(row),
              }),
          },
        ]),
      ),
      inspectedCharacter,
    );
    const row = rows.find((item) => item.id === inspectedCharacter);
    const definition = collectionDefinition(row);
    localizedText($('character-status'), () =>
      t(
        row.available
          ? 'tools:motionLab.characterAvailable'
          : 'tools:motionLab.characterUnavailable',
        {
          name: motionText(collection, definition, 'label'),
          status: collectionStatus(row),
          description: motionText(collection, definition, 'description') || '',
        },
      ),
    );
    $('equip-character').disabled = !row.available || !row.unlocked;
    const list = $('unlock-conditions');
    list.replaceChildren();
    for (const condition of row.conditions) {
      const item = document.createElement('li');
      localizedText(item, () =>
        t('tools:motionLab.conditionProgress', {
          mark: condition.met ? '✓' : '○',
          name: criterionLabel(row, condition),
          current: condition.current,
          target: condition.target,
        }),
      );
      list.append(item);
    }
    if (row.unmet.length) {
      const item = document.createElement('li');
      const label = document.createElement('span');
      localizedText(label, localizedMessage('tools:motionLab.unlockConditions'));
      const alternatives = document.createElement('ul');
      for (const group of row.alternatives) {
        const alternative = document.createElement('li');
        localizedText(alternative, () =>
          new Intl.ListFormat(getLocale(), { type: 'conjunction' }).format(
            group.conditions
              .filter((condition) => !condition.met)
              .map((condition) =>
                t('tools:motionLab.conditionRemaining', {
                  name: criterionLabel(row, condition),
                  current: condition.current,
                  target: condition.target,
                }),
              ),
          ),
        );
        alternatives.append(alternative);
      }
      item.append(label, alternatives);
      list.append(item);
    }
    list.hidden = !list.children.length;
    updateAnimationControls();
  }

  function setupCollection() {
    setOptions(
      'collection-context',
      Object.fromEntries(collection.contexts.map((item) => [item.id, item])),
      contextId,
      collection,
    );
    setOptions(
      'animation-recipe',
      presets.animationRecipes,
      presets.characters[inspectedCharacter].animationRecipe,
    );
    setOptions(
      'reward-fixture',
      Object.fromEntries(collection.fixtures.map((item) => [item.id, item])),
      collection.fixtures[0].id,
      collection,
    );
    listen($('collection-context'), 'change', (event) => {
      contextId = event.target.value;
      refreshCollection({ followEquipped: true });
      inspectionAnimation = createAnimationState();
      render();
      readouts();
    });
    listen($('character'), 'change', (event) => {
      inspectedCharacter = event.target.value;
      inspectionAnimation = createAnimationState();
      refreshCollection();
      render();
    });
    listen($('equip-character'), 'click', () => {
      const context = currentContext();
      const scope =
        $('equip-scope').value === 'context'
          ? { ...context }
          : $('equip-scope').value === 'theme'
            ? { gameId: context.gameId, themeId: context.themeId }
            : {};
      const result = equipCharacter(collection, profile, inspectedCharacter, scope, context);
      if (result.accepted) profile = result.profile;
      if (result.accepted) {
        const resolved = resolveCharacter(collection, profile, context);
        const key =
          resolved.characterId === inspectedCharacter
            ? 'tools:motionLab.equippedSaved'
            : 'tools:motionLab.moreSpecificAppearance';
        const character = presets.characters[resolved.characterId];
        const saved = saveProfile();
        localizedText($('collection-message'), () =>
          t(key, {
            name: motionText(presets, character, 'label'),
            storage: String(saved),
          }),
        );
      } else
        localizedText($('collection-message'), () =>
          t('tools:motionLab.equipFailed', { reason: motionCollectionReason(result.reason) }),
        );
      refreshCollection();
      render();
      readouts();
    });
    listen($('apply-fixture'), 'click', () => {
      const result = applyFixture(collection, profile, $('reward-fixture').value);
      if (result.accepted) profile = result.profile;
      if (result.accepted) {
        const saved = saveProfile();
        localizedText($('collection-message'), () =>
          t('tools:motionLab.fixtureApplied', { storage: String(saved) }),
        );
      } else
        localizedText($('collection-message'), () =>
          t('tools:motionLab.fixtureRejected', { reason: motionCollectionReason(result.reason) }),
        );
      refreshCollection();
      render();
      readouts();
    });
    listen($('reset-collection'), 'click', () => {
      profile = createProfile(profileOptions);
      const saved = saveProfile();
      localizedText($('collection-message'), () =>
        t('tools:motionLab.collectionReset', { storage: String(saved) }),
      );
      refreshCollection({ followEquipped: true });
      render();
      readouts();
    });
    listen($('animation-recipe'), 'change', (event) => {
      recipeOverrides.set(inspectedCharacter, event.target.value);
      rotorOverrides.delete(inspectedCharacter);
      inspectionAnimation = createAnimationState();
      if (inspectedCharacter === selection.character) liveAnimation = createAnimationState();
      updateAnimationControls();
      render();
      readouts();
    });
    for (const [id, key, numeric] of [
      ['blade-count', 'bladeCount', true],
      ['blade-shape', 'bladeShape', false],
      ['rotor-radius', 'radius', true],
    ]) {
      listen($(id), id === 'rotor-radius' ? 'input' : 'change', (event) => {
        rotorOverrides.set(inspectedCharacter, {
          ...rotorOverrides.get(inspectedCharacter),
          [key]: numeric ? Number(event.target.value) : event.target.value,
        });
        updateAnimationControls();
        render();
        readouts();
      });
    }
    listen($('inspection-slow'), 'change', () => {
      inspectionAnimation = createAnimationState();
      render();
    });
    listen($('apply-family-look'), 'click', () => {
      selection.terrainLayer = presets.familyLooks[selection.theme].terrainLayer;
      $('terrain-layer').value = selection.terrainLayer;
      const context = collection.contexts.find((item) => item.scope.themeId === selection.theme);
      if (context) {
        contextId = context.id;
        $('collection-context').value = contextId;
      }
      refreshCollection({ followEquipped: true });
      inspectionAnimation = createAnimationState();
      render();
      readouts();
      eventNote(localizedMessage('tools:motionLab.familyApplied'));
    });
    refreshCollection();
    if (storageWarning) localizedText($('collection-message'), storageWarning);
  }

  function setupBackground() {
    const clear = () => {
      backgroundToken++;
      if (pendingBackground) {
        pendingBackground.image?.removeAttribute('src');
        if (pendingBackground.url) URL.revokeObjectURL(pendingBackground.url);
        pendingBackground = null;
      }
      if (background) URL.revokeObjectURL(background.url);
      background = null;
      $('background-file').value = '';
      $('clear-background').disabled = true;
      backgroundMessage(localizedMessage('tools:motionLab.previewCleared'), 'cancelled');
      render();
    };
    listen($('clear-background'), 'click', clear);
    listen($('background-file'), 'change', async (event) => {
      const file = event.target.files[0];
      event.target.value = '';
      if (!file) return;
      if (
        !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) ||
        file.size > PNG_PREVIEW_MAX_BYTES
      ) {
        backgroundMessage(localizedMessage('tools:motionLab.chooseImage'), 'error');
        return;
      }
      const token = ++backgroundToken;
      if (pendingBackground) {
        pendingBackground.image?.removeAttribute('src');
        if (pendingBackground.url) URL.revokeObjectURL(pendingBackground.url);
      }
      pendingBackground = { image: null, url: null };
      $('clear-background').disabled = false;
      const current = () => !disposed && token === backgroundToken;
      const lease = backgroundPresenter.begin({
        message: localizedMessage('tools:motionLab.preparingImage'),
        isCurrent: current,
      });
      let source = file,
        animatedPng = false;
      try {
        if (file.type === 'image/png') {
          const buffer = await file.arrayBuffer();
          if (!current()) return;
          const result = derivePngStill(new Uint8Array(buffer));
          animatedPng = result.animated;
          if (animatedPng) source = new Blob([result.bytes], { type: 'image/png' });
        }
      } catch {
        if (current()) {
          pendingBackground = null;
          $('clear-background').disabled = !background;
          lease.finish({
            message: localizedMessage('tools:motionLab.pngFailed'),
            state: 'error',
          });
        }
        return;
      }
      if (!current()) return;
      const url = URL.createObjectURL(source),
        image = new Image();
      pendingBackground = { image, url };
      image.onload = () => {
        if (disposed || token !== backgroundToken) {
          URL.revokeObjectURL(url);
          return;
        }
        if (background) URL.revokeObjectURL(background.url);
        pendingBackground = null;
        background = { image, url };
        $('clear-background').disabled = false;
        lease.finish({
          message: localizedMessage(
            animatedPng ? 'tools:motionLab.animatedImageReady' : 'tools:motionLab.imageReady',
            {
              name: file.name,
              width: image.naturalWidth,
              height: image.naturalHeight,
            },
          ),
        });
        render();
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        if (!disposed && token === backgroundToken) {
          pendingBackground = null;
          lease.finish({
            message: localizedMessage('tools:motionLab.imageFailed'),
            state: 'error',
          });
        }
      };
      image.src = url;
    });
    listen($('background-fit'), 'change', (event) => {
      backgroundFit = event.target.value;
      render();
    });
    listen($('background-opacity'), 'input', (event) => {
      backgroundOpacity = Number(event.target.value);
      const percent = Math.round(backgroundOpacity * 100);
      setRangeReadout(
        'background-opacity',
        'background-opacity-output',
        localizedMessage('tools:motionLab.percent', { percent }),
        localizedMessage('tools:motionLab.percentAccessible', { percent }),
      );
      render();
    });
  }

  function drawGrid(colors) {
    if (!showGrid) return;
    ctx.lineWidth = 0.65 / cellPixels;
    for (let x = 0; x <= 48; x++) {
      ctx.strokeStyle = rgba(colors.grid, x % 4 === 0 ? 0.65 : 0.24);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 36);
      ctx.stroke();
    }
    for (let y = 0; y <= 36; y++) {
      ctx.strokeStyle = rgba(colors.grid, y % 4 === 0 ? 0.65 : 0.24);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(48, y);
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(colors.dim, 0.45);
    ctx.lineWidth = 1 / cellPixels;
    ctx.strokeRect(1, 1, 46, 34);
    const corners = [
      [2, 2, 1, 1],
      [46, 2, -1, 1],
      [2, 34, 1, -1],
      [46, 34, -1, -1],
    ];
    ctx.strokeStyle = rgba(colors.dim, 0.8);
    for (const [x, y, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(x, y + dy);
      ctx.lineTo(x, y);
      ctx.lineTo(x + dx, y);
      ctx.stroke();
    }
  }

  function drawImageFit(image, x, y, width, height, smoothing = false) {
    const factor = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const w = image.naturalWidth * factor,
      h = image.naturalHeight * factor;
    ctx.imageSmoothingEnabled = smoothing;
    ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
  }

  // Deliberately modest vector/pixel diagrams until a corresponding image layer is supplied.
  function drawMicro(role, kind, x, y, color, dim) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1 / 8, 1 / 8);
    ctx.fillStyle = rgba(color, 0.78);
    if (role === 'wall') {
      if (kind === 'circuit') {
        ctx.fillRect(2, 2, 4, 4);
        ctx.fillRect(0, 3, 8, 1);
        ctx.fillRect(3, 0, 1, 8);
        ctx.fillStyle = dim;
        ctx.fillRect(3, 3, 2, 2);
      } else if (kind === 'archive') {
        ctx.fillRect(1, 1, 6, 6);
        ctx.fillStyle = dim;
        ctx.fillRect(2, 3, 4, 1);
        ctx.fillRect(3, 5, 2, 1);
      } else if (kind === 'stone') {
        ctx.fillRect(2, 1, 4, 1);
        ctx.fillRect(1, 2, 6, 4);
        ctx.fillRect(2, 6, 4, 1);
        ctx.fillStyle = dim;
        ctx.fillRect(3, 4, 3, 1);
      } else {
        ctx.fillRect(1, 2, 6, 4);
        ctx.fillStyle = dim;
        ctx.fillRect(2, 3, 1, 2);
        ctx.fillRect(5, 3, 1, 2);
      }
    } else if (role === 'slow') {
      if (kind === 'queue') {
        ctx.fillRect(2, 1, 3, 4);
        ctx.fillStyle = rgba(color, 0.4);
        ctx.fillRect(4, 3, 3, 4);
      } else if (kind === 'reeds') {
        ctx.fillRect(2, 2, 1, 5);
        ctx.fillRect(5, 1, 1, 6);
        ctx.fillRect(3, 5, 3, 1);
      } else if (kind === 'static') {
        ctx.fillRect(1, 2, 2, 1);
        ctx.fillRect(4, 3, 3, 1);
        ctx.fillRect(2, 5, 2, 1);
        ctx.fillRect(6, 6, 1, 1);
      } else {
        ctx.fillRect(1, 4, 3, 2);
        ctx.fillRect(4, 2, 3, 2);
        ctx.fillStyle = rgba(color, 0.3);
        ctx.fillRect(2, 2, 1, 1);
        ctx.fillRect(5, 6, 2, 1);
      }
    } else {
      if (kind === 'alert') {
        ctx.fillRect(2, 1, 4, 6);
        ctx.fillStyle = dim;
        ctx.fillRect(3, 2, 2, 2);
        ctx.fillRect(3, 5, 2, 1);
      } else if (kind === 'plasma') {
        ctx.fillRect(3, 1, 2, 2);
        ctx.fillRect(2, 3, 4, 2);
        ctx.fillRect(3, 5, 2, 2);
        ctx.fillStyle = dim;
        ctx.fillRect(3, 3, 2, 2);
      } else if (kind === 'thorns') {
        ctx.fillRect(1, 4, 6, 1);
        ctx.fillRect(2, 2, 1, 2);
        ctx.fillRect(5, 4, 1, 3);
        ctx.fillRect(6, 2, 1, 2);
      } else {
        ctx.fillRect(1, 2, 1, 4);
        ctx.fillRect(6, 2, 1, 4);
        ctx.fillRect(2, 3, 2, 1);
        ctx.fillRect(4, 4, 2, 1);
        ctx.fillRect(3, 2, 1, 1);
        ctx.fillRect(4, 5, 1, 1);
      }
    }
    ctx.restore();
  }

  function drawProp(role, kind, x, y, size, color, background) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 16, size / 16);
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.fillRect(2, 4, 13, 10);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(color, 0.8);
    if (role === 'wall') {
      if (kind === 'archive') {
        ctx.fillStyle = rgba(color, 0.66);
        ctx.fillRect(3, 2, 10, 12);
        ctx.fillStyle = background;
        ctx.fillRect(4, 3, 8, 4);
        ctx.fillRect(4, 9, 8, 4);
        ctx.fillStyle = color;
        ctx.fillRect(7, 4, 2, 1);
        ctx.fillRect(7, 10, 2, 1);
      } else if (kind === 'circuit') {
        ctx.fillStyle = rgba(color, 0.32);
        ctx.fillRect(2, 2, 12, 12);
        ctx.strokeRect(4, 4, 8, 8);
        ctx.fillStyle = color;
        ctx.fillRect(6, 6, 4, 4);
        for (let i = 3; i < 14; i += 3) {
          ctx.fillRect(i, 0, 1, 3);
          ctx.fillRect(i, 13, 1, 3);
        }
      } else if (kind === 'stone') {
        ctx.fillStyle = rgba(color, 0.65);
        ctx.beginPath();
        ctx.moveTo(4, 2);
        ctx.lineTo(12, 3);
        ctx.lineTo(14, 7);
        ctx.lineTo(12, 13);
        ctx.lineTo(4, 14);
        ctx.lineTo(2, 9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(4, 6);
        ctx.lineTo(9, 7);
        ctx.lineTo(10, 11);
        ctx.stroke();
      } else {
        ctx.fillStyle = rgba(color, 0.7);
        ctx.beginPath();
        ctx.moveTo(3, 5);
        ctx.lineTo(13, 5);
        ctx.lineTo(15, 12);
        ctx.lineTo(1, 12);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = rgba(color, 0.9);
        ctx.fillRect(3, 3, 10, 3);
        ctx.fillStyle = background;
        ctx.fillRect(5, 6, 1, 3);
        ctx.fillRect(10, 6, 1, 3);
        ctx.strokeRect(3, 3, 10, 3);
      }
    } else if (role === 'slow') {
      ctx.fillStyle = rgba(color, 0.2);
      ctx.beginPath();
      ctx.ellipse(8, 9, 7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      if (kind === 'queue') {
        ctx.fillStyle = rgba(color, 0.65);
        ctx.fillRect(2, 3, 7, 9);
        ctx.fillStyle = color;
        ctx.fillRect(7, 5, 7, 9);
        ctx.fillStyle = background;
        ctx.fillRect(8, 7, 4, 1);
        ctx.fillRect(8, 10, 3, 1);
      } else if (kind === 'reeds') {
        for (const [a, b] of [
          [4, 3],
          [7, 1],
          [10, 4],
          [12, 2],
        ]) {
          ctx.strokeStyle = color;
          ctx.beginPath();
          ctx.moveTo(a, 13);
          ctx.lineTo(a - 1, b);
          ctx.stroke();
          ctx.fillStyle = rgba(color, 0.7);
          ctx.fillRect(a - 2, b, 3, 3);
        }
      } else if (kind === 'static') {
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = rgba(color, 0.3 + i * 0.12);
          ctx.fillRect(2 + (i % 2) * 3, 2 + i * 2, 8 - i, 1);
        }
      } else {
        ctx.strokeStyle = rgba(color, 0.7);
        for (const [a, b, width] of [
          [3, 6, 6],
          [6, 10, 7],
          [3, 12, 3],
        ]) {
          ctx.beginPath();
          ctx.ellipse(a + width / 2, b, width / 2, 1.1, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else {
      if (kind === 'alert') {
        ctx.fillStyle = rgba(color, 0.65);
        ctx.fillRect(3, 2, 10, 12);
        ctx.fillStyle = background;
        ctx.fillRect(7, 4, 2, 5);
        ctx.fillRect(7, 11, 2, 1);
        ctx.fillStyle = color;
        ctx.fillRect(12, 2, 2, 3);
      } else if (kind === 'plasma') {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(8, 8, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = rgba(color, 0.55);
        ctx.fillRect(6, 5, 4, 6);
        ctx.fillStyle = color;
        ctx.fillRect(7, 7, 2, 2);
      } else if (kind === 'thorns') {
        ctx.beginPath();
        ctx.moveTo(2, 12);
        ctx.lineTo(5, 6);
        ctx.lineTo(11, 10);
        ctx.lineTo(14, 3);
        ctx.stroke();
        ctx.fillStyle = color;
        for (const [a, b] of [
          [4, 5],
          [6, 9],
          [10, 8],
          [12, 4],
        ]) {
          ctx.beginPath();
          ctx.moveTo(a, b);
          ctx.lineTo(a + 3, b - 2);
          ctx.lineTo(a + 1, b + 2);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        ctx.fillStyle = rgba(color, 0.8);
        ctx.fillRect(2, 2, 2, 12);
        ctx.fillRect(12, 2, 2, 12);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(3, 5);
        ctx.bezierCurveTo(6, 1, 10, 13, 13, 9);
        ctx.moveTo(3, 10);
        ctx.bezierCurveTo(6, 14, 10, 2, 13, 5);
        ctx.stroke();
        ctx.fillRect(7, 6, 2, 2);
      }
    }
    ctx.restore();
  }

  function drawTerrain(colors) {
    const style = presets.terrainStyles[selection.terrainStyle];
    const layer = presets.terrainLayers[selection.terrainLayer];
    for (const area of presets.terrain) {
      const material = layer.roles[area.role];
      const color = colors[area.role];
      ctx.save();
      ctx.beginPath();
      ctx.rect(area.x, area.y, area.width, area.height);
      ctx.clip();
      ctx.fillStyle = rgba(color, 0.07);
      ctx.fillRect(area.x, area.y, area.width, area.height);
      if (style.microOpacity > 0) {
        const image = assetRecord(material.microSrc);
        ctx.globalAlpha = style.microOpacity;
        for (let x = area.x; x < area.x + area.width; x++)
          for (let y = area.y; y < area.y + area.height; y++) {
            if (image.state === 'loaded') drawImageFit(image.image, x + 0.08, y + 0.08, 0.84, 0.84);
            else drawMicro(area.role, material.kind, x, y, color, colors.arena);
          }
      }
      if (style.propOpacity > 0) {
        const image = assetRecord(material.propSrc);
        ctx.globalAlpha = style.propOpacity;
        for (let x = area.x; x < area.x + area.width; x += style.propPitch)
          for (let y = area.y; y < area.y + area.height; y += style.propPitch) {
            const width = Math.min(2, area.x + area.width - x),
              height = Math.min(2, area.y + area.height - y);
            const size = Math.min(width, height) * 0.95;
            if (image.state === 'loaded') drawImageFit(image.image, x, y, width, height);
            else
              drawProp(
                area.role,
                material.kind,
                x + (width - size) / 2,
                y + (height - size) / 2,
                size,
                color,
                colors.arena,
              );
          }
      }
      ctx.restore();
      ctx.lineWidth = 0.7 / cellPixels;
      ctx.strokeStyle = rgba(color, 0.26);
      ctx.strokeRect(area.x, area.y, area.width, area.height);
    }
  }

  function updateParticles(dt) {
    if (paused || reducedMotion || !showParticles) {
      particles = [];
      particleClock = 0;
      return;
    }
    particles = particles
      .map((particle) => ({
        ...particle,
        life: particle.life - dt,
        x: particle.x + particle.vx * dt,
        y: particle.y + particle.vy * dt,
      }))
      .filter((particle) => particle.life > 0);
    if (state.speed < 0.1) return;
    particleClock += dt * (state.mode === 'boost' ? 22 : 8);
    const forward = DIRECTIONS[state.direction];
    while (particleClock >= 1) {
      particleClock -= 1;
      const jitter = Math.sin(++particleSequence * 2.399) * 0.16;
      particles.push({
        x: state.x - forward.x * 0.52 + forward.y * jitter,
        y: state.y - forward.y * 0.52 - forward.x * jitter,
        vx: -forward.x * 0.65,
        vy: -forward.y * 0.65,
        life: 0.42,
        size: state.mode === 'boost' ? 0.09 : 0.065,
      });
    }
    if (particles.length > 40) particles.splice(0, particles.length - 40);
  }

  function drawCharacter(colors) {
    for (const particle of particles) {
      ctx.fillStyle = rgba(colors.accent, (particle.life / 0.42) * 0.55);
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    const body = presets.characters[selection.character],
      image = assetRecord(body.src);
    paintCharacter(ctx, {
      body,
      image: image.image,
      recipe: recipeFor(selection.character),
      animation: liveAnimation,
      colors,
      scale: selection.characterScale,
      x: state.x,
      y: state.y,
      heading: state.heading,
      bank: state.bank,
      speedRatio: state.visualSpeed / motion.cruiseSpeed,
      reducedMotion,
      showRotors,
      pixel: 1 / cellPixels,
    });
  }

  function drawTurnCue(colors) {
    if (motion.turnPolicy !== 'grid-center' || !state.queuedDirection || paused) return;
    const target = nextGridCenter(state, presets.board),
      direction = DIRECTIONS[state.queuedDirection];
    ctx.save();
    ctx.strokeStyle = colors.accent;
    ctx.fillStyle = colors.accent;
    ctx.lineWidth = 1.5 / cellPixels;
    ctx.setLineDash([0.12, 0.12]);
    ctx.beginPath();
    ctx.moveTo(state.x, state.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeRect(target.x - 0.18, target.y - 0.18, 0.36, 0.36);
    ctx.beginPath();
    ctx.moveTo(target.x, target.y);
    ctx.lineTo(target.x + direction.x * 0.6, target.y + direction.y * 0.6);
    ctx.stroke();
    ctx.translate(target.x + direction.x * 0.6, target.y + direction.y * 0.6);
    ctx.rotate(direction.heading);
    ctx.beginPath();
    ctx.moveTo(0, -0.12);
    ctx.lineTo(0.09, 0.07);
    ctx.lineTo(-0.09, 0.07);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawInspection(colors) {
    inspectionCtx.setTransform(1, 0, 0, 1, 0, 0);
    inspectionCtx.fillStyle = colors.arena;
    inspectionCtx.fillRect(0, 0, 400, 320);
    inspectionCtx.strokeStyle = rgba(colors.grid, 0.65);
    inspectionCtx.lineWidth = 1;
    for (let x = 20; x < 400; x += 20) {
      inspectionCtx.beginPath();
      inspectionCtx.moveTo(x, 0);
      inspectionCtx.lineTo(x, 320);
      inspectionCtx.stroke();
    }
    for (let y = 20; y < 320; y += 20) {
      inspectionCtx.beginPath();
      inspectionCtx.moveTo(0, y);
      inspectionCtx.lineTo(400, y);
      inspectionCtx.stroke();
    }
    inspectionCtx.setTransform(155, 0, 0, 155, 200, 160);
    const body = presets.characters[inspectedCharacter],
      image = assetRecord(body.src);
    paintCharacter(inspectionCtx, {
      body,
      image: image.image,
      recipe: recipeFor(inspectedCharacter),
      animation: inspectionAnimation,
      colors,
      speedRatio: state.visualSpeed / motion.cruiseSpeed,
      reducedMotion,
      showRotors,
      pixel: 1 / 155,
      inspectionSlow: $('inspection-slow').checked,
    });
    inspectionCtx.setTransform(1, 0, 0, 1, 0, 0);
    const status = $('inspection-status');
    status.hidden = image.state === 'loaded';
    status.textContent = status.hidden
      ? ''
      : fieldKitCopy(
          `motion.${!body.src ? 'inspectionNeutral' : image.state === 'loading' ? 'inspectionLoading' : 'inspectionUnavailable'}`,
          document.documentElement.lang,
        );
  }

  function render() {
    const colors = presets.themes[selection.theme].colors;
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.arena;
    ctx.fillRect(0, 0, 48, 36);
    if (background) {
      const image = background.image,
        factor = (backgroundFit === 'cover' ? Math.max : Math.min)(
          48 / image.naturalWidth,
          36 / image.naturalHeight,
        );
      const width = image.naturalWidth * factor,
        height = image.naturalHeight * factor;
      ctx.save();
      ctx.globalAlpha = backgroundOpacity;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(image, (48 - width) / 2, (36 - height) / 2, width, height);
      ctx.restore();
    }
    drawGrid(colors);
    drawTerrain(colors);
    updateAbilityLegend();
    if (abilityEnabled && abilityState)
      paintAbilityStage(ctx, abilityState, abilityConfig, abilityPlayer(), {
        colors,
        pixels: cellPixels,
        family: selection.theme,
        reducedMotion,
        labelFont: canvasTextFonts(display.snapshot().textFace, {
          ui: '"Field Kit UI", "Field Kit Mono", sans-serif',
        }).ui,
        labelPixels: display.snapshot().textSize === 'large' ? 18 : 14,
      });
    drawTurnCue(colors);
    drawCharacter(colors);
    drawInspection(colors);
  }

  function readouts() {
    const heading = ((((state.heading * 180) / Math.PI) % 360) + 360) % 360;
    const cardinal = [
      'north',
      'northEast',
      'east',
      'southEast',
      'south',
      'southWest',
      'west',
      'northWest',
    ][Math.round(heading / 45) % 8];
    $('speed-value').textContent = number(paused ? 0 : state.speed, 1);
    $('speed-fill').style.width =
      `${clamp((paused ? 0 : state.speed) / (16 * motion.boostMultiplier), 0, 1) * 100}%`;
    $('heading-value').textContent = t('tools:motionLab.heading', {
      direction: compass(cardinal),
      degrees: formatNumber(Math.round(heading), { minimumIntegerDigits: 3, useGrouping: false }),
    });
    $('heading-arrow').style.transform = `rotate(${heading}deg)`;
    const body = presets.characters[selection.character];
    const width = body.widthCells * selection.characterScale;
    $('body-size').textContent = t('tools:motionLab.bodySize', {
      pixels: number(width * cellPixels, 0),
      cells: number(width, 2),
    });
    const recipe = recipeFor(selection.character),
      rotor = recipe.components.find((component) => component.type === 'rotors');
    $('rotor-state').textContent =
      rotor && body.rotors.length
        ? !showRotors
          ? t('tools:motionLab.rotorsHidden')
          : reducedMotion
            ? t('tools:motionLab.rotorsFrozen', { blades: formatNumber(rotor.bladeCount) })
            : paused
              ? t('tools:motionLab.rotorsPaused', { blades: formatNumber(rotor.bladeCount) })
              : t(
                  state.mode === 'boost'
                    ? 'tools:motionLab.rotorsBoost'
                    : state.speed > 0.1
                      ? 'tools:motionLab.rotorsTravel'
                      : 'tools:motionLab.rotorsIdle',
                  { blades: formatNumber(rotor.bladeCount) },
                )
        : recipe.components.length
          ? recipe.components.map((component) => componentName(component.type)).join(' + ')
          : t('tools:motionLab.staticBody');
    $('state-label').textContent = paused
      ? t('interface:paused')
      : state.mode === 'turning'
        ? t('tools:motionLab.bodyTurning')
        : state.mode === 'boost'
          ? t('common:controls.boost')
          : state.mode === 'slow'
            ? t('tools:motionLab.slowInput')
            : state.speed > 0.1
              ? t('tools:motionLab.moving')
              : t('common:status.ready');
    $('mode-label').textContent = autoplay
      ? t('tools:autoplayRoute')
      : t('tools:motionLab.manualInput');
    $('turn-queue').textContent =
      motion.turnPolicy !== 'grid-center'
        ? t('tools:immediateNoQueuedTurn')
        : autoplay
          ? t('tools:motionLab.autoplayGrid')
          : state.queuedDirection
            ? t('tools:motionLab.turnQueued', {
                direction: directionLabel(state.queuedDirection).toUpperCase(),
                x: number(nextGridCenter(state, presets.board).x, 1),
                y: number(nextGridCenter(state, presets.board).y, 1),
              })
            : t('tools:motionLab.turnBufferEmpty', {
                x: number(state.x, 2),
                y: number(state.y, 2),
              });
    $('play-pause').textContent = paused ? t('common:actions.playback') : t('common:actions.pause');
    $('autoplay').checked = autoplay;
    for (const [id, active] of [
      ['boost', keyBoost || pointerBoost],
      ['slow', keySlow || pointerSlow],
    ]) {
      $(id).classList.toggle('is-held', active);
      $(id).setAttribute('aria-pressed', String(active));
    }
    for (const button of document.querySelectorAll('[data-direction]'))
      button.classList.toggle('is-held', steering.snapshot() === button.dataset.direction);
    abilityReadouts();
  }

  function clearHeld(options) {
    steering.clear(options);
    keyBoost = keySlow = pointerBoost = pointerSlow = false;
    for (const [id, button] of pointerCaptures)
      if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
    pointerCaptures.clear();
  }

  function pause(reason = localizedMessage('tools:motionLab.pausedDirection')) {
    paused = true;
    loop.setRunning(false);
    if (!state) return;
    clearHeld({ preserveDirection: true });
    particles = [];
    loop.resetClock();
    eventNote(reason);
    readouts();
    render();
  }

  function resume() {
    if (!loop.canRun || !state) return;
    paused = false;
    loop.setRunning(true);
    loop.resetClock();
    eventNote(
      autoplay
        ? localizedMessage('tools:motionLab.autoplayNotice')
        : localizedMessage('tools:motionLab.manualNotice'),
    );
    readouts();
  }

  function manualStart(key, direction, repeat = false) {
    if (steering.press(key, direction, { active: !paused, repeat })) autoplay = false;
    else if (paused) eventNote(localizedMessage('tools:motionLab.pausedChoose'));
    readouts();
  }

  function reset() {
    state = createMotionState(presets.route, motion);
    liveAnimation = createAnimationState();
    inspectionAnimation = createAnimationState();
    particles = [];
    particleClock = 0;
    clearHeld();
    loop.resetClock();
    resetAbilityState();
    eventNote(localizedMessage('tools:motionLab.resetNotice'));
    readouts();
    render();
  }

  function updateReduced() {
    const next = localReducedMotion || sharedReducedMotion;
    const changed = reducedMotion !== next;
    reducedMotion = next;
    $('reduced-motion').checked = localReducedMotion;
    $('motion-effects-notice').textContent = fieldKitCopy(
      `motion.${sharedReducedMotion ? 'effectsCapped' : localReducedMotion ? 'effectsLocal' : 'effectsFull'}`,
      document.documentElement.lang,
    );
    if (changed) {
      particles = [];
      particleClock = 0;
    }
    // Reading and cosmetic preferences cannot reset input, movement or run intent.
    if (state) {
      readouts();
      render();
    }
  }

  function setReduced(value) {
    localReducedMotion = value;
    updateReduced();
  }

  function setHeldPointer(button, onDown, onUp) {
    const release = (event) => {
      if (pointerCaptures.get(event.pointerId) === button) pointerCaptures.delete(event.pointerId);
      onUp(event.pointerId);
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
      readouts();
    };
    listen(button, 'pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      pointerCaptures.set(event.pointerId, button);
      onDown(event.pointerId);
      readouts();
    });
    listen(button, 'pointerup', release);
    listen(button, 'pointercancel', release);
    listen(button, 'lostpointercapture', (event) => {
      if (pointerCaptures.get(event.pointerId) === button) pointerCaptures.delete(event.pointerId);
      onUp(event.pointerId);
      readouts();
    });
  }

  function setupControls() {
    $('turn-policy').value = motion.turnPolicy || 'immediate';
    listen($('turn-policy'), 'change', (event) => {
      motion.turnPolicy = event.target.value;
      autoplay = false;
      reset();
      pause(
        localizedMessage(
          motion.turnPolicy === 'grid-center'
            ? 'tools:motionLab.gridPolicySelected'
            : 'tools:motionLab.immediatePolicySelected',
          { x: state.x, y: state.y },
        ),
      );
    });
    setOptions('theme', presets.themes, selection.theme);
    setOptions('terrain-layer', presets.terrainLayers, selection.terrainLayer);
    setupCollection();
    setupBackground();
    setupAbilities();
    for (const [id, key, handler] of [
      ['theme', 'theme', applyPalette],
      ['terrain-layer', 'terrainLayer', updateAssetStatus],
    ]) {
      listen($(id), 'change', (event) => {
        selection[key] = event.target.value;
        handler();
        render();
        readouts();
      });
    }
    for (const radio of document.querySelectorAll('[name="terrain-style"]')) {
      radio.checked = radio.value === selection.terrainStyle;
      listen(radio, 'change', (event) => {
        if (event.target.checked) {
          selection.terrainStyle = event.target.value;
          render();
          eventNote(localizedMessage('tools:motionLab.terrainNotice'));
        }
      });
    }
    const ranges = [
      [
        'character-scale',
        'scale-output',
        selection.characterScale,
        (value) => {
          selection.characterScale = value;
        },
        (value) => `${number(value, 2)}×`,
        (value) => t('tools:motionLab.scaleValue', { value: number(value, 2) }),
      ],
      [
        'cruise-speed',
        'speed-output',
        motion.cruiseSpeed,
        (value) => {
          motion.cruiseSpeed = value;
        },
        (value) => t('tools:motionLab.speedValue', { value: formatNumber(value) }),
        (value) => t('tools:motionLab.speedValueAccessible', { value: formatNumber(value) }),
      ],
      [
        'turn-rate',
        'turn-output',
        motion.turnRateDegrees,
        (value) => {
          motion.turnRateDegrees = value;
        },
        (value) => t('tools:motionLab.turnRateValue', { value: formatNumber(value) }),
        (value) => t('tools:motionLab.turnRateAccessible', { value: formatNumber(value) }),
      ],
    ];
    // Keep slider labels local and readable; no values are baked into source artwork.
    for (const [id, output, initial, setter, label, valueText] of ranges) {
      $(id).value = initial;
      setRangeReadout(
        id,
        output,
        () => label(initial),
        () => valueText(initial),
      );
      listen($(id), 'input', (event) => {
        const value = Number(event.target.value);
        setter(value);
        setRangeReadout(
          id,
          output,
          () => label(value),
          () => valueText(value),
        );
        readouts();
        render();
      });
    }
    listen($('show-grid'), 'change', (event) => {
      showGrid = event.target.checked;
      render();
    });
    listen($('show-rotors'), 'change', (event) => {
      showRotors = event.target.checked;
      render();
      readouts();
    });
    listen($('show-particles'), 'change', (event) => {
      showParticles = event.target.checked;
      if (!showParticles) particles = [];
      render();
    });
    $('reduced-motion').checked = localReducedMotion;
    listen($('reduced-motion'), 'change', (event) => setReduced(event.target.checked));
    listen($('play-pause'), 'click', () => (paused ? resume() : pause()));
    listen($('reset'), 'click', reset);
    listen($('autoplay'), 'change', (event) => {
      autoplay = event.target.checked;
      clearHeld();
      if (autoplay) reset();
      resume();
    });
    for (const button of document.querySelectorAll('[data-direction]')) {
      setHeldPointer(
        button,
        (id) => manualStart(`pointer-${id}`, button.dataset.direction),
        (id) => steering.release(`pointer-${id}`),
      );
      listen(button, 'keydown', (event) => {
        if (['Space', 'Enter'].includes(event.code) && !event.repeat) {
          event.preventDefault();
          manualStart(`button-${button.dataset.direction}`, button.dataset.direction);
        }
      });
      listen(button, 'keyup', (event) => {
        if (['Space', 'Enter'].includes(event.code)) {
          event.preventDefault();
          steering.release(`button-${button.dataset.direction}`);
        }
      });
      listen(button, 'blur', () => {
        steering.release(`button-${button.dataset.direction}`);
        readouts();
      });
    }
    setHeldPointer(
      $('boost'),
      () => {
        if (paused) return;
        pointerBoost = true;
        eventNote(localizedMessage('tools:motionLab.boostHeld'));
      },
      () => {
        pointerBoost = false;
      },
    );
    setHeldPointer(
      $('slow'),
      () => {
        if (paused) return;
        pointerSlow = true;
        eventNote(localizedMessage('tools:motionLab.slowHeld'));
      },
      () => {
        pointerSlow = false;
      },
    );
    for (const [id, setter] of [
      [
        'boost',
        (value) => {
          pointerBoost = value;
        },
      ],
      [
        'slow',
        (value) => {
          pointerSlow = value;
        },
      ],
    ]) {
      listen($(id), 'keydown', (event) => {
        if (['Space', 'Enter'].includes(event.code)) {
          event.preventDefault();
          if (!event.repeat && !paused) setter(true);
        }
      });
      listen($(id), 'keyup', (event) => {
        if (['Space', 'Enter'].includes(event.code)) {
          event.preventDefault();
          setter(false);
        }
      });
      listen($(id), 'blur', () => {
        setter(false);
        readouts();
      });
    }
    listen(window, 'keydown', (event) => {
      if (event.code === 'Escape') {
        pause();
        return;
      }
      if (event.target.closest('input,select,textarea,button,[contenteditable=true]')) return;
      if (
        ['KeyE', 'KeyR'].includes(event.code) &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        if (!event.repeat) abilityCommand(event.code === 'KeyE' ? 'act' : 'pickup');
        return;
      }
      // Key repeat after Pause/focus loss cannot resurrect a cleared command; require a fresh press.
      if (event.repeat) return;
      if (keyDirections.has(event.code)) {
        event.preventDefault();
        manualStart(event.code, keyDirections.get(event.code));
      } else if (['ShiftLeft', 'ShiftRight'].includes(event.code)) {
        if (!paused) keyBoost = true;
      } else if (event.code === 'Space') {
        event.preventDefault();
        if (!paused) keySlow = true;
      }
    });
    listen(window, 'keyup', (event) => {
      steering.release(event.code);
      if (['ShiftLeft', 'ShiftRight'].includes(event.code)) keyBoost = false;
      if (event.code === 'Space') keySlow = false;
    });
  }

  function frame(time, dt) {
    if (!state || disposed) return;
    state = steering.advance(
      state,
      {
        boost: keyBoost || pointerBoost,
        slow: keySlow || pointerSlow,
        autoplay,
        paused,
        reducedMotion,
      },
      motion,
      presets.board,
      presets.route,
      dt,
    );
    abilityState = advanceAbility(
      abilityState,
      { player: abilityPlayer(), paused: paused || !abilityEnabled },
      dt,
      abilityConfig,
    );
    updateParticles(dt);
    const travel = { visualSpeed: state.visualSpeed, cruiseSpeed: motion.cruiseSpeed };
    liveAnimation = advanceAnimation(liveAnimation, recipeFor(selection.character), travel, dt, {
      paused,
      reducedMotion,
    });
    inspectionAnimation = advanceAnimation(
      inspectionAnimation,
      recipeFor(inspectedCharacter),
      travel,
      dt,
      { paused, reducedMotion, inspectionSlow: $('inspection-slow').checked },
    );
    if (!paused) render();
    if (time - lastReadout > 80) {
      readouts();
      lastReadout = time;
      if (!paused && state.mode !== lastEventMode) {
        const messages = {
          boost: localizedMessage('tools:motionLab.eventBoost'),
          slow: localizedMessage('tools:motionLab.eventSlow'),
          turning:
            motion.turnPolicy === 'grid-center'
              ? localizedMessage('tools:motionLab.eventGridTurn')
              : localizedMessage('tools:motionLab.eventImmediateTurn'),
          cruise: localizedMessage('tools:motionLab.eventCruise'),
          idle: localizedMessage('tools:motionLab.eventIdle'),
        };
        eventNote(messages[state.mode]);
        lastEventMode = state.mode;
      }
    }
  }

  async function start() {
    const lease = loadPresenter.begin({
      message: localizedMessage('tools:motionLab.loading'),
    });
    try {
      const responses = await Promise.all([
        fetch(presetURL, { signal: startupAbort.signal }),
        fetch(new URL('./collection-presets.json', import.meta.url), {
          signal: startupAbort.signal,
        }),
        fetch(new URL('./ability-presets.json', import.meta.url), { signal: startupAbort.signal }),
      ]);
      if (disposed) return;
      if (responses.some((response) => !response.ok))
        throw Object.assign(
          new Error('A presentation or collection JSON file could not be loaded'),
          { translationKey: 'tools:motionLab.dataUnavailable' },
        );
      const [visuals, definitions, abilityDefinitions] = await Promise.all(
        responses.map((response) => response.json()),
      );
      if (disposed) return;
      presets = freezeMotionPresets(validateAnimationRecipes(validatePresets(visuals)));
      validateCollection(definitions, Object.keys(presets.characters));
      collection = freezeMotionPresets(definitions);
      abilityConfig = freezeMotionPresets(validateAbilityPresets(abilityDefinitions));
      try {
        const raw = localStorage.getItem(storageKey),
          restored = restoreProfile(raw, profileOptions);
        profile = restored.profile;
        storageWarning = restored.warning || '';
        if (restored.warning && raw !== null) recoveryRaw = raw;
      } catch {
        profile = createProfile(profileOptions);
        storageWarning = localizedMessage('tools:motionLab.collectionReadUnavailable');
      }
      contextId = collection.contexts[0].id;
      inspectedCharacter = resolveCharacter(collection, profile, currentContext()).characterId;
      selection = { ...presets.defaults };
      motion = { ...presets.motion };
      state = createMotionState(presets.route, motion);
      autoplay = presets.defaults.autoplay;
      paused = reducedMotion || loop.interrupted;
      setupControls();
      applyPalette();
      resize();
      updateAssetStatus();
      readouts();
      render();
      resizeObserver = new ResizeObserver(() => {
        if (!disposed) {
          resize();
          render();
          readouts();
        }
      });
      resizeObserver.observe(canvas);
      if (reducedMotion) eventNote(localizedMessage('tools:motionLab.reducedStart'));
      lease.finish({ message: localizedMessage('tools:motionLab.ready') });
      setStudyReady(true);
      loop.setReady();
      loop.setRunning(!paused);
    } catch (error) {
      if (disposed) return;
      loop.dispose();
      lease.finish({
        message: localizedMessage('tools:motionLab.unavailableRetry'),
        state: 'error',
      });
      $('load-error').hidden = false;
      localizedText($('load-error'), () =>
        t('tools:motionLab.loadError', {
          detail: error.translationKey ? t(error.translationKey) : error.message,
        }),
      );
      $('motion-retry').hidden = false;
      localizedText($('state-label'), localizedMessage('tools:motionLab.unavailable'));
      setStudyReady(false);
    }
  }

  function cancelPendingBackground() {
    backgroundToken++;
    if (!pendingBackground) return;
    const { image, url } = pendingBackground;
    pendingBackground = null;
    if (image) {
      image.onload = image.onerror = null;
      image.removeAttribute('src');
    }
    if (url) URL.revokeObjectURL(url);
    backgroundMessage(localizedMessage('tools:motionLab.imageCancelled'), 'cancelled');
  }

  const loop = createPreviewLoop({
    initiallyInterrupted: display.interrupted,
    initiallyAway: display.away,
    onFrame: frame,
    onInterrupt(reason) {
      pause(
        reason === 'blur'
          ? localizedMessage('tools:motionLab.pausedBlur')
          : localizedMessage('tools:motionLab.pausedAway'),
      );
      steering.clear({ preserveDirection: true, forgetPhysical: true });
    },
    onPageHide: cancelPendingBackground,
    onDispose() {
      disposed = true;
      startupAbort.abort();
      setStudyReady(false);
      clearHeld({ preserveDirection: true, forgetPhysical: true });
      listeners.splice(0).forEach((remove) => remove());
      stopDisplay();
      stopLocale();
      resizeObserver?.disconnect();
      cancelPendingBackground();
      if (background) {
        URL.revokeObjectURL(background.url);
        background = null;
      }
      for (const record of images.values()) {
        if (record.pendingImage) record.pendingImage.onload = record.pendingImage.onerror = null;
      }
    },
  });
  const stopLocale = onLocaleChange(() => {
    if (!disposed && state) {
      updateReduced();
    }
  });
  const stopDisplay = display.subscribe((value) => {
    sharedReducedMotion = value.effectiveReducedEffects;
    updateReduced();
  });
  // Owned startup completion is observable to integration fixtures without exposing
  // or replacing movement state. It also fences all asynchronous initialization.
  return start();
}

// An app graph can finish loading after a terminal departure. The independent
// display entry keeps that terminal marker, so a late module cannot remount UI.
export const ready = getMotionDisplay().disposed ? Promise.resolve() : mountMotionLab();
