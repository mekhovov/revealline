# Replay startup test correction

The first v0.60.0 candidate, `02127f1c45f4bb35e0df1cafd6e0bf682f80bdc0`, failed manual qualification run [35188267111](https://github.com/mekhovov/revealline/actions/runs/35188267111): shard 4 reported **1,256/1,257 passing**. The early display test exhausted 150 `setImmediate` turns in 30.44 ms while the cold module graph was loading. Other jobs were still running at the retained observation; this record does not claim their final outcomes. No qualified frozen release follows from that run.

Both held-boot tests now wait for the real application to enter its intercepted startup fetch. That fetch remains held while the same preference assertions run. Import failure propagates, and a five-second diagnostic deadline bounds a missing entry. This removes event-loop iteration counting without moving assertions past startup or changing production behavior. Cleanup closes the host, releases and drains a held import, closes any late owner, then restores fixture globals; its diagnostic timer is also cleared.

The eight complete affected files pass **57/57 on Node 20.19.5 and Node 22.22.2**, sequentially at 100 MiB. Independent static review found no actionable issue. The final production files remain identical to the earlier native observations; fresh complete qualification and public checks remain required. Full P05 remains incomplete.

[Originals](originals.zip), [member index](originals-index.json) and [packet receipt](receipt.json) retain the failed hosted log/API snapshot, exact correction review and final local logs. The two runtime counts overlap and are not additive; local success is not hosted or public acceptance.
