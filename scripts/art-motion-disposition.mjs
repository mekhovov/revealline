#!/usr/bin/env node
/** Source-only C0/C7 work queue. Never rewrites runtime bindings or approvals. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../game/data-json.mjs';
import { validateAssetRevision } from '../game/presentation/model.mjs';
import { journeyActors } from '../game/content-design/catalogs.mjs';
import { createCombatCandidates } from '../game/content-design/combat-candidates.mjs';
import { buildActorCoverage } from './actor-coverage.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const ART_MOTION_DISPOSITION_PATH =
  'docs/verification/actor-motion/art-motion-disposition.json';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const identity = (value) => hash(canonicalJSON(value));
const unique = (items) => [...new Set(items)].sort();
const ordered = (a, b) => a.id.localeCompare(b.id, 'en');
const categories = new Set([
  'audio',
  'control',
  'effect',
  'enemy',
  'font',
  'hud',
  'icon',
  'pickup',
  'picture',
  'player',
  'reward',
  'scene',
  'screen',
  'team',
  'terrain',
  'trail',
  'ui',
]);
const evidencePaths = [
  'scripts/art-motion-disposition.mjs',
  'scripts/actor-coverage.mjs',
  'game/presentation/compiled/runtime.json',
  'authoring/motion-lab/presets.json',
  'game/presentation/journey-actor-materials.mjs',
  'game/ui/actor-presentation.mjs',
  'game/ui/render.mjs',
  'game/couch/coop-actor-presentation.mjs',
  'game/content-design/catalogs.mjs',
  'game/content-design/combat-candidates.mjs',
  'game/core/enemy-pressure.mjs',
  'game/core/combat-patrols.mjs',
  'game/test/content-pursuit-intercept.test.mjs',
  'game/test/content-combat.test.mjs',
  'game/test/combat-patrols.test.mjs',
  'game/test/team-pressure-originals.test.mjs',
];

/** Dispositions prescribe work, never infer visual acceptance from metadata. */
export const DISPOSITION_POLICIES = Object.freeze({
  'preserve-image': {
    disposition: 'Keep',
    reason:
      'Preserve the exact registered raster; its declared review stage is historical source evidence, not current whole-board approval.',
    next: 'Inspect silhouette, facing, contrast, overlaps and factual cues at actual size in each consuming mode before proposing a successor.',
  },
  'repair-player-proportions': {
    disposition: 'Repair',
    reason:
      'The registered Field Kit rig retains the small rotor proportions rejected in the current user review. Preserve the original body/revision while preparing a separately reviewed body and matching rig.',
    next: 'Compare the native reference-v2 candidate at 20/24/32 CSS pixels, four headings and held/moving states. Adopt only a reviewed successor; do not retrofit immutable anchors.',
    evidence: ['docs/drone-reference-review.md', 'docs/verification/rotor-motion/proportions.html'],
  },
  'repair-patrol-rig': {
    disposition: 'Repair',
    reason:
      'The prepared Field Kit patrol image has no registered rotor anchors. A runtime adapter or candidate does not change this registered metadata.',
    next: 'Review the prepared body and matching new rig together. Inspect historical/manual images for baked blades before adding any moving layer.',
    evidence: ['docs/actor-motion-live-baseline.md', 'docs/drone-reference-review.md'],
  },
  'review-component': {
    disposition: 'Review',
    reason:
      'A component/recipe binding is declared; metadata alone does not prove runtime consumption, visible motion, complete state playback or current review.',
    next: 'Trace the consuming painter and inspect normal, warning, active, recovery, pause and reduced-effects states where applicable; retain factual cues when decoration is disabled.',
  },
  'review-material': {
    disposition: 'Review',
    reason:
      'The current mission resolves a campaign material separately from the optional FPV body. A shared material is not evidence that every role/owner was visually inspected.',
    next: 'Review one instance of every distinct role/runtime/material binding, then its owner boards for clipping, markers and visual overlap. Preserve simulation identity.',
  },
  'review-fpv-selection': {
    disposition: 'Review',
    reason:
      'The current source records an available FPV body slot; explicit appearances, uploads and retained choices can override it. Per-player selection is not read by this audit.',
    next: 'Inspect the actual appearance chosen by each host, including inherited Team states; record the selected asset/rig identity alongside rendered evidence.',
  },
  'preserve-artwork': {
    disposition: 'Keep',
    reason:
      'Preserve this mission-owned artwork identity and exact original. Candidate/source review labels are not promoted by this report.',
    next: 'Check reveal mask, contain/cover, complete reveal and Retry/gallery restoration on each owner; verify original bytes separately before adoption.',
  },
  'repair-missing': {
    disposition: 'Repair',
    reason:
      'A current actor or player binding requests a compiled slot absent from the supplied compiled metadata.',
    next: 'Resolve the missing binding or document an intentional supported fallback; regenerate and verify before visual qualification.',
  },
  'review-unknown': {
    disposition: 'Review',
    reason:
      'This slot/category or ownership scope is not classified by the bounded audit. Unknown does not mean unused, absent or approved.',
    next: 'Add an explicit reader/classification and a regression case, or record a scoped manual inspection with exact source and owner identities.',
  },
});

