"""Independent SHA256, Git/TAR body+mode, manifest, ZIP body+CRC proof."""
import datetime,hashlib,json,pathlib,subprocess,sys,tarfile,zipfile
ROOT,VERSION,COMMIT,OUT=sys.argv[1:];ROOT=pathlib.Path(ROOT).resolve();OUT=pathlib.Path(OUT).resolve();release=ROOT/'releases'/VERSION
record=json.loads((release/'release.json').read_text());assert record['version']==VERSION and record['sourceRevision']==COMMIT

def stream_hash(f,kind='sha256',prefix=b''):
 h=hashlib.new(kind);h.update(prefix);size=0
 while chunk:=f.read(1024*1024):size+=len(chunk);h.update(chunk)
 return h.hexdigest(),size

def file_hash(p):
 assert p.is_file() and not p.is_symlink(),str(p)
 with p.open('rb') as f:return stream_hash(f)[0]
for p,key in [(release/'source.tar','sourceArchiveSha256'),(release/'site/distribution.zip','distributionSha256'),(release/'site/manifest.json','manifestSha256')]:assert file_hash(p)==record[key],str(p)
proc=subprocess.Popen(['git','archive','--format=tar',COMMIT],cwd=ROOT,stdout=subprocess.PIPE)
archive_hash,archive_bytes=stream_hash(proc.stdout);assert proc.wait()==0 and archive_hash==record['sourceArchiveSha256']
entries={}
for item in subprocess.check_output(['git','ls-tree','-r','-z',COMMIT],cwd=ROOT).split(b'\0'):
 if not item:continue
 header,name=item.split(b'\t',1);mode,kind,sha=header.decode().split();assert kind=='blob';entries[name.decode()]=(mode,sha)
seen=set()
with tarfile.open(release/'source.tar') as archive:
 for item in archive:
  if item.isdir():continue
  assert item.isfile() and item.name not in seen and item.name in entries,item.name;seen.add(item.name)
  mode,sha=entries[item.name]
  with archive.extractfile(item) as f:actual,size=stream_hash(f,'sha1',b'blob '+str(item.size).encode()+b'\0')
  assert size==item.size and actual==sha and ('100755' if item.mode&0o111 else '100644')==mode,item.name
assert seen==set(entries)
site=release/'site';manifest=json.loads((site/'manifest.json').read_text());assert manifest['version']==VERSION and manifest['sourceRevision']==COMMIT
files={r['path']:r for r in manifest['files']};assert len(files)==len(manifest['files'])
for name,pin in files.items():
 p=site/name;assert p.resolve().is_relative_to(site) and not p.is_symlink() and p.stat().st_size==pin['bytes'] and file_hash(p)==pin['sha256'],name
assert sum(r['bytes'] for r in files.values())==manifest['totalBytes']
all_site={p.relative_to(site).as_posix() for p in site.rglob('*') if p.is_file()};assert all_site==set(files)|{'manifest.json','.xonix-build.json','distribution.zip','distribution.zip.sha256'},all_site-set(files)
checksum=(site/'distribution.zip.sha256').read_text().strip();assert checksum==record['distributionSha256']+'  distribution.zip'
with zipfile.ZipFile(site/'distribution.zip') as archive:
 members=archive.infolist();names=[m.filename for m in members];assert len(set(names))==len(names) and set(names)==set(files)|{'manifest.json'}
 for member in members:
  assert not member.is_dir() and member.flag_bits&1==0
  expected=files.get(member.filename,{'sha256':record['manifestSha256'],'bytes':(site/'manifest.json').stat().st_size})
  # Reading each member through EOF also verifies its stored CRC.
  with archive.open(member) as f:actual,size=stream_hash(f)
  assert actual==expected['sha256'] and size==member.file_size==expected['bytes'],member.filename
result={'format':'revealline-frozen-integrity.v1','verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':True,'version':VERSION,'sourceRevision':COMMIT,'sourceTree':subprocess.check_output(['git','rev-parse',COMMIT+'^{tree}'],cwd=ROOT,text=True).strip(),'sourceArchiveSha256':record['sourceArchiveSha256'],'distributionSha256':record['distributionSha256'],'manifestSha256':record['manifestSha256'],'sourceArchiveBytes':archive_bytes,'sourceArchiveEqualsFreshGitArchive':True,'sourceGitBodiesAndExecutableModesVerified':len(entries),'manifestFiles':len(files),'manifestBytes':manifest['totalBytes'],'looseFilesVerified':True,'zipMembers':len(names),'zipMemberBodiesVerified':True,'zipCRCsVerified':True}
assert not OUT.exists(),'Do not overwrite an integrity receipt.'
OUT.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
