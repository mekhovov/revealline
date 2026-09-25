import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { dataIdentity } from '../game/data-json.mjs';
import { createDifficultyContext } from '../game/campaign-difficulty.mjs';
import { CLASSES } from '../game/core/registry.mjs';
import { normalizedLevel } from '../game/core/level.mjs';
import { FIRST_FLIGHT_LESSONS } from '../game/first-flight.mjs';
import { ENEMY_CATALOG } from '../game/enemy-catalog.mjs';
import { COOP_STARTER_PACK } from '../game/coop/library.mjs';

// Explicit presentation fields. Attribution, authors, legal notices, IDs, paths,
// recordings and user-authored files are deliberately not extraction inputs.
export const CONTENT_FIELDS = new Set([
  'name',
  'title',
  'subtitle',
  'label',
  'description',
  'summary',
  'brief',
  'briefs',
  'instructions',
  'instruction',
  'outcome',
  'hint',
  'caption',
  'domain',
  'risk',
  'motion',
  'forms',
  'labels',
  'objective',
  'supply',
  'enemy',
  'boss',
  'currency',
  'ability',
  'hook',
  'campaignTitle',
  'alt',
  'routeDecision',
  'mastery',
  'route',
]);

/** Extract the same immutable source, execution and navigation records the
 * current hosts present. These are build-time readers; no saves or media are
 * opened, and no translated value enters the content compiler. */
