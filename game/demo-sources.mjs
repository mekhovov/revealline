import {
  loadDemoCatalog,
  resolveDemoCatalog,
  demoIdentity,
  loadDemoRecording,
} from './demo-catalog.mjs';
import { prepareReplayPlayer } from './replay-player.mjs';
import { prepareBotPlayer } from './demo-bot-player.mjs';
import { supportsDemoBot } from './demo-bot.mjs';
import { campaignKey } from './library.mjs';

export async function loadDemoSources({
  entries,
  library,
  turnPolicy = 'immediate',
  signal,
  fetch: fetcher = globalThis.fetch,
  WorkerClass = globalThis.Worker,
}) {
  const checkAbort = () => {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  };
  checkAbort();
  let clips = [];
  try {
    clips = resolveDemoCatalog(await loadDemoCatalog({ fetch: fetcher, signal }), entries);
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  checkAbort();
  try {
    clips.push(...(await library.list(entries, { signal })));
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  checkAbort();
  const sources = clips.map((clip, index) => ({
    ...clip,
    kind: 'replay',
    levelKey: `${clip.campaignKey}/${clip.levelId}`,
    approachable: index === 0,
    async create({ signal }) {
      const replay = await loadDemoRecording(clip, { fetch: fetcher, signal });
      return prepareReplayPlayer(replay, { signal });
    },
  }));
  if (typeof WorkerClass === 'function')
    for (const entry of entries) {
      if (entry.difficulty && entry.difficulty !== 'standard') continue;
      for (const level of entry.campaign.levels) {
        const options = {
          seed: 1,
          turnPolicy,
          classId: 'scout',
          classRecipes: entry.classRecipes ?? entry.campaign.classRecipes,
        };
        if (!supportsDemoBot(level, options)) continue;
        for (const seed of [1, 2, 3])
          sources.push({
            id: `live-${campaignKey(entry.campaign)}-${level.id}-${seed}`,
            kind: 'bot',
            levelId: level.id,
            level,
            entry,
            identity: demoIdentity(level, options.classRecipes),
            campaignKey: campaignKey(entry.campaign),
            levelKey: `${campaignKey(entry.campaign)}/${level.id}`,
            create: ({ signal }) =>
              prepareBotPlayer(
                level,
                { ...options, seed },
                { signal, WorkerClass, plannerSeed: seed },
              ),
          });
      }
    }
  return sources;
}
