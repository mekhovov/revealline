import { contentText } from '../i18n/content.mjs';
import { localizedText, t } from '../i18n/index.mjs';
import { onNativeInactive } from '../platform.mjs';
import { prepareReplayPlayer } from '../replay-player.mjs';
import { MAX_REPLAY_BYTES } from '../replay.mjs';
import { BoardPainter, boardPaintSizeForRun } from '../ui/render.mjs';
import { encounterView } from '../ui/encounter-view.mjs';
import { attachReplayNavigation } from './navigation.mjs';

const $ = (id) => document.getElementById(id);
const examples = {
  'fieldcraft-01': {
    file: './data/fieldcraft-01.replay.json',
    get brief() { return t("interface:immediateTurnsAFiberCraftCrossesTheInterferenceBandAt"); },
  },
  'fieldcraft-02': {
    file: './data/fieldcraft-02.replay.json',
    get brief() { return t("interface:gridCenterTurnsCollectSuppliesPlaceTwoSupportFieldsAnd"); },
  },
  'fieldcraft-03': {
    file: './data/fieldcraft-03.replay.json',
    get brief() { return t("interface:immediateTurnsAPulseAbandonsAThreatenedLiveCutThe"); },
  },
  'fieldcraft-04': {
    file: './data/fieldcraft-04.replay.json',
    get brief() { return t("interface:gridCenterTurnsPickUpANetAndSlowThe"); },
  },
};
const clipped = (value, length = 160) => String(value).slice(0, length);

