import { spawnSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { actorVoiceGenerationPlan } from '../game/hunt/actor-voice-manifest.mjs';
import { inspectRecordingContainer } from '../game/journey/reaction-recording-format.mjs';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const command = (executable, args) => {
  const result = spawnSync(executable, args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr);
};

/** Replaceable authoring adapter; optional local voices must actually be installed. */
export async function macOSActorSpeechProvider({ job, output, scratch }) {
  const intermediate = join(scratch, 'actor.aiff');
  command('/usr/bin/say', [
    '-v',
    job.profile.voice,
    '-r',
    String(job.profile.rate),
    '-o',
    intermediate,
    job.transcript,
  ]);
  command('/usr/bin/afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '64000', intermediate, output]);
  return {
    provider: 'macos-say',
    voice: job.profile.voice,
    rate: job.profile.rate,
    kind: 'generated',
    releaseStatus: 'listening-review-required',
    note: 'Original scripted game character. Local draft voice; EN/UK pronunciation, expression and mix require listening review. Casts share this line identity.',
  };
}

/** Default is a script-only plan. Explicit synthesize writes real, inspected media
 * and portable locale bundles using the existing Studio original/replacement format. */
export async function generateActorReactionVoices({
  outputDirectory,
  locale = null,
  generate = false,
  synthesize = macOSActorSpeechProvider,
} = {}) {
  if (!outputDirectory) throw new TypeError('Choose a new output directory for the voice edition.');
  const output = resolve(outputDirectory),
    plan = actorVoiceGenerationPlan(locale);
  await mkdir(output, { recursive: true });
  const manifest = {
    ...plan,
    jobs: plan.jobs.map((job) => ({ ...job, scriptSha256: sha256(job.transcript) })),
  };
  // Never replace an earlier script edition or generated original implicitly.
  const planPath = join(output, 'generation-plan.json'),
    planText = JSON.stringify(manifest, null, 2) + '\n';
  try {
    await writeFile(planPath, planText, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if ((await readFile(planPath, 'utf8')) !== planText)
      throw new Error(
        'This directory contains a different pinned script edition. Choose a new directory.',
      );
  }
  if (!generate)
    return { jobs: manifest.jobs.length, generated: 0, output, status: 'generation-pending' };
  const scratch = await mkdtemp(join(tmpdir(), 'revealline-actor-voices-'));
  const generated = [],
    records = new Map();
  try {
    for (const job of manifest.jobs) {
      const path = join(output, job.filename);
      try {
        await access(path);
        throw new Error('This voice edition already has a recording: ' + job.filename);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      const provenance = await synthesize({ job, output: path, scratch });
      const bytes = await readFile(path);
      if (!bytes.length || bytes.length > plan.limits.clipBytes)
        throw new Error('Generated recording exceeds the per-clip limit.');
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const inspected = inspectRecordingContainer(buffer);
      if (inspected.maxDecodedSeconds > plan.limits.durationSeconds)
        throw new Error('Generated recording exceeds 15 seconds.');
      if (
        typeof provenance?.provider !== 'string' ||
        !provenance.provider ||
        provenance.provider.length > 120 ||
        typeof provenance.voice !== 'string' ||
        !provenance.voice ||
        provenance.voice.length > 120
      )
        throw new Error('Generation adapter must identify its real provider and voice.');
      const original = {
        bytes: bytes.length,
        sha256: sha256(bytes),
        base64: bytes.toString('base64'),
        mime: inspected.format === 'pcm-wav' ? 'audio/wav' : 'audio/mp4',
        transcript: job.transcript,
        provenance: {
          ...provenance,
          kind: 'generated',
          releaseStatus: 'listening-review-required',
        },
      };
      const record = {
        key: `${job.lineId}|${job.locale}`,
        lineId: job.lineId,
        locale: job.locale,
        active: null,
        revisions: [],
        original,
      };
      if (!records.has(job.locale)) records.set(job.locale, []);
      records.get(job.locale).push(record);
      const portable = JSON.stringify({
        format: plan.replacementFormat,
        records: records.get(job.locale),
      });
      if (Buffer.byteLength(portable) > plan.limits.localeBundleBytes)
        throw new Error('Generated locale exceeds the 32 MiB portable bundle limit.');
      const { base64: _bytes, ...metadata } = original;
      generated.push({
        lineId: job.lineId,
        locale: job.locale,
        filename: job.filename,
        scriptSha256: job.scriptSha256,
        ...metadata,
      });
    }
    for (const [language, entries] of records)
      await writeFile(
        join(output, `humanoid-reactions-${language}-v1.json`),
        JSON.stringify({ format: plan.replacementFormat, records: entries }),
        { flag: 'wx' },
      );
    await writeFile(
      join(output, 'generated-recordings.json'),
      JSON.stringify(
        { version: plan.version, status: 'listening-review-required', clips: generated },
        null,
        2,
      ) + '\n',
      { flag: 'wx' },
    );
    return {
      jobs: manifest.jobs.length,
      generated: generated.length,
      bytes: generated.reduce((sum, entry) => sum + entry.bytes, 0),
      output,
      status: 'listening-review-required',
    };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

/** Install an inspected edition as immutable, lazily fetched runtime originals. */
export async function installActorVoiceEdition({ outputDirectory, runtimeDirectory }) {
  const output = resolve(outputDirectory),
    runtime = resolve(runtimeDirectory);
  const manifest = JSON.parse(await readFile(join(output, 'generated-recordings.json'), 'utf8'));
  const expected = new Map(
    actorVoiceGenerationPlan().jobs.map((job) => [`${job.lineId}|${job.locale}`, job]),
  );
  if (!Array.isArray(manifest.clips) || manifest.clips.length !== expected.size)
    throw new Error('Runtime publication requires one complete bilingual voice edition.');
  await mkdir(join(runtime, 'actors-v1'), { recursive: true });
  const records = [];
  for (const clip of manifest.clips) {
    const key = `${clip.lineId}|${clip.locale}`,
      job = expected.get(key);
    if (!job || clip.filename !== job.filename || clip.transcript !== job.transcript)
      throw new Error('Voice edition does not match its pinned scripts.');
    expected.delete(key);
    const bytes = await readFile(join(output, clip.filename));
    if (bytes.length !== clip.bytes || sha256(bytes) !== clip.sha256)
      throw new Error('Voice edition media integrity failed.');
    const target = join(runtime, 'actors-v1', clip.filename);
    try {
      await writeFile(target, bytes, { flag: 'wx' });
    } catch (error) {
      if (error.code !== 'EEXIST' || sha256(await readFile(target)) !== clip.sha256) throw error;
    }
    const { filename, scriptSha256: _script, ...record } = clip;
    records.push({ ...record, file: `actors-v1/${filename}` });
  }
  const source = `// Generated by scripts/generate-actor-reaction-voices.mjs. Listening review remains pending.\nexport const ACTOR_VOICE_RECORDINGS = Object.freeze(${JSON.stringify(records, null, 2)});\n`;
  await writeFile(join(runtime, 'actors.mjs'), source);
  return { clips: records.length, bytes: records.reduce((sum, item) => sum + item.bytes, 0) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2),
    option = (key) => {
      const index = args.indexOf(key);
      if (index === -1) return undefined;
      if (!args[index + 1] || args[index + 1].startsWith('--'))
        throw new Error('Missing value for ' + key);
      return args[index + 1];
    };
  if (
    args.some(
      (arg, index) =>
        !['--output', '--locale', '--synthesize', '--runtime'].includes(arg) &&
        !['--output', '--locale', '--runtime'].includes(args[index - 1]),
    )
  )
    throw new Error(
      'Use --output DIRECTORY [--locale en|uk] [--synthesize] [--runtime DIRECTORY].',
    );
  console.log(
    JSON.stringify(
      await generateActorReactionVoices({
        outputDirectory: option('--output'),
        locale: option('--locale') ?? null,
        generate: args.includes('--synthesize'),
      }),
      null,
      2,
    ),
  );
  if (option('--runtime'))
    console.log(
      JSON.stringify(
        await installActorVoiceEdition({
          outputDirectory: option('--output'),
          runtimeDirectory: option('--runtime'),
        }),
        null,
        2,
      ),
    );
}
