#!/usr/bin/env python3
"""Bound one Linux browser phase and retire only proven owned processes."""
import argparse
import ctypes
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import select
import signal
import stat
import subprocess
import sys
import threading
import time

PHASE_SECONDS = {"matrix": 1800, "additional": 1800, "offline": 600}
LOG_BYTES = 4 * 1024 * 1024
REPORT_BYTES = 16 * 1024 * 1024
ENGINES = ("chromium", "firefox", "webkit")


def expected_jobs(phase):
    if phase == "matrix":
        return (["restoration-" + e for e in ("webkit", "chromium", "firefox")]
                + ["mixed-" + e for e in ENGINES]
                + ["sim-fresh-" + e for e in ENGINES]
                + ["graphics-chromium", "listeners-chromium"])
    if phase == "additional":
        return (["survival-fresh-" + e for e in ENGINES]
                + [clip + "-" + e for e in ENGINES
                   for clip in ("first-signal-right", "hidden-frequency-search")])
    if phase == "offline":
        return ["actual-worker-offline-chromium"]
    raise ValueError("Unknown phase")


def sha(body):
    return hashlib.sha256(body).hexdigest()


def bounded_file(path, maximum):
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(path, flags)
    with os.fdopen(fd, "rb") as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_size > maximum:
            raise ValueError("Expected bounded regular file: " + str(path))
        body = stream.read(maximum + 1)
        if len(body) > maximum:
            raise ValueError("File grew beyond its bound: " + str(path))
        return body


def private_directory_identity(path):
    info = path.lstat()
    assert stat.S_ISDIR(info.st_mode) and not path.is_symlink()
    assert path.resolve(strict=True) == path
    assert info.st_uid == os.getuid() and stat.S_IMODE(info.st_mode) == 0o700
    return info.st_dev, info.st_ino, info.st_uid


def process_row(pid):
    """The raw argv digest is identity; the printable prefix is diagnostics only."""
    directory = Path("/proc") / str(pid)
    try:
        first = (directory / "stat").read_bytes()
        fields = first[first.rfind(b")") + 2:].split()
        status = (directory / "status").read_bytes()
        uid = int(re.search(rb"^Uid:\s+(\d+)", status, re.M).group(1))
        argv = bounded_file(directory / "cmdline", 1024 * 1024)
        second = (directory / "stat").read_bytes()
        later = second[second.rfind(b")") + 2:].split()
        if fields[19] != later[19]:
            return None
        return {"pid": int(pid), "ppid": int(later[1]), "state": later[0].decode(),
                "startTicks": int(later[19]), "uid": uid, "argvSHA256": sha(argv),
                "argv": argv.replace(b"\0", b" ").decode("utf-8", "replace")[:2048]}
    except (FileNotFoundError, ProcessLookupError, PermissionError):
        return None


def process_snapshot():
    result = {}
    entries = list(Path("/proc").iterdir())
    if len(entries) > 32768:
        raise RuntimeError("Process snapshot entry bound exceeded")
    for directory in entries:
        if directory.name.isdecimal():
            row = process_row(int(directory.name))
            if row is not None:
                result[row["pid"]] = row
    return result


def process_identity(row):
    return row["pid"], row["startTicks"], row["uid"], row["argvSHA256"]


def enable_subreaper():
    if sys.platform != "linux":
        raise RuntimeError("This supervisor requires Linux /proc and pidfds")
    if not hasattr(os, "pidfd_open") or not hasattr(signal, "pidfd_send_signal"):
        raise RuntimeError("Python/kernel pidfd support is required; no PID-only fallback")
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(36, 1, 0, 0, 0) != 0:  # PR_SET_CHILD_SUBREAPER
        raise OSError(ctypes.get_errno(), "Cannot establish child subreaper")


