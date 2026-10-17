"""Verify retained FPV input-recovery delivery evidence without downloading builds."""

from pathlib import Path
from urllib.parse import urljoin
import datetime
import hashlib
import json

if not __debug__:
    raise RuntimeError("Run this evidence verifier without Python optimization (-O).")

ROOT = Path(__file__).resolve().parents[2]
DELIVERY = ROOT / "docs/fpv-input-recovery-delivery"
HEAD = "13675fd0070ef5efb0b6bdb901f33922d27a6484"
MAXIMUM_BYTES = 980_000_000
PACKAGE_IDS = {"civilian-fpv", "fpv-worlds"}
STARTUP_STAGES = {
    "fresh-password",
    "saved-profile-reload",
    "installed-worker-reload",
    "offline-process-reopen",
}
RECORDING_LABELS = {"before-input-loss", "input-unavailable", "resumed"}
PUBLIC_PATH = "docs/fpv-input-recovery-public-acceptance.json"
LIVE_PATH = "docs/fpv-input-recovery-live-acceptance.json"
LOCAL_PATH = "docs/fpv-input-recovery-verification.json"
NATIVE_PATH = "docs/fpv-input-recovery-native-runtime.json"
STAGING_PATH = "docs/fpv-input-recovery-native-staging.json"
NUMERICAL_PATH = "docs/fpv-advanced-runtime-post-publication-qualification.json"
PRACTICE_PATH = "optional-practice/civilian-fpv/advanced-practice.mjs"
SIMULATION_PATH = "optional-practice/civilian-fpv/advanced-simulation.mjs"


def read(relative):
    return json.loads((ROOT / relative).read_text())


def pin(relative):
    content = (ROOT / relative).read_bytes()
    return {
        "path": str(relative),
        "bytes": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
    }


def check_pin(row):
    actual = pin(row["path"])
    assert actual["sha256"] == row["sha256"], row["path"]
    if "bytes" in row:
        assert actual["bytes"] == row["bytes"], row["path"]


def indexed(rows, field, expected):
    """Reject duplicates as well as missing or unexpected evidence entries."""
    result = {row[field]: row for row in rows}
    assert len(result) == len(rows) == len(expected), (field, expected)
    assert set(result) == expected, (field, set(result), expected)
    return result


def check_recording(row):
    check_pin(row)
    record = read(row["path"])
    assert record["format"] == "AdvancedRecording.v1"
    assert record["scored"] is False
    assert record["missionTicks"] == row["missionTicks"]
    assert record["finalHash"] == row["finalHash"]
    rates = record["config"]["configuration"]["rateProfile"]
    assert rates["axes"]["roll"]["rate"] == 90
    return record


def check_worker(worker, package, expected_revision):
    assert worker["ready"] is True
    assert worker["revision"] == expected_revision
    assert worker["scope"] == package["base"]
    assert worker["controllerURL"] == urljoin(package["base"], "worker.js")


ci = read("docs/fpv-input-recovery-ci.json")
merge = read("docs/fpv-input-recovery-delivery/merge.json")
publication = read("docs/fpv-input-recovery-delivery/publication-final.json")
public = read(PUBLIC_PATH)
local = read(LOCAL_PATH)
assert ci["format"] == "FpvInputRecoveryCI.v1" and ci["pass"] is True
assert ci["number"] == 1565 and ci["headRefOid"] == HEAD
assert merge["state"] == "MERGED" and merge["headRefOid"] == HEAD
revision = merge["mergeCommit"]["oid"]

expected_jobs = {
    ("Appearance preview", "preview"): "SUCCESS",
    ("Company edition candidates", "optional-practice"): "SUCCESS",
    ("Company edition candidates", "candidate"): "SUCCESS",
    ("Validate source for continuous main", "preflight"): "SUCCESS",
    ("Validate source for continuous main", "focused"): "SUCCESS",
    ("Validate source for continuous main", "release-ready"): "SUCCESS",
    ("Validate source for continuous main", "build"): "SKIPPED",
    ("Validate source for continuous main", "test"): "SKIPPED",
}
for feature in ["gameplay", "creator", "presentation", "recordings", "rooms", "local-ux"]:
    expected_jobs[("Industrial feature verification", f"feature ({feature})")] = "SUCCESS"
