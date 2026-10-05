import {
  createClassicSnakeMatch,
  queueClassicSnakeMatchTurn,
  advanceClassicSnakeMatchTo,
  nextClassicSnakeMatchEventAt,
  classicSnakeMatchSummary,
} from '../snake/classic-match.mjs';
import { drawClassicBoard, classicCatchMarks } from '../snake/classic-view.mjs';
import { advanceClassicFlight } from '../snake/classic-flight-art.mjs';
import { createHuntDestruction } from '../hunt/destruction.mjs';

/** A disposable, unsaved native match. Only engine commands advance it; neither
 * the draft nor a presentation choice can rewrite an accepted actor or body. */
export function createSnakeStudioPreview({ draw = drawClassicBoard } = {}) {
  let match = null,
    playing = false,
    disposed = false,
    flights = [],
    effects = [];
  function clear() {
    effects.forEach((effect) => effect.reset());
    effects = [];
    flights = [];
    playing = false;
    match = null;
  }
  function visuals(elapsed, active, options = {}) {
    match?.runs.forEach((run, i) => {
      flights[i] = advanceClassicFlight(
        flights[i],
        elapsed,
        active && run.status === 'running',
        options.reduced,
      );
      effects[i].advance({ valid: true, eliminations: classicCatchMarks(run) }, elapsed / 1000, {
        ...options,
        key: run,
        paused: !active,
        sources: run.snakes.map((snake) => ({
          ...snake.body[0],
          id: snake.id,
          direction: snake.direction,
        })),
      });
    });
  }
  const snapshot = () => ({
    playing,
    match: match ? classicSnakeMatchSummary(match) : null,
  });
  return Object.freeze({
    snapshot,
    load(level, { mode = 'solo' } = {}) {
      if (disposed) throw new Error('Snake preview is disposed.');
      // Invalid edits retire the old preview rather than showing stale geometry.
      clear();
      match = createClassicSnakeMatch(level, { mode, seed: 17 });
      effects = match.runs.map(() => createHuntDestruction({ preview: true }));
      visuals(0, false);
      return snapshot();
    },
    setPlaying(value) {
      playing = !disposed && !!value && match?.status === 'running';
      return snapshot();
    },
    turn(seat, direction) {
      return !disposed && !!match && queueClassicSnakeMatchTurn(match, seat, direction);
    },
    step(options = {}) {
      playing = false;
      if (!disposed && match?.status === 'running') {
        const next = nextClassicSnakeMatchEventAt(match),
          elapsed = next - match.elapsedMs;
        advanceClassicSnakeMatchTo(match, next);
        visuals(elapsed, true, options);
      }
      return snapshot();
    },
    advance(elapsed, options = {}) {
      if (!disposed && playing && match?.status === 'running') {
        // A delayed/background frame never fast-forwards an unattended preview.
        const dt = Number.isFinite(elapsed) ? Math.max(0, Math.min(100, elapsed)) : 0;
        advanceClassicSnakeMatchTo(match, match.elapsedMs + dt);
        visuals(dt, true, options);
        if (match.status !== 'running') playing = false;
      }
      return snapshot();
    },
    draw(canvases, options = {}) {
      if (disposed || !match) return;
      visuals(0, false, options);
      match.runs.forEach((run, i) => {
        if (!canvases[i]) return;
        draw(canvases[i], run, {
          ...options,
          effects: effects[i],
          flight: flights[i],
          attemptKey: match,
          cssWidth: canvases[i].getBoundingClientRect?.().width,
        });
      });
    },
    dispose() {
      clear();
      disposed = true;
    },
  });
}
