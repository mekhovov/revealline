import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createExplorationExample } from '../studio/exploration-example.mjs';
import { createExplorationEditor } from '../studio/exploration-editor.mjs';
import { mountLocalExplorationPreview } from '../studio/exploration-image-preview.mjs';
import { createStudioReward } from '../../authoring/company-studio/reward-editor.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';
const bytes = pngBytes(),
  hash = createHash('sha256').update(bytes).digest('hex');
function payload() {
  const value = structuredClone(createExplorationExample());
  value.recipe.id = 'inspect-image-atlas';
  value.recipe.diagram = {
    asset: { assetId: 'frame', sha256: hash },
    locales: {
      en: { alt: 'A fictional frame', caption: 'Illustrative structure.' },
      uk: { alt: 'Вигадана рама', caption: 'Умовна конструкція.' },
    },
    hotspots: [{ cardId: 'camera', x: 0.25, y: 0.5 }],
  };
  return value;
}
function target() {
  const document = new Document(),
    container = document.createElement('div');
  document.body.append(container);
  return { document, container };
}
const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 2));
};
function mediaWindow() {
  const urls = new Set(),
    blobs = [];
  let created = 0;
  return {
    urls,
    blobs,
    get created() {
      return created;
    },
    URL: {
      createObjectURL(blob) {
        const url = 'blob:diagram-' + ++created;
        urls.add(url);
        blobs.push(blob);
        return url;
      },
      revokeObjectURL(url) {
        urls.delete(url);
      },
    },
    setTimeout(fn) {
      fn();
    },
  };
}
function file(content = bytes) {
  return { name: 'diagram.png', size: content.length, arrayBuffer: async () => content };
}
test('guided Studio diagram fields stage only a draft, then explicit Apply and Export preserve sources and gameplay', async () => {
  const f = await editionProviderFixture(),
    { container } = target(),
    win = mediaWindow();
  let source = f.source,
    rewards = [
      createStudioReward({
        campaign: f.catalog.campaigns[0],
        source,
        id: 'atlas',
        rule: 'all-missions',
        locales: {
          en: { title: 'Atlas', teaser: 'Explore', paragraph: 'A model.' },
          uk: { title: 'Атлас', teaser: 'Дослідіть', paragraph: 'Модель.' },
        },
      }),
    ],
    writes = 0;
  const originalBindings = createRewardMissionBindings(source),
    requirements = rewards[0].requirements;
  const editor = createExplorationEditor({
    container,
    getSource: () => source,
    getRewards: () => rewards,
    window: win,
    apply: (next) => {
      writes++;
      source = next.source;
      rewards = next.rewards;
    },
  });
  editor.sync();
  const action = (id) => container.querySelector(`[data-exploration-action="${id}"]`);
  await action('example').onclick();
  const fields = {
    assetId: 'frame',
    sha256: hash,
    enAlt: 'A fictional frame',
    ukAlt: 'Вигадана рама',
    enCaption: 'Illustrative structure.',
    ukCaption: 'Умовна конструкція.',
  };
  for (const [id, value] of Object.entries(fields))
    container.querySelector(`[data-diagram-field="${id}"]`).value = value;
  container.querySelector('[data-diagram-include="camera"]').checked = true;
  const x = container.querySelector('[data-diagram-x="camera"]');
  x.value = '';
  container.querySelector('[data-diagram-action="stage"]').onclick();
  let draft = JSON.parse(container.querySelector('[data-exploration-field="json"]').value);
  assert.equal(draft.recipe.id, 'inspect-compare-atlas');
  assert.equal(writes, 0, 'blank coordinates must not silently mean zero');
  x.value = '25';
  container.querySelector('[data-diagram-y="camera"]').value = '50';
  container.querySelector('[data-diagram-action="stage"]').onclick();
  draft = JSON.parse(container.querySelector('[data-exploration-field="json"]').value);
  assert.deepEqual(draft.recipe.diagram.hotspots, [{ cardId: 'camera', x: 0.25, y: 0.5 }]);
  assert.equal(writes, 0);
  await action('preview').onclick();
  assert.equal(writes, 0);
  assert(container.querySelector('[data-exploration-image-file="frame"]'));
  await action('apply').onclick();
  assert.equal(writes, 1);
  assert.deepEqual(rewards[0].requirements, requirements);
  assert.deepEqual(createRewardMissionBindings(source), originalBindings);
  const saved = rewards[0].payloads.find((p) => p.type === 'exploration');
  assert.deepEqual(saved.recipe.diagram, draft.recipe.diagram);
  assert.deepEqual(saved.recipe.sources, draft.recipe.sources);
  await action('export').onclick();
  assert.deepEqual(JSON.parse(await win.blobs[0].text()), rewards);
  assert.equal(win.urls.size, 0);
  container.querySelector('[data-diagram-action="remove"]').onclick();
  assert.equal(writes, 1);
  assert.equal(
    JSON.parse(container.querySelector('[data-exploration-field="json"]').value).recipe.id,
    'inspect-compare-atlas',
  );
  editor.dispose();
  assert.equal(container.children.length, 0);
});
test('local preview validates hash and raster bytes, replacing and disposing exact media without uploads', async () => {
  const { container } = target(),
    win = mediaWindow(),
    view = mountLocalExplorationPreview({
      container,
      payload: payload(),
      window: win,
      locale: 'uk',
    }),
    input = container.querySelector('[data-exploration-image-file="frame"]');
  await settle();
  assert.equal(win.urls.size, 0);
  input.files = [file(Buffer.from('wrong image'))];
  input.onchange();
  await settle();
  assert.equal(win.urls.size, 0);
  assert.equal(container.querySelector('img'), null);
  input.files = [file()];
  input.onchange();
  await settle();
  assert.equal(win.urls.size, 1);
  assert.equal(container.querySelector('img').alt, 'Вигадана рама');
  for (let i = 0; i < 4; i++) {
    input.files = [file()];
    input.onchange();
    await settle();
    assert.equal(win.urls.size, 1);
  }
  input.files = [{ ...file(), size: 4 * 1024 * 1024 + 1 }];
  input.onchange();
  await settle();
  assert.equal(win.urls.size, 0);
  assert.equal(container.querySelector('img'), null);
  view.dispose();
  assert.equal(win.urls.size, 0);
  assert.equal(container.children.length, 0);
  assert.equal(input.onchange, null);
});
test('a pending local file read cannot allocate a URL or redraw a disposed Studio preview', async () => {
  const { container } = target(),
    win = mediaWindow();
  let finish;
  const view = mountLocalExplorationPreview({ container, payload: payload(), window: win }),
    input = container.querySelector('[data-exploration-image-file="frame"]');
  input.files = [{ ...file(), arrayBuffer: () => new Promise((resolve) => (finish = resolve)) }];
  input.onchange();
  await settle();
  assert.equal(typeof finish, 'function');
  view.dispose();
  finish(bytes);
  await settle();
  assert.equal(win.created, 0);
  assert.equal(win.urls.size, 0);
  assert.equal(container.children.length, 0);
});
