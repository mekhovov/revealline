import hashlib, json, os, pathlib, stat, tarfile
temporary = pathlib.Path(os.environ['RUNNER_TEMP'])
archive = temporary / 'artifact.tar'
maximum = int(os.environ['MAX_PUBLISHED_BYTES'])
receipt = {
  'format': 'revealline-main-pages-archive-receipt.v1',
  'sourceRevision': os.environ['SOURCE_SHA'],
  'artifactId': os.environ['PAGES_ARTIFACT_ID'],
  'measurement': 'actual uncompressed artifact.tar emitted by the pinned Pages action',
  'maximumArchiveBytes': maximum,
  'archiveAccepted': False,
  'errors': [],
}
try:
  inventory_bytes = (temporary / 'main-pages-inventory.json').read_bytes()
  inventory = json.loads(inventory_bytes)
  staged = json.loads((temporary / 'main-pages-receipt.json').read_bytes())
  inventory_hash = hashlib.sha256(inventory_bytes).hexdigest()
  assert staged['sourceRevision'] == inventory['sourceRevision'] == os.environ['SOURCE_SHA'], 'Source identity mismatch'
  assert staged['capacityAccepted'] is True and staged['completeInventory'] is True, 'Staging was not accepted'
  assert staged['inventorySha256'] == inventory_hash, 'Inventory checksum mismatch'
  assert receipt['artifactId'].isdigit(), 'Missing uploaded artifact identity'
  expected = {row['path']: row for row in inventory['files']}
  assert len(expected) == len(inventory['files']) == staged['files'] > 0, 'Invalid inventory count'
  assert sum(row['bytes'] for row in expected.values()) == staged['bytes'], 'Invalid inventory byte count'
  before = archive.lstat()
  assert stat.S_ISREG(before.st_mode) and before.st_nlink == 1, 'Archive must be a regular, unlinked file'
  receipt.update(archiveBytes=before.st_size, stagedBytes=staged['bytes'], inventorySha256=inventory_hash)
  digest = hashlib.sha256()
  with archive.open('rb') as stream:
    while block := stream.read(1024 * 1024):
      digest.update(block)
  receipt['archiveSha256'] = digest.hexdigest()
  seen = set()
  # Never extract archive-controlled paths or links onto the runner.
  with tarfile.open(archive, mode='r:') as bundle:
    for member in bundle:
      name = member.name
      if name.startswith('./'):
        name = name[2:]
      if member.isdir() and name in ('', '.'):
        continue
      parts = name.split('/')
      assert name and not name.startswith('/') and all(part not in ('', '.', '..') for part in parts), f'Unsafe archive path: {member.name}'
      if member.isdir():
        continue
      assert member.isfile(), f'Unsupported archive member: {name}'
      assert name not in seen, f'Duplicate archive file: {name}'
      assert name in expected, f'Unexpected archive file: {name}'
      row = expected[name]
      assert member.size == row['bytes'], f'Archive size differs: {name}'
      file_hash = hashlib.sha256()
      size = 0
      with bundle.extractfile(member) as stream:
        while block := stream.read(1024 * 1024):
          size += len(block)
          file_hash.update(block)
      assert size == row['bytes'] and file_hash.hexdigest() == row['sha256'], f'Archive content differs: {name}'
      seen.add(name)
  assert seen == set(expected), 'Archive is missing inventoried files'
  after = archive.lstat()
  signature = lambda value: (value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns, value.st_ctime_ns, value.st_nlink)
  assert signature(before) == signature(after), 'Archive changed during verification'
  receipt['files'] = len(seen)
  receipt['overheadBytes'] = before.st_size - staged['bytes']
  assert before.st_size <= maximum, f'Pages archive exceeds {maximum} bytes: {before.st_size}'
  receipt['archiveAccepted'] = True
except Exception as error:
  receipt['errors'].append(str(error))
(temporary / 'main-pages-archive-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
assert receipt['archiveAccepted'], '; '.join(receipt['errors'])
