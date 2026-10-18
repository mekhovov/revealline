import { loadDemoCatalog, resolveDemoCatalog } from '../demo-catalog.mjs';
import { loadDemoSources } from '../demo-sources.mjs';
import { withDemoLoadingDeadline } from '../demo-loading.mjs';
import { prepareMissionLibraryIndex } from '../mission-library/classic-source.mjs';
import { verifyIndexedInstalledPack } from '../mission-library/pack-identity.mjs';
import { externalChapterHash } from '../external-chapter.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { campaignKey } from '../library.mjs';
import { PACK_LIMITS, preparePack, resolvePackCampaign } from '../packs.mjs';
import { browserDecodeImage } from '../imports.mjs';
import { soloClassicDemoLaunchURL } from './solo-classic-launch.mjs';
import { createSoloDemoSourceOwner } from './solo-source-owner.mjs';

const mismatch = () =>
  Object.assign(new Error('Authored Classic demonstration content has changed.'), {
    code: 'content-mismatch',
  });

/** Only finite same-release paths from the authored index are selectable. */
function sourceURL(row) {
  const path = row.sourceFile.path;
  if (
    row.source === 'base'
      ? path !== 'game/content/campaign.json'
      : !/^game\/content\/packs\/[a-z0-9][a-z0-9-]*\.json$/.test(path)
  )
    throw mismatch();
  if (row.sourceFile.bytes > PACK_LIMITS.maxBytes) throw mismatch();
  return new URL(`../../${path}`, import.meta.url);
}

/** Streaming bounds apply before JSON parsing, including transports that ignore abort. */
async function readBytes(url, maximum, { signal, fetch: fetcher }) {
  signal.throwIfAborted();
  const response = await fetcher(url, { signal, redirect: 'error', credentials: 'same-origin' });
  let reader;
  const cancel = () => {
    try {
      Promise.resolve(reader ? reader.cancel() : response.body?.cancel()).catch(() => {});
    } catch {}
  };
  if (signal.aborted) {
    cancel();
    signal.throwIfAborted();
  }
  signal.addEventListener('abort', cancel, { once: true });
  let finished = false;
  try {
    if (!response.ok)
      throw Object.assign(new Error('Authored Classic demonstration content is unavailable.'), {
        code: 'package-unavailable',
      });
    const length = response.headers?.get('content-length');
    if (
      response.redirected ||
      (response.url && response.url !== url.href) ||
      (length != null && (!/^\d+$/.test(length) || Number(length) > maximum)) ||
      !response.body?.getReader
    )
      throw mismatch();
    reader = response.body.getReader();
    const parts = [];
    let total = 0;
    for (;;) {
      signal.throwIfAborted();
      const result = await reader.read();
      signal.throwIfAborted();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maximum) throw mismatch();
      parts.push(result.value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.byteLength;
    }
    finished = true;
    return bytes;
  } finally {
    signal.removeEventListener('abort', cancel);
    if (!finished) cancel();
    reader?.releaseLock();
  }
}

