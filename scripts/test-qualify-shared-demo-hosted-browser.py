#!/usr/bin/env python3
"""Portable contract guards plus real Linux process-lifetime tests (never browsers)."""
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
from types import SimpleNamespace

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location(
    "hosted_browser_owner", Path(__file__).with_name("qualify-shared-demo-hosted-browser.py"))
owner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(owner)


class ContractGuards(unittest.TestCase):
    def test_diagnostic_overflow_fails_admission_but_does_not_disable_cleanup(self):
        tree = owner.LinuxProcessOwner({})
        tree.child = SimpleNamespace(pid=4242, poll=lambda: 7)
        tree.observed = [{}] * 257
        with patch.object(owner, "process_snapshot", return_value={}):
            with self.assertRaises(RuntimeError):
                tree.capture()
            self.assertEqual(tree.cleanup(), [])
            self.assertTrue(tree.evidence([])["boundsExceeded"])

    def test_tmp_symlink_swap_cannot_reuse_a_previously_admitted_inode(self):
        with tempfile.TemporaryDirectory() as tmp:
            original = Path(tmp).resolve() / "private"
            original.mkdir(mode=0o700)
            admitted = owner.private_directory_identity(original)
            backup = original.with_name("renamed")
            original.rename(backup)
            self.assertEqual(owner.private_directory_identity(backup), admitted)
            original.symlink_to(backup, target_is_directory=True)
            with self.assertRaises(AssertionError):
                owner.private_directory_identity(original)

    def test_exited_root_pid_cannot_be_readmitted_after_pid_reuse(self):
        tree = owner.LinuxProcessOwner({})
        tree.child = SimpleNamespace(pid=4242, poll=lambda: 7)
        row = {"pid": 4242, "ppid": 123, "state": "R", "startTicks": 99,
               "uid": os.getuid(), "argvSHA256": "a" * 64, "argv": "unrelated replacement"}
        with patch.object(owner, "process_snapshot", return_value={4242: row}), \
                patch.object(owner.os, "pidfd_open", create=True) as open_pidfd:
            self.assertEqual(tree.capture(), [])
            self.assertFalse(tree.root_seen)
            open_pidfd.assert_not_called()

    def test_phase_inventory_is_complete_and_ordered(self):
        self.assertEqual([len(owner.expected_jobs(p)) for p in owner.PHASE_SECONDS], [11, 9, 1])
        self.assertEqual(len(set(owner.expected_jobs("matrix"))), 11)
        self.assertEqual(owner.expected_jobs("additional")[-1], "hidden-frequency-search-webkit")
        with self.assertRaises(ValueError):
            owner.expected_jobs("other")

    def test_report_read_rejects_oversize_and_symlink(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "report.json"
            path.write_bytes(b"x" * 17)
            with self.assertRaises(ValueError):
                owner.bounded_file(path, 16)
            link = Path(tmp) / "link.json"
            link.symlink_to(path)
            with self.assertRaises(OSError):
                owner.bounded_file(link, 20)

    def test_interruption_is_deferred_only_through_registration(self):
        report = {"complete": True}
        state = owner.Cancellation(report)
        state.registering = True
        state.handle(signal.SIGTERM, None)
        self.assertFalse(report["complete"])
        with self.assertRaises(InterruptedError):
            state.registered()
        self.assertFalse(state.registering)
        state.finalizing = True
        report["complete"] = True
        state.handle(signal.SIGINT, None)
        self.assertFalse(report["complete"])
        self.assertEqual(report["interruptedSignal"], "SIGTERM")

    def test_log_overflow_is_drained_but_not_stored_unboundedly(self):
        with tempfile.TemporaryDirectory() as tmp:
            log = owner.BoundedLog(Path(tmp) / "child.log", limit=32)
            child = subprocess.Popen([sys.executable, "-c", "print('x'*100000)"], stdout=subprocess.PIPE)
            log.start(child.stdout)
            self.assertEqual(child.wait(timeout=5), 0)
            result = log.finish()
            self.assertTrue(result["complete"])
            self.assertTrue(result["overflow"])
            self.assertEqual(result["writtenBytes"], 32)
            self.assertEqual((Path(tmp) / "child.log").stat().st_size, 32)
            with self.assertRaises(RuntimeError):
                log.check()

    def test_aggregate_rejects_missing_jobs_changed_bindings_and_child_tampering(self):
        previous = Path.cwd()
        with tempfile.TemporaryDirectory() as tmp:
            try:
                os.chdir(tmp)
                Path(".cache").mkdir()
                child = Path(".cache/child.json")
                child.write_text('{"complete":true}')
                bindings = {"head": "a" * 40, "source": {"runtime": {"sha256": "c" * 64}}}
                result = {"format": "SharedDemoHostedBrowserV1", "complete": True,
                          "bindingsStable": True, "head": "a" * 40, "base": "b" * 40,
                          "phase": "offline", "expectedRuntime": "c" * 64,
                          "selected": owner.expected_jobs("offline"), "before": bindings,
                          "after": bindings, "toolingBefore": [1], "toolingAfter": [1],
                          "jobs": [{"id": owner.expected_jobs("offline")[0], "complete": True,
                                    "finished": "now", "exit": {"code": 0, "signal": None},
                                    "reportPath": str(child), "reportSHA256": owner.sha(child.read_bytes())}]}
                path = Path(".cache/report.json")

                def check(value):
                    path.write_text(json.dumps(value))
                    return owner.validate_aggregate(path, "offline", "a" * 40, "b" * 40, "c" * 64)

                self.assertEqual(len(check(result)["jobs"]), 1)
                for altered in ({**result, "jobs": []}, {**result, "complete": False},
                                {**result, "after": {"wrong": True}},
                                {**result, "toolingAfter": [2]},
                                {**result, "interruptedSignal": "SIGTERM"}):
                    with self.assertRaises(AssertionError):
                        check(altered)
                child.write_text('{"complete":false}')
                with self.assertRaises(AssertionError):
                    check(result)
            finally:
                os.chdir(previous)


@unittest.skipUnless(sys.platform == "linux", "Linux /proc/pidfd integration: not executed on this platform")
class LinuxLifetimeGuards(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.log_path = Path(self.directory.name) / "phase.log"

    def supervise(self, program, *, seconds=5, spawn=subprocess.Popen, validate=lambda: {}):
        # The first in-loop storage check runs after root ownership is observed.
        # Release the fixture only then, rather than relying on CI scheduling sleeps.
        ready = Path(self.directory.name) / "parent-observed-root"
        checks = 0

        def release_observed_child():
            nonlocal checks
            checks += 1
            if checks >= 2:
                ready.touch()

        bootstrap = ("from pathlib import Path; import time; marker=Path(" + repr(str(ready))
                     + ");\nwhile not marker.exists(): time.sleep(.005)\nexec(" + repr(program) + ")")
        result, cancellation, previous = owner.supervise(
            [sys.executable, "-c", bootstrap], self.log_path, seconds=seconds,
            spawn=spawn, validate=validate, storage_check=release_observed_child,
            cleanup_seconds=(.1, .1, 1))
        self.addCleanup(lambda: [signal.signal(sig, handler) for sig, handler in previous.items()])
        self.assertTrue(result["ownedProcesses"]["verified"], result)
        self.assertEqual(result["ownedProcesses"]["remaining"], [])
        return result

    def test_clean_child_success_requires_observed_retirement(self):
        result = self.supervise("print('ready',flush=True)")
        self.assertTrue(result["complete"], result)
        self.assertEqual(result["childExit"], 0)
        self.assertEqual(result["ownedProcesses"]["actions"], [])

    def test_child_exiting_between_polls_does_not_borrow_finalization_time(self):
        real_sleep = time.sleep
        with patch.object(owner.time, "sleep", side_effect=lambda _: real_sleep(.4)):
            result = self.supervise("import time; time.sleep(.15)", seconds=.3)
        self.assertFalse(result["complete"])
        self.assertTrue(result["watchdogExpired"])
        self.assertEqual(result["childExit"], 0)

    def test_nonzero_root_is_not_reaped_as_success_when_child_is_adopted(self):
        program = ("import subprocess,sys,time; subprocess.Popen([sys.executable,'-c',"
                   "'import time; time.sleep(30)'],start_new_session=True); sys.exit(7)")
        result = self.supervise(program)
        self.assertFalse(result["complete"])
        self.assertEqual(result["childExit"], 7)
        self.assertTrue(result["cleanupNeededAfterChildExit"])
        self.assertGreaterEqual(len(result["ownedProcesses"]["observed"]), 2)

    def test_timeout_retires_detached_sigterm_ignoring_descendant(self):
        child = "import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(30)"
        program = ("import subprocess,sys,time; subprocess.Popen([sys.executable,'-c',"
                   + repr(child) + "],start_new_session=True); time.sleep(30)")
        result = self.supervise(program, seconds=.25)
        self.assertFalse(result["complete"])
        self.assertTrue(result["watchdogExpired"])
        self.assertTrue(any(row["signal"] == "SIGKILL" for row in result["ownedProcesses"]["actions"]))

    def test_interrupt_inside_popen_registration_is_cleaned_and_cannot_succeed(self):
        def interrupted_spawn(*args, **kwargs):
            child = subprocess.Popen(*args, **kwargs)
            signal.raise_signal(signal.SIGTERM)
            return child
        result = self.supervise("import time; time.sleep(30)", spawn=interrupted_spawn)
        self.assertFalse(result["complete"])
        self.assertEqual(result["interruptedSignal"], "SIGTERM")

    def test_preexisting_unrelated_sibling_is_not_owned_or_signalled(self):
        sibling = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])
        try:
            result = self.supervise("import time; time.sleep(30)", seconds=.15)
            self.assertFalse(result["complete"])
            self.assertIsNone(sibling.poll())
            self.assertNotIn(sibling.pid, [row["pid"] for row in result["ownedProcesses"]["observed"]])
        finally:
            sibling.terminate()
            sibling.wait(timeout=5)

    def test_changed_pid_identity_cannot_receive_a_signal(self):
        owner.enable_subreaper()
        baseline = owner.process_snapshot()
        child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])
        tree = owner.LinuxProcessOwner(baseline)
        try:
            tree.attach(child)
            row = next(row for row in tree.capture() if row["pid"] == child.pid)
            self.assertFalse(tree.send({**row, "startTicks": row["startTicks"] + 1}, signal.SIGKILL))
            self.assertEqual(tree.actions, [])
            self.assertIsNone(child.poll())
        finally:
            self.assertEqual(tree.cleanup(.1, .1, 1), [])

    def test_log_overflow_cannot_be_success_even_when_cleanup_finishes(self):
        result = self.supervise("import sys,time; sys.stdout.write('x'*4194305); sys.stdout.flush(); time.sleep(30)")
        self.assertFalse(result["complete"])
        self.assertTrue(result["log"]["overflow"])
        self.assertEqual(self.log_path.stat().st_size, owner.LOG_BYTES)

    def test_failed_validation_and_finalization_signal_cannot_restore_success(self):
        def invalid():
            raise ValueError("changed source or aggregate")
        result = self.supervise("print('finished')", validate=invalid)
        self.assertFalse(result["complete"])
        self.assertIn("validationFailure", result)
        state = owner.Cancellation(result)
        state.finalizing = True
        result["complete"] = True
        state.handle(signal.SIGINT, None)
        self.assertFalse(result["complete"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
