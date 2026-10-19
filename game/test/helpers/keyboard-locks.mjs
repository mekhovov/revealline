/** A finite Web Locks model shared by two independent preference owners. */
export class KeyboardLocks {
  held = new Set();
  calls = [];
  async request(key, options, callback) {
    this.calls.push({ key, options });
    if (this.held.has(key)) return callback(null);
    this.held.add(key);
    try {
      return await callback({ name: key, mode: 'exclusive' });
    } finally {
      this.held.delete(key);
    }
  }
}
export const keyboardTurn = () => new Promise((resolve) => setTimeout(resolve, 0));
