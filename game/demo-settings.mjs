import { editionIdentityId, resolveEditionContext } from './edition-context.mjs';

export const LEGACY_DEMO_SETTINGS_KEY = 'revealline.demo.shared.v1';

/** Every entry in one build shares Solo's existing, isolated preference key. */
export function demoSettingsKey({ channel, buildInfo = null, editionId } = {}) {
  if (channel === undefined) {
    const version =
      typeof buildInfo?.version === 'string' &&
      /^(?:v?\d{1,5}\.\d{1,5}\.\d{1,5}|DEV)$/.test(buildInfo.version)
        ? buildInfo.version
        : null;
    const selectedEdition = editionId ?? buildInfo?.editionId;
    channel = selectedEdition
      ? resolveEditionContext({
          editionId: editionIdentityId(selectedEdition),
          version: version ?? 'DEV',
        }).channel
      : version
        ? `release-${version}`
        : 'dev';
  }
  return `revealline.demo.${channel}.v1`;
}

/** Native pages read only the small build identity used by the Solo app.
 * Missing/offline development metadata uses the same dev channel; a stalled
 * metadata request cannot hold ordinary mode startup indefinitely. */
export async function loadDemoSettingsKey({
  document: doc = globalThis.document,
  fetcher = globalThis.fetch,
  timeoutMs = 1500,
} = {}) {
  const editionId = doc?.documentElement?.dataset?.editionId;
  let buildInfo = null;
  const controller = new AbortController();
  let timer;
  try {
    buildInfo = await Promise.race([
      Promise.resolve().then(async () => {
        const response = await fetcher(new URL('./build-info.json', import.meta.url), {
          signal: controller.signal,
          cache: 'no-cache',
        });
        if (!response.ok || Number(response.headers?.get?.('content-length')) > 16384) return null;
        const text = await response.text();
        return text.length <= 16384 ? JSON.parse(text) : null;
      }),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } catch {
    // The ordinary Solo boot treats unavailable build-info as development too.
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
  try {
    return demoSettingsKey({ buildInfo, editionId });
  } catch {
    return demoSettingsKey();
  }
}

export function readDemoSettings(storage, key, reduced = false) {
  const defaults = {
    auto: !reduced,
    collect: false,
    gameSounds: false,
    hidePictures: false,
    showAllPictures: false,
  };
  try {
    // The old cross-mode key is a read-only fallback. A present canonical
    // document always wins, including when it is malformed; never resurrect
    // an older opt-in or migrate preferences merely by opening a demo.
    const stored = storage.getItem(key);
    const legacy =
      stored == null && key?.startsWith('revealline.demo.') && key !== LEGACY_DEMO_SETTINGS_KEY;
    const value = JSON.parse(legacy ? storage.getItem(LEGACY_DEMO_SETTINGS_KEY) : stored);
    if (
      value?.version !== 1 ||
      typeof value.auto !== 'boolean' ||
      typeof value.collect !== 'boolean' ||
      (value.gameSounds !== undefined && typeof value.gameSounds !== 'boolean') ||
      (value.hidePictures !== undefined && typeof value.hidePictures !== 'boolean') ||
      (value.showAllPictures !== undefined && typeof value.showAllPictures !== 'boolean') ||
      Object.keys(value).some(
        (name) =>
          !['version', 'auto', 'collect', 'gameSounds', 'hidePictures', 'showAllPictures'].includes(
            name,
          ),
      )
    )
      return defaults;
    return {
      auto: value.auto,
      collect: value.collect,
      gameSounds: value.gameSounds === true,
      hidePictures: value.hidePictures === true,
      showAllPictures: value.showAllPictures === true && value.hidePictures !== true,
    };
  } catch {
    return defaults;
  }
}
