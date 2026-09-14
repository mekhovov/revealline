"""Small refusal tests for the immutable draft-retention boundary; no network."""
import copy, importlib.util, pathlib, tempfile, unittest
spec=importlib.util.spec_from_file_location('promotion',pathlib.Path(__file__).with_name('promote.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def fixture():
 h='a'*64; source='b'*40; tree='c'*40; controller='d'*40; second='e'*40
 assets=[{'name':n,'bytes':10,'sha256':h} for n in sorted(m.NAMES)]
 artifacts={role:{'id':i+1,'name':'frozen-v0.49.0-'+role,'digest':'sha256:'+h,'size_in_bytes':100} for i,role in enumerate(['metadata','source','distribution'])}
 pin={'version':'v0.49.0','sourceRevision':source,'sourceTree':tree,'qualificationSha256':h}
 row={**pin,'tagObject':'f'*40,'expectedAssets':assets,'artifacts':artifacts,'freezeControllerRevision':controller,'freezeRunId':1,'independentArtifactProofSha256':h,'independentVerification':{'runId':2,'runAttempt':1,'controllerRevision':second}}
 proof={'format':'revealline-local-artifact-integrity.v1','passed':True,'version':pin['version'],'sourceRevision':source,'sourceTree':tree,'artifacts':artifacts,'freezeControllerRevision':controller,'freezeRunId':1,'sourceExtracted':False,'looseFilesVerified':False,'sourceArchiveSha256':h,'sourceArchiveBytes':10,'distributionSha256':h,'distributionBytes':10,'hostedLooseFileProofSha256':h,'sourceGitBodiesAndExecutableModesVerified':12,'artifactPinsSha256':h}
 for key in ['sourceArtifactTransportVerified','distributionArtifactTransportVerified','metadataArtifactTransportVerified','sourceArchiveEqualsFreshGitArchive','zipMemberBodiesVerified','zipCRCsVerified']:proof[key]=True
 summary={'format':'revealline-hosted-independent-artifact-verification.v1','passed':True,'version':pin['version'],'sourceRevision':source,'sourceTree':tree,'firstFreezeRunId':1,'firstFreezeControllerRevision':controller,'independentVerifierRunId':2,'independentVerifierRunAttempt':1,'independentVerifierControllerRevision':second,'independentArtifactProofSha256':h,'originalHostedLooseProofSha256':h,'sourceGitBodiesAndExecutableModesVerified':12,'pinsSha256':h}
 for key in ['allThreeTransportBodiesVerified','sourceArchiveEqualsFreshGitArchive','zipMemberBodiesVerified','zipCRCsVerified','originalHostedLooseFilesVerified']:summary[key]=True
 for key in ['independentLooseFilesVerified','gameBuildPerformed','publicationPerformed']:summary[key]=False
 return row,pin,proof,summary
class Checks(unittest.TestCase):
 def test_exact_reviewed_pair(self):m.check_promotion(*fixture())
 def reject(self, mutate):
  values=fixture();mutate(*values)
  with self.assertRaises(ValueError):m.check_promotion(*values)
 def test_wrong_game_source(self):self.reject(lambda row,pin,p,s:row.update(sourceRevision='0'*40))
 def test_wrong_independent_controller(self):self.reject(lambda row,pin,p,s:s.update(independentVerifierControllerRevision='0'*40))
 def test_wrong_original_body(self):self.reject(lambda row,pin,p,s:p.update(distributionSha256='0'*64))
 def test_missing_transport(self):self.reject(lambda row,pin,p,s:p.update(metadataArtifactTransportVerified=False))
 def test_false_local_loose_claim(self):self.reject(lambda row,pin,p,s:p.update(looseFilesVerified=True))
 def test_already_published_claim(self):self.reject(lambda row,pin,p,s:s.update(publicationPerformed=True))
 def test_incomplete_body_coverage(self):self.reject(lambda row,pin,p,s:s.update(sourceGitBodiesAndExecutableModesVerified=11))
 def test_artifact_pin_difference(self):self.reject(lambda row,pin,p,s:s.update(pinsSha256='0'*64))
 def test_unexpected_release_asset(self):self.reject(lambda row,pin,p,s:row['expectedAssets'].append({'name':'new.bin','bytes':1,'sha256':'a'*64}))
class DraftBoundary(unittest.TestCase):
 def test_paginated_draft_is_existing(self):
  calls=[]
  def api(route):
   calls.append(route)
   return [{'tag_name':'v0.1.'+str(i)} for i in range(100)] if route.endswith('&page=1') else [{'id':9,'tag_name':'v0.49.0','draft':True}]
  self.assertEqual(m.release_by_tag(api,'v0.49.0')['id'],9);self.assertEqual(len(calls),2)
 def test_existing_draft_refuses_creation(self):
  with tempfile.TemporaryDirectory() as tmp:
   def forbidden(*a):self.fail('Mutation after existing draft')
   with self.assertRaisesRegex(ValueError,'already exists'):
    m.retain_draft(lambda route:[{'tag_name':'v0.49.0','draft':True}],'v0.49.0',fixture()[0],pathlib.Path(tmp),None,pathlib.Path(tmp),forbidden,forbidden,forbidden)
 def test_partial_upload_retains_draft_id_before_failure(self):
  with tempfile.TemporaryDirectory() as tmp:
   reports=pathlib.Path(tmp);state={'created':False};calls=[]
   draft={'id':42,'tag_name':'v0.49.0','draft':True,'prerelease':False,'assets':[]}
   def api(route):return [draft] if state['created'] else []
   def create(*a):state['created']=True
   def upload(rid,name,path):
    self.assertEqual(rid,42);self.assertTrue((reports/'draft-created.json').exists());calls.append(name)
    if len(calls)==2:raise RuntimeError('uncertain upload')
    return {'id':101,'name':name,'state':'uploaded'}
   with self.assertRaisesRegex(RuntimeError,'uncertain upload'):
    m.retain_draft(api,'v0.49.0',fixture()[0],reports,None,reports,lambda:None,create,upload)
   self.assertTrue((reports/'draft-created.json').exists());self.assertEqual(len(list(reports.glob('uploaded-*.json'))),1)
 def test_created_draft_is_verified_by_id_and_tags_rechecked(self):
  with tempfile.TemporaryDirectory() as tmp:
   reports=pathlib.Path(tmp);row=fixture()[0];state={'created':False,'checks':0};routes=[]
   draft={'id':42,'tag_name':'v0.49.0','draft':True,'prerelease':False,'assets':[]}
   def api(route):
    routes.append(route)
    return copy.deepcopy(draft) if route=='releases/42' else [copy.deepcopy(draft)] if state['created'] else []
   def check():state['checks']+=1
   def create(*a):state['created']=True
   def upload(rid,name,path):
    asset={'id':len(draft['assets'])+1,'name':name,'size':10,'digest':'sha256:'+'a'*64,'state':'uploaded'};draft['assets'].append(asset);return asset
   final=m.retain_draft(api,'v0.49.0',row,reports,None,reports,check,create,upload)
   self.assertTrue(final['draft']);self.assertEqual(state['checks'],2);self.assertIn('releases/42',routes);self.assertFalse(any('releases/tags/' in r for r in routes))
if __name__=='__main__':unittest.main()
