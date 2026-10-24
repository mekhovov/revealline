"""Fixed Linux hosted authoring campaign. No arbitrary command or guard overrides."""
import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import stat
import subprocess
import sys
import threading
import time

MIB = 1024 * 1024
FLOOR = 2048 * MIB
RSS_LIMIT = 2048 * MIB
WALL_LIMIT = 180
STREAM_LIMIT = 4 * MIB
CAMPAIGN_LOG_LIMIT = 32 * MIB
PROJECTION_LIMIT = 4 * MIB
TERMINAL_RESERVE = 65536
CAMPAIGN_WALL = 45 * 60
AUDIT_OID = "56ad477033516d565fbb7f85cea70d0430ceae1c"
AUDIT_SHA256 = "a6124736ce13aec52fb26d818e6c2aa6ce83965ccaf92b94c783043d1d150fc4"
TARGETS = ("cultural", "expedition", "hunt")
FACTORIES = {
    "cultural": "game/content-design/team-cultural-specialist-v2-originals.mjs",
    "expedition": "game/content-design/multiplayer-expansion.mjs",
    "hunt": "game/content-design/team-hunt-training-candidates.mjs",
}


def stable_stat(value):
    return tuple(getattr(value, key) for key in ("st_dev", "st_ino", "st_mode", "st_size", "st_mtime_ns", "st_ctime_ns"))


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()


def controlled_environment(inherited, temporary):
    # HOME is preserved if present, never repurposed. No tokens/Git namespace/cache flags.
    env = {key: inherited[key] for key in ("PATH", "HOME", "LANG", "LC_ALL", "TZ") if key in inherited}
    env.update({"CI": "true", "TMPDIR": str(temporary), "NODE_OPTIONS": "--max-old-space-size=1536",
                "GIT_NO_LAZY_FETCH": "1", "GIT_OPTIONAL_LOCKS": "0", "GIT_TERMINAL_PROMPT": "0",
                "PYTHONDONTWRITEBYTECODE": "1"})
    return env


def fixed_phases(node, root, projections):
    tool = str(root / "scripts/remote-team-navigation.mjs")
    phases = []
    for operation in ("produce", "check"):
        for target in TARGETS:
            phases.append((f"{operation}-{target}", [node, tool, operation, target, str(projections / f"{target}.json")], None))
    for target, expected in (("contract", 2), ("cultural", 1), ("expedition", 1), ("hunt", 1)):
        filename = "test-remote-team-navigation.mjs" if target == "contract" else f"remote-team-navigation-{target}.check.mjs"
        phases.append((f"test-{target}", [node, "--test", "--test-concurrency=1",
                       str(root / "scripts" / filename)], expected))
    return phases


def require_complete_tap(text, expected):
    counts = {}
    for key in ("tests", "pass", "fail", "cancelled", "skipped", "todo"):
        found = re.findall(rf"^# {key} (\d+)\s*$", text, re.MULTILINE)
        if len(found) != 1:
            raise RuntimeError(f"Missing or ambiguous complete TAP count: {key}")
        counts[key] = int(found[0])
    if counts != {"tests": expected, "pass": expected, "fail": 0, "cancelled": 0, "skipped": 0, "todo": 0}:
        raise RuntimeError(f"Incomplete authored target file: {counts}")
    return counts


def require_frozen_projection(expected, observed):
    if expected != observed:
        raise RuntimeError("A check/test rewrote the frozen projection")


def require_preexisting_projection(expected, observed):
    names = {record["path"] for record in expected}
    require_frozen_projection(expected, [record for record in observed if record["path"] in names])


def parse_proc_stat(text):
    # /proc stat comm may contain spaces or closing parentheses; fields follow the last ).
    end = text.rfind(")")
    first = text[:text.find(" ")]
    rest = text[end + 2:].split()
    if end < 0 or len(rest) < 22:
        raise RuntimeError("Malformed process observation")
    return {"pid": int(first), "state": rest[0], "ppid": int(rest[1]), "pgid": int(rest[2]),
            "start": int(rest[19]), "rss": max(0, int(rest[21])) * os.sysconf("SC_PAGE_SIZE")}


