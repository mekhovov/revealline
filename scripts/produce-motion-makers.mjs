import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { encodeSpritePNG } from './produce-field-kit-sprites.mjs';
import { MOTION_MAKERS_CLIP, renderMotionMakersFrame } from './motion-makers-diagram.mjs';
import {
  MOTION_MAKERS_STORY,
  MOTION_MAKERS_SOURCES,
} from '../game/company-campaigns/curriculum-motion-makers.mjs';

export const MOTION_MAKERS_ASSET_DIRECTORY = 'game/editions/assets/discovery/motion-makers';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function motionMakersText(locale) {
  const story = MOTION_MAKERS_STORY[locale];
  if (!story) throw new TypeError('Motion Makers supports English and Ukrainian.');
  return {
    captions:
      'WEBVTT\n\n' +
      story.cues
        .map(([start, end, text], i) => `${i + 1}\n${start} --> ${end}\n${text}`)
        .join('\n\n') +
      '\n',
    transcript:
      [
        story.title,
        story.description,
        ...story.paragraphs,
        ...MOTION_MAKERS_SOURCES.map((source) => `${source.title}\n${source.url}`),
      ].join('\n\n') + '\n',
  };
}

/** Streams original frames directly to an explicit authoring-only ffmpeg tool.
 * No browser encoder, network call, runtime dependency or temporary frame files. */
export async function produceMotionMakers({ outputDirectory, ffmpeg = 'ffmpeg' }) {
  if (!outputDirectory) throw new TypeError('Choose an explicit media output directory.');
  await mkdir(outputDirectory, { recursive: true });
  const { width, height, fps, seconds } = MOTION_MAKERS_CLIP;
  const filenames = [
    ['video', 'motion-makers-v1.mp4'],
    ['poster', 'motion-makers-poster-v1.png'],
    ['transcript-en', 'motion-makers-en-v1.txt'],
    ['transcript-uk', 'motion-makers-uk-v1.txt'],
    ['captions-en', 'motion-makers-en-v1.vtt'],
    ['captions-uk', 'motion-makers-uk-v1.vtt'],
  ];
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    '-y',
    '-fflags',
    '+bitexact',
    '-f',
    'rawvideo',
    '-pixel_format',
    'rgba',
    '-video_size',
    `${width}x${height}`,
    '-framerate',
    String(fps),
    '-i',
    'pipe:0',
    '-frames:v',
    String(fps * seconds),
    '-an',
    '-c:v',
    'libx264',
    '-threads',
    '1',
    '-preset',
    'veryslow',
    '-crf',
    '21',
    '-profile:v',
    'baseline',
    '-pix_fmt',
    'yuv420p',
    '-flags:v',
    '+bitexact',
    '-sws_flags',
    'accurate_rnd+bitexact',
    '-map_metadata',
    '-1',
    '-movflags',
    '+faststart',
    resolve(outputDirectory, filenames[0][1]),
  ];
  const encoder = spawn(ffmpeg, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let diagnostics = '';
  encoder.stderr.on('data', (chunk) => {
    diagnostics = (diagnostics + chunk).slice(-8192);
  });
  const exited = new Promise((resolveExit) => {
    encoder.once('error', (error) => resolveExit({ error }));
    encoder.once('close', (code) => resolveExit({ code }));
  });
  // Retain the error while frames are being streamed, then fail the production.
  let streamError;
  encoder.stdin.on('error', (error) => {
    streamError = error;
  });
  try {
    await once(encoder, 'spawn');
    for (let frame = 0; frame < fps * seconds; frame++) {
      if (streamError) throw streamError;
      if (!encoder.stdin.write(renderMotionMakersFrame(frame).rgba))
        await once(encoder.stdin, 'drain');
    }
    encoder.stdin.end();
    const { code, error } = await exited;
    if (error) throw error;
    if (code !== 0) throw new Error('Motion Makers encoding failed: ' + diagnostics);
  } catch (error) {
    encoder.stdin.destroy();
    encoder.kill();
    await exited;
    throw error;
  }
  // Full static role diagram, with air symbols; never merely an opening frame.
  await writeFile(
    resolve(outputDirectory, filenames[1][1]),
    encodeSpritePNG(renderMotionMakersFrame(240)),
  );
  for (const locale of ['en', 'uk']) {
    const text = motionMakersText(locale);
    await writeFile(resolve(outputDirectory, `motion-makers-${locale}-v1.txt`), text.transcript);
    await writeFile(resolve(outputDirectory, `motion-makers-${locale}-v1.vtt`), text.captions);
  }
  const files = [];
  for (const [suffix, filename] of filenames) {
    const bytes = await readFile(resolve(outputDirectory, filename));
    files.push({
      id: 'fpv-motion-makers-' + suffix,
      path: `${MOTION_MAKERS_ASSET_DIRECTORY}/${filename}`,
      bytes: bytes.length,
      sha256: sha(bytes),
    });
  }
  return {
    format: 'revealline-original-concept-video.v1',
    missionId: 'fpv-meet-aircraft-02',
    revision: '1',
    clip: MOTION_MAKERS_CLIP,
    audioStreams: 0,
    source:
      'Original code-drawn educational illustration; no copied source images, fonts, music or hardware footage.',
    sourceModules: [
      'scripts/motion-makers-diagram.mjs',
      'scripts/produce-motion-makers.mjs',
      'game/company-campaigns/curriculum-motion-makers.mjs',
    ],
    sourceInspiration: MOTION_MAKERS_SOURCES,
    encoder: execFileSync(ffmpeg, ['-version'], { encoding: 'utf8' }).split('\n')[0],
    encoderArguments: args.map((arg) =>
      arg === resolve(outputDirectory, filenames[0][1]) ? filenames[0][1] : arg,
    ),
    files,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const argument = process.argv.slice(2).find((value) => value.startsWith('--output='));
  if (!argument)
    throw new Error('Usage: node scripts/produce-motion-makers.mjs --output=<directory>');
  const receipt = await produceMotionMakers({
    outputDirectory: resolve(argument.slice('--output='.length)),
  });
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
}
