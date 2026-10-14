/** Authoring source preparation only. Verified bytes do not establish collision readiness. */
import {
  REGION_LIMITS,
  validateRegionManifest,
  createRegionPlanner,
} from "./region-manifest.mjs";

const abortError = () =>
  new DOMException("Regional preparation was cancelled", "AbortError");
const requireValue = (value, message) => {
  if (!value) throw new TypeError(message);
};

function contentBase(value) {
  const url = new URL(value);
  requireValue(
    url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)),
    "Content needs HTTPS or local verification HTTP",
  );
  requireValue(
    !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname.endsWith("/"),
    "Content base must be a directory URL without credentials, query or fragment",
  );
  return url;
}

async function readVerified(asset, url, fetchImpl, signal, subtle) {
  signal.throwIfAborted();
  const response = await fetchImpl(url, {
    signal,
    credentials: "omit",
    redirect: "error",
  });
  try {
    signal.throwIfAborted();
    requireValue(
      response.ok &&
        !response.redirected &&
        (!response.url || response.url === url.href),
      `Asset response rejected: ${asset.id}`,
    );
    requireValue(
      response.body?.getReader,
      `Asset response has no readable body: ${asset.id}`,
    );
  } catch (error) {
    await response.body?.cancel().catch(() => {});
    throw error;
  }
  const reader = response.body.getReader(),
    bytes = new Uint8Array(asset.bytes);
  let used = 0,
    complete = false;
  const cancel = () => {
    reader.cancel(signal.reason).catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      requireValue(
        value instanceof Uint8Array &&
          used + value.byteLength <= bytes.byteLength,
        `Asset response exceeds declared bytes: ${asset.id}`,
      );
      bytes.set(value, used);
      used += value.byteLength;
    }
    requireValue(
      used === asset.bytes,
      `Asset response is truncated: ${asset.id}`,
    );
    const digest = new Uint8Array(await subtle.digest("SHA-256", bytes));
    signal.throwIfAborted();
    const hash = [...digest]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    requireValue(hash === asset.sha256, `Asset hash mismatch: ${asset.id}`);
    complete = true;
    return bytes;
  } finally {
    signal.removeEventListener("abort", cancel);
    if (!complete) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/**
 * Bounded committed + staging source bytes. Fetch cancellation is serialized before a
 * successor starts. copyAsset returns a caller-owned copy outside this source budget.
 */
export function createRegionSourceWindow(
  input,
  {
    baseURL,
    fetchImpl = globalThis.fetch,
    subtle = globalThis.crypto?.subtle,
    maxSourceBytes = REGION_LIMITS.residentSourceBytes,
    concurrency = 2,
    timeoutMs = 120000,
  } = {},
) {
  const manifest = validateRegionManifest(input),
    planner = createRegionPlanner(manifest),
    base = contentBase(baseURL);
  requireValue(
    typeof fetchImpl === "function" && subtle?.digest,
    "Fetch and SHA-256 are required",
  );
  requireValue(
    Number.isSafeInteger(maxSourceBytes) &&
      maxSourceBytes > 0 &&
      maxSourceBytes <= REGION_LIMITS.residentSourceBytes,
    "Invalid source byte budget",
  );
  requireValue(
    Number.isSafeInteger(concurrency) && concurrency >= 1 && concurrency <= 4,
    "Invalid fetch concurrency",
  );
  requireValue(
    Number.isSafeInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 120000,
    "Invalid preparation timeout",
  );
  const assets = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  const chunks = new Map(manifest.chunks.map((chunk) => [chunk.id, chunk]));
  let committed = new Map(),
    resident = [],
    committedPosition = null,
    origin = null;
  let state = "idle",
    failure = null,
    generation = 0,
    active = null,
    queue = Promise.resolve(),
    disposed = false,
    reservedBytes = 0;
  const committedBytes = () =>
    [...committed.values()].reduce((sum, bytes) => sum + bytes.byteLength, 0);
  const snapshot = () => ({
    state,
    sourceReady: state === "ready",
    flightReady: false,
    failure,
    position: committedPosition && { ...committedPosition },
    origin: origin && { ...origin },
    chunks: [...resident],
    assetIds: [...committed.keys()].sort(),
    sourceBytes: committedBytes(),
    reservedSourceBytes: reservedBytes,
  });
  function cancellation() {
    generation++;
    active?.abort(abortError());
    active = null;
  }
  async function prepare(point, token, signal) {
    signal.throwIfAborted();
    const plan = planner(point, { resident, maxSourceBytes });
    if (plan.blocked) throw new Error(plan.blocked);
    const nextChunks = [...plan.requiredChunks],
      selected = new Set(
        nextChunks.flatMap((chunkId) => chunks.get(chunkId).assets),
      );
    const retainedBytes = committedBytes();
    const extraBytes = (ids) =>
      [...ids]
        .filter((assetId) => !committed.has(assetId))
        .reduce((sum, assetId) => sum + assets.get(assetId).bytes, 0);
    let additional = extraBytes(selected);
    if (retainedBytes + additional > maxSourceBytes)
      throw new Error("transition-source-budget");
    // Preserve the previous committed window on all failures. Optional prefetch yields
    // to the combined old+new budget; mandatory source data never silently disappears.
    for (const chunkId of plan.targetChunks.filter(
      (chunkId) => !nextChunks.includes(chunkId),
    )) {
      const candidate = new Set([...selected, ...chunks.get(chunkId).assets]);
      const candidateBytes = extraBytes(candidate);
      if (retainedBytes + candidateBytes <= maxSourceBytes) {
        nextChunks.push(chunkId);
        additional = candidateBytes;
        for (const assetId of candidate) selected.add(assetId);
      }
    }
    reservedBytes = retainedBytes + additional;
    const staged = new Map(),
      missing = [...selected].filter((assetId) => !committed.has(assetId));
    let cursor = 0,
      firstFailure = null;
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    try {
      const worker = async () => {
        try {
          while (cursor < missing.length) {
            controller.signal.throwIfAborted();
            const assetId = missing[cursor++],
              asset = assets.get(assetId);
            staged.set(
              assetId,
              await readVerified(
                asset,
                new URL(asset.path, base),
                fetchImpl,
                controller.signal,
                subtle,
              ),
            );
          }
        } catch (error) {
          firstFailure ??= error;
          controller.abort(error);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(concurrency, missing.length) }, worker),
      );
      if (firstFailure) throw firstFailure;
      signal.throwIfAborted();
      if (disposed || token !== generation) throw abortError();
      const next = new Map(
        [...selected].map((assetId) => [
          assetId,
          committed.get(assetId) ?? staged.get(assetId),
        ]),
      );
      committed = next;
      resident = nextChunks;
      committedPosition = { ...point };
      origin = { ...plan.origin };
      state = "ready";
      failure = null;
    } finally {
      signal.removeEventListener("abort", abort);
      staged.clear();
      reservedBytes = committedBytes();
    }
    return snapshot();
  }
  return {
    snapshot,
    transition(point) {
      if (disposed)
        return Promise.reject(new Error("Regional source window is disposed"));
      // Validate before replacing the current request; caller mutation cannot move it.
      const target = { ...point };
      try {
        planner(target, { maxSourceBytes });
      } catch (error) {
        return Promise.reject(error);
      }
      cancellation();
      const token = generation,
        controller = new AbortController();
      active = controller;
      state = "loading";
      failure = null;
      const operation = queue.then(async () => {
        controller.signal.throwIfAborted();
        const timer = setTimeout(
          () =>
            controller.abort(
              new DOMException(
                "Regional preparation timed out",
                "TimeoutError",
              ),
            ),
          timeoutMs,
        );
        try {
          return await prepare(target, token, controller.signal);
        } catch (error) {
          if (token === generation && !disposed) {
            state = "error";
            failure = error.message;
          }
          throw error;
        } finally {
          clearTimeout(timer);
          if (active === controller) active = null;
        }
      });
      queue = operation.catch(() => {});
      return operation;
    },
    copyAsset(assetId) {
      if (disposed) throw new Error("Regional source window is disposed");
      const bytes = committed.get(assetId);
      if (!bytes)
        throw new Error(`Asset is not in the committed window: ${assetId}`);
      return bytes.slice();
    },
    cancel() {
      if (!disposed) {
        cancellation();
        state = "cancelled";
        failure = null;
      }
    },
    async dispose() {
      if (!disposed) {
        disposed = true;
        cancellation();
        state = "disposed";
        committed.clear();
        resident = [];
        committedPosition = null;
        origin = null;
      }
      await queue;
      reservedBytes = 0;
    },
  };
}
