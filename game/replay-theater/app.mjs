import { onNativeInactive } from '../platform.mjs';
import { prepareReplayPlayer } from '../replay-player.mjs';
import { MAX_REPLAY_BYTES } from '../replay.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { encounterView } from '../ui/encounter-view.mjs';

const $ = (id) => document.getElementById(id);
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

try {
  const [themeResponse, presetResponse] = await Promise.all([
    fetch('../content/themes.json'),
    fetch('../../authoring/motion-lab/presets.json'),
  ]);
  if (!themeResponse.ok || !presetResponse.ok)
    throw new Error('Presentation assets could not load.');
  const [{ themes }, presets] = await Promise.all([themeResponse.json(), presetResponse.json()]);
  const context = $('board').getContext('2d');
  if (!context) throw new Error('This browser could not create a 2D canvas.');
  for (const theme of themes) {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.name;
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
    eventLines = [];
  const chosenTheme = () => themes.find((theme) => theme.id === $('theme').value) || themes[0];
  const bodyFor = (theme, state) => theme.classBodies?.[state.activeClassId] || theme.player;
  function updateControls() {
    const disabled = pending || !player;
    $('play-pause').disabled = disabled || ['complete', 'error'].includes(player?.phase);
    $('play-pause').textContent = player?.phase === 'playing' ? 'Pause' : 'Play';
    $('restart').disabled = disabled;
    $('step').disabled = disabled || ['complete', 'error'].includes(player?.phase);
    $('speed').disabled = disabled;
    $('theme').disabled = pending;
    $('cancel-load').hidden = !pending;
    $('playback-phase').textContent = pending ? 'Verifying' : player?.phase || 'Empty';
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
      `${info.turnPolicy} · ${clipped(state.activeClassId)} · ${(state.coverage * 100).toFixed(1)}% covered · ${state.lives} lives · ${state.score} recorded points`;
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
    painter.effectsFor(result.events);
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
    controller?.abort();
    epoch++;
    pending = false;
    $('import-status').textContent = 'Load cancelled. The previous recording is unchanged.';
    updateControls();
  }
  async function load(getSource, label) {
    controller?.abort();
    const ticket = ++epoch;
    const nextController = new AbortController();
    controller = nextController;
    pending = true;
    player?.pause();
    updateControls();
    $('import-status').textContent = `Reading ${clipped(label)}…`;
    const current = () => ticket === epoch && !nextController.signal.aborted;
    try {
      const source = await getSource(nextController.signal);
      if (!current()) return;
      const nextPlayer = await prepareReplayPlayer(source, {
        signal: nextController.signal,
        onProgress: ({ ticks, total }) => {
          if (current()) $('import-status').textContent = `Verifying ${ticks} / ${total} ticks…`;
        },
      });
      if (!current()) return;
      let assetMessage = '';
      const nextPainter = new BoardPainter(presets, {
        onAsset: (message) => {
          assetMessage = message;
          if (painter === nextPainter) $('asset-status').textContent = message;
        },
      });
      nextPainter.setLevel(nextPlayer.state.level, { seed: nextPlayer.info.seed });
      const theme = chosenTheme();
      await nextPainter.setLook(theme, bodyFor(theme, nextPlayer.state));
      if (!current()) return;
      player = nextPlayer;
      painter = nextPainter;
      player.setRate(Number($('speed').value));
      lastClass = player.state.activeClassId;
      lastFrame = 0;
      eventLines = [];
      displayEvents([]);
      $('recording-name').textContent = player.info.levelName;
      $('asset-status').textContent = assetMessage;
      $('import-status').textContent = `${clipped(label)} verified and loaded. Ready to watch.`;
      $('transport-status').textContent =
        player.phase === 'complete'
          ? 'This recording contains no input ticks. Its final checkpoint matches.'
          : 'Choose Play, or step one recorded tick at a time.';
      readouts();
    } catch (error) {
      if (current())
        $('import-status').textContent =
          `Could not load recording: ${clipped(error.message, 300)} The previous recording is unchanged.`;
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
      if (file.size > MAX_REPLAY_BYTES) throw new Error('Replay exceeds the 32 MiB limit.');
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
      $('transport-status').textContent =
        'Presentation changed. The recording remains paused at the same tick.';
    }),
  );
  $('board').addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code === 'ArrowRight') {
      event.preventDefault();
      if (!event.repeat) safely(event.code === 'Space' ? togglePlay : step);
    }
  });
  onNativeInactive(() => {
    lastFrame = 0;
    if (player?.phase === 'playing') consume(player.pause());
  }).catch((error) => {
    $('transport-status').textContent = `App lifecycle adapter unavailable: ${error.message}`;
  });
  document.addEventListener('visibilitychange', () => {
    lastFrame = 0;
    if (document.hidden && player?.phase === 'playing') {
      consume(player.pause());
      $('transport-status').textContent =
        'Paused while this page is hidden. Choose Play to continue.';
    }
  });
  function frame(now) {
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
    requestAnimationFrame(frame);
  }
  exampleBrief();
  document.querySelector('main').inert = false;
  document.querySelector('main').removeAttribute('aria-busy');
  $('boot-status').hidden = true;
  requestAnimationFrame(frame);
  void load(fetchExample, 'Copper Crossing example');
} catch (error) {
  $('boot-status').textContent =
    `The theater could not start: ${clipped(error.message, 300)} Reload the page to try again.`;
}
