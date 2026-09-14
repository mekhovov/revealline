"""Copy independently verified immutable artifacts to a new draft release; never publish it."""
from pathlib import Path
import datetime,hashlib,json,os,re,shutil,subprocess,sys,time,zipfile
BASE=Path(__file__).resolve().parent
NAMES={'source.tar','distribution.zip','distribution.zip.sha256','manifest.json','release.json','source-qualification.json','frozen-integrity.json'}
def require(value,message):
    if not value:raise ValueError(message)
def hashfile(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for b in iter(lambda:stream.read(1024*1024),b''):h.update(b)
    return h.hexdigest()
def check_promotion(row,pin,proof,verification):
    require(row['version']==pin['version'] and row['sourceRevision']==pin['sourceRevision'],'Wrong promoted source')
    require(re.fullmatch('[a-f0-9]{40}',row['tagObject']) is not None,'Missing annotated tag object')
    require({x['name'] for x in row['expectedAssets']}==NAMES and len(row['expectedAssets'])==7,'Exact seven original assets required')
    require(all(re.fullmatch('[a-f0-9]{64}',x['sha256']) and isinstance(x['bytes'],int) and 0<x['bytes']<750_000_000 for x in row['expectedAssets']),'Invalid original asset pin')
    require(proof['passed'] is True and proof['version']==row['version'] and proof['sourceRevision']==row['sourceRevision'],'Independent artifact proof is required')
    require(proof['format']=='revealline-local-artifact-integrity.v1' and all(proof[k] is True for k in ['sourceArtifactTransportVerified','distributionArtifactTransportVerified','metadataArtifactTransportVerified','sourceArchiveEqualsFreshGitArchive','zipMemberBodiesVerified','zipCRCsVerified']),'Incomplete independent artifact verification')
    require(proof['sourceExtracted'] is False and proof['looseFilesVerified'] is False,'Independent archive and original loose-file verification scope must remain distinct')
    require(proof['artifacts']==row['artifacts'] and proof['freezeControllerRevision']==row['freezeControllerRevision'] and proof['freezeRunId']==row['freezeRunId'],'Artifact receipt source run mismatch')
    assets={x['name']:x for x in row['expectedAssets']}
    require(proof['sourceArchiveSha256']==assets['source.tar']['sha256'] and proof['sourceArchiveBytes']==assets['source.tar']['bytes'] and proof['distributionSha256']==assets['distribution.zip']['sha256'] and proof['distributionBytes']==assets['distribution.zip']['bytes'] and proof['hostedLooseFileProofSha256']==assets['frozen-integrity.json']['sha256'],'Independent proof and original uploaded bodies differ')
    independent=row['independentVerification']
    require(verification['format']=='revealline-hosted-independent-artifact-verification.v1' and verification['passed'] is True,'Missing second independent verification')
    require(verification['version']==row['version'] and verification['sourceRevision']==row['sourceRevision'] and verification['sourceTree']==proof['sourceTree']==pin['sourceTree'],'Independent source identity differs')
    require(verification['firstFreezeRunId']==row['freezeRunId'] and verification['firstFreezeControllerRevision']==row['freezeControllerRevision'],'First freeze identity differs')
    require(verification['independentVerifierRunId']==independent['runId'] and verification['independentVerifierRunAttempt']==independent['runAttempt']==1 and verification['independentVerifierControllerRevision']==independent['controllerRevision'],'Independent verification run differs')
    require(verification['independentArtifactProofSha256']==row['independentArtifactProofSha256'] and verification['originalHostedLooseProofSha256']==assets['frozen-integrity.json']['sha256'],'Independent proof hashes differ')
    require(all(verification[k] is True for k in ['allThreeTransportBodiesVerified','sourceArchiveEqualsFreshGitArchive','zipMemberBodiesVerified','zipCRCsVerified','originalHostedLooseFilesVerified']) and all(verification[k] is False for k in ['independentLooseFilesVerified','gameBuildPerformed','publicationPerformed']),'Independent verification scope differs')
    require(verification['sourceGitBodiesAndExecutableModesVerified']==proof['sourceGitBodiesAndExecutableModesVerified'] and verification['sourceGitBodiesAndExecutableModesVerified']>0,'Source body coverage differs')
    require(verification['pinsSha256']==proof['artifactPinsSha256'],'Wrapper pin proof differs')
    require(row['qualificationSha256']==pin['qualificationSha256'],'Changed source qualification')
    require(set(row['artifacts'])=={'source','distribution','metadata'},'Exact three artifact wrappers required')
    for kind,a in row['artifacts'].items():
        require(a['name']=='frozen-'+row['version']+'-'+kind and a['digest'].startswith('sha256:') and re.fullmatch('[a-f0-9]{64}',a['digest'][7:]) and isinstance(a['id'],int),'Invalid wrapper pin')

def write_receipt(path,value):
    with path.open('x') as out:json.dump(value,out,indent=2);out.write('\n')
def release_by_tag(api,version):
    matches=[]
    for page in range(1,101):
        values=api(f'releases?per_page=100&page={page}');require(isinstance(values,list),'Release enumeration failed')
        matches.extend(x for x in values if x['tag_name']==version)
        if len(values)<100:break
    else:raise ValueError('Release enumeration exceeded bounded page count')
    require(len(matches)<=1,'Duplicate release tag records')
    return matches[0] if matches else None
def empty_recovery(api,version,row,recovery):
    live=api('releases/'+str(recovery['releaseId']))
    require(live['id']==recovery['releaseId'] and live['tag_name']==version and live['draft'] is True and live['prerelease'] is False and live['assets']==[],'Pinned draft is not still empty and private')
    require(live['name']==row['title'] and live['body']==row['releaseNotes'] and live['author']['login']=='github-actions[bot]','Pinned owned draft metadata differs')
    selected=release_by_tag(api,version);require(selected is None or selected['id']==live['id'],'Another release owns this version')
    return live
def observe_uploaded(api,release_id,version,name,expected,pause=time.sleep):
    for attempt in range(12):
        live=api('releases/'+str(release_id));require(live['id']==release_id and live['tag_name']==version and live['draft'] is True,'Saved draft identity changed after upload')
        matches=[a for a in live['assets'] if a['name']==name];require(len(matches)<=1,'Uploaded asset duplicated')
        if matches and matches[0]['state']=='uploaded':
            actual=matches[0];require(actual['size']==expected['bytes'] and actual['digest']=='sha256:'+expected['sha256'],'Uploaded asset differs');return actual
        if attempt<11:pause(2)
    raise ValueError('Uploaded asset has not appeared; retain draft and do not retry the write')
def retain_draft(api,version,row,assets,notes,reports,check_tag,create,upload,recovery=None):
    check_tag()
    if recovery is None:
        require(release_by_tag(api,version) is None,'A published release or draft already exists')
        draft=create(version,notes)
    else:draft=empty_recovery(api,version,row,recovery)
    require(draft and draft['tag_name']==version and draft['draft'] and not draft['prerelease'],'Created or resumed draft identity missing')
    release_id=draft['id'];write_receipt(reports/'draft-created.json',{'releaseId':release_id,'tag':version,'draft':True,'uploadComplete':False,'createdInThisRun':recovery is None,'resumedFromFailedRun':recovery['priorRunId'] if recovery else None})
    require(not draft['assets'],'New draft already contains assets')
    for name in sorted(NAMES):
        result=upload(release_id,name,assets/name)
        write_receipt(reports/('uploaded-'+name+'.json'),result)
    final=api('releases/'+str(release_id));require(final['id']==release_id and final['tag_name']==version and final['draft'] and not final['prerelease'],'Draft unexpectedly changed or published')
    actual={a['name']:a for a in final['assets']};require(set(actual)==NAMES and len(final['assets'])==7,'Unexpected release assets')
    for expected in row['expectedAssets']:
        a=actual[expected['name']];require(a['state']=='uploaded' and a['size']==expected['bytes'] and a['digest']=='sha256:'+expected['sha256'],'GitHub stored body mismatch')
    check_tag();return final

def main():
    version=sys.argv[1];require(version in ['v0.49.0','v0.50.0','v0.51.0'],'Unlisted version')
    reports=Path('promotion-receipts')/version;reports.mkdir(parents=True,exist_ok=False)
    write_receipt(reports/'request.json',{'version':version,'controllerRevision':os.environ.get('GITHUB_SHA'),'runId':os.environ.get('GITHUB_RUN_ID'),'draftOnly':True,'publicationPerformed':False})
    manifest=json.loads((BASE/'promotions.json').read_text())
    require(manifest['format']=='revealline-frozen-promotion.v1' and manifest['sourceRepository']=='mekhovov/revealline','Untrusted promotion manifest')
    rows=[r for r in manifest['sources'] if r['version']==version];require(len(rows)==1,'Unlisted promotion');row=rows[0]
    require(row['freezeRunId']==manifest['freezeRunId'] and row['freezeControllerRevision']==manifest['freezeControllerRevision'],'Promotion run identity differs')
    pin=next(x for x in json.loads((BASE/'sources.json').read_text())['sources'] if x['version']==version)
    proofpath=BASE/'promotions'/version/'local-artifact-integrity.json';require(hashfile(proofpath)==row['independentArtifactProofSha256'],'Changed independent proof')
    summarypath=BASE/'promotions'/version/'verification.json';require(hashfile(summarypath)==row['independentVerification']['summarySha256'],'Changed independent verification summary')
    proof=json.loads(proofpath.read_text());verification=json.loads(summarypath.read_text());check_promotion(row,pin,proof,verification)
    require(shutil.disk_usage(Path.cwd()).free>=8*1024**3,'Draft asset promotion requires8GiBfree')
    def rawapi(route):return subprocess.check_output(['gh','api','repos/mekhovov/revealline/'+route],timeout=120)
    def api(route):return json.loads(rawapi(route))
    def check_tag():
        ref=api('git/ref/tags/'+version);require(ref['object']['type']=='tag' and ref['object']['sha']==row['tagObject'],'Tag object changed')
        tag=api('git/tags/'+row['tagObject']);require(tag['object']['type']=='commit' and tag['object']['sha']==row['sourceRevision'],'Tag source changed')
    recovery_config=json.loads((BASE/'recoveries.json').read_text())
    require(recovery_config['format']=='revealline-owned-empty-draft-recovery.v1' and recovery_config['sourceRepository']=='mekhovov/revealline' and recovery_config['promotionsSha256']==hashfile(BASE/'promotions.json'),'Recovery manifest differs')
    recoveries=[r for r in recovery_config['sources'] if r['version']==version];require(len(recoveries)==1,'Exact owned draft recovery required');recovery=recoveries[0]
    require(recovery['expectedAssetsBefore']==0,'Only empty own drafts may resume')
    failed_path=BASE/'recoveries'/version/'failure.json';require(hashfile(failed_path)==recovery['failureSha256'],'Prior failure proof differs')
    failed=json.loads(failed_path.read_text());require(failed['passed'] is False and failed['publicationPerformed'] is False and failed['retainedRelease']['id']==recovery['releaseId'] and failed['retainedRelease']['assets']==[],'Prior empty-draft proof differs')
    prior=api('actions/runs/'+str(recovery['priorRunId']));require(prior['conclusion']=='failure' and prior['status']=='completed' and prior['head_sha']==recovery['priorControllerRevision'] and prior['path']=='.github/workflows/promote-qualified-artifacts.yml','Prior failed run differs')
    check_tag();empty_recovery(api,version,row,recovery)
    run=api('actions/runs/'+str(manifest['freezeRunId']));require(run['status']=='completed' and run['conclusion']=='success' and run['head_sha']==manifest['freezeControllerRevision'] and run['path']=='.github/workflows/freeze-qualified-sources.yml','Freeze run is not the accepted immutable pass')
    independent=row['independentVerification'];second=api('actions/runs/'+str(independent['runId']))
    require(second['status']=='completed' and second['conclusion']=='success' and second['head_sha']==independent['controllerRevision'] and second['run_attempt']==independent['runAttempt']==1 and second['event']=='push' and second['head_branch']=='codex/verify-qualified-freeze-artifacts' and second['path']=='.github/workflows/reverify-qualified-artifacts.yml' and second['repository']['full_name']==second['head_repository']['full_name']=='mekhovov/revealline','Independent run is not the accepted immutable pass')
    pinned=independent['proofArtifact'];live=api('actions/artifacts/'+str(pinned['id']))
    require(live['expired'] is False and all(live[k]==pinned[k] for k in ['id','name','size_in_bytes','digest']) and live['name']=='reverified-'+version+'-proof','Independent proof artifact differs')
    require(live['workflow_run']['id']==independent['runId'] and live['workflow_run']['head_sha']==independent['controllerRevision'],'Independent proof artifact run differs')
    artifactlist=api('actions/runs/'+str(manifest['freezeRunId'])+'/artifacts?per_page=100');byid={a['id']:a for a in artifactlist['artifacts']}
    work=Path('promotion-work')/version;require(not work.exists(),'Existing draft staging');work.mkdir(parents=True);assets=work/'assets';assets.mkdir()
    prior_pin=recovery['failureArtifact'];prior_live=api('actions/artifacts/'+str(prior_pin['id']))
    require(not prior_live['expired'] and all(prior_live[k]==prior_pin[k] for k in ['id','name','size_in_bytes','digest']) and prior_live['workflow_run']['id']==recovery['priorRunId'] and prior_live['workflow_run']['head_sha']==recovery['priorControllerRevision'],'Prior failure artifact differs')
    prior_wrapper=work/'prior-failure.zip'
    with prior_wrapper.open('xb') as out:subprocess.run(['gh','api','--allow-escape-sequences','repos/mekhovov/revealline/actions/artifacts/'+str(prior_pin['id'])+'/zip'],stdout=out,check=True,timeout=120)
    require(prior_wrapper.stat().st_size==prior_pin['size_in_bytes'] and hashfile(prior_wrapper)==prior_pin['digest'][7:],'Prior failure transport differs')
    with zipfile.ZipFile(prior_wrapper) as archive:
        require(set(archive.namelist())=={'request.json','failure.json'} and len(archive.namelist())==2 and archive.getinfo('failure.json').file_size==failed_path.stat().st_size<100_000,'Prior failure members differ')
        require(archive.read('failure.json')==failed_path.read_bytes(),'Prior failure body differs')
    proofwrapper=work/'independent-proof.zip'
    with proofwrapper.open('xb') as out:subprocess.run(['gh','api','--allow-escape-sequences','repos/mekhovov/revealline/actions/artifacts/'+str(independent['proofArtifact']['id'])+'/zip'],stdout=out,check=True,timeout=120)
    require(proofwrapper.stat().st_size==independent['proofArtifact']['size_in_bytes'] and hashfile(proofwrapper)==independent['proofArtifact']['digest'][7:],'Independent proof transport differs')
    with zipfile.ZipFile(proofwrapper) as archive:
        require(len(archive.namelist())==len(set(archive.namelist())),'Duplicate independent proof members')
        for name,path in [('verification.json',summarypath),('local-artifact-integrity.json',proofpath)]:
            member=archive.getinfo(name);require(member.file_size==path.stat().st_size<2_000_000,'Independent proof member size differs')
            require(archive.read(member)==path.read_bytes(),'Independent proof artifact body differs')
    for kind,pinned in row['artifacts'].items():
        live=byid.get(pinned['id']);require(live and not live['expired'] and all(live[k]==pinned[k] for k in ['name','size_in_bytes','digest']),'Stored artifact changed')
        require(live['workflow_run']['id']==manifest['freezeRunId'] and live['workflow_run']['head_sha']==manifest['freezeControllerRevision'],'Artifact source run changed')
        wrapper=work/(kind+'.zip')
        with wrapper.open('xb') as out:subprocess.run(['gh','api','repos/mekhovov/revealline/actions/artifacts/'+str(live['id'])+'/zip','--allow-escape-sequences'],stdout=out,check=True,timeout=1800)
        require(wrapper.stat().st_size==pinned['size_in_bytes'] and hashfile(wrapper)==pinned['digest'][7:],'Artifact transport changed')
        with zipfile.ZipFile(wrapper) as archive:
            wanted={'source.tar'} if kind=='source' else {'distribution.zip'} if kind=='distribution' else {'release.json','manifest.json','distribution.zip.sha256','source-qualification.json','frozen-integrity.json'}
            names=archive.namelist();require(len(names)==len(set(names)) and wanted<=set(names),'Missing or duplicate artifact members')
            if kind!='metadata':require(set(names)==wanted,'Unexpected artifact member')
            for name in wanted:
                member=archive.getinfo(name);require(not member.is_dir() and member.flag_bits&1==0 and member.file_size<750_000_000,'Invalid artifact member')
                with archive.open(member) as inp,(assets/name).open('xb') as out:shutil.copyfileobj(inp,out,1024*1024)
    expected={a['name']:a for a in row['expectedAssets']}
    for name,p in expected.items():require((assets/name).stat().st_size==p['bytes'] and hashfile(assets/name)==p['sha256'],'Original release body changed: '+name)
    record=json.loads((assets/'release.json').read_text());require(record['version']==version and record['sourceRevision']==row['sourceRevision'],'Wrong original release record')
    require(record['sourceArchiveSha256']==expected['source.tar']['sha256'] and record['distributionSha256']==expected['distribution.zip']['sha256'] and record['manifestSha256']==expected['manifest.json']['sha256'],'Release body pins changed')
    require(expected['source-qualification.json']['sha256']==pin['qualificationSha256'],'Qualification upload changed')
    notes=work/'release-notes.md';notes.write_text(row['releaseNotes'])
    def create(tag,notes):
        request=work/'create-draft.json';write_receipt(request,{'tag_name':tag,'target_commitish':row['sourceRevision'],'draft':True,'prerelease':False,'make_latest':'false','name':row['title'],'body':notes.read_text()})
        # The POST response is the ID authority; a listing can lag immediately after creation.
        return json.loads(subprocess.check_output(['gh','api','--method','POST','repos/mekhovov/revealline/releases','--input',str(request)],timeout=120))
    def upload(release_id,name,path):
        selected=release_by_tag(api,version);before=api('releases/'+str(release_id))
        require(selected and selected['id']==release_id and before['id']==release_id and before['tag_name']==version and before['draft'] is True,'Saved draft identity changed before upload')
        require(not any(a['name']==name for a in before['assets']),'Asset already exists; never overwrite')
        subprocess.run(['gh','release','upload',version,str(path),'--repo','mekhovov/revealline'],check=True,timeout=1800)
        expected=next(a for a in row['expectedAssets'] if a['name']==name)
        return observe_uploaded(api,release_id,version,name,expected)
    release=retain_draft(api,version,row,assets,notes,reports,check_tag,create,upload,recovery)
    receipt={'format':'revealline-hosted-draft-promotion.v1','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':True,'version':version,'sourceRevision':row['sourceRevision'],'tagObject':row['tagObject'],'controllerRevision':os.environ['GITHUB_SHA'],'runId':int(os.environ['GITHUB_RUN_ID']),'freezeRunId':manifest['freezeRunId'],'independentArtifactProofSha256':row['independentArtifactProofSha256'],'independentVerificationRunId':independent['runId'],'independentVerificationControllerRevision':independent['controllerRevision'],'releaseId':release['id'],'draft':True,'assets':[{k:a[k] for k in ['id','name','size','digest','state']} for a in release['assets']],'published':False,'pagesDeployed':False}
    (reports/'draft-promotion.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))

if __name__=='__main__':
    try:main()
    except Exception as error:
        if len(sys.argv)>1 and sys.argv[1] in ['v0.49.0','v0.50.0','v0.51.0']:
            reports=Path('promotion-receipts')/sys.argv[1]
            if reports.is_dir() and not (reports/'failure.json').exists():
                state={'passed':False,'errorType':type(error).__name__,'message':str(error)[:2000],'publicationPerformed':False,'remoteDeletionPerformed':False,'at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
                try:
                    def api(route):return json.loads(subprocess.check_output(['gh','api','repos/mekhovov/revealline/'+route],timeout=120))
                    created=reports/'draft-created.json'
                    live=api('releases/'+str(json.loads(created.read_text())['releaseId'])) if created.exists() else release_by_tag(api,sys.argv[1])
                    state['retainedRelease']=live
                except Exception as query:state['releaseLookupFailure']=str(query)[:1000]
                write_receipt(reports/'failure.json',state)
        raise
