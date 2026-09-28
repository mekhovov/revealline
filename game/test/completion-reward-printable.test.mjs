import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, createHash } from 'node:crypto';
import { createPrintableReward } from '../rewards/printable.mjs';
import { createStudioReward } from '../../authoring/company-studio/reward-editor.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { createExplorationExample } from '../studio/exploration-example.mjs';
const png = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=',
    'base64',
  ),
);
function fixture() {
  const source = createStarterProject();
  return structuredClone(
    createStudioReward({
      campaign: { ...source.campaigns[0], brandId: 'museum' },
      source,
      rule: 'all-missions',
      id: 'atlas',
      locales: {
        en: {
          title: 'An <atlas>',
          teaser: 'Hidden teaser',
          paragraph: 'A <script>alert(1)</script> is plain text.',
        },
        uk: { title: 'Атлас', teaser: 'Відкриття', paragraph: 'Знання та джерела.' },
      },
    }),
  );
}
function addImage(reward) {
  reward.payloads.push({
    id: 'picture',
    type: 'image',
    asset: { assetId: 'exact-picture', sha256: createHash('sha256').update(png).digest('hex') },
    locales: {
      en: { title: 'Picture', alt: 'A "picture"' },
      uk: { title: 'Зображення', alt: 'Точна версія' },
    },
  });
}
test('printable recordings keep the exact localized transcript and poster without a media player', async () => {
  const reward = fixture();
  const transcripts = {
    en: new TextEncoder().encode('Owned <script>recording</script>.'),
    uk: new TextEncoder().encode('Власний запис.'),
  };
  const ref = (assetId, bytes) => ({
    assetId,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  const payload = {
    id: 'recording',
    type: 'video',
    asset: ref('video', new Uint8Array([1])),
    poster: ref('poster', png),
    transcript: Object.fromEntries(
      Object.entries(transcripts).map(([locale, bytes]) => [
        locale,
        ref('transcript-' + locale, bytes),
      ]),
    ),
    captions: {
      en: ref('captions-en', new Uint8Array([2])),
      uk: ref('captions-uk', new Uint8Array([3])),
    },
    locales: { en: { title: 'Recording' }, uk: { title: 'Запис' } },
  };
  reward.payloads.push(payload);
  const options = {
    crypto: webcrypto,
    getImage: async () => ({ bytes: png, mimeType: 'image/png' }),
    getTranscript: async ({ assetId }) => transcripts[assetId.slice(-2)],
  };
  const printed = await createPrintableReward(reward, options);
  assert.deepEqual(printed.missingAssetIds, []);
  assert(printed.html.includes('Owned &lt;script&gt;recording&lt;/script&gt;.'));
  assert(printed.html.includes('data:image/png;base64,'));
  assert(!printed.html.includes('<video'));
  assert(!printed.html.includes('<audio'));
  const missing = await createPrintableReward(reward, {
    ...options,
    getTranscript: async () => transcripts.uk,
  });
  assert.deepEqual(missing.missingAssetIds, ['transcript-en']);
  assert(!missing.html.includes('Власний запис.'));
  payload.type = 'audio';
  delete payload.poster;
  delete payload.captions;
  const audio = await createPrintableReward(reward, { ...options, locale: 'uk' });
  assert(audio.html.includes('Власний запис.'));
  assert(!audio.html.includes('<img'));
});
test('printable discoveries are static, escaped, localized and never contain progress or locked teasers', async () => {
  const reward = fixture();
  reward.payloads[0].locales.en.sources = [
    { title: 'Source & context', url: 'https://example.org/object?a=1&b=2' },
  ];
  const { html } = await createPrintableReward(reward, { crypto: webcrypto });
  assert(html.includes('&lt;script&gt;'));
  assert(!html.includes('<script>'));
  assert(!html.includes('Hidden teaser'));
  assert(!html.includes('gameplayId'));
  assert(html.includes('Content-Security-Policy'));
  assert(html.includes('a=1&amp;b=2'));
  assert(html.includes('@media print'));
  const uk = await createPrintableReward(reward, { locale: 'uk', preview: true });
  assert(uk.html.includes('<html lang="uk">'));
  assert(uk.html.includes('не підтверджує перемогу'));
});
test('portable pictures require exact checked bytes and all data stays embedded offline', async () => {
  const reward = fixture();
  addImage(reward);
  const result = await createPrintableReward(reward, {
    crypto: webcrypto,
    getImage: async () => ({ bytes: png, mimeType: 'image/png' }),
  });
  assert.deepEqual(result.missingAssetIds, []);
  assert(result.html.includes('src="data:image/png;base64,'));
  assert(!result.html.includes('src="https:'));
  assert(result.html.includes('A &quot;picture&quot;'));
  for (const media of [
    { bytes: new Uint8Array([1, 2]), mimeType: 'image/png' },
    { bytes: png, mimeType: 'image/svg+xml' },
    { bytes: new Uint8Array(4 * 1024 * 1024 + 1), mimeType: 'image/png' },
  ]) {
    const missing = await createPrintableReward(reward, {
      crypto: webcrypto,
      getImage: async () => media,
    });
    assert.deepEqual(missing.missingAssetIds, ['exact-picture']);
    assert(!missing.html.includes('<img'));
    assert(missing.html.includes('plain text.'));
  }
});
test('missing art retains text, links and public-code terms; abort does not download a partial document', async () => {
  const reward = fixture();
  addImage(reward);
  reward.payloads.push({
    id: 'code',
    type: 'public-code',
    code: 'DEMO',
    issuer: 'Fictional test issuer',
    termsUrl: 'https://example.org/terms',
    expiresOn: '2027-01-01',
    locales: {
      en: { title: 'Test code', terms: 'Test fixture only' },
      uk: { title: 'Тестовий код', terms: 'Лише тест' },
    },
  });
  const missing = await createPrintableReward(reward);
  assert.deepEqual(missing.missingAssetIds, ['exact-picture']);
  assert(missing.html.includes('not a unique or single-use entitlement'));
  assert(missing.html.includes('2027-01-01'));
  const controller = new AbortController();
  await assert.rejects(
    createPrintableReward(reward, {
      signal: controller.signal,
      getImage: async () => {
        controller.abort();
        return null;
      },
    }),
    { name: 'AbortError' },
  );
  await assert.rejects(createPrintableReward(reward, { locale: 'xx' }), /locale/);
});

test('atlas printable includes the same cards, source notes and causal feedback as the untimed viewer', async () => {
  const reward = fixture();
  const payload = createExplorationExample();
  reward.payloads.push(payload);
  const result = await createPrintableReward(reward);
  assert(result.html.includes(payload.recipe.cards[0].locales.en.title));
  assert(result.html.includes(payload.recipe.predictions[0].locales.en.prompt));
  assert(result.html.includes(payload.recipe.predictions[0].choices[0].locales.en.feedback));
  assert(result.html.includes(payload.recipe.sources[0].url));
});
