import { OVERFLIGHT_MACHINERY, OVERFLIGHT_SOLDIERS } from './project.mjs';

// Cosmetic limits never limit kills, rewards or visible live actors. Settled
// marks have no timer: only the oldest marks yield when this fixed history fills.
export const OVERFLIGHT_REMAINS_LIMITS = Object.freeze({
  capacity: 1024,
  visible: 320,
  moving: 24,
  settleSeconds: 0.34,
});
const families = new Set([...OVERFLIGHT_SOLDIERS, ...OVERFLIGHT_MACHINERY]);
const machinery = new Set(OVERFLIGHT_MACHINERY);
const wardrobes = ['tactical', 'rivals', 'arcade'];

export function overflightRemainsFrame(mark, destruction = {}, cast = 'authored') {
  if (machinery.has(mark.family))
    return `remains:machine:${mark.family}:${destruction.brutal ? 'debris' : 'clean'}`;
  const wardrobe = wardrobes.includes(cast) ? cast : wardrobes[(mark.wardrobe ?? 0) % 3];
  const mode = !destruction.brutal ? 'clean' : destruction.blood === false ? 'debris' : 'blood';
  return `remains:soldier:${mark.family}:${wardrobe}:${mode}`;
}

/** Consume accepted defeat facts, never inactive pooled slots. The ring is a
 * presentation mailbox: missed old facts may be dropped without changing play. */
export function createOverflightRemains() {
  const marks = Array.from({ length: OVERFLIGHT_REMAINS_LIMITS.capacity }, () => ({}));
  let owner = null,
    sequence = 0,
    count = 0,
    cursor = 0,
    evicted = 0,
    missed = 0;
  const reset = () => {
    owner = null;
    sequence = count = cursor = evicted = missed = 0;
  };
  return {
    reset,
    consume(run) {
      if (owner !== run || (run.defeats?.sequence ?? 0) < sequence) {
        reset();
        owner = run;
      }
      const feed = run.defeats;
      if (!feed || !Number.isSafeInteger(feed.sequence) || !Array.isArray(feed.records)) return;
      const capacity = Math.min(feed.capacity, feed.records.length);
      if (!Number.isSafeInteger(capacity) || capacity < 1) return;
      const first = Math.max(sequence + 1, feed.sequence - capacity + 1);
      missed += Math.max(0, first - sequence - 1);
      for (let next = first; next <= feed.sequence; next++) {
        const fact = feed.records[(next - 1) % capacity];
        if (
          fact?.sequence !== next ||
          !families.has(fact.family) ||
          ![fact.x, fact.y, fact.time, fact.heading].every(Number.isFinite)
        )
          continue;
        const mark = marks[cursor];
        // Copy scalars; the core will reuse its mailbox records and enemy slots.
        mark.sequence = next;
        mark.family = fact.family;
        mark.wardrobe = Number.isInteger(fact.wardrobe) ? ((fact.wardrobe % 3) + 3) % 3 : 0;
        mark.x = fact.x;
        mark.y = fact.y;
        mark.time = fact.time;
        mark.heading = fact.heading;
        mark.machine = machinery.has(fact.family);
        mark.size = fact.heavy ? (mark.machine ? 48 : 27) : mark.machine ? 30 : 22;
        cursor = (cursor + 1) % marks.length;
        if (count < marks.length) count++;
        else evicted++;
      }
      sequence = feed.sequence;
    },
    visitVisible(camera, visit) {
      let rendered = 0;
      // Recent marks win in a dense clearing. Unseen marks remain in world space
      // and can reappear when the camera returns; no texture or entity is created.
      for (let index = 0; index < count && rendered < OVERFLIGHT_REMAINS_LIMITS.visible; index++) {
        const mark = marks[(cursor - 1 - index + marks.length) % marks.length];
        if (
          Math.abs(mark.x - camera.x) > camera.width / 2 + mark.size ||
          Math.abs(mark.y - camera.y) > camera.height / 2 + mark.size
        )
          continue;
        visit(mark, rendered++);
      }
      return rendered;
    },
    snapshot: () => ({ stored: count, capacity: marks.length, sequence, evicted, missed }),
  };
}
