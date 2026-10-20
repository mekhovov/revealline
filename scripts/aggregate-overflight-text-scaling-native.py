"""Verify all four immutable seven-file groups. No game imports or test execution."""
import argparse
import hashlib
import importlib.util
import io
import json
import math
import os
from pathlib import Path
import re
import stat
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

SPEC = importlib.util.spec_from_file_location("overflight_native_guard", Path(__file__).with_name("overflight-text-scaling-native-guard.py"))
guard = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(guard)
MIB = 1024 * 1024
GROUP_RAW = 8 * MIB
GROUP_ARTIFACT = 12 * MIB
START = time.monotonic()


def artifact_names(source, run):
    return [f"overflight28-{source}-{run}-g{number}" for number in range(1, 5)]


def expected_files(number):
    phases = guard.fixed_phases("NODE", Path("SOURCE"), number)
    names = {"node-version", "initial-source", "final-source"}
    names.update(label for label, _, _ in phases)
    names.update(f"{index:02}-{when}-source" for index in range(1, 8) for when in ("before", "after"))
    files = {"campaign.json", "helper-source.json"}
    for name in names:
        files.update(f"{name}/{file}" for file in ("child-terminal.json", "stdout.log", "stderr.log"))
    files.update(f"{label}/qualified.json" for label, _, _ in phases)
    return names, files


def validate_archive(entries, number):
    directories, files = expected_files(number)
    seen, total, raw = set(), 0, 0
    for entry in entries:
        name = entry.filename
        if (name in seen or "\\" in name or "\0" in name or name.startswith("/") or
                any(part in ("", ".", "..") for part in name.rstrip("/").split("/"))):
            raise RuntimeError("Duplicate or unsafe ZIP member")
        seen.add(name)
        mode = entry.external_attr >> 16
        if stat.S_ISLNK(mode) or entry.flag_bits & 1 or entry.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
            raise RuntimeError("Encrypted or symlink ZIP member")
        if entry.is_dir():
            if name.rstrip("/") not in directories | {"tmp"} or entry.file_size:
                raise RuntimeError("Unknown ZIP directory")
            continue
        if name not in files or (stat.S_IFMT(mode) not in (0, stat.S_IFREG)):
            raise RuntimeError("Unknown or nonregular ZIP member")
        limit = 4 * MIB if name.endswith(("stdout.log", "stderr.log")) else 1024 * 1024
        if name.endswith("child-terminal.json"):
            limit = 65536
        if not 0 <= entry.file_size <= limit:
            raise RuntimeError("ZIP member size bound")
        total += entry.file_size
        if name.endswith(("stdout.log", "stderr.log")):
            raw += entry.file_size
        if total > GROUP_ARTIFACT or raw > GROUP_RAW:
            raise RuntimeError("ZIP uncompressed allocation/raw bound")
    if {name for name in seen if not name.endswith("/")} != files:
        raise RuntimeError("ZIP does not contain the exact complete group file set")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        return None


def bounded_response(response, maximum):
    data = bytearray()
    while True:
        chunk = response.read(min(65536, maximum + 1 - len(data)))
        if not chunk:
            return bytes(data)
        data.extend(chunk)
        if len(data) > maximum:
            raise RuntimeError("Bounded API/archive response exceeded")


