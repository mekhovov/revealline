#!/usr/bin/env python3
import argparse,datetime,hashlib,json,os,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("--stage",type=Path,required=True);p.add_argument("--artifact",type=Path,required=True);p.add_argument("--role",choices=["company"],required=True);a=p.parse_args()
m=json.loads(a.artifact.read_text()); role=a.role
assert m["name"]=="company-candidate-7842d6249217eade6d4ea5f7220b6dd8d4ff01af"
assert m["workflow_run"]["head_sha"]=="7842d6249217eade6d4ea5f7220b6dd8d4ff01af" and not m["expired"]
assert isinstance(m["size_in_bytes"],int) and 0<m["size_in_bytes"]<=2_000_000_000
assert m["digest"].startswith("sha256:")
space=os.statvfs(a.stage);assert space.f_bavail*space.f_frsize>=3*1024**3+m["size_in_bytes"]
out=a.stage/(role+"-original-artifact.zip");err=a.stage/(role+"-download.stderr");intent=a.stage/(role+"-download-intent.json");terminal=a.stage/(role+"-download-terminal.json")
assert not any(x.exists() for x in [out,err,intent,terminal])
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
intent.write_text(json.dumps({"UTC":now(),"artifactId":m["id"],"bytes":m["size_in_bytes"],"digest":m["digest"],"head":"7842d6249217eade6d4ea5f7220b6dd8d4ff01af","retry":False},indent=2)+"\n")
h=hashlib.sha256();n=0;last=0;overflow=False
with out.open("xb") as f,err.open("xb") as e:
 proc=subprocess.Popen(["gh","api",f"repos/mekhovov/revealline/actions/artifacts/{m['id']}/zip"],stdout=subprocess.PIPE,stderr=e)
 for block in iter(lambda:proc.stdout.read(1024*1024),b""):
  n+=len(block);h.update(block)
  if n<=m["size_in_bytes"]:f.write(block)
  else:overflow=True
  if n-last>=64*1024*1024:print(json.dumps({"bytesRead":n,"expected":m["size_in_bytes"]}),flush=True);last=n
 rc=proc.wait();f.flush();os.fsync(f.fileno())
record={"UTC":now(),"exitCode":rc,"artifactId":m["id"],"bytesRead":n,"sha256":h.hexdigest(),"expectedBytes":m["size_in_bytes"],"expectedSHA256":m["digest"].split(":",1)[1],"overflow":overflow,"stderrSHA256":hashlib.sha256(err.read_bytes()).hexdigest()}
record["pass"]=rc==0 and n==m["size_in_bytes"] and "sha256:"+h.hexdigest()==m["digest"] and not overflow
terminal.write_text(json.dumps(record,indent=2)+"\n");print(json.dumps(record),flush=True)
assert record["pass"],"Original artifact readback failed; original/partial and actual terminal preserved"
