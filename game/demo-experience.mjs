export { createDemoPractice } from './demo-modes/solo-practice.mjs';
import { soloDemoCaption } from './demo-modes/solo-captions.mjs';
// A key-family prefix is not a translatable message. Keep its exact comparison value.
const REACTION_KEY_PREFIX = ['demo', 'reaction'].join(':');


export function createDemoIdle(timeout = 60) {
  let elapsed = 0;
  return {
    activity() {
      elapsed = 0;
    },
    advance(seconds, eligible) {
      if (!eligible || !Number.isFinite(seconds) || seconds < 0 || seconds > 0.25) {
        elapsed = 0;
        return false;
      }
      elapsed += seconds;
      if (elapsed < timeout) return false;
      elapsed = 0;
      return true;
    },
  };
}

export { readDemoSettings } from './demo-settings.mjs';

export function createDemoCaptions({ interpretEvent = soloDemoCaption } = {}) {
  let clock = 0,
    until = 0,
    key = 'demo:tipStart',
    pending = [],
    lastLesson = key,
    reaction = null,
    reactionsShown = 0,
    lastReactionAt = -Infinity,
    recovering = false,
    completed = false;
  let history = [key];
  const seen = new Set();
  const labels = new Map();
  const resolve = (value) => labels.get(value)?.() ?? value;
  const cue = (event) => {
    if (typeof event.captionKey === 'string' && typeof event.captionText === 'function') {
      labels.set(event.captionKey, event.captionText);
      return event.captionKey;
    }
    if (typeof event.caption === 'string' && event.caption.trim()) return event.caption;
    return interpretEvent(event);
  };
  return {
    get current() {
      return resolve(key);
    },
    get readyToLeave() {
      return completed && !pending.length && clock >= until;
    },
    complete(recap = null) {
      if (completed) return;
      completed = true;
      reaction = null;
      recovering = false;
      pending = recap && recap !== key ? [{ key: recap, expires: Infinity }] : [];
    },
    get history() {
      return Object.freeze(history.map(resolve));
    },
    reset(initial = 'demo:tipStart') {
      clock = 0;
      until = 6;
      key = typeof initial === 'string' ? initial : initial.key;
      pending = [];
      completed = false;
      history = [key];
      seen.clear();
      lastLesson = key;
      reaction = null;
      reactionsShown = 0;
      lastReactionAt = -Infinity;
      recovering = false;
      labels.clear();
      if (typeof initial?.text === 'function') labels.set(key, initial.text);
    },
    get reacting() {
      return key.startsWith(REACTION_KEY_PREFIX);
    },
    advance(seconds, events = [], { reactions = false, fresh = true } = {}) {
      clock += Math.min(0.25, Math.max(0, seconds));
      // Personality never competes with a new lesson or replays delayed events.
      // Only one recent reaction can wait; at most two appear in a scene.
      if (completed || !reactions || !fresh) {
        reaction = null;
        recovering = false;
        if (key.startsWith(REACTION_KEY_PREFIX)) key = lastLesson;
      }
      for (const event of completed ? [] : events) {
        if (reactions && fresh) {
          let response = null;
          if (event.type === 'player.failed') recovering = true;
          if (event.type === 'cut.closed' && recovering) {
            response = 'demo:reactionRecovery';
            recovering = false;
          }
          if (event.type === 'shield.absorbed') response = 'demo:reactionShield';
          if (event.type === 'objective.captured') response = 'demo:reactionObjective';
          if (response && reactionsShown < 2 && clock >= 12 && clock - lastReactionAt >= 24)
            reaction = { key: response, expires: clock + 8 };
        }
        const next = cue(event);
        // The finite cue vocabulary bounds this queue. Keep each lesson once,
        // including same-tick capture/objective events, in its observed order.
        if (next && !seen.has(next) && !pending.some((item) => item.key === next))
          pending.push({
            key: next,
            expires: Number.isFinite(event.expiresAfter)
              ? clock + Math.max(0, event.expiresAfter)
              : event.situational || event.type === 'boss.warning'
                ? clock + 6
                : Infinity,
          });
      }
      pending = pending.filter((item) => item.expires > clock);
      if (pending.length && clock >= until) {
        key = pending.shift().key;
        seen.add(key);
        lastLesson = key;
        until = clock + 6;
        history = [...history, key].slice(-5);
      } else if (clock >= until) {
        if (reaction && reaction.expires >= clock) {
          key = reaction.key;
          reaction = null;
          reactionsShown++;
          lastReactionAt = clock;
          until = clock + 6;
        } else key = lastLesson;
      }
      if (reaction && reaction.expires < clock) reaction = null;
      return resolve(key);
    },
  };
}
