"""Prepare synthetic local fixtures; this does not run Motion or a browser.

Run using the existing bundled Python identified in README.md. Image encoding
bytes depend on the pinned Pillow/libwebp/zlib versions. No source art is read.
"""

from hashlib import sha256
import json
from pathlib import Path
import struct
import sys
import zlib

import PIL
from PIL import Image, features


ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"
FROZEN = ROOT.parent / "p05-motion-successor-a13ab970" / "proposal"
SIZE = (32, 24)
COLORS = {"red": (224, 48, 64, 255), "blue": (32, 112, 224, 255), "green": (48, 192, 80, 255)}
DURATIONS = [400, 600]


def digest(data):
    return sha256(data).hexdigest()


def frame(color):
    image = Image.new("RGBA", SIZE, COLORS[color])
    # Fixed 2x2 corner markers distinguish orientation from animation.
    for x in range(2):
        for y in range(2):
            image.putpixel((x, y), (0, 0, 0, 255))
            image.putpixel((SIZE[0] - 1 - x, SIZE[1] - 1 - y), (255, 255, 255, 255))
    return image


def png_structure(data):
    offset, chunks, controls, data_offset, first_control = 8, [], [], None, None
    while offset < len(data):
        length = struct.unpack_from(">I", data, offset)[0]
        kind = data[offset + 4 : offset + 8].decode("ascii")
        payload = data[offset + 8 : offset + 8 + length]
        chunks.append(kind)
        if kind == "IDAT" and data_offset is None:
            data_offset = offset
        if kind == "fcTL":
            first_control = offset if first_control is None else first_control
            values = struct.unpack(">IIIIIHHBB", payload)
            controls.append({"sequence": values[0], "width": values[1], "height": values[2],
                             "x": values[3], "y": values[4], "delay_numerator": values[5],
                             "delay_denominator": values[6], "disposal": values[7], "blend": values[8]})
        offset += length + 12
    return {"chunks": chunks, "frame_controls": controls,
            "default_image_outside_animation": bool(first_control is not None and data_offset < first_control)}


def webp_structure(data):
    offset, chunks, durations, loops = 12, [], [], None
    while offset < len(data):
        kind = data[offset : offset + 4].decode("ascii")
        length = int.from_bytes(data[offset + 4 : offset + 8], "little")
        payload = data[offset + 8 : offset + 8 + length]
        chunks.append(kind)
        if kind == "ANIM":
            loops = int.from_bytes(payload[4:6], "little")
        if kind == "ANMF":
            durations.append(int.from_bytes(payload[12:15], "little"))
        offset += 8 + length + length % 2
    return {"chunks": chunks, "animation_frame_durations_ms": durations, "loop": loops}


def facts(name, mime, expected, animation, description):
    path = FIXTURES / name
    raw = path.read_bytes()
    record = {"path": f"fixtures/{name}", "mime": mime,
              "upload_mime": "image/png" if mime == "image/apng" else mime,
              "bytes": len(raw), "sha256": digest(raw),
              "purpose": description, "expected_result": expected, "animation": animation}
    if expected == "decode failure":
        record.update({"width": None, "height": None, "decoded_frame_count": None,
                       "construction": "Only the eight-byte PNG signature; no IHDR, image data or IEND.",
                       "expected_still_pixels": None})
        return record
    with Image.open(path) as image:
        frames = []
        for index in range(image.n_frames):
            image.seek(index)
            decoded = image.convert("RGBA")
            frames.append({"index": index, "duration_ms": image.info.get("duration"),
                           "rgba_sha256": digest(decoded.tobytes()),
                           "center_rgba": list(decoded.getpixel((16, 12)))})
        record.update({"width": image.width, "height": image.height,
                       "decoded_frame_count": image.n_frames, "pillow_frame_inventory": frames,
                       "expected_still_pixels": {"source_frame_index": 0,
                           "source_frame_role": "separate default image" if mime == "image/apng" else "first/only image",
                           "rgba_sha256": digest(frame("red").tobytes()),
                           "samples": [{"x": 16, "y": 12, "rgba": list(COLORS["red"])},
                                       {"x": 0, "y": 0, "rgba": [0, 0, 0, 255]},
                                       {"x": 31, "y": 23, "rgba": [255, 255, 255, 255]}]}})
    if mime in ("image/png", "image/apng"):
        record["container_inventory"] = png_structure(raw)
    elif mime == "image/webp":
        record["container_inventory"] = webp_structure(raw)
    return record


