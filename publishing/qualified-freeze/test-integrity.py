"""Small fixtures for the same independent verifier used by hosted freezes."""
import hashlib,json,pathlib,subprocess,tempfile,unittest,zipfile
ROOT=pathlib.Path(__file__).resolve().parent

def digest(data):return hashlib.sha256(data).hexdigest()

class IntegrityTests(unittest.TestCase):
    def fixture(self,root):
        def git(*args):return subprocess.check_output(['git','-C',str(root),*args],stderr=subprocess.DEVNULL,text=True).strip()
        git('init');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid')
        (root/'game').mkdir();(root/'game/index.html').write_text('<title>Fixture</title>\n')
        (root/'script.sh').write_text('#!/bin/sh\nexit 0\n');(root/'script.sh').chmod(0o755)
        git('add','game/index.html','script.sh');git('commit','-m','fixture');commit=git('rev-parse','HEAD')
        frozen=root/'releases/v0.50.0';site=frozen/'site';site.mkdir(parents=True)
        subprocess.check_call(['git','-C',str(root),'archive','--format=tar','--output='+str(frozen/'source.tar'),commit])
        (site/'game').mkdir();data=b'<title>Built fixture</title>\n';(site/'game/index.html').write_bytes(data)
        manifest={'version':'v0.50.0','sourceRevision':commit,'files':[{'path':'game/index.html','bytes':len(data),'sha256':digest(data)}],'totalBytes':len(data)}
        mb=(json.dumps(manifest)+'\n').encode();(site/'manifest.json').write_bytes(mb)
        with zipfile.ZipFile(site/'distribution.zip','w') as z:z.writestr('game/index.html',data);z.writestr('manifest.json',mb)
        zhash=digest((site/'distribution.zip').read_bytes());(site/'distribution.zip.sha256').write_text(zhash+'  distribution.zip\n');(site/'.xonix-build.json').write_text('{}\n')
        record={'version':'v0.50.0','sourceRevision':commit,'sourceArchiveSha256':digest((frozen/'source.tar').read_bytes()),'distributionSha256':zhash,'manifestSha256':digest(mb)};(frozen/'release.json').write_text(json.dumps(record)+'\n')
        return commit,frozen,site
    def run_verifier(self,root,commit):
        return subprocess.run(['python3',str(ROOT/'verify-frozen.py'),str(root),'v0.50.0',commit,str(root/'integrity.json')],capture_output=True,text=True)
    def test_exact_tar_modes_manifest_and_zip_pass(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp);commit,_,_=self.fixture(root);result=self.run_verifier(root,commit)
            self.assertEqual(result.returncode,0,result.stderr);record=json.loads((root/'integrity.json').read_text());self.assertEqual(record['sourceGitBodiesAndExecutableModesVerified'],2);self.assertTrue(record['zipCRCsVerified'])
    def test_changed_loose_body_rejected_without_receipt(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp);commit,_,site=self.fixture(root);(site/'game/index.html').write_text('wrong')
            self.assertNotEqual(self.run_verifier(root,commit).returncode,0);self.assertFalse((root/'integrity.json').exists())
    def test_changed_archive_or_extra_file_rejected(self):
        for target in ['source.tar','site/extra.txt']:
            with tempfile.TemporaryDirectory() as tmp:
                root=pathlib.Path(tmp);commit,frozen,_=self.fixture(root);(frozen/target).write_text('wrong')
                self.assertNotEqual(self.run_verifier(root,commit).returncode,0);self.assertFalse((root/'integrity.json').exists())

if __name__=='__main__':unittest.main()
