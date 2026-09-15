#!/usr/bin/env python3
"""Snapshot observer coverage; a stale/stopped/missing process is a retained failure."""
import argparse,datetime,json,os
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--events',required=True,type=Path);p.add_argument('--target',required=True);p.add_argument('--out',required=True,type=Path);a=p.parse_args()
owned=Path(__file__).resolve().parent/'run'
if not a.events.resolve().is_relative_to(owned) or not a.out.resolve().is_relative_to(owned):p.error('Only this preparation run folder is permitted')
if a.out.exists():p.error('Checkpoint receipt already exists')
now=datetime.datetime.now(datetime.timezone.utc)
try:
 h=json.loads(Path(str(a.events)+'.health.json').read_text());time=datetime.datetime.fromisoformat(h['time'].replace('Z','+00:00'));age=(now-time).total_seconds()
 try:os.kill(h['collectorPid'],0);alive=True
 except ProcessLookupError:alive=False
 passed=h['state']=='ready' and h['target']==a.target and 0<=age<=6 and alive and not h['capped']
 result={'time':now.isoformat(),'passed':passed,'observedHealth':h,'ageSeconds':age,'collectorProcessAlive':alive,'meaning':'Confirms observer health at this boundary only; full interval also requires no stop/detach/cap or heartbeat gaps in final log.'}
except Exception as e:result={'time':now.isoformat(),'passed':False,'reason':str(e)}
a.out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'passed':result['passed'],'receipt':str(a.out)}));raise SystemExit(0 if result['passed'] else 1)
