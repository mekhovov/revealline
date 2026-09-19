import importlib.util,json,unittest
from pathlib import Path
from unittest.mock import patch
import hosted_run
P=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('public_api_get',P/'payload/http/public_api_get.py');api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
class HostedContractTests(unittest.TestCase):
    def test_only_exact_reviewed_binding_accepted(self):
        value=json.loads((P/'binding.proposed.json').read_bytes());value['reviewed']=True
        self.assertEqual(hosted_run.validate_binding(json.dumps(value)),value)
        for key,value2 in [('reviewed',False),('archiveCommit','0'*40),('runId',1),('expectedFiles',704),('receiptArtifactId',1)]:
            changed={**value,key:value2}
            with self.assertRaises(ValueError):hosted_run.validate_binding(json.dumps(changed))
    def test_duplicate_binding_keys_rejected(self):
        with self.assertRaises(ValueError):hosted_run.strict('{"reviewed":true,"reviewed":false}')
    def test_extra_binding_keys_rejected(self):
        v=json.loads((P/'binding.proposed.json').read_bytes());v.update(reviewed=True,arbitraryURL='https://example.com')
        with self.assertRaises(ValueError):hosted_run.validate_binding(json.dumps(v))
    def test_only_four_public_authority_routes(self):
        p='repos/mekhovov/revealline-archive-33/'
        for endpoint in ['git/ref/heads/main','actions/runs/35476969070','deployments/6547026356','deployments/6547026356/statuses']:
            self.assertEqual(api.endpoint(p+endpoint),'https://api.github.com/'+p+endpoint)
        for bad in ['https://example.com',p+'actions/runs/1',p+'actions/artifacts/10585129992/zip',p+'git/ref/heads/main?token=secret']:
            with self.assertRaises(ValueError):api.endpoint(bad)
    def test_authority_redirect_refused(self):
        with self.assertRaises(ValueError):api.NoRedirect().redirect_request(None,None,302,'',{},'https://example.com')
    def test_embedded_payload_pins_match(self):
        rows=json.loads((P/'payload-pins.json').read_bytes());self.assertEqual(len({r['path'] for r in rows}),len(rows))
        for r in rows:
            b=(P/'payload'/r['path']).read_bytes();self.assertEqual(len(b),r['bytes']);self.assertEqual(hosted_run.sha(b),r['sha256'])
if __name__=='__main__':unittest.main()
