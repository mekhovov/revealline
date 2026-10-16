import concurrent.futures,datetime,hashlib,json,pathlib,subprocess,sys
root=pathlib.Path.cwd()
out=root/"final-authority"
out.mkdir(exist_ok=False)
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
repo="repos/mekhovov/revealline"
roles={
 "run":repo+"/actions/runs/35962558115",
 "jobs":repo+"/actions/runs/35962558115/jobs?per_page=100",
 "deployment":repo+"/deployments/6631370106",
 "statuses":repo+"/deployments/6631370106/statuses?per_page=100",
 "artifacts":repo+"/actions/runs/35962558115/artifacts?per_page=100",
 "latest-deployment":repo+"/deployments?environment=github-pages&per_page=1",
}
def fetch(item):
 role,endpoint=item
 begin=datetime.datetime.now(datetime.timezone.utc).isoformat()
 proc=subprocess.run(["gh","api",endpoint],capture_output=True,timeout=40)
 if proc.returncode:
  raise RuntimeError(role+" API request failed: "+proc.stderr.decode()[:512])
 body=proc.stdout
 if len(body)>200000:
  raise RuntimeError(role+" API original exceeds 200KB bound")
 (out/(role+".json")).write_bytes(body)
 value=json.loads(body)
 pin={"path":"final-authority/"+role+".json","bytes":len(body),"sha256":hashlib.sha256(body).hexdigest(),"endpoint":endpoint,"startedAt":begin,"finishedAt":datetime.datetime.now(datetime.timezone.utc).isoformat()}
 if role=="latest-deployment":
  okay=isinstance(value,list) and len(value)==1 and value[0]["id"]==6631370106
  pin["latestDeploymentUnchanged"]=okay
 else:
  old=json.loads((root/"authority"/(role+".json")).read_bytes())
  okay=value==old
  pin["exactOriginalJSONObjectUnchanged"]=okay
 return role,pin,okay
results=[]
errors=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for fut in [pool.submit(fetch,item) for item in roles.items()]:
  try: results.append(fut.result())
  except Exception as error: errors.append(str(error))
try: results.append(fetch(("main",repo+"/git/ref/heads/main")))
except Exception as error: errors.append(str(error))
end=datetime.datetime.now(datetime.timezone.utc)
report=json.loads((root/"http/http-20260924T061200Z-494edbf9/http-report.json").read_bytes())
elapsed=(end-datetime.datetime.fromisoformat(report["startedAt"])).total_seconds()
okay=not errors and len(results)==7 and all(x[2] for x in results) and elapsed<1800 and report["status"]=="PASS"
proof={"format":"revealline-main-v097-final-authority-check.v1","status":"PASS" if okay else "FAIL","startedAt":started,"finishedAt":end.isoformat(),"auditAndFinalCheckElapsedSeconds":elapsed,"auditDeadlineSeconds":1800,"controllerCommit":"ca3f3fd638e02e1907a0811d7759d24ba8f726b6","runId":35962558115,"deploymentId":6631370106,"deploymentStatusId":18767390016,"receiptArtifactId":10792966805,"httpReport":{"path":"http/http-20260924T061200Z-494edbf9/http-report.json","sha256":hashlib.sha256((root/"http/http-20260924T061200Z-494edbf9/http-report.json").read_bytes()).hexdigest()},"checks":{x[0]:x[1] for x in results},"errors":errors,"scope":"Fresh read-only GitHub API originals after the complete public HTTP audit; exact JSON object equality with the admitted authority plus latest Pages deployment identity. No publication mutation."}
(out/"report.json").write_text(json.dumps(proof,indent=2)+"\n")
print(json.dumps(proof,indent=2))
sys.exit(0 if okay else 1)
