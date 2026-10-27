import { createHash } from 'node:crypto';
import { open, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJSON } from '../game/data-json.mjs';

export const REMOTE_TEAM_NAVIGATION_FORMAT = 'revealline-remote-team-display.v1';
export const REMOTE_TEAM_NAVIGATION_MAX_BYTES = 4 * 1024 * 1024;
const ROOT = new URL('../', import.meta.url);
const targets = Object.freeze({
  cultural: Object.freeze({
    module: 'game/content-design/team-cultural-specialist-v2-originals.mjs',
    factory: 'createTeamCulturalSpecialistV2OriginalCandidates',
    editionId: 'team-cultural-specialist-originals-2',
  }),
  expedition: Object.freeze({
    module: 'game/content-design/multiplayer-expansion.mjs',
    factory: 'createTeamExpansionCandidates',
    editionId: 'team-expedition-v1',
  }),
  hunt: Object.freeze({
    module: 'game/content-design/team-hunt-training-candidates.mjs',
    factory: 'createTeamHuntTrainingCandidates',
    editionId: 'humanoid-hunt-v1',
  }),
});
export const REMOTE_TEAM_NAVIGATION_TARGETS = Object.freeze(Object.keys(targets));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const requireValue = (condition, message) => {
  if (!condition) throw new TypeError(message);
};
const exactKeys = (value, keys) =>
  record(value) && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');

/** Explicit first-party authoring targets only; no imported source or route admission. */
export function remoteTeamNavigationTarget(target) {
  requireValue(Object.hasOwn(targets, target), 'Choose one registered remote Team target.');
  return targets[target];
}

/** The public factories still return independently editable source objects. */
export async function loadRemoteTeamNavigationSource(target) {
  const descriptor = remoteTeamNavigationTarget(target);
  const module = await import(new URL(descriptor.module, ROOT));
  return module[descriptor.factory]();
}

/** Receipt-only entrypoint pins; whole-main/translation/tooling revisions never enter display bytes.
 * The hosted receipt separately pins full source commit/tree and the input/dependency closure. */
export async function remoteTeamNavigationCodeOwners(target) {
  const paths = [
    'scripts/remote-team-navigation.mjs',
    'scripts/published-navigation.mjs',
    'game/content-design/project.mjs',
    'game/content-design/execution.mjs',
    'game/content-design/journey.mjs',
    'game/content-design/mission-card.mjs',
    'game/mission-library/journey-presentation.mjs',
    'game/mission-library/team-source.mjs',
    'game/mission-library/supplemental-hunt.mjs',
    'game/mission-library/multiplayer-expeditions.mjs',
    'game/mission-library/library.mjs',
    'game/mission-library/handoff.mjs',
    'game/content-design/default-entry.mjs',
    'game/i18n/content-registry.mjs',
    'package-lock.json',
    remoteTeamNavigationTarget(target).module,
  ].sort();
  return Promise.all(
    paths.map(async (path) => ({ path, sha256: digest(await readFile(new URL(path, ROOT))) })),
  );
}

/** Authoring-time compilation only. This module is not imported by a gameplay host. */
export async function createRemoteTeamNavigation(target) {
  const descriptor = remoteTeamNavigationTarget(target);
  const source = await loadRemoteTeamNavigationSource(target);
  const { buildJourneyView, projectHash } = await import('./published-navigation.mjs');
  const cards = {};
  const { campaigns, presentations, ordinals } = buildJourneyView(source, 'team', cards);
  for (const presets of Object.values(presentations)) {
    for (const presentation of Object.values(presets)) {
      presentation.translations = Object.fromEntries(
        Object.entries(presentation.translations).map(([field, value]) => {
          requireValue(
            typeof value.key === 'string' && value.key.length > 0,
            'Team display translation needs an existing live message key.',
          );
          return [field, { source: value.source, key: value.key }];
        }),
      );
    }
  }
  const result = {
    format: REMOTE_TEAM_NAVIGATION_FORMAT,
    target,
    mode: 'team',
    editionId: descriptor.editionId,
    factory: descriptor.factory,
    project: { id: source.id, revision: source.revision, sha256: projectHash(source) },
    view: { campaigns, presentations, ordinals },
    cards,
  };
  encodeRemoteTeamNavigation(result);
  return result;
}

