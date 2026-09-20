import { createDraftHistory } from './drafts.mjs';

/** Serial/coalesced saves: late completions never mark newer edits as saved.
 * On failure the live history/export remains available; retry never overwrites a
 * conflicting head. Loading another project belongs to a new session. */
export function createContentDraftSession(
  source,
  { backend, revision = null, onStatus = () => {} } = {},
) {
  const history = createDraftHistory(source);
  let saved = revision === null ? null : history.export(),
    running = null,
    failure = null;
  const status = () => ({
    revision,
    dirty: history.export() !== saved,
    saving: !!running,
    error: failure,
  });
  const notify = () => onStatus(status());
  async function drain() {
    while (history.export() !== saved) {
      const text = history.export();
      const result = await backend.save(JSON.parse(text), revision);
      revision = result.revision;
      saved = text;
    }
  }
  const save = () => {
    if (running) return running;
    failure = null;
    running = Promise.resolve()
      .then(drain)
      .catch((error) => {
        failure = error;
        throw error;
      })
      .finally(() => {
        running = null;
        notify();
      });
    notify();
    return running;
  };
  return {
    current: history.current,
    export: history.export,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    status,
    save,
    replace(candidate) {
      const value = history.replace(candidate);
      notify();
      return value;
    },
    undo() {
      const value = history.undo();
      notify();
      return value;
    },
    redo() {
      const value = history.redo();
      notify();
      return value;
    },
  };
}
