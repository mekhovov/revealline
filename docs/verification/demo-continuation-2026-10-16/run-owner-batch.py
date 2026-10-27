"""One finite sequential production-budget audit; never retries a failed owner."""

import datetime
import json
import os
import re
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = Path(__file__).resolve().parent
STATE = EVIDENCE / "batch-state.json"
if len(sys.argv) != 2 or not re.fullmatch(r"[0-9a-f]{40}", sys.argv[1]) or STATE.exists():
    raise SystemExit("Pass the frozen source commit once; an existing batch cannot be replaced.")
SOURCE = sys.argv[1]


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def unchanged():
    subprocess.run(
        ["git", "--no-optional-locks", "diff", "--quiet", SOURCE, "--",
         "game", "scripts", "optional-practice", "package.json", "package-lock.json"],
        cwd=ROOT, check=True,
    )


state = {"format": "revealline-demo-owner-batch.v1", "sourceCommit": SOURCE,
         "pid": os.getpid(), "startedAt": now(), "status": "running", "runs": []}


def save():
    temporary = STATE.with_suffix(".json.next")
    temporary.write_text(json.dumps(state, indent=2) + "\n")
    temporary.replace(STATE)


child = None
try:
    unchanged()
    save()
    for owner, flags in [("base", []), ("journey", ["--journey"]), ("droneaid", ["--edition", "droneaid"])]:
        unchanged()
        report, log = EVIDENCE / f"{owner}-final.json", EVIDENCE / f"{owner}-final.log"
        if report.exists() or log.exists():
            raise RuntimeError(f"Refusing to replace existing {owner} evidence.")
        command = ["node", "scripts/audit-demo-availability.mjs", *flags,
                   "--report", str(report.relative_to(ROOT))]
        run = {"owner": owner, "command": command, "startedAt": now(), "status": "running"}
        state["runs"].append(run)
        save()
        with log.open("w") as output:
            child = subprocess.Popen(command, cwd=ROOT, stdout=output, stderr=subprocess.STDOUT)
            run["pid"] = child.pid
            save()
            run["exitCode"] = child.wait()
        run.update(status="completed", finishedAt=now())
        unchanged()
        save()
    state["status"] = "completed"
except BaseException as error:
    state.update(status="interrupted", error=f"{type(error).__name__}: {error}")
    if child is not None and child.poll() is None:
        child.terminate()
        try:
            child.wait(timeout=10)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait()
        state["runs"][-1].update(status="interrupted", exitCode=child.returncode)
    raise
finally:
    state["finishedAt"] = now()
    save()
