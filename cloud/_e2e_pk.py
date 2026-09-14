#!/usr/bin/env python3
"""
端到端 PK AI 验证：创建 AI 房间 → 推进到 opening → 等 AI kickoff → 抓首次发言
"""
import json, time, sqlite3, urllib.request

API = "http://localhost:3001"
DB = "/opt/mbti/data/debate.db"

def post(path, body):
    req = urllib.request.Request(API + path,
                                 data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

# 1. 建 AI 房间
print("═══ 1️⃣ 建 AI 房间 ═══")
data = post("/api/pk/ai/create", {"userId": "u_e2e_diag", "level": "beginner", "topic": "AI 是否应该拥有创作版权"})
room = data["room"]
rid = room["id"]
print(f"  房间号: {rid}")
print(f"  topic: {room['topic']}")
print(f"  phase: {room['current_phase']}")

# 2. 按序推进：waiting → preparation → opening
print("\n═══ 2️⃣ 按序推进阶段 ═══")
for ph in ("preparation", "opening"):
    try:
        res = post(f"/api/pk/{rid}/phase", {"phase": ph, "userId": "u_e2e_diag"})
        print(f"  → {ph}: ok")
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:200]
        print(f"  → {ph}: 400 — {body}")
        break
    time.sleep(2)  # 让阶段稳定

# 3. 等 6 秒
print("\n═══ 3️⃣ 等 6 秒让 AI kickoff ═══")
time.sleep(6)

# 4. 抓 AI 发言
print("\n═══ 4️⃣ AI 首次发言 ═══")
con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
rows = con.execute("""SELECT content, created_at FROM pk_moves
                     WHERE room_id=? AND user_id LIKE 'ai\_\_%' ESCAPE '\\'
                     ORDER BY created_at ASC LIMIT 8""", (rid,)).fetchall()
for i, r in enumerate(rows, 1):
    ts = time.strftime("%H:%M:%S", time.localtime(r["created_at"]/1000))
    print(f"  [{i:02d} {ts}] {r['content'][:120]}")

# 5. 看 phase 推进后 room 状态
print("\n═══ 5️⃣ room 状态 ═══")
cur = con.execute("SELECT current_phase, topic, phase_started_at FROM pk_rooms WHERE id=?", (rid,)).fetchone()
print(f"  phase={cur['current_phase']} topic={cur['topic'][:40]} phase_started_at={cur['phase_started_at']}")
con.close()