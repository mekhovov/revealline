import { boundedJSON, exactKeys, required, stableId } from '../data-json.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { freezeDesign } from '../content-design/catalogs.mjs';
import { createRun, stepRun, getSummary, CLASSES } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplayAsync } from '../replay.mjs';

export const CREATOR_GAMEPLAY_POLICY = 'compiled-preset-v1';
export const CREATOR_TEMPLATE_VERSION = 'creator-crossing.v1';
export const CREATOR_ROUTE_FORMAT = 'revealline-creator-route.v1';
export const CREATOR_TEMPLATES = freezeDesign([
  {
    id: 'first-crossing',
    version: CREATOR_TEMPLATE_VERSION,
    name: 'First crossing',
    description: 'An introductory crossing with no enemies. Close one line to reveal the picture.',
    variants: ['center', 'west'],
    modes: ['solo'],
    difficulties: ['gentle', 'standard', 'expert'],
    maxTicks: 2400,
  },
]);
const abort = (signal) => {
  if (signal?.aborted) throw new DOMException('Level generation cancelled.', 'AbortError');
};
const uint32 = (value) => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
const text = (value) => typeof value === 'string' && value.trim() && value.length <= 160;

/** Geometry depends only on the explicit template and generation seed. No file
 * names, encoded images, clock, browser storage or random perturbation are read. */
export function generateCreatorProject(options) {
  const value = boundedJSON(options, { maxBytes: 2048, maxNodes: 16, maxDepth: 2 });
  exactKeys(value, ['id', 'name', 'seed'], 'creator generation');
  required(
    stableId(value.id) && text(value.name),
    'Choose a project identity and collection name.',
  );
  required(uint32(value.seed), 'Generation seed must be an unsigned 32-bit integer.');
  const variantId = value.seed % 2 === 0 ? 'center' : 'west';
  const source = createStarterProject(value.id);
  source.revision = '1';
  source.name = value.name.trim();
  source.assets = [];
  const map = source.maps[0];
  Object.assign(map, {
    id: 'crossing-map',
    name: 'An open crossing',
    width: 72,
    height: 36,
    foundations: [],
    spawns: [{ id: 'home', x: variantId === 'center' ? 36.5 : 18.5, y: 0.5 }],
  });
  const mission = source.missions[0];
  Object.assign(mission, {
    id: 'picture-1',
    name: 'First picture',
    map: { id: map.id, revision: map.revision },
    modes: ['solo'],
    actors: [],
    coverage: 0.5,
    design: {
      routeDecision: 'Cross directly or turn to make a smaller return?',
      lesson: 'A line closes when you reach safe ground.',
      counterplay: 'There are no enemies in this introductory template.',
      captureConsequence: 'Closing a line reclaims the unoccupied field.',
      introduces: ['closure'],
      practices: [],
      combines: [],
      memorableMoment: 'Your picture appears after the first complete crossing.',
      mastery: 'Make one continuous crossing.',
      durationSeconds: [10, 45],
      difficulty: {
        band: 1,
        planning: 0,
        execution: 1,
        threatDensity: 0,
        timePressure: 0,
        mechanicLoad: 0,
        coordination: 0,
      },
    },
  });
  Object.assign(source.campaigns[0], {
    id: 'pictures',
    name: source.name,
    missionIds: [mission.id],
  });
  Object.assign(source.packs[0], {
    id: 'collection',
    name: source.name,
    campaignIds: ['pictures'],
  });
  const project = compileContentProject(source).source;
  return freezeDesign({
    project,
    provenance: {
      format: 'revealline-creator-generation.v1',
      templateId: 'first-crossing',
      templateVersion: CREATOR_TEMPLATE_VERSION,
      variantId,
      generationSeed: value.seed,
      runtimeSeed: value.seed,
      missionId: mission.id,
      gameplayPolicy: CREATOR_GAMEPLAY_POLICY,
      policyId: source.policyId,
    },
  });
}

