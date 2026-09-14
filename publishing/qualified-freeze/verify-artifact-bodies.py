#!/usr/bin/env python3
"""Verify immutable freeze artifacts without extracting the source or loose site.

The supplied immutable GitHub API rows are collector-owned trust inputs.
All three artifact transports and extracted metadata are independently checked.
No network, cleanup, checkout, release, tag, or source writes are performed.
"""
import argparse
import datetime
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import tarfile
import zipfile


CHUNK = 1024 * 1024
METADATA_NAMES = {"freeze-request.json", "freeze-invocation.json", "freeze.log",
                  "source-qualification.json", "receipt-qualified.json", "frozen-integrity.json",
                  "release.json", "manifest.json", ".xonix-build.json",
                  "distribution.zip.sha256", "artifact-bodies.json"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def safe_name(name):
    require(isinstance(name, str) and name and "\\" not in name and "\0" not in name,
            "Invalid archive path")
    p = PurePosixPath(name)
    require(not p.is_absolute() and all(x not in ("", ".", "..") for x in name.split("/")),
            "Unsafe archive path: " + name)
    return name


def stream_hash(stream, kind="sha256", prefix=b"", maximum=None, destination=None):
    h = hashlib.new(kind)
    h.update(prefix)
    count = 0
    while chunk := stream.read(CHUNK):
        count += len(chunk)
        require(maximum is None or count <= maximum, "Body exceeds pinned size")
        h.update(chunk)
        if destination is not None:
            destination.write(chunk)
    return h.hexdigest(), count


def regular_file(path):
    require(path.is_file() and not path.is_symlink(), "Expected regular file: " + str(path))
    return path


def file_hash(path):
    with regular_file(path).open("rb") as f:
        return stream_hash(f)


def document(path):
    return json.loads(regular_file(path).read_bytes())


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args])


def member_list(archive):
    members = archive.infolist()
    names = []
    for member in members:
        safe_name(member.filename)
        mode = member.external_attr >> 16
        require(not member.is_dir() and not (member.flag_bits & 1)
                and stat.S_IFMT(mode) in (0, stat.S_IFREG),
                "Unsupported ZIP member: " + member.filename)
        names.append(member.filename)
    require(len(set(names)) == len(names), "Duplicate ZIP members")
    return members


def verify_transport(path, row, role, version):
    require(isinstance(row["id"], int) and row["id"] > 0, "Invalid artifact ID")
    require(row["name"] == f"frozen-{version}-{role}", "Wrong artifact name")
    require(re.fullmatch(r"sha256:[0-9a-f]{64}", row["digest"] or ""), "Invalid artifact digest")
    require(isinstance(row["size_in_bytes"], int) and row["size_in_bytes"] > 0,
            "Invalid artifact size")
    actual, size = file_hash(path)
    require(size == row["size_in_bytes"] and "sha256:" + actual == row["digest"],
            role + " artifact transport digest/size mismatch")


class HashingReader:
    def __init__(self, stream, maximum):
        self.stream = stream
        self.maximum = maximum
        self.size = 0
        self.hash = hashlib.sha256()

    def read(self, size=-1):
        data = self.stream.read(size)
        self.size += len(data)
        require(self.size <= self.maximum, "Source TAR exceeds pinned size")
        self.hash.update(data)
        return data


def verify_source(path, expected, root, commit):
    require(git(root, "rev-parse", "--show-object-format").strip() == b"sha1",
            "Verifier currently supports SHA-1 Git repositories")
    entries = {}
    for row in git(root, "ls-tree", "-r", "-z", commit).split(b"\0"):
        if not row:
            continue
        header, raw_name = row.split(b"\t", 1)
        mode, kind, oid = header.decode().split()
        name = safe_name(raw_name.decode())
        require(kind == "blob" and mode in ("100644", "100755"), "Unsupported Git entry")
        entries[name] = (mode, oid)
    seen = set()
    with zipfile.ZipFile(path) as outer:
        members = member_list(outer)
        require([m.filename for m in members] == ["source.tar"], "Source wrapper must contain only source.tar")
        require(members[0].file_size == expected["bytes"], "Source wrapper inner size differs")
        with outer.open(members[0]) as raw:
            reader = HashingReader(raw, expected["bytes"])
            with tarfile.open(fileobj=reader, mode="r|") as archive:
                for item in archive:
                    if item.isdir():
                        safe_name(item.name.rstrip("/"))
                        continue
                    name = safe_name(item.name)
                    require(item.isfile() and name not in seen and name in entries,
                            "Unexpected or duplicate TAR member: " + name)
                    seen.add(name)
                    mode, oid = entries[name]
                    require(("100755" if item.mode & 0o111 else "100644") == mode,
                            "Git executable mode differs: " + name)
                    with archive.extractfile(item) as body:
                        digest, size = stream_hash(body, "sha1", b"blob " + str(item.size).encode() + b"\0", item.size)
                    require(size == item.size and digest == oid, "Git blob differs: " + name)
            # Drain TAR padding and the enclosing ZIP member to validate its CRC.
            while reader.read(CHUNK):
                pass
            require(reader.size == expected["bytes"] and reader.hash.hexdigest() == expected["sha256"],
                    "Whole source TAR differs")
    require(seen == set(entries), "TAR/Git path sets differ")
    process = subprocess.Popen(["git", "-C", str(root), "archive", "--format=tar", commit],
                               stdout=subprocess.PIPE)
    try:
        fresh_hash, fresh_size = stream_hash(process.stdout)
    finally:
        process.stdout.close()
    require(process.wait() == 0, "Fresh git archive failed")
    require(fresh_hash == expected["sha256"] and fresh_size == expected["bytes"],
            "Source TAR is not the exact fresh Git archive")
    return len(entries)


