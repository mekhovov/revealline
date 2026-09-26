import { boundedJSON, canonicalJSON, exactKeys, required } from '../../game/data-json.mjs';
import { freezeEdition } from '../../game/editions/model.mjs';
import { projectStudioSelection, validateStudioReport } from './model.mjs';

export const STUDIO_REVIEW_FORMAT = 'revealline-company-art-observations.v1';
export const STUDIO_REVIEW_BYTES = 2 * 1024 * 1024;
export const STUDIO_REVIEW_CHECKS = Object.freeze(
  [
    ['identity-story', 'Company identity and fictional story'],
    ['crop-layout', 'Framing and crop at this viewport'],
    ['partial-reveal', 'Masked and revealed scene readability'],
    ['gameplay-cues', 'Frontier, objective, trail and threat cues'],
    ['reduced-motion', 'Reduced-motion presentation'],
    ['content-attribution', 'Content accuracy and source attribution'],
  ].map(([id, label]) => Object.freeze({ id, label })),
);
export const STUDIO_REVIEW_STATES = Object.freeze([
  'initial',
  'partial',
  'result',
  'full-art-diagnostic',
]);
const purpose = 'manual-observations-not-approval';
const text = (value, limit, empty = false) =>
  typeof value === 'string' && value.length <= limit && (empty || value.trim().length > 0);
const same = (a, b, message) => required(canonicalJSON(a) === canonicalJSON(b), message);
const bounded = (input) =>
  boundedJSON(input, {
    maxBytes: STUDIO_REVIEW_BYTES,
    maxArray: 1024,
    maxNodes: 60000,
    maxString: 16000,
  });