/** Canonical display bytes contain no executable packs, native rows, media or progress. */
export function encodeRemoteTeamNavigation(value) {
  const bytes = Buffer.from(`${canonicalJSON(value)}\n`, 'utf8');
  requireValue(
    bytes.length <= REMOTE_TEAM_NAVIGATION_MAX_BYTES,
    'Remote Team display exceeds the 4 MiB review bound.',
  );
  return bytes;
}

/** Structural inspection is NOT runtime trust/admission; checking regenerates authority. */
export function inspectRemoteTeamNavigation(bytes, target) {
  const descriptor = remoteTeamNavigationTarget(target);
  requireValue(
    Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= REMOTE_TEAM_NAVIGATION_MAX_BYTES,
    'Use bounded remote Team display bytes.',
  );
  const value = JSON.parse(bytes.toString('utf8'));
  requireValue(
    exactKeys(value, [
      'format',
      'target',
      'mode',
      'editionId',
      'factory',
      'project',
      'view',
      'cards',
    ]),
    'Unexpected remote Team display fields.',
  );
  requireValue(
    value.format === REMOTE_TEAM_NAVIGATION_FORMAT &&
      value.target === target &&
      value.mode === 'team' &&
      value.editionId === descriptor.editionId,
    'Remote Team display target does not match.',
  );
  requireValue(value.factory === descriptor.factory, 'Remote Team display factory does not match.');
  requireValue(
    exactKeys(value.project, ['id', 'revision', 'sha256']) &&
      typeof value.project.id === 'string' &&
      value.project.id.length > 0 &&
      value.project.id.length <= 512 &&
      typeof value.project.revision === 'string' &&
      value.project.revision.length > 0 &&
      value.project.revision.length <= 512 &&
      /^[a-f0-9]{64}$/.test(value.project.sha256),
    'Remote Team display needs exact source provenance.',
  );
  requireValue(
    exactKeys(value.view, ['campaigns', 'presentations', 'ordinals']) &&
      Array.isArray(value.view.campaigns) &&
      value.view.campaigns.length > 0 &&
      record(value.view.presentations) &&
      record(value.view.ordinals) &&
      record(value.cards),
    'Remote Team display needs navigation and diagram metadata.',
  );
  requireValue(
    encodeRemoteTeamNavigation(value).equals(bytes),
    'Remote Team display must use exact canonical bytes.',
  );
  return value;
}

/** No output rewrite: compare current registered source and its complete display projection. */
export async function checkRemoteTeamNavigation(bytes, target) {
  inspectRemoteTeamNavigation(bytes, target);
  const expected = encodeRemoteTeamNavigation(await createRemoteTeamNavigation(target));
  requireValue(
    expected.equals(bytes),
    'Remote Team display differs from the registered current authoring source.',
  );
  return {
    target,
    bytes: bytes.length,
    sha256: digest(bytes),
    codeOwners: await remoteTeamNavigationCodeOwners(target),
  };
}

async function boundedFile(path) {
  const handle = await open(path, 'r');
  try {
    const bytes = Buffer.alloc(REMOTE_TEAM_NAVIGATION_MAX_BYTES + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, null);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    requireValue(
      offset <= REMOTE_TEAM_NAVIGATION_MAX_BYTES,
      'Remote Team display exceeds the 4 MiB review bound.',
    );
    return bytes.subarray(0, offset);
  } finally {
    await handle.close();
  }
}

export async function runRemoteTeamNavigationCLI(args) {
  requireValue(
    args.length === 3 && ['produce', 'check'].includes(args[0]),
    'Usage: node scripts/remote-team-navigation.mjs produce|check cultural|expedition|hunt FILE',
  );
  const [operation, target, path] = args;
  remoteTeamNavigationTarget(target);
  if (operation === 'check')
    return { operation, ...(await checkRemoteTeamNavigation(await boundedFile(path), target)) };
  const bytes = encodeRemoteTeamNavigation(await createRemoteTeamNavigation(target));
  inspectRemoteTeamNavigation(bytes, target);
  await writeFile(path, bytes, { flag: 'wx' });
  return {
    operation,
    target,
    bytes: bytes.length,
    sha256: digest(bytes),
    codeOwners: await remoteTeamNavigationCodeOwners(target),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await runRemoteTeamNavigationCLI(process.argv.slice(2))));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
