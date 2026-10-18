import { createHash } from 'node:crypto';

/** Demo recordings also need their exact ordinary source for admission and Fresh.
 * Sharing this finite dependency with an optional extra does not install a pack
 * or change whether an archived mission is discoverable in normal play. */
export function classicDemoSourcePaths(entries) {
  const byPath = new Map(entries.map((entry) => [entry.name, entry]));
  const catalog = byPath.get('game/demo-data/catalog.json');
  if (!catalog) return new Set();
  const index = byPath.get('game/content/mission-library-index.json');
  if (!index) throw new Error('Demo native dependencies need the ordinary mission index.');
  const { clips } = JSON.parse(catalog.bytes);
  const { missions } = JSON.parse(index.bytes);
  if (!Array.isArray(clips) || !Array.isArray(missions))
    throw new Error('Invalid demo native dependency metadata.');
  const paths = new Set();
  for (const clip of clips) {
    const matches = missions.filter(
      (mission) =>
        ['base', 'bundled', 'archived'].includes(mission.source) &&
        mission.campaignKey === clip.campaignKey &&
        mission.levelId === clip.levelId &&
        mission.modes?.includes('solo'),
    );
    if (matches.length !== 1) throw new Error(`Demo has no unique ordinary source: ${clip.id}`);
    const source = matches[0].sourceFile;
    const entry = byPath.get(source?.path);
    if (
      !entry ||
      entry.bytes.length !== source.bytes ||
      createHash('sha256').update(entry.bytes).digest('hex') !== source.sha256
    )
      throw new Error(`Demo ordinary source differs from its native identity: ${clip.id}`);
    paths.add(source.path);
  }
  return paths;
}