const publicURL = (value) => {
  if (!text(value, 2048)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
};

/** Call only after verifyStudioPreview succeeds for this unchanged applied draft. */
export function createStudioReviewContext({ catalog, editionId, files, report }) {
  const checked = validateStudioReport(report);
  required(checked.editionId === editionId, 'Review edition differs from the verified artifact.');
  const { edition, brand, campaigns } = projectStudioSelection(catalog, editionId, files);
  const missions = [];
  const ids = new Set();
  for (const campaign of campaigns) {
    const project = files.get(campaign.sourcePath);
    const lessons = campaign.lessonPath ? files.get(campaign.lessonPath) : [];
    for (const mission of project.missions) {
      required(!ids.has(mission.id), 'Repeated mission in the review context.');
      ids.add(mission.id);
      const asset = project.assets.find(
        (row) => row.id === mission.presentation?.backgroundAssetId,
      );
      required(
        !mission.presentation?.backgroundAssetId || asset,
        'Missing selected mission picture.',
      );
      const lesson = lessons?.find((row) => row.missionId === mission.id);
      missions.push({
        id: mission.id,
        name: mission.name,
        campaignId: campaign.id,
        campaignName: campaign.name,
        sourcePath: campaign.sourcePath,
        missionRevision: mission.revision,
        picture: asset
          ? Object.fromEntries(
              ['id', 'revision', 'path', 'sha256', 'bytes', 'width', 'height', 'alt'].map((key) => [
                key,
                asset[key],
              ]),
            )
          : null,
        notice:
          lesson?.notice ??
          mission.design?.captureConsequence ??
          'Illustrative game content; review its factual and fictional boundaries.',
        sources: [...(brand.sources ?? []), ...(lesson?.sources ?? [])]
          .filter((source) => publicURL(source.url))
          .map(({ title, url }) => ({ title, url })),
      });
    }
  }
  required(
    missions.length > 0 && missions.length <= 512,
    'Review mission count is outside its bound.',
  );
  return freezeEdition({
    editionId,
    editionName: edition.name,
    artifact: checked.artifact,
    missions,
  });
}

export function studioObservationKey(row) {
  return [row.missionId, row.viewport.width, row.viewport.height, row.motion, row.sceneState].join(
    ':',
  );
}

export function validateStudioObservation(input, context) {
  const row = bounded(input);
  exactKeys(
    row,
    [
      'missionId',
      'picture',
      'observer',
      'observedAt',
      'viewport',
      'motion',
      'sceneState',
      'checks',
      'notes',
    ],
    'mission observation',
  );
  const mission = context.missions.find((item) => item.id === row.missionId);
  required(mission, 'Observation names an unselected mission.');
  same(row.picture, mission.picture, 'Observation picture differs from this verified mission.');
  required(text(row.observer, 160), 'Name the observer of this scene.');
  required(
    text(row.observedAt, 32) &&
      /^\d{4}-\d{2}-\d{2}T/.test(row.observedAt) &&
      Number.isFinite(Date.parse(row.observedAt)),
    'Observation time is invalid.',
  );
  exactKeys(row.viewport, ['width', 'height'], 'observation viewport');
  required(
    Object.values(row.viewport).every((n) => Number.isInteger(n) && n >= 240 && n <= 8192),
    'Use a viewport between 240 and 8192 pixels.',
  );
  required(
    ['standard', 'reduced'].includes(row.motion) && STUDIO_REVIEW_STATES.includes(row.sceneState),
    'Choose the observed motion and scene state.',
  );
  required(
    Array.isArray(row.checks) && row.checks.length === STUDIO_REVIEW_CHECKS.length,
    'Observation checks are incomplete.',
  );
  const checks = new Set();
  for (const check of row.checks) {
    exactKeys(check, ['id', 'status', 'notes'], 'observation check');
    required(
      STUDIO_REVIEW_CHECKS.some(({ id }) => id === check.id) && !checks.has(check.id),
      'Unknown or duplicate observation check.',
    );
    checks.add(check.id);
    required(
      ['not-observed', 'observed', 'issue'].includes(check.status),
      'Observation status cannot approve artwork.',
    );
    required(
      text(check.notes, 2000, check.status === 'not-observed'),
      'Describe each observed result or issue.',
    );
    required(
      check.id !== 'reduced-motion' || check.status === 'not-observed' || row.motion === 'reduced',
      'Reduced-motion observations require reduced motion.',
    );
  }
  required(
    row.checks.some((check) => check.status !== 'not-observed'),
    'Record at least one explicit observation.',
  );
  required(text(row.notes, 4000, true), 'Observation notes exceed their bound.');
  return row;
}

export function studioReviewPacket(context, observations) {
  return validateStudioReviewPacket(
    {
      format: STUDIO_REVIEW_FORMAT,
      purpose,
      editionId: context.editionId,
      artifact: context.artifact,
      observations,
    },
    context,
  );
}

export function validateStudioReviewPacket(input, context) {
  const packet = bounded(input);
  exactKeys(
    packet,
    ['format', 'purpose', 'editionId', 'artifact', 'observations'],
    'art observation packet',
  );
  required(
    packet.format === STUDIO_REVIEW_FORMAT && packet.purpose === purpose,
    'This is an observation packet, not an approval receipt.',
  );
  required(
    packet.editionId === context.editionId,
    'Observation packet belongs to another edition.',
  );
  same(
    packet.artifact,
    context.artifact,
    'Observation packet belongs to a changed or unverified artifact.',
  );
  required(
    Array.isArray(packet.observations) && packet.observations.length <= 512,
    'Observation count exceeds 512.',
  );
  const ids = new Set();
  packet.observations = packet.observations.map((input) => {
    const row = validateStudioObservation(input, context),
      key = studioObservationKey(row);
    required(
      !ids.has(key),
      'Duplicate mission observation for this viewport, motion and scene state.',
    );
    ids.add(key);
    return row;
  });
  return packet;
}

/** Imported prose is a provenance lead, never a verified human decision. No master is fetched. */
export function studioGenerationNotes(input, context) {
  const receipt = bounded(input);
  required(
    Array.isArray(receipt.assets) && receipt.assets.length > 0 && receipt.assets.length <= 512,
    'Choose a bounded generation receipt.',
  );
  const seen = new Set(),
    notes = [];
  for (const row of receipt.assets) {
    const id = row.missionId ?? row.id;
    required(text(id, 160) && !seen.has(id), 'Duplicate or missing generation-note mission.');
    seen.add(id);
    const mission = context.missions.find((item) => item.id === id);
    if (!mission) continue;
    const picture = mission.picture,
      selected = row.selected;
    required(
      picture &&
        selected &&
        String(row.revision ?? 1) === picture.revision &&
        selected.sha256 === picture.sha256 &&
        selected.bytes === picture.bytes &&
        selected.width === picture.width &&
        selected.height === picture.height &&
        selected.path === `game/${picture.path}`,
      'Generation notes refer to a different selected picture.',
    );
    required(
      row.review && text(row.review.original, 8000) && text(row.review.selected, 8000),
      'Generation inspection notes are missing.',
    );
    const warning = row.review.compositionNote ?? '';
    required(text(warning, 8000, true), 'Generation warning exceeds its bound.');
    const references = receipt.sourceReferences ?? [];
    required(
      Array.isArray(references) && references.length <= 32,
      'Generation references must be bounded public HTTPS URLs.',
    );
    const sources = references.map((source) => (typeof source === 'string' ? source : source?.url));
    required(sources.every(publicURL), 'Generation references must be bounded public HTTPS URLs.');
    notes.push({
      missionId: id,
      original: row.review.original,
      selected: row.review.selected,
      warning,
      sources,
    });
  }
  required(notes.length > 0, 'No selected mission pictures match this generation receipt.');
  return notes;
}
