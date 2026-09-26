import { REPLAY_EXAMPLES as examples } from './examples.mjs';
import { loadEditionToolProvider, editionToolPresentation } from '../ui/edition-tool-provider.mjs';
import { contentText } from '../i18n/content.mjs';
import { t, localizedText } from '../i18n/index.mjs';
import { mountPresentationPage } from '../presentation/page.mjs';
import { onNativeInactive } from '../platform.mjs';
import { prepareReplayPlayer } from '../replay-player.mjs';
import { MAX_REPLAY_BYTES } from '../replay.mjs';
import {
  MAX_REPLAY_PRESENTATION_BYTES,
  snapshotReplayPresentation,
} from '../replay-presentation.mjs';
import { prepareReplayActorContext } from '../replay-actor-context.mjs';
import { prepareRetainedActorAppearanceLease } from '../presentation/actor-appearance-lease.mjs';
import { acquireCandidatePicture, claimCandidatePicture } from '../content-design/picture.mjs';
import { BoardPainter, boardPaintSizeForRun } from '../ui/render.mjs';
import { encounterView } from '../ui/encounter-view.mjs';
import { attachReplayNavigation } from './navigation.mjs';
import { createOperationStatus } from '../ui/operation-status.mjs';
import { mountReplayDisplay } from './display.mjs';

const $ = (id) => document.getElementById(id);
globalThis.RevealLineToolLaunch?.attached();
let theaterDisposed = false;
let disposeRecording = () => {};
const replayDisplay = mountReplayDisplay();
const bootStatus = createOperationStatus($('boot-status'));
const bootDisplay = bootStatus.begin({
  message: t('interface:preparingTheTheater'),
  stage: 'reading',
});
const presentationFeedback = createOperationStatus($('presentation-status'));
let presentationOperation = null;
let runtimeContent = null,
  presentationPage = null;
const closeTheater = (event = {}) => {
  if (event.persisted || theaterDisposed) return;
  theaterDisposed = true;
  disposeRecording();
  replayDisplay.dispose();
  bootStatus.dispose();
  presentationFeedback.dispose();
  presentationPage?.close();
  window.removeEventListener('pagehide', closeTheater);
};
window.addEventListener('pagehide', closeTheater);

const clipped = (value, length = 160) => String(value).slice(0, length);
const encoder = new TextEncoder();

function readRecording(source) {
  if (
    typeof source !== 'string' ||
    source.length > MAX_REPLAY_PRESENTATION_BYTES ||
    encoder.encode(source).byteLength > MAX_REPLAY_PRESENTATION_BYTES
  )
    throw new Error(t('interface:recordingExceedsTheReplayPlusAppearanceMetadataLimit'));
  const document = JSON.parse(source);
  // Raw recordings keep their original parser and byte budget, including source
  // whitespace. A declared wrapper must pass its closed, independently bounded
  // components; it never registers its uploaded actor identity as trusted.
  const envelope =
    document && typeof document === 'object' && Object.hasOwn(document, 'format')
      ? snapshotReplayPresentation(source)
      : null;
  return { envelope, replay: envelope?.replay ?? source };
}

