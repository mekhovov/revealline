#!/usr/bin/env python3
"""Read exact downloaded CI candidates; never execute or rebuild their payloads."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import zipfile

HEAD = "7842d6249217eade6d4ea5f7220b6dd8d4ff01af"
TREE = "8fa670f1bae0c0e46011f2416f295c9b74ba7c0e"
RESERVE = 3 * 1024 ** 3
SAFE = re.compile(r"[A-Za-z0-9_-][A-Za-z0-9_.-]*(?:/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*\Z")


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def stable(path):
    s = path.lstat()
    assert stat.S_ISREG(s.st_mode), str(path)
    return (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns)


def pin(path, expected):
    before = stable(path)
    assert before[2] == expected["bytes"], str(path)
    actual = digest(path)
    assert actual == expected["sha256"], str(path)
    assert stable(path) == before, str(path)
    return {"path": expected["path"], "bytes": before[2], "sha256": actual}


def read_json(path):
    assert stable(path)[2] <= 2 * 1024 * 1024, str(path)
    return json.loads(path.read_text())


def inspect_members(path, rows, additional=None):
    rows = rows + ([] if additional is None else [additional])
    expected = {r["path"]: r for r in rows}
    assert len(rows) == len(expected) and 0 < len(rows) <= 20000
    before = stable(path)
    result = []
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        assert len(entries) == len(expected)
        assert {x.filename for x in entries} == set(expected)
        assert not archive.comment
        for entry in entries:
            name = entry.filename
            assert SAFE.fullmatch(name) and not entry.is_dir()
            assert not stat.S_ISLNK(entry.external_attr >> 16)
            assert entry.compress_type == zipfile.ZIP_STORED
            assert not (entry.flag_bits & 1)
            row = expected[name]
            assert entry.file_size == row["bytes"]
            h, n = hashlib.sha256(), 0
            with archive.open(entry) as source:
                for block in iter(lambda: source.read(1024 * 1024), b""):
                    h.update(block)
                    n += len(block)
            assert n == row["bytes"] and h.hexdigest() == row["sha256"], name
            result.append({"path": name, "bytes": n, "sha256": h.hexdigest()})
    assert stable(path) == before
    return {"archive": path.name, "members": len(result), "decodedBytes": sum(r["bytes"] for r in result), "rows": result}


def unpack_wrapper(path, output, artifact):
    assert not output.exists(), str(output)
    before = stable(path)
    assert before[2] == artifact["size_in_bytes"]
    actual = digest(path)
    assert artifact["digest"] == "sha256:" + actual
    with zipfile.ZipFile(path) as wrapper:
        entries = wrapper.infolist()
        assert 0 < len(entries) <= 128
        assert len({e.filename for e in entries}) == len(entries)
        required = sum(e.file_size for e in entries)
        assert required <= 2500 * 1024 * 1024
        space = os.statvfs(output.parent)
        assert space.f_bavail * space.f_frsize >= RESERVE + required
        for e in entries:
            assert SAFE.fullmatch(e.filename) and "/" not in e.filename
            assert not e.is_dir() and not stat.S_ISLNK(e.external_attr >> 16)
            assert not (e.flag_bits & 1)
        output.mkdir()
        for e in entries:
            with wrapper.open(e) as source, (output / e.filename).open("xb") as target:
                for block in iter(lambda: source.read(1024 * 1024), b""):
                    target.write(block)
            assert (output / e.filename).stat().st_size == e.file_size
    assert stable(path) == before
    return {"artifactId": artifact["id"], "bytes": before[2], "sha256": actual, "decodedBytes": required, "files": len(entries)}


def verify_candidate(root, kind):
    optional = kind == "optional"
    checksum_name = "optional-checksums.json" if optional else "checksums.json"
    checksums = read_json(root / checksum_name)
    pins = checksums["files"]
    names = {r["path"] for r in pins}
    assert len(names) == len(pins)
    assert {p.name for p in root.iterdir()} == names | {checksum_name}
    verified = []
    for row in pins:
        assert SAFE.fullmatch(row["path"]) and "/" not in row["path"]
        verified.append(pin(root / row["path"], row))
    envelope = read_json(root / ("optional-packages.json" if optional else "editions.json"))
    assert envelope["sourceRevision"] == HEAD and envelope["sourceTree"] == TREE
    items = envelope["packages"] if optional else envelope["editions"]
    assert {r["id"] for r in items} == ({"civilian-flight", "civilian-fpv", "fpv-worlds"} if optional else {"fpv-learning"})
    archives = []
    for item in items:
        manifest_pin, inventory_pin = item["manifest"], item["sourceInventory"]
        manifest = read_json(root / manifest_pin["path"])
        inventory = read_json(root / inventory_pin["path"])
        assert inventory["sourceRevision"] == HEAD and inventory["sourceTree"] == TREE
        assert manifest["engineCommit" if optional else "sourceRevision"] == HEAD
        assert manifest["engineTree" if optional else "sourceTree"] == TREE
        for role in ["manifest", "sourceInventory", "distribution", "sourceArchive"]:
            assert item[role] in pins
        runtime_extra = {**manifest_pin, "path": "optional-package.json" if optional else "manifest.json"}
        source_extra = {**inventory_pin, "path": "source-inventory.json"}
        runtime = inspect_members(root / item["distribution"]["path"], manifest["files"], runtime_extra)
        source = inspect_members(root / item["sourceArchive"]["path"], inventory["files"], source_extra)
        if optional:
            for checked in [runtime, source]:
                assert checked["members"] <= manifest["limits"]["files"]
                assert checked["decodedBytes"] <= manifest["limits"]["bytes"]
        archives.extend([runtime, source])
    return {"kind": kind, "head": HEAD, "tree": TREE, "files": verified, "archives": archives, "limits": "Independent hash/CRC/member and optional declared-budget check; cloud admission covers repository policy, complete import closure and two reproducible builds. No native or player acceptance."}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--wrapper", required=True, type=Path)
    parser.add_argument("--artifact", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--kind", required=True, choices=["optional", "company"])
    parser.add_argument("--receipt", required=True, type=Path)
    args = parser.parse_args()
    assert not args.receipt.exists(), "Refusing to overwrite evidence"
    wrapper = unpack_wrapper(args.wrapper, args.output, read_json(args.artifact))
    result = verify_candidate(args.output, args.kind)
    result["wrapper"] = wrapper
    with args.receipt.open("x") as stream:
        json.dump(result, stream, indent=2)
        stream.write("\n")
    print(json.dumps({"result": "PASS_EXACT_ORIGINAL_ARCHIVE_BYTES", "kind": args.kind, "files": len(result["files"]), "archives": [{k: a[k] for k in ["archive", "members", "decodedBytes"]} for a in result["archives"]], "wrapper": wrapper}))