def main():
    FIXTURES.mkdir(exist_ok=True)
    red, blue, green = (frame(name) for name in ("red", "blue", "green"))
    red.save(FIXTURES / "static-default.png", format="PNG", optimize=False, compress_level=9)
    red.convert("RGB").save(FIXTURES / "animated-first-frame.gif", format="GIF", save_all=True,
                            append_images=[blue.convert("RGB")], duration=DURATIONS, loop=0,
                            disposal=1, optimize=False)
    # A .png extension supplies image/png to Motion's existing file-type gate.
    # Pillow excludes this default image from the two timed animation frames.
    red.save(FIXTURES / "animated-separate-default.png", format="PNG", save_all=True,
             append_images=[blue, green], default_image=True, duration=DURATIONS,
             loop=0, disposal=[0, 0], blend=[0, 0], optimize=False, compress_level=9)
    red.save(FIXTURES / "animated-first-frame.webp", format="WEBP", save_all=True,
             append_images=[blue], duration=DURATIONS, loop=0, lossless=True, quality=100,
             method=6, minimize_size=False, allow_mixed=False, background=(0, 0, 0, 0))
    (FIXTURES / "invalid-signature-only.png").write_bytes(b"\x89PNG\r\n\x1a\n")
    repeating = {"loop": "infinite", "loop_field": 0, "frame_durations_ms": DURATIONS,
                 "cycle_duration_ms": sum(DURATIONS)}
    files = [
        facts("static-default.png", "image/png", "static red control", None,
              "Pixel-identical control for the normative still image of all three animated fixtures."),
        facts("animated-first-frame.gif", "image/gif", "static red first frame", repeating,
              "Two opaque frames, red 400 ms then blue 600 ms; repeated indefinitely."),
        facts("animated-separate-default.png", "image/apng", "static red default outside animation",
              {**repeating, "default_image_duration_ms": None, "default_participates_in_animation": False},
              "Red separate default; timed frames are blue 400 ms then green 600 ms. Upload MIME is image/png."),
        facts("animated-first-frame.webp", "image/webp", "static red first frame", repeating,
              "Two lossless opaque frames, red 400 ms then blue 600 ms; repeated indefinitely."),
        facts("invalid-signature-only.png", "image/png", "decode failure", None,
              "Invalid replacement must retain the previously accepted background."),
    ]
    pins = {}
    for relative in ("authoring/motion-lab/app.js", "authoring/motion-lab/index.html",
                     "authoring/motion-lab/README.md", "authoring/skills/xonix-animation-director/SKILL.md",
                     "game/test/motion-lab-display-host.test.mjs"):
        data = (FROZEN / relative).read_bytes()
        pins[relative] = {"bytes": len(data), "sha256": digest(data)}
    manifest = {"format": "revealline-motion-background-conformance-fixtures.v1",
                "status": "Fixture preparation only; native conformance not executed.",
                "base_source": "a13ab970222498d7c5fa7f62f9fc04fe436979d5",
                "frozen_parent": "../p05-motion-successor-a13ab970/proposal",
                "frozen_parent_pins": pins,
                "generator": {"path": "generate.py", "sha256": digest(Path(__file__).read_bytes()),
                              "python_executable": sys.executable, "python": sys.version,
                              "pillow": PIL.__version__, "libwebp": features.version("webp"),
                              "zlib_runtime": zlib.ZLIB_RUNTIME_VERSION},
                "origin": "Original synthetic geometry generated solely for conformance inspection; not production artwork.",
                "total_fixture_bytes": sum(item["bytes"] for item in files),
                "files": files,
                "evidence_limits": ["Pillow decoding inventories fixture pixels, not browser behavior.",
                                    "No browser, app test, screenshot, source mutation, build or deployment occurred.",
                                    "No claim of memory release or absence of native internal decoder work."]}
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"fixtures": len(files), "bytes": manifest["total_fixture_bytes"],
                      "manifest_sha256": digest((ROOT / "manifest.json").read_bytes()),
                      "files": [{key: item[key] for key in ("path", "bytes", "sha256")}
                                for item in files]}, indent=2))


if __name__ == "__main__":
    main()
