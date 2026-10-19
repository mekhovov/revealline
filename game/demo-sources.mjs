import { withDemoLoadingDeadline } from './demo-loading.mjs';
import {
  loadDemoCatalog,
  resolveDemoCatalog,
  demoIdentity,
  loadDemoRecording,
} from './demo-catalog.mjs';
import { prepareReplayPlayer, prepareReviewedReplayPlayer } from './replay-player.mjs';
import { prepareCompleteBotPlayer } from './demo-bot-player.mjs';
import { prepareImprovPlayer } from './demo-improv-player.mjs';
import { LIVE_BOT_LEVEL_IDS, supportsDemoBot } from './demo-bot.mjs';
import { campaignKey } from './library.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from './gameplay-tuning.mjs';
import { diagnoseDemoReplay } from './demo-replay-diagnostics.mjs';
import { demoRuntimeEngineHint, preferDemoRuntimeCandidates } from './demo-runtime.mjs';
export { demoRuntimeEngineHint } from './demo-runtime.mjs';

export async function loadDemoSources({
  entries,
  library,
  turnPolicy = 'immediate',
  signal,
  fetch: fetcher = globalThis.fetch,
  WorkerClass = globalThis.Worker,
  loading = {},
  catalogs,
  engineHint = demoRuntimeEngineHint(),
}) {
  const checkAbort = () => {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  };
  checkAbort();
  let clips = [];
  try {
    const metadata = catalogs ?? [await loadDemoCatalog({ ...loading, fetch: fetcher, signal })];
    clips = metadata.flatMap((catalog) => resolveDemoCatalog(catalog, entries));
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  checkAbort();
  try {
    clips.push(
      ...(await withDemoLoadingDeadline((signal) => library.list(entries, { signal }), {
        ...loading,
        signal,
      })),
    );
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  checkAbort();
  const sources = clips.map((clip, index) => ({
    ...clip,
    kind: 'replay',
    variantId: clip.entry?.difficulty ?? 'standard',
    levelKey: `${clip.campaignKey}/${clip.levelId}`,
    approachable: index === 0,
    async create({ signal }) {
      // Native math can differ between engines. Each alternative is a frozen,
      // independently verified ordinary replay of this exact installed content.
      // Only a complete strict verification can select it; never replace outcomes.
      const qualified = clip.id.startsWith('solo-qualified-');
      const recorded = [
        ...[clip.replayURL, ...(clip.replayVariants ?? [])].map((replayURL) => ({
          ...clip,
          replayURL,
        })),
        ...(clip.runtimePerformances ?? []).map((performance) => ({ ...clip, ...performance })),
      ];
      // Original reviewed clips retain their exact order and compatibility gate.
      const candidates = qualified
        ? preferDemoRuntimeCandidates(
            recorded,
            engineHint,
            (candidate) =>
              candidate.engine ??
              /\.(chromium|firefox|webkit)\.replay\.json$/.exec(candidate.replayURL)?.[1],
          )
        : recorded;
      for (let index = 0; index < candidates.length; index++) {
        let replay;
        try {
          replay = await loadDemoRecording(candidates[index], {
            ...loading,
            fetch: fetcher,
            signal,
          });
          const isLastCandidate = index === candidates.length - 1;
          const player = await (isLastCandidate && clip.source !== 'local' && !qualified
            ? prepareReviewedReplayPlayer(replay, { signal })
            : prepareReplayPlayer(replay, { signal }));
          if (
            !['won', 'lost'].includes(player.info.recordedStatus) ||
            (candidates[index].outcome && candidates[index].outcome !== player.info.recordedStatus)
          ) {
            player.dispose();
            throw new Error('Demo recordings must finish with a real win or loss.');
          }
          return player;
        } catch (error) {
          if (error.name === 'ReplayVerificationError' && !signal?.aborted && qualified) {
            try {
              const diagnostic = await withDemoLoadingDeadline(
                async (signal) => {
                  const response = await fetcher(
                    new URL(
                      candidates[index].replayURL.replace(/\.replay\.json$/, '.diagnostics.json'),
                      import.meta.url,
                    ),
                    { signal },
                  );
                  if (!response.ok) return null;
                  const body = await response.text();
                  return diagnoseDemoReplay(replay, body, { signal });
                },
                { ...loading, signal },
              );
              if (diagnostic) error.diagnostics = [...(error.diagnostics ?? []), diagnostic];
            } catch {
              // A missing diagnostic cannot change the native verification result.
            }
          }
          if (
            (!qualified && error.name !== 'ReplayVerificationError') ||
            signal?.aborted ||
            index === candidates.length - 1
          )
            throw error;
        }
      }
    },
  }));
  if (typeof WorkerClass === 'function')
    for (const entry of entries) {
      if (entry.difficulty && entry.difficulty !== 'standard') continue;
      for (const level of entry.campaign.levels) {
        if (!LIVE_BOT_LEVEL_IDS.includes(level.id)) continue;
        const simulationLevel = applyGameplayTuning(level, resolveGameplayTuning('standard'));
        const options = {
          seed: 1,
          turnPolicy,
          classId: 'scout',
          classRecipes: entry.classRecipes ?? entry.campaign.classRecipes,
        };
        if (!supportsDemoBot(simulationLevel, options)) continue;
        const identity = demoIdentity(level, options.classRecipes),
          recordingIdentity = demoIdentity(simulationLevel, options.classRecipes);
        for (const seed of [1, 2, 3])
          sources.push({
            id: `live-${campaignKey(entry.campaign)}-${level.id}-${seed}`,
            kind: 'bot',
            variantId: entry.difficulty ?? 'standard',
            levelId: level.id,
            level,
            entry,
            identity,
            recordingIdentity,
            campaignKey: campaignKey(entry.campaign),
            levelKey: `${campaignKey(entry.campaign)}/${level.id}`,
            create: ({ signal, onWorker }) =>
              prepareCompleteBotPlayer(
                simulationLevel,
                { ...options, seed },
                { signal, WorkerClass, plannerSeed: seed, onWorker },
              ),
          });
      }
    }
  const represented = new Set(sources.map((source) => source.levelKey));
  for (const entry of entries) {
    if (entry.difficulty && entry.difficulty !== 'standard') continue;
    const recipes = entry.classRecipes ?? entry.campaign.classRecipes;
    if (!Array.isArray(recipes) || !recipes.length) continue;
    for (const [levelIndex, level] of entry.campaign.levels.entries()) {
      const key = `${campaignKey(entry.campaign)}/${level.id}`;
      if (represented.has(key)) continue;
      const simulationLevel = applyGameplayTuning(level, resolveGameplayTuning('standard')),
        classId = recipes[levelIndex % recipes.length].id,
        baseSeed = (levelIndex + 1) * 2654435761;
      let performance = 0;
      sources.push({
        id: `improv-${campaignKey(entry.campaign)}-${level.id}`,
        kind: 'improv',
        variantId: entry.difficulty ?? 'standard',
        levelId: level.id,
        level,
        entry,
        identity: demoIdentity(level, recipes),
        recordingIdentity: demoIdentity(simulationLevel, recipes),
        campaignKey: campaignKey(entry.campaign),
        levelKey: key,
        create: ({ signal }) => {
          performance++;
          const seed = (baseSeed ^ Math.imul(performance, 2246822519)) >>> 0;
          return prepareImprovPlayer(
            simulationLevel,
            { seed, turnPolicy, classId, classRecipes: recipes },
            { signal, performanceSeed: seed },
          );
        },
      });
      represented.add(key);
    }
  }
  return sources;
}
