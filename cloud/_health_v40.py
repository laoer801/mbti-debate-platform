#!/usr/bin/env python3
"""v40.8 完整云端体检 — 用户视角"""
import json, sqlite3, urllib.request, urllib.error, time, subprocess
API = "http://localhost:3001"; DB = "/opt/mbti/data/debate.db"

def get(url, t=6):
    try:
        with urllib.request.urlopen(url, timeout=t) as f: return f.status, json.loads(f.read())
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:200]
    except Exception as e: return 0, str(e)

def post(url, body, t=30):
    r = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(r, timeout=t) as f: return f.status, json.loads(f.read())
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:200]
    except Exception as e: return 0, str(e)

print("═"*60)
print("  云端全面体检 · v40.8")
print("═"*60)

# 1. 端口
print("\n[1] 端口监听 (本机 + 公网)")
import socket
for port in (3001, 3443):
    s = socket.socket(); s.settimeout(2)
    try: s.connect(("127.0.0.1", port)); print(f"  ✅ localhost:{port} OK"); s.close()
    except Exception as e: print(f"  ❌ localhost:{port} {e}")

import subprocess as sp
def sh(cmd):
    p = sp.Popen(cmd, shell=True, stdout=sp.PIPE, stderr=sp.PIPE)
    out, err = p.communicate()
    return p.returncode, out.decode("utf-8", errors="replace"), err.decode("utf-8", errors="replace")

# 2. 服务状态 + PID
print("\n[2] 服务进程")
rc, out, _ = sh("systemctl is-active mbti-debate.service")
print(f"  systemctl: {out.strip()}")
rc, out, _ = sh("ps -ef | grep 'node.*index.js' | grep -v grep | head -1")
print(f"  {out.strip()}")

# 3. .env 完整性
print("\n[3] /opt/mbti/.env 完整性")
rc, out, _ = sh("for k in ZHIHU_ACCESS_SECRET ZHIHU_MODEL_FAST ZHIHU_MODEL_THINKING ZHIHU_MODEL_AGENT ZHIHU_RATE_LIMIT_RPM JWT_SECRET PORT HTTPS_PORT; do printf '  %-26s ' $k; grep -q ^$k= /opt/mbti/.env && echo OK || echo MISSING; done")
print(out)

# 4. 知乎直答
print("[4] /api/zhihu/status")
s, d = get(API+"/api/zhihu/status")
print(f"  HTTP {s} enabled={d.get('enabled') if isinstance(d, dict) else '?'}")
if isinstance(d, dict): print(f"  models: {d.get('models')}  rpmLimit: {d.get('rpmLimit')}")

# 5. LLM 三档
print("\n[5] LLM 三档直连")
for m in ("fast", "thinking", "agent"):
    s, d = post(API+"/api/zhihu/chat", {"model": m, "messages": [{"role":"user","content":"hi"}]})
    if isinstance(d, dict):
        c = d.get("content","")[:60].replace("\n"," ")
        print(f"  ✅ {m:<10} HTTP {s} | {c}")
    else:
        print(f"  ❌ {m:<10} HTTP {s} | {str(d)[:80]}")

# 6. 关键 API 健康
print("\n[6] 关键 API 健康")
for ep in ("/api/health", "/api/scenes", "/api/topics", "/api/pk/rooms/list", "/api/knowledge/search?q=MBTI"):
    s, d = get(API+ep, t=5)
    snippet = ""
    if isinstance(d, dict) and "results" in d: snippet = f"  ({len(d['results'])} 条)"
    if isinstance(d, dict) and "rooms" in d: snippet = f"  ({len(d['rooms'])} 房间)"
    print(f"  ✅ {ep:<40} HTTP {s}{snippet}")

# 7. PK 自动模式状态
print("\n[7] PK 自动模式 (近 1h)")
rc, logs, _ = sh("journalctl -u mbti-debate.service --since '1 hour ago' --no-pager")
auto_count = logs.count("[PK-AUTO]")
judge_ok = logs.count("裁判完成")
judge_fail = logs.count("裁判失败")
summary_ok = logs.count("总结报告已保存")
summary_fail = logs.count("LLM 两次都失败")
print(f"  [PK-AUTO] 日志条数: {auto_count}")
print(f"  裁判成功: {judge_ok} | 裁判失败回退: {judge_fail}")
print(f"  总结落库: {summary_ok} | 总结兜底: {summary_fail}")

# 8. 自动模式跑过的房间
print("\n[8] 最近自动模式房间")
con = sqlite3.connect(DB); con.row_factory = sqlite3.Row
rows = con.execute("""SELECT r.id, r.topic, r.current_phase, r.winner_id,
                        (SELECT COUNT(*) FROM pk_moves WHERE room_id=r.id) moves,
                        (SELECT move_count FROM pk_summaries WHERE room_id=r.id) sm
                     FROM pk_rooms r
                     WHERE r.ai_mode=1 AND r.created_at > (strftime('%s','now')-3600)*1000
                     ORDER BY r.created_at DESC LIMIT 4""").fetchall()
for r in rows:
    print(f"  {r['id']} | {r['current_phase']:<10} | {r['moves']:<3} 发言 | 总结={r['sm']} | 胜方={r['winner_id']}")
con.close()

# 9. 错误日志（仅 Error/throw/限流）
print("\n[9] 错误日志（近 1h）")
err_lines = [l for l in logs.split("\n") if any(k in l for k in ("Error","throw","TypeError","MODULE_NOT","直答限流","HTTP 401","HTTP 429"))]
if err_lines:
    for l in err_lines[-8:]: print(f"  ⚠ {l[:160]}")
else:
    print("  ✅ 无错误")

print("\n" + "═"*60)
print("  体检完成")
print("═"*60)