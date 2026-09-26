import { createRun } from './core/index.mjs';
import { versionsForCampaign } from './core/versions.mjs';
import { required } from './data-json.mjs';
import { createExecutionCatalog } from './campaign-contexts.mjs';
import { campaignKey } from './library.mjs';
import { snapshotReplayPresentation } from './replay-presentation.mjs';
import { matchReplayInstalledRules } from './replay-installed-rules.mjs';
import { prepareMissionLibraryIndex } from './mission-library/classic-source.mjs';
import { PACK_LIMITS, PACK_LIBRARY_VERSION, inspectPackLibraryMetadata } from './packs.mjs';
import { hashPresentationBytes } from './presentation/bundle.mjs';
import { validateActorAppearancePinForContent } from './presentation/actor-appearance-pin.mjs';
import { prepareCampaignVisualThemeContext } from './presentation/visual-theme-identities.mjs';
import { createJourneyVisualThemeIdentityAdapter } from './presentation/journey-visual-theme-identities.mjs';
import { loadAuthoredJourneyRoute } from './content-design/route-loader.mjs';
import { createCandidateSoloHost } from './content-design/solo-host.mjs';
import { authoredJourneyUsesActorMaterials } from './content-design/mode-href.mjs';
import { journeyActorThemeCandidates } from './presentation/journey-actor-materials.mjs';

const abort = (signal) => {
  if (signal?.aborted) throw new DOMException('Replay owner preparation cancelled.', 'AbortError');
};
const unavailable = 'The exact accepted replay owner is unavailable in this release.';
const appRoot = new URL('../', import.meta.url);

// These paths are obtained only from the shipped index or constants below,
// never from a recording, pin or caller-controlled URL.
function sourceURL(path) {
  required(
    typeof path === 'string' &&
      (path === 'game/content-design/themes.json' ||
        /^(game\/content\/|optional\/external-chapters\/|authoring\/library\/)[a-zA-Z0-9_./-]+\.json$/.test(
          path,
        )) &&
      !path.split('/').some((part) => part === '.' || part === '..'),
    'The trusted replay catalogue contains an unsupported source path.',
  );
  return new URL(path, appRoot);
}