try {
  runtimeContent = await loadEditionToolProvider();
  if (theaterDisposed) throw new DOMException(t('interface:theTheaterIsClosed'), 'AbortError');
  presentationPage = runtimeContent
    ? editionToolPresentation()
    : mountPresentationPage({
        onStatus(status) {
          if (status.status === 'preparing') {
            if (!presentationOperation) presentationOperation = presentationFeedback.begin(status);
            else presentationOperation.update(status);
          } else {
            presentationOperation?.finish({
              state: status.status === 'error' ? 'error' : 'ready',
              message:
                status.status === 'error'
                  ? t('interface:releaseArtworkIsUnavailableTheCurrentLookIsKept')
                  : '',
            });
            presentationOperation = null;
          }
        },
      });
  const [{ themes }, presets] = runtimeContent
    ? [runtimeContent.boot[1], runtimeContent.boot[2]]
    : await Promise.all([
        fetch('../content/themes.json').then((response) => {
          if (!response.ok) throw new Error(t('interface:presentationAssetsCouldNotLoad'));
          return response.json();
        }),
        fetch('../../authoring/motion-lab/presets.json').then((response) => {
          if (!response.ok) throw new Error(t('interface:presentationAssetsCouldNotLoad'));
          return response.json();
        }),
      ]);
  if (!runtimeContent) {
    const selected = $('example').value;
    $('example').replaceChildren(
      ...Object.entries(examples).map(([id, source]) => {
        const option = document.createElement('option');
        option.value = id;
        localizedText(option, () => t(source.labelKey));
        return option;
      }),
    );
    $('example').value = examples[selected] ? selected : Object.keys(examples)[0];
  }
  if (runtimeContent) {
    for (const id of ['example', 'example-brief', 'load-example']) $(id).hidden = true;
    const exampleLabel = document.querySelector('label[for="example"]');
    if (exampleLabel) exampleLabel.hidden = true;
    localizedText($('load-heading'), () => 'Import a recording');
    const section = $('example').closest('section');
    const importPanel = section?.querySelector('.import-panel');
    if (importPanel) importPanel.open = true;
    const label = section?.querySelector('.eyebrow');
    if (label) localizedText(label, () => runtimeContent.selection.edition.name);
    const examplesFootnote = document.querySelector(
      '[data-i18n="interface:theExamplesUseNormalMovementEquipmentAndClassChangeInputs"]',
    );
    if (examplesFootnote) examplesFootnote.hidden = true;
    $('load-example').disabled = true;
    const explanation = document.querySelector(
      '[data-i18n="interface:themesChangeThePreviewSceneAndRawReplayActorsRecorded"]',
    );
    if (explanation)
      localizedText(
        explanation,
        () =>
          'Company recordings require their exact original actors, palette and mission picture. Raw recordings use the selected preview theme. Gameplay and results stay as recorded. Music and the original interface are not restored; this theater is silent.',
      );
  }
  if (theaterDisposed) throw new DOMException(t('interface:theTheaterIsClosed'), 'AbortError');
  const context = $('board').getContext('2d');
  if (!context) throw new Error(t('interface:thisBrowserCouldNotCreateA2dCanvas'));
  for (const theme of themes) {
    const option = document.createElement('option');
    option.value = theme.id;
    localizedText(option, () => contentText(theme, 'name'));
    $('theme').append(option);
  }
  let player = null,
    painter = null,
    releasePresentationPainter = null,
    actorLease = null,
    pictureLease = null,
    pending = false,
    epoch = 0,
    controller = null,
    lastFrame = 0,
    lastClass = null,
    eventLines = [],
    disposed = false,
    frameId = null,
    nativeUnsubscribe = null;
  const importStatus = createOperationStatus($('import-status'), { isCurrent: () => !disposed });
  let retainedRecovery = null;
  disposeRecording = () => {
    if (disposed) return;
    disposed = true;
    controller?.abort();
    epoch++;
    importStatus.dispose();
    releasePresentationPainter?.();
    actorLease?.release();
    actorLease = null;
    pictureLease?.release();
    pictureLease = null;
    retainedRecovery?.remove();
    globalThis.cancelAnimationFrame?.(frameId);
    nativeUnsubscribe?.();
  };
  let importDisplay = null;
  const chosenTheme = () =>
    themes.find(
      (theme) =>
        theme.id ===
        (actorLease?.pin().authoredPresentationSha256
          ? actorLease.pin().content.contentThemeId
          : $('theme').value),
    ) || themes[0];
  const bodyFor = (theme, state) => theme.classBodies?.[state.activeClassId] || theme.player;
  function updateControls() {
    const previousFocus = document.activeElement;
    const completedControl =
      !disposed &&
      !pending &&
      player?.phase === 'complete' &&
      !document.hidden &&
      document.hasFocus?.() !== false &&
      [$('play-pause'), $('step')].includes(previousFocus);
    const disabled = pending || !player;
    $('play-pause').disabled = disabled || ['complete', 'error'].includes(player?.phase);
    localizedText($('play-pause'), () =>
      player?.phase === 'playing' ? t('common:actions.pause') : t('common:actions.playback'),
    );
    $('restart').disabled = disabled;
    $('step').disabled = disabled || ['complete', 'error'].includes(player?.phase);
    $('speed').disabled = disabled;
    $('theme').disabled = pending || !!actorLease?.pin().authoredPresentationSha256;
    $('cancel-load').hidden = !pending;
    localizedText($('playback-phase'), () =>
      pending ? t('interface:verifying') : player?.phase || t('interface:empty'),
    );
    // Native disabling can move Play/Step focus to BODY. Keep this completed
    // transport journey local without moving focus out of another editor.
    if (
      completedControl &&
      !$('restart').disabled &&
      [previousFocus, document.body, null].includes(document.activeElement)
    ) {
      $('restart').focus({ preventScroll: true });
      $('restart').scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }
  function readouts() {
    if (!player) return;
    const { state, info } = player;
    const encounter = encounterView(state);
    $('encounter-cue').hidden = !encounter;
    localizedText($('encounter-title'), () => contentText(encounter, 'title') ?? '');
    localizedText($('encounter-instruction'), () =>
      encounter
        ? t('gameplay:recordedRoute', { value1: contentText(encounter, 'instruction') })
        : '',
    );
    $('timeline').max = Math.max(1, info.totalTicks);
    $('timeline').value = state.tick;
    localizedText($('tick-readout'), () =>
      t('gameplay:tick', { value1: state.tick, value2: info.totalTicks }),
    );
    localizedText(
      $('time-readout'),
      () => `${state.time.toFixed(2)} / ${info.durationSeconds.toFixed(2)} s`,
    );
    localizedText($('run-readout'), () =>
      t('gameplay:cellsCoveredLivesRecordedPoints', {
        value1: state.width,
        value2: state.height,
        value3: info.turnPolicy,
        value4: clipped(state.activeClassId),
        value5: (state.coverage * 100).toFixed(1),
        value6: state.lives,
        value7: state.score,
      }),
    );
    localizedText($('checkpoint'), () =>
      player.finalCheckpoint
        ? t('gameplay:finalCheckpointMatchesNoProgressAwarded', {
            value1: player.finalCheckpoint.hash,
          })
        : player.phase === 'error'
          ? player.error
          : t('gameplay:sourceVerifiedExactInputTicksFinalCheckpointCheckedAgainAt', {
              value1: info.totalTicks,
            }),
    );
  }
  function displayEvents(events) {
    if (events.length) {
      eventLines.push(
        ...events.map((event) =>
          t('gameplay:tick2', {
            value1: event.tick ?? player.state.tick,
            value2: clipped(event.type, 80),
            value3: event.classId ? ` · ${clipped(event.classId, 80)}` : '',
            value4: event.primitive ? ` · ${clipped(event.primitive, 80)}` : '',
            value5:
              event.type === 'signal.changed' && event.resistant && event.zoneIds.length
                ? ' · interference resisted'
                : '',
            value6: event.reason ? ` · ${clipped(event.reason, 80)}` : '',
          }),
        ),
      );
      eventLines = eventLines.slice(-12);
    }
    const items = (eventLines.length ? eventLines : [t('interface:noEventsYet')]).map((text) => {
      const item = document.createElement('li');
      localizedText(item, () => text);
      return item;
    });
    $('events').replaceChildren(...items);
  }
  function consume(result) {
    painter.effectsFor(result.events, player.state);
    if (result.events.length) displayEvents(result.events);
    if (lastClass !== player.state.activeClassId) {
      lastClass = player.state.activeClassId;
      const theme = chosenTheme();
      void painter.setLook(theme, bodyFor(theme, player.state));
    }
    if (result.reason === 'frame-gap')
      localizedText($('transport-status'), () =>
        t('interface:pausedAfterALongFrameGapChoosePlayToContinue'),
      );
    else if (result.phase === 'complete')
      localizedText($('transport-status'), () =>
        t('interface:recordingCompleteTheFinalStateMatchesRestartToWatchAgain'),
      );
    updateControls();
    readouts();
  }
  function cancelLoad() {
    if (!pending) return;
    importDisplay?.finish({
      state: 'cancelled',
      message: t('interface:loadCancelledThePreviousRecordingIsUnchanged'),
    });
    importDisplay = null;
    controller?.abort();
    epoch++;
    pending = false;
    updateControls();
  }
  async function load(getSource, label) {
    if (disposed) return;
    retainedRecovery?.remove();
    retainedRecovery = null;
    controller?.abort();
    const ticket = ++epoch;
    const nextController = new AbortController();
    controller = nextController;
    pending = true;
    player?.pause();
    updateControls();
    const current = () => !disposed && ticket === epoch && !nextController.signal.aborted;
    const display = importStatus.begin({
      message: `Reading ${clipped(label)}…`,
      stage: 'reading',
      isCurrent: current,
    });
    importDisplay = display;
    let stagedActors = null,
      stagedPicture = null,
      stagedPainterRelease = null,
      retainedRequest = null;
    const releaseStaged = () => {
      stagedPainterRelease?.();
      stagedPainterRelease = null;
      stagedActors?.release();
      stagedActors = null;
      stagedPicture?.release();
      stagedPicture = null;
    };
    nextController.signal.addEventListener('abort', releaseStaged, { once: true });
    try {
      const source = await getSource(nextController.signal);
      if (!current()) return;
      const { envelope, replay } = readRecording(source);
      const receipt = envelope?.actorAppearancePin.authoredPresentationSha256;
      if (runtimeContent && receipt !== runtimeContent.authoredPresentationSha256)
        retainedRequest = runtimeContent.presentationHistory.find((item) => item.id === receipt);
      display.update({
        message: t('interface:verifyingTheRecordingSExactInputTicks'),
        stage: 'verifying',
      });
      const nextPlayer = await prepareReplayPlayer(replay, {
        signal: nextController.signal,
        onProgress: ({ ticks, total }) => {
          display.update({
            progress: total > 0 ? { completed: ticks, total, unit: 'ticks' } : null,
          });
        },
      });
      if (!current()) return;
      if (envelope) {
        if (runtimeContent && envelope.actorAppearancePin.style !== 'campaign')
          throw new Error('This edition does not include that recorded actor style.');
        display.update({
          message: t('interface:checkingTheRecordedMissionOwnerAndExactFpvActors'),
          stage: 'verifying',
          progress: null,
        });
        const actual = await prepareReplayActorContext(envelope, {
          signal: nextController.signal,
          ...(runtimeContent ? { authored: runtimeContent } : {}),
        });
        if (!current()) return;
        stagedActors = await prepareRetainedActorAppearanceLease(
          { pin: envelope.actorAppearancePin, ...actual },
          {
            baseURL: new URL('../presentation/compiled/', location.href),
            signal: nextController.signal,
            currentManifestSha256: presentationPage.current()?.manifestSha256 ?? null,
            onStatus: (status) => display.update(status),
          },
        );
        if (!current()) return;
        if (actual.authoredBackground) {
          display.update({
            message: 'Verifying the recorded mission’s original picture…',
            stage: 'decoding',
            progress: null,
          });
          const picture = await acquireCandidatePicture(actual.authoredBackground, {
            signal: nextController.signal,
          });
          if (!current()) {
            picture.release();
            return;
          }
          stagedPicture = picture;
          claimCandidatePicture(actual.authoredBackground, picture);
        }
      }
      let assetMessage = '';
      const nextPainter = new BoardPainter(presets, {
        onAsset: (message) => {
          assetMessage = message;
          if (!disposed && painter === nextPainter) localizedText($('asset-status'), () => message);
        },
      });
      nextPainter.setLevel(nextPlayer.state.level, { seed: nextPlayer.info.seed });
      const theme = envelope?.actorAppearancePin.authoredPresentationSha256
        ? themes.find((item) => item.id === envelope.actorAppearancePin.content.contentThemeId)
        : chosenTheme();
      display.update({
        message: t('interface:preparingTheRecordingSArtwork'),
        stage: 'decoding',
        progress: null,
      });
      await nextPainter.setLook(theme, bodyFor(theme, nextPlayer.state));
      if (!current()) return;
      nextPlayer.setRate(Number($('speed').value));
      stagedPainterRelease = presentationPage.bindPainter(nextPainter);
      if (!current()) return;
      const size = boardPaintSizeForRun(nextPlayer.state);
      $('board').width = size.width;
      $('board').height = size.height;
      $('board').parentElement.style.setProperty('--board-ratio', String(size.width / size.height));
      $('board').parentElement.style.setProperty('--board-width', `${size.width}px`);
      player = nextPlayer;
      releasePresentationPainter?.();
      actorLease?.release();
      pictureLease?.release();
      painter = nextPainter;
      releasePresentationPainter = stagedPainterRelease;
      stagedPainterRelease = null;
      actorLease = stagedActors;
      stagedActors = null;
      pictureLease = stagedPicture;
      stagedPicture = null;
      if (actorLease?.pin().authoredPresentationSha256) $('theme').value = theme.id;
      lastClass = player.state.activeClassId;
      lastFrame = 0;
      eventLines = [];
      displayEvents([]);
      localizedText($('recording-name'), () => player.info.levelName);
      localizedText($('asset-status'), () => assetMessage);
      localizedText($('recorded-appearance'), () =>
        actorLease
          ? actorLease.pin().authoredPresentationSha256
            ? pictureLease
              ? 'Recorded company actors, palette and original mission picture match their exact artwork receipt. Music and the original interface are not restored.'
              : 'Recorded company actors and procedural palette match their exact artwork receipt. This mission has no authored picture. Music and the original interface are not restored.'
            : t('interface:recordedFpvActorsExactActorReleaseRestoredPictureMusicAnd')
          : t('interface:rawReplayPreviewActorsAndSceneNoRecordedAppearanceIs'),
      );
      display.finish({ message: `${clipped(label)} verified and loaded. Ready to watch.` });
      localizedText($('transport-status'), () =>
        player.phase === 'complete'
          ? t('interface:thisRecordingContainsNoInputTicksItsFinalCheckpointMatches')
          : t('interface:choosePlayOrStepOneRecordedTickAtATime'),
      );
      readouts();
    } catch (error) {
      if (current()) {
        display.finish({
          state: 'error',
          message: `Could not load recording: ${clipped(error.message, 300)} The previous recording is unchanged.`,
        });
        if (retainedRequest) {
          const link = document.createElement('a'),
            target = new URL(location.href);
          target.searchParams.set('edition', runtimeContent.editionId);
          target.searchParams.set('presentation', retainedRequest.id);
          link.href = target.href;
          link.id = 'retained-recording-artwork';
          link.textContent = 'Open the exact retained artwork, then import this recording again';
          retainedRecovery = document.createElement('p');
          retainedRecovery.append(link);
          $('import-status').parentElement.append(retainedRecovery);
        }
      }
    } finally {
      nextController.signal.removeEventListener('abort', releaseStaged);
      releaseStaged();
      if (ticket === epoch) {
        importDisplay = null;
        pending = false;
        updateControls();
      }
    }
  }
  async function fetchExample(signal) {
    if (runtimeContent) throw new Error('Import a recording from this edition.');
    const example = examples[$('example').value];
    const response = await fetch(example.file, { signal });
    if (!response.ok) throw new Error(t('interface:theExampleFileCouldNotLoad'));
    if (Number(response.headers.get('content-length')) > MAX_REPLAY_BYTES)
      throw new Error(t('interface:replayExceedsThe32MibLimit'));
    return response.text();
  }
  function exampleBrief() {
    localizedText($('example-brief'), () => examples[$('example').value].brief);
  }
  function togglePlay() {
    if (!player || pending || ['complete', 'error'].includes(player.phase)) return;
    consume(player.phase === 'playing' ? player.pause() : player.play());
    lastFrame = 0;
    localizedText($('transport-status'), () =>
      player.phase === 'playing'
        ? t('interface:playingTheVerifiedRecording')
        : t('interface:pausedTheNextRecordedInputIsPreserved'),
    );
  }
  function safely(action) {
    if (disposed) return;
    try {
      action();
    } catch (error) {
      player?.pause();
      localizedText($('transport-status'), () => clipped(error.message, 300));
      updateControls();
      readouts();
    }
  }
  $('load-example').addEventListener(
    'click',
    () => void load(fetchExample, t('interface:fieldcraftExample')),
  );
  $('example').addEventListener('change', exampleBrief);
  $('cancel-load').addEventListener('click', cancelLoad);
  $('load-text').addEventListener('click', () => {
    const text = $('replay-text').value;
    void load(async () => text, t('interface:pastedReplay'));
  });
  $('replay-file').addEventListener('change', () => {
    const file = $('replay-file').files?.[0];
    if (!file) return;
    void load(async () => {
      if (file.size > MAX_REPLAY_PRESENTATION_BYTES)
        throw new Error(t('interface:recordingExceedsTheReplayPlusAppearanceMetadataLimit'));
      return file.text();
    }, file.name);
    $('replay-file').value = '';
  });
  $('play-pause').addEventListener('click', () => safely(togglePlay));
  $('restart').addEventListener('click', () =>
    safely(() => {
      if (!player || pending) return;
      player.reset();
      painter.setLevel(player.state.level, { seed: player.info.seed });
      eventLines = [];
      displayEvents([]);
      lastFrame = 0;
      consume(player.pause());
      localizedText($('transport-status'), () =>
        t('interface:restartedAtTickZeroChoosePlayWhenReady'),
      );
    }),
  );
  const step = () => {
    if (!player || pending) return;
    consume(player.step());
    if (player.phase !== 'complete')
      localizedText($('transport-status'), () =>
        t('gameplay:pausedAtTick', { value1: player.state.tick }),
      );
  };
  $('step').addEventListener('click', () => safely(step));
  $('speed').addEventListener('change', () =>
    safely(() => {
      if (player && !pending) consume(player.setRate(Number($('speed').value)));
    }),
  );
  $('theme').addEventListener('change', () =>
    safely(() => {
      if (!player || pending || actorLease?.pin().authoredPresentationSha256) return;
      consume(player.pause());
      const theme = chosenTheme();
      void painter.setLook(theme, bodyFor(theme, player.state));
      localizedText($('transport-status'), () =>
        actorLease
          ? t('interface:previewSceneChangedRecordedFpvActorsAndThePausedTick')
          : t('interface:presentationChangedTheRecordingRemainsPausedAtTheSameTick'),
      );
    }),
  );
  const navigation = attachReplayNavigation({
    pending: () => pending,
    cancelLoad,
    pause: () => {
      if (player?.phase === 'playing') consume(player.pause());
      lastFrame = 0;
    },
    togglePlay: () => safely(togglePlay),
    step: () => safely(step),
    onInactive: () => {
      lastFrame = 0;
      localizedText($('transport-status'), () => t('interface:playbackPausedChoosePlayToContinue'));
    },
    onDispose: () => {
      disposeRecording();
      closeTheater();
    },
  });
  onNativeInactive(navigation.suspend)
    .then((unsubscribe) => {
      if (disposed) unsubscribe();
      else nativeUnsubscribe = unsubscribe;
    })
    .catch((error) => {
      if (!disposed)
        localizedText($('transport-status'), () =>
          t('gameplay:appLifecycleAdapterUnavailable', { value1: error.message }),
        );
    });
  function frame(now) {
    if (disposed) return;
    navigation.sample(now);
    const dt = lastFrame ? Math.max(0, (now - lastFrame) / 1000) : 0;
    lastFrame = now;
    safely(() => {
      if (player && painter) {
        if (player.phase === 'playing' && !pending) consume(player.advance(dt));
        const display = replayDisplay.snapshot();
        painter.draw(context, player.state, Math.min(dt, 0.1), {
          paused: player.phase !== 'playing',
          reduced: display.effectiveReducedEffects,
          textFace: display.textFace,
          showGrid: $('grid').checked,
          fullReveal: player.phase === 'complete' && player.state.status === 'won',
          celebrationPaused: document.hidden,
          backdrop: pictureLease,
          actorAppearance: actorLease
            ? { style: actorLease.pin().style, snapshot: actorLease.snapshot }
            : null,
        });
      }
    });
    frameId = requestAnimationFrame(frame);
  }
  if (!runtimeContent) exampleBrief();
  document.querySelector('main').inert = false;
  document.querySelector('main').removeAttribute('aria-busy');
  bootDisplay.clear();
  frameId = requestAnimationFrame(frame);
  if (!runtimeContent) void load(fetchExample, t('interface:copperCrossingExample'));
} catch (error) {
  if (!theaterDisposed)
    bootDisplay.finish({
      state: 'error',
      message: `The theater could not start: ${clipped(error.message, 300)} Reload the page to try again.`,
    });
}
