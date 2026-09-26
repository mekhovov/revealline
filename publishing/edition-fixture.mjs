import { createEditionCandidate, editionJSON } from './edition-candidate.mjs';
import { editionAppIdentity } from '../game/edition-context.mjs';

/** Tiny complete candidate shared by admission and promotion failure tests. */
export function editionAdmissionFixture({
  version = 'v0.140.0',
  editionId = 'coupa',
  basePath = '/revealline/',
} = {}) {
  const sourceRevision = 'a'.repeat(40),
    sourceTree = 'b'.repeat(40);
  const catalog = {
    editions: [{ id: editionId }],
    campaigns: [
      { id: `${editionId}-missions`, revision: '1', sourcePath: 'game/content/campaign.json' },
    ],
    assets: [],
  };
  const identity = editionAppIdentity({ editionId, basePath });
  const sourceFiles = new Map([
    ['game/company.html', Buffer.from('<html>game</html>')],
    ['game/content/campaign.json', editionJSON({ missions: [] })],
  ]);
  const runtime = new Map([
    ...sourceFiles,
    ['edition-catalog.json', editionJSON(catalog)],
    [
      'app/manifest.webmanifest',
      editionJSON({ ...identity, name: 'Example edition', display: 'standalone' }),
    ],
    [
      'app/current.json',
      editionJSON({ editionId, version, scope: '../', entry: 'game/company.html' }),
    ],
    ['app/index.html', Buffer.from('<html>Install edition</html>')],
    ['app/app.mjs', Buffer.from('export const fixture = true;')],
    ['app/service-worker.js', Buffer.from('/* fixture launcher */')],
    ['service-worker.js', Buffer.from('/* fixture game */')],
  ]);
  const { edition, files } = createEditionCandidate({
    compiled: { files: runtime, runtimeCatalog: catalog },
    sourceFiles,
    version,
    sourceRevision,
    sourceTree,
  });
  const envelope = {
    format: 'revealline-editions.v1',
    version,
    sourceRevision,
    sourceTree,
    editions: [edition],
  };
  files.set('editions.json', editionJSON(envelope));
  return {
    envelope,
    files,
    runtime,
    sourceFiles,
    catalog,
    read: async (descriptor) => files.get(descriptor.path),
  };
}
