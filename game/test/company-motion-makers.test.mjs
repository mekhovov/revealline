import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Input, BufferSource, MP4 } from '../vendor/mediabunny-1.59.1.min.mjs';
import {
  CURRICULUM_MOTION_MAKERS_MISSION,
  CURRICULUM_MOTION_MAKERS_FILES,
  CURRICULUM_MOTION_MAKERS_ASSET_IDS,
  createCurriculumMotionMakersContent,
} from '../company-campaigns/curriculum-motion-makers.mjs';
import { rewardMediaReferences, inspectRewardMediaBytes } from '../rewards/media-format.mjs';
import { validateCompletionReward, completionRewardAssetReferences } from '../rewards/model.mjs';
import {
  MOTION_MAKERS_CLIP,
  motionMakersState,
  renderMotionMakersFrame,
} from '../../scripts/motion-makers-diagram.mjs';
import { encodeSpritePNG } from '../../scripts/produce-field-kit-sprites.mjs';
import { motionMakersText, produceMotionMakers } from '../../scripts/produce-motion-makers.mjs';

const root = new URL('../../', import.meta.url);
const files = CURRICULUM_MOTION_MAKERS_FILES.map((row) => ({
  ...row,
  approved: true,
  publication: 'public',
  dependencies: [],
}));
const content = () => createCurriculumMotionMakersContent(CURRICULUM_MOTION_MAKERS_MISSION, files);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('a missing optional offline encoder rejects cleanly without creating a usable receipt', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'motion-makers-encoder-'));
  try {
    await assert.rejects(
      produceMotionMakers({
        outputDirectory: directory,
        ffmpeg: join(directory, 'missing-encoder'),
      }),
      /ENOENT/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Motion Makers pins six original files and a real silent 12-second bounded video', async () => {
  const video = content().find((payload) => payload.type === 'video');
  const references = rewardMediaReferences(video);
  assert.equal(references.length, 6);
  let total = 0;
  for (const { role, reference, locale } of references) {
    const file = files.find((row) => row.id === reference.assetId);
    assert(file);
    const bytes = await readFile(new URL(file.path, root));
    assert.equal(bytes.length, file.bytes);
    assert.equal(hash(bytes), file.sha256);
    assert.equal(reference.sha256, file.sha256);
    const inspected = inspectRewardMediaBytes(file, role, bytes);
    total += bytes.length;
    if (role === 'captions') {
      assert.equal(inspected.endSeconds, 12);
      assert.equal(bytes.toString('utf8'), motionMakersText(locale).captions);
    }
    if (role === 'transcript') {
      assert.equal(bytes.toString('utf8'), motionMakersText(locale).transcript);
      assert.match(
        inspected.text,
        /https:\/\/www\.grc\.nasa\.gov\/www\/k-12\/airplane\/propeller\.html/,
      );
      assert(
        locale === 'uk'
          ? /не.*моделювання/.test(inspected.text)
          : /not.*simulation/.test(inspected.text),
      );
    }
  }
  assert.equal(total, 238110);
  assert(total < 256 * 1024, 'The complete six-file educational clip is under 256 KiB.');
  const file = files.find((row) => row.id === video.asset.assetId);
  const input = new Input({
    source: new BufferSource(await readFile(new URL(file.path, root))),
    formats: [MP4],
  });
  try {
    const track = await input.getPrimaryVideoTrack();
    assert.equal((await input.getTracks()).length, 1);
    assert.equal(await input.getPrimaryAudioTrack(), null);
    assert.equal(await input.computeDuration(), 12);
    assert.equal(track.codec, 'avc');
    assert.equal(track.displayWidth, 960);
    assert.equal(track.displayHeight, 540);
  } finally {
    input.dispose();
  }
});

