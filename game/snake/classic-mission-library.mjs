import { dataIdentity } from '../data-json.mjs';
import { getLocale } from '../i18n/index.mjs';
import { createClassicSnake, classicSnakeUsesVariableHazards } from './classic-core.mjs';
import { prepareClassicSnakeLevel } from './classic-setup.mjs';
import { drawClassicBoard } from './classic-view.mjs';

/** Browsing has no attempt, clock, profile writer or awards. Exact catalogue
 * entries remain the launch authority; only the host may replace its match. */
export function classicSnakeLibrarySource({
  entries,
  chapters,
  campaigns,
  records,
  getSetup = () => ({}),
  getSeed = () => 17,
  locale = getLocale,
  communityIdentity = null,
  availability = () => ({ state: 'ready' }),
  launch,
}) {
  const cache = new Map();
  const local = (value) => value?.[locale()] ?? value?.en ?? '';
  const chapterFor = (entry) => chapters.find((chapter) => chapter.id === entry.chapterId);
  const campaignFor = (entry) =>
    campaigns.find((campaign) =>
      (campaign.chapterIds ?? campaign.chapters).includes(entry.chapterId),
    );
  const heading = (entry) => {
    const chapter = local(chapterFor(entry)?.title),
      campaign = local(campaignFor(entry)?.title);
    return chapter === campaign ? chapter : `${campaign} · ${chapter}`;
  };
  function prepared(entry) {
    const setup = getSetup(),
      seed = getSeed(),
      key = JSON.stringify([setup.pace, setup.format, setup.targetRules, setup.preset, seed]);
    let item = cache.get(entry);
    if (!item || item.key !== key) {
      const level = prepareClassicSnakeLevel(entry, setup);
      item = { key, level, seed, levelIdentity: dataIdentity(level), diagrams: new Map() };
      cache.set(entry, item);
    }
    return item;
  }
  const record = (entry, mode) => records?.get(prepared(entry), mode, 'mission');
  return {
    id: `snake:${communityIdentity ?? 'official'}`,
    editionId: communityIdentity ?? 'classic-snake',
    edition: 'Snake',
    collection: communityIdentity ? 'Custom' : 'Classic',
    entries,
    describe(entry) {
      const group = entries.filter((item) => item.chapterId === entry.chapterId);
      return {
        id: entry.id,
        revision: entry.level.revision,
        campaignKey: entry.chapterId,
        campaignTitle: heading(entry),
        name: local(entry.title),
        levelIndex: group.indexOf(entry),
        campaignLevelCount: group.length,
        ...(!communityIdentity
          ? {
              canonicalLevelKey: `snake:${entry.id}`,
              globalLevelNumber: entries.indexOf(entry) + 1,
            }
          : {}),
        modes: ['solo', 'versus', 'team'],
        tags: ['Arcade'],
        hook: local(entry.description),
      };
    },
    presentation: (entry) => ({
      name: local(entry.title),
      campaignTitle: heading(entry),
      edition: 'Snake',
      hook: local(entry.description),
    }),
    details: (entry) => ({ route: local(entry.description) }),
    availability(entry, mode) {
      try {
        prepared(entry);
        return availability(entry, mode);
      } catch {
        return {
          state: 'unavailable',
          reason: locale() === 'uk' ? 'Ці налаштування недоступні.' : 'This setup is unavailable.',
        };
      }
    },
    progressState(entry, mode) {
      const best = record(entry, mode);
      return best?.clear
        ? { state: 'completed', bestStars: best.rating?.stars || null }
        : { state: 'new', bestStars: null };
    },
    card(entry, mode) {
      const item = prepared(entry),
        seats = mode === 'team' ? 'team' : 'solo';
      if (!item.diagrams.has(seats)) {
        const run = createClassicSnake(item.level, {
          mode: seats,
          seed: item.seed,
          ...(classicSnakeUsesVariableHazards(item.level) ? { hazardSeed: 17 } : {}),
        });
        item.diagrams.set(seats, {
          kind: 'classic-snake',
          width: run.level.width,
          height: run.level.height,
          chapterId: entry.chapterId,
          run,
        });
      }
      return item.diagrams.get(seats);
    },
    // Snake does not grant reward pictures.
    completion: () => null,
    launch,
  };
}

export function renderClassicSnakeLibraryPreview({ container, diagram, document }) {
  if (diagram?.kind !== 'classic-snake') return;
  const canvas = document.createElement('canvas');
  canvas.className = 'journey-card-map';
  canvas.setAttribute('aria-hidden', 'true');
  container.append(canvas);
  drawClassicBoard(canvas, diagram.run, {
    boardStyle: 'retro',
    chapterId: diagram.chapterId,
    reduced: true,
    cssWidth: 288,
    pixelRatio: 1,
  });
}
