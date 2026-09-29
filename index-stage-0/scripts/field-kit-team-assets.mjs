import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../game/data-json.mjs';
import { teamAnchorSlotSpecs } from '../game/presentation/team-anchor-slots.mjs';
import { teamEffectSlotSpecs } from '../game/presentation/team-effect-slots.mjs';
import { buildTeamAnchorArt } from './produce-team-anchor-art.mjs';
import { buildTeamFeedbackArt } from './produce-team-feedback-art.mjs';

export const fieldKitTeamSlotSpecs = () => [...teamAnchorSlotSpecs(), ...teamEffectSlotSpecs()];
const families = [
  ['authoring/library/team-anchor-field-kit-v1', buildTeamAnchorArt],
  ['authoring/library/team-feedback-field-kit-v1', buildTeamFeedbackArt],
];
const hash = (body) => createHash('sha256').update(body).digest('hex');

/** Bind only complete, reproducible original families. This prepares assets but
 * never writes a ledger, changes quality approval or adopts runtime output. */
export async function createFieldKitTeamAssets({ projectRoot }) {
  const specs = fieldKitTeamSlotSpecs();
  const prepared = [];
  for (const [directory, build] of families) {
    const generated = await build({ projectRoot });
    const source = path.join(projectRoot, directory, 'prepared');
    const recorded = JSON.parse(await fs.readFile(path.join(source, 'manifest.json'), 'utf8'));
    if (canonicalJSON(recorded) !== canonicalJSON(generated.manifest))
      throw new Error(`Team prepared manifest differs from its original producer: ${directory}.`);
    for (const record of recorded.assets) {
      const slot = specs.find((entry) => entry.id === record.slot);
      if (!slot || prepared.some((entry) => entry.slotId === slot.id))
        throw new Error('Team production requires each registered role exactly once.');
      const body = await fs.readFile(path.join(source, record.file));
      if (!body.equals(generated.files.get(record.file)) || hash(body) !== record.sha256)
        throw new Error(`Team prepared image differs from its original producer: ${record.slot}.`);
      prepared.push({
        slotId: slot.id,
        body,
        values: {
          kind: 'image',
          description: record.description,
          file: {
            sha256: record.sha256,
            bytes: record.bytes,
            mime: 'image/png',
            width: record.width,
            height: record.height,
          },
          geometry: { ...structuredClone(slot.geometry), occupiedBounds: record.occupiedBounds },
          provenance: {
            creator: record.provenance.creator,
            source: `${record.provenance.source} sha256:${record.provenance.sourceSha256}`,
            license: record.provenance.license,
            prompt: record.provenance.prompt,
            parent: null,
          },
          quality: {
            stage: 'produced',
            evidence: [
              `Reproduced original integer-pixel source ${record.provenance.sourceSha256}; PNG ${record.sha256}.`,
              'Complete paired anchor and four-role feedback families. Runtime visual approval remains separate.',
            ],
          },
        },
      });
    }
  }
  if (prepared.length !== specs.length)
    throw new Error('Team production requires both anchors and all four feedback roles.');
  return { slots: specs, assets: prepared };
}
