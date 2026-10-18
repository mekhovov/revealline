// Only these managed asset-cache stores are distinct from player persistence.
const mediaStores = new Set([
  'revealline-soundtrack-v1/reservations',
  'revealline-soundtrack-v1/managedState',
  'revealline-soundtrack-v1/mediaBlobs',
  'revealline-soundtrack-v1/mediaRecords',
]);

export function playerPersistenceMutations(events) {
  return events.filter((event) => {
    if (event.kind !== 'mutation') return false;
    if (event.api === 'Storage' && event.method === 'removeItem' && event.absentRemoval === true)
      return false;
    return !(event.api === 'IndexedDB' && mediaStores.has(event.owner));
  });
}

export function mutationSignatures(events) {
  return [
    ...new Set(
      events.map(({ api, owner, method, key }) => JSON.stringify([api, owner, method, key])),
    ),
  ].sort();
}

export function unexpectedBootMutations(events, ordinarySignatures) {
  const admitted = new Set(ordinarySignatures);
  return mutationSignatures(playerPersistenceMutations(events)).filter(
    (value) => !admitted.has(value),
  );
}

export function restoredFromBFCache(before, after) {
  return (
    !!before.documentId &&
    before.documentId === after.documentId &&
    after.lifecycle.some((event) => event.type === 'pageshow' && event.persisted === true)
  );
}

export function browserErrorDescription(error) {
  return String(error?.stack || error?.message || error).slice(0, 4000);
}

export function restorationDiagnosticGate(pageErrors, events) {
  return (
    pageErrors.length === 0 &&
    !events.some((event) => event.kind === 'window-error' || event.kind === 'unhandledrejection')
  );
}
