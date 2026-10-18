import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { prepareClassicSnakeLevel } from '../snake/classic-setup.mjs';
import { drawClassicBoard } from '../snake/classic-view.mjs';
import {
  createClassicSnakeMatch,
  advanceClassicSnakeMatchTo,
  queueClassicSnakeMatchTurn,
  exportClassicSnakeMatch,
  restoreClassicSnakeMatch,
} from '../snake/classic-match.mjs';
import { verifySnakeDemo } from './snake-recording.mjs';

const directions = new Set(['up', 'right', 'down', 'left']);
function abort(signal) {
  if (!signal?.aborted) return;
  const error = new Error('Snake demo preparation cancelled.');
  error.name = 'AbortError';
  throw error;
}
const validFrame = (seconds) => Number.isFinite(seconds) && seconds >= 0 && seconds <= 0.25;

export function createSnakeDemoPlayer(source, { level, signal } = {}) {
  abort(signal);
  const { demo } = verifySnakeDemo(source, { level });
  abort(signal);
  const recording = demo.recording;
  const match = createClassicSnakeMatch(level, recording.options);
  let phase = 'paused',
    cursor = 0,
    disposed = false;
  const report = (events = []) => ({ phase, tick: match.runs[0].tick, events });
  function advanceTo(time) {
    const events = [];
    const onStep = ({ run }) => events.push(...structuredClone(run.events));
    while (recording.turns[cursor]?.atMs <= time) {
      const turn = recording.turns[cursor++];
      advanceClassicSnakeMatchTo(match, turn.atMs, { onStep });
      if (!queueClassicSnakeMatchTurn(match, turn.seat, turn.direction))
        throw new Error('Verified Snake demo input was rejected during playback.');
    }
    advanceClassicSnakeMatchTo(match, time, { onStep });
    if (match.status === 'finished') {
      if (exportClassicSnakeMatch(match).checkpoint !== recording.checkpoint)
        throw new Error('Snake demo playback diverged from its verified terminal checkpoint.');
      phase = 'complete';
    }
    return report(events);
  }
  return {
    get state() {
      return match.runs[0];
    },
    get match() {
      return match;
    },
    get phase() {
      return disposed ? 'disposed' : phase;
    },
    get maxAdvanceSeconds() {
      return 0.25;
    },
    info: Object.freeze({
      modeId: 'snake',
      levelId: level.id,
      levelName: level.name,
      recordedStatus: demo.outcome,
      totalTicks: recording.replays[0].steps,
      durationSeconds: recording.elapsedMs / 1000,
    }),
    play() {
      if (!disposed && phase !== 'complete') phase = 'playing';
      return report();
    },
    pause() {
      if (!disposed && phase !== 'complete') phase = 'paused';
      return report();
    },
    advance(seconds) {
      if (!validFrame(seconds)) throw new TypeError('Invalid Snake demonstration frame.');
      if (disposed || phase !== 'playing') return report();
      return advanceTo(Math.min(recording.elapsedMs, match.elapsedMs + seconds * 1000));
    },
    async forkForPractice({ signal: practiceSignal } = {}) {
      abort(practiceSignal);
      if (disposed || match.status !== 'running')
        throw new Error('Practice needs an unfinished Snake run.');
      const snapshot = exportClassicSnakeMatch(match);
      const fork = restoreClassicSnakeMatch(snapshot, { level });
      abort(practiceSignal);
      return {
        run: fork.runs[0],
        match: fork,
        origin: {
          modeId: 'snake',
          levelId: level.id,
          tick: fork.runs[0].tick,
          elapsedMs: fork.elapsedMs,
          checkpoint: snapshot.checkpoint,
        },
      };
    },
    exportRecording() {
      return structuredClone(demo);
    },
    dispose() {
      disposed = true;
      phase = 'disposed';
    },
  };
}

/** Isolated native match: no ordinary app, writer lock, save or reward callbacks. */
export function createSnakeDemoPractice(fork) {
  const match = fork?.match;
  if (!match || match.options.mode !== 'solo' || match.status !== 'running')
    throw new Error('Snake practice requires an unfinished isolated Solo match.');
  // Reconstruct first, then release autoplay's queued turns at the control
  // boundary. Geometry, clock and objective state remain the displayed state.
  for (const snake of match.runs[0].snakes) snake.turns.length = 0;
  let phase = 'paused';
  const report = (events = [], reason = null) => ({
    phase,
    tick: match.runs[0].tick,
    events,
    reason,
  });
  return {
    get state() {
      return match.runs[0];
    },
    get match() {
      return match;
    },
    get phase() {
      return phase;
    },
    start(intent = {}) {
      if (['complete', 'disposed'].includes(phase)) return;
      if (directions.has(intent.direction)) queueClassicSnakeMatchTurn(match, 0, intent.direction);
      phase = 'playing';
    },
    play() {
      this.start();
      return report();
    },
    steer(direction) {
      this.start({ direction });
    },
    pause() {
      if (!['complete', 'disposed'].includes(phase)) phase = 'paused';
      return report();
    },
    advance(seconds) {
      if (!validFrame(seconds)) {
        this.pause();
        return report([], 'frame-gap');
      }
      if (phase !== 'playing') return report();
      const events = [];
      advanceClassicSnakeMatchTo(match, match.elapsedMs + seconds * 1000, {
        onStep: ({ run }) => events.push(...structuredClone(run.events)),
      });
      if (match.status === 'finished') phase = 'complete';
      return report(events);
    },
    dispose() {
      phase = 'disposed';
    },
  };
}

