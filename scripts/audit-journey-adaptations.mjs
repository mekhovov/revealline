import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { WHOLE_JOURNEY_CHAPTERS } from '../game/content-design/whole-journey-candidates.mjs';

const root = new URL('../', import.meta.url);
const json = async (relative) => JSON.parse(await readFile(new URL(relative, root), 'utf8'));

/** Existing declarations only: no second mission registry, inferred matching by
 * name, edited historical observation, asset loading or publication. */
export async function loadJourneyAdaptationInputs() {
  const ledger = await json('docs/research/xposed-journey-ledger.json');
  const chapters = [];
  for (const [index, chapter] of WHOLE_JOURNEY_CHAPTERS.entries()) {
    const module = await import(`../game/content-design/${chapter.id}-candidates.mjs`);
    const factory =
      chapter.id === 'horizon'
        ? 'createOpeningCandidates'
        : `create${chapter.id[0].toUpperCase()}${chapter.id.slice(1)}Candidates`;
    const source = module[factory]();
    const phase = `P${String(index + 1).padStart(2, '0')}`;
    let declarations, evidenceSource;
    if (['horizon', 'border', 'signal'].includes(chapter.id)) {
      evidenceSource = `docs/research/${chapter.id}-reference-crosswalk.json`;
      const crosswalk = await json(evidenceSource);
      if (crosswalk.phase !== phase) throw new Error(`Wrong phase in ${evidenceSource}.`);
      const referencePins = new Map(
        crosswalk.references.map((reference) => [reference.designKey, reference.sha256]),
      );
      declarations = crosswalk.missions.flatMap((mission) =>
        mission.references.map((reference) => ({
          reference,
          missionId: mission.id,
          decision: 'redesign',
          final: false,
          reason: mission.departureFromReference,
          referenceSHA256: referencePins.get(reference),
          standardSimulationIdentity: mission.standardSimulationIdentity,
        })),
      );
    } else {
      evidenceSource = `game/content-design/${chapter.id}-candidates.mjs`;
      declarations = module[`${chapter.id.toUpperCase()}_REFERENCE_ADAPTATIONS`];
    }
    chapters.push({ id: chapter.id, phase, source, evidenceSource, declarations });
  }
  return { ledger, chapters };
}

/** Qualification stays open. Resolved identities prove a declaration has current
 * executable geometry; they do not prove that routes were played or enjoyed. */
export function inspectJourneyAdaptations({ ledger, chapters }) {
  const references = ledger.references.filter((row) => row.kind === 'mission-layout-reference');
  const byKey = new Map(references.map((row) => [row.designKey, row]));
  if (byKey.size !== references.length) throw new Error('Duplicate numbered reference.');
  const links = [],
    seen = new Set(),
    authoredMissions = [];
  for (const chapter of chapters) {
    const project = compileContentProject(chapter.source);
    authoredMissions.push(
      ...project.missions.map((mission) => ({ chapter: chapter.id, missionId: mission.id })),
    );
    for (const declaration of chapter.declarations) {
      const reference = byKey.get(declaration.reference);
      if (!reference) throw new Error(`Unknown numbered reference: ${declaration.reference}.`);
      if (declaration.final !== false || declaration.decision !== 'redesign')
        throw new Error(
          'A provisional crosswalk cannot infer a final disposition. Review new decisions explicitly.',
        );
      if (typeof declaration.reason !== 'string' || !declaration.reason.trim())
        throw new Error('Adaptation needs its explicit design rationale.');
      if (
        Object.hasOwn(declaration, 'referenceSHA256') &&
        declaration.referenceSHA256 !== reference.source.sha256
      )
        throw new Error(`Changed or missing reference pin: ${declaration.reference}.`);
      const key = `${chapter.id}/${declaration.missionId}/${declaration.reference}`;
      if (seen.has(key)) throw new Error(`Duplicate adaptation: ${key}.`);
      seen.add(key);
      const editions = [];
      for (const mode of ['solo', 'versus'])
        for (const difficulty of ['gentle', 'standard', 'expert']) {
          const manifest = resolveMission(project, declaration.missionId, { mode, difficulty });
          editions.push({ mode, difficulty, simulationIdentity: manifest.simulationIdentity });
          if (
            mode === 'solo' &&
            difficulty === 'standard' &&
            Object.hasOwn(declaration, 'standardSimulationIdentity') &&
            declaration.standardSimulationIdentity !== manifest.simulationIdentity
          )
            throw new Error(
              `Stale declared simulation: ${key}. Renew its design and route review.`,
            );
        }
      const mission = project.source.missions.find((row) => row.id === declaration.missionId);
      links.push({
        reference: declaration.reference,
        referenceSHA256: reference.source.sha256,
        chapter: chapter.id,
        phase: chapter.phase,
        projectId: project.source.id,
        missionId: mission.id,
        missionRevision: mission.revision,
        map: mission.map,
        designRationale: declaration.reason,
        routeDecision: mission.design.routeDecision,
        evidenceSource: chapter.evidenceSource,
        editions,
        status: 'implemented-candidate-not-final-disposition',
        finalDisposition: false,
        humanValidation: 'pending',
        releaseValidation: 'not-qualified-by-this-audit',
      });
    }
  }
  const linked = new Set(links.map((link) => link.reference));
  const unlinkedReferences = references
    .filter((row) => !linked.has(row.designKey))
    .map((row) => row.designKey);
  const originalMissionsWithoutReference = authoredMissions.filter(
    (mission) =>
      !links.some(
        (link) => link.chapter === mission.chapter && link.missionId === mission.missionId,
      ),
  );
  return {
    format: 'JourneyAdaptationCoverageV1',
    counts: {
      sourceFiles: ledger.references.length,
      numberedReferences: references.length,
      coveredReferences: linked.size,
      adaptationLinks: links.length,
      authoredSoloCandidates: authoredMissions.length,
      finalDispositions: 0,
    },
    unlinkedReferences,
    originalMissionsWithoutReference,
    references: references.map((reference) => ({
      designKey: reference.designKey,
      source: reference.source,
      adaptations: links.filter((link) => link.reference === reference.designKey),
    })),
    qualification: 'reference-to-current-candidate-coverage-only',
    limitations: [
      'Original observations, source hashes and historical proposals remain in the source ledger; this audit does not reinspect screenshots.',
      'A source can inspire several original missions and an original mission can combine several motifs; counts are not a filler quota.',
      'Six resolved Solo/Versus editions per link prove compilation, not actual play, equal-race outcomes, human pacing or enjoyment.',
      'Artwork availability, Team adaptations, human final dispositions, releases and Pages deployment require their own evidence.',
      'Early crosswalk pins are checked; later declarations resolve current candidates and do not establish past route evidence for a changed edition.',
    ],
  };
}

export async function auditJourneyAdaptations() {
  return inspectJourneyAdaptations(await loadJourneyAdaptationInputs());
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 2)
      throw new Error('Usage: node scripts/audit-journey-adaptations.mjs');
    const report = await auditJourneyAdaptations();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.unlinkedReferences.length) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
