import {
  boundedJSON,
  canonicalJSON,
  dataIdentity,
  exactKeys,
  required,
} from "../data-json.mjs";
import { COOP_PACK_MAX_BYTES } from "../coop/recipes.mjs";
import { creatorAbort, creatorSHA256 } from "./bytes.mjs";
import {
  createCreatorTeamAttempt,
  CREATOR_TEAM_PORTABLE_FORMAT,
  exportCreatorTeamCampaign,
  importCreatorTeamCampaign,
  validateCreatorTeamCampaign,
} from "./team.mjs";

export const CREATOR_TEAM_DATABASE = "revealline-creator-team-v1";
export const CREATOR_TEAM_EDITION_FORMAT =
  "revealline-installed-team-edition.v1";
export const CREATOR_TEAM_PROGRESS_FORMAT =
  "revealline-installed-team-progress.v1";
const DATABASE_VERSION = 1;
const STORES = Object.freeze(["editions", "progress", "metadata"]);
const STATE_KEY = "state";
const STATE_FORMAT = "revealline-installed-team-state.v1";
const MAX_EDITIONS = 128;
const difficulties = new Set(["gentle", "standard", "expert"]);
const presets = new Set(["full", "joint"]);
const editionPattern = /^[a-f0-9]{64}$/;
const text = (value, maximum = 160) =>
  typeof value === "string" && value.length > 0 && value.length <= maximum;

const cancelled = () =>
  new DOMException("Team library operation cancelled.", "AbortError");
const requestResult = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Team library request failed."));
  });

function validateState(source) {
  if (source === undefined) return { format: STATE_FORMAT, generation: 0 };
  const state = boundedJSON(source, {
    maxBytes: 1024,
    maxNodes: 8,
    maxDepth: 2,
  });
  exactKeys(state, ["format", "generation"], "installed Team state");
  required(
    state.format === STATE_FORMAT &&
      Number.isSafeInteger(state.generation) &&
      state.generation >= 0,
    "Installed Team state is damaged.",
  );
  return state;
}

function emptyProgress(editionId) {
  return {
    format: CREATOR_TEAM_PROGRESS_FORMAT,
    editionId,
    generation: 0,
    clears: {},
  };
}

export function validateInstalledTeamProgress(source, editionId) {
  if (source === undefined) return emptyProgress(editionId);
  const progress = boundedJSON(source, {
    maxBytes: 256 * 1024,
    maxNodes: 4096,
    maxDepth: 6,
    maxArray: 32,
    maxString: 160,
  });
  exactKeys(
    progress,
    ["format", "editionId", "generation", "clears"],
    "installed Team progress",
  );
  required(
    progress.format === CREATOR_TEAM_PROGRESS_FORMAT &&
      progress.editionId === editionId &&
      Number.isSafeInteger(progress.generation) &&
      progress.generation >= 0 &&
      progress.clears &&
      typeof progress.clears === "object" &&
      !Array.isArray(progress.clears),
    "Installed Team progress is damaged.",
  );
  for (const [levelId, receipt] of Object.entries(progress.clears)) {
    required(
      text(levelId, 80),
      "Installed Team progress contains an invalid level identity.",
    );
    exactKeys(
      receipt,
      ["runId", "gameplayId", "difficulty", "presetId"],
      "installed Team completion",
    );
    required(
      text(receipt.runId, 160) &&
        text(receipt.gameplayId, 160) &&
        difficulties.has(receipt.difficulty) &&
        presets.has(receipt.presetId),
      "Installed Team completion receipt is damaged.",
    );
  }
  return progress;
}

