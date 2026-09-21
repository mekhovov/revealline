import { boundedJSON, canonicalJSON, required, stableId } from '../data-json.mjs';
import { COOP_PACK_MAX_BYTES, validateCoopPack } from '../coop/recipes.mjs';
import {
  exportCoopPresentationEnvelope,
  readCoopPresentationPicture,
} from '../coop/presentation-envelope.mjs';
import { freezePresentation } from '../presentation/model.mjs';
import { prepareTeamVisualThemeContext } from '../presentation/visual-theme-identities.mjs';
import {
  createVisualThemeCatalogue,
  VISUAL_THEME_CATALOGUE_FORMAT,
} from '../presentation/visual-theme-catalogue.mjs';
import { prepareVisualThemeLease } from '../presentation/visual-theme-lease.mjs';
import { createPresentationHost } from '../presentation/host.mjs';
import { createCoopPresentation } from './coop-presentation.mjs';
import {
  RETAINED_FPV38_PRESENTATION,
  RETAINED_FPV38_PICTURE_BINDINGS,
  RETAINED_FPV38_IMPORT_POLICY,
} from './coop-retained-presentation.mjs';

const aborted = () =>
  new DOMException('Team presentation preparation was cancelled.', 'AbortError');
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const quiet = (fn) => {
  try {
    fn?.();
  } catch {
    /* Cleanup cannot adopt game state. */
  }
};
function ownRequest(source) {
  required(
    source && stableId(source.attemptId) && stableId(source.themeId),
    'Invalid Team request identity.',
  );
  const pack = boundedJSON(source.pack, { maxBytes: COOP_PACK_MAX_BYTES, maxArray: 4096 });
  const valid = validateCoopPack(pack);
  required(valid.valid, `Invalid Team pack: ${valid.errors.join('; ')}`);
  const level = pack.levels.find((entry) => entry.id === source.levelId);
  required(level, 'The requested Team level is absent from this exact pack.');
  const artworkSource = source.artworkSource ?? null;
  if (artworkSource) {
    exportCoopPresentationEnvelope(artworkSource);
    required(
      same(artworkSource.pack, pack),
      'Local Team artwork belongs to a different exact pack.',
    );
    readCoopPresentationPicture(artworkSource, level);
    required(
      artworkSource.receipt.theme.id === source.themeId,
      'Local Team artwork requires its accepted theme.',
    );
  }
  const request = {
    pack: freezePresentation(pack),
    levelId: level.id,
    themeId: source.themeId,
    attemptId: source.attemptId,
    artworkSource,
  };
  return {
    request,
    level,
    key: canonicalJSON([
      pack,
      level.id,
      source.themeId,
      source.attemptId,
      artworkSource?.receipt ?? null,
    ]),
  };
}
function themeOf(snapshot) {
  const theme = snapshot?.resolved?.theme;
  required(
    theme && stableId(theme.id) && Number.isSafeInteger(theme.revision) && theme.revision > 0,
    'No prepared Team theme snapshot.',
  );
  return { id: theme.id, revision: theme.revision, collection: snapshot.resolved.collection };
}
function presentationOf(snapshot) {
  return {
    source: snapshot.source,
    theme: { id: snapshot.resolved.theme.id, revision: snapshot.resolved.theme.revision },
    collection: snapshot.resolved.collection,
    sha256: snapshot.manifestSha256,
  };
}
const legacyTheme = { ...RETAINED_FPV38_PRESENTATION.theme, collection: null };

/** An attempt owns picture + optional retained theme together. No storage, global
 * preference, production-default or simulation mutation occurs in this wrapper.
 * createHost is trusted transport injection, never selected by imported data.
 */