export function validateCreatorProvenance(source) {
  const value = boundedJSON(source, { maxBytes: 4096, maxNodes: 20, maxDepth: 2 });
  exactKeys(
    value,
    [
      'format',
      'templateId',
      'templateVersion',
      'variantId',
      'generationSeed',
      'runtimeSeed',
      'missionId',
      'gameplayPolicy',
      'policyId',
    ],
    'creator provenance',
  );
  required(
    value.format === 'revealline-creator-generation.v1' &&
      value.templateId === 'first-crossing' &&
      value.templateVersion === CREATOR_TEMPLATE_VERSION &&
      value.gameplayPolicy === CREATOR_GAMEPLAY_POLICY &&
      uint32(value.generationSeed) &&
      uint32(value.runtimeSeed) &&
      stableId(value.missionId),
    'Unsupported creator template, seed or gameplay policy. Regenerate this level.',
  );
  const generated = generateCreatorProject({
    id: 'template-check',
    name: 'Check',
    seed: value.generationSeed,
  });
  required(
    value.variantId === generated.provenance.variantId &&
      value.policyId === generated.provenance.policyId &&
      value.runtimeSeed === generated.provenance.runtimeSeed,
    'Template variant or runtime seed differs from its generation recipe.',
  );
  return freezeDesign(value);
}

/** Check the actual compiled level, seed and preset through public legal input.
 * Uploaded success flags never bypass execution. Artwork/labels can change while
 * simulation stays identical. Gameplay edits require regeneration or a future
 * explicit recorded-completion workflow; they cannot borrow template evidence. */
export async function verifyCreatorRoutes(
  source,
  provenance,
  { signal, buildVersion = 'dev' } = {},
) {
  abort(signal);
  const generated = validateCreatorProvenance(provenance);
  const project = compileContentProject(source);
  const reference = compileContentProject(
    generateCreatorProject({ id: 'template-check', name: 'Check', seed: generated.generationSeed })
      .project,
  );
  const results = [];
  for (const difficulty of CREATOR_TEMPLATES[0].difficulties) {
    const manifest = resolveMission(project, generated.missionId, { mode: 'solo', difficulty });
    const expected = resolveMission(reference, 'picture-1', { mode: 'solo', difficulty });
    required(
      manifest.simulationIdentity === expected.simulationIdentity,
      'Gameplay changed after generation. Regenerate the level or keep it as an unapproved draft.',
    );
    for (const turnPolicy of ['immediate', 'grid-center']) {
      abort(signal);
      const options = {
        seed: generated.runtimeSeed,
        turnPolicy,
        classId: 'scout',
        classRecipes: CLASSES,
      };
      const run = createRun(manifest.level, options);
      const recorder = createRecorder(manifest.level, options, buildVersion);
      const input = { direction: 'down' };
      for (
        let tick = 0;
        tick < CREATOR_TEMPLATES[0].maxTicks && run.status !== 'won' && run.status !== 'lost';
        tick++
      ) {
        if (tick % 120 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
          abort(signal);
        }
        recordInput(recorder, input);
        stepRun(run, input);
      }
      required(getSummary(run).won, 'The generated route did not complete. Regenerate this level.');
      const replay = exportReplay(recorder, run);
      const verified = await verifyReplayAsync(replay, { signal });
      required(
        verified.match && verified.actual.summary.won,
        'The generated completion did not replay successfully.',
      );
      results.push({
        format: CREATOR_ROUTE_FORMAT,
        kind: 'automated',
        check: 'route-feasibility',
        missionId: manifest.missionId,
        mode: 'solo',
        difficulty,
        simulationIdentity: manifest.simulationIdentity,
        gameplayPolicy: CREATOR_GAMEPLAY_POLICY,
        seed: generated.runtimeSeed,
        turnPolicy,
        replay,
      });
    }
  }
  abort(signal);
  return freezeDesign(results);
}
