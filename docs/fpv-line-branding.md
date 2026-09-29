# FPV / LINE identity

The current game is **FPV / LINE**. Current game menus, browser titles, website and creator chrome, install screens, export filenames, and native display metadata use the new identity. Edition titles use **`<edition name> / LINE`**. The aggregate Dutch edition is **DroneAid / LINE**, publicly selected with `?edition=droneaid` or `/editions/droneaid/app/`.

## Artwork

The original wordmark combines a four-rotor drone, a stepped cyan flight path, ivory **FPV**, and signal-yellow **LINE**. It was generated and refined with the built-in image generator specifically for this game. A matching square symbol supplies favicons, install icons and native artwork.

- [Transparent wordmark](../game/ui/art/identity/fpv-line/wordmark.png)
- [Original square icon](../game/ui/art/identity/fpv-line/icon-master.png)
- [Exact generation prompts](../authoring/library/fpv-line-identity/prompts.json)
- [Dimensions, source hashes and native derivatives](../game/ui/art/identity/fpv-line/provenance.json)
- [Install encoding recipe](../game/ui/art/identity/fpv-line/install-icons.json)

The generated source images are unchanged. Shared CSS frames the wordmark's transparent canvas; install and native pipelines derive the required sizes and containers. The 512px install PNG uses bounded channel precision to remain within the existing launcher limit. Other icon sizes preserve full RGB precision. Company logos remain company artwork.

## Presentation

`game/ui/brand-identity.mjs` owns game and edition title presentation. It retains real heading text and switches to text if the wordmark fails to load or Plain text is selected. Changing language cannot replace the image or lose its accessible title. The shared stylesheet is imported through the existing font entry point so player and creator chrome use the same assets.

DroneAid's existing propeller replaces its collective wordmark in current branding. The landing propeller turns once every ten seconds. Compact in-game marks stay still. Reduced Motion, reduced effects, background animation off and inactive landing scenes stop the decorative rotation. Short landscape keeps the propeller beside the Solo selector, outside the title and action stack.

## Compatibility

Public names and newly generated links change; save keys, bundle IDs, runtime globals, import formats, content receipts and historical snapshots remain compatible. The DroneAid internal identity is still `droneaid-nl-community`; legacy links remain supported. Native filesystem names use **FPV LINE** because `/` is a path separator. The repository and deployed project base path remain `revealline`.

See [edition identity and migration](edition-public-identity.md) for canonical routes, retained manifest identity, installation and rollback behavior. Renaming an already installed app depends on the browser or operating system applying the next update; source metadata changes do not establish that physical-device behavior.

## Verification

The [branding evidence](verification/fpv-line-brand-2026-09-29.md) separates source browser checks, automated checks, generated assets, the bounded standalone preview and work still requiring release qualification. Historical menu verification remains dated evidence for those earlier artifacts.