class LinuxProcessOwner:
    """A subreaper catches fast orphans; pidfds prevent signalling reused PIDs."""
    def __init__(self, baseline):
        self.baseline = {process_identity(row)[:3] for row in baseline.values()}
        self.child = None
        self.known = {}
        self.observed = []
        self.actions = []
        self.transitions = []
        self.root_seen = False

    def attach(self, child):
        self.child = child
        self.capture()

    @staticmethod
    def alive(fd):
        poller = select.poll()
        poller.register(fd, select.POLLIN)
        return not poller.poll(0)

    def capture(self, enforce_limits=True):
        self.child.poll()  # Popen alone reaps the root and retains its real exit code.
        current = process_snapshot()
        for pid, item in list(self.known.items()):
            row = current.get(pid)
            if row is None or not self.alive(item["fd"]):
                if (row and row["state"] == "Z" and row["ppid"] == os.getpid()
                        and pid != self.child.pid and process_identity(row)[:3] == item["key"][:3]):
                    try:
                        os.waitpid(pid, os.WNOHANG)  # Only a registered adopted descendant.
                    except ChildProcessError:
                        pass
                os.close(item["fd"])
                del self.known[pid]
                continue
            if process_identity(row)[:3] != item["key"][:3]:
                raise RuntimeError("Owned pidfd and /proc identity disagree")
            if process_identity(row) != item["key"]:
                # exec/setproctitle preserves the pidfd's kernel process identity.
                self.transitions.append({"before": list(item["key"]), "after": list(process_identity(row))})
                item["key"] = process_identity(row)
            item["row"] = row
        changed = True
        while changed:
            changed = False
            for pid, row in current.items():
                base = process_identity(row)[:3]
                if pid in self.known or base in self.baseline:
                    continue
                if pid == self.child.pid and self.child.poll() is not None:
                    continue  # Never attach a reused numeric PID after the managed root exits.
                relation = ("spawned root" if pid == self.child.pid else
                            "observed descendant" if row["ppid"] in self.known else
                            "adopted by this dedicated subreaper" if row["ppid"] == os.getpid() else None)
                if relation is None:
                    continue
                if row["state"] == "Z":
                    if pid != self.child.pid and row["ppid"] == os.getpid():
                        try:
                            os.waitpid(pid, os.WNOHANG)
                        except ChildProcessError:
                            pass
                    continue
                try:
                    fd = os.pidfd_open(pid, 0)
                    again = process_row(pid)
                except ProcessLookupError:
                    continue
                if (again is None or process_identity(again) != process_identity(row)
                        or not self.alive(fd)
                        or (pid == self.child.pid and self.child.poll() is not None)):
                    os.close(fd)
                    continue
                self.known[pid] = {"fd": fd, "key": process_identity(row), "row": row}
                self.observed.append({**row, "ownership": relation})
                self.root_seen |= pid == self.child.pid
                changed = True
        if enforce_limits and (len(self.observed) > 256 or len(self.actions) > 1024 or len(self.transitions) > 1024):
            raise RuntimeError("Owned-process observation/action bound exceeded")
        return [item["row"] for item in self.known.values()]

    def send(self, row, signum):
        item = self.known.get(row["pid"])
        actual = process_row(row["pid"])
        if item is None or actual is None or process_identity(actual) != process_identity(row) or item["key"] != process_identity(row):
            return False
        if not self.alive(item["fd"]):
            return False
        action = {"identity": list(process_identity(row)), "signal": signal.Signals(signum).name}
        try:
            signal.pidfd_send_signal(item["fd"], signum)
            action["sent"] = True
        except ProcessLookupError:
            action["sent"] = False
        self.actions.append(action)
        return action["sent"]

    def wait_clear(self, seconds, enforce_limits=True):
        deadline = time.monotonic() + seconds
        while True:
            remaining = self.capture(enforce_limits=enforce_limits)
            if not remaining or time.monotonic() >= deadline:
                return remaining
            time.sleep(.05)

    def cleanup(self, grace=8, term=3, kill=3):
        # A diagnostic overflow fails qualification, but must not disable owned cleanup.
        rows = self.capture(enforce_limits=False)
        root = next((row for row in rows if row["pid"] == self.child.pid), None)
        if root:
            self.send(root, signal.SIGTERM)
            rows = self.wait_clear(grace, enforce_limits=False)
        if rows:
            for row in rows:
                self.send(row, signal.SIGTERM)
            rows = self.wait_clear(term, enforce_limits=False)
        deadline = time.monotonic() + kill
        while rows and time.monotonic() < deadline:
            for row in rows:
                self.send(row, signal.SIGKILL)
            rows = self.wait_clear(min(.2, max(0, deadline - time.monotonic())), enforce_limits=False)
        return rows

    def evidence(self, remaining):
        return {"verified": self.root_seen and remaining == [], "rootObserved": self.root_seen,
                "method": "Linux /proc startTicks/UID/full raw argv SHA256; pidfd signals; dedicated subreaper",
                "observed": self.observed[:256], "actions": self.actions[:1024],
                "identityTransitions": self.transitions[:1024], "remaining": remaining,
                "boundsExceeded": len(self.observed) > 256 or len(self.actions) > 1024 or len(self.transitions) > 1024}


