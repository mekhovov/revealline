"""Download the pinned CC0 inputs; extract assets only, never execute archive files.
Usage: python3 download.py SOURCE_DIRECTORY ARCHIVE_DIRECTORY
"""
import hashlib, io, json, pathlib, sys, urllib.request, zipfile
root = pathlib.Path(__file__).resolve().parent
sources, archives = (pathlib.Path(value).resolve() for value in sys.argv[1:3])
archives.mkdir(parents=True, exist_ok=True)
for row in json.loads((root / 'source/downloads.json').read_text()):
    archive = archives / (row['id'] + '.zip')
    if not archive.exists():
        request = urllib.request.Request(row['download'], headers={'User-Agent': 'FPV-LINE-asset-preparation/1.0'})
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read(64 * 1024 * 1024 + 1)
        if len(data) > 64 * 1024 * 1024:
            raise ValueError('Archive exceeds preparation download budget')
        if hashlib.sha256(data).hexdigest() != row['sha256']:
            raise ValueError('Source changed: ' + row['id'])
        archive.write_bytes(data)
    data = archive.read_bytes()
    if hashlib.sha256(data).hexdigest() != row['sha256']:
        raise ValueError('Source checksum differs: ' + str(archive))
    destination = sources / row['id']
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(data)) as package:
        if sum(info.file_size for info in package.infolist()) > 256 * 1024 * 1024:
            raise ValueError('Expanded source exceeds preparation budget')
        for info in package.infolist():
            name = pathlib.PurePosixPath(info.filename.replace('\\', '/'))
            if name.is_absolute() or '..' in name.parts:
                raise ValueError('Unsafe archive path')
            if info.is_dir() or name.suffix.lower() not in {'.glb', '.png', '.jpg', '.jpeg', '.txt', '.blend'}:
                continue
            target = destination.joinpath(*name.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            content = package.read(info)
            if target.exists() and target.read_bytes() != content:
                raise ValueError('Refusing to replace changed local source: ' + str(target))
            target.write_bytes(content)
    print(row['id'], row['sha256'])
