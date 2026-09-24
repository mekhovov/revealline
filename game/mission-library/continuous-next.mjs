import { LIBRARY_MODES } from "./library.mjs";

/** Boundary continuation uses eligible rows in the complete registry, never the
 * chooser's search results. Browse-only editions remain valid manual selections
 * but cannot create automatic loops between historical and current journeys.
 * Original adapters still own preparation, launch and progress. */
export function librarySuccessor(library, currentRow, mode) {
  if (!LIBRARY_MODES.includes(mode))
    throw new TypeError("Unknown continuation mode.");
  if (!currentRow || library.find(currentRow.id) !== currentRow)
    throw new Error(
      "The current mission edition changed. Your result is kept.",
    );
  const rows = library.forMode(mode);
  const index = rows.indexOf(currentRow);
  if (index < 0)
    throw new Error("The current mission does not belong to this mode.");
  return (
    rows.slice(index + 1).find((row) => row.automaticContinuation !== false) ??
    null
  );
}

/** Runtime hosts supply their original campaign/pack identity, not a display
 * title or an execution-projection campaign key. Fail closed on ambiguity. */
export function retainedLibraryMission(
  library,
  { mode, levelId, campaignKey, sourcePackId = null, ownerId, editionId },
) {
  const rows = library.forMode(mode).filter((row) => {
    if (
      !["Classic", "Custom"].includes(row.collection) ||
      row.runtimeId !== levelId
    )
      return false;
    if (
      (ownerId && row.ownerId !== ownerId) ||
      (editionId && row.editionId !== editionId)
    )
      return false;
    const campaign = JSON.parse(row.campaignKey);
    const owner = JSON.parse(row.ownerId);
    const packId =
      owner[0] === "classic"
        ? owner[2]
        : owner[0] === "custom"
          ? owner[1]
          : undefined;
    return campaign[2] === campaignKey && packId === sourcePackId;
  });
  if (rows.length !== 1)
    throw new Error(
      "The exact current mission edition is unavailable. Your result is kept.",
    );
  return rows[0];
}
