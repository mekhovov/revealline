export const OVERFLIGHT_DEFEAT_CAPACITY = 512;

/** Presentation facts survive pooled enemy reuse and multiple fixed steps per
 * render. Overflow retires only old cosmetic facts; never gameplay or rewards. */
export function createOverflightDefeatFeed() {
  return {
    sequence: 0,
    capacity: OVERFLIGHT_DEFEAT_CAPACITY,
    records: Array.from({ length: OVERFLIGHT_DEFEAT_CAPACITY }, () => ({
      sequence: 0,
      id: 0,
      family: '',
      wardrobe: 0,
      x: 0,
      y: 0,
      heading: 0,
      heavy: false,
      specialist: false,
      role: 'common',
      tick: 0,
      time: 0,
    })),
  };
}

export function recordOverflightDefeat(run, enemy) {
  const feed = run.defeats;
  const sequence = ++feed.sequence;
  const record = feed.records[(sequence - 1) % feed.capacity];
  record.sequence = sequence;
  record.id = enemy.id;
  record.family = enemy.family;
  record.wardrobe = enemy.wardrobe;
  record.x = enemy.x;
  record.y = enemy.y;
  record.heading = enemy.heading;
  record.heavy = enemy.heavy;
  record.specialist = enemy.specialist;
  record.role = enemy.role;
  record.tick = run.tick;
  record.time = run.time;
}
