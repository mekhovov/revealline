"""Bounded, explicit OGG -> PCM16 -> MP3 authoring; no acquisition or approval.

Run with bundled Python 3.12 and the pinned, task-local lameenc package on
PYTHONPATH. Original source pins come from expansion-downloads.json. Existing
outputs/receipts are never overwritten. Only this process's scratch is removed.
"""
from pathlib import Path
import datetime
import hashlib
import importlib.metadata
import json
import math
import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
import time
import wave

import lameenc

MIB = 1024 * 1024
FOLDER = Path(__file__).resolve().parents[1]
ROOT = FOLDER.parents[2]
CACHE = ROOT / ".cache/licensed-expansion-encoder-20260921"
INPUT = FOLDER / "provenance/expansion-downloads.json"
OUTPUT = FOLDER / "provenance/expansion-derivatives.json"
WHEEL = CACHE / "lameenc-1.8.4-cp312-cp312-macosx_11_0_arm64.whl"
WHEEL_SHA = "fb0d5bb76b09d8bf4e27f4824a72e4acd659bd4ec8dac2879fd5744f3d6d88fc"
MODULE_SHA = "c7ed7ca6776e6c05cecd0cf90d347faa0a0781a7aacf7093300796090d526f4e"
SCRATCH_LIMIT = 80 * MIB
LIBRARY_LIMIT = 650 * MIB
FREE_RESERVE = 1024 * MIB
MAX_DURATION = 720


def digest(file):
    with file.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def size(folder):
    return sum(p.stat().st_size for p in folder.rglob("*") if p.is_file())


def ordinary(relative):
    parts = Path(relative).parts
    if Path(relative).is_absolute() or not parts or any(p in (".", "..") for p in parts):
        raise ValueError("Invalid source path")
    p = FOLDER
    for part in parts:
        p = p / part
        if p.is_symlink():
            raise ValueError("Source links are not allowed")
    if not p.is_file():
        raise ValueError("Source is not an ordinary file")
    return p


def verify(pin):
    source = ordinary(pin["path"])
    if source.stat().st_size != pin["bytes"] or digest(source) != pin["sha256"]:
        raise ValueError("Original changed: " + pin["path"])
    return source


