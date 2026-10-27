import { requireRestoreClearance } from './restore-containment.mjs';
import { regionalCollisionCounts } from './region-motion-query.mjs';
import { earlierFlightHit } from "../flight-contact.mjs";
/** Atomic terrain/scenery composition for unscored authoring, never World.v1. */
import { Group } from "../vendor/three.module.js";
import {
  validateRegionManifest,
  REGION_FORMAT,
  createRegionPlanner,
} from "./region-manifest.mjs";
import {
  createVerifiedTerrainWindow,
  TERRAIN_GEOMETRY_BYTES_PER_CELL,
} from "./verified-terrain-window.mjs";
import { createVerifiedSceneryWindow } from "./verified-scenery-window.mjs";
import {
  validateFrameTransaction,
  adoptVerifiedFrame,
  readFramePose,
  prepareVerifiedFrame,
  verifiedCollisionFrame,
} from "./frame-transaction.mjs";

const MiB = 1024 * 1024;
const fail = (condition, message) => {
  if (!condition) throw new TypeError(message);
};
const cancelled = () =>
  new DOMException("Mixed region preparation cancelled", "AbortError");
const pointCopy = (point) => ({ x: point.x, y: point.y, z: point.z });
const sum = (pair, field) =>
  pair ? (pair.terrain.snapshot()[field] ?? 0) + (pair.scenery.snapshot()[field] ?? 0) : 0;
const residentBytes = (pair) => sum(pair, "geometryBytes") + sum(pair, "textureBytes");
function supportPair(pair, ...args) {
  const terrain = pair.terrain.support(...args),
    scenery = pair.scenery.support(...args);
  if (
    !["terrain-hit", "no-support"].includes(terrain.status) ||
    !["scenery-hit", "no-support"].includes(scenery.status)
  )
    return { status: "unknown-cell" };
  if (terrain.status === "no-support" && scenery.status === "no-support")
    return { status: "no-support" };
  return scenery.status === "scenery-hit" &&
    (terrain.status === "no-support" || scenery.heightMm > terrain.heightMm)
    ? { ...scenery, status: "terrain-hit", layer: "scenery" }
    : { ...terrain, layer: "terrain" };
}
function sweepPair(pair, ...args) {
  const terrain = pair.terrain.sweep(...args),
    scenery = pair.scenery.sweep(...args);
  if (
    !["terrain-hit", "terrain-clear"].includes(terrain.status) ||
    !["scenery-hit", "scenery-clear"].includes(scenery.status)
  )
    return { status: "unknown-cell" };
  if (terrain.status === "terrain-clear" && scenery.status === "scenery-clear")
    return { status: "terrain-clear" };
  return scenery.status === "scenery-hit" &&
    (terrain.status === "terrain-clear" || scenery.fraction < terrain.fraction)
    ? { ...scenery, status: "terrain-hit", layer: "scenery" }
    : { ...terrain, layer: "terrain" };
}
async function disposePair(pair) {
  if (!pair) return;
  pair.terrain?.cancel();
  pair.scenery?.cancel();
  pair.group.clear();
  pair.group.removeFromParent();
  await Promise.all([pair.terrain?.dispose(), pair.scenery?.dispose()]);
}

