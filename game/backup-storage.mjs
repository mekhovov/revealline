import { boundedJSON, exactKeys, plainObject, required } from './data-json.mjs';
import { isPreparedBackup, MAX_BACKUP_BYTES } from './backup.mjs';
import { exportPackLibrary } from './packs.mjs';
import { SESSION_STORAGE_BYTES } from './sessions.mjs';

export const BACKUP_JOURNAL_FORMAT = 'xonix-backup-journal.v1';
export const MAX_BACKUP_JOURNAL_BYTES = MAX_BACKUP_BYTES * 2 + 16384;
const inFlight = new WeakMap();
const bytes = (value) => new TextEncoder().encode(value).byteLength;
const keyValid = (value) => typeof value === 'string' && value.length > 0 && value.length <= 300;
const tokenFor = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
function context(adapters) {
  const {
    storage,
    readAsset,
    writeAsset,
    profileKey,
    packsKey,
    sessionKey,
    journalKey,
    commitProfile,
    withLock,
    lockKey = `${profileKey}.backup-lock`,
  } = adapters;
  required(
    storage &&
      ['getItem', 'setItem', 'removeItem'].every((name) => typeof storage[name] === 'function') &&
      typeof readAsset === 'function' &&
      typeof writeAsset === 'function',
    'Backup storage adapters are incomplete.',
  );
  const keys = [profileKey, packsKey, sessionKey, journalKey, lockKey];
  required(
    keys.every(keyValid) && new Set(keys).size === keys.length,
    'Backup keys must be distinct.',
  );
  required(
    withLock === undefined || typeof withLock === 'function',
    'Invalid backup lock adapter.',
  );
  return {
    storage,
    readAsset,
    writeAsset,
    profileKey,
    packsKey,
    sessionKey,
    journalKey,
    lockKey,
    commitProfile,
    withLock,
  };
}
function journalCopy(candidate, ctx) {
  const value = boundedJSON(candidate, {
    maxBytes: MAX_BACKUP_JOURNAL_BYTES,
    maxString: MAX_BACKUP_BYTES,
    maxNodes: 200000,
    maxDepth: 22,
    maxArray: 4096,
  });
  exactKeys(value, ['format', 'token', 'targets', 'previous'], 'backup journal');
  required(
    value.format === BACKUP_JOURNAL_FORMAT && keyValid(value.token),
    'Invalid backup journal.',
  );
  exactKeys(value.targets, ['profileKey', 'packsKey', 'sessionKey', 'lockKey'], 'journal targets');
  for (const key of ['profileKey', 'packsKey', 'sessionKey', 'lockKey'])
    required(value.targets[key] === ctx[key], 'Backup journal belongs to different storage keys.');
  exactKeys(value.previous, ['profile', 'packs', 'session'], 'journal previous values');
  required(
    ['profile', 'session'].every(
      (key) => value.previous[key] === null || typeof value.previous[key] === 'string',
    ) && Object.hasOwn(value.previous, 'packs'),
    'Backup journal previous values are incomplete.',
  );
  return value;
}
async function write(ctx, key, value) {
  const result = await ctx.writeAsset(key, value);
  required(result?.ok !== false, result?.warning || 'Asset storage write failed.');
}
function setRaw(ctx, key, value) {
  if (value === null) ctx.storage.removeItem(key);
  else ctx.storage.setItem(key, value);
}
function releaseLock(ctx, token) {
  if (ctx.storage.getItem(ctx.lockKey) === token) ctx.storage.removeItem(ctx.lockKey);
}
function ownLock(ctx, token) {
  ctx.storage.setItem(ctx.lockKey, token);
  required(ctx.storage.getItem(ctx.lockKey) === token, 'Another tab owns the backup import lock.');
}
async function serialized(ctx, task) {
  let held = inFlight.get(ctx.storage);
  if (!held) inFlight.set(ctx.storage, (held = new Set()));
  required(!held.has(ctx.lockKey), 'Another backup operation is already running in this page.');
  held.add(ctx.lockKey);
  try {
    if (ctx.withLock) return await ctx.withLock(() => task(true));
    if (globalThis.navigator?.locks?.request)
      return await globalThis.navigator.locks.request(ctx.lockKey, () => task(true));
    return await task(false);
  } finally {
    held.delete(ctx.lockKey);
  }
}
async function rollback(ctx, journal) {
  const failures = [];
  // Clearing the journal may have returned an uncertain error after committing.
  // Re-establish the recovery record before undoing any authoritative value.
  try {
    const pending = await ctx.readAsset(ctx.journalKey);
    if (pending === null) await write(ctx, ctx.journalKey, journal);
    else
      required(
        journalCopy(pending, ctx).token === journal.token,
        'Backup journal ownership changed.',
      );
  } catch (error) {
    return [`recovery journal: ${error.message}`];
  }
  try {
    await write(ctx, ctx.packsKey, journal.previous.packs);
  } catch (error) {
    failures.push(`packs: ${error.message}`);
  }
  for (const [name, key] of [
    ['session', ctx.sessionKey],
    ['profile', ctx.profileKey],
  ]) {
    try {
      setRaw(ctx, key, journal.previous[name]);
    } catch (error) {
      failures.push(`${name}: ${error.message}`);
    }
  }
  if (!failures.length) {
    try {
      await write(ctx, ctx.journalKey, null);
    } catch (error) {
      failures.push(`journal: ${error.message}`);
    }
  }
  return failures;
}

