import {
  createPresentationPins,
  snapshotPresentationPins,
  validatePresentationPinsForRun,
  PRESENTATION_PINS_FORMAT,
} from '../presentation-pins.mjs';
import { createPresentationImageSlot } from './presentation-image.mjs';

/** One attempt's immutable choices and one currently displayed decoded original.
 * The caller owns pause/resume intent. No simulation, profile or award writes. */
export function createFlightPictures({
  context,
  level,
  themeIds,
  identityCatalog,
  readMedia,
  pins: savedPins,
  legacy = false,
  explicitLegacy = false,
  acquire,
}) {
  const ownContext = Object.freeze({ ...context });
  const worlds = Object.freeze([...themeIds]);
  let pins =
    savedPins === undefined
      ? undefined
      : validatePresentationPinsForRun(savedPins, {
          identityCatalog,
          campaignKey: context.executionKey,
          level,
          themeId: context.themeId,
        });
  if (explicitLegacy)
    pins = snapshotPresentationPins({
      format: PRESENTATION_PINS_FORMAT,
      executionKey: context.executionKey,
      levelId: level.id,
      levelRevision: level.revision,
      choices: worlds.map((themeId) => ({
        kind: 'legacy',
        identity: identityCatalog.resolve({
          executionKey: context.executionKey,
          levelId: level.id,
          levelRevision: level.revision,
          themeId,
        }),
      })),
    });
  let slot = null,
    readyTheme = legacy ? context.themeId : null,
    pending = null,
    generation = 0,
    disposed = false;
  function cancel() {
    generation++;
    pending?.abort();
    pending = null;
  }
  async function ensure(themeId = ownContext.themeId, { signal } = {}) {
    if (disposed) throw new Error('This picture attempt is closed.');
    if (signal?.aborted) throw new DOMException('Picture preparation cancelled.', 'AbortError');
    cancel();
    if (readyTheme === themeId) return true;
    const ticket = generation,
      controller = new AbortController();
    pending = controller;
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    let candidate = null;
    const check = () => {
      if (disposed || controller.signal.aborted || ticket !== generation)
        throw new DOMException('Picture preparation cancelled.', 'AbortError');
    };
    try {
      check();
      if (legacy) {
        readyTheme = themeId;
        return true;
      }
      let media;
      if (!pins) {
        media = await readMedia({ signal: controller.signal });
        check();
        pins = createPresentationPins({
          library: media.metadata.document.library,
          identityCatalog,
          executionKey: context.executionKey,
          levelId: level.id,
          levelRevision: level.revision,
          themeIds: worlds,
        });
      }
      const pin = pins.choices.find((choice) => choice.identity.themeId === themeId);
      if (!pin) throw new Error('This saved attempt has no picture choice for that world.');
      if (pin.kind === 'still') {
        media ??= await readMedia({ signal: controller.signal });
        check();
        candidate = createPresentationImageSlot(acquire ? { acquire } : {});
        const next = { ...ownContext, themeId };
        candidate.setContext(next);
        await candidate.load(
          { pin, metadata: media.metadata, store: media.store },
          { context: next, signal: controller.signal },
        );
      }
      check();
      const prior = slot;
      slot = candidate;
      candidate = null;
      readyTheme = themeId;
      prior?.dispose();
      return true;
    } finally {
      signal?.removeEventListener('abort', abort);
      candidate?.dispose();
      if (pending === controller) pending = null;
    }
  }
  function dispose() {
    if (!disposed) {
      disposed = true;
      cancel();
      slot?.dispose();
      slot = null;
    }
  }
  return Object.freeze({
    ensure,
    cancel,
    dispose,
    pins: () => pins,
    ready: (themeId) => readyTheme === themeId,
    current: () => slot?.current() ?? null,
    identityCatalog,
    legacy,
    context: ownContext,
  });
}
