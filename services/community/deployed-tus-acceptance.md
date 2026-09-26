# Deployed tus interruption acceptance

`npm run acceptance:tus-deployed` exercises the actual HTTPS service rather than the in-process
development fixture. It creates a valid generated `.rlpack`, sends publication traffic through a
loopback fault proxy, commits the first 17 bytes of the first tus `PATCH`, and closes the client
connection before returning the upstream response. The production browser upload adapter must read
the authoritative offset with `HEAD`, resume the same upload resource, and finish without creating
another submission.

Before creating content, the command requires `/version` to match the configured exact release,
source revision and validator version, then requires both `/health` and `/ready` to pass. After the
worker publishes the package, the command discovers and downloads that immutable edition,
checks its exact byte count and SHA-256, and unlists it with a short-lived administrator session.
It writes an owner-only `revealline-community-deployed-tus-acceptance.v1` receipt containing public
release and run identities, readiness, byte identities, offsets, request counts, validation status,
and cleanup status. Credentials, account subjects, response bodies, package content, and secret
configuration values are not written to the receipt or terminal.

Copy [deployed-acceptance.env.example](deployed-acceptance.env.example) outside the checkout, replace
the placeholders, restrict it to its owner, and load it in the operator shell. Use a new lowercase
namespace for every run and short-lived creator and administrator sessions:

```sh
cd services/community
set -a
. /secure/path/revealline-deployed-acceptance.env
set +a
npm run acceptance:tus-deployed
```

Set `COMMUNITY_TUS_ACCEPTANCE_EXPECTED_VERSION`,
`COMMUNITY_TUS_ACCEPTANCE_EXPECTED_SOURCE_REVISION`, and
`COMMUNITY_TUS_ACCEPTANCE_EXPECTED_VALIDATOR_VERSION` from the immutable artifact and deployed
validator configuration. An identity mismatch or failed liveness/readiness probe stops before the
fault proxy starts, a package is built, or a submission is created.

The base URL must use HTTPS and must not contain credentials, a query, or a fragment. If the service
is mounted below a path, include its trailing path in the base URL. The local fault proxy binds only
to loopback and forwards only to the configured HTTPS origin. It rewrites same-service tus
`Location` responses back through the loopback boundary so the injected interruption cannot be
bypassed.

The runner reserves the receipt path before any network request. It refuses to overwrite evidence
from an earlier run. A failure after an edition identity is known makes one best-effort administrator
unlisting attempt and records only `unlisted`, `failed`, or `not-required`. Inspect a failed cleanup
and remove the uniquely named disposable edition before reusing the deployment.

`npm run acceptance:tus-resume` remains the credential-free local contract test. It starts its own
in-memory service and proves the same client/proxy mechanics without contacting a deployment.
