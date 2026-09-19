import { boundedJSON, canonicalJSON, exactKeys, required, stableId } from '../data-json.mjs';
import { validateCoopPack, COOP_PACK_MAX_BYTES } from '../coop/recipes.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { freezePresentation, LIMITS, validateAssetRevision } from '../presentation/model.mjs';

const digest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const revision = (value) => Number.isSafeInteger(value) && value > 0;
const identifier = (value) => typeof value === 'string' && value.length > 0 && value.length <= 100;
// Historical level revisions are opaque strings or positive integer Numbers.
// Asset/theme revisions remain their separate, stricter presentation contract.
const levelRevision = (value) => identifier(value) || (Number.isInteger(value) && value > 0);
const fields = (value, names, label) => {
  const keys = names.split(' ');
  exactKeys(value, keys, label);
  required(
    keys.every((key) => Object.hasOwn(value, key)),
    `${label} is incomplete.`,
  );
};
function pictureIdentity(picture) {
  fields(picture, 'slot assetId assetRevision sha256 bytes mime width height', 'Team picture');
  required(
    stableId(picture.slot) &&
      stableId(picture.assetId) &&
      revision(picture.assetRevision) &&
      digest(picture.sha256) &&
      revision(picture.bytes) &&
      picture.bytes <= LIMITS.assetBytes &&
      ['image/png', 'image/jpeg'].includes(picture.mime) &&
      picture.width === 1152 &&
      picture.height === 576,
    'Team picture requires a bounded complete 1152×576 PNG/JPEG identity.',
  );
}
function historicalPolicy(source) {
  if (source === null || source === undefined) return null;
  const policy = boundedJSON(source, { maxBytes: 4096, maxArray: 16 });
  fields(
    policy,
    'version themeId themeRevision collection picture',
    'Team historical import policy',
  );
  required(
    policy.version === 'revealline-team-historical-import-picture.v1' &&
      stableId(policy.themeId) &&
      revision(policy.themeRevision) &&
      policy.collection === null,
    'Invalid Team historical import picture policy.',
  );
  pictureIdentity(policy.picture);
  required(
    policy.picture.slot === 'scene.reveal.wide',
    'Historical Team imports require an explicit wide-scene association.',
  );
  return freezePresentation(policy);
}
function bindingTable(source) {
  const rows = boundedJSON(source, { maxBytes: 256 * 1024, maxArray: 128 });
  required(Array.isArray(rows), 'Team picture bindings must be a finite list.');
  const seen = new Set();
  for (const row of rows) {
    fields(
      row,
      'packId packRevision packSha256 levelId levelRevision levelSha256 themeId themeRevision collection picture',
      'Team binding',
    );
    required(
      identifier(row.packId) &&
        revision(row.packRevision) &&
        digest(row.packSha256) &&
        identifier(row.levelId) &&
        levelRevision(row.levelRevision) &&
        digest(row.levelSha256) &&
        stableId(row.themeId) &&
        revision(row.themeRevision),
      'Team binding needs complete immutable content and theme identities.',
    );
    if (row.collection !== null) {
      fields(row.collection, 'id revision', 'Team collection');
      required(
        stableId(row.collection.id) && revision(row.collection.revision),
        'Invalid Team collection identity.',
      );
    }
    if (row.picture !== null) pictureIdentity(row.picture);
    const { picture: _, ...identity } = row;
    const key = canonicalJSON(identity);
    required(!seen.has(key), 'Duplicate Team picture identity.');
    seen.add(key);
  }
  return freezePresentation(rows);
}
function requestIdentity(request) {
  required(request && typeof request === 'object', 'A Team picture request is required.');
  const { levelId, themeId, attemptId } = request;
  required(
    identifier(levelId) && stableId(themeId) && stableId(attemptId),
    'Invalid Team request identity.',
  );
  const pack = boundedJSON(request.pack, { maxBytes: COOP_PACK_MAX_BYTES, maxArray: 4096 });
  const validation = validateCoopPack(pack);
  required(validation.valid, `Invalid Team pack: ${validation.errors.join('; ')}`);
  const level = pack.levels.find((entry) => entry.id === levelId);
  required(level, 'The requested Team level is absent from this exact pack.');
  const packJSON = canonicalJSON(pack),
    levelJSON = canonicalJSON(level);
  return {
    pack,
    level,
    themeId,
    attemptId,
    packJSON,
    levelJSON,
    key: canonicalJSON([packJSON, levelId, themeId, attemptId]),
  };
}
function snapshotIdentity(snapshot, themeId) {
  const theme = snapshot?.resolved?.theme,
    collection = snapshot?.resolved?.collection;
  required(
    theme?.id === themeId && revision(theme.revision),
    'No matching prepared Team theme snapshot.',
  );
  required(
    collection === null || (stableId(collection?.id) && revision(collection?.revision)),
    'Invalid prepared Team collection.',
  );
  return freezePresentation({
    themeId: theme.id,
    themeRevision: theme.revision,
    collection: collection === null ? null : { id: collection.id, revision: collection.revision },
  });
}
function selectedAsset(snapshot, row) {
  if (row.picture === null) return null;
  const wanted = row.picture;
  const asset = validateAssetRevision(snapshot.resolved.assets?.[wanted.slot]);
  const file = asset.file,
    frame = asset.geometry?.frame;
  required(
    asset.kind === 'image' &&
      asset.id === wanted.assetId &&
      asset.revision === wanted.assetRevision &&
      asset.quality.stage === 'reviewed' &&
      file.sha256 === wanted.sha256 &&
      file.bytes === wanted.bytes &&
      file.mime === wanted.mime &&
      file.width === wanted.width &&
      file.height === wanted.height &&
      frame.x === 0 &&
      frame.y === 0 &&
      frame.width === file.width &&
      frame.height === file.height,
    'The prepared Team asset does not match its exact reviewed picture binding.',
  );
  return asset;
}
function imageURL(bytes, mime) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32768)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return `data:${mime};base64,${btoa(binary)}`;
}
const aborted = () => new DOMException('Team picture preparation was cancelled.', 'AbortError');
const releaseQuietly = (lease) => {
  try {
    lease?.release();
  } catch {
    /* Release owns no game state. */
  }
};

