#!/usr/bin/env python3
"""v40.8 端到端：自动模式完整跑一局 PK"""
import json, time, sqlite3, urllib.request, urllib.error
API = "http://localhost:3001"; DB = "/opt/mbti/data/debate.db"
def post(p, b):
    r = urllib.request.Request(API+p, data=json.dumps(b).encode(), headers={"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(r, timeout=15) as f: return json.loads(f.read())
    except urllib.error.HTTPError as e: return {"_err": e.code, "_body": e.read().decode()[:200]}
def now_phase():
    return json.loads(urllib.request.urlopen(API+"/api/pk/rooms/list", timeout=5).read()) if False else None

print("═══ 自动模式完整跑一局 ═══")
# 1. 建房间（直接用 master 难度，看 AI 全自动表现）
print("\n[1] 建 AI 房间 (master)")
d = post("/api/pk/ai/create", {"userId": "u_autotest", "level": "master", "topic": "人工智能是否会取代人类工作"})
rid = d["room"]["id"]
print(f"  room={rid} topic={d['room']['topic']}")

# 2. 启动准备阶段（人工触发，等服务自动跑完后续）
print("\n[2] 触发 preparation")
r = post(f"/api/pk/{rid}/phase", {"phase": "preparation", "userId": "u_autotest"})
print(f"  → {r.get('phase', r.get('_err'))}")

# 3. 监控阶段变化（最长等 6 分钟覆盖 preparation 8s + opening 90s + free_debate 180s + closing 75s + judging 20s）
print("\n[3] 监控自动推进（最长 6 分钟）")
con = sqlite3.connect(DB); con.row_factory = sqlite3.Row
last_phase = None
deadline = time.time() + 360
phase_log = []
while time.time() < deadline:
    row = con.execute("SELECT current_phase, phase_started_at, phase_duration FROM pk_rooms WHERE id=?", (rid,)).fetchone()
    cur = row["current_phase"]
    if cur != last_phase:
        last_phase = cur
        phase_log.append((cur, row["phase_started_at"], row["phase_duration"]))
        print(f"  [{time.strftime('%H:%M:%S')}] phase → {cur}")
        if cur == "finished":
            break
    time.sleep(2)

# 4. 看总结报告
print("\n[4] 检查 pk_summaries")
sum_row = con.execute("SELECT * FROM pk_summaries WHERE room_id=?", (rid,)).fetchone()
if sum_row:
    print(f"  ✅ 总结报告存在")
    print(f"  winner_id={sum_row['winner_id']} winner_side={sum_row['winner_side']} moves={sum_row['move_count']}")
    print(f"  summary 头 240 字: {sum_row['summary'][:240]}")
else:
    print("  ❌ 没找到总结报告")

# 5. AI 总发言数 + 完整一段示例
print("\n[5] AI 发言统计")
rows = con.execute("SELECT content FROM pk_moves WHERE room_id=? AND user_id LIKE 'ai\\_\\_%' ESCAPE '\\' ORDER BY created_at", (rid,)).fetchall()
print(f"  AI 发言总数: {len(rows)}")
for i, r in enumerate(rows[:3], 1): print(f"    [{i}] {r['content'][:100]}")
print(f"    ...")
for i, r in enumerate(rows[-3:], len(rows)-2): print(f"    [{i}] {r['content'][:100]}")

# 6. 房间最终状态
print("\n[6] 房间最终状态")
final = con.execute("SELECT current_phase, winner_id, started_at, created_at FROM pk_rooms WHERE id=?", (rid,)).fetchone()
duration_s = (final['started_at'] - final['created_at']) / 1000 if final['started_at'] else 0
print(f"  phase={final['current_phase']} winner={final['winner_id']}")
print(f"  实际用时: {duration_s:.0f}s")
con.close()
print("\n═══ 完成 ═══")