try {
  const [themeResponse, presetResponse] = await Promise.all([
    fetch('../content/themes.json'),
    fetch('../../authoring/motion-lab/presets.json'),
  ]);
  if (!themeResponse.ok || !presetResponse.ok)
    throw new Error(t("interface:presentationAssetsCouldNotLoad"));
  const [{ themes }, presets] = await Promise.all([themeResponse.json(), presetResponse.json()]);
  const context = $('board').getContext('2d');
  if (!context) throw new Error(t("interface:thisBrowserCouldNotCreateA2dCanvas"));
  for (const theme of themes) {
    const option = document.createElement('option');
    option.value = theme.id;
    localizedText(option, () =>contentText(theme, 'name'));
    $('theme').append(option);
  }
  $('reduced').checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let player = null,
    painter = null,
    pending = false,
    epoch = 0,
    controller = null,
    lastFrame = 0,
    lastClass = null,
    eventLines = [],
    disposed = false,
    frameId = null,
    nativeUnsubscribe = null;
  const chosenTheme = () => themes.find((theme) => theme.id === $('theme').value) || themes[0];
  const bodyFor = (theme, state) => theme.classBodies?.[state.activeClassId] || theme.player;
  function updateControls() {
    const disabled = pending || !player;
    $('play-pause').disabled = disabled || ['complete', 'error'].includes(player?.phase);
    localizedText($('play-pause'), () =>player?.phase === 'playing' ? t("common:actions.pause") : t("common:actions.play"));
    $('restart').disabled = disabled;
    $('step').disabled = disabled || ['complete', 'error'].includes(player?.phase);
    $('speed').disabled = disabled;
    $('theme').disabled = pending;
    $('cancel-load').hidden = !pending;
    localizedText($('playback-phase'), () =>pending ? t("interface:verifying") : player?.phase || t("interface:empty"));
  }
  function readouts() {
    if (!player) return;
    const { state, info } = player;
    const encounter = encounterView(state);
    $('encounter-cue').hidden = !encounter;
    localizedText($('encounter-title'), () =>contentText(encounter, 'title') ?? '');
    localizedText($('encounter-instruction'), () =>encounter
      ? t("gameplay:recordedRoute", { value1: contentText(encounter, 'instruction') })
      : '');
    $('timeline').max = Math.max(1, info.totalTicks);
    $('timeline').value = state.tick;
    localizedText($('tick-readout'), () =>t("gameplay:tick", { value1: state.tick, value2: info.totalTicks }));
    localizedText($('time-readout'), () =>`${state.time.toFixed(2)} / ${info.durationSeconds.toFixed(2)} s`);
    localizedText($('run-readout'), () =>t("gameplay:cellsCoveredLivesRecordedPoints", { value1: state.width, value2: state.height, value3: info.turnPolicy, value4: clipped(state.activeClassId), value5: (state.coverage * 100).toFixed(1), value6: state.lives, value7: state.score }));
    localizedText($('checkpoint'), () =>player.finalCheckpoint
      ? t("gameplay:finalCheckpointMatchesNoProgressAwarded", { value1: player.finalCheckpoint.hash })
      : player.phase === 'error'
        ? player.error
        : t("gameplay:sourceVerifiedExactInputTicksFinalCheckpointCheckedAgainAt", { value1: info.totalTicks }));
  }
  function displayEvents(events) {
    if (events.length) {
      eventLines.push(
        ...events.map(
          (event) =>
            t("gameplay:tick2", { value1: event.tick ?? player.state.tick, value2: clipped(event.type, 80), value3: event.classId ? ` · ${clipped(event.classId, 80)}` : '', value4: event.primitive ? ` · ${clipped(event.primitive, 80)}` : '', value5: event.type === 'signal.changed' && event.resistant && event.zoneIds.length ? ' · interference resisted' : '', value6: event.reason ? ` · ${clipped(event.reason, 80)}` : '' }),
        ),
      );
      eventLines = eventLines.slice(-12);
    }
    const items = (eventLines.length ? eventLines : [t("interface:noEventsYet")]).map((text) => {
      const item = document.createElement('li');
      localizedText(item, () =>text);
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
      localizedText($('transport-status'), () =>t("interface:pausedAfterALongFrameGapChoosePlayToContinue"));
    else if (result.phase === 'complete')
      localizedText($('transport-status'), () =>t("interface:recordingCompleteTheFinalStateMatchesRestartToWatchAgain"));
    updateControls();
    readouts();
  }
  function cancelLoad() {
    if (!pending) return;
    controller?.abort();
    epoch++;
    pending = false;
    localizedText($('import-status'), () =>t("interface:loadCancelledThePreviousRecordingIsUnchanged"));
    updateControls();
  }
  async function load(getSource, label) {
    if (disposed) return;
    controller?.abort();
    const ticket = ++epoch;
    const nextController = new AbortController();
    controller = nextController;
    pending = true;
    player?.pause();
    updateControls();
    localizedText($('import-status'), () =>t("gameplay:reading2", { value1: clipped(label) }));
    const current = () => !disposed && ticket === epoch && !nextController.signal.aborted;
    try {
      const source = await getSource(nextController.signal);
      if (!current()) return;
      const nextPlayer = await prepareReplayPlayer(source, {
        signal: nextController.signal,
        onProgress: ({ ticks, total }) => {
          if (current()) localizedText($('import-status'), () =>t("gameplay:verifyingTicks", { value1: ticks, value2: total }));
        },
      });
      if (!current()) return;
      let assetMessage = '';
      const nextPainter = new BoardPainter(presets, {
        onAsset: (message) => {
          assetMessage = message;
          if (!disposed && painter === nextPainter) localizedText($('asset-status'), () =>message);
        },
      });
      nextPainter.setLevel(nextPlayer.state.level, { seed: nextPlayer.info.seed });
      const theme = chosenTheme();
      await nextPainter.setLook(theme, bodyFor(theme, nextPlayer.state));
      if (!current()) return;
      const size = boardPaintSizeForRun(nextPlayer.state);
      $('board').width = size.width;
      $('board').height = size.height;
      $('board').parentElement.style.setProperty('--board-ratio', String(size.width / size.height));
      $('board').parentElement.style.setProperty('--board-width', `${size.width}px`);
      player = nextPlayer;
      painter = nextPainter;
      player.setRate(Number($('speed').value));
      lastClass = player.state.activeClassId;
      lastFrame = 0;
      eventLines = [];
      displayEvents([]);
      localizedText($('recording-name'), () =>player.info.levelName);
      localizedText($('asset-status'), () =>assetMessage);
      localizedText($('import-status'), () =>t("gameplay:verifiedAndLoadedReadyToWatch", { value1: clipped(label) }));
      localizedText($('transport-status'), () =>player.phase === 'complete'
          ? t("interface:thisRecordingContainsNoInputTicksItsFinalCheckpointMatches")
          : t("interface:choosePlayOrStepOneRecordedTickAtATime"));
      readouts();
    } catch (error) {
      if (current())
        localizedText($('import-status'), () =>t("gameplay:couldNotLoadRecordingThePreviousRecordingIsUnchanged", { value1: clipped(error.message, 300) }));
    } finally {
      if (ticket === epoch) {
        pending = false;
        updateControls();
      }
    }
  }
  async function fetchExample(signal) {
    const example = examples[$('example').value];
    const response = await fetch(example.file, { signal });
    if (!response.ok) throw new Error(t("interface:theExampleFileCouldNotLoad"));
    if (Number(response.headers.get('content-length')) > MAX_REPLAY_BYTES)
      throw new Error(t("interface:replayExceedsThe32MibLimit"));
    return response.text();
  }
  function exampleBrief() {
    localizedText($('example-brief'), () =>examples[$('example').value].brief);
  }
  function togglePlay() {
    if (!player || pending || ['complete', 'error'].includes(player.phase)) return;
    consume(player.phase === 'playing' ? player.pause() : player.play());
    lastFrame = 0;
    localizedText($('transport-status'), () =>player.phase === 'playing'
        ? t("interface:playingTheVerifiedRecording")
        : t("interface:pausedTheNextRecordedInputIsPreserved"));
  }
  function safely(action) {
    if (disposed) return;
    try {
      action();
    } catch (error) {
      player?.pause();
      localizedText($('transport-status'), () =>clipped(error.message, 300));
      updateControls();
      readouts();
    }
  }
  $('load-example').addEventListener('click', () => void load(fetchExample, t("interface:fieldcraftExample")));
  $('example').addEventListener('change', exampleBrief);
  $('cancel-load').addEventListener('click', cancelLoad);
  $('load-text').addEventListener('click', () => {
    const text = $('replay-text').value;
    void load(async () => text, t("interface:pastedReplay"));
  });
  $('replay-file').addEventListener('change', () => {
    const file = $('replay-file').files?.[0];
    if (!file) return;
    void load(async () => {
      if (file.size > MAX_REPLAY_BYTES) throw new Error(t("interface:replayExceedsThe32MibLimit"));
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
      localizedText($('transport-status'), () =>t("interface:restartedAtTickZeroChoosePlayWhenReady"));
    }),
  );
  const step = () => {
    if (!player || pending) return;
    consume(player.step());
    if (player.phase !== 'complete')
      localizedText($('transport-status'), () =>t("gameplay:pausedAtTick", { value1: player.state.tick }));
  };
  $('step').addEventListener('click', () => safely(step));
  $('speed').addEventListener('change', () =>
    safely(() => {
      if (player && !pending) consume(player.setRate(Number($('speed').value)));
    }),
  );
  $('theme').addEventListener('change', () =>
    safely(() => {
      if (!player || pending) return;
      consume(player.pause());
      const theme = chosenTheme();
      void painter.setLook(theme, bodyFor(theme, player.state));
      localizedText($('transport-status'), () =>t("interface:presentationChangedTheRecordingRemainsPausedAtTheSameTick"));
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
      localizedText($('transport-status'), () =>t("interface:playbackPausedChoosePlayToContinue"));
    },
    onDispose: () => {
      disposed = true;
      globalThis.cancelAnimationFrame?.(frameId);
      nativeUnsubscribe?.();
    },
  });
  onNativeInactive(navigation.suspend)
    .then((unsubscribe) => {
      if (disposed) unsubscribe();
      else nativeUnsubscribe = unsubscribe;
    })
    .catch((error) => {
      if (!disposed)
        localizedText($('transport-status'), () =>t("gameplay:appLifecycleAdapterUnavailable", { value1: error.message }));
    });
  function frame(now) {
    if (disposed) return;
    navigation.sample(now);
    const dt = lastFrame ? Math.max(0, (now - lastFrame) / 1000) : 0;
    lastFrame = now;
    safely(() => {
      if (player && painter) {
        if (player.phase === 'playing' && !pending) consume(player.advance(dt));
        painter.draw(context, player.state, Math.min(dt, 0.1), {
          paused: player.phase !== 'playing',
          reduced: $('reduced').checked,
          showGrid: $('grid').checked,
          fullReveal: player.phase === 'complete' && player.state.status === 'won',
          celebrationPaused: document.hidden,
        });
      }
    });
    frameId = requestAnimationFrame(frame);
  }
  exampleBrief();
  document.querySelector('main').inert = false;
  document.querySelector('main').removeAttribute('aria-busy');
  $('boot-status').hidden = true;
  frameId = requestAnimationFrame(frame);
  void load(fetchExample, t("interface:copperCrossingExample"));
} catch (error) {
  localizedText($('boot-status'), () =>t("gameplay:theTheaterCouldNotStartReloadThePageToTry", { value1: clipped(error.message, 300) }));
}
