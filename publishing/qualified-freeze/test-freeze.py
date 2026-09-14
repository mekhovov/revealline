import copy, importlib.util, json, pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('freeze',ROOT/'freeze.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class QualificationTests(unittest.TestCase):
    def setUp(self):
        self.pins=json.loads((ROOT/'sources.json').read_text())['sources']
    def records(self,pin):
        root=ROOT/'qualifications'/pin['version']
        return json.loads((root/'source-qualification.json').read_text()),json.loads((root/'receipt-qualified.json').read_text())
    def test_all_three_exact_qualified_candidates(self):
        for pin in self.pins:
            q,r=self.records(pin);m.check_receipts(pin,q,r)
    def test_wrong_source_tree_and_workflow_are_rejected(self):
        pin=self.pins[0]
        for key in ['sourceRevision','sourceTree','workflowBlob']:
            q,r=self.records(pin);q[key]='a'*40
            with self.assertRaises(ValueError):m.check_receipts(pin,q,r)
    def test_failed_missing_or_duplicate_gate_is_rejected(self):
        pin=self.pins[0]
        for mutation in [lambda q:q['gates'].pop(),lambda q:q['gates'].append(q['gates'][0]),lambda q:q['gates'][0]['step'].update(conclusion='failure')]:
            q,r=self.records(pin);mutation(q)
            with self.assertRaises(ValueError):m.check_receipts(pin,q,r)
    def test_test_omission_and_stale_job_are_rejected(self):
        pin=self.pins[0]
        for mutation in [lambda q,r:q['tests'].update(skipped=1),lambda q,r:r['jobs'][1].update(actualCheckoutCommit='a'*40),lambda q,r:r['coverage'].update(eachSourceTestFileExactlyOnce=False),lambda q,r:r.update(runAttempt=2)]:
            q,r=self.records(pin);mutation(q,r)
            with self.assertRaises(ValueError):m.check_receipts(pin,q,r)

if __name__=='__main__':unittest.main()
