import hashlib, json, os, pathlib, stat
root = pathlib.Path(os.environ['RUNNER_TEMP']) / 'main-pages'
rows, errors = [], []
if root.is_symlink() or not root.is_dir():
  errors.append('Staging root must be an ordinary directory.')
else:
  def scan_error(error):
    errors.append('Could not enumerate staged directory: ' +
                  pathlib.Path(error.filename).relative_to(root).as_posix())
  entries = []
  for directory, directories, names in os.walk(root, onerror=scan_error, followlinks=False):
    entries.extend(pathlib.Path(directory) / name for name in sorted(directories + names))
  for entry in entries:
    relative = entry.relative_to(root).as_posix()
    try:
      before = entry.lstat()
      if stat.S_ISDIR(before.st_mode):
        continue
      if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1:
        errors.append(f'Unsupported file type or link: {relative}')
        continue
      # These names are excluded by the pinned Pages upload action.
      if any(part in ('.git', '.github') for part in entry.relative_to(root).parts):
        errors.append(f'File would be excluded from the Pages archive: {relative}')
        continue
      digest, size = hashlib.sha256(), 0
      with entry.open('rb') as body:
        for chunk in iter(lambda: body.read(1024 * 1024), b''):
          digest.update(chunk)
          size += len(chunk)
      after = entry.lstat()
      identity = lambda item: (item.st_dev, item.st_ino, item.st_size,
                               item.st_mtime_ns, item.st_ctime_ns, item.st_nlink)
      if identity(before) != identity(after) or size != before.st_size:
        errors.append(f'File changed during inventory: {relative}')
        continue
      rows.append({'path': relative, 'bytes': size, 'sha256': digest.hexdigest()})
    except OSError:
      errors.append(f'Could not inspect staged file: {relative}')
files = len(rows)
rows.sort(key=lambda row: row['path'])
total = sum(row['bytes'] for row in rows)
if not files:
  errors.append('Staging inventory has no ordinary files.')
maximum = int(os.environ['MAX_PUBLISHED_BYTES'])
inventory = {
  'format': 'revealline-main-pages-inventory.v1',
  'sourceRevision': os.environ['SOURCE_SHA'],
  'completeInventory': not errors,
  'files': rows,
}
inventory_bytes = (json.dumps(inventory, separators=(',', ':')) + '\n').encode('utf-8')
pathlib.Path(os.environ['RUNNER_TEMP'], 'main-pages-inventory.json').write_bytes(inventory_bytes)
receipt = {
  'format': 'revealline-main-pages-receipt.v1',
  'sourceRevision': os.environ['SOURCE_SHA'],
  'files': files,
  'bytes': total,
  'maximumBytes': maximum,
  'measurement': 'raw-final-staged-file-bytes; not tar archive size',
  'completeInventory': not errors,
  'withinCapacity': total <= maximum,
  'capacityAccepted': not errors and total <= maximum,
  'inventorySha256': hashlib.sha256(inventory_bytes).hexdigest(),
  'largestFiles': sorted(rows, key=lambda row: (-row['bytes'], row['path']))[:20],
  'errors': errors,
}
pathlib.Path(os.environ['RUNNER_TEMP'], 'main-pages-receipt.json').write_text(
  json.dumps(receipt, indent=2) + '\n'
)
with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
  output.write(f'files={files}\nbytes={total}\n')
assert not errors, 'Invalid Pages inventory: ' + '; '.join(errors)
assert total <= maximum, f'Pages snapshot exceeds {maximum} bytes: {total}'
