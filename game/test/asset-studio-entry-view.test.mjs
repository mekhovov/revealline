import test from 'node:test';
import assert from 'node:assert/strict';
import { studioEntryView } from '../../authoring/asset-studio/entry-view.mjs';
import { matchingSlots } from '../../authoring/asset-studio/helpers.mjs';
import { openContentStudioSection } from '../ui/content-studio-navigation.mjs';

const slots = [
  { id: 'player.fpv', group: 'players' },
  { id: 'audio.confirm', group: 'audio' },
  { id: 'audio.destroy-soft', group: 'audio' },
].map((slot) => ({ ...slot, label: slot.id, requirements: [], screens: [], states: [] }));

test('Sound Studio entry selects destruction and includes both native recipes and uploaded sounds', () => {
  const view = studioEntryView(
    'https://example.test/release/site/authoring/asset-studio/?studio=sounds&slot=player.fpv&workspace=foreign&return=https://other.test',
    slots,
  );
  assert.equal(view.selected, 'audio.destroy-soft');
  assert.deepEqual(view.filters, {
    query: 'audio.',
    screen: '',
    state: '',
    kind: '',
    quality: '',
  });
  const resolved = {
    assets: Object.fromEntries(
      slots.map((slot, index) => [
        slot.id,
        { kind: index === 2 ? 'audio' : 'recipe', quality: { stage: 'reviewed' } },
      ]),
    ),
  };
  assert.deepEqual(
    matchingSlots(slots, resolved, view.filters).map(({ id }) => id),
    ['audio.confirm', 'audio.destroy-soft'],
  );
  assert.equal(
    studioEntryView(
      'file:///site/authoring/asset-studio/index.html?studio=sounds',
      slots.slice(0, 2),
    ).selected,
    'audio.confirm',
    'Older custom workspaces still open their actual audio inventory.',
  );
});

test('Sound entry rejects ambiguous or unknown hints without inventing assets', () => {
  for (const href of [
    'invalid',
    'https://example.test/game/?studio=sounds',
    'https://example.test/authoring/asset-studio/?studio=sounds&studio=themes',
    'https://example.test/authoring/asset-studio/?studio=themes',
    'https://example.test/authoring/asset-studio/',
  ])
    assert.equal(studioEntryView(href, slots), null);
  assert.equal(
    studioEntryView('https://example.test/authoring/asset-studio/?studio=sounds', []),
    null,
  );
});

test('Voice Studio link opens only the fixed native disclosure and never starts a preview', () => {
  const section = { open: false, scrollIntoView: () => scrolled++ };
  let scrolled = 0;
  const document = {
    getElementById(id) {
      assert.equal(id, 'reaction-voice-editor-panel');
      return section;
    },
  };
  assert.equal(
    openContentStudioSection({
      document,
      href: 'https://example.test/edition/game/studio/index.html?lang=uk#reaction-voice-editor-panel',
    }),
    true,
  );
  assert.equal(section.open, true);
  assert.equal(scrolled, 1);
  for (const href of [
    'invalid',
    'https://example.test/game/studio/index.html#preview-panel',
    'https://example.test/game/studio/raid.html#reaction-voice-editor-panel',
    'https://example.test/game/studio/#https://other.test',
  ])
    assert.equal(openContentStudioSection({ document, href }), false);
  assert.equal(scrolled, 1);
});
