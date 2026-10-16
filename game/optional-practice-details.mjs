import { boundedJSON, exactKeys, required } from './data-json.mjs';

export const PRACTICE_DETAILS_FORMAT = 'revealline-practice-details.v1';
export function validatePracticeDescription(input, id) {
  const value = boundedJSON(input, { maxBytes: 12288, maxNodes: 64, maxArray: 8 });
  exactKeys(value, ['format', 'id', 'copy', 'support', 'changelog'], 'practice description');
  required(
    value.format === 'revealline-practice-description.v1' && value.id === id,
    'Practice description identity differs.',
  );
  exactKeys(value.copy, ['en', 'uk'], 'practice languages');
  required(
    typeof value.support === 'string' &&
      /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/issues$/.test(value.support),
    'Practice support must be a repository issue tracker.',
  );
  exactKeys(value.changelog, ['en', 'uk'], 'practice changelog');
  for (const locale of ['en', 'uk']) {
    exactKeys(
      value.copy[locale],
      ['name', 'description', 'purpose', 'inputs', 'requirements', 'firstFlight'],
      'practice copy',
    );
    for (const text of [
      ...['name', 'description', 'purpose', 'inputs', 'requirements', 'firstFlight'].map(
        (key) => value.copy[locale][key],
      ),
      value.changelog[locale],
    ])
      required(
        typeof text === 'string' &&
          text.trim().length > 0 &&
          text.length <= 900 &&
          !/[\x00-\x1f\x7f]/.test(text),
        'Invalid practice description text.',
      );
  }
  return value;
}

/** Details never choose executable URLs; the v1 catalogue remains authoritative. */
export function validatePracticeDetails(input, packages, indexURL) {
  const value = boundedJSON(input, { maxBytes: 98304, maxNodes: 512, maxArray: 8 });
  exactKeys(value, ['format', 'packages'], 'practice details');
  required(
    value.format === PRACTICE_DETAILS_FORMAT &&
      Array.isArray(value.packages) &&
      value.packages.length <= 8,
    'Invalid practice details.',
  );
  const result = new Map();
  for (const row of value.packages) {
    exactKeys(
      row,
      ['id', 'revision', 'description', 'preview', 'guide', 'downloadBytes', 'offlineBytes'],
      'practice detail',
    );
    const item = packages.find((entry) => entry.id === row.id && entry.revision === row.revision);
    if (!item) continue;
    required(!result.has(row.id), 'Repeated practice details.');
    const base = `${item.id}/releases/${item.version}/site/`;
    required(
      row.preview === base + `optional-practice/${item.id}/preview.png` &&
        row.guide === base + `optional-practice/${item.id}/guide.html`,
      'Practice details must belong to their exact package.',
    );
    for (const bytes of [row.downloadBytes, row.offlineBytes])
      required(
        Number.isSafeInteger(bytes) && bytes > 0 && bytes <= 32 * 1024 * 1024,
        'Invalid practice size.',
      );
    result.set(item.id, {
      ...row,
      description: validatePracticeDescription(row.description, row.id),
      previewURL: new URL(row.preview, indexURL).href,
      guideURL: new URL(row.guide, indexURL).href,
    });
  }
  return result;
}

export async function loadPracticeDetails(
  indexURL,
  packages,
  { fetcher = globalThis.fetch, signal } = {},
) {
  const response = await fetcher(new URL('details.json', indexURL).href, {
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    signal,
  });
  if (!response.ok) throw new Error('Practice details unavailable.');
  const reader = response.body?.getReader();
  required(reader, 'Bounded practice details response required.');
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      required(length <= 98304, 'Practice details too large.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return { raw, details: validatePracticeDetails(raw, packages, indexURL) };
}
