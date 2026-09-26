import {
  STUDIO_REVIEW_BYTES,
  STUDIO_REVIEW_CHECKS,
  STUDIO_REVIEW_STATES,
  studioObservationKey,
  studioReviewPacket,
  validateStudioReviewPacket,
  studioGenerationNotes,
} from './review-model.mjs';

/** In-memory observer notes only. Never reads game internals or changes progress. */
export function createStudioReviewPane({ documentRef, download, status }) {
  const $ = (id) => documentRef.getElementById(id);
  const node = (tag, text) => {
    const el = documentRef.createElement(tag);
    el.textContent = text;
    return el;
  };
  let context = null,
    pendingContext = null,
    active = false,
    formDirty = false,
    generation = 0,
    observations = [],
    generationNotes = new Map();
  const mission = () => context?.missions.find(({ id }) => id === $('review-mission').value);
  const guarded =
    (fn) =>
    async (...args) => {
      try {
        await fn(...args);
      } catch (error) {
        if (error.name === 'AbortError') return;
        status(error.message, true);
      }
    };
  const resetChecks = () => {
    for (const { id } of STUDIO_REVIEW_CHECKS) {
      $(`review-check-${id}`).value = 'not-observed';
      $(`review-note-${id}`).value = '';
    }
    $('review-notes').value = '';
    formDirty = false;
  };
  function renderMission() {
    const row = mission();
    if (!row) return;
    $('review-picture').textContent = row.picture
      ? `${row.picture.id} · revision ${row.picture.revision} · ${row.picture.width}×${row.picture.height}\n${row.picture.path}\nSHA-256 ${row.picture.sha256}\n${row.picture.alt}`
      : 'This mission has no raster reveal picture. Review its selected procedural presentation.';
    $('review-attribution').replaceChildren(node('p', row.notice));
    for (const source of row.sources) {
      const link = node('a', source.title);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      $('review-attribution').append(link);
    }
    const notes = generationNotes.get(row.id);
    $('review-generation-notes').replaceChildren(node('h4', 'Generation inspection notes'));
    if (!notes)
      $('review-generation-notes').append(
        node(
          'p',
          'No generation receipt imported for this exact picture. Import its receipt to display recorded inspection notes and composition warnings.',
        ),
      );
    else {
      for (const [label, value] of [
        ['Original inspection', notes.original],
        ['Selected inspection', notes.selected],
        [
          'Composition warning',
          notes.warning ||
            'No separate composition warning was recorded; this is not a completed gameplay review.',
        ],
      ])
        $('review-generation-notes').append(node('p', `${label}: ${value}`));
      for (const url of notes.sources) {
        const link = node('a', url);
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        $('review-generation-notes').append(link);
      }
    }
  }
  function render() {
    $('mission-review').hidden = !context;
    if (!context) return;
    $('review-fields').disabled = !active;
    $('import-observations').disabled = !active;
    $('import-generation-notes').disabled = !active;
    $('export-observations').disabled = observations.length === 0;
    $('review-new-artifact').hidden = !pendingContext;
    $('review-binding').textContent =
      `${context.editionName} · artifact SHA-256 ${context.artifact.sha256}`;
    $('review-state').textContent = active
      ? 'Verified artifact selected. Record only what you actually observed; no check grants artwork approval.'
      : 'Artifact verification is no longer current. Existing observations still export with their original artifact hash. Verify the current draft before recording more.';
    const covered = new Set(observations.map(({ missionId }) => missionId)).size;
    $('review-coverage').textContent =
      `${observations.length} observations cover ${covered} of ${context.missions.length} missions. Coverage is not approval or proof that every scene state was reviewed.`;
    $('review-observation-list').replaceChildren();
    for (const row of observations) {
      const item = node(
        'li',
        `${context.missions.find(({ id }) => id === row.missionId).name} · ${row.viewport.width}×${row.viewport.height} · ${row.motion} · ${row.sceneState} · ${row.observer}`,
      );
      const edit = node('button', 'Edit observation');
      edit.type = 'button';
      edit.disabled = !active;
      edit.onclick = () => {
        $('review-mission').value = row.missionId;
        renderMission();
        $('review-observer').value = row.observer;
        $('review-width').value = row.viewport.width;
        $('review-height').value = row.viewport.height;
        $('review-motion').value = row.motion;
        $('review-scene').value = row.sceneState;
        $('review-notes').value = row.notes;
        for (const check of row.checks) {
          $(`review-check-${check.id}`).value = check.status;
          $(`review-note-${check.id}`).value = check.notes;
        }
        $('review-observer').focus();
      };
      const remove = node('button', 'Remove observation');
      remove.type = 'button';
      remove.disabled = !active;
      remove.onclick = () => {
        if (!active) return;
        observations = observations.filter((other) => other !== row);
        render();
      };
      item.append(edit, remove);
      $('review-observation-list').append(item);
    }
    renderMission();
  }
  function adopt(next) {
    generation++;
    const unchanged =
      context?.editionId === next.editionId &&
      context?.artifact.sha256 === next.artifact.sha256 &&
      context?.artifact.bytes === next.artifact.bytes &&
      context?.artifact.path === next.artifact.path;
    if (context && !unchanged && (observations.length || formDirty)) {
      active = false;
      pendingContext = next;
      render();
      return;
    }
    context = next;
    pendingContext = null;
    active = true;
    if (!unchanged) {
      observations = [];
      generationNotes = new Map();
      resetChecks();
    }
    const selected = $('review-mission').value;
    $('review-mission').replaceChildren();
    for (const row of context.missions) {
      const option = node('option', `${row.campaignName} / ${row.name}`);
      option.value = row.id;
      $('review-mission').append(option);
    }
    if (context.missions.some(({ id }) => id === selected)) $('review-mission').value = selected;
    render();
  }
  for (const { id, label } of STUDIO_REVIEW_CHECKS) {
    const group = node('div', '');
    group.className = 'review-check';
    const choiceLabel = node('label', label);
    choiceLabel.htmlFor = `review-check-${id}`;
    const choice = documentRef.createElement('select');
    choice.id = `review-check-${id}`;
    for (const [value, name] of [
      ['not-observed', 'Not observed'],
      ['observed', 'Observed — describe result'],
      ['issue', 'Issue found'],
    ]) {
      const option = node('option', name);
      option.value = value;
      choice.append(option);
    }
    const notesLabel = node('label', `${label}: observation notes`);
    notesLabel.htmlFor = `review-note-${id}`;
    const notes = documentRef.createElement('textarea');
    notes.id = `review-note-${id}`;
    notes.rows = 2;
    notes.maxLength = 2000;
    group.append(choiceLabel, choice, notesLabel, notes);
    $('review-checks').append(group);
  }
  for (const value of STUDIO_REVIEW_STATES) {
    const option = node('option', value.replaceAll('-', ' '));
    option.value = value;
    $('review-scene').append(option);
  }
  $('review-mission').onchange = () => {
    resetChecks();
    renderMission();
  };
  $('review-new-artifact').onclick = () => {
    const next = pendingContext;
    observations = [];
    context = null;
    adopt(next);
  };
  $('review-form').onsubmit = guarded((event) => {
    event.preventDefault();
    if (!active) throw new Error('Verify the current artifact before recording an observation.');
    const selected = mission();
    const row = {
      missionId: selected.id,
      picture: selected.picture,
      observer: $('review-observer').value.trim(),
      observedAt: new Date().toISOString(),
      viewport: {
        width: Number($('review-width').value),
        height: Number($('review-height').value),
      },
      motion: $('review-motion').value,
      sceneState: $('review-scene').value,
      checks: STUDIO_REVIEW_CHECKS.map(({ id }) => ({
        id,
        status: $(`review-check-${id}`).value,
        notes: $(`review-note-${id}`).value.trim(),
      })),
      notes: $('review-notes').value.trim(),
    };
    const key = studioObservationKey(row);
    observations = studioReviewPacket(context, [
      ...observations.filter((item) => studioObservationKey(item) !== key),
      row,
    ]).observations;
    formDirty = false;
    render();
    status('Manual observation saved in this tab. Asset and promotion approval are unchanged.');
  });
  $('review-form').oninput = () => {
    formDirty = true;
  };
  $('export-observations').onclick = guarded(() =>
    download(`review-${context.editionId}-artwork.json`, studioReviewPacket(context, observations)),
  );
  const readImport = async (input) => {
    const file = input.files[0];
    if (!file) return null;
    if (file.size > STUDIO_REVIEW_BYTES) throw new Error('Review imports are limited to 2 MiB.');
    const owner = context,
      ticket = generation,
      ownsImport = () => active && context === owner && ticket === generation;
    let text;
    try {
      text = await file.text();
    } catch (error) {
      if (ownsImport()) throw error;
      throw new DOMException('The verified review artifact changed during import.', 'AbortError');
    }
    if (!ownsImport())
      throw new DOMException('The verified review artifact changed during import.', 'AbortError');
    input.value = '';
    return text;
  };
  $('import-observations').onchange = guarded(async () => {
    const text = await readImport($('import-observations'));
    if (text === null) return;
    const imported = validateStudioReviewPacket(text, context);
    observations = studioReviewPacket(context, [
      ...observations,
      ...imported.observations,
    ]).observations;
    render();
    status('Matching manual observations imported; no artwork approval was inferred.');
  });
  $('import-generation-notes').onchange = guarded(async () => {
    const text = await readImport($('import-generation-notes'));
    if (text === null) return;
    for (const row of studioGenerationNotes(text, context)) generationNotes.set(row.missionId, row);
    renderMission();
    status(
      'Matching generation notes loaded as provenance leads. Original files were not fetched.',
    );
  });
  return {
    adopt,
    invalidate() {
      generation++;
      active = false;
      pendingContext = null;
      render();
    },
  };
}