workflows = {workflow for workflow, _ in expected_jobs}
product = [row for row in ci["statusCheckRollup"] if row["workflowName"] in workflows]
actual_jobs = {(row["workflowName"], row["name"]): row for row in product}
assert len(actual_jobs) == len(product) == len(expected_jobs) == 14
assert set(actual_jobs) == set(expected_jobs)
for identity, conclusion in expected_jobs.items():
    assert actual_jobs[identity]["status"] == "COMPLETED", identity
    assert actual_jobs[identity]["conclusion"] == conclusion, identity
passed = [row for row in product if row["conclusion"] == "SUCCESS"]
skipped = sorted(row["name"] for row in product if row["conclusion"] == "SKIPPED")
assert len(passed) == ci["nonSkippedProductChecks"] == 12
assert skipped == ci["skippedGeneralJobs"] == ["build", "test"]

assert publication["headSha"] == revision
assert publication["status"] == "completed" and publication["conclusion"] == "success"
publication_jobs = indexed(publication["jobs"], "name", {"build", "deploy", "verify"})
for job in publication_jobs.values():
    assert job["status"] == "completed" and job["conclusion"] == "success"

assert local["format"] == "FpvInputRecoveryVerification.v1" and local["pass"] is True
assert local["checks"]["practiceTests"] == 741
assert local["checks"]["practiceFailed"] == local["checks"]["practiceSkipped"] == 0
for row in local["sources"] + local["evidence"]:
    check_pin(row)

native = read(NATIVE_PATH)
staging = read(STAGING_PATH)
assert native["format"] == "FpvInputRecoveryNativeRuntime.v1" and native["pass"] is True
assert native["desktopFixtureRuntimeVerified"] is True and not native["failures"]
assert staging["format"] == "FpvInputRecoveryNativeStaging.v1"
assert staging["pass"] is True and staging["sourceStable"] is True
assert len(staging["sourceHashes"]) == native["sourceBinding"]["sourceHashCount"] == 209
assert native["sourceBinding"]["report"] == STAGING_PATH
assert native["sourceBinding"]["sha256"] == pin(STAGING_PATH)["sha256"]
assert native["sourceBinding"]["sourceStable"] is True
assert native["sourceBinding"]["advancedPracticeSha256"] == pin(PRACTICE_PATH)["sha256"]
assert local["desktopFollowup"]["report"] == NATIVE_PATH
assert local["desktopFollowup"]["sha256"] == pin(NATIVE_PATH)["sha256"]
assert local["desktopFollowup"]["pass"] is True
assert local["desktopFollowup"]["sourcePins"] == 209
assert local["desktopFollowup"]["retainedFlightPrefix"] is True
assert native["verification"]["retainedFlightPrefix"] is True
assert native["verification"]["sourceStable"] is True
assert native["process"]["exitCode"] == 0
assert native["process"]["workers"] == {"created": 2, "terminated": 2, "live": 0}
for relative, digest in staging["sourceHashes"].items():
    assert pin(relative)["sha256"] == digest, relative
for row in native["artifacts"]:
    check_pin(row)

numerical = read(NUMERICAL_PATH)
assert local["numericalEvidenceReuse"]["report"] == NUMERICAL_PATH
assert local["numericalEvidenceReuse"]["sourcePins"] == 20
assert local["numericalEvidenceReuse"]["allStillMatch"] is True
assert local["numericalEvidenceReuse"]["freshTimingBenchmarkPerformed"] is False
assert numerical["format"] == "AdvancedRuntimeQualification.v1"
assert numerical["sourceStable"] is True
assert numerical["measuredDeterminismPass"] is True
assert numerical["measuredTimingPass"] is True
num = numerical["sources"]
assert len(num) == len({row["path"] for row in num}) == 20
for row in num:
    check_pin(row)
# Reusing this bounded numerical result does not qualify its wider platform matrix.
assert numerical["fullPlatformMatrixQualified"] is False
assert numerical["scoredEligible"] is False and numerical["defaultEligible"] is False

