import { attachDemoLayout } from './demo-layout.mjs';
import { REACTION_PORTRAITS } from '../journey/reaction-portraits.mjs';
import { createReactionPreferences } from '../journey/reaction-preferences.mjs';
import { musicStatusLabel } from './music-credit.mjs';
import { createSoloDemoView } from '../demo-modes/solo-view.mjs';
import { contentText } from '../i18n/content.mjs';
import { t, onLocaleChange } from '../i18n/index.mjs';
import { createRun } from '../core/index.mjs';
import { arcadeActionCapabilities } from '../core/arcade-actions.mjs';
import { boardPaintSizeForRun } from './render.mjs';
import { createSoloDemoAdapter } from '../demo-modes/solo.mjs';
import { createDemoRegistry } from '../demo-registry.mjs';
import { withDemoLoadingDeadline } from '../demo-loading.mjs';
import { createDemoDirector } from '../demo-director.mjs';
import {
  createDemoIdle,
  createDemoPractice,
  createDemoCaptions,
  readDemoSettings,
} from '../demo-experience.mjs';
import { attachDemoInput } from './demo-input.mjs';
import { attachDemoFullscreen } from './demo-fullscreen.mjs';
import { attachDemoClock } from './demo-clock.mjs';
import { attachDemoAudio } from './demo-audio.mjs';
import { bindingLabels } from '../key-bindings.mjs';
import { controllerBindingLabels } from '../controller-bindings.mjs';
import { createDemoControllerFrame } from './demo-controller.mjs';
import { attachControllerNavigation } from './controller-navigation.mjs';

export { resolveDemoTheme } from '../demo-modes/solo.mjs';

