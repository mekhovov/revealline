#!/usr/bin/env python3
"""Rebuild only the CC0 destruction bank from retained, hash-checked originals.

This scoped command deliberately leaves every unrelated sound and its metadata
untouched. The historical general bank producer remains in produce.py. Requires ffmpeg;
uses no network, third-party Python package or randomness.
"""

import argparse
from array import array
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import sys
import wave


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SOURCES = HERE / "originals/kenney-destruction-v1"
OUTPUT = ROOT / "game/audio/effects"
RATE = 48000
PEAK = 10 ** (-20 / 20)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def db(value):
    return 20 * math.log10(max(value, 1e-12))


def metrics(values):
    window = RATE // 20
    energy = [sample * sample for sample in values]
    rolling = sum(energy[:window])
    loudest = rolling
    for index in range(window, len(energy)):
        rolling += energy[index] - energy[index - window]
        loudest = max(loudest, rolling)
    return {
        "samplePeakDbfs": db(max(abs(sample) for sample in values)),
        "max50msDbfs": db(math.sqrt(loudest / min(window, len(values)))),
        "rmsDbfs": db(math.sqrt(sum(energy) / len(values))),
        "frames": len(values),
        "duration": len(values) / RATE,
    }


def make_recipe(family, variant):
    """Material layers, not changes to the shared mixer or gameplay."""
    suffix = f"{variant:03}"
    punch = f"impact/impactPunch_medium_{suffix}.ogg"
    soft = f"impact/impactSoft_medium_{suffix}.ogg"
    metal = f"impact/impactMetal_heavy_{suffix}.ogg"
    plate = f"impact/impactPlate_light_{suffix}.ogg"
    crunch = f"scifi/explosionCrunch_{suffix}.ogg"
    low = f"scifi/lowFrequency_explosion_{variant % 2:03}.ogg"
    # source, linear weight, playback rate, start offset, low-pass ceiling
    recipes = {
        "soft": (0.22, -30, [(punch, 0.80, 1, 0, 6000), (soft, 0.30, 1, 0.008, 3500)]),
        "armored": (0.30, -30, [(punch, 0.58, 0.94, 0, 5000), (metal, 0.70, 1, 0, 7000), (plate, 0.18, 1.05, 0.012, 5500)]),
        "light": (0.45, -29, [(crunch, 0.82, 1.12, 0, 7800), (metal, 0.45, 1, 0.015, 6000)]),
        "heavy": (0.75, -28, [(crunch, 0.85, 0.86, 0, 6200), (low, 0.48, 1, 0, 2000), (plate, 0.20, 0.84, 0.025, 4800)]),
        "electronic": (0.30, -31, [(f"digital/{['zap1', 'zap2', 'lowDown'][variant]}.ogg", 0.60, [0.92, 1.08, 1][variant], 0, 4800), (metal, 0.55, 1.20, 0, 7500)]),
    }
    duration, target, layers = recipes[family]
    return {
        "duration": duration,
        "targetMax50msDbfs": target,
        "samplePeakCeilingDbfs": -20,
        "layers": [
            {"source": source, "weight": weight, "rate": rate, "offset": offset, "lowpass": lowpass}
            for source, weight, rate, offset, lowpass in layers
        ],
    }