export function artMotionPolicy(slot, source) {
  const asset = validateAssetRevision(source);
  if (!categories.has(slot.split('.')[0])) return 'review-unknown';
  if (
    /^player\.[^.]+\.(compact|detailed)$/.test(slot) &&
    asset.id === `${slot}.field-kit` &&
    asset.kind === 'image' &&
    asset.geometry.rotorAnchors.some((anchor) => anchor.radius <= 0.12)
  )
    return 'repair-player-proportions';
  if (
    slot === 'enemy.border-patrol' &&
    asset.id === `${slot}.field-kit` &&
    asset.kind === 'image' &&
    !asset.geometry.rotorAnchors.length
  )
    return 'repair-patrol-rig';
  return asset.kind === 'image' && asset.quality.stage === 'reviewed'
    ? 'preserve-image'
    : 'review-component';
}

function workRow(id, policy, fields) {
  return { id, ...fields, disposition: DISPOSITION_POLICIES[policy].disposition, policy };
}

export async function buildArtMotionDisposition({
  root = ROOT,
  coverage,
  compiled,
  combatSource = createCombatCandidates(),
} = {}) {
  coverage ??= await buildActorCoverage({ root });
  compiled ??= JSON.parse(
    await fs.readFile(path.join(root, 'game/presentation/compiled/runtime.json'), 'utf8'),
  );
  const sources = await Promise.all(
    evidencePaths.map(async (file) => ({
      path: file,
      sha256: hash(await fs.readFile(path.join(root, file))),
    })),
  );
  const assets = Object.entries(compiled.resolved.assets)
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([slot, source]) => {
      const asset = validateAssetRevision(source),
        binding = compiled.resolved.bindings[slot];
      if (binding?.id !== asset.id || binding?.revision !== asset.revision)
        throw new Error(`Compiled binding identity mismatch: ${slot}`);
      return workRow(slot, artMotionPolicy(slot, asset), {
        category: slot.split('.')[0],
        asset: {
          id: asset.id,
          revision: asset.revision,
          kind: asset.kind,
          metadataSha256: identity(asset),
        },
        file: asset.file
          ? {
              ...asset.file,
              url: compiled.urls[asset.file.sha256] ?? null,
            }
          : null,
        geometry: asset.geometry,
        recipe: asset.recipe,
        declaredSourceStage: asset.quality.stage,
        sourceReviewSha256: identity(asset.quality),
        scope: 'compiled-library-capability; not per-mission selection',
      });
    });
  const bySlot = new Map(assets.map((asset) => [asset.id, asset]));
  const actorGroups = new Map(),
    artworkGroups = new Map(),
    missingSlots = new Set();
  const owners = coverage.missions
    .map((mission) => {
      const { actors, ...owner } = mission;
      const ownerId = `owner-${identity([mission.mode, mission.route, mission.campaignId, mission.missionId]).slice(0, 16)}`;
      for (const actor of actors) {
        const binding = {
          mode: mission.mode,
          role: actor.role,
          runtimeType: actor.runtimeType,
          themeId: mission.themeId,
          campaignMaterialId: mission.campaignMaterialId,
          fpvBodySlot: actor.fpvBodySlot,
          optionalCombatRole: actor.optionalCombatRole ?? null,
        };
        const key = identity(binding);
        if (!actorGroups.has(key))
          actorGroups.set(
            key,
            workRow(
              `actor-${key.slice(0, 16)}`,
              mission.campaignMaterialId ? 'review-material' : 'review-fpv-selection',
              { ...binding, owners: [] },
            ),
          );
        actorGroups.get(key).owners.push({ owner: ownerId, actorId: actor.id });
        if (actor.fpvBodySlot && !bySlot.has(actor.fpvBodySlot))
          missingSlots.add(actor.fpvBodySlot);
      }
      if (mission.artwork) {
        const key = identity(mission.artwork);
        if (!artworkGroups.has(key))
          artworkGroups.set(
            key,
            workRow(`artwork-${key.slice(0, 16)}`, 'preserve-artwork', {
              artwork: mission.artwork,
              owners: [],
            }),
          );
        artworkGroups.get(key).owners.push(ownerId);
      }
      return { id: ownerId, ...owner };
    })
    .sort(ordered);
  const actorBindings = [...actorGroups.values()].sort(ordered);
  const artworkBindings = [...artworkGroups.values()].sort(ordered);
  const playerBindings = coverage.playerRoles
    .map((role) => {
      for (const slot of role.slots) if (!bySlot.has(slot)) missingSlots.add(slot);
      return workRow(`player-${role.role}`, 'review-fpv-selection', {
        ...role,
        scope: 'available class appearance; per-mission/player choice unknown',
      });
    })
    .sort(ordered);
  const catalogs = coverage.routes.map((route) => ({
    mode: route.mode,
    id: route.actorCatalog,
    roles: journeyActors(route.actorCatalog).roles,
  }));
  const behaviorCoverage = [
    'trail-pursuer',
    'heading-interceptor',
    'optional-scout',
    'optional-sentry',
    'impact-carrier',
  ].map((role) => ({
    role,
    declaredCatalogs: unique(
      catalogs.filter((catalog) => catalog.roles[role]).map((catalog) => catalog.id),
    ),
    authoredPlacementsByMode: Object.fromEntries(
      ['solo', 'versus', 'team'].map((mode) => [
        mode,
        coverage.missions
          .filter((mission) => mission.mode === mode)
          .reduce(
            (count, mission) =>
              count + mission.actors.filter((actor) => actor.role === role).length,
            0,
          ),
      ]),
    ),
    optionalStudyMissions: combatSource.missions
      .filter((mission) => mission.actors.some((actor) => actor.role === role))
      .map((mission) => mission.id)
      .sort(),
    next: role.startsWith('optional-')
      ? 'Existing optional runtime/authoring and greybox studies are source evidence. Qualify deliberate opt-in, teaching, replay, score identity, appearance and mode support before any route adoption; do not invent a new attack.'
      : 'Review existing warning/commit/recovery and capture cancellation in current owner boards. Authored-role counts do not enumerate effective tuning or Team specialist recipes.',
  }));
  const unknownCoverage = [
    [
      'manual-appearances',
      'Browser/player uploads and manual actor, background or recipe overrides are not read.',
      'Inspect accepted selections and preserved originals in each real host; retain precedence on Retry/replay.',
    ],
    [
      'retained-attempts',
      'Stored/replayed attempts may pin earlier bindings outside current defaults.',
      'Inventory exact retained appearance/source identities without rewriting their approvals or original bytes.',
    ],
    [
      'explicit-content',
      'Historical, explicitly addressed, installed/imported and community editions are outside current queryless owners.',
      'Run their real source resolvers and append explicit owner cohorts; do not substitute equal mission counts.',
    ],
    [
      'effective-configurations',
      'Difficulty, specialist/team recipes and player setup can change effective behavior/appearance.',
      'Enumerate actual accepted configurations separately; authored roles alone cannot prove absence of an attack.',
    ],
    [
      'rendered-and-device',
      'Image decoding, rendered motion, frame cost, memory, download cost, devices and human sessions are not measured.',
      'Attach exact-source visual/performance/play evidence; source reproduction alone cannot close C0/C7.',
    ],
  ].map(([id, reason, next]) => ({
    id,
    disposition: 'Review',
    coverage: 'unknown',
    count: null,
    reason,
    next,
  }));
  const missingBindings = [...missingSlots]
    .sort()
    .map((slot) => workRow(slot, 'repair-missing', {}));
  const all = [
    ...assets,
    ...actorBindings,
    ...artworkBindings,
    ...playerBindings,
    ...missingBindings,
    ...unknownCoverage,
  ];
  return {
    format: 'revealline-art-motion-disposition.v1',
    scope: 'source disposition work queue; no visual, gameplay, device or release approval',
    coverageSha256: identity(coverage),
    compiledSha256: identity(compiled),
    defaults: coverage.defaults,
    routes: coverage.routes,
    sources,
    policies: DISPOSITION_POLICIES,
    dispositionMeaning: {
      Keep: 'Preserve exact source; still perform the listed review.',
      Repair:
        'Concrete source or current-review gap; prepare a compatible, separately reviewed correction.',
      Review: 'Evidence or ownership is incomplete; inspect the listed scope.',
      Replace:
        'Requires a recorded visual rejection, exact replacement revision and retained compatibility; never selected automatically here.',
    },
    summary: {
      ownerMissions: owners.length,
      authoredActorPlacements: actorBindings.reduce((n, row) => n + row.owners.length, 0),
      distinctActorBindings: actorBindings.length,
      distinctMissionArtworks: artworkBindings.length,
      compiledBindings: assets.length,
      compiledCategories: Object.fromEntries(
        [...categories]
          .sort()
          .map((category) => [
            category,
            assets.filter((asset) => asset.category === category).length,
          ]),
      ),
      dispositions: Object.fromEntries(
        ['Keep', 'Repair', 'Review', 'Replace'].map((value) => [
          value,
          all.filter((row) => row.disposition === value).length,
        ]),
      ),
      missingSlots: [...missingSlots].sort(),
      unknownScopes: unknownCoverage.length,
      visualApproval: false,
    },
    owners,
    actorBindings,
    playerBindings,
    artworkBindings,
    assets,
    missingBindings,
    behaviorCoverage: {
      scope:
        'C4 existing source capabilities and authored placement, not complete configuration or gameplay acceptance',
      optionalStudy: {
        id: combatSource.id,
        revision: combatSource.revision,
        sourceSha256: identity(combatSource),
        classification: 'unqualified-greybox; not default or published by this report',
      },
      roles: behaviorCoverage,
      evidence: [
        'game/core/enemy-pressure.mjs',
        'game/core/combat-patrols.mjs',
        'game/content-design/combat-candidates.mjs',
        'game/test/content-pursuit-intercept.test.mjs',
        'game/test/content-combat.test.mjs',
        'game/test/combat-patrols.test.mjs',
        'game/test/team-pressure-originals.test.mjs',
      ],
      testStatus:
        'test files discovered; their existence does not claim execution or a passing result',
    },
    unknownCoverage,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] ?? '--summary';
  if (!['--summary', '--write', '--check'].includes(mode) || process.argv.length > 3)
    throw new Error('Usage: art-motion-disposition.mjs [--summary|--write|--check]');
  const report = await buildArtMotionDisposition();
  if (mode !== '--summary') {
    const output = path.join(ROOT, ART_MOTION_DISPOSITION_PATH),
      bytes = `${canonicalJSON(report)}\n`;
    if (mode === '--write') {
      await fs.mkdir(path.dirname(output), { recursive: true });
      await fs.writeFile(output, bytes);
    } else if ((await fs.readFile(output, 'utf8')) !== bytes)
      throw new Error(
        'Art/motion disposition drift: regenerate and inspect changed identities and work items.',
      );
  }
  console.log(JSON.stringify(report.summary, null, 2));
}
