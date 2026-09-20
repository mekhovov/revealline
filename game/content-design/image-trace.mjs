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
  required(trace.format === 'ContentImageTraceV1', 'Expected a ContentImageTraceV1 draft.');
  required(stableId(trace.projectId) && stableId(trace.missionId), 'Invalid tracing owner.');
  required(
    typeof trace.mapIdentity === 'string' && /^[a-f0-9]{16}$/.test(trace.mapIdentity),
    'Invalid tracing map identity.',
  );
  exactKeys(trace.reference, ['name', 'dataUrl'], 'tracing reference');
  required(
    typeof trace.reference.name === 'string' &&
      trace.reference.name.trim().length > 0 &&
      trace.reference.name.length <= 160,
    'Reference name must be nonempty and at most 160 characters.',
  );
  const header = inspectImageDataUrl(trace.reference.dataUrl);
  required(header.valid, header.errors.join(' '));
  required(
    header.byteLength <= 4 * 1024 * 1024,
    'Reference pictures must be no larger than 4 MiB.',
  );
  trace.crop = validateReferenceCrop(trace.crop, header.width, header.height);
  required(typeof trace.visible === 'boolean', 'Reference visibility must be explicit.');
  required(Array.isArray(trace.rectangles), 'Tracing rectangles must be an array.');
  for (const row of trace.rectangles) {
    exactKeys(row, ['surface', 'x', 'y', 'w', 'h'], 'tracing rectangle');
    required(
      ['foundations', 'walls', 'slow', 'lethal'].includes(row.surface) &&
        [row.x, row.y, row.w, row.h].every(Number.isInteger) &&
        row.x >= 1 &&
        row.y >= 1 &&
        row.w >= 1 &&
        row.h >= 1 &&
        row.x + row.w <= 71 &&
        row.y + row.h <= 35,
      'Tracing rectangles must stay inside the board in whole cells.',
    );
  }
  return trace;
}

export async function readImageTraceFile(file, { timeoutMs = 10000 } = {}) {
  required(
    file && Number.isInteger(file.size) && file.size > 0 && file.size <= IMAGE_TRACE_BYTE_LIMIT,
    'Tracing backups must be nonempty and at most 6 MiB.',
  );
  required(
    Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 10000,
    'Invalid tracing read timeout.',
  );
  let timer;
  try {
    const source = await Promise.race([
      file.text(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Tracing backup read timed out. Your draft is unchanged.')),
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
  required(stableId(project?.id) && stableId(missionId), 'Choose a tracing project and mission.');
  const mission = project.missions.find((item) => item.id === missionId);
  const map = project.maps.find(
    (item) => item.id === mission?.map.id && item.revision === mission?.map.revision,
  );
  required(map, 'The tracing mission map is missing.');
  return { projectId: project.id, missionId, mapIdentity: dataIdentity(map) };
}

/** Restore only onto the same exact map. A queued pre-Apply draft must not apply
 * twice after a crash between the map checkpoint and tracing checkpoint. */
export function assertImageTraceOwner(trace, project, missionId) {
  const owner = imageTraceOwner(project, missionId);
  required(
    trace.projectId === owner.projectId && trace.missionId === owner.missionId,
    'This tracing draft belongs to a different project or mission.',
  );
  required(
    trace.mapIdentity === owner.mapIdentity,
    'This tracing draft uses a different map revision. Restore its project checkpoint first.',
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
