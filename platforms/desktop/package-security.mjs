import path from 'node:path';
import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';

/** Container validation does not claim that macOS has rendered the icon. */
export async function readMacIcon(directory) {
  const source = 'assets/revealline.icns';
  const folder = path.join(directory, 'assets');
  const filename = path.join(directory, source);
  const fail = () => {
    throw new Error(
      'Desktop branding requires a regular, valid assets/revealline.icns (at most 8 MiB).',
    );
  };
  let folderInfo, fileInfo;
  try {
    folderInfo = await fs.lstat(folder);
    fileInfo = await fs.lstat(filename);
  } catch {
    fail();
  }
  if (
    !folderInfo.isDirectory() ||
    folderInfo.isSymbolicLink() ||
    !fileInfo.isFile() ||
    fileInfo.isSymbolicLink()
  )
    fail();
  const file = await fs.open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  let bytes;
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size < 17 || info.size > 8 * 1024 * 1024) fail();
    bytes = Buffer.alloc(info.size);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await file.read(bytes, offset, bytes.length - offset, offset);
      if (!bytesRead) fail();
      offset += bytesRead;
    }
    if ((await file.read(Buffer.alloc(1), 0, 1, bytes.length)).bytesRead) fail();
  } finally {
    await file.close();
  }
  if (bytes.toString('ascii', 0, 4) !== 'icns' || bytes.readUInt32BE(4) !== bytes.length) fail();
  let offset = 8,
    images = 0;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) fail();
    const type = bytes.toString('ascii', offset, offset + 4),
      size = bytes.readUInt32BE(offset + 4);
    if (size < 9 || offset + size > bytes.length) fail();
    if (/^ic(?:p[4-6]|0[7-9]|1[0-4])$/.test(type)) images++;
    offset += size;
  }
  if (!images) fail();
  return { source, bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
}

// All current v1 fuses are explicit; a new Electron fuse must be reviewed at upgrade.
export const PACKAGED_FUSES = Object.freeze({
  RunAsNode: false,
  EnableCookieEncryption: false,
  EnableNodeOptionsEnvironmentVariable: false,
  EnableNodeCliInspectArguments: false,
  EnableEmbeddedAsarIntegrityValidation: false,
  OnlyLoadAppFromAsar: false,
  LoadBrowserProcessSpecificV8Snapshot: true,
  GrantFileProtocolExtraPrivileges: false,
  WasmTrapHandlers: true,
});

export function packagedExecutable(directory, platform = process.platform) {
  if (platform === 'darwin') return path.join(directory, 'Reveal Line.app');
  if (platform === 'win32') return path.join(directory, 'Reveal Line.exe');
  if (platform === 'linux') return path.join(directory, 'Reveal Line');
  throw new Error(`Unsupported desktop packaging platform: ${platform}`);
}

/** Flip the packaged copy only, then independently read every configured fuse. */
export async function hardenPackage(directory, { api, platform = process.platform } = {}) {
  const fuses = api || (await import('@electron/fuses'));
  const target = packagedExecutable(directory, platform);
  const config = {
    version: fuses.FuseVersion.V1,
    strictlyRequireAllFuses: true,
    resetAdHocDarwinSignature: platform === 'darwin',
  };
  for (const [name, value] of Object.entries(PACKAGED_FUSES)) {
    if (!Number.isInteger(fuses.FuseV1Options[name]))
      throw new Error(`The installed fuse API does not support ${name}.`);
    config[fuses.FuseV1Options[name]] = value;
  }
  await fuses.flipFuses(target, config);
  const actual = await fuses.getCurrentFuseWire(target);
  if (actual.version !== fuses.FuseVersion.V1)
    throw new Error('Packaged Electron fuse version did not verify.');
  for (const [name, value] of Object.entries(PACKAGED_FUSES)) {
    const expected = value ? fuses.FuseState.ENABLE : fuses.FuseState.DISABLE;
    if (actual[fuses.FuseV1Options[name]] !== expected)
      throw new Error(`Packaged Electron fuse did not verify: ${name}.`);
  }
  return { ...PACKAGED_FUSES };
}
