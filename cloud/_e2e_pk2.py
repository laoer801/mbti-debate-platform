#!/usr/bin/env python3
"""端到端 PK AI 验证 v2"""
import json, time, sqlite3, urllib.request
API = "http://localhost:3001"; DB = "/opt/mbti/data/debate.db"
def post(p, b):
    r = urllib.request.Request(API+p, data=json.dumps(b).encode(), headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(r, timeout=15) as f: return json.loads(f.read())
print("═══ 建房间 ═══"); d = post("/api/pk/ai/create", {"userId":"u_e2e_v2","level":"beginner","topic":"金钱能否买到幸福"}); rid=d["room"]["id"]
print(f"  room={rid} topic={d['room']['topic']}")
for ph in ("preparation","opening"):
    try: post(f"/api/pk/{rid}/phase", {"phase":ph,"userId":"u_e2e_v2"}); print(f"  → {ph}: ok")
    except urllib.error.HTTPError as e: print(f"  → {ph}: {e.code}"); break
print("\n═══ 等 8 秒 AI kickoff ═══"); time.sleep(8)
con = sqlite3.connect(DB)
rows = con.execute("SELECT content FROM pk_moves WHERE room_id=? AND user_id LIKE 'ai\\_\\_%' ESCAPE '\\' ORDER BY created_at ASC LIMIT 6", (rid,)).fetchall()
print(f"  AI 写了 {len(rows)} 条")
for i,r in enumerate(rows,1): print(f"  [{i}] {r[0][:150]}")
con.close()