async function readJSON(path, maxBytes, { fetcher, signal }, identity = null) {
  abort(signal);
  const url = sourceURL(path);
  const response = await fetcher(url.href, {
    signal,
    redirect: 'error',
    credentials: 'same-origin',
  });
  let reader;
  try {
    abort(signal);
    required(
      response.ok && !response.redirected && (!response.url || response.url === url.href),
      unavailable,
    );
    const length = response.headers?.get('content-length');
    required(
      length == null || (/^\d+$/.test(length) && +length > 0 && +length <= maxBytes),
      'Replay owner source exceeds its byte budget.',
    );
    required(response.body?.getReader, 'A bounded replay source response is required.');
    reader = response.body.getReader();
  } catch (error) {
    await response.body?.cancel?.().catch(() => {});
    throw error;
  }
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', cancel, { once: true });
  const chunks = [];
  let size = 0,
    complete = false;
  try {
    for (;;) {
      abort(signal);
      const part = await reader.read();
      abort(signal);
      if (part.done) {
        complete = true;
        break;
      }
      size += part.value.byteLength;
      required(size <= maxBytes, 'Replay owner source exceeds its byte budget.');
      chunks.push(part.value);
    }
  } finally {
    signal?.removeEventListener('abort', cancel);
    if (!complete) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  required(size > 0, 'Replay owner source is empty.');
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (identity)
    required(
      size === identity.bytes && (await hashPresentationBytes(bytes)) === identity.sha256,
      'Replay owner source bytes differ from the trusted catalogue.',
    );
  abort(signal);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

function recordedLevel(campaign, replay) {
  required(
    versionsForCampaign(campaign).ruleset === replay.ruleset,
    'Replay and accepted campaign simulation versions differ.',
  );
  return matchReplayInstalledRules({
    campaign,
    replay,
    state: createRun(replay.level, replay.options),
  });
}

async function journeyContext(envelope, options) {
  const authored = options.authored;
  if (envelope.actorAppearancePin.authoredPresentationSha256)
    required(
      authored?.editionId === envelope.actorAppearancePin.content.editionId &&
        authored.authoredPresentationSha256 ===
          envelope.actorAppearancePin.authoredPresentationSha256,
      'This recording needs its exact earlier edition artwork and actor recipes. Open the matching release; the recording has not been changed.',
    );
  const route = authored
    ? authored.route
    : await loadAuthoredJourneyRoute(envelope.actorAppearancePin.content.editionId);
  abort(options.signal);
  required(route, unavailable);
  const themes = authored
    ? { themes: authored.themes }
    : await readJSON('game/content-design/themes.json', 262144, options);
  const host = createCandidateSoloHost(route.source, {
    themes:
      !authored && authoredJourneyUsesActorMaterials(route.id)
        ? journeyActorThemeCandidates(themes.themes, {
            includeOriginals: route.preserveOriginalThemes === true,
          })
        : themes.themes,
    corePackIds: route.corePackIds,
    optionalCampaignIds: route.optionalCampaignIds,
  });
  try {
    const matches = host.entries.filter(
      (entry) =>
        entry.executionKey === envelope.execution.campaignKey &&
        entry.sourcePackId === envelope.execution.sourcePackId,
    );
    required(matches.length === 1, unavailable);
    const entry = matches[0],
      level = recordedLevel(entry.campaign, envelope.replay);
    const manifest = entry.manifests.find((item) => item.missionId === level.id);
    required(manifest, unavailable);
    const adapter = await createJourneyVisualThemeIdentityAdapter(route.source, {
      mode: 'solo',
      signal: options.signal,
    });
    return {
      scope: 'journey',
      ...(authored ? { authoredPresentationSha256: authored.authoredPresentationSha256 } : {}),
      content: await adapter.prepareHostSelection(
        {
          host,
          selection: entry,
          level,
          association: {
            editionId: route.id,
            contentThemeId: manifest.presentation.themeId,
            mode: 'solo',
          },
        },
        { signal: options.signal },
      ),
    };
  } finally {
    host.preparer.dispose();
  }
}

async function classicContext(envelope, options) {
  required(envelope.actorAppearancePin.content.editionId === 'field-kit', unavailable);
  const index = prepareMissionLibraryIndex(
    await readJSON('game/content/mission-library-index.json', 512 * 1024, options),
  );
  const rows = index.missions.filter(
    (row) =>
      row.packId === envelope.execution.sourcePackId &&
      row.levelId === envelope.replay.level.id &&
      row.modes.includes('solo'),
  );
  required(rows.length > 0, unavailable);
  const sources = new Set(rows.map((row) => JSON.stringify(row.sourceFile)));
  required(sources.size === 1, 'The accepted replay source is ambiguous.');
  const row = rows[0];
  required(row.sourceFile.bytes <= PACK_LIMITS.maxBytes, 'Replay owner source is too large.');
  const source = await readJSON(row.sourceFile.path, row.sourceFile.bytes, options, row.sourceFile);
  let entries, scope;
  if (row.source === 'base') {
    required(
      row.packId === null && row.sourceFile.path === 'game/content/campaign.json',
      unavailable,
    );
    const recipes = await readJSON('game/content/classes.json', 262144, options);
    const themes = await readJSON('game/content/themes.json', 262144, options);
    source.classRecipes = recipes;
    entries = [{ campaign: source, classRecipes: recipes, themes: themes.themes }];
    scope = 'builtin';
  } else {
    // Metadata inspection validates the full trusted pack and its normalized
    // fingerprint without inventing prepared-pack authority or media readiness.
    const metadata = await inspectPackLibraryMetadata({
      format: PACK_LIBRARY_VERSION,
      packs: [source],
    });
    abort(options.signal);
    const pack = metadata.packs[0];
    required(
      pack.id === row.packId &&
        pack.version === row.packVersion &&
        pack.identity.bytes === row.packIdentity.bytes &&
        pack.identity.sha256 === row.packIdentity.sha256,
      'Replay owner pack differs from the trusted catalogue.',
    );
    entries = pack.entries;
    scope = 'trusted-pack';
  }
  const entry = createExecutionCatalog(entries).find(envelope.execution.campaignKey);
  required(entry && (entry.sourcePackId ?? null) === envelope.execution.sourcePackId, unavailable);
  const level = recordedLevel(entry.campaign, envelope.replay);
  const accepted = rows.find((item) => item.campaignKey === entry.baseCampaignKey);
  required(
    accepted &&
      campaignKey(entry.baseCampaign) === accepted.campaignKey &&
      entry.baseCampaign.levels[accepted.levelIndex]?.id === accepted.levelId &&
      entry.baseCampaign.levels[accepted.levelIndex]?.revision === accepted.levelRevision,
    'Replay mission differs from the trusted catalogue.',
  );
  const themeId = envelope.actorAppearancePin.content.contentThemeId;
  required(
    entry.themes.some((theme) => theme.id === themeId),
    'Replay content theme is unavailable.',
  );
  return {
    scope,
    content: await prepareCampaignVisualThemeContext(
      {
        entry,
        level,
        association: { editionId: 'field-kit', contentThemeId: themeId, mode: 'solo' },
      },
      { signal: options.signal },
    ),
  };
}

/** Read-only owner resolution, not replay outcome verification or asset
 * readiness. Uploaded identities only select among code-owned sources. No
 * local Custom pack, latest preference or uploaded URL participates in trust.
 */
export async function prepareReplayActorContext(
  source,
  { signal, fetcher = fetch, authored } = {},
) {
  const envelope = snapshotReplayPresentation(source);
  abort(signal);
  required(typeof fetcher === 'function', 'Replay owner resolution requires a transport.');
  const options = { signal, fetcher, authored };
  const owner = envelope.actorAppearancePin.content.owner;
  required(['journey', 'campaign'].includes(owner.kind), 'This replay owner is not supported.');
  const result = await (owner.kind === 'journey'
    ? journeyContext(envelope, options)
    : classicContext(envelope, options));
  abort(signal);
  validateActorAppearancePinForContent(envelope.actorAppearancePin, result.content);
  return Object.freeze(result);
}