def main():
    if sys.version_info[:2] != (3, 12) or importlib.metadata.version("lameenc") != "1.8.4":
        raise RuntimeError("Requires pinned Python 3.12/lameenc 1.8.4")
    module = Path(lameenc.__file__).resolve()
    if not module.is_relative_to(CACHE.resolve()) or digest(module) != MODULE_SHA or digest(WHEEL) != WHEEL_SHA:
        raise RuntimeError("Encoder does not match task-local pins")
    if OUTPUT.exists():
        raise RuntimeError("Receipt already exists; refusing to overwrite")
    intake_hash = digest(INPUT)
    intake = json.loads(INPUT.read_text())
    tracks = [t for t in intake["tracks"] if t["original"]["path"].endswith(".ogg")]
    if not 0 < len(tracks) <= 128 or len({t["id"] for t in tracks}) != len(tracks):
        raise ValueError("Invalid bounded intake")
    for t in intake["tracks"]:
        verify(t["original"])
    for t in tracks:
        if not re.fullmatch(r"[a-z0-9.-]+", t["id"]):
            raise ValueError("Invalid intake identity")
        if (FOLDER / "derivatives" / ("expansion-20260921-" + t["id"] + ".mp3")).exists():
            raise RuntimeError("Derivative already exists")

    measurements = {"maximumScratchAndToolBytes": size(CACHE), "minimumFreeBytes": shutil.disk_usage(ROOT).free}

    def guard(additional_scratch=0, additional_library=0):
        scratch = size(CACHE)
        free = shutil.disk_usage(ROOT).free
        library = size(FOLDER)
        measurements["maximumScratchAndToolBytes"] = max(measurements["maximumScratchAndToolBytes"], scratch)
        measurements["minimumFreeBytes"] = min(measurements["minimumFreeBytes"], free)
        if scratch + additional_scratch >= SCRATCH_LIMIT:
            raise RuntimeError("Task scratch/tools would exceed 80 MiB; serial pass required")
        if free - additional_scratch - additional_library < FREE_RESERVE:
            raise RuntimeError("Insufficient 1 GiB free reserve")
        if library + additional_library >= LIBRARY_LIMIT:
            raise RuntimeError("Active licensed library would exceed 650 MiB")

    def command(argv, timeout=60):
        begin = time.monotonic()
        process = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            while process.poll() is None:
                guard()
                if time.monotonic() - begin > timeout:
                    raise TimeoutError("Codec time budget exceeded")
                time.sleep(0.1)
            stdout, stderr = process.communicate()
            if process.returncode:
                raise RuntimeError(f"Codec failed ({process.returncode}): {stderr[:4096]}")
            if len(stdout) + len(stderr) > 65536:
                raise RuntimeError("Unexpected codec diagnostic size")
            guard()
            return {"exitCode": process.returncode, "stderr": stderr, "stdout": stdout, "seconds": round(time.monotonic() - begin, 3)}
        finally:
            if process.poll() is None:
                process.kill()
                process.communicate()

    encoder = {
        "package": "lameenc", "version": "1.8.4", "moduleSha256": MODULE_SHA,
        "wheelSha256": WHEEL_SHA, "bitRateKbps": 256, "quality": 2,
        "sampleRate": "preserve original, recorded per track", "channels": "preserve original",
        "transform": "CoreAudio Vorbis decode to PCM16, LAME MP3 encode; full duration; no resampling, trim, gain, normalization, fade or remix. Lossy derivative; OGG original retained.",
    }
    receipt = {
        "format": "revealline-authored-mp3-derivatives.v1",
        "at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "encoder": encoder,
        "tools": {"python": sys.version, "platform": platform.platform(), "afconvertSha256": digest(Path("/usr/bin/afconvert")), "afinfoSha256": digest(Path("/usr/bin/afinfo")), "helperSha256": digest(Path(__file__)), "wheelSource": json.loads((CACHE / "wheel-source.json").read_text())},
        "intakeSha256": intake_hash, "tracks": [], "technicalEvidence": [],
        "resourceLimits": {"scratchAndToolsBytes": SCRATCH_LIMIT, "activeLibraryBytes": LIBRARY_LIMIT, "freeReserveBytes": FREE_RESERVE, "durationDifferenceSeconds": 0.2, "pcmBlockFrames": 16384},
        "limits": "Complete source/output decode, MP3 structural inspection, exact pin and duration checks only; no listening, musical quality, mix, cultural, loop, browser, gameplay or publication approval.",
    }
    for track in tracks:
        source = verify(track["original"])
        metadata = command(["/usr/bin/afinfo", str(source)])["stdout"]
        match = re.search(r"Data format:\s+(\d+) ch,\s+(\d+) Hz", metadata)
        channels, rate = map(int, match.groups())
        duration = float(re.search(r"estimated duration:\s+([\d.]+)", metadata)[1])
        if channels not in (1, 2) or rate not in (44100, 48000) or not 0 < duration <= MAX_DURATION:
            raise ValueError("Unsupported native source format or duration")
        pcm_bound = math.ceil((duration + 0.2) * rate * channels * 2) + MIB
        mp3_bound = math.ceil((duration + 0.2) * 32000) + MIB
        guard(pcm_bound + mp3_bound, mp3_bound)
        name = "expansion-20260921-" + track["id"] + ".mp3"
        output = FOLDER / "derivatives" / name
        with tempfile.TemporaryDirectory(prefix="decode-", dir=CACHE) as tmp:
            scratch = Path(tmp)
            pcm, candidate, back = scratch / "source.wav", scratch / "candidate.mp3", scratch / "verified.wav"
            source_decode = command(["/usr/bin/afconvert", "-f", "WAVE", "-d", "LEI16", str(source), str(pcm)])
            codec = lameenc.Encoder()
            codec.set_bit_rate(256)
            codec.set_quality(2)
            codec.silence()
            codec.set_in_sample_rate(rate)
            codec.set_channels(channels)
            with wave.open(str(pcm), "rb") as wav, candidate.open("xb") as dest:
                if (wav.getframerate(), wav.getnchannels(), wav.getsampwidth()) != (rate, channels, 2):
                    raise ValueError("Native decoded format differs")
                frames, read_frames = wav.getnframes(), 0
                if abs(frames / rate - duration) >= 0.2:
                    raise ValueError("Source metadata and full decode duration differ")
                while block := wav.readframes(16384):
                    read_frames += len(block) // (channels * 2)
                    dest.write(codec.encode(block))
                    if dest.tell() > 32 * MIB:
                        raise RuntimeError("Encoded MP3 exceeds 32 MiB")
                    guard()
                dest.write(codec.flush())
                if read_frames != frames:
                    raise ValueError("PCM body is shorter than its full frame count")
            verify(track["original"])
            candidate_hash = digest(candidate)
            inspect_code = "import { readFile } from 'node:fs/promises'; import { inspectMP3 } from './game/mp3.mjs'; console.log(JSON.stringify(await inspectMP3(new Blob([await readFile(process.argv[1])]))));"
            inspected = command(["node", "--input-type=module", "-e", inspect_code, str(candidate)])
            asset = json.loads(inspected["stdout"])
            if asset["sha256"] != candidate_hash or asset["sampleRate"] != rate or asset["channels"] != channels:
                raise ValueError("MP3 structural inspection differs")
            # The complete encoded candidate and source hash are checked before freeing source PCM.
            pcm.unlink()
            guard(pcm_bound)
            output_decode = command(["/usr/bin/afconvert", "-f", "WAVE", "-d", "LEI16", str(candidate), str(back)])
            with wave.open(str(back), "rb") as wav:
                if (wav.getframerate(), wav.getnchannels(), wav.getsampwidth()) != (rate, channels, 2):
                    raise ValueError("MP3 decode changed native format")
                decoded, read_frames = wav.getnframes(), 0
                while block := wav.readframes(16384):
                    read_frames += len(block) // (channels * 2)
                if decoded != read_frames or not 0 <= (decoded - frames) / rate < 0.2:
                    raise ValueError("Full decoded MP3 duration mismatch")
            if abs(asset["durationSeconds"] - decoded / rate) >= 0.2 or digest(candidate) != candidate_hash:
                raise ValueError("Inspected and decoded delivery differ")
            verify(track["original"])
            guard(additional_library=candidate.stat().st_size)
            # Exclusive publication into derivatives; same-filesystem hard link cannot overwrite.
            os.link(candidate, output)
            candidate.unlink()
            guard()
            row = {
                "id": track["id"], "name": name, "sourceName": source.name,
                "sourceBytes": track["original"]["bytes"], "sourceSha256": track["original"]["sha256"],
                "sourceDecodedFrames": frames, "sourceDecodedDurationSeconds": frames / rate,
                "bytes": output.stat().st_size, "sha256": candidate_hash,
                "mp3DecodedFrames": decoded, "mp3DecodedDurationSeconds": decoded / rate,
                "sampleRate": rate, "channels": channels, "encoderReceipt": "provenance/expansion-derivatives.json",
            }
            receipt["tracks"].append(row)
            receipt["technicalEvidence"].append({"id": track["id"], "sourcePath": track["original"]["path"], "runtimePath": "derivatives/" + name, "sourceAFInfo": metadata, "sourceDecode": source_decode, "outputDecode": output_decode, "inspection": asset, "sourceUnchanged": True, "paddingSeconds": (decoded - frames) / rate})
        guard()
        receipt["resourceMeasurements"] = {**measurements, "activeLibraryBytes": size(FOLDER)}
        receipt["complete"] = False
        # Only this newly created run's receipt is checkpointed; originals/registers are untouched.
        OUTPUT.write_text(json.dumps(receipt, indent=2) + "\n")
        print(json.dumps({"id": track["id"], "bytes": row["bytes"], "seconds": frames / rate, "completed": len(receipt["tracks"])}), flush=True)
    if digest(INPUT) != intake_hash:
        raise ValueError("Intake changed during conversion")
    for track in intake["tracks"]:
        verify(track["original"])
    receipt["complete"] = True
    receipt["allIntakeOriginalsUnchanged"] = True
    receipt["resourceMeasurements"] = {**measurements, "activeLibraryBytes": size(FOLDER), "finalScratchAndToolBytes": size(CACHE), "finalFreeBytes": shutil.disk_usage(ROOT).free}
    OUTPUT.write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({"complete": True, "tracks": len(receipt["tracks"]), **receipt["resourceMeasurements"]}), flush=True)


if __name__ == "__main__":
    main()
