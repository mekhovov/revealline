import { OVERFLIGHT_BATTLEFIELDS } from '../overflight/battlefields.mjs';
import {
  createOverflightProject,
  compileOverflightProject,
  DEFAULT_OVERFLIGHT_PROJECT,
} from '../overflight/project.mjs';

export const SURVIVAL_DEMO_SEED = DEFAULT_OVERFLIGHT_PROJECT.seed;
const LAUNCH_MARKER = 'survival-demo';

/** The ordinary mission chooser uses this same authored catalog. No world/set cross product. */
export function survivalDemoInventory() {
  return OVERFLIGHT_BATTLEFIELDS.map((entry, index) => ({
    modeId: 'survival',
    id: `survival:${entry.id}:standard`,
    levelId: entry.id,
    levelKey: entry.id,
    variantId: 'standard',
    world: entry.world,
    title: entry.title,
    approachable: index === 0,
  }));
}

export function survivalDemoProject(entry) {
  const authored = OVERFLIGHT_BATTLEFIELDS.find(({ id }) => id === entry.levelId);
  if (!authored) throw new TypeError('Unknown authored Survival mission.');
  return createOverflightProject({
    rulesVersion: 4,
    layout: authored.id,
    world: authored.world,
    difficulty: 'standard',
    seed: SURVIVAL_DEMO_SEED,
  });
}

export function survivalDemoCompiled(entry) {
  return compileOverflightProject(survivalDemoProject(entry));
}

// These are the ordinary fresh-profile defaults, never the user's persisted options.
export const SURVIVAL_DEMO_OPTIONS = Object.freeze({
  airframes: 3,
  slowResume: true,
  flightTraits: false,
});

/** This finite marker selects an authored standard setup, never arbitrary options. */
export function survivalDemoLaunchURL(entry) {
  if (!OVERFLIGHT_BATTLEFIELDS.some((authored) => authored.id === entry?.levelId))
    throw new TypeError('Unknown authored Survival mission.');
  const url = new URL('../overflight/play.html', import.meta.url);
  url.searchParams.set('layout', entry.levelId);
  url.searchParams.set(LAUNCH_MARKER, 'standard');
  return url.href;
}

export function readSurvivalDemoLaunch(params) {
  if (
    params.getAll(LAUNCH_MARKER).length !== 1 ||
    params.get(LAUNCH_MARKER) !== 'standard' ||
    params.getAll('layout').length !== 1 ||
    ['community', 'studio', 'prototype', 'operation', 'fixture', 'reviewBuild'].some((key) =>
      params.has(key),
    )
  )
    return null;
  return survivalDemoInventory().find((entry) => entry.levelId === params.get('layout')) ?? null;
}

export function survivalDemoSessionOptions(options) {
  return { ...options, difficulty: 'standard', ...SURVIVAL_DEMO_OPTIONS };
}
