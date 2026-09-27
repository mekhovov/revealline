import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import {
  SCREENING_VERSION,
  DECODER_PATH,
  DECODER_SHA256,
  SCREENING_LIMITS,
  TRANSFORMS,
  sha256,
  decodeScreeningPNG,
  exactTransformSignatures,
  similaritySignatures,
  compareSimilarity,
  thumbnailPNG,
  classifyExactSharing,
  validateArtworkChanges,
} from './artwork-screening.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIRECTORY = 'docs/content-offline';
const INVENTORY = `${DIRECTORY}/inventory.json`;
const OUTPUT = `${DIRECTORY}/artwork-screening.json`;
const HTML = `${DIRECTORY}/artwork-screening.html`;
const ALGORITHM = 'scripts/artwork-screening.mjs';
const stable = (value) =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, stable(value[key])]),
        )
      : value;
const serialize = (value) => `${JSON.stringify(stable(value), null, 2)}\n`;
const sorted = (values) => [...new Set(values)].sort();
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

export async function buildArtworkScreening({ root = ROOT, onProgress = () => {} } = {}) {
  const read = (relative) => fs.readFile(path.join(root, relative));
  assert.equal(
    sha256(await read(DECODER_PATH)),
    DECODER_SHA256,
    'Pinned original decoder changed; review and version the screening method.',
  );
  const inventoryBytes = await read(INVENTORY),
    inventory = JSON.parse(inventoryBytes);
  assert.equal(inventory.format, 'revealline-content-inventory.v1');
  assert.equal(inventory.method.decoderSha256, DECODER_SHA256, 'Inventory decoder differs.');
  const originals = inventory.artwork
    .filter((art) => art.kind === 'original')
    .sort((a, b) => a.id.localeCompare(b.id));
  assert.ok(
    originals.length <= SCREENING_LIMITS.originals,
    'Screening original count exceeds bounded comparison budget.',
  );
  const ownership = new Map(originals.map(({ id }) => [id, { current: [], historical: [] }]));
  const owners = new Map();
  for (const mission of inventory.missions) {
    owners.set(mission.id, {
      id: mission.id,
      name: mission.name,
      mode: mission.mode,
      route: mission.route,
      chapter: mission.chapter,
      classification: mission.classification,
    });
    for (const artwork of mission.artworks)
      if (ownership.has(artwork.id))
        ownership
          .get(artwork.id)
          [mission.classification === 'current' ? 'current' : 'historical'].push(mission.id);
  }
  const images = [],
    signatures = new Map(),
    thumbnails = new Map();
  for (const [index, original] of originals.entries()) {
    assert.ok(!path.isAbsolute(original.path) && !original.path.split(/[\\/]/).includes('..'));
    const bytes = await read(original.path);
    assert.equal(sha256(bytes), original.id, `Changed source original: ${original.path}`);
    assert.equal(bytes.length, original.bytes);
    const decoded = decodeScreeningPNG(bytes);
    assert.equal(
      sha256(decoded.pixels),
      original.pixelsSha256,
      'Inventory pixels differ; regenerate the inventory first.',
    );
    const exact = exactTransformSignatures(decoded);
    const thumbnail = thumbnailPNG(decoded);
    const owned = ownership.get(original.id);
    const row = {
      ...original,
      currentOwners: sorted(owned.current),
      historicalOwners: sorted(owned.historical),
      exactTransforms: exact,
      canonicalPixels: exact.map((item) => item.sha256).sort()[0],
      thumbnail: {
        path: `artwork-thumbnails/${original.id}.png`,
        bytes: thumbnail.length,
        sha256: sha256(thumbnail),
      },
    };
    images.push(row);
    thumbnails.set(row.thumbnail.path, thumbnail);
    if (row.currentOwners.length) signatures.set(row.id, similaritySignatures(decoded));
    if (index % 20 === 0) onProgress(`Screened ${index + 1}/${originals.length} originals`);
  }
  const { exactCurrent, historicalReuse } = classifyExactSharing(images);
  const current = images.filter((image) => image.currentOwners.length),
    candidates = new Map(current.map(({ id }) => [id, []]));
  for (let a = 0; a < current.length; a++)
    for (let b = a + 1; b < current.length; b++) {
      const left = current[a],
        right = current[b];
      if (
        left.canonicalPixels === right.canonicalPixels ||
        !left.currentOwners.some((owner) => right.currentOwners.some((other) => owner !== other))
      )
        continue;
      const score = compareSimilarity(signatures.get(left.id), signatures.get(right.id));
      const pair = { left: left.id, right: right.id, ...score };
      candidates.get(left.id).push(pair);
      candidates.get(right.id).push(pair);
    }
  const compare = (a, b) =>
    a.distance - b.distance || a.left.localeCompare(b.left) || a.right.localeCompare(b.right);
  const displayed = new Map();
  const nearest = current.map(({ id }) => {
    const matches = candidates.get(id).sort(compare).slice(0, SCREENING_LIMITS.nearest);
    for (const pair of matches) displayed.set(`${pair.left}/${pair.right}`, pair);
    return {
      artwork: id,
      matches: matches.map((pair) => ({
        artwork: pair.left === id ? pair.right : pair.left,
        distance: pair.distance,
        suspected: pair.suspected,
      })),
    };
  });
  const pairs = [...displayed.values()].sort(compare);
  const report = {
    format: SCREENING_VERSION,
    inventorySha256: sha256(inventoryBytes),
    method: {
      algorithm: ALGORITHM,
      algorithmSha256: sha256(await read(ALGORITHM)),
      decoder: DECODER_PATH,
      decoderSha256: DECODER_SHA256,
      exact:
        'SHA-256 of width/height-tagged decoded RGB8 samples under all eight exact dihedral transforms. Metadata and encoded-byte differences are not composition differences.',
      similarity:
        'Encoded-RGB integer luma (77R+150G+29B)/256; 16×16 floor-partition area means; 256 mean bits + 480 directional gradient bits weighted twice (distance 0–1216); all eight grid transforms.',
      crops:
        'Full image plus 75% and 50% width/height windows at center and four corners; compare full-to-crop in either direction. Arbitrary offsets, aspect ratios and local edits are not exhaustive.',
      lowInformation:
        '10th–90th percentile luma contrast below 16 suppresses suspected labels, never visual review.',
      thresholds: SCREENING_LIMITS,
      transforms: TRANSFORMS,
      thumbnail:
        'Derived maximum 96px RGB area-average thumbnail, PNG with explicitly stored DEFLATE blocks. Source originals and game delivery bytes unchanged.',
      gate: 'Default/check records the existing baseline without rejecting publication. Strict new-art comparison rejects introduced exact cross-owner copies and requires explicit visual approval of each changed current assignment. Similarity scores never automatically approve or reject originality.',
      limitations: [
        'Only RGB8 non-interlaced PNG originals supported by the pinned decoder are screened. Unsupported formats fail closed.',
        'No browser color management is applied. Browser decoding, accessibility and composition review remain required.',
        'Perceptual matches are suspected, not confirmed: simple structure, flat skies and similar genres may match. Recolorings, crops and edits may be missed.',
        'Procedural backgrounds are outside this original-image screen; the inventory retains their separate renderer/seed evidence.',
        'Same-owner reveal/reward/thumbnail references are deduplicated. Historical reuse remains reported separately and is not a new-current violation.',
        'Every new image needs visual review against the contact sheet and actual gameplay, even with no suspected match.',
      ],
      reference: 'https://github.com/facebook/ThreatExchange/blob/main/pdq/README.md',
      referenceNote:
        'PDQ documentation motivates pinning decoder/implementation and human calibration. This bounded local screen is not PDQ and uses none of its thresholds.',
    },
    summary: {
      originals: images.length,
      currentOriginals: current.length,
      currentExactCrossOwnerGroups: exactCurrent.length,
      distinctByteRotatedOrReflectedGroups: exactCurrent.filter(
        (group) => group.kind === 'exact-rotated-or-reflected-pixels',
      ).length,
      historicalReuseGroups: historicalReuse.length,
      nearestPairs: pairs.length,
      suspectedPairs: pairs.filter((pair) => pair.suspected).length,
      originalBytes: images.reduce((sum, image) => sum + image.bytes, 0),
      reviewThumbnailBytes: [...thumbnails.values()].reduce((sum, bytes) => sum + bytes.length, 0),
      visualReview: 'pending',
    },
    images,
    owners: [...owners.values()].filter((owner) =>
      images.some(
        (image) =>
          image.currentOwners.includes(owner.id) || image.historicalOwners.includes(owner.id),
      ),
    ),
    exactCurrent,
    historicalReuse,
    nearest,
    pairs,
  };
  return { report, thumbnails };
}

