"""Synthetic retained-authority fixtures; no network or game payload creation."""
import copy
import io
import json
import os
import stat
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import binding as b


class BindingTests(unittest.TestCase):
    def setUp(self):
        self.metadata = b.pinned_metadata()
        scratch = b.ROOT / 'test-scratch'
        scratch.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix='fixture-', dir=scratch)
        self.root = Path(self.temp.name)
        (self.root / 'authority').mkdir()
        self.commit, self.tree = 'a' * 40, 'b' * 40
        self.ids = {'runId': 11, 'deploymentId': 22, 'deploymentStatusId': 33, 'receiptArtifactId': 44}
        catalog = {'format': 'test-catalog'}
        catalog_raw = b.encoded(catalog)
        publication = {'currentVersion': b.VERSION, 'deploymentEnabled': True, 'catalogSha256': b.sha(catalog_raw)}
        publication_raw = b.encoded(publication)
        self.values = {
            'main': {'ref': 'refs/heads/main', 'object': {'sha': self.commit}},
            'commit': {'sha': self.commit, 'tree': {'sha': self.tree}, 'url': f'https://api.github.com/repos/{b.REPO}/git/commits/{self.commit}'},
            'run': {'id': 11, 'head_sha': self.commit, 'head_branch': 'main', 'event': 'push', 'status': 'completed', 'conclusion': 'success', 'repository': {'full_name': b.REPO}, 'path': '.github/workflows/publish-frozen-pages.yml', 'name': 'Publish selected frozen game'},
            'jobs': {'total_count': 2, 'jobs': []},
            'deployment': {'id': 22, 'sha': self.commit, 'ref': 'main', 'environment': 'github-pages', 'repository_url': 'https://api.github.com/repos/' + b.REPO},
            'statuses': [{'id': 33, 'state': 'success', 'environment_url': b.BASE, 'deployment_url': f'https://api.github.com/repos/{b.REPO}/deployments/22', 'log_url': f'https://github.com/{b.REPO}/actions/runs/11/job/1'}],
            'publication': publication, 'catalog': catalog,
        }
        for name, steps in [('assemble', ['Independently reread every prepared artifact byte', 'Upload verified Pages artifact']), ('deploy', ['Recheck latest stable selection after any deployment wait', 'Deploy verified frozen edition to GitHub Pages'])]:
            self.values['jobs']['jobs'].append({'name': name, 'run_id': 11, 'head_sha': self.commit, 'status': 'completed', 'conclusion': 'success', 'steps': [{'name': s, 'status': 'completed', 'conclusion': 'success'} for s in steps]})
        bodies, _, manifest = self.metadata
        rows = [{'path': f'releases/{b.VERSION}/site/' + row['path'], 'bytes': row['bytes'], 'sha256': row['sha256']} for row in manifest['files']]
        rows.extend({'path': f'releases/{b.VERSION}/site/{n}', 'bytes': len(bodies[n]), 'sha256': b.sha(bodies[n])} for n in ('manifest.json', 'distribution.zip.sha256'))
        rows.append({'path': f'releases/{b.VERSION}/release.json', 'bytes': len(bodies['release.json']), 'sha256': b.sha(bodies['release.json'])})
        existing = {r['path'] for r in rows}
        for name in ['.nojekyll', 'index.html', 'release.json', 'manifest.json', 'archive-routing.json', 'current-entry-routing.json', 'releases/index.html', 'releases/v0.82.0/site/game/index.html']:
            if name not in existing:
                rows.append({'path': name, 'bytes': 0, 'sha256': b.sha(b'')})
        rows.sort(key=lambda r: r['path'])
        self.receipt = {'format': 'revealline-metadata-pages-artifact.v1', 'currentVersion': b.VERSION, 'gameSourceRevision': b.SOURCE, 'qualifiedSourceTree': b.TREE, 'publishable': True, 'browserAdmissionsRequired': True, 'currentGraphLayout': 'single-canonical-with-root-metadata-v1', 'controllerCommit': self.commit, 'controllerTree': self.tree, 'files': rows, 'totalBytes': sum(r['bytes'] for r in rows), 'budgetBytes': b.MAX_TOTAL, 'catalogSha256': b.sha(catalog_raw), 'configurationSha256': b.sha(publication_raw)}
        self.extraction = {'distributionSha256': b.ZIP_SHA, 'manifestSha256': b.METADATA['manifest.json'][1], 'version': b.VERSION, 'gameSourceRevision': b.SOURCE, 'crcAndHashesVerified': True}
        self.patches = [patch.object(b, 'ROOT', self.root), patch.object(b, 'REQUEST', self.root / 'execution-request.reviewed.json'), patch.object(b, 'pinned_metadata', return_value=self.metadata), patch.object(b, 'git', side_effect=self.git)]
        for p in self.patches: p.start()

    def tearDown(self):
        for p in reversed(self.patches): p.stop()
        self.temp.cleanup()

    def git(self, *args):
        if args == ('rev-parse', self.commit + '^{tree}'): return (self.tree + '\n').encode()
        if args == ('rev-parse', b.SOURCE + '^{tree}'): return (b.TREE + '\n').encode()
        for role in ('publication', 'catalog'):
            if args == ('show', self.commit + ':publishing/pages-controller/' + role + '.json'):
                return b.encoded(self.values[role])
        raise AssertionError(args)

    def write(self, *, missing_member=False, extra_member=False, special_member=False):
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, 'w', zipfile.ZIP_DEFLATED) as z:
            info = zipfile.ZipInfo('artifact-receipt.json')
            info.compress_type = zipfile.ZIP_DEFLATED
            if special_member:
                info.create_system = 3
                info.external_attr = (stat.S_IFIFO | 0o600) << 16
            z.writestr(info, b.encoded(self.receipt))
            if not missing_member: z.writestr('zip-receipt.json', b.encoded(self.extraction))
            if extra_member: z.writestr('../unexpected.json', b'{}')
        zip_raw = stream.getvalue()
        self.values['artifacts'] = {'artifacts': [{'id': 44, 'name': 'frozen-pages-receipts', 'expired': False, 'workflow_run': {'id': 11, 'head_sha': self.commit}, 'size_in_bytes': len(zip_raw), 'digest': 'sha256:' + b.sha(zip_raw)}]}
        pins = {}
        for role in b.ROLES:
            raw = zip_raw if role == 'receiptZIP' else b.encoded(self.values[role])
            name = 'authority/' + role + ('.zip' if role == 'receiptZIP' else '.json')
            (self.root / name).write_bytes(raw)
            pins[role] = {'path': name, 'bytes': len(raw), 'sha256': b.sha(raw)}
        rows = self.receipt['files']
        self.request = {'format': 'revealline-main-v097-http-request.v1', 'reviewed': True, 'controllerCommit': self.commit, 'controllerTree': self.tree, **self.ids, 'inventory': {'files': len(rows), 'bytes': sum(r['bytes'] for r in rows), 'sha256': b.sha(b.encoded({'base': b.BASE, 'files': rows}))}, 'pins': pins}
        self.save_request()

    def save_request(self):
        b.REQUEST.write_bytes(b.encoded(self.request))

    def test_complete_receipt_uses_all_aliases_originals_and_historical_bridges(self):
        self.write()
        result = b.validate_execution_binding()
        self.assertEqual(result['rows'], self.receipt['files'])
        self.assertIn('releases/v0.82.0/site/game/index.html', [r['path'] for r in result['rows']])

    def test_pending_request_and_changed_authority_are_refused(self):
        self.write(); self.request['reviewed'] = False; self.save_request()
        with self.assertRaisesRegex(ValueError, 'reviewed request'): b.validate_execution_binding()
        self.write(); (self.root / self.request['pins']['run']['path']).write_bytes(b'{}')
        with self.assertRaisesRegex(ValueError, 'byte pin differs'): b.validate_execution_binding()

    def test_wrong_workflow_preview_or_skipped_deploy_refused(self):
        for mutate in (lambda: self.values['run'].update(name='Different workflow'), lambda: self.values['run'].update(event='pull_request'), lambda: self.values['jobs']['jobs'][1]['steps'][1].update(conclusion='skipped')):
            before = copy.deepcopy(self.values); mutate(); self.write()
            with self.assertRaises(ValueError): b.validate_execution_binding()
            self.values = before

    def test_wrong_source_preview_receipt_and_missing_canonical_refused(self):
        for mutate in (lambda: self.receipt.update(gameSourceRevision='c' * 40), lambda: self.receipt.update(publishable=False), lambda: self.receipt['files'].pop(next(i for i, r in enumerate(self.receipt['files']) if r['path'].endswith('/site/game/index.html') and b.VERSION in r['path']))):
            before = copy.deepcopy(self.receipt); mutate(); self.receipt['totalBytes'] = sum(r['bytes'] for r in self.receipt['files']); self.write()
            with self.assertRaises(ValueError): b.validate_execution_binding()
            self.receipt = before

    def test_duplicate_unsafe_and_changed_original_rows_refused_even_with_new_inventory_pin(self):
        for mutate in (lambda: self.receipt['files'].append(self.receipt['files'][0].copy()), lambda: self.receipt['files'][0].update(path='../escape'), lambda: next(r for r in self.receipt['files'] if b.VERSION in r['path'] and r['bytes'] > 0).update(sha256='e' * 64)):
            before = copy.deepcopy(self.receipt); mutate(); self.receipt['totalBytes'] = sum(r['bytes'] for r in self.receipt['files']); self.write()
            with self.assertRaises(ValueError): b.validate_execution_binding()
            self.receipt = before

    def test_inventory_count_and_zip_members_fail_closed(self):
        self.write(); self.request['inventory']['files'] -= 1; self.save_request()
        with self.assertRaisesRegex(ValueError, 'finite inventory'): b.validate_execution_binding()
        for options in ({'extra_member': True}, {'missing_member': True}):
            self.write(**options)
            with self.assertRaisesRegex(ValueError, 'ZIP members'): b.validate_execution_binding()

    def test_latest_failed_status_and_other_deployment_refused(self):
        self.values['statuses'].append({**self.values['statuses'][0], 'id': 34, 'state': 'failure'})
        self.write()
        with self.assertRaisesRegex(ValueError, 'deployment status'): b.validate_execution_binding()
        self.values['statuses'].pop(); self.values['deployment']['sha'] = 'e' * 40; self.write()
        with self.assertRaisesRegex(ValueError, 'Pages deployment'): b.validate_execution_binding()

    def test_nonregular_zip_member_refused_without_extraction(self):
        self.write(special_member=True)
        with self.assertRaisesRegex(ValueError, 'Unsafe receipt ZIP member'):
            b.validate_execution_binding()

    def test_symlink_fifo_and_oversized_inputs_refused_before_open(self):
        ordinary = self.root / 'ordinary'; ordinary.write_bytes(b'ab')
        link = self.root / 'link'; link.symlink_to(ordinary)
        fifo = self.root / 'fifo'; os.mkfifo(fifo)
        for path, limit in ((link, 5), (fifo, 5), (ordinary, 1)):
            with patch.object(b.os, 'open', side_effect=AssertionError('must refuse before open')):
                with self.assertRaises(ValueError): b.bounded(path, limit)


if __name__ == '__main__': unittest.main()