def decode(source, rate, lowpass):
    # Explicit mono float output avoids guessing source channel count or depth.
    raw = subprocess.check_output([
        "ffmpeg", "-v", "error", "-nostdin", "-i", str(SOURCES / source),
        "-af", f"aresample={RATE},asetrate={round(RATE * rate)},aresample={RATE},highpass=f=65,lowpass=f={lowpass}",
        "-ac", "1", "-ar", str(RATE), "-f", "f32le", "pipe:1",
    ])
    values = array("f")
    values.frombytes(raw)
    if sys.byteorder != "little":
        values.byteswap()
    peak = max(abs(sample) for sample in values)
    if not math.isfinite(peak) or peak == 0:
        raise ValueError(f"Source has no finite signal: {source}")
    # Remove only leading silence. Keep 1 ms before the threshold crossing;
    # the final envelope prevents a hard start. Source originals stay intact.
    onset = next(index for index, sample in enumerate(values) if abs(sample) >= peak * 0.01)
    return [sample / peak for sample in values[max(0, onset - RATE // 1000):]]


def render(recipe):
    length = round(recipe["duration"] * RATE)
    mix = [0.0] * length
    for layer in recipe["layers"]:
        source = decode(layer["source"], layer["rate"], layer["lowpass"])
        offset = round(layer["offset"] * RATE)
        for index, sample in enumerate(source[:length - offset]):
            mix[index + offset] += sample * layer["weight"]
    attack = round(0.0015 * RATE)
    release = round(min(0.065, recipe["duration"] * 0.24) * RATE)
    for index in range(length):
        mix[index] *= min(1, index / attack, (length - 1 - index) / release)
    # Smooth transient shaping followed by a scalar calibrated to the louder
    # of the 50 ms RMS and peak constraints. No codec gain or runtime limiter
    # is assumed. Existing master/effects volumes still apply during playback.
    mix = [0.55 * math.tanh(sample / 0.55) for sample in mix]
    before = metrics(mix)
    scale = min(
        10 ** ((recipe["targetMax50msDbfs"] - before["max50msDbfs"]) / 20),
        PEAK / max(abs(sample) for sample in mix),
    )
    pcm = array("h", [max(-32768, min(32767, round(sample * scale * 32767))) for sample in mix])
    measured = metrics([sample / 32768 for sample in pcm])
    if sys.byteorder != "little":
        pcm.byteswap()
    return pcm.tobytes(), measured


def write_wav(path, data):
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audition", type=Path, help="Also write a labeled sequential review WAV/JSON at this path")
    args = parser.parse_args()
    manifest = json.loads((SOURCES / "sources.json").read_text())
    for pack, entry in manifest["packs"].items():
        license_path = SOURCES / entry["licenseFile"]
        if digest(license_path.read_bytes()) != entry["licenseSha256"]:
            raise ValueError(f"License checksum mismatch: {license_path}")
        for filename, record in entry["files"].items():
            data = (SOURCES / pack / filename).read_bytes()
            if len(data) != record["bytes"] or digest(data) != record["sha256"]:
                raise ValueError(f"Source checksum mismatch: {pack}/{filename}")

    report = {
        "format": "RevealLineDestructionProductionV1",
        "sourceManifestSha256": digest((SOURCES / "sources.json").read_bytes()),
        "producerSha256": digest(Path(__file__).read_bytes()),
        "decoder": subprocess.check_output(["ffmpeg", "-version"], text=True).splitlines()[0],
        "channels": 1, "sampleRate": RATE, "bitsPerSample": 16,
        "review": "Candidate audio. Measurements are technical evidence, not a human listening certificate.",
        "entries": {},
    }
    entries = []
    sequence = bytearray()
    labels = []
    for family in ["soft", "armored", "light", "heavy", "electronic"]:
        for variant in range(3):
            name = f"destroy-{family}" + (f"-{variant}" if variant else "")
            recipe = make_recipe(family, variant)
            pcm, measured = render(recipe)
            target = OUTPUT / f"{name}.wav"
            write_wav(target, pcm)
            data = target.read_bytes()
            entry = {"file": target.name, "loop": False, "bytes": len(data), "sha256": digest(data)}
            entries.append((name, entry))
            report["entries"][name] = {**entry, **measured, "recipe": recipe}
            labels.append({"name": name, "startSeconds": len(sequence) / (RATE * 2), "duration": measured["duration"]})
            sequence.extend(pcm)
            sequence.extend(bytes(round(0.55 * RATE) * 2))

    bank_path = OUTPUT / "bank.mjs"
    bank = bank_path.read_text()
    bank = re.sub(r"  // BEGIN CC0 destruction bank.*?  // END CC0 destruction bank\n", "", bank, flags=re.S)
    block = "  // BEGIN CC0 destruction bank — produced by authoring/audio/revealline-v1/produce_destruction.py\n"
    for name, entry in entries:
        block += f"  '{name}': {{\n    file: '{entry['file']}',\n    loop: false,\n    bytes: {entry['bytes']},\n    sha256: '{entry['sha256']}',\n  }},\n"
    block += "  // END CC0 destruction bank\n"
    if not bank.endswith("};\n"):
        raise ValueError("Unexpected effect bank format; refusing to rewrite unrelated entries")
    bank_path.write_text(bank[:-3] + block + "};\n")
    (HERE / "destruction-production.json").write_text(json.dumps(report, indent=2) + "\n")
    if args.audition:
        args.audition.parent.mkdir(parents=True, exist_ok=True)
        write_wav(args.audition, sequence)
        args.audition.with_suffix(".json").write_text(json.dumps({
            "description": "Five material families, three variants each, separated by 550 ms. Exact authored level; no gain boost or music. Listening review pending.",
            "sampleRate": RATE, "timeline": labels,
        }, indent=2) + "\n")
    print(json.dumps({"cues": len(entries), "totalBytes": sum(entry["bytes"] for _, entry in entries), "maxPeakDbfs": max(entry["samplePeakDbfs"] for entry in report["entries"].values())}))


if __name__ == "__main__":
    main()
