"""One bounded unauthenticated public authority GET; no redirect or credential support."""
import json,sys,time,urllib.request,urllib.error
PREFIX='repos/mekhovov/revealline-archive-32/'
def endpoint(value):
    allowed={PREFIX+'git/ref/heads/main',PREFIX+'actions/runs/35464701544',PREFIX+'deployments/6544867176',PREFIX+'deployments/6544867176/statuses'}
    if value not in allowed: raise ValueError('Unreviewed authority endpoint')
    return 'https://api.github.com/'+value
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): raise ValueError('Authority redirect refused')
def main(args):
    if len(args)!=1: raise ValueError('One exact endpoint required')
    url=endpoint(args[0]);start=time.monotonic();body=bytearray()
    opener=urllib.request.build_opener(NoRedirect())
    request=urllib.request.Request(url,headers={'Accept':'application/vnd.github+json','User-Agent':'RevealLine-archive32-public-authority-audit','X-GitHub-Api-Version':'2022-11-28'})
    with opener.open(request,timeout=25) as response:
        if response.status!=200 or response.geturl()!=url: raise ValueError('Authority response identity mismatch')
        while True:
            if time.monotonic()-start>=40: raise TimeoutError('Authority deadline exceeded')
            chunk=response.read(min(65536,2000001-len(body)))
            if not chunk: break
            body.extend(chunk)
            if len(body)>2000000: raise ValueError('Authority size limit exceeded')
    json.loads(body);sys.stdout.buffer.write(body)
if __name__=='__main__':
    try: main(sys.argv[1:])
    except Exception as exc:
        # No response body, signed redirect target, credential or exception URL is logged.
        print(type(exc).__name__+': public authority GET failed',file=sys.stderr);raise SystemExit(1)
