#!/usr/bin/env node
/** Small isolated-profile fixture; never writes browser storage or earns gameplay rewards. */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { openAsBlob } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { required } from '../game/data-json.mjs';
import { prepareBackupArchive } from '../game/backup-archive.mjs';
import { inspectBackupArchive } from '../game/backup-archive-inspection.mjs';
import { importMediaBundle } from '../game/media-bundle.mjs';
import { inspectStoryBundle } from '../game/story-bundle.mjs';
import { importSoundtrackBundle } from '../game/soundtrack-bundle.mjs';
import { createJourneyProfileStore, createJourneyBackend } from '../game/journey/profile.mjs';
import { backupSetFixture } from '../game/test/helpers/backup-set-fixture.mjs';
import { memoryIndexedDB, structuralProbe } from '../game/test/helpers/soundtrack-fixtures.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const FORMAT = 'revealline-nonempty-restore-fixture.v1';
const MAX_FIXTURE_BYTES = 2 * 1024 * 1024;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const synthetic = Object.freeze({
  type: 'complete',
  mode: 'solo',
  missionId: 'qa-nonempty-restore-synthetic',
  runId: 'qa-synthetic-not-earned',
  gameplayId: 'qa-storage-transfer-only',
  difficulty: 'standard',
});
const fixtureOriginals = (fixture) => [
  ...fixture.still.assets.map(({ sha256, blob }) => ({
    component: 'media',
    sha256,
    bytes: blob.size,
  })),
  { component: 'story', sha256: fixture.f.descriptor.source.sha256, bytes: fixture.f.blob.size },
  ...fixture.audio.assets.map(({ sha256, blob }) => ({
    component: 'audio',
    sha256,
    bytes: blob.size,
  })),
];
const profile = (profileKey) =>
  createJourneyProfileStore({
    profileKey,
    backend: createJourneyBackend({ ...memoryIndexedDB(), profileKey }),
  });

export async function prepareNonemptyRestoreFixture({ profileKey, sourceRevision }) {
  required(
    typeof profileKey === 'string' && profileKey.length > 0,
    'Choose the destination profile key explicitly.',
  );
  required(/^[a-f0-9]{40}$/u.test(sourceRevision), 'A full committed source revision is required.');
  const fixture = await backupSetFixture(),
    journey = profile(profileKey);
  try {
    await journey.load();
    journey.record(synthetic);
    required(await journey.flush(), 'Synthetic fixture progress was not prepared.');
    fixture.source.edition = {
      version: 'restore-qualification-fixture',
      channel: 'isolated-test-only',
      sourceRevision,
    };
    fixture.source.archiveProfile = {
      kind: 'authored-journey',
      identity: fixture.source.gameIdentity,
    };
    fixture.source.journey = {
      identity: journey.stateRevision,
      read: (options) => journey.exportAsync(options),
    };
    const archive = await prepareBackupArchive(fixture.source),
      blob = archive.files[0].blob;
    required(blob.size <= MAX_FIXTURE_BYTES, 'Qualification fixture exceeds its 2 MiB bound.');
    const inspection = await inspectBackupArchive(blob);
    const originals = fixtureOriginals(fixture);
    const receipt = {
      format: FORMAT,
      sourceRevision,
      purpose: 'Isolated restore qualification only. Synthetic progress is not earned gameplay.',
      archive: {
        filename: 'nonempty-restore.zip',
        bytes: blob.size,
        sha256: hash(Buffer.from(await blob.arrayBuffer())),
      },
      profileKey,
      syntheticReceipt: synthetic,
      originals,
      components: inspection.files.map(({ id, filename, bytes, sha256 }) => ({
        id,
        filename,
        bytes,
        sha256,
      })),
      expected: {
        order: ['media', 'story', 'audio', 'journey'],
        originals: { media: 1, story: 1, audio: 1 },
        syntheticClears: 1,
        gameData: 'excluded-authored',
      },
      qualification: {
        archiveStructure: 'checked',
        nativeCodecs: 'pending-browser',
        browserPersistence: 'pending-browser',
        hardware: 'not-tested',
      },
      sourceOriginals: [
        'game/assets/field-kit/sprites/enemy-border-patrol.png',
        'game/test/fixtures/video/owned-poster-fixture.mp4',
        'game/test/fixtures/audio/silence-mpeg1-layer3.mp3',
      ],
    };
    return { blob, receipt };
  } finally {
    journey.performance.dispose();
  }
}

/** Compare original payloads and the scoped synthetic receipt, not normalized bundle bytes.
 * Native decoding is deliberately not claimed by this read-only comparison. */
