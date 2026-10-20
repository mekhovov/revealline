"""One immutable whole115 scalar diagnostic; no memory fix or family qualification."""
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
import sys
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

MIB = 1024 ** 2
FLOOR = 2048 * MIB
FILE = "game/test/fpv-world-appearance-ui.test.mjs"
WORKFLOW = ".github/workflows/world-fixture-memory-scalars.yml"
CONTROLS = (WORKFLOW, "scripts/world-fixture-memory-scalars.py",
            "scripts/world-fixture-memory-scalars-pins.json",
            "scripts/test_world_fixture_memory_scalars.py",
            "docs/verification/world-fixture-memory-scalars.md", "scripts/parse-scalar-observations.py")
PINS_SHA = "e9ad7ff031b16fce16ef878cb9ecf39908b1350627a19f2aab80417ebd684aa6"
DEADLINE = None
PHASES = ("node-version", "initial-source", "pure-controls", "before-source", "world-file", "after-source")
MEMBERS = {"observation.json", "helper-source.json", "scalar-observations.json"}
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
        metadata[name] = {"SHA256": digest(data), "identity": list(identity)}
    return {"head": git(root, "rev-parse", "HEAD").decode().strip(),
            "tree": git(root, "rev-parse", "HEAD^{tree}").decode().strip(),
            "inventory": rows, "metadata": metadata}


def read_pins(control):
    data, _ = ordinary(Path(control) / "scripts/world-fixture-memory-scalars-pins.json")
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
    if path != "repos/mekhovov/revealline" and not path.startswith("repos/mekhovov/revealline/"):
        raise RuntimeError("Unexpected API owner")
    request = urllib.request.Request("https://api.github.com/" + path,
        headers={"Authorization": "Bearer " + os.environ["DIAGNOSTIC_READ_TOKEN"],
                 "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"})
    with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
        return json.loads(bounded(response, 256 * 1024))


def candidate_context(root):
    event = json.loads(ordinary(Path(os.environ["GITHUB_EVENT_PATH"]), MIB)[0])
    pr, repo = event.get("pull_request", {}), event.get("repository", {})
    if (repo.get("id") != 1367404328 or repo.get("full_name") != "mekhovov/revealline" or
            pr.get("head", {}).get("repo", {}).get("id") != repo["id"] or
            pr.get("head", {}).get("ref") != "codex/world-fixture-memory-scalars" or
            pr.get("base", {}).get("ref") != "main" or pr.get("draft") is not True):
        raise RuntimeError("Only the reviewed same-repository new draft route is allowed")
    head = pr.get("head", {}).get("sha", "")
    actual = git(root, "rev-parse", "HEAD").decode().strip()
    if not re.fullmatch("[a-f0-9]{40}", head) or actual != head:
        raise RuntimeError("Checkout must equal the exact immutable event head")
    return {"head": head, "tree": git(root, "rev-parse", "HEAD^{tree}").decode().strip()}


def finite(value, maximum):
    return type(value) in (int, float) and math.isfinite(value) and 0 <= value <= maximum


def verify_terminal(data, stdout, stderr, argv):
    if len(data) != 65536:
        raise RuntimeError("Child terminal must retain exact reserved64KiB")
    row = json.loads(data)
    if (row.get("args") != argv or row.get("started") is not True or
            row.get("subreaper") is not True or not finite(row.get("elapsedSeconds"), 180) or
            type(row.get("peakObservedOwnedRSSBytes")) is not int or
            not 0 <= row["peakObservedOwnedRSSBytes"] <= 2048 * MIB or
            type(row.get("stdoutBytes")) is not int or type(row.get("stderrBytes")) is not int or
            row["stdoutBytes"] != len(stdout) or row["stderrBytes"] != len(stderr) or
            row.get("stdoutSHA256") != digest(stdout) or row.get("stderrSHA256") != digest(stderr)):
        raise RuntimeError("Native terminal argv/resource/raw binding failed")
    return row