assert public["format"] == "FPVPublicFreshInstallEvidence.v1"
assert public["passed"] is True and public["expectedRevision"] == revision
assert public["publicBindingStable"] is True and public["runnerStable"] is True
assert public["runnerSha256"] == public["runnerFinalSha256"]
assert public["runnerSha256"] == pin("scripts/smoke-fpv-public-fresh-install.mjs")["sha256"]
assert public["publicBinding"]["metadata"]["sourceRevision"] == revision
assert public["publicBinding"]["metadata"]["channel"] == "main"
assert public["publicBinding"]["metadata"]["buildVersion"] == f"main-{revision[:12]}"
packages = public["packages"]
public_packages = indexed(packages, "id", PACKAGE_IDS)
for package in packages:
    expected_base = urljoin(public["publicRoot"], f"optional-practice/{package['id']}/")
    assert package["base"] == expected_base
    for flag in [
        "passed",
        "initiallyLocked",
        "passwordFormAccepted",
        "browserRestartedOffline",
        "offlineNavigationFromServiceWorker",
        "ratesPersisted",
        "replayVerified",
    ]:
        assert package[flag] is True, (package["id"], flag)
    assert not package["pageErrors"]
    assert package["workerCleanup"]["created"] == package["workerCleanup"]["terminated"] == 1
    record = check_recording(package["recording"])
    assert package["workerCleanup"]["tick"] == record["missionTicks"]
    for key in ["installedWorker", "offlineWorker"]:
        check_worker(package[key], package, public["publicBinding"]["workers"][package["id"]])
    stages = indexed(package["startups"], "stage", STARTUP_STAGES)
    for stage in stages.values():
        assert stage["passed"] is True and "captureFailure" not in stage
        assert stage["state"]["access"] == "unlocked"
        assert stage["state"]["settingsPresent"] is True
        assert stage["state"]["shellPending"] is False

live = read(LIVE_PATH)
assert live["format"] == "FpvLiveInputRecoveryAcceptance.v1"
assert live["passed"] is True and live["expectedRevision"] == revision
assert live["runner"]["stable"] is True and live["installReport"]["stable"] is True
assert live["publicBindingStable"] is True
assert live["runner"]["sha256"] == live["runner"]["finalSha256"]
live_runner = pin("docs/fpv-input-recovery-delivery/live-input-recovery.mjs")
assert live["runner"]["sha256"] == live_runner["sha256"]
assert live["installReport"]["sha256"] == pin(PUBLIC_PATH)["sha256"]
assert live["publicRoot"] == public["publicRoot"]
assert live["publicBinding"]["metadata"] == public["publicBinding"]["metadata"]
for key in ["metadataSha256", "manifestSha256"]:
    assert live["publicBinding"][key] == public["publicBinding"][key]
assert set(live["publicBinding"]["pins"]) == {PRACTICE_PATH, SIMULATION_PATH}
for relative, row in live["publicBinding"]["pins"].items():
    assert row == public["publicBinding"]["pins"][relative], relative
live_packages = indexed(live["packages"], "id", PACKAGE_IDS)
for package in live_packages.values():
    installed = public_packages[package["id"]]
    assert package["passed"] is True and not package["pageErrors"]
    assert package["gamepadsPresent"] == 0 and package["rememberedUnlock"] is True
    assert package["base"] == installed["base"] and package["profile"] == installed["profile"]
    check_worker(
        package["installedWorker"],
        installed,
        public["publicBinding"]["workers"][package["id"]],
    )
    for key in [
        "recordingUnchangedAfterInputFailure",
        "keyboardSelectionDoesNotResume",
        "explicitRestartCreatesNewFlight",
    ]:
        assert package["checks"][key] is True, key
    assert package["checks"]["exactPrefixAndContinuousSequences"]["hashes"] > 0
    recordings = indexed(package["recordings"], "label", RECORDING_LABELS)
    records = {}
    for label, row in recordings.items():
        records[label] = check_recording(row)
        assert row["replay"]["verified"] is True
        assert row["replay"]["verificationScope"] == "complete"
        assert row["replay"]["verifiedThroughMission"] == row["missionTicks"]
    before = records["before-input-loss"]
    retained = records["input-unavailable"]
    resumed = records["resumed"]
    assert before == retained
    assert before["hashes"] and resumed["missionTicks"] > retained["missionTicks"]
    assert resumed["inputs"][: len(retained["inputs"])] == retained["inputs"]
    assert resumed["hashes"][: len(retained["hashes"])] == retained["hashes"]
    assert [sample[1] for sample in resumed["inputs"]] == list(range(len(resumed["inputs"])))
    prefix = package["checks"]["exactPrefixAndContinuousSequences"]
    assert prefix["inputs"] == len(retained["inputs"])
    assert prefix["hashes"] == len(retained["hashes"])
    assert prefix["totalInputs"] == len(resumed["inputs"])
    workers = indexed(package["workerCleanup"], "id", {0, 1})
    for worker in workers.values():
        assert worker["terminated"] is True and worker["pendingSteps"] == 0
        assert worker["url"] == urljoin(package["base"], "advanced-worker.mjs")
    assert workers[0]["missionTick"] == resumed["missionTicks"]
    assert workers[0]["steps"] == len(resumed["inputs"])
    assert workers[1]["missionTick"] == workers[1]["steps"] == 0
    assert {row["path"] for row in package["servedSources"]} == {PRACTICE_PATH, SIMULATION_PATH}
    for row in package["servedSources"]:
        expected = public["publicBinding"]["pins"][row["path"]]
        assert row["sha256"] == expected["sha256"] and row["bytes"] == expected["bytes"]

