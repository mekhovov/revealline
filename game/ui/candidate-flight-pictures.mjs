import { required } from '../data-json.mjs';
import { compileAssetRevision } from '../content-design/assets.mjs';
import {
  acquireCandidatePicture,
  isCandidatePictureFor,
  claimCandidatePicture,
  discardUnclaimedCandidatePicture,
} from '../content-design/picture.mjs';
import { pictureDisplayContext } from './presentation-image.mjs';

const cancelled = () => new DOMException('Candidate picture preparation cancelled.', 'AbortError');

/** One candidate attempt, one authored theme and one immutable original. Uses
 * the same readiness/display interface as flight-pictures without pretending to
 * be an official managed-media choice. Prepared pixels may transfer here once
 * the caller has taken the candidate attempt and checked its host ownership. */
export function createCandidateFlightPictures({
  context,
  asset: source,
  picture = null,
  acquire = acquireCandidatePicture,
  timeoutMs = 20000,
}) {
  const ownContext = pictureDisplayContext(context),
    asset = compileAssetRevision(source);
  required(typeof acquire === 'function', 'Candidate picture acquisition is required.');
  required(
    Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 20000,
    'Invalid candidate picture deadline.',
  );
  required(
    picture === null || isCandidatePictureFor(asset, picture),
    'Prepared picture does not match this exact original.',
  );
  let binding = picture ? claimCandidatePicture(asset, picture) : null,
    pending = null,
    generation = 0,
    disposed = false;
  const cancel = () => {
    generation++;
    const old = pending;
    pending = null;
    old?.abort();
  };
  async function ensure(themeId = ownContext.themeId, { signal, onStatus = () => {} } = {}) {
    required(!disposed, 'Candidate picture attempt is disposed.');
    required(themeId === ownContext.themeId, 'This candidate keeps its authored theme.');
    if (signal?.aborted) throw cancelled();
    const ticket = generation + 1;
    cancel();
    if (disposed || generation !== ticket || pending) throw cancelled();
    if (binding && isCandidatePictureFor(asset, binding)) return true;
    binding = null;
    const controller = new AbortController();
    pending = controller;
    const current = () => !disposed && generation === ticket && !controller.signal.aborted;
    const check = () => {
      if (!current()) throw cancelled();
    };
    const report = (status, message) => {
      check();
      try {
        onStatus({
          status,
          stage: status === 'ready' ? 'ready' : 'preparing',
          progress: null,
          message,
        });
      } catch {}
      check();
    };
    let timer,
      abort,
      candidate = null;
    const stopped = new Promise((_, reject) => {
      const stop = (error) => {
        reject(error);
        controller.abort();
      };
      abort = () => stop(cancelled());
      controller.signal.addEventListener('abort', () => reject(cancelled()), { once: true });
      signal?.addEventListener('abort', abort, { once: true });
      timer = setTimeout(
        () =>
          stop(
            new Error(
              'The candidate picture did not become ready in time. Keep this flight and retry.',
            ),
          ),
        timeoutMs,
      );
    });
    try {
      candidate = await Promise.race([
        stopped,
        Promise.resolve().then(async () => {
          report('preparing', 'Verifying and opening this mission’s original picture…');
          const result = await acquire(asset, { signal: controller.signal });
          try {
            claimCandidatePicture(asset, result);
          } catch (error) {
            discardUnclaimedCandidatePicture(result);
            throw error;
          }
          if (!current()) {
            result.release();
            throw cancelled();
          }
          return result;
        }),
      ]);
      check();
      required(
        isCandidatePictureFor(asset, candidate),
        'Candidate picture was not verified for this original.',
      );
      // Observers may close the host or start newer work. Do not publish first.
      report('ready', 'This mission’s original picture is ready.');
      binding = candidate;
      candidate = null;
      return true;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (pending === controller) pending = null;
      controller.abort();
      candidate?.release?.();
    }
  }
  return Object.freeze({
    kind: 'candidate',
    officialProgressEligible: false,
    legacy: false,
    identityCatalog: null,
    context: ownContext,
    assetRevision: asset,
    pins: () => undefined,
    ready: (themeId) =>
      !disposed &&
      themeId === ownContext.themeId &&
      !!binding &&
      isCandidatePictureFor(asset, binding),
    current: () => (binding && isCandidatePictureFor(asset, binding) ? binding : null),
    ensure,
    cancel,
    dispose() {
      if (disposed) return;
      disposed = true;
      const old = binding;
      binding = null;
      cancel();
      old?.release();
    },
  });
}
