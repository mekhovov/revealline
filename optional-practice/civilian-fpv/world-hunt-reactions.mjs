import { attachContextualReactions } from '../../game/ui/contextual-reactions.mjs';
import { HUNT_CONTACT_CRITERION } from './snake-hunt.mjs';

/** Presentation projection only: native SIM has unarmed stationary/patrol prey.
 * Do not infer unsupported arcade behavior from a course's name or artwork. */
export function createWorldHuntReactionSession({ reactions }) {
  let actors = new Map(),
    families = [],
    seen = new Set(),
    lastTick = -1,
    health = null,
    playback = false,
    active = false;
  return {
    reset(course, state, { mode, attemptId, replay = false } = {}) {
      const targets = new Set(
        (course?.steps?.[mode] ?? [])
          .filter((step) => step.type === HUNT_CONTACT_CRITERION)
          .flatMap((step) => step.targets),
      );
      for (const policy of course?.pursuit?.actors ?? []) targets.add(policy.id);
      actors = new Map(
        (course?.actors ?? [])
          .filter((actor) => targets.has(actor.id))
          .map((actor) => [
            actor.id,
            course?.pursuit?.actors.find((policy) => policy.id === actor.id)?.family ??
              (actor.speed > 0 ? 'patroller' : 'lookout'),
          ]),
      );
      families = [...new Set(actors.values())];
      seen = new Set([...(state?.hunt?.caught ?? []), ...(state?.pursuit?.bonusCaught ?? [])]);
      lastTick = state?.ticks ?? -1;
      health = state?.health ?? null;
      playback = replay;
      active = false;
      reactions.reset(attemptId);
      reactions.suspend();
    },
    resume() {
      if (playback || !actors.size || active) return;
      active = true;
      reactions.resume();
      reactions.prepare(families);
    },
    prepare() {
      if (active && !playback) reactions.prepare(families);
    },
    suspend() {
      active = false;
      reactions.suspend();
    },
    /** Consume each accepted flight step, including the final catch. Restores
     * seed the cursor above; verified playback never emits fresh reactions. */
    consume(state) {
      if (!state || !Number.isSafeInteger(state.ticks) || state.ticks <= lastTick) return;
      lastTick = state.ticks;
      const hurt = Number.isFinite(health) && state.health < health;
      health = state.health;
      if (playback || !active || !actors.size) return;
      const danger =
        hurt ||
        !['active', 'complete'].includes(state.status) ||
        (state.events ?? []).some(
          (event) =>
            event.type === 'hunt-tail' ||
            (event.type === 'fire' && event.actor !== 'player') ||
            (event.type === 'impact' && event.actor === '$player'),
        );
      const events = [];
      for (const event of state.events ?? []) {
        if (event.type !== 'catch' || !actors.has(event.actor) || seen.has(event.actor)) continue;
        seen.add(event.actor);
        events.push({
          type: 'actor.caught',
          id: event.actor,
          tick: state.ticks,
          actorFamily:
            state.actors?.find((actor) => actor.id === event.actor)?.pursuit?.family ??
            actors.get(event.actor),
        });
      }
      if (events.length || danger)
        reactions.events(events, {
          // One local pilot owns this presentation; flight rules retain their native mode.
          mode: 'solo',
          board: 'fpv-world',
          actorFamilies: families,
          danger,
        });
    },
  };
}

export function mountWorldHuntReactions({
  sound,
  container,
  settingsContainer,
  document,
  window,
  storage,
  locale,
  voiceLibrary = null,
}) {
  const settings = document.createElement('details'),
    summary = document.createElement('summary'),
    label = document.createElement('label'),
    enabled = document.createElement('input'),
    caption = document.createElement('span');
  settings.dataset.simHuntReactions = 'true';
  enabled.type = 'checkbox';
  enabled.dataset.simCharacterReactions = 'true';
  label.append(enabled, caption);
  settings.append(summary, label);
  settingsContainer.append(settings);
  const reactions = attachContextualReactions({
    sound,
    container,
    settingsContainer: settings,
    document,
    window,
    getLocale: locale,
    voiceLibrary,
    getReduced: () =>
      document.body?.dataset.effects === 'reduced' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
    getStorage: () => storage,
  });
  const session = createWorldHuntReactionSession({ reactions });
  const refresh = () => {
    summary.textContent = locale() === 'uk' ? 'Реакції цілей полювання' : 'Hunt target reactions';
    caption.textContent = locale() === 'uk' ? 'Реакції персонажів' : 'Character reactions';
    enabled.checked = reactions.preferences.snapshot().enabled;
    reactions.refresh();
  };
  enabled.onchange = () => reactions.preferences.choose(enabled.checked);
  const unsubscribe = reactions.preferences.subscribe(refresh);
  return {
    ...session,
    refresh,
    dispose() {
      unsubscribe();
      reactions.dispose();
      enabled.onchange = null;
      settings.remove();
    },
  };
}
