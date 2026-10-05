import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { boundedJSON, canonicalJSON, exactKeys, required } from '../../game/data-json.mjs';
import { freezeDesign } from '../../game/content-design/catalogs.mjs';
import {
  CLASSIC_PACKAGE_FORMAT,
  classicSnakePackageEntries,
} from '../../game/snake/classic-community.mjs';
import { inspectCommunityPackage } from '../../game/community/package-family.mjs';
import { createEditionRuntimeCatalog } from '../../game/editions/model.mjs';
import { validateRoomContent } from '../../game/online/room-content.mjs';

export const ROOM_REGISTRY_FORMAT = 'revealline-room-registry.v1';
export const ROOM_REGISTRY_LIMITS = Object.freeze({
  manifestBytes: 128 * 1024,
  packages: 32,
  packageBytes: 4 * 1024 * 1024,
  totalBytes: 32 * 1024 * 1024,
  entries: 512,
});
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const labels = {
  media: {
    en: 'This package owns pictures or story media. Rooms do not yet preserve its verified media.',
    uk: 'Кімнати ще не підтримують перевірені власні зображення або сюжетні медіа цього пакунка.',
  },
  flight: {
    en: 'Flight packages are not supported by Capture or Snake rooms.',
    uk: 'Пакунки польотів не підтримуються кімнатами захоплення або Snake.',
  },
  solo: {
    en: 'This Company edition declares Solo only. It cannot become a Versus or Team room.',
    uk: 'Це видання компанії підтримує лише соло, а не кімнати проти або командні.',
  },
  company: {
    en: 'Company rooms need verified campaigns, branding and media. A catalogue alone cannot authorize play.',
    uk: 'Кімнатам компанії потрібні перевірені кампанії, бренд і медіа. Самого каталогу недостатньо.',
  },
  invalid: {
    en: 'This exact package did not pass native content validation.',
    uk: 'Цей точний пакунок не пройшов перевірку власного формату вмісту.',
  },
  pin: {
    en: 'The local package bytes do not match the operator’s immutable size and SHA-256 pin.',
    uk: 'Байти локального пакунка не відповідають зазначеним оператором розміру та SHA-256.',
  },
  file: {
    en: 'The pinned local file is missing, outside the registry directory, or exceeds its size bound.',
    uk: 'Локальний файл відсутній, поза каталогом реєстру або перевищує обмеження розміру.',
  },
};
function localized(value) {
  exactKeys(value, ['en', 'uk'], 'room package title');
  required(
    ['en', 'uk'].every(
      (locale) =>
        typeof value[locale] === 'string' &&
        value[locale].trim().length > 0 &&
        value[locale].length <= 120,
    ),
    'Room package titles need bounded EN/UK text.',
  );
}
function validatePin(pin) {
  exactKeys(
    pin,
    ['id', 'kind', 'path', 'sha256', 'bytes', 'editionId', 'version', 'title'],
    'operator room package pin',
  );
  required(/^[a-z][a-z0-9-]{0,63}$/.test(pin.id), 'Invalid room package registry ID.');
  required(['community', 'company-catalog'].includes(pin.kind), 'Unsupported room package owner.');
  required(
    typeof pin.path === 'string' &&
      pin.path.length <= 240 &&
      pin.path.split('/').every((part) => /^[a-zA-Z0-9_][a-zA-Z0-9._-]*$/.test(part)),
    'Room package paths must stay inside the operator registry directory.',
  );
  required(/^[a-f0-9]{64}$/.test(pin.sha256), 'Pin the full raw package SHA-256.');
  required(
    Number.isSafeInteger(pin.bytes) &&
      pin.bytes > 0 &&
      pin.bytes <= ROOM_REGISTRY_LIMITS.packageBytes,
    'Room package exceeds the bounded registry size.',
  );
  required(
    pin.kind === 'community'
      ? /^ed_[a-f0-9]{64}$/.test(pin.editionId)
      : /^[a-z][a-z0-9-]{0,63}$/.test(pin.editionId),
    'Pin an exact published Community edition or Company catalogue identity.',
  );
  required(
    typeof pin.version === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,63}$/.test(pin.version),
    'Pin the published content version.',
  );
  localized(pin.title);
  return pin;
}
export function validateRoomRegistryManifest(source) {
  const manifest = boundedJSON(source, {
    maxBytes: ROOM_REGISTRY_LIMITS.manifestBytes,
    maxNodes: 4096,
    maxArray: ROOM_REGISTRY_LIMITS.packages,
    maxDepth: 5,
  });
  exactKeys(manifest, ['format', 'packages'], 'operator room registry');
  required(
    manifest.format === ROOM_REGISTRY_FORMAT &&
      Array.isArray(manifest.packages) &&
      manifest.packages.length <= ROOM_REGISTRY_LIMITS.packages,
    'Invalid operator room registry.',
  );
  manifest.packages.forEach(validatePin);
  required(
    new Set(manifest.packages.map((pin) => pin.id)).size === manifest.packages.length,
    'Room package registry IDs must be distinct.',
  );
  required(
    manifest.packages.reduce((sum, pin) => sum + pin.bytes, 0) <= ROOM_REGISTRY_LIMITS.totalBytes,
    'The room registry exceeds its total package budget.',
  );
  return freezeDesign(manifest);
}
function unavailable(pin, code, reason, details = {}) {
  return { id: `import:${pin.id}`, title: pin.title, code, reason, ...details };
}
function entryFor(pin, family, mode, level, title) {
  const suffix = hash(canonicalJSON({ sha256: pin.sha256, editionId: pin.editionId, mode, level }));
  const id = `import:${pin.id}:${mode}:${suffix.slice(0, 32)}`;
  const content = validateRoomContent({
    format: 'revealline-room-content.v1',
    catalogueId: id,
    source: {
      kind: 'community',
      id: pin.editionId,
      sha256: pin.sha256,
      version: pin.version,
      title: pin.title,
    },
    mission: { id: level.id, revision: String(level.revision), title },
    presentation: 'shared-runtime',
  });
  return { id, family, mode, title, level, content };
}
/** Native import is mandatory even after hash verification. Package data never
 * supplies an import path, validator, executable policy or an asset fetch URL. */