export function createOwnedCoopPresentation({
  bindings,
  historicalImportPolicy,
  getSnapshot,
  readPicture,
  decodeImage,
  readAudio,
  apply,
  createHost = (association) =>
    createPresentationHost({ retainedManifestSha256: association.sha256 }),
}) {
  required(
    [getSnapshot, readPicture, decodeImage, createHost].every((fn) => typeof fn === 'function'),
    'Owned Team presentation requires prepared page readers and a decoder.',
  );
  const ownedBindings = freezePresentation(
    boundedJSON(bindings, { maxBytes: 256 * 1024, maxArray: 128 }),
  );
  const ownedPolicy =
    historicalImportPolicy == null
      ? null
      : freezePresentation(boundedJSON(historicalImportPolicy, { maxBytes: 4096, maxArray: 16 }));
  // Validate and own caller configuration now, before any asynchronous attempt.
  createCoopPresentation({
    bindings: ownedBindings,
    historicalImportPolicy: ownedPolicy,
    getSnapshot,
    readPicture,
    decodeImage,
  }).dispose();
  let closed = false,
    accepted = null,
    pending = null,
    lastRequest = null;
  const equalRequest = (a, b) =>
    a.key === b.key && a.request.artworkSource === b.request.artworkSource;
  const release = (state) => {
    if (!state) return;
    state.closed = true;
    state.controller.abort();
    state.signal?.removeEventListener('abort', state.abort);
    for (const cleanup of state.cleanups) quiet(cleanup);
    state.cleanups.clear();
    const picture = state.picture,
      theme = state.theme;
    state.picture = null;
    state.theme = null;
    quiet(() => picture?.dispose());
    quiet(() => theme?.release());
  };
  const check = (state) => {
    if (closed || state.closed || pending !== state || state.controller.signal.aborted)
      throw aborted();
  };
  const report = (state, status) => {
    if (closed || state.closed || pending !== state || state.controller.signal.aborted) return;
    try {
      state.onStatus(status);
    } catch {
      /* Status does not own resources. */
    }
  };
  function acceptedState() {
    required(!closed && accepted && !accepted.closed, 'The exact Team presentation is not ready.');
    const state = accepted;
    state.picture.confirm(state.owned.request);
    if (closed || state.closed || accepted !== state) throw aborted();
    return state;
  }
  async function prepare(state) {
    try {
      check(state);
      const request = state.owned.request,
        receipt = request.artworkSource?.receipt;
      const pageSnapshot = getSnapshot();
      check(state);
      const currentTheme = themeOf(pageSnapshot);
      const legacy = receipt && same(receipt.theme, legacyTheme);
      let retained = false;
      if (
        receipt &&
        (!same(receipt.theme, currentTheme) ||
          (legacy && !same(presentationOf(pageSnapshot), RETAINED_FPV38_PRESENTATION)))
      ) {
        required(legacy, 'No trusted exact retained presentation for this Team receipt.');
        report(state, {
          status: 'preparing',
          stage: 'verifying',
          progress: null,
          message: 'Preparing the exact retained Team presentation…',
        });
        check(state);
        const content = await prepareTeamVisualThemeContext(
          {
            pack: request.pack,
            level: state.owned.level,
            association: { editionId: 'fpv', contentThemeId: 'fpv', mode: 'team' },
          },
          { signal: state.controller.signal },
        );
        check(state);
        const selection = { id: 'team-legacy-fpv38', revision: 1 };
        const catalogue = createVisualThemeCatalogue({
          format: VISUAL_THEME_CATALOGUE_FORMAT,
          id: 'team-retained',
          revision: 1,
          entries: [
            {
              ...selection,
              name: 'Retained FPV field kit',
              presentation: RETAINED_FPV38_PRESENTATION,
              coverage: [content],
            },
          ],
        });
        state.theme = await prepareVisualThemeLease(
          { catalogue, selection, content, requiredSlots: ['scene.reveal.wide'] },
          {
            createHost: () => createHost(RETAINED_FPV38_PRESENTATION),
            signal: state.controller.signal,
            onStatus: (status) => {
              if (status.status !== 'ready') report(state, status);
            },
          },
        );
        check(state);
        required(
          state.theme.kind === 'prepared-presentation',
          'Exact retained Team presentation is unavailable.',
        );
        retained = true;
      }
      state.snapshot = retained ? state.theme.snapshot : pageSnapshot;
      const snapshot = state.snapshot;
      required(
        themeOf(snapshot).id === request.themeId,
        'No matching prepared Team theme snapshot.',
      );
      // Legacy matching page snapshots also use immutable legacy bindings; future
      // default bindings cannot alter historical import or reserved-pack authority.
      const legacyBindings = legacy && same(presentationOf(snapshot), RETAINED_FPV38_PRESENTATION);
      state.picture = createCoopPresentation({
        bindings: legacyBindings ? RETAINED_FPV38_PICTURE_BINDINGS : ownedBindings,
        historicalImportPolicy: legacyBindings ? RETAINED_FPV38_IMPORT_POLICY : ownedPolicy,
        getSnapshot: retained ? () => snapshot : () => getSnapshot(),
        readPicture: retained ? (...args) => state.theme.readPicture(...args) : readPicture,
        decodeImage,
      });
      const binding = await state.picture.select({
        ...request,
        signal: state.controller.signal,
        onStatus: (status) => report(state, status),
      });
      check(state);
      state.picture.confirm(request);
      check(state);
      const previous = accepted;
      accepted = state;
      state.binding = binding;
      pending = null;
      state.signal?.removeEventListener('abort', state.abort);
      release(previous);
      // A resource cleanup may reenter cancel/dispose/select. Never return a
      // released result, or silently overwrite the newer accepted owner.
      if (closed || state.closed || accepted !== state) throw aborted();
      return binding;
    } catch (error) {
      report(state, {
        status: 'error',
        stage: 'error',
        progress: null,
        message: `Team presentation unavailable: ${error.message}`,
      });
      if (accepted !== state) release(state);
      throw error;
    } finally {
      state.signal?.removeEventListener('abort', state.abort);
      if (pending === state) pending = null;
    }
  }
  return Object.freeze({
    select(source) {
      let owned;
      try {
        required(!closed, 'Team presentation is closed.');
        if (source?.signal?.aborted) throw aborted();
        owned = ownRequest(source);
        for (const old of [accepted?.owned, lastRequest])
          if (old?.request.attemptId === owned.request.attemptId)
            required(
              equalRequest(old, owned),
              'Retry must retain the exact Team pack, level, theme and artwork source.',
            );
        if (accepted && equalRequest(accepted.owned, owned)) {
          const current = accepted;
          const binding = current.picture.confirm(owned.request);
          if (pending) {
            const old = pending;
            pending = null;
            release(old);
          }
          if (closed || current.closed || accepted !== current || source.signal?.aborted)
            throw aborted();
          return Promise.resolve(binding);
        }
        if (pending && !pending.closed && equalRequest(pending.owned, owned))
          return pending.promise;
      } catch (error) {
        return Promise.reject(error);
      }
      const previous = pending;
      const state = {
        owned,
        closed: false,
        picture: null,
        theme: null,
        cleanups: new Set(),
        controller: new AbortController(),
        signal: source.signal,
        onStatus: source.onStatus ?? (() => {}),
      };
      state.abort = () => {
        if (pending === state) pending = null;
        release(state);
      };
      pending = state;
      lastRequest = owned;
      // Promise ownership precedes potentially reentrant cleanup and callbacks.
      state.promise = Promise.resolve().then(() => prepare(state));
      state.signal?.addEventListener('abort', state.abort, { once: true });
      if (state.signal?.aborted) state.abort();
      release(previous);
      return state.promise;
    },
    confirm(source) {
      if (source?.signal?.aborted) throw aborted();
      const owned = ownRequest(source),
        state = acceptedState();
      required(
        equalRequest(state.owned, owned),
        'The exact Team picture is not ready for this request.',
      );
      const binding = state.picture.confirm(owned.request);
      if (source.signal?.aborted) throw aborted();
      return binding;
    },
    current: () => accepted?.binding ?? null,
    snapshot: () => accepted?.snapshot ?? null,
    readAudio(slot, options = {}) {
      const state = acceptedState();
      if (state.theme) return state.theme.readAudio(slot, options);
      required(typeof readAudio === 'function', 'Team audio reader is unavailable.');
      return readAudio(slot, { ...options, snapshot: state.snapshot });
    },
    apply(element) {
      const state = acceptedState();
      const underlying = state.theme ? state.theme.apply(element) : apply?.(element);
      let done = false;
      const cleanup = () => {
        if (done) return;
        done = true;
        state.cleanups.delete(cleanup);
        quiet(underlying);
      };
      if (closed || state.closed || accepted !== state) {
        cleanup();
        throw aborted();
      }
      state.cleanups.add(cleanup);
      return cleanup;
    },
    cancel() {
      const state = pending;
      pending = null;
      release(state);
    },
    dispose() {
      if (closed) return;
      closed = true;
      const old = accepted,
        loading = pending;
      accepted = null;
      pending = null;
      release(loading);
      release(old);
    },
  });
}
