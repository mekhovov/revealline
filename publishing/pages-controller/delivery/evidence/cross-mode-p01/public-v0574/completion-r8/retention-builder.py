import datetime, hashlib, json, pathlib, shutil, stat, zipfile, zlib
P = pathlib.Path('/Users/oleksandr.mekhovov/work/my_projects/go_test_p01_publish574')
R = pathlib.Path('/Users/oleksandr.mekhovov/work/my_projects/go_test_cross_mode')
L = R / '.cache/cross-mode/p01/v0574-recovery-layout'
N = R / '.cache/cross-mode/p01/public-v0574-offline-completion-r8'
E = P / 'publishing/pages-controller/delivery/evidence/cross-mode-p01/public-v0574'
O = E / 'completion-r8'
C = L / 'p01-acceptance-draft/completion-r8-retention'
FLOOR, MAX_NEW, MAX_BYTES, MAX_FILES = 512*1024**2, 20*1024**2, 64*1024**2, 2000

def read(path):
    assert path.is_absolute() and path.resolve() == path, f'Noncanonical path: {path}'
    assert stat.S_ISREG(path.lstat().st_mode), f'Not an original regular file: {path}'
    assert not {'profile', 'node_modules', '__pycache__'}.intersection(path.parts), path
    before = path.stat(); data = path.read_bytes(); after = path.stat()
    assert (before.st_size, before.st_mtime_ns) == (after.st_size, after.st_mtime_ns), path
    return data

