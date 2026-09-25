#!/usr/bin/env python3
"""Verify every immutable Archive84 public byte against its pinned inventory."""
import argparse
import concurrent.futures
import datetime
import hashlib
import json
from pathlib import Path, PurePosixPath
import threading
import time
import urllib.error
import urllib.request
from urllib.parse import quote


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, location):
        raise urllib.error.HTTPError(request.full_url, code, "redirect refused", headers, response)


def audit_row(base, row, attempts, lock):
    path = row["path"]
    if not isinstance(path, str) or not path or PurePosixPath(path).is_absolute() or ".." in path.split("/"):
        raise ValueError("unsafe inventory path")
    url = base + quote(path, safe="/")
    for attempt in range(1, 4):
        result = {"path": path, "url": url, "attempt": attempt, "expectedBytes": row["bytes"],
                  "expectedSha256": row["sha256"], "startedAt": now(), "requestStarted": False}
        started = time.monotonic()
        try:
            request = urllib.request.Request(url, headers={"Accept-Encoding": "identity", "Cache-Control": "no-cache", "User-Agent": "RevealLine-Archive84-byte-audit/1.0"})
            result["requestStarted"] = True
            with urllib.request.build_opener(NoRedirect()).open(request, timeout=60) as response:
                result.update(statusCode=response.status, finalURL=response.geturl(), contentEncoding=response.headers.get("Content-Encoding", "identity"), contentLength=response.headers.get("Content-Length"))
                if response.status != 200 or response.geturl() != url:
                    raise ValueError("status or final URL mismatch")
                if result["contentEncoding"].strip().lower() not in ("", "identity"):
                    raise ValueError("unexpected content encoding")
                declared = result["contentLength"]
                if declared is not None and int(declared) != row["bytes"]:
                    raise ValueError("content length mismatch")
                digest = hashlib.sha256(); size = 0
                while True:
                    chunk = response.read(65536)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > row["bytes"]:
                        raise ValueError("body exceeds expected bytes")
                    digest.update(chunk)
                result.update(bytes=size, sha256=digest.hexdigest())
                if size != row["bytes"] or result["sha256"] != row["sha256"]:
                    raise ValueError("body bytes or sha256 mismatch")
            result["status"] = "PASS"
        except Exception as error:
            result.update(status="FAIL", errorType=type(error).__name__, error=str(error))
            if isinstance(error, urllib.error.HTTPError):
                result["statusCode"] = error.code
        result["elapsedSeconds"] = round(time.monotonic() - started, 3)
        with lock:
            attempts.write(json.dumps(result, sort_keys=True) + "\n"); attempts.flush()
        if result["status"] == "PASS" or attempt == 3:
            return result
        time.sleep(attempt)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--inventory", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    raw = args.inventory.read_bytes(); inventory = json.loads(raw)
    base = inventory["base"]; rows = inventory["files"]
    if not base.startswith("https://mekhovov.github.io/revealline-archive-84/") or len(rows) != 1149:
        raise ValueError("unexpected Archive84 inventory authority")
    if args.out.exists():
        raise ValueError("refusing to overwrite audit output")
    args.out.mkdir(parents=True)
    lock = threading.Lock(); started = now()
    with (args.out / "http-attempts.jsonl").open("x") as attempts:
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda row: audit_row(base, row, attempts, lock), rows))
    with (args.out / "http-results.jsonl").open("x") as output:
        for result in sorted(results, key=lambda value: value["path"]):
            output.write(json.dumps(result, sort_keys=True) + "\n")
    failed = [result for result in results if result["status"] != "PASS"]
    report = {
        "format": "revealline-archive-public-http-audit.v1", "status": "PASS" if not failed else "FAIL",
        "archiveId": "archive-84", "version": "v0.115.1", "base": base,
        "inventorySha256": hashlib.sha256(raw).hexdigest(), "files": len(results),
        "expectedBytes": sum(row["bytes"] for row in rows), "verifiedBytes": sum(result.get("bytes", 0) for result in results if result["status"] == "PASS"),
        "attempts": sum(result["attempt"] for result in results), "failedFiles": len(failed),
        "failedAttempts": sum(1 for line in (args.out / "http-attempts.jsonl").read_text().splitlines() if json.loads(line)["status"] != "PASS"),
        "retriedFiles": sum(result["attempt"] > 1 for result in results), "skipped": [result["path"] for result in results if not result["requestStarted"]],
        "allFinalURLsExact": all(result.get("finalURL") == result["url"] for result in results), "startedAt": started, "verifiedAt": now(), "failures": failed,
        "scope": "Complete public Archive84 inventory: exact 200 response, final URL, identity encoding, byte count, and SHA-256 for every pinned row. Browser acceptance is separate."
    }
    (args.out / "http-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, sort_keys=True))
    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(main())
