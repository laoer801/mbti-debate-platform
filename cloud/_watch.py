#!/usr/bin/env python3
"""简化版：每 10s 打印一次状态"""
import time, sqlite3, json, urllib.request
DB = "/opt/mbti/data/debate.db"; rid = "C0FB11F7"  # 已知最近房间
con = sqlite3.connect(DB); con.row_factory = sqlite3.Row
print(f"═══ 监控房间 {rid} ═══")
last_phase = None; last_moves = -1
for i in range(40):  # 最多 6.5 分钟
    row = con.execute("SELECT current_phase, started_at, created_at FROM pk_rooms WHERE id=?", (rid,)).fetchone()
    moves = con.execute("SELECT COUNT(*) FROM pk_moves WHERE room_id=?", (rid,)).fetchone()[0]
    ai_moves = con.execute("SELECT COUNT(*) FROM pk_moves WHERE room_id=? AND user_id LIKE 'ai\\_\\_%' ESCAPE '\\'", (rid,)).fetchone()[0]
    if row["current_phase"] != last_phase or moves != last_moves:
        last_phase = row["current_phase"]; last_moves = moves
        age = (time.time() - row["created_at"]/1000) if row["created_at"] else 0
        print(f"  [{i*10:3d}s] phase={row['current_phase']:<12} moves={moves:<3} ai_moves={ai_moves:<3}")
    if row["current_phase"] == "finished":
        print(f"\n  ✅ 完成!")
        sum_row = con.execute("SELECT * FROM pk_summaries WHERE room_id=?", (rid,)).fetchone()
        if sum_row:
            print(f"\n  📝 总结报告 ({sum_row['winner_side']}胜, {sum_row['move_count']}条, {sum_row['duration_ms']/1000:.0f}s):")
            print("  " + "-"*60)
            print("  " + sum_row["summary"].replace("\n", "\n  "))
        else:
            print("  ❌ 没找到总结报告")
        break
    time.sleep(10)
con.close()