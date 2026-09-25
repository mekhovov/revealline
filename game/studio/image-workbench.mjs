import { localizedMessage, localizedText, t } from '../i18n/index.mjs';
import { editorMessageError, editorErrorText } from './editor-copy.mjs';
import { studioSurfaceName } from './preview-copy.mjs';
import { studioDifficultyName } from './difficulty-view.mjs';
import { studioModeName } from './inspection-copy.mjs';
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
    localizedText($('reference-status'), text);
  };
  function invalidate(text = localizedMessage('tools:studio.image.inspectFirst')) {
    inspected = null;
    $('reference-apply').disabled = true;
    $('reference-play').disabled = true;
    $('reference-preview').hidden = true;
    message(text);
  }
  function list() {
    const queued = rows.map((row) => ({ ...row }));
    localizedText($('reference-queue'), () =>
      queued.length
        ? queued
            .map((row, index) =>
              t('tools:studio.image.queueRow', {
                index: index + 1,
                surface: studioSurfaceName(row.surface),
                x: row.x,
                y: row.y,
                width: row.w,
                height: row.h,
              }),
            )
            .join('\n')
        : t('tools:studio.image.emptyQueue'),
    );
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
    invalidate(localizedMessage('tools:studio.image.noReference'));
  }
  const guard = (action) => async (event) => {
    try {
      await action(event);
    } catch (error) {
      message(() => editorErrorText(error));
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
    invalidate(localizedMessage('tools:studio.image.loading'));
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
      localizedMessage('tools:studio.image.loaded', {
        name: file.name,
        width: next.width,
        height: next.height,
      }),
    );
    redraw();
    changed();
  });
  $('reference-crop').onclick = guard(() => {
    if (!reference) throw editorMessageError('errors:studio.image.uploadFirst');
    const next = validateReferenceCrop(
      Object.fromEntries(['x', 'y', 'w', 'h'].map((key) => [key, Number($(`crop-${key}`).value)])),
      reference.width,
      reference.height,
    );
    crop = next;
    invalidate(localizedMessage('tools:studio.image.cropUpdated'));
    redraw();
    changed();
  });
  for (const key of ['x', 'y', 'w', 'h'])
    $(`crop-${key}`).oninput = () => {
      loading++;
      invalidate(localizedMessage('tools:studio.image.cropChanged'));
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
    if (!reference || !getMission()) throw editorMessageError('errors:studio.image.chooseMission');
    const surface = $('surface').value;
    if (!['foundations', 'walls', 'slow', 'lethal'].includes(surface))
      throw editorMessageError('errors:studio.image.rectanglesOnly');
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
      throw editorMessageError('errors:studio.image.insideBorder');
    if (rows.length >= 128) throw editorMessageError('errors:studio.image.queueLimit');
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
    if (!reference || !getMission()) throw editorMessageError('errors:studio.image.chooseMission');
    if (['x', 'y', 'w', 'h'].some((key) => Number($(`crop-${key}`).value) !== crop[key]))
      throw editorMessageError('errors:studio.image.previewCrop');
    const result = inspectManualImageMap(getSource(), getMission().id, rows);
    const preview = prepareContentPreview(result.candidate, getMission().id, {
      difficulty: getDifficulty(),
      mode: getMission().modes[0],
    });
    const canvas = $('reference-preview');
    const rectangleCount = rows.length;
    canvas.hidden = false;
    inspected = { ...result, before: identity(), missionId: getMission().id };
    $('reference-apply').disabled = false;
    $('reference-play').disabled = !getMission().modes.includes('solo');
    message(() =>
      t('tools:studio.image.inspected', {
        count: rectangleCount,
        foundations: preview.geometry.foundationCount,
        eligible: preview.geometry.eligibleCount,
        summary: paintContentMap(canvas.getContext('2d'), preview, {
          width: canvas.width,
          underlay,
        }),
        diagnostics: result.diagnostics
          .map((row) =>
            t('tools:studio.image.diagnostic', {
              difficulty: studioDifficultyName(row.difficulty),
              mode: studioModeName(row.mode),
              code: row.code,
            }),
          )
          .join('; '),
      }),
    );
  });
  function currentInspection() {
    if (!inspected || inspected.before !== identity()) {
      invalidate();
      throw editorMessageError('errors:studio.image.selectionChanged');
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
      throw editorMessageError('errors:studio.image.candidateChanged');
    if (!apply(fresh.candidate)) return;
    rows = [];
    list();
    invalidate(localizedMessage('tools:studio.image.applied'));
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
        throw editorMessageError('errors:studio.image.restoreChanged');
      }
      reference?.dispose();
      reference = next;
      crop = trace.crop;
      rows = trace.rectangles;
      for (const key of ['x', 'y', 'w', 'h']) $(`crop-${key}`).value = crop[key];
      $('reference-tools').disabled = false;
      $('reference-show').checked = trace.visible;
      list();
      invalidate(localizedMessage('tools:studio.image.restored'));
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
            ? localizedMessage('tools:studio.image.draftChanged')
            : localizedMessage('tools:studio.image.draftChangedEmpty'),
        );
      observedDraft = nextDraft;
      $('reference-file').disabled = !getMission();
    },
    hasPending: () => rows.length > 0,
    dispose,
  };
}
