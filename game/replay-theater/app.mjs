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
const bootDisplay = bootStatus.begin({ message: 'Preparing the theater…', stage: 'reading' });
const presentationFeedback = createOperationStatus($('presentation-status'));
let presentationOperation = null;
const presentationPage = mountPresentationPage({
  onStatus(status) {
    if (status.status === 'preparing') {
      if (!presentationOperation) presentationOperation = presentationFeedback.begin(status);
      else presentationOperation.update(status);
    } else {
      presentationOperation?.finish({
        state: status.status === 'error' ? 'error' : 'ready',
        message:
          status.status === 'error'
            ? 'Release artwork is unavailable; the current look is kept.'
            : '',
      });
      presentationOperation = null;
    }
  },
});
const closeTheater = (event = {}) => {
  if (event.persisted || theaterDisposed) return;
  theaterDisposed = true;
  disposeRecording();
  replayDisplay.dispose();
  bootStatus.dispose();
  presentationFeedback.dispose();
  presentationPage.close();
  window.removeEventListener('pagehide', closeTheater);
};
window.addEventListener('pagehide', closeTheater);
const examples = {
  'fieldcraft-01': {
    file: './data/fieldcraft-01.replay.json',
    brief:
      'Immediate turns · A fiber craft crosses the interference band at full speed. Its exposed cable still needs a safe route home.',
  },
  'fieldcraft-02': {
    file: './data/fieldcraft-02.replay.json',
    brief:
      'Grid-center turns · Collect supplies, place two support fields and change from light to heavy carrier at the south hangar.',
  },
  'fieldcraft-03': {
    file: './data/fieldcraft-03.replay.json',
    brief:
      'Immediate turns · A pulse abandons a threatened live cut. The craft redeploys and takes a safer line to finish.',
  },
  'fieldcraft-04': {
    file: './data/fieldcraft-04.replay.json',
    brief:
      'Grid-center turns · Pick up a net and slow the approaching actor while the exposed cable closes.',
  },
};
const clipped = (value, length = 160) => String(value).slice(0, length);
const encoder = new TextEncoder();