def load_parser(root):
    path = Path(root) / "scripts/parse-scalar-observations.py"
    data, _ = ordinary(path)
    if git(root, "rev-parse", "HEAD:scripts/parse-scalar-observations.py").decode().strip() != blob(data):
        raise RuntimeError("Parser differs from immutable controls")
    spec = importlib.util.spec_from_file_location("reviewed_scalar_parser", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # Pure bounded parser only, never application imports.
    return module


def scalar_result(parser, stdout):
    try:
        result = parser.parse_observations(stdout, require_complete=False)
        data = encode(result)
        if len(data) > MIB:
            raise RuntimeError("Parsed scalar artifact exceeded1MiB")
        return result, data
    except Exception as error:
        result = {"status": "scalar-observations-invalid", "error": type(error).__name__ + ": " + str(error),
                  "qualification": "Parsing failure; native outcome remains independent"}
        return result, encode(result)


def diagnostic_pass(native, scalar, source_exact):
    return (native.get("outcome") == "WHOLE_FILE_SUCCESS" and
            scalar.get("status") == "scalar-observations-complete" and source_exact is True)


def final_record(record):
    if len(encode(record)) <= 65536:
        return record
    return {"format": record["format"], "outcome": "FAILED_OR_INCOMPLETE",
            "nativeOutcome": record.get("nativeOutcome"), "scalarStatus": record.get("scalarStatus"),
            "sourceHead": record["sourceHead"], "sourceTree": record["sourceTree"],
            "error": "Reserved observation receipt would overflow", "nativeQualification": False}


def prepare(args):
    control = target = Path(args.root).resolve(strict=True)
    pins, identity = read_pins(control), controls(control)
    wanted = candidate_context(control)
    if git(target, "rev-parse", "HEAD").decode().strip() != wanted["head"] or git(target, "rev-parse", "HEAD^{tree}").decode().strip() != wanted["tree"]:
        raise RuntimeError("Target is not the fixed immutable diagnostic head")
    repository = api("repos/mekhovov/revealline")
    if repository.get("id") != pins["repositoryID"] or repository.get("full_name") != "mekhovov/revealline":
        raise RuntimeError("Repository identity changed")
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


PURE_CODE = """import resource,runpy,signal,sys,types,unittest
resource.setrlimit(resource.RLIMIT_AS,(512*1024**2,512*1024**2))
signal.alarm(45)
values=runpy.run_path(sys.argv[1],run_name='diagnostic_source_controls')
module=types.SimpleNamespace(**values)
suite=unittest.defaultTestLoader.loadTestsFromModule(module)
if suite.countTestCases()!=19: raise SystemExit('Expected complete19 pure controls')
result=unittest.TextTestRunner(stream=sys.stdout,verbosity=1).run(suite)
raise SystemExit(0 if result.wasSuccessful() else 1)
"""


def pure_args(python, root):
    return [python, "-I", "-B", "-c", PURE_CODE,
            str(Path(root) / "scripts/test_world_fixture_memory_scalars.py")]


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
            "scope": "Diagnostic exact whole-file observation only, not any family qualification"}


