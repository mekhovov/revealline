import { HUNT_PRESENTATION_CATALOG } from './presentation-catalog.mjs';

/** Page-owned cosmetic slots. Two gameplay boards always have equal quotas;
 * previews yield their slots before gameplay can start another burst. */
export function createDestructionBudget({
  now = () => globalThis.performance?.now?.() ?? Date.now(),
} = {}) {
  const budgets = HUNT_PRESENTATION_CATALOG.budgets;
  const owners = new Map();
  function remove(owner, interrupt) {
    const record = owners.get(owner);
    if (!record) return;
    owners.delete(owner);
    record.active = false;
    if (interrupt) record.cancel();
  }
  function expire() {
    const time = now();
    for (const [owner, record] of owners)
      if (time - record.usedAt > budgets.staleFrameMs) remove(owner, true);
  }
  return Object.freeze({
    claim(owner, { preview = false, cancel = () => {} } = {}) {
      expire();
      const current = owners.get(owner);
      if (current) {
        current.usedAt = now();
        return current.lease;
      }
      if (!preview) for (const [other, record] of owners) if (record.preview) remove(other, true);
      if (preview && [...owners.values()].some((record) => !record.preview)) return null;
      const particles = budgets.pageParticles / budgets.painters;
      const envelopes = budgets.pageEnvelopes / budgets.painters;
      if (owners.size >= budgets.painters) return null;
      const record = {
        active: true,
        preview,
        particles,
        envelopes,
        usedAt: now(),
        cancel,
        lease: null,
      };
      record.lease = Object.freeze({
        particles,
        envelopes,
        get active() {
          return record.active;
        },
        release: () => remove(owner, false),
      });
      owners.set(owner, record);
      return record.lease;
    },
    clear() {
      for (const owner of [...owners.keys()]) remove(owner, true);
    },
    snapshot() {
      return Object.freeze({
        owners: owners.size,
        previews: [...owners.values()].filter((record) => record.preview).length,
        particles: [...owners.values()].reduce((sum, record) => sum + record.particles, 0),
        envelopes: [...owners.values()].reduce((sum, record) => sum + record.envelopes, 0),
      });
    },
  });
}
export const huntDestructionBudget = createDestructionBudget();
// One page lifecycle owner releases every cosmetic slot, including settings previews.
globalThis.document?.addEventListener?.('visibilitychange', () => {
  if (globalThis.document.hidden) huntDestructionBudget.clear();
});
globalThis.addEventListener?.('pagehide', () => huntDestructionBudget.clear());
