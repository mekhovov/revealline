const neutral = () => ({ direction: null, boost: false, support: false });

/** A fresh gesture may arrive after reset but before the next fixed tick.
 * Give the core its release tick without discarding newly latched steering.
 */
export function createCoopCommandBatch() {
  const releases = new Set();
  return {
    release(player) {
      if (player === undefined) {
        releases.add(0);
        releases.add(1);
      } else if (player === 0 || player === 1) releases.add(player);
      else throw new TypeError('Co-op seat must be 0 or 1.');
    },
    consume(commands) {
      return commands.map((command, player) => {
        if (releases.delete(player)) return neutral();
        return { direction: command.direction, boost: command.boost, support: command.action };
      });
    },
  };
}
