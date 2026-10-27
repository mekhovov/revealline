# R6 coupled voltage-sag inverse: contract investigation

19 October 2026. This source-only investigation follows the fixed-voltage domain
selector at `44372674db4b9abeaf182d2c9a6b396b0fe72fd4`. It adds a regression fixture
and design evidence, **not a coupled inverse implementation**. Live flight,
controllers, catalogs, package admission and saved configurations are unchanged.
R6 remains open.

## Confirmed counterexample within the existing interfaces

The committed test `game/test/fpv-aircraft-propulsion-sag-contract.test.mjs` uses
entirely invented, power-consistent static channels. It is not a measured motor
or a proposed aircraft preset. Four identical rotors have body positions
`(−0.5,0,−0.5)`, `(0.5,0,−0.5)`, `(0.5,0,0.5)`, `(−0.5,0,0.5)` metres,
alternating body-y reaction directions `+1,−1,+1,−1`, and thrust along body +y.
Each explicitly declared surface has command knots `c = [0,1]`, terminal-voltage
knots `V = [0.5,4.5]` volts and its single admitted cell `[0,0]`.

The observed-corner formulas, exactly represented by the bilinear surface, are:

```text
single-rotor thrust T = 2 c V N
single-rotor reaction-torque magnitude Q = T/8 N·m
single-rotor DC input current Irotor = 2 c A
RPM = 10; airspeed = 0
```

At any fixed command, current is constant with voltage and therefore satisfies
the existing load solver's nondecreasing-current requirement. All fields, static
conditions, component declarations and command units pass existing validators.
Shaft power remains below delivered electrical power at the tested points.

Demanding body force `(0,4,0)` N and zero torque gives equal commands
`c = 1/(2V)` and total current `I = 4/V`. For open-circuit voltage `Voc = 5 V`
and series resistance `R = 1 Ω`, the battery equation is:

```text
V = Voc − R I
V + 4/V − 5 = 0
V² − 5V + 4 = (V − 1)(V − 4) = 0
```

Both solutions lie strictly inside the command and voltage domains. The existing
fixed-voltage inverse and independent existing forward battery-load adapter both
accept them and reproduce the requested wrench:

| Quantity                                        | Lower-voltage solution | Higher-voltage solution |
| ----------------------------------------------- | ---------------------: | ----------------------: |
| Terminal voltage                                |                    1 V |                     4 V |
| Command, each rotor                             |                    0.5 |                   0.125 |
| Total demanded DC current                       |                    4 A |                     1 A |
| Power from ideal open-circuit source, `Voc × I` |                   20 W |                     5 W |
| Power delivered at terminals, `V × I`           |                    4 W |                     4 W |
| Series loss, `R × I²`                           |                   16 W |                     1 W |
| Achieved body force                             |            `(0,4,0)` N |             `(0,4,0)` N |

This is an algebraic multiplicity example, not evidence about either solution's
dynamic stability. No dynamic motor, battery or controller behavior is inferred.

The coupled residual is positive at both voltage-domain endpoints:
`g(0.5)=3.5` and `g(4.5)=7/18`, but negative at `g(2)=−1`. A search requiring an
endpoint sign change would miss both valid interior roots. With the same model
and `Voc = 4 V`, the equation becomes `(V−2)² = 0`: the existing forward adapter
accepts the repeated root at 2 V, but the residual never changes sign around it.
With `Voc = 3 V`, the quadratic discriminant is negative. An adequate inverse
must distinguish absent roots from unbracketed repeated or multiple roots.

A 3 A current threshold marks the first 5 V-source solution `limit-exceeded`
while retaining its actual 4 A unregulated demand and wrench. The other solution
remains `solved` at 1 A. The current forward contract reports a threshold; it
does not regulate current, change commands or choose between inverse solutions.

## Why the fixed-command proof does not transfer

