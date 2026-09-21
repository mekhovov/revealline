"""Read local reference MP3s into a metadata-only, non-publishable inventory.

Usage: python3 inventory.py SOURCE_DIRECTORY OUTPUT_JSON
Uses macOS afinfo for packet metadata; never copies or decodes audio to disk.
File names and embedded tags are untrusted identity evidence, not permission.
"""

from pathlib import Path
import datetime
import hashlib
import json
import re
import subprocess
import sys
import unicodedata
import xml.etree.ElementTree as ET


def syncsafe(data):
    if len(data) != 4 or any(x >= 128 for x in data):
        raise ValueError("Invalid ID3 synchsafe integer")
    return sum(x << (7 * (3 - i)) for i, x in enumerate(data))


def embedded_tags(data):
    """Decode ID3 text directly; afinfo XML corrupts some non-ASCII metadata."""
    if data[:3] != b"ID3" or data[3] not in (3, 4):
        return {}, []
    version = data[3]
    end = min(10 + syncsafe(data[6:10]), len(data), 4 * 1024 * 1024)
    if data[5] & 0xC0:
        return {}, []  # Extended/unsynchronized tags require a fuller parser.
    offset, found, text_frames = 10, set(), {}
    while offset + 10 <= end:
        key = data[offset:offset + 4]
        if not re.fullmatch(rb"[A-Z0-9]{4}", key):
            break
        raw_size = data[offset + 4:offset + 8]
        size = syncsafe(raw_size) if version == 4 else int.from_bytes(raw_size, "big")
        payload = data[offset + 10:offset + 10 + size]
        flags = data[offset + 8:offset + 10]
        if offset + 10 + size > end:
            break
        if key[:1] in (b"T", b"W") or key == b"COMM":
            if flags == b"\0\0":
                if key[:1] == b"T" and payload:
                    encoding = {0: "latin-1", 1: "utf-16", 2: "utf-16-be", 3: "utf-8"}.get(payload[0])
                    if encoding:
                        text = payload[1:].decode(encoding).rstrip("\0")
                        text_frames[key.decode("ascii")] = text
                        found.update(re.findall(r'https?://[^\s\x00<>"\x01-\x1f]+', text))
                elif key[:1] == b"W" and key != b"WXXX":
                    text = payload.decode("latin-1").rstrip("\0")
                    found.update(re.findall(r'https?://[^\s\x00<>"\x01-\x1f]+', text))
        offset += 10 + size
    return text_frames, sorted(x[:2048] for x in found)


def audio_metadata(path):
    result = subprocess.run(
        ["/usr/bin/afinfo", "-x", "-i", "-r", str(path)],
        capture_output=True, text=True, errors="replace", timeout=30, check=True,
    )
    xml = ET.fromstring(result.stdout)
    ns = {"a": "http://apple.com/core_audio/audio_info"}
    track = xml.find(".//a:track", ns)
    if track is None:
        raise ValueError(f"No audio track: {path.name}")
    def field(name):
        return track.findtext("a:" + name, namespaces=ns)
    info = {entry.attrib["key"]: entry.text or ""
            for entry in track.findall("a:info_dict/a:entry", ns)}
    return {
        "codec": field("format_type"),
        "channels": int(field("num_channels")),
        "sampleRateHz": int(float(field("sample_rate"))),
        "durationSeconds": float(field("duration")),
        "bitRateBps": int(field("bit_rate")),
        "method": "macOS afinfo -x -i -r; packet metadata, not musical audition",
    }, info


def inventory(source):
    files, groups = [], {}
    all_paths = sorted(source.iterdir(), key=lambda p: p.name)
    companions = [p.name for p in all_paths if p.is_file() and p.suffix.lower() != ".mp3"]
    for path in all_paths:
        if not path.is_file() or path.suffix.lower() != ".mp3":
            continue
        if path.is_symlink():
            raise ValueError("Reference inventory refuses symlinks")
        data = path.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        facts, info = audio_metadata(path)
        frames, links = embedded_tags(data)
        for tag, label in {"TIT2": "title", "TPE1": "artist", "TALB": "album",
                           "TCOM": "composer", "TOPE": "originalArtist", "TYER": "year",
                           "TCON": "genre", "TCOP": "copyright", "TPUB": "publisher"}.items():
            if tag in frames:
                info[label] = frames[tag]
        name = unicodedata.normalize("NFC", path.stem.strip())
        split = re.split(r"\s+[—–-]\s+", name, maxsplit=1)
        row = {
            "filename": path.name,
            "normalizedFilename": unicodedata.normalize("NFC", path.name),
            "bytes": len(data), "sha256": digest,
            "identityId": "ua-reference." + digest[:24],
            "embeddedMetadata": info,
            "id3TextFrames": frames,
            "filenameArtistCandidate": split[0] if len(split) == 2 else None,
            "filenameTitleCandidate": split[-1],
            "sourceLinks": links,
            "sourceLinksVerified": False,
            "audio": facts,
            "permissionStatus": "unknown",
            "publicationAllowed": False,
            "runtimeEligible": False,
            "reviewStatus": "metadata-only; identity and rights confirmation required",
        }
        files.append(row)
        groups.setdefault(digest, []).append(row)
    identities = []
    for digest, members in sorted(groups.items()):
        identities.append({
            "id": members[0]["identityId"], "sha256": digest,
            "bytes": members[0]["bytes"],
            "filenameAliases": [r["filename"] for r in members],
            "embeddedTitles": sorted({r["embeddedMetadata"]["title"] for r in members
                                      if r["embeddedMetadata"].get("title")}),
            "embeddedArtists": sorted({r["embeddedMetadata"]["artist"] for r in members
                                       if r["embeddedMetadata"].get("artist")}),
            "permissionStatus": "unknown", "publicationAllowed": False,
        })
    return {
        "format": "revealline-ua-fpv-reference-inventory.v1",
        "inspectedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "sourceFolder": "docs/research/dah-soundtracks",
        "purpose": "Private local reference inventory only; no recording is licensed by this document.",
        "inspectionTool": "/usr/bin/afinfo (CoreAudio); Python standard-library SHA-256 and bounded ID3 URL parsing",
        "sourceAudioCopied": False,
        "accompanyingFiles": companions,
        "summary": {
            "files": len(files), "uniqueRecordings": len(groups),
            "totalBytes": sum(r["bytes"] for r in files),
            "uniqueBytes": sum(v[0]["bytes"] for v in groups.values()),
            "maximumFileBytes": max((r["bytes"] for r in files), default=0),
            "totalDurationSeconds": sum(r["audio"]["durationSeconds"] for r in files),
            "uniqueDurationSeconds": sum(v[0]["audio"]["durationSeconds"] for v in groups.values()),
            "embeddedTitleCount": sum(bool(r["embeddedMetadata"].get("title")) for r in files),
            "embeddedArtistCount": sum(bool(r["embeddedMetadata"].get("artist")) for r in files),
            "embeddedSourceLinkCount": sum(bool(r["sourceLinks"]) for r in files),
            "permissionUnknownCount": len(groups), "publishableCount": 0,
        },
        "identities": identities, "files": files,
    }


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: inventory.py SOURCE_DIRECTORY OUTPUT_JSON")
    output = Path(sys.argv[2])
    if output.exists():
        raise SystemExit("Refusing to overwrite inventory; choose a new output path")
    result = inventory(Path(sys.argv[1]))
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(result["summary"], indent=2))
