#!/usr/bin/env python3
"""为什么打不开——全方位排查"""
import subprocess as sp
def sh(cmd):
    p = sp.Popen(cmd, shell=True, stdout=sp.PIPE, stderr=sp.PIPE)
    out, err = p.communicate()
    return p.returncode, out.decode("utf-8", errors="replace"), err.decode("utf-8", errors="replace")

print("═"*60); print("  为什么打不开 — 全方位排查"); print("═"*60)

print("\n[1] 服务存活")
rc, out, _ = sh("systemctl is-active mbti-debate.service")
print(f"  systemctl: {out.strip()}")
rc, out, _ = sh("ps -ef | grep 'node.*index.js' | grep -v grep | head -3")
print(f"  {out.strip() or '⚠ 无进程'}")

print("\n[2] 端口监听")
rc, out, _ = sh("ss -tlnp 2>/dev/null | grep -E ':3001|:3443' || echo '⚠ 端口未监听'")
print(f"  {out.strip()}")

print("\n[3] 公网连通 (curl 公网 IP)")
for port, label in (("3001", "HTTP"), ("3443", "HTTPS")):
    rc, out, _ = sh(f"curl -sS -k -o /dev/null -w 'http=%{{http_code}} t=%{{time_total}}s\\n' --max-time 5 https://47.114.35.97:{port}/api/health" if port == "3443" else f"curl -sS -o /dev/null -w 'http=%{{http_code}} t=%{{time_total}}s\\n' --max-time 5 http://47.114.35.97:{port}/api/health")
    print(f"  {label} :{port}  → {out.strip()}")

print("\n[4] 本机健康")
rc, out, _ = sh("curl -sS --max-time 5 http://localhost:3001/api/health 2>&1")
print(f"  {out.strip() or '⚠ 无响应'}")

print("\n[5] 错误日志（最近 50 条）")
rc, out, _ = sh("journalctl -u mbti-debate.service -n 50 --no-pager 2>/dev/null | grep -iE 'error|fatal|crash|out of memory|killed|exit|EADDR|ECONNREFUSED' | tail -10")
print(out.strip() or "  ✅ 无错误")

print("\n[6] 资源占用")
rc, out, _ = sh("free -h | head -2; df -h /opt/mbti 2>/dev/null | tail -1")
print(out.strip())

print("\n[7] 30分钟内重启痕迹")
rc, out, _ = sh("journalctl -u mbti-debate.service --since '30 min ago' --no-pager 2>/dev/null | grep -E 'Started|Stopped|Failed|killed|main process exited' | tail -10")
print(out.strip() or "  ✅ 无重启")

print("\n[8] 端到端：打开首页能否拿到 HTML")
rc, out, _ = sh("curl -sS --max-time 5 http://localhost:3001/ 2>&1 | head -c 200")
print(f"  {out.strip() or '⚠ 首页无响应'}")

print("\n[9] 数据库 & 端口并发")
rc, out, _ = sh("curl -sS --max-time 5 -o /dev/null -w 'http=%{http_code} t=%{time_total}s\\n' http://localhost:3001/api/scenes; curl -sS --max-time 5 -o /dev/null -w 'http=%{http_code} t=%{time_total}s\\n' http://localhost:3001/api/topics")
print(out.strip())

print("\n" + "═"*60); print("  排查完成"); print("═"*60)