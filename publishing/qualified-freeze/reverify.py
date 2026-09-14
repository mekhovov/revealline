"""Independently check frozen artifact bytes on a fresh runner; never publish."""
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile


BASE = Path(__file__).resolve().parent
REPOSITORY = "mekhovov/revealline"
FREEZE_RUN = 34904714317
FREEZE_CONTROLLER = "7c227dc92954a9d8ce654a2e235ce805934b8847"
VERIFIER_SHA = "702e62c2cd5d252ade5c4ba864571a0f589f7428c814c503ee264e72f4379dbe"
METADATA_MEMBER_LIMIT = 16 * 1024 * 1024
METADATA_TOTAL_LIMIT = 32 * 1024 * 1024


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    with path.open("x") as output:
        json.dump(value, output, indent=2)
        output.write("\n")


def load_verifier():
    path = BASE / "verify-artifact-bodies.py"
    require(sha(path) == VERIFIER_SHA, "Independent verifier bytes changed")
    spec = importlib.util.spec_from_file_location("independent_artifact_verifier", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def validate_run(run):
    require(run["id"] == FREEZE_RUN and run["head_sha"] == FREEZE_CONTROLLER
            and run["head_branch"] == "codex/hosted-qualified-freezes"
            and run["repository"]["full_name"] == REPOSITORY
            and run["head_repository"]["full_name"] == REPOSITORY
            and run["event"] == "push"
            and run["path"] == ".github/workflows/freeze-qualified-sources.yml"
            and run["status"] == "completed" and run["conclusion"] == "success"
            and run["run_attempt"] == 1, "Original freeze run is not the pinned successful run")


def validate_artifact(actual, expected, role, version):
    require(expected["name"] == f"frozen-{version}-{role}", "Unexpected pinned artifact name")
    require(all(actual[key] == expected[key] for key in ("id", "name", "size_in_bytes", "digest")),
            "Immutable artifact row differs")
    require(actual["expired"] is False and expected["expired"] is False, "Artifact expired")
    for record in (actual, expected):
        owner = record["workflow_run"]
        require(owner["id"] == FREEZE_RUN and owner["head_sha"] == FREEZE_CONTROLLER
                and owner["head_branch"] == "codex/hosted-qualified-freezes"
                and owner["repository_id"] == owner["head_repository_id"] == 1367404328,
                "Artifact belongs to another run or repository")


def extract_metadata(verifier, archive_path, target, row, version):
    verifier.verify_transport(archive_path, row, "metadata", version)
    require(not target.exists(), "Metadata extraction target already exists")
    with zipfile.ZipFile(archive_path) as archive:
        members = verifier.member_list(archive)
        require({member.filename for member in members} == verifier.METADATA_NAMES,
                "Metadata wrapper has unexpected members")
        require(all(member.file_size <= METADATA_MEMBER_LIMIT for member in members)
                and sum(member.file_size for member in members) <= METADATA_TOTAL_LIMIT,
                "Metadata exceeds bounded extraction limits")
        target.mkdir()
        for member in members:
            require("/" not in member.filename, "Metadata must be flat")
            with archive.open(member) as body, (target / member.filename).open("xb") as output:
                _, size = verifier.stream_hash(body, maximum=member.file_size, destination=output)
            require(size == member.file_size, "Metadata member size differs")


def validate_metadata(metadata, source_pin, artifact_pins):
    qpath, rpath = metadata / "source-qualification.json", metadata / "receipt-qualified.json"
    require(sha(qpath) == source_pin["qualificationSha256"]
            and sha(rpath) == source_pin["receiptSha256"], "Exact source qualification bytes differ")
    qualification = json.loads(qpath.read_bytes())
    receipt = json.loads(rpath.read_bytes())
    invocation = json.loads((metadata / "freeze-invocation.json").read_bytes())
    require(qualification["passed"] is True and receipt["qualifiedExactSourceContent"] is True,
            "Source qualification is not passed")
    require(qualification["sourceRevision"] == receipt["candidateCommit"] == source_pin["sourceRevision"]
            and qualification["sourceTree"] == receipt["candidateTree"] == source_pin["sourceTree"],
            "Source qualification identity differs")
    require(invocation["sourceRevision"] == source_pin["sourceRevision"]
            and invocation["sourceTree"] == source_pin["sourceTree"]
            and invocation["sourceRunId"] == source_pin["runId"]
            and invocation["qualificationSha256"] == source_pin["qualificationSha256"]
            and invocation["node"] == source_pin["node"]
            and invocation["runId"] == artifact_pins["freezeRunId"] == FREEZE_RUN
            and invocation["runAttempt"] == 1
            and invocation["controllerRevision"] == FREEZE_CONTROLLER,
            "First freeze invocation differs")


def main(version, source_arg, export_arg):
    require(version in ("v0.49.0", "v0.50.0", "v0.51.0"), "Unlisted version")
    source, export = Path(source_arg).resolve(), Path(export_arg).resolve()
    require(not export.exists(), "Existing re-verification output")
    export.mkdir(parents=True)
    proof = export / "proof"
    proof.mkdir()
    write_json(proof / "request.json", {"version": version,
        "independentVerifierControllerRevision": os.environ.get("GITHUB_SHA"),
        "firstFreezeControllerRevision": FREEZE_CONTROLLER, "firstFreezeRunId": FREEZE_RUN,
        "artifactOnly": True, "publicationPerformed": False})
    verifier = load_verifier()
    pins_path = BASE / "reverify-pins" / (version + ".json")
    pins = json.loads(pins_path.read_bytes())
    source_config = json.loads((BASE / "sources.json").read_bytes())
    source_pin = next(row for row in source_config["sources"] if row["version"] == version)
    require(source_config["repository"] == REPOSITORY
            and pins["format"] == "revealline-hosted-freeze-artifacts.v1"
            and pins["version"] == version and pins["sourceRevision"] == source_pin["sourceRevision"]
            and pins["freezeControllerRevision"] == FREEZE_CONTROLLER
            and pins["freezeRunId"] == FREEZE_RUN
            and set(pins["artifacts"]) == {"metadata", "source", "distribution"}, "Wrong artifact pins")
    def git(root, *args):
        return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()
    controller = git(BASE.parents[1], "rev-parse", "HEAD")
    require(controller == os.environ["GITHUB_SHA"], "Independent controller checkout differs")
    require(git(source, "rev-parse", "HEAD") == source_pin["sourceRevision"]
            and git(source, "rev-parse", "HEAD^{tree}") == source_pin["sourceTree"]
            and not git(source, "status", "--porcelain", "--untracked-files=no"), "Fresh source checkout differs")
    free = shutil.disk_usage(export).free
    require(free >= 8 * 1024**3, "Independent verification requires 8 GiB free")
    write_json(proof / "invocation.json", {"version": version,
        "sourceRevision": source_pin["sourceRevision"], "sourceTree": source_pin["sourceTree"],
        "sourceQualificationRunId": source_pin["runId"], "firstFreezeControllerRevision": FREEZE_CONTROLLER,
        "firstFreezeRunId": FREEZE_RUN, "independentVerifierControllerRevision": controller,
        "independentVerifierRunId": int(os.environ["GITHUB_RUN_ID"]),
        "independentVerifierRunAttempt": int(os.environ["GITHUB_RUN_ATTEMPT"]),
        "verifierSha256": VERIFIER_SHA, "wrapperSha256": sha(Path(__file__)),
        "pinsSha256": sha(pins_path), "freeBytesBefore": free,
        "python": sys.version, "startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()})
    def api(endpoint):
        return json.loads(subprocess.check_output(["gh", "api", f"repos/{REPOSITORY}/{endpoint}"], timeout=120))
    run = api(f"actions/runs/{FREEZE_RUN}")
    validate_run(run)
    write_json(proof / "original-freeze-run.json", run)
    live_artifacts = {}
    for role, row in pins["artifacts"].items():
        live = api(f"actions/artifacts/{row['id']}")
        validate_artifact(live, row, role, version)
        live_artifacts[role] = live
    write_json(proof / "live-artifact-rows.json", live_artifacts)
    shutil.copyfile(pins_path, proof / "artifact-pins.json")
    inputs = export / "inputs"
    inputs.mkdir()
    for role in ("metadata", "source", "distribution"):
        row = pins["artifacts"][role]
        target = inputs / (role + ".zip")
        # Binary bytes go only to a new file, never through terminal rendering.
        with target.open("xb") as body, (proof / (role + "-download.log")).open("xb") as error:
            process = subprocess.run(["gh", "api", "--allow-escape-sequences",
                f"repos/{REPOSITORY}/actions/artifacts/{row['id']}/zip"],
                stdout=body, stderr=error, timeout=1800)
        require(process.returncode == 0, role + " artifact download failed; retain its diagnostic log")
        verifier.verify_transport(target, row, role, version)
    metadata = inputs / "metadata"
    extract_metadata(verifier, inputs / "metadata.zip", metadata, pins["artifacts"]["metadata"], version)
    validate_metadata(metadata, source_pin, pins)
    args = [sys.executable, "-B", str(BASE / "verify-artifact-bodies.py"),
        "--pins", str(pins_path), "--metadata", str(metadata), "--metadata-zip", str(inputs / "metadata.zip"),
        "--source-zip", str(inputs / "source.zip"), "--distribution-zip", str(inputs / "distribution.zip"),
        "--git-root", str(source), "--out", str(export / "verified")]
    with (proof / "verification.log").open("xb") as log:
        result = subprocess.run(args, stdout=log, stderr=subprocess.STDOUT, timeout=1800)
    require(result.returncode == 0, "Independent artifact verifier failed; retain verification.log")
    local_path = export / "verified/local-artifact-integrity.json"
    local = json.loads(local_path.read_bytes())
    require(local["passed"] is True and local["looseFilesVerified"] is False,
            "Independent artifact proof missing or mislabeled")
    require(not git(source, "status", "--porcelain", "--untracked-files=no"), "Verification changed source checkout")
    shutil.copyfile(local_path, proof / "local-artifact-integrity.json")
    shutil.copytree(metadata, proof / "original-freeze-metadata")
    summary = {"format": "revealline-hosted-independent-artifact-verification.v1", "passed": True,
        "version": version, "sourceRevision": source_pin["sourceRevision"], "sourceTree": source_pin["sourceTree"],
        "sourceQualificationRunId": source_pin["runId"], "firstFreezeControllerRevision": FREEZE_CONTROLLER,
        "firstFreezeRunId": FREEZE_RUN, "independentVerifierControllerRevision": controller,
        "independentVerifierRunId": int(os.environ["GITHUB_RUN_ID"]),
        "independentVerifierRunAttempt": int(os.environ["GITHUB_RUN_ATTEMPT"]),
        "pinsSha256": sha(pins_path), "verifierSha256": VERIFIER_SHA,
        "independentArtifactProofSha256": sha(local_path),
        "originalHostedLooseProofSha256": sha(metadata / "frozen-integrity.json"),
        "originalHostedLooseFilesVerified": True, "independentLooseFilesVerified": False,
        "allThreeTransportBodiesVerified": True, "sourceArchiveEqualsFreshGitArchive": True,
        "sourceGitBodiesAndExecutableModesVerified": local["sourceGitBodiesAndExecutableModesVerified"],
        "zipMemberBodiesVerified": True, "zipCRCsVerified": True,
        "gameBuildPerformed": False, "publicationPerformed": False,
        "verifiedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()}
    write_json(proof / "verification.json", summary)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    try:
        require(len(sys.argv) == 4, "Expected version, source checkout, and new export directory")
        main(*sys.argv[1:])
    except Exception as error:
        if len(sys.argv) == 4:
            proof = Path(sys.argv[3]).resolve() / "proof"
            if proof.is_dir() and not (proof / "failure.json").exists():
                write_json(proof / "failure.json", {"passed": False, "errorType": type(error).__name__,
                    "message": str(error)[:2000], "at": datetime.datetime.now(datetime.timezone.utc).isoformat()})
        raise
