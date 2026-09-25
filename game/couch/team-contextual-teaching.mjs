const FORMAT = 'revealline.team-contextual-teaching.v1';
const DEFAULT_KEY = 'revealline.team-contextual-teaching.v1';
const SKILLS = Object.freeze(['cut', 'support', 'rescue']);

const blank = () => ({ introduced: new Set(), completed: new Set() });

function readStored(storage, key) {
  if (!storage) return blank();
  const value = storage.getItem(key);
  if (value === null) return blank();
  const parsed = JSON.parse(value);
  if (parsed?.format !== FORMAT) return blank();
  const valid = (items) =>
    new Set(Array.isArray(items) ? items.filter((item) => SKILLS.includes(item)) : []);
  return {
    introduced: valid(parsed.introduced),
    completed: valid(parsed.completed),
  };
}

function supportCue(guidance) {
  const roles = guidance?.supportBySeat;
  if (Array.isArray(roles) && roles.some((role) => /^Interceptor|^Disruptor/.test(role)))
    return 'SUPPORT READY · Player 1 intercepts sparks; Player 2 slows enemies. Tap Support near the matching threat.';
  const text = String(guidance?.supportText ?? '');
  if (/intercept/i.test(text) && /slow/i.test(text))
    return 'SUPPORT READY · Tap Support near a moving threat or travelling spark.';
  if (/intercept/i.test(text)) return 'SUPPORT READY · Tap Support near a travelling spark.';
  if (/slow/i.test(text)) return 'SUPPORT READY · Tap Support near a moving threat.';
  return null;
}

/**
 * Small, presentation-only teaching memory. It observes authoritative events,
 * never changes the simulation, and falls back to this page visit when storage
 * is unavailable.
 */
export function createTeamContextualTeaching({
  getStorage = () => globalThis.localStorage,
  key = DEFAULT_KEY,
  onWarning = () => {},
} = {}) {
  if (typeof getStorage !== 'function' || typeof onWarning !== 'function')
    throw new TypeError('Team teaching needs storage and warning callbacks.');
  let storage = null;
  let state = blank();
  try {
    storage = getStorage();
    state = readStored(storage, key);
  } catch (error) {
    onWarning(`Teaching progress stays on this page: ${error.message}`);
  }

  const save = () => {
    if (!storage) return;
    try {
      storage.setItem(
        key,
        JSON.stringify({
          format: FORMAT,
          introduced: SKILLS.filter((skill) => state.introduced.has(skill)),
          completed: SKILLS.filter((skill) => state.completed.has(skill)),
        }),
      );
    } catch (error) {
      storage = null;
      onWarning(`Teaching progress stays on this page: ${error.message}`);
    }
  };
  const introduce = (kind, text) => {
    if (state.introduced.has(kind) || state.completed.has(kind)) return null;
    state.introduced.add(kind);
    save();
    return Object.freeze({ kind, text });
  };

  return Object.freeze({
    opening(guidance) {
      if (state.introduced.has('cut')) return null;
      const ground = guidance?.groundName === 'safe ground' ? 'safe ground' : 'reclaimed ground';
      return introduce(
        'cut',
        `FIRST CUT · Steer off ${ground}, then return to ${ground} to bank the line.`,
      );
    },
    observe(events, guidance) {
      if (!Array.isArray(events))
        throw new TypeError('Team teaching needs the current event list.');
      let changed = false;
      for (const event of events) {
        if (event?.type === 'cut.closed' || event?.type === 'cut.joint') {
          if (!state.completed.has('cut')) {
            state.completed.add('cut');
            changed = true;
          }
        }
        if (event?.type === 'support.pulse' && !state.completed.has('support')) {
          state.completed.add('support');
          changed = true;
        }
        if (event?.type === 'rescue.completed' && !state.completed.has('rescue')) {
          state.completed.add('rescue');
          changed = true;
        }
      }
      if (changed) save();
      if (events.some((event) => event?.type === 'player.downed'))
        return introduce(
          'rescue',
          `RESCUE · Move together on ${guidance?.groundName ?? 'reclaimed ground'}; the active partner holds Support nearby for one second.`,
        );
      if (events.some((event) => event?.type === 'cut.closed' || event?.type === 'cut.joint')) {
        const text = supportCue(guidance);
        if (text) return introduce('support', text);
      }
      return null;
    },
    snapshot() {
      return Object.freeze({
        introduced: Object.freeze(SKILLS.filter((skill) => state.introduced.has(skill))),
        completed: Object.freeze(SKILLS.filter((skill) => state.completed.has(skill))),
      });
    },
  });
}

export const TEAM_CONTEXTUAL_TEACHING_FORMAT = FORMAT;
