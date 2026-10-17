// Bind this optional historical capability to source, never to package absence.
// Supplying every path to the caller's source comparison also detects a worker
// omitted from both the package and its offline descriptors.
export const SOLO_MP3_WORKER_FILES = Object.freeze([
  'game/ui/media-preparation.mjs',
  'game/ui/mp3-inspector.mjs',
  'game/mp3-inspection-worker.mjs',
  'game/mp3-inspection.mjs',
]);

export function inspectSoloWorkerClosure({
  sourcePaths,
  manifestPaths,
  coreFiles,
  inventoryFiles,
}) {
  const rows = SOLO_MP3_WORKER_FILES.map((path) => ({
    path,
    inSource: sourcePaths.has(path),
    inManifest: manifestPaths.has(path),
    inCore: coreFiles.some((row) => row.path === path),
    inInventory: inventoryFiles.some((row) => row.path === path && row.delivery === 'core'),
    inAnyInventory: inventoryFiles.some((row) => row.path === path),
  }));
  const sourceCount = rows.filter((row) => row.inSource).length;
  const contract = sourceCount === 0 ? 'absent-in-source' : 'required-in-source';
  const failures = [];
  if (sourceCount > 0 && sourceCount < rows.length)
    failures.push({ reason: 'MP3 worker source contract is incomplete.' });
  for (const row of rows) {
    if (sourceCount > 0 && !(row.inSource && row.inManifest && row.inCore && row.inInventory))
      failures.push({ reason: 'MP3 worker closure is not offline core.', path: row.path });
    if (sourceCount === 0 && (row.inManifest || row.inCore || row.inAnyInventory))
      failures.push({
        reason: 'MP3 worker is packaged without its source contract.',
        path: row.path,
      });
  }
  return { contract, rows, failures };
}
