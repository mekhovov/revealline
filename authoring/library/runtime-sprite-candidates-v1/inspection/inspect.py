"""Independently decode this closed candidate cohort; never create or modify PNGs."""
import hashlib
import io
import json
from pathlib import Path
import struct
import subprocess
import zlib
from PIL import Image, __version__ as pillow_version

COHORT = Path(__file__).resolve().parents[1]
ROOT = COHORT.parents[2]
SPEC = json.loads((COHORT / 'input.json').read_text())
BINDINGS = json.loads((COHORT / 'bindings.json').read_text())
MANIFEST = json.loads((COHORT / 'export/manifest.json').read_text())
sha = lambda b: hashlib.sha256(b).hexdigest()
assert SPEC['sources'] == MANIFEST['sources']
assert SPEC['size'] == MANIFEST['size'] == 128
assert len(SPEC['sources']) == len(BINDINGS['entries']) == len(MANIFEST['entries']) == 14
assert set(p.name for p in (COHORT/'export').iterdir()) == {'manifest.json', *(e['file'] for e in MANIFEST['entries'])}

def git_bytes(path):
    return subprocess.check_output(['git', 'show', BINDINGS['sourceCommit'] + ':' + path], cwd=ROOT)

def chunks(data):
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    offset, result = 8, []
    while offset < len(data):
        length = struct.unpack('>I', data[offset:offset+4])[0]
        kind = data[offset+4:offset+8]
        payload = data[offset+8:offset+8+length]
        assert len(payload) == length
        crc = struct.unpack('>I', data[offset+8+length:offset+12+length])[0]
        assert zlib.crc32(kind+payload) & 0xffffffff == crc
        result.append((kind.decode('ascii'), payload))
        offset += length + 12
        if kind == b'IEND':
            break
    assert offset == len(data)
    return result

def describe(image):
    alpha = image.getchannel('A')
    hist = alpha.histogram()
    edge = list(alpha.crop((0, 0, image.width, 1)).tobytes()) + list(alpha.crop((0, image.height-1, image.width, image.height)).tobytes())
    edge += list(alpha.crop((0, 1, 1, image.height-1)).tobytes()) + list(alpha.crop((image.width-1, 1, image.width, image.height-1)).tobytes())
    return {'pixelsSha256': sha(image.tobytes()), 'alphaBBox': list(alpha.getbbox()),
            'visiblePixels': image.width*image.height-hist[0], 'transparentPixels': hist[0],
            'opaquePixels': hist[255], 'intermediateAlphaPixels': sum(hist[1:255]),
            'alphaLevels': sum(n>0 for n in hist), 'edgeAlphaMax': max(edge),
            'edgeNonzeroPixels': sum(a>0 for a in edge), 'distinctRGBA': len(image.getcolors(image.width*image.height))}

