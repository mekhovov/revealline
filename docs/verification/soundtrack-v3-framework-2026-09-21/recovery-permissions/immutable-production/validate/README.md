# Content and build-input validation

`npm run validate` completed successfully on the current working tree using Node v20.19.5. It checked **825 build files**, literal references, 12 base levels, four themes, seven classes, **12 indexed packs / 35 pack levels / six pack goals**, and one cooperative pack with two levels. The exact output is retained unchanged in `validate.log`.

Both tracked active/archive indexes and catalogues were present before validation. These exact HEAD indexes declare twelve distinct packs, rather than the seventeen initially estimated in the task; none was excluded. Before running, 54 absent tracked build inputs totaling 99,624,318 bytes were restored from their exact Git blobs at `2248f7f35ac5ad75b8bdff5aaa66ca45417180be`. No existing input was overwritten, downloaded or rebuilt. This selection stayed below its 256 MiB hydration cap and kept over 8 GiB free.

`hydration.json` pins 833 selected build/validation inputs. All were unchanged across the run. Six existing files intentionally differed from HEAD: the new cooperative picture binding, three compiled presentation documents, and the reviewed soundtrack model/panel repair. Their actual hashes are recorded; this is a working-tree validation, not an exact-commit claim. `test-receipt.json` records the precise command, output hash and unchanged-input result.

The successful validator emitted its four navigation warnings for `diagnostics/`, `releases/`, `privacy.html` and `credits.html`; the receipt preserves them without treating them as failures. This attempt needed no failed validation/setup rerun. It does not establish a full test-suite, release, native listening or recording-quality approval.