export function snakeDemoPresentation(source, player, locale = 'en') {
  const language = locale === 'uk' ? 'uk' : 'en';
  const run = player.state;
  return {
    title: source.entry.title[language],
    goal: source.entry.description[language],
    status:
      language === 'uk'
        ? `Цілі: ${run.catches} / ${run.level.goal}`
        : `Targets: ${run.catches} / ${run.level.goal}`,
  };
}
export function snakeDemoSemanticEvents(events, locale = 'en') {
  const captions =
    locale === 'uk'
      ? {
          'target.caught': 'Ціль спіймано. Хвіст росте — залишайте місце для наступного повороту.',
          'target.warning': 'Ціль попереджає про наступний рух. Спостерігайте за безпечним вікном.',
          'relay.collected': 'Ретранслятор відкриває маршрут до наступної цілі.',
          'cargo.collected':
            'Вантаж підібрано. Тепер його потрібно доставити до відповідного дока.',
          'cargo.delivered': 'Вантаж доставлено — це просуває завдання місії.',
          'operation.stage-completed': 'Етап місії завершено. Перевірте наступне завдання.',
        }
      : {
          'target.caught': 'Target caught. The tail grows, so leave space for the next turn.',
          'target.warning': 'The target signals its next move. Watch for a safe opening.',
          'relay.collected': 'The relay opens the route to the next objective.',
          'cargo.collected': 'Cargo collected. Carry it to its matching dock.',
          'cargo.delivered': 'Cargo delivered, advancing the mission objective.',
          'operation.stage-completed': 'Mission stage complete. Watch for the next objective.',
        };
  return events
    .filter((event) => captions[event.type])
    .map((event) => ({
      type: event.type,
      tick: event.tick,
      caption: captions[event.type],
      ...(event.type === 'target.warning' ? { expiresAfter: 6 } : {}),
    }));
}

export function createSnakeDemoAdapter({ fetch: fetcher = globalThis.fetch, locale = 'en' } = {}) {
  const language = () =>
    (typeof locale === 'function' ? locale() : locale) === 'uk' ? 'uk' : 'en';
  const adapter = {
    modeId: 'snake',
    get label() {
      return language() === 'uk' ? 'Змійка' : 'Snake Solo';
    },
    enumerateSources() {
      return CLASSIC_SNAKE_LEVELS.map((entry, index) => {
        const level = prepareClassicSnakeLevel(entry);
        const url = new URL(`../demo-data/snake/${entry.id}.replay.json`, import.meta.url);
        const source = {
          id: `snake:${entry.id}:standard`,
          modeId: 'snake',
          kind: 'replay',
          levelId: entry.id,
          levelKey: entry.id,
          variantId: 'standard',
          approachable: index === 0,
          entry,
          level,
          get label() {
            return entry.title[language()];
          },
          get goal() {
            return entry.description[language()];
          },
          get launchURL() {
            const target = new URL('../snake/play.html', import.meta.url);
            target.search = new URLSearchParams({
              level: entry.id,
              mode: 'solo',
              pace: 'normal',
              activity: 'campaign',
              targets: 'authored',
              preset: 'classic',
              ready: '1',
              lang: language(),
            });
            return target.href;
          },
          async loadPayload({ signal } = {}) {
            abort(signal);
            const response = await fetcher(url, { signal });
            if (!response.ok) throw new Error(`Snake recording unavailable (${response.status}).`);
            const payload = await response.json();
            abort(signal);
            return payload;
          },
          async create({ signal, payload } = {}) {
            return createSnakeDemoPlayer(payload ?? (await source.loadPayload({ signal })), {
              level,
              signal,
            });
          },
        };
        return source;
      });
    },
    createPractice: createSnakeDemoPractice,
    presentation: (source, player) => snakeDemoPresentation(source, player, language()),
    semanticEvents: (events) =>
      snakeDemoSemanticEvents(events, language()).map((event) => ({
        ...event,
        captionKey: `snake:${event.type}`,
        captionText: () => snakeDemoSemanticEvents([event], language())[0].caption,
      })),
    async mountScene({ player, parent, document, signal, reducedMotion = false }) {
      abort(signal);
      const canvas = document.createElement('canvas');
      canvas.className = 'demo-mode-canvas';
      canvas.setAttribute(
        'aria-label',
        language() === 'uk' ? 'Демонстрація Змійки' : 'Snake demonstration',
      );
      canvas.style.width = '100%';
      canvas.style.maxHeight = '100%';
      canvas.style.objectFit = 'contain';
      parent.append(canvas);
      let disposed = false;
      return {
        canvas,
        paint(
          _seconds,
          { player: active = player, practice = null, reduced = reducedMotion } = {},
        ) {
          if (disposed) return;
          const current = practice ?? active;
          drawClassicBoard(canvas, current.state, {
            locale: language(),
            reduced,
            chapterId: CLASSIC_SNAKE_LEVELS.find((entry) => entry.id === current.state.level.id)
              ?.chapterId,
            // Demo owns no document-wide cached surfaces. Dropping the scene
            // releases every surface without touching the paused originating game.
            terrainCache: false,
            cssWidth: parent.clientWidth || undefined,
          });
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          canvas.width = canvas.height = 1;
          canvas.remove();
        },
      };
    },
  };
  return adapter;
}
