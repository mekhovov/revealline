# Approved soundtrack archive staging

`node scripts/build-soundtrack-archive.mjs --archive-id soundtracks.1 --base-url https://mekhovov.github.io/revealline-soundtracks-1/ --out .cache/soundtrack-archive-1`

This prepares a fresh local repository payload only. It does not create a GitHub repository, push, publish, edit approvals, or change the game's trusted catalogue. The current publication approvals contain zero recordings, so the command returns `status: "empty"` and creates no output. Candidate recordings and the local Ukrainian reference collection are not copied.

The command calls `compilePublishedSoundtracks(root)` and requires explicit web-playback and redistribution permission for every returned recording. It verifies exact lengths, SHA-256 and complete MP3 frame metadata. Approved recordings with identical delivery hashes share one object; metadata and all credits remain separate. It never re-encodes audio.

An approved payload contains:

- `objects/<sha256>.mp3`: unchanged approved delivery bytes.
- `inventory.json`: runtime-compatible paths, byte lengths and hashes.
- `README.md`: track credits, licence/source links and intended individual MP3 download links.
- `.nojekyll`: GitHub Pages static-file marker.
- `archive-candidate.json`: deterministic source-catalogue hash, exact archive admission/inventory pin, proposed catalogue entries with `archiveId`, and payload hashes. It is an unpublished review artifact, not automatic admission.

Only the existing owner/path allowlist (`https://mekhovov.github.io/revealline-soundtracks-<digits>/`) is accepted. Output must be a new directory below the source `.cache`, with no symlink ancestors or overwrites. Limits are 512 unique MP3 objects, 800,000,000 total payload bytes including metadata, and at least 1 GiB of free disk after staging. Failure during writing removes that newly created output; unrelated files stay untouched.

Before any later publication, review the candidate against retained listening and licence evidence. Deploy the exact inventory and objects, verify the hosted inventory hash and object bytes, and separately review a code-owned catalogue/admission update. The staging command performs none of those external actions and does not claim that intended download URLs already exist.

## Admitting a verified deployment

The source compiler reads `authoring/library/soundtrack-archive-admissions.json` in runtime mode. Its format is `revealline-soundtrack-archive-admissions.v1`; each `archives` entry contains `admission` (the runtime archive identity/baseURL/inventory SHA-256), `inventory` and `verification` (ordinary paths below `authoring/library/`), and the exact `trackIds` to route there. The verification JSON uses `revealline-soundtrack-host-verification.v1`, with `checkedAt`, `baseURL`, `inventorySha256` and `objects` matching every verified inventory member. These are reviewed source evidence, never imported player data.

Admission cannot approve music: all selected recordings must already pass the original/creator/UA-FPV publication compiler. Inventory contents must match exactly; an extra or missing object, changed length/hash, conflicting archive URL, symlink, unsafe host or restrictive same-hash alias is refused. Local payload bytes remain when an unarchived approved alias still needs them. Source-mode compilation is retained for reproducible restaging and never fetches the remote archive.
