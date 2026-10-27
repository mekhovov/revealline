#!/usr/bin/env node
import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  POLICY_FILES,
  sameAdmission,
  validationPolicyDigest,
} from "./admission-binding.mjs";

const STACK_MERGE_LABEL = "fastline-stack-merge";
// release-ready records the selected source policy. These jobs are deliberately
// skipped when that policy waives a full suite; a skip is never a test pass.
const POLICY_SKIPPED_JOBS = new Set(["focused", "test", "build"]);

// Finite reviewed source identities, not a general skipped-check allowlist.
// A proof classifies a PR-inapplicable job only; it is never native/browser
// qualification. The collector also proves the executed merge tree, Actions
// provenance, same-run source guards and both complete bounded observations.
// Unknown or changed workflow bytes require a separate source review.
export const REVIEWED_PR_INAPPLICABLE_WORKFLOWS = {
  '.github/workflows/deploy-pages.yml': {
    cc7a92a2875d8b7e29021e3a22ed2b47987c8f98: {
      bytes: 19972,
      sha256: '779432ef13e214cf851cb062279aec111421d8b7e9aeb3df68bca2f3bf0ca1a8',
      requiredSuccessfulJobs: [],
      jobs: {
        preflight: {
          name: null,
          checkNames: ['preflight'],
          needs: [],
          condition: "github.event_name == 'pull_request'",
          proof: null,
        },
        focused_shards: {
          name: null,
          checkNames: ['focused_shards'],
          needs: ['preflight'],
          condition:
            "github.event_name == 'pull_request' && needs.preflight.result == 'success' && needs.preflight.outputs.admission != 'hold' && needs.preflight.outputs.focusedRequired == 'true'",
          proof: null,
        },
        focused: {
          name: null,
          checkNames: ['focused'],
          needs: ['preflight', 'focused_shards'],
          condition:
            "always() && github.event_name == 'pull_request' && needs.preflight.result == 'success' && needs.preflight.outputs.admission != 'hold' && needs.preflight.outputs.focusedRequired == 'true'",
          proof: null,
        },
        test: {
          name: null,
          checkNames: ['test'],
          needs: ['preflight'],
          condition:
            "github.event_name == 'pull_request' && needs.preflight.outputs.admission == 'release' && vars.REVEALLINE_FULL_CI == 'true' && needs.preflight.outputs.runTests == 'true'",
          proof: null,
        },
        build: {
          name: null,
          checkNames: ['build'],
          needs: ['preflight'],
          condition:
            "github.event_name == 'pull_request' && (needs.preflight.outputs.admission == 'release' ||\n needs.preflight.outputs.admission == 'release-evidence')",
          proof: null,
        },
        'release-ready': {
          name: null,
          checkNames: ['release-ready'],
          needs: ['preflight', 'focused', 'test', 'build'],
          condition: "always() && github.event_name == 'pull_request'",
          proof: null,
        },
      },
    },
  },
  '.github/workflows/published-pages-smoke.yml': {
    '155b08d1f7d353b30244da019afa0234087fec61': {
      bytes: 19213,
      sha256: 'cac41781df50d8a187de9173e4fa940fd82f7d94dc1b15ad622e480322479364',
      requiredSuccessfulJobs: ['source'],
      jobs: {
        source: {
          name: null,
          checkNames: ['source'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && ((github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository) ||\n (github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'))",
          proof: null,
        },
        browser: {
          name: null,
          checkNames: ['browser'],
          needs: ['source'],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'",
          proof: {
            kind: 'manual-only',
          },
        },
      },
    },
    '48e48f436374f807d27692844e3c290038fd581e': {
      bytes: 19496,
      sha256: '94596b1a8b9d5cfc29a6953aa7086f4b660986189e3329afd683a42b76caa57a',
      requiredSuccessfulJobs: ['source'],
      jobs: {
        source: {
          name: null,
          checkNames: ['source'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && ((github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository) ||\n (github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'))",
          proof: null,
        },
        browser: {
          name: null,
          checkNames: ['browser'],
          needs: ['source'],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'",
          proof: {
            kind: 'manual-only',
          },
        },
      },
    },
  },
  '.github/workflows/solo-native-package-consumer.yml': {
    '0c3ebd54783fe5537c2077199347b584a1fe127c': {
      bytes: 438522,
      sha256: '7fd13f28c5b780244fcb064d8712bda6b58d4ba9f77764f9d34f7cfeb1f3ba1e',
      requiredSuccessfulJobs: ['replay-portability-source'],
      jobs: {
        cocoa: {
          name: null,
          checkNames: ['cocoa'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'cocoa'",
          proof: {
            kind: 'manual-only',
          },
        },
        correctness: {
          name: null,
          checkNames: ['correctness'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'first-eight'",
          proof: {
            kind: 'manual-only',
          },
        },
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'next'",
          proof: {
            kind: 'manual-only',
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
        raster: {
          name: null,
          checkNames: ['raster'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'raster'",
          proof: {
            kind: 'manual-only',
          },
        },
        readiness: {
          name: null,
          checkNames: ['readiness'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'readiness'",
          proof: {
            kind: 'manual-only',
          },
        },
        touch: {
          name: null,
          checkNames: ['touch'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'touch'",
          proof: {
            kind: 'manual-only',
          },
        },
        'hud-cpu': {
          name: null,
          checkNames: ['hud-cpu'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && (inputs.lane == 'hud-cpu' || inputs.lane == 'frame-trace')",
          proof: {
            kind: 'manual-only',
          },
        },
        'app-overhead': {
          name: '${{ matrix.engine }}',
          checkNames: ['matrix.engine'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'app-overhead'",
          proof: {
            kind: 'manual-only',
          },
        },
        'journal-cost': {
          name: '${{ matrix.engine }}',
          checkNames: ['matrix.engine'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'journal-cost'",
          proof: {
            kind: 'manual-only',
          },
        },
        timing: {
          name: '${{ inputs.phase }} / ${{ matrix.engine }} / ${{ matrix.repetition }}',
          checkNames: ['${{ inputs.phase }} / ${{ matrix.engine }} / ${{ matrix.repetition }}'],
          needs: [],
          condition:
            'github.repository == \'mekhovov/revealline\' && github.event_name == \'workflow_dispatch\' && github.ref == \'refs/heads/main\' && inputs.lane == \'timing\' && contains(fromJSON(\'["cold-first30","warm-first30","sentry-latency","long-rail-latency","large-capture-erosion","jammer-steering"]\'), inputs.phase)',
          proof: {
            kind: 'manual-only',
          },
        },
        lifecycle: {
          name: '${{ inputs.phase }} / ${{ matrix.engine }} / ${{ matrix.repetition }}',
          checkNames: ['${{ inputs.phase }} / ${{ matrix.engine }} / ${{ matrix.repetition }}'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'lifecycle' && contains(fromJSON('[\"retry\",\"soak\",\"long29\"]'), inputs.phase)",
          proof: {
            kind: 'manual-only',
          },
        },
        'shared-return': {
          name: null,
          checkNames: ['shared-return'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'shared-return'",
          proof: {
            kind: 'manual-only',
          },
        },
        'demo-recovery': {
          name: null,
          checkNames: ['demo-recovery'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'demo-recovery'",
          proof: {
            kind: 'manual-only',
          },
        },
        'demo-resources': {
          name: null,
          checkNames: ['demo-resources'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'demo-resources'",
          proof: {
            kind: 'manual-only',
          },
        },
        'replay-portability-source': {
          name: null,
          checkNames: ['replay-portability-source'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && ((github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository) || (github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'replay-portability'))",
          proof: null,
        },
        'replay-portability': {
          name: null,
          checkNames: ['replay-portability'],
          needs: ['replay-portability-source'],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'replay-portability'",
          proof: {
            kind: 'manual-only',
          },
        },
      },
    },
    '4a003cf2a23ad416d1e1fff86b932c16e2067dc6': {
      bytes: 436631,
      sha256: '0d2230c71ec56f256412aefe1fc76a2096f65f666ad7d322d72897ce724af86a',
      requiredSuccessfulJobs: ['replay-portability-source'],
      jobs: {
        cocoa: {
          name: null,
          checkNames: ['cocoa'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'cocoa'",
          proof: {
            kind: 'manual-only',
          },
        },
        correctness: {
          name: null,
          checkNames: ['correctness'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'first-eight'",
          proof: {
            kind: 'manual-only',
          },
        },
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'next'",
          proof: {
            kind: 'manual-only',
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
        raster: {
          name: null,
          checkNames: ['raster'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'raster'",
          proof: {
            kind: 'manual-only',
          },
        },
        readiness: {
          name: null,
          checkNames: ['readiness'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'readiness'",
          proof: {
            kind: 'manual-only',
          },
        },
        touch: {
          name: null,
          checkNames: ['touch'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'touch'",
          proof: {
            kind: 'manual-only',
          },
        },
        'hud-cpu': {
          name: null,
          checkNames: ['hud-cpu'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && (inputs.lane == 'hud-cpu' || inputs.lane == 'frame-trace')",
          proof: {
            kind: 'manual-only',
          },
        },
        'app-overhead': {
          name: '${{ matrix.engine }}',
          checkNames: ['matrix.engine'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'app-overhead'",
          proof: {
            kind: 'manual-only',
          },
        },
        'journal-cost': {
          name: '${{ matrix.engine }}',
          checkNames: ['matrix.engine'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'journal-cost'",
          proof: {
            kind: 'manual-only',
          },
        },
        timing: {
          name: '${{ inputs.phase }} / ${{ matrix.engine }} / ${{ matrix.repetition }}',
          checkNames: ['${{ inputs.phase }} / ${{ matrix.engine }} / ${{ matrix.repetition }}'],
          needs: [],
          condition:
            'github.repository == \'mekhovov/revealline\' && github.event_name == \'workflow_dispatch\' && github.ref == \'refs/heads/main\' && inputs.lane == \'timing\' && contains(fromJSON(\'["cold-first30","warm-first30","sentry-latency","long-rail-latency","large-capture-erosion","jammer-steering"]\'), inputs.phase)',
          proof: {
            kind: 'manual-only',
          },
        },
        lifecycle: {
          name: '${{ inputs.phase }} / ${{ matrix.engine }} / ${{ matrix.repetition }}',
          checkNames: ['${{ inputs.phase }} / ${{ matrix.engine }} / ${{ matrix.repetition }}'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'lifecycle' && contains(fromJSON('[\"retry\",\"soak\",\"long29\"]'), inputs.phase)",
          proof: {
            kind: 'manual-only',
          },
        },
        'shared-return': {
          name: null,
          checkNames: ['shared-return'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'shared-return'",
          proof: {
            kind: 'manual-only',
          },
        },
        'demo-recovery': {
          name: null,
          checkNames: ['demo-recovery'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'demo-recovery'",
          proof: {
            kind: 'manual-only',
          },
        },
        'demo-resources': {
          name: null,
          checkNames: ['demo-resources'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'demo-resources'",
          proof: {
            kind: 'manual-only',
          },
        },
        'replay-portability-source': {
          name: null,
          checkNames: ['replay-portability-source'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && ((github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository) || (github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'replay-portability'))",
          proof: null,
        },
        'replay-portability': {
          name: null,
          checkNames: ['replay-portability'],
          needs: ['replay-portability-source'],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'replay-portability'",
          proof: {
            kind: 'manual-only',
          },
        },
      },
    },
    f267efe7f6b771a25065072229e715f825278a3a: {
      bytes: 439526,
      sha256: '55bff4bc7f2e2563efcf1e8366a4b8b6d90fb5c155c9bfa4e09f39273acaf740',
      requiredSuccessfulJobs: ['replay-portability-source'],
      jobs: {
        cocoa: {
          name: null,
          checkNames: ['cocoa'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'cocoa'",
          proof: {
            kind: 'manual-only',
          },
        },
        correctness: {
          name: null,
          checkNames: ['correctness'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'first-eight'",
          proof: {
            kind: 'manual-only',
          },
        },
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'next'",
          proof: {
            kind: 'manual-only',
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
        raster: {
          name: null,
          checkNames: ['raster'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'raster'",
          proof: {
            kind: 'manual-only',
          },
        },
        readiness: {
          name: null,
          checkNames: ['readiness'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'readiness'",
          proof: {
            kind: 'manual-only',
          },
        },
        touch: {
          name: null,
          checkNames: ['touch'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'touch'",
          proof: {
            kind: 'manual-only',
          },
        },
        'hud-cpu': {
          name: null,
          checkNames: ['hud-cpu'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && (inputs.lane == 'hud-cpu' || inputs.lane == 'frame-trace')",
          proof: {
            kind: 'manual-only',
          },
        },
        'app-overhead': {
          name: '${{ matrix.engine }}',
          checkNames: ['matrix.engine'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'app-overhead'",
          proof: {
            kind: 'manual-only',
          },
        },
        'journal-cost': {
          name: '${{ matrix.engine }}',
          checkNames: ['matrix.engine'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'journal-cost'",
          proof: {
            kind: 'manual-only',
          },
        },
        timing: {
          name: '${{ inputs.phase }} / ${{ matrix.engine }} / ${{ matrix.repetition }}',
          checkNames: ['${{ inputs.phase }} / ${{ matrix.engine }} / ${{ matrix.repetition }}'],
          needs: [],
          condition:
            'github.repository == \'mekhovov/revealline\' && github.event_name == \'workflow_dispatch\' && github.ref == \'refs/heads/main\' && inputs.lane == \'timing\' && contains(fromJSON(\'["cold-first30","warm-first30","sentry-latency","long-rail-latency","large-capture-erosion","jammer-steering"]\'), inputs.phase)',
          proof: {
            kind: 'manual-only',
          },
        },
        lifecycle: {
          name: '${{ inputs.phase }} / ${{ matrix.engine }} / ${{ matrix.repetition }}',
          checkNames: ['${{ inputs.phase }} / ${{ matrix.engine }} / ${{ matrix.repetition }}'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'lifecycle' && contains(fromJSON('[\"retry\",\"soak\",\"long29\"]'), inputs.phase)",
          proof: {
            kind: 'manual-only',
          },
        },
        'shared-return': {
          name: null,
          checkNames: ['shared-return'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'shared-return'",
          proof: {
            kind: 'manual-only',
          },
        },
        'demo-recovery': {
          name: null,
          checkNames: ['demo-recovery'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'demo-recovery'",
          proof: {
            kind: 'manual-only',
          },
        },
        'demo-resources': {
          name: null,
          checkNames: ['demo-resources'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'demo-resources'",
          proof: {
            kind: 'manual-only',
          },
        },
        'replay-portability-source': {
          name: null,
          checkNames: ['replay-portability-source'],
          needs: [],
          condition:
            "github.repository == 'mekhovov/revealline' && ((github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository) || (github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'replay-portability'))",
          proof: null,
        },
        'replay-portability': {
          name: null,
          checkNames: ['replay-portability'],
          needs: ['replay-portability-source'],
          condition:
            "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'replay-portability'",
          proof: {
            kind: 'manual-only',
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-auxiliary-temporary.yml': {
    b5a2fa1aa18e9867eb83246a7bcdf245f0801d08: {
      bytes: 7937,
      sha256: '13c5a76b86a7547df5fed9ed50c98157ce95045302d77c97ae9bd204410bbbce',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '1ccf8368a3dcd099e1608c8a9433e6f0c0518e8f'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        auxiliary: {
          name: null,
          checkNames: ['auxiliary'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-cpu-profile-temporary.yml': {
    '3c1a3edbf220526ad1bd75c49d36ef9f3f234780': {
      bytes: 8180,
      sha256: 'dd2d6ad15c025e8489257700103c009efa56f99410c3c7938942502c05f74b13',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'bffcbd838a7bb925da8aaf030695773f893d8bda'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        preflight: {
          name: null,
          checkNames: ['preflight'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-current-transitions-temporary.yml': {
    '6a067e11d40d43cb7a0ae1efc55071e084f159b1': {
      bytes: 9845,
      sha256: '69b58eef1987785234433a35230a378975fbf153af47efb27bf888ff46aa5fed',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'adb1c0c7b7dd1a526a0693917f2012d1dbc08b22'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        preflight: {
          name: null,
          checkNames: ['preflight'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-demo-active-temporary.yml': {
    '3c4d34445a7f7515103db69b85118c2daa85b5e8': {
      bytes: 6421,
      sha256: '5732e852efa234bba16b7b6c0822e2b43753bf1b23f644b9e8b54d40466be5b3',
      requiredSuccessfulJobs: [],
      jobs: {
        demo: {
          name: null,
          checkNames: ['demo'],
          needs: [],
          condition:
            'github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && false',
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-demo-temporary.yml': {
    '8a53354b1de74d899a506c1cd4ace573524aa8c1': {
      bytes: 6291,
      sha256: '2b9f8dde2c9741b45988b8993382d6e3875833f80d5d511f803def71815a00ba',
      requiredSuccessfulJobs: [],
      jobs: {
        demo: {
          name: null,
          checkNames: ['demo'],
          needs: [],
          condition:
            'github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && false',
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-final-audio-temporary.yml': {
    d28486d18176cbcf74d9c4cadb323a8f8b53fc44: {
      bytes: 16745,
      sha256: 'ed37c2093c2c6d35bc9afa0055d9b13f0c875e3ac4b1449358f0532602f50a13',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        auxiliary: {
          name: '${{ matrix.observation }}',
          checkNames: ['matrix.observation'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-final-audio-v2-temporary.yml': {
    a0e9f5c6db0f62fe9f9976e01d8624a93256f362: {
      bytes: 18624,
      sha256: '2466aad51a6c6d1e9318d2a5f140264fe8e96078200224309f8d74d944d63cfc',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        auxiliary: {
          name: '${{ matrix.observation }}',
          checkNames: ['matrix.observation'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-final-journal-cost-temporary.yml': {
    '68f0c030626fbcf1a2f8937d76fb06cb16e71c92': {
      bytes: 16549,
      sha256: 'ca4959a1c5e5a779ed6ecdc61309624b60886a37c42cdf1c429f1a8d74645eae',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        auxiliary: {
          name: '${{ matrix.engine }}',
          checkNames: ['matrix.engine'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-final-journal-cost-v2-temporary.yml': {
    '584312eaaac8c6edfe6760fe62a2317d1914fab3': {
      bytes: 17653,
      sha256: 'c985a1b0d98e1b29762d504ceed3c33cc665be26249c84b1193c67e0665ad0ef',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        auxiliary: {
          name: '${{ matrix.engine }}',
          checkNames: ['matrix.engine'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-final-large-profile-temporary.yml': {
    d233cce03ed34c22fb5f2244df641c8aca32e33e: {
      bytes: 17702,
      sha256: 'a61204e5a4b7a7afd2cd7582de1a43e12c0217f002fea785321b04ee19155e95',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        preflight: {
          name: null,
          checkNames: ['preflight'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-final-lifecycle-long29-temporary.yml': {
    '7595cd77f0354b641085f868d23770bcc86f488f': {
      bytes: 20612,
      sha256: '11e8e7db5a20fb4c50a06e870025b55f89d4e752f600f52fea09e0537193ab9e',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
    d04f40b53c016423297693708f18a0c4aef5234c: {
      bytes: 21960,
      sha256: 'cf0b8d00b6435b7d9a4ec4fd5b228ef56184298ea19c718b57449e7910673295',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-final-lifecycle-next-temporary.yml': {
    '8bc5b364bbb67057a2388d1463ef749e7edcab5f': {
      bytes: 20596,
      sha256: '070c1c3441d3f0461d8729221064301b66333dfb6f407b4d70f410e86677ba0b',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
    e688235da830c34a3ff6b8231db0ed19fd8c73aa: {
      bytes: 21940,
      sha256: 'd4a9babb6adf2e4647fc2b04fc47694b66e7d0465af57b98292def78b8284faa',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-final-lifecycle-retry-temporary.yml': {
    '6514ee76451f927c6896c162192629c9361d2677': {
      bytes: 20604,
      sha256: '5ba5aad7ccba26cbeb74e33dd3b223d1267e517c167565e85f3d5f2cbe467ee3',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
    '70cd69fc56ac08d74fc38dc314b34fba4511f57d': {
      bytes: 21950,
      sha256: 'd303da3dc4489837a6de56ad453e1eee43a903eb844651087fe8e6bdbda57302',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-final-long-rail-cpu-profile-temporary.yml': {
    '30ddc92c7fc317d36fe1a2e0622605bdf511912e': {
      bytes: 17167,
      sha256: '6f9d747656b958232743af7b26ebdeeb7d1dd941744edb0d47b93fd2124349a4',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'c41a02216c0811952232a387fd1743e09452c269'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        preflight: {
          name: null,
          checkNames: ['preflight'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-final-recovery-temporary.yml': {
    fafc84c4d20364b2f1602795e89ec30b74858034: {
      bytes: 15950,
      sha256: '8f0c10d5d21930e4eb3bcd3fc18cddf77ae93f5ec015b7b8b7e043252c49faf6',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        auxiliary: {
          name: '${{ matrix.observation }}',
          checkNames: ['matrix.observation'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-final-recovery-v2-temporary.yml': {
    d1a3533a00fa32d5b941186db53dd24dac08126b: {
      bytes: 16979,
      sha256: '847ea04861db51ca6bd41b5a4e0a5aef702b5e4840f6ce862b6b1cc9269e4a36',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        auxiliary: {
          name: '${{ matrix.observation }}',
          checkNames: ['matrix.observation'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-final-soak-temporary.yml': {
    b716aede274f916c9f7343981fa972990886fca4: {
      bytes: 19030,
      sha256: '81857c210068ee882d707f0cbb023c143b0ddce8b79a391e090d664daaa353d9',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
    ce6e6c909602e5fe18d992ca0ea059a418b30930: {
      bytes: 18092,
      sha256: 'f687c075d7623d2608e896d4fc182c872a2a2780646b1a3a922b674f714a1f3d',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-final-soak-v2-temporary.yml': {
    '08c832d9287b404fdbcdf738209173f02269a92f': {
      bytes: 20570,
      sha256: '2d1f87f46689ebbf6018e275154803eb8b50fc13a3f014a59ee8f908742e1527',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
    '3c99ac990a78f3a5d41108e9ed3c09f58c6c09b0': {
      bytes: 21910,
      sha256: 'd7f6babb03f79c62266883f1a1978c9eed8027a9b199c8e061ed981ea09e986f',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-final-timing-cold-first30-temporary.yml': {
    '47a045d919f0408aae95061cd8714d1b59f479fb': {
      bytes: 18220,
      sha256: 'f4453250748104ab8d67b5f7a588d4507ec16192589235c3eba330e0d43e58df',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
    f0be72d23c9fc5fae2e12b29ecb0ae9b0f8863ae: {
      bytes: 19188,
      sha256: 'a986f08922a045a6845a0b9673641ea2f242716fe534e883450271585607b484',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-final-timing-cold-first30-v2-temporary.yml': {
    '2d8ab144ada9fda79c827f1d8b64d01d2940aac4': {
      bytes: 22068,
      sha256: 'a76e4901080d86ee7c9374eee258a4f226188f98ff1f80be00ca2c04841049cc',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
    '71a3dec125928e81a52f2227db17ca37ea8babf5': {
      bytes: 20698,
      sha256: '4ea30560db242968f93219ba44a5af7b8655127119486f4f310cda9af1747a3b',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-final-timing-long-rail-temporary.yml': {
    '672e5d03381b47f176f164ae86fb150135b9c460': {
      bytes: 19158,
      sha256: '3dcd0211edf0f713d7b716e6502d6c40900a0a44b2e96cf978f3b61c274bb248',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
    aad4a4b3364629ef2e3abd9f8253cf0a69d6903d: {
      bytes: 18196,
      sha256: 'f8fbc016ac6f5844324f371a6d7ed7a71fbeaea14e176b0a846a3376b81468ff',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-final-timing-long-rail-v2-temporary.yml': {
    '69e61852143cabb78236a691c6f70b2fc1dd78a2': {
      bytes: 22038,
      sha256: '1c2d1c46e0c0552769863f0ab3dd103d41520c79f279aec5cc2f6a62cff35b5f',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
    ec1488da3990162c20401c882a2505d95de9ef41: {
      bytes: 20674,
      sha256: 'cf841d1cd52e26428d3ceb0ab031f76c8c2e87f667c3f067fdc294eded5bb823',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-final-timing-sentry-temporary.yml': {
    eadfe16c2c74cd61937c655a4b0cea01db5e5fa0: {
      bytes: 19128,
      sha256: '45b84da3c046c0ed8adeb13b2d6871a12985622b04f2ede47d968054eb02fd89',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
    eda340627ac8cbe36bd02d9400be7c32c2639fcd: {
      bytes: 18172,
      sha256: '1218e95c0c6331826b9a9184469678d9e53c5c8f2f188a5c31ff9c7171503e32',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-final-timing-sentry-v2-temporary.yml': {
    ad5a6f46a2741bde6551a8e1d89cb7b476b3438a: {
      bytes: 20650,
      sha256: 'cf616d4fe9b895d9b874f751a0796dc24675b3acfccdbffde8313cc6899c407c',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
    d4a6df7d930810703e6d055c2b9d970d2b6d8b5b: {
      bytes: 22008,
      sha256: '7eafb28768c05c81aba2dc7529ce778df171f14adcd847d7c77dcd8349e63b8f',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-final-timing-warm-first30-temporary.yml': {
    '194e9ce7e67e9dc204252d63680cf1c38294d314': {
      bytes: 18220,
      sha256: '2c28a4e5e4f1f93de562fc76fde759fdc6acaa6f7a799fff2fdf5a0d097897b5',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
    '78f3c1dc30f43ac04cd040d0da7889a74f735a0b': {
      bytes: 19188,
      sha256: 'ff0409dd602c7c34f00fce31349691d2e730b266e84917e324828fb8288b2e60',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-final-timing-warm-first30-v2-temporary.yml': {
    '2f59560f7ff85c3d50fdd03ce651faec42a37593': {
      bytes: 22068,
      sha256: '5698bf79a9b096ed232b9ae28cebfb9abc15b67865bdfcbb33a399d7a8893566',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
    b9ea62c9d6cd86f83eb94c78a07b71f42a402425: {
      bytes: 20698,
      sha256: '0c05a74da9ee0f9a8ad3026353ea771e2c40baf7bb75674ac65f1636f31128b3',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-first-victory-cpu-239-temporary.yml': {
    b6340986804272b8241af6db5b657c38e18f9a7c: {
      bytes: 18718,
      sha256: '499295dfb303887401ad849b04dac40b55c941bf9f3783f014d635f98becc06b',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '239c574ecddd5bb6d5896e621d9edc53e7f6a313'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        preflight: {
          name: null,
          checkNames: ['preflight'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-first-victory-cpu-e1cc-temporary.yml': {
    '2d61de4b4a08d8001d93a926a208e9dbbc4ba2c9': {
      bytes: 18287,
      sha256: '9eb0cd0bf3300a77c01e1f1b17bdeacd10293daf1e2c95bdbef97145ff5828ec',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '7c7cc2648331870683ac7b76850bbeff859f802e'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        preflight: {
          name: null,
          checkNames: ['preflight'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-next-geometric-39774-temporary.yml': {
    cbd4bef3123157cc78d9530e0b91c1d75ed8c6a7: {
      bytes: 28068,
      sha256: 'f3291d565e9855e8a0e28e39bda47fff1b024496849942ace3c661113a176957',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '5e9e16fd48f4b96b4a7fe30c72aa835ce9f536f0'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-next-geometric-c696-temporary.yml': {
    '18277d01e7d92caa8d699d5f9413ebff267500c8': {
      bytes: 17234,
      sha256: 'b2071becacdd008ab088f7df5c8b410aca92de3d826354910a25ad7ccb268aa4',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '0febd334619731adc26dfa3df78aab02991563af'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-next-geometric-e1cc-temporary.yml': {
    d47c3a0feffbfc4923d9e358b653b7a1cb232ee6: {
      bytes: 18000,
      sha256: '02e00c52e02ee51441c129b6c8305cfce56854eaf9a3d0e93773ba2dddbace7a',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-optional-start-audio-e1cc-temporary.yml': {
    '4dbb9a21927c508a407f700fd8455a4707f538b7': {
      bytes: 25580,
      sha256: '9f6b00ac45693194fc026069d5ea7e748c95ec364a699f340cfb700703dfbe39',
      requiredSuccessfulJobs: [],
      jobs: {
        readiness: {
          name: null,
          checkNames: ['readiness'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '7c7cc2648331870683ac7b76850bbeff859f802e'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-optional-start-audio-e1cc-v2-temporary.yml': {
    '9f8baa68144f1b7f68cd3933abb8834776821df2': {
      bytes: 26348,
      sha256: 'a495105d3ad12a4fa8b8a59b678f5a1aa0c3b11287807eff640345d08062e2cb',
      requiredSuccessfulJobs: [],
      jobs: {
        readiness: {
          name: null,
          checkNames: ['readiness'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '239c574ecddd5bb6d5896e621d9edc53e7f6a313'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-optional-start-audio-e1cc-v3-temporary.yml': {
    '0e05e069db17c5bced9d50307c3db3325581a3a9': {
      bytes: 26949,
      sha256: '0a50990d3b6021d5e9894c25876742a1cb5d63952c893670dfa6520c27698274',
      requiredSuccessfulJobs: [],
      jobs: {
        readiness: {
          name: null,
          checkNames: ['readiness'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '92ff7ef800e542617b4fc3efad96bd07ce6cbecb'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-optional-start-audio-e1cc-v4-temporary.yml': {
    '3049a4221f411863a56b79e191a1ea8b9aa92f54': {
      bytes: 27480,
      sha256: '9ac0f743ad4c7c8bffb2bb1d2b466b7c3ea7512ba0d1f54d1bf012dd4d0ceff7',
      requiredSuccessfulJobs: [],
      jobs: {
        readiness: {
          name: null,
          checkNames: ['readiness'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '34d95cb9fe471ca56c243f05c4330826ba822fb9'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-preparation-temporary.yml': {
    f187163ba1e2f8909cce2cab7f30cf2ed2a30416: {
      bytes: 7988,
      sha256: 'a54160cfb9be186b7d336cc3eedebf59fd0fb014352644c537e7218a88ba6ad9',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'bffcbd838a7bb925da8aaf030695773f893d8bda'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        auxiliary: {
          name: '${{ matrix.observation }}',
          checkNames: ['matrix.observation'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-readiness-ab45-temporary.yml': {
    '32b88f42e0bf0e035ddf23577e9ec9b90ba7eaa1': {
      bytes: 24473,
      sha256: 'b6a035098b7ebf371c5faf4476ac6b4a26c41be9f885178314dc253056d82bfa',
      requiredSuccessfulJobs: [],
      jobs: {
        readiness: {
          name: null,
          checkNames: ['readiness'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-readiness-diagnosed-239-temporary.yml': {
    '6a51a292abc66d7999a33fca4138b320c9f8004c': {
      bytes: 26105,
      sha256: 'ddad751bd28f6c43f5400c3dd345c26654117a9e648f87cde124736e6b4f476f',
      requiredSuccessfulJobs: [],
      jobs: {
        readiness: {
          name: null,
          checkNames: ['readiness'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '239c574ecddd5bb6d5896e621d9edc53e7f6a313'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-readiness-diagnosed-239-v2-temporary.yml': {
    c47c63995682afdc2051fc16e7647d77eaa7da60: {
      bytes: 27196,
      sha256: '40cf8255667931305fb32a45204479cf6fe895cf003fda37242c48e83c3e1144',
      requiredSuccessfulJobs: [],
      jobs: {
        readiness: {
          name: null,
          checkNames: ['readiness'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '92ff7ef800e542617b4fc3efad96bd07ce6cbecb'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-readiness-preparation-e1cc-v2-temporary.yml': {
    f29d68f7835ca61e4d351e0913f6348ed803d156: {
      bytes: 25625,
      sha256: 'dda2e618e92fb77c3f39c07a02a76db3adfafcca68eec7d0f298b926c1e85b38',
      requiredSuccessfulJobs: [],
      jobs: {
        readiness: {
          name: null,
          checkNames: ['readiness'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '7c7cc2648331870683ac7b76850bbeff859f802e'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-selected-font-direct-sheet-e1cc-temporary.yml': {
    a8f4993e4ddaf0d4625f31400d8ef8223936f0b9: {
      bytes: 27305,
      sha256: '55aae4ab2d2d1c3b1eab83f940873b78ae43d0f625c6d4ba569b60a8ae934f6c',
      requiredSuccessfulJobs: [],
      jobs: {
        readiness: {
          name: null,
          checkNames: ['readiness'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '5e9e16fd48f4b96b4a7fe30c72aa835ce9f536f0'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-selected-font-settlement-e1cc-temporary.yml': {
    e8488591fcdff2d231a81df02a03c0f622eb8730: {
      bytes: 26621,
      sha256: '0d574e3352d0d91898d439cedd8dd3a7da45e4845cc963439a352c69bbaca3c0',
      requiredSuccessfulJobs: [],
      jobs: {
        readiness: {
          name: null,
          checkNames: ['readiness'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'bab3b2790944c6257f9c1f9b346839996bbefebb'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-supplemental-temporary.yml': {
    ee081ffc1b86ec1a11e562a36154c6748b060686: {
      bytes: 8435,
      sha256: 'b4dbd48a6c39237414b407e9e33f28ed9a12dac8c5b7f530783d1de53c2960c7',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'bffcbd838a7bb925da8aaf030695773f893d8bda'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        preflight: {
          name: null,
          checkNames: ['preflight'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-sustained-temporary.yml': {
    e00a5860353636ef9af3147376f497df55f27859: {
      bytes: 8203,
      sha256: 'ca9e5c7677c9bd6a6815454fdce6a727dc9b01e52c24816b1b3780444dff7bcb',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'aeadf7f43a8c1aba3af78d6cc8713666b4af49f1'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
  '.github/workflows/solo-remote-timing-temporary.yml': {
    f167445de4e242ce80871f8ee975d86dd02b4819: {
      bytes: 8256,
      sha256: 'a2b82942df2410b17a0830e92c21743a5adbf08e16617479c596b1768dbfe52e',
      requiredSuccessfulJobs: [],
      jobs: {
        declare: {
          name: null,
          checkNames: ['declare'],
          needs: [],
          condition:
            "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '69fdc854ecc07eca46a3becc3e38c233a3865fb0'",
          proof: {
            kind: 'other-pr',
            forbiddenPR: 1544,
          },
        },
        sustained: {
          name: null,
          checkNames: ['sustained'],
          needs: ['declare'],
          condition: null,
          proof: {
            kind: 'needs-inapplicable',
            needs: ['declare'],
          },
        },
      },
    },
  },
};

// Every accepted observation includes two full bounded sweeps. This remains
// local implementation until hosted gates and independent review qualify it.
export async function collectExactHeadCheckInventory({
  repository,
  repositoryId,
  headSha,
  pullRequestNumber,
  api,
  invocation,
  now = Date.now,
  maxRequests = 64,
  sweepTimeoutMs = 120_000,
  requestTimeoutMs = 30_000,
}) {
  const require = (condition, message) => {
    if (!condition) throw new Error(`Exact-head inventory: ${message}`);
  };
  require(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(
    repository,
  ), "invalid repository");
  require(/^[a-f0-9]{40}$/u.test(headSha), "invalid head");
  require(typeof api === "function" &&
    typeof now === "function", "missing reader or clock");
  require(Number.isSafeInteger(maxRequests) &&
    maxRequests > 0 &&
    maxRequests <= 64, "invalid request budget");
  require(Number.isSafeInteger(sweepTimeoutMs) &&
    sweepTimeoutMs > 0 &&
    sweepTimeoutMs <= 120_000, "invalid time budget");
  require(Number.isSafeInteger(requestTimeoutMs) &&
    requestTimeoutMs > 0 &&
    requestTimeoutMs <= 30_000, "invalid request timeout");
  const prefix = `/repos/${repository}/commits/${headSha}`;
  const statuses = new Set([
    "queued",
    "in_progress",
    "completed",
    "waiting",
    "requested",
    "pending",
  ]);
  const conclusions = new Set([
    "action_required",
    "cancelled",
    "failure",
    "neutral",
    "success",
    "skipped",
    "stale",
    "timed_out",
  ]);
  const positive = (value) => Number.isSafeInteger(value) && value > 0;
  require(repositoryId === undefined ||
    positive(repositoryId), "invalid numeric repository identity");
  require(pullRequestNumber === undefined ||
    positive(pullRequestNumber), "invalid pull request identity");
  require(invocation === undefined ||
    (positive(invocation?.runId) &&
      positive(invocation?.runAttempt) &&
      invocation?.jobName === "reconcile"), "invalid controller invocation");
  const timestamp = (value) =>
    value === null ||
    (typeof value === "string" &&
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/u.test(value) &&
      Number.isFinite(Date.parse(value)));
  const phase = (row) => {
    require(statuses.has(row.status), "invalid status");
    require(row.status === "completed"
      ? conclusions.has(row.conclusion)
      : row.conclusion === null, "invalid conclusion");
  };
  const identity = (row) => {
    require(positive(row?.id) &&
      positive(row?.app?.id), "invalid run or app identity");
    require(row.head_sha === headSha, "foreign head");
    phase(row);
  };
  const linksMatch = (link, route, hasNext) => {
    if (link === undefined || link === null || link === "") return;
    require(typeof link === "string", "invalid pagination link");
    const parts = link.split(/,\s*(?=<)/u);
    const relations = new Set();
    let next = false;
    for (const part of parts) {
      const match = /^<([^>]+)>;\s*rel="(next|prev|first|last)"$/u.exec(
        part.trim(),
      );
      require(match &&
        !relations.has(match[2]), "malformed pagination relation");
      relations.add(match[2]);
      const target = new URL(match[1]);
      const current = new URL(route, "https://api.github.com");
      const resourcePath = (pathname) => {
        const named = `/repos/${repository}/`;
        const numeric =
          repositoryId === undefined ? null : `/repositories/${repositoryId}/`;
        if (pathname.startsWith(named)) return pathname.slice(named.length);
        if (numeric && pathname.startsWith(numeric))
          return pathname.slice(numeric.length);
        return null;
      };
      // GitHub canonicalizes Link URLs to /repositories/{immutable id}/.
      // Accept that alias ONLY for the proven same repository. Requests remain
      // constructed from the literal trusted owner/name, never from this URL.
      require(target.origin === current.origin &&
        !target.username &&
        !target.password &&
        !target.hash &&
        resourcePath(target.pathname) !== null &&
        resourcePath(target.pathname) ===
          resourcePath(current.pathname), "foreign pagination resource");
      const pageValues = target.searchParams.getAll("page");
      require(pageValues.length === 1 &&
        /^[1-9][0-9]*$/u.test(
          pageValues[0],
        ), "invalid pagination page parameter");
      const targetPage = Number(pageValues[0]);
      require(positive(targetPage), "invalid linked page");
      target.searchParams.delete("page");
      current.searchParams.delete("page");
      require([...target.searchParams].sort().toString() ===
        [...current.searchParams]
          .sort()
          .toString(), "changed pagination filters");
      if (match[2] === "next") {
        next = true;
        require(targetPage ===
          Number(
            new URL(route, "https://api.github.com").searchParams.get("page"),
          ) +
            1, "skipped pagination page");
      }
    }
    // A full uncounted legacy page cannot prove whether it is the last page.
    // Validate any links, but always probe the next bounded page even when a
    // valid terminal header supplies only prev/first. Counted endpoints still
    // require exact next-link agreement with their independently checked total.
    require(hasNext === null ||
      next === hasNext, "incomplete pagination links");
  };
  const sweep = async () => {
    const started = now();
    require(Number.isFinite(started), "invalid clock");
    let requests = 0;
    const read = async (route) => {
      require(++requests <= maxRequests, "request budget exceeded");
      const elapsed = now() - started;
      require(Number.isFinite(elapsed) &&
        elapsed >= 0 &&
        elapsed < sweepTimeoutMs, "time budget exceeded");
      const abort = new AbortController();
      let timer;
      try {
        const response = await Promise.race([
          Promise.resolve().then(() => api(route, { signal: abort.signal })),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => {
                abort.abort();
                reject(new Error("Exact-head inventory: request timeout"));
              },
              Math.min(requestTimeoutMs, sweepTimeoutMs - elapsed),
            );
          }),
        ]);
        const after = now() - started;
        require(Number.isFinite(after) &&
          after >= 0 &&
          after < sweepTimeoutMs, "time budget exceeded");
        // A trusted HTTP adapter may expose a Link header without mixing it
        // into GitHub's JSON body. Raw injected JSON fixtures are also supported.
        return response &&
          Object.hasOwn(response, "body") &&
          Object.hasOwn(response, "link")
          ? response
          : { body: response, link: null };
      } finally {
        clearTimeout(timer);
      }
    };
    const counted = async (
      resource,
      key,
      validate,
      base = prefix,
      query = "",
    ) => {
      const rows = [],
        ids = new Set();
      let expected;
      for (let page = 1; page <= 10; page++) {
        const route = `${base}/${resource}?${query}${resource === "check-runs" ? "filter=all&" : ""}per_page=100&page=${page}`;
        const { body, link } = await read(route);
        require(Number.isSafeInteger(body?.total_count) &&
          body.total_count >= 0 &&
          body.total_count <= 1000, "count outside bound");
        expected ??= body.total_count;
        require(body.total_count === expected, "count changed during sweep");
        require(Array.isArray(body[key]) &&
          body[key].length ===
            Math.min(100, expected - rows.length), "incomplete page");
        for (const row of body[key]) {
          validate(row);
          require(!ids.has(row.id), "duplicate identity");
          ids.add(row.id);
          rows.push(structuredClone(row));
        }
        linksMatch(link, route, rows.length < expected);
        if (rows.length === expected) return rows;
      }
      throw new Error("Exact-head inventory: pagination bound exceeded");
    };
    let suiteRepositoryId = repositoryId;
    const suites = await counted("check-suites", "check_suites", (row) => {
      identity(row);
      require(positive(row.repository?.id) &&
        row.repository.full_name ===
          repository, "invalid suite repository identity");
      suiteRepositoryId ??= row.repository.id;
      require(row.repository.id ===
        suiteRepositoryId, "foreign suite repository identity");
    });
    const suiteById = new Map(suites.map((row) => [row.id, row]));
    const checkRuns = await counted("check-runs", "check_runs", (row) => {
      identity(row);
      require(typeof row.name === "string" &&
        row.name.length > 0 &&
        row.name.length <= 1024, "invalid check name");
      const suite = suiteById.get(row.check_suite?.id);
      require(suite &&
        suite.app.id === row.app.id &&
        (suite.app.slug ?? null) ===
          (row.app.slug ?? null), "unlisted or foreign suite");
      require(timestamp(row.started_at ?? null) &&
        timestamp(row.completed_at ?? null), "invalid check timestamp");
      require(row.status !== "completed" ||
        typeof row.completed_at === "string", "missing completion timestamp");
    });
    const legacy = [],
      legacyIds = new Set();
    let ended = false,
      previousTime = Infinity;
    for (let page = 1; page <= 11; page++) {
      const route = `${prefix}/statuses?per_page=100&page=${page}`;
      const { body, link } = await read(route);
      require(Array.isArray(body) &&
        body.length <= 100 &&
        legacy.length + body.length <= 1000, "legacy count outside bound");
      for (const row of body) {
        require(positive(row?.id) &&
          !legacyIds.has(row.id), "duplicate or invalid legacy identity");
        require(typeof row.context === "string" &&
          row.context.length > 0 &&
          row.context.length <= 1024, "invalid legacy context");
        // GitHub documents case-insensitive contexts, but does not define a
        // Unicode folding algorithm. Do not guess whether two non-ASCII names
        // are one gate or two: unsupported normalization fails closed.
        require(/^[\x20-\x7e]+$/u.test(
          row.context,
        ), "unsupported legacy context normalization");
        require(["success", "failure", "error", "pending"].includes(
          row.state,
        ), "invalid legacy state");
        require(typeof row.created_at === "string" &&
          timestamp(row.created_at) &&
          timestamp(row.updated_at ?? null), "invalid legacy timestamp");
        const created = Date.parse(row.created_at);
        require(created <= previousTime, "legacy order is not newest first");
        previousTime = created;
        legacyIds.add(row.id);
        legacy.push(structuredClone(row));
      }
      linksMatch(link, route, body.length === 100 ? null : false);
      if (body.length < 100) {
        ended = true;
        break;
      }
    }
    require(ended, "incomplete legacy pagination");
    const effective = new Map();
    for (const row of legacy) {
      const context = row.context.toLowerCase();
      if (!effective.has(context)) effective.set(context, row);
    }
    // Only a GitHub-owned suite -> run -> exact attempt -> job/check URL join
    // can prove an exception. Never derive a read URL from details_url, infer
    // a job ID from a check ID, or collapse different historical check IDs.
    const provenance = [],
      metadata = [],
      workflowCache = new Map(),
      jobCache = new Map();
    const actionsPrefix = `/repos/${repository}/actions`;
    // New skip proofs are admitted only for an identified PR. Ordinary inventories
    // retain their existing lookup path; no name alone grants an exception.
    const batchSkipped =
      positive(pullRequestNumber) &&
      checkRuns.some(
        (check) => check.conclusion === 'skipped' && !POLICY_SKIPPED_JOBS.has(check.name),
      );
    const associationRecord = (pull) => ({
      id: pull?.id ?? null,
      number: pull?.number ?? null,
      url: pull?.url ?? null,
      head: {
        sha: pull?.head?.sha ?? null,
        ref: pull?.head?.ref ?? null,
        repositoryId: pull?.head?.repo?.id ?? null,
        repositoryURL: pull?.head?.repo?.url ?? null,
      },
      base: {
        sha: pull?.base?.sha ?? null,
        ref: pull?.base?.ref ?? null,
        repositoryId: pull?.base?.repo?.id ?? null,
        repositoryURL: pull?.base?.repo?.url ?? null,
      },
    });
    let batchedRuns;
    const candidateWorkflows = new Map();
    if (batchSkipped) {
      batchedRuns = await counted(
        'runs',
        'workflow_runs',
        (row) => {
          require(positive(row?.id) &&
            positive(row.run_attempt) &&
            positive(row.workflow_id) &&
            positive(row.check_suite_id) &&
            row.head_sha === headSha &&
            row.repository?.full_name === repository &&
            row.head_repository?.full_name === repository &&
            row.repository.id === suiteRepositoryId &&
            row.head_repository.id === suiteRepositoryId &&
            typeof row.path === 'string' &&
            typeof row.event === 'string' &&
            Array.isArray(row.pull_requests) &&
            row.pull_requests.length <= 1000, 'invalid batched Actions run identity');
          const suite = suiteById.get(row.check_suite_id);
          require(suite?.app.id === 15368 &&
            suite.app.slug === 'github-actions', 'unlisted or foreign Actions run suite');
          phase(row);
        },
        actionsPrefix,
        `head_sha=${headSha}&`,
      );
      metadata.push({
        kind: 'exact-head-runs',
        runs: batchedRuns
          .map((run) => ({
            id: run.id,
            attempt: run.run_attempt,
            workflowId: run.workflow_id,
            path: run.path,
            head: run.head_sha,
            suiteId: run.check_suite_id,
            event: run.event,
            repositoryId: run.repository.id,
            headRepositoryId: run.head_repository.id,
            status: run.status,
            conclusion: run.conclusion,
            pullRequests: run.pull_requests.map(associationRecord),
          }))
          .sort((a, b) => a.id - b.id),
      });
      const paths = new Set();
      const catalog = await counted(
        'workflows',
        'workflows',
        (row) => {
          require(positive(row?.id) &&
            typeof row.path === 'string' &&
            typeof row.state === 'string' &&
            !paths.has(row.path), 'invalid or ambiguous workflow catalog');
          paths.add(row.path);
        },
        actionsPrefix,
      );
      const records = catalog
        .map(({ id, path, state }) => ({ id, path, state }))
        .sort((a, b) => a.id - b.id);
      metadata.push({ kind: 'workflow-catalog', workflows: records });
      for (const record of records) {
        if (/^\.github\/workflows\/[A-Za-z0-9_.-]+$/u.test(record.path))
          workflowCache.set(record.path.split('/').at(-1), record);
      }
      const directoryRoute = `/repos/${repository}/contents/.github/workflows?ref=${headSha}`;
      const { body: directory, link } = await read(directoryRoute);
      require(Array.isArray(directory) &&
        directory.length < 1000 &&
        (link === null ||
          link === undefined ||
          link === ''), 'incomplete candidate workflow directory');
      const entries = [];
      for (const entry of directory) {
        require(typeof entry?.name === 'string' &&
          /^[A-Za-z0-9_.-]+$/u.test(entry.name) &&
          entry.path === `.github/workflows/${entry.name}` &&
          entry.type === 'file' &&
          /^[a-f0-9]{40}$/u.test(entry.sha) &&
          !candidateWorkflows.has(entry.path), 'invalid or ambiguous candidate workflow identity');
        const record = { path: entry.path, blob: entry.sha, type: entry.type };
        candidateWorkflows.set(entry.path, record);
        entries.push(record);
      }
      metadata.push({
        kind: 'candidate-workflows',
        head: headSha,
        files: entries.sort((a, b) => a.path.localeCompare(b.path)),
      });
    }

    const workflow = async (filename) => {
      if (!workflowCache.has(filename)) {
        require(!batchSkipped, "missing trusted workflow in complete catalog");
        const { body } = await read(`${actionsPrefix}/workflows/${filename}`);
        require(positive(body?.id) &&
          typeof body.path === "string" &&
          typeof body.state === "string", "invalid trusted workflow metadata");
        const record = { id: body.id, path: body.path, state: body.state };
        workflowCache.set(filename, record);
        metadata.push({ kind: "workflow", ...record });
      }
      return workflowCache.get(filename);
    };
    const jobsForSuite = async (suiteId) => {
      if (!jobCache.has(suiteId)) {
        const runs = batchedRuns
          ? batchedRuns.filter((row) => row.check_suite_id === suiteId)
          : await counted(
          "runs",
          "workflow_runs",
          (row) => {
            require(positive(row?.id) &&
              positive(row.run_attempt) &&
              positive(row.workflow_id) &&
              row.head_sha === headSha &&
              row.check_suite_id === suiteId &&
              row.repository?.full_name === repository &&
              row.head_repository?.full_name === repository &&
              positive(row.repository.id) &&
              (repositoryId === undefined ||
                row.repository.id === repositoryId) &&
              row.repository.id === row.head_repository.id &&
              typeof row.path === "string" &&
              typeof row.event === "string", "invalid Actions run identity");
            phase(row);
          },
          actionsPrefix,
          `check_suite_id=${suiteId}&`,
        );
        require(runs.length === 1, "ambiguous Actions suite/run join");
        const run = runs[0];
        metadata.push({
          kind: "run",
          id: run.id,
          attempt: run.run_attempt,
          workflowId: run.workflow_id,
          path: run.path,
          head: run.head_sha,
          suiteId: run.check_suite_id,
          event: run.event,
          repositoryId: run.repository.id,
          headRepositoryId: run.head_repository.id,
          status: run.status,
          conclusion: run.conclusion,
        });
        const jobs = await counted(
          `runs/${run.id}/attempts/${run.run_attempt}/jobs`,
          "jobs",
          (job) => {
            require(positive(job?.id) &&
              job.run_id === run.id &&
              job.run_attempt === run.run_attempt &&
              job.head_sha === headSha &&
              typeof job.name === "string" &&
              typeof job.check_run_url === "string" &&
              timestamp(job.started_at ?? null) &&
              timestamp(
                job.completed_at ?? null,
              ), "invalid Actions job identity");
            phase(job);
          },
          actionsPrefix,
        );
        metadata.push({
          kind: "jobs",
          runId: run.id,
          attempt: run.run_attempt,
          jobs: jobs
            .map((job) => ({
              id: job.id,
              runId: job.run_id,
              attempt: job.run_attempt,
              head: job.head_sha,
              name: job.name,
              checkUrl: job.check_run_url,
              status: job.status,
              conclusion: job.conclusion,
              startedAt: job.started_at ?? null,
              completedAt: job.completed_at ?? null,
            }))
            .sort((a, b) => a.id - b.id),
        });
        jobCache.set(suiteId, { run, jobs });
      }
      return jobCache.get(suiteId);
    };
    const ancestryCache = new Map();
    const sourceTreeMatchesHead = async (base) => {
      if (!ancestryCache.has(base)) {
        // Read only the immutable comparison summary, not a partial commit
        // inventory. A merge onto an ancestor has exactly the head tree.
        const route = `/repos/${repository}/compare/${base}...${headSha}?per_page=1&page=1`;
        const { body, link } = await read(route);
        const counts = [body?.ahead_by, body?.behind_by, body?.total_commits];
        require(body?.url ===
          `https://api.github.com/repos/${repository}/compare/${base}...${headSha}` &&
          counts.every((value) => Number.isSafeInteger(value) && value >= 0) &&
          /^[a-f0-9]{40}$/u.test(body?.base_commit?.sha) &&
          /^[a-f0-9]{40}$/u.test(body?.merge_base_commit?.sha) &&
          body.base_commit.sha === base &&
          ['ahead', 'identical', 'behind', 'diverged'].includes(
            body.status,
          ), 'invalid executed-source ancestry summary');
        linksMatch(link, route, body.total_commits > 1);
        const record = {
          kind: 'executed-source-ancestry',
          comparisonURL: body.url,
          base,
          head: headSha,
          status: body.status,
          mergeBase: body.merge_base_commit.sha,
          ahead: body.ahead_by,
          behind: body.behind_by,
          total: body.total_commits,
        };
        const valid =
          record.mergeBase === base &&
          record.behind === 0 &&
          (base === headSha
            ? record.status === 'identical' && record.ahead === 0 && record.total === 0
            : record.status === 'ahead' && record.ahead > 0 && record.ahead === record.total);
        ancestryCache.set(base, valid);
        metadata.push(record);
      }
      return ancestryCache.get(base);
    };
    const checksByURL = new Map(
      checkRuns.map((check) => [
        `https://api.github.com/repos/${repository}/check-runs/${check.id}`,
        check,
      ]),
    );
    const boundCheckForJob = (job, run, jobs) => {
      const check = checksByURL.get(job.check_run_url);
      return check &&
        check.app.id === 15368 &&
        check.app.slug === 'github-actions' &&
        check.check_suite.id === run.check_suite_id &&
        check.head_sha === headSha &&
        job.head_sha === headSha &&
        job.run_id === run.id &&
        job.run_attempt === run.run_attempt &&
        job.name === check.name &&
        job.status === check.status &&
        job.conclusion === check.conclusion &&
        job.started_at === check.started_at &&
        job.completed_at === check.completed_at &&
        jobs.filter((other) => other.check_run_url === job.check_run_url).length === 1
        ? check
        : null;
    };
    const inapplicableProof = async (check, run, jobs) => {
      if (
        !batchSkipped ||
        pullRequestNumber === 1544 ||
        run.event !== 'pull_request' ||
        run.status !== 'completed' ||
        !['success', 'skipped'].includes(run.conclusion) ||
        run.pull_requests.length !== 1
      )
        return null;
      const pull = run.pull_requests[0];
      const repositoryURL = `https://api.github.com/repos/${repository}`;
      if (
        !positive(pull?.id) ||
        pull.number !== pullRequestNumber ||
        pull.url !== `${repositoryURL}/pulls/${pullRequestNumber}` ||
        pull.head?.sha !== headSha ||
        typeof pull.head.ref !== 'string' ||
        pull.head.ref.length === 0 ||
        pull.head.repo?.id !== suiteRepositoryId ||
        pull.head.repo.url !== repositoryURL ||
        pull.base?.ref !== 'main' ||
        !/^[a-f0-9]{40}$/u.test(pull.base.sha) ||
        pull.base.repo?.id !== suiteRepositoryId ||
        pull.base.repo.url !== repositoryURL
      )
        return null;
      const candidate = candidateWorkflows.get(run.path);
      const reviewed = REVIEWED_PR_INAPPLICABLE_WORKFLOWS[run.path]?.[candidate?.blob];
      const catalog = workflowCache.get(run.path.split('/').at(-1));
      if (
        !reviewed ||
        catalog?.state !== 'active' ||
        catalog.path !== run.path ||
        catalog.id !== run.workflow_id
      )
        return null;
      const definitions = Object.entries(reviewed.jobs);
      const matchingJobs = (definition) =>
        jobs.filter((job) => definition.checkNames.includes(job.name));
      const successfulSources = [];
      for (const jobId of reviewed.requiredSuccessfulJobs) {
        const definition = reviewed.jobs[jobId];
        const matches = matchingJobs(definition);
        if (matches.length !== 1) return null;
        const sourceCheck = boundCheckForJob(matches[0], run, jobs);
        if (
          !sourceCheck ||
          sourceCheck.status !== 'completed' ||
          sourceCheck.conclusion !== 'success'
        )
          return null;
        successfulSources.push({ jobId, actionJobId: matches[0].id, checkId: sourceCheck.id });
      }
      const proven = new Set();
      const prove = (jobId, visiting = new Set()) => {
        if (proven.has(jobId)) return true;
        const definition = reviewed.jobs[jobId];
        if (!definition?.proof || visiting.has(jobId)) return false;
        const matches = matchingJobs(definition);
        if (
          !matches.length ||
          !matches.every((job) => {
            const ownCheck = boundCheckForJob(job, run, jobs);
            return ownCheck?.status === 'completed' && ownCheck.conclusion === 'skipped';
          })
        )
          return false;
        const next = new Set(visiting).add(jobId);
        const proof = definition.proof;
        const valid =
          proof.kind === 'manual-only' ||
          (proof.kind === 'other-pr' &&
            proof.forbiddenPR === 1544 &&
            pullRequestNumber !== proof.forbiddenPR) ||
          (proof.kind === 'needs-inapplicable' &&
            definition.condition === null &&
            definition.needs.length > 0 &&
            JSON.stringify(definition.needs) === JSON.stringify(proof.needs) &&
            definition.needs.every((dependency) => prove(dependency, next)));
        if (!valid) return false;
        proven.add(jobId);
        return true;
      };
      // GitHub leaves some skipped matrix names unevaluated. A shared display
      // name must prove every reviewed source job it could denote.
      const candidates = definitions.filter(([, definition]) =>
        definition.checkNames.includes(check.name),
      );
      if (!candidates.length || !candidates.every(([jobId]) => prove(jobId))) return null;
      if (!(await sourceTreeMatchesHead(pull.base.sha))) return null;
      return {
        executedSourceBase: pull.base.sha,
        workflowBlob: candidate.blob,
        pullRequestNumber,
        sourceJobs: successfulSources,
        inapplicableJobs: [...proven].sort(),
      };
    };

    for (const check of [...checkRuns].sort((a, b) => a.id - b.id)) {
      if (
        !(
          check.name === "release-ready" ||
          check.name === "reconcile" ||
          (check.conclusion === "skipped" &&
            (POLICY_SKIPPED_JOBS.has(check.name) || batchSkipped))
        )
      )
        continue;
      const binding = { checkId: check.id, role: "ordinary" };
      if (check.app.id === 15368 && check.app.slug === "github-actions") {
        const { run, jobs } = await jobsForSuite(check.check_suite.id);
        const matches = jobs.filter(
          (job) =>
            job.check_run_url ===
            `https://api.github.com/repos/${repository}/check-runs/${check.id}`,
        );
        require(matches.length <= 1, "ambiguous check/job join");
        const job = matches[0];
        if (
          job &&
          job.name === check.name &&
          job.status === check.status &&
          job.conclusion === check.conclusion &&
          job.started_at === check.started_at &&
          job.completed_at === check.completed_at
        ) {
          Object.assign(binding, {
            jobId: job.id,
            runId: run.id,
            runAttempt: run.run_attempt,
            workflowId: run.workflow_id,
            workflowPath: run.path,
            suiteId: run.check_suite_id,
          });
          const controller = check.name === "reconcile";
          const filename = controller
            ? "fastline-auto-merge.yml"
            : "deploy-pages.yml";
          const trusted = await workflow(filename);
          if (
            trusted.state === "active" &&
            trusted.path === `.github/workflows/${filename}` &&
            run.workflow_id === trusted.id &&
            run.path === trusted.path
          ) {
            if (
              controller &&
              invocation?.runId === run.id &&
              invocation.runAttempt === run.run_attempt &&
              invocation.jobName === job.name &&
              jobs.filter((candidate) => candidate.name === invocation.jobName)
                .length === 1
            )
              binding.role = "self-reconcile";
            else if (!controller && run.event === "pull_request")
              binding.role =
                check.name === "release-ready"
                  ? "release-ready"
                  : "policy-skip";
          }
          if (binding.role === "ordinary" && check.conclusion === "skipped") {
            const proof = await inapplicableProof(check, run, jobs);
            if (proof) Object.assign(binding, { role: "inapplicable-skip", ...proof });
          }
        }
      }
      provenance.push(binding);
    }
    const suiteRecord = (row) => ({
      id: row.id,
      appId: row.app.id,
      appSlug: row.app.slug ?? null,
      head: row.head_sha,
      status: row.status,
      conclusion: row.conclusion,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
    });
    const runRecord = (row) => ({
      ...suiteRecord(row),
      name: row.name,
      suiteId: row.check_suite.id,
      detailsUrl: row.details_url ?? null,
      externalId: row.external_id ?? null,
      startedAt: row.started_at ?? null,
      completedAt: row.completed_at ?? null,
    });
    const legacyRecord = (row) => ({
      id: row.id,
      context: row.context,
      state: row.state,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? null,
      creatorId: row.creator?.id ?? null,
      targetUrl: row.target_url ?? null,
    });
    const byId = (a, b) => a.id - b.id;
    const canonical = JSON.stringify({
      repository,
      repositoryId: repositoryId ?? null,
      headSha,
      pullRequestNumber: pullRequestNumber ?? null,
      suites: suites
        .map((row) => ({
          ...suiteRecord(row),
          repositoryId: row.repository.id,
          repository: row.repository.full_name,
        }))
        .sort(byId),
      checkRuns: checkRuns.map(runRecord).sort(byId),
      statuses: legacy.map(legacyRecord),
      effectiveStatuses: [...effective.values()].map(legacyRecord),
      provenance,
      metadata,
    });
    return {
      suites,
      checkRuns,
      statuses: legacy,
      effectiveStatuses: [...effective.values()],
      canonical,
      requests,
      provenance,
      metadata,
    };
  };
  const startedAt = new Date().toISOString();
  const first = await sweep();
  const second = await sweep();
  require(first.canonical ===
    second.canonical, "inventory changed between complete sweeps");
  return {
    repository,
    repositoryId: repositoryId ?? null,
    headSha,
    suites: second.suites,
    checkRuns: second.checkRuns,
    statuses: second.statuses,
    effectiveStatuses: second.effectiveStatuses,
    provenance: second.provenance,
    metadata: second.metadata,
    startedAt,
    completedAt: new Date().toISOString(),
    requestCounts: [first.requests, second.requests],
    complete: true,
    atomicSnapshot: false,
    mergeAuthority: false,
  };
}

// These evaluators accept only a complete exact-head collector result.
export function inventoryCheckBlocker(inventory, headSha) {
  if (
    inventory?.complete !== true ||
    inventory.headSha !== headSha ||
    !Array.isArray(inventory.provenance) ||
    !Array.isArray(inventory.effectiveStatuses)
  )
    return "exact-head check inventory is incomplete";
  const bindings = new Map(inventory.provenance.map((p) => [p.checkId, p]));
  for (const check of inventory.checkRuns) {
    const binding = bindings.get(check.id);
    if (check.head_sha !== headSha)
      return `${check.name} belongs to a different head`;
    if (binding?.role === "self-reconcile") continue;
    if (check.status !== "completed")
      return `${check.name} is ${check.status} on the exact head`;
    if (
      check.conclusion !== "success" &&
      !(
        check.conclusion === "skipped" &&
        ((POLICY_SKIPPED_JOBS.has(check.name) &&
          binding?.role === "policy-skip") ||
          binding?.role === "inapplicable-skip")
      )
    )
      return `${check.name} concluded ${check.conclusion} on the exact head`;
  }
  for (const status of inventory.effectiveStatuses)
    if (status.state !== "success")
      return `legacy ${status.context} is ${status.state} on the exact head`;
  return null;
}

export function inventoryReleaseReady(inventory, headSha) {
  if (
    inventory?.complete !== true ||
    inventory.headSha !== headSha ||
    !Array.isArray(inventory.provenance)
  )
    return null;
  const ids = new Set(
    inventory.provenance
      .filter((p) => p.role === "release-ready")
      .map((p) => p.checkId),
  );
  const matches = inventory.checkRuns.filter(
    (check) =>
      ids.has(check.id) &&
      check.head_sha === headSha &&
      check.name === "release-ready",
  );
  return matches.length === 1
    ? {
        ...matches[0],
        actionsProvenance: inventory.provenance.find(
          (p) => p.checkId === matches[0].id,
        ),
      }
    : null;
}

// Reviewed, exact-source exceptions are trusted only because this module is
// loaded from main. Never load approvals from a pull request or an artifact.
const TRUSTED_POLICY_1558 = [
  [
    ".github/workflows/deploy-pages.yml",
    "fe9b921b9456a8ffa7bb79c9ee104206ac7a7f82",
  ],
  [
    "publishing/admission-binding.mjs",
    "bbc451129f21407143e4d3034d819711e5539dd2",
  ],
  [
    "publishing/admission-preflight.mjs",
    "9750b8dc5aef171f9124563966f726c2cbe15237",
  ],
  ["publishing/focused-tests.mjs", "403941412c35b2a61c2f67f611aa11d0b6d57467"],
  [
    "publishing/focused-test-map.json",
    "61a0b7a8f903a73a1ae5e5eeb26863b3b585f1f2",
  ],
  ["publishing/test-policy.json", "e067e704a165e16e449761989e3e1b611dc35181"],
  ["publishing/test-policy.mjs", "aa9f1efc79301cd227dbe7eb874dcba6b601003c"],
];
export const REVIEWED_POLICY_CHANGES = [
  {
    repository: "mekhovov/revealline",
    number: 1558,
    headSha: "d69dfcdc853e99c2a727ef13e747334ffe7ef97a",
    baseSha: "0597edff78fbec0faeccffae413ca48e7a5d91f1",
    trustedPolicyDigest:
      "533b2fbc30efdf12a2d5ea578a4360239e284ff8200107f1f7765b9f6210489b",
    approvedPolicyDigest:
      "083826bf415c8ff93e7801bfd7b35674547bcbb1acecf7f7734f4146a9eef475",
    paths: [
      ".github/workflows/measure-pages-stack.yml",
      "docs/pages-stack-measurement-design-2026-10-16.md",
      "docs/pages-stack-measurement-plan-2026-10-16.md",
      "publishing/focused-test-map.json",
      "publishing/focused-tests.test.mjs",
      "publishing/source-workflow.test.mjs",
      "scripts/pages-stack-artifact.py",
      "scripts/pages-stack-artifacts.mjs",
      "scripts/pages-stack-contract.mjs",
      "scripts/pages-stack-measurement.mjs",
      "scripts/pages-stack-packet.mjs",
      "scripts/pages-stack-source.mjs",
      "scripts/test-pages-stack-artifacts.mjs",
      "scripts/test-pages-stack-contract.mjs",
      "scripts/test-pages-stack-e2e.mjs",
      "scripts/test-pages-stack-measurement.mjs",
      "scripts/test-pages-stack-packet.mjs",
      "scripts/test-pages-stack-source.mjs",
    ],
    trustedPolicyBlobs: TRUSTED_POLICY_1558,
    candidatePolicyBlobs: TRUSTED_POLICY_1558.map(([name, oid]) => [
      name,
      name === "publishing/focused-test-map.json"
        ? "61dda74f9db14d20b6055e725cf5836b3b539bfe"
        : oid,
    ]),
  },
];

const exactSha = (value) =>
  typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const exactKeys = (value, keys) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  equal(Object.keys(value).sort(), [...keys].sort());
const policyBlobsValid = (entries) =>
  Array.isArray(entries) &&
  // The immutable #1558 record keeps its original complete seven-file shape.
  // This validates a record, not admission: all exact source/blob/digest/path
  // comparisons below still apply, and ordinary admission still uses current
  // POLICY_FILES. Never treat an arbitrary shorter inventory as a legacy one.
  [POLICY_FILES, TRUSTED_POLICY_1558.map(([name]) => name)].some(
    (profile) =>
      entries.length === profile.length &&
      entries.every(
        (entry, index) =>
          Array.isArray(entry) &&
          entry.length === 2 &&
          entry[0] === profile[index] &&
          exactSha(entry[1]),
      ),
  );
const pathsValid = (paths) =>
  Array.isArray(paths) &&
  paths.length > 0 &&
  paths.every(
    (name) =>
      typeof name === "string" &&
      /^[a-zA-Z0-9_.\/-]+$/u.test(name) &&
      !name.startsWith("/") &&
      !name.split("/").some((part) => !part || part === "." || part === ".."),
  ) &&
  equal(paths, [...new Set(paths)].sort());

export function trustedMainMatches(checkoutSha, liveSha) {
  return exactSha(checkoutSha) && checkoutSha === liveSha;
}

export function freshAdmissionMatches(check, pullRequest) {
  return (
    sameAdmission(check?.admissionReceipt, pullRequest, check?.policyDigest) &&
    (!check.approvedPolicyContext ||
      reviewedPolicyChangeMatches({
        ...check.approvedPolicyContext,
        pullRequest,
      }))
  );
}

export function mutationSnapshotMatches({
  controllerMainSha,
  liveMainSha,
  previousDecision,
  pullRequest,
  requiredCheck,
  freshChecks,
  observedHeadSha,
  dependencies,
  initialPullRequest,
}) {
  if (!trustedMainMatches(controllerMainSha, liveMainSha)) return false;
  if (
    !initialPullRequest ||
    !equal(
      pullMutationIdentity(initialPullRequest),
      pullMutationIdentity(pullRequest),
    )
  )
    return false;
  const latest = inventoryReleaseReady(freshChecks, observedHeadSha);
  if (
    !latest ||
    latest.id !== requiredCheck?.id ||
    !equal(latest.actionsProvenance, requiredCheck.actionsProvenance) ||
    !freshAdmissionMatches(requiredCheck, pullRequest)
  )
    return false;
  const freshRequired = { ...latest, admissionMatches: true };
  const freshDecision = decideMergeAction({
    pullRequest,
    observedHeadSha,
    requiredCheck: freshRequired,
    checkInventory: freshChecks,
    dependencies,
  });
  return (
    ["update", "stack", "merge", "arm"].includes(previousDecision.action) &&
    freshDecision.action === previousDecision.action
  );
}

const pullMutationIdentity = (pull) => ({
  number: pull.number,
  nodeId: pull.node_id,
  state: pull.state,
  draft: pull.draft,
  head: {
    sha: pull.head?.sha,
    ref: pull.head?.ref,
    repository: pull.head?.repo?.full_name,
    repositoryId: pull.head?.repo?.id,
  },
  base: {
    sha: pull.base?.sha,
    ref: pull.base?.ref,
    repository: pull.base?.repo?.full_name,
    repositoryId: pull.base?.repo?.id,
  },
  dependencies: [...new Set(dependencyNumbers(pull.body))].sort(
    (a, b) => a - b,
  ),
  labels: (pull.labels || []).map((label) => label.name || label).sort(),
  stack: pull.stack?.number ?? null,
  autoMerge: Boolean(pull.auto_merge),
  mergeable: pull.mergeable,
  mergeableState: pull.mergeable_state,
});

export async function collectControllerSnapshot({
  repository,
  number,
  observedHeadSha,
  controllerMainSha,
  invocation,
  api = github,
  admit,
  admittedCheck,
}) {
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository) ||
    !Number.isSafeInteger(number) ||
    number < 1
  )
    throw new Error("Invalid controller identity.");
  const prefix = `/repos/${repository}`;
  const mainBefore = await api(`${prefix}/git/ref/heads/main`);
  const first = await api(`${prefix}/pulls/${number}`);
  // The rejected-merge fallback must recognize an already completed merge
  // without another mutation or a duplicate production dispatch.
  if (first.state !== "open")
    return {
      pullRequest: first,
      observedHeadSha,
      controllerMainSha,
      liveMainSha: mainBefore.object?.sha,
      decision: { action: "wait", reason: "pull request is not open" },
    };
  if (!trustedMainMatches(controllerMainSha, mainBefore.object?.sha))
    throw new Error("Trusted main changed before snapshot.");
  if (
    first.number !== number ||
    first.head?.repo?.full_name !== repository ||
    first.base?.repo?.full_name !== repository ||
    !Number.isSafeInteger(first.base?.repo?.id) ||
    first.base.repo.id < 1 ||
    first.head?.repo?.id !== first.base.repo.id
  )
    throw new Error("Foreign pull request identity.");
  const checkInventory = await collectExactHeadCheckInventory({
    repository,
    repositoryId: first.base.repo.id,
    headSha: first.head.sha,
    pullRequestNumber: number,
    invocation,
    api: (route, options) =>
      api(route, { ...options, includePagination: true }),
  });
  const requiredCheck = inventoryReleaseReady(checkInventory, first.head.sha);
  if (
    requiredCheck?.status === "completed" &&
    requiredCheck.conclusion === "success"
  ) {
    if (
      admittedCheck &&
      requiredCheck.id === admittedCheck.id &&
      equal(requiredCheck.actionsProvenance, admittedCheck.actionsProvenance)
    ) {
      for (const key of [
        "admissionReceipt",
        "policyDigest",
        "approvedPolicyContext",
      ])
        if (Object.hasOwn(admittedCheck, key))
          requiredCheck[key] = structuredClone(admittedCheck[key]);
      requiredCheck.admissionMatches = freshAdmissionMatches(
        requiredCheck,
        first,
      );
    } else if (!admittedCheck) {
      const [owner, name] = repository.split("/");
      requiredCheck.admissionMatches = await (
        admit || ((check, pull) => checkedAdmission(owner, name, check, pull))
      )(requiredCheck, first);
    }
  }
  const dependencies = [];
  for (const dependency of [...new Set(dependencyNumbers(first.body))])
    if (dependency !== number)
      dependencies.push(await api(`${prefix}/pulls/${dependency}`));
  const last = await api(`${prefix}/pulls/${number}`);
  const mainAfter = await api(`${prefix}/git/ref/heads/main`);
  if (
    !equal(pullMutationIdentity(first), pullMutationIdentity(last)) ||
    !trustedMainMatches(controllerMainSha, mainAfter.object?.sha)
  )
    throw new Error("PR or trusted main changed during snapshot.");
  const decision = decideMergeAction({
    pullRequest: last,
    observedHeadSha,
    requiredCheck,
    checkInventory,
    dependencies,
  });
  return {
    controllerMainSha,
    liveMainSha: mainAfter.object.sha,
    pullRequest: last,
    observedHeadSha,
    requiredCheck,
    checkInventory,
    dependencies,
    decision,
  };
}

export async function executeVerifiedMergeAction({
  snapshot,
  refresh,
  actions,
}) {
  const action = snapshot.decision.action;
  if (action === "disarm") {
    await actions.disarm(snapshot.pullRequest, snapshot.observedHeadSha);
    return false;
  }
  if (!["update", "stack", "merge", "arm"].includes(action)) return false;
  const verify = async () => {
    const fresh = await refresh();
    if (
      fresh.pullRequest.state === "closed" &&
      fresh.pullRequest.merged === true &&
      fresh.pullRequest.head?.sha === snapshot.observedHeadSha
    )
      return null;
    if (
      !mutationSnapshotMatches({
        controllerMainSha: snapshot.controllerMainSha,
        liveMainSha: fresh.liveMainSha,
        previousDecision: snapshot.decision,
        pullRequest: fresh.pullRequest,
        initialPullRequest: snapshot.pullRequest,
        requiredCheck: snapshot.requiredCheck,
        freshChecks: fresh.checkInventory,
        observedHeadSha: snapshot.observedHeadSha,
        dependencies: fresh.dependencies,
      })
    ) {
      if (fresh.pullRequest.auto_merge && actions.disarm)
        await actions.disarm(fresh.pullRequest, snapshot.observedHeadSha);
      throw new Error(
        "Admission changed before mutation; no merge-capable request submitted.",
      );
    }
    return fresh;
  };
  const fresh = await verify();
  if (!fresh) return false;
  const perform = (name) =>
    actions[name](fresh.pullRequest, snapshot.observedHeadSha);
  if (action === "update" || action === "arm") {
    await perform(action);
    return false;
  }
  if (action === "stack") {
    if (!(await perform("stack")))
      throw new Error("GitHub did not accept the declared stack merge.");
    return true;
  }
  try {
    if (!(await perform("merge")))
      throw new Error("GitHub rejected the exact-head merge.");
    return true;
  } catch (error) {
    if (!isStackOnlyMergeError(error)) throw error;
    const fallback = await verify();
    if (!fallback) return false;
    if (!(await actions.stack(fallback.pullRequest, snapshot.observedHeadSha)))
      throw new Error("GitHub did not accept the exact-head stack merge.");
    return true;
  }
}

export function reviewedPolicyChangeMatches(
  input,
  approvals = REVIEWED_POLICY_CHANGES,
) {
  if (
    !exactKeys(input, [
      "repository",
      "pullRequest",
      "trustedPolicyBlobs",
      "candidatePolicyBlobs",
      "changedPaths",
      "receiptPaths",
      "trustedPolicyDigest",
    ]) ||
    !Array.isArray(approvals) ||
    approvals.length !== 1 ||
    !policyBlobsValid(input.trustedPolicyBlobs) ||
    !policyBlobsValid(input.candidatePolicyBlobs) ||
    !pathsValid(input.changedPaths) ||
    !pathsValid(input.receiptPaths)
  )
    return false;
  const approval = approvals[0];
  if (
    !exactKeys(approval, [
      "repository",
      "number",
      "headSha",
      "baseSha",
      "paths",
      "trustedPolicyBlobs",
      "candidatePolicyBlobs",
      "trustedPolicyDigest",
      "approvedPolicyDigest",
    ]) ||
    !Number.isSafeInteger(approval.number) ||
    approval.number < 1 ||
    !exactSha(approval.headSha) ||
    !exactSha(approval.baseSha) ||
    !/^[a-f0-9]{64}$/u.test(approval.trustedPolicyDigest || "") ||
    !/^[a-f0-9]{64}$/u.test(approval.approvedPolicyDigest || "") ||
    !pathsValid(approval.paths) ||
    !policyBlobsValid(approval.trustedPolicyBlobs) ||
    !policyBlobsValid(approval.candidatePolicyBlobs)
  )
    return false;
  // Only the reviewed map may differ among policy files. The new manual
  // diagnostic workflow is outside POLICY_FILES and allowed only at this
  // immutable reviewed PR/head/base identity, never as a generic exception.
  const differences = approval.trustedPolicyBlobs
    .filter(
      (entry, index) => !equal(entry, approval.candidatePolicyBlobs[index]),
    )
    .map(([name]) => name);
  if (
    !equal(differences, ["publishing/focused-test-map.json"]) ||
    approval.paths.includes("publishing/fastline-merge-controller.mjs") ||
    approval.paths.some(
      (name) =>
        name.startsWith(".github/") &&
        !(
          name === ".github/workflows/measure-pages-stack.yml" &&
          approval.repository === "mekhovov/revealline" &&
          approval.number === 1558 &&
          approval.headSha === "d69dfcdc853e99c2a727ef13e747334ffe7ef97a" &&
          approval.baseSha === "0597edff78fbec0faeccffae413ca48e7a5d91f1"
        ),
    )
  )
    return false;
  const pull = input.pullRequest;
  return (
    input.repository === approval.repository &&
    input.trustedPolicyDigest === approval.trustedPolicyDigest &&
    pull?.number === approval.number &&
    pull.head?.sha === approval.headSha &&
    pull.base?.sha === approval.baseSha &&
    pull.base?.ref === "main" &&
    pull.head?.repo?.full_name === approval.repository &&
    pull.base?.repo?.full_name === approval.repository &&
    equal(input.trustedPolicyBlobs, approval.trustedPolicyBlobs) &&
    equal(input.candidatePolicyBlobs, approval.candidatePolicyBlobs) &&
    equal(input.changedPaths, approval.paths) &&
    equal(input.receiptPaths, approval.paths)
  );
}

export function exactHeadCheckBlocker(
  checkRuns = [],
  headSha,
  provenance = [],
  effectiveStatuses = [],
) {
  return inventoryCheckBlocker(
    { complete: true, headSha, checkRuns, provenance, effectiveStatuses },
    headSha,
  );
}

export function dependencyNumbers(body = "") {
  return [
    ...String(body).matchAll(/(?:depends on|blocked by)\s+#([1-9][0-9]*)/giu),
  ].map((match) => Number(match[1]));
}

export function decideMergeAction({
  pullRequest,
  observedHeadSha,
  requiredCheck,
  checkInventory,
  checkInventoryComplete = true,
  dependencies = [],
}) {
  const labels = new Set(
    (pullRequest.labels || []).map((label) => label.name || label),
  );
  const autoMergeEnabled = Boolean(pullRequest.auto_merge);
  const reason = (() => {
    if (!/^[0-9a-f]{40}$/u.test(observedHeadSha || ""))
      return "event has no exact head SHA";
    if (pullRequest.head?.sha !== observedHeadSha)
      return "head changed after inspection";
    if (pullRequest.state !== "open") return "pull request is not open";
    if (pullRequest.draft !== false)
      return "pull request is draft or draft state is unknown";
    if (dependencies.some((dependency) => !dependency.merged_at))
      return "declared predecessor is not merged";
    if (
      !requiredCheck ||
      requiredCheck.status !== "completed" ||
      requiredCheck.conclusion !== "success" ||
      requiredCheck.head_sha !== observedHeadSha
    )
      return "release-ready is not successful on the exact head";
    if (requiredCheck.admissionMatches !== true)
      return "source or admission metadata changed since the successful gate";
    if (!checkInventoryComplete || checkInventory?.complete !== true)
      return "exact-head check inventory is incomplete";
    const selected = inventoryReleaseReady(checkInventory, observedHeadSha);
    if (
      !selected ||
      selected.id !== requiredCheck.id ||
      !equal(selected.actionsProvenance, requiredCheck.actionsProvenance)
    )
      return "release-ready identity is not uniquely verified on the exact head";
    const checkBlocker = inventoryCheckBlocker(checkInventory, observedHeadSha);
    if (checkBlocker) return checkBlocker;
    if (
      pullRequest.mergeable === false ||
      pullRequest.mergeable_state === "dirty"
    )
      return "pull request has conflicts";
    if (pullRequest.mergeable !== true) return "mergeability is unknown";
    if (pullRequest.mergeable_state === "behind") return null;
    if (
      !["clean", "has_hooks", "unstable"].includes(pullRequest.mergeable_state)
    )
      return `mergeability is ${pullRequest.mergeable_state || "unknown"}`;
    return null;
  })();

  if (reason) return { action: autoMergeEnabled ? "disarm" : "wait", reason };
  if (pullRequest.mergeable_state === "behind")
    return {
      action: "update",
      reason: "strict main requires an exact-SHA branch update",
    };
  if (
    labels.has(STACK_MERGE_LABEL) &&
    pullRequest.stack &&
    Number.isSafeInteger(pullRequest.stack.number)
  )
    return {
      action: "stack",
      reason: "declared stack top passed the exact-head gate",
    };
  if (["clean", "unstable"].includes(pullRequest.mergeable_state))
    return {
      action: "merge",
      reason:
        pullRequest.mergeable_state === "clean"
          ? "exact head is admitted and immediately mergeable"
          : "exact head is admitted; platform reports unstable merge state",
    };
  if (autoMergeEnabled)
    return { action: "none", reason: "exact-head auto-merge is already armed" };
  return {
    action: "arm",
    reason: "exact head is admitted; protected auto-merge may proceed",
  };
}

export function asynchronousMergeRequest(headSha) {
  if (!/^[0-9a-f]{40}$/u.test(headSha || ""))
    throw new TypeError("An exact 40-character head SHA is required.");
  return {
    sha: headSha,
    merge_method: "merge",
    merge_action: "default",
    bypass_rules: false,
  };
}

export function isStackOnlyMergeError(error) {
  return (
    error?.status === 403 &&
    error?.data?.message ===
      "Merging stacked PRs via this endpoint is not supported. Use the asynchronous merge endpoint instead."
  );
}

// Pull-request merges made with the workflow token do not emit a second
// `push` workflow run. Dispatch the rolling Pages build deliberately after a
// controller-owned merge so public play always follows protected main.
export function mainPagesDispatchRequest() {
  return { ref: "main" };
}

export function asynchronousMergeResult(value) {
  const status = value?.status;
  if (status === "pending") return { done: false, merged: false };
  if (status === "merged")
    return { done: true, merged: true, sha: value?.details?.sha || null };
  return {
    done: true,
    merged: false,
    reason:
      value?.details?.message || `asynchronous merge ${status || "failed"}`,
  };
}

export async function github(
  pathname,
  { includePagination = false, transport = fetch, ...options } = {},
) {
  const timeout = AbortSignal.timeout(30_000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;
  const response = await transport(`https://api.github.com${pathname}`, {
    ...options,
    signal,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${process.env.GH_TOKEN}`,
      "x-github-api-version": "2026-03-10",
      "user-agent": "revealline-fastline-controller",
      ...options.headers,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(
      `GitHub ${response.status} ${pathname}: ${text.slice(0, 1000)}`,
    );
    error.status = response.status;
    error.body = text;
    try {
      error.data = text ? JSON.parse(text) : null;
    } catch {
      error.data = null;
    }
    throw error;
  }
  const body = text ? JSON.parse(text) : null;
  return includePagination
    ? { body, link: response.headers.get("link") }
    : body;
}

async function mergeStack(owner, repository, pullRequest, headSha) {
  let requested;
  try {
    requested = await github(
      `/repos/${owner}/${repository}/pulls/${pullRequest.number}/merge-async`,
      {
        method: "PUT",
        body: JSON.stringify(asynchronousMergeRequest(headSha)),
        headers: { "content-type": "application/json" },
      },
    );
  } catch (error) {
    // A duplicate request returns its existing UUID as a 409. Continue that
    // exact request; every other rejection fails closed. GitHub does not
    // support auto-merge for stacks, so arming the top PR is not a valid
    // fallback.
    if (error?.status !== 409) throw error;
    requested = error.data;
  }
  if (requested?.status === "merged") return true;
  const uuid = requested?.details?.uuid || requested?.uuid;
  if (typeof uuid !== "string" || !/^[0-9a-f-]{20,80}$/iu.test(uuid))
    return false;
  for (let attempt = 0; attempt < 12; attempt++) {
    const value = await github(
      `/repos/${owner}/${repository}/pulls/${pullRequest.number}/merge-async/${uuid}`,
    );
    const result = asynchronousMergeResult(value);
    if (result.done) {
      if (!result.merged) throw new Error(result.reason);
      return true;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(15000, 1000 * 2 ** attempt)),
    );
  }
  throw new Error(
    "Asynchronous stacked merge did not finish within the bounded poll window.",
  );
}

async function dispatchMainPages(owner, repository) {
  await github(
    `/repos/${owner}/${repository}/actions/workflows/publish-main-pages.yml/dispatches`,
    {
      method: "POST",
      body: JSON.stringify(mainPagesDispatchRequest()),
      headers: { "content-type": "application/json" },
    },
  );
}

async function graphql(query, variables) {
  const result = await github("/graphql", {
    method: "POST",
    body: JSON.stringify({ query, variables }),
    headers: { "content-type": "application/json" },
  });
  if (result.errors?.length)
    throw new Error(`GraphQL: ${JSON.stringify(result.errors)}`);
  return result.data;
}

async function setAutoMerge(pullRequest, action, headSha) {
  if (action === "arm")
    return graphql(
      `
        mutation ($id: ID!, $head: GitObjectID!) {
          enablePullRequestAutoMerge(
            input: {
              pullRequestId: $id
              mergeMethod: MERGE
              expectedHeadOid: $head
            }
          ) {
            pullRequest {
              number
            }
          }
        }
      `,
      { id: pullRequest.node_id, head: headSha },
    );
  if (action === "disarm")
    return graphql(
      `
        mutation ($id: ID!) {
          disablePullRequestAutoMerge(input: { pullRequestId: $id }) {
            pullRequest {
              number
            }
          }
        }
      `,
      { id: pullRequest.node_id },
    );
}

async function appendSummary(lines) {
  if (process.env.GITHUB_STEP_SUMMARY)
    await fs.appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `${lines.join("\n")}\n`,
    );
}

async function upsertStatusComment(
  owner,
  repository,
  pullRequest,
  decision,
  observedHeadSha,
) {
  const marker = "<!-- fastline-controller-status -->";
  const dependencies = [...new Set(dependencyNumbers(pullRequest.body))];
  const nextAction = {
    arm: "GitHub auto-merge is being armed for this exact head.",
    disarm:
      "Existing auto-merge is being disarmed until the blocker is resolved.",
    update:
      "The branch is being updated from strict main; checks must pass again on the new head.",
    stack:
      "The declared GitHub stack is being submitted through the asynchronous exact-head endpoint.",
    merge:
      "The clean exact head is being submitted through the protected merge endpoint.",
    none: "No action: exact-head auto-merge is already armed.",
    wait: "Resolve the blocker, then rerun `release-ready` on the resulting exact head.",
  }[decision.action];
  const body = [
    marker,
    "### Fastline queue status",
    "",
    `- Purpose: ${pullRequest.title}`,
    `- Target: ${pullRequest.milestone?.title || "unassigned"}`,
    `- Predecessor: ${dependencies.length ? dependencies.map((number) => `#${number}`).join(", ") : "none declared"}`,
    `- Blocker/status: ${decision.reason}`,
    `- Checked SHA: \`${observedHeadSha || "none"}\``,
    `- Next: ${nextAction}`,
    "",
    "_This single bot-owned comment is updated in place._",
  ].join("\n");
  let existing = null;
  for (let page = 1; page <= 10 && !existing; page++) {
    const comments = await github(
      `/repos/${owner}/${repository}/issues/${pullRequest.number}/comments?per_page=100&page=${page}`,
    );
    existing = comments.find((comment) => comment.body?.includes(marker));
    if (comments.length < 100) break;
  }
  if (existing?.body === body) return;
  await github(
    existing
      ? `/repos/${owner}/${repository}/issues/comments/${existing.id}`
      : `/repos/${owner}/${repository}/issues/${pullRequest.number}/comments`,
    {
      method: existing ? "PATCH" : "POST",
      body: JSON.stringify({ body }),
      headers: { "content-type": "application/json" },
    },
  );
}

async function main() {
  if (!process.env.GH_TOKEN) throw new Error("GH_TOKEN is required.");
  const event = JSON.parse(
    await fs.readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
  );
  const workflowPull = event.workflow_run?.pull_requests?.[0];
  const [owner, repository] = process.env.GITHUB_REPOSITORY.split("/");
  const controllerRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const controllerMainSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: controllerRoot,
    encoding: "utf8",
    timeout: 10_000,
  }).trim();
  const initialMain = await github(
    `/repos/${owner}/${repository}/git/ref/heads/main`,
  );
  if (!trustedMainMatches(controllerMainSha, initialMain.object?.sha))
    throw new Error(
      "Trusted controller checkout is not current main; no mutation permitted.",
    );
  const observedHeadSha =
    event.pull_request?.head?.sha ||
    workflowPull?.head?.sha ||
    event.workflow_run?.head_sha;
  let number = event.pull_request?.number || workflowPull?.number;
  if (
    !Number.isSafeInteger(number) &&
    /^[0-9a-f]{40}$/u.test(observedHeadSha || "")
  ) {
    const associated = await github(
      `/repos/${owner}/${repository}/commits/${observedHeadSha}/pulls?per_page=100`,
    );
    const candidates = associated.filter(
      (candidate) =>
        candidate.state === "open" &&
        candidate.base?.ref === "main" &&
        candidate.head?.sha === observedHeadSha,
    );
    if (candidates.length !== 1) return;
    number = candidates[0].number;
  }
  if (!Number.isSafeInteger(number)) return;
  const snapshotOptions = {
    repository: `${owner}/${repository}`,
    number,
    observedHeadSha,
    controllerMainSha,
    invocation: {
      runId: Number(process.env.GITHUB_RUN_ID),
      runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
      jobName: process.env.GITHUB_JOB,
    },
  };
  let snapshot;
  try {
    snapshot = await collectControllerSnapshot(snapshotOptions);
  } catch (error) {
    // An operational/incomplete observation cannot authorize a mutation. Keep
    // protective disarming available, without fabricating a CI code failure.
    const pull = await github(`/repos/${owner}/${repository}/pulls/${number}`);
    snapshot = {
      pullRequest: pull,
      observedHeadSha,
      controllerMainSha,
      decision: {
        action: pull.auto_merge ? "disarm" : "wait",
        reason: `Operational observation rejected: ${error.message}`,
      },
    };
  }
  const { pullRequest, decision } = snapshot;
  await appendSummary([
    "### Fastline merge controller",
    "",
    `PR: #${number}`,
    `Observed head: \`${observedHeadSha || "none"}\``,
    `Decision: **${decision.action}** — ${decision.reason}`,
  ]);
  await upsertStatusComment(
    owner,
    repository,
    pullRequest,
    decision,
    observedHeadSha,
  );
  const merged = await executeVerifiedMergeAction({
    snapshot,
    refresh: () =>
      collectControllerSnapshot({
        ...snapshotOptions,
        admittedCheck: snapshot.requiredCheck,
      }),
    actions: {
      update: async (pull, head) =>
        github(
          `/repos/${owner}/${repository}/pulls/${pull.number}/update-branch`,
          {
            method: "PUT",
            body: JSON.stringify({ expected_head_sha: head }),
            headers: { "content-type": "application/json" },
          },
        ),
      stack: (pull, head) => mergeStack(owner, repository, pull, head),
      merge: async (pull, head) => {
        const result = await github(
          `/repos/${owner}/${repository}/pulls/${pull.number}/merge`,
          {
            method: "PUT",
            body: JSON.stringify({
              sha: head,
              merge_method: "merge",
            }),
            headers: { "content-type": "application/json" },
          },
        );
        if (!result?.merged)
          throw new Error(
            result?.message || "GitHub rejected the exact-head merge.",
          );
        return true;
      },
      arm: (pull, head) => setAutoMerge(pull, "arm", head),
      disarm: (pull, head) => setAutoMerge(pull, "disarm", head),
    },
  });
  if (merged) {
    await dispatchMainPages(owner, repository);
    await appendSummary([
      "Dispatched the rolling Pages build from protected main after the merge.",
    ]);
  }
}

export async function checkedAdmission(
  owner,
  repository,
  check,
  pullRequest,
  {
    root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    api = github,
    graph = graphql,
    download = fetch,
    approvals = REVIEWED_POLICY_CHANGES,
  } = {},
) {
  const proof = check.actionsProvenance;
  if (
    check.app?.id !== 15368 ||
    check.app?.slug !== "github-actions" ||
    check.name !== "release-ready" ||
    check.head_sha !== pullRequest.head.sha ||
    proof?.role !== "release-ready" ||
    proof.checkId !== check.id ||
    proof.workflowPath !== ".github/workflows/deploy-pages.yml" ||
    ![
      proof.runId,
      proof.runAttempt,
      proof.workflowId,
      proof.jobId,
      proof.suiteId,
    ].every((value) => Number.isSafeInteger(value) && value > 0)
  )
    return false;
  const prefix = `/repos/${owner}/${repository}`;
  const run = await api(`${prefix}/actions/runs/${proof.runId}`);
  if (
    run.id !== proof.runId ||
    run.run_attempt !== proof.runAttempt ||
    run.workflow_id !== proof.workflowId ||
    run.check_suite_id !== proof.suiteId ||
    run.event !== "pull_request" ||
    run.path !== ".github/workflows/deploy-pages.yml" ||
    run.head_sha !== pullRequest.head.sha
  )
    return false;
  // The artifact is untrusted input. Compare the actual checked revision's
  // policy blobs with protected-main automation, not its self-reported digest.
  const query = `query($owner: String!, $repository: String!) {
    repository(owner: $owner, name: $repository) {
      ${POLICY_FILES.map((name, index) => `p${index}: object(expression: ${JSON.stringify(`${run.head_sha}:${name}`)}) { oid }`).join("\n")}
    }
  }`;
  const policy = await graph(query, { owner, repository });
  const trustedPolicyBlobs = [];
  const candidatePolicyBlobs = [];
  for (const [index, name] of POLICY_FILES.entries()) {
    const bytes = await fs.readFile(path.join(root, name));
    const oid = createHash("sha1")
      .update(`blob ${bytes.length}\0`)
      .update(bytes)
      .digest("hex");
    trustedPolicyBlobs.push([name, oid]);
    candidatePolicyBlobs.push([name, policy.repository[`p${index}`]?.oid]);
  }
  const ordinaryPolicyMatch = equal(trustedPolicyBlobs, candidatePolicyBlobs);
  const trustedPolicyDigest = await validationPolicyDigest(root);
  let policyDigest = trustedPolicyDigest;
  const result = await api(
    `${prefix}/actions/runs/${run.id}/artifacts?per_page=100`,
  );
  const artifacts = result.artifacts.filter(
    (item) => item.name === `admission-${run.id}-${run.run_attempt}`,
  );
  if (
    artifacts.length !== 1 ||
    artifacts[0].expired ||
    artifacts[0].size_in_bytes > 1_000_000
  )
    return false;
  const response = await download(
    `https://api.github.com${prefix}/actions/artifacts/${artifacts[0].id}/zip`,
    {
      signal: AbortSignal.timeout(30_000),
      headers: {
        authorization: `Bearer ${process.env.GH_TOKEN}`,
        accept: "application/vnd.github+json",
      },
    },
  );
  if (!response.ok)
    throw new Error(`Receipt download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 1_000_000)
    throw new Error("Admission archive exceeds budget.");
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "fastline-admission-"),
  );
  const archive = path.join(directory, "receipt.zip");
  try {
    await fs.writeFile(archive, bytes);
    // Read one bounded member only. Never extract or execute artifact contents.
    const receipt = JSON.parse(
      execFileSync("unzip", ["-p", archive, "admission.json"], {
        encoding: "utf8",
        maxBuffer: 512_000,
        timeout: 10_000,
      }),
    );
    if (!ordinaryPolicyMatch) {
      const changedPaths = await completeChangedPaths(
        owner,
        repository,
        pullRequest,
        api,
      );
      if (
        !reviewedPolicyChangeMatches(
          {
            repository: `${owner}/${repository}`,
            pullRequest,
            trustedPolicyBlobs,
            candidatePolicyBlobs,
            changedPaths,
            receiptPaths: receipt.paths,
            trustedPolicyDigest,
          },
          approvals,
        )
      )
        return false;
      check.approvedPolicyContext = {
        repository: `${owner}/${repository}`,
        trustedPolicyBlobs,
        candidatePolicyBlobs,
        changedPaths,
        receiptPaths: receipt.paths,
        trustedPolicyDigest,
      };
      // This digest was independently derived from every reviewed candidate
      // policy blob and installed with the trusted approval, never taken from
      // the untrusted receipt. All executable policy blobs still match main.
      policyDigest = approvals[0].approvedPolicyDigest;
    }
    check.admissionReceipt = receipt;
    check.policyDigest = policyDigest;
    return sameAdmission(receipt, pullRequest, policyDigest);
  } finally {
    await fs.unlink(archive).catch(() => {});
    await fs.rmdir(directory);
  }
}

async function completeChangedPaths(
  owner,
  repository,
  pullRequest,
  api = github,
) {
  if (
    !Number.isSafeInteger(pullRequest.changed_files) ||
    pullRequest.changed_files < 1 ||
    pullRequest.changed_files > 3000
  )
    throw new Error("Invalid or oversized changed-file inventory.");
  const paths = new Set(),
    filenames = new Set();
  let count = 0;
  for (let page = 1; page <= 30; page++) {
    const rows = await api(
      `/repos/${owner}/${repository}/pulls/${pullRequest.number}/files?per_page=100&page=${page}`,
    );
    if (!Array.isArray(rows)) throw new Error("Invalid changed-file response.");
    count += rows.length;
    for (const row of rows) {
      if (filenames.has(row.filename))
        throw new Error("Duplicate changed-file row.");
      filenames.add(row.filename);
      paths.add(row.filename);
      if (row.previous_filename) paths.add(row.previous_filename);
    }
    if (rows.length < 100) break;
  }
  const result = [...paths].sort();
  if (count !== pullRequest.changed_files || !pathsValid(result))
    throw new Error("Incomplete or unsafe changed-path inventory.");
  return result;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
