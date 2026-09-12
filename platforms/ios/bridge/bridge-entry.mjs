// This is bundled locally. The shared browser game imports only the resulting
// /native/bridge.mjs on the packaged iOS origin; no bare imports reach its files.
export const MAX_EXPORT_BYTES = 84 * 1024 * 1024 + 32768;
const CACHE_FOLDER = 'revealline-json-exports-v1';
const MAX_STALE_DELETIONS = 32;
const STALE_AGE_MS = 24 * 60 * 60 * 1000;
const safeName = (name) =>
  typeof name === 'string' &&
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.json$/.test(name) &&
  !name.includes('..');

async function loadPlugins() {
  const [core, files, sharing, app] = await Promise.all([
    import('@capacitor/core'),
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
    import('@capacitor/app'),
  ]);
  if (!core.Capacitor.isNativePlatform() || core.Capacitor.getPlatform() !== 'ios')
    throw new Error('The native file bridge is available only inside the iOS app.');
  return { ...files, ...sharing, ...app };
}
function validateExport({ text, name } = {}) {
  if (!safeName(name)) throw new TypeError('Export needs a safe filename ending in .json.');
  if (typeof text !== 'string' || text.length > MAX_EXPORT_BYTES)
    throw new TypeError('Native JSON export exceeds its 84 MiB + 32 KiB limit.');
  if (new TextEncoder().encode(text).byteLength > MAX_EXPORT_BYTES)
    throw new TypeError('Native JSON export exceeds its UTF-8 byte limit.');
  try {
    JSON.parse(text);
  } catch {
    throw new TypeError('Export text must contain valid JSON.');
  }
  return { text, name };
}
async function pruneStale(Filesystem, Directory, now) {
  let files;
  try {
    ({ files } = await Filesystem.readdir({ path: CACHE_FOLDER, directory: Directory.Cache }));
  } catch {
    return;
  }
  if (!Array.isArray(files)) return;
  const stale = files
    .filter((file) => {
      const match = /^export-(\d{13})-[a-zA-Z0-9-]+\.json$/.exec(file.name ?? '');
      return file.type === 'file' && match && Number(match[1]) <= now - STALE_AGE_MS;
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, MAX_STALE_DELETIONS);
  for (const file of stale) {
    try {
      await Filesystem.deleteFile({
        path: `${CACHE_FOLDER}/${file.name}`,
        directory: Directory.Cache,
      });
    } catch {
      /* Keep failed deletions for a later bounded cleanup attempt. */
    }
  }
}

/** Injectable operations keep cancellation, cleanup and lifecycle testable without a device. */
export function createBridge({
  plugins = loadPlugins,
  now = Date.now,
  id = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
} = {}) {
  let sharing = false;
  return {
    async exportJSON(candidate) {
      const { text, name } = validateExport(candidate);
      if (sharing)
        throw new Error('Finish or cancel the current share sheet before exporting again.');
      sharing = true;
      let tempPath,
        runtime,
        cleanupFailed = false;
      let outcome;
      try {
        runtime = await plugins();
        const { Filesystem, Directory, Encoding, Share } = runtime;
        if (!(await Share.canShare()).value)
          throw new Error('Native sharing is unavailable on this device.');
        const timestamp = now(),
          unique = id();
        if (
          !Number.isSafeInteger(timestamp) ||
          timestamp < 1e12 ||
          timestamp >= 1e13 ||
          !/^[a-zA-Z0-9-]{1,80}$/.test(unique)
        )
          throw new Error('Could not create a unique temporary export name.');
        await pruneStale(Filesystem, Directory, timestamp);
        tempPath = `${CACHE_FOLDER}/export-${timestamp}-${unique}.json`;
        await Filesystem.writeFile({
          path: tempPath,
          directory: Directory.Cache,
          data: text,
          encoding: Encoding.UTF8,
          recursive: true,
        });
        const { uri } = await Filesystem.getUri({ path: tempPath, directory: Directory.Cache });
        if (typeof uri !== 'string' || !uri.startsWith('file://'))
          throw new Error('Native export did not return a local file URL.');
        const result = await Share.share({ title: name, files: [uri] });
        outcome =
          typeof result?.activityType === 'string' && result.activityType.trim()
            ? {
                status: 'shared',
                message: 'Shared with the selected app. Check the destination for your file.',
              }
            : {
                status: 'cancelled',
                message: 'Share sheet closed without a confirmed destination.',
              };
      } catch (error) {
        // Exact cancellation text from the pinned iOS Share 8.0.1 implementation.
        if (error?.message === 'Share canceled')
          outcome = {
            status: 'cancelled',
            message: 'Sharing cancelled. No destination was confirmed.',
          };
        else throw error;
      } finally {
        if (tempPath && runtime) {
          try {
            await runtime.Filesystem.deleteFile({
              path: tempPath,
              directory: runtime.Directory.Cache,
            });
          } catch {
            cleanupFailed = true;
          }
        }
        sharing = false;
      }
      if (cleanupFailed)
        outcome.message +=
          ' A temporary cache copy remains and will be retried for cleanup after 24 hours.';
      return outcome;
    },
    async onInactive(callback) {
      if (typeof callback !== 'function')
        throw new TypeError('An inactivity callback is required.');
      const { App } = await plugins();
      let removed = false;
      const handle = await App.addListener('appStateChange', ({ isActive }) => {
        if (!removed && isActive === false) callback();
      });
      return async () => {
        if (removed) return;
        removed = true;
        await handle.remove();
      };
    },
  };
}
const bridge = createBridge();
export const exportJSON = (value) => bridge.exportJSON(value);
export const onInactive = (callback) => bridge.onInactive(callback);
