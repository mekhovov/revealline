import { drawHuntActor } from '../hunt/actor-art.mjs';

const HEADINGS = new Set(['up', 'right', 'down', 'left']);

/** Historical v1 targets have positions but no saved heading. Observe only the
 * last rendered position of each of the two admitted targets, outside the run.
 * Accepted successor headings always win, including protected specialist fronts.
 * An unseen/ambiguous move retains the last heading rather than guessing inputs. */
export function createClassicTargetFacing() {
  let owner,
    identity,
    tick = -1,
    previous = new Map();
  return (run, attemptKey = run) => {
    const { width, height, wrap } = run.level;
    const nextIdentity = JSON.stringify([
      run.version,
      run.levelIdentity,
      run.seed,
      run.mode,
      width,
      height,
      wrap,
    ]);
    if (owner !== attemptKey || identity !== nextIdentity || run.tick < tick) previous.clear();
    const next = new Map(),
      result = new Map();
    for (const target of (run.targets ?? (run.target ? [run.target] : [])).slice(0, 2)) {
      const old = previous.get(target.id);
      let heading = HEADINGS.has(target.heading) ? target.heading : (old?.heading ?? 'up');
      if (!HEADINGS.has(target.heading) && old && run.tick > tick) {
        let dx = target.x - old.x,
          dy = target.y - old.y;
        if (wrap) {
          // Native v1 prey moves one grid cell at a time, including wrap seams.
          if (Math.abs(dx) === width - 1) dx = -Math.sign(dx);
          if (Math.abs(dy) === height - 1) dy = -Math.sign(dy);
        }
        if (dy === 0 && dx !== 0) heading = dx > 0 ? 'right' : 'left';
        else if (dx === 0 && dy !== 0) heading = dy > 0 ? 'down' : 'up';
      }
      next.set(target.id, { x: target.x, y: target.y, heading });
      result.set(target.id, heading);
    }
    previous = next;
    owner = attemptKey;
    identity = nextIdentity;
    tick = run.tick;
    return result;
  };
}

/** Historical Classic API, now backed by the shared humanoid painter. The
 * caller still owns its cosmetic clock; this never reads or advances target AI. */
export function drawClassicTarget(ctx, x, y, size, pose = 0, options = {}) {
  drawHuntActor(ctx, x, y, size, pose, options);
}