def run(args):
    control = Path(args.root).resolve(strict=True)
    pins, initial_control = read_pins(control), controls(control)
    wanted = candidate_context(control)
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
    reserve = campaign.output / "observation.json"
    reserve.write_bytes(b" " * guard.TERMINAL_RESERVE)
    info = reserve.lstat()
    campaign.reserved[reserve] = (info.st_dev, info.st_ino, info.st_size)
    record = {"format": "world-appearance-memory-diagnostic.v1", "label": args.label,
              "sourceHead": wanted["head"], "sourceTree": wanted["tree"],
              "scope": "DIAGNOSTIC_ONLY_NO_FEATURE_QUALIFICATION", "control": initial_control,
              "trusted": provenance, "root": str(campaign.root), "node": campaign.node,
              "auditorPath": str(campaign.helper), "guard": pins["guard"],
              "outcome": "FAILED_OR_INCOMPLETE", "nativeOutcome": "NOT_RUN", "scalarStatus": "NOT_PARSED", "before": None, "after": None,
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
        python = str(Path(sys.executable).resolve(strict=True))
        record["python"] = {"path": python, "SHA256": campaign.hash_regular(Path(python))}
        campaign.run("pure-controls", pure_args(python, campaign.root))
        pure_stdout = (campaign.output / "pure-controls/stdout.log").read_text()
        if not re.search(r"^Ran 19 tests in [0-9.]+s\s*$", pure_stdout, re.M) or not pure_stdout.rstrip().endswith("OK"):
            raise RuntimeError("Complete19 pure controls did not report success")
        record["pureControlCases"] = 19
        record["before"] = campaign.source_audit("before")
        campaign.active_phase = "world-file"
        try:
            campaign.run("world-file", native_args(campaign.node, campaign.root))
        except Exception as error:
            record["error"] = type(error).__name__ + ": " + str(error)
        terminal = campaign.output / "world-file/child-terminal.json"
        stdout = ordinary(campaign.output / "world-file/stdout.log")[0]
        stderr = ordinary(campaign.output / "world-file/stderr.log")[0]
        native = {"outcome": "FAILED_OR_INCOMPLETE"}
        if terminal.exists():
            data = ordinary(terminal, 65536)[0]
            record["nativeTerminal"] = json.loads(data)
            record["nativeOutcome"] = "FAILED_OR_INCOMPLETE"
            verify_terminal(data, stdout, stderr, native_args(campaign.node, campaign.root))
            native = classify(record["nativeTerminal"], stdout, stderr, True)
            record["nativeOutcome"] = native["outcome"]
        # Keep failed child facts immutable. Postflight is evidence, never a retry.
        if any(thread.is_alive() for thread in campaign.capture_threads) or campaign.observe(-1):
            raise RuntimeError("Refuse postflight with unconfirmed live child/capture")
        campaign.capacity()
        record["after"] = campaign.source_audit("after")
        before, after = record["before"], record["after"]
        exact = all(before[k] == after[k] for k in ("source", "dependencies", "git", "node"))
        record["sourceIntegrityComplete"] = exact
        scalar, scalar_bytes = scalar_result(load_parser(control), stdout)
        with (campaign.output / "scalar-observations.json").open("xb") as stream:
            stream.write(scalar_bytes)
        record["scalarStatus"] = scalar["status"]
        record["scalarArtifactSHA256"] = digest(scalar_bytes)
        if diagnostic_pass(native, scalar, exact):
            record["outcome"] = "WHOLE_FILE_SUCCESS"
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
                if path.is_symlink():
                    raise RuntimeError("Unexpected evidence symlink")
                if path.is_dir():
                    if path.relative_to(campaign.output).as_posix() not in {*PHASES, "tmp"}:
                        raise RuntimeError("Unexpected evidence directory")
                    continue
                if not stat.S_ISREG(path.lstat().st_mode):
                    raise RuntimeError("Unexpected special evidence entry")
                if path == reserve:
                    continue
                name = path.relative_to(campaign.output).as_posix()
                if name not in MEMBERS:
                    raise RuntimeError("Unexpected evidence member: " + name)
                data, _ = ordinary(path)
                record["evidenceFiles"].append({"path": name, "bytes": len(data), "SHA256": digest(data)})
        except Exception as error:
            record.update(outcome="FAILED_OR_INCOMPLETE", evidenceIndexError=type(error).__name__ + ": " + str(error))
        record = final_record(record)
        campaign.seal_terminal(reserve, record)
    print(json.dumps({"label": args.label, "outcome": record["outcome"], "nativeOutcome": record.get("nativeOutcome"),
                      "scalarStatus": record.get("scalarStatus"),
                      "nativeQualification": False, "receipt": str(reserve)}))
    return 0 if record["outcome"] == "WHOLE_FILE_SUCCESS" else 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("prepare", "run"))
    parser.add_argument("--root", required=True)
    parser.add_argument("--trusted", required=True)
    parser.add_argument("--output")
    args = parser.parse_args()
    args.label = "scalar"
    if args.mode == "run" and not args.output:
        parser.error("--output required")
    return prepare(args) if args.mode == "prepare" else run(args)


if __name__ == "__main__":
    raise SystemExit(main())
