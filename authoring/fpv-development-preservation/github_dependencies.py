"""Restore explicitly reviewed GitHub subtrees for links outside the captured root."""
import base64
import hashlib
import os
from pathlib import Path
import re
from urllib.parse import quote
from pack import digest, safe_relative
from restore_paths import mkdir_safe
from verify_upload import gh_json


def git_identity(kind, raw):
    return hashlib.sha1(kind.encode() + b' ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()


def manifest_tree(files):
    root, seen = {}, set()
    for row in files:
        path = safe_relative(row['path'])
        if (str(path) != row['path'] or row['path'] in seen or row.get('mode') not in ['100644', '100755']
                or not re.fullmatch(r'[0-9a-f]{40}', row.get('gitBlobSHA1', ''))
                or not re.fullmatch(r'[0-9a-f]{64}', row.get('sha256', ''))
                or not isinstance(row.get('bytes'), int) or not 0 <= row['bytes'] <= 100_000_000):
            raise ValueError('Unsafe or duplicate Git dependency manifest entry')
        seen.add(row['path'])
        node = root
        for name in path.parts[:-1]:
            node = node.setdefault(name, {})
            if not isinstance(node, dict):
                raise ValueError('Git dependency file/directory collision')
        if path.name in node:
            raise ValueError('Git dependency file/directory collision')
        node[path.name] = (row['mode'], row['gitBlobSHA1'])

    def seal(node):
        body, children = bytearray(), {}
        ordered = sorted(node.items(), key=lambda pair: (pair[0] + ('/' if isinstance(pair[1], dict) else '')).encode())
        for name, value in ordered:
            if isinstance(value, dict):
                sha, _ = seal(value)
                mode, kind = '40000', 'dir'
            else:
                mode, sha = value
                kind = 'file'
            body.extend(mode.encode() + b' ' + name.encode() + b'\0' + bytes.fromhex(sha))
            children[name] = (sha, kind)
        return git_identity('tree', bytes(body)), children
    return seal(root)


def validate_dependency(dep):
    for key in ['linkPath', 'targetWithinRoot', 'subtree']:
        safe_relative(dep[key])
    if (not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', dep['repo'])
            or not re.fullmatch(r'[0-9a-f]{40}', dep['commit'])
            or not isinstance(dep.get('originalTargetExact'), str)):
        raise ValueError('Invalid reviewed Git dependency source')
    sha, children = manifest_tree(dep['files'])
    if sha != dep['treeGitSHA1']:
        raise ValueError('Dependency file manifest does not reconstruct the reviewed Git tree')
    return children


def from_reviewed_recipe(recipe, coverage, symlinks):
    if recipe.get('format') != 'FPVAppReviewPortableLinkMapping.v1':
        raise ValueError('Unsupported reviewed external-link recipe')
    mapping = recipe['mapping']
    source = mapping['payloadSource']
    selected = [r for r in symlinks if r['path'] == mapping['linkPathRelativeToNewRestoreRoot']]
    target_sha = hashlib.sha256(selected[0]['target'].encode()).hexdigest() if len(selected) == 1 else None
    bindings = [{'commit': coverage.get('sourceCommit'), 'subtree': coverage.get('sourceSubtree'),
                 'treeGitSHA1': coverage.get('sourceTreeGitSHA1'), 'exactTreeMatch': True}]
    bindings += coverage.get('additionalPublishedExactTreeBindings', [])
    commit_bound = any(r.get('commit') == source['commit'] and r.get('subtree') == source['subtree']
                       and r.get('treeGitSHA1') == source['treeGitSHA1'] and r.get('exactTreeMatch') is True
                       for r in bindings)
    if (len(selected) != 1 or not coverage.get('allFilesTrackedAndMatchPublishedGitHubTree')
            or not target_sha or mapping.get('originalTargetSHA256') != target_sha
            or coverage.get('originalTargetSHA256') != target_sha or not commit_bound
            or coverage.get('uniqueUntrackedOrModifiedPayloads') or coverage.get('symlinksInsideTarget')
            or coverage['sourceRepository'] != source['repository']
            or coverage.get('sourceSubtree') != source['subtree']
            or coverage['sourceTreeGitSHA1'] != source['treeGitSHA1']
            or coverage['targetFiles'] != source['files'] or len(coverage['files']) != source['files']
            or sum(r['bytes'] for r in coverage['files']) != source['bytes']):
        raise ValueError('Reviewed dependency recipe and exact source coverage disagree')
    dep = {'linkPath': selected[0]['path'], 'originalTargetExact': selected[0]['target'],
           'targetWithinRoot': mapping['newTargetRelativeToNewRestoreRoot'],
           'repo': source['repository'], 'commit': source['commit'], 'subtree': source['subtree'],
           'treeGitSHA1': source['treeGitSHA1'], 'files': coverage['files']}
    validate_dependency(dep)
    return dep


def obtain_blob(repo, row, cache):
    path = cache / ('git-blob-' + row['gitBlobSHA1'] + '-' + row['sha256'])
    if path.exists() or path.is_symlink():
        if path.is_symlink():
            raise ValueError('Unsafe existing Git blob cache')
        raw = path.read_bytes()
    else:
        blob = gh_json('api', f'repos/{repo}/git/blobs/{row["gitBlobSHA1"]}')
        if blob.get('encoding') != 'base64' or blob.get('sha') != row['gitBlobSHA1']:
            raise ValueError('Unexpected Git blob API identity or encoding')
        raw = base64.b64decode(''.join(blob['content'].splitlines()), validate=True)
        if (len(raw) != row['bytes'] or hashlib.sha256(raw).hexdigest() != row['sha256']
                or git_identity('blob', raw) != row['gitBlobSHA1']):
            raise ValueError('Downloaded Git blob bytes differ from the reviewed manifest')
        with path.open('xb') as out:
            out.write(raw)
    if (len(raw) != row['bytes'] or hashlib.sha256(raw).hexdigest() != row['sha256']
            or git_identity('blob', raw) != row['gitBlobSHA1'] or digest(path) != row['sha256']):
        raise ValueError('Cached Git blob bytes differ from the reviewed manifest')
    return path


def restore_dependencies(dependencies, cache, target):
    mappings, restored = {}, []
    for dep in dependencies:
        expected = validate_dependency(dep)
        if dep['linkPath'] in mappings:
            raise ValueError('Duplicate reviewed external-link mapping')
        endpoint = f'repos/{dep["repo"]}/contents/{quote(dep["subtree"], safe="/")}?ref={dep["commit"]}'
        children = gh_json('api', endpoint)
        if not isinstance(children, list) or {x['name']: (x['sha'], x['type']) for x in children} != expected:
            raise ValueError('Reviewed Git subtree is not bound to the pinned source commit')
        base = mkdir_safe(target, dep['targetWithinRoot'])
        for row in dep['files']:
            relative = safe_relative(row['path'])
            parent = base if len(relative.parts) == 1 else mkdir_safe(base, str(relative.parent))
            destination = parent / relative.name
            source = obtain_blob(dep['repo'], row, cache)
            h, size = hashlib.sha256(), 0
            with source.open('rb') as src, destination.open('xb') as out:
                while raw := src.read(4 * 1024 * 1024):
                    out.write(raw)
                    h.update(raw)
                    size += len(raw)
            if size != row['bytes'] or h.hexdigest() != row['sha256'] or digest(destination) != row['sha256']:
                raise ValueError('Restored reviewed dependency file differs')
            os.chmod(destination, int(row['mode'], 8) & 0o777)
            os.utime(destination, ns=(0, 0))
            restored.append({'path': str(Path(dep['targetWithinRoot']) / row['path']),
                             'bytes': row['bytes'], 'sha256': row['sha256'], 'gitBlobSHA1': row['gitBlobSHA1']})
        mappings[dep['linkPath']] = dep
    return mappings, restored