archive = read("docs/fpv-input-recovery-delivery/archive/main-pages-archive-receipt.json")
staged = read("docs/fpv-input-recovery-delivery/staged/main-pages-receipt.json")
invpath = "docs/fpv-input-recovery-delivery/staged/main-pages-inventory.json"
inventory = read(invpath)
assert archive["format"] == "revealline-main-pages-archive-receipt.v1"
assert staged["format"] == "revealline-main-pages-receipt.v1"
assert inventory["format"] == "revealline-main-pages-inventory.v1"
for receipt in [inventory, staged, archive]:
    assert receipt["sourceRevision"] == revision
assert inventory["completeInventory"] is True and staged["completeInventory"] is True
assert staged["capacityAccepted"] is True and staged["withinCapacity"] is True
assert archive["archiveAccepted"] is True and not archive["errors"]
assert staged["maximumBytes"] == archive["maximumArchiveBytes"] == MAXIMUM_BYTES
rows = inventory["files"]
mapping = {row["path"]: row for row in rows}
assert len(mapping) == len(rows) == staged["files"] == archive["files"] > 0
assert all(type(row["bytes"]) is int and row["bytes"] >= 0 for row in rows)
assert sum(row["bytes"] for row in rows) == staged["bytes"] == archive["stagedBytes"]
assert pin(invpath)["sha256"] == staged["inventorySha256"] == archive["inventorySha256"]
assert 0 <= staged["bytes"] <= archive["archiveBytes"] <= MAXIMUM_BYTES
assert archive["overheadBytes"] == archive["archiveBytes"] - archive["stagedBytes"]
index = read("docs/fpv-input-recovery-delivery/artifact-index.json")
artifacts = [row for row in index["artifacts"] if str(row["id"]) == archive["artifactId"]]
assert len(artifacts) == 1
artifact = artifacts[0]
assert artifact["name"] == "github-pages"
assert artifact["workflow_run"]["id"] == publication["databaseId"]
assert artifact["workflow_run"]["head_sha"] == revision
assert artifact["workflow_run"]["head_branch"] == "main"
assert mapping["main-deployment.json"]["sha256"] == public["publicBinding"]["metadataSha256"]
assert mapping["manifest.json"]["sha256"] == public["publicBinding"]["manifestSha256"]
for relative, row in public["publicBinding"]["pins"].items():
    assert row["path"] == relative
    assert mapping[relative]["sha256"] == row["sha256"], relative
    assert mapping[relative]["bytes"] == row["bytes"], relative
runtime = [
    PRACTICE_PATH,
    "optional-practice/civilian-fpv/advanced-regional.mjs",
    "optional-practice/civilian-fpv/betaflight-import.mjs",
]
for relative in runtime:
    assert public["publicBinding"]["pins"][relative]["sha256"] == pin(relative)["sha256"], relative

