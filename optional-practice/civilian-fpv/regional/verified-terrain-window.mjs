import {
  validateFrameTransaction,
  adoptVerifiedFrame,
  readFramePose,
  prepareVerifiedFrame,
} from "./frame-transaction.mjs";
/** Exact-source terrain preparation coordinator. Detached authoring resources, never live flight. */
import {
  REGION_LIMITS,
  validateRegionManifest,
  createRegionPlanner,
} from "./region-manifest.mjs";
import { createRegionSourceWindow } from "./source-window.mjs";
import { compileTerrainCell, validateTerrainCell } from "./terrain-cell.mjs";
import { prepareTerrainWindow } from "./terrain-admission.mjs";
import { validateTerrainSurface } from "./terrain-surface.mjs";

export const TERRAIN_GEOMETRY_BYTES_PER_CELL =
  1089 * 3 * 4 * 2 + 32 * 32 * 6 * 4;
const fail = (condition, message) => {
  if (!condition) throw new TypeError(message);
};
const abortError = () =>
  new DOMException("Verified terrain preparation was cancelled", "AbortError");

/**
 * Sources remain private: no caller terrain, loader or preparation function can be substituted.
 * fetchImpl/subtle permit the same transport integration as the existing source window.
 */
export function createVerifiedTerrainWindow(
  input,
  {
    retainCommitted = false,
    baseURL,
    fetchImpl = globalThis.fetch,
    subtle = globalThis.crypto?.subtle,
    maxSourceBytes = REGION_LIMITS.residentSourceBytes,
    concurrency = 2,
    timeoutMs = 120000,
    maxGeometryBytes = 2 * 1024 * 1024,
    surfaceStyle = "plain",
    surfaceQuality = "balanced",
  } = {},
) {
  fail(typeof retainCommitted === "boolean", "Invalid retained-frame option");
  const manifest = validateRegionManifest(input),
    planner = createRegionPlanner(manifest);
  validateTerrainSurface(surfaceStyle, surfaceQuality);
  const assets = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  const chunks = new Map(manifest.chunks.map((chunk) => [chunk.id, chunk]));
  fail(
    Number.isSafeInteger(maxGeometryBytes) &&
      maxGeometryBytes > 0 &&
      maxGeometryBytes <= 2 * 1024 * 1024,
    "Invalid combined terrain geometry allowance",
  );
  for (const chunk of chunks.values()) {
    const selected = chunk.assets.map((id) => assets.get(id));
    fail(
      selected.length === 2 &&
        selected.filter((asset) => asset.kind === "scene").length === 1 &&
        selected.filter((asset) => asset.kind === "collision").length === 1,
      "Terrain-only source profile needs exactly one scene and one collision asset per cell",
    );
    for (const asset of selected)
      fail(
        asset.bytes <= (asset.kind === "collision" ? 16384 : 65536),
        "Terrain source asset exceeds decode profile",
      );
  }
  const source = createRegionSourceWindow(manifest, {
    baseURL,
    fetchImpl,
    subtle,
    maxSourceBytes,
    concurrency,
    timeoutMs,
  });
  const base = new URL(baseURL);
  let committed = null,
    provenance = null,
    state = "idle",
    failure = null,
    disposed = false;
  let generation = 0,
    queue = Promise.resolve(),
    reservedGeometryBytes = 0;
  const committedBytes = () => committed?.snapshot().geometryBytes ?? 0;
  const queryReady = () =>
    !disposed && Boolean(committed) && (retainCommitted || state === "ready");
  function snapshot() {
    const transport = source.snapshot();
    return {
      state,
      terrainReady: queryReady(),
      flightReady: false,
      failure,
      hasRetainedTerrain: Boolean(committed),
      geometryBytes: committedBytes(),
      reservedGeometryBytes,
      sourceBytes: transport.sourceBytes,
      reservedSourceBytes: transport.reservedSourceBytes,
      provenance: provenance && structuredClone(provenance),
    };
  }
  function current(token) {
    if (disposed || token !== generation) throw abortError();
  }
  function invalidate() {
    generation++;
    source.cancel();
  }
  async function prepare(point, plan, token, supportPose, frameTransaction) {
    let staged = null;
    try {
      current(token);
      const required = plan.requiredChunks;
      const requiredBytes = required.length * TERRAIN_GEOMETRY_BYTES_PER_CELL;
      fail(
        committedBytes() + requiredBytes <= maxGeometryBytes,
        "transition-terrain-geometry-budget",
      );
      reservedGeometryBytes = committedBytes() + requiredBytes;
      const ready = await source.transition(point);
      current(token);
      fail(
        ready.sourceReady && required.every((id) => ready.chunks.includes(id)),
        "Required verified sources are missing",
      );
      const cells = [],
        receipts = [];
      for (const chunkId of required) {
        current(token);
        const chunk = chunks.get(chunkId),
          declared = chunk.assets.map((id) => assets.get(id));
        const collision = declared.find((asset) => asset.kind === "collision"),
          scene = declared.find((asset) => asset.kind === "scene");
        // Copies are owned by this operation; no asset buffers or cell objects are exposed to callers.
        const collisionBytes = source.copyAsset(collision.id);
        const cell = validateTerrainCell(
          new TextDecoder("utf-8", { fatal: true }).decode(collisionBytes),
        );
        fail(
          cell.chunkId === chunk.id && cell.x === chunk.x && cell.z === chunk.z,
          "Verified collision identity does not match its declared chunk",
        );
        const sceneBytes = source.copyAsset(scene.id),
          compiled = compileTerrainCell(cell);
        fail(
          sceneBytes.length === compiled.glb.length &&
            sceneBytes.every((byte, i) => byte === compiled.glb[i]),
          "Verified scene differs from canonical terrain collision surface",
        );
        cells.push(cell);
        receipts.push({
          chunkId,
          collision: {
            id: collision.id,
            url: new URL(collision.path, base).href,
            bytes: collision.bytes,
            sha256: collision.sha256,
          },
          scene: {
            id: scene.id,
            url: new URL(scene.path, base).href,
            bytes: scene.bytes,
            sha256: scene.sha256,
          },
        });
        // Permit cancellation between bounded cell decodes, without publishing partial terrain.
        await Promise.resolve();
      }
      current(token);
      staged = await prepareTerrainWindow(manifest, cells, {
        requiredChunkIds: required,
        originMm: plan.origin,
        maxGeometryBytes: requiredBytes,
        surfaceStyle,
        surfaceQuality,
      });
      current(token);
      if (frameTransaction?.prepare)
        await prepareVerifiedFrame(frameTransaction, staged.group, () =>
          current(token),
        );
      supportPose = readFramePose(frameTransaction, supportPose, planner);
      current(token);
      if (supportPose) {
        const { positionMm, radiusMm } = supportPose;
        const support = staged.support(
          { ...positionMm, y: positionMm.y + radiusMm },
          4000000,
        );
        fail(
          support.status === "terrain-hit" &&
            positionMm.y >= support.heightMm - 1,
          "Staged terrain cannot support the required body pose",
        );
      }
      const nextProvenance = {
        regionId: manifest.id,
        revision: manifest.revision,
        positionMm: { ...point },
        originMm: { ...plan.origin },
        compiler: "FPV regional terrain compiler v1",
        chunks: receipts,
      };
      adoptVerifiedFrame(
        frameTransaction,
        { group: staged.group, provenance: structuredClone(nextProvenance) },
        () => current(token),
      );
      // No await or caller callback between host frame adoption and owner publication.
      const previous = committed;
      committed = staged;
      staged = null;
      provenance = nextProvenance;
      reservedGeometryBytes = committedBytes();
      state = "ready";
      failure = null;
      previous?.dispose();
      return snapshot();
    } catch (error) {
      if (!disposed && token === generation) {
        state = "error";
        failure = error.message;
      }
      throw error;
    } finally {
      staged?.dispose();
      reservedGeometryBytes = committedBytes();
    }
  }
  return Object.freeze({
    snapshot,
    get group() {
      return committed?.group ?? null;
    },
    transition(
      positionMm,
      supportPoseInput = null,
      frameTransactionInput = null,
    ) {
      if (disposed)
        return Promise.reject(new Error("Verified terrain window is disposed"));
      const point = { ...positionMm };
      let plan,
        frameTransaction,
        supportPose = null;
      try {
        frameTransaction = validateFrameTransaction(frameTransactionInput);
        if (supportPoseInput !== null) {
          fail(
            supportPoseInput &&
              Object.keys(supportPoseInput).length === 2 &&
              Object.hasOwn(supportPoseInput, "positionMm") &&
              Object.hasOwn(supportPoseInput, "radiusMm"),
            "Invalid support pose",
          );
          const p = supportPoseInput.positionMm,
            radiusMm = supportPoseInput.radiusMm;
          fail(
            p &&
              Object.keys(p).length === 3 &&
              ["x", "y", "z"].every((key) => Number.isSafeInteger(p[key])) &&
              Number.isSafeInteger(radiusMm) &&
              radiusMm > 0 &&
              radiusMm <= 2000,
            "Invalid support pose",
          );
          planner(p);
          supportPose = { positionMm: { ...p }, radiusMm };
        }
        plan = planner(point, { maxSourceBytes });
        if (plan.blocked) throw new Error(plan.blocked);
      } catch (error) {
        return Promise.reject(error);
      }
      invalidate();
      const token = generation;
      state = "loading";
      failure = null;
      const operation = queue.then(() =>
        prepare(point, plan, token, supportPose, frameTransaction),
      );
      queue = operation.catch(() => {});
      return operation;
    },
    flightSupport(...args) {
      if (disposed) throw new Error("Verified geometry is disposed");
      return queryReady()
        ? committed.flightSupport(...args)
        : { status: "not-ready" };
    },
    castMotion(...args) {
      if (disposed) throw new Error("Verified geometry is disposed");
      return queryReady()
        ? committed.castMotion(...args)
        : { status: "not-ready" };
    },
    support(...args) {
      if (disposed) throw new Error("Verified terrain window is disposed");
      return queryReady()
        ? committed.support(...args)
        : { status: "not-ready" };
    },
    sweep(...args) {
      if (disposed) throw new Error("Verified terrain window is disposed");
      return queryReady() ? committed.sweep(...args) : { status: "not-ready" };
    },
    cancel() {
      if (disposed) return;
      invalidate();
      state = "cancelled";
      failure = null;
    },
    async dispose() {
      if (!disposed) {
        disposed = true;
        invalidate();
        state = "disposed";
        failure = null;
        committed?.dispose();
        committed = null;
        provenance = null;
      }
      await queue;
      await source.dispose();
      reservedGeometryBytes = 0;
    },
  });
}