export async function inspectPinnedRoomPackage(pin, bytes) {
  validatePin(pin);
  required(bytes instanceof Uint8Array, 'Read owned local package bytes.');
  if (bytes.byteLength !== pin.bytes || hash(bytes) !== pin.sha256)
    return { entries: [], unavailable: unavailable(pin, 'PIN_MISMATCH', labels.pin) };
  try {
    if (pin.kind === 'company-catalog') {
      const catalog = createEditionRuntimeCatalog(
        new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      );
      const edition = catalog.editions.find((row) => row.id === pin.editionId);
      required(edition, 'The pinned Company edition is missing from this catalogue.');
      const soloOnly = edition.modes.every((mode) => mode === 'solo');
      return {
        entries: [],
        unavailable: unavailable(
          pin,
          soloOnly ? 'COMPANY_SOLO_ONLY' : 'COMPANY_OWNERSHIP_UNSUPPORTED',
          soloOnly ? labels.solo : labels.company,
          { declaredModes: [...edition.modes] },
        ),
      };
    }
    const prefix = new TextDecoder().decode(bytes.subarray(0, 8));
    if (['RLCNB1\r\n', 'RLTMC1\r\n'].includes(prefix))
      return { entries: [], unavailable: unavailable(pin, 'MEDIA_UNSUPPORTED', labels.media) };
    if (prefix === 'RLFPV2\r\n')
      return { entries: [], unavailable: unavailable(pin, 'FLIGHT_UNSUPPORTED', labels.flight) };
    // Detect only data families here. The shared native importer validates the
    // complete payload and evidence, including source-backed Team provenance.
    const source = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    required(
      [
        CLASSIC_PACKAGE_FORMAT,
        'revealline-creator-team-portable.v1',
        'revealline-creator-team-portable.v2',
      ].includes(source?.format),
      'Unsupported room content family.',
    );
    const admitted = await inspectCommunityPackage(new Blob([bytes]));
    const entries =
      admitted.family === 'classic'
        ? classicSnakePackageEntries(admitted.pack).flatMap((entry) =>
            ['versus', 'team'].map((mode) =>
              entryFor(pin, 'snake', mode, entry.level, entry.title),
            ),
          )
        : admitted.prepared.pack.levels.map((level) =>
            entryFor(pin, 'capture', 'team', level, {
              en: level.name ?? level.id,
              uk: level.name ?? level.id,
            }),
          );
    return { entries, family: admitted.family, runtimeIdentity: admitted.runtimeIdentity };
  } catch {
    // Never put filesystem paths, raw payloads or decoder errors in public DTOs.
    return {
      entries: [],
      unavailable: unavailable(pin, 'NATIVE_VALIDATION_FAILED', labels.invalid),
    };
  }
}

