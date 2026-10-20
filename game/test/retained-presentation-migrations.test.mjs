import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PRESENTATION_SUCCESSORS, migratePresentationHash } from '../presentation/retained-migrations.mjs';
import { snapshotActorAppearancePin } from '../presentation/actor-appearance-pin.mjs';
import { snapshotVisualThemePin } from '../presentation/visual-theme-pin.mjs';
import { validateCompiledPresentation } from '../presentation/host.mjs';

const content = {
  editionId: 'field-kit', contentThemeId: 'fpv', mode: 'solo',
  owner: { kind: 'campaign', baseCampaignKey: 'first-signal/2/88639f3aab7b6cc1' },
  level: { id: 'signal-01', revision: '1', sha256: 'a'.repeat(64) },
};

test('retained save pins migrate to authenticated successors without changing content or caller data', async () => {
  assert.equal(Object.keys(PRESENTATION_SUCCESSORS).length, 13);
  for (const [previous, next] of Object.entries(PRESENTATION_SUCCESSORS)) {
    const bytes = await readFile(new URL(`../presentation/compiled/runtime.${next}.json`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), next);
    const runtime = validateCompiledPresentation(JSON.parse(bytes));
    const presentation = { source: runtime.source, theme: { id: runtime.resolved.theme.id, revision: runtime.resolved.theme.revision }, collection: runtime.resolved.collection, sha256: previous };
    const actor = { format: 'revealline-actor-appearance-pin.v1', style: 'fpv', rendererPolicy: 'actor-style.v1', content, presentation };
    const visual = { format: 'revealline-visual-theme-pin.v1', content, selection: { id: 'field-kit-fpv', revision: runtime.resolved.theme.revision }, presentation };
    for (const [input, snapshot] of [[actor, snapshotActorAppearancePin], [visual, snapshotVisualThemePin]]) {
      const migrated = snapshot(JSON.stringify(input));
      assert.deepEqual(migrated.content, content);
      assert.equal(migrated.presentation.sha256, next);
      assert.deepEqual(migrated.presentation.theme, presentation.theme);
      assert.equal(input.presentation.sha256, previous);
      assert.deepEqual(snapshot(JSON.stringify(migrated)), migrated);
    }
  }
});

test('unknown and already current presentation hashes have no fallback', () => {
  const unknown = '0'.repeat(64);
  assert.equal(migratePresentationHash(unknown), unknown);
  for (const current of Object.values(PRESENTATION_SUCCESSORS)) assert.equal(migratePresentationHash(current), current);
});
