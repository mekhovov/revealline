// Original Dawn Signal motion over an unchanged imagegen illustration.
// Usage: xcrun swift animate.swift ORIGINAL.png NEW_OUTPUT_DIRECTORY
// Apple framework generation/inspection; no runtime or storage registration.
import Foundation
import AVFoundation
import AppKit
import CoreVideo
import ImageIO
import UniformTypeIdentifiers
import CryptoKit

func fail(_ message: String) -> Never { fatalError(message) }
guard CommandLine.arguments.count == 3 else { fail("Expected original PNG and a new output directory") }
let sourceURL = URL(fileURLWithPath: CommandLine.arguments[1]).standardizedFileURL
let out = URL(fileURLWithPath: CommandLine.arguments[2]).standardizedFileURL
let fm = FileManager.default
guard !fm.fileExists(atPath: out.path) else { fail("Output already exists; preserve previous originals") }
try fm.createDirectory(at: out, withIntermediateDirectories: false)
let sourceData = try Data(contentsOf: sourceURL)
guard let imageSource = CGImageSourceCreateWithData(sourceData as CFData, nil),
      let scene = CGImageSourceCreateImageAtIndex(imageSource, 0, nil) else { fail("Original PNG unavailable") }
let width = 640, height = 360, fps: Int32 = 12, frames = 96
let colorspace = CGColorSpaceCreateDeviceRGB()
func digest(_ data: Data) -> String { SHA256.hash(data: data).map { String(format:"%02x", $0) }.joined() }
func color(_ hex: UInt32, _ alpha: CGFloat = 1) -> CGColor {
  CGColor(red: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: alpha)
}
func rectangle(_ c: CGContext, _ x: Double, _ y: Double, _ w: Double, _ h: Double, _ hex: UInt32, _ alpha: CGFloat = 1) {
  c.setFillColor(color(hex, alpha)); c.fill(CGRect(x: floor(x), y: floor(y), width: w, height: h))
}
func smooth(_ x: Double) -> Double { let t = max(0, min(1, x)); return t*t*(3-2*t) }

// The plate has no aircraft. This small original craft is code-native pixel art,
// built from hull, arms, motors, steady navigation lights and rotor silhouettes.
func craft(_ c: CGContext, x: Double, y: Double, t: Double, frame: Int) {
  let landed = t >= 6.4, bob = landed ? 0 : sin(t * 2.1) * 1.1
  c.saveGState(); c.translateBy(x: floor(x), y: floor(y + bob))
  let span = landed ? 5.0 : (frame % 3 == 0 ? 7.0 : 6.0)
  // Far arms and four independently legible motor housings.
  rectangle(c,-17,-5,34,2,0x071520); rectangle(c,-13,5,26,2,0x071520)
  rectangle(c,-12,-4,5,3,0x3C616C); rectangle(c,8,-4,5,3,0x3C616C)
  rectangle(c,-12,3,5,3,0x203844); rectangle(c,8,3,5,3,0x203844)
  for (px,py) in [(-15.0,-5.0),(15.0,-5.0),(-12.0,6.0),(12.0,6.0)] {
    rectangle(c,px-2,py,5,3,0x07121A);rectangle(c,px-1,py,3,1,0x7097A0)
    rectangle(c,px-span,py-1,span*2+1,1,0xB6C8BC,0.8)
  }
  rectangle(c,-8,-6,16,12,0x06101A); rectangle(c,-6,-5,12,9,0x3D5961)
  rectangle(c,-4,-6,9,3,0x88A5A4); rectangle(c,-5,-2,11,4,0x1B343E)
  rectangle(c,-2,-5,4,3,0xDEB56B); rectangle(c,-1,-4,2,2,0xFFE1A1)
  rectangle(c,-3,4,7,3,0x0C1D27); rectangle(c,-1,4,3,2,0x73CFD2)
  rectangle(c,-7,7,2,3,0x172D35); rectangle(c,6,7,2,3,0x172D35)
  rectangle(c,-9,10,5,1,0x839796); rectangle(c,5,10,5,1,0x839796)
  c.restoreGState()
}

