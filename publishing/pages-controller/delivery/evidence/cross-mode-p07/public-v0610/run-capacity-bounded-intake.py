"""Capacity-only runner adapter for the unchanged original-receipt intake."""
from pathlib import Path
import importlib.util
import json
import os
import subprocess
import sys
import zipfile

HOME = Path(__file__).resolve().parent
CAP = 32 * 1024 * 1024
RESERVE = 512 * 1024 * 1024
# Conservative allowance for five small API originals, decoded metadata,
# request/response records and the final inventory-binding copies.
HEADROOM = 20 * 1024 * 1024
DOWNLOAD = ['gh', 'api', 'repos/mekhovov/revealline/actions/artifacts/10531462773/zip']


def budget_probe(allocated, expanded, free):
    # Each expanded receipt is retained original/prepared/final at most three times.
    required = expanded * 3 + HEADROOM
    if expanded < 0 or allocated + required > CAP:
        raise ValueError('Receipt expansion could exceed the 32 MiB cumulative cache cap')
    if free < RESERVE + required:
        raise ValueError('Receipt expansion would consume the reserved free capacity')
    return required


def execute():
    spec = importlib.util.spec_from_file_location('unchanged_intake', HOME / 'intake-live.py')
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    downloads = 0

    def guarded_runner(command, **kwargs):
        nonlocal downloads
        if command == DOWNLOAD:
            downloads += 1
            if downloads != 1:
                raise ValueError('Only one original receipt download is authorized')
        result = subprocess.run(command, **kwargs)
        if command == DOWNLOAD and result.returncode == 0:
            kwargs['stdout'].flush()
            raw_path = Path(kwargs['stdout'].name)
            with zipfile.ZipFile(raw_path) as archive:
                expanded = sum(item.file_size for item in archive.infolist())
            allocated = sum(p.stat().st_blocks * 512 for p in HOME.rglob('*') if p.is_file())
            stat = os.statvfs(HOME)
            free = stat.f_bavail * stat.f_frsize
            required = budget_probe(allocated, expanded, free)
            with (HOME / 'intake-capacity-review.json').open('x') as target:
                json.dump({'status': 'PASS_BEFORE_EXTRACTION', 'expandedBytes': expanded,
                           'allocatedBytesBeforeExtraction': allocated, 'futureAllowanceBytes': required,
                           'capBytes': CAP, 'freeBytes': free, 'reserveBytes': RESERVE,
                           'originalDownloadCount': downloads, 'helperChanged': False}, target, indent=2)
                target.write('\n')
        return result

    result = helper.intake(HOME, HOME / 'intake-request.reviewed.json',
                           'f4e3c291147e09c4d70791ac825ac2542ac521bd9209c141a20aebc0a6a7f6c6',
                           runner=guarded_runner)
    if downloads != 1:
        raise ValueError('Original receipt intake did not execute exactly once')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    execute()
