"""Explicit authoring conversion; requires an already installed pinned lameenc.

Run with Python 3.12 and the existing encoder package directory on PYTHONPATH.
No package installation or media download. Source audio is never overwritten.
"""
from pathlib import Path
import datetime
import hashlib
import importlib.metadata
import json
import shutil
import subprocess
import tempfile
import wave
import lameenc

folder = Path(__file__).resolve().parents[1]
receipt = json.loads((folder / "provenance/additional-downloads.json").read_text())
assert importlib.metadata.version("lameenc") == "1.8.4"
binary = Path(lameenc.__file__)
encoder_info = {
    "package": "lameenc", "version": "1.8.4",
    "moduleSha256": hashlib.sha256(binary.read_bytes()).hexdigest(),
    "wheelSha256": "fb0d5bb76b09d8bf4e27f4824a72e4acd659bd4ec8dac2879fd5744f3d6d88fc",
    "bitRateKbps": 256, "quality": 2,
    "sampleRate": "preserve original, recorded per track", "channels": "preserve original",
    "transform": "CoreAudio Vorbis decode to PCM16, LAME MP3 encode; full duration; no resampling, trim, gain, normalization, fade or remix. Lossy derivative; OGG original retained.",
}
rows = []
for track in receipt["tracks"]:
    original = track["original"]
    source = folder / original["path"]
    if source.suffix != ".ogg":
        continue
    assert hashlib.sha256(source.read_bytes()).hexdigest() == original["sha256"]
    assert shutil.disk_usage(folder).free > 1250 * 1024 * 1024
    output = folder / "derivatives" / (source.stem + ".mp3")
    assert not output.exists(), "Refusing to overwrite derivative"
    with tempfile.TemporaryDirectory(prefix="revealline-audio-conversion-") as temp:
        pcm = Path(temp) / "source.wav"
        back = Path(temp) / "delivery.wav"
        decode = ["/usr/bin/afconvert", "-f", "WAVE", "-d", "LEI16", str(source), str(pcm)]
        subprocess.run(decode, capture_output=True, text=True, check=True, timeout=60)
        encoder = lameenc.Encoder()
        encoder.set_bit_rate(256)
        encoder.set_quality(2)
        encoder.silence()
        with wave.open(str(pcm), "rb") as wav, output.open("xb") as dest:
            rate, channels, width = wav.getframerate(), wav.getnchannels(), wav.getsampwidth()
            assert rate in (44100, 48000) and channels in (1, 2) and width == 2
            frames = wav.getnframes()
            assert 0 < frames / rate <= 720
            encoder.set_in_sample_rate(rate)
            encoder.set_channels(channels)
            while True:
                block = wav.readframes(16384)
                if not block:
                    break
                dest.write(encoder.encode(block))
                assert dest.tell() <= 32 * 1024 * 1024
            dest.write(encoder.flush())
        subprocess.run(["/usr/bin/afconvert", "-f", "WAVE", "-d", "LEI16", str(output), str(back)],
                       capture_output=True, text=True, check=True, timeout=60)
        with wave.open(str(back), "rb") as wav:
            assert (wav.getframerate(), wav.getnchannels(), wav.getsampwidth()) == (rate, channels, 2)
            decoded = wav.getnframes()
        assert abs(decoded / rate - frames / rate) < 0.2
        body = output.read_bytes()
        row = {
            "id": track["id"], "name": output.name, "sourceName": source.name,
            "sourceBytes": original["bytes"], "sourceSha256": original["sha256"],
            "sourceDecodedFrames": frames, "sourceDecodedDurationSeconds": frames / rate,
            "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest(),
            "mp3DecodedFrames": decoded, "mp3DecodedDurationSeconds": decoded / rate,
            "sampleRate": rate, "channels": channels,
            "encoderReceipt": "provenance/additional-derivatives.json",
        }
        rows.append(row)
        (folder / "provenance/additional-derivatives.json").write_text(json.dumps({
            "format": "revealline-authored-mp3-derivatives.v1",
            "at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "encoder": encoder_info, "tracks": rows,
            "limits": "Complete source/output decode and format/duration checks; not a listening, quality, mix, loop or gameplay approval.",
        }, indent=2) + "\n")
        print(track["id"], len(body), rate, channels, flush=True)
