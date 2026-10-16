import { validateScenerySurface } from './scenery-surface.mjs';
import {
  validateFrameTransaction,
  adoptVerifiedFrame,
  readFramePose,
  prepareVerifiedFrame,
} from './frame-transaction.mjs';
/** Exact-source scenery preparation coordinator. Detached authoring resources, never live flight. */
import { validateRegionManifest, createRegionPlanner } from './region-manifest.mjs';
import { createRegionSourceWindow } from './source-window.mjs';
import { SCENERY_LIMITS } from './scenery-cell.mjs';
import {
  validateScenerySource,
  scenerySourceCell,
  compileScenerySource,
  scenerySourceResources,
} from './indexed-scenery-cell.mjs';
import { prepareSceneryWindow } from './scenery-admission.mjs';

const fail = (condition, message) => {
  if (!condition) throw new TypeError(message);
};
const abortError = () =>
  new DOMException('Verified scenery preparation was cancelled', 'AbortError');

/**
 * Sources remain private: no caller scenery, loader or preparation function can be substituted.
 * fetchImpl/subtle permit the same transport integration as the existing source window.
 */
export function createVerifiedSceneryWindow(
  input,
  {
    retainCommitted = false,
    baseURL,
    fetchImpl = globalThis.fetch,
    subtle = globalThis.crypto?.subtle,
    maxSourceBytes = 16 * 1024 * 1024,
    concurrency = 2,
    timeoutMs = 120000,
    maxGeometryBytes = 8 * 1024 * 1024,
    surfaceStyle = 'plain',
  } = {},
) {
  validateScenerySurface(surfaceStyle);
  fail(typeof retainCommitted === 'boolean', 'Invalid retained-frame option');
  const manifest = validateRegionManifest(input),
    planner = createRegionPlanner(manifest);
  const assets = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  const chunks = new Map(manifest.chunks.map((chunk) => [chunk.id, chunk]));
  fail(
    Number.isSafeInteger(maxGeometryBytes) &&
      maxGeometryBytes > 0 &&
      maxGeometryBytes <= 8 * 1024 * 1024,
    'Invalid combined scenery geometry allowance',
  );
  fail(
    Number.isSafeInteger(maxSourceBytes) &&
      maxSourceBytes > 0 &&
      maxSourceBytes <= 32 * 1024 * 1024,
    'Invalid scenery source allowance',
  );
  for (const chunk of chunks.values()) {
    const selected = chunk.assets.map((id) => assets.get(id));
    fail(
      selected.length === 2 &&
        selected.filter((asset) => asset.kind === 'scene').length === 1 &&
        selected.filter((asset) => asset.kind === 'collision').length === 1,
      'Scenery-only source profile needs exactly one scene and one collision asset per cell',
    );
    for (const asset of selected)
      fail(
        asset.bytes <=
          (asset.kind === 'collision' ? SCENERY_LIMITS.jsonBytes : SCENERY_LIMITS.sceneBytes),
        'Scenery source asset exceeds decode profile',
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
    state = 'idle',
    failure = null,
    disposed = false;
  let generation = 0,
    queue = Promise.resolve(),
    reservedGeometryBytes = 0;
  const committedBytes = () => committed?.snapshot().resourceBytes ?? 0;
  const queryReady = () =>
    !disposed && Boolean(committed) && (retainCommitted || state === 'ready');
  function snapshot() {
    const transport = source.snapshot();
    return {
      state,
      sceneryReady: queryReady(),
      flightReady: false,
      failure,
      hasRetainedScenery: Boolean(committed),
      geometryBytes: committed?.snapshot().geometryBytes ?? 0,
      textureBytes: committed?.snapshot().textureBytes ?? 0,
      resourceBytes: committedBytes(),
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
      let requiredBytes = 0;
      const ready = await source.transition(point);
      current(token);
      fail(
        ready.sourceReady && required.every((id) => ready.chunks.includes(id)),
        'Required verified sources are missing',
      );
      const cells = [],
        receipts = [];
      for (const chunkId of required) {
        current(token);
        const chunk = chunks.get(chunkId),
          declared = chunk.assets.map((id) => assets.get(id));
        const collision = declared.find((asset) => asset.kind === 'collision'),
          scene = declared.find((asset) => asset.kind === 'scene');
        // Copies are owned by this operation; no asset buffers or cell objects are exposed to callers.
        const collisionBytes = source.copyAsset(collision.id);
        const cellSource = validateScenerySource(
          new TextDecoder('utf-8', { fatal: true }).decode(collisionBytes),
        );
        const cell = scenerySourceCell(cellSource);
        cells.push(cellSource);
        fail(
          cell.chunkId === chunk.id && cell.x === chunk.x && cell.z === chunk.z,
          'Verified collision identity does not match its declared chunk',
        );
        requiredBytes = scenerySourceResources(cells).resourceBytes;
        fail(
          committedBytes() + requiredBytes <= maxGeometryBytes,
          'transition-scenery-geometry-budget',
        );
        reservedGeometryBytes = committedBytes() + requiredBytes;
        const sceneBytes = source.copyAsset(scene.id),
          compiled = compileScenerySource(cellSource);
        fail(
          sceneBytes.length === compiled.glb.length &&
            sceneBytes.every((byte, i) => byte === compiled.glb[i]),
          'Verified scene differs from canonical scenery collision surface',
        );
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
        // Permit cancellation between bounded cell decodes, without publishing partial scenery.
        await Promise.resolve();
      }
      current(token);
      staged = await prepareSceneryWindow(manifest, cells, {
        requiredChunkIds: required,
        originMm: plan.origin,
        maxGeometryBytes: requiredBytes,
        surfaceStyle,
      });
      current(token);
      if (frameTransaction?.prepare)
        await prepareVerifiedFrame(frameTransaction, staged.group, () => current(token));
      supportPose = readFramePose(frameTransaction, supportPose, planner);
      current(token);
      if (supportPose) {
        const { positionMm, radiusMm } = supportPose;
        const support = staged.support({ ...positionMm, y: positionMm.y + radiusMm }, 4000000);
        fail(
          support.status === 'scenery-hit' && positionMm.y >= support.heightMm - 1,
          'Staged scenery cannot support the required body pose',
        );
        fail(
          staged.overlap({ ...positionMm, y: positionMm.y + radiusMm }, Math.max(1, radiusMm - 1))
            .status === 'scenery-clear',
          'Staged scenery intersects the required body pose',
        );
      }
      const nextProvenance = {
        regionId: manifest.id,
        revision: manifest.revision,
        positionMm: { ...point },
        originMm: { ...plan.origin },
        compiler: cells.some((cell) => cell.format === 'FPVRegionIndexedScenery.v1')
          ? 'FPV indexed scenery compiler v1'
          : 'FPV regional scenery compiler v1',
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
      state = 'ready';
      failure = null;
      previous?.dispose();
      return snapshot();
    } catch (error) {
      if (!disposed && token === generation) {
        state = 'error';
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
    transition(positionMm, supportPoseInput = null, frameTransactionInput = null) {
      if (disposed) return Promise.reject(new Error('Verified scenery window is disposed'));
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
              Object.hasOwn(supportPoseInput, 'positionMm') &&
              Object.hasOwn(supportPoseInput, 'radiusMm'),
            'Invalid support pose',
          );
          const p = supportPoseInput.positionMm,
            radiusMm = supportPoseInput.radiusMm;
          fail(
            p &&
              Object.keys(p).length === 3 &&
              ['x', 'y', 'z'].every((key) => Number.isSafeInteger(p[key])) &&
              Number.isSafeInteger(radiusMm) &&
              radiusMm > 0 &&
              radiusMm <= 2000,
            'Invalid support pose',
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
      state = 'loading';
      failure = null;
      const operation = queue.then(() =>
        prepare(point, plan, token, supportPose, frameTransaction),
      );
      queue = operation.catch(() => {});
      return operation;
    },
    flightSupport(...args) {
      if (disposed) throw new Error('Verified geometry is disposed');
      return queryReady() ? committed.flightSupport(...args) : { status: 'not-ready' };
    },
    castMotion(...args) {
      if (disposed) throw new Error('Verified geometry is disposed');
      return queryReady() ? committed.castMotion(...args) : { status: 'not-ready' };
    },
    support(...args) {
      if (disposed) throw new Error('Verified scenery window is disposed');
      return queryReady() ? committed.support(...args) : { status: 'not-ready' };
    },
    overlap(...args) {
      if (disposed) throw new Error('Verified scenery window is disposed');
      return queryReady() ? committed.overlap(...args) : { status: 'not-ready' };
    },
    sweep(...args) {
      if (disposed) throw new Error('Verified scenery window is disposed');
      return queryReady() ? committed.sweep(...args) : { status: 'not-ready' };
    },
    cancel() {
      if (disposed) return;
      invalidate();
      state = 'cancelled';
      failure = null;
    },
    async dispose() {
      if (!disposed) {
        disposed = true;
        invalidate();
        state = 'disposed';
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