class BoundedLog:
    def __init__(self, path, limit=LOG_BYTES):
        self.output = path.open("xb")
        self.limit = limit
        self.total = 0
        self.written = 0
        self.digest = hashlib.sha256()
        self.error = None
        self.complete = False
        self.thread = None

    def start(self, pipe):
        def drain():
            try:
                while True:
                    body = pipe.read1(65536)
                    if not body:
                        break
                    self.total += len(body)
                    kept = body[:max(0, self.limit - self.written)]
                    if kept and self.error is None:
                        try:
                            self.output.write(kept)
                            self.digest.update(kept)
                            self.written += len(kept)
                        except OSError as error:
                            self.error = repr(error)
            except BaseException as error:
                self.error = repr(error)
            finally:
                self.output.close()
                pipe.close()
                self.complete = True
        self.thread = threading.Thread(target=drain, daemon=True)
        self.thread.start()

    def check(self):
        if self.error or self.total > self.limit:
            raise RuntimeError("Bounded log failed: " + str(self.error or "overflow"))

    def finish(self):
        if self.thread:
            self.thread.join(timeout=3)
            if self.thread.is_alive():
                self.error = self.error or "Log did not close within3seconds"
        else:
            self.output.close()
        return {"complete": self.complete, "error": self.error, "limitBytes": self.limit,
                "totalBytes": self.total, "writtenBytes": self.written,
                "overflow": self.total > self.limit, "sha256": self.digest.hexdigest()}


class Cancellation:
    def __init__(self, report):
        self.report = report
        self.registering = False
        self.finalizing = False
        self.pending = None

    def handle(self, signum, _frame):
        self.report.setdefault("interruptedSignal", signal.Signals(signum).name)
        self.report["complete"] = False
        if self.registering:
            self.pending = signum
        elif not self.finalizing:
            raise InterruptedError(self.report["interruptedSignal"])

    def registered(self):
        self.registering = False
        if self.pending is not None:
            self.pending = None
            raise InterruptedError(self.report["interruptedSignal"])


