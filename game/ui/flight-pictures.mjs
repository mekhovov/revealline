import {
  createPresentationPins,
  snapshotPresentationPins,
  PRESENTATION_PINS_FORMAT,
} from '../presentation-pins.mjs';
import {
  createFlightPresentationPins,
  presentationPicturePins,
  validateFlightPresentationPinsForRun,
} from '../flight-media-pins.mjs';
import { createPresentationImageSlot } from './presentation-image.mjs';

/** One attempt's immutable choices and one currently displayed decoded original.
 * acquireLegacy({pin,themeId},{signal}) owns authored legacy-pin decoding, when
 * supplied; legacy:true practice still uses its original no-acquisition path.
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
  acquireLegacy,
  selectPins,
  prepareSelection,
}) {
  const ownContext = Object.freeze({ ...context });
  const worlds = Object.freeze([...themeIds]);
  let pins =
    savedPins === undefined
      ? undefined
      : validateFlightPresentationPinsForRun(savedPins, {
          identityCatalog,
          campaignKey: context.executionKey,
          level,
          themeId: context.themeId,
        });
  if (explicitLegacy && !selectPins)
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
  async function ensure(themeId = ownContext.themeId, { signal, onStatus = () => {} } = {}) {
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
    const report = (value) => {
      if (disposed || controller.signal.aborted || ticket !== generation) return;
      try {
        onStatus({ status: 'preparing', progress: null, ...value });
      } catch {}
    };
    try {
      check();
      if (legacy) {
        readyTheme = themeId;
        return true;
      }
      let media;
      if (!pins) {
        report({ stage: 'reading', message: 'Reading this flight’s picture choices…' });
        media = await readMedia({ signal: controller.signal });
        check();
        let selection = {
          library: media.metadata.document.library,
          identityCatalog,
          executionKey: context.executionKey,
          levelId: level.id,
          levelRevision: level.revision,
          themeIds: worlds,
        };
        if (prepareSelection && !explicitLegacy) {
          report({ stage: 'preparing', message: 'Preparing this flight’s original picture…' });
          const prepared = await prepareSelection({
            media,
            selection,
            signal: controller.signal,
            onStatus: report,
          });
          check();
          media = prepared.media;
          selection = { ...selection, library: prepared.library };
        }
        report({ stage: 'verifying', message: 'Checking this flight’s exact picture binding…' });
        const selected = selectPins
          ? await selectPins({ media, selection, explicitLegacy, signal: controller.signal })
          : media.story
            ? await createFlightPresentationPins(
                {
                  ...selection,
                  stillDocument: media.metadata.document,
                  storyDocument: media.story.document,
                },
                { signal: controller.signal },
              )
            : createPresentationPins(selection);
        check();
        pins = selectPins
          ? validateFlightPresentationPinsForRun(selected, {
              identityCatalog,
              campaignKey: context.executionKey,
              level,
              themeId: context.themeId,
            })
          : selected;
      }
      const pin = presentationPicturePins(pins).choices.find(
        (choice) => choice.identity.themeId === themeId,
      );
      if (!pin) throw new Error('This saved attempt has no picture choice for that world.');
      if (pin.kind === 'still') {
        report({ stage: 'reading', message: 'Reading the saved picture original…' });
        media ??= await readMedia({ signal: controller.signal });
        check();
        candidate = createPresentationImageSlot(acquire ? { acquire } : {});
        const next = { ...ownContext, themeId };
        candidate.setContext(next);
        report({ stage: 'decoding', message: 'Opening this flight’s original picture…' });
        await candidate.load(
          { pin, metadata: media.metadata, store: media.store },
          { context: next, signal: controller.signal },
        );
      } else if (acquireLegacy) {
        report({ stage: 'decoding', message: 'Opening this flight’s authored picture…' });
        check();
        const handle = await acquireLegacy({ pin, themeId }, { signal: controller.signal });
        // Install the disposal owner before checking cancellation: an injected
        // acquisition may ignore abort and return its drawable late.
        candidate = handle
          ? Object.freeze({ current: () => handle, dispose: () => handle.dispose() })
          : null;
      }
      check();
      const prior = slot;
      slot = candidate;
      candidate = null;
      readyTheme = themeId;
      prior?.dispose();
      report({ status: 'ready', stage: 'ready', message: 'This flight’s picture is ready.' });
      return true;
    } catch (error) {
      if (error.name !== 'AbortError')
        report({
          status: 'error',
          stage: 'error',
          message: `Picture unavailable: ${error.message}`,
        });
      throw error;
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