/** In-page spectator/practice owner. All campaign mutations are outside this host. */
export function attachDemoHost({
  document: doc = globalThis.document,
  presets,
  getContext,
  loadSources,
  modeId = 'solo',
  adapters = {},
  readMedia,
  getJourneyPictureContext = () => null,
  canAutoStart,
  canOpen,
  onEnter,
  onExit,
  onFreshStart,
  clearInput,
  menu: suppliedMenu,
  nativeConfirmOwned = () => false,
  canWrite = () => false,
  settingsKey,
  storage = globalThis.localStorage,
  setCollect = () => {},
  clearRecordings = async () => {},
  audio = null,
  audioMaster = null,
  onPreparationPhase = () => {},
  onQualityFrame = null,
  onQualityTransition = () => {},
  prepareActors = async () => null,
  preparePresentation = async () => null,
}) {
  const $ = (id) => doc.getElementById(id),
    dialog = $('demo-dialog'),
    canvas = $('demo-canvas');
  if (!dialog || !canvas) return null;
  const guidePreferences = createReactionPreferences({
    getStorage: () => storage,
    window: doc.defaultView ?? globalThis,
  });
  const soloView = createSoloDemoView({
    document: doc,
    dialog,
    canvas,
    readMedia,
    audioMaster,
    audio,
    getContext,
  });
  const { reward, transition: sceneTransition } = soloView;
  const fullscreen = attachDemoFullscreen({ document: doc, dialog, button: $('demo-fullscreen') });
  const layout = attachDemoLayout({ document: doc, dialog, canvas });
  const idle = createDemoIdle(),
    captions = createDemoCaptions();
  let settings = readDemoSettings(storage, settingsKey, getContext().reduced);
  let active = false,
    disposed = false,
    interrupted = false,
    detailsOpen = false,
    lifecycleSuspended = false,
    director = null,
    controller = null,
    epoch = 0,
    practice = null,
    armed = false,
    painter = null,
    picture = null,
    source = null,
    dwell = 0,
    caption = 'demo:tipStart',
    error = '',
    origin = null,
    switchClass = null,
    busy = false,
    adoptedPlayer = null,
    handoffGeneration = 0,
    handoffPending = false,
    pendingFork = null,
    retirement = Promise.resolve(),
    displayLost = false,
    paintOwner = null,
    recoveryPaintTicket = 0,
    controlsRun = null,
    controlsSecond = null,
    controlsPlaybackPhase = null,
    nativeReadoutAge = 0,
    controlsCoverage = null,
    controlsLives = null,
    controlsStatus = null,
    controlsCaption = null,
    controlsController = null,
    controlsNativeHint = null,
    controllerIdentity = null,
    controlsAudio = null,
    controlsReduced = null,
    controlsQuality = null;
  const owners = new WeakMap(),
    resourceOwners = new Set(),
    nativeScenes = new Set(),
    retiredForks = new WeakSet(),
    listeners = [];
  let pendingSourceLoads = 0,
    pendingPreparations = 0,
    workerHandles = 0,
    workersCreated = 0,
    workerTerminationRequests = 0;
  function observeWorker() {
    workerHandles++;
    workersCreated++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      workerHandles--;
      workerTerminationRequests++;
    };
  }
  function resourceSnapshot() {
    const pixels = (canvas.width || 0) * (canvas.height || 0),
      images = new Set(),
      categories = {},
      painters = [];
    let unavailableImages = 0;
    const summarize = (values) => {
      let pixels = 0,
        unknownDimensions = 0;
      for (const image of values) {
        const width = image.naturalWidth || image.width || 0,
          height = image.naturalHeight || image.height || 0;
        if (width > 0 && height > 0) pixels += width * height;
        else unknownDimensions++;
      }
      return { images: values.size, pixels, rgbaBytesEstimate: pixels * 4, unknownDimensions };
    };
    const sources = { presentation: new Set(), actors: new Set(), backdrop: new Set() };
    for (const owner of resourceOwners) {
      if (owner.painter) painters.push(owner.painter.resourceSnapshot());
      for (const [kind, snapshot] of [
        ['presentation', owner.presentation?.snapshot ?? owner.painter?.presentation],
        ['actors', owner.actors?.snapshot],
      ]) {
        try {
          for (const slot of Object.keys(snapshot?.resolved?.assets ?? {})) {
            const image = snapshot.image?.(slot)?.image;
            if (image) sources[kind].add(image);
          }
        } catch {
          unavailableImages++;
        }
      }
      const backdrop = owner.picture?.backdrop?.image;
      if (backdrop) sources.backdrop.add(backdrop);
    }
    for (const [kind, values] of Object.entries(sources)) {
      for (const image of values) images.add(image);
      categories[kind] = summarize(values);
    }
    return {
      ...nativeResourceSnapshot(),
      format: 'DemoOwnedResourcesV1',
      active,
      disposed,
      phase: preparationPhase(),
      pendingSourceLoads,
      pendingPreparations,
      scenes: resourceOwners.size + nativeScenes.size,
      display: { canvases: Number(pixels > 0), pixels, rgbaBytesEstimate: pixels * 4 },
      painters,
      transition: sceneTransition.resourceSnapshot(),
      reward: reward.resourceSnapshot(),
      workers: {
        observedHandles: workerHandles,
        created: workersCreated,
        terminationRequests: workerTerminationRequests,
        accounting:
          'Observed bot Worker handles; successful terminate() calls are requests, not proof of native thread exit.',
      },
      sharedImages: {
        categories,
        uniqueObserved: summarize(images),
        unavailableSnapshots: unavailableImages,
        accounting:
          'Image identity is deduplicated within Demo only. Category rows overlap and are nonadditive with Solo, legacy, enemy and actor pools.',
      },
      accounting:
        'Manual owner snapshot only. Closed Demo retains its display canvas. Pending preparations include canceled work until settlement; unknown native allocations are not zero.',
      estimate:
        'Canvas/image RGBA8 dimensions only; browser/GPU copies and overhead are unobservable. No total memory is claimed.',
    };
  }
  const listen = (element, type, fn, options) => {
    if (!element) return;
    element.addEventListener(type, fn, options);
    listeners.push(() => element.removeEventListener(type, fn, options));
  };
  const text = (id, value) => {
    if ($(id).textContent !== value) $(id).textContent = value;
    if ($(id).dataset.icon) {
      $(id).setAttribute('aria-label', value);
      $(id).title = value;
    }
  };
  const currentRun = () => practice?.state ?? director?.player?.state;
  const allPicturesPreview = () =>
    settings.showAllPictures && !settings.hidePictures && picture?.previewAvailable === true;
  const pictureVisibility = () =>
    settings.hidePictures
      ? 'blurred'
      : allPicturesPreview()
        ? 'clear'
        : (picture?.pictureVisibility ?? 'blurred');
  const foreground = () => !doc.hidden && doc.hasFocus();
  const demoController = createDemoControllerFrame({
    getPreferences: () => getContext().preferences,
  });
  const ownsUI = () => !!doc.activeElement?.closest?.('[data-demo-ui]');
  // Native entries share the same DOM navigator. Existing page-owned navigators
  // keep their guarded Confirm/Back policies when explicitly supplied.
  const menuNavigation = suppliedMenu
    ? null
    : attachControllerNavigation({
        document: doc,
        getScope: () => (active && ownsUI() ? 'menu:shared-demo' : 'flight'),
        getRoot: () => dialog,
        getDefaultFocus: () =>
          $('demo-fresh').hidden || !interrupted ? $('demo-watch-pause') : $('demo-fresh'),
        getControlLabels: () => ({
          directions: t('interface:directionControls'),
          ...controllerBindingLabels(
            getContext().preferences?.controllerBindings,
            controllerIdentity?.id,
          ).menu,
        }),
        onBack: () => close(),
        onMenu: () => close(),
      });
  const menu = suppliedMenu ?? ((command) => menuNavigation.handle(command));

  const renderingLost = () => (!nativeLook() && displayLost) || (paintOwner?.losses?.size ?? 0) > 0;
  const watching = () => active && !practice && !interrupted && !busy && !renderingLost();
  const currentOwner = (owner) =>
    active && !owner.released && owner.epoch === epoch && paintOwner === owner;
  function repaintRecovered() {
    const owner = paintOwner,
      ticket = ++recoveryPaintTicket,
      session = epoch;
    // Painter invalidation/retirement can report restoration synchronously.
    // Repaint only after that owner operation has finished, without clock debt.
    queueMicrotask(() => {
      if (
        ticket !== recoveryPaintTicket ||
        session !== epoch ||
        !owner ||
        !currentOwner(owner) ||
        renderingLost()
      )
        return;
      soloView.invalidate({ context: true });
      paint(0);
    });
  }
  let publishedPreparationPhase = null;
  function preparationPhase() {
    if (!active) return null;
    // An explicit foreground handoff may prepare an independent main renderer
    // while this Demo display remains lost. Suspension still retires handoffs.
    if (handoffPending && foreground()) return 'preparing';
    if (lifecycleSuspended) return 'suspended';
    // Spectator transport remains available in the background. Keep required
    // fetch/decode/worker work admitted, but park bulk main-thread work.
    if (!foreground()) return practice || handoffPending ? 'suspended' : 'playing';
    if (busy || director?.phase === 'loading') return 'preparing';
    if (practice) return practice.phase === 'playing' ? 'playing' : 'paused';
    return interrupted || director?.phase === 'paused' ? 'paused' : 'playing';
  }
  function publishPreparationPhase() {
    const phase = preparationPhase();
    if (phase === null || phase === publishedPreparationPhase) return;
    publishedPreparationPhase = phase;
    onPreparationPhase(phase);
  }
  const takeoverAvailable = () =>
    active && !practice && !busy && !lifecycleSuspended && !renderingLost() && foreground();
  let soloAdapter = createSoloDemoAdapter({
    presets,
    getContext,
    loadSources,
    readMedia,
    getJourneyPictureContext,
    prepareActors,
    preparePresentation,
    owners,
    resourceOwners,
    getEpoch: () => epoch,
    onWorker: observeWorker,
    onContextLoss: (owner) => {
      if (currentOwner(owner)) suspend();
    },
    onContextRestored: (owner) => {
      if (currentOwner(owner)) {
        renderControls();
        repaintRecovered();
      }
    },
    onRetire: (promise) => retire({ dispose: () => promise }),
  });
  const registry = createDemoRegistry({
    solo: loadSources
      ? soloAdapter
      : async () => {
          const { loadStandaloneSoloContext } = await import('../demo-modes/solo-catalog.mjs');
          const standalone = await loadStandaloneSoloContext({ signal: controller?.signal });
          soloAdapter = createSoloDemoAdapter({
            ...standalone,
            getContext: () => ({ ...getContext(), entries: standalone.entries }),
            readMedia,
            getJourneyPictureContext,
            prepareActors,
            preparePresentation,
            owners,
            resourceOwners,
            getEpoch: () => epoch,
            onWorker: observeWorker,
            onContextLoss: (owner) => {
              if (currentOwner(owner)) suspend();
            },
            onContextRestored: (owner) => {
              if (currentOwner(owner)) {
                renderControls();
                repaintRecovered();
              }
            },
            onRetire: (promise) => retire({ dispose: () => promise }),
          });
          return soloAdapter;
        },
    ...adapters,
  });
  const nativeLook = () =>
    director?.player && owners.get(director.player)?.adapter ? owners.get(director.player) : null;
  const nativeResourceSnapshot = () => {
    const stats = nativeLook()?.scene.resourceStats?.() ?? {};
    return {
      ownedNativeScenes: nativeScenes.size,
      practiceWorlds: practice ? 1 : 0,
      ownedHostListeners: listeners.length,
      renderer: {
        ...(stats.registered ?? {}),
        ...(stats.renderer
          ? {
              gpuGeometries: stats.renderer.geometries,
              gpuTextures: stats.renderer.textures,
              gpuPrograms: stats.renderer.programs,
              contextLost: stats.renderer.contextLost,
            }
          : {}),
        ...(Number.isFinite(stats.allocatedSprites)
          ? { allocatedSprites: stats.allocatedSprites }
          : {}),
      },
    };
  };
  let resourceSampleAt = -Infinity;
  const sampleResources = (force = false) => {
    const stamp = Date.now();
    if (!force && stamp - resourceSampleAt < 1000) return;
    resourceSampleAt = stamp;
    dialog.dataset.demoResources = JSON.stringify(nativeResourceSnapshot());
  };
  const focusSurface = () => {
    const look = nativeLook(),
      target = look?.scene.canvas ?? look?.surface ?? canvas;
    target.tabIndex = 0;
    target.focus({ preventScroll: true });
  };
  const disposeFork = async (fork) => {
    if (!fork || retiredForks.has(fork)) return;
    retiredForks.add(fork);
    if (fork.dispose) await fork.dispose();
    else await fork.flight?.dispose?.();
  };
  const retire = (...items) => {
    // Every owner gets a cleanup attempt, even if another owner throws. Keep
    // the barrier across modal closes so a quick reopen cannot overlap engines.
    // Discard settled values so the barrier cannot retain prior result arrays.
    retirement = Promise.allSettled([
      retirement,
      ...items.filter(Boolean).map((item) => Promise.resolve().then(() => item.dispose?.())),
    ]).then(() => undefined);
    return retirement;
  };
  let requested = { modeId, scope: 'current' };
  const readoutSecond = () =>
    Math.floor(nativeLook() ? nativeReadoutAge : (currentRun()?.time ?? 0));
  function renderControls() {
    if (!active) return;
    publishPreparationPhase();
    if (doc.hidden) return;
    sampleResources();
    caption = captions.current;
    fullscreen.refresh();
    dialog.classList.toggle('is-practice', !!practice);
    const state = currentRun(),
      look = nativeLook(),
      presentation = look?.adapter.presentation?.(source, practice ?? look.nativePlayer),
      terminal =
        ['won', 'lost'].includes(state?.status) || (practice ?? director)?.phase === 'complete';
    const current = getContext();
    controlsRun = state;
    controlsSecond = readoutSecond();
    controlsPlaybackPhase = (practice ?? director)?.phase;
    controlsCoverage = Math.round((state?.coverage ?? 0) * 100);
    controlsLives = state?.lives;
    controlsStatus = state?.status ?? state?.phase;
    controlsCaption = caption;
    const connectedController = current.controller ?? controllerIdentity;
    controlsController = connectedController?.id ?? null;
    controlsReduced = current.reduced;
    controlsQuality = current.quality ?? 'full';
    const loading = busy || !director?.player;
    dialog.dataset.scene = loading ? 'loading' : 'playing';
    dialog.dataset.demoMode = source?.modeId ?? modeId;
    dialog.dataset.demoSource = source?.id ?? '';
    dialog.dataset.demoPhase =
      practice?.phase ?? director?.phase ?? (error && !busy ? 'unavailable' : 'loading');
    dialog.dataset.demoTick = String(state?.tick ?? state?.ticks ?? state?.time ?? 0);
    const diagnostics = director?.diagnostics ?? [];
    const lastPreparation = diagnostics.findLast((item) => item.preparation);
    if (lastPreparation) dialog.dataset.demoPreparationDetails = JSON.stringify(lastPreparation);
    else delete dialog.dataset.demoPreparationDetails;
    const lastFailure = diagnostics.findLast((item) => item.event.endsWith('failed'));
    if (lastFailure) {
      dialog.dataset.demoFailure = `${lastFailure.sourceId ?? ''} ${lastFailure.code ?? ''}: ${lastFailure.message ?? ''}`;
      dialog.dataset.demoFailureDetails = JSON.stringify(lastFailure);
    } else {
      delete dialog.dataset.demoFailure;
      delete dialog.dataset.demoFailureDetails;
    }
    const audioState = audio?.snapshot?.(),
      track = audioState?.track;
    controlsAudio = audioControlFields(audioState);
    text(
      'demo-now-playing',
      track
        ? `${track.title} · ${track.artist || t('interface:artistNotRecorded')}`
        : t('interface:noTrackSelected'),
    );
    text(
      'demo-music-state',
      audioState?.muted ? t('demo:audio.soundOff') : musicStatusLabel(audioState?.status ?? 'idle'),
    );
    $('demo-now-playing').title = $('demo-now-playing').textContent;
    const guideVisible = guidePreferences.snapshot().enabled && !practice;
    $('demo-guide-portrait').hidden = !guideVisible;
    $('demo-guide-label').hidden = !guideVisible;
    const portrait =
      REACTION_PORTRAITS.guide[
        !current.reduced &&
        (current.quality ?? 'full') === 'full' &&
        !interrupted &&
        !loading &&
        ['demo:tipClose', 'demo:tipPowerup', 'demo:tipObjective'].includes(caption)
          ? 'react'
          : 'idle'
      ];
    if ($('demo-guide-portrait').getAttribute('src') !== portrait)
      $('demo-guide-portrait').src = portrait;
    $('demo-join-hint').hidden = !!practice;

    text(
      'demo-source',
      t(
        practice
          ? 'demo:practice'
          : source?.kind === 'bot'
            ? 'demo:live'
            : source?.kind === 'improv'
              ? 'demo:improv'
              : 'demo:recorded',
      ),
    );
    text(
      'demo-level',
      presentation
        ? `${look.adapter.label ?? source.modeId} · ${presentation.title ?? source.label}`
        : source
          ? `${t('interface:nativeMenu.solo')} · ${contentText(source.level, 'name')}`
          : t('demo:loading'),
    );
    $('demo-level').title = $('demo-level').textContent;
    text(
      'demo-caption',
      t(
        practice
          ? terminal
            ? 'demo:practiceComplete'
            : armed
              ? 'demo:steer'
              : 'demo:practicePaused'
          : caption,
        { percent: Math.round((state?.coverage ?? 0) * 100) },
      ),
    );
    text(
      'demo-status',
      error ||
        (loading
          ? t('demo:loading')
          : state
            ? t('demo:readout', {
                percent: Math.round(state.coverage * 100),
                lives: state.lives,
                seconds: Math.floor(state.time),
              })
            : ''),
    );
    text(
      'demo-picture-note',
      t(
        settings.hidePictures
          ? 'demo:hiddenPicture'
          : allPicturesPreview()
            ? 'demo:previewPicture'
            : pictureVisibility() === 'clear'
              ? 'demo:earnedPicture'
              : 'demo:blurredPicture',
      ),
    );
    text('demo-panel-caption', $('demo-caption').textContent);
    text('demo-panel-status', $('demo-status').textContent);
    if (look) {
      text(
        'demo-caption',
        practice
          ? terminal
            ? t('demo:practiceComplete')
            : practice.phase === 'playing'
              ? (presentation.goal ?? source.goal ?? '')
              : t('demo:practicePaused')
          : caption === 'demo:tipStart'
            ? (presentation.goal ?? source.goal ?? '')
            : caption,
      );
      text('demo-status', error || presentation.status || '');
      text('demo-panel-caption', $('demo-caption').textContent);
      text('demo-panel-status', $('demo-status').textContent);
      text('demo-picture-note', presentation.goal ?? source.goal ?? '');
    }
    const pictureControl = $('demo-show-all-pictures-live')?.closest?.('label');
    if (pictureControl) pictureControl.hidden = !!look;
    if ($('demo-caption-history'))
      $('demo-caption-history').replaceChildren(
        ...captions.history.map((entry) => {
          const item = doc.createElement('li');
          item.textContent = entry.startsWith('demo:') ? t(entry) : entry;
          return item;
        }),
      );
    if ($('demo-retry'))
      $('demo-retry').hidden = director?.phase !== 'unavailable' && !(error && !director);
    $('demo-panel').hidden = !detailsOpen && !interrupted && !practice;
    dialog.dataset.details = $('demo-panel').hidden ? 'closed' : 'open';
    $('demo-details-close').hidden = interrupted || !!practice;
    $('demo-details-toggle').setAttribute('aria-expanded', String(!$('demo-panel').hidden));
    text('demo-details-toggle', t('demo:details'));
    text('demo-next', t('demo:nextShort'));
    $('demo-next').setAttribute('aria-label', t('demo:next'));
    text('demo-interrupt', t('demo:playChoices'));
    text('demo-back', t('demo:back'));
    $('demo-actions').hidden = !interrupted && !practice;
    $('demo-takeover').hidden = !!practice;
    $('demo-takeover').disabled = loading || terminal || renderingLost();
    $('demo-fresh').disabled = loading;
    $('demo-resume').disabled = busy || (!!practice && terminal) || renderingLost();
    text('demo-resume', t(practice ? 'demo:continuePractice' : 'demo:keepWatching'));
    $('demo-next').hidden = !!practice;
    $('demo-next').disabled = busy || renderingLost();
    $('demo-practice-controls').hidden = !practice;
    const ownControls = !!look?.input;
    const directions = $('demo-practice-controls').querySelector('.demo-directions');
    if (directions) directions.hidden = ownControls;
    const instructions = $('demo-practice-controls').querySelector(
      '[data-i18n="demo:practiceControls"]',
    );
    if (instructions) instructions.hidden = ownControls;
    $('demo-interrupt').hidden = !!practice;
    $('demo-watch-pause').hidden = !!practice;
    $('demo-watch-pause').disabled = handoffPending || renderingLost();
    text('demo-watch-pause', t(interrupted ? 'demo:resumeShort' : 'demo:pauseShort'));
    $('demo-watch-pause').setAttribute(
      'aria-label',
      t(interrupted ? 'demo:resumeDemo' : 'demo:pauseDemo'),
    );
    $('demo-watch-pause').setAttribute('aria-pressed', String(interrupted));

    $('demo-return').hidden = !practice;
    $('demo-return').disabled = renderingLost();
    $('demo-pause').hidden = !practice || !armed;
    const capabilities = arcadeActionCapabilities(state?.level);
    $('demo-ability').hidden = !!look || !capabilities.manualAbility;
    $('demo-pickup').hidden = !!look || !capabilities.manualPickup;
    $('demo-boost').hidden = !!look || !capabilities.manualBoost;
    $('demo-craft').hidden = !practice || !state?.hangars?.length;
    const keys = bindingLabels(getContext().preferences.keyboardBindings);
    text(
      'demo-bound-controls',
      t('demo:boundControls', {
        directions: [keys.up, keys.down, keys.left, keys.right].join(' · '),
        pause:
          keys.pause
            .split(' / ')
            .filter((key) => key !== 'Esc')
            .join(' / ') || t('common:actions.pause'),
      }),
    );
    controlsNativeHint = look?.input?.controllerHint?.() ?? null;
    $('demo-pad-controls').hidden = look?.input?.controllerHint
      ? !controlsNativeHint
      : !connectedController;
    if (look?.input?.controllerHint) text('demo-pad-controls', controlsNativeHint ?? '');
    else if (connectedController) {
      const pad = controllerBindingLabels(
        current.preferences.controllerBindings,
        connectedController.id,
      ).flight;
      text(
        'demo-pad-controls',
        t('demo:padControls', {
          directions: [pad.up, pad.down, pad.left, pad.right].join(' · '),
          pause: pad.pause,
        }),
      );
    }
    for (const action of ['boost', 'ability', 'pickup'])
      text(`demo-${action}`, `${t(`demo:${action}`)} · ${keys[action]}`);
    if (look?.input?.hint) text('demo-bound-controls', look.input.hint());
    else if (presentation?.controls) text('demo-bound-controls', presentation.controls);
  }
  const audioControlFields = (state) => [
    state?.track ? String(state.track.title) : null,
    state?.track?.artist || t('interface:artistNotRecorded'),
    !!state?.muted,
    state?.status ?? 'idle',
  ];
  function audioChanged() {
    if (!active) return;
    publishPreparationPhase();
    if (doc.hidden) return;
    const fields = audioControlFields(audio?.snapshot?.());
    if (controlsAudio && fields.every((value, index) => value === controlsAudio[index])) return;
    renderControls();
  }
  function refreshReadout() {
    const state = currentRun();
    if (
      state !== controlsRun ||
      readoutSecond() !== controlsSecond ||
      (practice ?? director)?.phase !== controlsPlaybackPhase ||
      Math.round((state?.coverage ?? 0) * 100) !== controlsCoverage ||
      state?.lives !== controlsLives ||
      (state?.status ?? state?.phase) !== controlsStatus ||
      getContext().reduced !== controlsReduced ||
      (getContext().quality ?? 'full') !== controlsQuality ||
      caption !== controlsCaption
    )
      renderControls();
  }
  const invalidateDisplay = () => {
    if (!active) return;
    soloView.invalidate();
    if (lifecycleSuspended && !renderingLost()) repaintRecovered();
  };
  listen(doc.defaultView, 'resize', invalidateDisplay);
  listen(doc, 'fullscreenchange', invalidateDisplay);
  listen(doc, 'visibilitychange', () => {
    renderControls();
    if (!doc.hidden && lifecycleSuspended && !renderingLost()) repaintRecovered();
  });
  const preferencesChanged = () => {
    if (!active) return;
    invalidateDisplay();
    renderControls();
  };
  listen(doc, 'change', (event) => {
    // Demo's own controls already publish their precise change synchronously.
    if (event.target?.id?.startsWith('demo-') || event.target?.closest?.('[data-demo-ui]')) return;
    preferencesChanged();
  });
  listen(doc.defaultView, 'storage', preferencesChanged);
  listen(canvas, 'contextlost', () => {
    if (displayLost) return;
    // This canvas survives close/reopen; only its own restoration clears loss.
    displayLost = true;
    soloView.invalidate({ context: true });
    if (!nativeLook()) suspend();
  });
  listen(canvas, 'contextrestored', () => {
    displayLost = false;
    soloView.invalidate({ context: true });
    // A reopened display can lose context before a player exists. Let its
    // required preparation finish in a paused state instead of deadlocking
    // behind the shared suspended admission queue and a disabled Resume.
    if (active && !paintOwner && (busy || director?.phase === 'loading'))
      lifecycleSuspended = false;
    invalidateDisplay();
    renderControls();
    repaintRecovered();
  });
  const displayObserver = doc.defaultView?.ResizeObserver
    ? new doc.defaultView.ResizeObserver(invalidateDisplay)
    : null;
  displayObserver?.observe(canvas);
  function clear() {
    menuNavigation?.clear();
    clearInput();
    input.clear();
  }
  function interrupt({ focus = true } = {}) {
    if (!active) return;
    interrupted = true;
    onQualityTransition();
    reward.pause();
    clock.reset();
    armed = false;
    director?.pause();
    practice?.pause();
    nativeLook()?.input?.clear?.();
    clear();
    renderControls();
    if (focus) $('demo-fresh').focus({ preventScroll: true });
  }
  function foregroundLost() {
    demoController.clear();
    reward.pause();
    idle.activity();
    clear();
    if (practice || handoffPending) suspend();
    else publishPreparationPhase();
  }
  function suspend() {
    demoController.clear();
    idle.activity();
    if (!active) return;
    handoffGeneration++;
    handoffPending = false;
    clock.stop();
    busy = false;
    interrupted = true;
    lifecycleSuspended = true;
    onQualityTransition();
    armed = false;
    director?.suspend();
    practice?.pause();
    nativeLook()?.input?.clear?.();
    clear();
    renderControls();
  }
  function close({ handoff = false } = {}) {
    if (!active) return retirement;
    demoController.clear();
    active = false;
    onQualityTransition();
    soloView.invalidate();
    publishedPreparationPhase = null;
    paintOwner = null;
    // Back cancels pending work immediately; asynchronous resource retirement
    // still joins the barrier before another scene can be prepared.
    director?.suspend();
    detailsOpen = false;
    sceneTransition.clear();
    reward.reset();
    delete dialog.dataset.reward;
    clock.stop();
    audio?.cancelPending?.();
    audioControls.reset();
    handoffPending = false;
    controller?.abort();
    epoch++;
    handoffGeneration++;
    adoptedPlayer = null;
    const fork = pendingFork;
    retire(practice, director, fork && { dispose: () => fork.then(disposeFork, () => {}) });
    director = null;
    painter = picture = source = practice = null;
    captions.reset();
    soloView.reset();
    armed = false;
    busy = false;
    clear();
    idle.activity();
    fullscreen.release();
    dialog.close();
    onExit({ handoff, origin });
    void retirement.then(() => sampleResources(true));
    return retirement;
  }
  async function prepare(source, options) {
    pendingPreparations++;
    try {
      return await prepareScene(source, options);
    } finally {
      pendingPreparations--;
    }
  }
  async function prepareScene(source, { signal, payload, reportPreparation }) {
    reportPreparation?.('retirement');
    await withDemoLoadingDeadline(() => retirement, { signal, timeoutMs: 5000 });
    if ((source.modeId ?? 'solo') === 'solo') {
      reportPreparation?.('source');
      return soloAdapter.prepare(source, { signal });
    }
    reportPreparation?.('adapter');
    const adapter = await registry.adapter(source.modeId, { signal });
    reportPreparation?.('source');
    const player = await source.create({ signal, payload, reportPreparation });
    let scene, ownership;
    const surface = doc.createElement('div');
    surface.className = 'demo-native-surface';
    canvas.parentElement.append(surface);
    nativeScenes.add(surface);
    let released = null;
    const release = () => {
      if (released) return released;
      released = (async () => {
        // Dispose independently: a renderer failure must not leak its physics,
        // input listeners, or the DOM surface it owned.
        await Promise.allSettled(
          [ownership?.input, scene, player]
            .filter(Boolean)
            .map((item) => Promise.resolve().then(() => item.dispose?.())),
        );
        surface.remove();
        nativeScenes.delete(surface);
        sampleResources(true);
      })();
      // A timed-out preparation may still be retiring its renderer while the
      // director tries a fallback. Share the same barrier as close/reopen.
      retire({ dispose: () => released });
      return released;
    };
    const cancel = () => {
      void release();
    };
    signal.addEventListener('abort', cancel, { once: true });
    try {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      reportPreparation?.('mount');
      scene = await adapter.mountScene({
        player,
        parent: surface,
        document: doc,
        signal,
        reportPreparation,
      });
      if (signal.aborted || released) {
        await Promise.resolve()
          .then(() => scene?.dispose?.())
          .catch(() => {});
        throw new DOMException('Cancelled', 'AbortError');
      }
      const wrapper = {
        get state() {
          return player.state;
        },
        get phase() {
          return player.phase;
        },
        get error() {
          return player.error;
        },
        get maxAdvanceSeconds() {
          return player.maxAdvanceSeconds;
        },
        play: () => player.play(),
        pause: () => player.pause(),
        advance: (dt) => player.advance(dt),
        forkForPractice: (options) => player.forkForPractice(options),
        dispose: release,
      };
      ownership = { adapter, scene, surface, nativePlayer: player };
      owners.set(wrapper, ownership);
      return wrapper;
    } catch (failure) {
      await release();
      throw failure;
    } finally {
      signal.removeEventListener('abort', cancel);
    }
  }
  function changed(snapshot) {
    if (!active) return;
    if (snapshot.phase === 'loading') {
      demoController.clear();
      sceneTransition.begin(reward.departureFrame());
      reward.reset();
      delete dialog.dataset.reward;
      clock.reset();
      source = painter = picture = adoptedPlayer = paintOwner = null;
      caption = 'demo:tipStart';
    }
    if (snapshot.source && snapshot.player !== adoptedPlayer) {
      adoptedPlayer = snapshot.player;
      nativeReadoutAge = 0;
      soloView.reset();
      clock.reset();
      source = snapshot.source;
      const look = owners.get(snapshot.player);
      paintOwner = look;
      onQualityTransition();
      canvas.hidden = !!look.adapter;
      if (look.adapter) {
        look.input = look.adapter.attachInput?.({
          root: dialog,
          canvas: look.scene.canvas ?? look.surface,
          practice: () => practice,
          onTakeover: takeover,
          onActivity: () => idle.activity(),
          getContext,
          onBack: () => close(),
          onPause: interrupt,
          onResume: resumePractice,
          menu,
        });
      } else {
        ({ painter, picture } = look);
        audio?.setScene?.({ source, theme: look.theme });
        const size = boardPaintSizeForRun(snapshot.player.state);
        canvas.width = size.width;
        canvas.height = size.height;
      }
      sceneTransition.ready();
      caption = look.adapter
        ? (look.adapter.presentation?.(source, look.nativePlayer)?.goal ?? source.goal ?? '')
        : 'demo:tipStart';
      captions.reset(
        look.adapter
          ? {
              key: `${source.modeId}:goal`,
              text: () =>
                look.adapter.presentation?.(snapshot.source, look.nativePlayer)?.goal ?? '',
            }
          : 'demo:tipStart',
      );
      dwell = 0;
      error = '';
      if (renderingLost()) suspend();
      else if (interrupted || lifecycleSuspended) repaintRecovered();
      // Preserve toolbar ownership during manual Next; otherwise the visible
      // native surface, rather than Solo's hidden canvas, owns game input.
      if (doc.activeElement === canvas || !dialog.contains(doc.activeElement)) focusSurface();
    }
    if (snapshot.phase === 'unavailable') {
      busy = false;
      error = t('demo:unavailable');
      detailsOpen = true;
    }
    if (snapshot.phase === 'paused') interrupted = true;
    renderControls();
  }
  async function open({ modeId: selectedMode = modeId, scope = 'current' } = {}) {
    if (disposed || active || !canOpen()) return false;
    demoController.clear();
    origin = doc.activeElement;
    onEnter();
    onQualityTransition();
    soloView.invalidate();
    clear();
    active = true;
    interrupted = displayLost;
    lifecycleSuspended = displayLost;
    practice = null;
    armed = false;
    error = '';
    source = null;
    busy = true;
    soloView.reset();
    picture = null;
    painter = null;
    caption = 'demo:tipStart';
    requested = { modeId: selectedMode, scope };
    canvas.hidden = false;
    if (!displayLost) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal,
      ticket = ++epoch;
    dialog.showModal();
    if (!displayLost) clock.start();
    audioControls.render();
    canvas.focus({ preventScroll: true });
    renderControls();
    const began = performance.now();
    try {
      await withDemoLoadingDeadline(() => retirement, { signal, timeoutMs: 5000 });
      const sources = await withDemoLoadingDeadline(
        async (signal) => {
          pendingSourceLoads++;
          try {
            return await registry.enumerateSources({ modeId: selectedMode, scope, signal });
          } finally {
            pendingSourceLoads--;
          }
        },
        { signal },
      );
      if (!active || signal.aborted || ticket !== epoch) return false;
      director = createDemoDirector({
        sources,
        prepare,
        onChange: changed,
        modeId: selectedMode,
        scope,
        loading: { recoveryTimeoutMs: Math.max(1, 30000 - (performance.now() - began)) },
      });
      busy = false;
      if (interrupted) {
        await director.next();
        director.pause();
      } else await director.start();
      return active;
    } catch (failure) {
      if (ticket !== epoch || signal.aborted) return false;
      error = t('demo:loadError');
      detailsOpen = true;
      if ($('demo-retry')) $('demo-retry').hidden = false;
      return false;
    } finally {
      if (ticket === epoch) {
        busy = false;
        renderControls();
      }
    }
  }
  function startPractice(run, intent = null, fork = { run }) {
    reward.reset();
    delete dialog.dataset.reward;
    switchClass = null;
    clock.stop();
    const look = nativeLook();
    practice = look ? look.adapter.createPractice(fork) : createDemoPractice(run);
    soloView.invalidate();
    onQualityTransition();
    director.pause();
    interrupted = true;
    armed = true;
    lifecycleSuspended = false;
    dwell = 0;
    $('demo-craft').replaceChildren(
      ...(run?.classRecipes ?? []).map((recipe) => {
        const option = doc.createElement('option');
        option.value = recipe.id;
        option.textContent = contentText(recipe, 'label');
        return option;
      }),
    );
    $('demo-craft').value = run?.activeClassId ?? '';
    clear();
    if (intent) practice.start(intent);
    renderControls();
    if (intent?.action === 'hangar' && !$('demo-craft').hidden)
      $('demo-craft').focus({ preventScroll: true });
    else focusSurface();
  }
  async function takeover(intent = null) {
    if (
      busy ||
      !director?.player ||
      practice ||
      renderingLost() ||
      (intent && !takeoverAvailable())
    )
      return;
    interrupt({ focus: false });
    busy = true;
    handoffPending = true;
    clock.stop();
    renderControls();
    const ticket = epoch,
      handoff = ++handoffGeneration,
      player = director.player;
    let fork,
      adopted = false;
    try {
      const terminal = ['won', 'lost'].includes(player.state.status);
      if (terminal && intent && !nativeLook()) {
        const recording = player.exportRecording();
        fork = { run: createRun(recording.level, recording.options) };
      } else {
        pendingFork = Promise.resolve(player.forkForPractice({ signal: controller.signal }));
        fork = await pendingFork;
      }
      if (
        !active ||
        ticket !== epoch ||
        handoff !== handoffGeneration ||
        director?.player !== player ||
        renderingLost() ||
        doc.hidden ||
        !doc.hasFocus()
      )
        return;
      startPractice(fork.run, intent, fork);
      adopted = true;
    } catch {
      if (active && ticket === epoch) error = t('demo:takeoverError');
    } finally {
      if (!adopted) await disposeFork(fork).catch(() => {});
      if (ticket === epoch) pendingFork = null;
      if (ticket === epoch && handoff === handoffGeneration) {
        busy = false;
        handoffPending = false;
        if (!practice && !lifecycleSuspended) clock.start();
        renderControls();
      }
    }
  }
  async function fresh() {
    if (busy || !source || !director?.player) return;
    interrupt();
    busy = true;
    handoffPending = true;
    clock.stop();
    renderControls();
    const ticket = epoch,
      handoff = ++handoffGeneration,
      selected = source;
    const current = () =>
      active && ticket === epoch && handoff === handoffGeneration && !doc.hidden && doc.hasFocus();
    try {
      const adopted = await onFreshStart(selected, current);
      if (!current()) return;
      if (adopted) {
        close({ handoff: true });
        return;
      }
      if (renderingLost()) return;
      if (!nativeLook()) {
        const recording = director.player.exportRecording();
        startPractice(createRun(recording.level, recording.options));
      }
    } catch {
      if (active && ticket === epoch) error = t('demo:takeoverError');
    } finally {
      if (ticket === epoch && handoff === handoffGeneration) {
        busy = false;
        handoffPending = false;
        if (!practice && !lifecycleSuspended) clock.start();
        renderControls();
      }
    }
  }
  const input = attachDemoInput({
    root: dialog,
    canvas,
    touchSurface: canvas.parentElement,
    active: () => active && !nativeLook()?.input,
    watching,
    takeoverAvailable,
    busy: () => busy,
    practice: () => !!practice && armed,
    getBindings: () => getContext().preferences.keyboardBindings,
    getTouchSettings: () => getContext().touchSettings ?? { mode: 'swipe' },
    tapMode: () => getContext().tapSteering === true,
    interrupt,
    takeover,
    back: () => close(),
    pause: interrupt,
    menu,
    nativeConfirmOwned,
    steer: (direction) => {
      if (practice && armed) {
        practice.steer(direction);
        renderControls();
      }
    },
    onHangar: () => {
      interrupt();
      $('demo-craft').focus();
    },
    ownsUI,
    onActivity: () => idle.activity(),
  });
  listen($('shell-demo'), 'click', () => void open());
  listen($('demo-button'), 'click', () => void open());
  listen($('demo-all-button'), 'click', () => void open({ scope: 'all' }));
  listen($('shell-demo-all'), 'click', () => void open({ scope: 'all' }));
  listen($('demo-retry'), 'click', () => {
    error = '';
    if (director) void director.retry();
    else {
      close();
      void open(requested);
    }
  });
  listen($('demo-interrupt'), 'click', interrupt);
  listen($('demo-pause'), 'click', interrupt);
  listen($('demo-watch-pause'), 'click', () => {
    if (interrupted) resumeWatching();
    else interrupt({ focus: false });
  });
  listen($('demo-back'), 'click', () => close());
  listen(dialog, 'cancel', (event) => {
    event.preventDefault();
    close();
  });
  listen($('demo-takeover'), 'click', () => void takeover());
  listen($('demo-fresh'), 'click', () => void fresh());
  listen($('demo-details-toggle'), 'click', () => {
    detailsOpen = !detailsOpen;
    soloView.invalidate();
    renderControls();
    if (detailsOpen && !interrupted && !practice)
      $('demo-details-close').focus({ preventScroll: true });
  });
  listen($('demo-details-close'), 'click', () => {
    detailsOpen = false;
    soloView.invalidate();
    if (interrupted || practice) return;
    renderControls();
    $('demo-details-toggle').focus();
  });
  listen($('demo-next'), 'click', () => {
    if (!busy && !practice && !renderingLost()) {
      interrupted = false;
      lifecycleSuspended = false;
      error = '';
      clear();
      clock.reset();
      clock.start();
      void director.next({ play: true });
      focusSurface();
    }
  });
  listen($('demo-craft'), 'change', () => {
    switchClass = $('demo-craft').value;
  });
  function resumePractice(intent) {
    if (!active || !practice || busy || renderingLost() || !foreground()) return;
    onQualityTransition();
    error = '';
    lifecycleSuspended = false;
    armed = true;
    if (intent) practice.start(intent);
    else practice.play?.();
    renderControls();
    focusSurface();
  }
  function resumeWatching() {
    if (renderingLost()) return;
    onQualityTransition();
    clear();
    error = '';
    lifecycleSuspended = false;
    if (practice) resumePractice();
    else {
      interrupted = false;
      void director?.play();
    }
    if (!practice) clock.start();
    renderControls();
    focusSurface();
  }
  listen($('demo-resume'), 'click', resumeWatching);
  listen($('demo-return'), 'click', () => {
    if (renderingLost()) return;
    onQualityTransition();
    retire(practice);
    practice = null;
    armed = false;
    interrupted = false;
    lifecycleSuspended = false;
    clear();
    void director?.play();
    clock.start();
    focusSurface();
    renderControls();
  });
  for (const type of ['keydown', 'pointerdown', 'wheel'])
    listen(doc, type, () => idle.activity(), true);
  const showAllPictureControls = [
    $('demo-show-all-pictures'),
    $('demo-show-all-pictures-live'),
  ].filter(Boolean);
  const saveSettings = () => {
    sceneTransition.clear();
    if (!painter) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    settings = {
      ...settings,
      auto: $('demo-auto').checked,
      collect: $('demo-collect').checked,
      hidePictures: $('demo-hide-pictures').checked,
      showAllPictures:
        showAllPictureControls.some((control) => control.checked) &&
        !$('demo-hide-pictures').checked,
    };
    setCollect(settings.collect);
    if (settings.hidePictures) reward.reset();
    renderControls();
    paint(0);
    idle.activity();
    try {
      if (canWrite()) storage.setItem(settingsKey, JSON.stringify({ version: 1, ...settings }));
    } catch {
      text('demo-settings-status', t('demo:settingsSessionOnly'));
    }
  };
  $('demo-auto').checked = settings.auto;
  if ($('demo-auto-live')) $('demo-auto-live').checked = settings.auto;
  $('demo-collect').checked = settings.collect;
  $('demo-hide-pictures').checked = settings.hidePictures;
  for (const control of showAllPictureControls) control.checked = settings.showAllPictures;
  setCollect(settings.collect);
  for (const control of [$('demo-auto'), $('demo-auto-live')].filter(Boolean))
    listen(control, 'change', () => {
      $('demo-auto').checked = control.checked;
      if ($('demo-auto-live')) $('demo-auto-live').checked = control.checked;
      saveSettings();
    });
  listen($('demo-collect'), 'change', saveSettings);
  listen($('demo-hide-pictures'), 'change', () => {
    if ($('demo-hide-pictures').checked)
      for (const control of showAllPictureControls) control.checked = false;
    saveSettings();
  });
  for (const control of showAllPictureControls)
    listen(control, 'change', () => {
      for (const other of showAllPictureControls) other.checked = control.checked;
      if (control.checked) $('demo-hide-pictures').checked = false;
      saveSettings();
    });
  listen($('demo-clear'), 'click', async () => {
    try {
      await clearRecordings();
      text('demo-settings-status', t('demo:cleared'));
    } catch {
      text('demo-settings-status', t('demo:cacheError'));
    }
  });
  function advance(seconds, { fresh = true } = {}) {
    if (renderingLost()) return;
    // Engines keep their own timestep and state shape. Native readout cadence
    // uses only the shared scheduler's already admitted playback time.
    if (nativeLook() && ['playing', 'complete'].includes((practice ?? director)?.phase))
      nativeReadoutAge += seconds;
    const result = practice
      ? practice.advance(seconds, () => {
          const controls = { ...input.controls(), switchClass };
          switchClass = null;
          return controls;
        })
      : director?.advance(seconds);
    const state = currentRun();
    const native = nativeLook();
    if (native) {
      if (!practice && !interrupted)
        caption = captions.advance(
          seconds,
          native.adapter.semanticEvents?.(result?.events ?? []) ?? [],
        );
      if (!doc.hidden) refreshReadout();
      if (!practice && !interrupted && director.phase === 'complete') {
        captions.complete();
        dwell += Math.min(seconds, 0.25);
        if (dwell >= 4 && captions.readyToLeave) {
          dwell = 0;
          void director.next();
        }
      }
      return;
    }
    if (!state || !painter) return;
    const look = owners.get(director.player);
    soloView.events({
      seconds,
      look,
      state,
      result,
      fresh,
      gameSounds: settings.gameSounds,
      source,
    });
    if (result?.reason === 'frame-gap') interrupt();
    if (
      practice &&
      result?.events?.some((event) => ['capture.stopped', 'player.failed'].includes(event.type))
    )
      clear();
    if (!practice && !interrupted) caption = captions.advance(seconds, result?.events);
    if (!doc.hidden) refreshReadout();
    if (!practice && !interrupted && director.phase === 'complete') {
      captions.complete(
        state.status === 'won'
          ? 'demo:recapWin'
          : state.status === 'lost'
            ? 'demo:recapLoss'
            : null,
      );
      dwell += Math.min(seconds, 0.25);
      if (
        soloView.complete({
          state,
          seconds,
          dwell,
          picture,
          visibility: pictureVisibility(),
          interrupted,
          foreground: foreground(),
          gameSounds: settings.gameSounds,
        }) &&
        captions.readyToLeave
      ) {
        dwell = 0;
        void director.next();
      }
    }
  }

  function paint(seconds) {
    if (!active || doc.hidden || renderingLost()) return;
    refreshReadout();
    const state = currentRun();
    const native = nativeLook();
    if (active && native && !doc.hidden) {
      try {
        native.scene.paint(seconds, {
          player: native.nativePlayer,
          practice,
          reduced: getContext().reduced,
        });
      } catch (failure) {
        retire(practice);
        practice = null;
        armed = false;
        interrupted = false;
        lifecycleSuspended = false;
        clear();
        void director.fail(failure);
        clock.start();
      }
      refreshReadout();
      return;
    }
    sceneTransition.paint(
      seconds,
      getContext().reduced || (getContext().quality ?? 'full') !== 'full',
    );
    if (!active || !painter || !state || doc.hidden) return;
    soloView.paint({
      seconds,
      state,
      look: owners.get(director.player),
      practice,
      phase: director.phase,
      interrupted,
      foreground: foreground(),
      visibility: pictureVisibility(),
      detailsOpen,
    });
  }
  function updateAudio() {
    publishPreparationPhase();
    const state = currentRun();
    const look = director?.player && owners.get(director.player);
    // Native engines have different state and sound events. The independent
    // music transport stays owned by demo-audio; Solo's effects adapter must
    // never receive a native flight or Snake board.
    if (look?.adapter) {
      audio?.updateMusic?.();
      look.adapter.updateAudio?.({ player: look.nativePlayer, practice, source, audio });
      return;
    }
    soloView.updateAudio({
      active: settings.gameSounds && (practice ? practice.phase === 'playing' : watching()),
      state,
      look,
      source,
    });
  }
  const clock = attachDemoClock({
    document: doc,
    observeFrame: onQualityFrame,
    getFrameOwner: () => (watching() && foreground() ? (director?.player ?? null) : null),
    frameBoundary: onQualityTransition,
    getPlaybackState: () => ({
      phase:
        !active || practice
          ? 'inactive'
          : busy
            ? 'loading'
            : interrupted
              ? 'paused'
              : (director?.phase ?? 'loading'),
      maxAdvanceSeconds:
        director?.phase === 'playing' ? director.player?.maxAdvanceSeconds : undefined,
    }),
    advance,
    paint,
    updateAudio,
  });
  const audioControls = attachDemoAudio({
    root: $('demo-audio'),
    document: doc,
    audio,
    active: () => active,
    getGameSounds: () => settings.gameSounds,
    onGameSoundsChange: (value) => {
      settings.gameSounds = value;
      saveSettings();
    },
  });
  const unsubscribe = onLocaleChange(preferencesChanged);
  const unsubscribeAudio = audio?.subscribe?.(audioChanged);
  const unsubscribeGuide = guidePreferences.subscribe(renderControls);
  return {
    get active() {
      return active;
    },
    // Identity only: the parent observes practice at its existing POST_RENDER
    // boundary, including controller and submission work, without a second clock.
    get qualityPracticeOwner() {
      return active &&
        foreground() &&
        !busy &&
        !lifecycleSuspended &&
        !renderingLost() &&
        armed &&
        practice?.phase === 'playing'
        ? practice.state
        : null;
    },
    get preparationPhase() {
      return preparationPhase();
    },
    get resourceExportReady() {
      return (
        !active ||
        (!busy &&
          !handoffPending &&
          pendingSourceLoads === 0 &&
          pendingPreparations === 0 &&
          director?.phase !== 'loading' &&
          (practice ? practice.phase !== 'playing' : interrupted || lifecycleSuspended))
      );
    },
    resourceSnapshot,
    get diagnostics() {
      return director?.diagnostics ?? [];
    },
    get resources() {
      return nativeResourceSnapshot();
    },
    get backgroundAudio() {
      return active && !practice && !handoffPending && !lifecycleSuspended;
    },
    containsAudio: (target) => audioControls.contains(target),
    refreshAudio: () => audioControls.render(),
    get inputExclusive() {
      return active;
    },
    get gameplayInputActive() {
      return !ownsUI() && !busy && (takeoverAvailable() || (!!practice && armed));
    },
    get practiceArmed() {
      return !!practice && armed;
    },
    get toggleBoostEligible() {
      return !!practice && armed && practice.state.status === 'running';
    },
    get scope() {
      return practice && armed ? 'attract-practice' : 'attract';
    },
    open,
    close,
    suspend,
    foregroundLost,
    interrupt,
    activity: () => idle.activity(),
    controller(frame) {
      if (!active) return;
      frame = demoController.sample(frame, {
        modeId: source?.modeId ?? modeId,
        scope:
          handoffPending || (!ownsUI() && !busy && (takeoverAvailable() || (!!practice && armed)))
            ? 'flight'
            : 'menu:shared-demo',
        spectator: !practice || !armed,
        toggleBoostEligible: !!practice && armed && practice.state.status === 'running',
      });
      controllerIdentity = frame.assigned ?? null;
      if (nativeLook()?.input) {
        const controls = nativeLook().input;
        (controls.controller ?? controls.sample)?.(frame);
      } else input.controller(frame);
      if (
        (frame.assigned?.id ?? null) !== controlsController ||
        (nativeLook()?.input?.controllerHint?.() ?? null) !== controlsNativeHint
      )
        renderControls();
    },
    update(seconds) {
      if (!active) {
        if (idle.advance(seconds, settings.auto && canAutoStart())) void open();
        return;
      }
      if (!foreground()) {
        foregroundLost();
        return;
      }
      if (practice) {
        updateAudio();
        advance(seconds);
        paint(seconds);
      }
    },
    destroy() {
      close();
      disposed = true;
      clock.destroy();
      sceneTransition.dispose();
      audioControls.dispose();
      input.destroy();
      demoController.dispose();
      menuNavigation?.destroy();
      fullscreen.dispose();
      layout.dispose();
      displayObserver?.disconnect();
      unsubscribe?.();
      unsubscribeAudio?.();
      unsubscribeGuide?.();
      guidePreferences.dispose();
      for (const remove of listeners) remove();
    },
  };
}