func draw(_ c: CGContext, frame: Int) {
  let t = Double(frame) / Double(fps)
  c.interpolationQuality = .none; c.setShouldAntialias(false)
  c.setFillColor(color(0x071422)); c.fill(CGRect(x:0,y:0,width:width,height:height))
  // Contain the full 1672x941 source: never crop or modify its original bytes.
  let scale = min(Double(width)/Double(scene.width), Double(height)/Double(scene.height))
  let sw = Double(scene.width)*scale, sh = Double(scene.height)*scale
  c.draw(scene, in:CGRect(x:(Double(width)-sw)/2,y:(Double(height)-sh)/2,width:sw,height:sh))
  // All animation coordinates use top-left screen convention.
  c.translateBy(x:0,y:CGFloat(height)); c.scaleBy(x:1,y:-1)
  // Low-contrast moving glints stay within the open water. No full-field flashes.
  for i in 0..<40 {
    let x = 286.0 + Double((i*43)%280) + sin(t*0.7 + Double(i))*2.0
    let y = 213.0 + Double((i*17)%90)
    let warm = i%7 == 0
    rectangle(c,x,y,Double(3+i%7),1,warm ? 0xE8B970 : 0x81ADB8,warm ? 0.34 : 0.19)
  }
  // Soft stepped lantern breath, limited to the existing lantern chamber.
  let light = CGFloat(0.055 + 0.025*sin(t*0.65))
  rectangle(c,138,51,20,21,0xFFD991,light)
  rectangle(c,141,55,14,14,0xFFF0BF,light)
  // Eight-second return: approach, descend, settle. It is a scene, not a loop.
  let progress = smooth(t/6.4)
  let x = 523.0 + (154.0-523.0)*progress
  let y = 112.0 + (215.0-112.0)*progress - sin(progress*Double.pi)*20
  if t > 4 {
    let opacity = CGFloat(min(0.24,(t-4)*0.09))
    rectangle(c,138,228,30,2,0x091522,opacity)
  }
  craft(c,x:x,y:y,t:t,frame:frame)
}

let clip = out.appendingPathComponent("dawn-signal.mp4")
let writer = try AVAssetWriter(outputURL:clip,fileType:.mp4)
let settings: [String:Any] = [
  AVVideoCodecKey:AVVideoCodecType.h264, AVVideoWidthKey:width, AVVideoHeightKey:height,
  AVVideoCompressionPropertiesKey:[AVVideoAverageBitRateKey:1_800_000,AVVideoExpectedSourceFrameRateKey:fps,AVVideoMaxKeyFrameIntervalKey:24,AVVideoAllowFrameReorderingKey:false,AVVideoProfileLevelKey:AVVideoProfileLevelH264MainAutoLevel]
]
let input = AVAssetWriterInput(mediaType:.video,outputSettings:settings)
input.expectsMediaDataInRealTime = false
let adapter = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput:input,sourcePixelBufferAttributes:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32ARGB,kCVPixelBufferWidthKey as String:width,kCVPixelBufferHeightKey as String:height,kCVPixelBufferCGImageCompatibilityKey as String:true,kCVPixelBufferCGBitmapContextCompatibilityKey as String:true])
guard writer.canAdd(input) else { fail("H.264 encoder unavailable") }
writer.add(input); guard writer.startWriting() else { fail("Writer could not start") }
writer.startSession(atSourceTime:.zero)
for frame in 0..<frames {
  let deadline = Date().addingTimeInterval(10)
  while !input.isReadyForMoreMediaData {
    guard writer.status == .writing && Date() < deadline else { fail("Writer readiness timed out") }
    try await Task.sleep(nanoseconds:5_000_000)
  }
  var pixel: CVPixelBuffer?
  guard let pool = adapter.pixelBufferPool, CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault,pool,&pixel) == kCVReturnSuccess, let buffer = pixel else { fail("Frame allocation failed") }
  CVPixelBufferLockBaseAddress(buffer,[])
  guard let context = CGContext(data:CVPixelBufferGetBaseAddress(buffer),width:width,height:height,bitsPerComponent:8,bytesPerRow:CVPixelBufferGetBytesPerRow(buffer),space:colorspace,bitmapInfo:CGImageAlphaInfo.noneSkipFirst.rawValue) else { fail("Frame context failed") }
  draw(context,frame:frame)
  CVPixelBufferUnlockBaseAddress(buffer,[])
  guard adapter.append(buffer,withPresentationTime:CMTime(value:Int64(frame),timescale:fps)) else { fail("Frame append failed") }
}
writer.endSession(atSourceTime:CMTime(value:Int64(frames),timescale:fps))
input.markAsFinished()
writer.finishWriting {}
let finishDeadline = Date().addingTimeInterval(30)
while writer.status == .writing && Date() < finishDeadline {
  try await Task.sleep(nanoseconds:5_000_000)
}
guard writer.status == .completed else { fail("Writer completion failed") }

