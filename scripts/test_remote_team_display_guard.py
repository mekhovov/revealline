"""Toy-only guard regression tests. Never execute Node, compiler, Git, or a game host."""
import importlib.util
import io
import json
import os
import re
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import Mock, patch

SPEC = importlib.util.spec_from_file_location("remote_team_display_guard", Path(__file__).with_name("remote-team-display-guard.py"))
guard = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(guard)


class Child:
    pid = 4321
    def __init__(self, stdout=b"", stderr=b"", code=0):
        self.stdout, self.stderr, self.code = io.BytesIO(stdout), io.BytesIO(stderr), code
    def poll(self):
        return self.code
    def wait(self, timeout=None):
        return self.code


class GuardTests(unittest.TestCase):
    def test_fixed_phases_are_complete_and_not_arbitrary(self):
        rows = guard.fixed_phases("/node22", Path("/source"), Path("/owned/projections"))
        self.assertEqual([row[0] for row in rows], [
            "produce-cultural", "produce-expedition", "produce-hunt", "check-cultural", "check-expedition", "check-hunt",
            "test-contract", "test-cultural", "test-expedition", "test-hunt"])
        self.assertEqual([row[2] for row in rows], [None] * 6 + [2, 1, 1, 1])
        self.assertTrue(all(row[1][0] == "/node22" for row in rows))
        self.assertTrue(all("--test-name-pattern" not in row[1] for row in rows))
        for row in rows[6:]:
            self.assertEqual(row[1][1:3], ["--test", "--test-concurrency=1"])
        self.assertEqual([row[1][-1] for row in rows[6:]], [
            "/source/scripts/test-remote-team-navigation.mjs",
            "/source/scripts/remote-team-navigation-cultural.check.mjs",
            "/source/scripts/remote-team-navigation-expedition.check.mjs",
            "/source/scripts/remote-team-navigation-hunt.check.mjs"])
        # Exact existing game-cli.mjs default discovery; only the cheap contract is automatic.
        discovery = re.compile(r"(?:^|/)(?:test-[^/]+|[^/]+\.test)\.mjs$")
        self.assertTrue(discovery.search(rows[6][1][-1]))
        self.assertTrue(all(not discovery.search(row[1][-1]) for row in rows[7:]))

    def test_environment_preserves_home_and_strips_all_inherited_namespaces_and_secrets(self):
        env = guard.controlled_environment({"HOME": "/actual-user", "PATH": "/tools", "GIT_DIR": "/wrong",
            "GIT_COMMON_DIR": "/wrong-common", "GIT_INDEX_FILE": "/wrong-index", "NODE_COMPILE_CACHE": "/cache",
            "NODE_OPTIONS": "--import /wrong", "NODE_V8_COVERAGE": "/coverage", "GH_TOKEN": "secret",
            "GITHUB_TOKEN": "secret", "NPM_CONFIG_USERCONFIG": "/wrong-config"}, Path("/owned/tmp"))
        self.assertEqual(env["HOME"], "/actual-user")
        self.assertEqual(env["TMPDIR"], "/owned/tmp")
        self.assertEqual(env["NODE_OPTIONS"], "--max-old-space-size=1536")
        for key in ("GIT_DIR", "GIT_COMMON_DIR", "GIT_INDEX_FILE", "NODE_COMPILE_CACHE", "NODE_V8_COVERAGE", "GH_TOKEN", "GITHUB_TOKEN", "NPM_CONFIG_USERCONFIG"):
            self.assertNotIn(key, env)

    def test_complete_tap_rejects_missing_duplicate_skipped_cancelled_and_failure_counts(self):
        good = "# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n"
        self.assertEqual(guard.require_complete_tap(good, 2)["pass"], 2)
        for bad in (good.replace("# pass 2", "# pass 1"), good.replace("# skipped 0", "# skipped 1"),
                    good.replace("# cancelled 0", "# cancelled 1"), good.replace("# fail 0", "# fail 1"),
                    good.replace("# todo 0\n", ""), good + "# pass 2\n"):
            with self.assertRaises(RuntimeError):
                guard.require_complete_tap(bad, 2)

    def test_process_birth_and_escaped_descendant_ownership(self):
        owner, primary = 100, 200
        known = {primary: 10}
        rows = {
            primary: {"pid": primary, "ppid": owner, "pgid": primary, "start": 10, "rss": 5, "state": "S"},
            201: {"pid": 201, "ppid": primary, "pgid": 201, "start": 11, "rss": 6, "state": "S"},
            202: {"pid": 202, "ppid": owner, "pgid": 202, "start": 12, "rss": 7, "state": "S"},
            300: {"pid": 300, "ppid": 1, "pgid": 300, "start": 13, "rss": 8, "state": "S"},
        }
        self.assertEqual({row["pid"] for row in guard.owned_processes(rows, known, primary, owner)}, {200, 201, 202})
        # A reused unrelated PID is not evidence that the old owned process survived.
        rows[201] = {**rows[201], "start": 99, "ppid": 1}
        self.assertNotIn(201, {row["pid"] for row in guard.owned_processes(rows, known, primary, owner)})

    def test_proc_parser_handles_parentheses_in_process_name(self):
        fields = ["S", "10", "11"] + ["0"] * 19
        fields[19], fields[21] = "12345", "3"
        row = guard.parse_proc_stat("12 (name ) with spaces) " + " ".join(fields))
        self.assertEqual((row["pid"], row["ppid"], row["pgid"], row["start"]), (12, 10, 11, 12345))
        self.assertEqual(row["rss"], 3 * os.sysconf("SC_PAGE_SIZE"))

    def toy(self, directory):
        campaign = guard.Campaign.__new__(guard.Campaign)
        campaign.root, campaign.output = directory, directory / "output"
        campaign.output.mkdir()
        campaign.env, campaign.known_children = {}, {}
        campaign.log_bytes, campaign.log_lock = 0, threading.Lock()
        campaign.reserved, campaign.results, campaign.capture_threads = {}, [], []
        campaign.capacity = Mock(return_value=guard.FLOOR + 1)
        campaign.observe, campaign.stop_owned, campaign.reap_adopted = Mock(return_value=[]), Mock(), Mock()
        return campaign

    def invoke_toy(self, campaign, child):
        initial = {child.pid: {"pid": child.pid, "start": 10, "ppid": os.getpid(), "pgid": child.pid, "rss": 1, "state": "Z"}}
        with patch.object(guard.subprocess, "Popen", return_value=child) as popen, patch.object(guard, "process_snapshot", return_value=initial):
            result = campaign.run("toy", ["NEVER-EXECUTED"])
            popen.assert_called_once()
            return result

    def test_toy_success_seals_child_fact_and_preserves_empty_stderr(self):
        with tempfile.TemporaryDirectory() as temporary:
            campaign = self.toy(Path(temporary))
            result = self.invoke_toy(campaign, Child(b"complete\n"))
            self.assertEqual(result["exitCode"], 0)
            self.assertFalse(result["outputTruncated"])
            self.assertEqual(result["remainingOwnedProcesses"], [])
            path = campaign.output / "toy/child-terminal.json"
            self.assertEqual(json.loads(path.read_bytes())["exitCode"], 0)
            self.assertEqual(path.stat().st_size, guard.TERMINAL_RESERVE)
            with self.assertRaises(RuntimeError):
                campaign.seal_terminal(path, {})

    def test_postflight_capacity_failure_does_not_erase_exit_zero_terminal(self):
        with tempfile.TemporaryDirectory() as temporary:
            campaign = self.toy(Path(temporary))
            campaign.capacity = Mock(side_effect=[guard.FLOOR + 1, RuntimeError("postflight floor")])
            with self.assertRaisesRegex(RuntimeError, "postflight floor"):
                self.invoke_toy(campaign, Child(b"complete\n"))
            receipt = json.loads((campaign.output / "toy/child-terminal.json").read_bytes())
            self.assertEqual(receipt["exitCode"], 0)
            self.assertIsNone(receipt["guard"])
            self.assertEqual((campaign.output / "toy/stdout.log").read_bytes(), b"complete\n")

    def test_output_overflow_after_already_exited_child_is_failure(self):
        with tempfile.TemporaryDirectory() as temporary, patch.object(guard, "STREAM_LIMIT", 8):
            campaign = self.toy(Path(temporary))
            with self.assertRaises(RuntimeError):
                self.invoke_toy(campaign, Child(b"longer than eight bytes"))
            receipt = json.loads((campaign.output / "toy/child-terminal.json").read_bytes())
            self.assertEqual(receipt["exitCode"], 0)
            self.assertTrue(receipt["outputTruncated"])
            self.assertIsNotNone(receipt["guard"])
            self.assertEqual((campaign.output / "toy/stdout.log").stat().st_size, 8)

    def test_stderr_blocks_even_when_child_exits_zero(self):
        with tempfile.TemporaryDirectory() as temporary:
            campaign = self.toy(Path(temporary))
            with self.assertRaises(RuntimeError):
                self.invoke_toy(campaign, Child(stderr=b"unexpected diagnostic"))
            receipt = json.loads((campaign.output / "toy/child-terminal.json").read_bytes())
            self.assertEqual(receipt["exitCode"], 0)
            self.assertGreater(receipt["stderrBytes"], 0)

    def test_prelaunch_capacity_failure_never_starts_process(self):
        with tempfile.TemporaryDirectory() as temporary:
            campaign = self.toy(Path(temporary))
            campaign.capacity = Mock(side_effect=RuntimeError("fresh prelaunch floor"))
            with patch.object(guard.subprocess, "Popen") as popen:
                with self.assertRaises(RuntimeError):
                    campaign.run("toy", ["NEVER-EXECUTED"])
                popen.assert_not_called()
            receipt = json.loads((campaign.output / "toy/child-terminal.json").read_bytes())
            self.assertFalse(receipt["started"])
            self.assertIsNone(receipt["exitCode"])

    def test_aggregate_projection_cap_and_unknown_files_fail_closed(self):
        with tempfile.TemporaryDirectory() as temporary:
            campaign = self.toy(Path(temporary))
            projections = campaign.output / "projections"
            projections.mkdir()
            (projections / "cultural.json").write_bytes(b"12345")
            with patch.object(guard, "PROJECTION_LIMIT", 4):
                with self.assertRaisesRegex(RuntimeError, "Aggregate"):
                    campaign.projections(["cultural"])
            (projections / "unknown.json").write_bytes(b"{}")
            with self.assertRaisesRegex(RuntimeError, "Unexpected"):
                campaign.projections(["cultural"])


    def running_toy(self, directory, rss):
        campaign = self.toy(directory)
        child = Child()
        child.code = None
        row = {"pid": child.pid, "ppid": os.getpid(), "pgid": child.pid, "start": 10, "rss": rss, "state": "S"}
        campaign.observe = lambda primary: [row] if child.code is None else []
        campaign.stop_owned = Mock(side_effect=lambda primary, group: setattr(child, "code", -15))
        return campaign, child

    def test_observed_rss_guard_stops_only_toy_owned_child(self):
        with tempfile.TemporaryDirectory() as temporary:
            campaign, child = self.running_toy(Path(temporary), guard.RSS_LIMIT + 1)
            with self.assertRaises(RuntimeError):
                self.invoke_toy(campaign, child)
            receipt = json.loads((campaign.output / "toy/child-terminal.json").read_bytes())
            self.assertEqual(receipt["guard"], "own-descendant-RSS-2048MiB")
            self.assertGreater(receipt["peakObservedOwnedRSSBytes"], guard.RSS_LIMIT)
            campaign.stop_owned.assert_called()

    def test_wall_timeout_preserves_failed_child_terminal(self):
        with tempfile.TemporaryDirectory() as temporary:
            campaign, child = self.running_toy(Path(temporary), 1)
            with patch.object(guard.time, "monotonic", side_effect=[0, guard.WALL_LIMIT + 1, guard.WALL_LIMIT + 2]):
                with self.assertRaises(RuntimeError):
                    self.invoke_toy(campaign, child)
            receipt = json.loads((campaign.output / "toy/child-terminal.json").read_bytes())
            self.assertEqual(receipt["guard"], "wall-180s")
            self.assertEqual(receipt["exitCode"], -15)

    def test_disk_floor_during_child_is_guarded_not_a_retry(self):
        with tempfile.TemporaryDirectory() as temporary:
            campaign, child = self.running_toy(Path(temporary), 1)
            campaign.capacity = Mock(side_effect=[guard.FLOOR + 1, RuntimeError("observed floor")])
            with self.assertRaises(RuntimeError):
                self.invoke_toy(campaign, child)
            receipt = json.loads((campaign.output / "toy/child-terminal.json").read_bytes())
            self.assertEqual(receipt["guard"], "capacity-or-campaign-wall")
            self.assertEqual(receipt["exitCode"], -15)

    def test_actual_toy_output_identity_detects_content_drift(self):
        with tempfile.TemporaryDirectory() as temporary:
            campaign = self.toy(Path(temporary))
            directory = campaign.output / "projections"
            directory.mkdir()
            path = directory / "cultural.json"
            path.write_bytes(b'{"a":1}')
            frozen = campaign.projections(["cultural"])
            guard.require_frozen_projection(frozen, campaign.projections(["cultural"]))
            path.write_bytes(b'{"a":2}')
            with self.assertRaisesRegex(RuntimeError, "rewrote"):
                guard.require_frozen_projection(frozen, campaign.projections(["cultural"]))

    def test_escaped_descendant_receives_escalation_as_well_as_group(self):
        campaign = guard.Campaign.__new__(guard.Campaign)
        rows = [{"pid": 100, "pgid": 100, "start": 10, "state": "S"},
                {"pid": 101, "pgid": 101, "start": 11, "state": "S"}]
        campaign.observe = Mock(return_value=rows)
        with patch.object(guard, "process_snapshot", return_value={row["pid"]: row for row in rows}), \
                patch.object(guard.os, "killpg") as group, patch.object(guard.os, "kill") as individual, \
                patch.object(guard.time, "monotonic", side_effect=[0, 3, 4, 7]):
            campaign.stop_owned(100, 100)
        self.assertIn(unittest.mock.call(100, guard.signal.SIGTERM), group.call_args_list)
        self.assertIn(unittest.mock.call(100, guard.signal.SIGKILL), group.call_args_list)
        self.assertIn(unittest.mock.call(101, guard.signal.SIGTERM), individual.call_args_list)
        self.assertIn(unittest.mock.call(101, guard.signal.SIGKILL), individual.call_args_list)

    def test_changed_birth_identity_is_not_individually_signalled(self):
        campaign = guard.Campaign.__new__(guard.Campaign)
        row = {"pid": 101, "pgid": 101, "start": 11, "state": "S"}
        campaign.observe = Mock(return_value=[row])
        with patch.object(guard, "process_snapshot", return_value={101: {**row, "start": 99}}), \
                patch.object(guard.os, "killpg") as group, patch.object(guard.os, "kill") as individual, \
                patch.object(guard.time, "monotonic", side_effect=[0, 3, 4, 7]):
            campaign.stop_owned(100, 100)
        group.assert_not_called()
        individual.assert_not_called()


    def test_earlier_projection_cannot_drift_while_next_target_is_produced(self):
        with tempfile.TemporaryDirectory() as temporary:
            campaign = self.toy(Path(temporary))
            directory = campaign.output / "projections"
            directory.mkdir()
            first = directory / "cultural.json"
            first.write_bytes(b'{"a":1}')
            frozen = campaign.projections(["cultural"])
            (directory / "expedition.json").write_bytes(b'{"b":1}')
            guard.require_preexisting_projection(frozen, campaign.projections(["cultural", "expedition"]))
            first.write_bytes(b'{"a":2}')
            with self.assertRaisesRegex(RuntimeError, "rewrote"):
                guard.require_preexisting_projection(frozen, campaign.projections(["cultural", "expedition"]))

    def test_reused_descendant_pid_is_admitted_only_under_current_owned_parent_birth(self):
        known = {200: 10, 201: 11, 202: 12}
        rows = {
            200: {"pid": 200, "ppid": 100, "pgid": 200, "start": 10, "rss": 1, "state": "S"},
            201: {"pid": 201, "ppid": 200, "pgid": 201, "start": 99, "rss": 1, "state": "S"},
            202: {"pid": 202, "ppid": 1, "pgid": 202, "start": 88, "rss": 1, "state": "S"},
        }
        result = guard.owned_processes(rows, known, 200, 100)
        self.assertEqual(known[201], 99)
        self.assertEqual(known[202], 12)
        self.assertEqual({row["pid"] for row in result}, {200, 201})


if __name__ == "__main__":
    unittest.main()
