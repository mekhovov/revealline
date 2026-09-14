import { describeCurrentArt } from '../../game/presentation/current-art.mjs';
import { hashPresentationBytes } from '../../game/presentation/bundle.mjs';
import { freezePresentation } from '../../game/presentation/model.mjs';
import { validatePack } from '../../game/packs.mjs';
import { campaignKey } from '../../game/library.mjs';
import { required } from '../../game/data-json.mjs';

const rootURL = new URL('../../', import.meta.url);
const check = (signal) => {
  if (signal?.aborted) throw new DOMException('Picture context cancelled.', 'AbortError');
};

/** Code-owned mission metadata only. No original image, player library or installation. */
export async function pictureOwnerContext(
  slotId,
  {
    signal,
    fetch: request = globalThis.fetch,
    baseURL = rootURL,
    describe = describeCurrentArt,
  } = {},
) {
  const descriptor = describe(slotId);
  if (!descriptor) return null;
  check(signal);
  let { level, theme } = descriptor;
  if (!level || !theme) {
    const pin = descriptor.source?.pack;
    required(pin, 'Exact picture owner metadata is unavailable. No substitute board was used.');
    const base = new URL(baseURL),
      url = new URL(pin.path, base);
    required(
      ['http:', 'https:'].includes(base.protocol) &&
        base.href.endsWith('/') &&
        !base.search &&
        !base.hash &&
        !base.username &&
        !base.password &&
        url.origin === base.origin &&
        url.href.startsWith(base.href),
      'Picture context requires its matching same-origin distribution.',
    );
    const response = await request(url.href, {
      signal,
      redirect: 'error',
      credentials: 'same-origin',
    });
    try {
      check(signal);
      required(
        response.ok,
        `Exact owner pack unavailable (HTTP ${response.status}). Open the matching release; no substitute board was used.`,
      );
      required(
        !response.redirected && (!response.url || response.url === url.href),
        'Owner pack moved from its registered source.',
      );
      required(response.body?.getReader, 'Bounded owner metadata reads are unavailable.');
    } catch (error) {
      await response.body?.cancel?.().catch(() => {});
      throw error;
    }
    const reader = response.body.getReader(),
      parts = [];
    let total = 0,
      complete = false;
    const cancel = () => {
      void reader.cancel().catch(() => {});
    };
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      for (;;) {
        check(signal);
        const part = await reader.read();
        check(signal);
        if (part.done) {
          complete = true;
          break;
        }
        total += part.value.byteLength;
        required(total <= pin.bytes, 'Owner pack exceeds its registered byte budget.');
        parts.push(part.value);
      }
    } finally {
      signal?.removeEventListener('abort', cancel);
      if (!complete) await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.byteLength;
    }
    required(
      total === pin.bytes && (await hashPresentationBytes(bytes)) === pin.sha256,
      'Owner pack differs from its immutable source pin.',
    );
    check(signal);
    const pack = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    const checked = validatePack(pack);
    required(checked.valid, `Owner pack is invalid: ${checked.errors.join('; ')}`);
    const campaign = pack.campaigns.find(
      (candidate) =>
        campaignKey({
          ...candidate,
          classRecipes: pack.classRecipes.filter(
            (recipe) => !candidate.classIds || candidate.classIds.includes(recipe.id),
          ),
        }) === descriptor.owner.baseCampaignKey,
    );
    level = campaign?.levels.find((candidate) => candidate.id === descriptor.owner.levelId);
    theme = pack.themes.find((candidate) => candidate.id === descriptor.owner.themeId);
  }
  required(
    level?.id === descriptor.owner.levelId &&
      level.revision === descriptor.owner.levelRevision &&
      theme?.id === descriptor.owner.themeId,
    'Picture owner level or theme differs. No substitute board was used.',
  );
  check(signal);
  return freezePresentation({
    descriptor,
    level,
    theme,
    fit: descriptor.fit,
    sampling: descriptor.sampling,
  });
}