async function inspectEdition(source, expectedId) {
  const row = boundedJSON(source, {
    maxBytes: COOP_PACK_MAX_BYTES * 2,
    maxNodes: 60000,
    maxDepth: 24,
    maxArray: 2048,
    maxString: COOP_PACK_MAX_BYTES,
  });
  exactKeys(
    row,
    ["format", "editionId", "installedAt", "bytes", "portable"],
    "installed Team edition",
  );
  required(
    row.format === CREATOR_TEAM_EDITION_FORMAT &&
      editionPattern.test(row.editionId) &&
      row.editionId === expectedId &&
      Number.isSafeInteger(row.installedAt) &&
      row.installedAt >= 0 &&
      Number.isSafeInteger(row.bytes) &&
      row.bytes > 0 &&
      row.bytes <= COOP_PACK_MAX_BYTES &&
      typeof row.portable === "string",
    "Installed Team edition is damaged.",
  );
  const bytes = new TextEncoder().encode(row.portable);
  required(
    bytes.byteLength === row.bytes,
    "Installed Team edition byte count differs.",
  );
  required(
    (await creatorSHA256(bytes)) === row.editionId,
    "Installed Team edition failed its integrity check.",
  );
  const document = boundedJSON(row.portable, {
    maxBytes: COOP_PACK_MAX_BYTES,
    maxNodes: 50000,
    maxDepth: 20,
    maxArray: 1024,
  });
  exactKeys(
    document,
    ["format", "pack", "provenance", "evidence"],
    "portable Team campaign",
  );
  required(
    document.format === CREATOR_TEAM_PORTABLE_FORMAT,
    "Unsupported installed Team format.",
  );
  const validated = validateCreatorTeamCampaign(
    document.pack,
    document.provenance,
  );
  return Object.freeze({
    editionId: row.editionId,
    installedAt: row.installedAt,
    bytes: row.bytes,
    portable: row.portable,
    pack: validated.pack,
    provenance: validated.provenance,
  });
}

/** Exact portable bytes and completion receipts share one IndexedDB authority.
 * Installation and progress each commit in one transaction. Launch still runs
 * the full portable importer and replay verifier before the pack reaches play. */
