"""Diagnostic only: two fixed immutable whole-file observations, never feature qualification."""
import argparse
import base64
import hashlib
import importlib.util
import io
import json
import math
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

MIB = 1024 ** 2
FLOOR = 2048 * MIB
FILE = "game/test/fpv-world-appearance-ui.test.mjs"
WORKFLOW = ".github/workflows/world-appearance-memory-comparison.yml"
CONTROLS = (WORKFLOW, "scripts/world-appearance-memory-comparison.py",
            "scripts/world-appearance-memory-comparison-pins.json",
            "scripts/test_world_appearance_memory_comparison.py",
            "docs/verification/world-appearance-memory-comparison.md")
PINS_SHA = "679106613c26d3c5d50512e20de207c5b452aaad1cca639ff9c9d8f60ca65091"
DEADLINE = None
PHASES = ("node-version", "initial-source", "before-source", "world-file", "after-source")
MEMBERS = {"comparison.json", "helper-source.json"}
MEMBERS |= {f"{phase}/{name}" for phase in PHASES
            for name in ("child-terminal.json", "stdout.log", "stderr.log")}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def blob(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def encode(value):
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()


def ordinary(path, maximum=4 * MIB):
    path = Path(path)
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or before.st_size > maximum:
        raise RuntimeError("Expected bounded ordinary nonlinked file")
    with path.open("rb") as stream:
        data = stream.read(maximum + 1)
        after = os.fstat(stream.fileno())
    fields = ("st_dev", "st_ino", "st_mode", "st_nlink", "st_size", "st_mtime_ns", "st_ctime_ns")
    identity = tuple(getattr(before, k) for k in fields)
    if identity != tuple(getattr(after, k) for k in fields) or identity != tuple(getattr(path.lstat(), k) for k in fields):
        raise RuntimeError("File changed during read")
    return data, identity


def floor(*paths):
    if DEADLINE is not None and time.monotonic() > DEADLINE:
        raise RuntimeError("Diagnostic aggregation wall180s exceeded")
    value = min(shutil.disk_usage(p).free for p in paths)
    if value <= FLOOR:
        raise RuntimeError("Diagnostic retains original 2GiB disk floor")
    return value


def git(root, *args):
    env = {k: os.environ[k] for k in ("PATH", "HOME", "LANG", "LC_ALL", "TZ") if k in os.environ}
    env.update(GIT_NO_LAZY_FETCH="1", GIT_OPTIONAL_LOCKS="0", GIT_TERMINAL_PROMPT="0")
    result = subprocess.run(["git", "--no-replace-objects", "-c", "gc.auto=0",
                             "-c", "maintenance.auto=false", "-C", str(root), *args],
                            env=env, capture_output=True, timeout=15)
    if result.returncode or result.stderr or len(result.stdout) > 2 * MIB:
        raise RuntimeError("Read-only Git proof failed")
    return result.stdout


def controls(root):
    root = Path(root).resolve(strict=True)
    rows = []
    for path in CONTROLS:
        data, identity = ordinary(root / path)
        fields = git(root, "ls-tree", "-z", "HEAD", "--", path).rstrip(b"\0").split(b"\t")
        if len(fields) != 2 or fields[1].decode() != path:
            raise RuntimeError("Control path missing")
        mode, kind, oid = fields[0].decode().split()
        if mode != "100644" or kind != "blob" or blob(data) != oid:
            raise RuntimeError("Control differs from immutable checkout")
        rows.append({"path": path, "mode": mode, "OID": oid, "SHA256": digest(data), "bytes": len(data)})
    metadata = {}
    for name in ("HEAD", "index", "config"):
        p = Path(git(root, "rev-parse", "--git-path", name).decode().strip())
        p = p if p.is_absolute() else root / p
        data, identity = ordinary(p, 16 * MIB)
        metadata[name] = {"SHA256": digest(data), "identity": identity}
    return {"head": git(root, "rev-parse", "HEAD").decode().strip(),
            "tree": git(root, "rev-parse", "HEAD^{tree}").decode().strip(),
            "inventory": rows, "metadata": metadata}


def read_pins(control):
    data, _ = ordinary(Path(control) / "scripts/world-appearance-memory-comparison-pins.json")
    if digest(data) != PINS_SHA:
        raise RuntimeError("Fixed diagnostic pins changed")
    return json.loads(data)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def bounded(response, maximum):
    out = bytearray()
    while True:
        if DEADLINE is not None and time.monotonic() > DEADLINE:
            raise RuntimeError("Diagnostic aggregation wall180s exceeded")
        value = response.read(min(65536, maximum + 1 - len(out)))
        if not value:
            return bytes(out)
        out.extend(value)
        if len(out) > maximum:
            raise RuntimeError("Bounded network response exceeded")


def api(path):
    if not path.startswith("repos/mekhovov/revealline/"):
        raise RuntimeError("Unexpected API owner")
    request = urllib.request.Request("https://api.github.com/" + path,
        headers={"Authorization": "Bearer " + os.environ["DIAGNOSTIC_READ_TOKEN"],
                 "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"})
    with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
        return json.loads(bounded(response, 256 * 1024))


def prepare(args):
    control, target = Path(args.control).resolve(strict=True), Path(args.root).resolve(strict=True)
    pins, identity = read_pins(control), controls(control)
    wanted = pins["targets"][args.label]
    if git(target, "rev-parse", "HEAD").decode().strip() != wanted["head"] or git(target, "rev-parse", "HEAD^{tree}").decode().strip() != wanted["tree"]:
        raise RuntimeError("Target is not the fixed immutable diagnostic head")
    run = api("repos/mekhovov/revealline/actions/runs/" + os.environ["GITHUB_RUN_ID"])
    if run.get("head_sha") != identity["head"] or run.get("run_attempt") != int(os.environ["GITHUB_RUN_ATTEMPT"]):
        raise RuntimeError("Executed run does not bind reviewed controls")
    workflow_commit = os.environ["GITHUB_WORKFLOW_SHA"]
    if not re.fullmatch("[a-f0-9]{40}", workflow_commit):
        raise RuntimeError("Missing immutable executed workflow revision")
    workflow = api("repos/mekhovov/revealline/contents/" + WORKFLOW + "?ref=" + workflow_commit)
    wfbytes = base64.b64decode(workflow["content"], validate=False)
    expected = next(row for row in identity["inventory"] if row["path"] == WORKFLOW)
    if workflow.get("type") != "file" or workflow.get("sha") != expected["OID"] or blob(wfbytes) != expected["OID"] or digest(wfbytes) != expected["SHA256"]:
        raise RuntimeError("Executed workflow differs from reviewed control checkout")
    trusted = Path(args.trusted)
    temporary = Path(os.environ["RUNNER_TEMP"]).resolve(strict=True)
    if trusted.parent.resolve(strict=True) != temporary or trusted.exists() or trusted.is_symlink():
        raise RuntimeError("Use fresh direct runner-temporary trusted directory")
    floor(control, target, temporary)
    payloads = {}
    for name in ("guard", "auditor"):
        row = pins[name]
        response = api("repos/mekhovov/revealline/git/blobs/" + row["OID"])
        data = base64.b64decode(response["content"], validate=False)
        if response.get("sha") != row["OID"] or response.get("size") != row["bytes"] or len(data) != row["bytes"] or digest(data) != row["SHA256"] or blob(data) != row["OID"]:
            raise RuntimeError("Trusted pinned blob differs")
        payloads[row["filename"]] = data
    floor(control, target, temporary)
    trusted.mkdir(mode=0o700)
    for name, data in payloads.items():
        with (trusted / name).open("xb") as stream:
            stream.write(data)
        (trusted / name).chmod(0o444)
    receipt = {"format": "world-memory-trusted-controls.v1", "label": args.label,
               "sourceHead": wanted["head"], "sourceTree": wanted["tree"],
               "control": identity, "workflowCommit": workflow_commit,
               "workflowBlob": expected["OID"], "workflowDefinitionMatchesControls": True,
               "runID": int(os.environ["GITHUB_RUN_ID"]), "runAttempt": int(os.environ["GITHUB_RUN_ATTEMPT"]),
               "guard": pins["guard"], "auditor": pins["auditor"]}
    with (trusted / "helper-source.json").open("xb") as stream:
        stream.write(encode(receipt))
    (trusted / "helper-source.json").chmod(0o444)
    floor(control, target, temporary)


def load_guard(trusted, pins):
    path = Path(trusted) / pins["guard"]["filename"]
    data, _ = ordinary(path)
    if digest(data) != pins["guard"]["SHA256"] or blob(data) != pins["guard"]["OID"]:
        raise RuntimeError("Immutable original native guard differs")
    spec = importlib.util.spec_from_file_location("reviewed_world_memory_guard", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # Reviewed stdlib-only definitions; no candidate/native imports.
    return module


def native_args(node, root):
    return [node, "--max-old-space-size=1536", "--test", "--test-concurrency=1",
            "--experimental-test-isolation=none", str(Path(root) / FILE)]


def classify(terminal, stdout, stderr, source_exact):
    if not terminal or not source_exact:
        return {"outcome": "FAILED_OR_INCOMPLETE", "reason": "missing native terminal or exact postflight"}
    clean = (terminal.get("started") is True and terminal.get("subreaper") is True and
             terminal.get("guard") is None and terminal.get("captureComplete") is True and
             terminal.get("outputComplete") is True and terminal.get("outputTruncated") is False and
             terminal.get("captureErrors") == [] and terminal.get("remainingOwnedProcesses") == [])
    if not clean:
        return {"outcome": "FAILED_OR_INCOMPLETE", "reason": "capture/resource/child ownership did not qualify"}
    if terminal.get("exitCode") == -6 and b"FATAL ERROR:" in stderr and b"heap out of memory" in stderr:
        return {"outcome": "V8_OOM", "nativeQualification": False}
    if terminal.get("exitCode") != 0 or stderr:
        return {"outcome": "FAILED_WHOLE_FILE", "nativeQualification": False}
    text = stdout.decode("utf-8")
    counts = {}
    for key in ("tests", "pass", "fail", "cancelled", "skipped", "todo"):
        matches = re.findall(rf"^# {key} (\d+)\s*$", text, re.M)
        if len(matches) != 1:
            return {"outcome": "FAILED_OR_INCOMPLETE", "reason": "missing or ambiguous full TAP footer"}
        counts[key] = int(matches[0])
    plans = re.findall(r"^1\.\.(\d+)\s*$", text, re.M)
    terminals = re.findall(r"^(?:ok|not ok) \d+(?: -[^\n]*)?$", text, re.M)
    if len(plans) != 1 or int(plans[0]) != len(terminals) or counts["tests"] != 115 or counts["pass"] != 115 or any(counts[k] for k in ("fail", "cancelled", "skipped", "todo")) or re.search(r"^\s*(?:not ok |Bail out!)", text, re.M):
        return {"outcome": "FAILED_OR_INCOMPLETE", "reason": "fixed whole115-case file did not fully pass"}
    return {"outcome": "WHOLE_FILE_SUCCESS", "tap": counts,
            "scope": "Diagnostic exact whole-file observation only, not feature58/60 qualification"}


def run(args):
    control = Path(args.control).resolve(strict=True)
    pins, initial_control = read_pins(control), controls(control)
    wanted = pins["targets"][args.label]
    guard = load_guard(args.trusted, pins)
    trusted_receipt, receipt_identity = ordinary(Path(args.trusted) / "helper-source.json", 65536)
    provenance = json.loads(trusted_receipt)
    if provenance["control"] != initial_control or provenance["sourceHead"] != wanted["head"] or provenance["sourceTree"] != wanted["tree"] or provenance["label"] != args.label:
        raise RuntimeError("Prepared trust context is stale")
    if provenance["guard"] != pins["guard"] or provenance["auditor"] != pins["auditor"] or provenance["workflowDefinitionMatchesControls"] is not True:
        raise RuntimeError("Unreviewed guard/auditor/workflow provenance")

    class Diagnostic(guard.Campaign):
        """Reuse original capture/audit lifecycle; only the inventory/provenance contract is diagnostic."""
        def verify_feature(self):
            actual = self.pinned_paths(tuple(pins["owners"]))
            for row in actual:
                expected = pins["owners"][row["path"]]
                if row["OID"] != expected["OID"] or row["bytes"] != expected["bytes"] or row["mode"] != "100644":
                    raise RuntimeError("The fixed nine diagnostic owners differ")
            if self.baseline_feature is None:
                self.baseline_feature = actual
            elif actual != self.baseline_feature:
                raise RuntimeError("Diagnostic owner drift")
            return {"scope": "DIAGNOSTIC_NINE_OWNERS_NOT_FEATURE_INVENTORY", "owners": actual}

        def helper_provenance(self):
            data, identity = ordinary(Path(args.trusted) / "helper-source.json", 65536)
            if data != trusted_receipt or identity != receipt_identity or controls(control) != initial_control:
                raise RuntimeError("Trusted controls/provenance changed")
            return {"receipt": provenance, "SHA256": digest(data)}

        def node_identity(self):
            actual = super().node_identity()
            if actual["sha256"] != pins["nodeSHA256"]:
                raise RuntimeError("Require identical reviewed Linux Node22.22.2 binary")
            return actual

    campaign = Diagnostic(args.root, args.output, wanted["head"], wanted["tree"],
                          Path(args.trusted) / pins["auditor"]["filename"], 1)
    temporary = Path(os.environ["RUNNER_TEMP"]).resolve(strict=True)
    if campaign.output.parent.resolve(strict=True) != temporary or campaign.output.exists() or campaign.output.is_symlink() or campaign.output.resolve().is_relative_to(campaign.root) or campaign.output.resolve().is_relative_to(control):
        raise RuntimeError("Use fresh output outside both source checkouts")
    campaign.output.mkdir()
    (campaign.output / "tmp").mkdir()
    reserve = campaign.output / "comparison.json"
    reserve.write_bytes(b" " * guard.TERMINAL_RESERVE)
    info = reserve.lstat()
    campaign.reserved[reserve] = (info.st_dev, info.st_ino, info.st_size)
    record = {"format": "world-appearance-memory-diagnostic.v1", "label": args.label,
              "sourceHead": wanted["head"], "sourceTree": wanted["tree"],
              "scope": "DIAGNOSTIC_ONLY_NO_FEATURE_QUALIFICATION", "control": initial_control,
              "trusted": provenance, "root": str(campaign.root), "node": campaign.node,
              "auditorPath": str(campaign.helper), "guard": pins["guard"],
              "outcome": "FAILED_OR_INCOMPLETE", "before": None, "after": None,
              "nativeTerminal": None, "error": None}
    campaign.env = guard.controlled_environment(os.environ, campaign.output / "tmp")
    try:
        guard.enable_subreaper()
        campaign.capacity()
        if campaign.hash_regular(campaign.helper) != pins["auditor"]["SHA256"]:
            raise RuntimeError("Auditor changed")
        (campaign.output / "helper-source.json").write_bytes(trusted_receipt)
        (campaign.output / "helper-source.json").chmod(0o444)
        campaign.run("node-version", [campaign.node, "--version"])
        if (campaign.output / "node-version/stdout.log").read_text().strip() != "v22.22.2":
            raise RuntimeError("Exact Node22.22.2 is required")
        campaign.source_audit("initial")
        record["before"] = campaign.source_audit("before")
        campaign.active_phase = "world-file"
        try:
            campaign.run("world-file", native_args(campaign.node, campaign.root))
        except Exception as error:
            record["error"] = type(error).__name__ + ": " + str(error)
        terminal = campaign.output / "world-file/child-terminal.json"
        if terminal.exists():
            record["nativeTerminal"] = json.loads(ordinary(terminal, 65536)[0])
        # Keep failed child facts immutable. Postflight is evidence, never a retry.
        if any(thread.is_alive() for thread in campaign.capture_threads) or campaign.observe(-1):
            raise RuntimeError("Refuse postflight with unconfirmed live child/capture")
        campaign.capacity()
        record["after"] = campaign.source_audit("after")
        before, after = record["before"], record["after"]
        exact = all(before[k] == after[k] for k in ("source", "dependencies", "git", "node"))
        stdout = ordinary(campaign.output / "world-file/stdout.log")[0]
        stderr = ordinary(campaign.output / "world-file/stderr.log")[0]
        record.update(classify(record["nativeTerminal"], stdout, stderr, exact))
        record["owners"] = campaign.verify_feature()["owners"]
        record["controlsAfter"] = controls(control)
        if record["controlsAfter"] != initial_control:
            raise RuntimeError("Control checkout changed")
        record["freeBytes"] = campaign.capacity()
    except Exception as error:
        record.update(outcome="FAILED_OR_INCOMPLETE", error=type(error).__name__ + ": " + str(error))
    finally:
        record["evidenceFiles"] = []
        try:
            for path in sorted(campaign.output.rglob("*")):
                if not path.is_file() or path == reserve:
                    continue
                name = path.relative_to(campaign.output).as_posix()
                if name not in MEMBERS:
                    raise RuntimeError("Unexpected evidence member: " + name)
                data, _ = ordinary(path)
                record["evidenceFiles"].append({"path": name, "bytes": len(data), "SHA256": digest(data)})
        except Exception as error:
            record.update(outcome="FAILED_OR_INCOMPLETE", evidenceIndexError=type(error).__name__ + ": " + str(error))
        campaign.seal_terminal(reserve, record)
    print(json.dumps({"label": args.label, "outcome": record["outcome"],
                      "nativeQualification": False, "receipt": str(reserve)}))
    return 0 if record["outcome"] == "WHOLE_FILE_SUCCESS" else 1


def validate_zip(entries):
    if len(entries) > 48:
        raise RuntimeError("ZIP member count exceeded")
    seen, total, raw = set(), 0, 0
    for entry in entries:
        name = entry.filename
        if name in seen or "\\" in name or "\0" in name or name.startswith("/") or any(p in ("", ".", "..") for p in name.rstrip("/").split("/")):
            raise RuntimeError("Duplicate or unsafe ZIP member")
        seen.add(name)
        mode = entry.external_attr >> 16
        if stat.S_ISLNK(mode) or entry.flag_bits & 1 or entry.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
            raise RuntimeError("Encrypted or symlink ZIP member")
        if entry.is_dir():
            if name.rstrip("/") not in set(PHASES) | {"tmp"} or entry.file_size:
                raise RuntimeError("Unknown ZIP directory")
            continue
        if name not in MEMBERS or stat.S_IFMT(mode) not in (0, stat.S_IFREG):
            raise RuntimeError("Unknown or nonregular ZIP member")
        limit = 4 * MIB if name.endswith((".log",)) else 65536
        if not 0 <= entry.file_size <= limit:
            raise RuntimeError("ZIP member bound exceeded")
        total += entry.file_size
        if name.endswith(".log"):
            raw += entry.file_size
    if total > 12 * MIB or raw > 8 * MIB or "comparison.json" not in seen:
        raise RuntimeError("ZIP total/raw bound or required diagnostic receipt failed")
    # Partial known member sets are retained as INCOMPLETE, never promoted to PASS.


def read_archive(data):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        validate_zip(archive.infolist())
        values = {}
        for entry in archive.infolist():
            if entry.is_dir():
                continue
            value = archive.read(entry)
            if len(value) != entry.file_size:
                raise RuntimeError("ZIP size/CRC mismatch")
            values[entry.filename] = value
        return values


def verify_observation(values, label, pins, current_control, run_id, attempt):
    if len(values["comparison.json"]) != 65536:
        raise RuntimeError("Diagnostic comparison reserve must be exact64KiB")
    r = json.loads(values["comparison.json"])
    wanted = pins["targets"][label]
    if r.get("format") != "world-appearance-memory-diagnostic.v1" or r.get("label") != label or r.get("sourceHead") != wanted["head"] or r.get("sourceTree") != wanted["tree"] or r.get("scope") != "DIAGNOSTIC_ONLY_NO_FEATURE_QUALIFICATION":
        raise RuntimeError("Diagnostic source/scope mismatch")
    if any(r.get("control", {}).get(k) != current_control[k] for k in ("head", "tree", "inventory")):
        raise RuntimeError("Diagnostic control head/tree/inventory differs")
    trust = r.get("trusted", {})
    if trust.get("runID") != run_id or trust.get("runAttempt") != attempt or trust.get("sourceHead") != wanted["head"] or trust.get("sourceTree") != wanted["tree"] or trust.get("control") != r["control"] or trust.get("guard") != pins["guard"] or trust.get("auditor") != pins["auditor"] or trust.get("workflowDefinitionMatchesControls") is not True:
        raise RuntimeError("Prepared/executed trust context differs")
    workflow_oid = next(row["OID"] for row in current_control["inventory"] if row["path"] == WORKFLOW)
    if trust.get("workflowBlob") != workflow_oid or not re.fullmatch("[a-f0-9]{40}", trust.get("workflowCommit", "")):
        raise RuntimeError("Executed workflow blob/revision differs")
    rows = r.get("evidenceFiles", [])
    if len({x.get("path") for x in rows}) != len(rows) or {x.get("path") for x in rows} != set(values) - {"comparison.json"}:
        raise RuntimeError("Evidence links are incomplete or duplicate")
    for row in rows:
        value = values[row["path"]]
        if row.get("bytes") != len(value) or row.get("SHA256") != digest(value):
            raise RuntimeError("Evidence payload differs")
    if "helper-source.json" in values and json.loads(values["helper-source.json"]) != trust:
        raise RuntimeError("Preserved helper receipt differs")
    complete = set(values) == MEMBERS
    terminal = None
    for phase in PHASES:
        key = phase + "/child-terminal.json"
        if key not in values:
            complete = False
            continue
        if len(values[key]) != 65536:
            raise RuntimeError("Sealed child terminal reserve must be exact64KiB")
        t = json.loads(values[key])
        for stream in ("stdout", "stderr"):
            raw = values.get(phase + "/" + stream + ".log")
            if raw is None or len(raw) != t.get(stream + "Bytes") or digest(raw) != t.get(stream + "SHA256"):
                raise RuntimeError("Sealed child/raw hash link differs")
        expected = ([r["node"], "--version"] if phase == "node-version" else
                    native_args(r["node"], r["root"]) if phase == "world-file" else
                    [r["node"], r["auditorPath"], "--root", r["root"]])
        if t.get("args") != expected:
            raise RuntimeError("Child argv/root/Node differs")
        elapsed, rss = t.get("elapsedSeconds"), t.get("peakObservedOwnedRSSBytes")
        if isinstance(elapsed, bool) or not isinstance(elapsed, (int, float)) or not math.isfinite(elapsed) or not 0 <= elapsed <= 180 or type(rss) is not int or not 0 <= rss <= 2048 * MIB:
            complete = False
        if phase == "world-file":
            terminal = t
        elif t.get("exitCode") != 0 or t.get("guard") is not None or t.get("stderrBytes") or t.get("started") is not True or t.get("captureComplete") is not True or t.get("outputComplete") is not True or t.get("outputTruncated") is not False or t.get("captureErrors") != [] or t.get("remainingOwnedProcesses") != [] or t.get("subreaper") is not True:
            complete = False
    if r.get("nativeTerminal") != terminal:
        raise RuntimeError("Native terminal link differs")
    before, after = r.get("before"), r.get("after")
    source_exact = bool(complete and before and after and r.get("controlsAfter") == r["control"] and
                        type(r.get("freeBytes")) is int and r["freeBytes"] > FLOOR)
    if source_exact:
        for name in ("source", "dependencies", "git", "node"):
            source_exact &= before.get(name) == after.get(name)
        source = before["source"]
        source_exact &= source.get("sourceRevision") == wanted["head"] and source.get("sourceTree") == wanted["tree"] and source.get("allTrackedSourceContentsAndModesMatch") is True
        source_exact &= before["node"].get("sha256") == pins["nodeSHA256"] and before["node"].get("path") == r["node"]
        source_exact &= before["git"].get("head") == wanted["head"] and before["git"].get("tree") == wanted["tree"] and source.get("root") == r["root"]
        owners = r.get("owners", [])
        if len(owners) != 9 or {row.get("path") for row in owners} != set(pins["owners"]):
            raise RuntimeError("Diagnostic nine-owner inventory incomplete")
        for row in owners:
            expected = pins["owners"][row["path"]]
            if row.get("mode") != "100644" or row.get("OID") != expected["OID"] or row.get("bytes") != expected["bytes"] or not re.fullmatch("[a-f0-9]{64}", row.get("SHA256", "")):
                raise RuntimeError("Diagnostic owner pin differs")
        if values.get("node-version/stdout.log", b"").strip() != b"v22.22.2":
            source_exact = False
        if json.loads(values["initial-source/stdout.log"]) != before["source"]:
            raise RuntimeError("Initial auditor does not bind unchanged diagnostic source")
        for phase, audit in (("before-source", before), ("after-source", after)):
            if json.loads(values[phase + "/stdout.log"]) != audit["source"] or audit.get("sourceTerminalSHA256") != digest(values[phase + "/child-terminal.json"]):
                raise RuntimeError("Source auditor output/terminal link differs")
    observed = classify(terminal, values.get("world-file/stdout.log", b""),
                        values.get("world-file/stderr.log", b""), source_exact)
    if r.get("outcome") != observed["outcome"]:
        raise RuntimeError("Claimed diagnostic outcome differs from actual evidence")
    return {"label": label, "sourceHead": wanted["head"], "sourceTree": wanted["tree"],
            "outcome": observed["outcome"], "nativeQualification": False,
            "sourceIntegrityComplete": source_exact, "receiptSHA256": digest(values["comparison.json"]),
            "child": terminal, "before": before, "after": after, "control": r["control"]}


def download_artifacts(control_head, run_id, attempt, directory, archive_links):
    prefix = f"world-memory-{control_head}-{run_id}-{attempt}-"
    names = [prefix + label for label in ("baseline", "feature")]
    run = api("repos/mekhovov/revealline/actions/runs/" + str(run_id))
    if run.get("head_sha") != control_head or run.get("run_attempt") != attempt:
        raise RuntimeError("Artifact run source differs")
    listing = api(f"repos/mekhovov/revealline/actions/runs/{run_id}/artifacts?per_page=100")
    matches = [r for r in listing.get("artifacts", []) if r.get("name") in names]
    if listing.get("total_count", 101) > 100 or len(matches) != 2 or sorted(r["name"] for r in matches) != sorted(names):
        raise RuntimeError("Missing/duplicate two immutable observations")
    out = []
    for label, name in zip(("baseline", "feature"), names):
        floor(directory)
        item = next(r for r in matches if r["name"] == name)
        if item.get("expired") is not False or not re.fullmatch(r"sha256:[a-f0-9]{64}", item.get("digest", "")) or not 0 < item.get("size_in_bytes", 0) <= 13 * MIB or item.get("workflow_run", {}).get("head_sha") != control_head or item["workflow_run"].get("id") != run_id:
            raise RuntimeError("Artifact metadata/digest differs")
        request = urllib.request.Request(f"https://api.github.com/repos/mekhovov/revealline/actions/artifacts/{item['id']}/zip",
            headers={"Authorization": "Bearer " + os.environ["DIAGNOSTIC_READ_TOKEN"], "Accept": "application/vnd.github+json"})
        try:
            with urllib.request.build_opener(NoRedirect).open(request, timeout=30):
                raise RuntimeError("Expected storage redirect")
        except urllib.error.HTTPError as error:
            if error.code != 302:
                raise
            location = error.headers["Location"]
            error.close()
        url = urllib.parse.urlsplit(location)
        if url.scheme != "https" or not url.hostname or not url.hostname.endswith(".blob.core.windows.net") or url.username or url.password:
            raise RuntimeError("Unsafe storage redirect")
        # Authentication is deliberately absent from artifact storage.
        with urllib.request.build_opener(NoRedirect).open(location, timeout=30) as response:
            data = bounded(response, 13 * MIB)
        if digest(data) != item["digest"][7:] or len(data) != item["size_in_bytes"]:
            raise RuntimeError("Artifact archive digest/size mismatch")
        with (directory / (label + ".zip")).open("xb") as stream:
            stream.write(data)
        link = {"artifactID": item["id"], "name": name, "bytes": len(data), "SHA256": digest(data)}
        archive_links.append(link)
        out.append((label, data, link))
    return out


def aggregate_receipt(result):
    """Keep persisted, printed and returned aggregate status consistent within the reserve."""
    data = encode(result)
    if len(data) > 65536:
        result = {"format": result["format"], "status": "COMPARISON_INCOMPLETE",
                  "nativeQualification": False, "featureQualification": False,
                  "observations": [], "error": "Aggregate receipt exceeded64KiB"}
        data = encode(result)
    return result, data


def aggregate(args):
    global DEADLINE
    began = time.monotonic()
    DEADLINE = began + 180
    control = Path(args.control).resolve(strict=True)
    initial_control, pins = controls(control), read_pins(control)
    temporary = Path(os.environ["RUNNER_TEMP"]).resolve(strict=True)
    output = Path(args.output)
    if output.parent.resolve(strict=True) != temporary or output.exists() or output.is_symlink():
        raise RuntimeError("Use fresh direct temporary aggregation path")
    floor(control, temporary)
    output.mkdir(mode=0o700)
    summary = output / "comparison-summary.json"
    fd = os.open(summary, os.O_RDWR | os.O_CREAT | os.O_EXCL, 0o600)
    os.write(fd, b" " * 65536)
    os.fsync(fd)
    identity = os.fstat(fd)
    run_id, attempt = int(os.environ["GITHUB_RUN_ID"]), int(os.environ["GITHUB_RUN_ATTEMPT"])
    observations, archive_links = [], []
    result = {"format": "world-appearance-memory-comparison.v1", "status": "COMPARISON_INCOMPLETE",
              "nativeQualification": False, "featureQualification": False,
              "controlHead": initial_control["head"], "controlTree": initial_control["tree"],
              "runID": run_id, "runAttempt": attempt, "artifacts": archive_links, "observations": observations}
    try:
        artifacts = download_artifacts(initial_control["head"], run_id, attempt, output, archive_links)
        for label, data, link in artifacts:
            floor(control, output)
            values = read_archive(data)
            observations.append(verify_observation(values, label, pins, initial_control, run_id, attempt))
        if controls(control) != initial_control:
            raise RuntimeError("Aggregation control source changed")
        # Compare semantic content, never filesystem metadata across fresh VMs.
        complete = all(r["sourceIntegrityComplete"] for r in observations)
        if complete:
            for scope in ("root", "authoring"):
                left, right = [r["before"]["dependencies"][scope] for r in observations]
                if any(left[k] != right[k] for k in ("entries", "bytes", "contentSHA256", "packageLockSHA256")):
                    raise RuntimeError("Installed dependency content differs across comparison VMs")
            if observations[0]["before"]["node"]["sha256"] != observations[1]["before"]["node"]["sha256"]:
                raise RuntimeError("Node binary differs across comparison VMs")
        result.update(status="COMPARISON_RECORDED" if complete else "COMPARISON_INCOMPLETE",
                      freeBytes=floor(control, output),
                      interpretation="Baseline OOM excludes feature-exclusive failure under these controls, not a retention cause. Baseline success alone does not prove a product regression.")
    except Exception as error:
        result.update(status="COMPARISON_INCOMPLETE", error=type(error).__name__ + ": " + str(error))
    finally:
        # A reserved known FD preserves an incomplete outcome even on guard/audit failure.
        now = os.fstat(fd)
        if (now.st_dev, now.st_ino, now.st_size) != (identity.st_dev, identity.st_ino, identity.st_size):
            os.close(fd)
            raise RuntimeError("Reserved aggregate receipt identity changed")
        result, data = aggregate_receipt(result)
        os.lseek(fd, 0, os.SEEK_SET)
        os.write(fd, data + b" " * (65536 - len(data)))
        os.fsync(fd)
        os.close(fd)
        summary.chmod(0o444)
    print(json.dumps({"status": result["status"], "outcomes": [r["outcome"] for r in observations], "nativeQualification": False}))
    return 0 if result["status"] == "COMPARISON_RECORDED" else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("prepare", "run", "aggregate"))
    parser.add_argument("--control", required=True)
    parser.add_argument("--root")
    parser.add_argument("--trusted")
    parser.add_argument("--output")
    parser.add_argument("--label", choices=("baseline", "feature"))
    args = parser.parse_args()
    if args.mode in ("prepare", "run") and not all((args.root, args.trusted, args.label)):
        parser.error("Fixed target root/trusted/label are required")
    if args.mode in ("run", "aggregate") and not args.output:
        parser.error("Output is required")
    if args.mode == "prepare":
        prepare(args)
        return 0
    return run(args) if args.mode == "run" else aggregate(args)


if __name__ == "__main__":
    raise SystemExit(main())
