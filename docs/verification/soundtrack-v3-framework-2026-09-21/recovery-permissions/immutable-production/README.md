# Complete immutable-production test cohort

All **70/70 tests passed**, with no failures, cancellations or skips, using the complete sorted `scripts/test-production-*.mjs` selection (seven files) and Node v20.19.5 with `--test-concurrency=2`. The exact command and log hash are retained in `test-receipt.json`; the original TAP output is `production-tests.tap`.

Before execution, the production register pins, retained metadata/source history, explicit fixture dependencies and local executable import closure were audited. This selected 172 inputs. The sparse checkout was missing 115 of those files; 167,091,083 bytes were restored from their exact Git blobs at `2248f7f35ac5ad75b8bdff5aaa66ca45417180be`, including the round-44/v034 and round-45/v035 delivery records. This stayed below the 256 MiB hydration limit. No existing file was overwritten, no symlink target was written, and no production source, validator or test was changed.

`hydration.json` records every selected path, reason, Git object, byte size, SHA-256 and whether it was restored. All 172 selected inputs matched HEAD before testing and were unchanged afterward. Free space remained over 8 GiB. The audited preparation avoided setup failures; this attempt has no failed run to replace or hide. Earlier failures in other cohorts remain in their existing evidence directories.

This verifies the bounded production-register/source-history cohort. It is not a whole-project, hosted CI, Field Kit production-history, native listening, musical-quality or release approval. It makes no new recording admission.
