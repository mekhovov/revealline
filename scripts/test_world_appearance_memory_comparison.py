"""Pure diagnostic evidence tests. No Node, Git, application or native execution."""
import hashlib
import importlib.util
import json
from pathlib import Path
import stat
import unittest
from unittest.mock import patch
import zipfile

SPEC = importlib.util.spec_from_file_location("comparison", Path(__file__).with_name("world-appearance-memory-comparison.py"))
m = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)
PINS = json.loads(Path(__file__).with_name("world-appearance-memory-comparison-pins.json").read_bytes())


def sealed(value):
    data = m.encode(value)
    assert len(data) <= 65536
    return data + b" " * (65536 - len(data))


def fixture(oom=False):
    source = {"format": "revealline-source-identity.v1", "sourceRevision": PINS["targets"]["baseline"]["head"],
              "sourceTree": PINS["targets"]["baseline"]["tree"], "root": "/candidate",
              "allTrackedSourceContentsAndModesMatch": True}
    control = {"head": "a" * 40, "tree": "b" * 40, "inventory": [
        {"path": m.WORKFLOW, "OID": "c" * 40, "SHA256": "d" * 64, "bytes": 123, "mode": "100644"}],
        "metadata": {"perVM": "identity"}}
    trusted = {"runID": 11, "runAttempt": 1, "sourceHead": source["sourceRevision"],
               "sourceTree": source["sourceTree"], "control": control, "guard": PINS["guard"],
               "auditor": PINS["auditor"], "workflowDefinitionMatchesControls": True,
               "workflowBlob": "c" * 40, "workflowCommit": "e" * 40}
    values, terminals = {"helper-source.json": m.encode(trusted)}, {}
    tap = ("TAP version 13\n" + "".join(f"ok {i} - case{i}\n" for i in range(1, 116)) +
           "1..115\n# tests 115\n# pass 115\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n")
    for phase in m.PHASES:
        out = b"v22.22.2\n" if phase == "node-version" else m.encode(source)
        err = b""
        argv = ["/node", "--version"] if phase == "node-version" else ["/node", "/auditor", "--root", "/candidate"]
        if phase == "world-file":
            out, err = (b"ok 1 - partial\n", b"FATAL ERROR: JavaScript heap out of memory\n") if oom else (tap.encode(), b"")
            argv = m.native_args("/node", "/candidate")
        terminal = {"args": argv, "started": True, "subreaper": True, "exitCode": -6 if oom and phase == "world-file" else 0,
                    "guard": None, "captureComplete": True, "outputComplete": True, "outputTruncated": False,
                    "captureErrors": [], "remainingOwnedProcesses": [], "elapsedSeconds": 1, "peakObservedOwnedRSSBytes": 100 * m.MIB,
                    "stdoutBytes": len(out), "stderrBytes": len(err), "stdoutSHA256": m.digest(out), "stderrSHA256": m.digest(err)}
        values[phase + "/child-terminal.json"] = sealed(terminal)
        values[phase + "/stdout.log"], values[phase + "/stderr.log"] = out, err
        terminals[phase] = terminal
    base = {"source": source, "git": {"head": source["sourceRevision"], "tree": source["sourceTree"]},
            "node": {"path": "/node", "sha256": PINS["nodeSHA256"]}, "dependencies": {"unchanged": True}}
    record = {"format": "world-appearance-memory-diagnostic.v1", "label": "baseline",
              "sourceHead": source["sourceRevision"], "sourceTree": source["sourceTree"],
              "scope": "DIAGNOSTIC_ONLY_NO_FEATURE_QUALIFICATION", "control": control,
              "trusted": trusted, "node": "/node", "root": "/candidate", "auditorPath": "/auditor",
              "nativeTerminal": terminals["world-file"], "before": {**base, "sourceTerminalSHA256": m.digest(values["before-source/child-terminal.json"])},
              "after": {**base, "sourceTerminalSHA256": m.digest(values["after-source/child-terminal.json"])},
              "controlsAfter": control, "freeBytes": m.FLOOR + 1,
              "owners": [{"path": name, "mode": "100644", "OID": row["OID"], "bytes": row["bytes"], "SHA256": "f" * 64}
                         for name, row in sorted(PINS["owners"].items())],
              "outcome": "V8_OOM" if oom else "WHOLE_FILE_SUCCESS"}
    seal(values, record)
    return values, record, control


