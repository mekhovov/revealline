import { DESTRUCTION_CUES, destructionCategory } from '../ui/destruction-audio.mjs';
import { screenPan } from '../ui/feedback-cues.mjs';

/** Presentation adapter only. The shared mixer owns samples, priority, movement
 * limits, master mute and pause. Replayed/imported history never emits old SFX. */
export function createClassicAudio(sound, { getDestruction = () => ({}), presentation } = {}) {
  let states = new WeakMap();
  // The same immutable Sound Studio release owns collection cues in every
  // native host. Installing a reader neither activates audio nor plays a cue.
  if (presentation?.readAudio) sound.setPublishedAudio(presentation.readAudio);
  function update(run, { active = true, mode = 'solo', board = 'snake-0', placement } = {}) {
    let state = states.get(run);
    if (!state || run.tick < state.tick) {
      state = {
        tick: run.tick,
        catches: run.catches + (run.bonusCatches ?? 0),
        pickups: run.pickupsUsed ?? 0,
        pickup: run.pickup,
        shutters: new Map(),
        projection: {},
      };
      states.set(run, state);
    }
    const projected = state.projection;
    Object.assign(projected, {
      tick: run.tick,
      status: run.status,
      time: run.elapsedMs / 1000,
      levelId: run.level.id,
      width: run.level.width,
      height: run.level.height,
      players: run.snakes.map((snake) => ({
        ...snake.body[0],
        id: snake.id,
        bodyId: 'fpv-scout-v1',
        status: snake.alive ? 'active' : 'dead',
      })),
      enemies: (run.targets ?? (run.target ? [run.target] : [])).map((target) => ({
        ...target,
        bodyId: 'humanoid',
        family: target.kind,
        // Pulse is frozen simulation state, not an audio/animation timer.
        frozenUntil: run.pulseTicks > 0 ? Infinity : 0,
      })),
    });
    if (active && run.tick > state.tick) {
      const catchCount = run.catches + (run.bonusCatches ?? 0);
      if (catchCount > state.catches) {
        const latest = run.recentCatches?.at(-1);
        const pan = screenPan(latest?.x ?? run.level.width / 2, run.level.width, placement);
        sound.event?.({ type: 'pickup.collected', board, pan, feedback: true, tick: run.tick });
        const categories = new Set();
        // Several co-op catches may land in one step. Retain each material, not
        // just the final casualty; the shared mixer bounds overlapping voices.
        const recent = run.recentCatches?.slice(-Math.max(1, catchCount - state.catches)) ?? [
          latest,
        ];
        for (const caught of recent.length ? recent : [latest]) {
          const family = caught?.kind;
          const category = destructionCategory({ family });
          if (categories.has(category)) continue;
          categories.add(category);
          sound.encounter('catch', {
            family,
            board,
            brutal: getDestruction().brutal,
            pan: screenPan(caught?.x ?? run.level.width / 2, run.level.width, placement),
          });
        }
      }
      if ((run.pickupsUsed ?? 0) > state.pickups) {
        const pickup =
          run.events?.find((event) => event.type === 'pickup.collected')?.pickup ?? state.pickup;
        sound.encounter(pickup?.kind === 'pulse' ? 'pulse' : 'reel', { board });
      } else if (run.pickup && run.pickup.id !== state.pickup?.id)
        sound.encounter('supply', { board });
      for (const shutter of run.shutters ?? []) {
        const previous = state.shutters.get(shutter.id);
        if (previous && shutter.closed !== previous.closed)
          sound.encounter('shutter', { board, closed: shutter.closed });
        else if (previous && shutter.warning && !previous.warning)
          sound.encounter('warning', { board });
      }
    }
    sound.feedback(active, { family: 'fpv' }, projected, {
      mode,
      board,
      placement,
      silentStart: run.tick > 0,
    });
    state.tick = run.tick;
    state.catches = run.catches + (run.bonusCatches ?? 0);
    state.pickups = run.pickupsUsed ?? 0;
    state.pickup = run.pickup ? { ...run.pickup } : null;
    state.shutters = new Map((run.shutters ?? []).map((item) => [item.id, { ...item }]));
  }
  return Object.freeze({
    update,
    prepare() {
      // Warm only the catch binding after explicit Start. Missing/late recordings
      // use the registered core recipe now, never replaying an earlier catch.
      return sound.publishedAudio?.prepare(['pickup', ...DESTRUCTION_CUES]);
    },
    reset() {
      states = new WeakMap();
      sound.feedbackDirector.reset();
    },
    dispose() {
      states = new WeakMap();
      sound.feedbackDirector.reset();
      if (presentation?.readAudio) sound.setPublishedAudio(null);
    },
  });
}