export function artworkScreeningHTML(report) {
  const images = new Map(report.images.map((image) => [image.id, image]));
  const owners = new Map(report.owners.map((owner) => [owner.id, owner]));
  const ownerLink = (id) => {
    const owner = owners.get(id);
    return `<a href="inventory.html#${encodeURIComponent(id)}">${escape(`${owner?.name ?? id} · ${owner?.mode ?? ''} · ${owner?.chapter ?? ''}`)}</a>`;
  };
  const card = (id) => {
    const image = images.get(id);
    return `<figure><a href="../../${escape(image.path)}"><img loading="lazy" width="160" src="${escape(image.thumbnail.path)}" alt="${escape(image.description)}"></a><figcaption><a href="#image-${id}">${escape(image.description || image.path)}</a><br><small>${escape(id.slice(0, 16))}</small></figcaption></figure>`;
  };
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Reveal Line artwork screening</title><style>body{max-width:1160px;margin:2rem auto;padding:0 1rem;font:16px/1.5 system-ui;background:#111722;color:#e5edf5}a{color:#8edfff}h1,h2,h3{line-height:1.2}code,small{overflow-wrap:anywhere}.pairs{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1rem}article,details{border:1px solid #435166;border-radius:.4rem;padding:.8rem;margin:.5rem 0}.images{display:flex;gap:1rem;flex-wrap:wrap}figure{margin:0;flex:1;min-width:120px}img{max-width:100%;height:auto}summary{cursor:pointer}.suspect{border-color:#dcac5e}.warning{color:#ffdf9c}pre{white-space:pre-wrap}</style><h1>Artwork screening · visual review pending</h1><p>This is reproducible screening evidence, not an originality approval. <a href="inventory.html">Complete ownership inventory</a> · <a href="artwork-screening.json">Machine-readable results</a>. Thumbnails are review derivatives; click one to inspect the unchanged original.</p><pre>${escape(JSON.stringify(report.summary, null, 2))}</pre><p class="warning">Exact current copies require replacement decisions. Historical reuse is retained. Nearest matches may be false positives; low distances do not establish plagiarism, uniqueness or gameplay variety. No visual approval has been recorded.</p><h2>Exact current cross-owner copies</h2>${report.exactCurrent.map((group) => `<details><summary>${escape(group.kind)} · ${group.assignments.length} assignments · ${group.artwork.length} originals</summary><div class="images">${group.artwork.map(card).join('')}</div><ul>${group.assignments.map(({ owner }) => `<li>${ownerLink(owner)}</li>`).join('')}</ul></details>`).join('')}<h2>Nearest-match contact sheets</h2><p>Top ${report.method.thresholds.nearest} neighbours per current original after exact matches are removed, deduplicated into pairs. Scores range from 0 to 1216; at most ${report.method.thresholds.suspectDistance} is a conservative <em>suspected</em> label, not a calibrated probability. Crop/transform applies in the named direction.</p><div class="pairs">${report.pairs.map((pair) => `<article${pair.suspected ? ' class="suspect"' : ''}><h3>${pair.suspected ? 'Suspected similarity — review' : 'Nearest neighbour — review'} · ${pair.distance}/1216</h3><div class="images">${card(pair.left)}${card(pair.right)}</div><p>${escape(pair.direction)} · ${escape(pair.crop)} · ${escape(pair.transform)}${pair.lowInformation ? ' · low-information comparison' : ''}</p></article>`).join('')}</div><h2>All originals and ownership</h2>${report.images.map((image) => `<details id="image-${image.id}"><summary>${escape(image.description || image.path)} · ${image.currentOwners.length} current / ${image.historicalOwners.length} historical owners</summary><div class="images">${card(image.id)}</div><p><code>${escape(image.path)}</code><br>Source SHA-256: <code>${image.id}</code><br>Pixel SHA-256: <code>${image.pixelsSha256}</code></p><h3>Current owners</h3><ul>${image.currentOwners.map((id) => `<li>${ownerLink(id)}</li>`).join('')}</ul><details><summary>Historical / tooling references (preserved)</summary><ul>${image.historicalOwners.map((id) => `<li>${ownerLink(id)}</li>`).join('')}</ul></details></details>`).join('')}<h2>Method and limits</h2><p>${escape(report.method.exact)}</p><p>${escape(report.method.similarity)}</p><p>${escape(report.method.crops)}</p><ul>${report.method.limitations.map((value) => `<li>${escape(value)}</li>`).join('')}</ul><p><a href="${report.method.reference}">PDQ implementation guidance</a>: ${escape(report.method.referenceNote)}</p><p>Reproduce: <code>node scripts/content-artwork-screening.mjs --check</code>. Method SHA-256: <code>${report.method.algorithmSha256}</code>.</p></html>\n`;
}

async function main() {
  const args = process.argv.slice(2);
  const allowed = new Set(['--write', '--check', '--strict-new', '--baseline', '--reviews']);
  for (let i = 0; i < args.length; i++) {
    assert.ok(allowed.has(args[i]), `Unknown argument: ${args[i]}`);
    if (['--baseline', '--reviews'].includes(args[i])) {
      assert.ok(args[i + 1] && !args[i + 1].startsWith('--'));
      i++;
    }
  }
  assert.ok(!(args.includes('--write') && args.includes('--check')), 'Choose write or check.');
  assert.ok(
    !(args.includes('--write') && args.includes('--strict-new')),
    'Strict checking never updates its evidence.',
  );
  const { report, thumbnails } = await buildArtworkScreening({
    onProgress: (message) => console.error(message),
  });
  const outputs = new Map([
    [OUTPUT, Buffer.from(serialize(report))],
    [HTML, Buffer.from(artworkScreeningHTML(report))],
    ...[...thumbnails].map(([file, bytes]) => [`${DIRECTORY}/${file}`, bytes]),
  ]);
  if (args.includes('--write'))
    for (const [file, bytes] of outputs) {
      await fs.mkdir(path.dirname(path.join(ROOT, file)), { recursive: true });
      await fs.writeFile(path.join(ROOT, file), bytes);
    }
  if (args.includes('--check'))
    for (const [file, bytes] of outputs)
      assert.ok(
        bytes.equals(await fs.readFile(path.join(ROOT, file))),
        `Stale screening artifact: ${file}`,
      );
  if (args.includes('--strict-new')) {
    const parameter = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
    assert.ok(
      parameter('--baseline'),
      'Use --baseline with an explicitly retained prior screening JSON.',
    );
    const baseline = JSON.parse(await fs.readFile(path.resolve(parameter('--baseline')), 'utf8'));
    const reviews = parameter('--reviews')
      ? JSON.parse(await fs.readFile(path.resolve(parameter('--reviews')), 'utf8'))
      : undefined;
    const result = validateArtworkChanges(report, { baseline, reviews });
    console.log(serialize(result));
    if (!result.passed) process.exitCode = 1;
  } else console.log(serialize(report.summary));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
