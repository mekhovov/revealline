import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { reviseStudioTheme } from '../presentation/studio-session.mjs';
import { createWorkspaceSpecimenHost } from '../../authoring/asset-studio/arcade-specimen.mjs';

function workspace() {
  const runtime = JSON.parse(
    readFileSync(new URL('../presentation/compiled/runtime.json', import.meta.url)),
  );
  const asset = structuredClone(runtime.resolved.assets['terrain.wall']);
  asset.id = 'workspace-custom-wall';
  asset.revision = 1;
  asset.provenance.parent = null;
  const source = reviseStudioTheme(createDefaultThemeBundle(), {
    tokens: { amber: '#edc978', panel: '#252d27' },
    assets: [asset],
    bindings: { 'terrain.wall': { id: asset.id, revision: asset.revision } },
  });
  const blob = new Blob(
    [
      readFileSync(
        new URL(`../presentation/compiled/assets/${asset.file.sha256}.png`, import.meta.url),
      ),
    ],
    { type: asset.file.mime },
  );
  const assets = new Map([[asset.file.sha256, blob]]);
  const document = {
    baseURI: 'https://example.test/authoring/asset-studio/',
    querySelector: () => null,
  };
  return { source, asset, assets, document };
}

test('arcade specimen prepares exact selected workspace tokens and custom artwork through runtime host', async () => {
  const fixture = workspace();
  const before = structuredClone(fixture.source);
  let closes = 0;
  const host = createWorkspaceSpecimenHost({
    ...fixture,
    decodeImage: async () => ({
      width: fixture.asset.file.width,
      height: fixture.asset.file.height,
      close() {
        closes++;
      },
    }),
  });
  const snapshot = await host.load();
  assert.equal(snapshot.resolved.tokens.panel, '#252d27');
  assert.equal(snapshot.resolved.tokens.amber, '#edc978');
  assert.equal(snapshot.image('terrain.wall').asset.id, 'workspace-custom-wall');
  assert.equal(snapshot.image('terrain.wall').asset.revision, 1);
  assert.deepEqual(fixture.source, before);
  host.close();
  assert.equal(closes, 1);
});

test('arcade specimen refuses missing or changed source bytes instead of substituting published art', async () => {
  const fixture = workspace();
  assert.throws(
    () => createWorkspaceSpecimenHost({ ...fixture, assets: new Map() }),
    /Workspace preview asset unavailable/,
  );
  const original = fixture.assets.get(fixture.asset.file.sha256);
  const bytes = new Uint8Array(await original.arrayBuffer());
  bytes[bytes.length - 1] ^= 1;
  fixture.assets.set(fixture.asset.file.sha256, new Blob([bytes], { type: original.type }));
  const host = createWorkspaceSpecimenHost(fixture);
  await assert.rejects(host.load(), /asset hash mismatch/);
  host.close();
});