/** No production bindings, network defaults, storage, simulation or art adoption.
 * The host injects a prepared registry snapshot and readers for its exact assets.
 * A null picture is an explicit registered procedural choice, never error fallback.
 */
export function createCoopPresentation({
  bindings,
  historicalImportPolicy,
  getSnapshot,
  readPicture,
  decodeImage,
}) {
  const rows = bindingTable(bindings),
    policy = historicalPolicy(historicalImportPolicy),
    closedNamespaces = new Set(['relay-rescue-starter', ...rows.map((row) => row.packId)]);
  required(
    [getSnapshot, readPicture, decodeImage].every((fn) => typeof fn === 'function'),
    'Team presentation requires injected snapshot, picture and decoder readers.',
  );
  let closed = false,
    captured = null,
    accepted = null,
    pending = null,
    selectionEpoch = 0;
  function contextCurrent(state) {
    const epoch = selectionEpoch;
    required(!closed && captured === state, 'This Team picture attempt is no longer current.');
    required(getSnapshot() === state.snapshot, 'Team presentation changed; prepare a new attempt.');
    required(
      canonicalJSON(snapshotIdentity(state.snapshot, state.request.themeId)) ===
        canonicalJSON(state.theme),
      'Team theme identity changed during preparation.',
    );
    if (state.row)
      required(
        canonicalJSON(selectedAsset(state.snapshot, state.row)) === state.assetJSON,
        'Team picture binding changed during preparation.',
      );
    // Snapshot readers (and injected snapshot accessors) can synchronously
    // cancel/dispose/select. Identity equality alone does not retain ownership.
    if (closed || captured !== state || selectionEpoch !== epoch) throw aborted();
  }
  function operationCurrent(operation) {
    if (closed || pending !== operation || operation.controller.signal.aborted) throw aborted();
    contextCurrent(operation.state);
    if (closed || pending !== operation || operation.controller.signal.aborted) throw aborted();
  }
  function report(operation, stage, message, status = 'preparing') {
    if (closed || pending !== operation || operation.controller.signal.aborted) return;
    try {
      operation.onStatus({ stage, message, status, progress: null });
    } catch {
      /* A display callback cannot adopt content. */
    }
  }
  function capture(request) {
    const identity = requestIdentity(request);
    if (captured?.request.attemptId === identity.attemptId) {
      required(
        captured.request.key === identity.key,
        'Retry must retain the exact Team pack, level and theme.',
      );
      contextCurrent(captured);
      return captured;
    }
    const snapshot = getSnapshot(),
      theme = snapshotIdentity(snapshot, identity.themeId);
    return { request: identity, snapshot, theme, row: null, assetJSON: null };
  }
  async function choose(operation) {
    const state = operation.state;
    operationCurrent(operation);
    if (state.row) return;
    report(operation, 'verifying', 'Verifying this exact Team arena and picture identity…');
    operationCurrent(operation);
    const encoder = new TextEncoder();
    const [packSha256, levelSha256] = await Promise.all([
      hashPresentationBytes(encoder.encode(state.request.packJSON)),
      hashPresentationBytes(encoder.encode(state.request.levelJSON)),
    ]);
    operationCurrent(operation);
    let row = rows.find(
      (candidate) =>
        candidate.packId === state.request.pack.id &&
        candidate.packRevision === state.request.pack.revision &&
        candidate.packSha256 === packSha256 &&
        candidate.levelId === state.request.level.id &&
        candidate.levelRevision === state.request.level.revision &&
        candidate.levelSha256 === levelSha256 &&
        candidate.themeId === state.theme.themeId &&
        candidate.themeRevision === state.theme.themeRevision &&
        canonicalJSON(candidate.collection) === canonicalJSON(state.theme.collection),
    );
    if (
      !row &&
      policy &&
      !closedNamespaces.has(state.request.pack.id) &&
      state.theme.themeId === policy.themeId &&
      state.theme.themeRevision === policy.themeRevision &&
      canonicalJSON(state.theme.collection) === canonicalJSON(policy.collection)
    ) {
      row = freezePresentation({
        packId: state.request.pack.id,
        packRevision: state.request.pack.revision,
        packSha256,
        levelId: state.request.level.id,
        levelRevision: state.request.level.revision,
        levelSha256,
        themeId: policy.themeId,
        themeRevision: policy.themeRevision,
        collection: policy.collection,
        picture: policy.picture,
      });
    }
    required(
      row,
      'No exact Team picture binding; this arena has not been prepared for this theme.',
    );
    const asset = selectedAsset(state.snapshot, row);
    state.assetJSON = canonicalJSON(asset);
    state.row = row;
  }
  async function prepare(operation) {
    let decoded = null;
    try {
      await choose(operation);
      operationCurrent(operation);
      const state = operation.state,
        row = state.row;
      if (row.picture) {
        report(operation, 'downloading', 'Reading the selected Team picture…');
        operationCurrent(operation);
        const original = await readPicture(row.picture.slot, {
          snapshot: state.snapshot,
          signal: operation.controller.signal,
          onStatus: (status) => report(operation, status.stage, status.message),
        });
        operationCurrent(operation);
        required(
          canonicalJSON(validateAssetRevision(original?.asset)) === state.assetJSON,
          'Team picture reader returned a different asset.',
        );
        let blob;
        try {
          const size = Object.getOwnPropertyDescriptor(Blob.prototype, 'size').get.call(
            original.blob,
          );
          const type = Object.getOwnPropertyDescriptor(Blob.prototype, 'type').get.call(
            original.blob,
          );
          required(
            size === row.picture.bytes && type === row.picture.mime,
            'Team picture reader returned invalid original bytes.',
          );
          blob = Blob.prototype.slice.call(original.blob, 0, size, type);
        } catch {
          throw new TypeError('Team picture reader returned invalid original bytes.');
        }
        report(operation, 'verifying', 'Verifying the complete Team picture original…');
        operationCurrent(operation);
        const bytes = new Uint8Array(await Blob.prototype.arrayBuffer.call(blob));
        operationCurrent(operation);
        required(
          bytes.length === row.picture.bytes &&
            (await hashPresentationBytes(bytes)) === row.picture.sha256,
          'Team picture original hash or size mismatch.',
        );
        operationCurrent(operation);
        const header = inspectImageDataUrl(imageURL(bytes, row.picture.mime));
        required(
          header.valid && header.width === 1152 && header.height === 576,
          'Team picture original dimensions disagree.',
        );
        report(operation, 'decoding', 'Preparing the complete Team picture…');
        operationCurrent(operation);
        const lease = await decodeImage(blob, { signal: operation.controller.signal });
        let released = false;
        decoded = {
          image: lease?.image,
          release() {
            if (released) return;
            released = true;
            if (typeof lease?.release === 'function') lease.release();
            else lease?.image?.close?.();
          },
        };
        required(
          lease && typeof lease.release === 'function',
          'Team picture decoding needs an owned release handle.',
        );
        operationCurrent(operation);
        required(
          decoded.image &&
            (decoded.image.naturalWidth ?? decoded.image.width) === 1152 &&
            (decoded.image.naturalHeight ?? decoded.image.height) === 576,
          'Decoded Team picture dimensions disagree.',
        );
      }
      operationCurrent(operation);
      const binding = Object.freeze({
        snapshot: state.snapshot,
        image: decoded?.image ?? null,
        choice: freezePresentation({ ...row, kind: row.picture ? 'image' : 'procedural' }),
        fit: 'contain',
        sampling: 'nearest',
      });
      // A display callback may cancel, select another attempt or dispose us.
      // Let it settle and recheck before replacing/releasing the accepted lease.
      report(
        operation,
        'ready',
        'The Team picture is ready. Start remains a separate action.',
        'ready',
      );
      operationCurrent(operation);
      const previous = accepted;
      accepted = { state, binding, release: decoded?.release ?? (() => {}) };
      decoded = null;
      const adoptionEpoch = selectionEpoch;
      releaseQuietly(previous);
      // Cleanup may itself dispose/cancel/select. That is lifecycle invalidation
      // after adoption, not a validation rollback; never return a disposed lease.
      // Do not invoke another external reader after the ownership swap.
      if (
        closed ||
        pending !== operation ||
        operation.controller.signal.aborted ||
        captured !== state ||
        selectionEpoch !== adoptionEpoch
      )
        throw aborted();
      return binding;
    } catch (error) {
      report(operation, 'error', `Team picture unavailable: ${error.message}`, 'error');
      throw error;
    } finally {
      releaseQuietly(decoded);
      operation.signal?.removeEventListener('abort', operation.abort);
      if (pending === operation) pending = null;
    }
  }
  return {
    select(request) {
      let state;
      const epoch = ++selectionEpoch;
      try {
        required(!closed, 'Team presentation is closed.');
        state = capture(request);
        if (closed || selectionEpoch !== epoch || request.signal?.aborted) throw aborted();
      } catch (error) {
        return Promise.reject(error);
      }
      if (pending?.state === state && !pending.controller.signal.aborted) return pending.promise;
      pending?.controller.abort();
      captured = state;
      if (accepted?.state === state) return Promise.resolve(accepted.binding);
      const controller = new AbortController();
      const operation = {
        state,
        controller,
        signal: request.signal,
        onStatus: request.onStatus ?? (() => {}),
      };
      operation.abort = () => controller.abort();
      operation.signal?.addEventListener('abort', operation.abort, { once: true });
      if (operation.signal?.aborted) operation.abort();
      pending = operation;
      // Assign promise ownership before any injected reader/status can reenter.
      operation.promise = Promise.resolve().then(() => prepare(operation));
      return operation.promise;
    },
    confirm(request) {
      if (request?.signal?.aborted) throw aborted();
      const identity = requestIdentity(request);
      required(
        !pending &&
          accepted &&
          accepted.state === captured &&
          captured.request.key === identity.key,
        'The exact Team picture is not ready for this request.',
      );
      contextCurrent(captured);
      if (request.signal?.aborted) throw aborted();
      return accepted.binding;
    },
    current: () => accepted?.binding ?? null,
    cancel() {
      selectionEpoch++;
      pending?.controller.abort();
    },
    dispose() {
      if (closed) return;
      closed = true;
      selectionEpoch++;
      pending?.controller.abort();
      releaseQuietly(accepted);
      accepted = null;
    },
  };
}
