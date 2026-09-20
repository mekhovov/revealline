import {
  loadMapReference,
  validateReferenceCrop,
  inspectManualImageMap,
} from '../content-design/image-authoring.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { paintContentMap } from '../content-design/map-view.mjs';
import {
  readImageTrace,
  imageTraceOwner,
  assertImageTraceOwner,
  decodeImageTraceReference,
} from '../content-design/image-trace.mjs';

/** The image and uncommitted tracing queue never enter project storage or runtime.
 * Independent tracing recovery is local-only and never grants Apply authority.
 * Only an explicitly inspected geometry candidate may cross the Apply boundary. */
export function createImageWorkbench({
  document,
  getSource,
  getMission,
  getDifficulty,
  redraw,
  apply,
  play,
  loadReference = loadMapReference,
  decodeReference = decodeImageTraceReference,
  onChange = () => {},
}) {
  const $ = (id) => document.getElementById(id);
  let reference = null,
    crop = null,
    rows = [],
    inspected = null,
    loading = 0;
  let owner = null,
    observedDraft = null;
  const draftIdentity = () => JSON.stringify([getSource(), getMission()?.id, getDifficulty()]);
  const identity = () => JSON.stringify([draftIdentity(), rows, crop]);
  const changed = () => {
    loading++;
    onChange();
  };
  const message = (text) => {
    $('reference-status').textContent = text;
  };
  function invalidate(text = 'Inspect the queued geometry before previewing or applying.') {
    inspected = null;
    $('reference-apply').disabled = true;
    $('reference-play').disabled = true;
    $('reference-preview').hidden = true;
    message(text);
  }
  function list() {
    $('reference-queue').textContent = rows.length
      ? rows
          .map((row, i) => `${i + 1}. ${row.surface}: (${row.x}, ${row.y}), ${row.w} × ${row.h}`)
          .join('\n')
      : 'No geometry queued. Uploading does not change the map.';
  }
  function dispose() {
    loading++;
    reference?.dispose();
    reference = null;
    crop = null;
    rows = [];
    $('reference-file').value = '';
    $('reference-show').checked = false;
    $('reference-tools').disabled = true;
    list();
    invalidate(
      'No reference loaded. Tracing recovery is separate from project checkpoints and published maps.',
    );
  }
  const guard = (action) => async (event) => {
    try {
      await action(event);
    } catch (error) {
      message(error.message);
    }
  };
  function underlay(ctx, width, height) {
    if (!reference || !crop || !$('reference-show').checked) return;
    ctx.drawImage(reference.image, crop.x, crop.y, crop.w, crop.h, 0, 0, width, height);
  }
  $('reference-file').onchange = guard(async () => {
    const file = $('reference-file').files[0];
    if (!file) return;
    const ticket = ++loading,
      initialOwner = owner;
    invalidate('Inspecting and decoding the local picture…');
    $('reference-tools').disabled = true;
    let next;
    try {
      next = await loadReference(file);
    } catch (error) {
      if (ticket === loading) {
        $('reference-tools').disabled = !reference;
        throw error;
      }
      return;
    }
    if (ticket !== loading || owner !== initialOwner) {
      next.dispose();
      return;
    }
    reference?.dispose();
    reference = next;
    crop = validateReferenceCrop(
      { x: 0, y: 0, w: next.width, h: next.height },
      next.width,
      next.height,
    );
    for (const key of ['x', 'y', 'w', 'h']) $(`crop-${key}`).value = crop[key];
    $('reference-tools').disabled = false;
    $('reference-show').checked = true;
    invalidate(
      `${file.name}: ${next.width} × ${next.height}. Local reference only; the crop stretches to the 2:1 board. No geometry has been inferred.`,
    );
    redraw();
    changed();
  });
  $('reference-crop').onclick = guard(() => {
    if (!reference) throw new Error('Upload a reference picture first.');
    const next = validateReferenceCrop(
      Object.fromEntries(['x', 'y', 'w', 'h'].map((key) => [key, Number($(`crop-${key}`).value)])),
      reference.width,
      reference.height,
    );
    crop = next;
    invalidate('Crop updated. Reinspect before applying geometry. A 2:1 crop avoids stretching.');
    redraw();
    changed();
  });
  for (const key of ['x', 'y', 'w', 'h'])
    $(`crop-${key}`).oninput = () => {
      loading++;
      invalidate('Crop fields changed. Use Preview crop, then inspect the geometry again.');
    };
  $('reference-show').onchange = () => {
    redraw();
    changed();
  };
  $('reference-clear').onclick = () => {
    dispose();
    redraw();
    changed();
  };
  $('reference-queue-add').onclick = guard(() => {
    if (!reference || !getMission())
      throw new Error('Upload a reference and choose a mission first.');
    const surface = $('surface').value;
    if (!['foundations', 'walls', 'slow', 'lethal'].includes(surface))
      throw new Error(
        'Manual tracing queues rectangles. Use the separate spawn editor after applying.',
      );
    const [x, y, w, h] = ['x', 'y', 'w', 'h'].map((key) => Number($(key).value));
    if (
      ![x, y, w, h].every(Number.isInteger) ||
      x < 1 ||
      y < 1 ||
      w < 1 ||
      h < 1 ||
      x + w > 71 ||
      y + h > 35
    )
      throw new Error('Use a whole-cell rectangle inside the outer border.');
    if (rows.length >= 128) throw new Error('The tracing queue supports at most 128 rectangles.');
    rows.push({ surface, x, y, w, h });
    invalidate();
    list();
    changed();
  });
  $('reference-queue-undo').onclick = () => {
    rows.pop();
    invalidate();
    list();
    changed();
  };
  $('reference-inspect').onclick = guard(() => {
    invalidate();
    if (!reference || !getMission())
      throw new Error('Upload a reference and choose a mission first.');
    if (['x', 'y', 'w', 'h'].some((key) => Number($(`crop-${key}`).value) !== crop[key]))
      throw new Error('Preview the edited crop before inspecting geometry.');
    const result = inspectManualImageMap(getSource(), getMission().id, rows);
    const preview = prepareContentPreview(result.candidate, getMission().id, {
      difficulty: getDifficulty(),
      mode: getMission().modes[0],
    });
    const canvas = $('reference-preview');
    const summary = paintContentMap(canvas.getContext('2d'), preview, {
      width: canvas.width,
      underlay,
    });
    canvas.hidden = false;
    inspected = { ...result, before: identity(), missionId: getMission().id };
    $('reference-apply').disabled = false;
    $('reference-play').disabled = !getMission().modes.includes('solo');
    message(
      `Inspected ${rows.length} rectangle(s) across all supported modes and presets. ${preview.geometry.foundationCount} foundation cells; ${preview.geometry.eligibleCount} earnable cells. ${summary} ${result.diagnostics.map((row) => `${row.difficulty}/${row.mode}: ${row.code}`).join('; ')} Frozen spawn inspection only, not a prediction during play. Apply is still required.`,
    );
  });
  function currentInspection() {
    if (!inspected || inspected.before !== identity()) {
      invalidate();
      throw new Error('The draft or tracing selection changed. Inspect again before applying.');
    }
    return inspected;
  }
  $('reference-play').onclick = guard(() => {
    const result = currentInspection();
    return play(result.candidate, result.missionId, getDifficulty());
  });
  $('reference-apply').onclick = guard(() => {
    const result = currentInspection();
    // Compile again at the mutation boundary, not merely at inspection time.
    const fresh = inspectManualImageMap(getSource(), result.missionId, rows);
    if (JSON.stringify(fresh.candidate) !== JSON.stringify(result.candidate))
      throw new Error('The inspected candidate changed. Inspect again.');
    if (!apply(fresh.candidate)) return;
    rows = [];
    list();
    invalidate(
      'Applied as a private map revision. Undo restores the original. Reference pixels remain separate from maps and are never published.',
    );
    changed();
  });
  dispose();
  return {
    snapshot() {
      if (!reference) return null;
      return readImageTrace({
        format: 'ContentImageTraceV1',
        ...imageTraceOwner(getSource(), getMission()?.id),
        reference: reference.source,
        crop,
        rectangles: rows,
        visible: $('reference-show').checked,
      });
    },
    async restore(source) {
      const trace = readImageTrace(source);
      assertImageTraceOwner(trace, getSource(), getMission()?.id);
      const ticket = ++loading,
        initialDraft = draftIdentity();
      const next = await decodeReference(trace);
      if (ticket !== loading || initialDraft !== draftIdentity()) {
        next.dispose();
        throw new Error(
          'The draft or reference changed during restore. Your newer work is intact.',
        );
      }
      reference?.dispose();
      reference = next;
      crop = trace.crop;
      rows = trace.rectangles;
      for (const key of ['x', 'y', 'w', 'h']) $(`crop-${key}`).value = crop[key];
      $('reference-tools').disabled = false;
      $('reference-show').checked = trace.visible;
      list();
      invalidate('Tracing restored. Inspect the proposed geometry again before Play or Apply.');
      redraw();
    },
    underlay: () => (reference && crop && $('reference-show').checked ? underlay : null),
    sync() {
      const nextOwner = JSON.stringify([getSource().id, getMission()?.id]);
      const nextDraft = draftIdentity();
      if (nextOwner !== owner) {
        dispose();
        owner = nextOwner;
      } else if (nextDraft !== observedDraft)
        invalidate(
          rows.length
            ? 'Draft or difficulty changed. Reinspect the queued geometry before applying.'
            : 'Draft or difficulty changed. No geometry is queued; tracing recovery is separate from project checkpoints.',
        );
      observedDraft = nextDraft;
      $('reference-file').disabled = !getMission();
    },
    hasPending: () => rows.length > 0,
    dispose,
  };
}
