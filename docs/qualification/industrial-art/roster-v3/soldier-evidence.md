# Industrial roster v3: soldiers

The approved directly overhead treatment now covers all 12 actor families and all 36 existing family/cast identities. This is an explicit `industrial-roster-v3` presentation revision; it does not change gameplay, historical artwork pins, installed Community/Company ownership or the published appearance default.

## What changed

Every family has a distinct compact and detailed silhouette, equipment and six-frame gait cadence. The three existing cast IDs retain their palette identity and add different kit geometry: strapped field kit, repaired asymmetric gear and insulated winter kit. These are original procedural game assets, with transparent backgrounds and no portrait faces or square tokens.

| Family          | Visible identity and motion                                                      |
| --------------- | -------------------------------------------------------------------------------- |
| Lookout         | Binoculars, small rear case, raised scanning gesture                             |
| Patroller       | Wide bedroll, baton and measured stride                                          |
| Runner          | Narrow light harness, long stride and glance/recovery gesture                    |
| Sprinter        | Headset, hydration pack, crouched warning and breathing recovery                 |
| Courier         | Offset bouncing satchel and a briefly inspected map                              |
| Guard           | Shoulder plates and equipment pouches; rifle only when the native actor is armed |
| Refuge seeker   | Hood and broad shelter roll, pointing toward its accepted route                  |
| Switchback      | Trailing scarf and an announced change of direction                              |
| Rendezvous pair | Radio, asymmetric antenna and paired badges/greeting gesture                     |
| Shield bearer   | Broad solid front plate; visible current facing stays authoritative              |
| Brace trooper   | Side armor follows native closed/recovery phases                                 |
| Relay warden    | Broad command pack, twin antennas and small status lights                        |

Each shared descriptor has 22 bounded frames and the nine existing clips: idle, notice, anticipation, move, blocked, recovery, caught, aim and fire. Descriptor import/export uses the existing validator and supported parts; no executable behavior or collision data was added. Cosmetic caught poses feed into the existing family/cast material identity and bounded clean/brutal defeat presentation. The defeat subsystem retains its established small equipment pieces; frame-exact production-kit fragments are not claimed in this batch.

## Review artifacts

[Transparent native-size specimens](soldiers/soldier-roster-v3.png) contain the 12 families in the table order. Columns are tactical, rivals and arcade; each group contains actual 16/24/32 px sprites and a 96 px enlargement. The black shown by some image viewers is not an image background. The [receipt](soldiers/receipt.json) records every specimen coordinate, RGBA hash, source identity and output size. [Animation descriptors](soldiers/soldier-roster-v3-animations.json) can be loaded into the existing shared animation tools.

Reproduce using:

```sh
node scripts/produce-soldier-roster.mjs docs/qualification/industrial-art/roster-v3/soldiers
```

The source renderer produced the 29,228-byte PNG and 62,389-byte descriptor export. It adds **zero decoded runtime atlas bytes**; native drawing still uses the existing pooled/cached presentation ownership and budgets. This is not a claim of zero overall graphics memory or measured device performance.

## Verification

- New soldier regressions: 6/6 passed on Node 22.22.2 and Node 20.20.0.
- Existing overhead/combat presentation: 29/29 passed on Node 22.
- Existing Asset Studio animation, shared Motion Lab and review-motion contracts: 28/28 passed on Node 22.
- Scoped ESLint, Prettier and `git diff --check` passed.
- All 12 silhouettes remain distinct within each cast at 16/24/32 px, without relying on color. All 36 bodies/equipment remain inside the rotating cell at cardinal/diagonal headings and sampled compact/detailed phases. Reduced effects, pause and freeze preserve still poses; specialist armor and native armed eligibility stay authoritative.
- Released, pilot-v1 and overhead-v2 artwork match 648 historical RGBA specimens generated from source `41441fc60a7321bf40a174ba76f2d92291b14aab`.

Two initial redirected scoped-test launches could not start while local disk capacity was exhausted; they are not counted as passes. After space recovery, the listed individual suites completed normally. Human assessment of the expanded roster, actual low-end-device frame time, all live-mode scenes and public/default adoption remain separate qualification evidence.
