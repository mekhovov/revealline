/** Deliberately independent of wall time; callbacks run only when a test advances. */
export function demoLoadingClock() {
  const tasks = new Map();
  let time = 0,
    serial = 0;
  return {
    options: {
      timeoutMs: 15000,
      setTimer(callback, delay) {
        const id = ++serial;
        tasks.set(id, { callback, due: time + delay });
        return id;
      },
      clearTimer: (id) => tasks.delete(id),
    },
    get pending() {
      return tasks.size;
    },
    advance(ms) {
      time += ms;
      for (const [id, task] of [...tasks]) {
        if (task.due > time) continue;
        tasks.delete(id);
        task.callback();
      }
    },
  };
}
export const settleDemoLoading = async () => {
  // Drain the finite wrapper/fetch/parse promise chains without sleeping.
  for (let turn = 0; turn < 20; turn++) await Promise.resolve();
};