def pin(path):
    data = read(path)
    return {'path': str(path), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

def verify(path, expected):
    got = pin(path)
    assert all(got[k] == expected[k] for k in ['bytes', 'sha256']), (path, got, expected)
    return got

def write(path, obj):
    with path.open('x', encoding='utf-8') as out:
        out.write(json.dumps(obj, indent=2, ensure_ascii=False) + '\n')

baseline = json.loads(read(C/'input-baseline.json'))
protected = [r for r in baseline['files'] if pathlib.PurePosixPath(r['path']).name in baseline['protectedUnchanged']]
for row in protected: verify(P/row['path'], row)
review = json.loads(read(N/'review.json'))
assert review['status'] == 'PASS_SCOPED_REMAINING_COLD_VERIFY_AND_RESTORATION' and review['blockers'] == []
verify(N/'review.json', {'bytes':45779,'sha256':'79bc0f5135b2ce59501b02b3d6596621ff7c9bafaaa6b8201396bfd690b02596'})
verify(N/'manifest.json', {'bytes':10683,'sha256':'c4be7161f3f3e6374b6d0690a1a4e4f5761c699efbe6daf1c0446e7e75855fcb'})
verify(L/'root-r8-scope-review.json', {'bytes':3738,'sha256':'ad68e520831954d27815a6ea18f384605b945a35e0f2316852cc67ca9386bef7'})
assert json.loads(read(N/'closure-check.json'))['status'] == 'CLOSED'
authority = json.loads(read(N/'manifest.json'))
assert authority['count'] == len(authority['files']) == 59
rows = []
for row in authority['files']:
    rel = pathlib.PurePosixPath(row['path'])
    assert not rel.is_absolute() and '..' not in rel.parts
    got = verify(N/rel, row)
    rows.append({'source':got.pop('path'), 'member':'r8/'+str(rel), **got})
assert sum(r['bytes'] for r in rows) == authority['bytes'] == 1414148
extras = [
    (N/'manifest.json', 'r8/manifest.json'),
    (L/'root-r8-scope-review.json', 'context/root-r8-scope-review.json'),
    (L/'p01-acceptance-draft/proof-map.json', 'context/proof-map-before-completion.json'),
    (pathlib.Path('/Users/oleksandr.mekhovov/work/my_projects/go_test_p01_file_cancel/.cache/cross-mode/p01/v0573-final-recovery/p01-acceptance-reconciliation/checklist.md'), 'context/prior-host-reconciliation.md'),
    (C/'input-baseline.json', 'context/input-baseline.json'),
]
for path, member in extras:
    got = pin(path); rows.append({'source':got.pop('path'), 'member':member, **got})
rows.sort(key=lambda r:r['member'])
assert len({r['source'] for r in rows}) == len({r['member'] for r in rows}) == len(rows) <= MAX_FILES
size = sum(r['bytes'] for r in rows); assert size <= MAX_BYTES
estimate = 22
for row in rows:
    compressor=zlib.compressobj(9,zlib.DEFLATED,-15)
    data=read(pathlib.Path(row['source']))
    estimate += len(compressor.compress(data)+compressor.flush()) + 76 + 2*len(row['member'].encode())
assert estimate + 2*1024**2 < MAX_NEW
free = shutil.disk_usage(P).free; assert free - MAX_NEW >= FLOOR
selection={'format':'revealline-p01-r8-completion-selection.v1','sourceRevision':review['source']['sourceRevision'],
    'status':'VERIFIED_R8_ORIGINALS_SELECTED','count':len(rows),'originalBytes':size,'estimatedZipBytes':estimate,
    'boundFiles':MAX_FILES,'boundOriginalBytes':MAX_BYTES,'maxNewOutputBytes':MAX_NEW,'requiredFreeBytes':FLOOR,
    'files':rows,'protectedPriorFiles':protected,
    'scope':'All59 R8 originals plus its original manifest, root scope review, historical proof map/reconciliation and retention baseline.',
    'exclusions':['External genuine current/historical browser profiles','Source/distribution/media payloads','Released source-qualification-evidence.zip; referenced unchanged','R3-R7 originals already sealed in ../evidence.zip'],
    'historicalContext':'The retained earlier proof map and prior-host reconciliation keep their original pending states; completion is additive.'}
write(C/'selection.json',selection)
print(json.dumps({'stage':'estimate-before-write','files':len(rows),'originalBytes':size,'estimatedZipBytes':estimate,'freeBytes':free}),flush=True)
O.mkdir(exist_ok=False)
archive=O/'evidence.zip'
with zipfile.ZipFile(archive,mode='x',compression=zipfile.ZIP_DEFLATED,compresslevel=9,allowZip64=False) as out:
    for row in rows:
        path=pathlib.Path(row['source']);verify(path,row); data=read(path)
        assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256']
        zi=zipfile.ZipInfo(row['member'],date_time=(1980,1,1,0,0,0));zi.create_system=3;zi.external_attr=0o100644<<16;zi.compress_type=zipfile.ZIP_DEFLATED
        out.writestr(zi,data,compresslevel=9)
        assert shutil.disk_usage(P).free >= FLOOR
with zipfile.ZipFile(archive) as out:
    assert out.namelist()==[r['member'] for r in rows]
    assert out.testzip() is None
    for row in rows:
        data=out.read(row['member']); assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256']
        assert data==read(pathlib.Path(row['source']))
for row in protected: verify(P/row['path'],row)
write(O/'manifest.json',selection)
shutil.copyfile(__file__,O/'retention-builder.py')
record={'format':'revealline-p01-r8-completion-retention.v1','status':'ASSEMBLED_AND_VERIFIED','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'originalFiles':len(rows),'originalBytes':size,'r8OriginalFiles':59,'r8OriginalBytes':1414148,
    'archive':{'path':'evidence.zip',**{k:v for k,v in pin(archive).items() if k!='path'}},
    'manifest':{'path':'manifest.json',**{k:v for k,v in pin(O/'manifest.json').items() if k!='path'}},
    'builder':{'path':'retention-builder.py',**{k:v for k,v in pin(O/'retention-builder.py').items() if k!='path'}},
    'allOriginalsReread':True,'allMembersCrcSizeHashAndBytesVerified':True,'priorSealedFilesUnchanged':True,
    'profilesIncluded':False,'runtimePayloadsIncluded':False,'physicalDeviceClaim':False,
    'freeBytesBefore':free,'freeBytesAfter':shutil.disk_usage(P).free,'rootFinalArchiveReviewPending':True}
write(O/'record.json',record)
assert sum(p.stat().st_size for p in O.iterdir()) < MAX_NEW
print(json.dumps({'stage':'complete','output':str(O),'record':pin(O/'record.json'),**record},indent=2))