async function currentJourneySources(root) {
  const moduleAt = (file) => import(pathToFileURL(path.join(root, 'game', file)).href);
  const { DEFAULT_JOURNEY_ROUTES } = await moduleAt('content-design/default-entry.mjs');
  const { loadAuthoredJourneyRoute } = await moduleAt('content-design/route-loader.mjs');
  const { createContentExecutionCatalog } = await moduleAt('content-design/execution.mjs');
  const { createJourneyCatalog } = await moduleAt('journey/catalog.mjs');
  const { createMissionCard } = await moduleAt('content-design/mission-card.mjs');
  const sources = [];
  const add = (source, data) => sources.push({ source, data });
  const registerExecution = (source, data, mode) => {
    add(`${source}#source`, data);
    const executions = createContentExecutionCatalog(data, { mode });
    add(`${source}#executions/${mode}`, executions.entries);
    // Match the navigation adapters' exact serializable records, including
    // source ownership and mode. A same-named custom mission cannot opt in.
    const catalog = createJourneyCatalog(
      executions.journey().campaigns.map(({ packId, runtime, manifests }) => ({
        source: 'candidate',
        packId,
        id: runtime.id,
        title: mode === 'team' ? runtime.name : runtime.title,
        modes: [mode],
        levels: runtime.levels.map((level, index) => ({
          id: level.id,
          name: level.name,
          hook: manifests[index].design.routeDecision,
        })),
      })),
    );
    add(`${source}#navigation/${mode}`, catalog.missions);
    add(
      `${source}#cards/${mode}`,
      executions.entries.flatMap((entry) => entry.manifests.map(createMissionCard)),
    );
  };
  for (const id of new Set([DEFAULT_JOURNEY_ROUTES.solo, DEFAULT_JOURNEY_ROUTES.versus])) {
    const route = await loadAuthoredJourneyRoute(id);
    if (!route) throw new Error(`Unregistered default Journey route: ${id}`);
    add(`game/content-design/route-definition.mjs#${id}`, route);
    registerExecution(`game/content-design/route-definition.mjs#${id}`, route.source, 'solo');
    registerExecution(`game/content-design/route-definition.mjs#${id}`, route.source, 'versus');
  }
  // The current mission library also exposes three manually selectable v9
  // missions. Register its exact bounded navigation projection and full launch
  // records, which have different indices but retain their authored identities.
  const { spatialNextPriorEditionProjection } = await moduleAt(
    'mission-library/spatial-next-editions.mjs',
  );
  const prior = await loadAuthoredJourneyRoute('whole-spatial-v9');
  add('game/content-design/route-definition.mjs#whole-spatial-v9', prior);
  for (const mode of ['solo', 'versus']) {
    registerExecution(
      'game/content-design/route-definition.mjs#whole-spatial-v9',
      prior.source,
      mode,
    );
    registerExecution(
      'game/mission-library/spatial-next-editions.mjs#prior',
      spatialNextPriorEditionProjection(prior.source),
      mode,
    );
  }
  const themes = JSON.parse(
    await fs.readFile(path.join(root, 'game/content-design/themes.json'), 'utf8'),
  );
  const { journeyActorThemeCandidates } = await moduleAt(
    'presentation/journey-actor-materials.mjs',
  );
  add('game/content-design/themes.json', themes);
  add(
    'game/presentation/journey-actor-materials.mjs#themes',
    journeyActorThemeCandidates(themes.themes),
  );
  const { DIFFICULTY_CATALOG, PRESSURE_DIFFICULTY_CATALOG } = await moduleAt(
    'content-design/catalogs.mjs',
  );
  add('game/content-design/catalogs.mjs#difficulty', [
    DIFFICULTY_CATALOG,
    PRESSURE_DIFFICULTY_CATALOG,
  ]);
  const teamFactories = {
    'team-trail-impact-originals-1': [
      'team-impact-originals.mjs',
      'createTeamImpactOriginalCandidates',
    ],
    'team-spatial-originals-1': [
      'team-spatial-originals.mjs',
      'createTeamSpatialOriginalCandidates',
    ],
    'team-pressure-originals-1': [
      'team-pressure-originals.mjs',
      'createTeamPressureOriginalCandidates',
    ],
    'team-specialist-originals-1': [
      'team-specialist-originals.mjs',
      'createTeamSpecialistOriginalCandidates',
    ],
  };
  const team = teamFactories[DEFAULT_JOURNEY_ROUTES.team];
  if (!team) throw new Error(`Unregistered default Team route: ${DEFAULT_JOURNEY_ROUTES.team}`);
  const [file, factory] = team;
  const module = await moduleAt(`content-design/${file}`);
  registerExecution(`game/content-design/${file}#${factory}`, module[factory](), 'team');
  return sources;
}
export async function contentSources(root) {
  const sources = [];
  async function walk(relative) {
    for (const item of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
      const name = path.posix.join(relative, item.name);
      if (item.isDirectory()) await walk(name);
      else if (name.endsWith('.json'))
        sources.push({
          source: name,
          data: JSON.parse(await fs.readFile(path.join(root, name), 'utf8')),
        });
    }
  }
  await walk('game/content');
  const build = JSON.parse(await fs.readFile(path.join(root, 'game/build-config.json'), 'utf8'));
  const optionalCatalog = build.optionalChapters?.catalog
    ? JSON.parse(await fs.readFile(path.join(root, build.optionalChapters.catalog), 'utf8'))
    : { packs: [] };
  const optionalPaths = new Set([
    ...(build.optionalOffline ?? []),
    ...optionalCatalog.packs.map((pack) => pack.path),
  ]);
  // Match the exact immutable metadata emitted into the release's offline
  // marker. Merely naming an imported pack like a shipped one does not qualify.
  for (const file of optionalPaths) {
    const bytes = await fs.readFile(path.join(root, file));
    const pack = JSON.parse(bytes);
    sources.push({
      source: `${file}#offline`,
      data: {
        path: file,
        id: pack.id,
        name: pack.name,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      },
    });
  }
  sources.push({
    source: 'authoring/motion-lab/presets.json',
    data: JSON.parse(
      await fs.readFile(path.join(root, 'authoring/motion-lab/presets.json'), 'utf8'),
    ),
  });
  sources.push({
    source: 'game/first-flight.mjs#FIRST_FLIGHT_LESSONS',
    data: FIRST_FLIGHT_LESSONS,
  });
  sources.push({ source: 'game/enemy-catalog.mjs#ENEMY_CATALOG', data: ENEMY_CATALOG });
  const classes = JSON.parse(
    await fs.readFile(path.join(root, 'game/content/classes.json'), 'utf8'),
  );
  const originals = [...sources];
  for (const { source, data } of originals) {
    const campaigns = data.version === 'xonix-campaign.v1' ? [data] : data.campaigns || [];
    for (const campaign of campaigns) {
      if (!campaign.levels?.[0]?.version) continue;
      const classRecipes = (data.classRecipes || classes).filter(
        (recipe) => !campaign.classIds || campaign.classIds.includes(recipe.id),
      );
      const owned = { ...campaign, classRecipes };
      for (const mode of ['standard', 'gentle']) {
        try {
          sources.push({
            source: `${source}#${campaign.id}/${mode}`,
            data: createDifficultyContext(owned, mode).campaign,
          });
        } catch {
          /* Nonplayable catalogue summaries have no difficulty projection. */
        }
      }
    }
  }
  sources.push({ source: 'game/core/registry.mjs#CLASSES', data: CLASSES });
  sources.push({ source: 'game/coop/library.mjs#COOP_STARTER_PACK', data: COOP_STARTER_PACK });
  sources.push(...(await currentJourneySources(root)));
  return sources;
}
export async function extractContent(root, register) {
  const registry = {};
  function visit(value, source, pointer = '') {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((child, i) => visit(child, source, `${pointer}/${i}`));
      return;
    }
    const fields = {};
    function leaves(child, field) {
      if (
        typeof child === 'string' &&
        /[A-Za-z]/.test(child) &&
        !/^(?:#[a-fA-F0-9]{3,8}|data:.*|https?:.*|[a-z0-9]+(?:[._/-][a-z0-9]+)+)$/.test(child) &&
        child.length < 12000
      ) {
        fields[field] = {
          source: child,
          key: register(child, { file: source, pointer: `${pointer}/${field}` }),
        };
      } else if (Array.isArray(child)) child.forEach((item, i) => leaves(item, `${field}.${i}`));
      else if (child && typeof child === 'object')
        for (const [key, item] of Object.entries(child)) leaves(item, `${field}.${key}`);
    }
    for (const [key, child] of Object.entries(value)) {
      // Animation descriptors contain technical property names and colors.
      // Only an authored prose motion description is translatable.
      if (CONTENT_FIELDS.has(key) && (key !== 'motion' || typeof child === 'string'))
        leaves(child, key);
      if (key === 'metadata' && child?.description)
        leaves(child.description, 'metadata.description');
      if (key === 'design' && child && typeof child === 'object')
        for (const field of ['routeDecision', 'mastery'])
          if (typeof child[field] === 'string') leaves(child[field], `design.${field}`);
    }
    if (Object.keys(fields).length) {
      const identity = dataIdentity(value);
      registry[identity] = { fields, source, pointer };
      if (/^xonix-level\.v/.test(value.version || '')) {
        try {
          registry[dataIdentity(normalizedLevel(value))] = registry[identity];
        } catch {
          /* Nonlevel containers are not normalized. */
        }
      }
    }
    for (const [key, child] of Object.entries(value))
      if (key !== 'metadata' && !CONTENT_FIELDS.has(key)) visit(child, source, `${pointer}/${key}`);
  }
  for (const { source, data } of await contentSources(root)) visit(data, source);
  return registry;
}