def supervise(command, log_path, *, seconds, env=None, storage_check=lambda: None,
              validate=lambda: {}, spawn=subprocess.Popen, cleanup_seconds=(8, 3, 3)):
    """One dedicated process; test seams never weaken the CLI's fixed bounds."""
    enable_subreaper()
    baseline = process_snapshot()
    report = {"format": "SharedDemoHostedBrowserSupervisionV1", "complete": False,
              "started": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "command": command, "timeoutSeconds": seconds, "cleanupSeconds": sum(cleanup_seconds)}
    cancellation = Cancellation(report)
    previous = {s: signal.getsignal(s) for s in (signal.SIGINT, signal.SIGTERM)}
    for s in previous:
        signal.signal(s, cancellation.handle)
    owner = LinuxProcessOwner(baseline)
    child = None
    remaining = None
    log = BoundedLog(log_path)
    start = time.monotonic()
    try:
        storage_check()
        cancellation.registering = True
        try:
            child = spawn(command, env=env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT, start_new_session=True)
            owner.attach(child)
            log.start(child.stdout)
        finally:
            cancellation.registered()
        next_storage = 0
        while child.poll() is None:
            owner.capture()
            log.check()
            if time.monotonic() - start >= seconds:
                report["watchdogExpired"] = True
                raise TimeoutError("Browser phase exceeded its whole-child limit")
            if time.monotonic() >= next_storage:
                storage_check()
                next_storage = time.monotonic() + 1
            time.sleep(.05)
        report["childElapsedSeconds"] = time.monotonic() - start
        if report["childElapsedSeconds"] >= seconds:
            report["watchdogExpired"] = True
            raise TimeoutError("Child exited after its whole-child limit")
        remaining = owner.wait_clear(1)
        if remaining:
            report["cleanupNeededAfterChildExit"] = True
            remaining = owner.cleanup(*cleanup_seconds)
    except BaseException as error:
        report["failure"] = repr(error)[:12000]
    finally:
        cancellation.finalizing = True
        if child is not None:
            if remaining is None:
                try:
                    remaining = owner.cleanup(*cleanup_seconds)
                except BaseException as error:
                    report["cleanupFailure"] = repr(error)[:6000]
            report["ownedProcesses"] = owner.evidence(remaining)
        report["childExit"] = child.poll() if child else None
        report["log"] = log.finish()
        try:
            storage_check()
            report["validation"] = validate()
        except BaseException as error:
            report["validationFailure"] = repr(error)[:6000]
        report["elapsedSeconds"] = time.monotonic() - start
        report["finished"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        log_ok = report["log"]["complete"] and not report["log"]["error"] and not report["log"]["overflow"]
        failures = ("failure", "cleanupFailure", "cleanupNeededAfterChildExit", "interruptedSignal", "watchdogExpired", "validationFailure")
        report["complete"] = (report["childExit"] == 0 and log_ok
                              and report.get("ownedProcesses", {}).get("verified") is True
                              and not report["ownedProcesses"]["boundsExceeded"]
                              and report["elapsedSeconds"] < seconds + 30
                              and not any(report.get(k) for k in failures))
        # Keep the final cancellation handler installed through the caller's receipt write.
    return report, cancellation, previous


def validate_aggregate(path, phase, head, base, fingerprint):
    body = bounded_file(path, REPORT_BYTES)
    result = json.loads(body)
    expected = expected_jobs(phase)
    assert result.get("format") == "SharedDemoHostedBrowserV1"
    assert result.get("complete") is True and result.get("bindingsStable") is True
    assert result.get("head") == head and result.get("base") == base
    assert result.get("phase") == phase and result.get("expectedRuntime") == fingerprint
    assert result.get("selected") == expected
    assert [row.get("id") for row in result.get("jobs", [])] == expected
    assert result.get("before") and result["before"] == result.get("after")
    assert result["before"]["head"] == head
    assert result["before"]["source"]["runtime"]["sha256"] == fingerprint
    assert result.get("toolingBefore") and result["toolingBefore"] == result.get("toolingAfter")
    for key in ("failure", "bindingFailure", "interruptedSignal", "error"):
        assert not result.get(key), key
    for row in result["jobs"]:
        assert row.get("complete") is True and row.get("finished")
        assert row.get("exit") == {"code": 0, "signal": None}
        if row.get("provider"):
            assert row["provider"].get("closeCompleted") is True
        child_path = Path(row["reportPath"])
        assert not child_path.is_absolute() and ".." not in child_path.parts
        assert child_path.parts[0] == ".cache"
        child = bounded_file(child_path, REPORT_BYTES)
        assert sha(child) == row.get("reportSHA256")
        assert json.loads(child).get("complete") is True
    return {"aggregateSHA256": sha(body), "bytes": len(body), "jobs": expected, "bindingsStable": True}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("node", "runtime", "head", "base", "fingerprint", "emitted-preview", "report"):
        parser.add_argument("--" + name, required=True)
    parser.add_argument("--phase", required=True, choices=PHASE_SECONDS)
    args = parser.parse_args(argv)
    if sys.platform != "linux":
        parser.error("Actual qualification requires Linux; macOS does not receive Linux credit")
    for value in (args.head, args.base):
        assert re.fullmatch(r"[a-f0-9]{40}", value)
    assert re.fullmatch(r"[a-f0-9]{64}", args.fingerprint)
    root = Path.cwd().resolve()
    assert root == Path(__file__).resolve().parent.parent
    node, runtime = Path(args.node), Path(args.runtime)
    assert node.is_absolute() and runtime.is_absolute()
    node, runtime = node.resolve(strict=True), runtime.resolve(strict=True)
    assert node.is_file() and runtime.is_file()
    capture = Path(os.path.abspath(args.emitted_preview))
    capture.relative_to(root)
    assert capture.resolve(strict=True) == capture and capture.is_dir()
    report_path = Path(os.path.abspath(args.report))
    report_path.relative_to(root / ".cache")
    assert report_path.suffix == ".json" and report_path.parent.resolve(strict=True) == report_path.parent
    supervision = report_path.with_suffix(".supervision.json")
    log_path = report_path.with_suffix(".log")
    for path in (report_path, supervision, log_path):
        assert not path.exists() and not path.is_symlink(), "Refusing prior evidence: " + str(path)
    tmp = Path(os.environ["TMPDIR"])
    assert tmp.is_absolute() and tmp.resolve(strict=True) == tmp and tmp.is_dir()
    tmp_identity = private_directory_identity(tmp)

    def storage_check():
        assert private_directory_identity(tmp) == tmp_identity
        for path, minimum in ((root, 200 * 1024**2), (tmp, 512 * 1024**2)):
            value = os.statvfs(path)
            assert value.f_bavail * value.f_frsize >= minimum, "Storage floor reached: " + str(path)

    paths = (Path(__file__).resolve(), root / "scripts/qualify-shared-demo-hosted-browser.mjs", node, runtime,
             capture / "manifest.json", root / "docs/qualification/shared-demos/source-freeze-latest.json")
    before = {str(path): sha(bounded_file(path, 256 * 1024**2)) for path in paths}

    def validate():
        assert before == {str(path): sha(bounded_file(path, 256 * 1024**2)) for path in paths}
        return validate_aggregate(report_path, args.phase, args.head, args.base, args.fingerprint)

    command = [str(node), "scripts/qualify-shared-demo-hosted-browser.mjs"]
    command += ["--" + key + "=" + str(value) for key, value in vars(args).items() if key != "node"]
    command = [item.replace("--emitted_preview=", "--emitted-preview=") for item in command]
    environment = {**os.environ, "SHARED_DEMO_HOSTED_SUPERVISED": "1", "GIT_NO_LAZY_FETCH": "1",
                   "GIT_OPTIONAL_LOCKS": "0", "NODE_DISABLE_COMPILE_CACHE": "1"}
    result, cancellation, previous = supervise(command, log_path, seconds=PHASE_SECONDS[args.phase],
                                                env=environment, storage_check=storage_check, validate=validate)
    result.update({"phase": args.phase, "head": args.head, "base": args.base,
                   "runtimeFingerprint": args.fingerprint, "inputPins": before,
                   "limitations": ["Synchronous filesystem reads may delay polling; final elapsed checks reject results outside the phase budget plus30seconds.",
                                   "Only this dedicated Linux process tree is owned. No process-group/name-wide signals or other job cancellation."]})
    try:
        with supervision.open("x") as output:
            json.dump(result, output, indent=2)
            output.write("\n")
        if cancellation.report.get("interruptedSignal"):
            result["complete"] = False
            supervision.write_text(json.dumps(result, indent=2) + "\n")
    finally:
        for signum, handler in previous.items():
            signal.signal(signum, handler)
    print(json.dumps({"report": str(supervision.relative_to(root)), "complete": result["complete"]}))
    return 0 if result["complete"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