def download_groups(directory, source, run):
    if directory.exists() or directory.is_symlink():
        raise RuntimeError("Use a fresh artifact download directory")
    temporary = Path(os.environ["RUNNER_TEMP"]).resolve(strict=True)
    if directory.parent.resolve(strict=True) != temporary:
        raise RuntimeError("Artifacts must be a direct child of runner temporary storage")
    tick(temporary)
    token = os.environ["ARTIFACT_READ_TOKEN"]
    opener = urllib.request.build_opener(NoRedirect)
    headers = {"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    run_id, attempt = run.split("-")
    api = f"https://api.github.com/repos/mekhovov/revealline/actions/runs/{run_id}"
    with opener.open(urllib.request.Request(api, headers=headers), timeout=30) as response:
        info = json.loads(bounded_response(response, 256 * 1024))
    if info.get("head_sha") != source or info.get("repository", {}).get("full_name") != "mekhovov/revealline" or info.get("run_attempt") != int(attempt):
        raise RuntimeError("Artifact run does not bind the immutable candidate")
    with opener.open(urllib.request.Request(api + "/artifacts?per_page=100", headers=headers), timeout=30) as response:
        listing = json.loads(bounded_response(response, 256 * 1024))
    names = artifact_names(source, run)
    matches = [item for item in listing.get("artifacts", []) if item.get("name") in names]
    if listing.get("total_count", 101) > 100 or len(matches) != 4 or sorted(item["name"] for item in matches) != sorted(names):
        raise RuntimeError("Missing/duplicate exact group artifacts")
    directory.mkdir()
    archive_proofs = []
    for number, name in enumerate(names, 1):
        tick(directory)
        item = next(row for row in matches if row["name"] == name)
        digest = item.get("digest", "")
        if (item.get("expired") is not False or not re.fullmatch("sha256:[a-f0-9]{64}", digest) or
                not 0 < item.get("size_in_bytes", 0) <= 13 * MIB or
                item.get("workflow_run", {}).get("head_sha") != source or item.get("workflow_run", {}).get("id") != int(run_id)):
            raise RuntimeError("Artifact identity/size/digest unavailable")
        url = f"https://api.github.com/repos/mekhovov/revealline/actions/artifacts/{int(item['id'])}/zip"
        try:
            with opener.open(urllib.request.Request(url, headers=headers), timeout=30):
                raise RuntimeError("Expected explicit unauthenticated blob redirect")
        except urllib.error.HTTPError as redirect:
            if redirect.code != 302:
                raise
            location = redirect.headers["Location"]
            redirect.close()
        parsed = urllib.parse.urlsplit(location)
        if parsed.scheme != "https" or not parsed.hostname or not parsed.hostname.endswith(".blob.core.windows.net") or parsed.username or parsed.password:
            raise RuntimeError("Unexpected artifact storage redirect")
        # Deliberately no Authorization header on the storage request; no further redirects.
        with opener.open(urllib.request.Request(location), timeout=30) as response:
            archive = bounded_response(response, 13 * MIB)
        if hashlib.sha256(archive).hexdigest() != digest[7:]:
            raise RuntimeError("Artifact archive SHA256 differs")
        archive_proofs.append({"group": number, "name": name, "artifactID": item["id"],
            "archiveSHA256": digest[7:], "archiveBytes": len(archive), "serviceSizeBytes": item["size_in_bytes"]})
        with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
            entries = zipped.infolist()
            if len(entries) > 128:
                raise RuntimeError("ZIP member count bound")
            validate_archive(entries, number)
            group = directory / name
            group.mkdir()
            for entry in entries:
                tick(directory)
                target = group / entry.filename
                if entry.is_dir():
                    target.mkdir(exist_ok=True)
                    continue
                target.parent.mkdir(exist_ok=True)
                with zipped.open(entry) as source_stream, target.open("xb") as destination:
                    count = 0
                    while chunk := source_stream.read(65536):
                        count += len(chunk)
                        if count > entry.file_size:
                            raise RuntimeError("ZIP member actual size differs")
                        destination.write(chunk)
                    if count != entry.file_size:
                        raise RuntimeError("Truncated ZIP member")
        tick(directory)
    proof = {"sourceHead": source, "run": run, "archives": archive_proofs}
    raw = (json.dumps(proof) + "\n").encode()
    if len(raw) > 65536:
        raise RuntimeError("Download provenance exceeds bounded receipt")
    with (directory / "archive-provenance.json").open("xb") as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    (directory / "archive-provenance.json").chmod(0o444)


def tick(root):
    value = os.statvfs(root)
    if value.f_bavail * value.f_frsize <= 2 * 1024 ** 3 or time.monotonic() - START > 180:
        raise RuntimeError("Aggregation capacity/wall guard")


def ordinary(path, maximum):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_size > maximum:
        raise RuntimeError("Unexpected or oversized artifact entry")
    data = path.read_bytes()
    if len(data) != info.st_size:
        raise RuntimeError("Artifact changed while read")
    return data


def document(path, maximum=1024 * 1024):
    return json.loads(ordinary(path, maximum))


def validate_helper_receipt(receipt, source, tree, workflow_oid):
    if (receipt.get("oid") != guard.AUDIT_OID or receipt.get("sha256") != guard.AUDIT_SHA256 or
            receipt.get("bytes") != 7275 or receipt.get("sourceHead") != source or
            receipt.get("sourceTree") != tree or receipt.get("workflowBlob") != workflow_oid or
            receipt.get("workflowDefinitionMatchesCandidate") is not True or
            not re.fullmatch("[a-f0-9]{40}", receipt.get("workflowCommit", ""))):
        raise RuntimeError("Trusted auditor/executed-workflow provenance does not bind candidate")


def content_dependencies(value):
    return {"fakeIndexedDB": value["fakeIndexedDB"], "immutablePackageInputs": value["immutablePackageInputs"], **{
        name: {key: value[name][key] for key in ("contentSHA256", "packageLockSHA256", "entries", "bytes")}
        for name in ("root", "authoring")}}


def finite_between(value, minimum, maximum):
    return type(value) in (int, float) and math.isfinite(value) and minimum <= value <= maximum


def validate_metadata(groups, source, tree):
    if len(groups) != 4 or [row.get("group") for row in groups] != [1, 2, 3, 4]:
        raise RuntimeError("Four unique ordered groups are mandatory")
    joined, total_raw, common = [], 0, None
    for number, row in enumerate(groups, 1):
        expected = list(guard.WHOLE_FILES[(number - 1) * 7:number * 7])
        if (row.get("status") != "PASS" or row.get("sourceHead") != source or row.get("sourceTree") != tree or
                row.get("git", {}).get("head") != source or row.get("git", {}).get("tree") != tree or
                row.get("wholeFiles") != expected or row.get("all28Inventory") != list(guard.WHOLE_FILES) or
                len(row.get("phases", [])) != 7 or len(set(row["phases"])) != 7 or
                row.get("feature", {}).get("initialReferenceManifestSHA256") != guard.FEATURE_MANIFEST_SHA256 or
                row["feature"].get("featurePaths") != 58 or row["feature"].get("stackAdmitted") is not False):
            raise RuntimeError("Group does not bind the complete exact-head selection")
        if (not finite_between(row.get("elapsedSeconds"), 0, 45 * 60) or
                type(row.get("freeBytes")) is not int or row["freeBytes"] <= 2 * 1024 ** 3):
            raise RuntimeError("Group campaign protective timing/capacity facts are invalid")
        raw = row.get("campaignRawBytes")
        if type(raw) is not int or not 0 <= raw <= GROUP_RAW:
            raise RuntimeError("Group raw budget missing or exceeded")
        total_raw += raw
        feature = row["feature"]
        inventory = feature.get("inventory", [])
        digest = hashlib.sha256(guard.json_bytes(inventory)).hexdigest()
        if (len(inventory) != 58 or [item.get("path") for item in inventory] != sorted(guard.FEATURE_PATHS) or
                feature.get("inventorySHA256") != digest or
                feature.get("matchesInitialReference") != (digest == guard.INITIAL_REFERENCE_LEAF_SHA256)):
            raise RuntimeError("Actual immutable58 feature inventory is incomplete or inconsistent")
        for item in inventory:
            if (item.get("mode") not in ("100644", "100755") or
                    not re.fullmatch("[a-f0-9]{40}", item.get("OID", "")) or
                    not re.fullmatch("[a-f0-9]{64}", item.get("SHA256", "")) or
                    type(item.get("bytes")) is not int or item["bytes"] < 0):
                raise RuntimeError("Feature leaf identity is malformed")
        source_proof = row["source"]
        if (source_proof.get("format") != "revealline-source-identity.v1" or
                source_proof.get("sourceRevision") != source or source_proof.get("sourceTree") != tree or
                source_proof.get("allTrackedSourceContentsAndModesMatch") is not True or
                not re.fullmatch("[a-f0-9]{64}", source_proof.get("aggregateSha256", "")) or
                source_proof.get("files", 0) <= 0 or source_proof.get("bytes", 0) <= 0):
            raise RuntimeError("Missing semantic full-source aggregate")
        signature = {"actualFeature": feature, "helperProvenance": {key: row["helperProvenance"]["receipt"][key]
                        for key in ("oid", "sha256", "bytes", "sourceHead", "sourceTree", "workflowCommit", "workflowBlob", "workflowDefinitionMatchesCandidate")}, "source": {key: source_proof[key] for key in ("format", "aggregateSha256", "files", "bytes")},
                     "dependencies": content_dependencies(row["dependencies"]),
                     "nodeSHA256": row["node"]["sha256"], "controls": row["controls"]}
        if common is None:
            common = signature
        elif signature != common:
            raise RuntimeError("Cross-job dependency/Node/control content differs")
        joined.extend(row["wholeFiles"])
    if joined != list(guard.WHOLE_FILES) or len(set(joined)) != 28 or total_raw > 32 * MIB:
        raise RuntimeError("Missing/duplicated/reordered whole-file union or raw overflow")
    return {"wholeFiles": joined, "rawBytes": total_raw, "commonContent": common}


def read_terminal(directory):
    path = directory / "child-terminal.json"
    terminal_bytes = ordinary(path, 65536)
    if len(terminal_bytes) != 65536:
        raise RuntimeError("Child terminal reserve was not preserved")
    child = json.loads(terminal_bytes)
    if (child.get("started") is not True or child.get("subreaper") is not True or
            not finite_between(child.get("elapsedSeconds"), 0, 180) or
            type(child.get("peakObservedOwnedRSSBytes")) is not int or
            not 0 <= child["peakObservedOwnedRSSBytes"] <= 2048 * MIB or
            child.get("exitCode") != 0 or child.get("guard") is not None or
            child.get("captureComplete") is not True or child.get("outputComplete") is not True or
            child.get("outputTruncated") is not False or child.get("remainingOwnedProcesses") != [] or
            child.get("captureErrors") != [] or child.get("stderrBytes") != 0):
        raise RuntimeError("A child terminal is incomplete or failed")
    for stream in ("stdout", "stderr"):
        data = ordinary(directory / f"{stream}.log", 4 * MIB)
        if len(data) != child[f"{stream}Bytes"] or hashlib.sha256(data).hexdigest() != child[f"{stream}SHA256"]:
            raise RuntimeError("Raw child stream differs from sealed terminal")
    return child, hashlib.sha256(terminal_bytes).hexdigest()


def validate_argv(actual, expected):
    if actual != expected:
        raise RuntimeError("Sealed child command differs from the exact audited owner")


def read_group(directory, number, source, tree, expected_controls):
    if not directory.is_dir() or directory.is_symlink():
        raise RuntimeError("Missing ordinary group artifact directory")
    row = document(directory / "campaign.json")
    phases = guard.fixed_phases("NODE", Path("SOURCE"), number)
    expected_names, expected_paths = expected_files(number)
    found, raw, total = set(), 0, 0
    for base, dirs, files in os.walk(directory, followlinks=False):
        for name in dirs:
            path = Path(base) / name
            relative = path.relative_to(directory).as_posix()
            if path.is_symlink() or relative not in expected_names | {"tmp"}:
                raise RuntimeError("Unknown artifact directory")
        for name in files:
            path = Path(base) / name
            relative = path.relative_to(directory).as_posix()
            if relative not in expected_paths or relative in found or not stat.S_ISREG(path.lstat().st_mode):
                raise RuntimeError("Unknown/nonregular artifact file")
            found.add(relative)
            total += path.lstat().st_size
            if relative.endswith(("stdout.log", "stderr.log")):
                raw += path.lstat().st_size
            if raw > GROUP_RAW or total > GROUP_ARTIFACT:
                raise RuntimeError("Artifact allocation/raw bound exceeded")
            tick(directory)
    if found != expected_paths or row.get("campaignRawBytes") != raw or row.get("controls") != expected_controls:
        raise RuntimeError("Artifact incomplete or control/raw proof differs")
    helper_data = ordinary(directory / "helper-source.json", 65536)
    helper = json.loads(helper_data)
    provenance = {"receipt": helper, "SHA256": hashlib.sha256(helper_data).hexdigest()}
    validate_helper_receipt(helper, source, tree, expected_controls[".github/workflows/overflight-text-scaling-native.yml"]["OID"])
    if row.get("helperProvenance") != provenance:
        raise RuntimeError("Trusted helper receipt changed or differs from campaign provenance")
    terminals = {}
    for name in expected_names:
        child, terminal_sha = read_terminal(directory / name)
        if name.endswith("-source"):
            observed = document(directory / name / "stdout.log")
            if (observed != row["source"] or observed.get("sourceRevision") != source or
                    observed.get("sourceTree") != tree or observed.get("allTrackedSourceContentsAndModesMatch") is not True):
                raise RuntimeError("Source audit content is not the exact candidate proof")
        terminals[name] = (child, terminal_sha)
    validate_argv(terminals["node-version"][0]["args"], [row["node"]["path"], "--version"])
    for name in expected_names:
        if name.endswith("-source"):
            validate_argv(terminals[name][0]["args"], [row["node"]["path"], row["auditorPath"], "--root", row["source"]["root"]])
    if ordinary(directory / "node-version/stdout.log", 64).strip() != b"v22.22.2":
        raise RuntimeError("Exact Node version not demonstrated")
    for index, (label, _, filename) in enumerate(phases, 1):
        qualified = document(directory / label / "qualified.json")
        child, terminal_sha = terminals[label]
        if (qualified.get("status") != "PASS" or qualified.get("wholeFile") != filename or
                qualified.get("phase") != label or qualified.get("child") != {**child, "terminalSHA256": terminal_sha} or
                row["phases"][index - 1] != label):
            raise RuntimeError("Qualified phase does not bind its sealed native child")
        validate_argv(child["args"], [row["node"]["path"], "--max-old-space-size=1536", "--test",
                      "--test-concurrency=1", "--experimental-test-isolation=none",
                      str(Path(row["source"]["root"]) / filename)])
        tap = guard.require_complete_tap(ordinary(directory / label / "stdout.log", 4 * MIB).decode())
        if qualified.get("tap") != tap:
            raise RuntimeError("Whole-file TAP proof differs")
        for when in ("before", "after"):
            proof = qualified[when]
            if proof.get("sourceTerminalSHA256") != terminals[f"{index:02}-{when}-source"][1]:
                raise RuntimeError("Source audit terminal differs")
            for key, campaign_key in (("source", "source"), ("git", "git"), ("dependencies", "dependencies"), ("node", "node")):
                if proof[key] != row[campaign_key]:
                    raise RuntimeError("Source/Git/dependency/Node changed within a group")
    tick(directory)
    return row


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifacts", required=True)
    parser.add_argument("--source-head", required=True)
    parser.add_argument("--source-tree", required=True)
    parser.add_argument("--run", required=True)
    parser.add_argument("--root", required=True)
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--receipt", required=True)
    args = parser.parse_args()
    if not re.fullmatch("[a-f0-9]{40}", args.source_head) or not re.fullmatch("[a-f0-9]{40}", args.source_tree) or not re.fullmatch("[0-9]+-[0-9]+", args.run):
        raise RuntimeError("Use exact immutable workflow/run identity")
    root = Path(args.root).resolve(strict=True)
    destination = Path(args.artifacts)
    if args.download:
        download_groups(destination, args.source_head, args.run)
    directory = destination.resolve(strict=True)
    tick(directory)
    controls = {}
    for name in (".github/workflows/overflight-text-scaling-native.yml", "scripts/overflight-text-scaling-native-guard.py", "scripts/aggregate-overflight-text-scaling-native.py", "scripts/test_overflight_text_scaling_native_guard.py"):
        data = ordinary(root / name, 256 * 1024)
        controls[name] = {"OID": hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest(), "SHA256": hashlib.sha256(data).hexdigest()}
    names = artifact_names(args.source_head, args.run)
    if sorted(path.name for path in directory.iterdir()) != sorted(names + ["archive-provenance.json"]):
        raise RuntimeError("Missing/duplicate/unexpected group artifacts")
    download_proof = document(directory / "archive-provenance.json", 65536)
    archives = download_proof.get("archives", [])
    if (download_proof.get("sourceHead") != args.source_head or download_proof.get("run") != args.run or
            len(archives) != 4 or [row.get("name") for row in archives] != names or
            [row.get("group") for row in archives] != [1, 2, 3, 4]):
        raise RuntimeError("Missing exact ordered archive download provenance")
    for row in archives:
        if (type(row.get("artifactID")) is not int or row["artifactID"] <= 0 or
                not re.fullmatch("[a-f0-9]{64}", row.get("archiveSHA256", "")) or
                not 0 < row.get("archiveBytes", 0) <= 13 * MIB):
            raise RuntimeError("Archive identity/digest provenance is malformed")
    groups = [read_group(directory / name, number, args.source_head, args.source_tree, controls) for number, name in enumerate(names, 1)]
    summary = validate_metadata(groups, args.source_head, args.source_tree)
    links = []
    for archive, row in zip(archives, groups):
        group = directory / archive["name"]
        phases = []
        for label in row["phases"]:
            data = ordinary(group / label / "qualified.json", 1024 * 1024)
            value = json.loads(data)
            phases.append({"wholeFile": value["wholeFile"], "qualifiedSHA256": hashlib.sha256(data).hexdigest(),
                "childTerminalSHA256": value["child"]["terminalSHA256"], "stdoutSHA256": value["child"]["stdoutSHA256"]})
        links.append({**archive, "campaignSHA256": hashlib.sha256(ordinary(group / "campaign.json", 1024 * 1024)).hexdigest(),
            "helperReceiptSHA256": row["helperProvenance"]["SHA256"], "auditorPath": row["auditorPath"], "phases": phases})
    tick(directory)
    result = {"status": "PASS", "sourceHead": args.source_head, "sourceTree": args.source_tree,
              "groups": 4, "completeFiles": 28, "artifactProofs": links, **summary, "browserPackageDeviceQualification": False}
    data = (json.dumps(result) + "\n").encode()
    receipt = Path(args.receipt)
    if len(data) > 65536 or receipt.parent.resolve(strict=True) != Path(os.environ["RUNNER_TEMP"]).resolve(strict=True):
        raise RuntimeError("Use one bounded fresh receipt outside source")
    tick(directory)
    with receipt.open("xb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    receipt.chmod(0o444)
    print(data.decode(), end="")


if __name__ == "__main__":
    try:
        main()
    except (urllib.error.HTTPError, urllib.error.URLError):
        raise SystemExit("Artifact transport failed; no qualification")