report = {
    "format": "FpvInputRecoveryDeliveryVerification.v1",
    "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "pass": True,
    "softwareDeliveryComplete": True,
    "scope": (
        "Available input-recovery software, reviewed diagnostic metadata correction, ordinary "
        "publication, current desktop fixture and fresh public Chrome installs. Deferred physical "
        "and wider-platform gates remain open."
    ),
    "pullRequest": "https://github.com/mekhovov/revealline/pull/1565",
    "implementationHead": HEAD,
    "deployedRevision": revision,
    "publication": publication["url"],
    "checks": {
        "practiceTests": 741,
        "nonSkippedProductChecks": len(passed),
        "skippedGeneralJobs": skipped,
        "publicationJobs": {name: row["conclusion"] for name, row in publication_jobs.items()},
        "localSourcePins": len(local["sources"]),
        "localEvidencePins": len(local["evidence"]),
        "publicPasswordAndOfflinePackages": len(public_packages),
        "publicSourcePinsMatchHostedInventory": len(public["publicBinding"]["pins"]),
        "publishedChangedRuntimeMatchesRepository": True,
        "publicRunnerStable": True,
        "startupStagesPassed": sum(len(package["startups"]) for package in packages),
        "liveInputRecoveryPackages": len(live_packages),
        "liveInputRecoveryRecordingsReplayed": sum(
            len(package["recordings"]) for package in live_packages.values()
        ),
        "liveInputRecoveryWorkersDisposed": sum(
            len(package["workerCleanup"]) for package in live_packages.values()
        ),
        "nativeSourcePins": len(staging["sourceHashes"]),
        "nativeArtifactHashesVerified": len(native["artifacts"]),
        "priorNumericalSourcesStillMatch": len(num),
        "newNumericalBenchmarkPerformed": False,
        "iosRuntimeVerified": False,
    },
    "capacity": {
        "files": len(rows),
        "stagedBytes": staged["bytes"],
        "actualArchiveBytes": archive["archiveBytes"],
        "maximumBytes": archive["maximumArchiveBytes"],
        "archiveHeadroomBytes": archive["maximumArchiveBytes"] - archive["archiveBytes"],
        "inventoryCountSumAndUniquePathsVerified": True,
        "inventoryDigestVerified": True,
        "hostedArchiveArtifactIdVerified": archive["artifactId"],
        "hostedArchiveSha256": archive["archiveSha256"],
        "archiveDownloadRepeatedLocally": False,
    },
    "publicAcceptance": {
        "browser": public["browser"],
        "packages": [
            {
                "id": package["id"],
                "missionTicks": package["recording"]["missionTicks"],
                "finalHash": package["recording"]["finalHash"],
                "recordingSha256": package["recording"]["sha256"],
                "workerCleanup": package["workerCleanup"],
                "startupStages": [
                    {
                        key: stage[key]
                        for key in ["stage", "passed", "elapsedMs", "pendingRequests"]
                    }
                    for stage in package["startups"]
                ],
            }
            for package in packages
        ],
        "neutralInputLifecycleOnly": True,
    },
    "liveInputRecovery": {
        "report": LIVE_PATH,
        "packages": [
            {key: package[key] for key in ["id", "recordings", "checks", "workerCleanup"]}
            for package in live["packages"]
        ],
    },
    "limitations": [
        (
            "Advanced remains optional, unscored and default-ineligible. Physical radio/touch, "
            "pilot feedback, aircraft measurements, iOS execution and wider hardware remain "
            "deferred. Validated propwash/ground effect and scored/default promotion remain gated."
        ),
        (
            "Current public acceptance covers fresh password entry, saved rates, offline process "
            "reopen and short neutral-input recording replay/disposal. It does not qualify "
            "physical controls, maximum-duration native flight, every installed-update path "
            "or startup reliability."
        ),
        (
            "The earlier World readiness timeout remains failed and unexplained in "
            "docs/fpv-boundary-public-acceptance.json. Three later baseline observations and "
            "this acceptance do not establish its cause."
        ),
        (
            "New startup request/capture metadata uses finite error categories. This does not "
            "claim unchanged outer action-error stacks or page-error logs are globally URL-free."
        ),
        (
            "Desktop execution is a labelled Electron fixture on one ARM64 Mac; production "
            "authentication, signed installers and iOS runtime were not exercised."
        ),
        (
            "Archive capacity uses retained hosted verification bound to inventory and artifact "
            "ID; the large Pages archive was not downloaded again locally. No gate bypass, "
            "manual merge or deployment was used."
        ),
    ],
    "evidence": [],
}
paths = {
    str(file.relative_to(ROOT))
    for file in DELIVERY.rglob("*")
    if file.is_file() and "__pycache__" not in file.parts
}
paths.update(
    [
        "docs/fpv-input-recovery-ci.json",
        LOCAL_PATH,
        "docs/fpv-input-recovery-browser.json",
        NATIVE_PATH,
        STAGING_PATH,
        PUBLIC_PATH,
        "docs/fpv-input-recovery-startup-public-baseline.json",
        LIVE_PATH,
        NUMERICAL_PATH,
    ]
)
paths.update(row["path"] for row in local["evidence"] + native["artifacts"])
paths.update(package["recording"]["path"] for package in packages)
paths.update(row["path"] for package in live["packages"] for row in package["recordings"])
report["evidence"] = [pin(relative) for relative in sorted(paths)]
output = ROOT / "docs/fpv-input-recovery-delivery-verification.json"
output.write_text(json.dumps(report, indent=2) + "\n")
print(
    json.dumps(
        {key: report[key] for key in ["pass", "deployedRevision", "checks", "capacity"]},
        indent=2,
    )
)
