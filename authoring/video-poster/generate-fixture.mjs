#!/usr/bin/env node
// Owned diagnostic content only. Exclusive cache output; no dependency download.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const argv = process.argv.slice(2);
const portraitRotation =
  argv.length === 4 &&
  argv[0] === '--out' &&
  argv[2] === '--kind' &&
  argv[3] === 'portrait-rotation';
if (!((argv.length === 2 && argv[0] === '--out') || portraitRotation)) {
  console.log(
    'Usage: node authoring/video-poster/generate-fixture.mjs --out .cache/NEW_FIXTURE_DIRECTORY [--kind portrait-rotation]',
  );
  process.exit(argv.includes('--help') ? 0 : 2);
}
const out = path.resolve(root, argv[1]);
const cache = path.join(root, '.cache');
if (!out.startsWith(cache + path.sep))
  throw new Error('Use a new directory under this worktree’s .cache.');
async function ordinaryDirectory(directory) {
  try {
    await fs.mkdir(directory);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const info = await fs.lstat(directory);
  if (info.isSymbolicLink() || !info.isDirectory())
    throw new Error('Fixture cache ancestors must be ordinary directories, never symbolic links.');
}
await ordinaryDirectory(cache);
const realCache = await fs.realpath(cache);
if (realCache !== path.join(await fs.realpath(root), '.cache'))
  throw new Error('Fixture cache must belong to this worktree.');
let parent = cache;
for (const component of path.relative(cache, path.dirname(out)).split(path.sep).filter(Boolean)) {
  parent = path.join(parent, component);
  await ordinaryDirectory(parent);
  if ((await fs.realpath(parent)) !== path.join(realCache, path.relative(cache, parent)))
    throw new Error('Fixture cache parent resolves outside its owned location.');
}
await fs.mkdir(out); // Never replace a prior clip or its evidence.
if ((await fs.realpath(out)) !== path.join(realCache, path.relative(cache, out)))
  throw new Error('Fixture output changed location before generation.');
const clip = path.join(
  out,
  portraitRotation ? 'owned-portrait-rotation-fixture.mp4' : 'owned-poster-fixture.mp4',
);
const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
const ffmpegFilters =
  ffmpeg.status === 0
    ? spawnSync('ffmpeg', ['-hide_banner', '-filters'], { encoding: 'utf8' })
    : { status: null, stdout: '', stderr: '' };
let commands, engine, generator, intermediate;
let authored = { width: 640, height: 360, fps: 10, frames: 60, durationSeconds: 6, audio: false };
let orientationQualification = null;
if (portraitRotation) {
  if (ffmpeg.status !== 0)
    throw new Error(
      'The portrait-rotation fixture requires an existing ffmpeg and ffprobe; nothing was installed.',
    );
  const ffprobe = spawnSync('ffprobe', ['-version'], { encoding: 'utf8' });
  if (ffprobe.status !== 0)
    throw new Error(
      'The portrait-rotation fixture requires an existing ffprobe; nothing was installed.',
    );
  intermediate = path.join(out, 'encoded-landscape-intermediate.mp4');
  commands = [
    [
      'ffmpeg',
      '-nostdin',
      '-n',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=640x360:rate=10:duration=4',
      '-an',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      intermediate,
    ],
    [
      'ffmpeg',
      '-nostdin',
      '-n',
      '-display_rotation',
      '90',
      '-i',
      intermediate,
      '-map',
      '0:v:0',
      '-an',
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      clip,
    ],
  ];
  engine = `${ffmpeg.stdout}\n${ffprobe.stdout}`;
  generator =
    'ffmpeg testsrc2 encoded 640x360, then losslessly remuxed with a 90-degree display matrix; no audio';
  authored = {
    encodedWidth: 640,
    encodedHeight: 360,
    displayWidth: 360,
    displayHeight: 640,
    rotationDegrees: 90,
    fps: 10,
    frames: 40,
    durationSeconds: 4,
    audio: false,
  };
  orientationQualification = {
    expectedBrowserDisplay: { width: 360, height: 640, orientation: 'portrait' },
    compactProfile: { width: 202, height: 358, targetVideoBitrate: 900000 },
    evidence:
      'The encoded samples remain 640x360 while the MP4 display matrix rotates them to a 360x640 portrait presentation. Browser qualification must report the portrait display dimensions and independently reopen a 202x358 portrait AVC output.',
  };
} else if (
  ffmpeg.status === 0 &&
  ffmpegFilters.status === 0 &&
  /\bdrawtext\b/.test(`${ffmpegFilters.stdout}\n${ffmpegFilters.stderr}`)
) {
  const font = path
    .join(root, 'game/ui/fonts/field-kit/ibm-plex-mono-500.woff2')
    .replace(/([\\':])/g, '\\$1');
  commands = [
    [
      'ffmpeg',
      '-nostdin',
      '-n',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=640x360:rate=10:duration=6',
      '-vf',
      `drawtext=fontfile='${font}':text='OWNED FIXTURE frame %{n}':x=20:y=30:fontsize=32:fontcolor=white:box=1:boxcolor=black`,
      '-an',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      clip,
    ],
  ];
  engine = `${ffmpeg.stdout}\n${ffmpegFilters.stdout}`;
  generator = 'ffmpeg testsrc2 + burned frame number; no audio';
} else {
  if (process.platform !== 'darwin')
    throw new Error(
      'ffmpeg is unavailable. Install nothing automatically; use an existing ffmpeg or the macOS SDK route.',
    );
  const version = spawnSync('xcrun', ['swift', '--version'], { encoding: 'utf8' });
  if (version.status !== 0)
    throw new Error(
      'Neither ffmpeg nor a usable macOS Swift SDK is available. No fixture was generated.',
    );
  const swift = `import Foundation
import AVFoundation
import AppKit
import CoreVideo

let output = URL(fileURLWithPath: CommandLine.arguments[1])
let width = 640, height = 360, fps: Int32 = 10, count = 60
let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: width, AVVideoHeightKey: height])
input.expectsMediaDataInRealTime = false
let adapter = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB, kCVPixelBufferWidthKey as String: width, kCVPixelBufferHeightKey as String: height, kCVPixelBufferCGImageCompatibilityKey as String: true, kCVPixelBufferCGBitmapContextCompatibilityKey as String: true])
guard writer.canAdd(input) else { fatalError("H.264 input unavailable") }
writer.add(input)
guard writer.startWriting() else { fatalError("Writer failed: \\(String(describing: writer.error))") }
writer.startSession(atSourceTime: .zero)
let colors: [NSColor] = [.systemRed, .systemGreen, .systemBlue, .systemOrange, .systemPurple, .systemTeal]
for frame in 0..<count {
  let deadline = Date().addingTimeInterval(10)
  while !input.isReadyForMoreMediaData {
    guard writer.status == .writing && Date() < deadline else { fatalError("Writer readiness timeout") }
    Thread.sleep(forTimeInterval: 0.005)
  }
  var pixel: CVPixelBuffer?
  guard CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, adapter.pixelBufferPool!, &pixel) == kCVReturnSuccess, let buffer = pixel else { fatalError("Pixel buffer allocation failed") }
  CVPixelBufferLockBaseAddress(buffer, [])
  let context = CGContext(data: CVPixelBufferGetBaseAddress(buffer), width: width, height: height, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer), space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
  context.setFillColor(colors[frame / 10].cgColor); context.fill(CGRect(x: 0, y: 0, width: width, height: height))
  context.setFillColor(NSColor.black.cgColor); context.fill(CGRect(x: 12, y: 155, width: 616, height: 188))
  context.setFillColor(NSColor.white.cgColor); context.fill(CGRect(x: frame * 10, y: 20, width: 30, height: 95))
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
  let attributes: [NSAttributedString.Key: Any] = [.font: NSFont.monospacedSystemFont(ofSize: 30, weight: .bold), .foregroundColor: NSColor.white]
  let label = String(format: "OWNED POSTER FIXTURE\\nFRAME %02d / 60\\nTIME %.1f SECONDS", frame, Double(frame) / Double(fps))
  label.draw(in: CGRect(x: 28, y: 170, width: 590, height: 155), withAttributes: attributes)
  NSGraphicsContext.restoreGraphicsState()
  CVPixelBufferUnlockBaseAddress(buffer, [])
  guard adapter.append(buffer, withPresentationTime: CMTime(value: Int64(frame), timescale: fps)) else { fatalError("Append failed: \\(String(describing: writer.error))") }
}
writer.endSession(atSourceTime: CMTime(value: Int64(count), timescale: fps))
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
guard done.wait(timeout: .now() + 30) == .success && writer.status == .completed else { fatalError("Writer completion failed") }
print("Owned 640x360 H.264 MP4; 60 frames at10fps;6seconds; no audio track")
`;
  const source = path.join(out, 'generate.swift');
  await fs.writeFile(source, swift, { flag: 'wx' });
  commands = [['xcrun', 'swift', source, clip]];
  engine = version.stdout;
  generator =
    'macOS AVAssetWriter H.264; six owned color cards + burned frame/time + moving bar; no audio';
}
let result;
let generationLog = '';
for (const command of commands) {
  result = spawnSync(command[0], command.slice(1), { encoding: 'utf8', timeout: 120000 });
  generationLog += `$ ${command.join(' ')}\n${result.stdout ?? ''}\n${result.stderr ?? ''}\n`;
  if (result.status !== 0) break;
}
await fs.writeFile(path.join(out, 'generation.log'), generationLog, { flag: 'wx' });
if (result.status !== 0)
  throw new Error(
    `Fixture generation failed (${result.status ?? result.error?.message}); retained the attempt. No playback qualification claimed.`,
  );
if (intermediate) await fs.rm(intermediate);
const bytes = await fs.readFile(clip);
let nativeOrientationProbe = null;
if (portraitRotation) {
  const probe = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height:stream_side_data=rotation',
      '-of',
      'json',
      clip,
    ],
    { encoding: 'utf8', timeout: 30000 },
  );
  if (probe.status !== 0)
    throw new Error('ffprobe could not verify the generated portrait display matrix.');
  nativeOrientationProbe = JSON.parse(probe.stdout);
  const stream = nativeOrientationProbe.streams?.[0];
  if (
    stream?.width !== 640 ||
    stream?.height !== 360 ||
    Math.abs(stream.side_data_list?.[0]?.rotation) !== 90
  )
    throw new Error('Generated fixture did not retain the expected 90-degree display matrix.');
}
const record = {
  format: 'revealline-owned-video-fixture.v1',
  generator,
  engine,
  command: commands.at(-1),
  commands,
  scriptSha256: hash(await fs.readFile(fileURLToPath(import.meta.url))),
  clip: { path: clip, bytes: bytes.length, sha256: hash(bytes), mime: 'video/mp4' },
  authored,
  ...(orientationQualification ? { orientationQualification, nativeOrientationProbe } : {}),
  visualTrimQualification: {
    sourceRange: { startSeconds: 1, endSeconds: 4 },
    expectedStartFrame: 10,
    expectedLastFrame: 39,
    evidence: portraitRotation
      ? 'The asymmetric test pattern makes a lost rotation or shifted edge visible. Production qualification still requires browser-reported portrait display dimensions, fresh presented timestamps and decoded RGB evidence from the exact generated and exported hashes.'
      : 'The burned frame/time label and per-second visual sequence make a shifted start or end visible. Production qualification still requires fresh browser-presented timestamps and decoded RGB evidence from the exact generated and exported hashes.',
  },
  limits:
    'Generated diagnostic fixture, not artwork or browser decode evidence. Native export may vary by SDK/encoder; actual file hash is recorded. No audible-track qualification is possible with this silent clip.',
};
await fs.writeFile(path.join(out, 'fixture.json'), JSON.stringify(record, null, 2) + '\n', {
  flag: 'wx',
});
console.log(JSON.stringify(record, null, 2));
