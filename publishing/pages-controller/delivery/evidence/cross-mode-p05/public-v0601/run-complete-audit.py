import subprocess
from pathlib import Path
p=Path('/Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/p05-team-public-audit-822f3290/root-operations')
with (p/"audit-complete.stdout").open("xb") as o,(p/"audit-complete.stderr").open("xb") as e:
 r=subprocess.run(['/Users/oleksandr.mekhovov/.local/share/mise/installs/node/20.19.5/bin/node', '/Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/p05-team-public-audit-822f3290/tools/audit-main.mjs', '--binding', '/Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/p05-team-public-audit-822f3290/tools/inputs/c1576deeab14bea21b00449912a6a465c3efaf90/binding.json', '--binding-sha', 'd3166766861a8d58acefc6fb5e5d9fd4e34056cf946a6e471b34fa01e269e74c', '--out', 'complete-1'],stdout=o,stderr=e)
(p/"audit-complete.exit").write_text(str(r.returncode)+"\n")
print("audit exit",r.returncode)
