"""Pure parser tests, authored and UNRUN. No native/application imports."""
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('scalars', Path(__file__).with_name('parse-scalar-observations.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def records():
    return [dict(sequence=i + 1, phase=phase, fixtureId=1, created=1,
                 disposeStarted=int(i >= 1), disposeCompleted=int(i >= 2), omitted=0,
                 heapUsed=100, heapTotal=200, external=10, arrayBuffers=5, rss=400,
                 liveWorkers=None if i == 0 else 0,
                 terminatedWorkers=None if i == 0 else 0,
                 retainedMessages=None if i == 0 else 0)
            for i, phase in enumerate(m.PHASES)]


def raw(rows, wrapper='# '):
    return ('TAP version 13\n' + ''.join(wrapper + m.PREFIX + json.dumps(row) + '\n' for row in rows) +
            'ok 1 - scalar control\n1..1\n# tests 1\n# pass 1\n# fail 0\n').encode()


class Parser(unittest.TestCase):
    def test_direct_and_actual_escaped_stdout_wrappers(self):
        direct = raw(records())
        wrapped = ('TAP version 13\n' + ''.join('    # ' + m.escape_node_tap_scalar_line('# ' + m.PREFIX + json.dumps(row)) + '\n' for row in records())).encode()
        for data, framing in ((direct, 'direct'), (wrapped, 'node-tap-escaped-stdout')):
            result = m.parse_observations(data, require_complete=True)
            self.assertEqual(result['fixtureCount'], 1)
            self.assertEqual(len(result['rows']), 4)
            self.assertEqual(result['observedTAPFramings'], [framing])

    def test_unframed_or_embedded_marker_rejected(self):
        for wrapper in ('', 'ok 1 - ', '# # ', '# # # '):
            with self.assertRaises(ValueError):
                m.parse_observations(raw(records(), wrapper))

    def test_missing_or_duplicate_phase_rejected(self):
        for rows in (records()[:-1], records() + [records()[-1]]):
            with self.assertRaises(ValueError):
                m.parse_observations(raw(rows), require_complete=True)

    def test_unknown_field_phase_and_noninteger_rejected(self):
        for change in ({'surprise': 1}, {'phase': 'unknown'}, {'heapUsed': True}, {'heapUsed': float('nan')}):
            rows = records()
            rows[0].update(change)
            with self.assertRaises(ValueError):
                m.parse_observations(raw(rows))

    def test_sequence_counter_and_omission_drift_rejected(self):
        for change in ({'sequence': 9}, {'created': 0}, {'omitted': 1}, {'disposeCompleted': 1}, {'disposeStarted': 1}):
            rows = records()
            rows[0].update(change)
            with self.assertRaises(ValueError):
                m.parse_observations(raw(rows))

    def test_construction_and_cleanup_worker_shapes_rejected(self):
        for index, value in ((0, 1), (1, None)):
            rows = records()
            rows[index]['liveWorkers'] = value
            with self.assertRaises(ValueError):
                m.parse_observations(raw(rows))

    def test_line_cap_and_missing_observations_rejected(self):
        for data in (b'TAP version 13\n1..0\n', raw(records()).replace(b'"constructed"', b'"' + b'x' * 1100 + b'"')):
            with self.assertRaises(ValueError):
                m.parse_observations(data)

    def test_partial_cleanup_retained_as_partial_not_complete(self):
        result = m.parse_observations(raw(records()[:2]))
        self.assertEqual(result['status'], 'scalar-observations-partial')

    def test_exact_observation_cap_remains_incomplete(self):
        rows = []
        for fixture in range(1, 129):
            for i, row in enumerate(records()):
                row.update(sequence=len(rows) + 1, fixtureId=fixture, created=fixture,
                           disposeStarted=fixture - 1 + int(i >= 1),
                           disposeCompleted=fixture - 1 + int(i >= 2))
                rows.append(row)
        with self.assertRaises(ValueError):
            m.parse_observations(raw(rows), require_complete=True)


    def test_strict_node_tap_escape_roundtrip_and_unknown_escape_rejected(self):
        original = '# value ' + m.BACKSLASH + 'literal'
        encoded = m.escape_node_tap_scalar_line(original)
        self.assertEqual(m.decode_node_tap_scalar_line(encoded), original)
        for invalid in (m.BACKSLASH, m.BACKSLASH + 'q', '# unescaped-hash'):
            with self.assertRaises(ValueError):
                m.decode_node_tap_scalar_line(invalid)

    def test_split_reporter_messages_are_not_reassembled_into_success(self):
        emitted = '# ' + m.PREFIX + json.dumps(records()[0])
        pieces = [emitted[:9], emitted[9:]]
        wrapped = ''.join('# ' + m.escape_node_tap_scalar_line(piece) + '\n' for piece in pieces).encode()
        with self.assertRaises(ValueError):
            m.parse_observations(wrapped, require_complete=True)


# Existing eleven parser cases above remain byte-exact.
from unittest.mock import patch
import copy
import stat

core_spec = importlib.util.spec_from_file_location('observer', Path(__file__).with_name('world-fixture-memory-scalars.py'))
cm = importlib.util.module_from_spec(core_spec)
core_spec.loader.exec_module(cm)


def terminal(out=b'', err=b'', code=0):
    return {'args': cm.native_args('/node', '/candidate'), 'started': True, 'subreaper': True,
            'exitCode': code, 'guard': None, 'elapsedSeconds': 1,
            'peakObservedOwnedRSSBytes': 100 * cm.MIB, 'stdoutBytes': len(out),
            'stderrBytes': len(err), 'stdoutSHA256': cm.digest(out), 'stderrSHA256': cm.digest(err),
            'captureComplete': True, 'outputComplete': True, 'outputTruncated': False,
            'captureErrors': [], 'remainingOwnedProcesses': []}


def sealed(value):
    data = cm.encode(value)
    assert len(data) <= 65536
    return data + b' ' * (65536 - len(data))


def whole_tap():
    return ('TAP version 13\n' + ''.join(f'ok {i} - case{i}\n' for i in range(1, 116)) +
            '1..115\n# tests 115\n# pass 115\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n').encode()


class Observer(unittest.TestCase):
    def setUp(self):
        self.block = patch.object(cm.subprocess, 'run', side_effect=AssertionError('No real child in controls'))
        self.block.start()
        self.addCleanup(self.block.stop)

    def test_native_result_is_independent_of_actual_complete_partial_invalid_parser_status(self):
        complete, _ = cm.scalar_result(m, raw(records()))
        partial, _ = cm.scalar_result(m, raw(records()[:2]))
        invalid, _ = cm.scalar_result(m, b'not scalar records')
        out = whole_tap()
        native = cm.classify(terminal(out), out, b'', True)
        self.assertEqual(native['outcome'], 'WHOLE_FILE_SUCCESS')
        self.assertEqual(complete['status'], 'scalar-observations-complete')
        self.assertEqual(partial['status'], 'scalar-observations-partial')
        self.assertEqual(invalid['status'], 'scalar-observations-invalid')
        self.assertTrue(cm.diagnostic_pass(native, complete, True))
        for scalar in (partial, invalid):
            self.assertFalse(cm.diagnostic_pass(native, scalar, True))
            self.assertEqual(native['outcome'], 'WHOLE_FILE_SUCCESS')
        err = b'FATAL ERROR: JavaScript heap out of memory\n'
        oom = cm.classify(terminal(b'', err, -6), b'', err, True)
        self.assertEqual(oom['outcome'], 'V8_OOM')
        self.assertFalse(cm.diagnostic_pass(oom, complete, True))
        self.assertEqual(oom['outcome'], 'V8_OOM')
        self.assertFalse(cm.diagnostic_pass(native, complete, False))

    def test_whole115_footer_partial_and_failed_assertion_are_distinct(self):
        out = whole_tap()
        self.assertEqual(cm.classify(terminal(out), out, b'', True)['outcome'], 'WHOLE_FILE_SUCCESS')
        for partial in (out.split(b'1..115')[0], out.replace(b'# tests 115', b'# tests 114'),
                        out.replace(b'# skipped 0', b'# skipped 1'), out + b'not ok 116 - hidden\n'):
            self.assertEqual(cm.classify(terminal(partial), partial, b'', True)['outcome'], 'FAILED_OR_INCOMPLETE')
        self.assertEqual(cm.classify(terminal(out, b'', 1), out, b'', True)['outcome'], 'FAILED_WHOLE_FILE')

    def test_native_argv_binds_node_root_and_original_experimental_flag(self):
        out = whole_tap()
        row = terminal(out)
        cm.verify_terminal(sealed(row), out, b'', cm.native_args('/node', '/candidate'))
        self.assertEqual(row['args'], ['/node', '--max-old-space-size=1536', '--test',
                                      '--test-concurrency=1', '--experimental-test-isolation=none',
                                      '/candidate/' + cm.FILE])
        for index, value in ((0, '/other-node'), (-1, '/other/' + cm.FILE),
                             (4, '--test-isolation=none'), (2, '--test-name-pattern=one')):
            changed = copy.deepcopy(row)
            changed['args'][index] = value
            with self.assertRaises(RuntimeError):
                cm.verify_terminal(sealed(changed), out, b'', row['args'])

    def test_raw_hash_lengths_terminal_padding_and_resource_facts_fail_closed(self):
        out = whole_tap()
        row = terminal(out)
        for data in (sealed(row)[:-1], sealed(row) + b' '):
            with self.assertRaises(RuntimeError):
                cm.verify_terminal(data, out, b'', row['args'])
        for key, value in (('stdoutSHA256', 'f' * 64), ('stdoutBytes', 0), ('stderrBytes', False),
                           ('started', False), ('subreaper', False), ('elapsedSeconds', float('nan')),
                           ('elapsedSeconds', True), ('elapsedSeconds', 181),
                           ('peakObservedOwnedRSSBytes', 2048 * cm.MIB + 1)):
            changed = copy.deepcopy(row)
            changed[key] = value
            with self.assertRaises(RuntimeError):
                cm.verify_terminal(sealed(changed), out, b'', row['args'])
        with self.assertRaises(RuntimeError):
            cm.verify_terminal(sealed(row), out + b'x', b'', row['args'])

    def test_actual_controls_roundtrip_and_changed_metadata_rejected(self):
        data = b'fixed control and metadata'
        identity = (7, 11, stat.S_IFREG | 0o644, 1, len(data), 123456, 789012)
        changed = [False]

        def external_git(root, *args):
            if args[:4] == ('ls-tree', '-z', 'HEAD', '--'):
                return ('100644 blob ' + cm.blob(data) + '\t' + args[4] + '\0').encode()
            if args[:2] == ('rev-parse', '--git-path'):
                return ('metadata/' + args[2] + '\n').encode()
            if args == ('rev-parse', 'HEAD'):
                return ('a' * 40 + '\n').encode()
            if args == ('rev-parse', 'HEAD^{tree}'):
                return ('b' * 40 + '\n').encode()
            raise AssertionError('Unexpected Git call')

        def file_io(path, *args):
            ident = list(identity)
            if changed[0] and Path(path).name == 'index':
                ident[1] += 1
            return data, tuple(ident)

        with patch.object(cm, 'git', side_effect=external_git), patch.object(cm, 'ordinary', side_effect=file_io):
            actual = cm.controls(Path(__file__).parent)
            receipt = json.loads(cm.encode(actual))
            self.assertEqual(actual, receipt)
            self.assertEqual(len(actual['inventory']), 6)
            for name in ('HEAD', 'index', 'config'):
                self.assertEqual(actual['metadata'][name]['identity'], list(identity))
            changed[0] = True
            self.assertNotEqual(receipt, cm.controls(Path(__file__).parent))

    def test_candidate_event_requires_exact_head_repository_and_new_draft(self):
        head = 'a' * 40
        event = {'repository': {'id': 1367404328, 'full_name': 'mekhovov/revealline'},
                 'pull_request': {'draft': True, 'base': {'ref': 'main'},
                                  'head': {'sha': head, 'ref': 'codex/world-fixture-memory-scalars',
                                           'repo': {'id': 1367404328}}}}
        def actual_git(root, *args):
            return ((head if args == ('rev-parse', 'HEAD') else 'b' * 40) + '\n').encode()
        for mutate in (None, 'head', 'repo', 'draft'):
            current = copy.deepcopy(event)
            if mutate == 'head': current['pull_request']['head']['sha'] = 'c' * 40
            if mutate == 'repo': current['repository']['id'] = 1
            if mutate == 'draft': current['pull_request']['draft'] = False
            with patch.dict(cm.os.environ, {'GITHUB_EVENT_PATH': '/event'}), patch.object(
                    cm, 'ordinary', return_value=(cm.encode(current), ())), patch.object(cm, 'git', side_effect=actual_git):
                if mutate is None:
                    self.assertEqual(cm.candidate_context('/candidate')['head'], head)
                else:
                    with self.assertRaises(RuntimeError): cm.candidate_context('/candidate')

    def test_api_accepts_exact_repository_and_descendants_without_widening_owner(self):
        allowed = ('repos/mekhovov/revealline',
                   'repos/mekhovov/revealline/actions/runs/123')
        rejected = ('repos/mekhovov/revealline-other',
                    'repos/mekhovov/revealline-other/actions/runs/123',
                    'repos/other/revealline',
                    'https://api.github.com/repos/mekhovov/revealline')
        with patch.dict(cm.os.environ, {'DIAGNOSTIC_READ_TOKEN': 'mock-only-token'}), patch.object(
                cm.urllib.request, 'build_opener') as transport:
            transport.return_value.open.side_effect = lambda request, timeout: cm.io.BytesIO(b'{"ok":true}')
            for path in allowed:
                self.assertEqual(cm.api(path), {'ok': True})
                self.assertIs(transport.call_args.args[0], cm.NoRedirect)
                args, kwargs = transport.return_value.open.call_args
                self.assertEqual(args[0].full_url, 'https://api.github.com/' + path)
                self.assertEqual(args[0].get_header('Authorization'), 'Bearer mock-only-token')
                self.assertEqual(kwargs, {'timeout': 30})
            self.assertEqual(transport.return_value.open.call_count, len(allowed))
            transport.reset_mock()
            for path in rejected:
                with self.assertRaisesRegex(RuntimeError, 'Unexpected API owner'):
                    cm.api(path)
            transport.assert_not_called()

    def test_overflow_summary_retains_native_outcome_and_fails_diagnostic(self):
        row = {'format': 'world-scalar-diagnostic.v1', 'outcome': 'WHOLE_FILE_SUCCESS',
               'nativeOutcome': 'V8_OOM', 'scalarStatus': 'scalar-observations-partial',
               'sourceHead': 'a' * 40, 'sourceTree': 'b' * 40, 'oversized': 'x' * 65536}
        bounded = cm.final_record(row)
        self.assertEqual(bounded['outcome'], 'FAILED_OR_INCOMPLETE')
        self.assertEqual(bounded['nativeOutcome'], 'V8_OOM')
        self.assertEqual(bounded['scalarStatus'], 'scalar-observations-partial')
        self.assertLessEqual(len(cm.encode(bounded)), 65536)


if __name__ == '__main__':
    unittest.main()