async function readBoundedFile(path, limit) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    required(
      stat.isFile() && stat.size > 0 && stat.size <= limit,
      'Invalid bounded registry file.',
    );
    const buffer = Buffer.alloc(limit + 1);
    let length = 0;
    while (length <= limit) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    required(length > 0 && length <= limit, 'Registry file grew beyond its size limit.');
    return buffer.subarray(0, length);
  } finally {
    await handle.close();
  }
}
/** Opt-in, server-local configuration. No client body, URL, local install receipt
 * or self-attested replay can extend this registry. Restart loads a new snapshot. */
export async function loadRoomContentRegistry(manifestPath) {
  if (!manifestPath)
    return freezeDesign({
      entries: [],
      unavailable: [],
      report: {
        enabled: false,
        packages: 0,
        admittedPackages: 0,
        unavailablePackages: 0,
        entries: 0,
      },
    });
  const manifestFile = await realpath(resolve(manifestPath));
  const base = dirname(manifestFile);
  const bytes = await readBoundedFile(manifestFile, ROOM_REGISTRY_LIMITS.manifestBytes);
  const manifest = validateRoomRegistryManifest(
    new TextDecoder('utf-8', { fatal: true }).decode(bytes),
  );
  const entries = [],
    unavailablePackages = [],
    reports = [];
  for (const pin of manifest.packages) {
    let admitted;
    try {
      const path = await realpath(resolve(base, pin.path));
      const owned = relative(base, path);
      required(
        owned && !owned.startsWith('..') && !isAbsolute(owned),
        'Package leaves registry directory.',
      );
      const packageBytes = await readBoundedFile(path, pin.bytes);
      admitted = await inspectPinnedRoomPackage(pin, packageBytes);
    } catch {
      admitted = {
        entries: [],
        unavailable: unavailable(pin, 'LOCAL_FILE_UNAVAILABLE', labels.file),
      };
    }
    if (admitted.unavailable) unavailablePackages.push(admitted.unavailable);
    entries.push(...admitted.entries);
    required(entries.length <= ROOM_REGISTRY_LIMITS.entries, 'Too many admitted room recipes.');
    reports.push({
      id: pin.id,
      kind: pin.kind,
      sha256: pin.sha256,
      bytes: pin.bytes,
      status: admitted.unavailable ? 'unavailable' : 'admitted',
      entries: admitted.entries.length,
      ...(admitted.unavailable ? { code: admitted.unavailable.code } : { family: admitted.family }),
    });
  }
  return freezeDesign({
    entries,
    unavailable: unavailablePackages,
    report: {
      enabled: true,
      manifestSha256: hash(bytes),
      packages: manifest.packages.length,
      admittedPackages: manifest.packages.length - unavailablePackages.length,
      unavailablePackages: unavailablePackages.length,
      entries: entries.length,
      pins: reports,
    },
  });
}
