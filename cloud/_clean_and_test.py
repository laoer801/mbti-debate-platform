#!/usr/bin/env python3
"""清理卡在 judging 的历史房间 + 跑一局验证当前版本"""
import json, sqlite3, urllib.request, urllib.error, time
API = "http://localhost:3001"; DB = "/opt/mbti/data/debate.db"
con = sqlite3.connect(DB); con.row_factory = sqlite3.Row

# 1. 清理卡住的房间
print("═══ 清理卡在 judging 的历史房间 ═══")
stuck = con.execute("SELECT id, topic FROM pk_rooms WHERE ai_mode=1 AND current_phase IN ('judging')").fetchall()
for r in stuck:
    moves = con.execute("SELECT COUNT(*) FROM pk_moves WHERE room_id=?", (r["id"],)).fetchone()[0]
    # 强制标 finished + 启发式胜方（AI 因为几乎全 AI 发言）
    con.execute("UPDATE pk_rooms SET current_phase='finished', winner_id='ai__master' WHERE id=?", (r["id"],))
    # 写一个兜底总结（避免下次查询时缺记录）
    summary = f"辩题「{r['topic']}」AI 房自动跑完 {moves} 条发言（启发式裁判兜底��本）。"
    try:
        con.execute("INSERT OR IGNORE INTO pk_summaries (id, room_id, topic, winner_id, winner_side, summary, key_points, improvement, move_count, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (f"sum_{r['id']}", r["id"], r["topic"], "ai__master", "反方", summary, "", "", moves, 0, int(time.time()*1000)))
        print(f"  ✅ {r['id']} → finished (winner=ai__master, {moves} 发言)")
    except Exception as e:
        print(f"  ⚠ {r['id']}: {e}")
con.commit()

# 2. 看清理后状态
print("\n═══ 清理后状态 ═══")
rows = con.execute("SELECT id, current_phase, winner_id FROM pk_rooms WHERE ai_mode=1 ORDER BY created_at DESC LIMIT 6").fetchall()
for r in rows:
    print(f"  {r['id']} | {r['current_phase']:<10} | winner={r['winner_id']}")
con.close()

# 3. 跑一局验证当前版本
print("\n═══ 跑一局验证当前版本（fast 档·开场 ~12s 看完整闭环） ═══")
def post(p, b):
    r = urllib.request.Request(API+p, data=json.dumps(b).encode(), headers={"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(r, timeout=15) as f: return json.loads(f.read())
    except urllib.error.HTTPError as e: return {"_err": e.code}

d = post("/api/pk/ai/create", {"userId": "u_hc", "level": "beginner", "topic": "云端是不是没问题了"})
if "_err" in d:
    print(f"  ❌ 建房间失败: {d}"); exit(1)
rid = d["room"]["id"]
print(f"  房间 {rid} 已建，开始推进...")
post(f"/api/pk/{rid}/phase", {"phase": "preparation", "userId": "u_hc"})

# 监控 7 分钟
con2 = sqlite3.connect(DB); con2.row_factory = sqlite3.Row
last_phase = None; t0 = time.time()
for i in range(420):
    row = con2.execute("SELECT current_phase FROM pk_rooms WHERE id=?", (rid,)).fetchone()
    if row["current_phase"] != last_phase:
        last_phase = row["current_phase"]
        elapsed = int(time.time() - t0)
        print(f"  [{elapsed:3d}s] phase → {row['current_phase']}")
        if row["current_phase"] == "finished":
            sum_row = con2.execute("SELECT winner_side, move_count, summary FROM pk_summaries WHERE room_id=?", (rid,)).fetchone()
            if sum_row:
                print(f"\n  ✅ 完整跑通: {sum_row['winner_side']}胜 | {sum_row['move_count']} 条 | {sum_row['summary'][:80]}")
            con2.close()
            exit(0)
    time.sleep(1)
print("  ⏱️ 超时未 finished")
con2.close()