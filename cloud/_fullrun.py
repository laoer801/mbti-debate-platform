#!/usr/bin/env python3
"""v40.8 完整自动模式验证"""
import json, time, sqlite3, urllib.request, sys
API = "http://localhost:3001"; DB = "/opt/mbti/data/debate.db"

def post(p, b):
    r = urllib.request.Request(API+p, data=json.dumps(b).encode(), headers={"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(r, timeout=15) as f: return json.loads(f.read())
    except urllib.error.HTTPError as e: return {"_err": e.code}

print("[1] 建 AI 房间 (master)", flush=True)
d = post("/api/pk/ai/create", {"userId": "u_autotest2", "level": "master", "topic": "人工智能是否会取代人类工作"})
if "_err" in d:
    print(f"  ERR: {d}", flush=True); sys.exit(1)
rid = d["room"]["id"]
print(f"  room={rid}", flush=True)

print("[2] 触发 preparation", flush=True)
r = post(f"/api/pk/{rid}/phase", {"phase": "preparation", "userId": "u_autotest2"})
print(f"  → {r.get('phase') or r}", flush=True)

print("[3] 监控自动推进（最长 7 分钟）", flush=True)
con = sqlite3.connect(DB); con.row_factory = sqlite3.Row
last_phase = None; last_moves = -1
start_t = time.time()
for i in range(420):  # 7 分钟
    row = con.execute("SELECT current_phase FROM pk_rooms WHERE id=?", (rid,)).fetchone()
    moves = con.execute("SELECT COUNT(*) FROM pk_moves WHERE room_id=?", (rid,)).fetchone()[0]
    ai_m = con.execute("SELECT COUNT(*) FROM pk_moves WHERE room_id=? AND user_id LIKE 'ai\\_\\_%' ESCAPE '\\'", (rid,)).fetchone()[0]
    if row["current_phase"] != last_phase or moves != last_moves:
        last_phase = row["current_phase"]; last_moves = moves
        elapsed = int(time.time() - start_t)
        print(f"  [{elapsed:3d}s] phase={row['current_phase']:<12} moves={moves:<3} ai={ai_m}", flush=True)
    if row["current_phase"] == "finished":
        print(f"\n  ✅ 自动跑完一局！", flush=True)
        sum_row = con.execute("SELECT * FROM pk_summaries WHERE room_id=?", (rid,)).fetchone()
        if sum_row:
            print(f"  📝 总结: {sum_row['winner_side']}胜 | {sum_row['move_count']}条 | {sum_row['duration_ms']/1000:.0f}s", flush=True)
            print(f"  内容: {sum_row['summary'][:200]}", flush=True)
        else:
            print("  ❌ 没找到总结报告", flush=True)
        con.close(); sys.exit(0)
    time.sleep(1)
print("  ⏱️ 7 分钟到，仍未 finished", flush=True)
con.close(); sys.exit(1)