enemy_raw = git_bytes('game/content/enemy-presentations.json')
presets_raw = git_bytes('authoring/motion-lab/presets.json')
enemies = json.loads(enemy_raw)['entries']
presets = json.loads(presets_raw)
ukraine = next(s for s in presets['characterPresentations']['sets'] if s['themeId']=='ukraine')
rows=[]
for source, binding, entry in zip(SPEC['sources'], BINDINGS['entries'], MANIFEST['entries']):
    assert source == entry['original'] and source['id'] == binding['id']
    assert binding['runtimeAdopted'] is False
    parent_path = ROOT/source['path']
    parent_bytes = parent_path.read_bytes()
    assert len(parent_bytes) == source['bytes'] and sha(parent_bytes) == source['sha256']
    blob = subprocess.check_output(['git','rev-parse', BINDINGS['sourceCommit']+':'+source['path']],cwd=ROOT,text=True).strip()
    assert hashlib.sha1(b'blob '+str(len(parent_bytes)).encode()+b'\0'+parent_bytes).hexdigest() == blob
    parent_chunks = chunks(parent_bytes)
    assert parent_chunks[0][0]=='IHDR'
    assert struct.unpack('>IIBBBBB',parent_chunks[0][1]) == (source['width'],source['height'],8,6,0,0,0)
    with Image.open(io.BytesIO(parent_bytes)) as raw:
        raw.load(); assert raw.mode=='RGBA'; parent=raw.copy()
    candidate_bytes=(COHORT/'export'/entry['file']).read_bytes()
    assert len(candidate_bytes)==entry['output']['bytes'] and sha(candidate_bytes)==entry['output']['sha256']
    assert entry['file']==source['id']+'-'+sha(candidate_bytes)+'.png'
    parsed=chunks(candidate_bytes)
    assert [c[0] for c in parsed]==['IHDR','IDAT','IEND']
    assert struct.unpack('>IIBBBBB',parsed[0][1])==(128,128,8,6,0,0,0)
    with Image.open(io.BytesIO(candidate_bytes)) as raw:
        raw.load(); assert raw.mode=='RGBA' and raw.size==(128,128); candidate=raw.copy()
    rgba=candidate.tobytes(); assert sha(rgba)==entry['output']['pixelsSha256']
    original=parent.tobytes()
    sampled=b''.join(original[4*(((2*y+1)*parent.height//256)*parent.width+((2*x+1)*parent.width//256)):4*(((2*y+1)*parent.height//256)*parent.width+((2*x+1)*parent.width//256))+4] for y in range(128) for x in range(128))
    assert rgba==sampled, 'Every candidate RGBA sample must equal its exact parent frame'
    assert entry['frame']=={'crop':False,'pivot':[0.5,0.5],'heading':'north'}
    if binding['kind']=='enemy':
        authority=next(e for e in enemies if e['type']==binding['role'] and e['skinId']==binding['skinId'])
        assert authority['presentationId']==source['id'] and authority['src']==source['path']
        assert all(authority[k]==source[k] for k in ['bytes','sha256','width','height'])
        assert authority['pivot']==[0.5,0.5]
        ancestry={'kind':'enemy','role':binding['role'],'skinId':binding['skinId'],'motion':authority['motion']}
    else:
        assert binding['kind']=='player' and binding['themeId']=='ukraine'
        assert ukraine['classBodies'][binding['role']]==source['id']
        authority=presets['characters'][source['id']]
        assert (ROOT/'authoring/motion-lab'/authority['src']).resolve()==parent_path.resolve()
        assert authority['originalSha256']==source['sha256'] and authority['headingOffsetDegrees']==0
        ancestry={'kind':'player','role':binding['role'],'themeId':'ukraine','animationRecipe':authority['animationRecipe'],'recipe':presets['animationRecipes'][authority['animationRecipe']]}
    rows.append({'id':source['id'],'originalGitBlob':blob,'parent':describe(parent),'output':describe(candidate),
                 'file':entry['file'],'outputBytes':len(candidate_bytes),'outputSHA256':sha(candidate_bytes),
                 'frame':entry['frame'],'frameSHA256':sha(json.dumps(entry['frame'],sort_keys=True,separators=(',',':')).encode()),
                 'parentBindingSHA256':sha(json.dumps(ancestry,sort_keys=True,separators=(',',':')).encode()),'binding':ancestry,
                 'allSamplesEqualParent':True,'closedPNGChunks':[c[0] for c in parsed]})
result={'format':'revealline-sprite-candidate-inspection.v1','status':'DECODE_AND_PARENT_BINDING_PASS_VISUAL_SEPARATE',
        'sourceCommit':BINDINGS['sourceCommit'],'compilerCommit':BINDINGS['compilerCommit'],'inspector':'Python/Pillow '+pillow_version,
        'inputSHA256':sha((COHORT/'input.json').read_bytes()),'bindingSHA256':sha((COHORT/'bindings.json').read_bytes()),
        'manifestSHA256':sha((COHORT/'export/manifest.json').read_bytes()),'inspectorSHA256':sha(Path(__file__).read_bytes()),
        'authoritySHA256':{'game/content/enemy-presentations.json':sha(enemy_raw),'authoring/motion-lab/presets.json':sha(presets_raw)},
        'count':14,'parentBytes':sum(s['bytes'] for s in SPEC['sources']),'outputBytes':sum(r['outputBytes'] for r in rows),'rows':rows,
        'limits':['No PNGs are written or re-encoded by this inspection.','Center pivot/north are frame assumptions; mechanical anchors and perception require separate visual review.','Static sampled bodies do not create new originals or complete animation sets.','No runtime adapter, storage identity, simulation, release or original source is changed.']}
print(json.dumps(result,indent=2))