export function createInstalledTeamCampaignStore({
  indexedDB = globalThis.indexedDB,
  now = Date.now,
} = {}) {
  let opening = null,
    closed = false;
  function open(signal) {
    creatorAbort(signal);
    if (closed)
      return Promise.reject(new Error("Installed Team library is closed."));
    if (!indexedDB)
      return Promise.reject(
        new Error("This browser cannot store Team campaigns."),
      );
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(CREATOR_TEAM_DATABASE, DATABASE_VERSION);
      let failed = false;
      const fail = (error) => {
        failed = true;
        opening = null;
        reject(error || new Error("Installed Team library could not open."));
      };
      request.onupgradeneeded = () => {
        try {
          for (const store of STORES)
            if (!request.result.objectStoreNames.contains(store))
              request.result.createObjectStore(store);
        } catch (error) {
          request.transaction?.abort();
          fail(error);
        }
      };
      request.onerror = () => fail(request.error);
      request.onblocked = () =>
        fail(new Error("Close older game tabs to update Team storage."));
      request.onsuccess = () => {
        const db = request.result;
        if (failed || closed || signal?.aborted) {
          db.close();
          fail(
            signal?.aborted
              ? cancelled()
              : new Error("Installed Team library is closed."),
          );
          return;
        }
        db.onversionchange = () => {
          db.close();
          opening = null;
        };
        resolve(db);
      };
    });
    return opening;
  }
  async function transaction(names, mode, operation, signal) {
    creatorAbort(signal);
    const db = await open(signal);
    creatorAbort(signal);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(names, mode);
      let value,
        failure,
        operationDone = false,
        transactionDone = false;
      const finish = () => {
        if (operationDone && transactionDone) resolve(value);
      };
      const abort = () => {
        failure = cancelled();
        try {
          tx.abort();
        } catch {}
      };
      signal?.addEventListener("abort", abort, { once: true });
      let result;
      try {
        // IndexedDB transactions may become inactive as soon as the current
        // task yields. Let the operation enqueue its first requests now.
        result = operation(tx);
      } catch (error) {
        failure = error;
        try {
          tx.abort();
        } catch {}
        return;
      }
      Promise.resolve(result)
        .then((result) => {
          value = result;
          operationDone = true;
          finish();
        })
        .catch((error) => {
          failure = error;
          operationDone = true;
          if (transactionDone) {
            reject(error);
            return;
          }
          try {
            tx.abort();
          } catch {}
        });
      tx.oncomplete = () => {
        signal?.removeEventListener("abort", abort);
        transactionDone = true;
        finish();
      };
      tx.onabort = tx.onerror = () => {
        signal?.removeEventListener("abort", abort);
        reject(
          failure ||
            tx.error ||
            new Error("Installed Team transaction failed."),
        );
      };
    });
  }
  async function install(prepared, { signal } = {}) {
    creatorAbort(signal);
    const portable = exportCreatorTeamCampaign(prepared);
    const bytes = new Uint8Array(await portable.arrayBuffer());
    creatorAbort(signal);
    const editionId = await creatorSHA256(bytes);
    const portableText = new TextDecoder("utf-8", { fatal: true }).decode(
      bytes,
    );
    const installedAt = now();
    required(
      Number.isSafeInteger(installedAt) && installedAt >= 0,
      "Installed Team clock is invalid.",
    );
    const row = {
      format: CREATOR_TEAM_EDITION_FORMAT,
      editionId,
      installedAt,
      bytes: bytes.byteLength,
      portable: portableText,
    };
    const db = await open(signal);
    creatorAbort(signal);
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES, "readwrite"),
        editions = tx.objectStore("editions"),
        metadata = tx.objectStore("metadata"),
        existingRequest = editions.get(editionId),
        keysRequest = editions.getAllKeys(),
        stateRequest = metadata.get(STATE_KEY);
      let failure,
        ready = 0,
        outcome;
      const abort = () => {
        failure = cancelled();
        try {
          tx.abort();
        } catch {}
      };
      const stage = () => {
        if (++ready !== 3) return;
        try {
          const existing = existingRequest.result;
          if (existing !== undefined) {
            outcome = { existing };
            return;
          }
          const keys = keysRequest.result;
          required(
            keys.length < MAX_EDITIONS,
            "Remove an installed Team campaign before adding another.",
          );
          const state = validateState(stateRequest.result);
          state.generation++;
          editions.put(row, editionId);
          metadata.put(state, STATE_KEY);
          outcome = { existing: null };
        } catch (error) {
          failure = error;
          try {
            tx.abort();
          } catch {}
        }
      };
      signal?.addEventListener("abort", abort, { once: true });
      existingRequest.onsuccess = stage;
      keysRequest.onsuccess = stage;
      stateRequest.onsuccess = stage;
      tx.oncomplete = () => {
        signal?.removeEventListener("abort", abort);
        resolve(outcome);
      };
      tx.onabort = tx.onerror = () => {
        signal?.removeEventListener("abort", abort);
        reject(failure || tx.error || new Error("Team installation failed."));
      };
    });
    creatorAbort(signal);
    if (result.existing) {
      const inspected = await inspectEdition(result.existing, editionId);
      required(
        inspected.portable === portableText,
        "Installed Team edition identity is already bound to different bytes.",
      );
      return Object.freeze({ editionId, alreadyInstalled: true });
    }
    return Object.freeze({ editionId, alreadyInstalled: false });
  }
  async function inventory({ signal } = {}) {
    const snapshot = await transaction(
      STORES,
      "readonly",
      async (tx) => {
        const editions = tx.objectStore("editions"),
          progress = tx.objectStore("progress"),
          metadata = tx.objectStore("metadata"),
          [keys, rows, progressRows, state] = await Promise.all([
            requestResult(editions.getAllKeys()),
            requestResult(editions.getAll()),
            requestResult(progress.getAll()),
            requestResult(metadata.get(STATE_KEY)),
          ]);
        return { keys, rows, progressRows, state };
      },
      signal,
    );
    creatorAbort(signal);
    required(
      snapshot.keys.length === snapshot.rows.length &&
        snapshot.rows.length <= MAX_EDITIONS,
      "Installed Team inventory is damaged.",
    );
    const byEdition = new Map(
      snapshot.progressRows.map((row) => {
        const editionId = row?.editionId;
        required(
          editionPattern.test(editionId),
          "Installed Team progress has no edition identity.",
        );
        return [editionId, validateInstalledTeamProgress(row, editionId)];
      }),
    );
    const editions = [];
    for (let index = 0; index < snapshot.rows.length; index++) {
      const edition = await inspectEdition(
        snapshot.rows[index],
        snapshot.keys[index],
      );
      creatorAbort(signal);
      editions.push(
        Object.freeze({
          ...edition,
          progress: Object.freeze(
            structuredClone(
              byEdition.get(edition.editionId) ??
                emptyProgress(edition.editionId),
            ),
          ),
        }),
      );
    }
    editions.sort(
      (a, b) =>
        b.installedAt - a.installedAt || a.editionId.localeCompare(b.editionId),
    );
    return Object.freeze({
      generation: validateState(snapshot.state).generation,
      editions: Object.freeze(editions),
    });
  }
  async function load(editionId, { signal } = {}) {
    required(
      editionPattern.test(editionId),
      "Choose an installed Team edition.",
    );
    const source = await transaction(
      ["editions"],
      "readonly",
      (tx) => requestResult(tx.objectStore("editions").get(editionId)),
      signal,
    );
    required(source !== undefined, "This exact Team edition is not installed.");
    const inspected = await inspectEdition(source, editionId);
    creatorAbort(signal);
    const prepared = await importCreatorTeamCampaign(
      new Blob([inspected.portable], {
        type: "application/vnd.revealline.team+json",
      }),
      { signal },
    );
    required(
      canonicalJSON(prepared.pack) === canonicalJSON(inspected.pack),
      "Installed Team pack changed while it was being prepared.",
    );
    return Object.freeze({ editionId, prepared });
  }
  async function recordCompletion(
    { editionId, levelId, runId, gameplayId, difficulty, presetId },
    { signal } = {},
  ) {
    required(
      editionPattern.test(editionId) &&
        text(levelId, 80) &&
        text(runId, 160) &&
        text(gameplayId, 160) &&
        difficulties.has(difficulty) &&
        presets.has(presetId),
      "Team completion needs an exact installed attempt identity.",
    );
    const db = await open(signal);
    creatorAbort(signal);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["editions", "progress"], "readwrite"),
        editions = tx.objectStore("editions"),
        progressStore = tx.objectStore("progress"),
        editionRequest = editions.get(editionId),
        progressRequest = progressStore.get(editionId);
      let failure,
        ready = 0,
        result;
      const abort = () => {
        failure = cancelled();
        try {
          tx.abort();
        } catch {}
      };
      const stage = () => {
        if (++ready !== 2) return;
        try {
          required(
            editionRequest.result !== undefined,
            "This exact Team edition is no longer installed.",
          );
          const document = boundedJSON(editionRequest.result.portable, {
            maxBytes: COOP_PACK_MAX_BYTES,
            maxNodes: 50000,
            maxDepth: 20,
            maxArray: 1024,
          });
          const validated = validateCreatorTeamCampaign(
            document.pack,
            document.provenance,
          );
          required(
            validated.pack.levels.some((level) => level.id === levelId),
            "This level does not belong to the installed Team edition.",
          );
          const attempt = createCreatorTeamAttempt(
            validated.pack,
            levelId,
            difficulty,
            presetId,
          );
          required(
            gameplayId ===
              dataIdentity({ ruleset: attempt.ruleset, level: attempt.level }),
            "This Team completion does not match the installed configuration.",
          );
          const progress = validateInstalledTeamProgress(
              progressRequest.result,
              editionId,
            ),
            previous = progress.clears[levelId],
            receipt = { runId, gameplayId, difficulty, presetId };
          if (previous?.runId === runId) {
            required(
              canonicalJSON(previous) === canonicalJSON(receipt),
              "A Team completion run cannot change identity.",
            );
          } else {
            progress.clears[levelId] = receipt;
            progress.generation++;
            progressStore.put(progress, editionId);
          }
          result = structuredClone(progress);
        } catch (error) {
          failure = error;
          try {
            tx.abort();
          } catch {}
        }
      };
      signal?.addEventListener("abort", abort, { once: true });
      editionRequest.onsuccess = stage;
      progressRequest.onsuccess = stage;
      tx.oncomplete = () => {
        signal?.removeEventListener("abort", abort);
        resolve(result);
      };
      tx.onabort = tx.onerror = () => {
        signal?.removeEventListener("abort", abort);
        reject(
          failure || tx.error || new Error("Team completion save failed."),
        );
      };
    });
  }
  return Object.freeze({
    install,
    inventory,
    load,
    recordCompletion,
    close() {
      closed = true;
      void opening?.then(
        (db) => db.close(),
        () => {},
      );
      opening = null;
    },
  });
}
