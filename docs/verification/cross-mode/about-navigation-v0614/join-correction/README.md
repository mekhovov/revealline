# About controller join correction

A successful controller join now establishes visible focus without activation. An already focused control is retained; arrival on BODY selects Return. Held input and release cannot activate it. A fresh Confirm is required.

All four source hunks were reviewed. The complete affected cohort passes 201/201 on Node 20.19.5 and 201/201 on Node 22.22.2; scoped lint, formatting and whitespace checks pass. The parent also reran the original root probe and verified zero clicks after join/release.

Original commit 61cf9c14 and its receipts remain unchanged. The first negative Node 22 run was stopped during cyclic DOM assertion rendering. Equivalent boolean identity assertions avoided that diagnostic failure without relaxing the conditions. Bounded negative runs reproduced 19/22 on both runtimes before the corrected passing runs. The intake manifest pins every retained original.

This is a follow-up within unpublished v0.61.4. Exact-commit source gates, build, freeze, native and public acceptance remain with the release coordinator. Modeled DOM and pad input do not establish physical-controller or browser certification.