/**
 * Coordinate durable writes through a recovery journal, not a cross-store
 * transaction. Host must keep ordinary writers behind the same writeLock.
 */
export async function commitBackup(prepared, adapters) {
  let ctx;
  try {
    required(
      isPreparedBackup(prepared),
      'Prepare and validate the complete backup before storage.',
    );
    ctx = context(adapters);
    required(
      typeof ctx.commitProfile === 'function',
      'A guarded profile commit adapter is required.',
    );
    const session = prepared.session === null ? null : JSON.stringify(prepared.session);
    required(
      session === null || bytes(session) <= SESSION_STORAGE_BYTES,
      'This attempt exceeds the 2 MiB local slot. Keep the full backup and use a portable attempt file to resume it.',
    );
    const packs = exportPackLibrary(prepared.packs);
    return await serialized(ctx, async (exclusive) => {
      required(
        exclusive,
        'Full backup import needs Web Locks or an exclusive host lock. Individual file exports remain available in this browser.',
      );
      if ((await ctx.readAsset(ctx.journalKey)) !== null)
        return {
          ok: false,
          recoveryRequired: true,
          warning: 'An unfinished backup import must be recovered before importing another file.',
        };
      if (ctx.storage.getItem(ctx.lockKey) !== null)
        return {
          ok: false,
          recoveryRequired: true,
          warning: 'A previous backup import owns the write lock. Recover it before retrying.',
        };
      const token = tokenFor();
      ownLock(ctx, token);
      let journal;
      try {
        const previous = {
          profile: ctx.storage.getItem(ctx.profileKey),
          session: ctx.storage.getItem(ctx.sessionKey),
          packs: await ctx.readAsset(ctx.packsKey),
        };
        journal = journalCopy(
          {
            format: BACKUP_JOURNAL_FORMAT,
            token,
            targets: {
              profileKey: ctx.profileKey,
              packsKey: ctx.packsKey,
              sessionKey: ctx.sessionKey,
              lockKey: ctx.lockKey,
            },
            previous,
          },
          ctx,
        );
        await write(ctx, ctx.journalKey, journal);
      } catch (error) {
        // No authoritative value has changed. An uncertain journal write is
        // left for startup recovery; do not clear its ownership prematurely.
        let pending = true;
        try {
          pending = (await ctx.readAsset(ctx.journalKey)) !== null;
        } catch {}
        if (!pending) releaseLock(ctx, token);
        return {
          ok: false,
          recoveryRequired: pending,
          warning: `Backup journal could not be saved; player data is unchanged. ${error.message}`,
        };
      }
      try {
        await write(ctx, ctx.packsKey, packs);
        setRaw(ctx, ctx.sessionKey, session);
        const profile = await ctx.commitProfile(prepared.library, {
          mode: 'replace',
          writeLock: { key: ctx.lockKey, token },
        });
        required(
          plainObject(profile) && profile.ok === true,
          profile?.warning || 'Player profile commit failed.',
        );
        await write(ctx, ctx.journalKey, null);
        let warning = '';
        try {
          releaseLock(ctx, token);
        } catch {
          warning = 'Backup imported, but its write lock needs cleanup on the next reload.';
        }
        return { ok: true, profile, warning, recoveryRequired: false };
      } catch (error) {
        const failures = await rollback(ctx, journal);
        if (!failures.length) {
          try {
            releaseLock(ctx, token);
          } catch (cleanup) {
            failures.push(`write lock: ${cleanup.message}`);
          }
        }
        return {
          ok: false,
          rolledBack: failures.length === 0,
          recoveryRequired: failures.length > 0,
          warning: failures.length
            ? `Backup import failed and recovery is incomplete. Keep the backup, free storage and reload before playing. ${error.message} ${failures.join('; ')}`
            : `Backup import failed; previous player data was restored. ${error.message}`,
        };
      }
    });
  } catch (error) {
    return { ok: false, recoveryRequired: false, warning: error.message };
  }
}

/** Call before any ordinary profile, pack or suspended-slot reads at startup. */
export async function recoverBackupImport(adapters) {
  try {
    const ctx = context(adapters);
    return await serialized(ctx, async (exclusive) => {
      const raw = await ctx.readAsset(ctx.journalKey);
      if (raw === null) {
        const token = ctx.storage.getItem(ctx.lockKey);
        if (token !== null) {
          required(
            exclusive,
            'An orphan backup lock needs exclusive recovery. Close other game tabs and reload in a browser with Web Locks.',
          );
          releaseLock(ctx, token);
          return {
            ok: true,
            recovered: true,
            warning: 'An interrupted backup lock was cleared; player data was unchanged.',
          };
        }
        return { ok: true, recovered: false, warning: '' };
      }
      required(
        exclusive,
        'Recover this backup in a browser with Web Locks or an exclusive host lock.',
      );
      const journal = journalCopy(raw, ctx);
      ownLock(ctx, journal.token);
      const failures = await rollback(ctx, journal);
      if (failures.length)
        return {
          ok: false,
          recovered: false,
          recoveryRequired: true,
          warning: `Backup recovery is incomplete. Keep the backup, free storage and reload before playing. ${failures.join('; ')}`,
        };
      releaseLock(ctx, journal.token);
      return {
        ok: true,
        recovered: true,
        warning: 'An interrupted backup import was rolled back to the previous player data.',
      };
    });
  } catch (error) {
    return {
      ok: false,
      recovered: false,
      recoveryRequired: true,
      warning: `Backup recovery could not finish. Original journal data was kept. ${error.message}`,
    };
  }
}
