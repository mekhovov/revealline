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
import zipfile
import stat
from unittest.mock import Mock, patch

SPEC = importlib.util.spec_from_file_location("overflight_text_scaling_native_guard", Path(__file__).with_name("overflight-text-scaling-native-guard.py"))
guard = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(guard)
AGG_SPEC = importlib.util.spec_from_file_location("overflight_native_aggregate", Path(__file__).with_name("aggregate-overflight-text-scaling-native.py"))
aggregate = importlib.util.module_from_spec(AGG_SPEC)
AGG_SPEC.loader.exec_module(aggregate)


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
        expected = ('game/test/touch-controls-view.test.mjs', 'game/test/overflight-touch.test.mjs', 'game/test/overflight-text-scaling-host.test.mjs', 'game/test/overflight-text-scaling-riy-reader-host.test.mjs', 'game/test/overflight-text-scaling-view.test.mjs', 'game/test/reaction-reading-time.test.mjs', 'game/test/overflight-commentator.test.mjs', 'game/test/actor-reaction-director.test.mjs', 'game/test/fpv-hunt-reactions.test.mjs', 'game/test/overflight-text-scaling.test.mjs', 'game/test/overflight-text-scaling-declarations.test.mjs', 'game/test/overflight-upgrade-card.test.mjs', 'game/test/overflight-upgrade-preview.test.mjs', 'game/test/overflight-riy.test.mjs', 'game/test/display-preferences.test.mjs', 'game/test/display-preferences-host.test.mjs', 'game/test/text-size-compatibility.test.mjs', 'game/test/text-size-library.test.mjs', 'game/test/text-size-host.test.mjs', 'game/test/theme-bootstrap.test.mjs', 'game/test/theme-system.test.mjs', 'game/test/theme-family-host.test.mjs', 'game/test/fpv-theme-family-controls.test.mjs', 'game/test/fpv-world-appearance-ui.test.mjs', 'game/test/fpv-flight-ui.test.mjs', 'game/test/shared-touch-preferences.test.mjs', 'game/test/classic-snake-ui.test.mjs', 'game/test/localization-couch-host.test.mjs')
        self.assertEqual(guard.WHOLE_FILES, expected)
        rows = []
        for group in range(1, 5):
            selected = guard.fixed_phases("/node22", Path("/source"), group)
            self.assertEqual(len(selected), 7)
            self.assertEqual([row[2] for row in selected], list(expected[(group - 1) * 7:group * 7]))
            rows.extend(selected)
        self.assertEqual([row[2] for row in rows], list(expected))
        for row in rows:
            self.assertEqual(row[1], ["/node22", "--max-old-space-size=1536", "--test",
                "--test-concurrency=1", "--experimental-test-isolation=none", str(Path("/source") / row[2])])
            self.assertNotIn("--test-name-pattern", row[1])
        self.assertEqual(len({row[0] for row in rows}), 28)
        for invalid in (0, 5, -1, "1"):
            with self.assertRaises(RuntimeError):
                guard.fixed_phases("/node22", Path("/source"), invalid)

    def aggregate_fixture(self):
        result = []
        inventory = [{"path": name, "mode": "100644", "OID": "1" * 40, "SHA256": "2" * 64, "bytes": 1}
                     for name in sorted(guard.FEATURE_PATHS)]
        digest = guard.sha256(guard.json_bytes(inventory))
        provenance = {"oid": guard.AUDIT_OID, "sha256": guard.AUDIT_SHA256, "bytes": 7275,
                      "sourceHead": "a" * 40, "sourceTree": "b" * 40, "workflowBlob": "f" * 40,
                      "workflowCommit": "e" * 40, "workflowDefinitionMatchesCandidate": True}
        for number in range(1, 5):
            selected = list(guard.WHOLE_FILES[(number - 1) * 7:number * 7])
            result.append({"group": number, "status": "PASS", "sourceHead": "a" * 40, "sourceTree": "b" * 40,
                "git": {"head": "a" * 40, "tree": "b" * 40, "index": {"ino": number}},
                "source": {"format": "revealline-source-identity.v1", "sourceRevision": "a" * 40,
                    "sourceTree": "b" * 40, "allTrackedSourceContentsAndModesMatch": True,
                    "aggregateSha256": "d" * 64, "files": 10, "bytes": 100, "root": f"/different-vm-{number}"},
                "wholeFiles": selected, "all28Inventory": list(guard.WHOLE_FILES),
                "all44Inventory": list(guard.complete_inventory()), "phases": [str(i) for i in range(7)],
                "additionalPhases": [label for label, _, _ in guard.additional_phases("NODE", Path("SOURCE"), number)],
                "additionalWholeFiles": [filename for _, _, filename in guard.additional_phases("NODE", Path("SOURCE"), number)],
                "feature": {"initialReferenceManifestSHA256": guard.FEATURE_MANIFEST_SHA256,
                    "featurePaths": 66, "stackAdmitted": True,
                    "dependencyHead": guard.STACK_HEAD, "dependencyAdmittedAtMain": guard.ADMITTED_AT_MAIN,
                    "additionalCompleteFiles": 16, "raidFamilyCompleteFiles": 15, "totalCompleteFiles": 44,
                    "inventory": [dict(row) for row in inventory],
                    "inventorySHA256": digest, "matchesInitialReference": digest == guard.INITIAL_REFERENCE_LEAF_SHA256},
                "helperProvenance": {"receipt": {**provenance, "helperPath": f"/vm-{number}/trusted/auditor"},
                    "SHA256": guard.sha256(json.dumps({**provenance, "helperPath": f"/vm-{number}/trusted/auditor"}).encode())},
                "auditorPath": f"/vm-{number}/trusted/auditor",
                "campaignRawBytes": 1, "elapsedSeconds": 1.0, "freeBytes": guard.FLOOR + 1, "node": {"sha256": "identical-node", "dev": number, "ino": number, "path": f"/vm-{number}/node"},
                "controls": {"workflow": "same"}, "dependencies": {"fakeIndexedDB": "locked-version",
                    "immutablePackageInputs": [{"path": path, "OID": "3" * 40} for path in guard.DEPENDENCY_PATHS],
                    **{name: {"contentSHA256": "same", "packageLockSHA256": "same", "entries": 1, "bytes": 1,
                        "rootDev": number, "rootIno": number, "metadataSHA256": f"different-{number}"}
                       for name in ("root", "authoring")}}})
        return result

    def test_aggregate_requires_all_four_exact_head_ordered_whole_file_groups(self):
        rows = self.aggregate_fixture()
        self.assertEqual(len(aggregate.validate_metadata(rows, "a" * 40, "b" * 40)["wholeFiles"]), 28)
        for mutate in (lambda value: value.pop(), lambda value: value.reverse(),
                       lambda value: value[1].update(group=1), lambda value: value[2].update(sourceHead="c" * 40),
                       lambda value: value[2].update(status="FAILED_OR_INCOMPLETE"),
                       lambda value: value[0]["wholeFiles"].reverse(),
                       lambda value: value[3]["wholeFiles"].__setitem__(0, value[0]["wholeFiles"][0]),
                       lambda value: value[0].update(campaignRawBytes=8 * guard.MIB + 1),
                       lambda value: value[0]["dependencies"]["root"].update(contentSHA256="different"),
                       lambda value: value[0].update(controls={"workflow": "different"}),
                       lambda value: value[0]["feature"].update(stackAdmitted=False),
                       lambda value: value[0]["feature"].update(dependencyHead="0" * 40),
                       lambda value: value[0]["feature"].update(dependencyAdmittedAtMain="0" * 40),
                       lambda value: value[0]["source"].update(aggregateSha256="e" * 64)):
            rows = self.aggregate_fixture()
            mutate(rows)
            with self.assertRaises(RuntimeError):
                aggregate.validate_metadata(rows, "a" * 40, "b" * 40)

    def test_additional_host_is_one_complete_file_only_after_original_group_one(self):
        original = guard.fixed_phases("/node22", Path("/source"), 1)
        additional = guard.additional_phases("/node22", Path("/source"), 1)
        self.assertEqual(len(original), 7)
        self.assertEqual([row for row in additional if row[2] in guard.ADDITIONAL_WHOLE_FILES], [("additional-overflight-host", ["/node22", "--max-old-space-size=1536",
            "--test", "--test-concurrency=1", "--experimental-test-isolation=none",
            "/source/game/test/overflight-host.test.mjs"], "game/test/overflight-host.test.mjs")])
        self.assertEqual((original + additional)[7], additional[0])
        self.assertNotIn(additional[0][2], guard.WHOLE_FILES)
        for number in (2, 3, 4):
            rows = guard.additional_phases("/node22", Path("/source"), number)
            self.assertEqual(len(rows), 4)
            self.assertFalse(any(row[2] in guard.ADDITIONAL_WHOLE_FILES for row in rows))
        for number in (0, 5, -1, "1"):
            with self.assertRaises(RuntimeError):
                guard.additional_phases("/node22", Path("/source"), number)

    def test_additional_host_metadata_rejects_missing_duplicate_wrong_and_foreign_group(self):
        rows = self.aggregate_fixture()
        proof = aggregate.validate_metadata(rows, "a" * 40, "b" * 40)
        self.assertEqual(proof["wholeFiles"], list(guard.WHOLE_FILES))
        self.assertEqual([name for name in proof["additionalWholeFiles"] if name in guard.ADDITIONAL_WHOLE_FILES], ["game/test/overflight-host.test.mjs"])
        self.assertEqual(proof["additionalCompleteFiles"], 16)
        for mutate in (lambda value: value[0].update(additionalPhases=[]),
                       lambda value: value[0].update(additionalWholeFiles=[]),
                       lambda value: value[0]["additionalPhases"].append("additional-overflight-host"),
                       lambda value: value[0]["additionalWholeFiles"].append("game/test/overflight-host.test.mjs"),
                       lambda value: value[0].update(additionalWholeFiles=["game/test/wrong-host.test.mjs"]),
                       lambda value: value[1].update(additionalPhases=["additional-overflight-host"]),
                       lambda value: value[1].update(additionalWholeFiles=["game/test/overflight-host.test.mjs"]),
                       lambda value: value[0]["feature"].update(additionalCompleteFiles=0)):
            rows = self.aggregate_fixture()
            mutate(rows)
            with self.assertRaises(RuntimeError):
                aggregate.validate_metadata(rows, "a" * 40, "b" * 40)

    def test_additional_host_archive_requires_exact_group_one_namespace(self):
        def entries(number):
            _, names = aggregate.expected_files(number)
            result = [zipfile.ZipInfo(name) for name in sorted(names)]
            for entry in result:
                entry.external_attr = (stat.S_IFREG | 0o644) << 16
                entry.file_size = 65536 if entry.filename.endswith("child-terminal.json") else 0
            return result
        first, second = entries(1), entries(2)
        aggregate.validate_archive(first, 1)
        aggregate.validate_archive(second, 2)
        additions = {entry.filename for entry in first if entry.filename.startswith("additional-")}
        self.assertEqual(len(additions), 10)
        qualified = "additional-overflight-host/qualified.json"
        self.assertIn(qualified, additions)
        with self.assertRaises(RuntimeError):
            aggregate.validate_archive([entry for entry in first if entry.filename != qualified], 1)
        duplicated = next(entry for entry in first if entry.filename == qualified)
        with self.assertRaises(RuntimeError):
            aggregate.validate_archive(first + [duplicated], 1)
        with self.assertRaises(RuntimeError):
            aggregate.validate_archive(second + [duplicated], 2)
        wrong = zipfile.ZipInfo("additional-wrong-host/qualified.json")
        wrong.external_attr = (stat.S_IFREG | 0o644) << 16
        with self.assertRaises(RuntimeError):
            aggregate.validate_archive([entry for entry in first if entry.filename != qualified] + [wrong], 1)

    def test_aggregate_bounded_artifact_reads_reject_oversize_and_symlink(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "raw"
            path.write_bytes(b"complete")
            self.assertEqual(aggregate.ordinary(path, 8), b"complete")
            with self.assertRaises(RuntimeError):
                aggregate.ordinary(path, 7)
            linked = Path(temporary) / "linked"
            linked.symlink_to(path)
            with self.assertRaises(RuntimeError):
                aggregate.ordinary(linked, 8)

    def test_aggregate_archive_rejects_traversal_duplicates_symlinks_and_unknown_paths(self):
        _, names = aggregate.expected_files(1)
        entries = [zipfile.ZipInfo(name) for name in sorted(names)]
        for entry in entries:
            entry.file_size = 65536 if entry.filename.endswith("child-terminal.json") else 0
            entry.external_attr = (stat.S_IFREG | 0o644) << 16
        aggregate.validate_archive(entries, 1)
        for unsafe in ("../escape", "/absolute", "x\\y", "unknown.json"):
            bad = zipfile.ZipInfo(unsafe)
            with self.assertRaises(RuntimeError):
                aggregate.validate_archive(entries + [bad], 1)
        with self.assertRaises(RuntimeError):
            aggregate.validate_archive(entries + [entries[0]], 1)
        bad = zipfile.ZipInfo(entries[0].filename)
        bad.external_attr = (stat.S_IFLNK | 0o777) << 16
        with self.assertRaises(RuntimeError):
            aggregate.validate_archive([bad] + entries[1:], 1)
        bad.external_attr = (stat.S_IFREG | 0o644) << 16
        bad.file_size = 13 * guard.MIB
        with self.assertRaises(RuntimeError):
            aggregate.validate_archive([bad] + entries[1:], 1)
        with self.assertRaises(RuntimeError):
            aggregate.validate_archive(entries[:-1], 1)

    def test_aggregate_terminal_requires_exact_padding_and_complete_untampered_raw(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            raw = b"complete"
            (directory / "stdout.log").write_bytes(raw)
            (directory / "stderr.log").write_bytes(b"")
            value = {"started": True, "subreaper": True, "elapsedSeconds": 0.25, "peakObservedOwnedRSSBytes": 1,
                     "exitCode": 0, "guard": None, "captureComplete": True, "outputComplete": True,
                     "outputTruncated": False, "remainingOwnedProcesses": [], "captureErrors": [],
                     "stdoutBytes": len(raw), "stderrBytes": 0, "stdoutSHA256": guard.sha256(raw),
                     "stderrSHA256": guard.sha256(b"")}
            data = json.dumps(value).encode()
            padded = data + b" " * (65536 - len(data))
            terminal = directory / "child-terminal.json"
            terminal.write_bytes(padded)
            self.assertEqual(aggregate.read_terminal(directory)[0], value)
            terminal.write_bytes(padded[:-1])
            with self.assertRaises(RuntimeError):
                aggregate.read_terminal(directory)
            terminal.write_bytes(padded)
            (directory / "stdout.log").write_bytes(b"tampered")
            with self.assertRaises(RuntimeError):
                aggregate.read_terminal(directory)
            (directory / "stdout.log").unlink()
            with self.assertRaises(FileNotFoundError):
                aggregate.read_terminal(directory)

    def test_native_argv_binds_exact_node_and_audited_source_root(self):
        expected = ["/actual/node", "--max-old-space-size=1536", "--test", "--test-concurrency=1",
                    "--experimental-test-isolation=none", "/actual/source/" + guard.WHOLE_FILES[0]]
        aggregate.validate_argv(expected, expected)
        for actual in (["/other/node"] + expected[1:], expected[:-1] + ["/other/source/" + guard.WHOLE_FILES[0]]):
            with self.assertRaises(RuntimeError):
                aggregate.validate_argv(actual, expected)
        auditor = ["/actual/node", "/trusted/auditor.mjs", "--root", "/actual/source"]
        aggregate.validate_argv(auditor, auditor)
        with self.assertRaises(RuntimeError):
            aggregate.validate_argv(["/actual/node", "/other/auditor.mjs", "--root", "/actual/source"], auditor)

    def test_aggregate_trusted_receipt_requires_auditor_workflow_and_candidate(self):
        value = self.aggregate_fixture()[0]["helperProvenance"]["receipt"]
        aggregate.validate_helper_receipt(value, "a" * 40, "b" * 40, "f" * 40)
        for key in ("oid", "sha256", "sourceHead", "sourceTree", "workflowBlob", "workflowCommit"):
            bad = {**value, key: "wrong"}
            with self.assertRaises(RuntimeError):
                aggregate.validate_helper_receipt(bad, "a" * 40, "b" * 40, "f" * 40)

    def test_dependency_version_uses_current_lock_not_stale_initial_version(self):
        with tempfile.TemporaryDirectory() as temporary:
            campaign = self.toy(Path(temporary))
            authoring = campaign.root / "authoring/fpv-worlds"
            installed = authoring / "node_modules/fake-indexeddb"
            installed.mkdir(parents=True)
            (authoring / "package.json").write_text(json.dumps({"devDependencies": {"fake-indexeddb": "^7.0.0"}}))
            (authoring / "package-lock.json").write_text(json.dumps({"packages": {"node_modules/fake-indexeddb": {"version": "7.0.0"}}}))
            package = installed / "package.json"
            package.write_text(json.dumps({"version": "7.0.0"}))
            campaign.pinned_paths = Mock(return_value=[{"current": "immutable input proof"}])
            campaign.dependency_root_identity = Mock(return_value={"contentSHA256": "toy content"})
            self.assertEqual(campaign.dependency_identity()["fakeIndexedDB"], "7.0.0")
            campaign.pinned_paths.assert_called_with(guard.DEPENDENCY_PATHS)
            self.assertEqual(campaign.dependency_root_identity.call_args_list,
                             [unittest.mock.call(campaign.root), unittest.mock.call(authoring)])
            package.write_text(json.dumps({"version": "6.2.5"}))
            with self.assertRaisesRegex(RuntimeError, "immutable lock version"):
                campaign.dependency_identity()

    def test_aggregate_terminal_rejects_impossible_start_time_memory_and_ownership_facts(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / "stdout.log").write_bytes(b"")
            (directory / "stderr.log").write_bytes(b"")
            valid = {"started": True, "subreaper": True, "elapsedSeconds": 180.0,
                     "peakObservedOwnedRSSBytes": guard.RSS_LIMIT, "exitCode": 0, "guard": None,
                     "captureComplete": True, "outputComplete": True, "outputTruncated": False,
                     "remainingOwnedProcesses": [], "captureErrors": [], "stdoutBytes": 0, "stderrBytes": 0,
                     "stdoutSHA256": guard.sha256(b""), "stderrSHA256": guard.sha256(b"")}
            terminal = directory / "child-terminal.json"
            def write(value):
                data = json.dumps(value).encode()
                terminal.write_bytes(data + b" " * (65536 - len(data)))
            write(valid)
            self.assertEqual(aggregate.read_terminal(directory)[0], valid)
            for key, value in (("started", False), ("started", None), ("subreaper", False),
                               ("elapsedSeconds", -1), ("elapsedSeconds", 180.001), ("elapsedSeconds", float("nan")),
                               ("elapsedSeconds", float("inf")), ("elapsedSeconds", True),
                               ("peakObservedOwnedRSSBytes", -1), ("peakObservedOwnedRSSBytes", guard.RSS_LIMIT + 1),
                               ("peakObservedOwnedRSSBytes", 1.5), ("peakObservedOwnedRSSBytes", True)):
                with self.subTest(key=key, value=value):
                    write({**valid, key: value})
                    with self.assertRaises(RuntimeError):
                        aggregate.read_terminal(directory)

    def test_aggregate_campaign_rejects_impossible_elapsed_and_below_floor_capacity(self):
        for key, value in (("elapsedSeconds", -1), ("elapsedSeconds", 2700.001),
                           ("elapsedSeconds", float("nan")), ("elapsedSeconds", float("inf")),
                           ("elapsedSeconds", True), ("freeBytes", guard.FLOOR), ("freeBytes", guard.FLOOR - 1),
                           ("freeBytes", float("inf")), ("freeBytes", True)):
            with self.subTest(key=key, value=value):
                rows = self.aggregate_fixture()
                rows[0][key] = value
                with self.assertRaises(RuntimeError):
                    aggregate.validate_metadata(rows, "a" * 40, "b" * 40)

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
        good = "ok 1 - first\nok 2 - second\n1..2\n# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n"
        self.assertEqual(guard.require_complete_tap(good)["pass"], 2)
        for bad in (good.replace("# pass 2", "# pass 1"), good.replace("# skipped 0", "# skipped 1"),
                    good.replace("# cancelled 0", "# cancelled 1"), good.replace("# fail 0", "# fail 1"),
                    good.replace("# todo 0\n", ""), good + "# pass 2\n", good.replace("1..2", "1..3"),
                    good.replace("1..2\n", ""), good + "1..2\n", good.replace("ok 2", "not ok 2"),
                    "1..0\n# tests 0\n# pass 0\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n"):
            with self.assertRaises(RuntimeError):
                guard.require_complete_tap(bad)

    def test_nested_complete_file_keeps_top_level_plan_distinct_from_total_tests(self):
        text = ("    ok 1 - nested\n    1..1\nok 1 - outer\n1..1\n# tests 2\n# pass 2\n"
                "# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n")
        self.assertEqual(guard.require_complete_tap(text)["topLevelPlan"], 1)
        with self.assertRaises(RuntimeError):
            guard.require_complete_tap(text.replace("    ok 1", "    not ok 1"))

    def test_feature_binding_derives_current63_and_rejects_content_or_inventory_drift(self):
        with tempfile.TemporaryDirectory() as temporary:
            campaign = self.toy(Path(temporary))
            campaign.baseline_feature = None
            entries, names = [], []
            for index in range(66):
                name, content = f"feature-{index}", f"tiny-{index}".encode()
                names.append(name)
                (campaign.root / name).write_bytes(content)
                blob = guard.hashlib.sha1(b"blob " + str(len(content)).encode() + b"\0" + content).hexdigest()
                entries.append(f"100644 blob {blob}\t{name}\0".encode())
            required_inventory_indexes = [list(guard.FEATURE_PATHS).index(name) for name in [
                "optional-practice/civilian-fpv/sim-presentation.mjs",
                "optional-practice/civilian-fpv/style.css",
                "game/test/fpv-world-appearance-ui.test.mjs",
                "game/overflight/raid.html", "game/overflight/raid-upgrade-card.mjs",
                "game/test/overflight-raid-presentation.test.mjs",
            ]]
            selected = tuple(f"test-{i}.mjs" for i in range(28))
            for name in selected:
                (campaign.root / name).write_bytes(b"tiny")
            for filename in guard.ADDITIONAL_WHOLE_FILES + guard.FAMILY_FILES:
                host = campaign.root / filename
                host.parent.mkdir(parents=True, exist_ok=True)
                host.write_bytes(b"tiny")
            campaign.git = Mock(return_value=b"".join(entries))
            with patch.object(guard, "FEATURE_PATHS", tuple(names)), patch.object(guard, "WHOLE_FILES", selected):
                actual = campaign.verify_feature()
                self.assertEqual(actual["featurePaths"], 66)
                self.assertFalse(actual["matchesInitialReference"], "Future immutable heads are not blocked by stale initial blobs")
                (campaign.root / "feature-0").write_bytes(b"drift")
                with self.assertRaisesRegex(RuntimeError, "content drift"):
                    campaign.verify_feature()
                (campaign.root / "feature-0").write_bytes(b"tiny-0")
                (campaign.root / selected[-1]).unlink()
                with self.assertRaises(FileNotFoundError):
                    campaign.verify_feature()
                for missing in required_inventory_indexes:
                    campaign.git = Mock(return_value=b"".join(entries[:missing] + entries[missing + 1:]))
                    with self.assertRaisesRegex(RuntimeError, "required source paths"):
                        campaign.verify_feature()
                campaign.git = Mock(return_value=b"".join(entries[:-1]))
                with self.assertRaisesRegex(RuntimeError, "required source paths"):
                    campaign.verify_feature()


    def test_raid_family_fixed_additions_preserve_original_blocks_and_exact44(self):
        expected = ("game/test/overflight-raid-core.test.mjs", "game/test/overflight-raid-balance.test.mjs", "game/test/overflight-raid-hud.test.mjs", "game/test/overflight-raid-presentation.test.mjs", "game/test/overflight-raid-records.test.mjs", "game/test/overflight-raid-refit-shield.test.mjs", "game/test/overflight-raid-review-pilot.test.mjs", "game/test/overflight-raid-variants.test.mjs", "game/test/overflight-time-attack-medal-goal.test.mjs", "game/test/raid-community.test.mjs", "game/test/raid-project.test.mjs", "game/test/raid-studio-preview.test.mjs", "game/test/overflight-reroll-disclosure.test.mjs", "game/test/overflight-upgrade-consequences.test.mjs", "game/test/overflight-attack-readability.test.mjs")
        self.assertEqual(guard.FAMILY_FILES, expected)
        self.assertEqual(guard.FAMILY_GROUP_SLICES, ((0, 3), (3, 7), (7, 11), (11, 15)))
        flattened = []
        for number, (start, end) in enumerate(guard.FAMILY_GROUP_SLICES, 1):
            original = guard.fixed_phases("/node22", Path("/source"), number)
            extra = guard.additional_phases("/node22", Path("/source"), number)
            selected = original + extra
            self.assertEqual(len(selected), 11)
            self.assertEqual([row[2] for row in original], list(guard.WHOLE_FILES[(number - 1) * 7:number * 7]))
            self.assertEqual([row[2] for row in extra], (list(guard.ADDITIONAL_WHOLE_FILES) if number == 1 else []) + list(expected[start:end]))
            if number == 1:
                self.assertEqual(selected[7][2], "game/test/overflight-host.test.mjs")
            for label, args, filename in selected:
                self.assertEqual(args, ["/node22", "--max-old-space-size=1536", "--test",
                    "--test-concurrency=1", "--experimental-test-isolation=none", str(Path("/source") / filename)])
                self.assertNotIn("--test-name-pattern", args)
                flattened.append((label, filename))
        self.assertEqual(len(flattened), 44)
        self.assertEqual(len({label for label, _ in flattened}), 44)
        self.assertEqual({filename for _, filename in flattened}, set(guard.complete_inventory()))

    def test_raid_family_metadata_requires_exact_complete_inventory_and_group_additions(self):
        rows = self.aggregate_fixture()
        self.assertEqual(json.loads(json.dumps(rows)), rows)
        proof = aggregate.validate_metadata(rows, "a" * 40, "b" * 40)
        self.assertEqual(proof["all44WholeFiles"], list(guard.complete_inventory()))
        self.assertEqual(proof["additionalWholeFiles"], list(guard.ADDITIONAL_WHOLE_FILES + guard.FAMILY_FILES))
        self.assertEqual(proof["additionalCompleteFiles"], 16)
        for mutate in (lambda value: value[0]["all44Inventory"].pop(),
                       lambda value: value[0]["all44Inventory"].reverse(),
                       lambda value: value[1]["all44Inventory"].__setitem__(-1, value[1]["all44Inventory"][0]),
                       lambda value: value[0]["additionalPhases"].pop(),
                       lambda value: value[0]["additionalWholeFiles"].pop(),
                       lambda value: value[2]["additionalWholeFiles"].reverse(),
                       lambda value: value[3]["additionalWholeFiles"].__setitem__(0, value[1]["additionalWholeFiles"][0]),
                       lambda value: value[1]["feature"].update(raidFamilyCompleteFiles=14),
                       lambda value: value[1]["feature"].update(totalCompleteFiles=43)):
            rows = self.aggregate_fixture()
            mutate(rows)
            with self.assertRaises(RuntimeError):
                aggregate.validate_metadata(rows, "a" * 40, "b" * 40)

    def test_raid_archive_exact158_namespace_keeps_original_byte_and_raw_caps(self):
        self.assertEqual(aggregate.GROUP_ZIP_MEMBERS, 158)
        self.assertEqual(aggregate.GROUP_RAW, 8 * guard.MIB)
        self.assertEqual(aggregate.GROUP_ARTIFACT, 12 * guard.MIB)
        for number in range(1, 5):
            directories, files = aggregate.expected_files(number)
            self.assertEqual(len(directories), 36)
            self.assertEqual(len(files), 121)
            entries = []
            for name in sorted(files):
                entry = zipfile.ZipInfo(name)
                entry.external_attr = (stat.S_IFREG | 0o644) << 16
                entry.file_size = 65536 if name.endswith("child-terminal.json") else 0
                entries.append(entry)
            for name in sorted(directories | {"tmp"}):
                entry = zipfile.ZipInfo(name + "/")
                entry.external_attr = (stat.S_IFDIR | 0o755) << 16
                entries.append(entry)
            self.assertEqual(len(entries), 158)
            aggregate.validate_archive(entries, number)
            with self.assertRaises(RuntimeError):
                aggregate.validate_archive(entries + [zipfile.ZipInfo("unknown/")], number)
            target = next(entry.filename for entry in entries if entry.filename.startswith("raid-family-") and entry.filename.endswith("/qualified.json"))
            with self.assertRaises(RuntimeError):
                aggregate.validate_archive([entry for entry in entries if entry.filename != target], number)
            oversized = next(entry for entry in entries if entry.filename.endswith("stdout.log"))
            oversized.file_size = 4 * guard.MIB + 1
            with self.assertRaises(RuntimeError):
                aggregate.validate_archive(entries, number)
        self.assertEqual(guard.LAUNCH_FLOOR, 2550000000)
        self.assertEqual(guard.FLOOR, 2 * 1024 ** 3)
        self.assertEqual(guard.RSS_LIMIT, 2048 * guard.MIB)
        self.assertEqual(guard.WALL_LIMIT, 180)
        self.assertEqual(guard.CAMPAIGN_WALL, 45 * 60)

    def test_formatted_raid_reference_is_pending_and_blocks_native_before_output(self):
        self.assertRegex(guard.FEATURE_MANIFEST_SHA256, r"^[a-f0-9]{64}$")
        self.assertRegex(guard.INITIAL_REFERENCE_LEAF_SHA256, r"^[a-f0-9]{64}$")
        guard.require_formatted_raid_reference()
        for manifest, leaf in ((None, None), ("1" * 63, "2" * 64), ("1" * 64, True),
                               ("PENDING", "2" * 64)):
            with patch.object(guard, "FEATURE_MANIFEST_SHA256", manifest), patch.object(guard, "INITIAL_REFERENCE_LEAF_SHA256", leaf):
                with self.assertRaisesRegex(RuntimeError, "Formatted Raid8"):
                    guard.require_formatted_raid_reference()
        with patch.object(guard, "FEATURE_MANIFEST_SHA256", "1" * 64), patch.object(guard, "INITIAL_REFERENCE_LEAF_SHA256", "2" * 64):
            guard.require_formatted_raid_reference()
        with tempfile.TemporaryDirectory() as temporary:
            campaign = guard.Campaign.__new__(guard.Campaign)
            campaign.output = Path(temporary) / "never-created"
            with patch.object(guard, "FEATURE_MANIFEST_SHA256", None), patch.object(guard.subprocess, "Popen") as spawn:
                with self.assertRaisesRegex(RuntimeError, "Formatted Raid8"):
                    campaign.execute()
            spawn.assert_not_called()
            self.assertFalse(campaign.output.exists())

    def test_trusted_helper_receipt_binds_candidate_and_cannot_change_after_copy(self):
        with tempfile.TemporaryDirectory() as temporary:
            campaign = self.toy(Path(temporary))
            trusted = campaign.root / "trusted"
            trusted.mkdir()
            campaign.helper = trusted / "check-source-identity.mjs"
            campaign.source_sha, campaign.source_tree = "a" * 40, "b" * 40
            campaign.baseline_helper_receipt, campaign.helper_copy_identity = None, None
            campaign.helper_receipt_copied = False
            campaign.git = Mock(return_value=("f" * 40 + "\n").encode())
            value = {"oid": guard.AUDIT_OID, "sha256": guard.AUDIT_SHA256, "bytes": 7275,
                     "sourceHead": campaign.source_sha, "sourceTree": campaign.source_tree,
                     "workflowBlob": "f" * 40, "workflowCommit": "e" * 40,
                     "workflowDefinitionMatchesCandidate": True}
            original = trusted / "helper-source.json"
            data = json.dumps(value).encode()
            original.write_bytes(data)
            first = campaign.helper_provenance()
            copy = campaign.output / "helper-source.json"
            copy.write_bytes(data)
            campaign.helper_receipt_copied = True
            campaign.helper_copy_identity = guard.stable_stat(copy.lstat())
            self.assertEqual(campaign.helper_provenance(), first)
            copy.write_bytes(data + b" ")
            with self.assertRaisesRegex(RuntimeError, "Preserved helper receipt"):
                campaign.helper_provenance()
            value["sourceHead"] = "c" * 40
            original.write_bytes(json.dumps(value).encode())
            with self.assertRaisesRegex(RuntimeError, "does not bind candidate"):
                campaign.helper_provenance()

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
        campaign.additional_results = []
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
