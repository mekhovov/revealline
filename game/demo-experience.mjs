export { createDemoPractice } from './demo-modes/solo-practice.mjs';
import { soloDemoCaption } from './demo-modes/solo-captions.mjs';

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
      labels.clear();
      if (typeof initial?.text === 'function') labels.set(key, initial.text);
    },
    advance(seconds, events = []) {
      clock += Math.min(0.25, Math.max(0, seconds));
      for (const event of completed ? [] : events) {
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
        until = clock + 6;
        history = [...history, key].slice(-5);
      }
      return resolve(key);
    },
  };
}
