#!/usr/bin/env python3
"""Deterministic commit-plus-manifest source preservation; never follows symlinks.

Reads immutable Git blobs through one bounded-memory cat-file process. Gitlinks
are rejected: a submodule commit is not preservation of its external contents.
This tool does not qualify, build, tag, upload or publish a release.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

FORMAT = 'revealline-source-manifest.v1'
CHUNK = 1024 * 1024
MAX_BYTES = 8_000_000_000
MAX_PATHS = 100_000
MAX_MANIFEST = 32 * CHUNK


def frozen_proof_key(frozen):
    contract = frozen.get('sourceContract', 'tar-v1')
    require(contract in ('tar-v1', 'manifest-v1'), 'Unknown frozen source contract')
    return ('sourceManifestGitContentsAndModesVerified' if contract == 'manifest-v1'
            else 'sourceTarGitBlobTypeModeAndPaxCommitVerified')


def inspection_source(inspection):
    manifest = 'sourceManifest' in inspection
    require(not (manifest and 'sourceTar' in inspection), 'Ambiguous source inspection')
    return ('source-manifest.json', 'sourceManifest') if manifest else ('source.tar', 'sourceTar')


def qualification_proof(inspection):
    if 'sourceManifest' in inspection:
        return {'sourceContract': 'manifest-v1', 'sourceManifestGitContentsAndModesVerified': True}
    return {'sourceTarGitBlobTypeModeAndPaxCommitVerified': True}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


def git(repo, *args):
    return subprocess.check_output(['git', '-C', str(repo), *args], timeout=60)


def source_manifest(repo, commit):
    require(isinstance(commit, str) and re.fullmatch(r'[a-f0-9]{40}', commit), 'Exact commit required')
    require(git(repo, 'rev-parse', '--verify', commit + '^{commit}').decode().strip() == commit,
            'Commit identity differs')
    tree = git(repo, 'rev-parse', commit + '^{tree}').decode().strip()
    entries = []
    for row in git(repo, 'ls-tree', '-r', '-z', '--full-tree', commit).split(b'\0'):
        if not row:
            continue
        metadata, raw_path = row.split(b'\t', 1)
        mode, kind, oid = metadata.decode('ascii').split()
        name = raw_path.decode('utf-8', errors='strict')
        require(kind == 'blob' and mode in ('100644', '100755', '120000'), 'Unsupported Git mode/type')
        require(name and all(part not in ('', '.', '..') for part in name.split('/')) and
                '\\' not in name and not any(ord(char) < 32 or ord(char) == 127 for char in name),
                'Unsafe source path')
        entries.append((raw_path, name, mode, oid))
    require(0 < len(entries) <= MAX_PATHS, 'Source inventory exceeds path budget')
    entries.sort(key=lambda entry: entry[0])
    rows, total = [], 0
    process = subprocess.Popen(['git', '-C', str(repo), 'cat-file', '--batch'],
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        for _, name, mode, oid in entries:
            process.stdin.write((oid + '\n').encode('ascii'))
            process.stdin.flush()
            header = process.stdout.readline(256).decode('ascii').strip().split()
            require(len(header) == 3 and header[0] == oid and header[1] == 'blob' and header[2].isdigit(),
                    'Git blob header differs')
            size = int(header[2])
            total += size
            require(total <= MAX_BYTES, 'Source inventory exceeds byte budget')
            digest = hashlib.sha256()
            remaining = size
            while remaining:
                block = process.stdout.read(min(CHUNK, remaining))
                require(block, 'Truncated Git blob')
                digest.update(block)
                remaining -= len(block)
            require(process.stdout.read(1) == b'\n', 'Git blob delimiter differs')
            rows.append({'path': name, 'mode': mode, 'bytes': size, 'sha256': digest.hexdigest()})
        process.stdin.close()
        require(process.wait(timeout=60) == 0, 'Git blob stream failed')
    finally:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=10)
        if not process.stdin.closed:
            process.stdin.close()
        process.stdout.close()
    return {'format': FORMAT, 'sourceRevision': commit, 'sourceTree': tree, 'totalBytes': total, 'files': rows}


def verify_manifest(body, repo, commit, tree=None):
    require(isinstance(body, bytes) and 0 < len(body) <= MAX_MANIFEST, 'Manifest byte budget exceeded')
    # Canonical bytes disallow duplicate JSON keys, extra fields, reordered paths,
    # floats masquerading as byte counts, and differing escape encodings.
    expected = source_manifest(repo, commit)
    require(tree is None or expected['sourceTree'] == tree, 'Source tree differs')
    require(body == encoded(expected), 'Source manifest differs from immutable Git objects')
    return {'files': len(expected['files']), 'originalBytes': expected['totalBytes'],
            'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest(),
            'allGitBlobContentsAndModesVerified': True, 'sourceRevision': commit,
            'sourceTree': expected['sourceTree']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=('create', 'verify'))
    parser.add_argument('--repo', type=Path, required=True)
    parser.add_argument('--commit', required=True)
    parser.add_argument('--manifest', type=Path, required=True)
    args = parser.parse_args()
    if args.operation == 'create':
        body = encoded(source_manifest(args.repo, args.commit))
        require(len(body) <= MAX_MANIFEST, 'Manifest byte budget exceeded')
        with args.manifest.open('xb') as stream:
            stream.write(body)
        print(json.dumps({'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()}))
    else:
        require(not args.manifest.is_symlink() and args.manifest.stat().st_size <= MAX_MANIFEST,
                'Manifest must be a bounded ordinary file')
        print(json.dumps(verify_manifest(args.manifest.read_bytes(), args.repo, args.commit)))


if __name__ == '__main__':
    main()
