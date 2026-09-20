import { readImageTrace } from './image-trace.mjs';

/** Per-mission recovery with explicit adoption of saved drafts. No project or
 * gameplay writes occur here. Edits made during a save are coalesced afterward. */
export function createImageTraceSession({ backend, restore, onStatus = () => {} }) {
  const owners = new Map();
  let active = null;
  const status = (owner = active) =>
    owner && {
      projectId: owner.projectId,
      missionId: owner.missionId,
      loaded: owner.loaded,
      saved: owner.saved,
      revision: owner.revision,
      dirty: owner.dirty,
      saving: !!owner.saving,
      error: owner.error,
      needsChoice: owner.loaded && !owner.authorized && owner.dirty,
    };
  const report = (owner) => {
    if (owner === active) onStatus(status(owner));
  };
  async function flush(owner = active) {
    if (!owner || owner.saving || !owner.loaded || !owner.authorized || owner.error || !owner.dirty)
      return owner?.saving;
    // Install the in-flight marker before yielding to storage or status callbacks.
    owner.saving = Promise.resolve()
      .then(async () => {
        while (owner.dirty && owner.authorized && !owner.error) {
          const version = owner.version,
            trace = owner.pending;
          try {
            const saved = await backend.save(
              owner.projectId,
              owner.missionId,
              trace,
              owner.revision,
            );
            owner.revision = saved.revision;
            owner.saved = saved.trace;
            if (version === owner.version) owner.dirty = false;
          } catch (error) {
            owner.error = error;
            owner.failed = true;
            owner.authorized = false;
          }
        }
      })
      .finally(() => {
        owner.saving = null;
        report(owner);
      });
    report(owner);
    return owner.saving;
  }
  async function read(owner) {
    if (!owner) return;
    if (owner.saving) await owner.saving;
    const ticket = ++owner.readTicket;
    try {
      const saved = await backend.read(owner.projectId, owner.missionId);
      if (ticket !== owner.readTicket) return;
      owner.loaded = true;
      owner.revision = saved.revision;
      owner.saved = saved.trace;
      owner.error = null;
      // A previously failed/uncertain write always needs an explicit choice.
      owner.authorized = !saved.trace && !owner.failed;
      report(owner);
      await flush(owner);
    } catch (error) {
      if (ticket !== owner.readTicket) return;
      owner.error = error;
      owner.failed = true;
      owner.authorized = false;
      report(owner);
    }
  }
  return {
    select(projectId, missionId) {
      if (!missionId) {
        active = null;
        onStatus(null);
        return;
      }
      const key = `${projectId}/${missionId}`;
      if (active?.key === key) return;
      if (!owners.has(key))
        owners.set(key, {
          key,
          projectId,
          missionId,
          loaded: false,
          saved: null,
          pending: null,
          revision: null,
          dirty: false,
          authorized: false,
          error: null,
          version: 0,
          readTicket: 0,
          saving: null,
          failed: false,
        });
      active = owners.get(key);
      report(active);
      if (!active.loaded) void read(active);
    },
    change(source) {
      if (!active) return;
      const trace = source === null ? null : readImageTrace(source);
      if (trace && (trace.projectId !== active.projectId || trace.missionId !== active.missionId))
        throw new Error('Tracing owner changed. Select the matching mission first.');
      active.pending = trace;
      active.dirty = true;
      active.version++;
      if (active.error) active.failed = true;
      report(active);
      void flush(active);
    },
    async restore(source = active?.saved) {
      if (!active || !source) throw new Error('No saved tracing draft is available.');
      const owner = active,
        version = owner.version;
      if (owner.saving) throw new Error('Wait for the current tracing save to finish.');
      const trace = readImageTrace(source);
      if (trace.projectId !== owner.projectId || trace.missionId !== owner.missionId)
        throw new Error('This tracing draft belongs to a different project or mission.');
      await restore(trace);
      if (owner !== active || owner.version !== version)
        throw new Error('Tracing changed during restore. The newer session was retained.');
      const fromSaved = source === owner.saved;
      owner.pending = trace;
      owner.dirty = !fromSaved;
      owner.authorized = fromSaved || (owner.loaded && !owner.saved && !owner.error);
      owner.version++;
      report(owner);
      await flush(owner);
    },
    reload: () => read(active),
    async replace() {
      if (!active?.loaded || active.error || active.saving)
        throw new Error('Read the saved tracing draft before replacing it.');
      if (!active.dirty) throw new Error('There is no changed tracing session to save.');
      active.authorized = true;
      active.failed = false;
      await flush(active);
    },
    status: () => status(),
    pending: () => active?.pending,
    hasUnsaved: () => [...owners.values()].some((owner) => owner.dirty),
    flush: () => flush(),
  };
}