def seal(values, record):
    record["evidenceFiles"] = [{"path": k, "bytes": len(v), "SHA256": m.digest(v)}
                               for k, v in sorted(values.items()) if k != "comparison.json"]
    values["comparison.json"] = sealed(record)


def entry(name, size=0, mode=stat.S_IFREG | 0o644):
    value = zipfile.ZipInfo(name)
    value.external_attr = mode << 16
    value.file_size = size
    return value


class Evidence(unittest.TestCase):
    def setUp(self):
        self.block = patch.object(m.subprocess, "run", side_effect=AssertionError("No real child in evidence toys"))
        self.block.start()
        self.addCleanup(self.block.stop)

    def verify(self, values, control):
        return m.verify_observation(values, "baseline", PINS, control, 11, 1)

    def test_success_requires_complete115_and_is_diagnostic_only(self):
        values, record, control = fixture()
        result = self.verify(values, control)
        self.assertEqual(result["outcome"], "WHOLE_FILE_SUCCESS")
        self.assertFalse(result["nativeQualification"])

    def test_oversized_aggregate_is_incomplete_in_receipt_print_and_exit_status(self):
        original = {"format": "world-appearance-memory-comparison.v1",
                    "status": "COMPARISON_RECORDED", "observations": ["x" * 65536]}
        result, data = m.aggregate_receipt(original)
        self.assertEqual(result["status"], "COMPARISON_INCOMPLETE")
        self.assertEqual(json.loads(data), result)
        self.assertEqual(result["observations"], [])
        self.assertFalse(result["nativeQualification"])
        self.assertFalse(result["featureQualification"])
        self.assertLessEqual(len(data), 65536)
        self.assertEqual(0 if result["status"] == "COMPARISON_RECORDED" else 1, 1)
        ordinary = {"format": original["format"], "status": "COMPARISON_RECORDED"}
        same, data = m.aggregate_receipt(ordinary)
        self.assertIs(same, ordinary)
        self.assertEqual(json.loads(data), ordinary)

    def test_oom_is_retained_without_qualifying_a_pass(self):
        values, record, control = fixture(oom=True)
        result = self.verify(values, control)
        self.assertEqual(result["outcome"], "V8_OOM")
        self.assertFalse(result["nativeQualification"])

    def test_partial_known_artifact_is_incomplete_not_pass(self):
        values, record, control = fixture()
        for name in list(values):
            if name.startswith("after-source/"):
                del values[name]
        record.update(outcome="FAILED_OR_INCOMPLETE", after=None)
        seal(values, record)
        self.assertEqual(self.verify(values, control)["outcome"], "FAILED_OR_INCOMPLETE")

    def test_native_argv_cannot_switch_node_root_flag_or_filter(self):
        for field, replacement in [(0, "/alternate-node"), (-1, "/other/" + m.FILE), (2, "--test-name-pattern=one")]:
            values, record, control = fixture()
            record["nativeTerminal"]["args"][field] = replacement
            values["world-file/child-terminal.json"] = sealed(record["nativeTerminal"])
            seal(values, record)
            with self.assertRaisesRegex(RuntimeError, "argv"):
                self.verify(values, control)

    def test_raw_tamper_is_rejected(self):
        values, record, control = fixture()
        values["world-file/stdout.log"] += b"changed"
        with self.assertRaises(RuntimeError):
            self.verify(values, control)
        for name in ("comparison.json", "world-file/child-terminal.json"):
            for shortened in (True, False):
                values, record, control = fixture()
                values[name] = values[name][:-1] if shortened else values[name] + b" "
                if name != "comparison.json":
                    seal(values, record)
                with self.assertRaisesRegex(RuntimeError, "reserve"):
                    self.verify(values, control)

    def test_control_source_or_scope_tamper_is_rejected(self):
        for key in ("sourceHead", "sourceTree", "scope"):
            values, record, control = fixture()
            record[key] = "changed"
            seal(values, record)
            with self.assertRaises(RuntimeError):
                self.verify(values, control)

    def test_omitted_owner_and_false_success_are_rejected(self):
        values, record, control = fixture()
        record["owners"].pop()
        seal(values, record)
        with self.assertRaisesRegex(RuntimeError, "nine-owner"):
            self.verify(values, control)
        values, record, control = fixture(oom=True)
        record["outcome"] = "WHOLE_FILE_SUCCESS"
        seal(values, record)
        with self.assertRaisesRegex(RuntimeError, "outcome"):
            self.verify(values, control)

    def test_guarded_or_nonterminal_native_cannot_qualify(self):
        for key, value in [("guard", "wall-180s"), ("remainingOwnedProcesses", [17]), ("captureComplete", False)]:
            values, record, control = fixture()
            record["nativeTerminal"][key] = value
            values["world-file/child-terminal.json"] = sealed(record["nativeTerminal"])
            record["outcome"] = "FAILED_OR_INCOMPLETE"
            seal(values, record)
            self.assertEqual(self.verify(values, control)["outcome"], "FAILED_OR_INCOMPLETE")

    def test_fixed_flags_and_original_pins_are_not_overridable(self):
        self.assertEqual(m.native_args("NODE", Path("/ROOT")),
            ["NODE", "--max-old-space-size=1536", "--test", "--test-concurrency=1",
             "--experimental-test-isolation=none", "/ROOT/" + m.FILE])
        self.assertEqual(len(PINS["owners"]), 9)
        self.assertEqual(set(PINS["targets"]), {"baseline", "feature"})

    def test_actual_controls_shape_survives_receipt_json_and_rejects_metadata_change(self):
        data = b"fixed control and metadata"
        identity = (7, 11, stat.S_IFREG | 0o644, 1, len(data), 123456, 789012)

        def external_git(root, *args):
            if args[:4] == ("ls-tree", "-z", "HEAD", "--"):
                return ("100644 blob " + m.blob(data) + "\t" + args[4] + "\0").encode()
            if args[:2] == ("rev-parse", "--git-path"):
                return ("metadata/" + args[2] + "\n").encode()
            if args == ("rev-parse", "HEAD"):
                return ("a" * 40 + "\n").encode()
            if args == ("rev-parse", "HEAD^{tree}"):
                return ("b" * 40 + "\n").encode()
            raise AssertionError("Unexpected external Git call")

        with patch.object(m, "git", side_effect=external_git), patch.object(
                m, "ordinary", return_value=(data, identity)):
            actual = m.controls(Path(__file__).parent)
        receipt_control = json.loads(m.encode(actual))
        self.assertEqual(actual, receipt_control)
        for name in ("HEAD", "index", "config"):
            self.assertEqual(actual["metadata"][name]["identity"], list(identity))
        receipt_control["metadata"]["index"]["identity"][1] += 1
        self.assertNotEqual(actual, receipt_control)

    def test_partial_archive_member_set_is_allowed_only_as_evidence(self):
        m.validate_zip([entry("comparison.json")])

    def test_zip_rejects_duplicate_traversal_symlink_special_or_encrypted(self):
        cases = [[entry("comparison.json"), entry("comparison.json")],
                 [entry("../comparison.json")], [entry("/comparison.json")],
                 [entry("comparison.json", mode=stat.S_IFLNK | 0o777)],
                 [entry("comparison.json", mode=stat.S_IFIFO | 0o600)],
                 [entry("unknown.json")]]
        encrypted = entry("comparison.json")
        encrypted.flag_bits |= 1
        cases.append([encrypted])
        for entries in cases:
            with self.assertRaises(RuntimeError):
                m.validate_zip(entries)

    def test_zip_rejects_member_total_and_raw_bounds(self):
        with self.assertRaises(RuntimeError):
            m.validate_zip([entry("comparison.json", 65537)])
        with self.assertRaises(RuntimeError):
            m.validate_zip([entry("comparison.json"),
                            entry("world-file/stdout.log", 4 * m.MIB),
                            entry("world-file/stderr.log", 4 * m.MIB),
                            entry("before-source/stdout.log", 1)])


if __name__ == "__main__":
    unittest.main()
