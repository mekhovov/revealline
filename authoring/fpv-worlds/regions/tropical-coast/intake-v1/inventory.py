"""Read-only inventory of a completed, explicitly pinned source archive."""
import sys, pathlib, hashlib, zipfile, stat, json, collections
archive=pathlib.Path(sys.argv[1]); expected=sys.argv[2]
h=hashlib.sha256()
with archive.open('rb') as f:
 while block:=f.read(1024*1024): h.update(block)
assert h.hexdigest()==expected, 'Source archive hash mismatch'
seen=set(); records=[]; groups=collections.defaultdict(lambda:{'files':0,'bytes':0})
with zipfile.ZipFile(archive) as z:
 for item in z.infolist():
  name=pathlib.PurePosixPath(item.filename)
  assert not name.is_absolute() and '..' not in name.parts and '\\' not in item.filename, 'Unsafe archive path'
  assert not stat.S_ISLNK(item.external_attr>>16), 'Archive symlink rejected'
  key=str(name).casefold();assert key not in seen, 'Duplicate or case-colliding archive path';seen.add(key)
  if item.is_dir(): continue
  ext=name.suffix.lower();groups[ext]['files']+=1;groups[ext]['bytes']+=item.file_size
  records.append({'path':str(name),'bytes':item.file_size,'compressedBytes':item.compress_size,'crc32':f'{item.CRC:08x}'})
print(json.dumps({'archive':archive.name,'bytes':archive.stat().st_size,'sha256':expected,'files':len(records),'uncompressedBytes':sum(x['bytes'] for x in records),'groups':dict(groups),'records':records},indent=2))
