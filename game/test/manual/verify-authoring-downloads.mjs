// Read-only validation of the exact September 29 browser acceptance downloads.
// Usage: node game/test/manual/verify-authoring-downloads.mjs <download-directory>
// JSON goes to stdout; no input file or application storage is modified.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { importThemeBundle } from '../../presentation/bundle.mjs';
import { importCreatorBundle } from '../../creator/bundle.mjs';
import { importCreatorTeamMediaCampaign } from '../../creator/team-media.mjs';
import { importMediaBundle } from '../../media-bundle.mjs';
import { validateEnemyCatalogDraft } from '../../enemy-catalog.mjs';
import { compileContentProject } from '../../content-design/project.mjs';
import { validateScenario } from '../../content.mjs';
import { companyPlaytestTask } from '../../company-campaigns/playtest-fixtures.mjs';
import { verifyReplayAsync } from '../../replay.mjs';
import {
  validateStudioDraft,
  validateStudioHistory,
} from '../../../authoring/company-studio/model.mjs';

const directory = process.argv[2];
assert(directory, 'Pass the directory containing the exact acceptance downloads.');
assert.equal(process.platform, 'darwin', 'This verifier uses the macOS ImageIO decoder via sips.');
const run = promisify(execFile);
const scratch = await mkdtemp(join(tmpdir(), 'revealline-artifact-decode-'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const decodedImages = new Map();
async function decodeImage(source) {
  const bytes =
    typeof source === 'string'
      ? Buffer.from(source.slice(source.indexOf(',') + 1), 'base64')
      : Buffer.from(await source.arrayBuffer());
  const digest = hash(bytes);
  if (decodedImages.has(digest)) return decodedImages.get(digest);
  const input = join(scratch, `${digest}.image`),
    output = join(scratch, `${digest}.bmp`);
  await writeFile(input, bytes);
  // Encoding a complete uncompressed bitmap forces ImageIO to decode pixels;
  // the result dimensions are not copied from the original image header.
  await run('/usr/bin/sips', ['-s', 'format', 'bmp', input, '--out', output]);
  const bmp = await readFile(output);
  assert.equal(bmp.toString('ascii', 0, 2), 'BM');
  const width = bmp.readInt32LE(18),
    height = Math.abs(bmp.readInt32LE(22));
  const depth = bmp.readUInt16LE(28),
    compression = bmp.readUInt32LE(30);
  assert(width > 0 && height > 0 && [0, 3].includes(compression));
  assert(bmp.length >= bmp.readUInt32LE(10) + Math.ceil((width * depth) / 32) * 4 * height);
  const facts = { naturalWidth: width, naturalHeight: height };
  decodedImages.set(digest, facts);
  return facts;
}
const groups = [
  ['Asset Studio', 'theme', ['revealline-fpv-r98.rltheme', 'revealline-fpv-r98 (1).rltheme']],
  [
    'Picture Creator',
    'creator',
    [
      'creation-8c75cd50-76be-4130-9b26-e332814343da.rlpack',
      'creation-7245196e-c53f-4686-9acd-92c2b2e77579.rlpack',
    ],
  ],
  ['Team Creator', 'team', ['my-team-campaign.rlteammedia', 'my-team-campaign (1).rlteammedia']],
  [
    'Content Studio',
    'project',
    ['my-journey-backup.json', 'my-journey-backup (1).json', 'my-journey-backup (2).json'],
  ],
  ['Playground', 'scenario', ['signal-01.xonix (2).json', 'signal-01.xonix (3).json']],
  ['Company Studio', 'company', ['coupa-all-draft.json', 'coupa-all-draft (1).json']],
  [
    'Company transfer practice',
    'task',
    ['playtest-culture-connection-task.json', 'playtest-culture-connection-task (1).json'],
  ],
  [
    'Enemy Workshop',
    'enemy',
    ['RevealLine-enemy-catalog.json', 'RevealLine-enemy-catalog (1).json'],
  ],
  ['Video Poster', 'poster', ['RevealLine-poster-0.png', 'RevealLine-poster-0 (1).png']],
  [
    'Still Picture Workshop',
    'still',
    ['RevealLine-originals.rlmedia', 'RevealLine-originals (1).rlmedia'],
  ],
  [
    'Demo recording variants',
    'demo',
    ['demo-browser-recording-variants.json', 'demo-browser-recording-variants (1).json'],
  ],
];
const records = [];
try {
  for (const [tool, kind, names] of groups)
    for (const name of names) {
      const path = join(directory, name),
        metadata = await stat(path);
      // Restrict reads to the recorded local Sep29 acceptance session, excluding
      // earlier user exports even if an identically named file has been replaced.
      assert(
        metadata.mtimeMs >= Date.parse('2026-09-28T22:00:00Z') &&
          metadata.mtimeMs < Date.parse('2026-09-28T23:00:00Z'),
        `Unexpected session timestamp: ${name}`,
      );
      const bytes = await readFile(path),
        blob = new Blob([bytes]);
      const record = {
        tool,
        name,
        bytes: bytes.length,
        sha256: hash(bytes),
        modifiedUTC: metadata.mtime.toISOString(),
        status: 'pass',
      };
      try {
        const parsed = () => JSON.parse(bytes.toString('utf8'));
        if (kind === 'theme') {
          const result = await importThemeBundle(blob, { decodeImage });
          record.validation = {
            assets: result.assets.size,
            imagesDecoded: result.imagesDecoded,
            schema: result.document.format,
          };
        } else if (kind === 'creator') {
          const result = await importCreatorBundle(blob, { decodeImage });
          record.validation = {
            schema: result.manifest.format,
            assets: result.manifest.assets.length,
            editionId: result.manifest.editionId,
            replayEvidence: 'exact current verification',
          };
        } else if (kind === 'team') {
          const result = await importCreatorTeamMediaCampaign(blob, { decodeImage });
          record.validation = {
            schema: result.manifest.format,
            assets: result.manifest.assets.length,
            levels: result.manifest.bindings.length,
            replayEvidence: 'exact current verification',
          };
        } else if (kind === 'still') {
          const result = await importMediaBundle(blob, { decodeImage });
          record.validation = { assets: result.assets.length, schema: result.document.format };
        } else if (kind === 'project') {
          const result = compileContentProject(parsed());
          record.validation = {
            schema: result.format,
            maps: result.maps.length,
            missions: result.missions.length,
          };
        } else if (kind === 'scenario') {
          const result = validateScenario(parsed());
          assert.equal(result.valid, true, JSON.stringify(result.errors));
          record.validation = { schema: parsed().format, warnings: result.warnings };
        } else if (kind === 'company') {
          const result = validateStudioDraft(parsed());
          const retained = await validateStudioHistory(result.catalog, result.files);
          record.validation = {
            schema: parsed().format,
            files: result.files.size,
            editions: result.catalog.editions.length,
            retainedPresentations: retained.length,
          };
        } else if (kind === 'task') {
          const result = parsed();
          assert.deepEqual(result, companyPlaytestTask(result.id));
          record.validation = { exactTaskFixture: result.id, exportedResponses: false };
        } else if (kind === 'enemy') {
          const result = validateEnemyCatalogDraft(parsed());
          record.validation = { schema: result.version, entries: result.entries.length };
        } else if (kind === 'poster') {
          record.validation = await decodeImage(blob);
          assert.deepEqual(record.validation, { naturalWidth: 640, naturalHeight: 360 });
          assert.equal(
            record.sha256,
            '3cf37831006475a8b43318c86ec91abd6b55a06aadd01d2707a9bc168879e9a9',
          );
        } else if (kind === 'demo') {
          const result = parsed();
          assert.equal(result.format, 'revealline-demo-browser-authoring.v1');
          assert.equal(result.clips.length, 6);
          record.validation = { schema: result.format, clips: [] };
          for (const clip of result.clips) {
            const verification = await verifyReplayAsync(clip.replay);
            record.validation.clips.push({
              id: clip.id,
              ticks: verification.ticks,
              match: verification.match,
              diagnostics: verification.diagnostics,
            });
          }
          if (record.validation.clips.some((clip) => !clip.match))
            record.status = 'runtime-replay-mismatch';
        }
      } catch (error) {
        record.status = 'failed';
        record.error = error.message;
      }
      records.push(record);
    }
  process.exitCode = records.some((record) => record.status === 'failed') ? 1 : 0;
  console.log(
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        session: '2026-09-29 Europe/Berlin',
        decoder: 'macOS sips/ImageIO full bitmap conversion; BMP pixel payload length checked',
        inputWrites: false,
        storageWrites: false,
        decodedUniqueImages: decodedImages.size,
        records,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(scratch, { recursive: true, force: true });
}
