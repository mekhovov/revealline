import { requireAuthoring, describeAuthoringError } from './authoring-error.mjs';
import { boundedJSON, dataIdentity, exactKeys, required, stableId } from '../data-json.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { validateReferenceCrop, loadMapReference } from './image-authoring.mjs';

export const IMAGE_TRACE_BYTE_LIMIT = 6 * 1024 * 1024;

/** Tracing is an unpublished authoring draft, never a map or asset revision.
 * Keep the original embedded bytes, not an executable URL or inferred collision. */
export function readImageTrace(source) {
  const trace = boundedJSON(source, {
    maxBytes: IMAGE_TRACE_BYTE_LIMIT,
    maxString: IMAGE_TRACE_BYTE_LIMIT,
    maxNodes: 1200,
    maxDepth: 5,
    maxArray: 128,
  });
  exactKeys(
    trace,
    [
      'format',
      'projectId',
      'missionId',
      'mapIdentity',
      'reference',
      'crop',
      'rectangles',
      'visible',
    ],
    'image trace',
  );
  requireAuthoring(
    trace.format === 'ContentImageTraceV1',
    'Expected a ContentImageTraceV1 draft.',
    'errors:studio.trace.format',
  );
  requireAuthoring(
    stableId(trace.projectId) && stableId(trace.missionId),
    'Invalid tracing owner.',
    'errors:studio.trace.owner',
  );
  requireAuthoring(
    typeof trace.mapIdentity === 'string' && /^[a-f0-9]{16}$/.test(trace.mapIdentity),
    'Invalid tracing map identity.',
    'errors:studio.trace.mapIdentity',
  );
  exactKeys(trace.reference, ['name', 'dataUrl'], 'tracing reference');
  requireAuthoring(
    typeof trace.reference.name === 'string' &&
      trace.reference.name.trim().length > 0 &&
      trace.reference.name.length <= 160,
    'Reference name must be nonempty and at most 160 characters.',
    'errors:studio.trace.referenceName',
  );
  const header = inspectImageDataUrl(trace.reference.dataUrl);
  required(header.valid, header.errors.join(' '));
  requireAuthoring(
    header.byteLength <= 4 * 1024 * 1024,
    'Reference pictures must be no larger than 4 MiB.',
    'errors:studio.image.size',
  );
  trace.crop = validateReferenceCrop(trace.crop, header.width, header.height);
  requireAuthoring(
    typeof trace.visible === 'boolean',
    'Reference visibility must be explicit.',
    'errors:studio.trace.visibility',
  );
  requireAuthoring(
    Array.isArray(trace.rectangles),
    'Tracing rectangles must be an array.',
    'errors:studio.trace.rectangles',
  );
  for (const row of trace.rectangles) {
    exactKeys(row, ['surface', 'x', 'y', 'w', 'h'], 'tracing rectangle');
    requireAuthoring(
      ['foundations', 'walls', 'slow', 'lethal'].includes(row.surface) &&
        [row.x, row.y, row.w, row.h].every(Number.isInteger) &&
        row.x >= 1 &&
        row.y >= 1 &&
        row.w >= 1 &&
        row.h >= 1 &&
        row.x + row.w <= 71 &&
        row.y + row.h <= 35,
      'Tracing rectangles must stay inside the board in whole cells.',
      'errors:studio.trace.rectangleBounds',
    );
  }
  return trace;
}

export async function readImageTraceFile(file, { timeoutMs = 10000 } = {}) {
  requireAuthoring(
    file && Number.isInteger(file.size) && file.size > 0 && file.size <= IMAGE_TRACE_BYTE_LIMIT,
    'Tracing backups must be nonempty and at most 6 MiB.',
    'errors:studio.trace.backupSize',
  );
  requireAuthoring(
    Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 10000,
    'Invalid tracing read timeout.',
    'errors:studio.trace.readTimeoutValue',
  );
  let timer;
  try {
    const source = await Promise.race([
      file.text(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              describeAuthoringError(
                new Error('Tracing backup read timed out. Your draft is unchanged.'),
                'errors:studio.trace.readTimeout',
              ),
            ),
          timeoutMs,
        );
      }),
    ]);
    return readImageTrace(source);
  } finally {
    clearTimeout(timer);
  }
}

export function imageTraceOwner(project, missionId) {
  requireAuthoring(
    stableId(project?.id) && stableId(missionId),
    'Choose a tracing project and mission.',
    'errors:studio.trace.chooseOwner',
  );
  const mission = project.missions.find((item) => item.id === missionId);
  const map = project.maps.find(
    (item) => item.id === mission?.map.id && item.revision === mission?.map.revision,
  );
  requireAuthoring(map, 'The tracing mission map is missing.', 'errors:studio.trace.missingMap');
  return { projectId: project.id, missionId, mapIdentity: dataIdentity(map) };
}

/** Restore only onto the same exact map. A queued pre-Apply draft must not apply
 * twice after a crash between the map checkpoint and tracing checkpoint. */
export function assertImageTraceOwner(trace, project, missionId) {
  const owner = imageTraceOwner(project, missionId);
  requireAuthoring(
    trace.projectId === owner.projectId && trace.missionId === owner.missionId,
    'This tracing draft belongs to a different project or mission.',
    'errors:studio.trace.differentOwner',
  );
  requireAuthoring(
    trace.mapIdentity === owner.mapIdentity,
    'This tracing draft uses a different map revision. Restore its project checkpoint first.',
    'errors:studio.trace.differentRevision',
  );
  return owner;
}

export async function decodeImageTraceReference(trace, options) {
  const header = inspectImageDataUrl(trace.reference.dataUrl);
  required(header.valid, header.errors.join(' '));
  const binary = atob(trace.reference.dataUrl.split(',')[1]);
  return loadMapReference(
    {
      name: trace.reference.name,
      type: header.mime,
      size: header.byteLength,
      arrayBuffer: async () => Uint8Array.from(binary, (value) => value.charCodeAt(0)),
    },
    options,
  );
}
