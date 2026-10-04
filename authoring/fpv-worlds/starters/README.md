# Editable FPV route starters

Ten original, standalone projects provide five route shapes in industrial and
natural settings. Each project has one course and independent Self-level and Acro
routes. They use the existing World Studio project, collision, flight and archive
formats. Nothing is added to the built-in challenge catalogue or simulator package.

This is the first D4 authoring increment. The explicit spatial editor mode selector
and offline qualification are follow-ups. The [functional receipts](evidence/README.md)
record twenty completed authoring flights with matching independent replays and
237 passed browser checks, including an actual spatial drag. Original proofs and
the earlier failed browser receipt are retained.

## Build and open

Run from the repository root with the repository's supported Node version:

```sh
node authoring/fpv-worlds/starters/build.mjs --out /tmp/fpv-creator-starters
```

The destination must not exist. No installation, network access or external
authoring tool is required. The builder validates all ten projects, sweeps their
nominal paths through the actual collision engine, imports both exported archive
formats and checks that rebuilding each archive produces identical bytes.

Open the generated `index.html` to download an individual editable ZIP. Each
project also has a `.rlpack`, compiled `.project.json`, SHA-256 hashes and byte
sizes in `qualification.json`. ZIPs use the supported uncompressed STORE profile;
ordinary desktop ZIP tools may produce an unsupported compressed archive.

For ordinary-control completion and independent replay qualification as well:

```sh
node authoring/fpv-worlds/starters/build.mjs --out /tmp/fpv-creator-starters-flights --fly
```

An optional `--id creator-industrial-sweeper` limits a diagnostic run to one
project. Proofs are authoring sessions: they grant no rewards. The existing
authoring pilot drives the unchanged fixed-step flight simulation, then the
ordinary replay validator checks the final state. A failed run exits nonzero and
keeps its already-written artifacts; use a new output directory for a new run.
The authoring pilot must complete with zero hard contacts. This is reproducible
functional evidence, not a human flight or device qualification.

## Use a starter in World Studio

1. Open **Library → Import .rlpack / editable project** and select a generated
   `.zip`. Import installs that project locally. Choose **Edit** in its pack row
   to open the course in **Workshop**.
2. Move a route marker with its arrows or numeric coordinates. Duplicate,
   reorder or remove an objective, then check **Undo** and **Redo**. Keep the
   challenge/world IDs stable while editing that project; use **Create a copy**
   when you want a separate identity.
3. The routes differ by mode, so the current spatial controls edit **Self-level
   only**. To change Acro, open **Advanced → Challenge JSON**, edit `steps.acro`
   and choose **Validate & apply JSON**. Do not assume equal array indexes refer
   to corresponding objectives in the two routes.
4. Select the intended flight mode in Settings, choose **Test flight**, and check
   the full route. Repeat for the other mode. Preview is unscored.
5. **Export editable project** preserves the project metadata and both routes.
   Import that ZIP again, reopen it and check the edited coordinates. **Export
   world pack** makes the supported playable archive. Keep the previous archive
   if you need its exact revision for a recording or playlist.

The pack editor opens the first course. Supplying one course per project avoids
requiring users to fork a multi-course project merely to edit another route.

| Shape       | Self-level route                                       | Acro route                                   |
| ----------- | ------------------------------------------------------ | -------------------------------------------- |
| Sweeper     | Broad arc with settling marker                         | Separate inside arc                          |
| Hairpin     | Two turn-zone markers and separate return lane         | One central turn marker, tighter return line |
| Chicane     | Wide alternating offsets with an early settling marker | Separate smaller offsets                     |
| Climb       | Intermediate level-off, 7 m exit                       | Continuous ascent to 8 m                     |
| Split level | Below the deck, then above it                          | Above the deck, then below it                |

Industrial projects reuse the simulator's Container Yard environment and natural
projects its Woodland environment. Authored obstacles are original closed boxes;
the split-level project adds a 4–5 m deck and two side supports. The route and
collision data are included in each project. Decorative scenery and its existing
licenses remain part of the compatible simulator runtime, not assets owned or
redistributed by these projects. These are small authoring examples, not new
finished worlds.

## Clearance and metadata ownership

All coordinates use integer millimetres. Flight positions refer to the drone's
lower point; its collision sphere center is one radius above that point. The
default 220 mm radius is unchanged. Gate openings are objective regions and do
not themselves establish physical obstacle clearance.

`authoring.clearance.nominalPaths` records an intended approach and exit line for
each mode. Qualification checks spawn/route points and sweeps every airborne
segment using a sphere expanded by 500 mm around the original center. Takeoff
and landing segments use the actual radius because they meet the ground. The
nominal margin does not certify every possible flight path, turning speed or
future edit. Retest both modes after moving markers, obstacles or the landing pad.

