import {advanceMotion} from "./motion.mjs";

// Presentation-lab input boundary. Historical motion functions still interpret
// null as no command; only this adapter remembers deliberate manual direction.
export function createManualSteering() {
  const held = new Set();
  let direction = null;
  return {
    press(source, next, {active = true, repeat = false} = {}) {
      if (!["up", "right", "down", "left"].includes(next)) throw new Error("Unknown direction");
      if (repeat || held.has(source)) return false;
      held.add(source);
      if (!active) return false;
      direction = next;
      return true;
    },
    release(source) {held.delete(source);},
    clear({preserveDirection = false, forgetPhysical = false} = {}) {
      if (!preserveDirection) direction = null;
      if (forgetPhysical) held.clear();
    },
    snapshot() {return direction;},
    advance(state, input, config, board, route, dt) {
      // The historical Grid policy clears its buffer on a paused/null call.
      // A paused lab does not step that policy, so the exact queued turn survives.
      return input.paused ? state : advanceMotion(state, {...input, direction}, config, board, route, dt);
    },
  };
}