export function createVerifiedMixedWindow(
  terrainInput,
  {
    source,
    scenery,
    retainCommitted = false,
    maxSourceBytes = 32 * MiB,
    maxGeometryBytes = 10 * MiB,
  } = {},
) {
  fail(typeof retainCommitted === "boolean", "Invalid retained-frame option");
  const terrainManifest = validateRegionManifest(terrainInput),
    sceneryManifest = validateRegionManifest(scenery?.manifest);
  fail(terrainManifest.format === REGION_FORMAT, 'Mixed terrain needs the complete terrain profile');
  fail(
    terrainManifest.id === sceneryManifest.id &&
      terrainManifest.revision === sceneryManifest.revision,
    "Mixed layers need the same region identity and revision",
  );
  fail(
    Object.keys(terrainManifest.grid).every(
      (key) => terrainManifest.grid[key] === sceneryManifest.grid[key],
    ),
    "Mixed layer grids disagree",
  );
  const sceneryChunks = new Map(
    sceneryManifest.chunks.map((chunk) => [chunk.id, chunk]),
  );
  fail(
    terrainManifest.chunks.every(
      (chunk) =>
        sceneryChunks.get(chunk.id)?.x === chunk.x &&
        sceneryChunks.get(chunk.id)?.z === chunk.z,
    ),
    "Mixed layer cell identities disagree",
  );
  const scenerySpawns = new Map(
    sceneryManifest.spawns.map((spawn) => [spawn.id, spawn.position]),
  );
  fail(
    terrainManifest.spawns.length === sceneryManifest.spawns.length &&
      terrainManifest.spawns.every((spawn) =>
        ["x", "y", "z"].every(
          (axis) =>
            scenerySpawns.get(spawn.id)?.[axis] === spawn.position[axis],
        ),
      ),
    "Mixed layer spawns disagree",
  );
  fail(
    Number.isSafeInteger(maxSourceBytes) &&
      maxSourceBytes > 0 &&
      maxSourceBytes <= 32 * MiB,
    "Invalid combined source allowance",
  );
  fail(
    Number.isSafeInteger(maxGeometryBytes) &&
      maxGeometryBytes > 0 &&
      maxGeometryBytes <= 10 * MiB,
    "Invalid combined geometry allowance",
  );
  const terrainPlan = createRegionPlanner(terrainManifest),
    sceneryPlan = createRegionPlanner(sceneryManifest);
  const assetBytes = (manifest) => {
    const assets = new Map(
      manifest.assets.map((asset) => [asset.id, asset.bytes]),
    );
    return new Map(
      manifest.chunks.map((chunk) => [
        chunk.id,
        chunk.assets.reduce((n, id) => n + assets.get(id), 0),
      ]),
    );
  };
  const terrainBytes = assetBytes(terrainManifest),
    sceneryBytes = assetBytes(sceneryManifest);
  let committed = null,
    staging = null,
    provenance = null,
    state = "idle",
    failure = null,
    disposed = false,
    generation = 0,
    queue = Promise.resolve(),
    reservedSourceBytes = 0,
    reservedGeometryBytes = 0;
  const queryReady = () =>
    !disposed && Boolean(committed) && (retainCommitted || state === "ready");
  const snapshot = () => ({
    state,
    terrainReady: queryReady(),
    flightReady: false,
    hasRetainedTerrain: Boolean(committed),
    geometryProfile: "terrain-scenery-v1",
    geometryBytes: sum(committed, "geometryBytes"),
    textureBytes: sum(committed, "textureBytes"),
    resourceBytes: residentBytes(committed),
    sourceBytes: sum(committed, "sourceBytes"),
    reservedSourceBytes,
    reservedGeometryBytes,
    provenance: provenance && structuredClone(provenance),
    failure,
  });
  const current = (token) => {
    if (disposed || token !== generation) throw cancelled();
  };
  function invalidate() {
    generation++;
    staging?.terrain?.cancel();
    staging?.scenery?.cancel();
  }
  async function prepare(point, plan, token, supportPose, transaction) {
    let pair = null;
    try {
      current(token);
      const ids = plan.requiredChunks,
        terrainSource = ids.reduce((n, id) => n + terrainBytes.get(id), 0),
        scenerySource = ids.reduce((n, id) => n + sceneryBytes.get(id), 0),
        terrainGeometry = ids.length * TERRAIN_GEOMETRY_BYTES_PER_CELL;
      fail(
        sum(committed, "sourceBytes") + terrainSource + scenerySource <=
          maxSourceBytes,
        "mixed-transition-source-budget",
      );
      const sceneryGeometry = Math.min(
        8 * MiB,
        maxGeometryBytes - residentBytes(committed) - terrainGeometry,
      );
      fail(sceneryGeometry > 0, "mixed-transition-geometry-budget");
      reservedSourceBytes =
        sum(committed, "sourceBytes") + terrainSource + scenerySource;
      reservedGeometryBytes =
        residentBytes(committed) + terrainGeometry + sceneryGeometry;
      pair = { terrain: null, scenery: null, group: new Group() };
      staging = pair;
      // Fresh private owners cannot replace either visible committed layer on their own.
      // Exact required-source allowances also prevent optional prefetch from escaping the pair budget.
      pair.terrain = createVerifiedTerrainWindow(terrainManifest, {
        ...source,
        maxSourceBytes: terrainSource,
        maxGeometryBytes: terrainGeometry,
      });
      pair.scenery = createVerifiedSceneryWindow(sceneryManifest, {
        ...scenery.source,
        maxSourceBytes: scenerySource,
        maxGeometryBytes: sceneryGeometry,
      });
      const preparations = [
        pair.terrain.transition(point),
        pair.scenery.transition(point),
      ];
      try {
        await Promise.all(preparations);
      } catch (error) {
        pair.terrain.cancel();
        pair.scenery.cancel();
        await Promise.allSettled(preparations);
        throw error;
      }
      current(token);
      const terrain = pair.terrain.snapshot(),
        buildings = pair.scenery.snapshot();
      fail(
        terrain.terrainReady && buildings.sceneryReady,
        "Mixed layers are not both ready",
      );
      fail(
        ["x", "y", "z"].every(
          (axis) =>
            terrain.provenance.originMm[axis] ===
            buildings.provenance.originMm[axis],
        ),
        "Mixed local origins disagree",
      );
      if (supportPose?.requireClearRestore) await pair.scenery.prepareRestoreProof(() => current(token), supportPose.positionMm, supportPose.radiusMm);
      current(token);
      pair.group.add(pair.terrain.group, pair.scenery.group);
      const buildingReceipts = new Map(
        buildings.provenance.chunks.map((chunk) => [chunk.chunkId, chunk]),
      );
      const nextProvenance = {
        regionId: terrainManifest.id,
        revision: terrainManifest.revision,
        positionMm: pointCopy(point),
        originMm: { ...plan.origin },
        compiler: "FPV regional mixed owner v1",
        chunks: terrain.provenance.chunks.map((chunk) => ({
          chunkId: chunk.chunkId,
          terrain: chunk,
          scenery: buildingReceipts.get(chunk.chunkId),
        })),
      };
      if (transaction?.prepare)
        await prepareVerifiedFrame(transaction, pair.group, () => current(token), () => {
          current(token);
          return verifiedCollisionFrame(nextProvenance, [
            ...pair.terrain.collisionFrame().colliders,
            ...pair.scenery.collisionFrame().colliders,
          ]);
        });
      supportPose = readFramePose(transaction, supportPose, terrainPlan);
      current(token);
      if (supportPose) {
        const { positionMm, radiusMm } = supportPose,
          center = { ...positionMm, y: positionMm.y + radiusMm };
        const support = supportPair(pair, center, 4000000);
        fail(
          support.status === "terrain-hit" &&
            positionMm.y >= support.heightMm - 1,
          "Mixed geometry cannot support required body pose",
        );
        fail(
          pair.scenery.overlap(center, Math.max(1, radiusMm - 1)).status ===
            "scenery-clear",
          "Mixed scenery intersects required body pose",
        );
      }
      if (supportPose?.requireClearRestore) {
        const { positionMm, radiusMm } = supportPose;
        requireRestoreClearance(pair.scenery.restoreClearance({ ...positionMm, y: positionMm.y + radiusMm }, radiusMm));
      }
      adoptVerifiedFrame(
        transaction,
        { group: pair.group, provenance: structuredClone(nextProvenance) },
        () => current(token),
      );
      const previous = committed;
      committed = pair;
      pair = null;
      staging = null;
      provenance = nextProvenance;
      state = "ready";
      failure = null;
      // Disposal starts synchronously, removing prior visible resources before any await.
      await disposePair(previous);
      current(token);
      return snapshot();
    } catch (error) {
      if (!disposed && token === generation) {
        state = "error";
        failure = error.message;
      }
      throw error;
    } finally {
      await disposePair(pair);
      if (staging === pair) staging = null;
      reservedSourceBytes = sum(committed, "sourceBytes");
      reservedGeometryBytes = residentBytes(committed);
    }
  }
  return Object.freeze({
    snapshot,
    collisionFrame() {
      fail(queryReady(), 'Verified collision geometry is unavailable');
      return verifiedCollisionFrame(provenance, [
        ...committed.terrain.collisionFrame().colliders,
        ...committed.scenery.collisionFrame().colliders,
      ]);
    },
    collisionSnapshot: () =>
      regionalCollisionCounts(
        committed?.terrain,
        committed?.scenery,
        staging === committed ? null : staging?.terrain,
        staging === committed ? null : staging?.scenery,
      ),
    get group() {
      return committed?.group ?? null;
    },
    transition(
      positionMm,
      supportPoseInput = null,
      frameTransactionInput = null,
    ) {
      if (disposed)
        return Promise.reject(new Error("Mixed window is disposed"));
      let point,
        plan,
        supportPose = null,
        transaction;
      try {
        point = pointCopy(positionMm);
        plan = terrainPlan(point);
        sceneryPlan(point);
        transaction = validateFrameTransaction(frameTransactionInput);
        if (supportPoseInput !== null) {
          fail(
            supportPoseInput &&
              Object.keys(supportPoseInput).length === (supportPoseInput.requireClearRestore === true ? 3 : 2) &&
              Object.hasOwn(supportPoseInput, "positionMm") &&
              Object.hasOwn(supportPoseInput, "radiusMm"),
            "Invalid mixed support pose",
          );
          const p = supportPoseInput.positionMm,
            radiusMm = supportPoseInput.radiusMm;
          fail(
            p &&
              Object.keys(p).length === 3 &&
              ["x", "y", "z"].every((axis) => Number.isFinite(p[axis])) &&
              Number.isSafeInteger(radiusMm) &&
              radiusMm > 0 &&
              radiusMm <= 2000,
            "Invalid mixed support pose",
          );
          terrainPlan(p);
          supportPose = { positionMm: pointCopy(p), radiusMm, ...(supportPoseInput.requireClearRestore === true ? { requireClearRestore: true } : {}) };
        }
      } catch (error) {
        return Promise.reject(error);
      }
      invalidate();
      const token = generation;
      state = "loading";
      failure = null;
      const operation = queue.then(() =>
        prepare(point, plan, token, supportPose, transaction),
      );
      queue = operation.catch(() => {});
      return operation;
    },
    flightSupport(...args) {
      if (disposed) throw new Error("Mixed window is disposed");
      if (!queryReady()) return { status: "not-ready" };
      const terrain = committed.terrain.flightSupport(...args),
        scenery = committed.scenery.flightSupport(...args);
      if (
        ![terrain, scenery].every(
          (result) => result.status === "flight-support",
        )
      )
        return { status: "unknown-cell" };
      return scenery.hitDistanceMm !== null &&
        (terrain.hitDistanceMm === null ||
          scenery.hitDistanceMm < terrain.hitDistanceMm)
        ? scenery
        : terrain;
    },
    motionCoverage(...args) {
      if (disposed) throw new Error("Mixed window is disposed");
      if (!queryReady()) return { status: "not-ready" };
      const terrain = committed.terrain.motionCoverage(...args),
        scenery = committed.scenery.motionCoverage(...args);
      return [terrain, scenery].every((result) => result.status === "motion-covered")
        ? { status: "motion-covered" }
        : { status: "unknown-cell" };
    },
    castMotion(...args) {
      if (disposed) throw new Error("Mixed window is disposed");
      if (!queryReady()) return { status: "not-ready" };
      const terrain = committed.terrain.castMotion(...args),
        scenery = committed.scenery.castMotion(...args);
      if (
        ![terrain, scenery].every((result) =>
          ["motion-hit", "motion-clear"].includes(result.status),
        )
      )
        return { status: "unknown-cell" };
      const hit = earlierFlightHit(terrain.hit, scenery.hit);
      return hit ? { status: "motion-hit", hit } : { status: "motion-clear" };
    },
    support(...args) {
      if (disposed) throw new Error("Mixed window is disposed");
      return queryReady()
        ? supportPair(committed, ...args)
        : { status: "not-ready" };
    },
    sweep(...args) {
      if (disposed) throw new Error("Mixed window is disposed");
      return queryReady()
        ? sweepPair(committed, ...args)
        : { status: "not-ready" };
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
        const old = committed;
        committed = null;
        provenance = null;
        await disposePair(old);
      }
      await queue;
      reservedSourceBytes = 0;
      reservedGeometryBytes = 0;
    },
  });
}
