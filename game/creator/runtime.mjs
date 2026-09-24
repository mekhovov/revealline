import { boundedJSON, exactKeys, required } from '../data-json.mjs';
import { createContentAttemptPreparer } from '../content-design/attempt.mjs';
import { stepRun, releaseInputs } from '../core/index.mjs';
import { recordInput, recordRelease, exportReplay, verifyReplayAsync } from '../replay.mjs';
import { suspendSession, restoreSession, SESSION_STORAGE_BYTES } from '../sessions.mjs';
import { creatorArtworkLoader, isPreparedCreatorBundle } from './bundle.mjs';

export const creatorProfileKey = (editionId) => `custom-${editionId}`;
export const creatorAttemptKey = (editionId) => `revealline.creator.attempt.v1.${editionId}`;

/** Ordinary installed Custom gameplay. It shares the compiler, attempt/picture
 * preparer, legal inputs and session verifier. This host never adopts Journey
 * eligibility, global tuning or a different edition's progression. */
export function createCreatorRuntime(prepared, { decodeImage, buildVersion = 'dev' } = {}) {
  required(isPreparedCreatorBundle(prepared), 'Verify the installed edition before playing.');
  const { project, themes, provenance } = prepared.manifest.content;
  const preparer = createContentAttemptPreparer(project, {
    themes,
    buildVersion,
    loadArtwork: creatorArtworkLoader(prepared),
    decodeImage,
  });
  let attempt = null,
    runId = null,
    generation = 0,
    disposed = false;
  const key = (entry) => `creator:${prepared.editionId}:${entry.executionKey}`;
  async function prepare(missionId, difficulty, turnPolicy, { signal } = {}) {
    required(!disposed, 'Custom player is closed.');
    const ticket = ++generation;
    const mission = preparer.catalog
      .journey()
      .missions.find((item) => item.id === missionId || item.levelId === missionId);
    required(mission, 'Choose a mission from this installed edition.');
    const candidate = await preparer.prepare(
      { missionId: mission.id, difficulty, turnPolicy, seed: provenance.runtimeSeed },
      { signal },
    );
    if (disposed || ticket !== generation || signal?.aborted) {
      if (preparer.current(candidate)) preparer.cancel();
      throw new DOMException('Custom attempt superseded.', 'AbortError');
    }
    return candidate;
  }
  function adopt(candidate, restored = null) {
    const next = preparer.take(candidate);
    attempt?.picture?.release();
    attempt = { ...next, ...(restored ? { run: restored.run, recorder: restored.recorder } : {}) };
    runId = restored?.session.runId ?? crypto.randomUUID();
    return attempt;
  }
  return Object.freeze({
    editionId: prepared.editionId,
    catalog: preparer.catalog,
    current: () => attempt,
    runId: () => runId,
    async start(
      { missionId = provenance.missionId, difficulty = 'standard', turnPolicy = 'immediate' } = {},
      options,
    ) {
      return adopt(await prepare(missionId, difficulty, turnPolicy, options));
    },
    step(input) {
      required(attempt && !disposed, 'Start an installed Custom mission first.');
      if (!['running', 'respawning'].includes(attempt.run.status)) return attempt.run;
      recordInput(attempt.recorder, input);
      stepRun(attempt.run, input);
      return attempt.run;
    },
    pause() {
      if (!attempt || disposed) return;
      releaseInputs(attempt.run);
      recordRelease(attempt.recorder);
    },
    suspend() {
      required(attempt && !disposed, 'There is no unfinished Custom mission.');
      return {
        format: 'revealline-creator-attempt.v1',
        editionId: prepared.editionId,
        missionId: attempt.selection.missionId,
        difficulty: attempt.selection.difficulty,
        session: suspendSession({
          run: attempt.run,
          recorder: attempt.recorder,
          campaignKey: key(attempt.entry),
          themeId: attempt.theme.id,
          bodyId: 'neutral-marker',
          runId,
        }),
      };
    },
    async restore(source, { signal } = {}) {
      const saved = boundedJSON(source, {
        maxBytes: SESSION_STORAGE_BYTES,
        maxNodes: 250000,
        maxDepth: 28,
        maxArray: 200000,
      });
      exactKeys(
        saved,
        ['format', 'editionId', 'missionId', 'difficulty', 'session'],
        'Custom attempt',
      );
      required(
        saved.format === 'revealline-creator-attempt.v1' && saved.editionId === prepared.editionId,
        'This saved attempt belongs to a different installed edition.',
      );
      required(
        saved.session?.replay?.options?.seed === provenance.runtimeSeed,
        'Saved attempt uses a different runtime seed.',
      );
      const candidate = await prepare(
        saved.missionId,
        saved.difficulty,
        saved.session.replay.options.turnPolicy,
        { signal },
      );
      try {
        const restored = await restoreSession(saved.session, {
          campaign: candidate.entry.campaign,
          campaignKey: key(candidate.entry),
          signal,
        });
        required(
          preparer.current(candidate) && !disposed,
          'A newer attempt replaced this recovery.',
        );
        required(
          restored.run.level.id === candidate.manifest.missionId &&
            restored.session.themeId === candidate.theme.id,
          'Saved mission or picture differs from this edition.',
        );
        return adopt(candidate, restored);
      } catch (error) {
        if (preparer.current(candidate)) preparer.cancel();
        throw error;
      }
    },
    async completion({ signal } = {}) {
      required(
        attempt?.run.status === 'won' && !disposed,
        'Only a legal win can earn a Custom picture.',
      );
      const current = attempt,
        identity = runId;
      const checked = await verifyReplayAsync(exportReplay(current.recorder, current.run), {
        signal,
      });
      required(
        attempt === current &&
          runId === identity &&
          !disposed &&
          checked.match &&
          checked.actual.summary.won,
        'This Custom completion changed or did not verify.',
      );
      return Object.freeze({
        type: 'complete',
        mode: 'solo',
        missionId: current.manifest.missionId,
        runId: identity,
        gameplayId: `${prepared.editionId}:${current.manifest.simulationIdentity}`,
        difficulty: current.selection.difficulty,
      });
    },
    dispose() {
      disposed = true;
      generation++;
      preparer.dispose();
      attempt?.picture?.release();
      attempt = null;
    },
  });
}
