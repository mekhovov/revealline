import { createJourneyBackend, createJourneyProfileStore } from '../journey/profile.mjs';

function availableBackend(profileKey) {
  // Resolve inside the store's bounded operation: a denied global getter is
  // session-only, not a boot error. A successful retry reuses one connection.
  let backend;
  const current = () => (backend ??= createJourneyBackend({ profileKey }));
  return { profileKey, read: () => current().read(), commit: (events) => current().commit(events) };
}

/** Shared, release-independent Team bookmarks/receipts. Only runs admitted by
 * the owning host can clear an owned candidate; imports never gain authority
 * from matching IDs. Local receipts are not official scores or human approval. */
export function createTeamJourneyProgress(
  journey,
  {
    backend,
    profileKey = backend?.profileKey ?? 'journey',
    sessionId = crypto.randomUUID(),
    operationTimeoutMs,
  } = {},
) {
  const listeners = new Set(),
    attempts = new WeakMap();
  let disposed = false,
    sequence = 0;
  const store = createJourneyProfileStore({
    backend: backend ?? availableBackend(profileKey),
    profileKey,
    operationTimeoutMs,
    onStatus(status) {
      for (const listener of [...listeners]) {
        if (disposed || !listeners.has(listener)) continue;
        try {
          listener(status);
        } catch {
          /* UI cannot veto persistence. */
        }
      }
    },
  });
  return Object.freeze({
    load: () => store.load(),
    snapshot: () => store.snapshot(),
    status: () => store.status(),
    retry: () => store.flush(),
    export: () => store.export(),
    backupFilename: store.backupFilename,
    initial(difficulty) {
      const profile = store.snapshot(),
        cursor = journey.catalog.find(profile.cursors.team);
      const mission =
        cursor && journey.isCore(cursor.id)
          ? Object.hasOwn(profile.clears.team, cursor.id)
            ? (journey.next(cursor.id) ?? cursor)
            : cursor
          : journey.catalog.missions.find((item) => journey.isCore(item.id));
      return journey.row(mission, difficulty);
    },
    started(row, run, { skipped = null, gameplayId = null, adminOverride = false } = {}) {
      if (
        disposed ||
        adminOverride ||
        (gameplayId !== null &&
          (typeof gameplayId !== 'string' || !/^[0-9a-f]{16}$/.test(gameplayId))) ||
        !journey.owns(row) ||
        !run ||
        attempts.has(run) ||
        run.tick !== 0 ||
        !['ready', 'running'].includes(run.status) ||
        run.level.id !== row.level.id ||
        run.level.version !== row.level.version ||
        run.ruleset !== row.pack.ruleset ||
        run.difficulty !== row.difficulty ||
        (skipped && (!journey.owns(skipped) || journey.destination(skipped).next !== row))
      )
        return false;
      attempts.set(run, {
        row,
        runId: `${sessionId}/${++sequence}`,
        gameplayId: gameplayId ?? row.simulationIdentity,
        completed: false,
      });
      store.recordMany([
        ...(skipped ? [{ type: 'skip', mode: 'team', missionId: skipped.mission.id }] : []),
        { type: 'select', mode: 'team', missionId: row.mission.id },
      ]);
      return true;
    },
    complete(run) {
      const attempt = attempts.get(run);
      if (disposed || !attempt || attempt.completed || run.status !== 'won') return false;
      attempt.completed = true;
      store.record({
        type: 'complete',
        mode: 'team',
        missionId: attempt.row.mission.id,
        runId: attempt.runId,
        gameplayId: attempt.gameplayId,
        difficulty: attempt.row.difficulty,
      });
      return true;
    },
    skipped(from, to) {
      if (
        disposed ||
        !journey.owns(from) ||
        !journey.owns(to) ||
        journey.destination(from).next !== to
      )
        return false;
      store.record({ type: 'skip', mode: 'team', missionId: from.mission.id });
      return true;
    },
    subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      store.status();
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      listeners.clear();
    },
  });
}
