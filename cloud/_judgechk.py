#!/usr/bin/env python3
"""复现 judge 调用，看 LLM 真实输出"""
import json, sqlite3, urllib.request, urllib.error
API = "http://localhost:3001"; DB = "/opt/mbti/data/debate.db"
con = sqlite3.connect(DB); con.row_factory = sqlite3.Row
row = con.execute("SELECT id, topic FROM pk_rooms WHERE ai_mode=1 AND current_phase='finished' ORDER BY created_at DESC LIMIT 1").fetchone()
if not row: print("no finished room"); exit()
rid = row["id"]; topic = row["topic"]
con.close()
print(f"rid={rid} topic={topic}")

# 直接调用 judge 端点
body = {"roomId": rid}
r = urllib.request.Request(API+f"/api/pk/{rid}/judge", data=json.dumps(body).encode(), headers={"Content-Type":"application/json"})
try:
    with urllib.request.urlopen(r, timeout=120) as f:
        result = json.loads(f.read())
        print(f"JUDGE OK: winner={result.get('winner')} feedback_len={len(result.get('feedback',''))}")
except urllib.error.HTTPError as e:
    print(f"JUDGE HTTP {e.code}: {e.read().decode()[:300]}")