def process_snapshot():
    rows = {}
    with os.scandir("/proc") as entries:
        for entry in entries:
            if not entry.name.isdigit():
                continue
            try:
                row = parse_proc_stat(Path(entry.path, "stat").read_text())
                rows[row["pid"]] = row
            except (FileNotFoundError, ProcessLookupError):
                continue
    return rows


def owned_processes(snapshot, known, primary, owner_pid):
    # Linux subreaper owns escaped/reparented descendants, including after Node exits.
    for row in snapshot.values():
        if row["ppid"] == owner_pid:
            known[row["pid"]] = row["start"]
    changed = True
    while changed:
        changed = False
        for row in snapshot.values():
            parent = snapshot.get(row["ppid"])
            if (parent and known.get(parent["pid"]) == parent["start"] and known.get(row["pid"]) != row["start"]):
                known[row["pid"]] = row["start"]
                changed = True
    return [row for row in snapshot.values() if known.get(row["pid"]) == row["start"]]


def enable_subreaper():
    if sys.platform != "linux" or ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) != 0:
        raise RuntimeError("This hosted guard requires Linux child-subreaper ownership")


class Campaign:
    def __init__(self, root, output, source_sha, source_tree, helper):
        self.root = Path(root).resolve(strict=True)
        self.output = Path(output)
        self.source_sha, self.source_tree = source_sha, source_tree
        self.helper = Path(helper).resolve(strict=True)
        self.node = str(Path(shutil.which("node") or "").resolve(strict=True))
        self.known_children = {}
        self.log_bytes = 0
        self.log_lock = threading.Lock()
        self.reserved = {}
        self.results = []
        self.capture_threads = []
        self.active_phase = None
        self.baseline_source = None
        self.baseline_dependencies = None
        self.baseline_git = None
        self.baseline_node = None
        self.start = time.monotonic()

    def capacity(self):
        if time.monotonic() - self.start > CAMPAIGN_WALL:
            raise RuntimeError("Campaign protective wall exceeded 45 minutes")
        free = min(shutil.disk_usage(self.root).free, shutil.disk_usage(self.output).free)
        if free <= FLOOR:
            raise RuntimeError(f"Capacity guard: {free} bytes <= 2 GiB")
        return free

    def budgeted_scan_tick(self, started):
        if time.monotonic() - started > WALL_LIMIT:
            raise RuntimeError("Read-only audit exceeded 180 seconds")
        self.capacity()

    def hash_regular(self, path):
        before = path.lstat()
        if not stat.S_ISREG(before.st_mode):
            raise RuntimeError(f"Expected ordinary file: {path}")
        descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        try:
            if stable_stat(os.fstat(descriptor)) != stable_stat(before):
                raise RuntimeError(f"File identity changed before read: {path}")
            digest = hashlib.sha256()
            while True:
                chunk = os.read(descriptor, 65536)
                if not chunk:
                    break
                digest.update(chunk)
            after = os.fstat(descriptor)
        finally:
            os.close(descriptor)
        if stable_stat(before) != stable_stat(after) or stable_stat(path.lstat()) != stable_stat(before):
            raise RuntimeError(f"File changed while read: {path}")
        return digest.hexdigest()

    def git(self, *args, allow_empty=False):
        result = subprocess.run(["git", "--no-replace-objects", "-C", str(self.root), *args],
                                env=self.env, capture_output=True, timeout=15)
        if (result.returncode not in ((0, 1) if allow_empty else (0,)) or result.stderr or
                len(result.stdout) > 4 * MIB or (result.returncode == 1 and result.stdout)):
            raise RuntimeError("Bounded read-only Git identity command failed")
        return result.stdout

    def git_identity(self):
        head = self.git("rev-parse", "--verify", "HEAD").decode().strip()
        tree = self.git("rev-parse", "HEAD^{tree}").decode().strip()
        if head != self.source_sha or tree != self.source_tree:
            raise RuntimeError("Checkout does not match immutable approved source head/tree")
        identity = {"head": head, "tree": tree, "refsSHA256": sha256(self.git("show-ref", "--head", allow_empty=True))}
        for label, name in (("index", "index"), ("headFile", "HEAD"), ("config", "config")):
            path = Path(self.git("rev-parse", "--git-path", name).decode().strip())
            path = path if path.is_absolute() else self.root / path
            st = path.lstat()
            identity[label] = {"sha256": self.hash_regular(path), "dev": st.st_dev, "ino": st.st_ino,
                               "mode": st.st_mode, "bytes": st.st_size, "mtimeNS": st.st_mtime_ns, "ctimeNS": st.st_ctime_ns}
        return identity

    def dependency_identity(self):
        start = time.monotonic()
        root = self.root / "node_modules"
        info = root.lstat()
        if not stat.S_ISDIR(info.st_mode) or root.is_symlink():
            raise RuntimeError("Use an ordinary installed dependency root")
        content, metadata = hashlib.sha256(), hashlib.sha256()
        count, total = 0, 0
        observations = {root: stable_stat(info)}
        metadata.update(json_bytes([".", *stable_stat(info)]))
        for directory, dirs, files in os.walk(root, followlinks=False):
            dirs.sort()
            for name in sorted(dirs + files):
                path = Path(directory, name)
                relative = path.relative_to(root).as_posix()
                before = path.lstat()
                mode = stat.S_IMODE(before.st_mode)
                if stat.S_ISLNK(before.st_mode):
                    target = os.readlink(path)
                    resolved = path.resolve(strict=True)
                    if not resolved.is_relative_to(root):
                        raise RuntimeError("Installed dependency symlink escapes its root")
                    record = [relative, "link", mode, target]
                elif stat.S_ISDIR(before.st_mode):
                    record = [relative, "directory", mode]
                elif stat.S_ISREG(before.st_mode):
                    record = [relative, "file", mode, self.hash_regular(path)]
                    total += before.st_size
                else:
                    raise RuntimeError("Special installed dependency entry")
                if stable_stat(path.lstat()) != stable_stat(before):
                    raise RuntimeError("Dependency entry changed during inventory")
                content.update(json_bytes(record))
                metadata.update(json_bytes([relative, before.st_dev, before.st_ino, before.st_mode,
                                            before.st_size, before.st_mtime_ns, before.st_ctime_ns]))
                observations[path] = stable_stat(before)
                count += 1
                if count % 128 == 0:
                    self.budgeted_scan_tick(start)
        for index, (path, observed) in enumerate(observations.items()):
            if stable_stat(path.lstat()) != observed:
                raise RuntimeError("Dependency metadata changed during complete inventory")
            if index % 128 == 0:
                self.budgeted_scan_tick(start)
        self.budgeted_scan_tick(start)
        return {"entries": count, "bytes": total, "contentSHA256": content.hexdigest(),
                "metadataSHA256": metadata.hexdigest(), "rootDev": info.st_dev, "rootIno": info.st_ino,
                "packageLockSHA256": self.hash_regular(self.root / "package-lock.json")}

    def node_identity(self):
        st = Path(self.node).lstat()
        return {"path": self.node, "sha256": self.hash_regular(Path(self.node)), "dev": st.st_dev,
                "ino": st.st_ino, "mode": st.st_mode, "bytes": st.st_size}

    def reserve_terminal(self, stage):
        path = stage / "child-terminal.json"
        with path.open("xb") as stream:
            stream.write(b" " * TERMINAL_RESERVE)
            stream.flush()
            os.fsync(stream.fileno())
        st = path.lstat()
        self.reserved[path] = (st.st_dev, st.st_ino, st.st_size)
        return path

    def seal_terminal(self, path, receipt):
        data = json_bytes(receipt)
        if len(data) > TERMINAL_RESERVE:
            raise RuntimeError("Child-terminal receipt exceeds reserved bound")
        st = path.lstat()
        if (st.st_dev, st.st_ino, st.st_size) != self.reserved[path] or not (st.st_mode & 0o222):
            raise RuntimeError("Terminal reserve changed or already sealed")
        fd = os.open(path, os.O_RDWR | os.O_NOFOLLOW)
        try:
            if stable_stat(os.fstat(fd)) != stable_stat(st):
                raise RuntimeError("Terminal reserve inode changed")
            with os.fdopen(fd, "r+b", closefd=False) as stream:
                stream.write(data + b" " * (TERMINAL_RESERVE - len(data)))
                stream.flush()
                os.fsync(fd)
        finally:
            os.close(fd)
        path.chmod(0o444)
        return self.hash_regular(path)

    def observe(self, primary):
        return owned_processes(process_snapshot(), self.known_children, primary, os.getpid())

    def stop_owned(self, primary, group):
        for signum in (signal.SIGTERM, signal.SIGKILL):
            rows = self.observe(primary)
            # A known live identity must still own the group before group signalling.
            current_group = process_snapshot()
            if any(current_group.get(row["pid"], {}).get("start") == row["start"] and
                   current_group[row["pid"]]["pgid"] == group and current_group[row["pid"]]["state"] != "Z"
                   for row in rows):
                try:
                    os.killpg(group, signum)
                except ProcessLookupError:
                    pass
            for row in rows:
                current = process_snapshot().get(row["pid"])
                if current and current["start"] == row["start"] and current["state"] != "Z":
                    try:
                        os.kill(row["pid"], signum)
                    except ProcessLookupError:
                        pass
            deadline = time.monotonic() + 2
            while time.monotonic() < deadline:
                if not any(row["state"] != "Z" for row in self.observe(primary)):
                    break
                time.sleep(0.05)

    def reap_adopted(self):
        while True:
            try:
                pid, _ = os.waitpid(-1, os.WNOHANG)
            except ChildProcessError:
                return
            if not pid:
                return

    def run(self, label, args):
        stage = self.output / label
        stage.mkdir()
        terminal = self.reserve_terminal(stage)
        streams = [stage / "stdout.log", stage / "stderr.log"]
        files = [path.open("xb") for path in streams]
        hashes, counts = [hashlib.sha256(), hashlib.sha256()], [0, 0]
        overflow = threading.Event()
        capture_errors = []
        threads, process = [], None
        started = time.monotonic()
        guard, peak, code, remaining = None, 0, None, None
        sealed = False
        try:
            # Fresh capacity immediately before Popen, after log/reserve/audit setup.
            self.capacity()
            process = subprocess.Popen(args, cwd=self.root, env=self.env, stdin=subprocess.DEVNULL,
                                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
            primary = process.pid
            initial = process_snapshot().get(primary)
            if initial is None:
                raise RuntimeError("Cannot establish primary process birth identity")
            self.known_children[primary] = initial["start"]

            def capture(source, index):
                try:
                    while True:
                        chunk = source.read(65536)
                        if not chunk:
                            break
                        with self.log_lock:
                            allowed = min(len(chunk), max(0, STREAM_LIMIT - counts[index]),
                                          max(0, CAMPAIGN_LOG_LIMIT - self.log_bytes))
                            if allowed:
                                files[index].write(chunk[:allowed])
                                files[index].flush()
                                hashes[index].update(chunk[:allowed])
                                counts[index] += allowed
                                self.log_bytes += allowed
                            if allowed != len(chunk):
                                overflow.set()
                except Exception as error:
                    capture_errors.append(type(error).__name__)
                    overflow.set()
                finally:
                    source.close()

            threads = [threading.Thread(target=capture, args=(process.stdout, 0), daemon=True),
                       threading.Thread(target=capture, args=(process.stderr, 1), daemon=True)]
            self.capture_threads.extend(threads)
            for thread in threads:
                thread.start()
            while process.poll() is None:
                rows = self.observe(primary)
                rss = sum(row["rss"] for row in rows)
                peak = max(peak, rss)
                if rss > RSS_LIMIT:
                    guard = "own-descendant-RSS-2048MiB"
                elif time.monotonic() - started > WALL_LIMIT:
                    guard = "wall-180s"
                elif overflow.is_set():
                    guard = "output-overflow-or-capture-error"
                else:
                    try:
                        self.capacity()
                    except RuntimeError:
                        guard = "capacity-or-campaign-wall"
                if guard:
                    self.stop_owned(primary, primary)
                    break
                time.sleep(0.05)
            code = process.wait(timeout=3)
            # Escaped/live descendants or inherited open pipes fail closed, never extend a test.
            rows = self.observe(primary)
            if any(row["state"] != "Z" for row in rows):
                guard = guard or "descendant-outlived-command"
                self.stop_owned(primary, primary)
            for thread in threads:
                thread.join(timeout=3)
                if thread.is_alive():
                    guard = guard or "capture-thread-not-terminal"
                    self.stop_owned(primary, primary)
                    thread.join(timeout=3)
            self.reap_adopted()
            remaining = self.observe(primary)
            if remaining:
                guard = guard or "unconfirmed-descendant-termination"
            if overflow.is_set() or capture_errors:
                guard = guard or "terminal-output-overflow-or-capture-error"
            # Child fact is persisted BEFORE full postflight; final capacity may still fail.
            receipt = {"label": label, "args": args, "started": True, "exitCode": code,
                       "guard": guard, "elapsedSeconds": round(time.monotonic() - started, 6),
                       "peakObservedOwnedRSSBytes": peak, "stdoutBytes": counts[0], "stderrBytes": counts[1],
                       "stdoutSHA256": hashes[0].hexdigest(), "stderrSHA256": hashes[1].hexdigest(),
                       "outputTruncated": overflow.is_set(), "captureErrors": capture_errors,
                       "captureComplete": not any(thread.is_alive() for thread in threads),
                       "outputComplete": not overflow.is_set() and not capture_errors and not any(thread.is_alive() for thread in threads),
                       "remainingOwnedProcesses": remaining, "subreaper": True}
            for stream in files:
                stream.flush()
                os.fsync(stream.fileno())
            receipt["terminalSHA256"] = self.seal_terminal(terminal, receipt)
            sealed = True
            if code != 0 or guard or counts[1] or remaining or any(thread.is_alive() for thread in threads):
                raise RuntimeError(f"Child command did not qualify: {label}")
            self.capacity()
            return receipt
        except Exception as error:
            if process and process.poll() is None:
                self.stop_owned(process.pid, process.pid)
                try:
                    code = process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    guard = guard or "primary-not-terminal"
            if not sealed:
                self.seal_terminal(terminal, {"label": label, "args": args, "started": process is not None,
                    "exitCode": code, "guard": guard, "failure": type(error).__name__ + ": " + str(error),
                    "stdoutBytes": counts[0], "stderrBytes": counts[1], "stdoutSHA256": hashes[0].hexdigest(),
                    "stderrSHA256": hashes[1].hexdigest(), "outputTruncated": overflow.is_set(),
                    "captureComplete": bool(threads) and not any(thread.is_alive() for thread in threads),
                    "outputComplete": False,
                    "remainingOwnedProcesses": remaining, "elapsedSeconds": round(time.monotonic() - started, 6)})
            raise
        finally:
            if process is not None:
                if process.poll() is None or any(row["state"] != "Z" for row in self.observe(process.pid)):
                    self.stop_owned(process.pid, process.pid)
                for thread in threads:
                    thread.join(timeout=3)
                self.reap_adopted()
            for stream in files:
                stream.close()

    def source_audit(self, label):
        if self.hash_regular(self.helper) != AUDIT_SHA256:
            raise RuntimeError("Trusted audit helper changed")
        result = self.run(label + "-source", [self.node, str(self.helper), "--root", str(self.root)])
        source = json.loads((self.output / (label + "-source") / "stdout.log").read_bytes())
        if (source.get("format") != "revealline-source-identity.v1" or
                source.get("sourceRevision") != self.source_sha or source.get("sourceTree") != self.source_tree or
                source.get("root") != str(self.root) or source.get("allTrackedSourceContentsAndModesMatch") is not True):
            raise RuntimeError("Trusted source identity receipt does not bind the candidate")
        git, deps, node = self.git_identity(), self.dependency_identity(), self.node_identity()
        if self.baseline_source is None:
            self.baseline_source, self.baseline_git = source, git
            self.baseline_dependencies, self.baseline_node = deps, node
        elif (source != self.baseline_source or git != self.baseline_git or
                deps != self.baseline_dependencies or node != self.baseline_node):
            raise RuntimeError("Tracked source/Git/dependency/tooling drift")
        self.capacity()
        return {"source": source, "git": git, "dependencies": deps, "node": node,
                "sourceTerminalSHA256": result["terminalSHA256"]}

    def projections(self, expected_targets):
        directory = self.output / "projections"
        entries = sorted(directory.iterdir())
        expected = sorted(f"{target}.json" for target in expected_targets)
        if [path.name for path in entries] != expected:
            raise RuntimeError("Unexpected/missing projection output paths")
        total, records = 0, []
        for path in entries:
            if not path.is_file() or path.is_symlink():
                raise RuntimeError("Projection is not an ordinary owned file")
            info = path.lstat()
            total += info.st_size
            if total > PROJECTION_LIMIT:
                raise RuntimeError("Aggregate projection exceeds 4 MiB")
            records.append({"path": path.name, "bytes": info.st_size, "sha256": self.hash_regular(path)})
        return records

    def verify_cli_receipt(self, label, target, operation, projections):
        receipt = json.loads((self.output / label / "stdout.log").read_bytes())
        actual = next(record for record in projections if record["path"] == f"{target}.json")
        if any(receipt.get(key) != value for key, value in {"operation": operation, "target": target,
                "bytes": actual["bytes"], "sha256": actual["sha256"]}.items()):
            raise RuntimeError("CLI receipt does not bind exact generated bytes")
        common = {"scripts/remote-team-navigation.mjs", "scripts/published-navigation.mjs",
                  "game/content-design/project.mjs", "game/content-design/execution.mjs",
                  "game/content-design/journey.mjs", "game/content-design/mission-card.mjs",
                  "game/mission-library/journey-presentation.mjs", "game/mission-library/team-source.mjs",
                  "game/mission-library/supplemental-hunt.mjs", "game/mission-library/multiplayer-expeditions.mjs",
                  "game/i18n/content-registry.mjs", "game/content-design/default-entry.mjs",
                  "game/mission-library/handoff.mjs", "game/mission-library/library.mjs",
                  "package-lock.json", FACTORIES[target]}
        owners = receipt.get("codeOwners")
        if (not isinstance(owners, list) or len(owners) != len(common) or
                {owner.get("path") for owner in owners} != common):
            raise RuntimeError("CLI code owner receipt differs from declared authority")
        for owner in owners:
            if owner.get("sha256") != self.hash_regular(self.root / owner["path"]):
                raise RuntimeError("CLI code owner bytes do not match exact source")

    def failure_postflight(self):
        # Evidence-only source auditing is not a test retry; never launch it below floor,
        # after unconfirmed children/readers, without a known actual phase terminal,
        # or after campaign output budget exhaustion.
        try:
            if not self.active_phase or self.baseline_source is None:
                return {"status": "NOT_RUN", "reason": "no qualified preflight/active authoring phase"}
            terminal = self.output / self.active_phase / "child-terminal.json"
            if not terminal.is_file() or json.loads(terminal.read_bytes()).get("started") is not True:
                return {"status": "NOT_RUN", "reason": "authoring child never started"}
            if any(thread.is_alive() for thread in self.capture_threads) or self.observe(-1):
                return {"status": "NOT_RUN", "reason": "child/capture ownership not fully terminal"}
            self.capacity()
            if self.log_bytes + 4096 > CAMPAIGN_LOG_LIMIT:
                return {"status": "NOT_RUN", "reason": "campaign capture budget exhausted"}
            audit = self.source_audit("failure-postflight")
            return {"status": "SOURCE_UNCHANGED", "audit": audit, "authoringQualification": False}
        except Exception as error:
            return {"status": "FAILED_OR_INCOMPLETE", "reason": type(error).__name__ + ": " + str(error),
                    "authoringQualification": False}

    def execute(self):
        if not re.fullmatch(r"[a-f0-9]{40}", self.source_sha) or not re.fullmatch(r"[a-f0-9]{40}", self.source_tree):
            raise RuntimeError("Use complete immutable source identities")
        temporary = Path(os.environ.get("RUNNER_TEMP", "")).resolve(strict=True)
        if (not os.environ.get("RUNNER_TEMP") or self.output.parent.resolve(strict=True) != temporary or
                self.output.exists() or self.output.is_symlink() or self.output.resolve().is_relative_to(self.root)):
            raise RuntimeError("Use a fresh direct child of runner temporary storage outside source")
        self.output.mkdir()
        (self.output / "projections").mkdir()
        (self.output / "tmp").mkdir()
        self.env = controlled_environment(os.environ, self.output / "tmp")
        enable_subreaper()
        self.capacity()
        if self.hash_regular(self.helper) != AUDIT_SHA256:
            raise RuntimeError("Trusted helper SHA256 does not match its reviewed source")
        helper_bytes = self.helper.read_bytes()
        if hashlib.sha1(b"blob " + str(len(helper_bytes)).encode() + b"\0" + helper_bytes).hexdigest() != AUDIT_OID:
            raise RuntimeError("Trusted helper Git blob does not match")
        self.run("node-version", [self.node, "--version"])
        if (self.output / "node-version/stdout.log").read_text().strip() != "v22.22.2":
            raise RuntimeError("Hosted authoring requires exact Node22.22.2")
        self.source_audit("initial")
        produced, frozen = [], []
        for index, (label, args, expected) in enumerate(fixed_phases(self.node, self.root, self.output / "projections"), 1):
            self.active_phase = label
            before = self.source_audit(f"{index:02}-before")
            require_frozen_projection(frozen, self.projections(produced))
            child = self.run(label, args)
            if label.startswith("produce-"):
                produced.append(label.removeprefix("produce-"))
            projections = self.projections(produced)
            require_preexisting_projection(frozen, projections)
            frozen = projections
            if expected is not None:
                counts = require_complete_tap((self.output / label / "stdout.log").read_text(), expected)
            else:
                operation, target = label.split("-", 1)
                self.verify_cli_receipt(label, target, operation, projections)
                counts = None
            after = self.source_audit(f"{index:02}-after")
            require_frozen_projection(frozen, self.projections(produced))
            self.capacity()
            record = {"phase": label, "child": child, "tap": counts, "before": before, "after": after,
                      "projections": projections, "status": "PASS"}
            (self.output / label / "qualified.json").write_bytes(json_bytes(record))
            self.results.append(record)
        self.source_audit("final")
        require_frozen_projection(frozen, self.projections(produced))
        self.capacity()
        result = {"status": "PASS", "sourceHead": self.source_sha, "sourceTree": self.source_tree,
                  "phases": [record["phase"] for record in self.results], "projections": frozen,
                  "ordinaryGameplayOrSenderActivation": False, "source": self.baseline_source,
                  "dependencies": self.baseline_dependencies, "git": self.baseline_git, "node": self.baseline_node,
                  "elapsedSeconds": round(time.monotonic() - self.start, 6), "freeBytes": self.capacity()}
        (self.output / "campaign.json").write_bytes(json_bytes(result))
        print(json.dumps(result))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--source-sha", required=True)
    parser.add_argument("--source-tree", required=True)
    parser.add_argument("--audit-helper", required=True)
    args = parser.parse_args()
    campaign = Campaign(args.root, args.output, args.source_sha, args.source_tree, args.audit_helper)
    try:
        campaign.execute()
    except Exception as error:
        failure = {"status": "FAILED_OR_INCOMPLETE", "error": type(error).__name__ + ": " + str(error),
                   "completedQualifiedPhases": [row["phase"] for row in campaign.results],
                   "sourceHead": args.source_sha, "sourceTree": args.source_tree,
                   "noPassInferredFromKnownChildExit": True, "sourceAfterFailure": campaign.failure_postflight()}
        if campaign.output.is_dir():
            try:
                (campaign.output / "campaign-failure.json").write_bytes(json_bytes(failure))
            except OSError:
                pass
        print(json.dumps(failure), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
