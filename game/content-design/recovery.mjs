import { required, stableId } from '../data-json.mjs';

/** Read-only inspection. Restore creates a successor of the observed head, never
 * writes over a historical checkpoint. A later cross-tab edit still conflicts. */
export async function inspectDraftCheckpoint(backend, id, revision = null) {
  required(stableId(id), 'Invalid draft project id.');
  required(
    revision === null || (Number.isSafeInteger(revision) && revision > 0),
    'Choose a positive whole checkpoint number, or leave it blank for the latest.',
  );
  const head = await backend.read(id);
  required(head, 'No checkpoint found for that project ID. The current draft is unchanged.');
  required(revision === null || revision <= head.revision, 'That checkpoint does not exist.');
  const selected =
    revision === null || revision === head.revision ? head : await backend.read(id, revision);
  return { head, selected };
}

/** Every asynchronous inspection is tied to the visible editor state it began
 * with. Newer actions win; late reads/imports cannot overwrite newer edits. */
export function createInspectionRequests(readState) {
  let revision = 0;
  return {
    invalidate() {
      revision++;
    },
    begin() {
      const ticket = ++revision,
        before = readState();
      return () => ticket === revision && before === readState();
    },
  };
}

export function projectIdFromURL(url) {
  const id = new URL(url).searchParams.get('project');
  required(id === null || stableId(id), 'Invalid project ID in this Studio address.');
  return id ?? 'my-journey';
}