// Inspect the actual compressed movie, not just intended encoder settings.
let asset = AVURLAsset(url:clip)
let duration = try await asset.load(.duration)
let tracks = try await asset.loadTracks(withMediaType:.video)
let audioTracks = try await asset.loadTracks(withMediaType:.audio)
guard tracks.count == 1 && audioTracks.isEmpty && abs(duration.seconds-8) < 0.001 else { fail("Unexpected output tracks or duration") }
let size = try await tracks[0].load(.naturalSize)
guard Int(size.width)==width && Int(size.height)==height else { fail("Unexpected output dimensions") }
let reader = try AVAssetReader(asset:asset)
let readerOutput = AVAssetReaderTrackOutput(track:tracks[0],outputSettings:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32BGRA])
reader.add(readerOutput); guard reader.startReading() else { fail("Native decode failed to start") }
var samples: [[String:Any]] = []
while let sample = readerOutput.copyNextSampleBuffer() {
  guard let pixel = CMSampleBufferGetImageBuffer(sample) else { fail("Decoded sample has no frame") }
  let time = CMSampleBufferGetPresentationTimeStamp(sample).seconds
  CVPixelBufferLockBaseAddress(pixel,.readOnly)
  let data = Data(bytes:CVPixelBufferGetBaseAddress(pixel)!,count:CVPixelBufferGetBytesPerRow(pixel)*CVPixelBufferGetHeight(pixel))
  samples.append(["mediaTime":time,"decodedPixelSha256":digest(data)])
  CVPixelBufferUnlockBaseAddress(pixel,.readOnly)
}
guard reader.status == .completed && samples.count == frames else { fail("Native decode did not complete all96frames") }
for (index,sample) in samples.enumerated() {
  guard abs((sample["mediaTime"] as! Double)-Double(index)/Double(fps)) < 0.001 else { fail("Decoded frame timestamp differs") }
}
func savePNG(_ image: CGImage, _ url: URL) throws {
  guard let dest = CGImageDestinationCreateWithURL(url as CFURL,UTType.png.identifier as CFString,1,nil) else { fail("PNG destination unavailable") }
  CGImageDestinationAddImage(dest,image,nil); guard CGImageDestinationFinalize(dest) else { fail("PNG encoding failed") }
}
let imageGenerator = AVAssetImageGenerator(asset:asset)
imageGenerator.appliesPreferredTrackTransform = true
imageGenerator.requestedTimeToleranceBefore = .zero
imageGenerator.requestedTimeToleranceAfter = .zero
var captures: [[String:Any]] = []
for index in [0,24,48,72,95] {
  let requested = CMTime(value:Int64(index),timescale:fps)
  var observed = CMTime.invalid
  let image = try imageGenerator.copyCGImage(at:requested,actualTime:&observed)
  let name = index == 48 ? "poster.png" : String(format:"frame-%02d.png",index)
  let url = out.appendingPathComponent(name)
  try savePNG(image,url)
  let bytes = try Data(contentsOf:url)
  captures.append(["path":name,"requestedTime":requested.seconds,"observedMediaTime":observed.seconds,"timingEvidence":"AVAssetImageGenerator.actualTime","bytes":bytes.count,"sha256":digest(bytes),"width":image.width,"height":image.height])
}
let clipData = try Data(contentsOf:clip)
guard clipData.count <= 64*1024*1024 else { fail("Video exceeds existing64MiBcap") }
let posterData = try Data(contentsOf:out.appendingPathComponent("poster.png"))
guard posterData.count <= 4*1024*1024 else { fail("Poster exceeds existing4MiBcap") }
let result: [String:Any] = [
  "format":"revealline-original-story-generation.v1",
  "illustration":["path":sourceURL.path,"sha256":digest(sourceData),"bytes":sourceData.count,"width":scene.width,"height":scene.height],
  "video":["path":"dawn-signal.mp4","sha256":digest(clipData),"bytes":clipData.count,"mime":"video/mp4","width":width,"height":height,"durationSeconds":duration.seconds,"fps":fps,"frames":samples.count,"audioTracks":audioTracks.count],
  "captures":captures,"decodedSamples":samples,
  "qualification":"Actual macOS AVFoundation encoding and96-frame native decode. No browser, hardware-controller, integrated story/earned, offline, public or soundtrack qualification.",
  "determinism":"Illustration bytes unchanged; motion is deterministic from frame index. Encoded MP4/PNG bytes may differ across encoder/SDK versions; preserve exact accepted outputs."
]
let json = try JSONSerialization.data(withJSONObject:result,options:[.prettyPrinted,.sortedKeys])
try (json + Data([10])).write(to:out.appendingPathComponent("native-inspection.json"),options:.withoutOverwriting)
print("PASS:640x360 H.264,8seconds,96decodedframes,noaudio;exactmovie/poster/timestampsrecorded")
