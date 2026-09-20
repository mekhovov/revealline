import { boundedJSON, exactKeys, required, dataIdentity } from '../data-json.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { compileContentProject, resolveMission } from './project.mjs';
import { forkMissionMap } from './drafts.mjs';

/** Reference pictures are local authoring aids, not runtime assets or collision data.
 * Check original bytes and headers before asking a browser to allocate pixels. */
export async function loadMapReference(
  file,
  { createImage = () => new Image(), timeoutMs = 10000 } = {},
) {
  required(
    file && ['image/png', 'image/jpeg', 'image/webp'].includes(file.type),
    'Choose a static PNG, JPEG or WebP reference.',
  );
  required(
    Number.isInteger(file.size) && file.size > 0 && file.size <= 4 * 1024 * 1024,
    'Reference pictures must be no larger than 4 MiB.',
  );
  required(
    Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 10000,
    'Invalid reference loading timeout.',
  );
  let timer,
    image,
    closed = false;
  const dispose = () => {
    closed = true;
    if (image) {
      image.onload = null;
      image.onerror = null;
      image.removeAttribute('src');
    }
  };
  try {
    return await Promise.race([
      (async () => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        required(!closed, 'Reference loading expired.');
        required(bytes.length === file.size, 'Reference byte length changed during loading.');
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 8192)
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
        const dataUrl = `data:${file.type};base64,${btoa(binary)}`;
        const header = inspectImageDataUrl(dataUrl);
        required(header.valid, header.errors.join(' '));
        image = createImage();
        await new Promise((resolve, reject) => {
          image.onerror = () => reject(new Error('This reference picture could not decode.'));
          image.onload = async () => {
            try {
              await image.decode?.();
              required(!closed, 'Reference loading expired.');
              required(
                image.naturalWidth === header.width && image.naturalHeight === header.height,
                'Decoded reference dimensions differ from its header.',
              );
              resolve();
            } catch (error) {
              reject(error);
            }
          };
          image.src = dataUrl;
        });
        image.onload = null;
        image.onerror = null;
        return {
          image,
          width: header.width,
          height: header.height,
          source: Object.freeze({
            name:
              typeof file.name === 'string' && file.name.trim()
                ? file.name.slice(0, 160)
                : 'Reference picture',
            dataUrl,
          }),
          dispose,
        };
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Reference loading timed out. Retry another picture.')),
          timeoutMs,
        );
      }),
    ]);
  } catch (error) {
    dispose();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Crop coordinates are original image pixels. No resampling or saved-byte edits. */
export function validateReferenceCrop(source, width, height) {
  const crop = boundedJSON(source, { maxBytes: 512, maxNodes: 8, maxDepth: 1 });
  exactKeys(crop, ['x', 'y', 'w', 'h'], 'reference crop');
  required(
    [width, height].every((n) => Number.isInteger(n) && n > 0 && n <= 8192),
    'Invalid reference dimensions.',
  );
  required(
    Object.values(crop).length === 4 &&
      Object.values(crop).every(Number.isInteger) &&
      crop.x >= 0 &&
      crop.y >= 0 &&
      crop.w > 0 &&
      crop.h > 0 &&
      crop.x + crop.w <= width &&
      crop.y + crop.h <= height,
    'Crop must be a whole-pixel rectangle inside the reference picture.',
  );
  return Object.freeze(crop);
}

/** Manual proposals use board cells, never inferred pixel colors. The same
 * compiler/diagnostics serve Studio, CLI and runtime; no partial apply on failure. */
export function inspectManualImageMap(source, missionId, rectangles) {
  const project = compileContentProject(source).source;
  const mission = project.missions.find((entry) => entry.id === missionId);
  required(mission, 'Choose a mission before tracing a map.');
  const rows = boundedJSON(rectangles, { maxBytes: 16000, maxNodes: 1000, maxArray: 128 });
  required(Array.isArray(rows) && rows.length > 0, 'Queue at least one manual rectangle.');
  const original = project.maps.find(
    (map) => map.id === mission.map.id && map.revision === mission.map.revision,
  );
  const changes = structuredClone({
    foundations: original.foundations ?? [],
    walls: original.walls ?? [],
    terrain: original.terrain ?? [],
  });
  rows.forEach((row, index) => {
    exactKeys(row, ['surface', 'x', 'y', 'w', 'h'], 'manual rectangle');
    required(
      ['foundations', 'walls', 'slow', 'lethal'].includes(row.surface),
      'Select a foundation, wall, slow or lethal surface.',
    );
    const { x, y, w, h } = row;
    if (row.surface === 'slow' || row.surface === 'lethal') {
      let id = `manual-${dataIdentity(row)}-${index}`;
      while (changes.terrain.some((area) => area.id === id)) id += '-r';
      changes.terrain.push({ id, kind: row.surface, x, y, w, h });
    } else changes[row.surface].push({ x, y, w, h });
  });
  const candidate = forkMissionMap(project, missionId, changes);
  const compiled = compileContentProject(candidate);
  const diagnostics = [];
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const mode of mission.modes) {
      const manifest = resolveMission(compiled, missionId, { difficulty, mode });
      diagnostics.push(...manifest.diagnostics.map((row) => ({ ...row, difficulty, mode })));
    }
  required(
    !diagnostics.some((row) => row.severity === 'error'),
    'The proposed map has blocking runtime diagnostics. Revise the queued geometry.',
  );
  return { candidate, diagnostics };
}