def verify_metadata_wrapper(path, metadata, row, version):
    verify_transport(path, row, "metadata", version)
    paths = {p.relative_to(metadata).as_posix(): p for p in metadata.rglob("*") if p.is_file()}
    require(set(paths) == METADATA_NAMES, "Unexpected metadata file set")
    require(all(p.is_file() and not p.is_symlink() for p in metadata.rglob("*")),
            "Metadata must contain only direct regular files")
    with zipfile.ZipFile(path) as outer:
        members = member_list(outer)
        require({m.filename for m in members} == set(paths), "Metadata wrapper/directory paths differ")
        for member in members:
            expected, size = file_hash(paths[member.filename])
            with outer.open(member) as body:
                actual, read_size = stream_hash(body, maximum=size)
            require(actual == expected and read_size == size == member.file_size,
                    "Extracted metadata body differs: " + member.filename)


def verify(args):
    pins = document(Path(args.pins))
    require(pins["format"] == "revealline-hosted-freeze-artifacts.v1", "Wrong pins format")
    version, commit = pins["version"], pins["sourceRevision"]
    require(re.fullmatch(r"v0\.\d+\.\d+", version) and re.fullmatch(r"[0-9a-f]{40}", commit),
            "Invalid pinned source identity")
    require(re.fullmatch(r"[0-9a-f]{40}", pins["freezeControllerRevision"]), "Invalid controller identity")
    require(isinstance(pins["freezeRunId"], int) and pins["freezeRunId"] > 0, "Invalid freeze run")
    require(set(pins["artifacts"]) == {"metadata", "source", "distribution"}, "Wrong artifact roles")
    metadata, root, out = Path(args.metadata), Path(args.git_root), Path(args.out)
    require(metadata.is_dir() and not metadata.is_symlink(), "Invalid metadata directory")
    require(not out.exists() and not out.is_symlink(), "Output must be a new directory")
    require(out.parent.is_dir(), "Output parent must already exist")
    source_zip, distribution_zip = Path(args.source_zip), Path(args.distribution_zip)
    verify_transport(source_zip, pins["artifacts"]["source"], "source", version)
    verify_transport(distribution_zip, pins["artifacts"]["distribution"], "distribution", version)
    verify_metadata_wrapper(Path(args.metadata_zip), metadata, pins["artifacts"]["metadata"], version)
    record = document(metadata / "release.json")
    manifest = document(metadata / "manifest.json")
    bodies = document(metadata / "artifact-bodies.json")
    hosted = document(metadata / "frozen-integrity.json")
    invocation = document(metadata / "freeze-invocation.json")
    for label, value in [("release", record), ("manifest", manifest), ("bodies", bodies),
                         ("hosted proof", hosted), ("invocation", invocation)]:
        require(value["version"] == version and value["sourceRevision"] == commit,
                label + " source/version mismatch")
    require(bodies["format"] == "revealline-frozen-artifact-bodies.v1", "Wrong body pins format")
    require(hosted["format"] == "revealline-frozen-integrity.v1" and hosted["passed"] is True
            and hosted["looseFilesVerified"] is True, "Hosted loose-file proof is absent")
    require(invocation["format"] == "revealline-hosted-freeze-invocation.v1"
            and invocation["artifactOnly"] is True
            and invocation["controllerRevision"] == pins["freezeControllerRevision"]
            and invocation["runId"] == pins["freezeRunId"], "Freeze invocation differs")
    tree = git(root, "rev-parse", commit + "^{tree}").decode().strip()
    require(tree == hosted["sourceTree"] == invocation["sourceTree"], "Source tree differs")
    for name, key in [("source.tar", "sourceArchiveSha256"), ("distribution.zip", "distributionSha256")]:
        expected = bodies["assets"][name]
        require(isinstance(expected["bytes"], int) and expected["bytes"] > 0
                and expected["sha256"] == record[key] == hosted[key], "Inner asset pins differ")
    manifest_hash, manifest_bytes = file_hash(metadata / "manifest.json")
    require(manifest_hash == record["manifestSha256"] == hosted["manifestSha256"], "Manifest digest differs")
    require((metadata / "distribution.zip.sha256").read_text().strip()
            == record["distributionSha256"] + "  distribution.zip", "Distribution checksum differs")
    files = {}
    for row in manifest["files"]:
        name = safe_name(row["path"])
        require(name not in files and name != "manifest.json" and isinstance(row["bytes"], int)
                and row["bytes"] >= 0 and re.fullmatch(r"[0-9a-f]{64}", row["sha256"]), "Invalid manifest row")
        files[name] = row
    require(sum(row["bytes"] for row in files.values()) == manifest["totalBytes"], "Manifest total differs")
    source_count = verify_source(source_zip, bodies["assets"]["source.tar"], root, commit)
    # Only now allocate the one required inner ZIP. On failure retain it as evidence.
    out.mkdir()
    (out / "site").mkdir()
    target = out / "site/distribution.zip"
    with zipfile.ZipFile(distribution_zip) as outer:
        members = member_list(outer)
        require([m.filename for m in members] == ["distribution.zip"],
                "Distribution wrapper must contain only distribution.zip")
        expected = bodies["assets"]["distribution.zip"]
        require(members[0].file_size == expected["bytes"], "Distribution inner size differs")
        with outer.open(members[0]) as body, target.open("xb") as output:
            actual, size = stream_hash(body, maximum=expected["bytes"], destination=output)
        require(actual == expected["sha256"] and size == expected["bytes"], "Whole distribution ZIP differs")
    with zipfile.ZipFile(target) as archive:
        members = member_list(archive)
        require({m.filename for m in members} == set(files) | {"manifest.json"}, "Distribution member set differs")
        for member in members:
            expected = files.get(member.filename, {"bytes": manifest_bytes, "sha256": manifest_hash})
            require(member.file_size == expected["bytes"], "Distribution member size differs")
            with archive.open(member) as body:
                actual, size = stream_hash(body, maximum=expected["bytes"])
            require(actual == expected["sha256"] and size == expected["bytes"],
                    "Distribution member body differs: " + member.filename)
    result = {
        "format": "revealline-local-artifact-integrity.v1", "passed": True,
        "verifiedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "version": version, "sourceRevision": commit, "sourceTree": tree,
        "freezeControllerRevision": pins["freezeControllerRevision"], "freezeRunId": pins["freezeRunId"],
        "artifactPinsSha256": file_hash(Path(args.pins))[0], "artifacts": pins["artifacts"],
        "sourceArtifactTransportVerified": True, "distributionArtifactTransportVerified": True,
        "metadataArtifactTransportVerified": True,
        "metadataTrustBoundary": "Supplied pinned GitHub API rows; metadata wrapper and extracted bytes independently verified.",
        "sourceArchiveSha256": record["sourceArchiveSha256"], "sourceArchiveBytes": bodies["assets"]["source.tar"]["bytes"],
        "sourceArchiveEqualsFreshGitArchive": True, "sourceGitBodiesAndExecutableModesVerified": source_count,
        "sourceExtracted": False, "distributionSha256": record["distributionSha256"],
        "distributionBytes": bodies["assets"]["distribution.zip"]["bytes"], "manifestSha256": manifest_hash,
        "manifestFiles": len(files), "manifestBytes": manifest["totalBytes"],
        "zipMembers": len(members), "zipMemberBodiesVerified": True, "zipCRCsVerified": True,
        "looseFilesVerified": False, "hostedLooseFileProofSha256": file_hash(metadata / "frozen-integrity.json")[0],
        "independentBuildReproductionPerformed": False, "networkRequestsPerformed": False,
    }
    with (out / "local-artifact-integrity.json").open("x") as output:
        json.dump(result, output, indent=2)
        output.write("\n")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("pins", "metadata", "metadata-zip", "source-zip", "distribution-zip", "git-root", "out"):
        parser.add_argument("--" + name, required=True)
    print(json.dumps(verify(parser.parse_args()), indent=2))


if __name__ == "__main__":
    main()
