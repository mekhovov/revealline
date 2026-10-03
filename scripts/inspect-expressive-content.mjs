import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { format, resolveConfig } from 'prettier';
import { createPursuitCampaignCandidates } from '../game/content-design/pursuit-campaign-candidates.mjs';
import { createContentExecutionCatalog } from '../game/content-design/execution.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../game/gameplay-tuning.mjs';
import { CLASSIC_SNAKE_V3_LEVELS } from '../game/snake/classic-catalogue-v3.mjs';
import { prepareClassicSnakeLevel } from '../game/snake/classic-setup.mjs';
import { validateClassicSnakeLevel } from '../game/snake/classic-core.mjs';
import { EXPRESSIVE_HUNT_COURSES } from '../optional-practice/civilian-fpv/expressive-hunt-courses.mjs';
import { validateWorldCourse } from '../optional-practice/civilian-fpv/world-model.mjs';
import {
  ACTOR_FAMILIES,
  ACTOR_CASTS,
  ACTOR_VISUALS,
  ACTOR_ART_BUDGET,
} from '../game/hunt/actor-catalog.mjs';

const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const qualification = (seed) => ({
  structuralAdmission: 'accepted',
  proposedQualificationSeed: seed,
  demonstratedCompletionRoute: null,
  humanPlay: 'pending',
  deviceAndPerformance: 'pending',
  studioRoundTrip: 'pending-manual-review',
  publicRelease: 'not-qualified',
});

/** Native content admission and a review inventory. Does not execute gameplay or test suites. */
export function inspectExpressiveContent() {
  const layouts = [];
  for (const team of [false, true]) {
    const source = createPursuitCampaignCandidates({ team });
    const modes = team ? ['team'] : ['solo', 'versus'];
    const catalogs = modes.map((mode) => ({
      mode,
      catalog: createContentExecutionCatalog(source, { mode }),
    }));
    for (const mission of source.missions) {
      const recipes = [];
      for (const { mode, catalog } of catalogs) {
        for (const entry of catalog.entries) {
          const level = entry.campaign.levels.find((candidate) => candidate.id === mission.id);
          if (!level) continue;
          const accepted = applyGameplayTuning(level, resolveGameplayTuning(entry.difficulty));
          recipes.push({
            mode,
            pace: entry.difficulty,
            format: accepted.version,
            identity: digest(accepted),
            campaign: entry.campaignId,
          });
        }
      }
      if (!recipes.length) throw new Error(`No admitted recipes for ${mission.id}`);
      layouts.push({
        family: team ? 'Capture Team' : 'Capture Solo / Versus',
        id: mission.id,
        revision: mission.revision,
        title: mission.name,
        challenge: mission.design.routeDecision,
        provenance: { owner: 'official-candidate', source: source.id, format: mission.format },
        modes,
        recipes,
        launch: `/game/${team ? 'couch/relay-rescue.html' : ''}?journey=pursuit-campaigns-v1`,
        qualification: qualification(17),
      });
    }
  }
  for (const entry of CLASSIC_SNAKE_V3_LEVELS) {
    const recipes = ['slow', 'normal', 'fast'].map((pace) => {
      const accepted = validateClassicSnakeLevel(prepareClassicSnakeLevel(entry, { pace }));
      return { pace, format: accepted.version, identity: digest(accepted) };
    });
    layouts.push({
      family: 'Classic Snake',
      id: entry.id,
      revision: entry.level.revision,
      title: entry.title.en,
      titleUk: entry.title.uk,
      challenge: entry.description.en,
      provenance: {
        owner: 'official-catalogue',
        source: entry.chapterId,
        format: entry.level.version,
      },
      modes: ['solo', 'versus', 'team'],
      recipes,
      launch: `/game/snake/play.html?mode=solo&level=${entry.id}&targets=authored&board=retro&seed=17`,
      qualification: qualification(17),
    });
  }
  for (const course of EXPRESSIVE_HUNT_COURSES) {
    const accepted = validateWorldCourse(course);
    layouts.push({
      family: 'FPV SIM',
      id: accepted.id,
      revision: accepted.revision,
      title: accepted.locales.en.title,
      titleUk: accepted.locales.uk.title,
      challenge: accepted.locales.en.brief,
      provenance: {
        owner: 'official-optional-package',
        source: 'civilian-fpv',
        format: accepted.format,
      },
      modes: ['self-level', 'acro'],
      recipes: [{ format: accepted.format, identity: digest(accepted) }],
      launch: '/game/snake/#sim-title',
      qualification: qualification(accepted.rules.seed),
    });
  }
  return {
    format: 'expressive-content-inventory.v1',
    scope:
      'Source admission only; no completion, enjoyment, network or release qualification is implied.',
    counts: Object.fromEntries(
      [...new Set(layouts.map((layout) => layout.family))].map((family) => [
        family,
        layouts.filter((layout) => layout.family === family).length,
      ]),
    ),
    totalLayouts: layouts.length,
    actors: {
      families: ACTOR_FAMILIES.map(({ id }) => id),
      casts: ACTOR_CASTS.map(({ id }) => id),
      variants: ACTOR_VISUALS.length,
      artworkBudget: ACTOR_ART_BUDGET,
    },
    layouts,
  };
}

function markdown(report) {
  return `# Expressive pursuit content inventory\n\nGenerated by \`scripts/inspect-expressive-content.mjs\` using native content validators. ${report.scope}\n\n${report.totalLayouts} new layouts. Every row is a draft pending a demonstrated completion route, device/controller review and public-release qualification. Candidate Capture progress remains separate from the released Journey.\n\n| Family | Level | ID | Modes | Qualification seed |\n| --- | --- | --- | --- | --- |\n${report.layouts.map((row) => `| ${row.family} | ${row.title} | \`${row.id}\` | ${row.modes.join(', ')} | ${row.qualification.proposedQualificationSeed} |`).join('\n')}\n\nThe JSON companion records every admitted recipe identity, pace, source owner and the outstanding qualification fields. Seeds are proposed review seeds, not claims of successful play. Casts, gore and Retro Field do not change these gameplay identities.\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const report = inspectExpressiveContent();
  const destination = process.argv[2];
  if (destination) {
    await mkdir(destination, { recursive: true });
    const formatting = (await resolveConfig(import.meta.filename)) ?? {};
    await writeFile(
      path.join(destination, 'expressive-content-inventory.json'),
      await format(JSON.stringify(report), { ...formatting, parser: 'json' }),
    );
    await writeFile(
      path.join(destination, 'expressive-content-inventory.md'),
      await format(markdown(report), { ...formatting, parser: 'markdown' }),
    );
  }
  console.log(
    JSON.stringify(
      {
        totalLayouts: report.totalLayouts,
        counts: report.counts,
        actorVariants: report.actors.variants,
        qualification: 'pending-human-review',
      },
      null,
      2,
    ),
  );
}
