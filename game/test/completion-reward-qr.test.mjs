import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRewardQrImage } from '../rewards/qr.mjs';
import { validateCompletionRewardPayload } from '../rewards/model.mjs';
import { createPrintableReward } from '../rewards/printable.mjs';
import { mountRewardQr } from '../ui/reward-qr.mjs';
import { createResourceRewardEditor } from '../studio/resource-reward-editor.mjs';
import { editDiscoveryResource } from '../content-design/discovery.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { createStudioReward } from '../../authoring/company-studio/reward-editor.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import { Document } from './helpers/couch-dom.mjs';

const resource = {
  id: 'reference',
  type: 'url',
  url: 'https://www.metmuseum.org/art/collection/search/436154',
  qr: true,
  locales: { en: { title: 'Museum reference' }, uk: { title: 'Музейне джерело' } },
};
function fixture() {
  const source = createStarterProject();
  const reward = createStudioReward({
    source,
    campaign: { ...source.campaigns[0], brandId: 'museum' },
    rule: 'all-missions',
    id: 'museum-finale',
    locales: {
      en: { title: 'Exhibit', teaser: 'The finale', paragraph: 'A source-linked discovery.' },
      uk: { title: 'Виставка', teaser: 'Фінал', paragraph: 'Відкриття з джерелом.' },
    },
  });
  return { source, rewards: [reward] };
}
test('offline QR is deterministic, bounded, text-free SVG with an integral quiet zone', async () => {
  const a = await createRewardQrImage(resource),
    b = await createRewardQrImage(resource);
  assert.deepEqual(a, b);
  // Independently decoded with macOS CoreImage CIDetector on 2026-09-28.
  assert.equal(
    createHash('sha256').update(a.src).digest('hex'),
    '24a84aab2259c7400b791f6c1daacdd51f2045d997ec3e6b5232a071480b8c9b',
  );
  const svg = decodeURIComponent(a.src.split(',')[1]);
  assert(!svg.includes(resource.url));
  assert(!svg.includes('<script'));
  assert(!svg.includes('href='));
  const coordinates = [...svg.matchAll(/M(\d+),(\d+)h1v1h-1z/g)].map((m) => [+m[1], +m[2]]);
  assert(coordinates.length > 100);
  assert(coordinates.every(([x, y]) => x >= 4 && y >= 4 && x < a.size - 4 && y < a.size - 4));
  assert.equal(a.address, resource.url);
  assert.equal(a.size, 4 * a.version + 25);
});
test('QR validation retains old URL payloads and rejects unsafe or oversized destinations', async () => {
  const old = structuredClone(resource);
  delete old.qr;
  assert.deepEqual(validateCompletionRewardPayload(old), old);
  for (const url of [
    'http://example.org',
    'javascript:alert(1)',
    'https://u:p@example.org',
    'https://example.org/' + 'a'.repeat(256),
    'https://example.org/' + 'я'.repeat(80),
  ])
    await assert.rejects(createRewardQrImage({ ...resource, url }));
  await assert.rejects(createRewardQrImage({ ...resource, qr: 'true' }));
  await assert.rejects(createRewardQrImage({ ...resource, qr: false }));
  assert.equal(
    (await createRewardQrImage({ ...resource, url: 'https://example.org/знання' })).address,
    'https://example.org/%D0%B7%D0%BD%D0%B0%D0%BD%D0%BD%D1%8F',
  );
});
test('vendored encoder and license match pinned source provenance', async () => {
  const root = new URL('../vendor/', import.meta.url);
  const record = JSON.parse(await readFile(new URL('qrcodegen-1.8.0.json', root)));
  const bytes = await readFile(new URL(record.artifact, root));
  const hash = (value) => createHash('sha256').update(value).digest('hex');
  assert.equal(hash(bytes), record.artifactSha256);
  assert.equal(hash(await readFile(new URL(record.licenseFile, root))), record.licenseSha256);
  const suffix =
    '\n// RevealLine: expose the upstream namespace as an ES module.\nexport { qrcodegen };\n';
  assert(bytes.toString().endsWith(suffix));
  assert.equal(hash(bytes.subarray(0, -Buffer.byteLength(suffix))), record.sourceSha256);
});
test('QR authoring round trip preserves requirements and gameplay, and portable export has no scripts', async () => {
  const f = fixture(),
    before = JSON.stringify(f);
  const result = editDiscoveryResource(f.source, f.rewards, f.rewards[0].id, resource);
  assert.equal(JSON.stringify(f), before);
  assert.deepEqual(result.rewards[0].requirements, f.rewards[0].requirements);
  assert.deepEqual(
    createRewardMissionBindings(result.source),
    createRewardMissionBindings(f.source),
  );
  assert.notEqual(result.rewards[0].revision, f.rewards[0].revision);
  assert.deepEqual(JSON.parse(JSON.stringify(result)).rewards[0].payloads.at(-1), resource);
  const print = await createPrintableReward(result.rewards[0], { preview: true });
  assert(print.html.includes('data:image/svg+xml;'));
  assert(print.html.includes('Author preview'));
  assert(!print.html.includes('<script'));
  assert(print.html.includes(`href="${resource.url}"`));
});
test('QR viewer requires an explicit action and releases every image across20 disposal cycles', async () => {
  const document = new Document();
  for (let i = 0; i < 20; i++) {
    const container = document.createElement('section'),
      controller = new AbortController();
    const viewer = mountRewardQr({ container, payload: resource, signal: controller.signal });
    const [button, picture] = container.children;
    assert.equal(picture.hidden, true);
    const click = button.onclick();
    if (i % 2) controller.abort();
    await click;
    if (!(i % 2)) {
      assert.equal(picture.hidden, false);
      assert.match(picture.src, /^data:image\/svg\+xml/);
    }
    viewer.dispose();
    assert.equal(container.children.length, 0);
    assert.equal(button.onclick, null);
  }
});
test('shared resource editor previews without progress and explicitly applies a revisioned payload', async () => {
  let current = fixture(),
    applications = 0;
  const document = new Document(),
    container = document.createElement('section');
  const editor = createResourceRewardEditor({
    container,
    getSource: () => current.source,
    getRewards: () => current.rewards,
    getLocale: () => 'uk',
    apply: (candidate) => {
      applications++;
      current = candidate;
    },
  });
  editor.sync();
  const field = (name) => container.querySelector(`[data-resource-field="${name}"]`);
  field('address').value = resource.url;
  field('en').value = 'Museum';
  field('uk').value = 'Музей';
  field('qr').checked = true;
  await container.querySelector('[data-resource-action="preview"]').onclick();
  assert.equal(applications, 0);
  await container.querySelector('[data-resource-action="apply"]').onclick();
  assert.equal(applications, 1);
  assert.equal(current.rewards[0].payloads.at(-1).qr, true);
  editor.dispose();
  assert.equal(container.children.length, 0);
});