async function prepareEntry(row, options) {
  const { signal } = options;
  const bytes = await readBytes(sourceURL(row), row.sourceFile.bytes, options);
  if (
    bytes.byteLength !== row.sourceFile.bytes ||
    (await externalChapterHash(bytes)) !== row.sourceFile.sha256
  )
    throw mismatch();
  signal.throwIfAborted();
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const decodeImage = async (dataUrl, context) => {
    signal.throwIfAborted();
    const image = await browserDecodeImage(dataUrl, { ...context, signal });
    signal.throwIfAborted();
    return image;
  };
  let authored;
  if (row.source === 'base') {
    const artwork = await readBytes(
      new URL('../content/base-artwork.json', import.meta.url),
      PACK_LIMITS.maxBytes,
      options,
    );
    const { pack } = await preparePack(new TextDecoder('utf-8', { fatal: true }).decode(artwork), {
      decodeImage,
    });
    if (pack.id !== 'first-signal-artwork') throw mismatch();
    authored = { ...resolvePackCampaign(pack, row.campaignId), sourcePackId: null };
    if (campaignKey(authored.campaign) !== row.campaignKey) throw mismatch();
    // The indexed campaign bytes own the simulation; artwork cannot replace it.
    authored.campaign = { ...JSON.parse(source), classRecipes: authored.classRecipes };
  } else {
    const { pack } = await preparePack(source, { decodeImage });
    if (!(await verifyIndexedInstalledPack(pack, row, { isCurrent: () => !signal.aborted })))
      throw mismatch();
    authored = resolvePackCampaign(pack, row.campaignId);
  }
  signal.throwIfAborted();
  const entry = createExecutionCatalog([authored]).entries.find(
    (entry) => entry.difficulty === 'standard' && campaignKey(entry.campaign) === row.campaignKey,
  );
  const level = entry?.campaign.levels[row.levelIndex];
  if (level?.id !== row.levelId || level.revision !== row.levelRevision) throw mismatch();
  return entry;
}

/** Enumerate metadata only. Selection owns one fully validated native pack and
 * replay until disposal; no installation, profile writes or pack cache exist. */
export async function loadBuiltinClassicSoloDemoSources({
  signal,
  fetch: fetcher = globalThis.fetch,
  index: suppliedIndex,
} = {}) {
  const [catalog, index] = await Promise.all([
    loadDemoCatalog({ signal, fetch: fetcher }),
    suppliedIndex
      ? prepareMissionLibraryIndex(suppliedIndex)
      : withDemoLoadingDeadline(
          async (signal) =>
            prepareMissionLibraryIndex(
              new TextDecoder('utf-8', { fatal: true }).decode(
                await readBytes(
                  new URL('../content/mission-library-index.json', import.meta.url),
                  512 * 1024,
                  { signal, fetch: fetcher },
                ),
              ),
            ),
          { signal },
        ),
  ]);
  signal?.throwIfAborted();
  return catalog.clips.flatMap((clip) => {
    const row = index.missions.find(
      (row) =>
        ['base', 'bundled', 'archived'].includes(row.source) &&
        row.modes.includes('solo') &&
        row.difficultiesByMode.solo.includes('standard') &&
        row.campaignKey === clip.campaignKey &&
        row.campaignId === clip.campaignId &&
        row.levelId === clip.levelId &&
        row.levelRevision === clip.levelRevision,
    );
    if (!row) return [];
    sourceURL(row);
    const metadataLevel = Object.freeze({
      id: row.levelId,
      revision: row.levelRevision,
      name: row.name,
    });
    const owner = createSoloDemoSourceOwner(metadataLevel);
    return [
      {
        ...clip,
        modeId: 'solo',
        kind: 'replay',
        levelKey: `${clip.campaignKey}/${clip.levelId}`,
        variantId: 'standard',
        approachable: row.source === 'base' && row.levelIndex === 0,
        launchURL: soloClassicDemoLaunchURL(row),
        get entry() {
          return owner.entry;
        },
        get level() {
          return owner.level;
        },
        async create({ signal, onWorker } = {}) {
          const ownerSignal = signal;
          return withDemoLoadingDeadline(
            async (signal) => {
              const entry = await prepareEntry(row, { signal, fetch: fetcher });
              const one = { format: catalog.format, clips: [clip] };
              const resolved = resolveDemoCatalog(one, [entry])[0];
              if (!resolved) throw mismatch();
              const sources = await loadDemoSources({
                entries: [entry],
                catalogs: [one],
                signal,
                fetch: fetcher,
                library: { list: async () => [] },
                WorkerClass: null,
              });
              const player = await sources
                .find((source) => source.id === clip.id)
                .create({ signal, onWorker });
              return owner.adopt(player, {
                entry,
                level: resolved.level,
                signals: [signal, ownerSignal],
              });
            },
            { signal, onLateResult: (player) => player.dispose() },
          );
        },
      },
    ];
  });
}
