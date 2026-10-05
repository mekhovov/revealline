import { screenPan } from '../ui/feedback-cues.mjs';

/** Presentation adapter only. The shared mixer owns samples, priority, movement
 * limits, master mute and pause. Replayed/imported history never emits old SFX. */
export function createClassicAudio(sound, { getDestruction = () => ({}) } = {}) {
  let states = new WeakMap();
  let eventSteps = new WeakMap();
  function events(run, { active = true, board = 'snake-0', placement } = {}) {
    if ((eventSteps.get(run) ?? -1) >= run.tick) return;
    eventSteps.set(run, run.tick);
    if (!active) return;
    for (const event of run.events ?? []) {
      if (event.tick !== run.tick) continue;
      const cue = {
        'target.warning': 'warning',
        'relay.collected': 'supply',
        'target.opened': 'objective',
      }[event.type];
      if (!cue) continue;
      const source = event.target ?? event.relay;
      sound.encounter(cue, {
        family: source?.kind,
        board,
        pan: screenPan(source?.x ?? run.level.width / 2, run.level.width, placement),
      });
    }
  }
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
        sound.encounter('catch', {
          family: latest?.kind,
          board,
          brutal: getDestruction().brutal,
          pan: screenPan(latest?.x ?? run.level.width / 2, run.level.width, placement),
        });
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
    events,
    update,
    reset() {
      states = new WeakMap();
      eventSteps = new WeakMap();
      sound.feedbackDirector.reset();
    },
  });
}
