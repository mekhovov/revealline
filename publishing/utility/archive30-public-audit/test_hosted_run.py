import importlib.util,json,unittest
from pathlib import Path
from unittest.mock import patch
import hosted_run
P=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('public_api_get',P/'payload/http/public_api_get.py');api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
class HostedContractTests(unittest.TestCase):
    def test_only_exact_reviewed_binding_accepted(self):
        value=json.loads((P/'binding.proposed.json').read_bytes());value['reviewed']=True
        # Synthetic authority is only injected in memory for contract testing.
        value.update(deploymentId=101,deploymentStatusId=102,receiptArtifactId=103,receiptBytes=104,receiptSha256='1'*64,executionRequestSha256='2'*64)
        with patch.object(Path,'read_text',return_value=json.dumps(value)):
            self.assertEqual(hosted_run.validate_binding(json.dumps(value)),value)
            self.assert_modified_bindings_rejected(value)
    def assert_modified_bindings_rejected(self,value):
        for key,value2 in [('reviewed',False),('archiveCommit','0'*40),('runId',1),('expectedFiles',704),('receiptArtifactId',1)]:
            changed={**value,key:value2}
            with self.assertRaises(ValueError):hosted_run.validate_binding(json.dumps(changed))
    def test_pending_authority_cannot_be_enabled_by_review_flag(self):
        value=json.loads((P/'binding.proposed.json').read_bytes());value['reviewed']=True
        value['deploymentId']=None
        with patch.object(Path,'read_text',return_value=json.dumps(value)):
            with self.assertRaisesRegex(ValueError,'authority is still pending'):
                hosted_run.validate_binding(json.dumps(value))
    def test_duplicate_binding_keys_rejected(self):
        with self.assertRaises(ValueError):hosted_run.strict('{"reviewed":true,"reviewed":false}')
    def test_extra_binding_keys_rejected(self):
        v=json.loads((P/'binding.proposed.json').read_bytes());v.update(reviewed=True,arbitraryURL='https://example.com')
        with self.assertRaises(ValueError):hosted_run.validate_binding(json.dumps(v))
    def test_only_four_public_authority_routes(self):
        p='repos/mekhovov/revealline-archive-30/'
        # Deployment 123 is an offline fixture, never a dispatch binding.
        with patch.object(api,'DEPLOYMENT_ID',123):
            for endpoint in ['git/ref/heads/main','actions/runs/35431113584','deployments/123','deployments/123/statuses']:
                self.assertEqual(api.endpoint(p+endpoint),'https://api.github.com/'+p+endpoint)
            for bad in ['https://example.com',p+'actions/runs/1',p+'actions/runs/35421309244',p+'deployments/6537067684',p+'actions/artifacts/10577528164/zip',p+'git/ref/heads/main?token=secret']:
                with self.assertRaises(ValueError):api.endpoint(bad)
    def test_pending_deployment_disables_all_authority_routes(self):
        with patch.object(api,'DEPLOYMENT_ID',None):
            with self.assertRaisesRegex(ValueError,'pending'):
                api.endpoint('repos/mekhovov/revealline-archive-30/git/ref/heads/main')
    def test_authority_redirect_refused(self):
        with self.assertRaises(ValueError):api.NoRedirect().redirect_request(None,None,302,'',{},'https://example.com')
    def test_embedded_payload_pins_match(self):
        rows=json.loads((P/'payload-pins.json').read_bytes());self.assertEqual(len({r['path'] for r in rows}),len(rows))
        for r in rows:
            b=(P/'payload'/r['path']).read_bytes();self.assertEqual(len(b),r['bytes']);self.assertEqual(hosted_run.sha(b),r['sha256'])
if __name__=='__main__':unittest.main()