export async function verifyNonemptyRestoreExport(blob, expected) {
  required(blob.size <= MAX_FIXTURE_BYTES, 'Qualification export exceeds its 2 MiB bound.');
  required(
    expected?.format === FORMAT &&
      Array.isArray(expected.originals) &&
      expected.originals.length === 3,
    'Choose the generated qualification receipt.',
  );
  required(
    expected.syntheticReceipt?.runId === synthetic.runId &&
      expected.syntheticReceipt?.missionId === synthetic.missionId,
    'The synthetic qualification identity changed.',
  );
  const fixture = await backupSetFixture(),
    inspection = await inspectBackupArchive(blob);
  required(
    JSON.stringify(expected.originals) === JSON.stringify(fixtureOriginals(fixture)),
    'The original fixture pins changed. Use the matching receipt and source revision.',
  );
  const component = (id) => {
    const file = inspection.files.find((entry) => entry.id === id);
    required(file, `The restored export is missing ${id}.`);
    return file.blob;
  };
  const media = await importMediaBundle(component('media'), {
    decodeImage: fixture.source.decodeImage,
  });
  const story = await inspectStoryBundle(component('story'));
  const audio = await importSoundtrackBundle(component('audio'), { probeMedia: structuralProbe });
  const assets = { media: media.assets, story: story.assets, audio: audio.assets };
  for (const original of expected.originals) {
    const asset = assets[original.component]?.find((entry) => entry.sha256 === original.sha256);
    required(
      asset &&
        asset.blob.size === original.bytes &&
        hash(Buffer.from(await asset.blob.arrayBuffer())) === original.sha256,
      `The restored export lacks the exact ${original.component} original.`,
    );
  }
  const journey = profile(expected.profileKey);
  try {
    await journey.load();
    const checked = await journey.inspectBackupAsync(await component('journey').text());
    const actual = checked.merged.clears.solo[synthetic.missionId];
    required(
      actual?.runId === synthetic.runId &&
        actual.gameplayId === synthetic.gameplayId &&
        actual.difficulty === synthetic.difficulty,
      'The scoped synthetic Journey receipt was not retained.',
    );
  } finally {
    journey.performance.dispose();
  }
  return {
    format: 'revealline-nonempty-restore-comparison.v1',
    status: 'original-payloads-and-synthetic-receipt-match',
    sourceRevision: expected.sourceRevision,
    export: { bytes: blob.size, sha256: hash(Buffer.from(await blob.arrayBuffer())) },
    originals: expected.originals,
    profileKey: expected.profileKey,
    limitations: [
      'Synthetic progress is not earned gameplay.',
      'No native codec, audible playback, hardware or offline-startup result is inferred.',
    ],
  };
}

export async function writeNonemptyRestoreFixture(output, options) {
  const prepared = await prepareNonemptyRestoreFixture(options);
  await mkdir(output); // A fresh directory only: never replace an earlier qualification receipt.
  await writeFile(
    join(output, prepared.receipt.archive.filename),
    new Uint8Array(await prepared.blob.arrayBuffer()),
    { flag: 'wx' },
  );
  await writeFile(join(output, 'receipt.json'), JSON.stringify(prepared.receipt, null, 2) + '\n', {
    flag: 'wx',
  });
  return prepared.receipt;
}

async function main() {
  const args = process.argv.slice(2),
    options = new Map();
  for (let index = 0; index < args.length; index += 2) {
    required(
      ['--output', '--profile-key', '--verify', '--receipt'].includes(args[index]) &&
        args[index + 1] &&
        !options.has(args[index]),
      'Use --output NEW_DIRECTORY --profile-key DESTINATION_KEY, or --verify EXPORTED_ZIP --receipt FIXTURE_RECEIPT.',
    );
    options.set(args[index], args[index + 1]);
  }
  if (options.has('--verify')) {
    required(
      options.size === 2 && options.has('--receipt'),
      'Verification requires only --verify and --receipt.',
    );
    const receiptPath = resolve(options.get('--receipt'));
    required((await stat(receiptPath)).size <= 64 * 1024, 'Qualification receipt exceeds 64 KiB.');
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
    return verifyNonemptyRestoreExport(await openAsBlob(resolve(options.get('--verify'))), receipt);
  }
  required(
    options.size === 2 && options.has('--output') && options.has('--profile-key'),
    'Choose a new output directory and an explicit destination profile key.',
  );
  required(
    execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim() === '',
    'Commit tracked changes before preparing an exact-source qualification fixture.',
  );
  execFileSync(
    'git',
    ['ls-files', '--error-unmatch', 'scripts/prepare-backup-restore-fixture.mjs'],
    { cwd: ROOT, stdio: 'pipe' },
  );
  return writeNonemptyRestoreFixture(resolve(options.get('--output')), {
    profileKey: options.get('--profile-key'),
    sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim(),
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
    .then((receipt) => process.stdout.write(JSON.stringify(receipt, null, 2) + '\n'))
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