function readRecording(source) {
  if (
    typeof source !== 'string' ||
    source.length > MAX_REPLAY_PRESENTATION_BYTES ||
    encoder.encode(source).byteLength > MAX_REPLAY_PRESENTATION_BYTES
  )
    throw new Error('Recording exceeds the replay plus appearance metadata limit.');
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
  const [themeResponse, presetResponse] = await Promise.all([
    fetch('../content/themes.json'),
    fetch('../../authoring/motion-lab/presets.json'),
  ]);
  if (theaterDisposed) throw new DOMException('The theater is closed.', 'AbortError');
  if (!themeResponse.ok || !presetResponse.ok)
    throw new Error('Presentation assets could not load.');
  const [{ themes }, presets] = await Promise.all([themeResponse.json(), presetResponse.json()]);
  if (theaterDisposed) throw new DOMException('The theater is closed.', 'AbortError');
  const context = $('board').getContext('2d');
  if (!context) throw new Error('This browser could not create a 2D canvas.');
  for (const theme of themes) {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.name;
    $('theme').append(option);
  }
  let player = null,
    painter = null,
    releasePresentationPainter = null,
    actorLease = null,
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
  disposeRecording = () => {
    if (disposed) return;
    disposed = true;
    controller?.abort();
    epoch++;
    importStatus.dispose();
    releasePresentationPainter?.();
    actorLease?.release();
    globalThis.cancelAnimationFrame?.(frameId);
    nativeUnsubscribe?.();
  };
  let importDisplay = null;
  const chosenTheme = () => themes.find((theme) => theme.id === $('theme').value) || themes[0];
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
    $('play-pause').textContent = player?.phase === 'playing' ? 'Pause' : 'Play';
    $('restart').disabled = disabled;
    $('step').disabled = disabled || ['complete', 'error'].includes(player?.phase);
    $('speed').disabled = disabled;
    $('theme').disabled = pending;
    $('cancel-load').hidden = !pending;
    $('playback-phase').textContent = pending ? 'Verifying' : player?.phase || 'Empty';
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
    $('encounter-title').textContent = encounter?.title ?? '';
    $('encounter-instruction').textContent = encounter
      ? `Recorded route: ${encounter.instruction}`
      : '';
    $('timeline').max = Math.max(1, info.totalTicks);
    $('timeline').value = state.tick;
    $('tick-readout').textContent = `Tick ${state.tick} / ${info.totalTicks}`;
    $('time-readout').textContent =
      `${state.time.toFixed(2)} / ${info.durationSeconds.toFixed(2)} s`;
    $('run-readout').textContent =
      `${state.width} × ${state.height} cells · ${info.turnPolicy} · ${clipped(state.activeClassId)} · ${(state.coverage * 100).toFixed(1)}% covered · ${state.lives} lives · ${state.score} recorded points`;
    $('checkpoint').textContent = player.finalCheckpoint
      ? `Final checkpoint matches · ${player.finalCheckpoint.hash} · No progress awarded.`
      : player.phase === 'error'
        ? player.error
        : `Source verified · ${info.totalTicks} exact input ticks · Final checkpoint checked again at the end.`;
  }
  function displayEvents(events) {
    if (events.length) {
      eventLines.push(
        ...events.map(
          (event) =>
            `Tick ${event.tick ?? player.state.tick} · ${clipped(event.type, 80)}${event.classId ? ` · ${clipped(event.classId, 80)}` : ''}${event.primitive ? ` · ${clipped(event.primitive, 80)}` : ''}${event.type === 'signal.changed' && event.resistant && event.zoneIds.length ? ' · interference resisted' : ''}${event.reason ? ` · ${clipped(event.reason, 80)}` : ''}`,
        ),
      );
      eventLines = eventLines.slice(-12);
    }
    const items = (eventLines.length ? eventLines : ['No events yet.']).map((text) => {
      const item = document.createElement('li');
      item.textContent = text;
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
      $('transport-status').textContent =
        'Paused after a long frame gap. Choose Play to continue the exact recording.';
    else if (result.phase === 'complete')
      $('transport-status').textContent =
        'Recording complete. The final state matches. Restart to watch again.';
    updateControls();
    readouts();
  }
  function cancelLoad() {
    if (!pending) return;
    importDisplay?.finish({
      state: 'cancelled',
      message: 'Load cancelled. The previous recording is unchanged.',
    });
    importDisplay = null;
    controller?.abort();
    epoch++;
    pending = false;
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
    const current = () => !disposed && ticket === epoch && !nextController.signal.aborted;
    const display = importStatus.begin({
      message: `Reading ${clipped(label)}…`,
      stage: 'reading',
      isCurrent: current,
    });
    importDisplay = display;
    let stagedActors = null,
      stagedPainterRelease = null;
    const releaseStaged = () => {
      stagedPainterRelease?.();
      stagedPainterRelease = null;
      stagedActors?.release();
      stagedActors = null;
    };
    nextController.signal.addEventListener('abort', releaseStaged, { once: true });
    try {
      const source = await getSource(nextController.signal);
      if (!current()) return;
      const { envelope, replay } = readRecording(source);
      display.update({
        message: 'Verifying the recording’s exact input ticks…',
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
        display.update({
          message: 'Checking the recorded mission owner and exact FPV actors…',
          stage: 'verifying',
          progress: null,
        });
        const actual = await prepareReplayActorContext(envelope, {
          signal: nextController.signal,
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
      }
      let assetMessage = '';
      const nextPainter = new BoardPainter(presets, {
        onAsset: (message) => {
          assetMessage = message;
          if (!disposed && painter === nextPainter) $('asset-status').textContent = message;
        },
      });
      nextPainter.setLevel(nextPlayer.state.level, { seed: nextPlayer.info.seed });
      const theme = chosenTheme();
      display.update({
        message: 'Preparing the recording’s artwork…',
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
      painter = nextPainter;
      releasePresentationPainter = stagedPainterRelease;
      stagedPainterRelease = null;
      actorLease = stagedActors;
      stagedActors = null;
      lastClass = player.state.activeClassId;
      lastFrame = 0;
      eventLines = [];
      displayEvents([]);
      $('recording-name').textContent = player.info.levelName;
      $('asset-status').textContent = assetMessage;
      $('recorded-appearance').textContent = actorLease
        ? 'Recorded FPV actors · Exact actor release restored. Picture, music and interface are not recorded; this theater is silent.'
        : 'Raw replay · Preview actors and scene. No recorded appearance is claimed; this theater is silent.';
      display.finish({ message: `${clipped(label)} verified and loaded. Ready to watch.` });
      $('transport-status').textContent =
        player.phase === 'complete'
          ? 'This recording contains no input ticks. Its final checkpoint matches.'
          : 'Choose Play, or step one recorded tick at a time.';
      readouts();
    } catch (error) {
      if (current())
        display.finish({
          state: 'error',
          message: `Could not load recording: ${clipped(error.message, 300)} The previous recording is unchanged.`,
        });
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
    const example = examples[$('example').value];
    const response = await fetch(example.file, { signal });
    if (!response.ok) throw new Error('The example file could not load.');
    if (Number(response.headers.get('content-length')) > MAX_REPLAY_BYTES)
      throw new Error('Replay exceeds the 32 MiB limit.');
    return response.text();
  }
  function exampleBrief() {
    $('example-brief').textContent = examples[$('example').value].brief;
  }
  function togglePlay() {
    if (!player || pending || ['complete', 'error'].includes(player.phase)) return;
    consume(player.phase === 'playing' ? player.pause() : player.play());
    lastFrame = 0;
    $('transport-status').textContent =
      player.phase === 'playing'
        ? 'Playing the verified recording.'
        : 'Paused. The next recorded input is preserved.';
  }
  function safely(action) {
    if (disposed) return;
    try {
      action();
    } catch (error) {
      player?.pause();
      $('transport-status').textContent = clipped(error.message, 300);
      updateControls();
      readouts();
    }
  }
  $('load-example').addEventListener('click', () => void load(fetchExample, 'Fieldcraft example'));
  $('example').addEventListener('change', exampleBrief);
  $('cancel-load').addEventListener('click', cancelLoad);
  $('load-text').addEventListener('click', () => {
    const text = $('replay-text').value;
    void load(async () => text, 'Pasted replay');
  });
  $('replay-file').addEventListener('change', () => {
    const file = $('replay-file').files?.[0];
    if (!file) return;
    void load(async () => {
      if (file.size > MAX_REPLAY_PRESENTATION_BYTES)
        throw new Error('Recording exceeds the replay plus appearance metadata limit.');
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
      $('transport-status').textContent = 'Restarted at tick zero. Choose Play when ready.';
    }),
  );
  const step = () => {
    if (!player || pending) return;
    consume(player.step());
    if (player.phase !== 'complete')
      $('transport-status').textContent = `Paused at tick ${player.state.tick}.`;
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
      $('transport-status').textContent = actorLease
        ? 'Preview scene changed. Recorded FPV actors and the paused tick are unchanged.'
        : 'Presentation changed. The recording remains paused at the same tick.';
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
      $('transport-status').textContent = 'Playback paused. Choose Play to continue.';
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
        $('transport-status').textContent = `App lifecycle adapter unavailable: ${error.message}`;
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
          actorAppearance: actorLease ? { style: 'fpv', snapshot: actorLease.snapshot } : null,
        });
      }
    });
    frameId = requestAnimationFrame(frame);
  }
  exampleBrief();
  document.querySelector('main').inert = false;
  document.querySelector('main').removeAttribute('aria-busy');
  bootDisplay.clear();
  frameId = requestAnimationFrame(frame);
  void load(fetchExample, 'Copper Crossing example');
} catch (error) {
  if (!theaterDisposed)
    bootDisplay.finish({
      state: 'error',
      message: `The theater could not start: ${clipped(error.message, 300)} Reload the page to try again.`,
    });
}