Source `definitions` own versioned worlds, layouts and challenges. Their separate
mode orders compile into runtime course arrays. Project-level `authoring`
metadata owns the template descriptions, nominal paths and guidance. World Studio
regenerates layered definitions during editing; its export preserves root metadata
but does **not** recompute these r1 nominal paths. Keep revised guidance synchronized
with edited geometry yourself, and revise authored content identities explicitly
before distributing changed gameplay as a new revision.

These projects have no imported scene anchors, source bindings, model assets or
local overrides to reconcile. Existing runtime physics, rewards, world identities,
replay rules and 104-file / 16 MiB package limits remain unchanged. Because this
directory is authoring-only, its incremental optional-runtime source cost is zero.

## Admitted editor verification

The separate fixture generator accepts the frozen admitted player used for this
qualification and a successful `--fly` output. It verifies every source hash,
then hardlinks the player and generated artifacts into a new directory. It never
changes a player module or its automatic mount guard. The small host HTML copy
only adds isolated native IndexedDB, temporary settings and download capture.

```sh
node authoring/fpv-worlds/starters/prepare-browser.mjs \
  --player /path/to/fpv-world-disposal-admitted-player-d9ad2561e \
  --artifacts /tmp/fpv-creator-starters-flights \
  --out /tmp/fpv-creator-editor
python3 -m http.server 8884 --bind 127.0.0.1 --directory /tmp/fpv-creator-editor
```

Open `http://127.0.0.1:8884/` and choose **Run import and numeric editor checks**.
The fixture checks all ten ZIP identities with the admitted compiler, then uses
the public UI for two representative projects. It checks numeric edits,
Undo/Redo, export/reimport, original retained and edited active pack revisions,
four original replays, and online reopening with the same native IndexedDB.

When stage one passes, drag the selected upper gate's translation arrow in the
actual 3D canvas a small distance. Choose **Check spatial edit and Undo/Redo**.
The second stage requires trusted pointer events and a committed spatial edit,
then verifies its history, mode identity, exports, installation and reopening.
Download the receipt. Keep a failed fixture untouched and use a fresh output
directory for a corrected run. This fixture does not establish service-worker
installation or offline access. Its edited copies do not inherit the original
routes' flight or nominal-clearance qualification.

## Українською

Десять окремих проєктів містять п'ять форм маршруту у промисловому та природному
середовищах. Кожен проєкт має одне завдання й незалежні маршрути самовирівнювання
та Acro. Це перший крок D4; вибір режиму у просторовому редакторі та перевірка
автономного доступу будуть окремими наступними кроками. Збережено результати
двадцяти польотів із точним повторенням та 237 успішних перевірок у браузері,
зокрема фактичного перетягування маркера у просторовому редакторі.

Команда збірки вище створює `index.html` з посиланнями на редаговані ZIP. Відкрийте
**Бібліотека → Імпорт .rlpack / проєкту**, оберіть ZIP, а потім
**Редагувати**. Курс відкриється в **Майстерні**. Імпорт установлює проєкт локально. Переміщуйте, дублюйте та
впорядковуйте маркери; перевіряйте **Скасувати** й **Повторити**. Для цих різних
маршрутів просторові засоби змінюють лише самовирівнювання. Acro змінюйте в
**Додатково → JSON завдання**, у масиві `steps.acro`, після чого перевірте й
застосуйте JSON. Перевірте політ в обох режимах та експортуйте редагований проєкт.

Плавний поворот навчає проходити дугу; розворот має окремі смуги; шикана чергує
ліві та праві зміщення; набір висоти залишає місце для вирівнювання; два рівні
мають відкриту бічну зону зміни висоти. Порядок проходження двох рівнів у режимах
протилежний. Кожен маршрут завершується посадкою на землі.

Номінальний запас становить 0,5 м понад радіус дрона 0,22 м. Висота визначена
нижньою точкою дрона. Для зльоту та посадки перевіряється фактичний радіус без
додаткового запасу біля землі. Перевірка заданої траєкторії не гарантує безпеку
інших ліній або майбутніх змін. Метадані `authoring` описують r1, зберігаються
під час експорту й не перераховуються редактором після змін. Перевіряйте обидва
режими повторно та зберігайте попередні архіви для точних версій записів польоту.

Нові стандартні завдання, фізика, винагороди та розміри пакунків не змінюються.
Декорації належать сумісному симулятору. Перевірки реальних пристроїв, новачків,
продуктивності та завершення всього D4 не заявляються.