test('the original frame source has stationary stator, shared illustrative rotation and an independently reproducible complete poster', async () => {
  assert.deepEqual(MOTION_MAKERS_CLIP, { width: 960, height: 540, fps: 24, seconds: 12 });
  for (const frame of [0, 60, 120, 180, 240, 287]) {
    const state = motionMakersState(frame);
    assert.equal(state.statorAngle, 0);
    assert.equal(state.rotorAngle, state.propellerAngle);
  }
  for (const frame of [-1, 0.5, 288, Infinity]) assert.throws(() => motionMakersState(frame));
  assert.deepEqual(
    renderMotionMakersFrame(0),
    renderMotionMakersFrame(48),
    'Opening gives a still orientation period.',
  );
  assert.deepEqual(
    renderMotionMakersFrame(240),
    renderMotionMakersFrame(287),
    'The final complete role diagram settles instead of looping.',
  );
  const opening = renderMotionMakersFrame(0),
    moving = renderMotionMakersFrame(120);
  assert.notEqual(hash(opening.rgba), hash(moving.rgba));
  // This patch contains the whole inner stator but excludes the moving outer
  // rotor: its pixels must stay identical while the illustrative rotor moves.
  for (let y = 208; y < 342; y++)
    for (let x = 193; x < 327; x++) {
      if (Math.hypot(x - 260, y - 275) >= 68) continue;
      const at = (y * 960 + x) * 4;
      assert.deepEqual(opening.rgba.subarray(at, at + 4), moving.rgba.subarray(at, at + 4));
    }
  const poster = files.find((row) => row.id === 'fpv-motion-makers-poster');
  const bytes = await readFile(new URL(poster.path, root));
  assert.deepEqual(bytes, encodeSpritePNG(renderMotionMakersFrame(240)));
});

test('only Motion Makers can add the optional video and every reference requires exact public admission', async () => {
  assert.deepEqual(createCurriculumMotionMakersContent('fpv-meet-aircraft-01', []), []);
  for (const expected of files) {
    assert.throws(
      () =>
        createCurriculumMotionMakersContent(
          CURRICULUM_MOTION_MAKERS_MISSION,
          files.filter((row) => row.id !== expected.id),
        ),
      /exact admitted/,
    );
    for (const change of [
      (row) => {
        row.approved = false;
      },
      (row) => {
        row.publication = 'private';
      },
      (row) => {
        row.bytes++;
      },
      (row) => {
        row.sha256 = '0'.repeat(64);
      },
      (row) => {
        row.path = 'game/other.mp4';
      },
    ]) {
      const wrong = structuredClone(files);
      change(wrong.find((row) => row.id === expected.id));
      assert.throws(
        () => createCurriculumMotionMakersContent(CURRICULUM_MOTION_MAKERS_MISSION, wrong),
        /exact admitted/,
      );
    }
  }
  const payloads = content();
  assert.deepEqual(
    payloads.map((row) => [row.id, row.type]),
    [
      ['fpv-meet-aircraft-02-motion-guide', 'knowledge'],
      ['fpv-meet-aircraft-02-motion-video', 'video'],
    ],
  );
  const rewards = JSON.parse(
    await readFile(
      new URL('game/content/company-campaigns/fpv-meet-aircraft.rewards.json', root),
      'utf8',
    ),
  );
  const current = rewards.find(
    (row) => row.scope.kind === 'mission' && row.scope.id === CURRICULUM_MOTION_MAKERS_MISSION,
  );
  assert(current);
  const proposed = validateCompletionReward({
    ...current,
    payloads: [
      ...current.payloads.filter((row) => !payloads.some((next) => next.id === row.id)),
      ...payloads,
    ],
  });
  assert.deepEqual(proposed.requirements, current.requirements);
  for (const id of CURRICULUM_MOTION_MAKERS_ASSET_IDS)
    assert(completionRewardAssetReferences([proposed]).some((ref) => ref.assetId === id));
  assert.deepEqual(
    JSON.parse(JSON.stringify(payloads)),
    payloads,
    'Export/import needs no new media type or private playback state.',
  );
  assert(!JSON.stringify(payloads).includes('autoplay'));
});
