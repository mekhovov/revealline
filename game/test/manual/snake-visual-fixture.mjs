import { restoreClassicSnakeReplay, classicSnakeSignalView } from '../../snake/classic-core.mjs';
import {
  createClassicSnakeMatch,
  queueClassicSnakeMatchTurn,
  advanceClassicSnakeMatchTo,
  nextClassicSnakeMatchEventAt,
} from '../../snake/classic-match.mjs';
import { drawClassicBoard } from '../../snake/classic-view.mjs';
import { classicSignalStrength } from '../../snake/classic-signal-view.mjs';
import { resolveClassicBoardScene, classicSceneBackdrop } from '../../snake/classic-scenes.mjs';

export function selectSnakeVisualProof(proofs, { mode = 'solo', signal = 'local' } = {}) {
  const levelId =
    signal === 'broadcast' ? 'classic-field-quiet-channel' : 'classic-field-quiet-return';
  const pace = mode === 'team' && signal === 'broadcast' ? 'slow' : 'normal';
  const proof = proofs.find(
    (row) =>
      row.levelId === levelId &&
      row.mode === (mode === 'team' ? 'team' : 'solo') &&
      row.pace === pace,
  );
  if (!proof) throw new Error('No matching verified visual fixture recording.');
  return proof;
}

/** Replays only accepted journal inputs through the production match engine.
 * No actors, phases, deadlines or outcome fields are edited by this fixture. */
export function createSnakeVisualFixture(proof, mode = proof.mode) {
  const replay = proof.replay;
  if (restoreClassicSnakeReplay(replay).status !== 'won')
    throw new Error('Fixture proof must verify a completed mission.');
  const match = createClassicSnakeMatch(replay.level, {
    mode,
    seed: replay.seed,
    hazardSeed: replay.hazardSeed,
  });
  let cursor = 0;
  return {
    match,
    step() {
      if (match.status !== 'running') return false;
      const tick = match.runs[0].tick;
      while (replay.turns[cursor]?.tick === tick) {
        const turn = replay.turns[cursor++];
        const seats = mode === 'versus' ? [0, 1] : [turn.playerId];
        for (const seat of seats)
          if (!queueClassicSnakeMatchTurn(match, seat, turn.direction))
            throw new Error('Verified fixture input was rejected.');
      }
      advanceClassicSnakeMatchTo(match, nextClassicSnakeMatchEventAt(match));
      return true;
    },
    active() {
      return match.runs.some((run) => classicSignalStrength(run, classicSnakeSignalView(run)) > 0);
    },
    seekBurst() {
      while (match.status === 'running' && !this.active()) this.step();
      return this.active();
    },
  };
}

async function mountFixture() {
  const { document, location, devicePixelRatio, requestAnimationFrame } = globalThis;
  const $ = (id) => document.getElementById(id);
  const query = new URLSearchParams(location.search);
  for (const id of ['mode', 'signal', 'style', 'scene'])
    if (query.has(id)) $(id).value = query.get(id);
  if (query.get('reduced') === '1') $('reduced').checked = true;
  const { proofs } = await (await fetch('../fixtures/classic-snake-v4-proofs.json')).json();
  let driver,
    proof,
    playing = false,
    accumulated = 0,
    clock = 0,
    previous;
  const cards = [];
  function setPlaying(value) {
    playing = value;
    accumulated = 0;
    $('play').textContent = value ? 'Pause' : 'Play verified route';
    $('play').setAttribute('aria-pressed', String(value));
  }
  function reset(seek = true) {
    setPlaying(false);
    clock = 0;
    proof = selectSnakeVisualProof(proofs, { mode: $('mode').value, signal: $('signal').value });
    driver = createSnakeVisualFixture(proof, $('mode').value);
    cards.length = 0;
    $('boards').replaceChildren();
    for (let index = 0; index < driver.match.runs.length; index++) {
      const card = document.createElement('article'),
        heading = document.createElement('h2'),
        status = document.createElement('p'),
        canvas = document.createElement('canvas');
      heading.textContent =
        $('mode').value === 'team' ? 'Team · shared board' : `Player ${index + 1}`;
      canvas.setAttribute('aria-label', `${heading.textContent}: actual Snake board`);
      status.className = 'reception';
      card.append(heading, canvas, status);
      $('boards').append(card);
      cards.push({ card, canvas, status });
    }
    if (seek) driver.seekBurst();
    $('evidence').textContent =
      `${proof.replay.level.name} · ${proof.mode} ${proof.pace} proof · level seed ${proof.seed} · hazard seed ${proof.replay.hazardSeed}. ${$('mode').value === 'versus' ? 'Both real match boards follow the same verified Solo journal.' : 'Production match engine follows the exact verified journal.'}`;
    render();
  }
  function render() {
    const scene = resolveClassicBoardScene({
      boardScene: $('scene').value,
      chapterId: 'classic-snake-signal-tactics',
    });
    const background =
      $('style').value === 'living-circuit' ? classicSceneBackdrop(scene, { document }) : null;
    cards.forEach(({ card, canvas, status }, index) => {
      const run = driver.match.runs[index],
        signal = classicSnakeSignalView(run);
      card.style.backgroundImage = background ? `url("${background}")` : '';
      drawClassicBoard(canvas, run, {
        boardStyle: $('style').value,
        boardScene: $('scene').value,
        chapterId: 'classic-snake-signal-tactics',
        reduced: $('reduced').checked,
        flight: { timeMs: clock },
        cssWidth: canvas.clientWidth || 672,
        pixelRatio: devicePixelRatio,
      });
      const source = signal.sources.find((item) => item.phase === 'jamming') ?? signal.sources[0];
      status.textContent = `Move ${run.tick} · ${(run.elapsedMs / 1000).toFixed(1)}s · ${run.status} · ${source?.phase ?? 'source caught'} · interference ${Math.round(classicSignalStrength(run, signal) * 100)}% · ${Math.max(0, source?.remainingMs ?? 0)}ms`;
    });
    $('step').disabled = driver.match.status !== 'running';
    $('play').disabled = driver.match.status !== 'running';
    $('state').textContent =
      `${playing ? 'Playing' : 'Paused at an exact simulation boundary'} · ${driver.active() ? 'active interference' : 'clear reception'}`;
  }
  for (const id of ['mode', 'signal']) $(id).addEventListener('change', () => reset());
  for (const id of ['style', 'scene', 'reduced']) $(id).addEventListener('change', render);
  $('seek').addEventListener('click', () => reset());
  $('reset').addEventListener('click', () => reset(false));
  $('step').addEventListener('click', () => {
    setPlaying(false);
    driver.step();
    clock += 100;
    render();
  });
  $('play').addEventListener('click', () => setPlaying(!playing));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) setPlaying(false);
  });
  function frame(time) {
    const elapsed = previous == null ? 0 : Math.min(100, time - previous);
    previous = time;
    if (playing) {
      accumulated += elapsed;
      clock += elapsed;
      let interval = nextClassicSnakeMatchEventAt(driver.match) - driver.match.elapsedMs;
      while (accumulated >= interval && driver.match.status === 'running') {
        accumulated -= interval;
        driver.step();
        interval = nextClassicSnakeMatchEventAt(driver.match) - driver.match.elapsedMs;
      }
      if (driver.match.status !== 'running') setPlaying(false);
      render();
    }
    requestAnimationFrame(frame);
  }
  reset();
  requestAnimationFrame(frame);
}
if (globalThis.document?.getElementById('snake-visual-fixture'))
  void mountFixture().catch((error) => {
    globalThis.document.getElementById('state').textContent = `Fixture error: ${error.message}`;
  });