The existing load solver assumes commands remain fixed while voltage changes.
In an inverse, commands change to preserve the requested wrench, so monotone
fixed-command current does not imply a monotone coupled residual. Repeatedly
calling the fixed-voltage inverse and bisecting, iterating from one initial guess
or choosing whichever branch converges cannot establish complete coverage or a
unique result.

Within one joint command/voltage cell, the allocation matrix and wrench offset
are affine functions of voltage. Writing the four command fractions as `u`:

```text
A(V) u = b(V)
D(V) = det A(V), degree at most 4
ui(V) = Ni(V)/D(V), degree Ni at most 4, when D(V) ≠ 0
I(V,u) = α + βV + Σ(γi + δiV) ui
```

Multiplying the battery residual by `D(V)` yields a polynomial of degree at most
five. Determinant zeros are singularities, not automatically admissible roots;
command-cell boundaries and conditioning limits also constrain each branch.
This algebraic reduction identifies the missing prerequisite. It is not a
completed, floating-point-qualified root-isolation algorithm.

## Concrete next contract options

The general option requires a separately reviewed bounded joint-cell solver:

1. Partition the common declared voltage coverage and enumerate admitted joint
   command cells without inventing intervals. Bound voltage partitions, joint
   combinations, root-isolation work, retained candidates and numerical storage.
2. Isolate all candidate roots within each partition, including repeated roots;
   distinguish determinant poles and unresolved narrow/ill-conditioned regions.
   Specify coefficient arithmetic and error bounds before claiming completeness.
3. Require exact source-domain membership, the existing condition limit, command
   representation checks and independent forward battery/wrench/power residuals.
   No voltage or command snapping, clipping or extrapolation.
4. Keep requested wrench and source-battery inputs separate from solved terminal
   voltage, unregulated current, commands and all three power quantities above.
   A threshold is not a current regulator. Any future eligibility or branch
   selection policy must be explicit and preserve all rejected-solution evidence.
5. Return no usable commands for unresolved coverage, exhausted work bounds or
   distinct admissible solutions. Exact shared-boundary duplicates need a defined
   ownership rule; approximate solutions must not be silently merged.
6. Keep results diagnostic-only and `flightEligible: false`. Motor transients,
   measured evidence, controller adaptation and replay/runtime qualification
   remain separate requirements.

A narrower alternative could explicitly support surfaces whose current is
independent of command over the whole searched domain. That allows a fixed-load
voltage solve followed by command inversion and a complete forward check, but
is unrepresentative of ordinary propulsion. Its source predicate, coverage and
purpose would need a separately reviewed restricted contract; no such API was added.
Zero resistance already reduces to the existing fixed-voltage selector.

The blocker is therefore **a reviewed complete root-isolation/error-bound
contract for the joint nonlinear domain**, not missing user permission or an
unavailable physical radio. This increment deliberately does not introduce a
naïve iterative wrapper or claim R6 is complete.

## Validation

Four regression checks exercise the unchanged production domain and forward
evaluators: two distinct interior solutions with independent force/current/power
expectations, same-sign endpoint residuals, a repeated root with no sign crossing,
and threshold reporting without command regulation. These preserve a concrete
acceptance fixture for a future solver. Synthetic mathematical correctness does
not establish real-aircraft fidelity.

```sh
node --test game/test/fpv-aircraft-propulsion-sag-contract.test.mjs
```

Node 20.19.5 passes **99/99** focused checks: the four new contract fixtures plus
the unchanged 95 domain/inverse/quad/surface/load/path checks. Scoped ESLint,
Prettier and `git diff --check` pass. The preserved local combined log
`fpv-sag-inverse-contract-tests-20261019.log` has SHA-256
`58d04b02c9e49455462deef50bdd701dbe3e60dbfcbed8d149c43cc8d9c26aee`.
No package, browser flight or physical-device check is added by this investigation.
Independent read-only review reproduced all four new checks and approved the
counterexample, degree bound and documented limitations without blocking findings.
