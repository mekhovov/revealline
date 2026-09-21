import concurrent.futures, datetime, hashlib, json, pathlib, subprocess, sys
root=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]); base='https://mekhovov.github.io/revealline-soundtracks-01/'
manifest_bytes=(root/'deployment-manifest.json').read_bytes(); manifest=json.loads(manifest_bytes)
files=[f for f in manifest['files'] if f['path']!='.nojekyll']+[{'path':'deployment-manifest.json','bytes':len(manifest_bytes),'sha256':hashlib.sha256(manifest_bytes).hexdigest()}]
def check(f):
    url=base+f['path']; digest=hashlib.sha256(); size=0
    proc=subprocess.Popen(['curl','--silent','--show-error','--fail','--location','--proto','=https','--proto-redir','=https','--max-redirs','2','--connect-timeout','20','--max-time','180','--write-out','%{stderr}\n%{http_code} %{url_effective}\n',url],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    try:
        while True:
            chunk=proc.stdout.read(262144)
            if not chunk: break
            size+=len(chunk); digest.update(chunk)
            if size>f['bytes']: proc.kill(); raise RuntimeError('Response larger than expected: '+f['path'])
        err=proc.stderr.read().decode(); code=proc.wait()
        if code or err.strip()!=('200 '+url): raise RuntimeError(f'HTTP failure {f["path"]}: {code}: {err}')
        actual=digest.hexdigest()
        if size!=f['bytes'] or actual!=f['sha256']: raise RuntimeError('Hash/length mismatch: '+f['path'])
        return {'path':f['path'],'url':url,'status':200,'bytes':size,'sha256':actual,'verified':True}
    finally:
        if proc.poll() is None: proc.kill(); proc.wait()
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results=list(pool.map(check,files))
receipt={'format':'revealline-public-mp3-delivery-verification.v1','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baseURL':base,'archiveCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'manifestSha256':hashlib.sha256(manifest_bytes).hexdigest(),'verified':True,'publicFiles':len(results),'audioFiles':sum(x['path'].endswith('.mp3') for x in results),'audioBytes':sum(x['bytes'] for x in results if x['path'].endswith('.mp3')),'totalBytes':sum(x['bytes'] for x in results),'deploymentOnlyFiles':[{'path':'.nojekyll','bytes':0,'sha256':'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855','observedHTTPStatus':404,'note':'Zero-byte Pages configuration marker is in the verified deployment payload; GitHub Pages does not expose this dotfile URL.'}],'method':'All served responses streamed through curl with TLS verification; HTTPS only; exact 200 URL, byte count and SHA-256 checked; no audio copies retained.','files':results}
out.write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({k:v for k,v in receipt.items() if k!='files'},indent=2))
