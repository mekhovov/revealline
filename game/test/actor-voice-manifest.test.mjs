import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ACTOR_VOICE_RECORDINGS } from '../audio/reactions/actors.mjs';
import { inspectRecordingContainer } from '../journey/reaction-recording-format.mjs';
import { ACTOR_REACTION_LINES } from '../hunt/actor-reactions.mjs';
import { actorVoiceGenerationPlan } from '../hunt/actor-voice-manifest.mjs';
import { generateActorReactionVoices } from '../../scripts/generate-actor-reaction-voices.mjs';

test('published actor originals contain the exact bounded bilingual media they declare', async () => {
  const jobs = new Map(
    actorVoiceGenerationPlan().jobs.map((job) => [`${job.lineId}|${job.locale}`, job]),
  );
  assert.equal(ACTOR_VOICE_RECORDINGS.length, jobs.size);
  for (const clip of ACTOR_VOICE_RECORDINGS) {
    const key = `${clip.lineId}|${clip.locale}`,
      job = jobs.get(key);
    assert.ok(job);
    jobs.delete(key);
    assert.equal(clip.transcript, job.transcript);
    const bytes = await readFile(new URL(`../audio/reactions/${clip.file}`, import.meta.url));
    assert.equal(bytes.length, clip.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), clip.sha256);
    const metadata = inspectRecordingContainer(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    assert.ok(metadata.maxDecodedSeconds <= 15);
    assert.equal(clip.provenance.releaseStatus, 'listening-review-required');
  }
  assert.equal(jobs.size, 0);
});

test('actor speech manifest has two exact lines for every family and both locales', () => {
  const plan = actorVoiceGenerationPlan();
  assert.equal(plan.jobs.length, 48);
  assert.equal(new Set(plan.jobs.map((job) => job.lineId)).size, 24);
  assert.equal(new Set(plan.jobs.map((job) => job.filename)).size, 48);
  for (const job of plan.jobs) {
    const line = ACTOR_REACTION_LINES.find((entry) => entry.id === job.lineId);
    assert.equal(job.transcript, line.text[job.locale]);
    assert.equal(job.status, 'generation-pending');
    assert.equal(Object.isFrozen(job.profile), true);
    assert.equal(
      plan.jobs.filter((entry) => entry.speaker === job.speaker && entry.locale === job.locale)
        .length,
      2,
    );
  }
  assert.equal(actorVoiceGenerationPlan('uk').jobs.length, 24);
  assert.throws(() => actorVoiceGenerationPlan('xx'));
});

test('preparing a pinned voice edition never invokes generation and rejects changed scripts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'actor-voice-plan-'));
  try {
    let calls = 0;
    const input = {
      outputDirectory: directory,
      locale: 'en',
      synthesize: async () => {
        calls++;
        throw Error('not authorized by plan-only operation');
      },
    };
    const result = await generateActorReactionVoices(input);
    assert.equal(result.generated, 0);
    assert.equal(calls, 0);
    const plan = JSON.parse(await readFile(join(directory, 'generation-plan.json'), 'utf8'));
    assert.equal(plan.jobs.length, 24);
    assert.ok(plan.jobs.every((job) => /^[a-f0-9]{64}$/.test(job.scriptSha256)));
    await generateActorReactionVoices(input);
    await assert.rejects(
      generateActorReactionVoices({ ...input, locale: 'uk' }),
      /different pinned script edition/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
